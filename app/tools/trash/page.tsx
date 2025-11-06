'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePermissions } from '@/hooks/use-permissions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Trash2, RotateCcw, AlertTriangle, Package, Search, RotateCw } from 'lucide-react'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { format } from 'date-fns'
import { differenceInDays } from 'date-fns'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, ArrowLeft, ArrowRight } from 'lucide-react'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface DeletedAsset {
  id: string
  assetTagId: string
  description: string
  status: string | null
  category: {
    name: string
  } | null
  subCategory: {
    name: string
  } | null
  location: string | null
  deletedAt: string
}

async function fetchDeletedAssets(page: number = 1, pageSize: number = 100, search?: string) {
  // Fetch all deleted assets with a large page size to get accurate count
  const response = await fetch(`/api/assets?includeDeleted=true&page=1&pageSize=10000`)
  if (!response.ok) throw new Error('Failed to fetch deleted assets')
  const data = await response.json()
  // Filter to only show soft-deleted assets
  let allDeletedAssets = data.assets?.filter((asset: { isDeleted?: boolean }) => asset.isDeleted) || []
  
  // Apply search filter if provided
  if (search && search.trim()) {
    const searchLower = search.toLowerCase().trim()
    allDeletedAssets = allDeletedAssets.filter((asset: DeletedAsset) => {
      return (
        asset.assetTagId?.toLowerCase().includes(searchLower) ||
        asset.description?.toLowerCase().includes(searchLower) ||
        asset.category?.name?.toLowerCase().includes(searchLower) ||
        asset.subCategory?.name?.toLowerCase().includes(searchLower) ||
        asset.location?.toLowerCase().includes(searchLower) ||
        asset.status?.toLowerCase().includes(searchLower)
      )
    })
  }
  
  // Calculate pagination based on filtered results
  const total = allDeletedAssets.length
  const totalPages = Math.ceil(total / pageSize)
  const skip = (page - 1) * pageSize
  const paginatedAssets = allDeletedAssets.slice(skip, skip + pageSize)
  
  return {
    assets: paginatedAssets,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  }
}

