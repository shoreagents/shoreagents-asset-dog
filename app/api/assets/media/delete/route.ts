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

    const { searchParams } = new URL(request.url)
    const imageUrl = searchParams.get('imageUrl')

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      )
    }

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
    }

    // Optionally delete the file from storage
    // Extract bucket and path from imageUrl
    try {
      const supabaseAdmin = createAdminSupabaseClient()
      
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
          console.error('Failed to delete file from storage:', deleteError)
          // Continue even if storage deletion fails
        }
      }
    } catch (storageError) {
      console.error('Storage deletion error:', storageError)
      // Continue even if storage deletion fails
    }

    // Clear the media files cache so the deletion appears immediately
    if (typeof globalThis !== 'undefined') {
      globalThis.mediaFilesCache = undefined
    }

    return NextResponse.json({ 
      success: true, 
      message: linkedImages.length > 0 
        ? `Deleted ${linkedImages.length} link(s)`
        : `Deleted successfully`,
      deletedLinks: linkedImages.length,
    })
  } catch (error) {
    console.error('Error deleting media:', error)
    
    return NextResponse.json(
      { error: 'Failed to delete media' },
      { status: 500 }
    )
  }
}

