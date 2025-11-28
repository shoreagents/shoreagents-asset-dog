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
    const category = searchParams.get('category')
    const location = searchParams.get('location')
    const site = searchParams.get('site')
    const department = searchParams.get('department')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const includeAllAssets = searchParams.get('includeAllAssets') === 'true'

    // Build where clause
    const whereClause: Prisma.AssetsWhereInput = {
      isDeleted: false,
    }

    // Apply filters
    if (status) {
      whereClause.status = status
    }

    if (category) {
      whereClause.categoryId = category
    }

    if (location) {
      whereClause.location = location
    }

    if (site) {
      whereClause.site = site
    }

    if (department) {
      whereClause.department = department
    }

    // Date range filter (on purchaseDate or createdAt)
    if (startDate || endDate) {
      whereClause.OR = [
        {
          purchaseDate: {
            ...(startDate ? { gte: new Date(startDate) } : {}),
            ...(endDate ? { lte: new Date(endDate) } : {}),
          },
        },
        {
          createdAt: {
            ...(startDate ? { gte: new Date(startDate) } : {}),
            ...(endDate ? { lte: new Date(endDate) } : {}),
          },
        },
      ]
    }

    // Get total assets count
    const totalAssets = await retryDbOperation(() =>
      prisma.assets.count({ where: whereClause })
    )

    // Get total value
    const valueResult = await retryDbOperation(() =>
      prisma.assets.aggregate({
        where: whereClause,
        _sum: {
          cost: true,
        },
      })
    )
    const totalValue = valueResult._sum.cost || 0

    // Get assets by status
    const statusGroups = await retryDbOperation(() =>
      prisma.assets.groupBy({
        by: ['status'],
        where: whereClause,
        _count: true,
        _sum: {
          cost: true,
        },
      })
    )

    // Format status groups
    const byStatus = statusGroups.map((group) => ({
      status: group.status || 'Unknown',
      count: group._count,
      value: group._sum.cost || 0,
    }))

    // Get assets by category
    const categoryGroups = await retryDbOperation(() =>
      prisma.assets.groupBy({
        by: ['categoryId'],
        where: whereClause,
        _count: true,
        _sum: {
          cost: true,
        },
      })
    )

    // Fetch category names
    const categoryIds = categoryGroups.map((g) => g.categoryId).filter(Boolean) as string[]
    const categories = await retryDbOperation(() =>
      prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true },
      })
    )

    const categoryMap = new Map(categories.map((c) => [c.id, c.name]))

    const byCategory = categoryGroups
      .filter((group) => group.categoryId)
      .map((group) => ({
        categoryId: group.categoryId!,
        categoryName: categoryMap.get(group.categoryId!) || 'Unknown',
        count: group._count,
        value: group._sum.cost || 0,
      }))
      .sort((a, b) => b.count - a.count)

    // Get assets by location
    const locationGroups = await retryDbOperation(() =>
      prisma.assets.groupBy({
        by: ['location'],
        where: {
          ...whereClause,
          location: { not: null },
        },
        _count: true,
      })
    )

    const byLocation = locationGroups
      .filter((group) => group.location)
      .map((group) => ({
        location: group.location!,
        count: group._count,
      }))
      .sort((a, b) => b.count - a.count)

    // Get assets by site
    const siteGroups = await retryDbOperation(() =>
      prisma.assets.groupBy({
        by: ['site'],
        where: {
          ...whereClause,
          site: { not: null },
        },
        _count: true,
      })
    )

    const bySite = siteGroups
      .filter((group) => group.site)
      .map((group) => ({
        site: group.site!,
        count: group._count,
      }))
      .sort((a, b) => b.count - a.count)

    // Get recent assets (last 10 or all if requested)
    const recentAssets = await retryDbOperation(() =>
      prisma.assets.findMany({
        where: whereClause,
        take: includeAllAssets ? undefined : 10,
        orderBy: { createdAt: 'desc' },
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
          location: true,
          site: true,
          department: true,
        },
      })
    )

    return NextResponse.json({
      summary: {
        totalAssets,
        totalValue,
        byStatus,
        byCategory,
        byLocation,
        bySite,
      },
      recentAssets,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error generating summary report:', error)
    return NextResponse.json(
      { error: 'Failed to generate summary report' },
      { status: 500 }
    )
  }
}