export default function TrashPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canViewAssets = hasPermission('canViewAssets')
  const canManageTrash = hasPermission('canManageTrash')
  const queryClient = useQueryClient()
  
  // Get page, pageSize, and search from URL
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '100', 10)
  
  // Separate states for search input (immediate UI) and search query (debounced API calls)
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '')
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previousSearchInputRef = useRef<string>(searchParams.get('search') || '')
  
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<DeletedAsset | null>(null)

  // Update URL parameters
  const updateURL = useCallback((updates: { page?: number; pageSize?: number; search?: string }) => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (updates.page !== undefined) {
      if (updates.page === 1) {
        params.delete('page')
      } else {
        params.set('page', updates.page.toString())
      }
    }
    
    if (updates.pageSize !== undefined) {
      if (updates.pageSize === 100) {
        params.delete('pageSize')
      } else {
        params.set('pageSize', updates.pageSize.toString())
      }
      params.delete('page')
    }
    
    if (updates.search !== undefined) {
      if (updates.search === '') {
        params.delete('search')
      } else {
        params.set('search', updates.search)
      }
      params.delete('page')
    }
    
    router.push(`?${params.toString()}`, { scroll: false })
  }, [searchParams, router])

  // Debounce search input
  useEffect(() => {
    if (searchInput === previousSearchInputRef.current) {
      return
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(searchInput)
      previousSearchInputRef.current = searchInput
      const currentSearch = searchParams.get('search') || ''
      if (searchInput !== currentSearch) {
        updateURL({ search: searchInput, page: 1 })
      }
    }, 500)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
        searchTimeoutRef.current = null
      }
    }
  }, [searchInput, searchParams, updateURL])


  // Fetch deleted assets
  const { data, isLoading } = useQuery({
    queryKey: ['deletedAssets', page, pageSize, searchQuery],
    queryFn: () => fetchDeletedAssets(page, pageSize, searchQuery || undefined),
    enabled: (canViewAssets || canManageTrash) && !permissionsLoading,
  })

  const handlePageSizeChange = (newPageSize: string) => {
    updateURL({ pageSize: parseInt(newPageSize), page: 1 })
  }

  const handlePageChange = (newPage: number) => {
    updateURL({ page: newPage })
  }

  // Combine loading states
  const isLoadingData = permissionsLoading || isLoading

  // Restore mutation
  const restoreMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const response = await fetch(`/api/assets/${assetId}/restore`, {
        method: 'PATCH',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to restore asset')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deletedAssets'] })
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      toast.success('Asset restored successfully')
      setIsRestoreDialogOpen(false)
      setSelectedAsset(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to restore asset')
    },
  })

  // Permanent delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const response = await fetch(`/api/assets/${assetId}?permanent=true`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to permanently delete asset')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deletedAssets'] })
      toast.success('Asset permanently deleted')
      setIsDeleteDialogOpen(false)
      setSelectedAsset(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to permanently delete asset')
    },
  })

  const handleRestore = (asset: DeletedAsset) => {
    setSelectedAsset(asset)
    setIsRestoreDialogOpen(true)
  }

  const handleDelete = (asset: DeletedAsset) => {
    setSelectedAsset(asset)
    setIsDeleteDialogOpen(true)
  }

  const confirmRestore = () => {
    if (selectedAsset) {
      restoreMutation.mutate(selectedAsset.id)
    }
  }

  const confirmDelete = () => {
    if (selectedAsset) {
      deleteMutation.mutate(selectedAsset.id)
    }
  }

  const getDaysUntilPermanentDelete = (deletedAt: string) => {
    const deletedDate = new Date(deletedAt)
    const daysSinceDeleted = differenceInDays(new Date(), deletedDate)
    return Math.max(0, 30 - daysSinceDeleted)
  }

  if (isLoadingData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Trash</h1>
          <p className="text-muted-foreground">
            View and manage deleted assets
          </p>
        </div>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
          <Spinner className="h-8 w-8" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!canViewAssets && !canManageTrash && !permissionsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Trash</h1>
          <p className="text-muted-foreground">
            View and manage deleted assets
          </p>
        </div>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3 text-center">
            <Package className="h-12 w-12 text-muted-foreground opacity-50" />
            <p className="text-lg font-medium">Access Denied</p>
            <p className="text-sm text-muted-foreground">
              You do not have permission to view deleted assets. Please contact your administrator.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const deletedAssets = data?.assets || []
  const pagination = data?.pagination

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Trash</h1>
        <p className="text-muted-foreground">
          View and manage deleted assets. Assets will be permanently deleted after 30 days.
        </p>
      </div>

      <Card className="gap-0">
        <CardHeader className="shrink-0 pb-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <CardTitle>Deleted Assets</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                View and manage deleted assets. Assets will be permanently deleted after 30 days.
              </CardDescription>
            </div>
            <div className="flex gap-2 sm:gap-3 items-center">
              <Button
                variant="outline"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['deletedAssets'] })
                  toast.success('Deleted assets list refreshed')
                }}
                disabled={isLoading}
              >
                <RotateCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          <div className="relative flex-1 mt-3 w-full md:w-sm">
            <div className="relative flex-1 sm:flex-initial sm:min-w-[250px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by asset tag, description, category, location..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-0">
          {isLoadingData ? (
            <div className="flex items-center justify-center py-12 h-[calc(100vh-25rem)] min-h-[500px]">
              <div className="flex flex-col items-center gap-3">
                <Spinner className="h-8 w-8" />
                <p className="text-sm text-muted-foreground">Loading deleted assets...</p>
              </div>
            </div>
          ) : deletedAssets.length === 0 ? (
            <div className="min-w-full">
              <ScrollArea className="h-[calc(100vh-25rem)] min-h-[500px]">
                <div className="flex items-center justify-center h-full">
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No deleted assets found</p>
                    <p className="text-sm">Deleted assets will appear here</p>
                  </div>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          ) : (
            <div className="min-w-full">
              <ScrollArea className="h-[calc(100vh-25rem)] min-h-[500px]">
                <Table className="border-t">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset Tag</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Deleted Date</TableHead>
                      <TableHead>Days Left</TableHead>
                      <TableHead className={cn("text-center sticky right-0 bg-card z-10 shadow-[inset_4px_0_6px_-4px_rgba(0,0,0,0.1)]")}>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deletedAssets.map((asset: DeletedAsset) => {
                      const daysLeft = getDaysUntilPermanentDelete(asset.deletedAt)
                      return (
                        <TableRow key={asset.id}>
                          <TableCell className="font-medium">{asset.assetTagId}</TableCell>
                          <TableCell className="max-w-[300px] truncate">{asset.description}</TableCell>
                          <TableCell>
                            {asset.category?.name || '-'} / {asset.subCategory?.name || '-'}
                          </TableCell>
                          <TableCell>
                            {asset.status ? (
                              <Badge variant="outline">{asset.status}</Badge>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>{asset.location || '-'}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(asset.deletedAt), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>
                            {daysLeft > 0 ? (
                              <Badge variant={daysLeft <= 7 ? 'destructive' : 'default'}>
                                {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Overdue
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className={cn("sticky right-0 bg-card z-10 shadow-[inset_4px_0_6px_-4px_rgba(0,0,0,0.1)]")}>
                            <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    className="h-8 w-8 p-0"
                                    onClick={(e) => {
                                      if (!canManageTrash) {
                                        e.preventDefault()
                                        toast.error('You do not have permission to take actions')
                                      }
                                    }}
                                  >
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                {canManageTrash && (
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => handleRestore(asset)}
                                    className="cursor-pointer"
                                  >
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Restore
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(asset)}
                                    className="cursor-pointer text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Permanently
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                                )}
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          )}
        </CardContent>

        {/* Pagination Bar */}
        <div className="sticky bottom-0 border-t bg-transparent z-10 shadow-sm mt-auto">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 px-4 sm:px-6 py-3">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (pagination?.hasPreviousPage) {
                    handlePageChange(Math.max(1, page - 1))
                  }
                }}
                disabled={!pagination?.hasPreviousPage || isLoadingData}
                className="h-8 px-2 sm:px-3"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                <span className="text-muted-foreground">Page</span>
                <div className="px-1.5 sm:px-2 py-1 rounded-md bg-primary/10 text-primary font-medium text-xs sm:text-sm">
                  {isLoadingData ? '...' : (pagination?.page || page)}
                </div>
                <span className="text-muted-foreground">of</span>
                <span className="text-muted-foreground">{isLoadingData ? '...' : (pagination?.totalPages || 1)}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (pagination?.hasNextPage) {
                    handlePageChange(Math.min(pagination.totalPages, page + 1))
                  }
                }}
                disabled={!pagination?.hasNextPage || isLoadingData}
                className="h-8 px-2 sm:px-3"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-center sm:justify-end gap-2 sm:gap-4">
              <Select value={pageSize.toString()} onValueChange={handlePageSizeChange} disabled={isLoadingData}>
                <SelectTrigger className="h-8 w-auto min-w-[90px] sm:min-w-[100px] text-xs sm:text-sm border-primary/20 bg-primary/10 text-primary font-medium hover:bg-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50 rows</SelectItem>
                  <SelectItem value="100">100 rows</SelectItem>
                  <SelectItem value="200">200 rows</SelectItem>
                  <SelectItem value="300">300 rows</SelectItem>
                  <SelectItem value="500">500 rows</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                {isLoadingData ? (
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

      {/* Restore Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={isRestoreDialogOpen}
        onOpenChange={setIsRestoreDialogOpen}
        onConfirm={confirmRestore}
        itemName={selectedAsset?.assetTagId || 'asset'}
        isLoading={restoreMutation.isPending}
        title="Restore Asset"
        description={`Are you sure you want to restore "${selectedAsset?.assetTagId}"? This will make the asset available again.`}
        confirmLabel="Restore"
        loadingLabel="Restoring..."
      />

      {/* Permanent Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={confirmDelete}
        itemName={selectedAsset?.assetTagId || 'asset'}
        isLoading={deleteMutation.isPending}
        title="Permanently Delete Asset"
        description={`Are you sure you want to permanently delete "${selectedAsset?.assetTagId}"? This action cannot be undone.`}
        confirmLabel="Delete Permanently"
      />
    </div>
  )
}

