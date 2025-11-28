import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  // Check authentication
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  try {
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'csv'
    const reportType = searchParams.get('reportType') || 'summary'
    const status = searchParams.get('status')
    const category = searchParams.get('category')
    const location = searchParams.get('location')
    const site = searchParams.get('site')
    const department = searchParams.get('department')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      isDeleted: false,
    }

    if (status) {
      where.status = status
    }
    if (category) {
      where.categoryId = category
    }
    if (location) {
      where.location = location
    }
    if (site) {
      where.site = site
    }
    if (department) {
      where.department = department
    }
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate)
      }
    }

    // Fetch assets
    const assets = await prisma.assets.findMany({
      where,
      include: {
        category: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let exportData: any[] = []

    // Prepare data based on report type
    if (reportType === 'status') {
      // Group by status with counts and values
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const statusGroups = new Map<string, { count: number; totalValue: number; assets: any[] }>()
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      assets.forEach((asset: any) => {
        const statusKey = asset.status || 'Unknown'
        if (!statusGroups.has(statusKey)) {
          statusGroups.set(statusKey, { count: 0, totalValue: 0, assets: [] })
        }
        const group = statusGroups.get(statusKey)!
        group.count++
        group.totalValue += Number(asset.cost) || 0
        group.assets.push(asset)
      })

      // Create export data
      exportData = Array.from(statusGroups.entries()).map(([status, data]) => ({
        'Status': status,
        'Asset Count': data.count.toString(),
        'Total Value': data.totalValue.toFixed(2),
        'Average Value': (data.totalValue / data.count).toFixed(2),
        'Percentage of Total': ((data.count / assets.length) * 100).toFixed(1) + '%',
      }))

      // Sort by count descending
      exportData.sort((a, b) => parseInt(b['Asset Count']) - parseInt(a['Asset Count']))

    } else if (reportType === 'category') {
      // Group by category with counts and values
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const categoryGroups = new Map<string, { count: number; totalValue: number; assets: any[] }>()
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      assets.forEach((asset: any) => {
        const categoryKey = asset.category?.name || 'Uncategorized'
        if (!categoryGroups.has(categoryKey)) {
          categoryGroups.set(categoryKey, { count: 0, totalValue: 0, assets: [] })
        }
        const group = categoryGroups.get(categoryKey)!
        group.count++
        group.totalValue += Number(asset.cost) || 0
        group.assets.push(asset)
      })

      // Create export data
      exportData = Array.from(categoryGroups.entries()).map(([category, data]) => ({
        'Category': category,
        'Asset Count': data.count.toString(),
        'Total Value': data.totalValue.toFixed(2),
        'Average Value': (data.totalValue / data.count).toFixed(2),
        'Percentage of Total': ((data.count / assets.length) * 100).toFixed(1) + '%',
      }))

      // Sort by count descending
      exportData.sort((a, b) => parseInt(b['Asset Count']) - parseInt(a['Asset Count']))

    } else {
      // Summary report - Full asset export with all fields
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      exportData = assets.map((asset: any) => ({
        'Asset Tag ID': asset.assetTagId || '',
        'Description': asset.description || '',
        'Purchased From': asset.purchasedFrom || '',
        'Purchase Date': asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : '',
        'Brand': asset.brand || '',
        'Cost': asset.cost?.toString() || '',
        'Model': asset.model || '',
        'Serial No': asset.serialNo || '',
        'Additional Information': asset.additionalInformation || '',
        'Xero Asset No.': asset.xeroAssetNo || '',
        'Owner': asset.owner || '',
        'Sub Category': asset.subCategory || '',
        'PBI Number': asset.pbiNumber || '',
        'Status': asset.status || '',
        'Issued To': asset.issuedTo || '',
        'PO Number': asset.poNumber || '',
        'Payment Voucher Number': asset.paymentVoucherNumber || '',
        'Asset Type': asset.assetType || '',
        'Delivery Date': asset.deliveryDate ? new Date(asset.deliveryDate).toISOString().split('T')[0] : '',
        'Unaccounted Inventory': asset.unaccountedInventory || '',
        'Remarks': asset.remarks || '',
        'QR': asset.qr || '',
        'Old Asset Tag': asset.oldAssetTag || '',
        'Depreciable Asset': asset.depreciableAsset || '',
        'Depreciable Cost': asset.depreciableCost?.toString() || '',
        'Salvage Value': asset.salvageValue?.toString() || '',
        'Asset Life (months)': asset.assetLifeMonths?.toString() || '',
        'Depreciation Method': asset.depreciationMethod || '',
        'Date Acquired': asset.dateAcquired ? new Date(asset.dateAcquired).toISOString().split('T')[0] : '',
        'Category': asset.category?.name || '',
        'Department': asset.department || '',
        'Site': asset.site || '',
        'Location': asset.location || '',
        'Checkout Date': asset.checkoutDate ? new Date(asset.checkoutDate).toISOString().split('T')[0] : '',
        'Expected Return Date': asset.expectedReturnDate ? new Date(asset.expectedReturnDate).toISOString().split('T')[0] : '',
        'Last Audit Date': asset.lastAuditDate ? new Date(asset.lastAuditDate).toISOString().split('T')[0] : '',
        'Last Audit Type': asset.lastAuditType || '',
        'Last Auditor': asset.lastAuditor || '',
        'Audit Count': asset.auditCount?.toString() || '0',
        'Created At': new Date(asset.createdAt).toISOString().split('T')[0],
      }))
    }

    // Check if we have data to export
    if (exportData.length === 0) {
      return NextResponse.json(
        { error: 'No data to export' },
        { status: 400 }
      )
    }

    const reportTypeLabel = reportType === 'status' ? 'Status' : reportType === 'category' ? 'Category' : 'Summary'
    const sheetName = `Assets by ${reportTypeLabel}`

    if (format === 'csv') {
      // Generate CSV
      const headers = Object.keys(exportData[0] || {})
      const csvRows = [
        headers.join(','),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...exportData.map((row: any) =>
          headers.map(header => {
            const value = row[header]
            // Escape quotes and wrap in quotes if contains comma
            const stringValue = String(value || '')
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
              return `"${stringValue.replace(/"/g, '""')}"`
            }
            return stringValue
          }).join(',')
        ),
      ]
      const csv = csvRows.join('\n')

      const filename = `asset-report-${reportType}-${new Date().toISOString().split('T')[0]}.csv`

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    } else if (format === 'excel') {
      // Generate Excel
      const ws = XLSX.utils.json_to_sheet(exportData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, sheetName)

      // Generate buffer
      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

      const filename = `asset-report-${reportType}-${new Date().toISOString().split('T')[0]}.xlsx`

      return new NextResponse(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }

    return NextResponse.json(
      { error: 'Invalid format. Use csv or excel.' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error exporting report:', error)
    return NextResponse.json(
      { error: 'Failed to export report' },
      { status: 500 }
    )
  }
}

