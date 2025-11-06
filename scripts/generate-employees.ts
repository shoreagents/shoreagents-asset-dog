import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Sample Filipino names for realistic employee data
const firstNames = [
  'Maria', 'Jose', 'Juan', 'Ana', 'Pedro', 'Carmen', 'Miguel', 'Elena', 'Carlos', 'Rosa',
  'Antonio', 'Isabel', 'Francisco', 'Teresa', 'Manuel', 'Gloria', 'Rafael', 'Patricia', 'Fernando', 'Mercedes',
  'Ricardo', 'Dolores', 'Roberto', 'Concepcion', 'Alberto', 'Pilar', 'Eduardo', 'Cristina', 'Jorge', 'Beatriz',
  'Luis', 'Monica', 'Sergio', 'Alicia', 'Victor', 'Sofia', 'Raul', 'Adriana', 'Oscar', 'Gabriela',
  'Daniel', 'Valentina', 'Andres', 'Camila', 'Alejandro', 'Isabella', 'Diego', 'Valeria', 'Sebastian', 'Ximena',
  'Nicolas', 'Renata', 'Samuel', 'Antonella', 'Matias', 'Regina', 'Emiliano', 'Catalina', 'Leonardo', 'Emilia',
  'Santiago', 'Martina', 'Mateo', 'Paula', 'Benjamín', 'Lucia', 'Maximiliano', 'Julieta', 'Agustin', 'Mia',
  'Joaquin', 'Emma', 'Ignacio', 'Sara', 'Thiago', 'Daniela', 'Vicente', 'Mariana', 'Felipe', 'Natalia',
  'Rafael', 'Andrea', 'Rodrigo', 'Fernanda', 'Martin', 'Valentina', 'Esteban', 'Constanza', 'Cristobal', 'Amanda',
  'Gonzalo', 'Trinidad', 'Patricio', 'Esperanza', 'Arturo', 'Soledad', 'Hernan', 'Rosario', 'Mauricio', 'Dolores'
]

const lastNames = [
  'Santos', 'Reyes', 'Cruz', 'Bautista', 'Ocampo', 'Garcia', 'Lopez', 'Martinez', 'Gonzalez', 'Perez',
  'Sanchez', 'Ramirez', 'Torres', 'Flores', 'Rivera', 'Gomez', 'Diaz', 'Cruz', 'Morales', 'Gutierrez',
  'Castillo', 'Ramos', 'Herrera', 'Jimenez', 'Ruiz', 'Aguilar', 'Vargas', 'Mendoza', 'Castro', 'Ortiz',
  'Moreno', 'Romero', 'Alvarez', 'Mendez', 'Guerrero', 'Munoz', 'Alonso', 'Gutierrez', 'Navarro', 'Ramos',
  'Gil', 'Vazquez', 'Serrano', 'Blanco', 'Suarez', 'Munoz', 'Alonso', 'Gutierrez', 'Navarro', 'Ramos',
  'Delgado', 'Ortega', 'Marin', 'Cortes', 'Garrido', 'León', 'Herrera', 'Molina', 'Cabrera', 'Vega',
  'Campos', 'Peña', 'Fuentes', 'Carrasco', 'Nieto', 'Aguirre', 'Parra', 'Romero', 'Vidal', 'Carmona',
  'Crespo', 'Hidalgo', 'Luna', 'Soto', 'Ibanez', 'Mora', 'Rubio', 'Miranda', 'Calvo', 'Prieto',
  'Vega', 'Campos', 'Peña', 'Fuentes', 'Carrasco', 'Nieto', 'Aguirre', 'Parra', 'Romero', 'Vidal'
]

const departments = [
  'IT Department', 'Human Resources', 'Finance', 'Operations', 'Marketing', 'Sales', 'Customer Service',
  'Administration', 'Legal', 'Procurement', 'Quality Assurance', 'Research & Development', 'Logistics',
  'Security', 'Maintenance', 'Training', 'Compliance', 'Business Development', 'Project Management'
]

async function generateEmployeeUsers() {
  try {
    console.log('Generating 143 employee users...')
    
    const employees = []
    
    for (let i = 1; i <= 143; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)]
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)]
      const name = `${firstName} ${lastName}`
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@shoreagents.com`
      
      employees.push({
        name,
        email
      })
    }
    
    // Batch create all employees
    const createdEmployees = await prisma.employeeUser.createMany({
      data: employees,
      skipDuplicates: true
    })
    
    console.log(`Created ${createdEmployees.count} employee users`)
    
    // Get all assets and assign employees
    const assets = await prisma.assets.findMany({
      select: { id: true }
    })
    
    const allEmployees = await prisma.employeeUser.findMany({
      select: { id: true }
    })
    
    console.log(`Found ${assets.length} assets to assign employees to`)
    
    // Assign one employee per asset
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i]
      const employee = allEmployees[i % allEmployees.length] // Cycle through employees
      
      await prisma.assets.update({
        where: { id: asset.id },
        data: { employeeUserId: employee.id }
      })
    }
    
    console.log('Successfully assigned employees to all assets')
    
  } catch (error) {
    console.error('Error generating employee users:', error)
  } finally {
    await prisma.$disconnect()
  }
}

generateEmployeeUsers()
