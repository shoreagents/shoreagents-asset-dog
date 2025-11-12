import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { retryDbOperation } from '@/lib/db-utils'

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // Viewing categories requires view assets permission
  const permissionCheck = await requirePermission('canViewAssets')
  if (!permissionCheck.allowed) return permissionCheck.error

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

    return NextResponse.json({ categories })
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

  const permissionCheck = await requirePermission('canManageCategories')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const body = await request.json()
    
    const category = await retryDbOperation(() => prisma.category.create({
      data: {
        name: body.name,
        description: body.description,
      },
    }))

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

