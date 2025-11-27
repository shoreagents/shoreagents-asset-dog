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

  const permissionCheck = await requirePermission('canManageSetup')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const body = await request.json()
    const { id } = await params

    const category = await prisma.category.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
      },
      include: {
        subCategories: true,
      },
    })

    return NextResponse.json({ category })
  } catch (error: unknown) {
    const prismaError = error as { code?: string; message?: string }
    
    // Handle duplicate name error - expected error, don't log
    if (prismaError?.code === 'P2002') {
      return NextResponse.json(
        { error: 'A category with this name already exists' },
        { status: 409 }
      )
    }
    
    // Handle connection pool errors - expected error, don't log
    if (prismaError?.code === 'P1001' || prismaError?.code === 'P2024') {
      return NextResponse.json(
        { error: 'Database connection limit reached. Please try again in a moment.' },
        { status: 503 }
      )
    }
    
    // Only log unexpected errors
    console.error('Unexpected error updating category:', error)
    return NextResponse.json(
      { error: 'Failed to update category' },
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

  const permissionCheck = await requirePermission('canManageSetup')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const { id } = await params

    // Check if category exists and get related data
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        subCategories: {
          include: {
            assets: true,
          },
        },
        assets: true,
      },
    })

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      )
    }

    // Check if category directly has assets
    if (category.assets.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete category with associated assets. Please reassign or delete assets first.' },
        { status: 400 }
      )
    }

    // Check if any subcategories have assets
    const subcategoriesWithAssets = category.subCategories.filter(
      (subCat) => subCat.assets.length > 0
    )

    if (subcategoriesWithAssets.length > 0) {
      const subcategoryNames = subcategoriesWithAssets.map((sc) => sc.name).join(', ')
      return NextResponse.json(
        {
          error: `Cannot delete category. The following subcategor${subcategoriesWithAssets.length === 1 ? 'y has' : 'ies have'} associated assets: ${subcategoryNames}. Please reassign or delete those assets first.`,
        },
        { status: 400 }
      )
    }

    // Delete category (Prisma will cascade delete subcategories automatically)
    await prisma.category.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting category:', error)
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 }
    )
  }
}

