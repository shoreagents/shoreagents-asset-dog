import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  try {
    // Get recent check-in history (last 10 check-ins)
    const recentCheckins = await prisma.assetsCheckin.findMany({
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
      recentCheckins,
    })
  } catch (error) {
    console.error('Error fetching check-in statistics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch check-in statistics' },
      { status: 500 }
    )
  }
}

