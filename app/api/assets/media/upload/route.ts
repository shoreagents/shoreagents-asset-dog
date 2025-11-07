import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { prisma } from '@/lib/prisma'

// Clear the media files cache after upload
declare global {
  var mediaFilesCache: {
    files: Array<{
      name: string
      id: string
      created_at: string
      path: string
      bucket: string
    }>
    timestamp: number
  } | undefined
}

export async function POST(request: NextRequest) {
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

    // Get file from form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size (max 5MB per file)
    const maxFileSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxFileSize) {
      return NextResponse.json(
        { error: 'File size too large. Maximum size is 5MB.' },
        { status: 400 }
      )
    }

    // Check storage limit (5MB total - temporary)
    const storageLimit = 5 * 1024 * 1024 // 5MB limit
    
    // Calculate current storage used directly from storage and database
    // This avoids making an authenticated HTTP request
    let supabaseAdmin = createAdminSupabaseClient()
    
    try {
      // List all files from storage to calculate total size
      const listAllFiles = async (bucket: string, folder: string = ''): Promise<Array<{
        metadata?: { size?: number }
        path: string
      }>> => {
        const allFiles: Array<{ metadata?: { size?: number }; path: string }> = []
        const { data, error } = await supabaseAdmin.storage
          .from(bucket)
          .list(folder, {
            limit: 1000,
          })

        if (error || !data) return allFiles

        for (const item of data) {
          const itemPath = folder ? `${folder}/${item.name}` : item.name
          const isFolder = item.id === null || item.id === undefined
          
          if (isFolder) {
            const subFiles = await listAllFiles(bucket, itemPath)
            allFiles.push(...subFiles)
          } else {
            allFiles.push({ 
              metadata: item.metadata as { size?: number } | undefined,
              path: itemPath
            })
          }
        }

        return allFiles
      }

      const assetsFiles = await listAllFiles('assets', '')
      const fileHistoryFiles = await listAllFiles('file-history', 'assets')
      
      // Calculate storage from files
      let currentStorageUsed = 0
      const allFiles = [...assetsFiles, ...fileHistoryFiles]
      
      // Get sizes from storage metadata
      allFiles.forEach((file) => {
        if (file.metadata?.size) {
          currentStorageUsed += file.metadata.size
        }
      })

      // Also check database for images that might have size info
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dbImages = await (prisma as any).assetsImage.findMany({
        select: {
          imageUrl: true,
          imageSize: true,
        },
      })

      // Create a set of storage file sizes for quick lookup
      const storageSizes = new Set(allFiles.map(f => f.metadata?.size).filter((s): s is number => s !== undefined))

      // Add database sizes for images not already counted from storage
      dbImages.forEach((img: { imageUrl: string; imageSize: number | null }) => {
        if (img.imageSize && !storageSizes.has(img.imageSize)) {
          currentStorageUsed += img.imageSize
        }
      })

      if (currentStorageUsed + file.size > storageLimit) {
        return NextResponse.json(
          { 
            error: `Storage limit exceeded. Current usage: ${(currentStorageUsed / (1024 * 1024)).toFixed(2)}MB / ${(storageLimit / (1024 * 1024)).toFixed(2)}MB` 
          },
          { status: 400 }
        )
      }
    } catch (error) {
      // If we can't check storage, allow upload but log warning
      console.warn('Could not check storage limit:', error)
    }

    // Generate unique file path
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileExtension = file.name.split('.').pop() || 'jpg'
    const sanitizedExtension = fileExtension.toLowerCase()
    // Use timestamp-based filename for standalone media uploads
    const fileName = `media-${timestamp}.${sanitizedExtension}`
    const filePath = `assets/${fileName}` // Upload to assets folder in bucket

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase storage bucket 'assets' (or 'file-history/assets' if assets bucket doesn't exist)
    let publicUrl: string | null = null
    let finalFilePath = filePath

    const { error: uploadError } = await supabaseAdmin.storage
      .from('assets')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      // If assets bucket doesn't exist, try file-history bucket
      if (uploadError.message.includes('Bucket not found') || uploadError.message.includes('not found')) {
        // Keep the same path structure for file-history bucket
        const fallbackPath = filePath
        const { error: fallbackError } = await supabaseAdmin.storage
          .from('file-history')
          .upload(fallbackPath, buffer, {
            contentType: file.type,
            upsert: false,
          })

        if (fallbackError) {
          console.error('Storage upload error:', fallbackError)
          return NextResponse.json(
            { error: 'Failed to upload image to storage', details: fallbackError.message },
            { status: 500 }
          )
        }

        // Get public URL
        const { data: urlData } = supabaseAdmin.storage
          .from('file-history')
          .getPublicUrl(fallbackPath)

        publicUrl = urlData?.publicUrl || null
        finalFilePath = fallbackPath
      } else {
        console.error('Storage upload error:', uploadError)
        return NextResponse.json(
          { error: 'Failed to upload image to storage', details: uploadError.message },
          { status: 500 }
        )
      }
    } else {
      // Get public URL
      const { data: urlData } = supabaseAdmin.storage
        .from('assets')
        .getPublicUrl(filePath)

      publicUrl = urlData?.publicUrl || null
    }

    if (!publicUrl) {
      return NextResponse.json(
        { error: 'Failed to get public URL for uploaded image' },
        { status: 500 }
      )
    }

    // Clear the media files cache so the new file appears immediately
    if (typeof globalThis !== 'undefined') {
      globalThis.mediaFilesCache = undefined
    }

    return NextResponse.json({
      filePath: finalFilePath,
      fileName: fileName,
      fileSize: file.size,
      mimeType: file.type,
      publicUrl: publicUrl,
    })
  } catch (error) {
    console.error('Error uploading media:', error)
    return NextResponse.json(
      { error: 'Failed to upload media' },
      { status: 500 }
    )
  }
}

