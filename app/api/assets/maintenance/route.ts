import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseDate } from '@/lib/date-utils'
import { verifyAuth } from '@/lib/auth-utils'
import { retryDbOperation } from '@/lib/db-utils'
import { requirePermission } from '@/lib/permission-utils'

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canManageMaintenance')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const assetId = searchParams.get('assetId')

    const where: Record<string, unknown> = {}
    if (status) {
      where.status = status
    }
    if (assetId) {
      where.assetId = assetId
    }

    const maintenances = await retryDbOperation(() =>
      prisma.assetsMaintenance.findMany({
        where,
        include: {
          asset: {
            select: {
              id: true,
              assetTagId: true,
              description: true,
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
              subCategory: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
    )

    return NextResponse.json({ maintenances })
  } catch (error) {
    console.error('Error fetching maintenances:', error)
    return NextResponse.json(
      { error: 'Failed to fetch maintenances' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canManageMaintenance')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const body = await request.json()
    const {
      assetId,
      title,
      details,
      dueDate,
      maintenanceBy,
      status,
      dateCompleted,
      dateCancelled,
      cost,
      isRepeating,
    } = body

    if (!assetId) {
      return NextResponse.json(
        { error: 'Asset ID is required' },
        { status: 400 }
      )
    }

    if (!title) {
      return NextResponse.json(
        { error: 'Maintenance title is required' },
        { status: 400 }
      )
    }

    if (!status) {
      return NextResponse.json(
        { error: 'Maintenance status is required' },
        { status: 400 }
      )
    }

    // Validate status-specific fields
    if (status === 'Completed' && !dateCompleted) {
      return NextResponse.json(
        { error: 'Date completed is required when status is Completed' },
        { status: 400 }
      )
    }

    if (status === 'Cancelled' && !dateCancelled) {
      return NextResponse.json(
        { error: 'Date cancelled is required when status is Cancelled' },
        { status: 400 }
      )
    }

    // Check if asset exists
    const asset = await prisma.assets.findUnique({
      where: { id: assetId },
    })

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      )
    }

    // Create maintenance record and update asset status in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create maintenance record
      const maintenance = await tx.assetsMaintenance.create({
        data: {
          assetId,
          title,
          details: details || null,
          dueDate: dueDate ? parseDate(dueDate) : null,
          maintenanceBy: maintenanceBy || null,
          status,
          dateCompleted: dateCompleted ? parseDate(dateCompleted) : null,
          dateCancelled: dateCancelled ? parseDate(dateCancelled) : null,
          cost: cost ? parseFloat(cost.toString()) : null,
          isRepeating: isRepeating || false,
        },
        include: {
          asset: {
            select: {
              id: true,
              assetTagId: true,
              description: true,
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
              subCategory: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      })

      // Update asset status based on maintenance status
      let newAssetStatus: string | null = null
      if (status === 'Completed' || status === 'Cancelled') {
        newAssetStatus = 'Available'
      } else if (status === 'Scheduled' || status === 'In progress') {
        newAssetStatus = 'Maintenance'
      }

      if (newAssetStatus !== null) {
        await tx.assets.update({
          where: { id: assetId },
          data: { status: newAssetStatus },
        })
      }

      return maintenance
    })

    return NextResponse.json({
      success: true,
      maintenance: result,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create maintenance'
    console.error('Error creating maintenance:', error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canManageMaintenance')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const body = await request.json()
    const {
      id,
      title,
      details,
      dueDate,
      maintenanceBy,
      status,
      dateCompleted,
      dateCancelled,
      cost,
      isRepeating,
    } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Maintenance ID is required' },
        { status: 400 }
      )
    }

    // Get current maintenance to find assetId
    const currentMaintenance = await prisma.assetsMaintenance.findUnique({
      where: { id },
      select: { assetId: true },
    })

    if (!currentMaintenance) {
      return NextResponse.json(
        { error: 'Maintenance not found' },
        { status: 404 }
      )
    }

    // Validate status-specific fields
    if (status === 'Completed' && !dateCompleted) {
      return NextResponse.json(
        { error: 'Date completed is required when status is Completed' },
        { status: 400 }
      )
    }

    if (status === 'Cancelled' && !dateCancelled) {
      return NextResponse.json(
        { error: 'Date cancelled is required when status is Cancelled' },
        { status: 400 }
      )
    }

    // Update maintenance record and asset status in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update maintenance record
      const updateData: Record<string, unknown> = {}
      if (title !== undefined) updateData.title = title
      if (details !== undefined) updateData.details = details || null
      if (dueDate !== undefined) updateData.dueDate = dueDate ? parseDate(dueDate) : null
      if (maintenanceBy !== undefined) updateData.maintenanceBy = maintenanceBy || null
      if (status !== undefined) updateData.status = status
      if (dateCompleted !== undefined) updateData.dateCompleted = dateCompleted ? parseDate(dateCompleted) : null
      if (dateCancelled !== undefined) updateData.dateCancelled = dateCancelled ? parseDate(dateCancelled) : null
      if (cost !== undefined) updateData.cost = cost ? parseFloat(cost.toString()) : null
      if (isRepeating !== undefined) updateData.isRepeating = isRepeating

      const maintenance = await tx.assetsMaintenance.update({
        where: { id },
        data: updateData,
        include: {
          asset: {
            select: {
              id: true,
              assetTagId: true,
              description: true,
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
              subCategory: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      })

      // Update asset status based on maintenance status
      if (status !== undefined) {
        let newAssetStatus: string | null = null
        if (status === 'Completed' || status === 'Cancelled') {
          newAssetStatus = 'Available'
        } else if (status === 'Scheduled' || status === 'In progress') {
          newAssetStatus = 'Maintenance'
        }

        if (newAssetStatus !== null) {
          await tx.assets.update({
            where: { id: currentMaintenance.assetId },
            data: { status: newAssetStatus },
          })
        }
      }

      return maintenance
    })

    return NextResponse.json({
      success: true,
      maintenance: result,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update maintenance'
    console.error('Error updating maintenance:', error)
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

