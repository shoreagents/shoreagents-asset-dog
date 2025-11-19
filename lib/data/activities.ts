import { prisma } from '@/lib/prisma'
import { retryDbOperation } from '@/lib/db-utils'
import { getCached, setCached } from '@/lib/cache-utils'

export interface ActivityItem {
  id: string
  type: string
  assetId: string
  assetTagId: string
  assetDescription: string
  timestamp: string
  details: Record<string, unknown>
}

export interface PaginationInfo {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface ActivitiesResult {
  activities: ActivityItem[]
  pagination: PaginationInfo
}

export interface GetActivitiesParams {
  page?: number
  pageSize?: number
  activityType?: string | null
}

/**
 * Fetches activities from the database with optional filtering and pagination
 * This function is called by both the API route and Server Components
 * Includes caching to reduce database load
 */
export async function getActivities(params: GetActivitiesParams = {}): Promise<ActivitiesResult> {
  const page = params.page || 1
  const pageSize = Math.min(Math.max(params.pageSize || 50, 25), 500) // Clamp between 25-500
  const activityType = params.activityType
  
  // Check cache first (2 minute TTL for activities)
  // Cache key includes pagination and filter params for correct cache hits
  const cacheKey = `activities-${activityType || 'all'}-${page}-${pageSize}`
  const cached = getCached<ActivitiesResult>(cacheKey)
  if (cached) {
    return cached
  }
  
  try {
    let totalActivities = 0
    
    // For single activity type, use efficient database pagination
    if (activityType) {
      const skip = (page - 1) * pageSize
      
      switch (activityType) {
        case 'checkout': {
          const [count, checkouts] = await retryDbOperation(() =>
            prisma.$transaction([
              prisma.assetsCheckout.count(),
              prisma.assetsCheckout.findMany({
                skip,
                take: pageSize,
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
              })
            ])
          )
          totalActivities = count

          const activities = checkouts.map(checkout => ({
            id: checkout.id,
            type: 'checkout',
            assetId: checkout.assetId,
            assetTagId: checkout.asset.assetTagId,
            assetDescription: checkout.asset.description,
            timestamp: checkout.createdAt.toISOString(),
            details: {
              employeeName: checkout.employeeUser?.name || null,
              employeeEmail: checkout.employeeUser?.email || null,
              checkoutDate: checkout.checkoutDate.toISOString(),
              expectedReturnDate: checkout.expectedReturnDate?.toISOString() || null,
            }
          }))
          
          const result = {
            activities,
            pagination: {
              page,
              pageSize,
              total: totalActivities,
              totalPages: Math.ceil(totalActivities / pageSize),
              hasNextPage: page < Math.ceil(totalActivities / pageSize),
              hasPreviousPage: page > 1,
            }
          }
          
          setCached(cacheKey, result, 120000)
          return result
        }
        case 'checkin': {
          const [count, checkins] = await retryDbOperation(() =>
            prisma.$transaction([
              prisma.assetsCheckin.count(),
              prisma.assetsCheckin.findMany({
                skip,
                take: pageSize,
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
              })
            ])
          )
          totalActivities = count

          const activities = checkins.map(checkin => ({
            id: checkin.id,
            type: 'checkin',
            assetId: checkin.assetId,
            assetTagId: checkin.asset.assetTagId,
            assetDescription: checkin.asset.description,
            timestamp: checkin.createdAt.toISOString(),
            details: {
              employeeName: checkin.employeeUser?.name || null,
              employeeEmail: checkin.employeeUser?.email || null,
              checkinDate: checkin.checkinDate.toISOString(),
              condition: checkin.condition,
            }
          }))
          
          const result = {
            activities,
            pagination: {
              page,
              pageSize,
              total: totalActivities,
              totalPages: Math.ceil(totalActivities / pageSize),
              hasNextPage: page < Math.ceil(totalActivities / pageSize),
              hasPreviousPage: page > 1,
            }
          }
          
          setCached(cacheKey, result, 120000)
          return result
        }
        case 'move': {
          const [count, moves] = await retryDbOperation(() =>
            prisma.$transaction([
              prisma.assetsMove.count(),
              prisma.assetsMove.findMany({
                skip,
                take: pageSize,
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
              })
            ])
          )
          totalActivities = count

          const activities = moves.map(move => ({
            id: move.id,
            type: 'move',
            assetId: move.assetId,
            assetTagId: move.asset.assetTagId,
            assetDescription: move.asset.description,
            timestamp: move.createdAt.toISOString(),
            details: {
              moveType: move.moveType,
              moveDate: move.moveDate.toISOString(),
              employeeName: move.employeeUser?.name || null,
              reason: move.reason,
            }
          }))
          
          const result = {
            activities,
            pagination: {
              page,
              pageSize,
              total: totalActivities,
              totalPages: Math.ceil(totalActivities / pageSize),
              hasNextPage: page < Math.ceil(totalActivities / pageSize),
              hasPreviousPage: page > 1,
            }
          }
          
          setCached(cacheKey, result, 120000)
          return result
        }
        case 'reserve': {
          const [count, reserves] = await retryDbOperation(() =>
            prisma.$transaction([
              prisma.assetsReserve.count(),
              prisma.assetsReserve.findMany({
                skip,
                take: pageSize,
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
              })
            ])
          )
          totalActivities = count

          const activities = reserves.map(reserve => ({
            id: reserve.id,
            type: 'reserve',
            assetId: reserve.assetId,
            assetTagId: reserve.asset.assetTagId,
            assetDescription: reserve.asset.description,
            timestamp: reserve.createdAt.toISOString(),
            details: {
              reservationType: reserve.reservationType,
              reservationDate: reserve.reservationDate.toISOString(),
              employeeName: reserve.employeeUser?.name || null,
              department: reserve.department,
              purpose: reserve.purpose,
            }
          }))
          
          const result = {
            activities,
            pagination: {
              page,
              pageSize,
              total: totalActivities,
              totalPages: Math.ceil(totalActivities / pageSize),
              hasNextPage: page < Math.ceil(totalActivities / pageSize),
              hasPreviousPage: page > 1,
            }
          }
          
          setCached(cacheKey, result, 120000)
          return result
        }
        case 'lease': {
          const [count, leases] = await retryDbOperation(() =>
            prisma.$transaction([
              prisma.assetsLease.count(),
              prisma.assetsLease.findMany({
                skip,
                take: pageSize,
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
              })
            ])
          )
          totalActivities = count

          const activities = leases.map(lease => ({
            id: lease.id,
            type: 'lease',
            assetId: lease.assetId,
            assetTagId: lease.asset.assetTagId,
            assetDescription: lease.asset.description,
            timestamp: lease.createdAt.toISOString(),
            details: {
              lessee: lease.lessee,
              leaseStartDate: lease.leaseStartDate.toISOString(),
              leaseEndDate: lease.leaseEndDate?.toISOString() || null,
            }
          }))
          
          const result = {
            activities,
            pagination: {
              page,
              pageSize,
              total: totalActivities,
              totalPages: Math.ceil(totalActivities / pageSize),
              hasNextPage: page < Math.ceil(totalActivities / pageSize),
              hasPreviousPage: page > 1,
            }
          }
          
          setCached(cacheKey, result, 120000)
          return result
        }
        case 'leaseReturn': {
          const [count, leaseReturns] = await retryDbOperation(() =>
            prisma.$transaction([
              prisma.assetsLeaseReturn.count(),
              prisma.assetsLeaseReturn.findMany({
                skip,
                take: pageSize,
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
              })
            ])
          )
          totalActivities = count

          const activities = leaseReturns.map(leaseReturn => ({
            id: leaseReturn.id,
            type: 'leaseReturn',
            assetId: leaseReturn.assetId,
            assetTagId: leaseReturn.asset.assetTagId,
            assetDescription: leaseReturn.asset.description,
            timestamp: leaseReturn.createdAt.toISOString(),
            details: {
              lessee: leaseReturn.lease.lessee,
              returnDate: leaseReturn.returnDate.toISOString(),
              condition: leaseReturn.condition,
            }
          }))
          
          const result = {
            activities,
            pagination: {
              page,
              pageSize,
              total: totalActivities,
              totalPages: Math.ceil(totalActivities / pageSize),
              hasNextPage: page < Math.ceil(totalActivities / pageSize),
              hasPreviousPage: page > 1,
            }
          }
          
          setCached(cacheKey, result, 120000)
          return result
        }
        case 'dispose': {
          const [count, disposals] = await retryDbOperation(() =>
            prisma.$transaction([
              prisma.assetsDispose.count(),
              prisma.assetsDispose.findMany({
                skip,
                take: pageSize,
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
              })
            ])
          )
          totalActivities = count

          const activities = disposals.map(disposal => ({
            id: disposal.id,
            type: 'dispose',
            assetId: disposal.assetId,
            assetTagId: disposal.asset.assetTagId,
            assetDescription: disposal.asset.description,
            timestamp: disposal.createdAt.toISOString(),
            details: {
              disposeDate: disposal.disposeDate.toISOString(),
              disposalMethod: disposal.disposalMethod,
              disposeValue: disposal.disposeValue ? Number(disposal.disposeValue) : null,
              disposeReason: disposal.disposeReason,
            }
          }))
          
          const result = {
            activities,
            pagination: {
              page,
              pageSize,
              total: totalActivities,
              totalPages: Math.ceil(totalActivities / pageSize),
              hasNextPage: page < Math.ceil(totalActivities / pageSize),
              hasPreviousPage: page > 1,
            }
          }
          
          setCached(cacheKey, result, 120000)
          return result
        }
        case 'maintenance': {
          const [count, maintenances] = await retryDbOperation(() =>
            prisma.$transaction([
              prisma.assetsMaintenance.count(),
              prisma.assetsMaintenance.findMany({
                skip,
                take: pageSize,
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
              })
            ])
          )
          totalActivities = count
          
          const activities = maintenances.map(maintenance => ({
            id: maintenance.id,
            type: 'maintenance',
            assetId: maintenance.assetId,
            assetTagId: maintenance.asset.assetTagId,
            assetDescription: maintenance.asset.description,
            timestamp: maintenance.createdAt.toISOString(),
            details: {
              title: maintenance.title,
              status: maintenance.status,
              dueDate: maintenance.dueDate?.toISOString() || null,
              dateCompleted: maintenance.dateCompleted?.toISOString() || null,
              maintenanceBy: maintenance.maintenanceBy,
              cost: maintenance.cost ? Number(maintenance.cost) : null,
            }
          }))
          
          const result = {
            activities,
            pagination: {
              page,
              pageSize,
              total: totalActivities,
              totalPages: Math.ceil(totalActivities / pageSize),
              hasNextPage: page < Math.ceil(totalActivities / pageSize),
              hasPreviousPage: page > 1,
            }
          }
          
          setCached(cacheKey, result, 120000)
          return result
        }
      }
    }
    
    // For all activity types, use a single transaction to avoid connection pool exhaustion
    // Fetch a reasonable amount from each type (enough to cover pagination, but not excessive)
    const itemsPerType = Math.min(pageSize, 100) // Cap at 100 per type to avoid fetching too much
    
    // Use a single transaction for all queries to minimize connection usage
    const [
      checkoutCount,
      checkinCount,
      moveCount,
      reserveCount,
      leaseCount,
      leaseReturnCount,
      disposeCount,
      maintenanceCount,
      checkouts,
      checkins,
      moves,
      reserves,
      leases,
      leaseReturns,
      disposals,
      maintenances,
    ] = await retryDbOperation(() =>
      prisma.$transaction([
        // Counts
        prisma.assetsCheckout.count(),
        prisma.assetsCheckin.count(),
        prisma.assetsMove.count(),
        prisma.assetsReserve.count(),
        prisma.assetsLease.count(),
        prisma.assetsLeaseReturn.count(),
        prisma.assetsDispose.count(),
        prisma.assetsMaintenance.count(),
        // Data
        prisma.assetsCheckout.findMany({
          take: itemsPerType,
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
        }),
        prisma.assetsCheckin.findMany({
          take: itemsPerType,
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
        }),
        prisma.assetsMove.findMany({
          take: itemsPerType,
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
        }),
        prisma.assetsReserve.findMany({
          take: itemsPerType,
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
        }),
        prisma.assetsLease.findMany({
          take: itemsPerType,
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
        }),
        prisma.assetsLeaseReturn.findMany({
          take: itemsPerType,
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
        }),
        prisma.assetsDispose.findMany({
          take: itemsPerType,
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
        }),
        prisma.assetsMaintenance.findMany({
          take: itemsPerType,
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
        }),
      ])
    )
    
    totalActivities = checkoutCount + checkinCount + moveCount + reserveCount + 
                      leaseCount + leaseReturnCount + disposeCount + maintenanceCount

    // Process all activity types into a unified array
    const activities: Array<{
      id: string
      type: string
      assetId: string
      assetTagId: string
      assetDescription: string
      timestamp: Date
      details: Record<string, unknown>
    }> = []

    // Process checkouts
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

    // Process checkins
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

    // Process moves
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

    // Process reserves
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

    // Process leases
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

    // Process lease returns
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

    // Process disposals
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
          disposeValue: disposal.disposeValue ? Number(disposal.disposeValue) : null,
          disposeReason: disposal.disposeReason,
        }
      })
    })

    // Process maintenances
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
          cost: maintenance.cost ? Number(maintenance.cost) : null,
        }
      })
    })

    // Sort all activities by timestamp (most recent first)
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    
    // Apply pagination
    const totalPages = Math.ceil(totalActivities / pageSize)
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedActivities = activities.slice(startIndex, endIndex).map(activity => {
      // Convert Date objects to ISO strings in details
      const convertedDetails: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(activity.details)) {
        if (value instanceof Date) {
          convertedDetails[key] = value.toISOString()
        } else {
          convertedDetails[key] = value
        }
      }
      
      return {
        id: activity.id,
        type: activity.type,
        assetId: activity.assetId,
        assetTagId: activity.assetTagId,
        assetDescription: activity.assetDescription,
        timestamp: activity.timestamp.toISOString(),
        details: convertedDetails
      }
    })

    const result: ActivitiesResult = { 
      activities: paginatedActivities,
      pagination: {
        page,
        pageSize,
        total: totalActivities,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      }
    }
    
    // Cache for 2 minutes
    setCached(cacheKey, result, 120000)
    
    return result
  } catch (error) {
    console.error('Error fetching activities:', error)
    throw new Error('Failed to fetch activities')
  }
}

