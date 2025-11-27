import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { retryDbOperation } from '@/lib/db-utils'

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

    const department = await retryDbOperation(() =>
      prisma.assetsDepartment.update({
        where: { id },
        data: {
          name: body.name,
          description: body.description,
        },
      })
    )

    return NextResponse.json({ department })
  } catch (error: unknown) {
    const prismaError = error as { code?: string; message?: string }
    
    // Handle duplicate name error - expected error, don't log
    if (prismaError?.code === 'P2002') {
      return NextResponse.json(
        { error: 'A department with this name already exists' },
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
    console.error('Unexpected error updating department:', error)
    return NextResponse.json(
      { error: 'Failed to update department' },
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

    // Check if department exists and has associated assets
    const department = await retryDbOperation(() =>
      prisma.assetsDepartment.findUnique({
        where: { id },
      })
    )

    if (!department) {
      return NextResponse.json(
        { error: 'Department not found' },
        { status: 404 }
      )
    }

    // Check if any assets use this department
    const assetsWithDepartment = await retryDbOperation(() =>
      prisma.assets.findMany({
        where: {
          department: department.name,
          isDeleted: false,
        },
        take: 1,
      })
    )

    if (assetsWithDepartment.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete department with associated assets. Please reassign or delete assets first.' },
        { status: 400 }
      )
    }

    // Delete department
    await retryDbOperation(() =>
      prisma.assetsDepartment.delete({
        where: { id },
      })
    )

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const prismaError = error as { code?: string; message?: string }
    
    // Handle connection pool errors - expected error, don't log
    if (prismaError?.code === 'P1001' || prismaError?.code === 'P2024') {
      return NextResponse.json(
        { error: 'Database connection limit reached. Please try again in a moment.' },
        { status: 503 }
      )
    }
    
    // Only log unexpected errors
    console.error('Unexpected error deleting department:', error)
    return NextResponse.json(
      { error: 'Failed to delete department' },
      { status: 500 }
    )
  }
}

