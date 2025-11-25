import { prisma } from '@/lib/prisma'
import { retryDbOperation } from '@/lib/db-utils'
import { getCached, setCached } from '@/lib/cache-utils'
import { Prisma } from '@prisma/client'

export type AssetsData = {
  assets: Array<{
    id: string
    assetTagId: string
    description: string
    status: string | null
    category: {
      name: string
    } | null
    subCategory: {
      name: string
    } | null
    categoryId: string | null
    subCategoryId: string | null
    location: string | null
    issuedTo: string | null
    purchasedFrom: string | null
    purchaseDate: string | null
    brand: string | null
    cost: number | null
    model: string | null
    serialNo: string | null
    additionalInformation: string | null
    xeroAssetNo: string | null
    owner: string | null
    pbiNumber: string | null
    poNumber: string | null
    paymentVoucherNumber: string | null
    assetType: string | null
    deliveryDate: string | null
    unaccountedInventory: boolean | null
    remarks: string | null
    qr: string | null
    oldAssetTag: string | null
    depreciableAsset: boolean | null
    depreciableCost: number | null
    salvageValue: number | null
    assetLifeMonths: number | null
    depreciationMethod: string | null
    dateAcquired: string | null
    department: string | null
    site: string | null
    checkouts?: Array<{
      id: string
      checkoutDate: string | null
      expectedReturnDate: string | null
      employeeUser: {
        id: string
        name: string
        email: string
        department: string | null
      } | null
    }>
    auditHistory?: Array<{
      id: string
      auditType: string
      auditDate: string
      auditor: string | null
      status: string | null
      notes: string | null
    }>
    imagesCount?: number
  }>
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
  summary?: {
    totalAssets: number
    totalValue: number
    availableAssets: number
    checkedOutAssets: number
  }
}

export type AssetsParams = {
  page?: number
  pageSize?: number
  search?: string
  category?: string
  status?: string
  includeDeleted?: boolean
}

/**
 * Fetches assets from the database
 * This function is called by Server Components
 * Includes caching to reduce database load
 */
