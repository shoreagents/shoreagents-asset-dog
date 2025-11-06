import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'

export async function GET() {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  try {
    // Count scheduled maintenances today
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const scheduledTodayCount = await prisma.assetsMaintenance.count({
      where: {
        status: 'Scheduled',
        dueDate: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    })

    // Count in progress maintenances
    const inProgressCount = await prisma.assetsMaintenance.count({
      where: {
        status: 'In progress',
      },
    })

    // Get recent maintenances (last 10)
    const recentMaintenances = await prisma.assetsMaintenance.findMany({
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

    return NextResponse.json({
      scheduledTodayCount,
      inProgressCount,
      recentMaintenances,
    })
  } catch (error: any) {
    console.error('Error fetching maintenance stats:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch maintenance stats' },
      { status: 500 }
    )
  }
}

