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
        include: {
          relatedTransaction: {
            include: {
              inventoryItem: {
                select: {
                  id: true,
                  itemCode: true,
                  name: true,
                },
              },
            },
          },
        },
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

  const permissionCheck = await requirePermission('canManageInventory')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { transactionType, quantity, unitCost, reference, notes, destinationItemId } = body

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

    // For TRANSFER, destinationItemId is required
    if (transactionType === 'TRANSFER' && !destinationItemId) {
      return NextResponse.json(
        { error: 'Destination item is required for transfer transactions' },
        { status: 400 }
      )
    }

    // Cannot transfer to the same item
    if (transactionType === 'TRANSFER' && destinationItemId === id) {
      return NextResponse.json(
        { error: 'Cannot transfer to the same item' },
        { status: 400 }
      )
    }

    // Get current item (source)
    const sourceItem = await prisma.inventoryItem.findUnique({
      where: { id },
    })

    if (!sourceItem) {
      return NextResponse.json(
        { error: 'Source inventory item not found' },
        { status: 404 }
      )
    }

    // Get destination item if TRANSFER
    let destinationItem = null
    if (transactionType === 'TRANSFER') {
      destinationItem = await prisma.inventoryItem.findUnique({
        where: { id: destinationItemId },
      })

      if (!destinationItem) {
        return NextResponse.json(
          { error: 'Destination inventory item not found' },
          { status: 404 }
        )
      }
    }

    // Get user info
    const userName =
      auth.user.user_metadata?.name ||
      auth.user.user_metadata?.full_name ||
      auth.user.email?.split('@')[0] ||
      auth.user.email ||
      auth.user.id

    // Calculate new stock
    let newSourceStock = parseFloat(sourceItem.currentStock.toString())
    const qty = parseFloat(quantity.toString())

    // Calculate weighted average cost for IN transactions
    let newUnitCost = sourceItem.unitCost ? parseFloat(sourceItem.unitCost.toString()) : null
    if (transactionType === 'IN' && unitCost) {
      const currentCost = sourceItem.unitCost ? parseFloat(sourceItem.unitCost.toString()) : 0
      const currentStock = parseFloat(sourceItem.currentStock.toString())
      const newCost = parseFloat(unitCost.toString())
      
      if (currentStock > 0 && currentCost > 0) {
        // Weighted average: (old stock × old cost + new stock × new cost) / total stock
        const totalValue = (currentStock * currentCost) + (qty * newCost)
        const totalStock = currentStock + qty
        newUnitCost = totalValue / totalStock
      } else {
        // First stock or no previous cost, use new cost
        newUnitCost = newCost
      }
    }

    if (transactionType === 'IN' || transactionType === 'ADJUSTMENT') {
      newSourceStock += qty
    } else if (transactionType === 'OUT') {
      // OUT removes stock (consumed, sold, damaged, etc.)
      newSourceStock -= qty
      if (newSourceStock < 0) {
        return NextResponse.json(
          { error: 'Insufficient stock' },
          { status: 400 }
        )
      }
    } else if (transactionType === 'TRANSFER') {
      // TRANSFER removes stock from source item
      newSourceStock -= qty
      if (newSourceStock < 0) {
        return NextResponse.json(
          { error: 'Insufficient stock' },
          { status: 400 }
        )
      }
    }

    // Create transaction(s) and update stock in a transaction
    const result = await prisma.$transaction(async (tx) => {
      if (transactionType === 'TRANSFER') {
        // Create OUT transaction for source item
        const sourceTransaction = await tx.inventoryTransaction.create({
          data: {
            inventoryItemId: id,
            transactionType: 'TRANSFER',
            quantity: qty,
            unitCost,
            reference,
            notes: notes || `Transfer to ${destinationItem?.name || destinationItemId}`,
            actionBy: userName,
          },
        })

        // Create IN transaction for destination item
        const destinationTransaction = await tx.inventoryTransaction.create({
          data: {
            inventoryItemId: destinationItemId,
            transactionType: 'IN',
            quantity: qty,
            unitCost,
            reference,
            notes: notes || `Transfer from ${sourceItem.name}`,
            actionBy: userName,
            relatedTransactionId: sourceTransaction.id,
          },
        })

        // Link source transaction to destination transaction
        await tx.inventoryTransaction.update({
          where: { id: sourceTransaction.id },
          data: {
            relatedTransactionId: destinationTransaction.id,
          },
        })

        // Update source item stock (TRANSFER doesn't change cost, just moves stock)
        await tx.inventoryItem.update({
          where: { id },
          data: {
            currentStock: newSourceStock,
          },
        })

        // Update destination item stock and calculate weighted average cost
        const newDestinationStock = parseFloat(destinationItem!.currentStock.toString()) + qty
        let newDestinationUnitCost = destinationItem!.unitCost ? parseFloat(destinationItem!.unitCost.toString()) : null
        if (unitCost) {
          const destCurrentCost = destinationItem!.unitCost ? parseFloat(destinationItem!.unitCost.toString()) : 0
          const destCurrentStock = parseFloat(destinationItem!.currentStock.toString())
          const transferCost = parseFloat(unitCost.toString())
          
          if (destCurrentStock > 0 && destCurrentCost > 0) {
            // Weighted average for destination
            const totalValue = (destCurrentStock * destCurrentCost) + (qty * transferCost)
            const totalStock = destCurrentStock + qty
            newDestinationUnitCost = totalValue / totalStock
          } else {
            // First stock or no previous cost, use transfer cost
            newDestinationUnitCost = transferCost
          }
        }
        
        await tx.inventoryItem.update({
          where: { id: destinationItemId },
          data: {
            currentStock: newDestinationStock,
            unitCost: newDestinationUnitCost,
          },
        })

        return sourceTransaction
      } else {
        // Create transaction record for non-transfer types
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

        // Update stock and unit cost (for IN transactions with cost)
        await tx.inventoryItem.update({
          where: { id },
          data: {
            currentStock: newSourceStock,
            ...(transactionType === 'IN' && newUnitCost !== null && { unitCost: newUnitCost }),
          },
        })

        return transaction
      }
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

