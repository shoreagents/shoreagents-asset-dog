import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canViewAssets')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const { searchParams } = new URL(request.url)
    const groupBy = searchParams.get('groupBy') || 'category'

    let result: Array<{ name: string; value: number }> = []

    switch (groupBy) {
      case 'category': {
        const assetsByCategoryRaw = await prisma.assets.groupBy({
          by: ['categoryId'],
          where: {
            isDeleted: false,
            cost: { not: null },
          },
          _sum: {
            cost: true,
          },
          orderBy: {
            _sum: {
              cost: 'desc',
            },
          },
        })

        const categories = await prisma.category.findMany({
          select: {
            id: true,
            name: true,
          },
        })

        const categoryMap = new Map(categories.map((cat) => [cat.id, cat.name]))
        result = assetsByCategoryRaw.map((row) => ({
          name: row.categoryId ? (categoryMap.get(row.categoryId) || 'Uncategorized') : 'Uncategorized',
          value: row._sum.cost ? Number(row._sum.cost) : 0,
        }))
        break
      }

      case 'status': {
        const assetsByStatusRaw = await prisma.assets.groupBy({
          by: ['status'],
          where: {
            isDeleted: false,
            cost: { not: null },
            status: { not: null },
          },
          _sum: {
            cost: true,
          },
          orderBy: {
            _sum: {
              cost: 'desc',
            },
          },
        })

        result = assetsByStatusRaw
          .filter((row) => row.status) // Filter out null/empty statuses
          .map((row) => ({
            name: row.status || 'Unknown',
            value: row._sum.cost ? Number(row._sum.cost) : 0,
          }))
        break
      }

      case 'location': {
        const assetsByLocationRaw = await prisma.assets.groupBy({
          by: ['location'],
          where: {
            isDeleted: false,
            cost: { not: null },
            location: { not: null },
          },
          _sum: {
            cost: true,
          },
          orderBy: {
            _sum: {
              cost: 'desc',
            },
          },
        })

        result = assetsByLocationRaw
          .filter((row) => row.location && row.location.trim() !== '') // Filter out null/empty locations
          .map((row) => ({
            name: row.location || 'Unknown',
            value: row._sum.cost ? Number(row._sum.cost) : 0,
          }))
        break
      }

      case 'department': {
        const assetsByDepartmentRaw = await prisma.assets.groupBy({
          by: ['department'],
          where: {
            isDeleted: false,
            cost: { not: null },
            department: { not: null },
          },
          _sum: {
            cost: true,
          },
          orderBy: {
            _sum: {
              cost: 'desc',
            },
          },
        })

        result = assetsByDepartmentRaw
          .filter((row) => row.department && row.department.trim() !== '') // Filter out null/empty departments
          .map((row) => ({
            name: row.department || 'Unknown',
            value: row._sum.cost ? Number(row._sum.cost) : 0,
          }))
        break
      }

      case 'site': {
        const assetsBySiteRaw = await prisma.assets.groupBy({
          by: ['site'],
          where: {
            isDeleted: false,
            cost: { not: null },
            site: { not: null },
          },
          _sum: {
            cost: true,
          },
          orderBy: {
            _sum: {
              cost: 'desc',
            },
          },
        })

        result = assetsBySiteRaw
          .filter((row) => row.site && row.site.trim() !== '') // Filter out null/empty sites
          .map((row) => ({
            name: row.site || 'Unknown',
            value: row._sum.cost ? Number(row._sum.cost) : 0,
          }))
        break
      }

      default:
        return NextResponse.json(
          { error: 'Invalid groupBy parameter. Must be one of: category, status, location, department, site' },
          { status: 400 }
        )
    }

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Error fetching grouped asset values:', error)
    return NextResponse.json(
      { error: 'Failed to fetch grouped asset values' },
      { status: 500 }
    )
  }
}

