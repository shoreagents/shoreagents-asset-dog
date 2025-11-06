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

    const employee = await prisma.employeeUser.findUnique({
      where: {
        id,
      },
      include: {
        checkouts: {
          include: {
            asset: {
              select: {
                id: true,
                assetTagId: true,
                description: true,
              },
            },
          },
          orderBy: {
            checkoutDate: 'desc',
          },
        },
        checkins: {
          include: {
            asset: {
              select: {
                id: true,
                assetTagId: true,
                description: true,
              },
            },
          },
          orderBy: {
            checkinDate: 'desc',
          },
        },
        moves: {
          include: {
            asset: {
              select: {
                id: true,
                assetTagId: true,
                description: true,
              },
            },
          },
          orderBy: {
            moveDate: 'desc',
          },
        },
        reservations: {
          include: {
            asset: {
              select: {
                id: true,
                assetTagId: true,
                description: true,
              },
            },
          },
          orderBy: {
            reservationDate: 'desc',
          },
        },
      },
    })

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ employee })
  } catch (error) {
    console.error('Error fetching employee:', error)
    return NextResponse.json(
      { error: 'Failed to fetch employee' },
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

  const permissionCheck = await requirePermission('canManageEmployees')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const { id } = await params
    const body = await request.json()
    const { name, email, department } = body

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    const employee = await prisma.employeeUser.update({
      where: {
        id,
      },
      data: {
        name,
        email,
        department: department || null,
      },
    })

    return NextResponse.json({ employee })
  } catch (error: unknown) {
    console.error('Error updating employee:', error)
    const prismaError = error as { code?: string; message?: string }
    
    // Handle unique constraint violation (duplicate email)
    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        { error: 'An employee with this email already exists' },
        { status: 409 }
      )
    }

    // Handle not found
    if (prismaError.code === 'P2025') {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update employee' },
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

  const permissionCheck = await requirePermission('canManageEmployees')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const { id } = await params

    // Check if employee has any active checkouts
    const activeCheckouts = await prisma.assetsCheckout.findFirst({
      where: {
        employeeUserId: id,
        checkins: {
          none: {},
        },
      },
    })

    if (activeCheckouts) {
      return NextResponse.json(
        { error: 'Cannot delete employee with active asset checkouts' },
        { status: 400 }
      )
    }

    await prisma.employeeUser.delete({
      where: {
        id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error deleting employee:', error)
    const prismaError = error as { code?: string; message?: string }
    
    // Handle not found
    if (prismaError.code === 'P2025') {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to delete employee' },
      { status: 500 }
    )
  }
}

