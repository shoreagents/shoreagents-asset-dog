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
    const { assetId, lessee, leaseStartDate, leaseEndDate, conditions, notes } = body

    if (!assetId) {
      return NextResponse.json(
        { error: 'Asset ID is required' },
        { status: 400 }
      )
    }

    if (!lessee || !lessee.trim()) {
      return NextResponse.json(
        { error: 'Lessee (third party) is required' },
        { status: 400 }
      )
    }

    if (!leaseStartDate) {
      return NextResponse.json(
        { error: 'Lease start date is required' },
        { status: 400 }
      )
    }

    // Validate lease end date is after start date if provided
    if (leaseEndDate) {
      const startDate = parseDate(leaseStartDate)
      const endDate = parseDate(leaseEndDate)
      
      if (startDate && endDate && endDate < startDate) {
        return NextResponse.json(
          { error: 'Lease end date must be after start date' },
          { status: 400 }
        )
      }
    }

    // Create lease record in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Verify asset exists
      const asset = await tx.assets.findUnique({
        where: { id: assetId },
      })

      if (!asset) {
        throw new Error(`Asset with ID ${assetId} not found`)
      }

      // Check if asset is available for lease (must be Available status)
      if (asset.status && asset.status !== "Available") {
        throw new Error(`Asset is not available for lease. Current status: ${asset.status}`)
      }

      // Check if asset already has an active lease
      const activeLease = await tx.assetsLease.findFirst({
        where: {
          assetId,
          OR: [
            { leaseEndDate: null },
            { leaseEndDate: { gte: parseDate(leaseStartDate)! } },
          ],
        },
      })

      if (activeLease) {
        throw new Error('Asset already has an active lease')
      }

      // Create lease record (history tracking)
      const lease = await tx.assetsLease.create({
        data: {
          assetId,
          lessee: lessee.trim(),
          leaseStartDate: parseDate(leaseStartDate)!,
          leaseEndDate: leaseEndDate ? parseDate(leaseEndDate) : null,
          conditions: conditions || null,
          notes: notes || null,
        },
        include: {
          asset: true,
        },
      })

      // Update asset status to "Leased"
      await tx.assets.update({
        where: { id: assetId },
        data: {
          status: 'Leased',
        },
      })

      return lease
    })

    return NextResponse.json({ 
      success: true,
      lease: result
    })
  } catch (error) {
    console.error('Error creating lease:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to lease asset' },
      { status: 500 }
    )
  }
}

