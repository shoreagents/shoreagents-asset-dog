import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { retryDbOperation } from '@/lib/db-utils'
import { Prisma } from '@prisma/client'

type TransactionType = 
  | 'Add Asset'
  | 'Edit Asset'
  | 'Delete Asset'
  | 'Sold Asset'
  | 'Donated Asset'
  | 'Scrapped Asset'
  | 'Lost/Missing Asset'
  | 'Destroyed Asset'
  | 'Lease Out'
  | 'Lease Return'
  | 'Repair Asset'
  | 'Move Asset'
  | 'Checkout Asset'
  | 'Checkin Asset'
  | 'Actions By Users'

interface TransactionRecord {
  id: string
  transactionType: TransactionType
  assetTagId: string
  assetDescription: string
  category: string | null
  subCategory: string | null
  transactionDate: string
  actionBy: string | null
  details: string | null
  location: string | null
  site: string | null
  department: string | null
  assetCost: number | null
  // Edit Asset specific fields
  fieldChanged?: string | null
  oldValue?: string | null
  newValue?: string | null
  // Lease Out specific fields
  lessee?: string | null
  leaseStartDate?: string | null
  leaseEndDate?: string | null
  conditions?: string | null
  // Lease Return specific fields
  returnDate?: string | null
  condition?: string | null
  notes?: string | null
  // Repair Asset specific fields
  title?: string | null
  maintenanceBy?: string | null
  dueDate?: string | null
  status?: string | null
  cost?: number | null
  dateCompleted?: string | null
  // Move Asset specific fields
  moveType?: string | null
  moveDate?: string | null
  employeeName?: string | null
  reason?: string | null
  fromLocation?: string | null
  toLocation?: string | null
  // Checkout Asset specific fields
  checkoutDate?: string | null
  expectedReturnDate?: string | null
  isOverdue?: boolean | null
  // Checkin Asset specific fields
  checkinDate?: string | null
  // Disposal specific fields
  disposeDate?: string | null
  disposeReason?: string | null
  disposeValue?: number | null
  // Other transaction type specific fields can be added here
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canViewAssets')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const { searchParams } = new URL(request.url)
    
