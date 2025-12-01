'use client'

import { useState, useMemo, useCallback } from 'react'
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
import { CheckoutReportFilters } from '@/components/checkout-report-filters'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

interface CheckoutReportData {
  summary: {
    totalActive: number
    totalOverdue: number
    totalHistorical: number
    byEmployee: Array<{
      employeeId: string
      employeeName: string
      employeeEmail: string
      department: string | null
      count: number
      overdueCount: number
    }>
    byDepartment: Array<{
      department: string
      count: number
      overdueCount: number
      employeeCount: number
    }>
  }
  checkouts: Array<{
    id: string
    assetTagId: string
    assetDescription: string
    assetStatus: string | null
    assetCost: number | null
    category: string | null
    subCategory: string | null
    checkoutDate: string
    expectedReturnDate: string | null
    returnDate: string | null
    isOverdue: boolean
    employeeName: string
    employeeEmail: string
    employeeDepartment: string | null
    location: string | null
    site: string | null
  }>
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

interface ReportFilters {
  employeeId?: string
  dueDate?: string
  isOverdue?: boolean
  location?: string
  site?: string
  department?: string
  startDate?: string
  endDate?: string
}

export default function CheckoutReportsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canViewAssets = hasPermission('canViewAssets')
  
  // Get page and pageSize from URL
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)
  
  const [filters, setFilters] = useState<ReportFilters>({})
  const [isExporting, setIsExporting] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [pendingExportFormat, setPendingExportFormat] = useState<'csv' | 'excel' | 'pdf' | null>(null)
  const [includeCheckoutList, setIncludeCheckoutList] = useState(false)
  
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
    if (filters.employeeId) params.set('employeeId', filters.employeeId)
    if (filters.dueDate) params.set('dueDate', filters.dueDate)
    if (filters.isOverdue) params.set('isOverdue', 'true')
    if (filters.location) params.set('location', filters.location)
    if (filters.site) params.set('site', filters.site)
    if (filters.department) params.set('department', filters.department)
    if (filters.startDate) params.set('startDate', filters.startDate)
    if (filters.endDate) params.set('endDate', filters.endDate)
    // Add pagination
    if (page > 1) params.set('page', page.toString())
    if (pageSize !== 50) params.set('pageSize', pageSize.toString())
    return params.toString()
  }, [filters, page, pageSize])

  // Fetch report data
  const { data: reportData, isLoading, error, refetch } = useQuery<CheckoutReportData>({
    queryKey: ['checkout-report', queryString, page, pageSize],
    queryFn: async () => {
      const response = await fetch(`/api/reports/checkout?${queryString}`)
      if (!response.ok) {
        throw new Error('Failed to fetch checkout report data')
      }
      return response.json()
    },
    enabled: canViewAssets && !permissionsLoading,
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
    // Reset to page 1 when filter changes
    if (page > 1) {
      updateURL({ page: 1 })
    }
  }

  // Export handlers
  const handleExportClick = (format: 'csv' | 'excel' | 'pdf') => {
    setPendingExportFormat(format)
    // Reset includeCheckoutList when opening dialog
    setIncludeCheckoutList(false)
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
    if (filters.employeeId) params.set('employeeId', filters.employeeId)
    if (filters.dueDate) params.set('dueDate', filters.dueDate)
    if (filters.isOverdue) params.set('isOverdue', 'true')
    if (filters.location) params.set('location', filters.location)
    if (filters.site) params.set('site', filters.site)
    if (filters.department) params.set('department', filters.department)
    if (filters.startDate) params.set('startDate', filters.startDate)
    if (filters.endDate) params.set('endDate', filters.endDate)
    // Add includeCheckoutList parameter
    params.set('includeCheckoutList', includeCheckoutList.toString())

    const response = await fetch(`/api/reports/checkout/export?${params.toString()}`)
    
    if (!response.ok) {
      throw new Error('Export failed')
    }

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `checkout-report-${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'xlsx'}`
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

    // Fetch all checkouts for PDF export only if includeCheckoutList is checked
    let allCheckouts: typeof reportData.checkouts | undefined = undefined
    if (includeCheckoutList) {
      try {
        const params = new URLSearchParams()
        // Remove pagination to get all results
        if (filters.employeeId) params.set('employeeId', filters.employeeId)
        if (filters.dueDate) params.set('dueDate', filters.dueDate)
        if (filters.isOverdue) params.set('isOverdue', 'true')
        if (filters.location) params.set('location', filters.location)
        if (filters.site) params.set('site', filters.site)
        if (filters.department) params.set('department', filters.department)
        if (filters.startDate) params.set('startDate', filters.startDate)
        if (filters.endDate) params.set('endDate', filters.endDate)
        // Set a large pageSize to get all results
        params.set('pageSize', '10000')
        
        const response = await fetch(`/api/reports/checkout?${params.toString()}`)
        if (response.ok) {
          const data = await response.json()
          allCheckouts = data.checkouts || []
        }
      } catch (error) {
        console.error('Failed to fetch all checkouts for PDF:', error)
        // Fall back to undefined, which will skip the checkout list
      }
    }

    // Generate HTML for PDF
    const html = generateCheckoutReportHTML(reportData, allCheckouts, includeCheckoutList)

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
    a.download = `checkout-report-${new Date().toISOString().split('T')[0]}.pdf`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)

    toast.success('Report exported successfully as PDF')
  }

  const generateCheckoutReportHTML = (data: CheckoutReportData, allCheckouts?: typeof data.checkouts, includeList: boolean = false) => {
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
        <title>Checkout Report</title>
        <style>${styles}</style>
      </head>
      <body>
        <h1>Checkout Report</h1>
        <div class="subtitle">Currently checked-out assets and their details</div>
        
        <!-- Summary Statistics (always shown) -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px;">
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; background: #f9fafb;">
            <h3 style="margin: 0 0 5px 0; font-size: 14px; color: #6b7280;">Total Active</h3>
            <div style="font-size: 24px; font-weight: bold; color: #111827;">${data.summary.totalActive}</div>
          </div>
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; background: #f9fafb;">
            <h3 style="margin: 0 0 5px 0; font-size: 14px; color: #6b7280;">Total Value</h3>
            <div style="font-size: 24px; font-weight: bold; color: #111827;">${formatCurrency((() => {
              const allCheckoutsForCalc = allCheckouts || data.checkouts || []
              return allCheckoutsForCalc.reduce((sum, c) => sum + (c.assetCost || 0), 0)
            })())}</div>
          </div>
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; background: #f9fafb;">
            <h3 style="margin: 0 0 5px 0; font-size: 14px; color: #6b7280;">Overdue</h3>
            <div style="font-size: 24px; font-weight: bold; color: #dc2626;">${data.summary.totalOverdue}</div>
          </div>
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; background: #f9fafb;">
            <h3 style="margin: 0 0 5px 0; font-size: 14px; color: #6b7280;">Historical</h3>
            <div style="font-size: 24px; font-weight: bold; color: #111827;">${data.summary.totalHistorical}</div>
          </div>
        </div>

        <h2>Checkouts by Employee</h2>
        <table>
          <thead>
            <tr>
              <th>Employee Name</th>
              <th>Email</th>
              <th>Department</th>
              <th>Total Checkouts</th>
              <th>Overdue</th>
              <th>Total Value</th>
            </tr>
          </thead>
          <tbody>
            ${data.summary.byEmployee.length === 0 ? `
              <tr>
                <td colspan="6" style="text-align: center; color: #6b7280;">No employee checkouts found</td>
              </tr>
            ` : data.summary.byEmployee.map(emp => {
              const allCheckoutsForCalc = allCheckouts || data.checkouts || []
              const empCheckouts = allCheckoutsForCalc.filter(c => c.employeeName === emp.employeeName)
              const empValue = empCheckouts.reduce((sum, c) => sum + (c.assetCost || 0), 0)
              return `
              <tr>
                <td><strong>${emp.employeeName || 'Unknown'}</strong></td>
                <td>${emp.employeeEmail || 'N/A'}</td>
                <td>${emp.department || 'N/A'}</td>
                <td>${emp.count}</td>
                <td>${emp.overdueCount}</td>
                <td>${formatCurrency(empValue)}</td>
              </tr>
            `
            }).join('')}
          </tbody>
        </table>

        <h2>Checkouts by Department</h2>
        <table>
          <thead>
            <tr>
              <th>Department</th>
              <th>Total Checkouts</th>
              <th>Overdue</th>
              <th>Employees</th>
              <th>Total Value</th>
            </tr>
          </thead>
          <tbody>
            ${data.summary.byDepartment.length === 0 ? `
              <tr>
                <td colspan="5" style="text-align: center; color: #6b7280;">No department checkouts found</td>
              </tr>
            ` : data.summary.byDepartment.map(dept => {
              const allCheckoutsForCalc = allCheckouts || data.checkouts || []
              const deptCheckouts = allCheckoutsForCalc.filter(c => c.employeeDepartment === dept.department)
              const deptValue = deptCheckouts.reduce((sum, c) => sum + (c.assetCost || 0), 0)
              return `
              <tr>
                <td><strong>${dept.department || 'Unknown'}</strong></td>
                <td>${dept.count}</td>
                <td>${dept.overdueCount}</td>
                <td>${dept.employeeCount}</td>
                <td>${formatCurrency(deptValue)}</td>
              </tr>
            `
            }).join('')}
          </tbody>
        </table>
        
        ${includeList && allCheckouts ? `
        <h2>Checkout Details (${allCheckouts.length} checkouts)</h2>
        <table>
          <thead>
            <tr>
              <th>Asset Tag ID</th>
              <th>Description</th>
              <th>Category</th>
              <th>SUB-CATEGORY</th>
              <th>Check-out Date</th>
              <th>Due date</th>
              <th>Return Date</th>
              <th>Department</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            ${allCheckouts.length === 0 ? `
              <tr>
                <td colspan="9" style="text-align: center; color: #6b7280;">No active checkouts found</td>
              </tr>
            ` : allCheckouts.map(checkout => `
              <tr>
                <td><strong>${checkout.assetTagId}</strong></td>
                <td>${checkout.assetDescription || 'N/A'}</td>
                <td>${checkout.category || 'N/A'}</td>
                <td>${checkout.subCategory || 'N/A'}</td>
                <td>${format(new Date(checkout.checkoutDate), 'MMM d, yyyy')}</td>
                <td>${checkout.expectedReturnDate ? format(new Date(checkout.expectedReturnDate), 'MMM d, yyyy') : 'N/A'}</td>
                <td>${checkout.returnDate ? format(new Date(checkout.returnDate), 'MMM d, yyyy') : 'N/A'}</td>
                <td>${checkout.employeeDepartment || 'N/A'}</td>
                <td>${checkout.assetCost ? formatCurrency(checkout.assetCost) : 'N/A'}</td>
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

  if (!canViewAssets) {
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
              <p className="text-muted-foreground">You do not have permission to view reports</p>
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
            Checkout Reports
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm sm:text-base">
            Track currently checked-out assets, overdue items, and checkout history
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <CheckoutReportFilters filters={filters} onFiltersChange={handleFiltersChange} disabled={isExporting} />
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
          {filters.employeeId && (
            <Badge variant="secondary" className="gap-1">
              Employee: {reportData?.summary.byEmployee.find(e => e.employeeId === filters.employeeId)?.employeeName || filters.employeeId}
              <button
                onClick={() => removeFilter('employeeId')}
                className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                disabled={isExporting}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.dueDate && (
            <Badge variant="secondary" className="gap-1">
              Due Date: {format(new Date(filters.dueDate), 'MMM d, yyyy')}
              <button
                onClick={() => removeFilter('dueDate')}
                className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                disabled={isExporting}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.isOverdue && (
            <Badge variant="secondary" className="gap-1">
              Past Due Only
              <button
                onClick={() => removeFilter('isOverdue')}
                className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                disabled={isExporting}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.location && (
            <Badge variant="secondary" className="gap-1">
              Location: {filters.location}
              <button
                onClick={() => removeFilter('location')}
                className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                disabled={isExporting}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.site && (
            <Badge variant="secondary" className="gap-1">
              Site: {filters.site}
              <button
                onClick={() => removeFilter('site')}
                className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                disabled={isExporting}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.department && (
            <Badge variant="secondary" className="gap-1">
              Department: {filters.department}
              <button
                onClick={() => removeFilter('department')}
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
            key="checkout-report"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Checkouts Table */}
            <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-sm backdrop-saturate-150 relative flex flex-col flex-1 min-h-0 pb-0 gap-0">
              <CardHeader>
                <CardTitle>Active Checkouts</CardTitle>
                <CardDescription>
                  Currently checked-out assets and their details
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
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Asset Tag ID</TableHead>
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Description</TableHead>
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Category</TableHead>
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">SUB-CATEGORY</TableHead>
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Check-out Date</TableHead>
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Due date</TableHead>
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Return Date</TableHead>
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Department</TableHead>
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Cost</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {reportData.checkouts.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={9} className="h-24 text-center">
                                  No active checkouts found
                                </TableCell>
                              </TableRow>
                            ) : (
                              reportData.checkouts.map((checkout) => (
                                <TableRow key={checkout.id} className="group relative hover:bg-muted/90 border-b transition-colors">
                                  <TableCell className="font-medium">{checkout.assetTagId}</TableCell>
                                  <TableCell className="max-w-[200px]">
                                    <div className="truncate" title={checkout.assetDescription}>
                                      {checkout.assetDescription}
                                    </div>
                                  </TableCell>
                                  <TableCell>{checkout.category || 'N/A'}</TableCell>
                                  <TableCell>{checkout.subCategory || 'N/A'}</TableCell>
                                  <TableCell>
                                    {format(new Date(checkout.checkoutDate), 'MMM d, yyyy')}
                                  </TableCell>
                                  <TableCell>
                                    {checkout.expectedReturnDate
                                      ? format(new Date(checkout.expectedReturnDate), 'MMM d, yyyy')
                                      : 'N/A'}
                                  </TableCell>
                                  <TableCell>
                                    {checkout.returnDate
                                      ? format(new Date(checkout.returnDate), 'MMM d, yyyy')
                                      : 'N/A'}
                                  </TableCell>
                                  <TableCell>{checkout.employeeDepartment || 'N/A'}</TableCell>
                                  <TableCell>
                                    {checkout.assetCost ? formatCurrency(checkout.assetCost) : 'N/A'}
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
        </AnimatePresence>
      )}

      {/* Export Confirmation Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="bg-white/10 dark:bg-white/5 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-sm backdrop-saturate-150">
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
                  Checkout Report - Active and Historical Checkouts
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
                  <p className="text-sm text-muted-foreground">No filters applied - All checkouts will be included</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {filters.employeeId && (
                      <Badge variant="outline" className="text-xs">
                        Employee: {filters.employeeId}
                      </Badge>
                    )}
                    {filters.dueDate && (
                      <Badge variant="outline" className="text-xs">
                        Due Date: {format(new Date(filters.dueDate), 'MMM d, yyyy')}
                      </Badge>
                    )}
                    {filters.isOverdue && (
                      <Badge variant="outline" className="text-xs">
                        Past Due Only
                      </Badge>
                    )}
                    {filters.location && (
                      <Badge variant="outline" className="text-xs">
                        Location: {filters.location}
                      </Badge>
                    )}
                    {filters.site && (
                      <Badge variant="outline" className="text-xs">
                        Site: {filters.site}
                      </Badge>
                    )}
                    {filters.department && (
                      <Badge variant="outline" className="text-xs">
                        Department: {filters.department}
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

            {/* Include Checkout List Option (for PDF, CSV, Excel) */}
            {pendingExportFormat && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2 p-3 rounded-lg border border-border bg-muted/30">
                  <Checkbox
                    id="include-checkout-list"
                    checked={includeCheckoutList}
                    onCheckedChange={(checked) => setIncludeCheckoutList(checked === true)}
                  />
                  <Label
                    htmlFor="include-checkout-list"
                    className="text-sm font-medium cursor-pointer flex-1"
                  >
                    Include Checkout List
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground pl-3">
                  When checked, the export will include a detailed table of all checkouts. Unchecked by default - only summary statistics will be exported.
                </p>
              </div>
            )}

            {/* Export Description */}
            <div className="bg-muted/50 p-3 rounded-lg text-sm">
              <p className="text-muted-foreground">
                {(pendingExportFormat === 'csv' || pendingExportFormat === 'excel') && (
                  <>This will export summary statistics with employee and department breakdowns. {includeCheckoutList ? 'Checkout details table with complete data will be included.' : 'Only summary statistics will be exported (no checkout list).'}</>
                )}
                {pendingExportFormat === 'pdf' && (
                  <>This will export summary statistics with employee and department breakdowns. {includeCheckoutList ? 'Checkout details table will be included.' : 'Checkout details table will not be included.'}</>
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

