import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'

// GET - Get all checkout records for an asset
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canViewAssets')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const { id } = await params

    // Verify asset exists
    const asset = await prisma.assets.findUnique({
      where: { id },
    })

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      )
    }

    const checkouts = await prisma.assetsCheckout.findMany({
      where: {
        assetId: id,
      },
      include: {
        employeeUser: true,
        checkins: {
          orderBy: { checkinDate: 'desc' },
          take: 1,
        },
      },
      orderBy: {
        checkoutDate: 'desc',
      },
    })

    return NextResponse.json({ checkouts })
  } catch (error) {
    console.error('Error fetching checkout records:', error)
    return NextResponse.json(
      { error: 'Failed to fetch checkout records' },
      { status: 500 }
    )
  }
}

