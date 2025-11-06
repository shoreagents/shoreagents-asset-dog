import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkAssetEmployeeData() {
  try {
    // Check if assets have any employee-related fields
    const checkedOutAssets = await prisma.assets.findMany({
      where: {
        status: "Checked out"
      },
      take: 10, // Sample first 10
      select: {
        assetTagId: true,
        description: true,
        status: true,
        issuedTo: true,
      }
    })

    console.log('📊 Sample of checked out assets:')
    checkedOutAssets.forEach((asset, i) => {
      console.log(`\n${i + 1}. ${asset.assetTagId}`)
      console.log(`   Description: ${asset.description}`)
      console.log(`   Issued To: ${asset.issuedTo || 'N/A'}`)
    })

    // Check how many have issuedTo
    const assetsWithIssuedTo = await prisma.assets.count({
      where: {
        status: "Checked out",
        issuedTo: { not: null }
      }
    })

    const totalCheckedOut = await prisma.assets.count({
      where: { status: "Checked out" }
    })

    console.log(`\n📈 Statistics:`)
    console.log(`Total checked out assets: ${totalCheckedOut}`)
    console.log(`Assets with "issuedTo" field: ${assetsWithIssuedTo}`)
    console.log(`Assets without "issuedTo" field: ${totalCheckedOut - assetsWithIssuedTo}`)

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkAssetEmployeeData()

