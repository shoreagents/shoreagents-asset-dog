'use client'

import { useState, useMemo, useCallback } from 'react'
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
  Filter
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
import { ReportFilters } from '@/components/report-filters'
import { format } from 'date-fns'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface MaintenanceReportData {
  summary: {
    totalMaintenances: number
    underRepair: number
    upcoming: number
    completed: number
    totalCost: number
    averageCost: number
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

export default function MaintenanceReportsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canManageMaintenance = hasPermission('canManageMaintenance')
  
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
  const { data: reportData, isLoading, error, refetch } = useQuery<MaintenanceReportData>({
    queryKey: ['maintenance-report', queryString, page, pageSize],
    queryFn: async () => {
      const response = await fetch(`/api/reports/maintenance?${queryString}`)
      if (!response.ok) {
        throw new Error('Failed to fetch maintenance report data')
      }
      return response.json()
    },
    enabled: canManageMaintenance && !permissionsLoading,
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
    const params = new URLSearchParams()
    params.set('format', format)
    if (filters.status) params.set('status', filters.status)
    if (filters.assetId) params.set('assetId', filters.assetId)
    if (filters.category) params.set('category', filters.category)
    if (filters.startDate) params.set('startDate', filters.startDate)
    if (filters.endDate) params.set('endDate', filters.endDate)
    if (includeMaintenanceList) params.set('includeMaintenanceList', 'true')

    const response = await fetch(`/api/reports/maintenance/export?${params.toString()}`)
    
    if (!response.ok) {
      throw new Error('Export failed')
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `maintenance-report-${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'xlsx'}`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
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
        const params = new URLSearchParams()
        if (filters.status) params.set('status', filters.status)
        if (filters.assetId) params.set('assetId', filters.assetId)
        if (filters.category) params.set('category', filters.category)
        if (filters.startDate) params.set('startDate', filters.startDate)
        if (filters.endDate) params.set('endDate', filters.endDate)
        // Set a large pageSize to get all results
        params.set('pageSize', '10000')
        
        const response = await fetch(`/api/reports/maintenance?${params.toString()}`)
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
            <h3 style="margin: 0 0 5px 0; font-size: 14px; color: #6b7280;">Total Cost</h3>
            <div style="font-size: 24px; font-weight: bold; color: #111827;">${formatCurrency(data.summary.totalCost)}</div>
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
                <td>${formatCurrency(statusItem.totalCost)}</td>
                <td>${formatCurrency(statusItem.averageCost)}</td>
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
              <th>Maintenance By</th>
            </tr>
          </thead>
          <tbody>
            ${allMaintenances.length === 0 ? `
              <tr>
                <td colspan="8" style="text-align: center; color: #6b7280;">No maintenance records found</td>
              </tr>
            ` : allMaintenances.map(maintenance => `
              <tr>
                <td><strong>${maintenance.assetTagId}</strong></td>
                <td>${maintenance.assetDescription || 'N/A'}</td>
                <td>${maintenance.title || 'N/A'}</td>
                <td>${maintenance.status || 'N/A'}</td>
                <td>${maintenance.dueDate ? format(new Date(maintenance.dueDate), 'MMM d, yyyy') : 'N/A'}</td>
                <td>${maintenance.dateCompleted ? format(new Date(maintenance.dateCompleted), 'MMM d, yyyy') : 'N/A'}</td>
                <td>${formatCurrency(maintenance.cost)}</td>
                <td>${maintenance.maintenanceBy || 'N/A'}</td>
              </tr>
            `).join('')}
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

  if (permissionsLoading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center justify-center min-h-[400px]"
      >
        <Spinner className="h-8 w-8" />
      </motion.div>
    )
  }

  if (!canManageMaintenance) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-center min-h-[400px]"
      >
        <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-sm backdrop-saturate-150">
          <CardContent className="pt-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
              <p className="text-muted-foreground">You do not have permission to view maintenance reports</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
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
            className="bg-white/10 dark:bg-white/5 backdrop-blur-2xl border-white/30 dark:border-white/10 hover:bg-white/20 dark:hover:bg-white/10 shadow-sm backdrop-saturate-150"
          >
            <RefreshCw className={`h-4 w-4 sm:mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={isExporting || isLoading}
                className="bg-white/10 dark:bg-white/5 backdrop-blur-2xl border-white/30 dark:border-white/10 hover:bg-white/20 dark:hover:bg-white/10 shadow-sm backdrop-saturate-150"
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

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center min-h-[400px]">
          <Spinner className="h-8 w-8" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load report data. Please try again.</p>
          </CardContent>
        </Card>
      )}

      {/* Report Content */}
      {!isLoading && !error && reportData && (
        <AnimatePresence mode="wait">
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
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Maintenance By</TableHead>
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
                                  <TableCell>{maintenance.maintenanceBy || 'N/A'}</TableCell>
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
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Export Confirmation Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="bg-white/10 dark:bg-white/5 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-sm backdrop-saturate-150 max-w-2xl!">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Confirm Export
            </DialogTitle>
            <DialogDescription>
              Review your export settings before downloading
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Report Type */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Report Type
              </h4>
              <div className="pl-6">
                <Badge variant="default" className="text-sm">
                  Maintenance Report - Assets Under Repair and Maintenance History
                </Badge>
              </div>
            </div>

            {/* Export Format */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Export Format
              </h4>
              <div className="pl-6">
                <Badge variant="secondary" className="text-sm uppercase">
                  {pendingExportFormat}
                </Badge>
              </div>
            </div>

            {/* Active Filters */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Active Filters
              </h4>
              <div className="pl-6 space-y-1">
                {Object.keys(filters).length === 0 || !Object.values(filters).some(v => v) ? (
                  <p className="text-sm text-muted-foreground">No filters applied - All maintenances will be included</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {filters.status && (
                      <Badge variant="outline" className="text-xs">
                        Status: {filters.status}
                      </Badge>
                    )}
                    {filters.assetId && (
                      <Badge variant="outline" className="text-xs">
                        Asset: {filters.assetId}
                      </Badge>
                    )}
                    {filters.category && (
                      <Badge variant="outline" className="text-xs">
                        Category: {filters.category}
                      </Badge>
                    )}
                    {filters.startDate && (
                      <Badge variant="outline" className="text-xs">
                        From: {format(new Date(filters.startDate), 'MMM d, yyyy')}
                      </Badge>
                    )}
                    {filters.endDate && (
                      <Badge variant="outline" className="text-xs">
                        To: {format(new Date(filters.endDate), 'MMM d, yyyy')}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Include Maintenance List Option (for PDF, CSV, Excel) */}
            {pendingExportFormat && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2 p-3 rounded-lg border border-border bg-muted/30">
                  <Checkbox
                    id="include-maintenance-list"
                    checked={includeMaintenanceList}
                    onCheckedChange={(checked) => setIncludeMaintenanceList(checked === true)}
                  />
                  <Label
                    htmlFor="include-maintenance-list"
                    className="text-sm font-medium cursor-pointer flex-1"
                  >
                    Include Maintenance List
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground pl-3">
                  When checked, the export will include a detailed table of all maintenance records. Unchecked by default - only summary statistics will be exported.
                </p>
              </div>
            )}

            {/* Export Description */}
            <div className="bg-muted/50 p-3 rounded-lg text-sm">
              <p className="text-muted-foreground">
                {(pendingExportFormat === 'csv' || pendingExportFormat === 'excel') && (
                  <>This will export summary statistics with status breakdowns. {includeMaintenanceList ? 'Maintenance details table with complete data will be included.' : 'Only summary statistics will be exported (no maintenance list).'}</>
                )}
                {pendingExportFormat === 'pdf' && (
                  <>This will export summary statistics with status breakdowns. {includeMaintenanceList ? 'Maintenance details table will be included.' : 'Maintenance details table will not be included.'}</>
                )}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowExportDialog(false)
                setPendingExportFormat(null)
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmExport} disabled={isExporting}>
              {isExporting ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

