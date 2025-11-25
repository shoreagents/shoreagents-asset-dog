import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { getCached, setCached } from '@/lib/cache-utils'

export async function GET() {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  try {
    const cacheKey = 'stats-lease-return'

    // Check cache first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cached = await getCached<any>(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }
    // Count total returned assets
    const totalReturned = await prisma.assetsLeaseReturn.count({})

    // Get recent lease return history (last 10 returns)
    const recentReturns = await prisma.assetsLeaseReturn.findMany({
      take: 10,
      include: {
        asset: {
          select: {
            id: true,
            assetTagId: true,
            description: true,
          },
        },
        lease: {
          select: {
            id: true,
            lessee: true,
            leaseStartDate: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    const result = {
      totalReturned,
      recentReturns,
    }

    // Cache the result with 30 second TTL
    await setCached(cacheKey, result, 30000)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching lease return statistics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch lease return statistics' },
      { status: 500 }
    )
  }
}

