import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'

// DELETE - Delete a history log record
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // Check delete permission (using canDeleteAssets as history logs are part of asset management)
  const permissionCheck = await requirePermission('canDeleteAssets')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const { id } = await params
    
    // Check if history log record exists
    const historyLog = await prisma.assetsHistoryLogs.findUnique({
      where: { id },
    })

    if (!historyLog) {
      return NextResponse.json(
        { error: 'History log record not found' },
        { status: 404 }
      )
    }

    // Delete the history log record
    await prisma.assetsHistoryLogs.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting history log record:', error)
    return NextResponse.json(
      { error: 'Failed to delete history log record' },
      { status: 500 }
    )
  }
}

