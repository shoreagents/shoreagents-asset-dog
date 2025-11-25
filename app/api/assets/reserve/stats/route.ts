import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { getCached, setCached } from '@/lib/cache-utils'

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  try {
    const cacheKey = 'stats-reserve'

    // Check cache first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cached = await getCached<any>(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }
    // Count total reserved assets
    const totalReserved = await prisma.assetsReserve.count({})

    // Get recent reservation history (last 10 reservations)
    const recentReservations = await prisma.assetsReserve.findMany({
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
      totalReserved,
      recentReservations,
    }

    // Cache the result with 30 second TTL
    await setCached(cacheKey, result, 30000)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching reservation statistics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reservation statistics' },
      { status: 500 }
    )
  }
}

