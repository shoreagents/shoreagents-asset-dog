import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canManageCategories')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const body = await request.json()
    const { id } = await params

    const subcategory = await prisma.subCategory.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        categoryId: body.categoryId,
      },
      include: {
        category: true,
      },
    })

    return NextResponse.json({ subcategory })
  } catch (error) {
    console.error('Error updating subcategory:', error)
    return NextResponse.json(
      { error: 'Failed to update subcategory' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canManageCategories')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const { id } = await params

    // Check if subcategory has associated assets
    const subcategory = await prisma.subCategory.findUnique({
      where: { id },
      include: {
        assets: true,
      },
    })

    if (!subcategory) {
      return NextResponse.json(
        { error: 'Subcategory not found' },
        { status: 404 }
      )
    }

    if (subcategory.assets.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete subcategory with associated assets. Please reassign or delete assets first.' },
        { status: 400 }
      )
    }

    await prisma.subCategory.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting subcategory:', error)
    return NextResponse.json(
      { error: 'Failed to delete subcategory' },
      { status: 500 }
    )
  }
}

