import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth-utils'
import * as XLSX from 'xlsx'

type TransactionTypeStats = {
  count: number
  totalValue: number
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  try {
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'csv'
    const includeTransactionList = searchParams.get('includeTransactionList') === 'true'
    
    // Build query params for the transaction report API
    const params = new URLSearchParams()
    const transactionType = searchParams.get('transactionType')
    const category = searchParams.get('category')
    const location = searchParams.get('location')
    const site = searchParams.get('site')
    const department = searchParams.get('department')
    const actionBy = searchParams.get('actionBy')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    if (transactionType) params.set('transactionType', transactionType)
    if (category) params.set('category', category)
    if (location) params.set('location', location)
    if (site) params.set('site', site)
    if (department) params.set('department', department)
    if (actionBy) params.set('actionBy', actionBy)
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    
    // If including transaction list, fetch all transactions (not just current page)
    if (includeTransactionList) {
      params.set('pageSize', '10000')
    }

    // Fetch transaction report data
    const baseUrl = request.nextUrl.origin
    const response = await fetch(`${baseUrl}/api/reports/transaction?${params.toString()}`, {
      headers: {
        'Cookie': request.headers.get('cookie') || '',
      },
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch transaction data')
    }

    const data = await response.json()
    const transactions = data.transactions || []
    const summary = data.summary || { totalTransactions: 0, byType: [] }

    // Helper function to format numbers with commas
    const formatNumber = (value: number | null | undefined): string => {
      if (value === null || value === undefined || isNaN(value)) {
        return '0.00'
      }
      return Number(value).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    }

    if (format === 'csv') {
      let csvContent = ''
      
      if (includeTransactionList) {
        // Include summary and transaction list
        csvContent += 'TRANSACTION REPORT SUMMARY\n'
        csvContent += `Total Transactions,${summary.totalTransactions}\n\n`
        
        csvContent += 'TRANSACTIONS BY TYPE\n'
        csvContent += 'Transaction Type,Count,Total Asset Value\n'
        ;(summary.byType as Array<{ type: string; count: number; totalValue: number }>).forEach((item) => {
          csvContent += `${item.type},${item.count},${formatNumber(item.totalValue)}\n`
        })
        csvContent += '\n'
        
        csvContent += 'TRANSACTION RECORDS\n'
        const headers = [
          'Transaction Type',
          'Asset Tag ID',
          'Description',
          'Category',
          'Sub-Category',
          'Transaction Date',
          'Action By',
          'Details',
          'Location',
          'Site',
          'Department',
          'Asset Cost',
        ]
        csvContent += headers.join(',') + '\n'
        transactions.forEach((transaction: {
          transactionType: string
          assetTagId: string
          assetDescription: string
          category: string | null
          subCategory: string | null
          transactionDate: string
          actionBy: string | null
          details: string | null
          location: string | null
          site: string | null
          department: string | null
          assetCost: number | null
        }) => {
          csvContent += [
            transaction.transactionType,
            transaction.assetTagId,
            `"${transaction.assetDescription}"`,
            transaction.category || 'N/A',
            transaction.subCategory || 'N/A',
            transaction.transactionDate.split('T')[0],
            transaction.actionBy || 'N/A',
            `"${transaction.details || 'N/A'}"`,
            transaction.location || 'N/A',
            transaction.site || 'N/A',
            transaction.department || 'N/A',
            formatNumber(transaction.assetCost),
          ].join(',') + '\n'
        })
      } else {
        // Summary only
        csvContent += 'TRANSACTION REPORT SUMMARY\n'
        csvContent += `Total Transactions,${summary.totalTransactions}\n\n`
        csvContent += 'TRANSACTIONS BY TYPE\n'
        csvContent += 'Transaction Type,Count,Total Asset Value\n'
        ;(summary.byType as Array<{ type: string; count: number; totalValue: number }>).forEach((item) => {
          csvContent += `${item.type},${item.count},${formatNumber(item.totalValue)}\n`
        })
      }

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="transaction-report-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    if (format === 'excel') {
      const workbook = XLSX.utils.book_new()

      // Summary sheet
      const summaryData = [
        ['TRANSACTION REPORT SUMMARY'],
        ['Total Transactions', summary.totalTransactions],
        [],
        ['TRANSACTIONS BY TYPE'],
        ['Transaction Type', 'Count', 'Total Asset Value'],
        ...(summary.byType as Array<{ type: string; count: number; totalValue: number }>).map((item) => [
          item.type,
          item.count,
          formatNumber(item.totalValue),
        ]),
      ]
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary')

      if (includeTransactionList) {
        // Transaction list sheet
        const transactionData = transactions.map((transaction: {
          transactionType: string
          assetTagId: string
          assetDescription: string
          category: string | null
          subCategory: string | null
          transactionDate: string
          actionBy: string | null
          details: string | null
          location: string | null
          site: string | null
          department: string | null
          assetCost: number | null
        }) => ({
          'Transaction Type': transaction.transactionType,
          'Asset Tag ID': transaction.assetTagId,
          'Description': transaction.assetDescription,
          'Category': transaction.category || 'N/A',
          'Sub-Category': transaction.subCategory || 'N/A',
          'Transaction Date': transaction.transactionDate.split('T')[0],
          'Action By': transaction.actionBy || 'N/A',
          'Details': transaction.details || 'N/A',
          'Location': transaction.location || 'N/A',
          'Site': transaction.site || 'N/A',
          'Department': transaction.department || 'N/A',
          'Asset Cost': formatNumber(transaction.assetCost),
        }))
        const transactionSheet = XLSX.utils.json_to_sheet(transactionData)
        XLSX.utils.book_append_sheet(workbook, transactionSheet, 'Transactions')
      }

      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

      return new NextResponse(excelBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="transaction-report-${new Date().toISOString().split('T')[0]}.xlsx"`,
        },
      })
    }

    // PDF format - return error for now (can be implemented later)
    return NextResponse.json(
      { error: 'PDF export not yet implemented for transaction reports' },
      { status: 501 }
    )
  } catch (error) {
    console.error('Error exporting transaction reports:', error)
    return NextResponse.json(
      { error: 'Failed to export transaction reports' },
      { status: 500 }
    )
  }
}

