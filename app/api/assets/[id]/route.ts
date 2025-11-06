import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseDate } from '@/lib/date-utils'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // Check delete permission
  const permissionCheck = await requirePermission('canDeleteAssets')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const permanent = searchParams.get('permanent') === 'true'

    if (permanent) {
      // Permanent delete (hard delete) - only for admin or cleanup cron
      await prisma.assets.delete({
        where: {
          id,
        },
      })
      return NextResponse.json({ success: true, message: 'Asset permanently deleted' })
    } else {
      // Soft delete
      await prisma.assets.update({
        where: {
          id,
        },
        data: {
          deletedAt: new Date(),
          isDeleted: true,
        },
      })
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
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const { id } = await params

    const asset = await prisma.assets.findFirst({
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
          },
          orderBy: { checkoutDate: 'desc' },
          take: 1,
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
      },
    })

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ asset })
  } catch (error) {
    console.error('Error fetching asset:', error)
    return NextResponse.json(
      { error: 'Failed to fetch asset' },
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
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const { id } = await params
    const body = await request.json()

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

    const asset = await prisma.assets.update({
      where: {
        id,
      },
      data: {
        ...(body.assetTagId && { assetTagId: body.assetTagId }),
        ...(body.description && { description: body.description }),
        ...(body.status && { status: body.status }),
        ...(body.brand && { brand: body.brand }),
        ...(body.model && { model: body.model }),
        ...(body.location !== undefined && { location: body.location }),
        ...(body.issuedTo && { issuedTo: body.issuedTo }),
        ...(body.department !== undefined && { department: body.department }),
        ...(body.site !== undefined && { site: body.site }),
        ...(body.owner && { owner: body.owner }),
        ...(body.purchasedFrom && { purchasedFrom: body.purchasedFrom }),
        ...(body.purchaseDate && { purchaseDate: parseDate(body.purchaseDate) }),
        ...(body.poNumber && { poNumber: body.poNumber }),
        ...(body.xeroAssetNo && { xeroAssetNo: body.xeroAssetNo }),
        ...(body.remarks && { remarks: body.remarks }),
        ...(body.additionalInformation && { additionalInformation: body.additionalInformation }),
        ...(body.serialNo && { serialNo: body.serialNo }),
        ...(body.cost && { cost: parseFloat(body.cost) }),
        ...(body.assetType && { assetType: body.assetType }),
        ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl || null }),
      },
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

    return NextResponse.json({ asset })
  } catch (error) {
    console.error('Error updating asset:', error)
    return NextResponse.json(
      { error: 'Failed to update asset' },
      { status: 500 }
    )
  }
}

