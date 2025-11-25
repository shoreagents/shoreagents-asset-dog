import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { retryDbOperation } from '@/lib/db-utils'
import { getCached, setCached, clearCache } from '@/lib/cache-utils'

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // All authenticated users can view locations
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    
    // Only cache when no search filter (most common case - dropdown loading)
    if (!search) {
      const cacheKey = 'locations-list'
      const cached = await getCached<{ locations: unknown[] }>(cacheKey)
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

    const locations = await retryDbOperation(() =>
      prisma.assetsLocation.findMany({
        where,
        orderBy: {
          name: 'asc',
        },
      })
    )

    const result = { locations }
    
    // Cache for 10 minutes if no search filter
    if (!search) {
      await setCached('locations-list', result, 600000)
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
    console.error('Error fetching locations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch locations' },
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
        { error: 'Location name is required' },
        { status: 400 }
      )
    }

    const location = await retryDbOperation(() =>
      prisma.assetsLocation.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
        },
      })
    )

    // Invalidate locations cache when new location is created
    await clearCache('locations-list')

    return NextResponse.json({ location }, { status: 201 })
  } catch (error: unknown) {
    console.error('Error creating location:', error)
    
    const prismaError = error as { code?: string; message?: string }
    
    // Handle unique constraint violation (duplicate name)
    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        { error: 'A location with this name already exists' },
        { status: 409 }
      )
    }
    if (prismaError?.code === 'P1001' || prismaError?.code === 'P2024') {
      return NextResponse.json(
        { error: 'Database connection limit reached. Please try again in a moment.' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create location' },
      { status: 500 }
    )
  }
}

