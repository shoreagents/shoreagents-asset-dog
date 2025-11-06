import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Script to reassign existing checkout records to random employees
 * This updates the employee assignments for existing checkout records
 */
async function reassignCheckoutEmployees() {
  try {
    console.log('🔍 Finding all active checkout records...\n')

    // Get all active checkouts (not checked in)
    const activeCheckouts = await prisma.assetsCheckout.findMany({
      where: {
        checkins: {
          none: {}
        }
      },
      include: {
        asset: true,
        employeeUser: true,
      },
    })

    if (activeCheckouts.length === 0) {
      console.log('✅ No active checkout records found')
      await prisma.$disconnect()
      return
    }

    console.log(`📊 Found ${activeCheckouts.length} active checkout records\n`)

    // Get all employees for random assignment
    const allEmployees = await prisma.employeeUser.findMany({
      orderBy: { createdAt: 'asc' },
    })

    if (allEmployees.length === 0) {
      console.error('❌ No employees found in the database.')
      await prisma.$disconnect()
      return
    }

    console.log(`👥 Found ${allEmployees.length} employees available for random assignment\n`)

    // Helper function to get random employee
    const getRandomEmployee = () => {
      const randomIndex = Math.floor(Math.random() * allEmployees.length)
      return allEmployees[randomIndex]
    }

    // Track assignments
    const employeeAssignments = new Map<string, { name: string; email: string; count: number }>()
    const oldAssignments = new Map<string, { name: string; email: string; count: number }>()

    // Count old assignments
    activeCheckouts.forEach(checkout => {
      const key = checkout.employeeUserId
      const emp = checkout.employeeUser
      if (oldAssignments.has(key)) {
        oldAssignments.get(key)!.count++
      } else {
        oldAssignments.set(key, {
          name: emp.name,
          email: emp.email,
          count: 1,
        })
      }
    })

    console.log('📋 Current Assignments:')
    Array.from(oldAssignments.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .forEach(([employeeId, info]) => {
        console.log(`   ${info.name}: ${info.count} checkout(s)`)
      })
    console.log('')

    // Update checkouts with random employees
    console.log('🎲 Reassigning to random employees...\n')

    const results = await prisma.$transaction(
      activeCheckouts.map(checkout => {
        let newEmployee = getRandomEmployee()
        
        // Make sure we don't assign the same employee (unless there's only one employee)
        if (allEmployees.length > 1) {
          while (newEmployee.id === checkout.employeeUserId) {
            newEmployee = getRandomEmployee()
          }
        }

        // Track new assignment
        const key = newEmployee.id
        if (employeeAssignments.has(key)) {
          employeeAssignments.get(key)!.count++
        } else {
          employeeAssignments.set(key, {
            name: newEmployee.name,
            email: newEmployee.email,
            count: 1,
          })
        }

        return prisma.assetsCheckout.update({
          where: { id: checkout.id },
          data: {
            employeeUserId: newEmployee.id,
          },
          include: {
            asset: true,
            employeeUser: true,
          },
        })
      })
    )

    console.log(`✅ Successfully reassigned ${results.length} checkout record(s)\n`)

    console.log('📊 New Assignment Summary (Random Distribution):\n')
    const sortedAssignments = Array.from(employeeAssignments.entries())
      .sort((a, b) => b[1].count - a[1].count)
    
    sortedAssignments.forEach(([employeeId, info]) => {
      console.log(`   ${info.name} (${info.email}): ${info.count} asset(s)`)
    })
    console.log('')

    console.log('✨ Reassignment completed successfully!')

  } catch (error) {
    console.error('❌ Error reassigning checkout employees:', error)
    if (error instanceof Error) {
      console.error('Error details:', error.message)
    }
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
reassignCheckoutEmployees()

