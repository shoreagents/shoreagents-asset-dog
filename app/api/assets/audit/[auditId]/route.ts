import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'

// DELETE - Delete an audit record
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ auditId: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canAudit')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const { auditId } = await params
    await prisma.assetsAuditHistory.delete({
      where: {
        id: auditId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting audit record:', error)
    return NextResponse.json(
      { error: 'Failed to delete audit record' },
      { status: 500 }
    )
  }
}

// PATCH - Update an audit record
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ auditId: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  try {
    const { auditId } = await params
    const body = await request.json()

    const audit = await prisma.assetsAuditHistory.update({
      where: {
        id: auditId,
      },
      data: {
        auditType: body.auditType,
        auditDate: body.auditDate ? new Date(body.auditDate) : undefined,
        notes: body.notes,
        auditor: body.auditor,
        status: body.status,
      },
    })

    return NextResponse.json({ audit })
  } catch (error) {
    console.error('Error updating audit record:', error)
    return NextResponse.json(
      { error: 'Failed to update audit record' },
      { status: 500 }
    )
  }
}

