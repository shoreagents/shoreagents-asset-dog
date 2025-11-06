import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkEmployees() {
  try {
    const employees = await prisma.employeeUser.findMany({
      orderBy: { createdAt: 'asc' },
    })

    console.log(`📊 Total employees: ${employees.length}\n`)

    if (employees.length > 0) {
      console.log('👥 Employee list:')
      employees.forEach((emp, i) => {
        console.log(`${i + 1}. ${emp.name} (${emp.email})`)
        console.log(`   ID: ${emp.id}`)
        console.log(`   Created: ${emp.createdAt.toLocaleDateString()}`)
        console.log('')
      })

      console.log(`\n💡 Default employee (first in list): ${employees[0].name} (${employees[0].email})`)
    } else {
      console.log('❌ No employees found in the database')
    }

    // Also check how many checkouts each employee has
    console.log('\n📈 Checkout Statistics by Employee:')
    const employeesWithCheckouts = await prisma.employeeUser.findMany({
      include: {
        _count: {
          select: {
            checkouts: true,
          },
        },
      },
      orderBy: {
        checkouts: {
          _count: 'desc',
        },
      },
    })

    employeesWithCheckouts.forEach((emp) => {
      console.log(`${emp.name}: ${emp._count.checkouts} checkout(s)`)
    })

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkEmployees()

