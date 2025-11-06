import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseDate } from '@/lib/date-utils'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'

export async function POST(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canManageImport')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const { assets } = await request.json()

    console.log('Received assets to import:', assets?.length)

    if (!assets || !Array.isArray(assets)) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    // Pre-process: collect all unique categories and subcategories
    const uniqueCategories = new Set<string>()
    const uniqueSubCategories = new Set<string>()
    
    assets.forEach(asset => {
      if (asset.category && asset.category.trim()) {
        uniqueCategories.add(asset.category.trim())
      }
      if (asset.subCategory && asset.subCategory.trim()) {
        uniqueSubCategories.add(asset.subCategory.trim())
      }
    })

    // Batch create categories
    const categoryMap = new Map<string, string>()
    if (uniqueCategories.size > 0) {
      // Get existing categories
      const existingCategories = await prisma.category.findMany({
        where: { name: { in: Array.from(uniqueCategories) } }
      })
      
      existingCategories.forEach(cat => {
        categoryMap.set(cat.name, cat.id)
      })

      // Create missing categories
      const missingCategories = Array.from(uniqueCategories).filter(
        name => !categoryMap.has(name)
      )
      
      if (missingCategories.length > 0) {
        await prisma.category.createMany({
          data: missingCategories.map(name => ({
            name,
            description: 'Auto-created during import'
          })),
          skipDuplicates: true
        })

        // Get the newly created categories
        const createdCategories = await prisma.category.findMany({
          where: { name: { in: missingCategories } }
        })
        
        createdCategories.forEach(cat => {
          categoryMap.set(cat.name, cat.id)
        })
      }
    }

    // Batch create subcategories
    const subCategoryMap = new Map<string, string>()
    if (uniqueSubCategories.size > 0) {
      // Get existing subcategories
      const existingSubCategories = await prisma.subCategory.findMany({
        where: { name: { in: Array.from(uniqueSubCategories) } }
      })
      
      existingSubCategories.forEach(subCat => {
        subCategoryMap.set(subCat.name, subCat.id)
      })

      // Create missing subcategories
      const missingSubCategories = Array.from(uniqueSubCategories).filter(
        name => !subCategoryMap.has(name)
      )
      
      if (missingSubCategories.length > 0) {
        // Get default category for subcategories without parent
        let defaultCategoryId = null
        const defaultCategory = await prisma.category.findFirst()
        if (!defaultCategory) {
          const newDefaultCategory = await prisma.category.create({
            data: {
              name: 'Default',
              description: 'Default category for subcategories without parent'
            }
          })
          defaultCategoryId = newDefaultCategory.id
        } else {
          defaultCategoryId = defaultCategory.id
        }

        await prisma.subCategory.createMany({
          data: missingSubCategories.map(name => ({
            name,
            description: 'Auto-created during import',
            categoryId: defaultCategoryId
          })),
          skipDuplicates: true
        })

        // Get the newly created subcategories
        const createdSubCategories = await prisma.subCategory.findMany({
          where: { name: { in: missingSubCategories } }
        })
        
        createdSubCategories.forEach(subCat => {
          subCategoryMap.set(subCat.name, subCat.id)
        })
      }
    }

    // Check for existing assets in batch
    const assetTagIds = assets.map(asset => asset.assetTagId)
    const existingAssets = await prisma.assets.findMany({
      where: { assetTagId: { in: assetTagIds } },
      select: { assetTagId: true }
    })
    
    const existingAssetTags = new Set(existingAssets.map(asset => asset.assetTagId))

    // Helper function to safely parse numbers, handling NaN, empty strings, null, undefined
    const parseNumber = (value: unknown): number | null => {
      if (value === null || value === undefined || value === '') {
        return null
      }
      const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : Number(value)
      return isNaN(num) ? null : num
    }

    // Helper function to safely parse boolean
    const parseBoolean = (value: unknown): boolean | null => {
      if (value === null || value === undefined || value === '') {
        return null
      }
      if (typeof value === 'boolean') return value
      if (typeof value === 'string') {
        const lower = value.toLowerCase().trim()
        return lower === 'true' || lower === 'yes' || lower === '1' ? true : 
               lower === 'false' || lower === 'no' || lower === '0' ? false : null
      }
      return Boolean(value)
    }

    // Prepare data for batch insert
    const assetsToCreate = assets
      .filter(asset => !existingAssetTags.has(asset.assetTagId))
      .map(asset => ({
        assetTagId: asset.assetTagId,
        description: asset.description || '',
        purchasedFrom: asset.purchasedFrom || null,
        purchaseDate: parseDate(asset.purchaseDate),
        brand: asset.brand || null,
        cost: parseNumber(asset.cost),
        model: asset.model || null,
        serialNo: asset.serialNo || null,
        additionalInformation: asset.additionalInformation || null,
        xeroAssetNo: asset.xeroAssetNo || null,
        owner: asset.owner || null,
        pbiNumber: asset.pbiNumber || null,
        status: asset.status || null,
        issuedTo: asset.issuedTo || null,
        poNumber: asset.poNumber || null,
        paymentVoucherNumber: asset.paymentVoucherNumber || null,
        assetType: asset.assetType || null,
        deliveryDate: parseDate(asset.deliveryDate),
        unaccountedInventory: parseBoolean(asset.unaccountedInventory || asset.unaccounted2021Inventory),
        remarks: asset.remarks || null,
        qr: asset.qr || null,
        oldAssetTag: asset.oldAssetTag || null,
        depreciableAsset: parseBoolean(asset.depreciableAsset) ?? false,
        depreciableCost: parseNumber(asset.depreciableCost),
        salvageValue: parseNumber(asset.salvageValue),
        assetLifeMonths: asset.assetLifeMonths ? parseInt(String(asset.assetLifeMonths), 10) : null,
        depreciationMethod: asset.depreciationMethod || null,
        dateAcquired: parseDate(asset.dateAcquired),
        categoryId: asset.category ? categoryMap.get(asset.category) : (asset.categoryId || null),
        subCategoryId: asset.subCategory ? subCategoryMap.get(asset.subCategory) : (asset.subCategoryId || null),
        department: asset.department || null,
        site: asset.site || null,
        location: asset.location || null,
      }))

    // Batch insert assets (fast)
    let createdCount = 0
    if (assetsToCreate.length > 0) {
      const result = await prisma.assets.createMany({
        data: assetsToCreate,
        skipDuplicates: true
      })
      createdCount = result.count
    }

    // After batch creation, process checkout records in batch for checkout-status assets
    const checkoutStatuses = ['checked out', 'checked-out', 'checkedout', 'in use']
    const checkoutAssetsData = assetsToCreate
      .map((assetData) => {
        const status = assetData.status?.toLowerCase().trim()
        if (status && checkoutStatuses.includes(status)) {
          return assetData
        }
        return null
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)

    if (checkoutAssetsData.length > 0) {
      // Fetch all created assets that need checkout records
      const assetTagIds = checkoutAssetsData.map(item => item.assetTagId)
      const createdAssets = await prisma.assets.findMany({
        where: { assetTagId: { in: assetTagIds } },
        select: { id: true, assetTagId: true }
      })

      const assetIdMap = new Map(createdAssets.map(a => [a.assetTagId, a.id]))

      // Prepare checkout records to create in batch (without employee user ID)
      const checkoutRecordsToCreate = checkoutAssetsData
        .map(item => {
          const assetId = assetIdMap.get(item.assetTagId)
          if (!assetId) return null

          const checkoutDate = item.deliveryDate || item.purchaseDate || new Date()
          const parsedDate = checkoutDate instanceof Date ? checkoutDate : parseDate(checkoutDate) || new Date()

          return {
            assetId,
            employeeUserId: null, // No employee user ID for imported checkouts
            checkoutDate: parsedDate,
            expectedReturnDate: null,
          }
        })
        .filter((record): record is NonNullable<typeof record> => record !== null)

      // Batch create checkout records
      if (checkoutRecordsToCreate.length > 0) {
        await prisma.assetsCheckout.createMany({
          data: checkoutRecordsToCreate,
          skipDuplicates: true
        })
        console.log(`Created ${checkoutRecordsToCreate.length} checkout record(s) in batch (without employee user ID)`)
      }
    }

    // Prepare results
    const results = assets.map(asset => {
      if (existingAssetTags.has(asset.assetTagId)) {
        return { asset: asset.assetTagId, action: 'skipped', reason: 'Duplicate asset tag' }
      } else {
        return { asset: asset.assetTagId, action: 'created' }
      }
    })

    console.log(`Import completed: ${createdCount} assets created, ${assets.length - createdCount} skipped`)

    return NextResponse.json({
      message: 'Assets imported successfully',
      results,
      summary: {
        total: assets.length,
        created: createdCount,
        skipped: assets.length - createdCount
      }
    })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
