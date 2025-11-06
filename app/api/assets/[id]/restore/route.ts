import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // Check delete permission (same as restore permission)
  const permissionCheck = await requirePermission('canDeleteAssets')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const { id } = await params

    // Check if asset exists and is soft-deleted
    const asset = await prisma.assets.findFirst({
      where: {
        id,
        isDeleted: true,
      },
    })

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found or not deleted' },
        { status: 404 }
      )
    }

    // Restore asset
    await prisma.assets.update({
      where: {
        id,
      },
      data: {
        deletedAt: null,
        isDeleted: false,
      },
    })

    return NextResponse.json({ success: true, message: 'Asset restored successfully' })
  } catch (error) {
    console.error('Error restoring asset:', error)
    return NextResponse.json(
      { error: 'Failed to restore asset' },
      { status: 500 }
    )
  }
}

