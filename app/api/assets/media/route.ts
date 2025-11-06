import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { prisma } from '@/lib/prisma'

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg']

// Simple in-memory cache for file listings (cleared on server restart)
// Cache expires after 5 minutes
interface CacheEntry {
  files: Array<{
    name: string
    id: string
    created_at: string
    bucket: string
    path: string
  }>
  timestamp: number
}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Declare global type for cache
declare global {
  var mediaFilesCache: CacheEntry | undefined
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const auth = await verifyAuth()
    if (auth.error || !auth.user) {
      return auth.error || NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check media permission
    const permissionCheck = await requirePermission('canManageMedia')
    if (!permissionCheck.allowed) return permissionCheck.error

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)

    const supabaseAdmin = createAdminSupabaseClient()

    // Helper function to recursively list all files in a folder
    const listAllFiles = async (bucket: string, folder: string = ''): Promise<Array<{
      name: string
      id: string
      created_at: string
      path: string
    }>> => {
      const allFiles: Array<{
        name: string
        id: string
        created_at: string
        path: string
      }> = []

      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .list(folder, {
          limit: 1000,
          sortBy: { column: 'created_at', order: 'desc' },
        })

      if (error) {
        return allFiles
      }

      if (!data) return allFiles

      for (const item of data) {
        const itemPath = folder ? `${folder}/${item.name}` : item.name
        const lastDotIndex = item.name.lastIndexOf('.')
        const ext = lastDotIndex > 0 
          ? item.name.toLowerCase().substring(lastDotIndex)
          : ''
        
        // In Supabase Storage:
        // - Files have an id and metadata
        // - Folders don't have an id (id is null/undefined)
        // Check if it's a folder by checking if id is missing
        const isFolder = item.id === null || item.id === undefined
        
        if (isFolder) {
          // It's a folder, recursively list files inside
          const subFiles = await listAllFiles(bucket, itemPath)
          allFiles.push(...subFiles)
        } else if (ext && IMAGE_EXTENSIONS.includes(ext)) {
          // It's an image file
          allFiles.push({
            name: item.name,
            id: item.id || itemPath,
            created_at: item.created_at || new Date().toISOString(),
            path: itemPath,
          })
        }
      }

      return allFiles
    }

    // Check cache first
    let allFiles: Array<{
      name: string
      id: string
      created_at: string
      bucket: string
      path: string
    }> = []
    
    // Note: Supabase Storage doesn't support true server-side pagination for recursive listings
    // We need to fetch all file metadata to sort properly, then paginate in memory
    // This is cached to reduce redundant API calls
    const cached = globalThis.mediaFilesCache
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      // Use cached file list
      allFiles = cached.files
    } else {
      // Fetch fresh file list
      // List all files from assets bucket (recursively from root)
      const assetsFiles = await listAllFiles('assets', '')

      // List all files from file-history bucket in assets folder (recursively)
      const fileHistoryFiles = await listAllFiles('file-history', 'assets')

      // Combine files from both buckets
      const combinedFiles: Array<{
        name: string
        id: string
        created_at: string
        bucket: string
        path: string
      }> = []

      // Add files from assets bucket
      assetsFiles.forEach((file) => {
        combinedFiles.push({
          ...file,
          bucket: 'assets',
          path: file.path,
        })
      })

      // Add files from file-history bucket
      fileHistoryFiles.forEach((file) => {
        combinedFiles.push({
          ...file,
          bucket: 'file-history',
          path: file.path,
        })
      })

      // Sort by created_at descending
      combinedFiles.sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime()
        const dateB = new Date(b.created_at || 0).getTime()
        return dateB - dateA
      })

      allFiles = combinedFiles

      // Cache the result
      globalThis.mediaFilesCache = {
        files: allFiles,
        timestamp: Date.now(),
      }
    }

    // Paginate
    const totalCount = allFiles.length
    const skip = (page - 1) * pageSize
    const paginatedFiles = allFiles.slice(skip, skip + pageSize)

    // Get public URLs for paginated files and check if they're linked to assets
    const images = await Promise.all(
      paginatedFiles.map(async (file) => {
        const { data: urlData } = supabaseAdmin.storage
          .from(file.bucket)
          .getPublicUrl(file.path)

        // Extract full filename and assetTagId
        const pathParts = file.path.split('/')
        const actualFileName = pathParts[pathParts.length - 1]
        
        // Extract assetTagId - filename format is: assetTagId-timestamp.ext
        // Try to get assetTagId by removing timestamp and extension
        // Timestamp is in ISO format: YYYY-MM-DDTHH-MM-SS-sssZ
        const fileNameWithoutExt = actualFileName.substring(0, actualFileName.lastIndexOf('.'))
        // Try to match pattern: assetTagId-YYYY-MM-DDTHH-MM-SS-sssZ
        const timestampMatch = fileNameWithoutExt.match(/-(20\d{2}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)$/)
        const assetTagId = timestampMatch 
          ? fileNameWithoutExt.substring(0, timestampMatch.index)
          : fileNameWithoutExt.split('-')[0] || fileNameWithoutExt

        const publicUrl = urlData?.publicUrl || ''
        
        // Check if this image is linked to any assets in the database
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const linkedImages = await (prisma as any).assetsImage.findMany({
          where: {
            OR: [
              { imageUrl: publicUrl },
              { 
                assetTagId: assetTagId,
                imageUrl: { contains: actualFileName }
              }
            ]
          },
          select: {
            assetTagId: true,
          },
          distinct: ['assetTagId'], // Get unique asset tag IDs
        })

        // Get all unique asset tag IDs
        const linkedAssetTagIds = linkedImages.map((img: { assetTagId: string }) => img.assetTagId).filter((id: string | null): id is string => !!id)

        // Check if any of the linked assets are soft-deleted
        const linkedAssetsInfo = await Promise.all(
          linkedAssetTagIds.map(async (tagId: string) => {
            const asset = await prisma.assets.findFirst({
              where: {
                assetTagId: tagId,
              },
              select: {
                isDeleted: true,
              }
            })
            return {
              assetTagId: tagId,
              isDeleted: asset?.isDeleted || false,
            }
          })
        )

        // Check if any asset is deleted (for backward compatibility)
        const hasDeletedAsset = linkedAssetsInfo.some(info => info.isDeleted)

        return {
          id: file.id || file.path,
          imageUrl: publicUrl,
          assetTagId,
          fileName: actualFileName,
          createdAt: file.created_at || new Date().toISOString(),
          isLinked: linkedAssetTagIds.length > 0,
          linkedAssetTagId: linkedAssetTagIds[0] || null, // Keep first one for backward compatibility
          linkedAssetTagIds: linkedAssetTagIds, // Array of all linked asset tag IDs
          linkedAssetsInfo: linkedAssetsInfo, // Array with deletion status for each
          assetIsDeleted: hasDeletedAsset,
        }
      })
    )


    return NextResponse.json({
      images,
      pagination: {
        total: totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    })
  } catch (error) {
    console.error('Error fetching media:', error)
    return NextResponse.json(
      { error: 'Failed to fetch media' },
      { status: 500 }
    )
  }
}

