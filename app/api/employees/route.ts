import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const excludeWithCheckedOutAssets = searchParams.get('excludeWithCheckedOutAssets') === 'true'
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '100', 10)
    const skip = (page - 1) * pageSize
    
    let whereClause = {}
    
    if (search) {
      whereClause = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { department: { contains: search, mode: 'insensitive' } },
        ]
      }
    }

    // If we need to exclude employees with checked out assets
    if (excludeWithCheckedOutAssets) {
      // Get IDs of employees who have active checkouts (assets with status "Checked out")
      const employeesWithActiveCheckouts = await prisma.assetsCheckout.findMany({
        where: {
          asset: {
            status: "Checked out"
          }
        },
        select: {
          employeeUserId: true
        },
        distinct: ['employeeUserId']
      })

      const employeeIdsToExclude = employeesWithActiveCheckouts
        .map(checkout => checkout.employeeUserId)
        .filter((id): id is string => id !== null) // Filter out null values

      if (employeeIdsToExclude.length > 0) {
        whereClause = {
          ...whereClause,
          id: {
            notIn: employeeIdsToExclude
          }
        }
      }
    }

    // Get total count for pagination
    const totalCount = await prisma.employeeUser.count({ where: whereClause })

    const employees = await prisma.employeeUser.findMany({
      where: whereClause,
      include: {
        checkouts: {
          where: {
            asset: {
              status: "Checked out"
            }
          },
          include: {
            asset: {
              select: {
                id: true,
                assetTagId: true,
                description: true,
                status: true,
                category: {
                  select: {
                    name: true
                  }
                },
                subCategory: {
                  select: {
                    name: true
                  }
                },
                location: true,
                brand: true,
                model: true,
              }
            },
            checkins: {
              select: {
                id: true
              }
            }
          },
          orderBy: {
            checkoutDate: 'desc',
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
      skip,
      take: pageSize,
    })

    // Filter checkouts to only include active ones (those without checkins)
    const employeesWithFilteredCheckouts = employees.map(employee => ({
      ...employee,
      checkouts: employee.checkouts.filter(checkout => checkout.checkins.length === 0)
    }))

    const totalPages = Math.ceil(totalCount / pageSize)

    return NextResponse.json({ 
      employees: employeesWithFilteredCheckouts,
      pagination: {
        page,
        pageSize,
        total: totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      }
    })
  } catch (error: unknown) {
    // Only log non-transient errors (not connection retries)
    const prismaError = error as { code?: string; message?: string }
    if (prismaError?.code !== 'P1001') {
      console.error('Error fetching employees:', error)
    }
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canManageEmployees')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
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

    const employee = await prisma.employeeUser.create({
      data: {
        name,
        email,
        department: department || null,
      },
    })

    return NextResponse.json({ employee }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating employee:', error)
    
    // Handle unique constraint violation (duplicate email)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'An employee with this email already exists' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create employee' },
      { status: 500 }
    )
  }
}

