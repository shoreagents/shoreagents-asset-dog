import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'

export async function DELETE() {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canManageInventory')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    // Find all soft-deleted items
    const deletedItems = await prisma.inventoryItem.findMany({
      where: {
        isDeleted: true,
      },
      select: {
        id: true,
      },
    })

    if (deletedItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Trash is already empty',
        deletedCount: 0,
      })
    }

    // Permanently delete all soft-deleted items
    const result = await prisma.inventoryItem.deleteMany({
      where: {
        isDeleted: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Permanently deleted ${result.count} item(s)`,
      deletedCount: result.count,
    })
  } catch (error) {
    console.error('Error emptying inventory trash:', error)
    return NextResponse.json(
      { error: 'Failed to empty trash' },
      { status: 500 }
    )
  }
}

