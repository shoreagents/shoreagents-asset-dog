import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseDate } from '@/lib/date-utils'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'

export async function POST(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  const permissionCheck = await requirePermission('canDispose')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const body = await request.json()
    const { assetIds, disposeDate, disposeReason, disposeReasonText, disposeValue, updates } = body

    if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
      return NextResponse.json(
        { error: 'Asset IDs are required' },
        { status: 400 }
      )
    }

    if (!disposeDate) {
      return NextResponse.json(
        { error: 'Dispose date is required' },
        { status: 400 }
      )
    }

    // disposeReason now represents the disposal method (Sold, Donated, etc.)
    const disposalMethod = disposeReason
    if (!disposalMethod) {
      return NextResponse.json(
        { error: 'Disposal method is required' },
        { status: 400 }
      )
    }

    // Validate dispose value if method is "Sold"
    if (disposalMethod === 'Sold') {
      // Check if at least one dispose value is provided (common or per-asset)
      const hasCommonValue = disposeValue && parseFloat(disposeValue.toString()) > 0
      const hasPerAssetValues = updates && Object.values(updates).some(
        (update: any) => update.disposeValue && parseFloat(update.disposeValue.toString()) > 0
      )
      
      if (!hasCommonValue && !hasPerAssetValues) {
        return NextResponse.json(
          { error: 'Dispose value is required for Sold assets' },
          { status: 400 }
        )
      }
    }

    // Process disposals in a transaction
    const results = await prisma.$transaction(async (tx) => {
      const disposeResults = []

      for (const assetId of assetIds) {
        // Check if asset exists and is not already disposed
        const asset = await tx.assets.findUnique({
          where: { id: assetId },
        })

        if (!asset) {
          throw new Error(`Asset ${assetId} not found`)
        }

        if (asset.status === 'Disposed') {
          throw new Error(`Asset ${assetId} is already disposed`)
        }

        // Get update data for this asset (notes)
        const assetUpdate = updates?.[assetId] || {}
        const disposeValueForAsset = updates?.[assetId]?.disposeValue || disposeValue

        // Create disposal record
        const disposal = await tx.assetsDispose.create({
          data: {
            assetId,
            disposeDate: parseDate(disposeDate)!,
            disposalMethod,
            disposeReason: disposeReasonText || null,
            disposeValue: disposalMethod === 'Sold' && disposeValueForAsset ? parseFloat(disposeValueForAsset.toString()) : null,
            notes: assetUpdate.notes || null,
          },
          include: {
            asset: {
              select: {
                id: true,
                assetTagId: true,
                description: true,
              },
            },
          },
        })

        // Update asset status to the disposal method (e.g., "Sold", "Donated", "Scrapped", "Lost/Missing", "Destroyed")
        await tx.assets.update({
          where: { id: assetId },
          data: {
            status: disposalMethod,
          },
        })

        disposeResults.push(disposal)
      }

      return disposeResults
    })

    return NextResponse.json({
      success: true,
      disposals: results,
    })
  } catch (error: any) {
    console.error('Error disposing assets:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to dispose assets' },
      { status: 500 }
    )
  }
}

