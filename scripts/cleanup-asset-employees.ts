import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanupAssetEmployees() {
  try {
    console.log('🧹 Starting cleanup of employee assignments from assets...\n')

    // Find assets with employee users that have status: Available, Lost/Missing, or Disposed
    const assetsToClean = await prisma.assets.findMany({
      where: {
        employeeUserId: { not: null },
        status: {
          in: ['Available', 'Lost/Missing', 'Disposed']
        }
      },
      include: {
        employeeUser: true,
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    console.log(`📊 Found ${assetsToClean.length} assets to clean up:\n`)

    // Group by status
    const byStatus: Record<string, number> = {}
    assetsToClean.forEach(asset => {
      const status = asset.status || 'No Status'
      byStatus[status] = (byStatus[status] || 0) + 1
    })

    console.log('📈 Assets to clean up by status:')
    Object.entries(byStatus)
      .sort(([, a], [, b]) => b - a)
      .forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`)
      })

    if (assetsToClean.length === 0) {
      console.log('\n✅ No assets need cleaning. All good!')
      return
    }

    // Show preview of what will be cleaned
    console.log('\n📋 Preview of assets that will be cleaned (first 10):')
    console.log('='.repeat(100))
    assetsToClean.slice(0, 10).forEach((asset, index) => {
      console.log(`${index + 1}. ${asset.assetTagId} - ${asset.description?.substring(0, 50)}...`)
      console.log(`   Status: ${asset.status}`)
      console.log(`   Current Employee: ${asset.employeeUser?.name || 'N/A'} (${asset.employeeUser?.email || 'N/A'})`)
    })

    if (assetsToClean.length > 10) {
      console.log(`\n   ... and ${assetsToClean.length - 10} more assets`)
    }

    // Perform the cleanup
    console.log('\n\n🔄 Removing employee assignments...\n')

    const updateResult = await prisma.assets.updateMany({
      where: {
        employeeUserId: { not: null },
        status: {
          in: ['Available', 'Lost/Missing', 'Disposed']
        }
      },
      data: {
        employeeUserId: null
      }
    })

    console.log(`✅ Successfully removed employee assignments from ${updateResult.count} assets`)

    // Verify the cleanup
    const remainingAnomalies = await prisma.assets.findMany({
      where: {
        employeeUserId: { not: null },
        status: {
          in: ['Available', 'Lost/Missing', 'Disposed']
        }
      }
    })

    if (remainingAnomalies.length === 0) {
      console.log('\n✅ Verification: All cleanup complete! No remaining anomalies.')
    } else {
      console.log(`\n⚠️  Warning: ${remainingAnomalies.length} assets still have anomalies`)
    }

    // Show final statistics
    const totalAssets = await prisma.assets.count()
    const assetsWithEmployees = await prisma.assets.count({
      where: {
        employeeUserId: { not: null }
      }
    })
    const assetsWithoutEmployees = await prisma.assets.count({
      where: {
        employeeUserId: null
      }
    })
    const checkedOutAssets = await prisma.assets.count({
      where: {
        status: 'Checked out'
      }
    })
    const checkedOutWithEmployee = await prisma.assets.count({
      where: {
        status: 'Checked out',
        employeeUserId: { not: null }
      }
    })
    const availableAssets = await prisma.assets.count({
      where: {
        status: 'Available'
      }
    })
    const availableWithEmployee = await prisma.assets.count({
      where: {
        status: 'Available',
        employeeUserId: { not: null }
      }
    })

    console.log('\n\n📊 FINAL STATISTICS:')
    console.log('='.repeat(100))
    console.log(`Total Assets: ${totalAssets}`)
    console.log(`Assets with Employee Users: ${assetsWithEmployees}`)
    console.log(`Assets without Employee Users: ${assetsWithoutEmployees}`)
    console.log(`\nStatus "Checked out": ${checkedOutAssets} total, ${checkedOutWithEmployee} with employees`)
    console.log(`Status "Available": ${availableAssets} total, ${availableWithEmployee} with employees`)

    // Verify employee users are still intact
    const employeeCount = await prisma.employeeUser.count()
    console.log(`\n👥 Employee Users in database: ${employeeCount} (all preserved)`)

    console.log('\n✅ Cleanup completed successfully!')

  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the cleanup
cleanupAssetEmployees()
  .then(() => {
    console.log('\n🎉 Done!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Cleanup failed:', error)
    process.exit(1)
  })

