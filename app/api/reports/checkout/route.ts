import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { retryDbOperation } from '@/lib/db-utils'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canViewAssets')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const { searchParams } = new URL(request.url)
    
    // Parse filters
    const status = searchParams.get('status')
    const department = searchParams.get('department')
    const employeeId = searchParams.get('employeeId')
    const assetTagId = searchParams.get('assetTagId')
    const dueDate = searchParams.get('dueDate')
    const isOverdue = searchParams.get('isOverdue') === 'true'
    const location = searchParams.get('location')
    const site = searchParams.get('site')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const includeOverdue = searchParams.get('includeOverdue') === 'true'
    
    // Parse pagination
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)
    const skip = (page - 1) * pageSize

    // Build where clause for checkouts
    const checkoutWhere: Prisma.AssetsCheckoutWhereInput = {}

    // Date range filter
    if (startDate || endDate) {
      checkoutWhere.checkoutDate = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(endDate) } : {}),
      }
    }

    // Employee filter
    if (employeeId) {
      checkoutWhere.employeeUserId = employeeId
    }

    // Department filter (through employee)
    if (department) {
      checkoutWhere.employeeUser = {
        department: department,
      }
    }

    // Get all checkouts (including active and historical)
    const checkouts = await retryDbOperation(() =>
      prisma.assetsCheckout.findMany({
        where: checkoutWhere,
        include: {
          asset: {
            select: {
              id: true,
              assetTagId: true,
              description: true,
              status: true,
              cost: true,
              category: {
                select: {
                  name: true,
                },
              },
              subCategory: {
                select: {
                  name: true,
                },
              },
              department: true,
              location: true,
              site: true,
            },
          },
          employeeUser: {
            select: {
              id: true,
              name: true,
              email: true,
              department: true,
            },
          },
          checkins: {
            select: {
              id: true,
              checkinDate: true,
            },
            orderBy: { checkinDate: 'desc' },
            take: 1,
          },
        },
        orderBy: {
          checkoutDate: 'desc',
        },
      })
    )

    // Filter active checkouts (those without checkin)
    const activeCheckouts = checkouts.filter(
      (checkout) => checkout.checkins.length === 0
    )

    // Filter overdue checkouts
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const overdueCheckouts = activeCheckouts.filter((checkout) => {
      if (!checkout.expectedReturnDate) return false
      const expectedReturn = new Date(checkout.expectedReturnDate)
      expectedReturn.setHours(0, 0, 0, 0)
      return expectedReturn < today
    })

    // Group by employee
    const byEmployee = new Map<string, {
      employeeId: string
      employeeName: string
      employeeEmail: string
      department: string | null
      count: number
      overdueCount: number
      checkouts: typeof checkouts
    }>()

    activeCheckouts.forEach((checkout) => {
      const employeeId = checkout.employeeUserId || 'unknown'
      const employeeName = checkout.employeeUser?.name || 'Unknown'
      const employeeEmail = checkout.employeeUser?.email || ''
      const department = checkout.employeeUser?.department || null

      if (!byEmployee.has(employeeId)) {
        byEmployee.set(employeeId, {
          employeeId,
          employeeName,
          employeeEmail,
          department,
          count: 0,
          overdueCount: 0,
          checkouts: [],
        })
      }

      const group = byEmployee.get(employeeId)!
      group.count++
      group.checkouts.push(checkout)

      // Check if overdue
      if (checkout.expectedReturnDate) {
        const expectedReturn = new Date(checkout.expectedReturnDate)
        expectedReturn.setHours(0, 0, 0, 0)
        if (expectedReturn < today) {
          group.overdueCount++
        }
      }
    })

    // Group by department
    const byDepartment = new Map<string, {
      department: string
      count: number
      overdueCount: number
      employees: Set<string>
    }>()

    activeCheckouts.forEach((checkout) => {
      const department = checkout.employeeUser?.department || 'Unassigned'
      
      if (!byDepartment.has(department)) {
        byDepartment.set(department, {
          department,
          count: 0,
          overdueCount: 0,
          employees: new Set(),
        })
      }

      const group = byDepartment.get(department)!
      group.count++
      if (checkout.employeeUserId) {
        group.employees.add(checkout.employeeUserId)
      }

      // Check if overdue
      if (checkout.expectedReturnDate) {
        const expectedReturn = new Date(checkout.expectedReturnDate)
        expectedReturn.setHours(0, 0, 0, 0)
        if (expectedReturn < today) {
          group.overdueCount++
        }
      }
    })

    // Apply status filter if needed
    let filteredCheckouts = activeCheckouts
    if (status === 'overdue') {
      filteredCheckouts = overdueCheckouts
    }

    // Apply department filter if needed
    if (department) {
      filteredCheckouts = filteredCheckouts.filter(
        (checkout) => checkout.employeeUser?.department === department
      )
    }

    // Apply asset tag filter
    if (assetTagId) {
      filteredCheckouts = filteredCheckouts.filter(
        (checkout) => checkout.asset.assetTagId.toLowerCase().includes(assetTagId.toLowerCase())
      )
    }

    // Apply due date filter
    if (dueDate) {
      const dueDateObj = new Date(dueDate)
      dueDateObj.setHours(0, 0, 0, 0)
      filteredCheckouts = filteredCheckouts.filter((checkout) => {
        if (!checkout.expectedReturnDate) return false
        const expectedReturn = new Date(checkout.expectedReturnDate)
        expectedReturn.setHours(0, 0, 0, 0)
        return expectedReturn.getTime() === dueDateObj.getTime()
      })
    }

    // Apply past due filter
    if (isOverdue) {
      filteredCheckouts = filteredCheckouts.filter((checkout) => {
        if (!checkout.expectedReturnDate) return false
        const expectedReturn = new Date(checkout.expectedReturnDate)
        expectedReturn.setHours(0, 0, 0, 0)
        return expectedReturn < today
      })
    }

    // Apply location filter
    if (location) {
      filteredCheckouts = filteredCheckouts.filter(
        (checkout) => checkout.asset.location === location
      )
    }

    // Apply site filter
    if (site) {
      filteredCheckouts = filteredCheckouts.filter(
        (checkout) => checkout.asset.site === site
      )
    }

    // Calculate pagination
    const total = filteredCheckouts.length
    const totalPages = Math.ceil(total / pageSize)
    
    // Apply pagination
    const paginatedCheckouts = filteredCheckouts.slice(skip, skip + pageSize)

    return NextResponse.json({
      summary: {
        totalActive: activeCheckouts.length,
        totalOverdue: overdueCheckouts.length,
        totalHistorical: checkouts.length - activeCheckouts.length,
        byEmployee: Array.from(byEmployee.values()).map((group) => ({
          employeeId: group.employeeId,
          employeeName: group.employeeName,
          employeeEmail: group.employeeEmail,
          department: group.department,
          count: group.count,
          overdueCount: group.overdueCount,
        })),
        byDepartment: Array.from(byDepartment.values()).map((group) => ({
          department: group.department,
          count: group.count,
          overdueCount: group.overdueCount,
          employeeCount: group.employees.size,
        })),
      },
      checkouts: paginatedCheckouts.map((checkout) => ({
        id: checkout.id,
        assetId: checkout.assetId,
        assetTagId: checkout.asset.assetTagId,
        assetDescription: checkout.asset.description,
        assetStatus: checkout.asset.status,
        assetCost: checkout.asset.cost ? Number(checkout.asset.cost) : null,
        category: checkout.asset.category?.name || null,
        subCategory: checkout.asset.subCategory?.name || null,
        checkoutDate: checkout.checkoutDate.toISOString().split('T')[0],
        expectedReturnDate: checkout.expectedReturnDate
          ? checkout.expectedReturnDate.toISOString().split('T')[0]
          : null,
        returnDate: checkout.checkins.length > 0 && checkout.checkins[0].checkinDate
          ? checkout.checkins[0].checkinDate.toISOString().split('T')[0]
          : null,
        isOverdue: checkout.expectedReturnDate
          ? new Date(checkout.expectedReturnDate) < today
          : false,
        employeeId: checkout.employeeUserId,
        employeeName: checkout.employeeUser?.name || 'Unknown',
        employeeEmail: checkout.employeeUser?.email || '',
        employeeDepartment: checkout.employeeUser?.department || null,
        location: checkout.asset.location,
        site: checkout.asset.site,
      })),
      generatedAt: new Date().toISOString(),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    })
  } catch (error) {
    console.error('Error fetching checkout report:', error)
    return NextResponse.json(
      { error: 'Failed to fetch checkout report' },
      { status: 500 }
    )
  }
}

