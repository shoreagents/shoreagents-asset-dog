import { prisma } from '@/lib/prisma'
import { retryDbOperation } from '@/lib/db-utils'
import { getCached, setCached } from '@/lib/cache-utils'
import { formatDateOnly } from '@/lib/date-utils'

export type DashboardStats = {
  assetValueByCategory: Array<{ name: string; value: number }>
  activeCheckouts: Array<{
    id: string
    checkoutDate: string
    expectedReturnDate: string | null
    asset: {
      id: string
      assetTagId: string
      description: string
    }
    employeeUser: {
      id: string
      name: string
      email: string
    } | null
  }>
  recentCheckins: Array<{
    id: string
    checkinDate: string
    asset: {
      id: string
      assetTagId: string
      description: string
    }
    checkout: {
      employeeUser: {
        id: string
        name: string
        email: string
      }
    }
  }>
  assetsUnderRepair: Array<{
    id: string
    dueDate: string | null
    status: string
    maintenanceBy: string | null
    asset: {
      id: string
      assetTagId: string
      description: string
    }
  }>
  feedCounts: {
    totalActiveCheckouts: number
    totalCheckins: number
    totalAssetsUnderRepair: number
  }
  summary: {
    totalActiveAssets: number
    totalValue: number
    purchasesInFiscalYear: number
    checkedOutCount: number
    availableCount: number
    checkedOutAndAvailable: number
  }
  calendar: {
    leasesExpiring: Array<{
      id: string
      leaseEndDate: string | null
      lessee: string
      asset: {
        id: string
        assetTagId: string
        description: string
      }
    }>
    maintenanceDue: Array<{
      id: string
      dueDate: string | null
      title: string
      asset: {
        id: string
        assetTagId: string
        description: string
      }
    }>
  }
}

/**
 * Fetches dashboard statistics from the database
 * This function is called by both the API route and Server Components
 * Includes caching to reduce database load
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  // Check cache first (15 second TTL for dashboard stats - Redis cached)
  // This dramatically reduces database load for frequently accessed data
  const cacheKey = 'dashboard-stats-v3'
  const cached = await getCached<DashboardStats>(cacheKey)
  if (cached) {
    return cached
  }

  try {
    const now = new Date()
    now.setHours(0, 0, 0, 0) // Set to start of day for accurate date comparison
    const fiscalYearStart = new Date(now.getFullYear(), 0, 1) // January 1st of current year
    const fiscalYearEnd = new Date(now.getFullYear() + 1, 0, 1) // January 1st of next year
    // Calculate date 90 days from now for expiring leases
    const expiringThreshold = new Date(now)
    expiringThreshold.setDate(expiringThreshold.getDate() + 90) // 90 days from today

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
          select: {
            id: true,
            dueDate: true,
            status: true,
            maintenanceBy: true,
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

        // Calendar data - leases expiring within the next 90 days
        prisma.assetsLease.findMany({
          where: {
            leaseEndDate: {
              gte: now,
              lte: expiringThreshold, // Only leases expiring within 90 days
            },
            returns: { none: {} }, // Exclude leases that have been returned
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

    const result: DashboardStats = {
      assetValueByCategory,
      activeCheckouts: activeCheckouts.map((checkout) => ({
        ...checkout,
        checkoutDate: checkout.checkoutDate.toISOString(),
        expectedReturnDate: checkout.expectedReturnDate?.toISOString() || null,
      })),
      recentCheckins: recentCheckins.map((checkin) => ({
        ...checkin,
        checkinDate: checkin.checkinDate.toISOString(),
        checkout: {
          employeeUser: checkin.checkout.employeeUser || { id: '', name: '', email: '' },
        },
      })),
      assetsUnderRepair: assetsUnderRepair.map((maintenance) => ({
        id: maintenance.id,
        dueDate: maintenance.dueDate ? formatDateOnly(maintenance.dueDate) : null,
        status: maintenance.status,
        maintenanceBy: maintenance.maintenanceBy || null,
        asset: maintenance.asset,
      })),
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
        leasesExpiring: leasesExpiring.map((lease) => ({
          id: lease.id,
          leaseEndDate: formatDateOnly(lease.leaseEndDate) || null,
          lessee: lease.lessee,
          asset: lease.asset,
        })),
        maintenanceDue: maintenanceDue.map((maintenance) => ({
          id: maintenance.id,
          dueDate: formatDateOnly(maintenance.dueDate) || null,
          title: maintenance.title,
          asset: maintenance.asset,
        })),
      },
    }

    // Cache for 15 seconds (15000 ms) - Redis cached for fast access
    // Subsequent requests will be instant until cache expires
    await setCached(cacheKey, result, 15000)

    return result
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    throw new Error('Failed to fetch dashboard statistics')
  }
}

