import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  try {
    const { id } = await params

    const item = await prisma.inventoryItem.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      include: {
        transactions: {
          orderBy: { transactionDate: 'desc' },
          take: 50, // Get last 50 transactions
        },
        _count: {
          select: { transactions: true },
        },
      },
    })

    if (!item) {
      return NextResponse.json(
        { error: 'Inventory item not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ item })
  } catch (error) {
    console.error('Error fetching inventory item:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory item' },
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

  const permissionCheck = await requirePermission('canEditAssets')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const { id } = await params
    const body = await request.json()

    // Check if item exists
    const existingItem = await prisma.inventoryItem.findUnique({
      where: { id },
    })

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Inventory item not found' },
        { status: 404 }
      )
    }

    // Check if itemCode is being changed and if it already exists
    if (body.itemCode && body.itemCode !== existingItem.itemCode) {
      const duplicateItem = await prisma.inventoryItem.findUnique({
        where: { itemCode: body.itemCode },
      })

      if (duplicateItem) {
        return NextResponse.json(
          { error: 'Item code already exists' },
          { status: 400 }
        )
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {}
    if (body.itemCode !== undefined) updateData.itemCode = body.itemCode
    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.category !== undefined) updateData.category = body.category
    if (body.unit !== undefined) updateData.unit = body.unit
    if (body.minStockLevel !== undefined) updateData.minStockLevel = body.minStockLevel
    if (body.maxStockLevel !== undefined) updateData.maxStockLevel = body.maxStockLevel
    if (body.unitCost !== undefined) updateData.unitCost = body.unitCost
    if (body.location !== undefined) updateData.location = body.location
    if (body.supplier !== undefined) updateData.supplier = body.supplier
    if (body.brand !== undefined) updateData.brand = body.brand
    if (body.model !== undefined) updateData.model = body.model
    if (body.sku !== undefined) updateData.sku = body.sku
    if (body.barcode !== undefined) updateData.barcode = body.barcode
    if (body.remarks !== undefined) updateData.remarks = body.remarks

    const updatedItem = await prisma.inventoryItem.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ item: updatedItem })
  } catch (error) {
    console.error('Error updating inventory item:', error)
    return NextResponse.json(
      { error: 'Failed to update inventory item' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canDeleteAssets')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const permanent = searchParams.get('permanent') === 'true'

    if (permanent) {
      // Hard delete
      await prisma.inventoryItem.delete({
        where: { id },
      })
      return NextResponse.json({ success: true, message: 'Item permanently deleted' })
    } else {
      // Soft delete
      await prisma.inventoryItem.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          isDeleted: true,
        },
      })
      return NextResponse.json({
        success: true,
        message: 'Item archived. It will be permanently deleted after 30 days.',
      })
    }
  } catch (error) {
    console.error('Error deleting inventory item:', error)
    return NextResponse.json(
      { error: 'Failed to delete inventory item' },
      { status: 500 }
    )
  }
}

