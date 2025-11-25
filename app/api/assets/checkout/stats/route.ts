import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { retryDbOperation } from '@/lib/db-utils'
import { getCached, setCached } from '@/lib/cache-utils'

export async function GET() {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  try {
    const cacheKey = 'stats-checkout'

    // Check cache first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cached = await getCached<any>(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }
    // Get recent checkout history (last 5 checkouts) with retry logic
    const recentCheckouts = await retryDbOperation(() =>
      prisma.assetsCheckout.findMany({
        take: 5,
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
    )

    const result = {
      recentCheckouts,
    }

    // Cache the result with 30 second TTL
    await setCached(cacheKey, result, 30000)

    return NextResponse.json(result)
  } catch (error: unknown) {
    const prismaError = error as { code?: string; message?: string }
    // Only log non-transient errors
    if (prismaError?.code !== 'P1001') {
      console.error('Error fetching checkout statistics:', error)
    }
    return NextResponse.json(
      { error: 'Failed to fetch checkout statistics' },
      { status: 500 }
    )
  }
}

