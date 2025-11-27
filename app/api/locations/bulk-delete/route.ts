import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { retryDbOperation } from '@/lib/db-utils'
import { clearCache } from '@/lib/cache-utils'

export async function DELETE(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canManageSetup')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const body = await request.json()
    const { ids } = body

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request. Expected an array of location IDs.' },
        { status: 400 }
      )
    }

    // Check which locations have associated assets
    const locations = await retryDbOperation(() =>
      prisma.assetsLocation.findMany({
        where: {
          id: {
            in: ids
          }
        },
        select: {
          id: true,
          name: true,
        }
      })
    )

    const locationsWithAssets: string[] = []
    const locationsToDelete: string[] = []

    // Check each location for associated assets
    for (const location of locations) {
      const assetsWithLocation = await retryDbOperation(() =>
        prisma.assets.findMany({
          where: {
            location: location.name,
            isDeleted: false,
          },
          take: 1,
        })
      )

      if (assetsWithLocation.length > 0) {
        locationsWithAssets.push(location.name)
      } else {
        locationsToDelete.push(location.id)
      }
    }

    // If any locations have associated assets, return error
    if (locationsWithAssets.length > 0) {
      return NextResponse.json(
        { 
          error: `Cannot delete location(s) with associated assets: ${locationsWithAssets.join(', ')}. Please reassign or delete assets first.`,
          locationsWithAssets 
        },
        { status: 400 }
      )
    }

    // Delete all locations that don't have associated assets
    const result = await retryDbOperation(() =>
      prisma.assetsLocation.deleteMany({
        where: {
          id: {
            in: locationsToDelete
          }
        }
      })
    )

    // Invalidate locations cache
    await clearCache('locations-list')

    return NextResponse.json({ 
      success: true, 
      deletedCount: result.count,
      message: `${result.count} location(s) deleted successfully`
    })
  } catch (error: unknown) {
    const prismaError = error as { code?: string; message?: string }
    
    // Handle database connection errors - expected error, don't log
    if (prismaError?.code === 'P1001' || prismaError?.code === 'P2024') {
      return NextResponse.json(
        { error: 'Database connection limit reached. Please try again in a moment.' },
        { status: 503 }
      )
    }

    // Only log unexpected errors
    console.error('Unexpected error bulk deleting locations:', error)
    return NextResponse.json(
      { error: 'Failed to delete locations' },
      { status: 500 }
    )
  }
}

