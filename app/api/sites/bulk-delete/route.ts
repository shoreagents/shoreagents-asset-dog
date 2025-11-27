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
        { error: 'Invalid request. Expected an array of site IDs.' },
        { status: 400 }
      )
    }

    // Check which sites have associated assets
    const sites = await retryDbOperation(() =>
      prisma.assetsSite.findMany({
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

    const sitesWithAssets: string[] = []
    const sitesToDelete: string[] = []

    // Check each site for associated assets
    for (const site of sites) {
      const assetsWithSite = await retryDbOperation(() =>
        prisma.assets.findMany({
          where: {
            site: site.name,
            isDeleted: false,
          },
          take: 1,
        })
      )

      if (assetsWithSite.length > 0) {
        sitesWithAssets.push(site.name)
      } else {
        sitesToDelete.push(site.id)
      }
    }

    // If any sites have associated assets, return error
    if (sitesWithAssets.length > 0) {
      return NextResponse.json(
        { 
          error: `Cannot delete site(s) with associated assets: ${sitesWithAssets.join(', ')}. Please reassign or delete assets first.`,
          sitesWithAssets 
        },
        { status: 400 }
      )
    }

    // Delete all sites that don't have associated assets
    const result = await retryDbOperation(() =>
      prisma.assetsSite.deleteMany({
        where: {
          id: {
            in: sitesToDelete
          }
        }
      })
    )

    // Invalidate sites cache
    await clearCache('sites-list')

    return NextResponse.json({ 
      success: true, 
      deletedCount: result.count,
      message: `${result.count} site(s) deleted successfully`
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
    console.error('Unexpected error bulk deleting sites:', error)
    return NextResponse.json(
      { error: 'Failed to delete sites' },
      { status: 500 }
    )
  }
}

