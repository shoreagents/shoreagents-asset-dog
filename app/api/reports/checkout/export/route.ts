import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth-utils'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  try {
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'csv'
    const employeeId = searchParams.get('employeeId')
    const assetTagId = searchParams.get('assetTagId')
    const dueDate = searchParams.get('dueDate')
    const isOverdue = searchParams.get('isOverdue')
    const location = searchParams.get('location')
    const site = searchParams.get('site')
    const department = searchParams.get('department')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const includeCheckoutList = searchParams.get('includeCheckoutList') === 'true'

    // Build query params for the checkout report API
    const params = new URLSearchParams()
    if (employeeId) params.set('employeeId', employeeId)
    if (assetTagId) params.set('assetTagId', assetTagId)
    if (dueDate) params.set('dueDate', dueDate)
    if (isOverdue) params.set('isOverdue', isOverdue)
    if (location) params.set('location', location)
    if (site) params.set('site', site)
    if (department) params.set('department', department)
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    // If including checkout list, fetch all checkouts (not just current page)
    if (includeCheckoutList) {
      params.set('pageSize', '10000')
    }

    // Fetch checkout report data
    const baseUrl = request.nextUrl.origin
    const response = await fetch(`${baseUrl}/api/reports/checkout?${params.toString()}`, {
      headers: {
        'Cookie': request.headers.get('cookie') || '',
      },
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch checkout data')
    }

    const data = await response.json()
    const checkouts = data.checkouts || []
    const summary = data.summary || {}

    // Calculate total value from all checkouts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalValue = checkouts.reduce((sum: number, checkout: any) => sum + (checkout.assetCost || 0), 0)

    // Calculate summary statistics
    const summaryData = [
      {
        'Metric': 'Total Active Checkouts',
        'Value': summary.totalActive?.toString() || '0',
        'Overdue': summary.totalOverdue?.toString() || '0',
        'Historical': summary.totalHistorical?.toString() || '0',
        'Total Value': totalValue.toFixed(2),
      },
      {
        'Metric': '---',
        'Value': '---',
        'Overdue': '---',
        'Historical': '---',
        'Total Value': '---',
      },
      {
        'Metric': 'CHECKOUTS BY EMPLOYEE',
        'Value': '',
        'Overdue': '',
        'Historical': '',
        'Total Value': '',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(summary.byEmployee || []).map((emp: any) => {
        // Calculate total value for this employee
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const empCheckouts = checkouts.filter((c: any) => c.employeeName === emp.employeeName)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const empValue = empCheckouts.reduce((sum: number, c: any) => sum + (c.assetCost || 0), 0)
        return {
          'Metric': `Employee: ${emp.employeeName || 'Unknown'}`,
          'Value': emp.count?.toString() || '0',
          'Overdue': emp.overdueCount?.toString() || '0',
          'Historical': (emp.count - emp.overdueCount)?.toString() || '0',
          'Total Value': empValue.toFixed(2),
        }
      }),
      {
        'Metric': '---',
        'Value': '---',
        'Overdue': '---',
        'Historical': '---',
        'Total Value': '---',
      },
      {
        'Metric': 'CHECKOUTS BY DEPARTMENT',
        'Value': '',
        'Overdue': '',
        'Historical': '',
        'Total Value': '',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(summary.byDepartment || []).map((dept: any) => {
        // Calculate total value for this department
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const deptCheckouts = checkouts.filter((c: any) => c.employeeDepartment === dept.department)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const deptValue = deptCheckouts.reduce((sum: number, c: any) => sum + (c.assetCost || 0), 0)
        return {
          'Metric': `Department: ${dept.department || 'Unknown'}`,
          'Value': dept.count?.toString() || '0',
          'Overdue': dept.overdueCount?.toString() || '0',
          'Historical': (dept.count - dept.overdueCount)?.toString() || '0',
          'Total Value': deptValue.toFixed(2),
        }
      }),
    ]

    // Prepare checkout list data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const checkoutListData: any[] = checkouts.map((checkout: any) => ({
      'Asset Tag ID': checkout.assetTagId || '',
      'Description': checkout.assetDescription || '',
      'Category': checkout.category || '',
      'SUB-CATEGORY': checkout.subCategory || '',
      'Check-out Date': checkout.checkoutDate || '',
      'Due date': checkout.expectedReturnDate || '',
      'Return Date': checkout.returnDate || '',
      'Department': checkout.employeeDepartment || '',
      'Cost': checkout.assetCost?.toString() || '',
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let exportData: any[] | { summary: any[]; checkoutList: any[] } = []

    if (includeCheckoutList) {
      // Store summary and checkout list separately
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      exportData = { summary: summaryData, checkoutList: checkoutListData } as { summary: any[]; checkoutList: any[] }
    } else {
      // Summary statistics only
      exportData = summaryData
    }

    if (format === 'csv') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let csvData: any[] = []
      
      // Handle checkout report with checkout list
      if (includeCheckoutList && typeof exportData === 'object' && !Array.isArray(exportData)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const summaryDataForCSV = (exportData as { summary: any[]; checkoutList: any[] }).summary
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const checkoutListDataForCSV = (exportData as { summary: any[]; checkoutList: any[] }).checkoutList
        
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
          '=== CHECKOUT LIST ===',
        ]
        
        // Then, output checkout list section
        const checkoutHeaders = Object.keys(checkoutListDataForCSV[0] || {})
        const checkoutRows = [
          checkoutHeaders.join(','),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...checkoutListDataForCSV.map((row: any) =>
            checkoutHeaders.map(header => {
              const value = row[header]
              const stringValue = String(value || '')
              if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                return `"${stringValue.replace(/"/g, '""')}"`
              }
              return stringValue
            }).join(',')
          ),
        ]
        
        const csv = [...summaryRows, ...checkoutRows].join('\n')
        
        const filename = `checkout-report-${new Date().toISOString().split('T')[0]}.csv`
        
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

      const filename = `checkout-report-${new Date().toISOString().split('T')[0]}.csv`

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    } else if (format === 'excel') {
      // Generate Excel
      const wb = XLSX.utils.book_new()
      
      if (includeCheckoutList && typeof exportData === 'object' && !Array.isArray(exportData)) {
        // Multiple sheets: Summary, By Employee, By Department, Checkout List
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const summaryDataForExcel = (exportData as { summary: any[]; checkoutList: any[] }).summary
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const checkoutListDataForExcel = (exportData as { summary: any[]; checkoutList: any[] }).checkoutList
        
        // Summary sheet
        const summaryWs = XLSX.utils.json_to_sheet(summaryDataForExcel)
        XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')
        
        // By Employee sheet
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const employeeData = summaryDataForExcel.filter((row: any) => 
          row.Metric && row.Metric.startsWith('Employee:')
        )
        if (employeeData.length > 0) {
          const employeeWs = XLSX.utils.json_to_sheet(employeeData)
          XLSX.utils.book_append_sheet(wb, employeeWs, 'By Employee')
        }
        
        // By Department sheet
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const departmentData = summaryDataForExcel.filter((row: any) => 
          row.Metric && row.Metric.startsWith('Department:')
        )
        if (departmentData.length > 0) {
          const departmentWs = XLSX.utils.json_to_sheet(departmentData)
          XLSX.utils.book_append_sheet(wb, departmentWs, 'By Department')
        }
        
        // Checkout List sheet
        const checkoutListWs = XLSX.utils.json_to_sheet(checkoutListDataForExcel)
        XLSX.utils.book_append_sheet(wb, checkoutListWs, 'Checkout List')
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
        XLSX.utils.book_append_sheet(wb, ws, 'Checkout Report')
      }

      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

      const filename = `checkout-report-${new Date().toISOString().split('T')[0]}.xlsx`

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
    console.error('Error exporting checkout report:', error)
    return NextResponse.json(
      { error: 'Failed to export checkout report' },
      { status: 500 }
    )
  }
}

