import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Count moves made today (based on createdAt, when the move was actually recorded)
    const movedTodayCount = await prisma.assetsMove.count({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    })

    // Get recent move history (last 10 moves)
    const recentMoves = await prisma.assetsMove.findMany({
      take: 10,
      include: {
        asset: {
          select: {
            id: true,
            assetTagId: true,
            description: true,
          },
        },
        employeeUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      movedTodayCount,
      recentMoves,
    })
  } catch (error) {
    console.error('Error fetching move statistics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch move statistics' },
      { status: 500 }
    )
  }
}

