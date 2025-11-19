import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { retryDbOperation } from '@/lib/db-utils'

export async function GET() {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canViewAssets')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const now = new Date()
    const fiscalYearStart = new Date(now.getFullYear(), 0, 1) // January 1st of current year
    const fiscalYearEnd = new Date(now.getFullYear() + 1, 0, 1) // January 1st of next year

    // Use a single transaction to avoid connection pool exhaustion
    // This ensures all queries use one connection instead of competing for multiple connections
    const [
      assetsByCategoryRaw,
      categories,
      totalActiveAssets,
      totalValueResult,
      checkedOutCount,
      availableCount,
      purchasesInFiscalYear,
      totalActiveCheckouts,
      activeCheckouts,
      totalCheckins,
      recentCheckins,
      totalAssetsUnderRepair,
      assetsUnderRepair,
      leasesExpiring,
      maintenanceDue,
    ] = await retryDbOperation(() =>
      prisma.$transaction([
        // Get asset value by category using Prisma groupBy for efficient database-level aggregation
        prisma.assets.groupBy({
          by: ['categoryId'],
          where: {
            isDeleted: false,
            cost: { not: null },
          },
          _sum: {
            cost: true,
          },
          orderBy: {
            _sum: {
              cost: 'desc',
            },
          },
        }),

        // Fetch all categories to map IDs to names
        prisma.category.findMany({
          select: {
            id: true,
            name: true,
          },
        }),

        // Summary statistics
        prisma.assets.count({
          where: { isDeleted: false },
        }),
        prisma.assets.aggregate({
          where: { isDeleted: false },
          _sum: { cost: true },
        }),
        prisma.assets.count({
          where: {
            isDeleted: false,
            status: { equals: 'Checked out', mode: 'insensitive' },
          },
        }),
        prisma.assets.count({
          where: {
            isDeleted: false,
            status: { equals: 'Available', mode: 'insensitive' },
          },
        }),
        prisma.assets.count({
          where: {
            isDeleted: false,
            OR: [
              {
                purchaseDate: {
                  gte: fiscalYearStart,
                  lt: fiscalYearEnd,
                },
              },
              {
                dateAcquired: {
                  gte: fiscalYearStart,
                  lt: fiscalYearEnd,
                },
              },
            ],
          },
        }),

        // Feed data
        prisma.assetsCheckout.count({
          where: {
            checkins: { none: {} },
          },
        }),
        prisma.assetsCheckout.findMany({
          where: {
            checkins: { none: {} },
          },
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
          orderBy: { checkoutDate: 'desc' },
          take: 10,
        }),
        prisma.assetsCheckin.count(),
        prisma.assetsCheckin.findMany({
          include: {
            asset: {
              select: {
                id: true,
                assetTagId: true,
                description: true,
              },
            },
            checkout: {
              include: {
                employeeUser: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
          orderBy: { checkinDate: 'desc' },
          take: 10,
        }),
        prisma.assetsMaintenance.count({
          where: {
            status: { in: ['Scheduled', 'In progress'] },
          },
        }),
        prisma.assetsMaintenance.findMany({
          where: {
            status: { in: ['Scheduled', 'In progress'] },
          },
          include: {
            asset: {
              select: {
                id: true,
                assetTagId: true,
                description: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),

        // Calendar data
        prisma.assetsLease.findMany({
          where: {
            leaseEndDate: { gte: now },
            returns: { none: {} },
          },
          include: {
            asset: {
              select: {
                id: true,
                assetTagId: true,
                description: true,
              },
            },
          },
          orderBy: { leaseEndDate: 'asc' },
        }),
        prisma.assetsMaintenance.findMany({
          where: {
            status: { in: ['Scheduled', 'In progress'] },
            dueDate: { not: null },
          },
          include: {
            asset: {
              select: {
                id: true,
                assetTagId: true,
                description: true,
              },
            },
          },
          orderBy: { dueDate: 'asc' },
        }),
      ])
    )

    // Process asset value by category - map category IDs to names
    const categoryMap = new Map(categories.map((cat) => [cat.id, cat.name]))
    const assetValueByCategory = assetsByCategoryRaw.map((row) => ({
      name: row.categoryId ? (categoryMap.get(row.categoryId) || 'Uncategorized') : 'Uncategorized',
      value: row._sum.cost ? Number(row._sum.cost) : 0,
    }))

    // Calculate derived values
    const checkedOutAndAvailable = checkedOutCount + availableCount
    const totalValue = totalValueResult._sum.cost ? Number(totalValueResult._sum.cost) : 0

    return NextResponse.json({
      assetValueByCategory,
      activeCheckouts,
      recentCheckins,
      assetsUnderRepair,
      feedCounts: {
        totalActiveCheckouts,
        totalCheckins,
        totalAssetsUnderRepair,
      },
      summary: {
        totalActiveAssets,
        totalValue,
        purchasesInFiscalYear,
        checkedOutCount,
        availableCount,
        checkedOutAndAvailable,
      },
      calendar: {
        leasesExpiring,
        maintenanceDue,
      },
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    )
  }
}

