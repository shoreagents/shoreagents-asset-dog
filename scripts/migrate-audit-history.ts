import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface AssetWithOldAuditFields {
  id: string
  assetTagId: string
  auditedOctober2019?: boolean | null
  auditedApril2021?: boolean | null
  auditedMay2021?: boolean | null
  finalReconAudit2021?: boolean | null
}

async function migrateAuditHistory() {
  try {
    console.log('Starting audit history migration...')
    
    // First, check if old audit columns still exist in the database
    let hasOldColumns = false
    try {
      // Try to query one of the old columns using raw SQL
      await prisma.$queryRaw`
        SELECT audited_october_2019 
        FROM assets 
        LIMIT 1
      `
      hasOldColumns = true
      console.log('Old audit columns found in database. Will migrate data.')
    } catch (error: any) {
      // Column doesn't exist, which is fine - schema might already be migrated
      console.log('Old audit columns not found. This is expected after schema migration.')
      console.log('Skipping data migration from old columns.')
      hasOldColumns = false
    }

    let migratedCount = 0
    let skippedCount = 0
    let errorCount = 0

    if (hasOldColumns) {
      // Get all assets with old audit data using raw SQL
      const assetsWithAudits = await prisma.$queryRaw<AssetWithOldAuditFields[]>`
        SELECT 
          id,
          asset_tag_id as "assetTagId",
          audited_october_2019 as "auditedOctober2019",
          audited_april_2021 as "auditedApril2021",
          audited_may_2021 as "auditedMay2021",
          final_recon_audit_2021 as "finalReconAudit2021"
        FROM assets
        WHERE audited_october_2019 = true 
           OR audited_april_2021 = true 
           OR audited_may_2021 = true 
           OR final_recon_audit_2021 = true
      `

      console.log(`Found ${assetsWithAudits.length} assets with old audit data to migrate`)

      // Create audit history records for each asset
      for (const asset of assetsWithAudits) {
        try {
          const auditRecords = []

          // October 2019 Audit
          if (asset.auditedOctober2019 === true) {
            auditRecords.push({
              assetId: asset.id,
              auditType: 'October Audit',
              auditDate: new Date('2019-10-31'),
              auditYear: 2019,
              auditMonth: 10,
              status: 'Completed',
              notes: 'Migrated from legacy audited_october_2019 field'
            })
          }

          // April 2021 Audit
          if (asset.auditedApril2021 === true) {
            auditRecords.push({
              assetId: asset.id,
              auditType: 'April Audit',
              auditDate: new Date('2021-04-30'),
              auditYear: 2021,
              auditMonth: 4,
              status: 'Completed',
              notes: 'Migrated from legacy audited_april_2021 field'
            })
          }

          // May 2021 Audit
          if (asset.auditedMay2021 === true) {
            auditRecords.push({
              assetId: asset.id,
              auditType: 'May Audit',
              auditDate: new Date('2021-05-31'),
              auditYear: 2021,
              auditMonth: 5,
              status: 'Completed',
              notes: 'Migrated from legacy audited_may_2021 field'
            })
          }

          // Final Recon Audit 2021
          if (asset.finalReconAudit2021 === true) {
            auditRecords.push({
              assetId: asset.id,
              auditType: 'Final Recon Audit',
              auditDate: new Date('2021-12-31'),
              auditYear: 2021,
              auditMonth: 12,
              status: 'Completed',
              notes: 'Migrated from legacy final_recon_audit_2021 field'
            })
          }

          // Create all audit records for this asset
          if (auditRecords.length > 0) {
            await prisma.assetsAuditHistory.createMany({
              data: auditRecords,
              skipDuplicates: true
            })
            migratedCount += auditRecords.length
            console.log(`✓ Migrated ${auditRecords.length} audit record(s) for asset ${asset.assetTagId}`)
          }
        } catch (error: any) {
          errorCount++
          console.error(`✗ Error migrating audits for asset ${asset.assetTagId}:`, error.message)
        }
      }
    }

    // Now get all assets (regardless of old audit data) and create a summary
    const allAssets = await prisma.assets.findMany({
      select: { id: true, assetTagId: true }
    })

    console.log('\n--- Migration Summary ---')
    console.log(`Total assets in database: ${allAssets.length}`)
    if (hasOldColumns) {
      console.log(`Assets with old audit data migrated: ${migratedCount} records created`)
      console.log(`Assets skipped (no audit data): ${skippedCount}`)
      console.log(`Errors encountered: ${errorCount}`)
    } else {
      console.log('No old audit columns found - schema already migrated.')
    }

    // Show current audit history count
    const auditHistoryCount = await prisma.assetsAuditHistory.count()
    console.log(`Total audit history records in database: ${auditHistoryCount}`)

    console.log('\n✓ Audit history migration completed!')
    
  } catch (error) {
    console.error('Error during audit history migration:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

migrateAuditHistory()

