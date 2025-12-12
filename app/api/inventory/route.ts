import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const includeDeleted = searchParams.get('includeDeleted') === 'true'
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)
    const lowStock = searchParams.get('lowStock') === 'true'

    // Build where clause
    const whereClause: Prisma.InventoryItemWhereInput = {
      isDeleted: includeDeleted ? undefined : false,
    }

    // Search filter
    if (search) {
      whereClause.OR = [
        { itemCode: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Category filter
    if (category) {
      whereClause.category = category
    }

    // Get total count and items
    // Note: Low stock filtering is done in memory since Prisma doesn't support field comparison in where clause
    let [totalCount, items] = await Promise.all([
      prisma.inventoryItem.count({ where: whereClause }),
      prisma.inventoryItem.findMany({
        where: whereClause,
        include: {
          _count: {
            select: { transactions: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: lowStock ? 0 : (page - 1) * pageSize, // Fetch all for low stock filtering
        take: lowStock ? undefined : pageSize,
      }),
    ])

    // Filter low stock items if requested
    if (lowStock) {
      items = items.filter((item) => {
        if (!item.minStockLevel) return false
        const current = parseFloat(item.currentStock.toString())
        const min = parseFloat(item.minStockLevel.toString())
        return current <= min
      })
      totalCount = items.length
      // Apply pagination after filtering
      items = items.slice((page - 1) * pageSize, page * pageSize)
    }

    const totalPages = Math.ceil(totalCount / pageSize)
    return NextResponse.json({
      items,
      pagination: {
        total: totalCount,
        page,
        pageSize,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    })
  } catch (error) {
    console.error('Error fetching inventory items:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory items' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canManageInventory')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const body = await request.json()
    const {
      itemCode,
      name,
      description,
      category,
      unit,
      currentStock,
      minStockLevel,
      maxStockLevel,
      unitCost,
      location,
      supplier,
      brand,
      model,
      sku,
      barcode,
      remarks,
    } = body

    // Validation
    if (!itemCode || !name) {
      return NextResponse.json(
        { error: 'Item code and name are required' },
        { status: 400 }
      )
    }

    // Check if item code already exists
    const existingItem = await prisma.inventoryItem.findUnique({
      where: { itemCode },
    })

    if (existingItem) {
      return NextResponse.json(
        { error: 'Item code already exists' },
        { status: 400 }
      )
    }

    // Get user info
    const userName =
      auth.user.user_metadata?.name ||
      auth.user.user_metadata?.full_name ||
      auth.user.email?.split('@')[0] ||
      auth.user.email ||
      auth.user.id

    // Create inventory item
    const item = await prisma.inventoryItem.create({
      data: {
        itemCode,
        name,
        description,
        category,
        unit,
        currentStock: currentStock || 0,
        minStockLevel,
        maxStockLevel,
        unitCost,
        location,
        supplier,
        brand,
        model,
        sku,
        barcode,
        remarks,
      },
    })

    // Create initial transaction if stock is provided
    if (currentStock && parseFloat(currentStock.toString()) > 0) {
      await prisma.inventoryTransaction.create({
        data: {
          inventoryItemId: item.id,
          transactionType: 'IN',
          quantity: currentStock,
          unitCost,
          notes: 'Initial stock',
          actionBy: userName,
        },
      })
    }

    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    console.error('Error creating inventory item:', error)
    return NextResponse.json(
      { error: 'Failed to create inventory item' },
      { status: 500 }
    )
  }
}

