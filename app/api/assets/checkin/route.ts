import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseDate } from '@/lib/date-utils'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { clearCache } from '@/lib/cache-utils'

export async function POST(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canCheckin')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const body = await request.json()
    const { assetIds, checkinDate, updates } = body

    if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
      return NextResponse.json(
        { error: 'Asset IDs are required' },
        { status: 400 }
      )
    }

    if (!checkinDate) {
      return NextResponse.json(
        { error: 'Check-in date is required' },
        { status: 400 }
      )
    }

    // Create checkin records and update assets in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const checkinRecords = await Promise.all(
        assetIds.map(async (assetId: string) => {
          const assetUpdate = updates?.[assetId] || {}
          // Get the asset and its most recent checkout
          const asset = await tx.assets.findUnique({
            where: { id: assetId },
            include: {
              checkouts: {
                orderBy: { checkoutDate: 'desc' },
                take: 1,
                include: {
                  employeeUser: true,
                  checkins: {
                    take: 1,
                  },
                },
              },
            },
          })

          if (!asset) {
            throw new Error(`Asset with ID ${assetId} not found`)
          }

          if (asset.status !== "Checked out") {
            throw new Error(`Asset ${asset.assetTagId} is not checked out. Current status: ${asset.status}`)
          }

          // Get the most recent checkout that hasn't been checked in yet
          const activeCheckout = asset.checkouts.find(
            checkout => checkout.checkins.length === 0
          ) || asset.checkouts[0]

          if (!activeCheckout) {
            throw new Error(`No active checkout found for asset ${asset.assetTagId}`)
          }

          if (!activeCheckout.employeeUserId) {
            throw new Error(`Checkout record for asset ${asset.assetTagId} does not have an employee assigned`)
          }

          // Update asset status to Available and location if provided
          const assetUpdateData: Record<string, unknown> = {
            status: "Available",
          }

          // Update location if return location is provided
          if (assetUpdate.returnLocation !== undefined) {
            assetUpdateData.location = assetUpdate.returnLocation || null
          }

          await tx.assets.update({
            where: { id: assetId },
            data: assetUpdateData,
          })

          // Create checkin record (history tracking)
          const checkin = await tx.assetsCheckin.create({
            data: {
              assetId,
              checkoutId: activeCheckout.id,
              employeeUserId: activeCheckout.employeeUserId,
              checkinDate: parseDate(checkinDate)!,
              condition: assetUpdate.condition || null,
              notes: assetUpdate.notes || null,
            },
            include: {
              asset: true,
              employeeUser: true,
              checkout: true,
            },
          })

          return checkin
        })
      )

      return checkinRecords
    })

    // Invalidate dashboard and activities cache when checkin is created
    clearCache('dashboard-stats')
    clearCache('activities-')

    return NextResponse.json({ 
      success: true,
      checkins: result,
      count: result.length
    })
  } catch (error) {
    console.error('Error creating checkin:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check in assets' },
      { status: 500 }
    )
  }
}

