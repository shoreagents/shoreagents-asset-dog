'use client'

import { useState, useMemo } from 'react'
import { useCategories } from '@/hooks/use-categories'
import { usePermissions } from '@/hooks/use-permissions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FileText, 
  BarChart3, 
  PieChart, 
  Download, 
  TrendingUp,
  Package,
  MapPin,
  Building2,
  Calendar,
  RefreshCw,
  FileSpreadsheet,
  X
} from 'lucide-react'
import Link from 'next/link'
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
import { Skeleton } from '@/components/ui/skeleton'
import { format } from 'date-fns'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ExportDialog } from '@/components/dialogs/export-dialog'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase-client'

type ReportType = 'summary' | 'status' | 'category'

interface ReportSummary {
  totalAssets: number
  totalValue: number
  byStatus: Array<{ status: string; count: number; value: number }>
  byCategory: Array<{ categoryId: string; categoryName: string; count: number; value: number }>
  byLocation: Array<{ location: string; count: number }>
  bySite: Array<{ site: string; count: number }>
}

interface ReportData {
  summary: ReportSummary
  recentAssets: Array<{
    id: string
    assetTagId: string
    description: string
    status: string | null
    cost: number | null
    category: { name: string } | null
    location: string | null
    site: string | null
    department: string | null
  }>
  generatedAt: string
}

interface ReportFilters {
  status?: string
  category?: string
  location?: string
  site?: string
  department?: string
  startDate?: string
  endDate?: string
}

const reportTypes = [
  { id: 'summary' as ReportType, label: 'Summary', icon: FileText, color: 'text-blue-500' },
  { id: 'status' as ReportType, label: 'Status', icon: BarChart3, color: 'text-green-500' },
  { id: 'category' as ReportType, label: 'Category', icon: PieChart, color: 'text-purple-500' },
]

