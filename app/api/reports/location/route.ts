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
    const location = searchParams.get('location')
    const site = searchParams.get('site')
    const category = searchParams.get('category')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    // Parse pagination
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)
    const skip = (page - 1) * pageSize

    // Build where clause
    const whereClause: Prisma.AssetsWhereInput = {
      isDeleted: false,
    }

    // Apply filters
    if (location) {
      whereClause.location = location
    }

    if (site) {
      whereClause.site = site
    }

    if (category) {
      whereClause.categoryId = category
    }

    if (status) {
      whereClause.status = status
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

    // Get total count for pagination
    const totalAssets = await retryDbOperation(() =>
      prisma.assets.count({
        where: whereClause,
      })
    )
    
    // Get ALL assets for summary calculations (no pagination)
    const allAssets = await retryDbOperation(() =>
      prisma.assets.findMany({
        where: whereClause,
        select: {
          location: true,
          site: true,
          cost: true,
        },
      })
    )
    
    // Get paginated assets for the table
    const assets = await retryDbOperation(() =>
      prisma.assets.findMany({
        where: whereClause,
        include: {
          category: {
            select: {
              name: true,
            },
          },
          moves: {
            orderBy: { moveDate: 'desc' },
            take: 10,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: pageSize,
      })
    )
    
    // Calculate pagination info
    const totalPages = Math.ceil(totalAssets / pageSize)
    const hasNextPage = page < totalPages
    const hasPreviousPage = page > 1

    // Group by location (using ALL assets for summary)
    const byLocation = new Map<string, {
      location: string
      count: number
      totalValue: number
    }>()

    allAssets.forEach((asset) => {
      const locationKey = asset.location || 'Unassigned'
      
      if (!byLocation.has(locationKey)) {
        byLocation.set(locationKey, {
          location: locationKey,
          count: 0,
          totalValue: 0,
        })
      }

      const group = byLocation.get(locationKey)!
      group.count++
      group.totalValue += Number(asset.cost) || 0
    })

    // Group by site (using ALL assets for summary)
    const bySite = new Map<string, {
      site: string
      count: number
      totalValue: number
      locations: Set<string>
    }>()

    allAssets.forEach((asset) => {
      const siteKey = asset.site || 'Unassigned'
      
      if (!bySite.has(siteKey)) {
        bySite.set(siteKey, {
          site: siteKey,
          count: 0,
          totalValue: 0,
          locations: new Set(),
        })
      }

      const group = bySite.get(siteKey)!
      group.count++
      group.totalValue += Number(asset.cost) || 0
      if (asset.location) {
        group.locations.add(asset.location)
      }
    })

    // Get movement history
    const movements = await retryDbOperation(() =>
      prisma.assetsMove.findMany({
        where: {
          ...(startDate || endDate
            ? {
                moveDate: {
                  ...(startDate ? { gte: new Date(startDate) } : {}),
                  ...(endDate ? { lte: new Date(endDate) } : {}),
                },
              }
            : {}),
        },
        include: {
          asset: {
            select: {
              id: true,
              assetTagId: true,
              description: true,
              location: true,
              site: true,
            },
          },
          employeeUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          moveDate: 'desc',
        },
        take: 100,
      })
    )

    // Calculate location utilization (assets per location)
    const locationUtilization = Array.from(byLocation.values()).map((group) => ({
      location: group.location,
      assetCount: group.count,
      totalValue: group.totalValue,
      averageValue: group.count > 0 ? group.totalValue / group.count : 0,
      utilizationPercentage: totalAssets > 0
        ? (group.count / totalAssets) * 100
        : 0,
    }))

    // Calculate site utilization
    const siteUtilization = Array.from(bySite.values()).map((group) => ({
      site: group.site,
      assetCount: group.count,
      totalValue: group.totalValue,
      locationCount: group.locations.size,
      averageValue: group.count > 0 ? group.totalValue / group.count : 0,
      utilizationPercentage: totalAssets > 0
        ? (group.count / totalAssets) * 100
        : 0,
    }))

    return NextResponse.json({
      summary: {
        totalAssets,
        totalLocations: byLocation.size,
        totalSites: bySite.size,
        byLocation: locationUtilization,
        bySite: siteUtilization,
      },
      assets: assets.map((asset) => ({
        id: asset.id,
        assetTagId: asset.assetTagId,
        description: asset.description,
        status: asset.status,
        cost: asset.cost ? Number(asset.cost) : null,
        category: asset.category?.name || null,
        location: asset.location,
        site: asset.site,
        department: asset.department,
        lastMoveDate: asset.moves[0]?.moveDate
          ? asset.moves[0].moveDate.toISOString().split('T')[0]
          : null,
      })),
      movements: movements.map((move) => ({
        id: move.id,
        assetId: move.assetId,
        assetTagId: move.asset.assetTagId,
        assetDescription: move.asset.description,
        moveType: move.moveType,
        moveDate: move.moveDate.toISOString().split('T')[0],
        employeeName: move.employeeUser?.name || null,
        reason: move.reason,
        notes: move.notes,
      })),
      pagination: {
        page,
        pageSize,
        total: totalAssets,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching location report:', error)
    return NextResponse.json(
      { error: 'Failed to fetch location report' },
      { status: 500 }
    )
  }
}

