import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseDate } from '@/lib/date-utils'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'

export async function POST(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canLease')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const body = await request.json()
    const { assetIds, returnDate, updates } = body

    if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
      return NextResponse.json(
        { error: 'Asset IDs are required' },
        { status: 400 }
      )
    }

    if (!returnDate) {
      return NextResponse.json(
        { error: 'Return date is required' },
        { status: 400 }
      )
    }

    // Process lease returns in a transaction
    const results = await prisma.$transaction(async (tx) => {
      const returnResults = []

      for (const assetId of assetIds) {
        // Find the most recent active lease for this asset
        const activeLease = await tx.assetsLease.findFirst({
          where: {
            assetId,
            OR: [
              { leaseEndDate: null },
              { leaseEndDate: { gte: parseDate(returnDate)! } },
            ],
          },
          orderBy: {
            leaseStartDate: 'desc',
          },
        })

        if (!activeLease) {
          throw new Error(`No active lease found for asset ${assetId}`)
        }

        // Check if this lease has already been returned
        const existingReturn = await tx.assetsLeaseReturn.findFirst({
          where: {
            leaseId: activeLease.id,
          },
        })

        if (existingReturn) {
          throw new Error(`This lease has already been returned`)
        }

        // Get update data for this asset (condition, notes)
        const assetUpdate = updates?.[assetId] || {}

        // Create lease return record
        const leaseReturn = await tx.assetsLeaseReturn.create({
          data: {
            assetId,
            leaseId: activeLease.id,
            returnDate: parseDate(returnDate)!,
            condition: assetUpdate.condition || null,
            notes: assetUpdate.notes || null,
          },
          include: {
            asset: {
              select: {
                id: true,
                assetTagId: true,
                description: true,
              },
            },
            lease: {
              select: {
                id: true,
                lessee: true,
              },
            },
          },
        })

        // Update asset status back to Available
        await tx.assets.update({
          where: { id: assetId },
          data: {
            status: 'Available',
          },
        })

        returnResults.push(leaseReturn)
      }

      return returnResults
    })

    return NextResponse.json({
      success: true,
      returns: results,
    })
  } catch (error) {
    console.error('Error processing lease returns:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to return leased assets' },
      { status: 500 }
    )
  }
}

