import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Script to sync checked out assets with checkout records
 * Finds all assets with status "Checked out" and ensures they have checkout records
 */
async function syncCheckedOutAssets(employeeEmail?: string, defaultCheckoutDate?: string) {
  try {
    console.log('🔍 Checking for checked out assets without checkout records...\n')

    // Find all assets with status "Checked out"
    const checkedOutAssets = await prisma.assets.findMany({
      where: {
        status: "Checked out"
      },
      include: {
        checkouts: {
          orderBy: { checkoutDate: 'desc' },
          take: 1,
          include: {
            employeeUser: true,
            checkins: {
              take: 1,
            },
          },
        },
      },
    })

    console.log(`📊 Found ${checkedOutAssets.length} assets with status "Checked out"\n`)

    // Filter assets that don't have an active checkout record (or the checkout has been checked in)
    const assetsNeedingCheckout = checkedOutAssets.filter(asset => {
      const latestCheckout = asset.checkouts[0]
      // Need checkout if:
      // 1. No checkout record exists
      // 2. Latest checkout has been checked in (has a checkin record)
      return !latestCheckout || latestCheckout.checkins.length > 0
    })

    if (assetsNeedingCheckout.length === 0) {
      console.log('✅ All checked out assets already have active checkout records!')
      await prisma.$disconnect()
      return
    }

    console.log(`⚠️  Found ${assetsNeedingCheckout.length} checked out assets without active checkout records:\n`)

    // Display assets needing checkout records
    assetsNeedingCheckout.forEach((asset, index) => {
      console.log(`${index + 1}. ${asset.assetTagId} - ${asset.description}`)
      console.log(`   Status: ${asset.status}`)
      console.log(`   Location: ${asset.location || 'N/A'}`)
      const latestCheckout = asset.checkouts[0]
      if (latestCheckout) {
        console.log(`   Last checkout: ${latestCheckout.checkoutDate.toLocaleDateString()} (already checked in)`)
      } else {
        console.log(`   No checkout record found`)
      }
      console.log('')
    })

    // Get all employees for random assignment
    const allEmployees = await prisma.employeeUser.findMany({
      orderBy: { createdAt: 'asc' },
    })

    if (allEmployees.length === 0) {
      console.error('❌ No employees found in the database. Please create an employee first.')
      await prisma.$disconnect()
      return
    }

    console.log(`👥 Found ${allEmployees.length} employees available for random assignment\n`)

    // Determine if using specific employee or random assignment
    let useSpecificEmployee = false
    let specificEmployeeId: string | null = null

    if (employeeEmail) {
      const employee = await prisma.employeeUser.findUnique({
        where: { email: employeeEmail },
      })

      if (!employee) {
        console.error(`❌ Employee with email "${employeeEmail}" not found`)
        await prisma.$disconnect()
        return
      }

      specificEmployeeId = employee.id
      useSpecificEmployee = true
      console.log(`✅ Using specific employee: ${employee.name} (${employee.email})\n`)
    } else {
      console.log(`🎲 Will randomly assign assets to employees\n`)
    }

    // Helper function to get random employee
    const getRandomEmployee = () => {
      const randomIndex = Math.floor(Math.random() * allEmployees.length)
      return allEmployees[randomIndex]
    }

    // Use provided checkout date or default to today
    const checkoutDate = defaultCheckoutDate 
      ? new Date(defaultCheckoutDate)
      : new Date()

    // Create checkout records
    console.log('📝 Creating checkout records...\n')

    // Track employee assignments for reporting
    const employeeAssignments = new Map<string, { name: string; email: string; count: number }>()

    const results = await prisma.$transaction(
      assetsNeedingCheckout.map(asset => {
        // Check if there's a previous checkout that was checked in
        const previousCheckout = asset.checkouts[0]
        
        // Get employee - specific or random
        const assignedEmployee = useSpecificEmployee 
          ? allEmployees.find(e => e.id === specificEmployeeId!)
          : getRandomEmployee()

        if (!assignedEmployee) {
          throw new Error('Failed to assign employee')
        }

        // Track assignment
        const key = assignedEmployee.id
        if (employeeAssignments.has(key)) {
          employeeAssignments.get(key)!.count++
        } else {
          employeeAssignments.set(key, {
            name: assignedEmployee.name,
            email: assignedEmployee.email,
            count: 1,
          })
        }
        
        return prisma.assetsCheckout.create({
          data: {
            assetId: asset.id,
            employeeUserId: assignedEmployee.id,
            checkoutDate: checkoutDate,
            expectedReturnDate: null,
          },
          include: {
            asset: true,
            employeeUser: true,
          },
        })
      })
    )

    console.log(`✅ Successfully created ${results.length} checkout record(s)\n`)
    
    // Show assignment summary
    if (!useSpecificEmployee) {
      console.log('📊 Assignment Summary (Random Distribution):\n')
      const sortedAssignments = Array.from(employeeAssignments.entries())
        .sort((a, b) => b[1].count - a[1].count)
      
      sortedAssignments.forEach(([employeeId, info]) => {
        console.log(`   ${info.name} (${info.email}): ${info.count} asset(s)`)
      })
      console.log('')
    } else {
      // Show first few if using specific employee
      console.log('First 10 assignments:\n')
      results.slice(0, 10).forEach((checkout, index) => {
        console.log(`${index + 1}. Asset: ${checkout.asset.assetTagId}`)
        console.log(`   Employee: ${checkout.employeeUser.name} (${checkout.employeeUser.email})`)
        console.log(`   Checkout Date: ${checkout.checkoutDate.toLocaleDateString()}`)
        console.log('')
      })
      if (results.length > 10) {
        console.log(`... and ${results.length - 10} more (all assigned to ${results[0].employeeUser.name})\n`)
      }
    }

    console.log('✨ Sync completed successfully!')

  } catch (error) {
    console.error('❌ Error syncing checked out assets:', error)
    if (error instanceof Error) {
      console.error('Error details:', error.message)
    }
  } finally {
    await prisma.$disconnect()
  }
}

// Get command line arguments
const args = process.argv.slice(2)
const employeeEmail = args[0] || undefined
const checkoutDate = args[1] || undefined

// Run the script
syncCheckedOutAssets(employeeEmail, checkoutDate)

