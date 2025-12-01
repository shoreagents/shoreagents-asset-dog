import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth-utils'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  try {
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'csv'
    const location = searchParams.get('location')
    const site = searchParams.get('site')
    const category = searchParams.get('category')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const includeAssetList = searchParams.get('includeAssetList') === 'true'

    // Build query params for the location report API
    const params = new URLSearchParams()
    if (location) params.set('location', location)
    if (site) params.set('site', site)
    if (category) params.set('category', category)
    if (status) params.set('status', status)
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    // If including asset list, fetch all assets (not just current page)
    if (includeAssetList) {
      params.set('pageSize', '10000')
    }

    // Fetch location report data
    const baseUrl = request.nextUrl.origin
    const response = await fetch(`${baseUrl}/api/reports/location?${params.toString()}`, {
      headers: {
        'Cookie': request.headers.get('cookie') || '',
      },
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch location data')
    }

    const data = await response.json()
    const assets = data.assets || []
    const summary = data.summary || {}

    // Prepare summary statistics
    // All rows need consistent columns for proper CSV/Excel export
    const summaryData = [
      {
        'Metric': 'Total Assets',
        'Value': summary.totalAssets?.toString() || '0',
        'Total Value': '',
        'Location Count': '',
        'Average Value': '',
        'Utilization %': '',
      },
      {
        'Metric': 'Total Locations',
        'Value': summary.totalLocations?.toString() || '0',
        'Total Value': '',
        'Location Count': '',
        'Average Value': '',
        'Utilization %': '',
      },
      {
        'Metric': 'Total Sites',
        'Value': summary.totalSites?.toString() || '0',
        'Total Value': '',
        'Location Count': '',
        'Average Value': '',
        'Utilization %': '',
      },
      {
        'Metric': '---',
        'Value': '---',
        'Total Value': '---',
        'Location Count': '---',
        'Average Value': '---',
        'Utilization %': '---',
      },
      {
        'Metric': 'ASSETS BY LOCATION',
        'Value': '',
        'Total Value': '',
        'Location Count': '',
        'Average Value': '',
        'Utilization %': '',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(summary.byLocation || []).map((loc: any) => ({
        'Metric': `Location: ${loc.location || 'Unknown'}`,
        'Value': loc.assetCount?.toString() || '0',
        'Total Value': loc.totalValue?.toString() || '0',
        'Location Count': '',
        'Average Value': loc.averageValue?.toFixed(2) || '0',
        'Utilization %': `${loc.utilizationPercentage?.toFixed(1) || '0'}%`,
      })),
      {
        'Metric': '---',
        'Value': '---',
        'Total Value': '---',
        'Location Count': '---',
        'Average Value': '---',
        'Utilization %': '---',
      },
      {
        'Metric': 'ASSETS BY SITE',
        'Value': '',
        'Total Value': '',
        'Location Count': '',
        'Average Value': '',
        'Utilization %': '',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(summary.bySite || []).map((site: any) => ({
        'Metric': `Site: ${site.site || 'Unknown'}`,
        'Value': site.assetCount?.toString() || '0',
        'Total Value': site.totalValue?.toString() || '0',
        'Location Count': site.locationCount?.toString() || '0',
        'Average Value': site.averageValue?.toFixed(2) || '0',
        'Utilization %': `${site.utilizationPercentage?.toFixed(1) || '0'}%`,
      })),
    ]

    // Prepare asset list data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const assetListData: any[] = assets.map((asset: any) => ({
      'Asset Tag ID': asset.assetTagId || '',
      'Description': asset.description || '',
      'Status': asset.status || '',
      'Cost': asset.cost?.toString() || '',
      'Category': asset.category || '',
      'Location': asset.location || '',
      'Site': asset.site || '',
      'Department': asset.department || '',
      'Last Move Date': asset.lastMoveDate || '',
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let exportData: any[] | { summary: any[]; assetList: any[] } = []

    if (includeAssetList) {
      // Store summary and asset list separately
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      exportData = { summary: summaryData, assetList: assetListData } as { summary: any[]; assetList: any[] }
    } else {
      // Summary statistics only
      exportData = summaryData
    }

    if (format === 'csv') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let csvData: any[] = []
      
      // Handle location report with asset list
      if (includeAssetList && typeof exportData === 'object' && !Array.isArray(exportData)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const summaryDataForCSV = (exportData as { summary: any[]; assetList: any[] }).summary
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const assetListDataForCSV = (exportData as { summary: any[]; assetList: any[] }).assetList
        
        // First, output summary section
        const summaryHeaders = Object.keys(summaryDataForCSV[0] || {})
        const summaryRows = [
          '=== SUMMARY STATISTICS ===',
          summaryHeaders.join(','),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...summaryDataForCSV.map((row: any) =>
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
        const assetHeaders = Object.keys(assetListDataForCSV[0] || {})
        const assetRows = [
          assetHeaders.join(','),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...assetListDataForCSV.map((row: any) =>
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
        
        const filename = `location-report-${new Date().toISOString().split('T')[0]}.csv`
        
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
            const stringValue = String(value || '')
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
              return `"${stringValue.replace(/"/g, '""')}"`
            }
            return stringValue
          }).join(',')
        ),
      ]
      const csv = csvRows.join('\n')

      const filename = `location-report-${new Date().toISOString().split('T')[0]}.csv`

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    } else if (format === 'excel') {
      // Generate Excel
      const wb = XLSX.utils.book_new()
      
      if (includeAssetList && typeof exportData === 'object' && !Array.isArray(exportData)) {
        // Multiple sheets: Summary, By Location, By Site, Asset List
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const summaryDataForExcel = (exportData as { summary: any[]; assetList: any[] }).summary
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const assetListDataForExcel = (exportData as { summary: any[]; assetList: any[] }).assetList
        
        // Summary sheet
        const summaryWs = XLSX.utils.json_to_sheet(summaryDataForExcel)
        XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')
        
        // By Location sheet
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const locationData = summaryDataForExcel.filter((row: any) => 
          row.Metric && row.Metric.startsWith('Location:')
        )
        if (locationData.length > 0) {
          const locationWs = XLSX.utils.json_to_sheet(locationData)
          XLSX.utils.book_append_sheet(wb, locationWs, 'By Location')
        }
        
        // By Site sheet
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const siteData = summaryDataForExcel.filter((row: any) => 
          row.Metric && row.Metric.startsWith('Site:')
        )
        if (siteData.length > 0) {
          const siteWs = XLSX.utils.json_to_sheet(siteData)
          XLSX.utils.book_append_sheet(wb, siteWs, 'By Site')
        }
        
        // Asset List sheet
        const assetListWs = XLSX.utils.json_to_sheet(assetListDataForExcel)
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
        XLSX.utils.book_append_sheet(wb, ws, 'Location Report')
      }

      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

      const filename = `location-report-${new Date().toISOString().split('T')[0]}.xlsx`

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
    console.error('Error exporting location report:', error)
    return NextResponse.json(
      { error: 'Failed to export location report' },
      { status: 500 }
    )
  }
}

