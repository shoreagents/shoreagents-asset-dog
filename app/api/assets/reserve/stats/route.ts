import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  try {
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

    return NextResponse.json({
      totalReserved,
      recentReservations,
    })
  } catch (error) {
    console.error('Error fetching reservation statistics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reservation statistics' },
      { status: 500 }
    )
  }
}