export default function AssetReportsPage() {
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canViewAssets = hasPermission('canViewAssets')
  const canManageReports = hasPermission('canManageReports')
  
  const [reportType, setReportType] = useState<ReportType>('summary')
  const [filters, setFilters] = useState<ReportFilters>({})
  const [isExporting, setIsExporting] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [pendingExportFormat, setPendingExportFormat] = useState<'csv' | 'excel' | 'pdf' | null>(null)
  const [includeAssetList, setIncludeAssetList] = useState(false)

  // Fetch categories for name lookup
  const { data: categoriesData = [] } = useCategories(true)

  // Create category lookup map
  const categoryMap = useMemo(() => {
    if (!categoriesData) return new Map()
    return new Map(categoriesData.map((cat: { id: string; name: string }) => [cat.id, cat.name]))
  }, [categoriesData])

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

  // Build query string from filters
  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (filters.status) params.set('status', filters.status)
    if (filters.category) params.set('category', filters.category)
    if (filters.location) params.set('location', filters.location)
    if (filters.site) params.set('site', filters.site)
    if (filters.department) params.set('department', filters.department)
    if (filters.startDate) params.set('startDate', filters.startDate)
    if (filters.endDate) params.set('endDate', filters.endDate)
    return params.toString()
  }, [filters])

  // Fetch report data
  const { data: reportData, isLoading, isFetching, error, refetch } = useQuery<ReportData>({
    queryKey: ['asset-report', 'summary', queryString],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/reports/assets/summary?${queryString}`
      
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
        throw new Error(error.detail || error.error || 'Failed to fetch report data')
      }
      return response.json()
    },
    enabled: canViewAssets, // Only fetch if user has permission
    placeholderData: (previousData) => previousData,
  })

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
    // Reset includeAssetList when opening dialog
    setIncludeAssetList(false)
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
    params.set('reportType', reportType)
    if (filters.status) params.set('status', filters.status)
    if (filters.category) params.set('category', filters.category)
    if (filters.location) params.set('location', filters.location)
    if (filters.site) params.set('site', filters.site)
    if (filters.department) params.set('department', filters.department)
    if (filters.startDate) params.set('startDate', filters.startDate)
    if (filters.endDate) params.set('endDate', filters.endDate)
    // For summary reports, include the includeAssetList parameter
    if (reportType === 'summary') {
      params.set('includeAssetList', includeAssetList.toString())
    }

    const url = `${baseUrl}/api/reports/assets/export?${params.toString()}`
    
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
    a.download = `asset-report-${reportType}-${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'xlsx'}`
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

    // For summary report, fetch all assets for PDF export only if includeAssetList is checked
    let allAssets: typeof reportData.recentAssets | undefined = undefined
    if (reportType === 'summary' && includeAssetList) {
      try {
        const baseUrl = getApiBaseUrl()
        const params = new URLSearchParams()
        params.set('includeAllAssets', 'true') // Fetch all assets instead of just 10
        if (filters.status) params.set('status', filters.status)
        if (filters.category) params.set('category', filters.category)
        if (filters.location) params.set('location', filters.location)
        if (filters.site) params.set('site', filters.site)
        if (filters.department) params.set('department', filters.department)
        if (filters.startDate) params.set('startDate', filters.startDate)
        if (filters.endDate) params.set('endDate', filters.endDate)
        
        const url = `${baseUrl}/api/reports/assets/summary?${params.toString()}`
        
        const token = await getAuthToken()
        const headers: HeadersInit = {}
        if (baseUrl && token) {
          headers['Authorization'] = `Bearer ${token}`
        }
        
        // Fetch all assets from summary API
        const response = await fetch(url, {
          credentials: 'include',
          headers,
        })
        if (response.ok) {
          const data = await response.json()
          allAssets = data.recentAssets || []
        }
      } catch (error) {
        console.error('Failed to fetch all assets for PDF:', error)
        // Fall back to undefined, which will skip the asset list
      }
    }

    // Generate HTML for PDF
    const html = generateReportHTML(reportData, allAssets, reportType === 'summary' ? includeAssetList : true)

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
    a.download = `asset-report-${reportType}-${new Date().toISOString().split('T')[0]}.pdf`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)

    toast.success('Report exported successfully as PDF')
  }

  const generateReportHTML = (data: ReportData, allAssets?: typeof data.recentAssets, includeList: boolean = false) => {
    const assetsToExport = allAssets || data.recentAssets
    const reportTypeLabel = reportType === 'status' ? 'Status Analysis' : 
                           reportType === 'category' ? 'Category Analysis' : 
                           'Summary'

    // Common styles
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
      .summary-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 20px;
        margin-bottom: 30px;
      }
      .summary-card {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 15px;
        background: #f9fafb;
      }
      .summary-card h3 {
        margin: 0 0 5px 0;
        font-size: 14px;
        color: #6b7280;
      }
      .summary-card .value {
        font-size: 24px;
        font-weight: bold;
        color: #111827;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
      }
      th, td {
        border: 1px solid #e5e7eb;
        padding: 12px;
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
            .summary-grid {
              page-break-after: avoid;
            }
            table {
              page-break-inside: auto;
            }
            thead {
              display: table-header-group;
            }
          }
    `

    // Summary Report (shows overview + recent assets)
    if (reportType === 'summary') {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Asset Report - ${reportTypeLabel}</title>
          <style>${styles}</style>
        </head>
        <body>
          <h1>Asset Report - ${reportTypeLabel}</h1>
          <div class="subtitle">Complete asset overview with status and category breakdown</div>
          
          <div class="summary-grid">
            <div class="summary-card">
              <h3>Total Assets</h3>
              <div class="value">${data.summary.totalAssets.toLocaleString()}</div>
            </div>
            <div class="summary-card">
              <h3>Total Value</h3>
              <div class="value">${formatCurrency(data.summary.totalValue)}</div>
            </div>
            <div class="summary-card">
              <h3>Locations</h3>
              <div class="value">${data.summary.byLocation.length}</div>
            </div>
            <div class="summary-card">
              <h3>Categories</h3>
              <div class="value">${data.summary.byCategory.length}</div>
            </div>
          </div>

          <h2>Assets by Status</h2>
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Count</th>
                <th>Value</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>
              ${data.summary.byStatus.map(item => {
                const percentage = data.summary.totalAssets > 0
                  ? ((item.count / data.summary.totalAssets) * 100).toFixed(1)
                  : '0'
                return `
                  <tr>
                    <td>${item.status}</td>
                    <td>${item.count.toLocaleString()}</td>
                    <td>${formatCurrency(item.value)}</td>
                    <td>${percentage}%</td>
                  </tr>
                `
              }).join('')}
            </tbody>
          </table>

          <h2>Assets by Category</h2>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Count</th>
                <th>Value</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>
              ${data.summary.byCategory.map(item => {
                const percentage = data.summary.totalAssets > 0
                  ? ((item.count / data.summary.totalAssets) * 100).toFixed(1)
                  : '0'
                return `
                  <tr>
                    <td>${item.categoryName}</td>
                    <td>${item.count.toLocaleString()}</td>
                    <td>${formatCurrency(item.value)}</td>
                    <td>${percentage}%</td>
                  </tr>
                `
              }).join('')}
            </tbody>
          </table>

          ${includeList ? `
          <h2>Asset Details (${assetsToExport.length} assets)</h2>
          <table>
            <thead>
              <tr>
                <th>Asset Tag</th>
                <th>Description</th>
                <th>Category</th>
                <th>Status</th>
                <th>Location</th>
                <th>Site</th>
                <th>Department</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              ${assetsToExport.map(asset => `
                <tr>
                  <td><strong>${asset.assetTagId}</strong></td>
                  <td>${asset.description}</td>
                  <td>${asset.category?.name || 'N/A'}</td>
                  <td>${asset.status || 'Unknown'}</td>
                  <td>${asset.location || 'N/A'}</td>
                  <td>${asset.site || 'N/A'}</td>
                  <td>${asset.department || 'N/A'}</td>
                  <td>${asset.cost ? formatCurrency(asset.cost) : 'N/A'}</td>
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

    // Status Report (focused on status breakdown)
    if (reportType === 'status') {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Asset Report - ${reportTypeLabel}</title>
          <style>${styles}</style>
        </head>
        <body>
          <h1>Asset Report - ${reportTypeLabel}</h1>
          <div class="subtitle">Asset distribution and value analysis by status</div>
          
          <div class="summary-grid">
            <div class="summary-card">
              <h3>Total Assets</h3>
              <div class="value">${data.summary.totalAssets.toLocaleString()}</div>
            </div>
            <div class="summary-card">
              <h3>Total Value</h3>
              <div class="value">${formatCurrency(data.summary.totalValue)}</div>
            </div>
            <div class="summary-card">
              <h3>Status Types</h3>
              <div class="value">${data.summary.byStatus.length}</div>
            </div>
            <div class="summary-card">
              <h3>Avg per Status</h3>
              <div class="value">${Math.round(data.summary.totalAssets / data.summary.byStatus.length)}</div>
            </div>
          </div>

          <h2>Assets by Status</h2>
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Count</th>
                <th>Total Value</th>
                <th>Average Value</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>
              ${data.summary.byStatus.map(item => {
                const percentage = data.summary.totalAssets > 0
                  ? ((item.count / data.summary.totalAssets) * 100).toFixed(1)
                  : '0'
                const avgValue = item.count > 0 ? item.value / item.count : 0
                return `
                  <tr>
                    <td><strong>${item.status}</strong></td>
                    <td>${item.count.toLocaleString()}</td>
                    <td>${formatCurrency(item.value)}</td>
                    <td>${formatCurrency(avgValue)}</td>
                    <td>${percentage}%</td>
                  </tr>
                `
              }).join('')}
            </tbody>
          </table>

          <div class="footer">
            <p>Generated on ${format(new Date(data.generatedAt), 'PPpp')}</p>
          </div>
        </body>
        </html>
      `
    }

    // Category Report (focused on category breakdown)
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Asset Report - ${reportTypeLabel}</title>
        <style>${styles}</style>
      </head>
      <body>
        <h1>Asset Report - ${reportTypeLabel}</h1>
        <div class="subtitle">Asset distribution and value analysis by category</div>
        
        <div class="summary-grid">
          <div class="summary-card">
            <h3>Total Assets</h3>
            <div class="value">${data.summary.totalAssets.toLocaleString()}</div>
          </div>
          <div class="summary-card">
            <h3>Total Value</h3>
            <div class="value">${formatCurrency(data.summary.totalValue)}</div>
          </div>
          <div class="summary-card">
            <h3>Categories</h3>
            <div class="value">${data.summary.byCategory.length}</div>
          </div>
          <div class="summary-card">
            <h3>Avg per Category</h3>
            <div class="value">${Math.round(data.summary.totalAssets / data.summary.byCategory.length)}</div>
          </div>
        </div>

        <h2>Assets by Category</h2>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Count</th>
              <th>Total Value</th>
              <th>Average Value</th>
              <th>Percentage</th>
            </tr>
          </thead>
          <tbody>
            ${data.summary.byCategory.map(item => {
              const percentage = data.summary.totalAssets > 0
                ? ((item.count / data.summary.totalAssets) * 100).toFixed(1)
                : '0'
              const avgValue = item.count > 0 ? item.value / item.count : 0
              return `
                <tr>
                  <td><strong>${item.categoryName}</strong></td>
                  <td>${item.count.toLocaleString()}</td>
                  <td>${formatCurrency(item.value)}</td>
                  <td>${formatCurrency(avgValue)}</td>
                  <td>${percentage}%</td>
                </tr>
              `
            }).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>Generated on ${format(new Date(data.generatedAt), 'PPpp')}</p>
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
            Asset Reports
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm sm:text-base">
            Generate analytical and operational reports for decision-making
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ReportFilters filters={filters} onFiltersChange={setFilters} disabled={isExporting} />
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

      {/* Report Type Selector */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-sm backdrop-saturate-150">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Report Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2">
              {reportTypes.map((type) => {
                const isActive = reportType === type.id
                return (
                  <motion.div
                    key={type.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full sm:w-auto"
                  >
                    <Button
                      variant={isActive ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setReportType(type.id)}
                      disabled={isExporting}
                      className={`w-full sm:w-auto gap-2 transition-all ${
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
          </CardContent>
        </Card>
      </motion.div>

      {/* Active Filter Badges */}
      <AnimatePresence>
        {(filters.status || filters.category || filters.location || filters.site || filters.department || filters.startDate || filters.endDate) && (
      <motion.div
            initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex flex-wrap gap-2"
          >
            <AnimatePresence>
                {filters.status && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ duration: 0.2 }}
      >
                    <Badge variant="outline" className="gap-1.5 pr-1 bg-white/5 hover:bg-white/10 transition-colors max-w-full">
                      <span className="text-xs truncate">
                        <span className="text-muted-foreground">Status:</span> {filters.status}
                      </span>
                      <button
                        onClick={() => removeFilter('status')}
                        disabled={isExporting}
                        className="ml-0.5 rounded-sm hover:bg-white/20 p-0.5 disabled:opacity-50"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
      </motion.div>
                )}
                {filters.category && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Badge variant="outline" className="gap-1.5 pr-1 bg-white/5 hover:bg-white/10 transition-colors max-w-full">
                      <span className="text-xs truncate">
                        <span className="text-muted-foreground">Category:</span> {categoryMap.get(filters.category) || filters.category}
                      </span>
                      <button
                        onClick={() => removeFilter('category')}
                        disabled={isExporting}
                        className="ml-0.5 rounded-sm hover:bg-white/20 p-0.5 disabled:opacity-50"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  </motion.div>
                )}
                {filters.location && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Badge variant="outline" className="gap-1.5 pr-1 bg-white/5 hover:bg-white/10 transition-colors max-w-full">
                      <span className="text-xs truncate">
                        <span className="text-muted-foreground">Location:</span> {filters.location}
                      </span>
                      <button
                        onClick={() => removeFilter('location')}
                        disabled={isExporting}
                        className="ml-0.5 rounded-sm hover:bg-white/20 p-0.5 disabled:opacity-50"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  </motion.div>
                )}
                {filters.site && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Badge variant="outline" className="gap-1.5 pr-1 bg-white/5 hover:bg-white/10 transition-colors max-w-full">
                      <span className="text-xs truncate">
                        <span className="text-muted-foreground">Site:</span> {filters.site}
                      </span>
                      <button
                        onClick={() => removeFilter('site')}
                        disabled={isExporting}
                        className="ml-0.5 rounded-sm hover:bg-white/20 p-0.5 disabled:opacity-50"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  </motion.div>
                )}
                {filters.department && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Badge variant="outline" className="gap-1.5 pr-1 bg-white/5 hover:bg-white/10 transition-colors max-w-full">
                      <span className="text-xs truncate">
                        <span className="text-muted-foreground">Department:</span> {filters.department}
                      </span>
                      <button
                        onClick={() => removeFilter('department')}
                        disabled={isExporting}
                        className="ml-0.5 rounded-sm hover:bg-white/20 p-0.5 disabled:opacity-50"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  </motion.div>
                )}
                {filters.startDate && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Badge variant="outline" className="gap-1.5 pr-1 bg-white/5 hover:bg-white/10 transition-colors max-w-full">
                      <span className="text-xs truncate">
                        <span className="text-muted-foreground">From:</span> {filters.startDate}
                      </span>
                      <button
                        onClick={() => removeFilter('startDate')}
                        disabled={isExporting}
                        className="ml-0.5 rounded-sm hover:bg-white/20 p-0.5 disabled:opacity-50"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  </motion.div>
                )}
                {filters.endDate && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Badge variant="outline" className="gap-1.5 pr-1 bg-white/5 hover:bg-white/10 transition-colors max-w-full">
                      <span className="text-xs truncate">
                        <span className="text-muted-foreground">To:</span> {filters.endDate}
                      </span>
                      <button
                        onClick={() => removeFilter('endDate')}
                        disabled={isExporting}
                        className="ml-0.5 rounded-sm hover:bg-white/20 p-0.5 disabled:opacity-50"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  </motion.div>
                )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

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
          // Report content with skeleton loading
          <motion.div
            key={reportType}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  title: 'Total Assets',
                  value: reportData?.summary.totalAssets.toLocaleString(),
                  description: 'All assets in system',
                  icon: Package,
                  color: 'text-blue-500',
                  bgColor: 'bg-blue-500/10',
                  borderColor: '#3b82f6',
                  delay: 0.1,
                },
                {
                  title: 'Total Value',
                  value: reportData ? formatCurrency(reportData.summary.totalValue) : undefined,
                  description: 'Combined asset value',
                  icon: TrendingUp,
                  color: 'text-green-500',
                  bgColor: 'bg-green-500/10',
                  borderColor: '#22c55e',
                  delay: 0.2,
                },
                {
                  title: 'Locations',
                  value: reportData?.summary.byLocation.length.toString(),
                  description: 'Unique locations',
                  icon: MapPin,
                  color: 'text-amber-500',
                  bgColor: 'bg-amber-500/10',
                  borderColor: '#f59e0b',
                  delay: 0.3,
                },
                {
                  title: 'Categories',
                  value: reportData?.summary.byCategory.length.toString(),
                  description: 'Asset categories',
                  icon: Building2,
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
                      {card.value ? (
                      <div className="text-2xl font-bold">{card.value}</div>
                      ) : (
                        <Skeleton className="h-8 w-24 mb-1" />
                      )}
                      <p className="text-xs text-muted-foreground mt-1.5">{card.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Status & Category Breakdown Grid */}
            {reportType === 'summary' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Category Breakdown - 2 columns */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                  className="lg:col-span-2"
                >
                  <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-sm backdrop-saturate-150 h-full">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <PieChart className="h-5 w-5" />
                        Assets by Category
                      </CardTitle>
                      <CardDescription>Distribution of assets across categories</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {reportData ? (
                      <ScrollArea className="h-[400px]">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="font-semibold">Category</TableHead>
                              <TableHead className="text-right font-semibold">Count</TableHead>
                              <TableHead className="text-right font-semibold">Value</TableHead>
                              <TableHead className="text-right font-semibold">% of Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {reportData.summary.byCategory.map((item, index) => {
                              const percentage = reportData.summary.totalAssets > 0
                                ? ((item.count / reportData.summary.totalAssets) * 100).toFixed(1)
                                : '0'
                              return (
                                <motion.tr
                                  key={item.categoryId}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ duration: 0.2, delay: index * 0.03 }}
                                  className="hover:bg-white/5 transition-colors"
                                >
                                  <TableCell className="font-medium">{item.categoryName}</TableCell>
                                  <TableCell className="text-right">{item.count.toLocaleString()}</TableCell>
                                  <TableCell className="text-right font-medium">
                                    {formatCurrency(item.value)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Badge variant="secondary">{percentage}%</Badge>
                                  </TableCell>
                                </motion.tr>
                              )
                            })}
                          </TableBody>
                        </Table>
                        <ScrollBar  
                          orientation="horizontal"
                          className='z-50'
                        />
                      </ScrollArea>
                      ) : (
                        <div className="flex items-center justify-center h-[400px]">
                          <div className="flex flex-col items-center gap-3">
                            <Spinner className="h-8 w-8" />
                            <p className="text-sm text-muted-foreground">Loading categories...</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Status Breakdown - 1 column */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                  className="lg:col-span-1"
                >
                  <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-sm backdrop-saturate-150 h-full">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Assets by Status
                      </CardTitle>
                      <CardDescription>Distribution by status</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {reportData ? (
                      <div className="space-y-4">
                        {reportData.summary.byStatus.map((item, index) => {
                          const percentage = reportData.summary.totalAssets > 0
                            ? ((item.count / reportData.summary.totalAssets) * 100).toFixed(1)
                            : '0'
                          return (
                            <motion.div
                              key={item.status}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.3, delay: index * 0.05 }}
                              className="space-y-2"
                            >
                              <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="font-medium">
                                    {item.status}
                                  </Badge>
                                  <span className="text-muted-foreground">{item.count}</span>
                                </div>
                                <div className="text-right">
                                  <div className="font-semibold">{percentage}%</div>
                                </div>
                              </div>
                              <div className="h-2.5 bg-muted/50 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ duration: 0.8, delay: index * 0.05 + 0.2, ease: 'easeOut' }}
                                className="h-full bg-primary rounded-full"
                              />
                              </div>
                              <div className="text-xs text-muted-foreground text-right">
                                {formatCurrency(item.value)}
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>
                      ) : (
                        <div className="flex items-center justify-center h-[400px]">
                          <div className="flex flex-col items-center gap-3">
                            <Spinner className="h-8 w-8" />
                            <p className="text-sm text-muted-foreground">Loading status...</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            )}

            {/* Status Breakdown - Full Width (when not summary) */}
            {reportType === 'status' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
              >
                <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-sm backdrop-saturate-150">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Assets by Status
                    </CardTitle>
                    <CardDescription>Distribution of assets across different statuses</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {reportData ? (
                    <div className="space-y-4">
                      {reportData.summary.byStatus.map((item, index) => {
                        const percentage = reportData.summary.totalAssets > 0
                          ? ((item.count / reportData.summary.totalAssets) * 100).toFixed(1)
                          : '0'
                        return (
                          <motion.div
                            key={item.status}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                            className="space-y-2"
                          >
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-medium">
                                  {item.status}
                                </Badge>
                                <span className="text-muted-foreground">{item.count} assets</span>
                              </div>
                              <div className="text-right">
                                <div className="font-semibold">{percentage}%</div>
                                <div className="text-xs text-muted-foreground">
                                  {formatCurrency(item.value)}
                                </div>
                              </div>
                            </div>
                            <div className="h-2.5 bg-muted/50 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              transition={{ duration: 0.8, delay: index * 0.05 + 0.2, ease: 'easeOut' }}
                              className="h-full bg-primary rounded-full"
                            />
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                    ) : (
                      <div className="flex items-center justify-center h-[400px]">
                        <div className="flex flex-col items-center gap-3">
                          <Spinner className="h-8 w-8" />
                          <p className="text-sm text-muted-foreground">Loading status...</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Category Breakdown - Full Width (when not summary) */}
            {reportType === 'category' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-sm backdrop-saturate-150">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChart className="h-5 w-5" />
                      Assets by Category
                    </CardTitle>
                    <CardDescription>Distribution of assets across categories</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {reportData ? (
                    <ScrollArea className="h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="font-semibold">Category</TableHead>
                            <TableHead className="text-right font-semibold">Count</TableHead>
                            <TableHead className="text-right font-semibold">Value</TableHead>
                            <TableHead className="text-right font-semibold">% of Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportData.summary.byCategory.map((item, index) => {
                            const percentage = reportData.summary.totalAssets > 0
                              ? ((item.count / reportData.summary.totalAssets) * 100).toFixed(1)
                              : '0'
                            return (
                              <motion.tr
                                key={item.categoryId}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.2, delay: index * 0.03 }}
                                className="hover:bg-white/5 transition-colors"
                              >
                                <TableCell className="font-medium">{item.categoryName}</TableCell>
                                <TableCell className="text-right">{item.count.toLocaleString()}</TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(item.value)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge variant="secondary">{percentage}%</Badge>
                                </TableCell>
                              </motion.tr>
                            )
                          })}
                        </TableBody>
                      </Table>
                      <ScrollBar
                        orientation="horizontal"
                        className='z-50'
                      />
                    </ScrollArea>
                    ) : (
                      <div className="flex items-center justify-center h-[400px]">
                        <div className="flex flex-col items-center gap-3">
                          <Spinner className="h-8 w-8" />
                          <p className="text-sm text-muted-foreground">Loading categories...</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Show rest of content only when data is loaded */}
            {reportData && (
              <>
            {/* Recent Assets */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
            >
              <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-sm backdrop-saturate-150">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Recent Assets
                  </CardTitle>
                  <CardDescription>Latest assets added to the system</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="font-semibold">Asset Tag</TableHead>
                          <TableHead className="font-semibold">Description</TableHead>
                          <TableHead className="font-semibold">Category</TableHead>
                          <TableHead className="font-semibold">Status</TableHead>
                          <TableHead className="text-right font-semibold">Value</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.recentAssets.length > 0 ? (
                          reportData.recentAssets.map((asset, index) => (
                            <motion.tr
                              key={asset.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.2, delay: index * 0.05 }}
                              className="hover:bg-white/5 transition-colors"
                            >
                              <TableCell className="font-medium">
                                <Link
                                  href={`/assets/details/${asset.id}`}
                                  className="text-primary hover:underline font-semibold"
                                >
                                  {asset.assetTagId}
                                </Link>
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate" title={asset.description}>
                                {asset.description}
                              </TableCell>
                              <TableCell>{asset.category?.name || 'N/A'}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{asset.status || 'Unknown'}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {asset.cost ? formatCurrency(asset.cost) : 'N/A'}
                              </TableCell>
                            </motion.tr>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                              No recent assets found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                    <ScrollBar
                      orientation="horizontal"
                      className='z-50'
                    />
                  </ScrollArea>
                </CardContent>
              </Card>
            </motion.div>

            {/* Report Metadata */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.5 }}
              className="flex items-center justify-center gap-2 text-xs text-muted-foreground"
            >
              <Calendar className="h-3 w-3" />
              <span>Report generated on {format(new Date(reportData.generatedAt), 'PPpp')}</span>
            </motion.div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export Confirmation Dialog */}
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        reportType={
          reportType === 'summary' 
            ? 'Summary Report - Complete Asset Data'
            : reportType === 'status'
            ? 'Status Report - Aggregated by Status'
            : 'Category Report - Aggregated by Category'
        }
        reportTypeIcon={FileText}
        exportFormat={pendingExportFormat}
        filters={filters as Record<string, string | boolean | null | undefined>}
        includeList={includeAssetList}
        onIncludeListChange={setIncludeAssetList}
        includeListLabel="Include Asset List"
        includeListDescription={reportType === 'summary' ? "When checked, the export will include a detailed table of all assets. Unchecked by default - only summary statistics will be exported." : undefined}
        exportDescription={(format, includeList) => {
          if (reportType === 'summary' && format === 'pdf') {
            return `This will export summary statistics with status and category breakdowns. ${includeList ? 'Asset details table will be included.' : 'Asset details table will not be included.'}`
          }
          if (reportType === 'summary' && (format === 'csv' || format === 'excel')) {
            return `This will export summary statistics with status and category breakdowns. ${includeList ? 'Asset details table with complete data (42 columns) will be included.' : 'Only summary statistics will be exported (no asset list).'}`
          }
          if (reportType === 'status') {
            return 'This will export aggregated data grouped by status with counts, total values, averages, and percentages.'
          }
          if (reportType === 'category') {
            return 'This will export aggregated data grouped by category with counts, total values, averages, and percentages.'
          }
          return ''
        }}
        isExporting={isExporting}
        onConfirm={handleConfirmExport}
        onCancel={() => {
          setShowExportDialog(false)
          setPendingExportFormat(null)
        }}
        formatFilterValue={(key, value) => {
          if (key === 'category') {
            return categoryMap.get(value as string) || String(value)
          }
          return String(value)
        }}
      />
    </motion.div>
  )
}
