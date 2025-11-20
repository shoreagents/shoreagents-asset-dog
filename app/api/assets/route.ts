import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseDate } from '@/lib/date-utils'
import { verifyAuth } from '@/lib/auth-utils'
import { retryDbOperation } from '@/lib/db-utils'
import { requirePermission, getUserPermissions, hasPermission } from '@/lib/permission-utils'
import { clearCache } from '@/lib/cache-utils'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const status = searchParams.get('status')
    const withMaintenance = searchParams.get('withMaintenance') === 'true'
    const includeDeleted = searchParams.get('includeDeleted') === 'true'

    // Check appropriate permission based on what's being requested
    if (includeDeleted) {
      // For viewing deleted assets (trash), allow canViewAssets OR canManageTrash
      const { user: trashUser, error: trashError } = await getUserPermissions()
      if (trashError) return trashError
      if (!trashUser) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
      const canViewAssets = hasPermission(trashUser, 'canViewAssets')
      const canManageTrash = hasPermission(trashUser, 'canManageTrash')
      if (!canViewAssets && !canManageTrash) {
        return NextResponse.json(
          { error: 'You do not have permission to view deleted assets' },
          { status: 403 }
        )
      }
    } else {
      // For viewing regular assets, check canViewAssets permission
      const permissionCheck = await requirePermission('canViewAssets')
      if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }
    }
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)
    const skip = (page - 1) * pageSize
    
    const whereClause: Prisma.AssetsWhereInput = {
      // Exclude soft-deleted assets by default
      ...(includeDeleted ? {} : { isDeleted: false }),
    }
    
    // Search filter
    if (search) {
      const searchFieldsParam = searchParams.get('searchFields')
      const searchFields = searchFieldsParam ? searchFieldsParam.split(',') : null
      
      const searchConditions: Prisma.AssetsWhereInput[] = []
      
      // If searchFields is provided, only search in those fields
      // Otherwise, search in all default fields
      const fieldsToSearch = searchFields || [
        'assetTagId', 'description', 'brand', 'model', 'serialNo', 'owner', 
        'issuedTo', 'department', 'site', 'location'
      ]
      
      // Map field names to Prisma conditions
      fieldsToSearch.forEach(field => {
        if (field === 'assetTagId') {
          searchConditions.push({ assetTagId: { contains: search, mode: 'insensitive' } })
        } else if (field === 'description') {
          searchConditions.push({ description: { contains: search, mode: 'insensitive' } })
        } else if (field === 'brand') {
          searchConditions.push({ brand: { contains: search, mode: 'insensitive' } })
        } else if (field === 'model') {
          searchConditions.push({ model: { contains: search, mode: 'insensitive' } })
        } else if (field === 'serialNo') {
          searchConditions.push({ serialNo: { contains: search, mode: 'insensitive' } })
        } else if (field === 'owner') {
          searchConditions.push({ owner: { contains: search, mode: 'insensitive' } })
        } else if (field === 'issuedTo') {
          searchConditions.push({ issuedTo: { contains: search, mode: 'insensitive' } })
        } else if (field === 'department') {
          searchConditions.push({ department: { contains: search, mode: 'insensitive' } })
        } else if (field === 'site') {
          searchConditions.push({ site: { contains: search, mode: 'insensitive' } })
        } else if (field === 'location') {
          searchConditions.push({ location: { contains: search, mode: 'insensitive' } })
        } else if (field === 'category.name') {
          searchConditions.push({ category: { name: { contains: search, mode: 'insensitive' } } })
        } else if (field === 'subCategory.name') {
          searchConditions.push({ subCategory: { name: { contains: search, mode: 'insensitive' } } })
        } else if (field === 'status') {
          searchConditions.push({ status: { contains: search, mode: 'insensitive' } })
        } else if (field === 'purchasedFrom') {
          searchConditions.push({ purchasedFrom: { contains: search, mode: 'insensitive' } })
        } else if (field === 'additionalInformation') {
          searchConditions.push({ additionalInformation: { contains: search, mode: 'insensitive' } })
        } else if (field === 'xeroAssetNo') {
          searchConditions.push({ xeroAssetNo: { contains: search, mode: 'insensitive' } })
        } else if (field === 'pbiNumber') {
          searchConditions.push({ pbiNumber: { contains: search, mode: 'insensitive' } })
        } else if (field === 'poNumber') {
          searchConditions.push({ poNumber: { contains: search, mode: 'insensitive' } })
        } else if (field === 'paymentVoucherNumber') {
          searchConditions.push({ paymentVoucherNumber: { contains: search, mode: 'insensitive' } })
        } else if (field === 'assetType') {
          searchConditions.push({ assetType: { contains: search, mode: 'insensitive' } })
        } else if (field === 'remarks') {
          searchConditions.push({ remarks: { contains: search, mode: 'insensitive' } })
        } else if (field === 'qr') {
          searchConditions.push({ qr: { contains: search, mode: 'insensitive' } })
        } else if (field === 'oldAssetTag') {
          searchConditions.push({ oldAssetTag: { contains: search, mode: 'insensitive' } })
        } else if (field === 'depreciationMethod') {
          searchConditions.push({ depreciationMethod: { contains: search, mode: 'insensitive' } })
        } else if (field === 'checkouts.checkoutDate') {
          // Date fields - parse search string as date and search by date range
          const searchDate = parseDate(search)
          if (searchDate) {
            // Search for dates on the same day (start of day to end of day)
            const startOfDay = new Date(searchDate)
            startOfDay.setHours(0, 0, 0, 0)
            const endOfDay = new Date(searchDate)
            endOfDay.setHours(23, 59, 59, 999)
            searchConditions.push({
              checkouts: {
                some: {
                  checkoutDate: {
                    gte: startOfDay,
                    lte: endOfDay,
                  },
                },
              },
            })
          }
        } else if (field === 'checkouts.expectedReturnDate') {
          // Date fields - parse search string as date and search by date range
          const searchDate = parseDate(search)
          if (searchDate) {
            // Search for dates on the same day (start of day to end of day)
            const startOfDay = new Date(searchDate)
            startOfDay.setHours(0, 0, 0, 0)
            const endOfDay = new Date(searchDate)
            endOfDay.setHours(23, 59, 59, 999)
            searchConditions.push({
              checkouts: {
                some: {
                  expectedReturnDate: {
                    gte: startOfDay,
                    lte: endOfDay,
                  },
                },
              },
            })
          }
        } else if (field === 'auditHistory.auditDate') {
          // Date fields - parse search string as date and search by date range
          const searchDate = parseDate(search)
          if (searchDate) {
            // Search for dates on the same day (start of day to end of day)
            const startOfDay = new Date(searchDate)
            startOfDay.setHours(0, 0, 0, 0)
            const endOfDay = new Date(searchDate)
            endOfDay.setHours(23, 59, 59, 999)
            searchConditions.push({
              auditHistory: {
                some: {
                  auditDate: {
                    gte: startOfDay,
                    lte: endOfDay,
                  },
                },
              },
            })
          }
        } else if (field === 'auditHistory.auditType') {
          searchConditions.push({ auditHistory: { some: { auditType: { contains: search, mode: 'insensitive' } } } })
        } else if (field === 'auditHistory.auditor') {
          searchConditions.push({ auditHistory: { some: { auditor: { contains: search, mode: 'insensitive' } } } })
        }
      })
      
      // Also include employee search if not filtering by specific fields or if employee fields are included
      if (!searchFields || searchFields.some(f => f.includes('employee'))) {
        searchConditions.push(
          { checkouts: { some: { employeeUser: { name: { contains: search, mode: 'insensitive' } } } } },
          { checkouts: { some: { employeeUser: { email: { contains: search, mode: 'insensitive' } } } } }
        )
      }
      
      if (searchConditions.length > 0) {
        whereClause.OR = searchConditions
      }
      }
    
    // Category filter
    if (category && category !== 'all') {
      whereClause.category = {
        name: { equals: category, mode: 'insensitive' }
      }
    }
    
    // Status filter
    if (status && status !== 'all') {
      whereClause.status = { equals: status, mode: 'insensitive' }
    }

    // Get total count for pagination
    const totalCount = await retryDbOperation(() => 
      prisma.assets.count({ where: whereClause })
    )

    // Build include object
    const include: Prisma.AssetsInclude = {
      category: true,
      subCategory: true,
      checkouts: {
        include: {
          employeeUser: true,
        },
        orderBy: { checkoutDate: 'desc' },
        take: 1,
      },
      leases: {
        where: {
          OR: [
            { leaseEndDate: null },
            { leaseEndDate: { gte: new Date() } },
          ],
        },
        include: {
          returns: {
            take: 1,
          },
        },
        orderBy: { leaseStartDate: 'desc' },
        take: 1,
      },
      auditHistory: {
        orderBy: { auditDate: 'desc' },
        take: 5, // Include latest 5 audits
      },
    }

    // Include maintenance if requested
    if (withMaintenance) {
      include.maintenances = {
        orderBy: { createdAt: 'desc' },
        take: 1, // Get the most recent maintenance
      }
    }

    // Fetch paginated assets
    // Use stable sorting: createdAt desc, then id desc for consistent ordering
    const assets = await retryDbOperation(() => prisma.assets.findMany({
      where: whereClause,
      include,
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' }, // Secondary sort by ID for stable ordering
      ],
      skip,
      take: pageSize,
    }))

    // Get image counts for all assets in this page
    let assetsWithImageCount = assets
    
    if (assets.length > 0) {
      const assetTagIds = assets.map(asset => asset.assetTagId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imageCounts = await (prisma as any).assetsImage.groupBy({
        by: ['assetTagId'],
        where: {
          assetTagId: { in: assetTagIds },
        },
        _count: {
          assetTagId: true,
        },
      })

      // Create a map of assetTagId to image count
      const imageCountMap = new Map(
        imageCounts.map((item: { assetTagId: string; _count: { assetTagId: number } }) => [
          item.assetTagId,
          item._count.assetTagId,
        ])
      )

      // Add image count to each asset
      assetsWithImageCount = assets.map(asset => ({
        ...asset,
        imagesCount: imageCountMap.get(asset.assetTagId) || 0,
      }))
    }

    // Check if unique statuses are requested
    const statusesOnly = searchParams.get('statuses') === 'true'
    if (statusesOnly) {
      // Return only unique statuses - fetch only status field (much faster than full assets)
      const assetsWithStatus = await retryDbOperation(() => prisma.assets.findMany({
        where: whereClause,
        select: {
          status: true,
        },
      }))
      
      // Extract unique statuses in memory (much faster than fetching 10k full assets)
      const uniqueStatuses = Array.from(new Set(
        assetsWithStatus.map(asset => asset.status).filter(Boolean)
      )).sort()
      
      return NextResponse.json({
        statuses: uniqueStatuses,
      })
    }

    // Check if summary is requested
    const summaryOnly = searchParams.get('summary') === 'true'
    if (summaryOnly) {
      // Use database aggregation for much faster summary calculation
      // Run all queries in a transaction to use a single connection and improve performance
      const [totalAssets, totalValueResult, availableAssets, checkedOutAssets] = await retryDbOperation(() =>
        prisma.$transaction([
          prisma.assets.count({ where: whereClause }),
          prisma.assets.aggregate({
        where: whereClause,
            _sum: {
          cost: true,
            },
          }),
          prisma.assets.count({
            where: {
              ...whereClause,
              status: { equals: 'Available', mode: 'insensitive' },
            },
          }),
          prisma.assets.count({
            where: {
              ...whereClause,
              status: { equals: 'Checked out', mode: 'insensitive' },
            },
          }),
        ])
      )

      const totalValue = totalValueResult._sum.cost ? Number(totalValueResult._sum.cost) : 0

      return NextResponse.json({
        summary: {
          totalAssets,
          totalValue,
          availableAssets,
          checkedOutAssets,
        }
      })
    }

    // Compute summary statistics in parallel with assets query for main response
    // This avoids a separate API call and improves performance
    const [totalValueResult, availableAssets, checkedOutAssets] = await retryDbOperation(() =>
      prisma.$transaction([
        prisma.assets.aggregate({
          where: whereClause,
          _sum: {
            cost: true,
          },
        }),
        prisma.assets.count({
          where: {
            ...whereClause,
            status: { equals: 'Available', mode: 'insensitive' },
          },
        }),
        prisma.assets.count({
          where: {
            ...whereClause,
            status: { equals: 'Checked out', mode: 'insensitive' },
          },
        }),
      ])
    )

    const totalValue = totalValueResult._sum.cost ? Number(totalValueResult._sum.cost) : 0

    return NextResponse.json({ 
      assets: assetsWithImageCount,
      pagination: {
        total: totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize)
      },
      summary: {
        totalAssets: totalCount,
        totalValue,
        availableAssets,
        checkedOutAssets,
      }
    })
  } catch (error: unknown) {
    // Only log non-transient errors (not connection retries)
    const prismaError = error as { code?: string; message?: string }
    if (prismaError?.code !== 'P1001') {
      console.error('Error fetching assets:', error)
    }
    return NextResponse.json(
      { error: 'Failed to fetch assets' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // Check create permission
  const permissionCheck = await requirePermission('canCreateAssets')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const body = await request.json()
    
    const asset = await retryDbOperation(() => prisma.assets.create({
      data: {
        assetTagId: body.assetTagId,
        description: body.description,
        purchasedFrom: body.purchasedFrom,
        purchaseDate: parseDate(body.purchaseDate),
        brand: body.brand,
        cost: body.cost ? parseFloat(body.cost) : null,
        model: body.model,
        serialNo: body.serialNo,
        additionalInformation: body.additionalInformation,
        xeroAssetNo: body.xeroAssetNo,
        owner: body.owner,
        pbiNumber: body.pbiNumber,
        status: body.status || "Available",
        issuedTo: body.issuedTo,
        poNumber: body.poNumber,
        paymentVoucherNumber: body.paymentVoucherNumber,
        assetType: body.assetType,
        deliveryDate: parseDate(body.deliveryDate),
        unaccountedInventory: body.unaccountedInventory || false,
        remarks: body.remarks,
        qr: body.qr,
        oldAssetTag: body.oldAssetTag,
        depreciableAsset: body.depreciableAsset || false,
        depreciableCost: body.depreciableCost ? parseFloat(body.depreciableCost) : null,
        salvageValue: body.salvageValue ? parseFloat(body.salvageValue) : null,
        assetLifeMonths: body.assetLifeMonths ? parseInt(body.assetLifeMonths) : null,
        depreciationMethod: body.depreciationMethod,
        dateAcquired: parseDate(body.dateAcquired),
        categoryId: body.categoryId || null,
        subCategoryId: body.subCategoryId || null,
        department: body.department,
        site: body.site,
        location: body.location,
      },
      include: {
        category: true,
        subCategory: true,
        checkouts: {
          include: {
            employeeUser: true,
          },
          orderBy: { checkoutDate: 'desc' },
          take: 1,
        },
      },
    }))

    // Invalidate dashboard cache when new asset is created
    clearCache('dashboard-stats')

    return NextResponse.json({ asset }, { status: 201 })
  } catch (error: unknown) {
    // Handle connection pool errors specifically
    const prismaError = error as { code?: string; message?: string }
    if (prismaError?.code === 'P1001' || prismaError?.code === 'P2024') {
      return NextResponse.json(
        { error: 'Database connection limit reached. Please try again in a moment.' },
        { status: 503 }
      )
    }
    console.error('Error creating asset:', error)
    return NextResponse.json(
      { error: 'Failed to create asset' },
      { status: 500 }
    )
  }
}

