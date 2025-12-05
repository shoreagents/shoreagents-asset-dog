import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requireAdmin } from '@/lib/permission-utils'
import { retryDbOperation } from '@/lib/db-utils'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const adminCheck = await requireAdmin()
  if (!adminCheck.allowed && adminCheck.error) {
    return adminCheck.error
  }

  try {
    const { id } = await params

    await retryDbOperation(() =>
      prisma.assetsHistoryLogs.delete({
        where: { id },
      })
    )

    return NextResponse.json({
      success: true,
      message: 'Event deleted successfully',
    })
  } catch (error: unknown) {
    const prismaError = error as { code?: string; message?: string }
    if (prismaError?.code === 'P1001' || prismaError?.code === 'P2024') {
      return NextResponse.json(
        { error: 'Database connection limit reached. Please try again in a moment.' },
        { status: 503 }
      )
    }
    if (prismaError?.code === 'P2025') {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }
    console.error('Error deleting asset event:', error)
    return NextResponse.json(
      { error: 'Failed to delete asset event' },
      { status: 500 }
    )
  }
}

