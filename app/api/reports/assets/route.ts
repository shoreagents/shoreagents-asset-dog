import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { retryDbOperation } from '@/lib/db-utils'
import { requirePermission } from '@/lib/permission-utils'

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // Check view permission
  const permissionCheck = await requirePermission('canViewAssets')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10)
    const skip = (page - 1) * pageSize

    // Build where clause for filtering
    // Note: Reports are not filtered by userId - all users with canViewAssets can see all reports
    const whereClause: {
      reportStatus?: string
      reportType?: string
    } = {}

    const reportStatus = searchParams.get('status')
    if (reportStatus && reportStatus !== 'all') {
      whereClause.reportStatus = reportStatus
    }

    const reportType = searchParams.get('type')
    if (reportType && reportType !== 'all') {
      whereClause.reportType = reportType
    }

    // Get total count
    const totalCount: number = await retryDbOperation<number>(() => prisma.assetReports.count({
      where: whereClause,
    }))

    // Fetch reports with pagination
    const reports = await retryDbOperation(() => prisma.assetReports.findMany({
      where: whereClause,
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        subCategory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: pageSize,
    }))

    return NextResponse.json({
      reports,
      pagination: {
        page,
        pageSize,
        total: totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        hasNextPage: page < Math.ceil(totalCount / pageSize),
        hasPreviousPage: page > 1,
      },
    })
  } catch (error: unknown) {
    const prismaError = error as { code?: string; message?: string }
    if (prismaError?.code !== 'P1001' && prismaError?.code !== 'P2024') {
      console.error('Error fetching asset reports:', error)
    }
    return NextResponse.json(
      { error: 'Failed to fetch asset reports' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // Check manage reports permission
  const permissionCheck = await requirePermission('canManageReports')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const body = await request.json()
    const {
      reportName,
      reportType,
      description,
      categoryId,
      subCategoryId,
      status,
      location,
      department,
      site,
      minCost,
      maxCost,
      purchaseDateFrom,
      purchaseDateTo,
      dateAcquiredFrom,
      dateAcquiredTo,
      includeDepreciableOnly,
      depreciationMethod,
      notes,
    } = body

    // Validate required fields
    if (!reportName || !reportType) {
      return NextResponse.json(
        { error: 'Report name and type are required' },
        { status: 400 }
      )
    }

    // Create report
    const report = await retryDbOperation(() => prisma.assetReports.create({
      data: {
        reportName,
        reportType,
        description: description || null,
        categoryId: categoryId || null,
        subCategoryId: subCategoryId || null,
        status: status || null,
        location: location || null,
        department: department || null,
        site: site || null,
        minCost: minCost ? parseFloat(minCost) : null,
        maxCost: maxCost ? parseFloat(maxCost) : null,
        purchaseDateFrom: purchaseDateFrom ? new Date(purchaseDateFrom) : null,
        purchaseDateTo: purchaseDateTo ? new Date(purchaseDateTo) : null,
        dateAcquiredFrom: dateAcquiredFrom ? new Date(dateAcquiredFrom) : null,
        dateAcquiredTo: dateAcquiredTo ? new Date(dateAcquiredTo) : null,
        includeDepreciableOnly: includeDepreciableOnly || false,
        depreciationMethod: depreciationMethod || null,
        userId: auth.user.id,
        generatedAt: new Date(),
        reportStatus: 'draft',
        notes: notes || null,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        subCategory: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }))

    return NextResponse.json({ report }, { status: 201 })
  } catch (error: unknown) {
    const prismaError = error as { code?: string; message?: string }
    if (prismaError?.code !== 'P1001' && prismaError?.code !== 'P2024') {
      console.error('Error creating asset report:', error)
    }
    return NextResponse.json(
      { error: 'Failed to create asset report' },
      { status: 500 }
    )
  }
}

