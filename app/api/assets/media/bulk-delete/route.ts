import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

// Clear the media files cache after delete
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

export async function DELETE(request: NextRequest) {
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

    const body = await request.json()
    const imageUrls = body.imageUrls as string[]

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json(
        { error: 'Image URLs array is required' },
        { status: 400 }
      )
    }

    let totalDeletedLinks = 0
    const supabaseAdmin = createAdminSupabaseClient()

    // Process each image URL
    for (const imageUrl of imageUrls) {
      // Find all AssetsImage records linked to this image URL
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const linkedImages = await (prisma as any).assetsImage.findMany({
        where: {
          imageUrl: imageUrl,
        },
        select: {
          id: true,
          assetTagId: true,
        },
      })

      // Delete all database links for this image (if any exist)
      if (linkedImages.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any).assetsImage.deleteMany({
          where: {
            imageUrl: imageUrl,
          },
        })
        totalDeletedLinks += linkedImages.length
      }

      // Delete the file from storage
      try {
        // Try to extract path from URL
        // URLs are like: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
        const urlMatch = imageUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/)
        if (urlMatch) {
          const bucket = urlMatch[1]
          const path = urlMatch[2]
          
          // Delete from storage
          const { error: deleteError } = await supabaseAdmin.storage
            .from(bucket)
            .remove([path])

          if (deleteError) {
            console.error(`Failed to delete file from storage: ${imageUrl}`, deleteError)
            // Continue with other files even if one fails
          }
        }
      } catch (storageError) {
        console.error(`Storage deletion error for ${imageUrl}:`, storageError)
        // Continue with other files even if one fails
      }
    }

    // Clear the media files cache so the deletions appear immediately
    if (typeof globalThis !== 'undefined') {
      globalThis.mediaFilesCache = undefined
    }

    return NextResponse.json({ 
      success: true, 
      message: `Deleted ${imageUrls.length} image(s)${totalDeletedLinks > 0 ? ` and removed ${totalDeletedLinks} link(s)` : ''}`,
      deletedCount: imageUrls.length,
      deletedLinks: totalDeletedLinks,
    })
  } catch (error) {
    console.error('Error bulk deleting media:', error)
    
    return NextResponse.json(
      { error: 'Failed to bulk delete media' },
      { status: 500 }
    )
  }
}

