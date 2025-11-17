import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'

export async function DELETE() {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canManageTrash')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    // Permanently delete all soft-deleted assets
    const result = await prisma.assets.deleteMany({
      where: {
        isDeleted: true,
      },
    })

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      message: `${result.count} asset(s) permanently deleted`,
    })
  } catch (error) {
    console.error('Error emptying trash:', error)
    return NextResponse.json(
      { error: 'Failed to empty trash' },
      { status: 500 }
    )
  }
}

