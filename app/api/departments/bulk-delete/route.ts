import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { retryDbOperation } from '@/lib/db-utils'
import { clearCache } from '@/lib/cache-utils'

export async function DELETE(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canManageSetup')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const body = await request.json()
    const { ids } = body

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request. Expected an array of department IDs.' },
        { status: 400 }
      )
    }

    // Check which departments have associated assets
    const departments = await retryDbOperation(() =>
      prisma.assetsDepartment.findMany({
        where: {
          id: {
            in: ids
          }
        },
        select: {
          id: true,
          name: true,
        }
      })
    )

    const departmentsWithAssets: string[] = []
    const departmentsToDelete: string[] = []

    // Check each department for associated assets
    for (const department of departments) {
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
        departmentsWithAssets.push(department.name)
      } else {
        departmentsToDelete.push(department.id)
      }
    }

    // If any departments have associated assets, return error
    if (departmentsWithAssets.length > 0) {
      return NextResponse.json(
        { 
          error: `Cannot delete department(s) with associated assets: ${departmentsWithAssets.join(', ')}. Please reassign or delete assets first.`,
          departmentsWithAssets 
        },
        { status: 400 }
      )
    }

    // Delete all departments that don't have associated assets
    const result = await retryDbOperation(() =>
      prisma.assetsDepartment.deleteMany({
        where: {
          id: {
            in: departmentsToDelete
          }
        }
      })
    )

    // Invalidate departments cache
    await clearCache('departments-list')

    return NextResponse.json({ 
      success: true, 
      deletedCount: result.count,
      message: `${result.count} department(s) deleted successfully`
    })
  } catch (error: unknown) {
    const prismaError = error as { code?: string; message?: string }
    
    // Handle database connection errors - expected error, don't log
    if (prismaError?.code === 'P1001' || prismaError?.code === 'P2024') {
      return NextResponse.json(
        { error: 'Database connection limit reached. Please try again in a moment.' },
        { status: 503 }
      )
    }

    // Only log unexpected errors
    console.error('Unexpected error bulk deleting departments:', error)
    return NextResponse.json(
      { error: 'Failed to delete departments' },
      { status: 500 }
    )
  }
}

