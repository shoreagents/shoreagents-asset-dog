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
    const includeAssetList = searchParams.get('includeAssetList') === 'true'

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
    let exportData: any[] | { summary: any[]; assetList: any[] } = []

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
      // Summary report
      // Calculate totals and groups (needed for both summary and when including asset list)
      const totalAssets = assets.length
      const totalValue = assets.reduce((sum, asset) => sum + (Number(asset.cost) || 0), 0)
      
      // Group by status
      const statusGroups = new Map<string, { count: number; totalValue: number }>()
      assets.forEach((asset) => {
        const statusKey = asset.status || 'Unknown'
        if (!statusGroups.has(statusKey)) {
          statusGroups.set(statusKey, { count: 0, totalValue: 0 })
        }
        const group = statusGroups.get(statusKey)!
        group.count++
        group.totalValue += Number(asset.cost) || 0
      })
      
      // Group by category
      const categoryGroups = new Map<string, { count: number; totalValue: number }>()
      assets.forEach((asset) => {
        const categoryKey = asset.category?.name || 'Uncategorized'
        if (!categoryGroups.has(categoryKey)) {
          categoryGroups.set(categoryKey, { count: 0, totalValue: 0 })
        }
        const group = categoryGroups.get(categoryKey)!
        group.count++
        group.totalValue += Number(asset.cost) || 0
      })
      
      // Build summary statistics data
      const summaryData = [
        // Summary row
        {
          'Metric': 'Total Assets',
          'Value': totalAssets.toString(),
          'Total Value': totalValue.toFixed(2),
          'Average Value': totalAssets > 0 ? (totalValue / totalAssets).toFixed(2) : '0.00',
          'Percentage': '100%',
        },
        // Separator
        {
          'Metric': '---',
          'Value': '---',
          'Total Value': '---',
          'Average Value': '---',
          'Percentage': '---',
        },
        // Assets by Status
        {
          'Metric': 'ASSETS BY STATUS',
          'Value': '',
          'Total Value': '',
          'Average Value': '',
          'Percentage': '',
        },
        ...Array.from(statusGroups.entries()).map(([status, data]) => ({
          'Metric': `Status: ${status}`,
          'Value': data.count.toString(),
          'Total Value': data.totalValue.toFixed(2),
          'Average Value': (data.totalValue / data.count).toFixed(2),
          'Percentage': totalAssets > 0 ? ((data.count / totalAssets) * 100).toFixed(1) + '%' : '0%',
        })),
        // Separator
        {
          'Metric': '---',
          'Value': '---',
          'Total Value': '---',
          'Average Value': '---',
          'Percentage': '---',
        },
        // Assets by Category
        {
          'Metric': 'ASSETS BY CATEGORY',
          'Value': '',
          'Total Value': '',
          'Average Value': '',
          'Percentage': '',
        },
        ...Array.from(categoryGroups.entries()).map(([category, data]) => ({
          'Metric': `Category: ${category}`,
          'Value': data.count.toString(),
          'Total Value': data.totalValue.toFixed(2),
          'Average Value': (data.totalValue / data.count).toFixed(2),
          'Percentage': totalAssets > 0 ? ((data.count / totalAssets) * 100).toFixed(1) + '%' : '0%',
        })),
      ]
      
      if (includeAssetList) {
        // Full asset export with all fields + summary
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const assetListData = assets.map((asset: any) => ({
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
        
        // Store summary and asset list separately
        // For Excel: we'll create multiple sheets
        // For CSV: we'll handle it in the CSV generation section
        exportData = { summary: summaryData, assetList: assetListData }
      } else {
        // Summary statistics only
        exportData = summaryData
      }
    }

    const reportTypeLabel = reportType === 'status' ? 'Status' : reportType === 'category' ? 'Category' : 'Summary'

    if (format === 'csv') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let csvData: any[] = []
      
      // Handle summary report with asset list
      if (reportType === 'summary' && includeAssetList && typeof exportData === 'object' && !Array.isArray(exportData)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const summaryData = (exportData as { summary: any[]; assetList: any[] }).summary
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const assetListData = (exportData as { summary: any[]; assetList: any[] }).assetList
        
        // First, output summary section
        const summaryHeaders = Object.keys(summaryData[0] || {})
        const summaryRows = [
          '=== SUMMARY STATISTICS ===',
          summaryHeaders.join(','),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...summaryData.map((row: any) =>
            summaryHeaders.map(header => {
              const value = row[header]
              const stringValue = String(value || '')
              if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                return `"${stringValue.replace(/"/g, '""')}"`
              }
              return stringValue
            }).join(',')
          ),
          '',
          '=== ASSET LIST ===',
        ]
        
        // Then, output asset list section
        const assetHeaders = Object.keys(assetListData[0] || {})
        const assetRows = [
          assetHeaders.join(','),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...assetListData.map((row: any) =>
            assetHeaders.map(header => {
              const value = row[header]
              const stringValue = String(value || '')
              if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                return `"${stringValue.replace(/"/g, '""')}"`
              }
              return stringValue
            }).join(',')
          ),
        ]
        
        const csv = [...summaryRows, ...assetRows].join('\n')
        
        const filename = `asset-report-${reportType}-${new Date().toISOString().split('T')[0]}.csv`
        
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${filename}"`,
          },
        })
      }
      
      // Check if we have data to export
      if (Array.isArray(exportData) && exportData.length === 0) {
        return NextResponse.json(
          { error: 'No data to export' },
          { status: 400 }
        )
      }
      
      csvData = Array.isArray(exportData) ? exportData : []
      
      // Generate CSV
      const headers = Object.keys(csvData[0] || {})
      const csvRows = [
        headers.join(','),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...csvData.map((row: any) =>
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
      const wb = XLSX.utils.book_new()
      
      if (reportType === 'summary' && includeAssetList && typeof exportData === 'object' && !Array.isArray(exportData)) {
        // Multiple sheets: Summary, Assets by Status, Assets by Category, Asset List
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const summaryData = (exportData as { summary: any[]; assetList: any[] }).summary
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const assetListData = (exportData as { summary: any[]; assetList: any[] }).assetList
        
        // Summary sheet
        const summaryWs = XLSX.utils.json_to_sheet(summaryData)
        XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')
        
        // Assets by Status sheet
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const statusData = summaryData.filter((row: any) => 
          row.Metric && row.Metric.startsWith('Status:')
        )
        if (statusData.length > 0) {
          const statusWs = XLSX.utils.json_to_sheet(statusData)
          XLSX.utils.book_append_sheet(wb, statusWs, 'By Status')
        }
        
        // Assets by Category sheet
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const categoryData = summaryData.filter((row: any) => 
          row.Metric && row.Metric.startsWith('Category:')
        )
        if (categoryData.length > 0) {
          const categoryWs = XLSX.utils.json_to_sheet(categoryData)
          XLSX.utils.book_append_sheet(wb, categoryWs, 'By Category')
        }
        
        // Asset List sheet
        const assetListWs = XLSX.utils.json_to_sheet(assetListData)
        XLSX.utils.book_append_sheet(wb, assetListWs, 'Asset List')
      } else {
        // Single sheet export
        const dataArray = Array.isArray(exportData) ? exportData : []
        if (dataArray.length === 0) {
          return NextResponse.json(
            { error: 'No data to export' },
            { status: 400 }
          )
        }
        const ws = XLSX.utils.json_to_sheet(dataArray)
        const sheetName = `Assets by ${reportTypeLabel}`
        XLSX.utils.book_append_sheet(wb, ws, sheetName)
      }

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

