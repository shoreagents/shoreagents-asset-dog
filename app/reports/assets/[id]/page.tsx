'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useRef, useTransition, memo, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { usePermissions } from '@/hooks/use-permissions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft, FileText, Calendar, MapPin, Building, DollarSign, TrendingUp, Package } from 'lucide-react'
import { format } from 'date-fns'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'

const formatCurrency = (value: number | null) => {
  if (!value) return 'N/A'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'PHP',
  }).format(value)
}

interface AssetReport {
  id: string
  reportName: string
  reportType: string
  description: string | null
  category: { id: string; name: string } | null
  subCategory: { id: string; name: string } | null
  status: string | null
  location: string | null
  department: string | null
  site: string | null
  minCost: number | null
  maxCost: number | null
  purchaseDateFrom: string | null
  purchaseDateTo: string | null
  dateAcquiredFrom: string | null
  dateAcquiredTo: string | null
  includeDepreciableOnly: boolean
  depreciationMethod: string | null
  userId: string
  generatedAt: string
  reportStatus: string
  totalAssets: number | null
  totalValue: number | null
  averageCost: number | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface Asset {
  id: string
  assetTagId: string
  description: string | null
  cost: number | null
  status: string | null
  location: string | null
  department: string | null
  site: string | null
  category: { id: string; name: string } | null
  subCategory: { id: string; name: string } | null
}

interface AssetsPagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNextPage: boolean
}

interface ReportWithAssets {
  report: AssetReport
  assets?: Asset[]
  assetsPagination?: AssetsPagination
}

