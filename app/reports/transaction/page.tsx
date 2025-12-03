'use client'

import { useState, useMemo, useCallback, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePermissions } from '@/hooks/use-permissions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Download, 
  RefreshCw,
  FileSpreadsheet,
  FileText,
  X,
  ArrowLeft,
  ArrowRight,
  Activity,
  Trash2,
  ArrowRightLeft,
  Wrench,
  Package,
} from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { TransactionReportFilters } from '@/components/reports/transaction-report-filters'
import { format } from 'date-fns'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ExportDialog } from '@/components/dialogs/export-dialog'
import { toast } from 'sonner'

interface TransactionReportData {
  transactions: Array<{
    id: string
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
    // Edit Asset specific fields
    fieldChanged?: string | null
    oldValue?: string | null
    newValue?: string | null
    // Lease Out specific fields
    lessee?: string | null
    leaseStartDate?: string | null
    leaseEndDate?: string | null
    conditions?: string | null
    // Lease Return specific fields
    returnDate?: string | null
    condition?: string | null
    notes?: string | null
    // Repair Asset specific fields
    title?: string | null
    maintenanceBy?: string | null
    dueDate?: string | null
    status?: string | null
    cost?: number | null
    dateCompleted?: string | null
    // Move Asset specific fields
    moveType?: string | null
    moveDate?: string | null
    employeeName?: string | null
    reason?: string | null
    fromLocation?: string | null
    toLocation?: string | null
    // Checkout Asset specific fields
    checkoutDate?: string | null
    expectedReturnDate?: string | null
    isOverdue?: boolean | null
    // Checkin Asset specific fields
    checkinDate?: string | null
    // Disposal specific fields
    disposeDate?: string | null
    disposeReason?: string | null
    disposeValue?: number | null
  }>
  summary: {
    totalTransactions: number
    byType: Array<{
      type: string
      count: number
      totalValue: number
    }>
  }
  generatedAt: string
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
}

type TransactionReportType = 
  | 'all'
  | 'Add Asset'
  | 'Sold Asset'
  | 'Donated Asset'
  | 'Scrapped Asset'
  | 'Lost/Missing Asset'
  | 'Destroyed Asset'
  | 'Edit Asset'
  | 'Lease Out'
  | 'Lease Return'
  | 'Repair Asset'
  | 'Move Asset'
  | 'Checkout Asset'
  | 'Checkin Asset'
  | 'Delete Asset'
  | 'Actions By Users'

interface ReportFilters {
  category?: string
  location?: string
  site?: string
  department?: string
  actionBy?: string
  startDate?: string
  endDate?: string
}

interface TableColumn {
  key: string
  label: string
  className?: string
}

const transactionReportTypes = [
  { 
    id: 'all' as TransactionReportType, 
    label: 'All Transactions', 
    icon: Activity, 
    color: 'text-blue-500',
  },
  { 
    id: 'Add Asset' as TransactionReportType, 
    label: 'Add Assets', 
    icon: Package, 
    color: 'text-green-500',
  },
  { 
    id: 'Sold Asset' as TransactionReportType, 
    label: 'Sold Assets', 
    icon: Trash2, 
    color: 'text-purple-500',
  },
  { 
    id: 'Donated Asset' as TransactionReportType, 
    label: 'Donated Assets', 
    icon: Trash2, 
    color: 'text-pink-500',
  },
  { 
    id: 'Scrapped Asset' as TransactionReportType, 
    label: 'Scrapped Assets', 
    icon: Trash2, 
    color: 'text-orange-500',
  },
  { 
    id: 'Lost/Missing Asset' as TransactionReportType, 
    label: 'Lost/Missing Assets', 
    icon: Trash2, 
    color: 'text-yellow-500',
  },
  { 
    id: 'Destroyed Asset' as TransactionReportType, 
    label: 'Destroyed Assets', 
    icon: Trash2, 
    color: 'text-red-500',
  },
  { 
    id: 'Edit Asset' as TransactionReportType, 
    label: 'Edit Assets', 
    icon: FileText, 
    color: 'text-blue-500',
  },
  { 
    id: 'Lease Out' as TransactionReportType, 
    label: 'Lease Out', 
    icon: ArrowRightLeft, 
    color: 'text-cyan-500',
  },
  { 
    id: 'Lease Return' as TransactionReportType, 
    label: 'Lease Return', 
    icon: ArrowRightLeft, 
    color: 'text-teal-500',
  },
  { 
    id: 'Repair Asset' as TransactionReportType, 
    label: 'Repair Assets', 
    icon: Wrench, 
    color: 'text-indigo-500',
  },
  { 
    id: 'Move Asset' as TransactionReportType, 
    label: 'Move Assets', 
    icon: ArrowRightLeft, 
    color: 'text-violet-500',
  },
  { 
    id: 'Checkout Asset' as TransactionReportType, 
    label: 'Checkout Assets', 
    icon: Download, 
    color: 'text-emerald-500',
  },
  { 
    id: 'Checkin Asset' as TransactionReportType, 
    label: 'Checkin Assets', 
    icon: Download, 
    color: 'text-lime-500',
  },
  { 
    id: 'Delete Asset' as TransactionReportType, 
    label: 'Deleted Assets', 
    icon: Trash2, 
    color: 'text-red-500',
  },
  { 
    id: 'Actions By Users' as TransactionReportType, 
    label: 'Actions By Users', 
    icon: Activity, 
    color: 'text-gray-500',
  },
]

