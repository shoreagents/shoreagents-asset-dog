import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { getCached, setCached } from '@/lib/cache-utils'

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  try {
    const cacheKey = 'stats-move'

    // Check cache first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cached = await getCached<any>(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }
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

    const result = {
      movedTodayCount,
      recentMoves,
    }

    // Cache the result with 30 second TTL
    await setCached(cacheKey, result, 30000)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching move statistics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch move statistics' },
      { status: 500 }
    )
  }
}