async function fetchReport(
  id: string,
  includeAssets: boolean = false,
  assetsPage: number = 1
): Promise<ReportWithAssets> {
  const params = new URLSearchParams()
  if (includeAssets) {
    params.append('includeAssets', 'true')
    params.append('page', assetsPage.toString())
    params.append('pageSize', '10')
  }
  const url = `/api/reports/assets/${id}${params.toString() ? `?${params.toString()}` : ''}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to fetch report')
  }
  return response.json()
}

const getReportTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    category: 'Category',
    location: 'Location',
    cost: 'Cost',
    depreciation: 'Depreciation',
    custom: 'Custom',
  }
  return labels[type] || type
}

const getStatusBadge = (status: string) => {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    draft: 'outline',
    saved: 'secondary',
    generated: 'default',
    archived: 'secondary',
  }
  return variants[status] || 'outline'
}

// Memoized table row to prevent unnecessary re-renders
const AssetTableRow = memo(({ asset }: { asset: Asset }) => (
  <TableRow>
    <TableCell className="font-medium">{asset.assetTagId}</TableCell>
    <TableCell className="max-w-[300px] truncate">
      {asset.description || '-'}
    </TableCell>
    <TableCell>
      {asset.category?.name || '-'}
      {asset.subCategory && ` / ${asset.subCategory.name}`}
    </TableCell>
    <TableCell>
      <Badge variant="outline">{asset.status || '-'}</Badge>
    </TableCell>
    <TableCell>{asset.location || '-'}</TableCell>
    <TableCell>{asset.department || '-'}</TableCell>
    <TableCell>{asset.site || '-'}</TableCell>
    <TableCell className="text-right">
      {formatCurrency(asset.cost)}
    </TableCell>
  </TableRow>
))
AssetTableRow.displayName = 'AssetTableRow'

export default function ViewReportPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canViewAssets = hasPermission('canViewAssets')
  const canManageReports = hasPermission('canManageReports')
  const reportId = params.id as string

  const [assetsPage, setAssetsPage] = useState(1)
  const [allAssets, setAllAssets] = useState<Asset[]>([])
  const processedPagesRef = useRef<Set<number>>(new Set())
  const previousReportIdRef = useRef<string | null>(null)
  const assetsCacheRef = useRef<Map<number, Asset[]>>(new Map())
  const [, startTransition] = useTransition()
  
  // Tab state from URL
  const activeTab = (searchParams.get('tab') as 'details' | 'assets') || 'details'

  // Update URL parameters
  const updateURL = useCallback(
    (updates: { tab?: 'details' | 'assets' }) => {
      const params = new URLSearchParams(searchParams.toString())

      if (updates.tab !== undefined) {
        if (updates.tab === 'details') {
          params.delete('tab')
        } else {
          params.set('tab', updates.tab)
        }
      }

      startTransition(() => {
        router.replace(`/reports/assets/${reportId}?${params.toString()}`, { scroll: false })
      })
    },
    [searchParams, router, reportId, startTransition]
  )

  const handleTabChange = (tab: 'details' | 'assets') => {
    updateURL({ tab })
  }

  // Fetch report (without assets initially)
  const { data: reportData, isLoading: reportLoading, error: reportError } = useQuery({
    queryKey: ['asset-report', reportId],
    queryFn: () => fetchReport(reportId, false),
    enabled: canViewAssets && canManageReports && !!reportId,
    staleTime: 5 * 60 * 1000,
  })

  const report = reportData?.report

  // Fetch assets with pagination
  const {
    data: assetsData,
    isLoading: assetsLoading,
    error: assetsError,
  } = useQuery({
    queryKey: ['asset-report-assets', reportId, assetsPage],
    queryFn: () => fetchReport(reportId, true, assetsPage),
    enabled: canViewAssets && canManageReports && !!reportId && !!report && report.reportStatus === 'generated',
    staleTime: 5 * 60 * 1000,
  })

  const assetsPagination = assetsData?.assetsPagination
  const currentAssetsStringRef = useRef<string>('')
  const hasInitialFetchRef = useRef<string | null>(null)

  // Reset fetch ref and processing refs when we have no assets displayed (e.g., when navigating back)
  useEffect(() => {
    if (report && allAssets.length === 0 && assetsPage === 1) {
      // Reset all refs if we have no assets - this handles navigating back
      if (hasInitialFetchRef.current === report.id) {
        hasInitialFetchRef.current = null
      }
      // Reset processing refs so data can be processed again
      processedPagesRef.current.clear()
      currentAssetsStringRef.current = ''
      assetsCacheRef.current.clear()
    }
  }, [report, allAssets.length, assetsPage])

  // Ensure initial fetch when report becomes available
  useEffect(() => {
    if (
      report &&
      report.reportStatus === 'generated' &&
      assetsPage === 1 &&
      canViewAssets &&
      reportId &&
      allAssets.length === 0 &&
      hasInitialFetchRef.current !== report.id
    ) {
      hasInitialFetchRef.current = report.id
      // Explicitly fetch page 1 assets when report loads
      queryClient.fetchQuery({
        queryKey: ['asset-report-assets', reportId, 1],
        queryFn: () => fetchReport(reportId, true, 1),
        staleTime: 5 * 60 * 1000,
      }).catch((error) => {
        // Silently handle errors - the query will retry if needed
        console.error('Failed to fetch initial assets:', error)
        hasInitialFetchRef.current = null // Reset on error so it can retry
      })
    }
  }, [report, assetsPage, canViewAssets, reportId, queryClient, allAssets.length])

  // Update cache when new assets are fetched - only when data actually changes
  useEffect(() => {
    const currentAssets = assetsData?.assets || []
    const currentAssetsString = JSON.stringify(currentAssets.map((a: Asset) => a.id).sort())
    
    // Process if:
    // 1. We have assets and the data is different from what we've seen, OR
    // 2. We have assets but no assets are displayed (e.g., after reset/navigation back)
    const shouldProcess = currentAssets.length > 0 && (
      currentAssetsString !== currentAssetsStringRef.current || 
      allAssets.length === 0
    )
    
    if (shouldProcess) {
      assetsCacheRef.current.set(assetsPage, currentAssets)
      currentAssetsStringRef.current = currentAssetsString
      
      // Only update state if this page hasn't been processed yet
      if (!processedPagesRef.current.has(assetsPage)) {
        startTransition(() => {
          if (assetsPage === 1) {
            // First page - replace all assets
            setAllAssets(currentAssets)
            processedPagesRef.current.clear()
            processedPagesRef.current.add(1)
          } else {
            // Subsequent pages - append new assets
            setAllAssets((prev) => {
              // Avoid duplicates by checking if asset already exists
              const existingIds = new Set(prev.map((a) => a.id))
              const uniqueNewAssets = currentAssets.filter((a: Asset) => !existingIds.has(a.id))
              processedPagesRef.current.add(assetsPage)
              return [...prev, ...uniqueNewAssets]
            })
          }
        })
      }
    } else if (assetsPage === 1 && currentAssets.length === 0 && !processedPagesRef.current.has(1)) {
      // No assets on first page
      startTransition(() => {
        setAllAssets([])
        processedPagesRef.current.clear()
      })
      currentAssetsStringRef.current = ''
    }
  }, [assetsData, assetsPage, startTransition, allAssets.length])

  // Reset when report changes
  useEffect(() => {
    if (previousReportIdRef.current !== reportId && reportId) {
      previousReportIdRef.current = reportId
      hasInitialFetchRef.current = null
      startTransition(() => {
        setAssetsPage(1)
        setAllAssets([])
      })
      processedPagesRef.current.clear()
      assetsCacheRef.current.clear()
    }
  }, [reportId, startTransition])

  const isLoading = reportLoading || (assetsPage === 1 && assetsLoading)
  const error = reportError || assetsError

  const handleLoadMore = () => {
    if (assetsPagination?.hasNextPage && !assetsLoading) {
      setAssetsPage((prev) => prev + 1)
    }
  }

  if (permissionsLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!canViewAssets) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-center">
          <FileText className="h-12 w-12 text-muted-foreground opacity-50" />
          <p className="text-lg font-medium">Access Denied</p>
          <p className="text-sm text-muted-foreground">
            You do not have permission to view asset reports. Please contact your administrator.
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-lg font-medium text-destructive">Error loading report</p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Failed to load report'}
          </p>
          <Button variant="outline" onClick={() => router.back()}>
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3 text-center">
          <FileText className="h-12 w-12 text-muted-foreground opacity-50" />
          <p className="text-lg font-medium">Report not found</p>
          <Button variant="outline" onClick={() => router.back()}>
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{report.reportName}</h1>
            {report.description && (
              <p className="text-muted-foreground mt-1">{report.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={getStatusBadge(report.reportStatus)} className="text-xs">
            {report.reportStatus}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {getReportTypeLabel(report.reportType)}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b">
        <button
          type="button"
          onClick={() => handleTabChange('details')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'details'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Report Details
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('assets')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'assets'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Affected Assets
        </button>
      </div>

      {/* Report Statistics - Only show for generated reports */}
      {activeTab === 'details' && report.reportStatus === 'generated' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(report.totalValue)}</div>
              <p className="text-xs text-muted-foreground mt-1">Combined asset value</p>
            </CardContent>
          </Card>
          <Card className="border-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Cost</CardTitle>
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(report.averageCost)}</div>
              <p className="text-xs text-muted-foreground mt-1">Per asset average</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Grid */}
      {activeTab === 'details' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 ">
        {/* Left Column - Report Information */}
        <div className="lg:col-span-2 space-y-6">
          {/* Report Configuration */}
          <Card className='h-full'>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Report Configuration
              </CardTitle>
              <CardDescription>Report settings and filter criteria</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Report Type</label>
                    <p className="text-base font-medium mt-1">{getReportTypeLabel(report.reportType)}</p>
                  </div>
                  {report.category && (
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Category</label>
                      <p className="text-base mt-1">
                        {report.category.name}
                        {report.subCategory && (
                          <span className="text-muted-foreground"> / {report.subCategory.name}</span>
                        )}
                      </p>
                    </div>
                  )}
                  {report.status && (
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status Filter</label>
                      <p className="text-base mt-1">{report.status}</p>
                    </div>
                  )}
                </div>

                {/* Location & Cost Filters */}
                <div className="space-y-4">
                  {(report.location || report.department || report.site) && (
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Location</label>
                      <div className="space-y-1.5 mt-1">
                        {report.location && (
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{report.location}</span>
                          </div>
                        )}
                        {report.department && (
                          <div className="flex items-center gap-2 text-sm">
                            <Building className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{report.department}</span>
                          </div>
                        )}
                        {report.site && (
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{report.site}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {(report.minCost !== null || report.maxCost !== null) && (
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cost Range</label>
                      <p className="text-base mt-1">
                        {report.minCost !== null ? formatCurrency(Number(report.minCost)) : 'No minimum'} -{' '}
                        {report.maxCost !== null ? formatCurrency(Number(report.maxCost)) : 'No maximum'}
                      </p>
                    </div>
                  )}
                  {report.includeDepreciableOnly && (
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Depreciation</label>
                      <p className="text-base mt-1">
                        Depreciable assets only
                        {report.depreciationMethod && (
                          <span className="text-muted-foreground"> ({report.depreciationMethod})</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Date Ranges */}
              {(report.purchaseDateFrom || report.purchaseDateTo || report.dateAcquiredFrom || report.dateAcquiredTo) && (
                <div className="mt-6 pt-6 border-t">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 block">Date Ranges</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(report.purchaseDateFrom || report.purchaseDateTo) && (
                      <div>
                        <label className="text-xs text-muted-foreground">Purchase Date</label>
                        <p className="text-sm mt-1">
                          {report.purchaseDateFrom
                            ? format(new Date(report.purchaseDateFrom), 'MMM dd, yyyy')
                            : 'No start'}{' '}
                          →{' '}
                          {report.purchaseDateTo
                            ? format(new Date(report.purchaseDateTo), 'MMM dd, yyyy')
                            : 'No end'}
                        </p>
                      </div>
                    )}
                    {(report.dateAcquiredFrom || report.dateAcquiredTo) && (
                      <div>
                        <label className="text-xs text-muted-foreground">Date Acquired</label>
                        <p className="text-sm mt-1">
                          {report.dateAcquiredFrom
                            ? format(new Date(report.dateAcquiredFrom), 'MMM dd, yyyy')
                            : 'No start'}{' '}
                          →{' '}
                          {report.dateAcquiredTo
                            ? format(new Date(report.dateAcquiredTo), 'MMM dd, yyyy')
                            : 'No end'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {report.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{report.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Metadata */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Timeline
              </CardTitle>
              <CardDescription>Report activity timeline</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Created</label>
                <p className="text-sm font-medium">
                  {format(new Date(report.createdAt), 'MMM dd, yyyy')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(report.createdAt), 'HH:mm')}
                </p>
              </div>
              {report.generatedAt && (
                <div className="space-y-1 pt-3 border-t">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Generated</label>
                  <p className="text-sm font-medium">
                    {format(new Date(report.generatedAt), 'MMM dd, yyyy')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(report.generatedAt), 'HH:mm')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      )}

      {/* Affected Assets List */}
      {activeTab === 'assets' && (
      <Card className='pb-2'>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Affected Assets
              </CardTitle>
              <CardDescription className="mt-1">
                {assetsPagination?.total || allAssets.length} asset{(assetsPagination?.total || allAssets.length) !== 1 ? 's' : ''} matching this report&apos;s criteria
                {allAssets.length > 0 && allAssets.length < (assetsPagination?.total || 0) && (
                  <span className="ml-2 font-medium">({allAssets.length} of {assetsPagination?.total} loaded)</span>
                )}
              </CardDescription>
            </div>
            {assetsPagination && assetsPagination.total > 0 && (
              <Badge variant="secondary" className="flex items-center gap-2 w-fit">
                <Package className="h-3.5 w-3.5" />
                {assetsPagination.total} Total
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!assetsPagination && assetsPage === 1 && assetsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <Spinner className="h-8 w-8" />
                <p className="text-sm text-muted-foreground">Loading assets...</p>
              </div>
            </div>
          ) : assetsPagination && assetsPagination.total === 0 && !assetsLoading ? (
            <div className="text-center py-16 text-muted-foreground">
              <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <Package className="h-8 w-8 opacity-50" />
              </div>
              <p className="font-medium text-base mb-1">No assets found</p>
              <p className="text-sm">No assets match the criteria for this report</p>
            </div>
          ) : (
            <>
              <ScrollArea>
              <Table className='border-b'>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Asset Tag</TableHead>
                      <TableHead className="font-semibold">Description</TableHead>
                      <TableHead className="font-semibold">Category</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Location</TableHead>
                      <TableHead className="font-semibold">Department</TableHead>
                      <TableHead className="font-semibold">Site</TableHead>
                      <TableHead className="text-right font-semibold">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allAssets.map((asset) => (
                      <AssetTableRow key={asset.id} asset={asset} />
                    ))}
                    {assetsLoading && assetsPage > 1 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-6">
                          <div className="flex items-center justify-center gap-2">
                            <Spinner className="h-4 w-4" />
                            <span className="text-sm text-muted-foreground">Loading more assets...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" className='z-10' />
              </ScrollArea>
              {assetsPagination?.hasNextPage && (
                <div className="flex justify-center py-2">
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
                    disabled={assetsLoading}
                    className="min-w-[140px]"
                  >
                    {assetsLoading ? (
                      <>
                        <Spinner className="mr-2 h-4 w-4" />
                        Loading...
                      </>
                    ) : (
                      <>
                        Load More
                      </>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  )
}

