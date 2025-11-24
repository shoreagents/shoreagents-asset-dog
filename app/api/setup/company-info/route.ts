import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { retryDbOperation } from '@/lib/db-utils'

export async function GET() {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // Allow read access to all authenticated users (for logo display in sidebar)
  // Only require permission for write operations (POST)
  try {
    // Get company info - there should only be one record
    // Use transaction to optimize connection pool usage
    const companyInfo = await retryDbOperation(() =>
      prisma.$transaction(
        async (tx) => {
          return await tx.companyInfo.findFirst({
            orderBy: { createdAt: 'desc' },
          })
        },
        {
          timeout: 30000, // 30 second timeout
          isolationLevel: 'ReadCommitted', // Read-only transaction
        }
      )
    )

    return NextResponse.json({ companyInfo })
  } catch (error) {
    console.error('Error fetching company info:', error)
    
    // Provide more specific error messages
    if (error instanceof Error) {
      // Check for connection pool timeout
      if (error.message.includes('connection pool') || error.message.includes('P2024') || error.message.includes('P1001')) {
        return NextResponse.json(
          { 
            error: 'Database connection timeout. Please try again.',
            details: 'The database is currently busy. Please wait a moment and retry.'
          },
          { status: 503 } // Service Unavailable
        )
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch company info',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canManageSetup')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const body = await request.json()
    const {
      companyName,
      contactEmail,
      contactPhone,
      address,
      zipCode,
      country,
      website,
      primaryLogoUrl,
      secondaryLogoUrl,
    } = body

    if (!companyName) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      )
    }

    // Use transaction to optimize connection pool usage and ensure atomicity
    const result = await retryDbOperation(() =>
      prisma.$transaction(
        async (tx) => {
          // Check if company info already exists
          const existing = await tx.companyInfo.findFirst()
          
          if (existing) {
            // Update existing record
            const updated = await tx.companyInfo.update({
              where: { id: existing.id },
              data: {
                companyName,
                contactEmail,
                contactPhone,
                address,
                zipCode,
                country,
                website,
                primaryLogoUrl,
                secondaryLogoUrl,
              },
            })
            return { companyInfo: updated, isUpdate: true }
          } else {
            // Create new record
            const created = await tx.companyInfo.create({
              data: {
                companyName,
                contactEmail,
                contactPhone,
                address,
                zipCode,
                country,
                website,
                primaryLogoUrl,
                secondaryLogoUrl,
              },
            })
            return { companyInfo: created, isUpdate: false }
          }
        },
        {
          timeout: 30000, // 30 second timeout
          isolationLevel: 'ReadCommitted',
        }
      )
    )

    return NextResponse.json({ companyInfo: result.companyInfo }, { status: result.isUpdate ? 200 : 201 })
  } catch (error) {
    console.error('Error saving company info:', error)
    return NextResponse.json(
      { error: 'Failed to save company info' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  // PUT is same as POST - upsert behavior
  return POST(request)
}

