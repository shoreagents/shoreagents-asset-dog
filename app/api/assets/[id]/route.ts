import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseDate } from '@/lib/date-utils'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { clearCache } from '@/lib/cache-utils'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // Check delete permission
  const permissionCheck = await requirePermission('canDeleteAssets')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const permanent = searchParams.get('permanent') === 'true'

    // Get user info for history logging - use name from metadata, fallback to email
    const userName = auth.user.user_metadata?.name || 
                     auth.user.user_metadata?.full_name || 
                     auth.user.email?.split('@')[0] || 
                     auth.user.email || 
                     auth.user.id

    if (permanent) {
      // Permanent delete (hard delete) - only for admin or cleanup cron
      // Log history before deleting
      await prisma.assetsHistoryLogs.create({
        data: {
          assetId: id,
          eventType: 'deleted',
          actionBy: userName,
        },
      })

      await prisma.assets.delete({
        where: {
          id,
        },
      })
      
      // Invalidate caches when asset is deleted
      await clearCache('dashboard-stats')
      await clearCache('assets-') // Clear all assets list caches
      await clearCache(`asset-details-${id}`) // Clear specific asset details cache
      
      return NextResponse.json({ success: true, message: 'Asset permanently deleted' })
    } else {
      // Soft delete - log history and update asset in transaction
      await prisma.$transaction(async (tx) => {
        // Create history log
        await tx.assetsHistoryLogs.create({
          data: {
            assetId: id,
            eventType: 'deleted',
            actionBy: userName,
          },
        })

        // Soft delete asset
        await tx.assets.update({
          where: {
            id,
          },
          data: {
            deletedAt: new Date(),
            isDeleted: true,
          },
        })
      })
      
      // Invalidate caches when asset is archived
      await clearCache('dashboard-stats')
      await clearCache('assets-') // Clear all assets list caches
      await clearCache(`asset-details-${id}`) // Clear specific asset details cache
      
      return NextResponse.json({ success: true, message: 'Asset archived. It will be permanently deleted after 30 days.' })
    }
  } catch (error) {
    console.error('Error deleting asset:', error)
    return NextResponse.json(
      { error: 'Failed to delete asset' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // Check view permission
  const permissionCheck = await requirePermission('canViewAssets')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const { id } = await params

    // Use transaction to optimize connection pool usage and ensure atomicity
    const asset = await prisma.$transaction(
      async (tx) => {
        return await tx.assets.findFirst({
          where: {
            id,
            isDeleted: false,
          },
          include: {
            category: true,
            subCategory: true,
            checkouts: {
              include: {
                employeeUser: true,
                checkins: {
                  take: 1,
                },
              },
              orderBy: { checkoutDate: 'desc' },
              take: 10, // Get more checkouts to find the active one
            },
            leases: {
              where: {
                OR: [
                  { leaseEndDate: null },
                  { leaseEndDate: { gte: new Date() } },
                ],
              },
              include: {
                returns: {
                  take: 1,
                },
              },
              orderBy: { leaseStartDate: 'desc' },
              take: 1,
            },
            auditHistory: {
              orderBy: { auditDate: 'desc' },
              take: 5,
            },
          },
        })
      },
      {
        timeout: 30000, // 30 second timeout
        isolationLevel: 'ReadCommitted', // Read-only transaction
      }
    )

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ asset })
  } catch (error) {
    console.error('Error fetching asset:', error)
    
    // Provide more specific error messages
    if (error instanceof Error) {
      // Check for connection pool timeout
      if (error.message.includes('connection pool') || error.message.includes('P2024')) {
        return NextResponse.json(
          { 
            error: 'Database connection timeout. Please try again.',
            details: 'The database is currently busy. Please wait a moment and retry.'
          },
          { status: 503 } // Service Unavailable
        )
      }
      
      // Check for query timeout
      if (error.message.includes('timeout') || error.message.includes('P2025')) {
        return NextResponse.json(
          { 
            error: 'Query timeout. Please try again.',
            details: 'The request took too long to process.'
          },
          { status: 504 } // Gateway Timeout
        )
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch asset',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // Check edit permission
  const permissionCheck = await requirePermission('canEditAssets')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const { id } = await params
    const body = await request.json()

    // Get user info for history logging - use name from metadata, fallback to email
    const userName = auth.user.user_metadata?.name || 
                     auth.user.user_metadata?.full_name || 
                     auth.user.email?.split('@')[0] || 
                     auth.user.email || 
                     auth.user.id

    // Check if assetTagId is being changed and if it already exists (excluding current asset)
    if (body.assetTagId) {
      const existingAsset = await prisma.assets.findFirst({
        where: {
          assetTagId: body.assetTagId,
          id: { not: id }, // Exclude current asset
        },
      })

      if (existingAsset) {
        return NextResponse.json(
          { error: 'Asset tag ID already exists' },
          { status: 400 }
        )
      }
    }

    // Get current asset to compare values
    const currentAsset = await prisma.assets.findUnique({
      where: { id },
    })

    if (!currentAsset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {}
    if (body.assetTagId) updateData.assetTagId = body.assetTagId
    if (body.description !== undefined) updateData.description = body.description
    if (body.status !== undefined) updateData.status = body.status
    if (body.brand !== undefined) updateData.brand = body.brand
    if (body.model !== undefined) updateData.model = body.model
    if (body.location !== undefined) updateData.location = body.location
    if (body.issuedTo !== undefined) updateData.issuedTo = body.issuedTo
    if (body.department !== undefined) updateData.department = body.department
    if (body.site !== undefined) updateData.site = body.site
    if (body.owner !== undefined) updateData.owner = body.owner
    if (body.purchasedFrom !== undefined) updateData.purchasedFrom = body.purchasedFrom
    if (body.purchaseDate !== undefined) updateData.purchaseDate = body.purchaseDate ? parseDate(body.purchaseDate) : null
    if (body.poNumber !== undefined) updateData.poNumber = body.poNumber
    if (body.xeroAssetNo !== undefined) updateData.xeroAssetNo = body.xeroAssetNo
    if (body.remarks !== undefined) updateData.remarks = body.remarks
    if (body.additionalInformation !== undefined) updateData.additionalInformation = body.additionalInformation
    if (body.serialNo !== undefined) updateData.serialNo = body.serialNo
    if (body.cost !== undefined) updateData.cost = body.cost ? parseFloat(body.cost) : null
    if (body.assetType !== undefined) updateData.assetType = body.assetType
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl || null
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId || null
    if (body.subCategoryId !== undefined) updateData.subCategoryId = body.subCategoryId || null
    if (body.deliveryDate !== undefined) updateData.deliveryDate = body.deliveryDate ? parseDate(body.deliveryDate) : null
    if (body.oldAssetTag !== undefined) updateData.oldAssetTag = body.oldAssetTag
    if (body.qr !== undefined) updateData.qr = body.qr
    if (body.unaccountedInventory !== undefined) updateData.unaccountedInventory = body.unaccountedInventory
    if (body.depreciableAsset !== undefined) updateData.depreciableAsset = body.depreciableAsset
    if (body.depreciableCost !== undefined) updateData.depreciableCost = body.depreciableCost ? parseFloat(body.depreciableCost) : null
    if (body.salvageValue !== undefined) updateData.salvageValue = body.salvageValue ? parseFloat(body.salvageValue) : null
    if (body.assetLifeMonths !== undefined) updateData.assetLifeMonths = body.assetLifeMonths ? parseInt(body.assetLifeMonths) : null
    if (body.depreciationMethod !== undefined) updateData.depreciationMethod = body.depreciationMethod
    if (body.dateAcquired !== undefined) updateData.dateAcquired = body.dateAcquired ? parseDate(body.dateAcquired) : null

    // Helper function to normalize date values for comparison
    const normalizeDate = (value: unknown): Date | null => {
      if (!value) return null
      if (value instanceof Date) return value
      if (typeof value === 'string') {
        const parsed = new Date(value)
        return isNaN(parsed.getTime()) ? null : parsed
      }
      return null
    }

    // Helper function to compare dates (only date part, ignore time)
    const datesAreEqual = (date1: Date | null, date2: Date | null): boolean => {
      if (!date1 && !date2) return true
      if (!date1 || !date2) return false
      return date1.toISOString().split('T')[0] === date2.toISOString().split('T')[0]
    }

    // Helper function to convert value to string for comparison
    const valueToString = (value: unknown): string => {
      if (value === null || value === undefined) return ''
      if (value instanceof Date) {
        // For dates, return only the date part (YYYY-MM-DD) for consistent comparison
        return value.toISOString().split('T')[0]
      }
      return String(value)
    }

    // Date fields that should be compared by date only (not time)
    const dateFields = [
      'purchaseDate',
      'deliveryDate',
      'dateAcquired',
    ]

    // Track changes for history logging
    const historyLogs: Array<{
      field: string
      changeFrom: string
      changeTo: string
    }> = []

    // Compare each field and create history logs
    Object.keys(updateData).forEach((key) => {
      const oldValue = currentAsset[key as keyof typeof currentAsset]
      const newValue = updateData[key]
      
      // Special handling for date fields
      if (dateFields.includes(key)) {
        const oldDate = normalizeDate(oldValue)
        const newDate = normalizeDate(newValue)
        
        // Only log if dates are actually different (ignoring time)
        if (!datesAreEqual(oldDate, newDate)) {
          historyLogs.push({
            field: key,
            changeFrom: oldDate ? oldDate.toISOString().split('T')[0] : '',
            changeTo: newDate ? newDate.toISOString().split('T')[0] : '',
          })
        }
      } else {
        // For non-date fields, use string comparison
        const oldValueStr = valueToString(oldValue)
        const newValueStr = valueToString(newValue)

        // Only log if value actually changed
        if (oldValueStr !== newValueStr) {
          historyLogs.push({
            field: key,
            changeFrom: oldValueStr,
            changeTo: newValueStr,
          })
        }
      }
    })

    // Update asset and create history logs in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update asset
      const updatedAsset = await tx.assets.update({
        where: { id },
        data: updateData,
        include: {
          category: true,
          subCategory: true,
          checkouts: {
            include: {
              employeeUser: true,
            },
            orderBy: { checkoutDate: 'desc' },
            take: 1,
          },
        },
      })

      // Create history logs for each changed field
      if (historyLogs.length > 0) {
        await Promise.all(
          historyLogs.map((log) =>
              tx.assetsHistoryLogs.create({
                data: {
                  assetId: id,
                  eventType: 'edited',
                  field: log.field,
                  changeFrom: log.changeFrom,
                  changeTo: log.changeTo,
                  actionBy: userName,
                },
              })
          )
        )
      }

      return updatedAsset
    })

    // Invalidate caches when asset is updated
    // Especially important if status or cost changed
    await clearCache('dashboard-stats')
    await clearCache('assets-') // Clear all assets list caches
    await clearCache(`asset-details-${id}`) // Clear specific asset details cache

    return NextResponse.json({ asset: result })
  } catch (error) {
    console.error('Error updating asset:', error)
    return NextResponse.json(
      { error: 'Failed to update asset' },
      { status: 500 }
    )
  }
}

