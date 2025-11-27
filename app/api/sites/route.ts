import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { retryDbOperation } from '@/lib/db-utils'
import { getCached, setCached, clearCache } from '@/lib/cache-utils'

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // All authenticated users can view sites
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    
    // Only cache when no search filter
    if (!search) {
      const cacheKey = 'sites-list'
      const cached = await getCached<{ sites: unknown[] }>(cacheKey)
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

    const sites = await retryDbOperation(() =>
      prisma.assetsSite.findMany({
        where,
        orderBy: {
          name: 'asc',
        },
      })
    )

    const result = { sites }
    
    // Cache for 10 minutes if no search filter
    if (!search) {
      await setCached('sites-list', result, 600000)
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
    console.error('Error fetching sites:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sites' },
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
        { error: 'Site name is required' },
        { status: 400 }
      )
    }

    const site = await retryDbOperation(() =>
      prisma.assetsSite.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
        },
      })
    )

    // Invalidate sites cache
    await clearCache('sites-list')

    return NextResponse.json({ site }, { status: 201 })
  } catch (error: unknown) {
    // Handle unique constraint violation (duplicate name) - expected error, don't log
    const prismaError = error as { code?: string; message?: string }
    if (prismaError?.code === 'P2002') {
      return NextResponse.json(
        { error: 'A site with this name already exists' },
        { status: 409 }
      )
    }

    // Handle database connection errors - expected error, don't log
    if (prismaError?.code === 'P1001' || prismaError?.code === 'P2024') {
      return NextResponse.json(
        { error: 'Database connection limit reached. Please try again in a moment.' },
        { status: 503 }
      )
    }

    // Only log unexpected errors
    console.error('Unexpected error creating site:', error)
    return NextResponse.json(
      { error: 'Failed to create site' },
      { status: 500 }
    )
  }
}

