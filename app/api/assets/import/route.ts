import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseDate } from '@/lib/date-utils'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'

export async function POST(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canManageImport')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const { assets } = await request.json()

    if (!assets || !Array.isArray(assets)) {
      return NextResponse.json(
        { error: 'Invalid request body. Expected an array of assets.' },
        { status: 400 }
      )
    }

    // Validate that assets have required fields
    const invalidAssets = assets.filter((asset) => {
      if (!asset || typeof asset !== 'object') {
        return true
      }
      // assetTagId is required
      if (!asset.assetTagId || (typeof asset.assetTagId === 'string' && asset.assetTagId.trim() === '')) {
        return true
      }
      return false
    })

    if (invalidAssets.length > 0) {
      return NextResponse.json(
        { 
          error: `Invalid data format: ${invalidAssets.length} row(s) are missing required "Asset Tag ID" field. Please ensure your Excel file has the correct column headers.`,
          details: `Rows with missing Asset Tag ID: ${invalidAssets.map((_, idx) => {
            const originalIndex = assets.indexOf(invalidAssets[idx])
            return originalIndex + 2 // +2 because row 1 is header
          }).join(', ')}`
        },
        { status: 400 }
      )
    }

    // Pre-process: collect all unique categories, subcategories, locations, departments, and sites
    const uniqueCategories = new Set<string>()
    const uniqueSubCategories = new Set<string>()
    const uniqueLocations = new Set<string>()
    const uniqueDepartments = new Set<string>()
    const uniqueSites = new Set<string>()
    // Map subcategory name to its parent category name
    const subCategoryToCategoryMap = new Map<string, string>()
    
    assets.forEach(asset => {
      const categoryName = asset.category ? asset.category.trim() : null
      const subCategoryName = asset.subCategory ? asset.subCategory.trim() : null
      
      if (categoryName) {
        uniqueCategories.add(categoryName)
      }
      if (subCategoryName) {
        uniqueSubCategories.add(subCategoryName)
        // Link subcategory to its parent category
        if (categoryName) {
          // Only set if not already mapped (first occurrence wins)
          if (!subCategoryToCategoryMap.has(subCategoryName)) {
            subCategoryToCategoryMap.set(subCategoryName, categoryName)
          }
        }
      }
      if (asset.location && asset.location.trim()) {
        uniqueLocations.add(asset.location.trim())
      }
      if (asset.department && asset.department.trim()) {
        uniqueDepartments.add(asset.department.trim())
      }
      if (asset.site && asset.site.trim()) {
        uniqueSites.add(asset.site.trim())
      }
    })

    // Batch create categories
    const categoryMap = new Map<string, string>()
    if (uniqueCategories.size > 0) {
      const categoryNamesArray = Array.from(uniqueCategories)
      
      // Get existing categories (case-sensitive exact match)
      const existingCategories = await prisma.category.findMany({
        where: { name: { in: categoryNamesArray } }
      })
      
      existingCategories.forEach(cat => {
        categoryMap.set(cat.name, cat.id)
      })

      // Create missing categories
      const missingCategories = categoryNamesArray.filter(
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

        // Get the newly created categories (refresh to ensure we have all)
        const allCategories = await prisma.category.findMany({
          where: { name: { in: categoryNamesArray } }
        })
        
        // Update map with all categories (existing + newly created)
        allCategories.forEach(cat => {
          categoryMap.set(cat.name, cat.id)
        })
      }
    }

    // Batch create subcategories
    const subCategoryMap = new Map<string, string>()
    if (uniqueSubCategories.size > 0) {
      // Get existing subcategories with their parent categories
      const existingSubCategories = await prisma.subCategory.findMany({
        where: { name: { in: Array.from(uniqueSubCategories) } },
        include: { category: true }
      })
      
      // Only use existing subcategories if they're under the correct parent category
      existingSubCategories.forEach(subCat => {
        const expectedParentCategory = subCategoryToCategoryMap.get(subCat.name)
        // Only map if the parent category matches (or if no parent was specified in import)
        if (!expectedParentCategory || subCat.category.name === expectedParentCategory) {
        subCategoryMap.set(subCat.name, subCat.id)
        }
        // If parent doesn't match, we'll create a new subcategory (but it will fail due to unique constraint)
        // So we need to handle this differently - we'll skip it and let the user know
      })

      // Create missing subcategories (those not in map, or those with wrong parent)
      const missingSubCategories = Array.from(uniqueSubCategories).filter(
        name => !subCategoryMap.has(name)
      )
      
      if (missingSubCategories.length > 0) {
        // Group subcategories by their parent category
        const subCategoriesByCategory = new Map<string, string[]>()
        missingSubCategories.forEach(subCatName => {
          const parentCategoryName = subCategoryToCategoryMap.get(subCatName)
          
          if (parentCategoryName) {
            // Check if the parent category exists in our map (exact match)
            if (categoryMap.has(parentCategoryName)) {
              // Parent category exists, group by it
              const categoryId = categoryMap.get(parentCategoryName)!
              if (!subCategoriesByCategory.has(categoryId)) {
                subCategoriesByCategory.set(categoryId, [])
              }
              subCategoriesByCategory.get(categoryId)!.push(subCatName)
            } else {
              // Parent category name doesn't match any in categoryMap
              // This can happen if category name doesn't match exactly
              // Log warning and use default
              console.warn(
                `Subcategory "${subCatName}" mapped to category "${parentCategoryName}" but category not found in categoryMap. ` +
                `Available categories: ${Array.from(categoryMap.keys()).join(', ')}`
              )
              const defaultKey = 'default'
              if (!subCategoriesByCategory.has(defaultKey)) {
                subCategoriesByCategory.set(defaultKey, [])
              }
              subCategoriesByCategory.get(defaultKey)!.push(subCatName)
            }
          } else {
            // No parent category found in import data, use default
            const defaultKey = 'default'
            if (!subCategoriesByCategory.has(defaultKey)) {
              subCategoriesByCategory.set(defaultKey, [])
            }
            subCategoriesByCategory.get(defaultKey)!.push(subCatName)
          }
        })

        // Get default category for subcategories without parent
        let defaultCategoryId = null
        if (subCategoriesByCategory.has('default')) {
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
        }

        // Create subcategories grouped by their parent category
        const subCategoriesToCreate: Array<{ name: string; categoryId: string }> = []
        
        subCategoriesByCategory.forEach((subCatNames, categoryIdOrDefault) => {
          const parentCategoryId = categoryIdOrDefault === 'default' 
            ? defaultCategoryId 
            : categoryIdOrDefault

          if (parentCategoryId) {
            subCatNames.forEach(subCatName => {
              subCategoriesToCreate.push({
                name: subCatName,
                categoryId: parentCategoryId
              })
            })
          }
        })

        if (subCategoriesToCreate.length > 0) {
        await prisma.subCategory.createMany({
            data: subCategoriesToCreate.map(item => ({
              name: item.name,
              description: 'Auto-created during import',
              categoryId: item.categoryId
            })),
            skipDuplicates: true
          })

          // Check which subcategories still need to be handled
          // (those that exist but under wrong parent category, or newly created)
          const allSubCategoriesAfterCreate = await prisma.subCategory.findMany({
            where: { name: { in: missingSubCategories } },
            include: { category: true }
          })
          
          // Update subcategories that exist under wrong parent category
          for (const subCat of allSubCategoriesAfterCreate) {
            const expectedParentCategory = subCategoryToCategoryMap.get(subCat.name)
            if (expectedParentCategory && subCat.category.name !== expectedParentCategory) {
              // Subcategory exists under wrong parent - update it
              const correctCategoryId = categoryMap.get(expectedParentCategory)
              if (correctCategoryId) {
                await prisma.subCategory.update({
                  where: { id: subCat.id },
                  data: { categoryId: correctCategoryId }
                })
                // Update the category name in our local reference
                subCat.category.name = expectedParentCategory
              }
            }
          }

          // Refresh to get updated subcategories
          const finalSubCategories = await prisma.subCategory.findMany({
            where: { name: { in: missingSubCategories } },
            include: { category: true }
          })
          
          // Add to map if the parent category matches what we expect
          finalSubCategories.forEach(subCat => {
            const expectedParentCategory = subCategoryToCategoryMap.get(subCat.name)
            if (expectedParentCategory && subCat.category.name === expectedParentCategory) {
              subCategoryMap.set(subCat.name, subCat.id)
            } else if (!expectedParentCategory) {
              // No expected parent, just add it
              subCategoryMap.set(subCat.name, subCat.id)
            }
          })
        }
      }
    }

    // Batch create locations
    const locationMap = new Map<string, string>()
    if (uniqueLocations.size > 0) {
      // Get existing locations
      const existingLocations = await prisma.assetsLocation.findMany({
        where: { name: { in: Array.from(uniqueLocations) } }
      })
      
      existingLocations.forEach(loc => {
        locationMap.set(loc.name, loc.id)
      })

      // Create missing locations
      const missingLocations = Array.from(uniqueLocations).filter(
        name => !locationMap.has(name)
      )
      
      if (missingLocations.length > 0) {
        await prisma.assetsLocation.createMany({
          data: missingLocations.map(name => ({
            name,
            description: 'Auto-created during import'
          })),
          skipDuplicates: true
        })

        // Get the newly created locations
        const createdLocations = await prisma.assetsLocation.findMany({
          where: { name: { in: missingLocations } }
        })
        
        createdLocations.forEach(loc => {
          locationMap.set(loc.name, loc.id)
        })
      }
    }

    // Batch create departments
    const departmentMap = new Map<string, string>()
    if (uniqueDepartments.size > 0) {
      // Get existing departments
      const existingDepartments = await prisma.assetsDepartment.findMany({
        where: { name: { in: Array.from(uniqueDepartments) } }
      })
      
      existingDepartments.forEach(dept => {
        departmentMap.set(dept.name, dept.id)
      })

      // Create missing departments
      const missingDepartments = Array.from(uniqueDepartments).filter(
        name => !departmentMap.has(name)
      )
      
      if (missingDepartments.length > 0) {
        await prisma.assetsDepartment.createMany({
          data: missingDepartments.map(name => ({
            name,
            description: 'Auto-created during import'
          })),
          skipDuplicates: true
        })

        // Get the newly created departments
        const createdDepartments = await prisma.assetsDepartment.findMany({
          where: { name: { in: missingDepartments } }
        })
        
        createdDepartments.forEach(dept => {
          departmentMap.set(dept.name, dept.id)
        })
      }
    }

    // Batch create sites
    const siteMap = new Map<string, string>()
    if (uniqueSites.size > 0) {
      // Get existing sites
      const existingSites = await prisma.assetsSite.findMany({
        where: { name: { in: Array.from(uniqueSites) } }
      })
      
      existingSites.forEach(site => {
        siteMap.set(site.name, site.id)
      })

      // Create missing sites
      const missingSites = Array.from(uniqueSites).filter(
        name => !siteMap.has(name)
      )
      
      if (missingSites.length > 0) {
        await prisma.assetsSite.createMany({
          data: missingSites.map(name => ({
            name,
            description: 'Auto-created during import'
          })),
          skipDuplicates: true
        })

        // Get the newly created sites
        const createdSites = await prisma.assetsSite.findMany({
          where: { name: { in: missingSites } }
        })
        
        createdSites.forEach(site => {
          siteMap.set(site.name, site.id)
        })
      }
    }

    // Check for existing assets in batch
    const assetTagIds = assets
      .map(asset => asset?.assetTagId)
      .filter((tagId): tagId is string => !!tagId && typeof tagId === 'string')
    
    if (assetTagIds.length === 0) {
      return NextResponse.json(
        { error: 'No valid Asset Tag IDs found in the import file. Please check your Excel file format.' },
        { status: 400 }
      )
    }

    const existingAssets = await prisma.assets.findMany({
      where: { assetTagId: { in: assetTagIds } },
      select: { assetTagId: true, isDeleted: true }
    })
    
    const existingAssetTags = new Set(existingAssets.map(asset => asset.assetTagId))
    const deletedAssetTags = new Set(
      existingAssets.filter(asset => asset.isDeleted).map(asset => asset.assetTagId)
    )

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
      .filter(asset => asset?.assetTagId && !existingAssetTags.has(asset.assetTagId))
      .map(asset => {
        // Ensure assetTagId exists and is valid
        if (!asset?.assetTagId || typeof asset.assetTagId !== 'string') {
          return null
        }
        return {
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
      }
      })
      .filter((asset): asset is NonNullable<typeof asset> => asset !== null)

    // Batch insert assets (fast)
    let createdCount = 0
    if (assetsToCreate.length > 0) {
      const result = await prisma.assets.createMany({
        data: assetsToCreate,
        skipDuplicates: true
      })
      createdCount = result.count
    }

    // After batch creation, process audit history records for assets with audit data
    const assetsWithAuditData = assets
      .filter(asset => {
        const hasAuditData = asset.lastAuditDate || asset.lastAuditType || asset.lastAuditor
        return asset?.assetTagId && !existingAssetTags.has(asset.assetTagId) && hasAuditData
      })

    if (assetsWithAuditData.length > 0) {
      // Fetch all created assets that need audit records
      const assetTagIds = assetsWithAuditData.map(asset => asset.assetTagId as string)
      const createdAssets = await prisma.assets.findMany({
        where: { assetTagId: { in: assetTagIds } },
        select: { id: true, assetTagId: true }
      })

      const assetIdMap = new Map(createdAssets.map(a => [a.assetTagId, a.id]))

      // Prepare audit history records to create in batch
      const auditRecordsToCreate = assetsWithAuditData
        .map(asset => {
          const assetId = assetIdMap.get(asset.assetTagId as string)
          if (!assetId) return null

          // Parse audit date
          const auditDate = asset.lastAuditDate 
            ? (asset.lastAuditDate instanceof Date 
              ? asset.lastAuditDate 
              : parseDate(asset.lastAuditDate) || new Date())
            : new Date()

          // Only create if we have at least audit date or audit type
          if (!asset.lastAuditDate && !asset.lastAuditType) {
            return null
          }

          return {
            assetId,
            auditType: asset.lastAuditType || 'Imported Audit',
            auditDate: auditDate,
            auditor: asset.lastAuditor || null,
            status: 'Completed',
            notes: 'Imported from Excel file',
          }
        })
        .filter((record): record is NonNullable<typeof record> => record !== null)

      // Batch create audit history records
      if (auditRecordsToCreate.length > 0) {
        await prisma.assetsAuditHistory.createMany({
          data: auditRecordsToCreate,
          skipDuplicates: true
        })
      }
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
      }
    }

    // After batch creation, process images for assets with image URLs
    const assetsWithImages = assets
      .filter(asset => {
        const assetTagId = asset.assetTagId as string
        const hasImages = asset.images && typeof asset.images === 'string' && asset.images.trim() !== ''
        return assetTagId && !existingAssetTags.has(assetTagId) && hasImages
      })

    if (assetsWithImages.length > 0) {
      // Fetch all created assets that need image records
      const assetTagIds = assetsWithImages.map(asset => asset.assetTagId as string)
      const createdAssets = await prisma.assets.findMany({
        where: { assetTagId: { in: assetTagIds } },
        select: { assetTagId: true }
      })

      const createdAssetTagIds = new Set(createdAssets.map(a => a.assetTagId))

      // Prepare image records to create
      const imageRecordsToCreate: Array<{ assetTagId: string; imageUrl: string; imageType: string | null; imageSize: number | null }> = []
      
      assetsWithImages.forEach(asset => {
        const assetTagId = asset.assetTagId as string
        if (!createdAssetTagIds.has(assetTagId)) return

        // Parse image URLs (comma or semicolon separated)
        const imageUrls = (asset.images as string)
          .split(/[,;]/)
          .map(url => url.trim())
          .filter(url => url.length > 0 && (url.startsWith('http://') || url.startsWith('https://')))

        imageUrls.forEach(imageUrl => {
          // Try to determine image type from URL
          const urlExtension = imageUrl.split('.').pop()?.split('?')[0]?.toLowerCase() || null
          let imageType: string | null = null
          if (urlExtension) {
            const mimeTypes: Record<string, string> = {
              'jpg': 'image/jpeg',
              'jpeg': 'image/jpeg',
              'png': 'image/png',
              'gif': 'image/gif',
              'webp': 'image/webp',
            }
            imageType = mimeTypes[urlExtension] || null
          }

          imageRecordsToCreate.push({
            assetTagId,
            imageUrl,
            imageType,
            imageSize: null, // Size unknown for external URLs
          })
        })
      })

      // Batch create image records
      if (imageRecordsToCreate.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any).assetsImage.createMany({
          data: imageRecordsToCreate,
          skipDuplicates: true
        })
      }
    }

    // Prepare results
    const results = assets
      .filter(asset => asset?.assetTagId)
      .map(asset => {
        const assetTagId = asset.assetTagId as string
        if (existingAssetTags.has(assetTagId)) {
          if (deletedAssetTags.has(assetTagId)) {
            return { asset: assetTagId, action: 'skipped', reason: 'Asset exists in trash' }
          } else {
            return { asset: assetTagId, action: 'skipped', reason: 'Duplicate asset tag' }
          }
        } else {
          return { asset: assetTagId, action: 'created' }
        }
      })

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
    // Log error for debugging but don't expose internal details
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    // Check for common Prisma errors
    if (errorMessage.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'Duplicate asset detected. Please ensure all Asset Tag IDs are unique.' },
        { status: 400 }
      )
    }
    
    if (errorMessage.includes('Foreign key constraint')) {
      return NextResponse.json(
        { error: 'Invalid category or subcategory reference. Please check your category names.' },
        { status: 400 }
      )
    }
    
    if (errorMessage.includes('Invalid value')) {
      return NextResponse.json(
        { error: 'Invalid data format. Please check your Excel file columns match the expected format.' },
        { status: 400 }
      )
    }
    
    // Generic error for unexpected issues
    return NextResponse.json(
      { 
        error: 'Failed to import assets. Please ensure your Excel file has the correct column headers and data format.',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    )
  }
}
