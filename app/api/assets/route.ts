import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseDate } from '@/lib/date-utils'
import { verifyAuth } from '@/lib/auth-utils'
import { retryDbOperation } from '@/lib/db-utils'
import { requirePermission, getUserPermissions, hasPermission } from '@/lib/permission-utils'
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
      if (!permissionCheck.allowed) return permissionCheck.error
    }
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10)
    const skip = (page - 1) * pageSize
    
    const whereClause: Prisma.AssetsWhereInput = {
      // Exclude soft-deleted assets by default
      ...(includeDeleted ? {} : { isDeleted: false }),
    }
    
    // Search filter
    if (search) {
      whereClause.OR = [
          { assetTagId: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { brand: { contains: search, mode: 'insensitive' } },
          { model: { contains: search, mode: 'insensitive' } },
          { serialNo: { contains: search, mode: 'insensitive' } },
          { owner: { contains: search, mode: 'insensitive' } },
          { issuedTo: { contains: search, mode: 'insensitive' } },
          { department: { contains: search, mode: 'insensitive' } },
          { site: { contains: search, mode: 'insensitive' } },
          { location: { contains: search, mode: 'insensitive' } },
          { checkouts: { some: { employeeUser: { name: { contains: search, mode: 'insensitive' } } } } },
          { checkouts: { some: { employeeUser: { email: { contains: search, mode: 'insensitive' } } } } },
        ]
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

    // Check if summary is requested
    const summaryOnly = searchParams.get('summary') === 'true'
    if (summaryOnly) {
      // Calculate summary statistics for all assets (ignoring pagination)
      const allAssets = await retryDbOperation(() => prisma.assets.findMany({
        where: whereClause,
        select: {
          cost: true,
          status: true,
        },
      }))

      const totalValue = allAssets.reduce((sum, asset) => {
        return sum + (asset.cost ? Number(asset.cost) : 0)
      }, 0)

      const totalAssets = allAssets.length
      const availableAssets = allAssets.filter(a => a.status?.toLowerCase() === 'available').length
      const checkedOutAssets = allAssets.filter(a => a.status?.toLowerCase() === 'checked out').length

      return NextResponse.json({
        summary: {
          totalAssets,
          totalValue,
          availableAssets,
          checkedOutAssets,
        }
      })
    }

    return NextResponse.json({ 
      assets: assetsWithImageCount,
      pagination: {
        total: totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize)
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
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const body = await request.json()
    
    const asset = await prisma.assets.create({
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
        status: body.status,
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
    })

    return NextResponse.json({ asset }, { status: 201 })
  } catch (error) {
    console.error('Error creating asset:', error)
    return NextResponse.json(
      { error: 'Failed to create asset' },
      { status: 500 }
    )
  }
}

