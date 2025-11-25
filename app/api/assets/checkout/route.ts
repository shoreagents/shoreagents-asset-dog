import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseDate } from '@/lib/date-utils'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { clearCache } from '@/lib/cache-utils'

export async function POST(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canCheckout')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const body = await request.json()
    const { assetIds, employeeUserId, checkoutDate, expectedReturnDate, updates } = body

    if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
      return NextResponse.json(
        { error: 'Asset IDs are required' },
        { status: 400 }
      )
    }

    if (!employeeUserId) {
      return NextResponse.json(
        { error: 'Employee user ID is required' },
        { status: 400 }
      )
    }

    if (!checkoutDate) {
      return NextResponse.json(
        { error: 'Checkout date is required' },
        { status: 400 }
      )
    }

    // Create checkout records and update assets in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create checkout records for all assets
      const checkoutRecords = await Promise.all(
        assetIds.map(async (assetId: string) => {
          const assetUpdate = updates?.[assetId] || {}
          
          // Get current asset to use current values if not updating
          const currentAsset = await tx.assets.findUnique({
            where: { id: assetId },
          })

          // Prepare asset update data - update status and location info if provided
          const updateData: Record<string, unknown> = {
            status: "Checked out",
          }

          // Update department/site/location if provided, otherwise keep current values
          updateData.department = assetUpdate.department !== undefined 
            ? (assetUpdate.department || null)
            : currentAsset?.department
          updateData.site = assetUpdate.site !== undefined 
            ? (assetUpdate.site || null)
            : currentAsset?.site
          updateData.location = assetUpdate.location !== undefined 
            ? (assetUpdate.location || null)
            : currentAsset?.location

          // Update asset with new status and location info
          await tx.assets.update({
            where: { id: assetId },
            data: updateData,
          })

          // Create checkout record (history tracking)
          const checkout = await tx.assetsCheckout.create({
            data: {
              assetId,
              employeeUserId,
              checkoutDate: parseDate(checkoutDate)!,
              expectedReturnDate: expectedReturnDate ? parseDate(expectedReturnDate) : null,
            },
            include: {
              asset: true,
              employeeUser: true,
            },
          })

          return checkout
        })
      )

      return checkoutRecords
    })

    // Invalidate dashboard and activities cache when checkout is created
    await clearCache('dashboard-stats')
    await clearCache('activities-')

    return NextResponse.json({ 
      success: true,
      checkouts: result,
      count: result.length
    })
  } catch (error) {
    console.error('Error creating checkout:', error)
    return NextResponse.json(
      { error: 'Failed to checkout assets' },
      { status: 500 }
    )
  }
}

