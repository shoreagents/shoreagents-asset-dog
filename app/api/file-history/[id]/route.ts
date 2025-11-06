import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { getUserPermissions } from '@/lib/permission-utils'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication and permissions
    const { user, error } = await getUserPermissions()
    if (error || !user) {
      return error || NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get userId from auth
    const { verifyAuth } = await import('@/lib/auth-utils')
    const auth = await verifyAuth()
    if (auth.error || !auth.user) {
      return auth.error || NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    const userId = auth.user.id

    const { id } = await params

    // Fetch file history record
    // Note: Using 'as any' temporarily until Prisma client is regenerated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaClient = prisma as any
    const fileHistory = await prismaClient.fileHistory.findUnique({
      where: { id },
    })

    if (!fileHistory) {
      return NextResponse.json(
        { error: 'File history not found' },
        { status: 404 }
      )
    }

    // Check permissions: Admin can delete any, or user can delete their own if they have canManageExport/canManageImport
    const isAdmin = user.role === 'admin'
    const isOwner = fileHistory.userId === userId
    const canDelete = isAdmin || (isOwner && (
      (fileHistory.operationType === 'export' && user.canManageExport) ||
      (fileHistory.operationType === 'import' && user.canManageImport)
    ))

    if (!canDelete) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this file history' },
        { status: 403 }
      )
    }

    // Delete file from Supabase storage if it exists
    if (fileHistory.filePath) {
      try {
        const supabaseAdmin = createAdminSupabaseClient()
        const { error: deleteError } = await supabaseAdmin.storage
          .from('file-history')
          .remove([fileHistory.filePath])

        if (deleteError) {
          console.error('Failed to delete file from storage:', deleteError)
          // Continue with database deletion even if storage deletion fails
        }
      } catch (storageError) {
        console.error('Storage deletion error:', storageError)
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Delete record from database
    await prismaClient.fileHistory.delete({
      where: { id },
    })

    return NextResponse.json(
      { message: 'File history deleted successfully' },
      { status: 200 }
    )
  } catch (error: unknown) {
    console.error('Error deleting file history:', error)
    return NextResponse.json(
      { error: 'Failed to delete file history' },
      { status: 500 }
    )
  }
}