    // Parse filters
    const transactionType = searchParams.get('transactionType')
    const category = searchParams.get('category')
    const location = searchParams.get('location')
    const site = searchParams.get('site')
    const department = searchParams.get('department')
    const actionBy = searchParams.get('actionBy')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    // Parse pagination
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)
    const skip = (page - 1) * pageSize

    const transactions: TransactionRecord[] = []

    // Date range filter
    const dateFilter = startDate || endDate ? {
      ...(startDate ? { gte: new Date(startDate) } : {}),
      ...(endDate ? { lte: new Date(endDate) } : {}),
    } : undefined

    // Helper function to fetch Add Asset transactions
    const fetchAddAssetTransactions = async (): Promise<TransactionRecord[]> => {
      if (transactionType && transactionType !== 'Add Asset') return []
      
      const addWhere: Prisma.AssetsWhereInput = {
        isDeleted: false,
        ...(dateFilter ? { createdAt: dateFilter } : {}),
        ...(category ? { category: { name: category } } : {}),
        ...(location ? { location } : {}),
        ...(site ? { site } : {}),
        ...(department ? { department } : {}),
      }

      const addedAssets = await retryDbOperation(() =>
        prisma.assets.findMany({
          where: addWhere,
          select: {
            id: true,
            assetTagId: true,
            description: true,
            createdAt: true,
            cost: true,
            category: { select: { name: true } },
            subCategory: { select: { name: true } },
            location: true,
            site: true,
            department: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5000, // Limit to prevent excessive data fetching
        })
      )

      // Get history logs for actionBy
      const assetIds = addedAssets.map(a => a.id)
      const historyLogs = assetIds.length > 0 ? await retryDbOperation(() =>
        prisma.assetsHistoryLogs.findMany({
          where: {
            assetId: { in: assetIds },
            eventType: 'added',
          },
          select: {
            assetId: true,
            actionBy: true,
          },
        })
      ) : []

      const historyMap = new Map(historyLogs.map(h => [h.assetId, h.actionBy]))

      return addedAssets.map(asset => ({
        id: `add-${asset.id}`,
        transactionType: 'Add Asset' as TransactionType,
        assetTagId: asset.assetTagId,
        assetDescription: asset.description,
        category: asset.category?.name || null,
        subCategory: asset.subCategory?.name || null,
        transactionDate: asset.createdAt.toISOString(),
        actionBy: historyMap.get(asset.id) || null,
        details: 'Asset added to system',
        location: asset.location,
        site: asset.site,
        department: asset.department,
        assetCost: asset.cost ? Number(asset.cost) : null,
      }))
    }

    // Helper function to fetch Edit Asset transactions
    const fetchEditAssetTransactions = async (): Promise<TransactionRecord[]> => {
      if (transactionType && transactionType !== 'Edit Asset') return []
      
      const editWhere: Prisma.AssetsHistoryLogsWhereInput = {
        eventType: 'edited',
        ...(dateFilter ? { eventDate: dateFilter } : {}),
        ...(actionBy ? { actionBy } : {}),
        asset: {
          isDeleted: false,
          ...(category ? { category: { name: category } } : {}),
          ...(location ? { location } : {}),
          ...(site ? { site } : {}),
          ...(department ? { department } : {}),
        },
      }

      const editLogs = await retryDbOperation(() =>
        prisma.assetsHistoryLogs.findMany({
          where: editWhere,
          select: {
            id: true,
            eventDate: true,
            eventType: true,
            field: true,
            changeFrom: true,
            changeTo: true,
            actionBy: true,
            asset: {
              select: {
                assetTagId: true,
                description: true,
                cost: true,
                category: { select: { name: true } },
                subCategory: { select: { name: true } },
                location: true,
                site: true,
                department: true,
              },
            },
          },
          orderBy: { eventDate: 'desc' },
          take: 5000, // Limit to prevent excessive data fetching
        })
      )

      return editLogs.map(log => ({
        id: `edit-${log.id}`,
        transactionType: 'Edit Asset' as TransactionType,
        assetTagId: log.asset.assetTagId,
        assetDescription: log.asset.description,
        category: log.asset.category?.name || null,
        subCategory: log.asset.subCategory?.name || null,
        transactionDate: log.eventDate.toISOString(),
        actionBy: log.actionBy,
        details: log.field ? `Field "${log.field}" changed from "${log.changeFrom || 'N/A'}" to "${log.changeTo || 'N/A'}"` : 'Asset edited',
        fieldChanged: log.field || null,
        oldValue: log.changeFrom || null,
        newValue: log.changeTo || null,
        location: log.asset.location,
        site: log.asset.site,
        department: log.asset.department,
        assetCost: log.asset.cost ? Number(log.asset.cost) : null,
      }))
    }

    // Helper function to fetch Delete Asset transactions
    const fetchDeleteAssetTransactions = async (): Promise<TransactionRecord[]> => {
      if (transactionType && transactionType !== 'Delete Asset') return []
      
      const deletedAssetsWhere: Prisma.AssetsWhereInput = {
        isDeleted: true,
        ...(category ? { category: { name: category } } : {}),
        ...(location ? { location } : {}),
        ...(site ? { site } : {}),
        ...(department ? { department } : {}),
        ...(dateFilter ? { deletedAt: dateFilter } : {}),
      }

      const deletedAssets = await retryDbOperation(() =>
        prisma.assets.findMany({
          where: deletedAssetsWhere,
          select: {
            id: true,
            assetTagId: true,
            description: true,
            cost: true,
            deletedAt: true,
            category: { select: { name: true } },
            subCategory: { select: { name: true } },
            location: true,
            site: true,
            department: true,
          },
          orderBy: { deletedAt: 'desc' },
          take: 5000, // Limit to prevent excessive data fetching
        })
      )

      // Get history logs for deleted assets to find actionBy
      const assetIds = deletedAssets.map(a => a.id)
      const deleteLogs = assetIds.length > 0 ? await retryDbOperation(() =>
        prisma.assetsHistoryLogs.findMany({
          where: {
            assetId: { in: assetIds },
            eventType: 'deleted',
          },
          select: {
            assetId: true,
            actionBy: true,
            eventDate: true,
          },
        })
      ) : []

      const logMap = new Map(deleteLogs.map(log => [log.assetId, log]))

      return deletedAssets.map(asset => {
        const log = logMap.get(asset.id)
        const deleteDate = asset.deletedAt || log?.eventDate || new Date()
        
        return {
          id: `delete-${asset.id}`,
          transactionType: 'Delete Asset' as TransactionType,
          assetTagId: asset.assetTagId,
          assetDescription: asset.description,
          category: asset.category?.name || null,
          subCategory: asset.subCategory?.name || null,
          transactionDate: deleteDate instanceof Date ? deleteDate.toISOString() : deleteDate,
          actionBy: log?.actionBy || null,
          details: 'Asset deleted',
          location: asset.location,
          site: asset.site,
          department: asset.department,
          assetCost: asset.cost ? Number(asset.cost) : null,
          deletedAt: asset.deletedAt?.toISOString() || null,
        }
      })
    }

    // Helper function to fetch disposal transactions
    const fetchDisposalTransactions = async (): Promise<TransactionRecord[]> => {
      const disposalTypes: Record<string, TransactionType> = {
        'Sold': 'Sold Asset',
        'Donated': 'Donated Asset',
        'Scrapped': 'Scrapped Asset',
        'Lost/Missing': 'Lost/Missing Asset',
        'Destroyed': 'Destroyed Asset',
      }

      const results: TransactionRecord[] = []

      for (const [method, transType] of Object.entries(disposalTypes)) {
        if (transactionType && transactionType !== transType) continue

        const disposeWhere: Prisma.AssetsDisposeWhereInput = {
          disposalMethod: method,
          ...(dateFilter ? { disposeDate: dateFilter } : {}),
          asset: {
            isDeleted: false,
            ...(category ? { category: { name: category } } : {}),
            ...(location ? { location } : {}),
            ...(site ? { site } : {}),
            ...(department ? { department } : {}),
          },
        }

        const disposals = await retryDbOperation(() =>
          prisma.assetsDispose.findMany({
            where: disposeWhere,
            include: {
              asset: {
                select: {
                  assetTagId: true,
                  description: true,
                  cost: true,
                  category: { select: { name: true } },
                  subCategory: { select: { name: true } },
                  location: true,
                  site: true,
                  department: true,
                },
              },
            },
            orderBy: { disposeDate: 'desc' },
            take: 1000, // Limit per disposal type
          })
        )

        disposals.forEach(disposal => {
          results.push({
            id: `dispose-${disposal.id}`,
            transactionType: transType,
            assetTagId: disposal.asset.assetTagId,
            assetDescription: disposal.asset.description,
            category: disposal.asset.category?.name || null,
            subCategory: disposal.asset.subCategory?.name || null,
            transactionDate: disposal.disposeDate.toISOString(),
            actionBy: null,
            details: disposal.disposeReason || `Asset ${method.toLowerCase()}`,
            location: disposal.asset.location,
            site: disposal.asset.site,
            department: disposal.asset.department,
            assetCost: disposal.asset.cost ? Number(disposal.asset.cost) : null,
            disposeDate: disposal.disposeDate.toISOString(),
            disposeReason: disposal.disposeReason || null,
            disposeValue: disposal.disposeValue ? Number(disposal.disposeValue) : null,
          })
        })
      }

      return results
    }

    // Helper function to fetch Lease Out transactions
    const fetchLeaseOutTransactions = async (): Promise<TransactionRecord[]> => {
      if (transactionType && transactionType !== 'Lease Out') return []
      
      const leaseWhere: Prisma.AssetsLeaseWhereInput = {
        ...(dateFilter ? { leaseStartDate: dateFilter } : {}),
        asset: {
          isDeleted: false,
          ...(category ? { category: { name: category } } : {}),
          ...(location ? { location } : {}),
          ...(site ? { site } : {}),
          ...(department ? { department } : {}),
        },
      }

      const leases = await retryDbOperation(() =>
        prisma.assetsLease.findMany({
          where: leaseWhere,
          include: {
            asset: {
              select: {
                assetTagId: true,
                description: true,
                cost: true,
                category: { select: { name: true } },
                subCategory: { select: { name: true } },
                location: true,
                site: true,
                department: true,
              },
            },
          },
          orderBy: { leaseStartDate: 'desc' },
          take: 5000,
        })
      )

      return leases.map(lease => ({
        id: `lease-${lease.id}`,
        transactionType: 'Lease Out' as TransactionType,
        assetTagId: lease.asset.assetTagId,
        assetDescription: lease.asset.description,
        category: lease.asset.category?.name || null,
        subCategory: lease.asset.subCategory?.name || null,
        transactionDate: lease.leaseStartDate.toISOString(),
        actionBy: null,
        details: `Leased to ${lease.lessee}`,
        location: lease.asset.location,
        site: lease.asset.site,
        department: lease.asset.department,
        assetCost: lease.asset.cost ? Number(lease.asset.cost) : null,
        lessee: lease.lessee || null,
        leaseStartDate: lease.leaseStartDate.toISOString(),
        leaseEndDate: lease.leaseEndDate ? lease.leaseEndDate.toISOString() : null,
        conditions: lease.conditions || null,
      }))
    }

    // Helper function to fetch Lease Return transactions
    const fetchLeaseReturnTransactions = async (): Promise<TransactionRecord[]> => {
      if (transactionType && transactionType !== 'Lease Return') return []
      
      const returnWhere: Prisma.AssetsLeaseReturnWhereInput = {
        ...(dateFilter ? { returnDate: dateFilter } : {}),
        asset: {
          isDeleted: false,
          ...(category ? { category: { name: category } } : {}),
          ...(location ? { location } : {}),
          ...(site ? { site } : {}),
          ...(department ? { department } : {}),
        },
      }

      const returns = await retryDbOperation(() =>
        prisma.assetsLeaseReturn.findMany({
          where: returnWhere,
          include: {
            asset: {
              select: {
                assetTagId: true,
                description: true,
                cost: true,
                category: { select: { name: true } },
                subCategory: { select: { name: true } },
                location: true,
                site: true,
                department: true,
              },
            },
            lease: {
              select: {
                lessee: true,
              },
            },
          },
          orderBy: { returnDate: 'desc' },
          take: 5000,
        })
      )

      return returns.map(returnRecord => ({
        id: `lease-return-${returnRecord.id}`,
        transactionType: 'Lease Return' as TransactionType,
        assetTagId: returnRecord.asset.assetTagId,
        assetDescription: returnRecord.asset.description,
        category: returnRecord.asset.category?.name || null,
        subCategory: returnRecord.asset.subCategory?.name || null,
        transactionDate: returnRecord.returnDate.toISOString(),
        actionBy: null,
        details: `Returned from ${returnRecord.lease.lessee}`,
        location: returnRecord.asset.location,
        site: returnRecord.asset.site,
        department: returnRecord.asset.department,
        assetCost: returnRecord.asset.cost ? Number(returnRecord.asset.cost) : null,
        lessee: returnRecord.lease.lessee || null,
        returnDate: returnRecord.returnDate.toISOString(),
        condition: returnRecord.condition || null,
        notes: returnRecord.notes || null,
      }))
    }

    // Helper function to fetch Repair Asset transactions
    const fetchRepairAssetTransactions = async (): Promise<TransactionRecord[]> => {
      if (transactionType && transactionType !== 'Repair Asset') return []
      
      const maintenanceWhere: Prisma.AssetsMaintenanceWhereInput = {
        ...(dateFilter ? { createdAt: dateFilter } : {}),
        asset: {
          isDeleted: false,
          ...(category ? { category: { name: category } } : {}),
          ...(location ? { location } : {}),
          ...(site ? { site } : {}),
          ...(department ? { department } : {}),
        },
      }

      const maintenances = await retryDbOperation(() =>
        prisma.assetsMaintenance.findMany({
          where: maintenanceWhere,
          include: {
            asset: {
              select: {
                assetTagId: true,
                description: true,
                cost: true,
                category: { select: { name: true } },
                subCategory: { select: { name: true } },
                location: true,
                site: true,
                department: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 5000,
        })
      )

      return maintenances.map(maintenance => ({
        id: `maintenance-${maintenance.id}`,
        transactionType: 'Repair Asset' as TransactionType,
        assetTagId: maintenance.asset.assetTagId,
        assetDescription: maintenance.asset.description,
        category: maintenance.asset.category?.name || null,
        subCategory: maintenance.asset.subCategory?.name || null,
        transactionDate: maintenance.createdAt.toISOString(),
        actionBy: maintenance.maintenanceBy || null,
        details: maintenance.title,
        location: maintenance.asset.location,
        site: maintenance.asset.site,
        department: maintenance.asset.department,
        assetCost: maintenance.asset.cost ? Number(maintenance.asset.cost) : null,
        title: maintenance.title || null,
        maintenanceBy: maintenance.maintenanceBy || null,
        dueDate: maintenance.dueDate ? maintenance.dueDate.toISOString() : null,
        status: maintenance.status || null,
        cost: maintenance.cost ? Number(maintenance.cost) : null,
        dateCompleted: maintenance.dateCompleted ? maintenance.dateCompleted.toISOString() : null,
      }))
    }

    // Helper function to fetch Move Asset transactions
    const fetchMoveAssetTransactions = async (): Promise<TransactionRecord[]> => {
      if (transactionType && transactionType !== 'Move Asset') return []
      
      const moveWhere: Prisma.AssetsMoveWhereInput = {
        ...(dateFilter ? { moveDate: dateFilter } : {}),
        asset: {
          isDeleted: false,
          ...(category ? { category: { name: category } } : {}),
          ...(location ? { location } : {}),
          ...(site ? { site } : {}),
          ...(department ? { department } : {}),
        },
      }

      const moves = await retryDbOperation(() =>
        prisma.assetsMove.findMany({
          where: moveWhere,
          include: {
            asset: {
              select: {
                assetTagId: true,
                description: true,
                cost: true,
                category: { select: { name: true } },
                subCategory: { select: { name: true } },
                location: true,
                site: true,
                department: true,
              },
            },
            employeeUser: {
              select: {
                name: true,
              },
            },
          },
          orderBy: { moveDate: 'desc' },
          take: 5000,
        })
      )

      // Get history logs for moves to find actionBy and fromLocation
      // Note: History logs are only created if the move API creates them when updating asset location/department
      const assetIds = moves.map(m => m.assetId)
      const moveHistoryLogs = assetIds.length > 0 ? await retryDbOperation(() =>
        prisma.assetsHistoryLogs.findMany({
          where: {
            assetId: { in: assetIds },
            eventType: 'edited',
            field: { in: ['location', 'department'] },
          },
          select: {
            assetId: true,
            eventDate: true,
            actionBy: true,
            field: true,
            changeFrom: true,
            changeTo: true,
          },
          orderBy: { eventDate: 'desc' },
        })
      ) : []

      // Create maps for quick lookup
      const actionByMap = new Map<string, string>()
      const fromLocationMap = new Map<string, string>()
      
      // Match history logs to moves by assetId and date proximity (within 1 day)
      moves.forEach(move => {
        const relevantLogs = moveHistoryLogs.filter(log => {
          if (log.assetId !== move.assetId) return false
          
          const logDate = log.eventDate.getTime()
          const moveDate = move.moveDate.getTime()
          const timeDiff = Math.abs(logDate - moveDate)
          
          // Check if log is within 1 day of move date
          return timeDiff < 86400000
        })
        
        if (relevantLogs.length > 0) {
          // Find the log that matches the move type
          let matchingLog = relevantLogs.find(log => {
            if (move.moveType === 'Location Transfer' && log.field === 'location') return true
            if (move.moveType === 'Department Transfer' && log.field === 'department') return true
            return false
          })
          
          // If no exact match, use the closest log
          if (!matchingLog && relevantLogs.length > 0) {
            matchingLog = relevantLogs[0]
          }
          
          if (matchingLog) {
            actionByMap.set(move.id, matchingLog.actionBy)
            
            // For Location Transfer, get fromLocation from changeFrom
            if (move.moveType === 'Location Transfer' && matchingLog.field === 'location') {
              fromLocationMap.set(move.id, matchingLog.changeFrom || '')
            }
            // For Department Transfer, fromLocation could be the previous department
            // but we're tracking it as location, so we'll leave it null for department transfers
          }
        }
      })

      return moves.map(move => {
        // Determine toLocation based on moveType
        let toLocation: string | null = null
        if (move.moveType === 'Location Transfer') {
          toLocation = move.asset.location || null
        } else if (move.moveType === 'Department Transfer') {
          // For department transfer, toLocation shows the department (not location)
          toLocation = move.asset.department || null
        }
        // For Employee Assignment, toLocation is not applicable (employee assignment doesn't change location)
        
        return {
          id: `move-${move.id}`,
          transactionType: 'Move Asset' as TransactionType,
          assetTagId: move.asset.assetTagId,
          assetDescription: move.asset.description,
          category: move.asset.category?.name || null,
          subCategory: move.asset.subCategory?.name || null,
          transactionDate: move.moveDate.toISOString(),
          actionBy: actionByMap.get(move.id) || null,
          details: `${move.moveType}: ${move.reason || 'No reason provided'}`,
          location: move.asset.location,
          site: move.asset.site,
          department: move.asset.department,
          assetCost: move.asset.cost ? Number(move.asset.cost) : null,
          moveType: move.moveType || null,
          moveDate: move.moveDate.toISOString(),
          employeeName: move.employeeUser?.name || null,
          reason: move.reason || null,
          fromLocation: fromLocationMap.get(move.id) || null,
          toLocation: toLocation,
        }
      })
    }

    // Helper function to fetch Checkout Asset transactions
    const fetchCheckoutAssetTransactions = async (): Promise<TransactionRecord[]> => {
      if (transactionType && transactionType !== 'Checkout Asset') return []
      
      const checkoutWhere: Prisma.AssetsCheckoutWhereInput = {
        ...(dateFilter ? { checkoutDate: dateFilter } : {}),
        asset: {
          isDeleted: false,
          ...(category ? { category: { name: category } } : {}),
          ...(location ? { location } : {}),
          ...(site ? { site } : {}),
          ...(department ? { department } : {}),
        },
      }

      const checkouts = await retryDbOperation(() =>
        prisma.assetsCheckout.findMany({
          where: checkoutWhere,
          include: {
            asset: {
              select: {
                assetTagId: true,
                description: true,
                cost: true,
                category: { select: { name: true } },
                subCategory: { select: { name: true } },
                location: true,
                site: true,
                department: true,
              },
            },
            employeeUser: {
              select: {
                name: true,
              },
            },
            checkins: {
              select: {
                id: true,
              },
            },
          },
          orderBy: { checkoutDate: 'desc' },
          take: 5000,
        })
      )

      return checkouts.map(checkout => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const expectedReturn = checkout.expectedReturnDate ? new Date(checkout.expectedReturnDate) : null
        expectedReturn?.setHours(0, 0, 0, 0)
        const isOverdue = expectedReturn && expectedReturn < today && checkout.checkins.length === 0

        return {
          id: `checkout-${checkout.id}`,
          transactionType: 'Checkout Asset' as TransactionType,
          assetTagId: checkout.asset.assetTagId,
          assetDescription: checkout.asset.description,
          category: checkout.asset.category?.name || null,
          subCategory: checkout.asset.subCategory?.name || null,
          transactionDate: checkout.checkoutDate.toISOString(),
          actionBy: checkout.employeeUser?.name || null,
          details: `Checked out to ${checkout.employeeUser?.name || 'Unknown'}`,
          location: checkout.asset.location,
          site: checkout.asset.site,
          department: checkout.asset.department,
          assetCost: checkout.asset.cost ? Number(checkout.asset.cost) : null,
          employeeName: checkout.employeeUser?.name || null,
          checkoutDate: checkout.checkoutDate.toISOString(),
          expectedReturnDate: checkout.expectedReturnDate ? checkout.expectedReturnDate.toISOString() : null,
          isOverdue: isOverdue || false,
        }
      })
    }

    // Helper function to fetch Checkin Asset transactions
    const fetchCheckinAssetTransactions = async (): Promise<TransactionRecord[]> => {
      if (transactionType && transactionType !== 'Checkin Asset') return []
      
      const checkinWhere: Prisma.AssetsCheckinWhereInput = {
        ...(dateFilter ? { checkinDate: dateFilter } : {}),
        asset: {
          isDeleted: false,
          ...(category ? { category: { name: category } } : {}),
          ...(location ? { location } : {}),
          ...(site ? { site } : {}),
          ...(department ? { department } : {}),
        },
      }

      const checkins = await retryDbOperation(() =>
        prisma.assetsCheckin.findMany({
          where: checkinWhere,
          include: {
            asset: {
              select: {
                assetTagId: true,
                description: true,
                cost: true,
                category: { select: { name: true } },
                subCategory: { select: { name: true } },
                location: true,
                site: true,
                department: true,
              },
            },
            employeeUser: {
              select: {
                name: true,
              },
            },
          },
          orderBy: { checkinDate: 'desc' },
          take: 5000,
        })
      )

      return checkins.map(checkin => ({
        id: `checkin-${checkin.id}`,
        transactionType: 'Checkin Asset' as TransactionType,
        assetTagId: checkin.asset.assetTagId,
        assetDescription: checkin.asset.description,
        category: checkin.asset.category?.name || null,
        subCategory: checkin.asset.subCategory?.name || null,
        transactionDate: checkin.checkinDate.toISOString(),
        actionBy: checkin.employeeUser?.name || null,
        details: `Checked in from ${checkin.employeeUser?.name || 'Unknown'}`,
        location: checkin.asset.location,
        site: checkin.asset.site,
        department: checkin.asset.department,
        assetCost: checkin.asset.cost ? Number(checkin.asset.cost) : null,
        employeeName: checkin.employeeUser?.name || null,
        checkinDate: checkin.checkinDate.toISOString(),
        condition: checkin.condition || null,
        notes: checkin.notes || null,
      }))
    }

    // Helper function to fetch Actions By Users (all history logs grouped by user)
    const fetchActionsByUsers = async (): Promise<TransactionRecord[]> => {
      if (transactionType && transactionType !== 'Actions By Users') return []
      
      const historyWhere: Prisma.AssetsHistoryLogsWhereInput = {
        ...(dateFilter ? { eventDate: dateFilter } : {}),
        ...(actionBy ? { actionBy: { contains: actionBy, mode: 'insensitive' } } : {}),
        asset: {
          ...(category ? { category: { name: category } } : {}),
          ...(location ? { location } : {}),
          ...(site ? { site } : {}),
          ...(department ? { department } : {}),
        },
      }

      const historyLogs = await retryDbOperation(() =>
        prisma.assetsHistoryLogs.findMany({
          where: historyWhere,
          select: {
            id: true,
            eventDate: true,
            eventType: true,
            field: true,
            changeFrom: true,
            changeTo: true,
            actionBy: true,
            asset: {
              select: {
                id: true,
                assetTagId: true,
                description: true,
                cost: true,
                category: { select: { name: true } },
                subCategory: { select: { name: true } },
                location: true,
                site: true,
                department: true,
                isDeleted: true,
              },
            },
          },
          orderBy: { eventDate: 'desc' },
          take: 10000, // Higher limit for user actions
        })
      )

      // Map eventType to TransactionType
      const eventTypeMap: Record<string, TransactionType> = {
        'added': 'Add Asset',
        'edited': 'Edit Asset',
        'deleted': 'Delete Asset',
      }

      return historyLogs.map(log => {
        const mappedType = eventTypeMap[log.eventType] || 'Edit Asset'
        
        return {
          id: `action-${log.id}`,
          transactionType: mappedType,
          assetTagId: log.asset.assetTagId,
          assetDescription: log.asset.description,
          category: log.asset.category?.name || null,
          subCategory: log.asset.subCategory?.name || null,
          transactionDate: log.eventDate.toISOString(),
          actionBy: log.actionBy,
          details: log.eventType === 'edited' && log.field
            ? `Field "${log.field}" changed from "${log.changeFrom || 'N/A'}" to "${log.changeTo || 'N/A'}"`
            : log.eventType === 'added'
            ? 'Asset added to system'
            : log.eventType === 'deleted'
            ? 'Asset deleted'
            : 'Asset action',
          fieldChanged: log.field || null,
          oldValue: log.changeFrom || null,
          newValue: log.changeTo || null,
          location: log.asset.location,
          site: log.asset.site,
          department: log.asset.department,
          assetCost: log.asset.cost ? Number(log.asset.cost) : null,
        }
      })
    }

    // Execute all queries in parallel when fetching all transaction types
    // If "Actions By Users" is selected, only fetch that
    if (transactionType === 'Actions By Users') {
      const actionsByUsers = await fetchActionsByUsers()
      transactions.push(...actionsByUsers)
    } else {
      const [
        addTransactions,
        editTransactions,
        deleteTransactions,
        disposalTransactions,
        leaseOutTransactions,
        leaseReturnTransactions,
        repairTransactions,
        moveTransactions,
        checkoutTransactions,
        checkinTransactions,
      ] = await Promise.all([
        fetchAddAssetTransactions(),
        fetchEditAssetTransactions(),
        fetchDeleteAssetTransactions(),
        fetchDisposalTransactions(),
        fetchLeaseOutTransactions(),
        fetchLeaseReturnTransactions(),
        fetchRepairAssetTransactions(),
        fetchMoveAssetTransactions(),
        fetchCheckoutAssetTransactions(),
        fetchCheckinAssetTransactions(),
      ])

      // Combine all transactions
      transactions.push(
        ...addTransactions,
        ...editTransactions,
        ...deleteTransactions,
        ...disposalTransactions,
        ...leaseOutTransactions,
        ...leaseReturnTransactions,
        ...repairTransactions,
        ...moveTransactions,
        ...checkoutTransactions,
        ...checkinTransactions
      )
    }

    // Filter by actionBy if specified
    let filteredTransactions = transactions
    if (actionBy) {
      filteredTransactions = transactions.filter(t => 
        t.actionBy?.toLowerCase().includes(actionBy.toLowerCase())
      )
    }

    // Sort by transaction date (newest first)
    filteredTransactions.sort((a, b) => 
      new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()
    )

    // Calculate summary statistics
    const totalTransactions = filteredTransactions.length
    const byType = filteredTransactions.reduce((acc, trans) => {
      if (!acc[trans.transactionType]) {
        acc[trans.transactionType] = { count: 0, totalValue: 0 }
      }
      acc[trans.transactionType].count++
      acc[trans.transactionType].totalValue += trans.assetCost || 0
      return acc
    }, {} as Record<string, { count: number; totalValue: number }>)

    // Paginate
    const paginatedTransactions = filteredTransactions.slice(skip, skip + pageSize)
    const totalPages = Math.ceil(totalTransactions / pageSize)

    return NextResponse.json({
      transactions: paginatedTransactions,
      summary: {
        totalTransactions,
        byType: Object.entries(byType).map(([type, stats]) => ({
          type,
          count: stats.count,
          totalValue: stats.totalValue,
        })),
      },
      generatedAt: new Date().toISOString(),
      pagination: {
        page,
        pageSize,
        total: totalTransactions,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    })
  } catch (error) {
    console.error('Error fetching transaction report:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transaction report' },
      { status: 500 }
    )
  }
}
