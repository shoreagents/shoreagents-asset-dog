import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanOrphanedCheckouts() {
  try {
    console.log('🔍 Checking for orphaned checkout records...\n')

    // Find orphaned checkout records using a LEFT JOIN query
    const orphanedCheckouts = await prisma.$queryRaw<Array<{ 
      id: string
      asset_id: string
      checkout_date: Date
      created_at: Date
    }>>`
      SELECT 
        ac.id,
        ac.asset_id,
        ac.checkout_date,
        ac.created_at
      FROM assets_checkout ac
      LEFT JOIN assets a ON ac.asset_id = a.id
      WHERE a.id IS NULL
    `

    console.log(`⚠️  Orphaned checkout records found: ${orphanedCheckouts.length}\n`)

    if (orphanedCheckouts.length === 0) {
      console.log('✅ No orphaned records found. Database is clean!')
      console.log('✅ You can now run: npx prisma db push')
      return
    }

    // Display orphaned records
    console.log('📋 Orphaned checkout records:')
    console.log('─'.repeat(80))
    orphanedCheckouts.forEach((checkout, index) => {
      console.log(`${index + 1}. ID: ${checkout.id}`)
      console.log(`   Asset ID: ${checkout.asset_id}`)
      console.log(`   Checkout Date: ${checkout.checkout_date}`)
      console.log(`   Created At: ${checkout.created_at}`)
      console.log('')
    })
    console.log('─'.repeat(80))

    // Check for related checkins that reference these orphaned checkouts
    const orphanedCheckoutIds = orphanedCheckouts.map(c => c.id)
    
    if (orphanedCheckoutIds.length > 0) {
      // Find related checkins using Prisma
      const relatedCheckins = await prisma.assetsCheckin.findMany({
        where: {
          checkoutId: {
            in: orphanedCheckoutIds
          }
        },
        select: {
          id: true,
          checkoutId: true
        }
      })

      if (relatedCheckins.length > 0) {
        console.log(`⚠️  Warning: Found ${relatedCheckins.length} checkin records that reference these orphaned checkouts.`)
        console.log('   These checkins will also be deleted.\n')
      }

      // Delete orphaned records in a transaction
      console.log('🗑️  Deleting orphaned checkout records...')
      
      await prisma.$transaction(async (tx) => {
        // First delete related checkins (they reference the checkouts)
        if (relatedCheckins.length > 0) {
          await tx.assetsCheckin.deleteMany({
            where: {
              checkoutId: {
                in: orphanedCheckoutIds
              }
            }
          })
          console.log(`   ✓ Deleted ${relatedCheckins.length} related checkin records`)
        }

        // Then delete orphaned checkouts
        await tx.assetsCheckout.deleteMany({
          where: {
            id: {
              in: orphanedCheckoutIds
            }
          }
        })
      })

      console.log(`   ✓ Deleted ${orphanedCheckouts.length} orphaned checkout records`)
      console.log('\n✅ Cleanup complete! You can now run: npx prisma db push')
    }

  } catch (error) {
    console.error('❌ Error cleaning orphaned records:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

cleanOrphanedCheckouts()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

