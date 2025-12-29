'use client'

import { useState, useMemo, useCallback, useEffect, Suspense } from 'react'
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
  ClipboardCheck,
  Filter
} from 'lucide-react'
import { useMobileDock } from '@/components/mobile-dock-provider'
import { useMobilePagination } from '@/components/mobile-pagination-provider'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { AuditReportFilters } from '@/components/reports/audit-report-filters'
import { format } from 'date-fns'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
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
import { cn } from '@/lib/utils'

interface AuditReportData {
  audits: Array<{
    id: string
    assetTagId: string
    category: string | null
    subCategory: string | null
    auditName: string
    auditedToSite: string | null
    auditedToLocation: string | null
    lastAuditDate: string
    auditBy: string | null
  }>
  pagination: {
    total: number
    page: number
    pageSize: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
}

interface ReportFilters {
  category?: string
  auditType?: string
  location?: string
  site?: string
  auditor?: string
  startDate?: string
  endDate?: string
}

function AuditReportsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canViewAssets = hasPermission('canViewAssets')
  const canManageReports = hasPermission('canManageReports')
  
  const isMobile = useIsMobile()
  const { setDockContent } = useMobileDock()
  const { setPaginationContent } = useMobilePagination()
  
  // Get page and pageSize from URL
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)
  
  const [filters, setFilters] = useState<ReportFilters>({})
  const [isExporting, setIsExporting] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [pendingExportFormat, setPendingExportFormat] = useState<'csv' | 'excel' | 'pdf' | null>(null)
  const [includeAuditList, setIncludeAuditList] = useState(false)
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false)

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
    if (filters.category) params.set('category', filters.category)
    if (filters.auditType) params.set('auditType', filters.auditType)
    if (filters.location) params.set('location', filters.location)
    if (filters.site) params.set('site', filters.site)
    if (filters.auditor) params.set('auditor', filters.auditor)
    if (filters.startDate) params.set('startDate', filters.startDate)
    if (filters.endDate) params.set('endDate', filters.endDate)
    if (page > 1) params.set('page', page.toString())
    if (pageSize !== 50) params.set('pageSize', pageSize.toString())
    return params.toString()
  }, [filters, page, pageSize])

  // Fetch audit data
  const { data, isLoading, isFetching, error, refetch } = useQuery<AuditReportData>({
    queryKey: ['audit-reports', queryString, page, pageSize],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/reports/audit?${queryString}`
      
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
        throw new Error(error.detail || error.error || 'Failed to fetch audit reports')
      }
      return response.json()
    },
    enabled: canViewAssets, // Only fetch if user has permission
    placeholderData: (previousData) => previousData,
  })

  const audits = data?.audits || []
  const pagination = data?.pagination

  // Remove individual filter
  const removeFilter = (filterKey: keyof ReportFilters) => {
    setFilters(prev => {
      const newFilters = { ...prev }
      delete newFilters[filterKey]
      return newFilters
    })
  }

  // Export handlers
  const handleExportClick = useCallback((format: 'csv' | 'excel' | 'pdf') => {
    if (!canManageReports) {
      return // Silent return - button is disabled, but keep as safety net
    }
    setPendingExportFormat(format)
    setIncludeAuditList(false)
    setShowExportDialog(true)
  }, [canManageReports])

  const handlePageSizeChange = useCallback((newPageSize: string) => {
    updateURL({ pageSize: parseInt(newPageSize), page: 1 })
  }, [updateURL])

  const handlePageChange = useCallback((newPage: number) => {
    updateURL({ page: newPage })
  }, [updateURL])

  const handleDataExport = async (format: 'csv' | 'excel') => {
    const baseUrl = getApiBaseUrl()
    const params = new URLSearchParams()
    params.set('format', format)
    if (filters.category) params.set('category', filters.category)
    if (filters.auditType) params.set('auditType', filters.auditType)
    if (filters.location) params.set('location', filters.location)
    if (filters.site) params.set('site', filters.site)
    if (filters.auditor) params.set('auditor', filters.auditor)
    if (filters.startDate) params.set('startDate', filters.startDate)
    if (filters.endDate) params.set('endDate', filters.endDate)
    if (includeAuditList) params.set('includeAuditList', 'true')

    const url = `${baseUrl}/api/reports/audit/export?${params.toString()}`
    
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
    a.download = `audit-report-${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'xlsx'}`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(downloadUrl)
    document.body.removeChild(a)

    toast.success(`Report exported successfully as ${format.toUpperCase()}`)
  }

  const handlePDFExport = async () => {
    if (!data) {
      toast.error('No report data available')
      return
    }

    // Use FastAPI backend PDF export
    const baseUrl = getApiBaseUrl()
    const params = new URLSearchParams()
    params.set('format', 'pdf')
    if (filters.category) params.set('category', filters.category)
    if (filters.auditType) params.set('auditType', filters.auditType)
    if (filters.location) params.set('location', filters.location)
    if (filters.site) params.set('site', filters.site)
    if (filters.auditor) params.set('auditor', filters.auditor)
    if (filters.startDate) params.set('startDate', filters.startDate)
    if (filters.endDate) params.set('endDate', filters.endDate)
    if (includeAuditList) params.set('includeAuditList', 'true')

    const url = `${baseUrl}/api/reports/audit/export?${params.toString()}`
    
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
      throw new Error(error.detail || error.error || 'PDF generation failed')
    }

    const blob = await response.blob()
    const downloadUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = `audit-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(downloadUrl)
    document.body.removeChild(a)

    toast.success('Report exported successfully as PDF')
  }

  const generateAuditReportHTML = (reportData: AuditReportData, allAudits?: typeof audits, includeList: boolean = false) => {
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

    const displayAudits = allAudits || audits
    const uniqueAuditTypes = new Set(displayAudits.map(a => a.auditName))
    const auditsByType = Array.from(uniqueAuditTypes).map(type => {
      const typeAudits = displayAudits.filter(a => a.auditName === type)
      return {
        auditType: type,
        count: typeAudits.length,
      }
    })

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Audit Report</title>
        <style>${styles}</style>
      </head>
      <body>
        <h1>Audit Report</h1>
        <div class="subtitle">Asset audit history and tracking</div>
        
        <!-- Summary Statistics (always shown) -->
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px;">
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; background: #f9fafb;">
            <h3 style="margin: 0 0 5px 0; font-size: 14px; color: #6b7280;">Total Audits</h3>
            <div style="font-size: 24px; font-weight: bold; color: #111827;">${displayAudits.length}</div>
          </div>
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; background: #f9fafb;">
            <h3 style="margin: 0 0 5px 0; font-size: 14px; color: #6b7280;">Unique Audit Types</h3>
            <div style="font-size: 24px; font-weight: bold; color: #111827;">${uniqueAuditTypes.size}</div>
          </div>
        </div>

        <h2>Audits by Type</h2>
        <table>
          <thead>
            <tr>
              <th>Audit Type</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            ${auditsByType.length === 0 ? `
              <tr>
                <td colspan="2" style="text-align: center; color: #6b7280;">No audit types found</td>
              </tr>
            ` : auditsByType.map(item => `
              <tr>
                <td><strong>${item.auditType}</strong></td>
                <td>${item.count}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${includeList ? `
        <h2>Audit Records</h2>
        <table>
          <thead>
            <tr>
              <th>Asset Tag ID</th>
              <th>Category</th>
              <th>Sub-Category</th>
              <th>Audit Type</th>
              <th>Audited to Site</th>
              <th>Audited to Location</th>
              <th>Last Audit Date</th>
              <th>Audit By</th>
            </tr>
          </thead>
          <tbody>
            ${displayAudits.length === 0 ? `
              <tr>
                <td colspan="8" style="text-align: center; color: #6b7280;">No audit records found</td>
              </tr>
            ` : displayAudits.map(audit => `
              <tr>
                <td>${audit.assetTagId}</td>
                <td>${audit.category || 'N/A'}</td>
                <td>${audit.subCategory || 'N/A'}</td>
                <td>${audit.auditName}</td>
                <td>${audit.auditedToSite || 'N/A'}</td>
                <td>${audit.auditedToLocation || 'N/A'}</td>
                <td>${format(new Date(audit.lastAuditDate), 'MMM d, yyyy')}</td>
                <td>${audit.auditBy || 'N/A'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ` : ''}

        <div class="footer">
          Generated on ${format(new Date(), 'MMMM d, yyyy')} at ${format(new Date(), 'h:mm a')}
        </div>
      </body>
      </html>
    `
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

  const hasActiveFilters = Object.values(filters).some((value) => value !== undefined && value !== '')

  // Set mobile dock content
  useEffect(() => {
    if (isMobile) {
      setDockContent(
        <>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isLoading || isExporting}
              className="h-10 w-10 rounded-full btn-glass-elevated"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading || isFetching ? 'animate-spin' : ''}`} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={isExporting || isLoading}
                  className="h-10 w-10 rounded-full btn-glass-elevated"
                  title="Export"
                >
                  {isExporting ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => handleExportClick('csv')} disabled={isExporting || !canManageReports}>
                  <FileText className="h-4 w-4 mr-2" />
                  CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportClick('excel')} disabled={isExporting || !canManageReports}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportClick('pdf')} disabled={isExporting || !canManageReports}>
                  <FileText className="h-4 w-4 mr-2" />
                  PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Popover open={isFilterPopoverOpen} onOpenChange={setIsFilterPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                disabled={isExporting}
                className="h-10 w-10 rounded-full btn-glass-elevated relative"
                title="Filters"
              >
                <Filter className="h-4 w-4" />
                {hasActiveFilters && (
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end" side="top">
              <AuditReportFilters
                filters={filters}
                onFiltersChange={(newFilters) => {
                  handleFiltersChange(newFilters)
                  setIsFilterPopoverOpen(false)
                }}
                disabled={isExporting}
                isMobilePopover={true}
              />
            </PopoverContent>
          </Popover>
        </>
      )
    } else {
      setDockContent(null)
    }
    
    return () => {
      setDockContent(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, isLoading, isFetching, isExporting, hasActiveFilters, isFilterPopoverOpen])

  // Set mobile pagination content
  useEffect(() => {
    if (isMobile && pagination && pagination.totalPages > 0) {
      setPaginationContent(
        <>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (page > 1) {
                  handlePageChange(page - 1)
                }
              }}
              disabled={page <= 1 || isLoading}
              className="h-8 px-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Page</span>
              <div className="px-1.5 py-1 rounded-md bg-primary/10 text-primary font-medium text-xs">
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
              className="h-8 px-2"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Select value={pageSize.toString()} onValueChange={handlePageSizeChange} disabled={isLoading}>
              <SelectTrigger className="h-8 w-auto min-w-[90px] text-xs border-primary/20 bg-primary/10 text-primary font-medium hover:bg-primary/20">
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
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {isLoading ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <span>{pagination?.total || 0}</span>
              )}
            </div>
          </div>
        </>
      )
    } else {
      setPaginationContent(null)
    }
    
    return () => {
      setPaginationContent(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, pagination?.page, pagination?.totalPages, pagination?.total, page, pageSize, isLoading])

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
            Audit Reports
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm sm:text-base">
            Track and analyze asset audit history
          </p>
        </div>
        <div className={cn("flex flex-wrap items-center justify-end gap-2", isMobile && "hidden")}>
          <AuditReportFilters filters={filters} onFiltersChange={handleFiltersChange} disabled={isExporting} />
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
              <DropdownMenuItem onClick={() => handleExportClick('csv')} disabled={isExporting || !canManageReports}>
                <FileText className="h-4 w-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportClick('excel')} disabled={isExporting || !canManageReports}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export as Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportClick('pdf')} disabled={isExporting || !canManageReports}>
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
          {filters.auditType && (
            <Badge variant="secondary" className="gap-1">
              Audit Type: {filters.auditType}
              <button
                onClick={() => removeFilter('auditType')}
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
          {filters.auditor && (
            <Badge variant="secondary" className="gap-1">
              Auditor: {filters.auditor}
              <button
                onClick={() => removeFilter('auditor')}
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
            <Card>
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
            key="audit-report"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Audit Table */}
            <Card className="pb-0 gap-0 relative">
              <CardHeader>
                <CardTitle>Audit Records</CardTitle>
                <CardDescription>
                  Complete audit history and tracking
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 px-0 relative">
                {isFetching && data && audits.length > 0 && (
                  <div className={cn("absolute inset-0 bg-background/30 backdrop-blur-sm z-20 flex items-center justify-center rounded-b-2xl", isMobile && "rounded-b-2xl")}>
                    <Spinner variant="default" size={24} className="text-muted-foreground" />
                  </div>
                )}
                {permissionsLoading || (isLoading && !data) ? (
                  // Loading state: show spinner in content area
                  <div className="h-[560px] pt-12 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <Spinner className="h-8 w-8" />
                      <p className="text-sm text-muted-foreground">Loading...</p>
                    </div>
                  </div>
                ) : data && audits.length === 0 ? (
                  <div className="h-[560px] pt-12 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <p className="text-sm">No audit records found</p>
                    </div>
                  </div>
                ) : data ? (
                <div className="h-[560px] pt-8">
                  <div className="min-w-full">
                    <ScrollArea className="h-[528px] relative">
                      <div className="sticky top-0 z-30 h-px bg-border w-full"></div>
                      <div className="pr-2.5 relative after:content-[''] after:absolute after:right-[10px] after:top-0 after:bottom-0 after:w-px after:bg-border after:z-50 after:h-full">
                        <Table className="border-b">
                          <TableHeader className="sticky -top-1 z-20 bg-card [&_tr]:border-b-0 -mr-2.5">
                            <TableRow className="group hover:bg-muted/50 relative border-b-0 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-[1.5px] after:h-px after:bg-border after:z-30">
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Asset Tag ID</TableHead>
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Category</TableHead>
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Sub-Category</TableHead>
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Audit Type</TableHead>
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Audited to Site</TableHead>
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Audited to Location</TableHead>
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Last Audit Date</TableHead>
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Audit By</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                              {audits.map((audit) => (
                                <TableRow key={audit.id} className="group relative hover:bg-muted/90 border-b transition-colors">
                                  <TableCell className="font-medium">{audit.assetTagId}</TableCell>
                                  <TableCell>{audit.category || 'N/A'}</TableCell>
                                  <TableCell>{audit.subCategory || 'N/A'}</TableCell>
                                  <TableCell>{audit.auditName}</TableCell>
                                  <TableCell>{audit.auditedToSite || 'N/A'}</TableCell>
                                  <TableCell>{audit.auditedToLocation || 'N/A'}</TableCell>
                                  <TableCell>
                                    {format(new Date(audit.lastAuditDate), 'MMM d, yyyy')}
                                  </TableCell>
                                  <TableCell>{audit.auditBy || 'N/A'}</TableCell>
                                </TableRow>
                              ))}
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
                
                {/* Pagination Bar - Fixed at Bottom (hidden on mobile, mobile uses mobile-pagination-provider) */}
                <div className={cn("sticky bottom-0 border-t bg-card z-10 shadow-sm mt-auto rounded-b-2xl", isMobile && "hidden")}>
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
        reportType="Audit Report - Asset Audit History"
        reportTypeIcon={ClipboardCheck}
        exportFormat={pendingExportFormat}
        filters={filters as Record<string, string | boolean | null | undefined>}
        includeList={includeAuditList}
        onIncludeListChange={setIncludeAuditList}
        includeListLabel="Include Audit List"
        includeListDescription="When checked, the export will include a detailed table of all audit records. Unchecked by default - only summary statistics will be exported."
        exportDescription={(format, includeList) => {
          if (format === 'pdf') {
            return `This will export audit history records. ${includeList ? 'Audit details table will be included.' : 'Audit details table will not be included.'}`
          }
          return `This will export audit history records. ${includeList ? 'Audit details table with complete data will be included.' : 'Only summary statistics will be exported (no audit list).'}`
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

export default function AuditReportsPage() {
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
      <AuditReportsPageContent />
    </Suspense>
  )
}
