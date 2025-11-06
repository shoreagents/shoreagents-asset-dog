import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { parseDate } from '@/lib/date-utils'
import { requirePermission } from '@/lib/permission-utils'

// PATCH - Update a checkout record (e.g., assign employee)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ checkoutId: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canCheckout')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const { checkoutId } = await params
    const body = await request.json()

    const updateData: Record<string, unknown> = {}

    if (body.employeeUserId !== undefined) {
      updateData.employeeUserId = body.employeeUserId || null
    }

    if (body.checkoutDate) {
      updateData.checkoutDate = parseDate(body.checkoutDate) || undefined
    }

    if (body.expectedReturnDate !== undefined) {
      updateData.expectedReturnDate = body.expectedReturnDate ? parseDate(body.expectedReturnDate) : null
    }

    const checkout = await prisma.assetsCheckout.update({
      where: {
        id: checkoutId,
      },
      data: updateData,
      include: {
        asset: true,
        employeeUser: true,
      },
    })

    return NextResponse.json({ checkout })
  } catch (error) {
    console.error('Error updating checkout record:', error)
    return NextResponse.json(
      { error: 'Failed to update checkout record' },
      { status: 500 }
    )
  }
}

// GET - Get a single checkout record
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ checkoutId: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  try {
    const { checkoutId } = await params

    const checkout = await prisma.assetsCheckout.findUnique({
      where: {
        id: checkoutId,
      },
      include: {
        asset: true,
        employeeUser: true,
        checkins: {
          orderBy: { checkinDate: 'desc' },
          take: 1,
        },
      },
    })

    if (!checkout) {
      return NextResponse.json(
        { error: 'Checkout record not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ checkout })
  } catch (error) {
    console.error('Error fetching checkout record:', error)
    return NextResponse.json(
      { error: 'Failed to fetch checkout record' },
      { status: 500 }
    )
  }
}

