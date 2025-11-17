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

    const body = await request.json()
    const documentUrls = body.documentUrls as string[]

    if (!documentUrls || !Array.isArray(documentUrls) || documentUrls.length === 0) {
      return NextResponse.json(
        { error: 'Document URLs array is required' },
        { status: 400 }
      )
    }

    let totalDeletedLinks = 0
    const supabaseAdmin = createAdminSupabaseClient()

    // Process each document URL
    for (const documentUrl of documentUrls) {
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
        totalDeletedLinks += linkedDocuments.length
      }

      // Delete the file from storage
      try {
        const urlMatch = documentUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/)
        if (urlMatch) {
          const bucket = urlMatch[1]
          const path = urlMatch[2]
          
          // Delete from storage
          const { error: deleteError } = await supabaseAdmin.storage
            .from(bucket)
            .remove([path])

          if (deleteError) {
            console.error(`Failed to delete file from storage: ${documentUrl}`, deleteError)
            // Continue with other files even if one fails
          }
        }
      } catch (storageError) {
        console.error(`Storage deletion error for ${documentUrl}:`, storageError)
        // Continue with other files even if one fails
      }
    }

    // Clear the document files cache so the deletions appear immediately
    if (typeof globalThis !== 'undefined') {
      globalThis.documentFilesCache = undefined
    }

    return NextResponse.json({ 
      success: true, 
      message: `Deleted ${documentUrls.length} document(s)${totalDeletedLinks > 0 ? ` and removed ${totalDeletedLinks} link(s)` : ''}`,
      deletedCount: documentUrls.length,
      deletedLinks: totalDeletedLinks,
    })
  } catch (error) {
    console.error('Error bulk deleting documents:', error)
    
    return NextResponse.json(
      { error: 'Failed to bulk delete documents' },
      { status: 500 }
    )
  }
}


