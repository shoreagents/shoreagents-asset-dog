'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback, useTransition, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { usePermissions } from '@/hooks/use-permissions'
import { useSubCategories } from '@/hooks/use-categories'
import { assetReportSchema, type AssetReportFormData } from '@/lib/validations/reports'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { Field, FieldError, FieldContent } from '@/components/ui/field'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FileText, MoreHorizontal, Trash2, ArrowLeft, ArrowRight, RefreshCw, Play, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'

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

interface PaginationInfo {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

async function fetchReports(
  page: number = 1,
  pageSize: number = 10,
  status?: string,
  type?: string
): Promise<{ reports: AssetReport[]; pagination: PaginationInfo }> {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
  })
  if (status && status !== 'all') params.append('status', status)
  if (type && type !== 'all') params.append('type', type)

  const response = await fetch(`/api/reports/assets?${params.toString()}`)
  if (!response.ok) {
    throw new Error('Failed to fetch asset reports')
  }
  return response.json()
}

async function fetchUniqueStatuses(): Promise<string[]> {
  const response = await fetch('/api/assets?statuses=true')
  if (!response.ok) {
    throw new Error('Failed to fetch statuses')
  }
  const data = await response.json()
  return data.statuses || []
}

export default function AssetReportsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canViewAssets = hasPermission('canViewAssets')
  const queryClient = useQueryClient()
  const [, startTransition] = useTransition()

  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '10', 10)
  const statusFilter = searchParams.get('status') || 'all'
  const typeFilter = searchParams.get('type') || 'all'

  // Form with react-hook-form and Zod validation
  const {
    register,
    handleSubmit: handleFormSubmit,
    control,
    setValue,
    trigger,
    formState: { errors },
    reset,
  } = useForm<AssetReportFormData>({
    resolver: zodResolver(assetReportSchema),
    defaultValues: {
    reportName: '',
    reportType: '',
    description: '',
    categoryId: 'all',
    subCategoryId: 'all',
    status: 'all',
    location: '',
    department: '',
    site: '',
    minCost: '',
    maxCost: '',
    purchaseDateFrom: '',
    purchaseDateTo: '',
    dateAcquiredFrom: '',
    dateAcquiredTo: '',
    includeDepreciableOnly: false,
    depreciationMethod: 'all',
    notes: '',
    },
  })

  // Watch all form values using useWatch (better for React rendering)
  const formData = useWatch({ control }) as AssetReportFormData

  // Track form changes to show floating buttons - only show when there's actual input
  const isFormDirty = useMemo(() => {
    if (!formData) return false
    
    // Check if form has any meaningful data (non-empty, non-default values)
    const hasReportName = formData.reportName && typeof formData.reportName === 'string' && formData.reportName.trim() !== ''
    const hasReportType = formData.reportType && typeof formData.reportType === 'string' && formData.reportType.trim() !== ''
    const hasDescription = formData.description && typeof formData.description === 'string' && formData.description.trim() !== ''
    const hasCategory = formData.categoryId && formData.categoryId !== 'all'
    const hasSubCategory = formData.subCategoryId && formData.subCategoryId !== 'all'
    const hasStatus = formData.status && formData.status !== 'all'
    const hasLocation = formData.location && typeof formData.location === 'string' && formData.location.trim() !== ''
    const hasDepartment = formData.department && typeof formData.department === 'string' && formData.department.trim() !== ''
    const hasSite = formData.site && typeof formData.site === 'string' && formData.site.trim() !== ''
    const hasMinCost = formData.minCost && typeof formData.minCost === 'string' && formData.minCost.trim() !== ''
    const hasMaxCost = formData.maxCost && typeof formData.maxCost === 'string' && formData.maxCost.trim() !== ''
    const hasPurchaseDateFrom = formData.purchaseDateFrom && typeof formData.purchaseDateFrom === 'string' && formData.purchaseDateFrom.trim() !== ''
    const hasPurchaseDateTo = formData.purchaseDateTo && typeof formData.purchaseDateTo === 'string' && formData.purchaseDateTo.trim() !== ''
    const hasDateAcquiredFrom = formData.dateAcquiredFrom && typeof formData.dateAcquiredFrom === 'string' && formData.dateAcquiredFrom.trim() !== ''
    const hasDateAcquiredTo = formData.dateAcquiredTo && typeof formData.dateAcquiredTo === 'string' && formData.dateAcquiredTo.trim() !== ''
    const hasDepreciableOnly = formData.includeDepreciableOnly === true
    const hasDepreciationMethod = formData.depreciationMethod && formData.depreciationMethod !== 'all'
    const hasNotes = formData.notes && typeof formData.notes === 'string' && formData.notes.trim() !== ''
    
    return !!(
      hasReportName ||
      hasReportType ||
      hasDescription ||
      hasCategory ||
      hasSubCategory ||
      hasStatus ||
      hasLocation ||
      hasDepartment ||
      hasSite ||
      hasMinCost ||
      hasMaxCost ||
      hasPurchaseDateFrom ||
      hasPurchaseDateTo ||
      hasDateAcquiredFrom ||
      hasDateAcquiredTo ||
      hasDepreciableOnly ||
      hasDepreciationMethod ||
      hasNotes
    )
  }, [formData])

  // Clear form function
  const clearForm = () => {
    reset({
      reportName: '',
      reportType: '',
      description: '',
      categoryId: 'all',
      subCategoryId: 'all',
      status: 'all',
      location: '',
      department: '',
      site: '',
      minCost: '',
      maxCost: '',
      purchaseDateFrom: '',
      purchaseDateTo: '',
      dateAcquiredFrom: '',
      dateAcquiredTo: '',
      includeDepreciableOnly: false,
      depreciationMethod: 'all',
      notes: '',
    })
  }


  // Lazy load categories - only fetch when category dropdown is opened
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false)
  const { data: categoriesData, isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await fetch('/api/categories')
      if (!response.ok) {
        // Return empty array on error instead of throwing
        return []
      }
      const data = await response.json()
      // Ensure we always return an array, never undefined
      return (data.categories || []) as Array<{ id: string; name: string }>
    },
    enabled: canViewAssets && isCategoryDropdownOpen && (formData.reportType === 'category' || formData.reportType === 'custom'),
    staleTime: 10 * 60 * 1000,
  })

  // Lazy load subcategories - fetch when dropdown is opened OR when subcategory is selected (to display name)
  const [isSubCategoryDropdownOpen, setIsSubCategoryDropdownOpen] = useState(false)
  const shouldFetchSubCategories = 
    (formData.reportType === 'category' || formData.reportType === 'custom') && 
    formData.categoryId && 
    formData.categoryId !== 'all'
  
  // Fetch subcategories when dropdown is opened OR when we have a selected subcategory (to display the name)
  const { data: subCategoriesData, isLoading: subCategoriesLoading } = useSubCategories(
    (isSubCategoryDropdownOpen || (shouldFetchSubCategories && formData.subCategoryId && formData.subCategoryId !== 'all'))
      ? (formData.categoryId || null)
      : null
  )

  // Lazy load statuses - only fetch when status dropdown is opened
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false)
  const { data: statusesData, isLoading: statusesLoading } = useQuery({
    queryKey: ['asset-statuses'],
    queryFn: fetchUniqueStatuses,
    enabled: canViewAssets && isStatusDropdownOpen && !!formData.reportType,
    staleTime: 10 * 60 * 1000,
  })

  // Update URL parameters
  const updateURL = useCallback((updates: { page?: number; pageSize?: number; status?: string; type?: string }) => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (updates.page !== undefined) {
      if (updates.page === 1) {
        params.delete('page')
      } else {
        params.set('page', updates.page.toString())
      }
    }
    
    if (updates.pageSize !== undefined) {
      if (updates.pageSize === 10) {
        params.delete('pageSize')
      } else {
        params.set('pageSize', updates.pageSize.toString())
      }
    }
    
    if (updates.status !== undefined) {
      if (updates.status === 'all') {
        params.delete('status')
      } else {
        params.set('status', updates.status)
      }
      params.delete('page')
    }
    
    if (updates.type !== undefined) {
      if (updates.type === 'all') {
        params.delete('type')
      } else {
        params.set('type', updates.type)
      }
      params.delete('page')
    }
    
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false })
    })
  }, [searchParams, router, startTransition])

  // Fetch reports with React Query
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['asset-reports', page, pageSize, statusFilter, typeFilter],
    queryFn: () => fetchReports(page, pageSize, statusFilter !== 'all' ? statusFilter : undefined, typeFilter !== 'all' ? typeFilter : undefined),
    enabled: canViewAssets,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const reports = data?.reports || []
  const pagination = data?.pagination

  // Create report mutation
  const createMutation = useMutation({
    mutationFn: async (reportData: {
      reportName: string
      reportType: string
      description: string | null
      categoryId: string | null
      subCategoryId: string | null
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
      notes: string | null
    }) => {
      const response = await fetch('/api/reports/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportData),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create report')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-reports'] })
      // Reset form
      reset({
        reportName: '',
        reportType: '',
        description: '',
        categoryId: 'all',
        subCategoryId: 'all',
        status: 'all',
        location: '',
        department: '',
        site: '',
        minCost: '',
        maxCost: '',
        purchaseDateFrom: '',
        purchaseDateTo: '',
        dateAcquiredFrom: '',
        dateAcquiredTo: '',
        includeDepreciableOnly: false,
        depreciationMethod: 'all',
        notes: '',
      })
      toast.success('Report created successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create report')
    },
  })

  // Generate report mutation
  const generateMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const response = await fetch(`/api/reports/assets/${reportId}`, {
        method: 'PATCH',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate report')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-reports'] })
      toast.success('Report generated successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to generate report')
    },
  })

  // Delete report mutation
  const deleteMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const response = await fetch(`/api/reports/assets/${reportId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete report')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-reports'] })
      toast.success('Report deleted successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete report')
    },
  })

  const onSubmit = (data: AssetReportFormData) => {
    createMutation.mutate({
      reportName: data.reportName,
      reportType: data.reportType,
      description: data.description || null,
      categoryId: data.categoryId === 'all' ? null : data.categoryId || null,
      subCategoryId: data.subCategoryId === 'all' ? null : data.subCategoryId || null,
      status: data.status === 'all' ? null : data.status || null,
      location: data.location || null,
      department: data.department || null,
      site: data.site || null,
      minCost: data.minCost ? parseFloat(data.minCost) : null,
      maxCost: data.maxCost ? parseFloat(data.maxCost) : null,
      purchaseDateFrom: data.purchaseDateFrom || null,
      purchaseDateTo: data.purchaseDateTo || null,
      dateAcquiredFrom: data.dateAcquiredFrom || null,
      dateAcquiredTo: data.dateAcquiredTo || null,
      includeDepreciableOnly: data.includeDepreciableOnly,
      depreciationMethod: data.depreciationMethod === 'all' ? null : data.depreciationMethod || null,
      notes: data.notes || null,
    })
  }

  const handlePageChange = (newPage: number) => {
    updateURL({ page: newPage })
  }

  const handlePageSizeChange = (newPageSize: string) => {
    updateURL({ pageSize: parseInt(newPageSize), page: 1 })
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

  const formatCurrency = (value: number | null) => {
    if (!value) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PHP',
    }).format(value)
  }

  if (permissionsLoading) {
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

  return (
    <div className={isFormDirty ? "space-y-6 pb-16" : "space-y-6"}>
      <div>
        <h1 className="text-3xl font-bold">Asset Reports</h1>
        <p className="text-muted-foreground">
          Generate and view comprehensive asset reports
        </p>
      </div>

      {/* Reports History Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Report History</CardTitle>
              <CardDescription>
                {pagination?.total || 0} report{pagination?.total !== 1 ? 's' : ''} found
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching || isLoading}
              className="h-8 w-8"
              title="Refresh reports"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <Spinner className="h-8 w-8" />
                <p className="text-sm text-muted-foreground">Loading reports...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3 text-center">
                <p className="text-lg font-medium text-destructive">Error loading reports</p>
                <p className="text-sm text-muted-foreground">
                  {error instanceof Error ? error.message : 'Failed to load asset reports'}
                </p>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Try Again
                </Button>
              </div>
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <p className="font-medium text-base mb-1">No reports found</p>
              <p className="text-sm">Create your first asset report to get started</p>
            </div>
          ) : (
            <>
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead>Report Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total Assets</TableHead>
                      <TableHead>Total Value</TableHead>
                      <TableHead>Generated</TableHead>
                      <TableHead className="w-[70px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">{report.reportName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{getReportTypeLabel(report.reportType)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadge(report.reportStatus)}>
                            {report.reportStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>{report.totalAssets ?? '-'}</TableCell>
                        <TableCell>{formatCurrency(report.totalValue)}</TableCell>
                        <TableCell>
                          {report.generatedAt
                            ? format(new Date(report.generatedAt), 'MMM dd, yyyy')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  router.push(`/reports/assets/${report.id}`)
                                }}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Report
                              </DropdownMenuItem>
                              {(report.reportStatus === 'draft' || report.reportStatus === 'saved') && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    generateMutation.mutate(report.id)
                                  }}
                                  disabled={generateMutation.isPending}
                                >
                                  <Play className="mr-2 h-4 w-4" />
                                  Generate Report
                                </DropdownMenuItem>
                              )}
                              {report.reportStatus === 'generated' && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    generateMutation.mutate(report.id)
                                  }}
                                  disabled={generateMutation.isPending}
                                >
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                  Regenerate Report
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => {
                                  if (confirm(`Delete report "${report.reportName}"?`)) {
                                    deleteMutation.mutate(report.id)
                                  }
                                }}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              <ScrollBar orientation="horizontal" className='z-10' />
              </ScrollArea>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-4 border-t">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={!pagination.hasPreviousPage || isLoading}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-2 text-sm">
                      <span>Page</span>
                      <span className="font-medium">{page}</span>
                      <span>of</span>
                      <span className="font-medium">{pagination.totalPages}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(page + 1)}
                      disabled={!pagination.hasNextPage || isLoading}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <Select value={pageSize.toString()} onValueChange={handlePageSizeChange} disabled={isLoading}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 per page</SelectItem>
                      <SelectItem value="25">25 per page</SelectItem>
                      <SelectItem value="50">50 per page</SelectItem>
                      <SelectItem value="100">100 per page</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Report Form */}
      <Card>
        <CardHeader>
          <CardTitle>Create New Report</CardTitle>
          <CardDescription>
            Configure your asset report with filters and options
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleFormSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field>
                  <Label htmlFor="reportName" className="mb-2 block">Report Name *</Label>
                  <FieldContent>
                  <Input
                    id="reportName"
                      {...register('reportName')}
                    placeholder="e.g., Assets by Category - Q4 2024"
                    />
                    <FieldError errors={errors.reportName ? [errors.reportName] : undefined} />
                  </FieldContent>
                </Field>
                <Field>
                  <Label htmlFor="reportType" className="mb-2 block">Report Type *</Label>
                  <FieldContent>
                  <Select
                      value={formData.reportType || ''}
                      onValueChange={(value) => {
                        setValue('reportType', value, { shouldValidate: true })
                        trigger('reportType')
                      }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select report type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="category">Category</SelectItem>
                      <SelectItem value="location">Location</SelectItem>
                      <SelectItem value="cost">Cost</SelectItem>
                      <SelectItem value="depreciation">Depreciation</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                    <FieldError errors={errors.reportType ? [errors.reportType] : undefined} />
                  </FieldContent>
                </Field>
                <Field className="md:col-span-2">
                  <Label htmlFor="description" className="mb-2 block">Description</Label>
                  <FieldContent>
                  <Textarea
                    id="description"
                      {...register('description')}
                    placeholder="Optional description"
                    rows={2}
                  />
                    <FieldError errors={errors.description ? [errors.description] : undefined} />
                  </FieldContent>
                </Field>
              </div>
            </div>

            {/* Filters */}
            {formData.reportType && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Filters</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Category filters - shown for category and custom report types */}
                  {(formData.reportType === 'category' || formData.reportType === 'custom') && (
                    <>
                      <Field>
                        <Label htmlFor="categoryId" className="mb-2 block">Category</Label>
                        <FieldContent>
                          <Select
                            value={formData.categoryId || 'all'}
                            onValueChange={(value) => {
                              setValue('categoryId', value)
                              setValue('subCategoryId', 'all')
                            }}
                            open={isCategoryDropdownOpen}
                            onOpenChange={setIsCategoryDropdownOpen}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="All Categories" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Categories</SelectItem>
                              {categoriesData?.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                              ))}
                              {isCategoryDropdownOpen && categoriesLoading && (
                                <SelectItem value="loading" disabled>
                                  <div className="flex items-center gap-2">
                                    <Spinner className="h-4 w-4" />
                                    <span>Loading categories...</span>
                                  </div>
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FieldError errors={errors.categoryId ? [errors.categoryId] : undefined} />
                        </FieldContent>
                      </Field>
                      <Field>
                        <Label htmlFor="subCategoryId" className="mb-2 block">Sub Category</Label>
                        <FieldContent>
                          <Select
                            value={formData.subCategoryId || 'all'}
                            onValueChange={(value) => setValue('subCategoryId', value)}
                            disabled={!formData.categoryId || formData.categoryId === 'all'}
                            open={isSubCategoryDropdownOpen}
                            onOpenChange={setIsSubCategoryDropdownOpen}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="All Sub Categories" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Sub Categories</SelectItem>
                              {subCategoriesData?.map((sub) => (
                                <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                              ))}
                              {isSubCategoryDropdownOpen && subCategoriesLoading && (
                                <SelectItem value="loading" disabled>
                                  <div className="flex items-center gap-2">
                                    <Spinner className="h-4 w-4" />
                                    <span>Loading subcategories...</span>
                                  </div>
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FieldError errors={errors.subCategoryId ? [errors.subCategoryId] : undefined} />
                        </FieldContent>
                      </Field>
                    </>
                  )}

                  {/* Location filters - shown for location and custom report types */}
                  {(formData.reportType === 'location' || formData.reportType === 'custom') && (
                    <>
                      <Field>
                        <Label htmlFor="location" className="mb-2 block">
                          Location
                          {formData.reportType === 'location' && <span className="text-destructive ml-1">*</span>}
                        </Label>
                        <FieldContent>
                          <Input
                            id="location"
                            {...register('location')}
                            placeholder="Filter by location"
                          />
                          <FieldError errors={errors.location ? [errors.location] : undefined} />
                        </FieldContent>
                      </Field>
                      <Field>
                        <Label htmlFor="department" className="mb-2 block">
                          Department
                          {formData.reportType === 'location' && <span className="text-destructive ml-1">*</span>}
                        </Label>
                        <FieldContent>
                          <Input
                            id="department"
                            {...register('department')}
                            placeholder="Filter by department"
                          />
                          <FieldError errors={errors.location && formData.reportType === 'location' ? [errors.location] : errors.department ? [errors.department] : undefined} />
                        </FieldContent>
                      </Field>
                      <Field>
                        <Label htmlFor="site" className="mb-2 block">
                          Site
                          {formData.reportType === 'location' && <span className="text-destructive ml-1">*</span>}
                        </Label>
                        <FieldContent>
                          <Input
                            id="site"
                            {...register('site')}
                            placeholder="Filter by site"
                          />
                          <FieldError errors={errors.location && formData.reportType === 'location' ? [errors.location] : errors.site ? [errors.site] : undefined} />
                        </FieldContent>
                      </Field>
                    </>
                  )}

                  {/* Status filter - shown for all report types */}
                  <Field>
                    <Label htmlFor="status" className="mb-2 block">Status</Label>
                    <FieldContent>
                      <Select
                        value={formData.status || 'all'}
                        onValueChange={(value) => setValue('status', value)}
                        open={isStatusDropdownOpen}
                        onOpenChange={setIsStatusDropdownOpen}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          {statusesData?.map((status) => (
                            <SelectItem key={status} value={status}>{status}</SelectItem>
                          ))}
                          {isStatusDropdownOpen && statusesLoading && (
                            <SelectItem value="loading" disabled>
                              <div className="flex items-center gap-2">
                                <Spinner className="h-4 w-4" />
                                <span>Loading statuses...</span>
                              </div>
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FieldError errors={errors.status ? [errors.status] : undefined} />
                    </FieldContent>
                  </Field>
                </div>
                </div>
            )}

            {/* Cost Range - shown for cost and custom report types */}
            {(formData.reportType === 'cost' || formData.reportType === 'custom') && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Cost Range</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field>
                    <Label htmlFor="minCost" className="mb-2 block">
                      Minimum Cost
                      {formData.reportType === 'cost' && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <FieldContent>
                  <Input
                    id="minCost"
                    type="number"
                    step="0.01"
                        {...register('minCost')}
                    placeholder="0.00"
                  />
                      <FieldError errors={errors.minCost ? [errors.minCost] : undefined} />
                    </FieldContent>
                  </Field>
                  <Field>
                    <Label htmlFor="maxCost" className="mb-2 block">
                      Maximum Cost
                      {formData.reportType === 'cost' && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <FieldContent>
                  <Input
                    id="maxCost"
                    type="number"
                    step="0.01"
                        {...register('maxCost')}
                    placeholder="0.00"
                  />
                      <FieldError errors={errors.minCost && formData.reportType === 'cost' ? [errors.minCost] : errors.maxCost ? [errors.maxCost] : undefined} />
                    </FieldContent>
                  </Field>
                </div>
              </div>
            )}

            {/* Date Ranges - shown for custom report type only */}
            {formData.reportType === 'custom' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Date Ranges</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field>
                  <Label htmlFor="purchaseDateFrom" className="mb-2 block">Purchase Date From</Label>
                    <FieldContent>
                  <Input
                    id="purchaseDateFrom"
                    type="date"
                        {...register('purchaseDateFrom')}
                      />
                      <FieldError errors={errors.purchaseDateFrom ? [errors.purchaseDateFrom] : undefined} />
                    </FieldContent>
                  </Field>
                  <Field>
                  <Label htmlFor="purchaseDateTo" className="mb-2 block">Purchase Date To</Label>
                    <FieldContent>
                  <Input
                    id="purchaseDateTo"
                    type="date"
                        {...register('purchaseDateTo')}
                      />
                      <FieldError errors={errors.purchaseDateTo ? [errors.purchaseDateTo] : undefined} />
                    </FieldContent>
                  </Field>
                  <Field>
                  <Label htmlFor="dateAcquiredFrom" className="mb-2 block">Date Acquired From</Label>
                    <FieldContent>
                  <Input
                    id="dateAcquiredFrom"
                    type="date"
                        {...register('dateAcquiredFrom')}
                      />
                      <FieldError errors={errors.dateAcquiredFrom ? [errors.dateAcquiredFrom] : undefined} />
                    </FieldContent>
                  </Field>
                  <Field>
                  <Label htmlFor="dateAcquiredTo" className="mb-2 block">Date Acquired To</Label>
                    <FieldContent>
                  <Input
                    id="dateAcquiredTo"
                    type="date"
                        {...register('dateAcquiredTo')}
                  />
                      <FieldError errors={errors.dateAcquiredTo ? [errors.dateAcquiredTo] : undefined} />
                    </FieldContent>
                  </Field>
                </div>
              </div>
            )}

            {/* Depreciation - shown for depreciation and custom report types */}
            {(formData.reportType === 'depreciation' || formData.reportType === 'custom') && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Depreciation</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="includeDepreciableOnly"
                      {...register('includeDepreciableOnly')}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="includeDepreciableOnly" className="block cursor-pointer">
                    Include Depreciable Assets Only
                  </Label>
                </div>
                  <Field>
                  <Label htmlFor="depreciationMethod" className="mb-2 block">Depreciation Method</Label>
                    <FieldContent>
                  <Select
                        value={formData.depreciationMethod || 'all'}
                        onValueChange={(value) => setValue('depreciationMethod', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Methods" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      <SelectItem value="straight-line">Straight Line</SelectItem>
                      <SelectItem value="declining-balance">Declining Balance</SelectItem>
                      <SelectItem value="sum-of-years">Sum of Years</SelectItem>
                    </SelectContent>
                  </Select>
                      <FieldError errors={errors.depreciationMethod ? [errors.depreciationMethod] : undefined} />
                    </FieldContent>
                  </Field>
                </div>
              </div>
            )}

            {/* Notes */}
            <Field>
              <Label htmlFor="notes" className="mb-2 block">Notes</Label>
              <FieldContent>
              <Textarea
                id="notes"
                  {...register('notes')}
                placeholder="Additional notes..."
                rows={3}
              />
                <FieldError errors={errors.notes ? [errors.notes] : undefined} />
              </FieldContent>
            </Field>

          </form>
        </CardContent>
      </Card>

      {/* Floating Action Buttons - Only show when form has changes */}
      {isFormDirty && canViewAssets && (
        <div className="fixed bottom-6 z-50 flex items-center justify-center gap-3 left-1/2 -translate-x-1/2 md:left-[calc(var(--sidebar-width,16rem)+((100vw-var(--sidebar-width,16rem))/2))] md:translate-x-[-50%]">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={clearForm}
            className="min-w-[120px] bg-accent!"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={() => {
              const form = document.querySelector('form') as HTMLFormElement
              if (form) {
                form.requestSubmit()
              }
            }}
            disabled={createMutation.isPending}
            className="min-w-[120px]"
          >
            {createMutation.isPending ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Creating...
              </>
            ) : (
              'Create Report'
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
