import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'

export async function GET() {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  try {
    // Count total leased assets (active leases where end date is in future or null)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const totalLeased = await prisma.assetsLease.count({
      where: {
        OR: [
          { leaseEndDate: null },
          { leaseEndDate: { gte: today } },
        ],
      },
    })

    // Get recent lease history (last 10 leases)
    const recentLeases = await prisma.assetsLease.findMany({
      take: 10,
      include: {
        asset: {
          select: {
            id: true,
            assetTagId: true,
            description: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      totalLeased,
      recentLeases,
    })
  } catch (error) {
    console.error('Error fetching lease statistics', error)
    return NextResponse.json(
      { error: 'Failed to fetch lease statistics' },
      { status: 500 }
    )
  }
}

