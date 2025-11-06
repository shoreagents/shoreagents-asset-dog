import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assetTagId: string }> }
) {
  try {
    // Check authentication
    const auth = await verifyAuth()
    if (auth.error || !auth.user) {
      return auth.error || NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check view permission
    const permissionCheck = await requirePermission('canViewAssets')
    if (!permissionCheck.allowed) return permissionCheck.error

    const { assetTagId } = await params

    if (!assetTagId) {
      return NextResponse.json(
        { error: 'Asset Tag ID is required' },
        { status: 400 }
      )
    }

    // Fetch images for the asset
    // Using 'as any' temporarily until Prisma client is regenerated after schema changes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const images = await (prisma as any).assetsImage.findMany({
      where: {
        assetTagId: assetTagId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ images })
  } catch (error) {
    console.error('Error fetching asset images:', error)
    return NextResponse.json(
      { error: 'Failed to fetch asset images' },
      { status: 500 }
    )
  }
}

