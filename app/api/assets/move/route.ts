import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseDate } from '@/lib/date-utils'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'

export async function POST(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canMove')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const body = await request.json()
    const { assetId, moveType, moveDate, location, employeeUserId, department, reason, notes } = body

    if (!assetId) {
      return NextResponse.json(
        { error: 'Asset ID is required' },
        { status: 400 }
      )
    }

    if (!moveType) {
      return NextResponse.json(
        { error: 'Move type is required' },
        { status: 400 }
      )
    }

    if (!moveDate) {
      return NextResponse.json(
        { error: 'Move date is required' },
        { status: 400 }
      )
    }

    // Validate move type specific requirements
    if (moveType === 'Location Transfer' && !location) {
      return NextResponse.json(
        { error: 'Location is required for Location Transfer' },
        { status: 400 }
      )
    }

    if (moveType === 'Employee Assignment' && !employeeUserId) {
      return NextResponse.json(
        { error: 'Employee user is required for Employee Assignment' },
        { status: 400 }
      )
    }

    if (moveType === 'Department Transfer' && !department) {
      return NextResponse.json(
        { error: 'Department is required for Department Transfer' },
        { status: 400 }
      )
    }

    // Create move record and update asset in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Get current asset to capture previous values
      const asset = await tx.assets.findUnique({
        where: { id: assetId },
      })

      if (!asset) {
        throw new Error(`Asset with ID ${assetId} not found`)
      }

      // Check if asset is currently leased
      const activeLease = await tx.assetsLease.findFirst({
        where: {
          assetId,
          OR: [
            { leaseEndDate: null },
            { leaseEndDate: { gte: parseDate(moveDate)! } },
          ],
        },
      })

      if (activeLease) {
        throw new Error(`Asset cannot be moved. It is currently leased to ${activeLease.lessee}`)
      }

      // Prepare asset update data based on move type
      const assetUpdateData: Record<string, unknown> = {}

      if (moveType === 'Location Transfer') {
        assetUpdateData.location = location || null
      } else if (moveType === 'Department Transfer') {
        assetUpdateData.department = department || null
      }

      // For Employee Assignment, update the active checkout record
      if (moveType === 'Employee Assignment' && employeeUserId) {
        // Find the active checkout (one without checkins)
        const activeCheckout = await tx.assetsCheckout.findFirst({
          where: {
            assetId,
            checkins: {
              none: {}
            }
          },
          orderBy: {
            checkoutDate: 'desc'
          }
        })

        if (activeCheckout) {
          // Update existing checkout to reassign to new employee
          await tx.assetsCheckout.update({
            where: { id: activeCheckout.id },
            data: {
              employeeUserId: employeeUserId,
              checkoutDate: parseDate(moveDate)!, // Update checkout date to move date
            },
          })
        } else {
          // No active checkout, create a new one
          await tx.assetsCheckout.create({
            data: {
              assetId,
              employeeUserId: employeeUserId,
              checkoutDate: parseDate(moveDate)!,
            },
          })
          // Update asset status to "Checked out"
          assetUpdateData.status = "Checked out"
        }
      }

      // Update asset if there are changes
      if (Object.keys(assetUpdateData).length > 0) {
        await tx.assets.update({
          where: { id: assetId },
          data: assetUpdateData,
        })
      }

      // Create move record (history tracking)
      const move = await tx.assetsMove.create({
        data: {
          assetId,
          moveType,
          moveDate: parseDate(moveDate)!,
          employeeUserId: moveType === 'Employee Assignment' ? employeeUserId : null,
          reason: reason || null,
          notes: notes || null,
        },
        include: {
          asset: true,
          employeeUser: true,
        },
      })

      return move
    })

    return NextResponse.json({ 
      success: true,
      move: result
    })
  } catch (error) {
    console.error('Error creating move:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to move asset' },
      { status: 500 }
    )
  }
}

