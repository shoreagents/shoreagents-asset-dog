'use client'

import { useState, useMemo, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
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
  Package,
  ChevronDown,
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
import { ReportFilters } from '@/components/reports/report-filters'
import { format } from 'date-fns'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ExportDialog } from '@/components/dialogs/export-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase-client'

interface MaintenanceReportData {
  summary: {
    totalMaintenances: number
    underRepair: number
    upcoming: number
    completed: number
    totalCost: number
    averageCost: number
    totalCostByStatus?: {
      completed: number
      scheduled: number
      cancelled: number
      inProgress: number
    }
    byStatus: Array<{
      status: string
      count: number
      totalCost: number
      averageCost: number
    }>
  }
  maintenances: Array<{
    id: string
    assetId: string
    assetTagId: string
    assetDescription: string
    assetStatus: string | null
    assetCost: number | null
    category: string | null
    title: string
    details: string | null
    status: string
    dueDate: string | null
    dateCompleted: string | null
    dateCancelled: string | null
    maintenanceBy: string | null
    cost: number | null
    isRepeating: boolean
    isOverdue: boolean
    isUpcoming: boolean
    inventoryItems?: Array<{
      id: string
      inventoryItemId: string
      quantity: number
      unitCost: number | null
      inventoryItem: {
        id: string
        itemCode: string
        name: string
        unit: string | null
        unitCost: number | null
      }
    }>
  }>
  upcoming: Array<{
    id: string
    assetId: string
    assetTagId: string
    assetDescription: string
    title: string
    dueDate: string | null
    maintenanceBy: string | null
    daysUntilDue: number | null
  }>
  generatedAt: string
  pagination?: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
}

interface ReportFilters {
  status?: string
  assetId?: string
  category?: string
  startDate?: string
  endDate?: string
}

function MaintenanceReportsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canViewAssets = hasPermission('canViewAssets')
  const canManageReports = hasPermission('canManageReports')
  
  // Get page and pageSize from URL
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)
  
  const [filters, setFilters] = useState<ReportFilters>({})
  const [isExporting, setIsExporting] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [pendingExportFormat, setPendingExportFormat] = useState<'csv' | 'excel' | 'pdf' | null>(null)
  const [includeMaintenanceList, setIncludeMaintenanceList] = useState(false)

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
      // Reset to page 1 when pageSize changes
      params.delete('page')
    }
    
    // Reset to page 1 when filters change
    if (updates.resetPage) {
      params.delete('page')
    }
    
    router.push(`?${params.toString()}`, { scroll: false })
  }, [searchParams, router])
  
  // Handle filter changes and reset to page 1
  const handleFiltersChange = useCallback((newFilters: ReportFilters) => {
    setFilters(newFilters)
    // Reset to page 1 when filters change
    if (page > 1) {
      updateURL({ resetPage: true })
    }
  }, [page, updateURL])

  // Helper functions for FastAPI
  const getApiBaseUrl = () => {
    const useFastAPI = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true'
    const fastApiUrl = process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000'
    return useFastAPI ? fastApiUrl : ''
  }

  const getAuthToken = async (): Promise<string | null> => {
    try {
      const supabase = createClient()
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) {
        console.error('Failed to get auth token:', error)
        return null
      }
      return session?.access_token || null
    } catch (error) {
      console.error('Error getting auth token:', error)
      return null
    }
  }

  // Build query string from filters and pagination
  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (filters.status) params.set('status', filters.status)
    if (filters.assetId) params.set('assetId', filters.assetId)
    if (filters.category) params.set('category', filters.category)
    if (filters.startDate) params.set('startDate', filters.startDate)
    if (filters.endDate) params.set('endDate', filters.endDate)
    // Add pagination
    if (page > 1) params.set('page', page.toString())
    if (pageSize !== 50) params.set('pageSize', pageSize.toString())
    return params.toString()
  }, [filters, page, pageSize])

  // Fetch report data
  const { data: reportData, isLoading, isFetching, error, refetch } = useQuery<MaintenanceReportData>({
    queryKey: ['maintenance-report', queryString, page, pageSize],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/reports/maintenance?${queryString}`
      
      const token = await getAuthToken()
      const headers: HeadersInit = {}
      if (baseUrl && token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(url, {
        credentials: 'include',
        headers,
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.detail || error.error || 'Failed to fetch maintenance report data')
      }
      return response.json()
    },
    enabled: canViewAssets, // Only fetch if user has permission
    placeholderData: (previousData) => previousData,
  })
  
  const pagination = reportData?.pagination
  
  const handlePageSizeChange = (newPageSize: string) => {
    updateURL({ pageSize: parseInt(newPageSize), page: 1 })
  }

  const handlePageChange = (newPage: number) => {
    updateURL({ page: newPage })
  }

  const formatCurrency = (value: number | null | undefined) => {
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
    if (!canManageReports) {
      toast.error('You do not have permission to export reports. Please contact your administrator.')
      return
    }
    setPendingExportFormat(format)
    setIncludeMaintenanceList(false) // Reset to default
    setShowExportDialog(true)
  }

  const handleConfirmExport = async () => {
    if (!pendingExportFormat) return
    
    setShowExportDialog(false)
    setIsExporting(true)
    
    try {
      if (pendingExportFormat === 'pdf') {
        await handlePDFExport()
      } else {
        await handleDataExport(pendingExportFormat)
      }
    } catch (error) {
      console.error('Export error:', error)
      toast.error(`Failed to export report as ${pendingExportFormat.toUpperCase()}`)
    } finally {
      setIsExporting(false)
      setPendingExportFormat(null)
    }
  }

  const handleDataExport = async (format: 'csv' | 'excel') => {
    const baseUrl = getApiBaseUrl()
    const params = new URLSearchParams()
    params.set('format', format)
    if (filters.status) params.set('status', filters.status)
    if (filters.assetId) params.set('assetId', filters.assetId)
    if (filters.category) params.set('category', filters.category)
    if (filters.startDate) params.set('startDate', filters.startDate)
    if (filters.endDate) params.set('endDate', filters.endDate)
    if (includeMaintenanceList) params.set('includeMaintenanceList', 'true')

    const url = `${baseUrl}/api/reports/maintenance/export?${params.toString()}`
    
    const token = await getAuthToken()
    const headers: HeadersInit = {}
    if (baseUrl && token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(url, {
      credentials: 'include',
      headers,
    })
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.detail || error.error || 'Export failed')
    }

    const blob = await response.blob()
    const downloadUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = `maintenance-report-${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'xlsx'}`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(downloadUrl)
    document.body.removeChild(a)

    toast.success(`Report exported successfully as ${format.toUpperCase()}`)
  }

  const handlePDFExport = async () => {
    if (!reportData) {
      toast.error('No report data available')
      return
    }

    // Fetch all maintenances for PDF export only if includeMaintenanceList is checked
    let allMaintenances: typeof reportData.maintenances | undefined = undefined
    if (includeMaintenanceList) {
      try {
        const baseUrl = getApiBaseUrl()
        const params = new URLSearchParams()
        if (filters.status) params.set('status', filters.status)
        if (filters.assetId) params.set('assetId', filters.assetId)
        if (filters.category) params.set('category', filters.category)
        if (filters.startDate) params.set('startDate', filters.startDate)
        if (filters.endDate) params.set('endDate', filters.endDate)
        // Set a large pageSize to get all results
        params.set('pageSize', '10000')
        
        const url = `${baseUrl}/api/reports/maintenance?${params.toString()}`
        
        const token = await getAuthToken()
        const headers: HeadersInit = {}
        if (baseUrl && token) {
          headers['Authorization'] = `Bearer ${token}`
        }
        
        const response = await fetch(url, {
          credentials: 'include',
          headers,
        })
        if (response.ok) {
          const data = await response.json()
          allMaintenances = data.maintenances || []
        }
      } catch (error) {
        console.error('Failed to fetch all maintenances for PDF:', error)
        // Fall back to undefined, which will skip the maintenance list
      }
    }

    // Generate HTML for PDF
    const html = generateMaintenanceReportHTML(reportData, allMaintenances, includeMaintenanceList)

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
    a.href = url
    a.download = `maintenance-report-${new Date().toISOString().split('T')[0]}.pdf`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)

    toast.success('PDF exported successfully')
  }

  const generateMaintenanceReportHTML = (data: MaintenanceReportData, allMaintenances?: typeof data.maintenances, includeList: boolean = false) => {
    const styles = `
      body {
        font-family: Arial, sans-serif;
        margin: 40px;
        color: #333;
      }
      h1 {
        color: #2563eb;
        border-bottom: 3px solid #2563eb;
        padding-bottom: 10px;
        margin-bottom: 10px;
      }
      .subtitle {
        color: #6b7280;
        margin-bottom: 30px;
        font-size: 14px;
      }
      h2 {
        color: #1e40af;
        margin-top: 30px;
        margin-bottom: 15px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
        font-size: 12px;
      }
      th, td {
        border: 1px solid #e5e7eb;
        padding: 8px;
        text-align: left;
      }
      th {
        background-color: #f3f4f6;
        font-weight: 600;
        color: #374151;
      }
      tr:nth-child(even) {
        background-color: #f9fafb;
      }
      tr {
        page-break-inside: avoid;
      }
      .footer {
        margin-top: 40px;
        padding-top: 20px;
        border-top: 1px solid #e5e7eb;
        text-align: center;
        color: #6b7280;
        font-size: 12px;
      }
      @media print {
        body {
          margin: 20px;
        }
        table {
          page-break-inside: auto;
        }
        thead {
          display: table-header-group;
        }
      }
    `

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Maintenance Report</title>
        <style>${styles}</style>
      </head>
      <body>
        <h1>Maintenance Report</h1>
        <div class="subtitle">Assets under repair, maintenance history, costs, and upcoming schedules</div>
        
        <!-- Summary Statistics (always shown) -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px;">
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; background: #f9fafb;">
            <h3 style="margin: 0 0 5px 0; font-size: 14px; color: #6b7280;">Total Maintenances</h3>
            <div style="font-size: 24px; font-weight: bold; color: #111827;">${data.summary.totalMaintenances}</div>
          </div>
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; background: #f9fafb;">
            <h3 style="margin: 0 0 5px 0; font-size: 14px; color: #6b7280;">Under Repair</h3>
            <div style="font-size: 24px; font-weight: bold; color: #dc2626;">${data.summary.underRepair}</div>
          </div>
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; background: #f9fafb;">
            <h3 style="margin: 0 0 5px 0; font-size: 14px; color: #6b7280;">Upcoming</h3>
            <div style="font-size: 24px; font-weight: bold; color: #2563eb;">${data.summary.upcoming}</div>
          </div>
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; background: #f9fafb;">
            <h3 style="margin: 0 0 5px 0; font-size: 14px; color: #6b7280;">Completed</h3>
            <div style="font-size: 24px; font-weight: bold; color: #111827;">${data.summary.completed}</div>
          </div>
        </div>
        
        <!-- Cost by Status Cards -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px;">
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; background: #f9fafb;">
            <h3 style="margin: 0 0 5px 0; font-size: 14px; color: #6b7280;">Total Cost - Completed</h3>
            <div style="font-size: 24px; font-weight: bold; color: #111827;">${formatCurrency(data.summary.totalCostByStatus?.completed || 0)}</div>
          </div>
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; background: #f9fafb;">
            <h3 style="margin: 0 0 5px 0; font-size: 14px; color: #6b7280;">Total Cost - Scheduled</h3>
            <div style="font-size: 24px; font-weight: bold; color: #111827;">${formatCurrency(data.summary.totalCostByStatus?.scheduled || 0)}</div>
          </div>
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; background: #f9fafb;">
            <h3 style="margin: 0 0 5px 0; font-size: 14px; color: #6b7280;">Total Cost - In Progress</h3>
            <div style="font-size: 24px; font-weight: bold; color: #111827;">${formatCurrency(data.summary.totalCostByStatus?.inProgress || 0)}</div>
          </div>
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; background: #f9fafb;">
            <h3 style="margin: 0 0 5px 0; font-size: 14px; color: #6b7280;">Total Cost - Cancelled</h3>
            <div style="font-size: 24px; font-weight: bold; color: #111827;">${formatCurrency(data.summary.totalCostByStatus?.cancelled || 0)}</div>
          </div>
        </div>

        <h2>Maintenances by Status</h2>
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Count</th>
              <th>Total Cost</th>
              <th>Average Cost</th>
            </tr>
          </thead>
          <tbody>
            ${data.summary.byStatus.length === 0 ? `
              <tr>
                <td colspan="4" style="text-align: center; color: #6b7280;">No status data found</td>
              </tr>
            ` : data.summary.byStatus.map(statusItem => `
              <tr>
                <td><strong>${statusItem.status || 'Unknown'}</strong></td>
                <td>${statusItem.count}</td>
                <td>${statusItem.totalCost > 0 ? formatCurrency(statusItem.totalCost) : '-'}</td>
                <td>${statusItem.totalCost > 0 ? formatCurrency(statusItem.averageCost) : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        ${includeList && allMaintenances ? `
        <h2>Maintenance Details (${allMaintenances.length} records)</h2>
        <table>
          <thead>
            <tr>
              <th>Asset Tag</th>
              <th>Description</th>
              <th>Title</th>
              <th>Status</th>
              <th>Due Date</th>
              <th>Completed</th>
              <th>Cost</th>
              <th>Inventory Items</th>
            </tr>
          </thead>
          <tbody>
            ${allMaintenances.length === 0 ? `
              <tr>
                <td colspan="8" style="text-align: center; color: #6b7280;">No maintenance records found</td>
              </tr>
            ` : allMaintenances.map(maintenance => {
              const inventoryItemsStr = maintenance.inventoryItems && maintenance.inventoryItems.length > 0
                ? maintenance.inventoryItems.map((item: { inventoryItem: { itemCode: string; unit: string | null }; quantity: number }) => 
                    `${item.inventoryItem.itemCode} (${item.quantity} ${item.inventoryItem.unit || 'units'})`
                  ).join('; ')
                : 'N/A'
              
              return `
              <tr>
                <td><strong>${maintenance.assetTagId}</strong></td>
                <td>${maintenance.assetDescription || 'N/A'}</td>
                <td>${maintenance.title || 'N/A'}</td>
                <td>${maintenance.status || 'N/A'}</td>
                <td>${maintenance.dueDate ? format(new Date(maintenance.dueDate), 'MMM d, yyyy') : 'N/A'}</td>
                <td>${maintenance.dateCompleted ? format(new Date(maintenance.dateCompleted), 'MMM d, yyyy') : 'N/A'}</td>
                <td>${formatCurrency(maintenance.cost)}</td>
                <td>${inventoryItemsStr}</td>
              </tr>
            `
            }).join('')}
          </tbody>
        </table>
        ` : ''}

        <div class="footer">
          <p>Generated on ${format(new Date(), 'MMMM d, yyyy \'at\' h:mm a')}</p>
        </div>
      </body>
      </html>
    `
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
          <h1 className="text-2xl sm:text-3xl font-bold">
            Maintenance Reports
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm sm:text-base">
            Track assets under repair, maintenance history, costs, and upcoming schedules
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ReportFilters filters={filters} onFiltersChange={handleFiltersChange} disabled={isExporting} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading || isExporting}
            className="bg-gray-400 bg-clip-padding backdrop-filter backdrop-blur-md bg-opacity-10 border shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 sm:mr-2 ${isLoading || isFetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={isExporting || isLoading}
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

      {/* Active Filter Badges */}
      {Object.keys(filters).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap gap-2"
        >
          {filters.status && (
            <Badge variant="secondary" className="gap-1">
              Status: {filters.status}
              <button
                onClick={() => removeFilter('status')}
                className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                disabled={isExporting}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.assetId && (
            <Badge variant="secondary" className="gap-1">
              Asset: {filters.assetId}
              <button
                onClick={() => removeFilter('assetId')}
                className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                disabled={isExporting}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.category && (
            <Badge variant="secondary" className="gap-1">
              Category: {filters.category}
              <button
                onClick={() => removeFilter('category')}
                className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                disabled={isExporting}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.startDate && (
            <Badge variant="secondary" className="gap-1">
              From: {format(new Date(filters.startDate), 'MMM d, yyyy')}
              <button
                onClick={() => removeFilter('startDate')}
                className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                disabled={isExporting}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.endDate && (
            <Badge variant="secondary" className="gap-1">
              To: {format(new Date(filters.endDate), 'MMM d, yyyy')}
              <button
                onClick={() => removeFilter('endDate')}
                className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                disabled={isExporting}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </motion.div>
      )}

      {/* Report Content */}
      <AnimatePresence mode="wait">
        {!canViewAssets && !permissionsLoading ? (
          // Access denied state - only show when permissions are done loading
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-sm backdrop-saturate-150">
              <CardContent className="pt-6">
                <div className="text-center">
                  <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
                  <p className="text-muted-foreground">You do not have permission to view reports</p>
        </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : error ? (
          // Error state
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="pt-6">
                <div className="text-center text-destructive">
                  <p className="font-medium">Failed to load report data</p>
                  <p className="text-sm mt-1">Please try again or check your connection</p>
                </div>
          </CardContent>
        </Card>
          </motion.div>
        ) : (
          // Report content with loading spinner in content area
          <motion.div
            key="maintenance-report"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Maintenances Table */}
            <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-sm backdrop-saturate-150 relative flex flex-col flex-1 min-h-0 pb-0 gap-0">
              <CardHeader>
                <CardTitle>Maintenance Records</CardTitle>
                <CardDescription>
                  Complete maintenance history and status
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 px-0 relative">
                {isFetching && reportData && reportData.maintenances && reportData.maintenances.length > 0 && (
                  <div className="absolute left-0 right-[10px] top-[33px] bottom-0 bg-background/50 backdrop-blur-sm z-20 flex items-center justify-center">
                    <Spinner variant="default" size={24} className="text-muted-foreground" />
                  </div>
                )}
                {permissionsLoading || (isLoading && !reportData) ? (
                  // Loading state: show spinner in content area
                  <div className="h-[560px] pt-12 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <Spinner className="h-8 w-8" />
                      <p className="text-sm text-muted-foreground">Loading...</p>
                    </div>
                  </div>
                ) : reportData && reportData.maintenances && reportData.maintenances.length === 0 ? (
                  <div className="h-[560px] pt-12 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <p className="text-sm">No maintenance records found</p>
                    </div>
                  </div>
                ) : reportData ? (
                <div className="h-[560px] pt-8">
                  <div className="min-w-full">
                    <ScrollArea className="h-[528px] relative">
                      <div className="sticky top-0 z-30 h-px bg-border w-full"></div>
                      <div className="pr-2.5 relative after:content-[''] after:absolute after:right-[10px] after:top-0 after:bottom-0 after:w-px after:bg-border after:z-50 after:h-full">
                        <Table className="border-b">
                          <TableHeader className="sticky -top-1 z-20 bg-card [&_tr]:border-b-0 -mr-2.5">
                            <TableRow className="group hover:bg-muted/50 relative border-b-0 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-[1.5px] after:h-px after:bg-border after:z-30">
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Asset Tag</TableHead>
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Description</TableHead>
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Title</TableHead>
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Status</TableHead>
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Due Date</TableHead>
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Completed</TableHead>
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Cost</TableHead>
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Inventory Items</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {reportData.maintenances.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center">
                                  No maintenance records found
                                </TableCell>
                              </TableRow>
                            ) : (
                              reportData.maintenances.map((maintenance) => (
                                <TableRow key={maintenance.id} className="group relative hover:bg-muted/90 border-b transition-colors">
                                  <TableCell className="font-medium">{maintenance.assetTagId}</TableCell>
                                  <TableCell className="max-w-[200px]">
                                    <div className="truncate" title={maintenance.assetDescription || ''}>
                                      {maintenance.assetDescription}
                                    </div>
                                  </TableCell>
                                  <TableCell>{maintenance.title}</TableCell>
                                  <TableCell>
                                    {maintenance.isOverdue ? (
                                      <Badge variant="destructive">Overdue</Badge>
                                    ) : maintenance.isUpcoming ? (
                                      <Badge variant="default">Upcoming</Badge>
                                    ) : (
                                      <Badge variant="secondary">{maintenance.status}</Badge>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {maintenance.dueDate
                                      ? format(new Date(maintenance.dueDate), 'MMM d, yyyy')
                                      : 'N/A'}
                                  </TableCell>
                                  <TableCell>
                                    {maintenance.dateCompleted
                                      ? format(new Date(maintenance.dateCompleted), 'MMM d, yyyy')
                                      : 'N/A'}
                                  </TableCell>
                                  <TableCell>
                                    {maintenance.cost ? formatCurrency(maintenance.cost) : 'N/A'}
                                  </TableCell>
                                  <TableCell>
                                    {maintenance.inventoryItems && maintenance.inventoryItems.length > 0 ? (
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
                                            <div className="flex flex-col gap-1 items-start">
                                              <Badge variant="outline" className="text-xs w-fit">
                                                <Package className="h-3 w-3 mr-1" />
                                                {maintenance.inventoryItems.length} {maintenance.inventoryItems.length === 1 ? 'item' : 'items'}
                                              </Badge>
                                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                {maintenance.inventoryItems.slice(0, 2).map((item, idx) => (
                                                  <span key={item.id}>
                                                    {item.inventoryItem.itemCode}
                                                    {idx < Math.min(maintenance.inventoryItems!.length, 2) - 1 && ', '}
                                                  </span>
                                                ))}
                                                {maintenance.inventoryItems.length > 2 && ` +${maintenance.inventoryItems.length - 2} more`}
                                                <ChevronDown className="h-3 w-3 ml-1" />
                                              </div>
                                            </div>
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-80" align="start">
                                          <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                              <Package className="h-4 w-4 text-muted-foreground" />
                                              <h4 className="font-semibold text-sm">Inventory Items Used</h4>
                                            </div>
                                            <Separator />
                                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                              {maintenance.inventoryItems.map((item, index) => (
                                                <div key={item.id}>
                                                  <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1">
                                                      <div className="font-medium text-sm">{item.inventoryItem.itemCode}</div>
                                                      <div className="text-xs text-muted-foreground">{item.inventoryItem.name}</div>
                                                    </div>
                                                    <div className="text-right">
                                                      <div className="text-sm font-medium">
                                                        {item.quantity} {item.inventoryItem.unit || 'units'}
                                                      </div>
                                                      {item.unitCost && (
                                                        <div className="text-xs text-muted-foreground">
                                                          ₱{new Intl.NumberFormat('en-US', {
                                                            minimumFractionDigits: 2,
                                                            maximumFractionDigits: 2,
                                                          }).format(item.unitCost)} each
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                  {index < maintenance.inventoryItems!.length - 1 && <Separator className="my-2" />}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        </PopoverContent>
                                      </Popover>
                                    ) : (
                                      <span className="text-sm text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                      <ScrollBar orientation="horizontal" />
                      <ScrollBar orientation="vertical" className="z-50" />
                    </ScrollArea>
                  </div>
                </div>
                  ) : null}
              </CardContent>
                
                {/* Pagination Bar - Fixed at Bottom */}
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
            </Card>
          </motion.div>
      )}
      </AnimatePresence>

      {/* Export Confirmation Dialog */}
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        reportType="Maintenance Report - Assets Under Repair and Maintenance History"
        reportTypeIcon={FileText}
        exportFormat={pendingExportFormat}
        filters={filters as Record<string, string | boolean | null | undefined>}
        includeList={includeMaintenanceList}
        onIncludeListChange={setIncludeMaintenanceList}
        includeListLabel="Include Maintenance List"
        includeListDescription="When checked, the export will include a detailed table of all maintenance records. Unchecked by default - only summary statistics will be exported."
        exportDescription={(format, includeList) => {
          if (format === 'pdf') {
            return `This will export summary statistics with status breakdowns. ${includeList ? 'Maintenance details table will be included.' : 'Maintenance details table will not be included.'}`
          }
          return `This will export summary statistics with status breakdowns. ${includeList ? 'Maintenance details table with complete data will be included.' : 'Only summary statistics will be exported (no maintenance list).'}`
        }}
        isExporting={isExporting}
        onConfirm={handleConfirmExport}
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

export default function MaintenanceReportsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-10 w-32 bg-muted animate-pulse rounded" />
        </div>
        <div className="h-96 bg-muted animate-pulse rounded" />
      </div>
    }>
      <MaintenanceReportsPageContent />
    </Suspense>
  )
}

