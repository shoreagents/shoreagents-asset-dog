import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

// Clear the document files cache after delete
declare global {
  var documentFilesCache: {
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
    const documentUrl = searchParams.get('documentUrl')

    if (!documentUrl) {
      return NextResponse.json(
        { error: 'Document URL is required' },
        { status: 400 }
      )
    }

    // Find all AssetsDocument records linked to this document URL
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const linkedDocuments = await (prisma as any).assetsDocument.findMany({
      where: {
        documentUrl: documentUrl,
      },
      select: {
        id: true,
        assetTagId: true,
      },
    })

    // Delete all database links for this document (if any exist)
    if (linkedDocuments.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any).assetsDocument.deleteMany({
        where: {
          documentUrl: documentUrl,
        },
      })
    }

    // Optionally delete the file from storage
    try {
      const supabaseAdmin = createAdminSupabaseClient()
      
      // Try to extract path from URL
      const urlMatch = documentUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/)
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

    // Clear the document files cache so the deletion appears immediately
    if (typeof globalThis !== 'undefined') {
      globalThis.documentFilesCache = undefined
    }

    return NextResponse.json({ 
      success: true, 
      message: linkedDocuments.length > 0 
        ? `Deleted ${linkedDocuments.length} link(s)`
        : `Deleted successfully`,
      deletedLinks: linkedDocuments.length,
    })
  } catch (error) {
    console.error('Error deleting document:', error)
    
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    )
  }
}


