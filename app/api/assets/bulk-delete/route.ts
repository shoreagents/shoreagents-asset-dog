import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'

export async function POST(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canDeleteAssets')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const body = await request.json()
    const { ids, permanent } = body

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request. Expected an array of asset IDs.' },
        { status: 400 }
      )
    }

    if (permanent) {
      // Permanent delete (hard delete)
      const result = await prisma.assets.deleteMany({
        where: {
          id: {
            in: ids
          }
        }
      })

      return NextResponse.json({ 
        success: true, 
        deletedCount: result.count,
        message: `${result.count} asset(s) permanently deleted`
      })
    } else {
      // Soft delete
      const result = await prisma.assets.updateMany({
        where: {
          id: {
            in: ids
          }
        },
        data: {
          deletedAt: new Date(),
          isDeleted: true,
        }
      })

      return NextResponse.json({ 
        success: true, 
        deletedCount: result.count,
        message: `${result.count} asset(s) archived. They will be permanently deleted after 30 days.`
      })
    }
  } catch (error) {
    console.error('Error bulk deleting assets:', error)
    return NextResponse.json(
      { error: 'Failed to delete assets' },
      { status: 500 }
    )
  }
}

