import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkAssetsWithEmployees() {
  try {
    console.log('🔍 Checking assets with employee users...\n')

    // Get all assets with employee users
    const assetsWithEmployees = await prisma.assets.findMany({
      where: {
        employeeUserId: { not: null }
      },
      include: {
        employeeUser: true,
        category: true,
        subCategory: true,
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    console.log(`📊 Total assets with employee users: ${assetsWithEmployees.length}\n`)

    // Group by status
    const byStatus: Record<string, number> = {}
    assetsWithEmployees.forEach(asset => {
      const status = asset.status || 'No Status'
      byStatus[status] = (byStatus[status] || 0) + 1
    })

    console.log('📈 Assets with employees grouped by status:')
    Object.entries(byStatus)
      .sort(([, a], [, b]) => b - a)
      .forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`)
      })

    // Find anomalies: assets with employees but status is not "In Use"
    const anomalies = assetsWithEmployees.filter(
      asset => asset.status !== 'In Use'
    )

    console.log(`\n⚠️  ANOMALIES FOUND: ${anomalies.length} assets with employee users but status is NOT "In Use"\n`)

    if (anomalies.length > 0) {
      console.log('🚨 Assets that should NOT have employee users (Status ≠ "In Use"):')
      console.log('=' .repeat(100))
      
      anomalies.forEach((asset, index) => {
        console.log(`\n${index + 1}. ${asset.assetTagId} - ${asset.description?.substring(0, 60)}...`)
        console.log(`   Status: ${asset.status || 'No Status'}`)
        console.log(`   Employee: ${asset.employeeUser?.name || 'N/A'} (${asset.employeeUser?.email || 'N/A'})`)
        console.log(`   Category: ${asset.category?.name || 'N/A'}`)
        console.log(`   Location: ${asset.location || 'N/A'}`)
        console.log(`   Updated: ${asset.updatedAt.toISOString().split('T')[0]}`)
      })

      // Group anomalies by status
      const anomaliesByStatus: Record<string, number> = {}
      anomalies.forEach(asset => {
        const status = asset.status || 'No Status'
        anomaliesByStatus[status] = (anomaliesByStatus[status] || 0) + 1
      })

      console.log('\n📊 Anomalies by status:')
      Object.entries(anomaliesByStatus)
        .sort(([, a], [, b]) => b - a)
        .forEach(([status, count]) => {
          console.log(`   ${status}: ${count}`)
        })
    }

    // Show correct assignments (status = "In Use")
    const correctAssignments = assetsWithEmployees.filter(
      asset => asset.status === 'In Use'
    )

    console.log(`\n✅ CORRECT ASSIGNMENTS: ${correctAssignments.length} assets with status "In Use" and employee users\n`)

    // Statistics by employee
    const employeeMap = new Map<string, { name: string; email: string; total: number; inUse: number; anomalies: number }>()
    
    assetsWithEmployees.forEach(asset => {
      if (asset.employeeUser) {
        const key = asset.employeeUser.id
        if (!employeeMap.has(key)) {
          employeeMap.set(key, {
            name: asset.employeeUser.name,
            email: asset.employeeUser.email,
            total: 0,
            inUse: 0,
            anomalies: 0
          })
        }
        const emp = employeeMap.get(key)!
        emp.total++
        if (asset.status === 'In Use') {
          emp.inUse++
        } else {
          emp.anomalies++
        }
      }
    })

    console.log(`\n👥 Employee Summary (Top 10 by total assets):`)
    console.log('=' .repeat(100))
    Array.from(employeeMap.entries())
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, 10)
      .forEach(([id, emp]) => {
        console.log(`\n${emp.name} (${emp.email})`)
        console.log(`   Total assets: ${emp.total}`)
        console.log(`   ✅ In Use: ${emp.inUse}`)
        console.log(`   ⚠️  Anomalies: ${emp.anomalies}`)
      })

    // Overall statistics
    const totalAssets = await prisma.assets.count()
    const assetsWithoutEmployees = await prisma.assets.count({
      where: {
        employeeUserId: null
      }
    })
    const assetsInUse = await prisma.assets.count({
      where: {
        status: 'In Use'
      }
    })
    const assetsInUseWithoutEmployee = await prisma.assets.count({
      where: {
        status: 'In Use',
        employeeUserId: null
      }
    })

    console.log(`\n\n📊 OVERALL STATISTICS:`)
    console.log('=' .repeat(100))
    console.log(`Total Assets: ${totalAssets}`)
    console.log(`Assets with Employee Users: ${assetsWithEmployees.length}`)
    console.log(`Assets without Employee Users: ${assetsWithoutEmployees}`)
    console.log(`Assets with Status "In Use": ${assetsInUse}`)
    console.log(`Assets "In Use" but NO employee assigned: ${assetsInUseWithoutEmployee} ⚠️`)
    console.log(`Assets with employees but NOT "In Use": ${anomalies.length} ⚠️`)

    // Summary recommendations
    console.log(`\n\n💡 RECOMMENDATIONS:`)
    console.log('=' .repeat(100))
    if (anomalies.length > 0) {
      console.log(`⚠️  Found ${anomalies.length} assets with employee users but status ≠ "In Use"`)
      console.log(`   Consider running a cleanup script to remove employee assignments from these assets`)
    }
    if (assetsInUseWithoutEmployee > 0) {
      console.log(`⚠️  Found ${assetsInUseWithoutEmployee} assets with status "In Use" but no employee assigned`)
      console.log(`   These assets may need to be checked in or assigned`)
    }

  } catch (error) {
    console.error('❌ Error checking assets with employees:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkAssetsWithEmployees()

