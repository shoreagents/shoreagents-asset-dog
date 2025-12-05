import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requireAdmin } from '@/lib/permission-utils'
import { retryDbOperation } from '@/lib/db-utils'

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const adminCheck = await requireAdmin()
  if (!adminCheck.allowed && adminCheck.error) {
    return adminCheck.error
  }

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const eventType = searchParams.get('eventType') // Filter by event type
    const field = searchParams.get('field') // Filter by field
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)
    const skip = (page - 1) * pageSize

    let whereClause: any = {}

    // Search filter
    if (search) {
      whereClause.OR = [
        { actionBy: { contains: search, mode: 'insensitive' } },
        { field: { contains: search, mode: 'insensitive' } },
        { changeFrom: { contains: search, mode: 'insensitive' } },
        { changeTo: { contains: search, mode: 'insensitive' } },
        { asset: { assetTagId: { contains: search, mode: 'insensitive' } } },
        { asset: { description: { contains: search, mode: 'insensitive' } } },
      ]
    }

    // Event type filter
    if (eventType && eventType !== 'all') {
      whereClause.eventType = eventType
    }

    // Field filter
    if (field && field !== 'all') {
      whereClause.field = field
    }

    const totalCount = await retryDbOperation(() =>
      prisma.assetsHistoryLogs.count({ where: whereClause })
    )

    const logs = await retryDbOperation(() =>
      prisma.assetsHistoryLogs.findMany({
        where: whereClause,
        include: {
          asset: {
            select: {
              id: true,
              assetTagId: true,
              description: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: pageSize,
      })
    )

    const totalPages = Math.ceil(totalCount / pageSize)

    return NextResponse.json({
      logs,
      pagination: {
        page,
        pageSize,
        total: totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    })
  } catch (error: unknown) {
    const prismaError = error as { code?: string; message?: string }
    if (prismaError?.code === 'P1001' || prismaError?.code === 'P2024') {
      return NextResponse.json(
        { error: 'Database connection limit reached. Please try again in a moment.' },
        { status: 503 }
      )
    }
    console.error('Error fetching asset events:', error)
    return NextResponse.json(
      { error: 'Failed to fetch asset events' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const adminCheck = await requireAdmin()
  if (!adminCheck.allowed && adminCheck.error) {
    return adminCheck.error
  }

  try {
    const body = await request.json()
    const { ids } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'IDs array is required' },
        { status: 400 }
      )
    }

    await retryDbOperation(() =>
      prisma.assetsHistoryLogs.deleteMany({
        where: {
          id: {
            in: ids,
          },
        },
      })
    )

    return NextResponse.json({
      success: true,
      message: `${ids.length} event${ids.length > 1 ? 's' : ''} deleted successfully`,
    })
  } catch (error: unknown) {
    const prismaError = error as { code?: string; message?: string }
    if (prismaError?.code === 'P1001' || prismaError?.code === 'P2024') {
      return NextResponse.json(
        { error: 'Database connection limit reached. Please try again in a moment.' },
        { status: 503 }
      )
    }
    console.error('Error deleting asset events:', error)
    return NextResponse.json(
      { error: 'Failed to delete asset events' },
      { status: 500 }
    )
  }
}

