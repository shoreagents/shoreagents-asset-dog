import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseDate } from '@/lib/date-utils'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'

export async function POST(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canReserve')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const body = await request.json()
    const { assetId, reservationType, reservationDate, purpose, notes, employeeUserId, department } = body

    if (!assetId) {
      return NextResponse.json(
        { error: 'Asset ID is required' },
        { status: 400 }
      )
    }

    if (!reservationType) {
      return NextResponse.json(
        { error: 'Reservation type is required' },
        { status: 400 }
      )
    }

    if (!reservationDate) {
      return NextResponse.json(
        { error: 'Reservation date is required' },
        { status: 400 }
      )
    }

    // Validate reservation type specific requirements
    if (reservationType === 'Employee' && !employeeUserId) {
      return NextResponse.json(
        { error: 'Employee user is required for Employee reservation' },
        { status: 400 }
      )
    }

    if (reservationType === 'Department' && !department) {
      return NextResponse.json(
        { error: 'Department is required for Department reservation' },
        { status: 400 }
      )
    }

    // Create reservation record in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Verify asset exists
      const asset = await tx.assets.findUnique({
        where: { id: assetId },
      })

      if (!asset) {
        throw new Error(`Asset with ID ${assetId} not found`)
      }

      // Create reservation record (history tracking)
      const reservation = await tx.assetsReserve.create({
        data: {
          assetId,
          reservationType,
          reservationDate: parseDate(reservationDate)!,
          purpose: purpose || null,
          notes: notes || null,
          employeeUserId: reservationType === 'Employee' ? employeeUserId : null,
          department: reservationType === 'Department' ? department : null,
        },
        include: {
          asset: true,
          employeeUser: true,
        },
      })

      return reservation
    })

    return NextResponse.json({ 
      success: true,
      reservation: result
    })
  } catch (error) {
    console.error('Error creating reservation:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reserve asset' },
      { status: 500 }
    )
  }
}

