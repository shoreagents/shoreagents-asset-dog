import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

interface OrphanedRecord {
  id: string
  asset_id: string
}

async function cleanAllOrphanedAssetRecords() {
  try {
    console.log('🔍 Checking for orphaned records in all asset-related tables...\n')

    const tables = [
      { name: 'assets_checkin', displayName: 'Checkin' },
      { name: 'assets_move', displayName: 'Move' },
      { name: 'assets_reserve', displayName: 'Reserve' },
      { name: 'assets_lease', displayName: 'Lease' },
      { name: 'assets_lease_return', displayName: 'Lease Return' },
      { name: 'assets_dispose', displayName: 'Dispose' },
      { name: 'assets_maintenance', displayName: 'Maintenance' },
      { name: 'assets_audit_history', displayName: 'Audit History' },
    ]

    let totalDeleted = 0

    for (const table of tables) {
      // Find orphaned records using a LEFT JOIN query
      const orphanedRecords = await prisma.$queryRawUnsafe<Array<OrphanedRecord>>(
        `SELECT ac.id, ac.asset_id
        FROM "${table.name}" ac
        LEFT JOIN assets a ON ac.asset_id = a.id
        WHERE a.id IS NULL`
      )

      if (orphanedRecords.length > 0) {
        console.log(`⚠️  Found ${orphanedRecords.length} orphaned ${table.displayName} records`)

        // Delete orphaned records using Prisma deleteMany for each ID
        // This is safer than raw SQL with arrays
        const ids = orphanedRecords.map(r => r.id)
        
        // Use the appropriate Prisma model based on table name
        const modelMap: Record<string, keyof PrismaClient> = {
          'assets_checkin': 'assetsCheckin',
          'assets_move': 'assetsMove',
          'assets_reserve': 'assetsReserve',
          'assets_lease': 'assetsLease',
          'assets_lease_return': 'assetsLeaseReturn',
          'assets_dispose': 'assetsDispose',
          'assets_maintenance': 'assetsMaintenance',
          'assets_audit_history': 'assetsAuditHistory',
        }
        
        const modelName = modelMap[table.name]
        if (modelName) {
          const model = (prisma as any)[modelName]
          await model.deleteMany({
            where: {
              id: {
                in: ids
              }
            }
          })
        }

        console.log(`   ✓ Deleted ${orphanedRecords.length} orphaned ${table.displayName} records\n`)
        totalDeleted += orphanedRecords.length
      } else {
        console.log(`✅ No orphaned ${table.displayName} records found`)
      }
    }

    if (totalDeleted === 0) {
      console.log('\n✅ No orphaned records found. Database is clean!')
    } else {
      console.log(`\n✅ Cleanup complete! Deleted ${totalDeleted} orphaned records total.`)
    }
    
    console.log('✅ You can now run: npx prisma db push')

  } catch (error) {
    console.error('❌ Error cleaning orphaned records:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

cleanAllOrphanedAssetRecords()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

