import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  // Verify cron secret (for security)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Find inventory items that were deleted more than 30 days ago
    const itemsToDelete = await prisma.inventoryItem.findMany({
      where: {
        isDeleted: true,
        deletedAt: {
          lte: thirtyDaysAgo,
        },
      },
      select: {
        id: true,
        itemCode: true,
      },
    })

    if (itemsToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No inventory items to permanently delete',
        deletedCount: 0,
      })
    }

    // Permanently delete items
    const result = await prisma.inventoryItem.deleteMany({
      where: {
        id: {
          in: itemsToDelete.map(item => item.id),
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: `Permanently deleted ${result.count} inventory item(s)`,
      deletedCount: result.count,
      deletedItemCodes: itemsToDelete.map(item => item.itemCode),
    })
  } catch (error) {
    console.error('Error cleaning up deleted inventory items:', error)
    return NextResponse.json(
      { error: 'Failed to cleanup deleted inventory items' },
      { status: 500 }
    )
  }
}

