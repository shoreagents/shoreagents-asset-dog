import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { retryDbOperation } from '@/lib/db-utils'
import { getCached, setCached, clearCache } from '@/lib/cache-utils'

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // All authenticated users can view departments
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    
    // Only cache when no search filter
    if (!search) {
      const cacheKey = 'departments-list'
      const cached = await getCached<{ departments: unknown[] }>(cacheKey)
      if (cached) {
        return NextResponse.json(cached)
      }
    }
    
    const where = search
      ? {
          name: {
            contains: search,
            mode: 'insensitive' as const,
          },
        }
      : {}

    const departments = await retryDbOperation(() =>
      prisma.assetsDepartment.findMany({
        where,
        orderBy: {
          name: 'asc',
        },
      })
    )

    const result = { departments }
    
    // Cache for 10 minutes if no search filter
    if (!search) {
      await setCached('departments-list', result, 600000)
    }

    return NextResponse.json(result)
  } catch (error: unknown) {
    const prismaError = error as { code?: string; message?: string }
    if (prismaError?.code === 'P1001' || prismaError?.code === 'P2024') {
      return NextResponse.json(
        { error: 'Database connection limit reached. Please try again in a moment.' },
        { status: 503 }
      )
    }
    console.error('Error fetching departments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch departments' },
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
    const { name, description } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Department name is required' },
        { status: 400 }
      )
    }

    const department = await retryDbOperation(() =>
      prisma.assetsDepartment.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
        },
      })
    )

    // Invalidate departments cache
    await clearCache('departments-list')

    return NextResponse.json({ department }, { status: 201 })
  } catch (error: unknown) {
    const prismaError = error as { code?: string; message?: string }
    
    // Handle duplicate name error - expected error, don't log
    if (prismaError?.code === 'P2002') {
      return NextResponse.json(
        { error: 'A department with this name already exists' },
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
    console.error('Unexpected error creating department:', error)
    return NextResponse.json(
      { error: 'Failed to create department' },
      { status: 500 }
    )
  }
}

