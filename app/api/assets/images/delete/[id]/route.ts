import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // Check edit permission
    const permissionCheck = await requirePermission('canEditAssets')
    if (!permissionCheck.allowed) return permissionCheck.error

    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Image ID is required' },
        { status: 400 }
      )
    }

    // Check if image exists first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingImage = await (prisma as any).assetsImage.findUnique({
      where: {
        id: id,
      },
    })

    if (!existingImage) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      )
    }

    // Delete image from database only (keep file in bucket)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).assetsImage.delete({
      where: {
        id: id,
      },
    })

    return NextResponse.json({ success: true, message: 'Image deleted from database' })
  } catch (error: any) {
    console.error('Error deleting image:', error)
    
    // Handle Prisma record not found error
    if (error?.code === 'P2025') {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    )
  }
}

