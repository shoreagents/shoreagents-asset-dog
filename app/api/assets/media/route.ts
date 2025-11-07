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
      metadata?: {
        size?: number
        mimetype?: string
      }
    }>> => {
      const allFiles: Array<{
        name: string
        id: string
        created_at: string
        path: string
        metadata?: {
          size?: number
          mimetype?: string
        }
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
          // It's an image file - include metadata if available
          allFiles.push({
            name: item.name,
            id: item.id || itemPath,
            created_at: item.created_at || new Date().toISOString(),
            path: itemPath,
            metadata: item.metadata ? {
              size: item.metadata.size,
              mimetype: item.metadata.mimetype,
            } : undefined,
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
      metadata?: {
        size?: number
        mimetype?: string
      }
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
        metadata?: {
          size?: number
          mimetype?: string
        }
      }> = []

      // Add files from assets bucket
      assetsFiles.forEach((file) => {
        combinedFiles.push({
          ...file,
          bucket: 'assets',
          path: file.path,
          metadata: file.metadata,
        })
      })

      // Add files from file-history bucket
      fileHistoryFiles.forEach((file) => {
        combinedFiles.push({
          ...file,
          bucket: 'file-history',
          path: file.path,
          metadata: file.metadata,
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

    // First, prepare all file data and extract URLs/assetTagIds
    const fileData = paginatedFiles.map((file) => {
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
      let assetTagId = timestampMatch 
        ? fileNameWithoutExt.substring(0, timestampMatch.index)
        : fileNameWithoutExt.split('-')[0] || fileNameWithoutExt
      
      // If the extracted assetTagId is "media", it's a standalone media upload, not linked to an asset
      // Set it to null so it won't be displayed as an asset
      if (assetTagId === 'media') {
        assetTagId = ''
      }

      const publicUrl = urlData?.publicUrl || ''

      return {
        file,
        publicUrl,
        assetTagId,
        actualFileName,
        // Get file size and type from storage metadata, fallback to database if available
        storageSize: file.metadata?.size,
        storageMimeType: file.metadata?.mimetype,
      }
    })

    // Batch query: Get all linked images in a single query
    const allPublicUrls = fileData.map(fd => fd.publicUrl).filter(Boolean)
    const allAssetTagIds = [...new Set(fileData.map(fd => fd.assetTagId).filter(Boolean))]

    // Build OR conditions for filename matching
    const filenameConditions = fileData.map(fd => ({
      assetTagId: fd.assetTagId,
      imageUrl: { contains: fd.actualFileName }
    })).filter(cond => cond.assetTagId && cond.imageUrl.contains)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allLinkedImages = await (prisma as any).assetsImage.findMany({
      where: {
        OR: [
          { imageUrl: { in: allPublicUrls } },
          ...filenameConditions,
        ]
      },
      select: {
        assetTagId: true,
        imageUrl: true,
        imageType: true,
        imageSize: true,
      },
    })

    // Create a map for quick lookup: imageUrl -> assetTagIds and image metadata
    const imageUrlToAssetTagIds = new Map<string, Set<string>>()
    const assetTagIdToImageUrls = new Map<string, Set<string>>()
    const imageUrlToMetadata = new Map<string, { imageType: string | null; imageSize: number | null }>()
    
    allLinkedImages.forEach((img: { assetTagId: string; imageUrl: string; imageType: string | null; imageSize: number | null }) => {
      if (!img.assetTagId || !img.imageUrl) return
      
      // Store metadata
      imageUrlToMetadata.set(img.imageUrl, {
        imageType: img.imageType || null,
        imageSize: img.imageSize || null,
      })
      
      // Map by imageUrl
      if (!imageUrlToAssetTagIds.has(img.imageUrl)) {
        imageUrlToAssetTagIds.set(img.imageUrl, new Set())
      }
      imageUrlToAssetTagIds.get(img.imageUrl)!.add(img.assetTagId)
      
      // Map by assetTagId (for filename matching)
      if (!assetTagIdToImageUrls.has(img.assetTagId)) {
        assetTagIdToImageUrls.set(img.assetTagId, new Set())
      }
      assetTagIdToImageUrls.get(img.assetTagId)!.add(img.imageUrl)
    })

    // Also check for filename matches in imageUrl
    fileData.forEach(({ publicUrl, assetTagId, actualFileName }) => {
      if (!assetTagId) return
      
      const matchingUrls = Array.from(assetTagIdToImageUrls.get(assetTagId) || [])
        .filter(url => url.includes(actualFileName))
      
      matchingUrls.forEach(url => {
        if (!imageUrlToAssetTagIds.has(url)) {
          imageUrlToAssetTagIds.set(url, new Set())
        }
        imageUrlToAssetTagIds.get(url)!.add(assetTagId)
      })
    })

    // Get all unique asset tag IDs that are linked
    const allLinkedAssetTagIds = new Set<string>()
    fileData.forEach(({ publicUrl }) => {
      const tagIds = imageUrlToAssetTagIds.get(publicUrl)
      if (tagIds) {
        tagIds.forEach(id => allLinkedAssetTagIds.add(id))
      }
    })

    // Batch query: Get all asset deletion status in a single query
    const linkedAssetsInfoMap = new Map<string, boolean>()
    if (allLinkedAssetTagIds.size > 0) {
      const assets = await prisma.assets.findMany({
        where: {
          assetTagId: { in: Array.from(allLinkedAssetTagIds) },
        },
        select: {
          assetTagId: true,
          isDeleted: true,
        }
      })

      assets.forEach(asset => {
        linkedAssetsInfoMap.set(asset.assetTagId, asset.isDeleted || false)
      })
    }

    // Calculate total storage used from ALL files (not just paginated)
    // We need to process all files to get accurate total storage
    const allFileData = allFiles.map((file) => {
      const { data: urlData } = supabaseAdmin.storage
        .from(file.bucket)
        .getPublicUrl(file.path)

      const pathParts = file.path.split('/')
      const actualFileName = pathParts[pathParts.length - 1]
      const fileNameWithoutExt = actualFileName.substring(0, actualFileName.lastIndexOf('.'))
      const timestampMatch = fileNameWithoutExt.match(/-(20\d{2}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)$/)
      const assetTagId = timestampMatch 
        ? fileNameWithoutExt.substring(0, timestampMatch.index)
        : fileNameWithoutExt.split('-')[0] || fileNameWithoutExt

      const publicUrl = urlData?.publicUrl || ''

      return {
        file,
        publicUrl,
        storageSize: file.metadata?.size,
        storageMimeType: file.metadata?.mimetype,
      }
    })

    // Get metadata for all files from database
    const allFilePublicUrls = allFileData.map(fd => fd.publicUrl).filter(Boolean)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allDbImages = await (prisma as any).assetsImage.findMany({
      where: {
        imageUrl: { in: allFilePublicUrls },
      },
      select: {
        imageUrl: true,
        imageType: true,
        imageSize: true,
      },
    })

    const allImageUrlToMetadata = new Map<string, { imageType: string | null; imageSize: number | null }>()
    allDbImages.forEach((img: { imageUrl: string; imageType: string | null; imageSize: number | null }) => {
      if (img.imageUrl) {
        allImageUrlToMetadata.set(img.imageUrl, {
          imageType: img.imageType || null,
          imageSize: img.imageSize || null,
        })
      }
    })

    // Calculate total storage used from all files
    const totalStorageUsed = allFileData.reduce((sum, { publicUrl, storageSize }) => {
      const dbMetadata = allImageUrlToMetadata.get(publicUrl) || { imageType: null, imageSize: null }
      const imageSize = storageSize || dbMetadata.imageSize || null
      return sum + (imageSize || 0)
    }, 0)

    // Build the response (only for paginated images)
    const images = fileData.map(({ file, publicUrl, assetTagId, actualFileName, storageSize, storageMimeType }) => {
      const linkedAssetTagIds = Array.from(imageUrlToAssetTagIds.get(publicUrl) || [])
      const linkedAssetsInfo = linkedAssetTagIds.map(tagId => ({
        assetTagId: tagId,
        isDeleted: linkedAssetsInfoMap.get(tagId) || false,
      }))
      const hasDeletedAsset = linkedAssetsInfo.some(info => info.isDeleted)
      const dbMetadata = imageUrlToMetadata.get(publicUrl) || { imageType: null, imageSize: null }

      // Prefer storage metadata over database metadata (storage is source of truth)
      // Fallback to database metadata if storage metadata is not available
      const imageType = storageMimeType || dbMetadata.imageType || null
      const imageSize = storageSize || dbMetadata.imageSize || null

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
        imageType: imageType,
        imageSize: imageSize,
      }
    })

    return NextResponse.json({
      images,
      pagination: {
        total: totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      },
      storage: {
        used: totalStorageUsed,
        limit: 5 * 1024 * 1024, // 5MB limit (temporary)
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

