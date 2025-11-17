import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { retryDbOperation } from '@/lib/db-utils'

export async function GET() {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  try {
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
              purchaseDate: true,
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

    return NextResponse.json({
      recentCheckouts,
    })
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

