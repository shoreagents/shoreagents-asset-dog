import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canManageInventory')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const { id } = await params

    // Check if item exists and is deleted
    const item = await prisma.inventoryItem.findUnique({
      where: { id },
    })

    if (!item) {
      return NextResponse.json(
        { error: 'Inventory item not found' },
        { status: 404 }
      )
    }

    if (!item.isDeleted) {
      return NextResponse.json(
        { error: 'Item is not deleted' },
        { status: 400 }
      )
    }

    // Restore the item
    const restoredItem = await prisma.inventoryItem.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedAt: null,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Item restored successfully',
      item: restoredItem,
    })
  } catch (error) {
    console.error('Error restoring inventory item:', error)
    return NextResponse.json(
      { error: 'Failed to restore inventory item' },
      { status: 500 }
    )
  }
}

