import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { getCached, setCached } from '@/lib/cache-utils'

export async function GET() {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  try {
    const cacheKey = 'stats-dispose'

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

    // Count disposals created today
    const disposedTodayCount = await prisma.assetsDispose.count({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    })

    // Get recent disposals (last 10)
    const recentDisposals = await prisma.assetsDispose.findMany({
      take: 10,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        asset: {
          select: {
            id: true,
            assetTagId: true,
            description: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
            subCategory: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    const result = {
      disposedTodayCount,
      recentDisposals,
    }

    // Cache the result with 30 second TTL
    await setCached(cacheKey, result, 30000)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error fetching dispose stats:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch dispose stats' },
      { status: 500 }
    )
  }
}

