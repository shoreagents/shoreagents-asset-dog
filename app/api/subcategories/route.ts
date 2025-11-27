import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { retryDbOperation } from '@/lib/db-utils'

export async function GET(request: NextRequest) {
  try {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canViewAssets')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')

    // Use select instead of include to reduce data transfer and connection time
    const subcategories = await retryDbOperation(() => 
      prisma.subCategory.findMany({
      where: categoryId ? { categoryId } : undefined,
      select: {
        id: true,
        name: true,
        description: true,
        categoryId: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })
    )

    return NextResponse.json({ subcategories })
  } catch (error) {
    // Handle connection pool errors specifically
    const prismaError = error as { code?: string; message?: string }
    if (prismaError?.code === 'P2024' || 
        prismaError?.code === 'P1001' ||
        (error instanceof Error && (
          error.message.includes('connection pool') ||
          error.message.includes('Timed out fetching') ||
          error.message.includes("Can't reach database server")
        ))) {
      console.error('[Subcategories API] Connection pool error:', error)
      return NextResponse.json(
        { error: 'Database connection limit reached. Please try again in a moment.' },
        { status: 503 }
      )
    }
    
    // Only log non-transient errors
    if (prismaError?.code !== 'P1001' && prismaError?.code !== 'P2024') {
    console.error('Error fetching subcategories:', error)
    }
    return NextResponse.json(
      { error: 'Failed to fetch subcategories' },
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
    
    const subcategory = await retryDbOperation(() => 
      prisma.subCategory.create({
      data: {
        name: body.name,
        description: body.description,
        categoryId: body.categoryId,
      },
      include: {
        category: true,
      },
    })
    )

    return NextResponse.json({ subcategory }, { status: 201 })
  } catch (error: unknown) {
    const prismaError = error as { code?: string; message?: string }
    
    // Handle duplicate name error - expected error, don't log
    if (prismaError?.code === 'P2002') {
      return NextResponse.json(
        { error: 'A subcategory with this name already exists in this category' },
        { status: 409 }
      )
    }
    
    // Handle connection pool errors - expected error, don't log
    if (prismaError?.code === 'P1001' || prismaError?.code === 'P2024') {
      return NextResponse.json(
        { error: 'Database connection limit reached. Please try again in a moment.' },
        { status: 503 }
      )
    }
    
    // Only log unexpected errors
    console.error('Unexpected error creating subcategory:', error)
    return NextResponse.json(
      { error: 'Failed to create subcategory' },
      { status: 500 }
    )
  }
}

