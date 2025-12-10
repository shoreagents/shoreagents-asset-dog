import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'

// GET - Fetch audit history for an asset
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // Allow viewing audit history with canViewAssets permission
  // Only require canAudit for creating/editing audits (POST)
  const permissionCheck = await requirePermission('canViewAssets')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const { id } = await params
    const audits = await prisma.assetsAuditHistory.findMany({
      where: {
        assetId: id,
      },
      orderBy: {
        auditDate: 'desc',
      },
    })

    return NextResponse.json({ audits })
  } catch (error) {
    console.error('Error fetching audit history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit history' },
      { status: 500 }
    )
  }
}

// POST - Create a new audit record
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canAudit')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const { id } = await params
    const body = await request.json()

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

    const audit = await prisma.assetsAuditHistory.create({
      data: {
        assetId: id,
        auditType: body.auditType,
        auditDate: new Date(body.auditDate),
        notes: body.notes || null,
        auditor: body.auditor || null,
        status: body.status || 'Completed',
      },
    })

    return NextResponse.json({ audit }, { status: 201 })
  } catch (error) {
    console.error('Error creating audit record:', error)
    return NextResponse.json(
      { error: 'Failed to create audit record' },
      { status: 500 }
    )
  }
}

