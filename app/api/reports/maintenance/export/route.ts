import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth-utils'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  try {
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'csv'
    const status = searchParams.get('status')
    const assetId = searchParams.get('assetId')
    const category = searchParams.get('category')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const includeMaintenanceList = searchParams.get('includeMaintenanceList') === 'true'

    // Build query params for the maintenance report API
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (assetId) params.set('assetId', assetId)
    if (category) params.set('category', category)
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    // If including maintenance list, fetch all maintenances (not just current page)
    if (includeMaintenanceList) {
      params.set('pageSize', '10000')
    }

    // Fetch maintenance report data
    const baseUrl = request.nextUrl.origin
    const response = await fetch(`${baseUrl}/api/reports/maintenance?${params.toString()}`, {
      headers: {
        'Cookie': request.headers.get('cookie') || '',
      },
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch maintenance data')
    }

    const data = await response.json()
    const maintenances = data.maintenances || []
    const summary = data.summary || {}

    // Prepare summary statistics
    const summaryData = [
      {
        'Metric': 'Total Maintenances',
        'Value': summary.totalMaintenances?.toString() || '0',
        'Under Repair': summary.underRepair?.toString() || '0',
        'Upcoming': summary.upcoming?.toString() || '0',
        'Completed': summary.completed?.toString() || '0',
        'Total Cost': summary.totalCost?.toFixed(2) || '0',
        'Average Cost': summary.averageCost?.toFixed(2) || '0',
      },
      {
        'Metric': '---',
        'Value': '---',
        'Under Repair': '---',
        'Upcoming': '---',
        'Completed': '---',
        'Total Cost': '---',
        'Average Cost': '---',
      },
      {
        'Metric': 'MAINTENANCES BY STATUS',
        'Value': '',
        'Under Repair': '',
        'Upcoming': '',
        'Completed': '',
        'Total Cost': '',
        'Average Cost': '',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(summary.byStatus || []).map((statusItem: any) => ({
        'Metric': `Status: ${statusItem.status || 'Unknown'}`,
        'Value': statusItem.count?.toString() || '0',
        'Under Repair': '',
        'Upcoming': '',
        'Completed': '',
        'Total Cost': statusItem.totalCost?.toFixed(2) || '0',
        'Average Cost': statusItem.averageCost?.toFixed(2) || '0',
      })),
    ]

    // Prepare maintenance list data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const maintenanceListData: any[] = maintenances.map((maintenance: any) => ({
      'Asset Tag ID': maintenance.assetTagId || '',
      'Asset Description': maintenance.assetDescription || '',
      'Category': maintenance.category || '',
      'Asset Status': maintenance.assetStatus || '',
      'Asset Cost': maintenance.assetCost?.toString() || '',
      'Title': maintenance.title || '',
      'Details': maintenance.details || '',
      'Status': maintenance.status || '',
      'Due Date': maintenance.dueDate || '',
      'Date Completed': maintenance.dateCompleted || '',
      'Date Cancelled': maintenance.dateCancelled || '',
      'Maintenance By': maintenance.maintenanceBy || '',
      'Cost': maintenance.cost?.toString() || '',
      'Is Repeating': maintenance.isRepeating ? 'Yes' : 'No',
      'Is Overdue': maintenance.isOverdue ? 'Yes' : 'No',
      'Is Upcoming': maintenance.isUpcoming ? 'Yes' : 'No',
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let exportData: any[] | { summary: any[]; maintenanceList: any[] } = []

    if (includeMaintenanceList) {
      // Store summary and maintenance list separately
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      exportData = { summary: summaryData, maintenanceList: maintenanceListData } as { summary: any[]; maintenanceList: any[] }
    } else {
      // Summary statistics only
      exportData = summaryData
    }

    if (format === 'csv') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let csvData: any[] = []
      
      // Handle maintenance report with maintenance list
      if (includeMaintenanceList && typeof exportData === 'object' && !Array.isArray(exportData)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const summaryDataForCSV = (exportData as { summary: any[]; maintenanceList: any[] }).summary
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const maintenanceListDataForCSV = (exportData as { summary: any[]; maintenanceList: any[] }).maintenanceList
        
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
          '=== MAINTENANCE LIST ===',
        ]
        
        // Then, output maintenance list section
        const maintenanceHeaders = Object.keys(maintenanceListDataForCSV[0] || {})
        const maintenanceRows = [
          maintenanceHeaders.join(','),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...maintenanceListDataForCSV.map((row: any) =>
            maintenanceHeaders.map(header => {
              const value = row[header]
              const stringValue = String(value || '')
              if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                return `"${stringValue.replace(/"/g, '""')}"`
              }
              return stringValue
            }).join(',')
          ),
        ]
        
        const csv = [...summaryRows, ...maintenanceRows].join('\n')
        
        const filename = `maintenance-report-${new Date().toISOString().split('T')[0]}.csv`
        
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

      const filename = `maintenance-report-${new Date().toISOString().split('T')[0]}.csv`

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    } else if (format === 'excel') {
      // Generate Excel
      const wb = XLSX.utils.book_new()
      
      if (includeMaintenanceList && typeof exportData === 'object' && !Array.isArray(exportData)) {
        // Multiple sheets: Summary, By Status, Maintenance List
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const summaryDataForExcel = (exportData as { summary: any[]; maintenanceList: any[] }).summary
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const maintenanceListDataForExcel = (exportData as { summary: any[]; maintenanceList: any[] }).maintenanceList
        
        // Summary sheet
        const summaryWs = XLSX.utils.json_to_sheet(summaryDataForExcel)
        XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')
        
        // By Status sheet
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const statusData = summaryDataForExcel.filter((row: any) => 
          row.Metric && row.Metric.startsWith('Status:')
        )
        if (statusData.length > 0) {
          const statusWs = XLSX.utils.json_to_sheet(statusData)
          XLSX.utils.book_append_sheet(wb, statusWs, 'By Status')
        }
        
        // Maintenance List sheet
        const maintenanceListWs = XLSX.utils.json_to_sheet(maintenanceListDataForExcel)
        XLSX.utils.book_append_sheet(wb, maintenanceListWs, 'Maintenance List')
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
        XLSX.utils.book_append_sheet(wb, ws, 'Maintenance Report')
      }

      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

      const filename = `maintenance-report-${new Date().toISOString().split('T')[0]}.xlsx`

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
    console.error('Error exporting maintenance report:', error)
    return NextResponse.json(
      { error: 'Failed to export maintenance report' },
      { status: 500 }
    )
  }
}
