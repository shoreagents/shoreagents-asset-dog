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
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)
    const transactionType = searchParams.get('type')

    const whereClause: any = {
      inventoryItemId: id,
    }

    if (transactionType) {
      whereClause.transactionType = transactionType
    }

    const [totalCount, transactions] = await Promise.all([
      prisma.inventoryTransaction.count({ where: whereClause }),
      prisma.inventoryTransaction.findMany({
        where: whereClause,
        orderBy: { transactionDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return NextResponse.json({
      transactions,
      pagination: {
        total: totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    })
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    )
  }
}

export async function POST(
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
    const { transactionType, quantity, unitCost, reference, notes } = body

    if (!transactionType || !quantity) {
      return NextResponse.json(
        { error: 'Transaction type and quantity are required' },
        { status: 400 }
      )
    }

    if (!['IN', 'OUT', 'ADJUSTMENT', 'TRANSFER'].includes(transactionType)) {
      return NextResponse.json(
        { error: 'Invalid transaction type' },
        { status: 400 }
      )
    }

    // Get current item
    const item = await prisma.inventoryItem.findUnique({
      where: { id },
    })

    if (!item) {
      return NextResponse.json(
        { error: 'Inventory item not found' },
        { status: 404 }
      )
    }

    // Get user info
    const userName =
      auth.user.user_metadata?.name ||
      auth.user.user_metadata?.full_name ||
      auth.user.email?.split('@')[0] ||
      auth.user.email ||
      auth.user.id

    // Calculate new stock
    let newStock = parseFloat(item.currentStock.toString())
    const qty = parseFloat(quantity.toString())

    if (transactionType === 'IN' || transactionType === 'ADJUSTMENT') {
      newStock += qty
    } else if (transactionType === 'OUT') {
      newStock -= qty
      if (newStock < 0) {
        return NextResponse.json(
          { error: 'Insufficient stock' },
          { status: 400 }
        )
      }
    }

    // Create transaction and update stock in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create transaction record
      const transaction = await tx.inventoryTransaction.create({
        data: {
          inventoryItemId: id,
          transactionType,
          quantity: qty,
          unitCost,
          reference,
          notes,
          actionBy: userName,
        },
      })

      // Update stock
      await tx.inventoryItem.update({
        where: { id },
        data: {
          currentStock: newStock,
        },
      })

      return transaction
    })

    return NextResponse.json({ transaction: result }, { status: 201 })
  } catch (error) {
    console.error('Error creating transaction:', error)
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    )
  }
}