// Column configurations for each transaction type
const getTableColumns = (reportType: TransactionReportType): TableColumn[] => {
  const baseColumns: TableColumn[] = [
    { key: 'transactionType', label: 'Transaction Type' },
    { key: 'assetTagId', label: 'Asset Tag ID', className: 'font-mono text-sm' },
    { key: 'description', label: 'Description', className: 'max-w-[200px] truncate' },
    { key: 'category', label: 'Category' },
    { key: 'transactionDate', label: 'Date' },
  ]

  switch (reportType) {
    case 'Add Asset':
      return [
        ...baseColumns.filter(c => c.key !== 'transactionType'),
        { key: 'actionBy', label: 'Added By' },
        { key: 'location', label: 'Location' },
        { key: 'site', label: 'Site' },
        { key: 'department', label: 'Department' },
        { key: 'assetCost', label: 'Asset Cost', className: 'text-right' },
      ]
    
    case 'Sold Asset':
    case 'Donated Asset':
    case 'Scrapped Asset':
    case 'Lost/Missing Asset':
    case 'Destroyed Asset':
      return [
        ...baseColumns.filter(c => c.key !== 'transactionType'),
        { key: 'disposeDate', label: 'Disposal Date' },
        { key: 'disposeReason', label: 'Reason' },
        { key: 'disposeValue', label: 'Disposal Value', className: 'text-right' },
        { key: 'location', label: 'Location' },
        { key: 'assetCost', label: 'Original Cost', className: 'text-right' },
      ]
    
    case 'Edit Asset':
      return [
        ...baseColumns.filter(c => c.key !== 'transactionType'),
        { key: 'actionBy', label: 'Edited By' },
        { key: 'fieldChanged', label: 'Field Changed' },
        { key: 'oldValue', label: 'Old Value', className: 'max-w-[150px] truncate' },
        { key: 'newValue', label: 'New Value', className: 'max-w-[150px] truncate' },
        { key: 'location', label: 'Location' },
      ]
    
    case 'Lease Out':
      return [
        ...baseColumns.filter(c => c.key !== 'transactionType'),
        { key: 'lessee', label: 'Lessee' },
        { key: 'leaseStartDate', label: 'Lease Start' },
        { key: 'leaseEndDate', label: 'Lease End' },
        { key: 'conditions', label: 'Conditions', className: 'max-w-[200px] truncate' },
        { key: 'assetCost', label: 'Asset Cost', className: 'text-right' },
      ]
    
    case 'Lease Return':
      return [
        ...baseColumns.filter(c => c.key !== 'transactionType'),
        { key: 'lessee', label: 'Lessee' },
        { key: 'returnDate', label: 'Return Date' },
        { key: 'condition', label: 'Condition' },
        { key: 'notes', label: 'Notes', className: 'max-w-[200px] truncate' },
        { key: 'assetCost', label: 'Asset Cost', className: 'text-right' },
      ]
    
    case 'Repair Asset':
      return [
        ...baseColumns.filter(c => c.key !== 'transactionType'),
        { key: 'title', label: 'Maintenance Title' },
        { key: 'maintenanceBy', label: 'Maintained By' },
        { key: 'dueDate', label: 'Due Date' },
        { key: 'status', label: 'Status' },
        { key: 'cost', label: 'Cost', className: 'text-right' },
        { key: 'dateCompleted', label: 'Completed Date' },
      ]
    
    case 'Move Asset':
      return [
        ...baseColumns.filter(c => c.key !== 'transactionType'),
        { key: 'moveType', label: 'Move Type' },
        { key: 'moveDate', label: 'Move Date' },
        { key: 'employeeName', label: 'Assigned To' },
        { key: 'reason', label: 'Reason', className: 'max-w-[200px] truncate' },
        { key: 'fromLocation', label: 'From Location' },
        { key: 'toLocation', label: 'To Location' },
      ]
    
    case 'Checkout Asset':
      return [
        ...baseColumns.filter(c => c.key !== 'transactionType'),
        { key: 'employeeName', label: 'Checked Out To' },
        { key: 'checkoutDate', label: 'Checkout Date' },
        { key: 'expectedReturnDate', label: 'Expected Return' },
        { key: 'isOverdue', label: 'Status' },
        { key: 'location', label: 'Location' },
        { key: 'assetCost', label: 'Asset Cost', className: 'text-right' },
      ]
    
    case 'Checkin Asset':
      return [
        ...baseColumns.filter(c => c.key !== 'transactionType'),
        { key: 'employeeName', label: 'Checked In From' },
        { key: 'checkinDate', label: 'Checkin Date' },
        { key: 'condition', label: 'Condition' },
        { key: 'notes', label: 'Notes', className: 'max-w-[200px] truncate' },
        { key: 'location', label: 'Location' },
        { key: 'assetCost', label: 'Asset Cost', className: 'text-right' },
      ]
    
    case 'Delete Asset':
      return [
        ...baseColumns.filter(c => c.key !== 'transactionType'),
        { key: 'actionBy', label: 'Deleted By' },
        { key: 'deletedAt', label: 'Deleted Date' },
        { key: 'reason', label: 'Reason', className: 'max-w-[200px] truncate' },
        { key: 'location', label: 'Location' },
        { key: 'assetCost', label: 'Asset Cost', className: 'text-right' },
      ]
    
    case 'Actions By Users':
      return [
        { key: 'actionBy', label: 'User' },
        { key: 'transactionType', label: 'Action Type' },
        { key: 'assetTagId', label: 'Asset Tag ID', className: 'font-mono text-sm' },
        { key: 'description', label: 'Description', className: 'max-w-[200px] truncate' },
        { key: 'transactionDate', label: 'Date' },
        { key: 'details', label: 'Details', className: 'max-w-[200px] truncate' },
        { key: 'count', label: 'Action Count', className: 'text-right' },
      ]
    
    default: // All Transactions
      return [
        ...baseColumns,
        { key: 'actionBy', label: 'Action By' },
        { key: 'details', label: 'Details', className: 'max-w-[200px] truncate' },
        { key: 'location', label: 'Location' },
        { key: 'assetCost', label: 'Asset Cost', className: 'text-right' },
      ]
  }
}

function TransactionReportsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canViewAssets = hasPermission('canViewAssets')
  
  // Get page and pageSize from URL
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)
  
  const [reportType, setReportType] = useState<TransactionReportType>('all')
  const [filters, setFilters] = useState<ReportFilters>({})
  const [isExporting, setIsExporting] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [pendingExportFormat, setPendingExportFormat] = useState<'csv' | 'excel' | 'pdf' | null>(null)
  const [includeTransactionList, setIncludeTransactionList] = useState(false)
  
  // Update URL with pagination
  const updateURL = useCallback((updates: { page?: number; pageSize?: number; resetPage?: boolean }) => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (updates.page !== undefined) {
      if (updates.page === 1) {
        params.delete('page')
      } else {
        params.set('page', updates.page.toString())
      }
    }
    
    if (updates.pageSize !== undefined) {
      if (updates.pageSize === 50) {
        params.delete('pageSize')
      } else {
        params.set('pageSize', updates.pageSize.toString())
      }
      params.delete('page')
    }
    
    if (updates.resetPage) {
      params.delete('page')
    }
    
    router.push(`?${params.toString()}`, { scroll: false })
  }, [searchParams, router])

  // Handle filter changes and reset to page 1
  const handleFiltersChange = useCallback((newFilters: ReportFilters) => {
    setFilters(newFilters)
    if (page > 1) {
      updateURL({ resetPage: true })
    }
  }, [page, updateURL])

  // Get table columns for current report type
  const tableColumns = useMemo(() => {
    return getTableColumns(reportType)
  }, [reportType])

  // Build query string from filters and pagination
  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    
    // If report type is not 'all', filter by that specific transaction type
    if (reportType !== 'all') {
      params.set('transactionType', reportType)
    }
    
    if (filters.category) params.set('category', filters.category)
    if (filters.location) params.set('location', filters.location)
    if (filters.site) params.set('site', filters.site)
    if (filters.department) params.set('department', filters.department)
    if (filters.actionBy) params.set('actionBy', filters.actionBy)
    if (filters.startDate) params.set('startDate', filters.startDate)
    if (filters.endDate) params.set('endDate', filters.endDate)
    if (page > 1) params.set('page', page.toString())
    if (pageSize !== 50) params.set('pageSize', pageSize.toString())
    return params.toString()
  }, [filters, page, pageSize, reportType])

  // Handle report type change
  const handleReportTypeChange = useCallback((newReportType: TransactionReportType) => {
    setReportType(newReportType)
    if (page > 1) {
      updateURL({ resetPage: true })
    }
  }, [page, updateURL])

  // Fetch transaction data
  const { data, isLoading, isFetching, error, refetch } = useQuery<TransactionReportData>({
    queryKey: ['transaction-reports', reportType, queryString, page, pageSize],
    queryFn: async () => {
      const response = await fetch(`/api/reports/transaction?${queryString}`)
      if (!response.ok) {
        throw new Error('Failed to fetch transaction reports')
      }
      return response.json()
    },
    enabled: canViewAssets && !permissionsLoading,
    placeholderData: (previousData) => previousData,
  })

  const transactions = data?.transactions || []
  const pagination = data?.pagination
  const summary = data?.summary

  // Format currency
  const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return '₱0.00'
    }
    return `₱${Number(value).toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`
  }

  // Remove individual filter
  const removeFilter = (filterKey: keyof ReportFilters) => {
    setFilters(prev => {
      const newFilters = { ...prev }
      delete newFilters[filterKey]
      return newFilters
    })
  }

  // Export handlers
  const handleExportClick = (format: 'csv' | 'excel' | 'pdf') => {
    setPendingExportFormat(format)
    setIncludeTransactionList(false)
    setShowExportDialog(true)
  }

  const handlePageSizeChange = (newPageSize: string) => {
    updateURL({ pageSize: parseInt(newPageSize), page: 1 })
  }

  const handlePageChange = (newPage: number) => {
    updateURL({ page: newPage })
  }

  const handleDataExport = async (format: 'csv' | 'excel') => {
    setIsExporting(true)
    try {
      const params = new URLSearchParams()
      params.set('format', format)
      
      // Apply report type filter
      if (reportType !== 'all') {
        params.set('transactionType', reportType)
      }
      
      if (filters.category) params.set('category', filters.category)
      if (filters.location) params.set('location', filters.location)
      if (filters.site) params.set('site', filters.site)
      if (filters.department) params.set('department', filters.department)
      if (filters.actionBy) params.set('actionBy', filters.actionBy)
      if (filters.startDate) params.set('startDate', filters.startDate)
      if (filters.endDate) params.set('endDate', filters.endDate)
      if (includeTransactionList) params.set('includeTransactionList', 'true')

      const response = await fetch(`/api/reports/transaction/export?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error('Export failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `transaction-report-${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'xlsx'}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success(`Report exported successfully as ${format.toUpperCase()}`)
      setShowExportDialog(false)
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export report')
    } finally {
      setIsExporting(false)
    }
  }

  const handlePDFExport = async () => {
    if (!data) {
      toast.error('No report data available')
      return
    }

    // Fetch all transactions for PDF export only if includeTransactionList is checked
    let allTransactions: typeof transactions | undefined = undefined
    if (includeTransactionList) {
      try {
        const params = new URLSearchParams()
        // Apply report type filter
        if (reportType !== 'all') {
          params.set('transactionType', reportType)
        }
        
        if (filters.category) params.set('category', filters.category)
        if (filters.location) params.set('location', filters.location)
        if (filters.site) params.set('site', filters.site)
        if (filters.department) params.set('department', filters.department)
        if (filters.actionBy) params.set('actionBy', filters.actionBy)
        if (filters.startDate) params.set('startDate', filters.startDate)
        if (filters.endDate) params.set('endDate', filters.endDate)
        // Set a large pageSize to get all results
        params.set('pageSize', '10000')
        
        const response = await fetch(`/api/reports/transaction?${params.toString()}`)
        if (response.ok) {
          const responseData = await response.json()
          allTransactions = responseData.transactions || []
        }
      } catch (error) {
        console.error('Failed to fetch all transactions for PDF:', error)
        // Fall back to undefined, which will skip the transaction list
      }
    }

    // Generate HTML for PDF
    const html = generateTransactionReportHTML(data, allTransactions, includeTransactionList, reportType)

    const response = await fetch('/api/reports/assets/pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ html }),
    })

    if (!response.ok) {
      throw new Error('PDF generation failed')
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    const reportTypeLabel = reportType === 'all' ? 'all-transactions' : reportType.toLowerCase().replace(/\s+/g, '-')
    a.href = url
    a.download = `transaction-report-${reportTypeLabel}-${new Date().toISOString().split('T')[0]}.pdf`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)

    toast.success('Report exported successfully as PDF')
  }

  const generateTransactionReportHTML = (
    data: TransactionReportData,
    allTransactions?: typeof transactions,
    includeList: boolean = false,
    selectedReportType: TransactionReportType = 'all'
  ) => {
    const reportTypeLabel = selectedReportType === 'all' 
      ? 'Transaction Report - Full record of asset transactions'
      : `${selectedReportType} Report`
    
    const styles = `
      @page {
        size: A4 landscape;
        margin: 15mm;
      }
      body {
        font-family: Arial, sans-serif;
        margin: 20px;
        color: #333;
      }
      h1 {
        color: #2563eb;
        border-bottom: 3px solid #2563eb;
        padding-bottom: 10px;
        margin-bottom: 10px;
        font-size: 24px;
      }
      .subtitle {
        color: #6b7280;
        margin-bottom: 20px;
        font-size: 12px;
      }
      h2 {
        color: #1e40af;
        margin-top: 20px;
        margin-bottom: 10px;
        font-size: 18px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 15px 0;
        font-size: 9px;
        table-layout: fixed;
      }
      th, td {
        border: 1px solid #e5e7eb;
        padding: 4px 6px;
        text-align: left;
        word-wrap: break-word;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      th {
        background-color: #f3f4f6;
        font-weight: 600;
        color: #374151;
        font-size: 9px;
      }
      td {
        font-size: 8px;
      }
      tr:nth-child(even) {
        background-color: #f9fafb;
      }
      tr {
        page-break-inside: avoid;
      }
      /* Column width adjustments for wide table */
      th:nth-child(1), td:nth-child(1) { width: 8%; } /* Transaction Type */
      th:nth-child(2), td:nth-child(2) { width: 8%; } /* Asset Tag ID */
      th:nth-child(3), td:nth-child(3) { width: 12%; } /* Description */
      th:nth-child(4), td:nth-child(4) { width: 8%; } /* Category */
      th:nth-child(5), td:nth-child(5) { width: 8%; } /* Sub-Category */
      th:nth-child(6), td:nth-child(6) { width: 7%; } /* Transaction Date */
      th:nth-child(7), td:nth-child(7) { width: 8%; } /* Action By */
      th:nth-child(8), td:nth-child(8) { width: 12%; } /* Details */
      th:nth-child(9), td:nth-child(9) { width: 6%; } /* Location */
      th:nth-child(10), td:nth-child(10) { width: 6%; } /* Site */
      th:nth-child(11), td:nth-child(11) { width: 8%; } /* Department */
      th:nth-child(12), td:nth-child(12) { width: 9%; } /* Asset Cost */
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 15px;
        margin-bottom: 20px;
      }
      .summary-card {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 12px;
        background: #f9fafb;
      }
      .summary-card h3 {
        margin: 0 0 5px 0;
        font-size: 12px;
        color: #6b7280;
      }
      .summary-card .value {
        font-size: 20px;
        font-weight: bold;
        color: #111827;
      }
      .footer {
        margin-top: 30px;
        padding-top: 15px;
        border-top: 1px solid #e5e7eb;
        text-align: center;
        color: #6b7280;
        font-size: 10px;
      }
      @media print {
        body {
          margin: 15mm;
        }
        table {
          page-break-inside: auto;
        }
        thead {
          display: table-header-group;
        }
        @page {
          size: A4 landscape;
        }
      }
    `

    const transactionsToExport = allTransactions || transactions || []
    const totalValue = transactionsToExport.reduce((sum, t) => sum + (t.assetCost || 0), 0)

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${reportTypeLabel}</title>
        <style>${styles}</style>
      </head>
      <body>
        <h1>${reportTypeLabel}</h1>
        <div class="subtitle">Complete record of asset transactions and activities</div>
        
        <!-- Summary Statistics (always shown) -->
        <div class="summary-grid">
          <div class="summary-card">
            <h3>Total Transactions</h3>
            <div class="value">${data.summary.totalTransactions}</div>
          </div>
          <div class="summary-card">
            <h3>Transaction Types</h3>
            <div class="value">${data.summary.byType.length}</div>
          </div>
          <div class="summary-card">
            <h3>Total Asset Value</h3>
            <div class="value">${formatCurrency(totalValue)}</div>
          </div>
          <div class="summary-card">
            <h3>Records Shown</h3>
            <div class="value">${transactionsToExport.length}</div>
          </div>
        </div>

        <h2>Transactions by Type</h2>
        <table>
          <thead>
            <tr>
              <th>Transaction Type</th>
              <th>Count</th>
              <th>Total Asset Value</th>
            </tr>
          </thead>
          <tbody>
            ${data.summary.byType.length === 0 ? `
              <tr>
                <td colspan="3" style="text-align: center; color: #6b7280;">No transaction types found</td>
              </tr>
            ` : data.summary.byType.map(item => `
              <tr>
                <td><strong>${item.type}</strong></td>
                <td>${item.count}</td>
                <td>${formatCurrency(item.totalValue)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        ${includeList && transactionsToExport.length > 0 ? `
        <h2>Transaction Details (${transactionsToExport.length} transactions)</h2>
        <table>
          <thead>
            <tr>
              <th>Transaction Type</th>
              <th>Asset Tag ID</th>
              <th>Description</th>
              <th>Category</th>
              <th>Sub-Category</th>
              <th>Transaction Date</th>
              <th>Action By</th>
              <th>Details</th>
              <th>Location</th>
              <th>Site</th>
              <th>Department</th>
              <th>Asset Cost</th>
            </tr>
          </thead>
          <tbody>
            ${transactionsToExport.map(transaction => `
              <tr>
                <td>${transaction.transactionType}</td>
                <td><strong>${transaction.assetTagId}</strong></td>
                <td>${transaction.assetDescription || 'N/A'}</td>
                <td>${transaction.category || 'N/A'}</td>
                <td>${transaction.subCategory || 'N/A'}</td>
                <td>${transaction.transactionDate ? format(new Date(transaction.transactionDate), 'MMM d, yyyy') : 'N/A'}</td>
                <td>${transaction.actionBy || 'N/A'}</td>
                <td>${transaction.details || 'N/A'}</td>
                <td>${transaction.location || 'N/A'}</td>
                <td>${transaction.site || 'N/A'}</td>
                <td>${transaction.department || 'N/A'}</td>
                <td>${transaction.assetCost ? formatCurrency(transaction.assetCost) : 'N/A'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : ''}

        <div class="footer">
          <p>Generated on ${format(new Date(data.generatedAt), 'PPpp')}</p>
        </div>
      </body>
      </html>
    `
  }

  const getTransactionTypeColor = (type: string): string => {
    const colorMap: Record<string, string> = {
      'Add Asset': 'bg-green-500/10 text-green-600 dark:text-green-400',
      'Edit Asset': 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      'Delete Asset': 'bg-red-500/10 text-red-600 dark:text-red-400',
      'Sold Asset': 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
      'Donated Asset': 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
      'Scrapped Asset': 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
      'Lost/Missing Asset': 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
      'Destroyed Asset': 'bg-red-500/10 text-red-600 dark:text-red-400',
      'Lease Out': 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
      'Lease Return': 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
      'Repair Asset': 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
      'Move Asset': 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
      'Checkout Asset': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      'Checkin Asset': 'bg-lime-500/10 text-lime-600 dark:text-lime-400',
    }
    return colorMap[type] || 'bg-gray-500/10 text-gray-600 dark:text-gray-400'
  }

  if (permissionsLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!canViewAssets) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              You don&apos;t have permission to view this report.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transaction Reports</h1>
          <p className="text-muted-foreground">
            Complete record of all asset transactions and activities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TransactionReportFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            disabled={isLoading || isFetching}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading || isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={isExporting || isLoading || isFetching}
                className="bg-gray-400 bg-clip-padding backdrop-filter backdrop-blur-md bg-opacity-10 border shadow-sm"
              >
                {isExporting ? (
                  <>
                    <Spinner className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Exporting...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Export</span>
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExportClick('csv')} disabled={isExporting}>
                <FileText className="h-4 w-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportClick('excel')} disabled={isExporting}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export as Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportClick('pdf')} disabled={isExporting}>
                <FileText className="h-4 w-4 mr-2" />
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.div>

      {/* Report Type Selector */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-sm backdrop-saturate-150">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Transaction by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="w-full">
              <div className="flex flex-wrap gap-2 pb-2">
                {transactionReportTypes.map((type) => {
                  const isActive = reportType === type.id
                  return (
                    <motion.div
                      key={type.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="shrink-0"
                    >
                      <Button
                        variant={isActive ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleReportTypeChange(type.id)}
                        disabled={isLoading || isFetching}
                        className={`gap-2 transition-all ${
                          isActive
                            ? 'shadow-md'
                            : 'bg-white/5 dark:bg-white/5 hover:bg-white/10 dark:hover:bg-white/10 border-white/20 dark:border-white/10'
                        }`}
                      >
                        <type.icon className={`h-4 w-4 ${isActive ? '' : type.color}`} />
                        {type.label}
                      </Button>
                    </motion.div>
                  )
                })}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>

      {/* Active Filters */}
      <AnimatePresence>
        {Object.keys(filters).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex flex-wrap gap-2"
          >
            <AnimatePresence>
              {Object.entries(filters).map(([key, value]) => {
                if (!value) return null
                return (
                  <motion.div
                    key={key}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Badge variant="outline" className="gap-1.5 pr-1 bg-white/5 hover:bg-white/10 transition-colors max-w-full">
                      <span className="text-xs truncate">
                        <span className="text-muted-foreground">
                          {key === 'transactionType' ? 'Type' : 
                           key === 'actionBy' ? 'User' :
                           key.charAt(0).toUpperCase() + key.slice(1)}:
                        </span> {value}
                      </span>
                      <button
                        onClick={() => removeFilter(key as keyof ReportFilters)}
                        disabled={isLoading || isFetching}
                        className="ml-0.5 rounded-sm hover:bg-white/20 p-0.5 disabled:opacity-50"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary Cards */}
      {summary && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {[
            {
              title: 'Total Transactions',
              value: summary.totalTransactions.toLocaleString(),
              description: 'All transactions',
              icon: Activity,
              color: 'text-blue-500',
              bgColor: 'bg-blue-500/10',
              borderColor: '#3b82f6',
              delay: 0.1,
            },
            {
              title: 'Transaction Types',
              value: summary.byType.length.toString(),
              description: 'Unique types',
              icon: FileText,
              color: 'text-green-500',
              bgColor: 'bg-green-500/10',
              borderColor: '#22c55e',
              delay: 0.2,
            },
            {
              title: 'Total Asset Value',
              value: formatCurrency(summary.byType.reduce((sum, item) => sum + item.totalValue, 0)),
              description: 'Combined value',
              icon: Download,
              color: 'text-amber-500',
              bgColor: 'bg-amber-500/10',
              borderColor: '#f59e0b',
              delay: 0.3,
            },
            {
              title: 'Current Page',
              value: `${transactions.length} / ${pagination?.total.toLocaleString() || 0}`,
              description: 'Displayed items',
              icon: FileSpreadsheet,
              color: 'text-purple-500',
              bgColor: 'bg-purple-500/10',
              borderColor: '#a855f7',
              delay: 0.4,
            },
          ].map((card) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: card.delay }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
            >
              <Card
                className="bg-white/10 dark:bg-white/5 backdrop-blur-2xl border-l-4 border border-white/30 dark:border-white/10 shadow-sm backdrop-saturate-150 transition-all hover:shadow-md hover:bg-white/15 dark:hover:bg-white/10"
                style={{ borderLeftColor: card.borderColor }}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                  <div className={`p-2 rounded-lg ${card.bgColor}`}>
                    <card.icon className={`h-4 w-4 ${card.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{card.value}</div>
                  <p className="text-xs text-muted-foreground mt-1.5">{card.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Transactions Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-sm backdrop-saturate-150 relative flex flex-col flex-1 min-h-0 pb-0 gap-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Transaction Records
            </CardTitle>
            <CardDescription>
              {pagination ? `Showing ${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, pagination.total)} of ${pagination.total.toLocaleString()} transactions` : 'Loading...'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 px-0 relative">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <Spinner className="h-8 w-8" />
                  <p className="text-sm text-muted-foreground">Loading transactions...</p>
                </div>
              </div>
            ) : error ? (
              <div className="py-12 text-center">
                <Card className="bg-destructive/10 border-destructive/20">
                  <CardContent className="pt-6">
                    <div className="text-center text-destructive">
                      <p className="font-medium">Failed to load transactions</p>
                      <p className="text-sm mt-1">Please try again or check your connection</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : transactions.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <p className="text-sm">No transactions found matching your filters.</p>
              </div>
            ) : (
              <>
                <div className="h-[560px] pt-8">
                  <div className="min-w-full">
                    <ScrollArea className="h-[528px] relative">
                      <div className="sticky top-0 z-30 h-px bg-border w-full"></div>
                      <div className="pr-2.5 relative after:content-[''] after:absolute after:right-[10px] after:top-0 after:bottom-0 after:w-px after:bg-border after:z-50 after:h-full">
                        <Table className="border-b">
                          <TableHeader className="sticky -top-1 z-20 bg-card [&_tr]:border-b-0 -mr-2.5">
                            <TableRow className="group hover:bg-muted/50 relative border-b-0 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-[1.5px] after:h-px after:bg-border after:z-30">
                              {tableColumns.map((column) => (
                                <TableHead 
                                  key={column.key} 
                                  className={`text-left bg-card transition-colors group-hover:bg-muted/50 ${column.className || ''} ${column.key.includes('Cost') || column.key.includes('Value') || column.key.includes('Count') ? 'text-right' : ''}`}
                                >
                                  {column.label}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {transactions.map((transaction) => {
                        const getCellValue = (key: string) => {
                          switch (key) {
                            case 'transactionType':
                              return (
                                <Badge className={getTransactionTypeColor(transaction.transactionType)}>
                                  {transaction.transactionType}
                                </Badge>
                              )
                            case 'assetTagId':
                              return <span className="font-mono text-sm font-medium">{transaction.assetTagId}</span>
                            case 'description':
                              return (
                                <span className="max-w-[200px] truncate" title={transaction.assetDescription}>
                                  {transaction.assetDescription}
                                </span>
                              )
                            case 'category':
                              return transaction.category || 'N/A'
                            case 'transactionDate':
                            case 'date':
                            case 'deletedAt':
                              return transaction.transactionDate 
                                ? format(new Date(transaction.transactionDate), 'MMM dd, yyyy')
                                : 'N/A'
                            case 'actionBy':
                            case 'addedBy':
                            case 'editedBy':
                            case 'deletedBy':
                            case 'maintainedBy':
                              return transaction.actionBy || 'N/A'
                            case 'details':
                              return (
                                <span className="max-w-[200px] truncate text-sm text-muted-foreground" title={transaction.details || 'N/A'}>
                                  {transaction.details || 'N/A'}
                                </span>
                              )
                            case 'location':
                              return transaction.location || 'N/A'
                            case 'site':
                              return transaction.site || 'N/A'
                            case 'department':
                              return transaction.department || 'N/A'
                            case 'assetCost':
                            case 'cost':
                            case 'disposeValue':
                              return <span className="font-medium">{formatCurrency(transaction.assetCost)}</span>
                            case 'fieldChanged':
                              return transaction.fieldChanged || 'N/A'
                            case 'oldValue':
                              return (
                                <span className="max-w-[150px] truncate text-sm text-muted-foreground" title={transaction.oldValue || 'N/A'}>
                                  {transaction.oldValue || 'N/A'}
                                </span>
                              )
                            case 'newValue':
                              return (
                                <span className="max-w-[150px] truncate text-sm" title={transaction.newValue || 'N/A'}>
                                  {transaction.newValue || 'N/A'}
                                </span>
                              )
                            case 'lessee':
                              return transaction.lessee || 'N/A'
                            case 'leaseStartDate':
                              return transaction.leaseStartDate 
                                ? format(new Date(transaction.leaseStartDate), 'MMM dd, yyyy')
                                : 'N/A'
                            case 'leaseEndDate':
                              return transaction.leaseEndDate 
                                ? format(new Date(transaction.leaseEndDate), 'MMM dd, yyyy')
                                : 'N/A'
                            case 'conditions':
                              return (
                                <span className="max-w-[200px] truncate text-sm text-muted-foreground" title={transaction.conditions || 'N/A'}>
                                  {transaction.conditions || 'N/A'}
                                </span>
                              )
                            case 'returnDate':
                              return transaction.returnDate 
                                ? format(new Date(transaction.returnDate), 'MMM dd, yyyy')
                                : 'N/A'
                            case 'condition':
                              return transaction.condition || 'N/A'
                            case 'notes':
                              return (
                                <span className="max-w-[200px] truncate text-sm text-muted-foreground" title={transaction.notes || 'N/A'}>
                                  {transaction.notes || 'N/A'}
                                </span>
                              )
                            case 'title':
                              return transaction.title || 'N/A'
                            case 'maintenanceBy':
                              return transaction.maintenanceBy || 'N/A'
                            case 'dueDate':
                              return transaction.dueDate 
                                ? format(new Date(transaction.dueDate), 'MMM dd, yyyy')
                                : 'N/A'
                            case 'status':
                              return transaction.status ? (
                                <Badge variant="outline">{transaction.status}</Badge>
                              ) : 'N/A'
                            case 'dateCompleted':
                              return transaction.dateCompleted 
                                ? format(new Date(transaction.dateCompleted), 'MMM dd, yyyy')
                                : 'N/A'
                            case 'moveType':
                              return transaction.moveType || 'N/A'
                            case 'moveDate':
                              return transaction.moveDate 
                                ? format(new Date(transaction.moveDate), 'MMM dd, yyyy')
                                : 'N/A'
                            case 'employeeName':
                              return transaction.employeeName || 'N/A'
                            case 'reason':
                              return (
                                <span className="max-w-[200px] truncate text-sm text-muted-foreground" title={transaction.reason || 'N/A'}>
                                  {transaction.reason || 'N/A'}
                                </span>
                              )
                            case 'fromLocation':
                              return transaction.fromLocation || 'N/A'
                            case 'toLocation':
                              return transaction.toLocation || 'N/A'
                            case 'checkoutDate':
                              return transaction.checkoutDate 
                                ? format(new Date(transaction.checkoutDate), 'MMM dd, yyyy')
                                : 'N/A'
                            case 'expectedReturnDate':
                              return transaction.expectedReturnDate 
                                ? format(new Date(transaction.expectedReturnDate), 'MMM dd, yyyy')
                                : 'N/A'
                            case 'isOverdue':
                              return transaction.isOverdue ? (
                                <Badge className="bg-red-500/10 text-red-600 dark:text-red-400">Overdue</Badge>
                              ) : (
                                <Badge className="bg-green-500/10 text-green-600 dark:text-green-400">Active</Badge>
                              )
                            case 'checkinDate':
                              return transaction.checkinDate 
                                ? format(new Date(transaction.checkinDate), 'MMM dd, yyyy')
                                : 'N/A'
                            case 'disposeDate':
                              return transaction.disposeDate 
                                ? format(new Date(transaction.disposeDate), 'MMM dd, yyyy')
                                : 'N/A'
                            case 'disposeReason':
                              return (
                                <span className="max-w-[200px] truncate text-sm text-muted-foreground" title={transaction.disposeReason || 'N/A'}>
                                  {transaction.disposeReason || 'N/A'}
                                </span>
                              )
                            default:
                              // For fields that don't exist in the transaction object, show N/A
                              return 'N/A'
                          }
                        }

                              return (
                                <TableRow key={transaction.id} className="group relative hover:bg-muted/90 border-b transition-colors">
                                  {tableColumns.map((column) => (
                                    <TableCell 
                                      key={column.key}
                                      className={`${column.className || ''} ${column.key.includes('Cost') || column.key.includes('Value') || column.key.includes('Count') ? 'text-right' : ''}`}
                                    >
                                      {getCellValue(column.key)}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                      <ScrollBar orientation="horizontal" />
                      <ScrollBar orientation="vertical" className="z-50" />
                    </ScrollArea>
                  </div>
                </div>
              </>
            )}
          </CardContent>
          
          {/* Pagination Bar - Fixed at Bottom */}
          {pagination && (
            <div className="sticky bottom-0 border-t bg-card z-10 shadow-sm mt-auto rounded-b-lg">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 px-4 sm:px-6 py-3">
                    {/* Left Side - Navigation */}
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (page > 1) {
                            handlePageChange(page - 1)
                          }
                        }}
                        disabled={page <= 1 || isLoading}
                        className="h-8 px-2 sm:px-3"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      
                      {/* Page Info */}
                      <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                        <span className="text-muted-foreground">Page</span>
                        <div className="px-1.5 sm:px-2 py-1 rounded-md bg-primary/10 text-primary font-medium text-xs sm:text-sm">
                          {isLoading ? '...' : (pagination?.page || page)}
                        </div>
                        <span className="text-muted-foreground">of</span>
                        <span className="text-muted-foreground">{isLoading ? '...' : (pagination?.totalPages || 1)}</span>
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (pagination && page < pagination.totalPages) {
                            handlePageChange(page + 1)
                          }
                        }}
                        disabled={!pagination || page >= (pagination.totalPages || 1) || isLoading}
                        className="h-8 px-2 sm:px-3"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {/* Right Side - Rows and Records */}
                    <div className="flex items-center justify-center sm:justify-end gap-2 sm:gap-4">
                      {/* Row Selection - Clickable */}
                      <Select value={pageSize.toString()} onValueChange={handlePageSizeChange} disabled={isLoading}>
                        <SelectTrigger className="h-8 w-auto min-w-[90px] sm:min-w-[100px] text-xs sm:text-sm border-primary/20 bg-primary/10 text-primary font-medium hover:bg-primary/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="25">25 rows</SelectItem>
                          <SelectItem value="50">50 rows</SelectItem>
                          <SelectItem value="100">100 rows</SelectItem>
                          <SelectItem value="200">200 rows</SelectItem>
                          <SelectItem value="500">500 rows</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      {/* Total Records */}
                      <div className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                        {isLoading ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          <>
                            <span className="hidden sm:inline">{pagination?.total || 0} records</span>
                            <span className="sm:hidden">{pagination?.total || 0}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
          )}
        </Card>
      </motion.div>

      {/* Export Dialog */}
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        reportType={
          reportType === 'all' 
            ? 'Transaction Report - Full record of asset transactions'
            : `${reportType} Report`
        }
        reportTypeIcon={
          reportType === 'all' 
            ? Activity 
            : transactionReportTypes.find((t) => t.id === reportType)?.icon || Activity
        }
        exportFormat={pendingExportFormat}
        filters={filters as Record<string, string | boolean | null | undefined>}
        includeList={includeTransactionList}
        onIncludeListChange={setIncludeTransactionList}
        includeListLabel="Include Transaction List"
        includeListDescription="When checked, the export will include a detailed table of all transactions. Unchecked by default - only summary statistics will be exported."
        exportDescription={(format, includeList) => {
          if (format === 'pdf') {
            return `This will export transaction information. ${includeList ? 'Transaction details table will be included.' : 'Transaction details table will not be included.'}`
          }
          return `This will export transaction information. ${includeList ? 'Transaction details table with complete transaction data will be included.' : 'Only summary statistics will be exported (no transaction list).'}`
        }}
        isExporting={isExporting}
        onConfirm={async () => {
          setShowExportDialog(false)
          setIsExporting(true)
          
          try {
            if (pendingExportFormat === 'pdf') {
              await handlePDFExport()
            } else {
              await handleDataExport(pendingExportFormat || 'csv')
            }
          } catch (error) {
            console.error('Export error:', error)
            toast.error(`Failed to export report as ${pendingExportFormat?.toUpperCase() || 'CSV'}`)
          } finally {
            setIsExporting(false)
            setPendingExportFormat(null)
          }
        }}
        onCancel={() => {
          setShowExportDialog(false)
          setPendingExportFormat(null)
        }}
        formatFilterValue={(key, value) => {
          if (key === 'startDate' || key === 'endDate') {
            return format(new Date(value as string), 'MMM d, yyyy')
          }
          return String(value)
        }}
      />
    </motion.div>
  )
}

export default function TransactionReportsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    }>
      <TransactionReportsPageContent />
    </Suspense>
  )
}