export async function getAssets(params: AssetsParams = {}): Promise<AssetsData> {
  const {
    page = 1,
    pageSize = 50,
    search,
    category,
    status,
    includeDeleted = false,
  } = params

  // Generate cache key based on all query parameters
  const cacheKeyParts = [
    'assets',
    page.toString(),
    pageSize.toString(),
    search || '',
    category || '',
    status || '',
    includeDeleted ? 'with-deleted' : 'no-deleted',
  ]
  const cacheKey = cacheKeyParts.join('-')

  // Check cache first (10 second TTL for assets list - Redis cached)
  const cached = await getCached<AssetsData>(cacheKey)
  if (cached) {
    return cached
  }

  const skip = (page - 1) * pageSize

  const whereClause: Prisma.AssetsWhereInput = {
    // Exclude soft-deleted assets by default
    ...(includeDeleted ? {} : { isDeleted: false }),
  }

  // Search filter
  if (search) {
    const searchConditions: Prisma.AssetsWhereInput[] = [
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
      { category: { name: { contains: search, mode: 'insensitive' } } },
      { subCategory: { name: { contains: search, mode: 'insensitive' } } },
    ]

    whereClause.OR = searchConditions
  }

  // Category filter
  if (category && category !== 'all') {
    whereClause.categoryId = category
  }

  // Status filter
  if (status && status !== 'all') {
    whereClause.status = status
  }

  // Get total count for pagination
  const totalCount = await retryDbOperation(() =>
    prisma.assets.count({ where: whereClause })
  )

  // Build include object
  const include: Prisma.AssetsInclude = {
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
    checkouts: {
      include: {
        employeeUser: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
          },
        },
      },
      orderBy: {
        checkoutDate: 'desc',
      },
      take: 1,
    },
    auditHistory: {
      orderBy: {
        auditDate: 'desc',
      },
      take: 5,
    },
  }

  // Fetch assets
  const assets = await retryDbOperation(() =>
    prisma.assets.findMany({
      where: whereClause,
      include,
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      skip,
      take: pageSize,
    })
  )

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

  // Calculate summary statistics
  const summary = await retryDbOperation(async () => {
    const [totalAssets, availableAssets, checkedOutAssets, totalValueResult] = await Promise.all([
      prisma.assets.count({
        where: {
          ...whereClause,
          isDeleted: false,
        },
      }),
      prisma.assets.count({
        where: {
          ...whereClause,
          isDeleted: false,
          status: 'Available',
        },
      }),
      prisma.assets.count({
        where: {
          ...whereClause,
          isDeleted: false,
          status: 'Checked out',
        },
      }),
      prisma.assets.aggregate({
        where: {
          ...whereClause,
          isDeleted: false,
        },
        _sum: {
          cost: true,
        },
      }),
    ])

    return {
      totalAssets,
      totalValue: totalValueResult._sum.cost ? Number(totalValueResult._sum.cost) : 0,
      availableAssets,
      checkedOutAssets,
    }
  })

  // Transform assets to match expected format
  const transformedAssets = assetsWithImageCount.map((asset) => ({
    id: asset.id,
    assetTagId: asset.assetTagId,
    description: asset.description,
    status: asset.status,
    category: asset.category,
    subCategory: asset.subCategory,
    categoryId: asset.categoryId,
    subCategoryId: asset.subCategoryId,
    location: asset.location,
    issuedTo: asset.issuedTo,
    purchasedFrom: asset.purchasedFrom,
    purchaseDate: asset.purchaseDate?.toISOString() || null,
    brand: asset.brand,
    cost: asset.cost ? Number(asset.cost) : null,
    model: asset.model,
    serialNo: asset.serialNo,
    additionalInformation: asset.additionalInformation,
    xeroAssetNo: asset.xeroAssetNo,
    owner: asset.owner,
    pbiNumber: asset.pbiNumber,
    poNumber: asset.poNumber,
    paymentVoucherNumber: asset.paymentVoucherNumber,
    assetType: asset.assetType,
    deliveryDate: asset.deliveryDate?.toISOString() || null,
    unaccountedInventory: asset.unaccountedInventory,
    remarks: asset.remarks,
    qr: asset.qr,
    oldAssetTag: asset.oldAssetTag,
    depreciableAsset: asset.depreciableAsset,
    depreciableCost: asset.depreciableCost ? Number(asset.depreciableCost) : null,
    salvageValue: asset.salvageValue ? Number(asset.salvageValue) : null,
    assetLifeMonths: asset.assetLifeMonths,
    depreciationMethod: asset.depreciationMethod,
    dateAcquired: asset.dateAcquired?.toISOString() || null,
    department: asset.department,
    site: asset.site,
    checkouts: (asset.checkouts as unknown as Array<{
      id: string
      checkoutDate: Date | null
      expectedReturnDate: Date | null
      employeeUser: {
        id: string
        name: string
        email: string
        department: string | null
      } | null
    }>).map((checkout) => ({
      id: checkout.id,
      checkoutDate: checkout.checkoutDate?.toISOString() || null,
      expectedReturnDate: checkout.expectedReturnDate?.toISOString() || null,
      employeeUser: checkout.employeeUser || null,
    })),
    auditHistory: asset.auditHistory.map((audit) => ({
      id: audit.id,
      auditType: audit.auditType,
      auditDate: audit.auditDate.toISOString(),
      auditor: audit.auditor,
      status: audit.status,
      notes: audit.notes,
    })),
    imagesCount: (asset as { imagesCount?: number }).imagesCount || 0,
  }))

  const totalPages = Math.ceil(totalCount / pageSize)

  const result: AssetsData = {
    assets: transformedAssets,
    pagination: {
      page,
      pageSize,
      total: totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
    summary,
  }

  // Cache the result with 10 second TTL
  await setCached(cacheKey, result, 10000)

  return result
}

