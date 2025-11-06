import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { retryDbOperation } from '@/lib/db-utils'
import { requirePermission } from '@/lib/permission-utils'

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // Check view permission
  const permissionCheck = await requirePermission('canViewAssets')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = Math.min(Math.max(parseInt(searchParams.get('pageSize') || '100', 10), 100), 500) // Clamp between 100-500
    const activityType = searchParams.get('type') // Optional filter: checkout, checkin, move, reserve, lease, leaseReturn, dispose, maintenance
    
    // Get total count FIRST to determine how many records we actually need to fetch
    let totalActivities = 0
    
    if (activityType) {
      // Count only the selected activity type
      switch (activityType) {
        case 'checkout':
          totalActivities = await retryDbOperation(() => prisma.assetsCheckout.count())
          break
        case 'checkin':
          totalActivities = await retryDbOperation(() => prisma.assetsCheckin.count())
          break
        case 'move':
          totalActivities = await retryDbOperation(() => prisma.assetsMove.count())
          break
        case 'reserve':
          totalActivities = await retryDbOperation(() => prisma.assetsReserve.count())
          break
        case 'lease':
          totalActivities = await retryDbOperation(() => prisma.assetsLease.count())
          break
        case 'leaseReturn':
          totalActivities = await retryDbOperation(() => prisma.assetsLeaseReturn.count())
          break
        case 'dispose':
          totalActivities = await retryDbOperation(() => prisma.assetsDispose.count())
          break
        case 'maintenance':
          totalActivities = await retryDbOperation(() => prisma.assetsMaintenance.count())
          break
      }
    } else {
      // Count all activity types
      const [
        checkoutCount,
        checkinCount,
        moveCount,
        reserveCount,
        leaseCount,
        leaseReturnCount,
        disposeCount,
        maintenanceCount
      ] = await Promise.all([
        retryDbOperation(() => prisma.assetsCheckout.count()),
        retryDbOperation(() => prisma.assetsCheckin.count()),
        retryDbOperation(() => prisma.assetsMove.count()),
        retryDbOperation(() => prisma.assetsReserve.count()),
        retryDbOperation(() => prisma.assetsLease.count()),
        retryDbOperation(() => prisma.assetsLeaseReturn.count()),
        retryDbOperation(() => prisma.assetsDispose.count()),
        retryDbOperation(() => prisma.assetsMaintenance.count()),
      ])
      totalActivities = checkoutCount + checkinCount + moveCount + reserveCount + 
                        leaseCount + leaseReturnCount + disposeCount + maintenanceCount
    }

    // Calculate how many records to fetch per activity type
    // For single type: fetch enough to cover current page, but if total is less, fetch all
    // For all types: fetch enough to ensure we have enough data after sorting across all types
    const fetchLimit = activityType 
      ? Math.max(pageSize * page + 100, totalActivities) // For single type, fetch enough for current page or all if total is less
      : Math.max((pageSize * page + 100) * 3, totalActivities) // For all types, fetch 3x page size or all if total is less

    const activities: Array<{
      id: string
      type: string
      assetId: string
      assetTagId: string
      assetDescription: string
      timestamp: Date
      details: Record<string, unknown>
    }> = []

    // Fetch checkouts
    if (!activityType || activityType === 'checkout') {
      const checkouts = await retryDbOperation(() => prisma.assetsCheckout.findMany({
        take: activityType ? fetchLimit : fetchLimit,
        include: {
          asset: {
            select: {
              id: true,
              assetTagId: true,
              description: true,
            }
          },
          employeeUser: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
      }))

      checkouts.forEach(checkout => {
        activities.push({
          id: checkout.id,
          type: 'checkout',
          assetId: checkout.assetId,
          assetTagId: checkout.asset.assetTagId,
          assetDescription: checkout.asset.description,
          timestamp: checkout.createdAt,
          details: {
            employeeName: checkout.employeeUser?.name || null,
            employeeEmail: checkout.employeeUser?.email || null,
            checkoutDate: checkout.checkoutDate,
            expectedReturnDate: checkout.expectedReturnDate,
          }
        })
      })
    }

    // Fetch checkins
    if (!activityType || activityType === 'checkin') {
      const checkins = await retryDbOperation(() => prisma.assetsCheckin.findMany({
        take: activityType ? fetchLimit : fetchLimit,
        include: {
          asset: {
            select: {
              id: true,
              assetTagId: true,
              description: true,
            }
          },
          employeeUser: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
      }))

      checkins.forEach(checkin => {
        activities.push({
          id: checkin.id,
          type: 'checkin',
          assetId: checkin.assetId,
          assetTagId: checkin.asset.assetTagId,
          assetDescription: checkin.asset.description,
          timestamp: checkin.createdAt,
          details: {
            employeeName: checkin.employeeUser?.name || null,
            employeeEmail: checkin.employeeUser?.email || null,
            checkinDate: checkin.checkinDate,
            condition: checkin.condition,
          }
        })
      })
    }

    // Fetch moves
    if (!activityType || activityType === 'move') {
      const moves = await retryDbOperation(() => prisma.assetsMove.findMany({
        take: activityType ? fetchLimit : fetchLimit,
        include: {
          asset: {
            select: {
              id: true,
              assetTagId: true,
              description: true,
            }
          },
          employeeUser: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
      }))

      moves.forEach(move => {
        activities.push({
          id: move.id,
          type: 'move',
          assetId: move.assetId,
          assetTagId: move.asset.assetTagId,
          assetDescription: move.asset.description,
          timestamp: move.createdAt,
          details: {
            moveType: move.moveType,
            moveDate: move.moveDate,
            employeeName: move.employeeUser?.name || null,
            reason: move.reason,
          }
        })
      })
    }

    // Fetch reserves
    if (!activityType || activityType === 'reserve') {
      const reserves = await retryDbOperation(() => prisma.assetsReserve.findMany({
        take: activityType ? fetchLimit : fetchLimit,
        include: {
          asset: {
            select: {
              id: true,
              assetTagId: true,
              description: true,
            }
          },
          employeeUser: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
      }))

      reserves.forEach(reserve => {
        activities.push({
          id: reserve.id,
          type: 'reserve',
          assetId: reserve.assetId,
          assetTagId: reserve.asset.assetTagId,
          assetDescription: reserve.asset.description,
          timestamp: reserve.createdAt,
          details: {
            reservationType: reserve.reservationType,
            reservationDate: reserve.reservationDate,
            employeeName: reserve.employeeUser?.name || null,
            department: reserve.department,
            purpose: reserve.purpose,
          }
        })
      })
    }

    // Fetch leases
    if (!activityType || activityType === 'lease') {
      const leases = await retryDbOperation(() => prisma.assetsLease.findMany({
        take: activityType ? fetchLimit : fetchLimit,
        include: {
          asset: {
            select: {
              id: true,
              assetTagId: true,
              description: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
      }))

      leases.forEach(lease => {
        activities.push({
          id: lease.id,
          type: 'lease',
          assetId: lease.assetId,
          assetTagId: lease.asset.assetTagId,
          assetDescription: lease.asset.description,
          timestamp: lease.createdAt,
          details: {
            lessee: lease.lessee,
            leaseStartDate: lease.leaseStartDate,
            leaseEndDate: lease.leaseEndDate,
          }
        })
      })
    }

    // Fetch lease returns
    if (!activityType || activityType === 'leaseReturn') {
      const leaseReturns = await retryDbOperation(() => prisma.assetsLeaseReturn.findMany({
        take: activityType ? fetchLimit : fetchLimit,
        include: {
          asset: {
            select: {
              id: true,
              assetTagId: true,
              description: true,
            }
          },
          lease: {
            select: {
              lessee: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
      }))

      leaseReturns.forEach(leaseReturn => {
        activities.push({
          id: leaseReturn.id,
          type: 'leaseReturn',
          assetId: leaseReturn.assetId,
          assetTagId: leaseReturn.asset.assetTagId,
          assetDescription: leaseReturn.asset.description,
          timestamp: leaseReturn.createdAt,
          details: {
            lessee: leaseReturn.lease.lessee,
            returnDate: leaseReturn.returnDate,
            condition: leaseReturn.condition,
          }
        })
      })
    }

    // Fetch disposals
    if (!activityType || activityType === 'dispose') {
      const disposals = await retryDbOperation(() => prisma.assetsDispose.findMany({
        take: activityType ? fetchLimit : fetchLimit,
        include: {
          asset: {
            select: {
              id: true,
              assetTagId: true,
              description: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
      }))

      disposals.forEach(disposal => {
        activities.push({
          id: disposal.id,
          type: 'dispose',
          assetId: disposal.assetId,
          assetTagId: disposal.asset.assetTagId,
          assetDescription: disposal.asset.description,
          timestamp: disposal.createdAt,
          details: {
            disposeDate: disposal.disposeDate,
            disposalMethod: disposal.disposalMethod,
            disposeValue: disposal.disposeValue,
            disposeReason: disposal.disposeReason,
          }
        })
      })
    }

    // Fetch maintenances
    if (!activityType || activityType === 'maintenance') {
      const maintenances = await retryDbOperation(() => prisma.assetsMaintenance.findMany({
        take: activityType ? fetchLimit : fetchLimit,
        include: {
          asset: {
            select: {
              id: true,
              assetTagId: true,
              description: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
      }))

      maintenances.forEach(maintenance => {
        activities.push({
          id: maintenance.id,
          type: 'maintenance',
          assetId: maintenance.assetId,
          assetTagId: maintenance.asset.assetTagId,
          assetDescription: maintenance.asset.description,
          timestamp: maintenance.createdAt,
          details: {
            title: maintenance.title,
            status: maintenance.status,
            dueDate: maintenance.dueDate,
            dateCompleted: maintenance.dateCompleted,
            maintenanceBy: maintenance.maintenanceBy,
            cost: maintenance.cost,
          }
        })
      })
    }

    // Sort all activities by timestamp (most recent first)
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    
    // Apply pagination
    const totalPages = Math.ceil(totalActivities / pageSize)
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedActivities = activities.slice(startIndex, endIndex)

    return NextResponse.json({ 
      activities: paginatedActivities,
      pagination: {
        page,
        pageSize,
        total: totalActivities,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      }
    })
  } catch (error: unknown) {
    console.error('Error fetching activities:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    )
  }
}

