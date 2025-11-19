import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { retryDbOperation } from '@/lib/db-utils'
import { getCached, setCached, clearCache } from '@/lib/cache-utils'

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // Viewing categories requires view assets permission
  const permissionCheck = await requirePermission('canViewAssets')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  // Check cache first (10 minute TTL - categories rarely change)
  const cacheKey = 'categories-list'
  const cached = getCached<{ categories: unknown[] }>(cacheKey)
  if (cached) {
    return NextResponse.json(cached)
  }

  try {
    const categories = await retryDbOperation(() => prisma.category.findMany({
      include: {
        subCategories: {
          orderBy: {
            name: 'asc',
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    }))

    const result = { categories }
    
    // Cache for 10 minutes (600000 ms) - categories rarely change
    setCached(cacheKey, result, 600000)

    return NextResponse.json(result)
  } catch (error: unknown) {
    // Handle connection pool errors specifically
    const prismaError = error as { code?: string; message?: string }
    if (prismaError?.code === 'P1001' || prismaError?.code === 'P2024') {
      return NextResponse.json(
        { error: 'Database connection limit reached. Please try again in a moment.' },
        { status: 503 }
      )
    }
    console.error('Error fetching categories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
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
    
    const category = await retryDbOperation(() => prisma.category.create({
      data: {
        name: body.name,
        description: body.description,
      },
    }))

    // Invalidate categories cache when new category is created
    clearCache('categories-list')

    return NextResponse.json({ category }, { status: 201 })
  } catch (error: unknown) {
    // Handle connection pool errors specifically
    const prismaError = error as { code?: string; message?: string }
    if (prismaError?.code === 'P1001' || prismaError?.code === 'P2024') {
      return NextResponse.json(
        { error: 'Database connection limit reached. Please try again in a moment.' },
        { status: 503 }
      )
    }
    console.error('Error creating category:', error)
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    )
  }
}

