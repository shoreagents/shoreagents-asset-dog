import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { retryDbOperation } from '@/lib/db-utils'
import { requirePermission } from '@/lib/permission-utils'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // Check view permission
  const permissionCheck = await requirePermission('canViewAssets')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const { id } = await params

    // Check if report exists and belongs to the user
    const report = await retryDbOperation(() => prisma.assetReports.findUnique({
      where: { id },
      select: { userId: true },
    }))

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      )
    }

    // Verify ownership (users can only delete their own reports)
    if (report.userId !== auth.user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this report' },
        { status: 403 }
      )
    }

    // Delete the report
    await retryDbOperation(() => prisma.assetReports.delete({
      where: { id },
    }))

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const prismaError = error as { code?: string; message?: string }
    if (prismaError?.code !== 'P1001' && prismaError?.code !== 'P2024') {
      console.error('Error deleting asset report:', error)
    }
    return NextResponse.json(
      { error: 'Failed to delete asset report' },
      { status: 500 }
    )
  }
}

// Helper function to build where clause from report filters
function buildReportWhereClause(report: any) {
  const baseFilters: any = {
    deletedAt: null, // Only non-deleted assets
  }

  // Category filter
  if (report.categoryId) {
    baseFilters.categoryId = report.categoryId
  }

  // Subcategory filter
  if (report.subCategoryId) {
    baseFilters.subCategoryId = report.subCategoryId
  }

  // Status filter
  if (report.status) {
    baseFilters.status = { equals: report.status, mode: 'insensitive' }
  }

  // Location filters - for location report type, use OR logic so typos in one field don't block results
  let locationFilter: any = null
  if (report.reportType === 'location') {
    const locationFilters: any[] = []
    
    if (report.location) {
      locationFilters.push({ location: { contains: report.location, mode: 'insensitive' } })
    }
    
    if (report.department) {
      locationFilters.push({ department: { contains: report.department, mode: 'insensitive' } })
    }
    
    if (report.site) {
      locationFilters.push({ site: { contains: report.site, mode: 'insensitive' } })
    }
    
    if (locationFilters.length > 0) {
      locationFilter = { OR: locationFilters }
    }
  } else {
    // For other report types, use AND logic (all filters must match)
    if (report.location) {
      baseFilters.location = { contains: report.location, mode: 'insensitive' }
    }

    if (report.department) {
      baseFilters.department = { contains: report.department, mode: 'insensitive' }
    }

    if (report.site) {
      baseFilters.site = { contains: report.site, mode: 'insensitive' }
    }
  }

  // Cost range filters
  if (report.minCost !== null || report.maxCost !== null) {
    baseFilters.cost = {}
    if (report.minCost !== null) {
      baseFilters.cost.gte = Number(report.minCost)
    }
    if (report.maxCost !== null) {
      baseFilters.cost.lte = Number(report.maxCost)
    }
  }

  // Date range filters
  if (report.purchaseDateFrom || report.purchaseDateTo) {
    baseFilters.purchaseDate = {}
    if (report.purchaseDateFrom) {
      baseFilters.purchaseDate.gte = report.purchaseDateFrom
    }
    if (report.purchaseDateTo) {
      baseFilters.purchaseDate.lte = report.purchaseDateTo
    }
  }

  if (report.dateAcquiredFrom || report.dateAcquiredTo) {
    baseFilters.dateAcquired = {}
    if (report.dateAcquiredFrom) {
      baseFilters.dateAcquired.gte = report.dateAcquiredFrom
    }
    if (report.dateAcquiredTo) {
      baseFilters.dateAcquired.lte = report.dateAcquiredTo
    }
  }

  // Depreciation filters
  if (report.includeDepreciableOnly) {
    baseFilters.depreciableAsset = true
  }

  if (report.depreciationMethod) {
    baseFilters.depreciationMethod = report.depreciationMethod
  }

  // Combine base filters with location filter using AND
  return locationFilter
    ? { AND: [baseFilters, locationFilter] }
    : baseFilters
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // Check view permission
  const permissionCheck = await requirePermission('canViewAssets')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const includeAssets = searchParams.get('includeAssets') === 'true'

    const report = await retryDbOperation(() => prisma.assetReports.findUnique({
      where: { id },
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

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      )
    }

    // Verify ownership
    if (report.userId !== auth.user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to view this report' },
        { status: 403 }
      )
    }

    const response: any = { report }

    // If includeAssets is true, fetch matching assets with pagination
    if (includeAssets) {
      const page = parseInt(searchParams.get('page') || '1', 10)
      const pageSize = parseInt(searchParams.get('pageSize') || '10', 10)
      const skip = (page - 1) * pageSize

      const whereClause = buildReportWhereClause(report)
      
      // Get total count and assets
      const [assets, totalCount] = await retryDbOperation(() => Promise.all([
        prisma.assets.findMany({
          where: whereClause,
          select: {
            id: true,
            assetTagId: true,
            description: true,
            cost: true,
            status: true,
            location: true,
            department: true,
            site: true,
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
            assetTagId: 'asc',
          },
          skip,
          take: pageSize,
        }),
        prisma.assets.count({
          where: whereClause,
        }),
      ]))

      response.assets = assets
      response.assetsPagination = {
        page,
        pageSize,
        total: totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        hasNextPage: page < Math.ceil(totalCount / pageSize),
      }
    }

    return NextResponse.json(response)
  } catch (error: unknown) {
    const prismaError = error as { code?: string; message?: string }
    if (prismaError?.code !== 'P1001' && prismaError?.code !== 'P2024') {
      console.error('Error fetching asset report:', error)
    }
    return NextResponse.json(
      { error: 'Failed to fetch asset report' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // Check view permission
  const permissionCheck = await requirePermission('canViewAssets')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const { id } = await params

    // Get the report
    const report = await retryDbOperation(() => prisma.assetReports.findUnique({
      where: { id },
    }))

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      )
    }

    // Verify ownership
    if (report.userId !== auth.user.id) {
      return NextResponse.json(
        { error: 'You do not have permission to generate this report' },
        { status: 403 }
      )
    }

    // Build where clause using helper function
    const whereClause = buildReportWhereClause(report)

    // Query assets matching the filters
    const [assets, totalValueResult] = await retryDbOperation(() => Promise.all([
      prisma.assets.findMany({
        where: whereClause,
        select: {
          id: true,
          cost: true,
        },
      }),
      prisma.assets.aggregate({
        where: whereClause,
        _sum: {
          cost: true,
        },
        _count: {
          id: true,
        },
      }),
    ]))

    const totalAssets = totalValueResult._count.id || 0
    const totalValue = totalValueResult._sum.cost ? Number(totalValueResult._sum.cost) : null
    const averageCost = totalAssets > 0 && totalValue !== null ? totalValue / totalAssets : null

    // Update report with calculated values
    const updatedReport = await retryDbOperation(() => prisma.assetReports.update({
      where: { id },
      data: {
        reportStatus: 'generated',
        generatedAt: new Date(),
        totalAssets,
        totalValue: totalValue !== null ? totalValue : null,
        averageCost: averageCost !== null ? averageCost : null,
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

    return NextResponse.json({ report: updatedReport })
  } catch (error: unknown) {
    const prismaError = error as { code?: string; message?: string }
    if (prismaError?.code !== 'P1001' && prismaError?.code !== 'P2024') {
      console.error('Error generating asset report:', error)
    }
    return NextResponse.json(
      { error: 'Failed to generate asset report' },
      { status: 500 }
    )
  }
}

