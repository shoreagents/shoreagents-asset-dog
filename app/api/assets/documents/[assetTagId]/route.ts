import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { retryDbOperation } from '@/lib/db-utils'

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

    // Fetch documents for the asset with retry logic
    // Using 'as any' temporarily until Prisma client is regenerated after schema changes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const documents = await retryDbOperation(() => (prisma as any).assetsDocument.findMany({
      where: {
        assetTagId: assetTagId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    }))

    return NextResponse.json({ documents })
  } catch (error: unknown) {
    const prismaError = error as { code?: string; message?: string }
    if (prismaError?.code === 'P1001' || prismaError?.code === 'P2024') {
      return NextResponse.json(
        { error: 'Database connection limit reached. Please try again in a moment.' },
        { status: 503 }
      )
    }
    console.error('Error fetching asset documents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch asset documents' },
      { status: 500 }
    )
  }
}


