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

    // Find assets that were deleted more than 30 days ago
    const assetsToDelete = await prisma.assets.findMany({
      where: {
        isDeleted: true,
        deletedAt: {
          lte: thirtyDaysAgo,
        },
      },
      select: {
        id: true,
        assetTagId: true,
      },
    })

    if (assetsToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No assets to permanently delete',
        deletedCount: 0,
      })
    }

    // Permanently delete assets
    const result = await prisma.assets.deleteMany({
      where: {
        id: {
          in: assetsToDelete.map(a => a.id),
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: `Permanently deleted ${result.count} asset(s)`,
      deletedCount: result.count,
      deletedAssetTags: assetsToDelete.map(a => a.assetTagId),
    })
  } catch (error) {
    console.error('Error cleaning up deleted assets:', error)
    return NextResponse.json(
      { error: 'Failed to cleanup deleted assets' },
      { status: 500 }
    )
  }
}

