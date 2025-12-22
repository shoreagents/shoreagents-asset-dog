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
  TrendingDown
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
import { DepreciationReportFilters } from '@/components/reports/depreciation-report-filters'
import { format } from 'date-fns'
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

interface DepreciationReportData {
  assets: Array<{
    id: string
    assetTagId: string
    description: string
    category: string | null
    subCategory: string | null
    originalCost: number | null
    depreciableCost: number | null
    salvageValue: number | null
    assetLifeMonths: number | null
    depreciationMethod: string | null
    dateAcquired: string | null
    location: string | null
    site: string | null
    isDepreciable: boolean
    monthlyDepreciation: number
    annualDepreciation: number
    accumulatedDepreciation: number
    currentValue: number
    depreciationYears: number
    depreciationMonths: number
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
  depreciationMethod?: string
  location?: string
  site?: string
  isDepreciable?: boolean
  startDate?: string
  endDate?: string
}

function DepreciationReportsPageContent() {
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
  const [includeAssetList, setIncludeAssetList] = useState(false)

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
    if (filters.depreciationMethod) params.set('depreciationMethod', filters.depreciationMethod)
    if (filters.location) params.set('location', filters.location)
    if (filters.site) params.set('site', filters.site)
    if (filters.isDepreciable !== undefined) params.set('isDepreciable', filters.isDepreciable.toString())
    if (filters.startDate) params.set('startDate', filters.startDate)
    if (filters.endDate) params.set('endDate', filters.endDate)
    if (page > 1) params.set('page', page.toString())
    if (pageSize !== 50) params.set('pageSize', pageSize.toString())
    return params.toString()
  }, [filters, page, pageSize])

  // Fetch depreciation data
  const { data, isLoading, isFetching, error, refetch } = useQuery<DepreciationReportData>({
    queryKey: ['depreciation-reports', queryString, page, pageSize],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/reports/depreciation?${queryString}`
      
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
        throw new Error(error.detail || error.error || 'Failed to fetch depreciation reports')
      }
      return response.json()
    },
    enabled: canViewAssets, // Only fetch if user has permission
    placeholderData: (previousData) => previousData,
  })

  const assets = data?.assets || []
  const pagination = data?.pagination

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
    if (!canManageReports) {
      toast.error('You do not have permission to export reports. Please contact your administrator.')
      return
    }
    setPendingExportFormat(format)
    setIncludeAssetList(false)
    setShowExportDialog(true)
  }

  const handlePageSizeChange = (newPageSize: string) => {
    updateURL({ pageSize: parseInt(newPageSize), page: 1 })
  }

  const handlePageChange = (newPage: number) => {
    updateURL({ page: newPage })
  }

  const handleDataExport = async (format: 'csv' | 'excel') => {
    const baseUrl = getApiBaseUrl()
    const params = new URLSearchParams()
    params.set('format', format)
    if (filters.category) params.set('category', filters.category)
    if (filters.depreciationMethod) params.set('depreciationMethod', filters.depreciationMethod)
    if (filters.location) params.set('location', filters.location)
    if (filters.site) params.set('site', filters.site)
    if (filters.isDepreciable !== undefined) params.set('isDepreciable', filters.isDepreciable.toString())
    if (filters.startDate) params.set('startDate', filters.startDate)
    if (filters.endDate) params.set('endDate', filters.endDate)
    if (includeAssetList) params.set('includeAssetList', 'true')

    const url = `${baseUrl}/api/reports/depreciation/export?${params.toString()}`
    
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
    a.download = `depreciation-report-${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'xlsx'}`
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

    // Fetch all assets for PDF export only if includeAssetList is checked
    let allAssets: typeof assets | undefined = undefined
    if (includeAssetList) {
      try {
        const baseUrl = getApiBaseUrl()
        const params = new URLSearchParams()
        if (filters.category) params.set('category', filters.category)
        if (filters.depreciationMethod) params.set('depreciationMethod', filters.depreciationMethod)
        if (filters.location) params.set('location', filters.location)
        if (filters.site) params.set('site', filters.site)
        if (filters.isDepreciable !== undefined) params.set('isDepreciable', filters.isDepreciable.toString())
        if (filters.startDate) params.set('startDate', filters.startDate)
        if (filters.endDate) params.set('endDate', filters.endDate)
        params.set('pageSize', '10000')
        
        const url = `${baseUrl}/api/reports/depreciation?${params.toString()}`
        
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
          const responseData = await response.json()
          allAssets = responseData.assets || []
        }
      } catch (error) {
        console.error('Failed to fetch all assets for PDF:', error)
      }
    }

    // Generate HTML for PDF
    const html = generateDepreciationReportHTML(data, allAssets, includeAssetList)

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
    a.download = `depreciation-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)

    toast.success('Report exported successfully as PDF')
  }

  const generateDepreciationReportHTML = (reportData: DepreciationReportData, allAssets?: typeof assets, includeList: boolean = false) => {
    const formatCurrencyForHTML = (value: number | null | undefined): string => {
      if (value === null || value === undefined || isNaN(value)) {
        return '₱0.00'
      }
      return `₱${Number(value).toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })}`
    }

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

    const displayAssets = allAssets || assets
    const depreciableAssets = displayAssets.filter(a => a.isDepreciable)
    const totalOriginalCost = displayAssets.reduce((sum, a) => sum + (a.originalCost || 0), 0)
    const totalDepreciableCost = depreciableAssets.reduce((sum, a) => sum + (a.depreciableCost || 0), 0)
    const totalAccumulatedDepreciation = depreciableAssets.reduce((sum, a) => sum + a.accumulatedDepreciation, 0)
    const totalCurrentValue = depreciableAssets.reduce((sum, a) => sum + a.currentValue, 0)
    const totalAnnualDepreciation = depreciableAssets.reduce((sum, a) => sum + a.annualDepreciation, 0)

    const byMethod = depreciableAssets.reduce((acc, asset) => {
      const method = asset.depreciationMethod || 'Not Specified'
      if (!acc[method]) {
        acc[method] = {
          count: 0,
          totalCost: 0,
          totalDepreciation: 0,
          totalCurrentValue: 0,
        }
      }
      acc[method].count++
      acc[method].totalCost += asset.depreciableCost || 0
      acc[method].totalDepreciation += asset.accumulatedDepreciation
      acc[method].totalCurrentValue += asset.currentValue
      return acc
    }, {} as Record<string, { count: number; totalCost: number; totalDepreciation: number; totalCurrentValue: number }>)

    // Format currency values for HTML
    const formattedTotalOriginalCost = formatCurrencyForHTML(totalOriginalCost)
    const formattedTotalDepreciableCost = formatCurrencyForHTML(totalDepreciableCost)
    const formattedTotalAccumulatedDepreciation = formatCurrencyForHTML(totalAccumulatedDepreciation)
    const formattedTotalCurrentValue = formatCurrencyForHTML(totalCurrentValue)
    const formattedTotalAnnualDepreciation = formatCurrencyForHTML(totalAnnualDepreciation)

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Depreciation Report</title>
        <style>${styles}</style>
      </head>
      <body>
        <h1>Depreciation Report</h1>
        <div class="subtitle">Asset depreciation calculations and tracking</div>
        
        <!-- Summary Statistics (always shown) -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px;">
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; background: #f9fafb;">
            <h3 style="margin: 0 0 5px 0; font-size: 14px; color: #6b7280;">Total Assets</h3>
            <div style="font-size: 24px; font-weight: bold; color: #111827;">${displayAssets.length}</div>
          </div>
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; background: #f9fafb;">
            <h3 style="margin: 0 0 5px 0; font-size: 14px; color: #6b7280;">Depreciable Assets</h3>
            <div style="font-size: 24px; font-weight: bold; color: #111827;">${depreciableAssets.length}</div>
          </div>
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; background: #f9fafb;">
            <h3 style="margin: 0 0 5px 0; font-size: 14px; color: #6b7280;">Total Original Cost</h3>
            <div style="font-size: 24px; font-weight: bold; color: #111827;">${formattedTotalOriginalCost}</div>
          </div>
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; background: #f9fafb;">
            <h3 style="margin: 0 0 5px 0; font-size: 14px; color: #6b7280;">Total Depreciable Cost</h3>
            <div style="font-size: 24px; font-weight: bold; color: #111827;">${formattedTotalDepreciableCost}</div>
          </div>
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; background: #f9fafb;">
            <h3 style="margin: 0 0 5px 0; font-size: 14px; color: #6b7280;">Accumulated Depreciation</h3>
            <div style="font-size: 24px; font-weight: bold; color: #dc2626;">${formattedTotalAccumulatedDepreciation}</div>
          </div>
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; background: #f9fafb;">
            <h3 style="margin: 0 0 5px 0; font-size: 14px; color: #6b7280;">Total Annual Depreciation</h3>
            <div style="font-size: 24px; font-weight: bold; color: #dc2626;">${formattedTotalAnnualDepreciation}</div>
          </div>
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; background: #f9fafb;">
            <h3 style="margin: 0 0 5px 0; font-size: 14px; color: #6b7280;">Total Current Value</h3>
            <div style="font-size: 24px; font-weight: bold; color: #16a34a;">${formattedTotalCurrentValue}</div>
          </div>
        </div>

        <h2>Depreciation by Method</h2>
        <table>
          <thead>
            <tr>
              <th>Depreciation Method</th>
              <th>Asset Count</th>
              <th>Total Cost</th>
              <th>Accumulated Depreciation</th>
              <th>Current Value</th>
            </tr>
          </thead>
          <tbody>
            ${Object.keys(byMethod).length === 0 ? `
              <tr>
                <td colspan="5" style="text-align: center; color: #6b7280;">No depreciable assets found</td>
              </tr>
            ` : Object.entries(byMethod).map(([method, stats]) => {
              const formattedCost = formatCurrencyForHTML(stats.totalCost)
              const formattedDepreciation = formatCurrencyForHTML(stats.totalDepreciation)
              const formattedCurrentValue = formatCurrencyForHTML(stats.totalCurrentValue)
              return `
              <tr>
                <td><strong>${method}</strong></td>
                <td>${stats.count}</td>
                <td>${formattedCost}</td>
                <td>${formattedDepreciation}</td>
                <td>${formattedCurrentValue}</td>
              </tr>
            `
            }).join('')}
          </tbody>
        </table>

        ${includeList ? `
        <h2>Asset Depreciation Details</h2>
        <table>
          <thead>
            <tr>
              <th>Asset Tag ID</th>
              <th>Description</th>
              <th>Category</th>
              <th>Depreciation Method</th>
              <th>Original Cost</th>
              <th>Depreciable Cost</th>
              <th>Salvage Value</th>
              <th>Asset Life (Months)</th>
              <th>Date Acquired</th>
              <th>Monthly Depreciation</th>
              <th>Annual Depreciation</th>
              <th>Accumulated Depreciation</th>
              <th>Current Value</th>
            </tr>
          </thead>
          <tbody>
            ${displayAssets.length === 0 ? `
              <tr>
                <td colspan="13" style="text-align: center; color: #6b7280;">No assets found</td>
              </tr>
            ` : displayAssets.map(asset => {
              const formattedOriginalCost = formatCurrencyForHTML(asset.originalCost)
              const formattedDepreciableCost = formatCurrencyForHTML(asset.depreciableCost)
              const formattedSalvageValue = formatCurrencyForHTML(asset.salvageValue)
              const formattedMonthlyDepreciation = formatCurrencyForHTML(asset.monthlyDepreciation)
              const formattedAnnualDepreciation = formatCurrencyForHTML(asset.annualDepreciation)
              const formattedAccumulatedDepreciation = formatCurrencyForHTML(asset.accumulatedDepreciation)
              const formattedCurrentValue = formatCurrencyForHTML(asset.currentValue)
              return `
              <tr>
                <td>${asset.assetTagId}</td>
                <td>${asset.description}</td>
                <td>${asset.category || 'N/A'}</td>
                <td>${asset.depreciationMethod || 'N/A'}</td>
                <td>${formattedOriginalCost}</td>
                <td>${formattedDepreciableCost}</td>
                <td>${formattedSalvageValue}</td>
                <td>${asset.assetLifeMonths || 'N/A'}</td>
                <td>${asset.dateAcquired ? format(new Date(asset.dateAcquired), 'MMM d, yyyy') : 'N/A'}</td>
                <td>${formattedMonthlyDepreciation}</td>
                <td>${formattedAnnualDepreciation}</td>
                <td>${formattedAccumulatedDepreciation}</td>
                <td>${formattedCurrentValue}</td>
              </tr>
            `
            }).join('')}
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
            Depreciation Reports
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm sm:text-base">
            Calculate asset depreciation over time using accounting methods
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <DepreciationReportFilters filters={filters} onFiltersChange={handleFiltersChange} disabled={isExporting} />
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
          {filters.depreciationMethod && (
            <Badge variant="secondary" className="gap-1">
              Method: {filters.depreciationMethod}
              <button
                onClick={() => removeFilter('depreciationMethod')}
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
          {filters.isDepreciable && (
            <Badge variant="secondary" className="gap-1">
              Depreciable Assets Only
              <button
                onClick={() => removeFilter('isDepreciable')}
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
            key="depreciation-report"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Depreciation Table */}
            <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-sm backdrop-saturate-150 relative flex flex-col flex-1 min-h-0 pb-0 gap-0">
              <CardHeader>
                <CardTitle>Depreciation Records</CardTitle>
                <CardDescription>
                  Asset depreciation calculations and tracking
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 px-0 relative">
                {isFetching && data && assets.length > 0 && (
                  <div className="absolute left-0 right-[10px] top-[33px] bottom-0 bg-background/50 backdrop-blur-sm z-20 flex items-center justify-center">
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
                ) : data && assets.length === 0 ? (
                  <div className="h-[560px] pt-12 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <p className="text-sm">No depreciation records found</p>
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
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Description</TableHead>
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Category</TableHead>
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Depreciation Method</TableHead>
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Original Cost</TableHead>
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Depreciable Cost</TableHead>
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Accumulated Depreciation</TableHead>
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Current Value</TableHead>
                              <TableHead className="text-left bg-card transition-colors group-hover:bg-muted/50">Date Acquired</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                              {assets.map((asset) => (
                                <TableRow key={asset.id} className="group relative hover:bg-muted/90 border-b transition-colors">
                                  <TableCell className="font-medium">{asset.assetTagId}</TableCell>
                                  <TableCell className="max-w-[200px]">
                                    <div className="truncate" title={asset.description}>
                                      {asset.description}
                                    </div>
                                  </TableCell>
                                  <TableCell>{asset.category || 'N/A'}</TableCell>
                                  <TableCell>{asset.depreciationMethod || 'N/A'}</TableCell>
                                  <TableCell>{formatCurrency(asset.originalCost)}</TableCell>
                                  <TableCell>{formatCurrency(asset.depreciableCost)}</TableCell>
                                  <TableCell>{formatCurrency(asset.accumulatedDepreciation)}</TableCell>
                                  <TableCell>{formatCurrency(asset.currentValue)}</TableCell>
                                  <TableCell>
                                    {asset.dateAcquired ? format(new Date(asset.dateAcquired), 'MMM d, yyyy') : 'N/A'}
                                  </TableCell>
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
        reportType="Depreciation Report - Asset Depreciation Calculations"
        reportTypeIcon={TrendingDown}
        exportFormat={pendingExportFormat}
        filters={filters as Record<string, string | boolean | null | undefined>}
        includeList={includeAssetList}
        onIncludeListChange={setIncludeAssetList}
        includeListLabel="Include Asset List"
        includeListDescription="When checked, the export will include a detailed table of all assets with depreciation calculations. Unchecked by default - only summary statistics will be exported."
        exportDescription={(format, includeList) => {
          if (format === 'pdf') {
            return `This will export depreciation calculations. ${includeList ? 'Asset details table will be included.' : 'Asset details table will not be included.'}`
          }
          return `This will export depreciation calculations. ${includeList ? 'Asset details table with complete depreciation data will be included.' : 'Only summary statistics will be exported (no asset list).'}`
        }}
        isExporting={isExporting}
        onConfirm={handleConfirmExport}
        onCancel={() => {
          setShowExportDialog(false)
          setPendingExportFormat(null)
        }}
        formatFilterValue={(key, value) => {
          if (key === 'isDepreciable' && value === true) {
            return 'Depreciable Assets Only'
          }
          if (key === 'startDate' || key === 'endDate') {
            return format(new Date(value as string), 'MMM d, yyyy')
          }
          return String(value)
        }}
      />
    </motion.div>
  )
}

export default function DepreciationReportsPage() {
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
      <DepreciationReportsPageContent />
    </Suspense>
  )
}

