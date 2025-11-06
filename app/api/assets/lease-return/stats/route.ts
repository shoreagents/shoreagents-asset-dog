import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'

export async function GET() {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  try {
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

    return NextResponse.json({
      totalReturned,
      recentReturns,
    })
  } catch (error) {
    console.error('Error fetching lease return statistics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch lease return statistics' },
      { status: 500 }
    )
  }
}

