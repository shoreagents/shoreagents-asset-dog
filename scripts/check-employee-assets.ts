import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkEmployeeAssets(email: string) {
  try {
    console.log(`🔍 Checking assets for email: ${email}`)
    
    // First, check if the employee exists
    const employee = await prisma.employeeUser.findUnique({
      where: { email },
      include: {
        assets: {
          include: {
            category: true,
            subCategory: true,
          }
        }
      }
    })

    if (!employee) {
      console.log(`❌ Employee with email ${email} not found`)
      return
    }

    console.log(`✅ Employee found: ${employee.name} (${employee.email})`)
    console.log(`📊 Total assets assigned: ${employee.assets.length}`)

    if (employee.assets.length > 0) {
      console.log('\n📋 Assets assigned to this employee:')
      employee.assets.forEach((asset, index) => {
        console.log(`${index + 1}. ${asset.assetTagId} - ${asset.description}`)
        console.log(`   Category: ${asset.category?.name || 'N/A'}`)
        console.log(`   SubCategory: ${asset.subCategory?.name || 'N/A'}`)
        console.log(`   Status: ${asset.status}`)
        console.log(`   Location: ${asset.location}`)
        console.log('')
      })
    } else {
      console.log('📭 No assets assigned to this employee')
    }

    // Also check total employees and assets
    const totalEmployees = await prisma.employeeUser.count()
    const totalAssets = await prisma.assets.count()
    const assetsWithEmployees = await prisma.assets.count({
      where: {
        employeeUserId: { not: null }
      }
    })

    console.log('\n📈 Database Statistics:')
    console.log(`Total Employees: ${totalEmployees}`)
    console.log(`Total Assets: ${totalAssets}`)
    console.log(`Assets with Employee Assignment: ${assetsWithEmployees}`)
    console.log(`Assets without Employee Assignment: ${totalAssets - assetsWithEmployees}`)

  } catch (error) {
    console.error('❌ Error checking employee assets:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Check the specific email
const emailToCheck = 'esperanza.gomez47@shoreagents.com'
checkEmployeeAssets(emailToCheck)
