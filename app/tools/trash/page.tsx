'use client'

import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePermissions } from '@/hooks/use-permissions'
import { motion, AnimatePresence } from 'framer-motion'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  HeaderGroup,
  Header,
} from '@tanstack/react-table'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Trash2, RotateCcw, AlertTriangle, Package, Search, RotateCw, X, MoreHorizontal, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
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
import { DeleteConfirmationDialog } from '@/components/dialogs/delete-confirmation-dialog'
import { BulkDeleteDialog } from '@/components/dialogs/bulk-delete-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMobileDock } from '@/components/mobile-dock-provider'
import { useIsMobile } from '@/hooks/use-mobile'

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

// Helper function to get status badge with colors
const getStatusBadge = (status: string | null) => {
  if (!status) return null
  const statusLC = status.toLowerCase()
  let statusVariant: 'default' | 'secondary' | 'destructive' | 'outline' = 'outline'
  let statusColor = ''
  
  if (statusLC === 'active' || statusLC === 'available') {
    statusVariant = 'default'
    statusColor = 'bg-green-500'
  } else if (statusLC === 'checked out' || statusLC === 'in use') {
    statusVariant = 'destructive'
    statusColor = 'bg-blue-500'
  } else if (statusLC === 'leased') {
    statusVariant = 'secondary'
    statusColor = 'bg-yellow-500'
  } else if (statusLC === 'inactive' || statusLC === 'unavailable') {
    statusVariant = 'secondary'
    statusColor = 'bg-gray-500'
  } else if (statusLC === 'maintenance' || statusLC === 'repair') {
    statusColor = 'bg-red-600 text-white'
  } else if (statusLC === 'lost' || statusLC === 'missing') {
    statusVariant = 'destructive'
    statusColor = 'bg-orange-500'
  } else if (statusLC === 'disposed' || statusLC === 'disposal') {
    statusVariant = 'secondary'
    statusColor = 'bg-purple-500'
  } else if (statusLC === 'sold') {
    statusVariant = 'default'
    statusColor = 'bg-teal-500 text-white border-0'
  } else if (statusLC === 'donated') {
    statusVariant = 'default'
    statusColor = 'bg-blue-500 text-white border-0'
  } else if (statusLC === 'scrapped') {
    statusVariant = 'default'
    statusColor = 'bg-orange-500 text-white border-0'
  } else if (statusLC === 'lost/missing' || statusLC.replace(/\s+/g, '').replace('/', '').toLowerCase() === 'lostmissing') {
    statusVariant = 'default'
    statusColor = 'bg-yellow-500 text-white border-0'
  } else if (statusLC === 'destroyed') {
    statusVariant = 'default'
    statusColor = 'bg-red-500 text-white border-0'
  }
  
  return <Badge variant={statusVariant} className={statusColor}>{status}</Badge>
}

async function fetchDeletedAssets(search?: string, searchType: string = 'unified') {
  // Fetch all deleted assets without pagination
  const response = await fetch(`/api/assets?includeDeleted=true&page=1&pageSize=10000`)
  if (!response.ok) throw new Error('Failed to fetch deleted assets')
  const data = await response.json()
  // Filter to only show soft-deleted assets
  let allDeletedAssets = data.assets?.filter((asset: { isDeleted?: boolean }) => asset.isDeleted) || []
  
  // Apply search filter if provided
  if (search && search.trim()) {
    const searchLower = search.toLowerCase().trim()
    allDeletedAssets = allDeletedAssets.filter((asset: DeletedAsset) => {
      if (searchType === 'assetTag') {
        return asset.assetTagId?.toLowerCase().includes(searchLower)
      } else if (searchType === 'description') {
        return asset.description?.toLowerCase().includes(searchLower)
      } else if (searchType === 'category') {
        return (
          asset.category?.name?.toLowerCase().includes(searchLower) ||
          asset.subCategory?.name?.toLowerCase().includes(searchLower)
        )
      } else if (searchType === 'location') {
        return asset.location?.toLowerCase().includes(searchLower)
      } else if (searchType === 'status') {
        return asset.status?.toLowerCase().includes(searchLower)
      } else {
        // unified search
        return (
          asset.assetTagId?.toLowerCase().includes(searchLower) ||
          asset.description?.toLowerCase().includes(searchLower) ||
          asset.category?.name?.toLowerCase().includes(searchLower) ||
          asset.subCategory?.name?.toLowerCase().includes(searchLower) ||
          asset.location?.toLowerCase().includes(searchLower) ||
          asset.status?.toLowerCase().includes(searchLower)
        )
      }
    })
  }
  
  const total = allDeletedAssets.length
  
  return {
    assets: allDeletedAssets,
    pagination: {
      total,
    },
  }
}

function TrashPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isMobile = useIsMobile()
  const { setDockContent } = useMobileDock()
  
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canViewAssets = hasPermission('canViewAssets')
  const canManageTrash = hasPermission('canManageTrash')
  const queryClient = useQueryClient()
  
  // Separate states for search input (immediate UI) and search query (debounced API calls)
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '')
  const [searchType, setSearchType] = useState<'unified' | 'assetTag' | 'description' | 'category' | 'location' | 'status'>(
    (searchParams.get('searchType') as 'unified' | 'assetTag' | 'description' | 'category' | 'location' | 'status') || 'unified'
  )
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previousSearchInputRef = useRef<string>(searchParams.get('search') || '')
  
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<DeletedAsset | null>(null)
  const [rowSelection, setRowSelection] = useState({})
  const [isBulkRestoreDialogOpen, setIsBulkRestoreDialogOpen] = useState(false)
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)
  const [isBulkRestoring, setIsBulkRestoring] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 })
  const [sorting, setSorting] = useState<SortingState>([])
  const [isManualRefresh, setIsManualRefresh] = useState(false)
  const [isEmptyTrashDialogOpen, setIsEmptyTrashDialogOpen] = useState(false)
  const isInitialMount = useRef(true)

  // Update URL parameters
  const updateURL = useCallback((updates: { search?: string; searchType?: string }) => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (updates.search !== undefined) {
      if (updates.search === '') {
        params.delete('search')
        params.delete('searchType')
      } else {
        params.set('search', updates.search)
      }
    }

    if (updates.searchType !== undefined) {
      if (updates.searchType === 'unified') {
        params.delete('searchType')
      } else {
        params.set('searchType', updates.searchType)
      }
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
        updateURL({ search: searchInput, searchType })
      }
    }, 500)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
        searchTimeoutRef.current = null
      }
    }
  }, [searchInput, searchParams, searchType, updateURL])


  // Fetch deleted assets
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['deletedAssets', searchQuery, searchType],
    queryFn: () => fetchDeletedAssets(searchQuery || undefined, searchType),
    enabled: (canViewAssets || canManageTrash) && !permissionsLoading,
    placeholderData: (previousData) => previousData,
  })

  // Reset manual refresh flag after successful fetch
  useEffect(() => {
    if (!isFetching && isManualRefresh) {
      setIsManualRefresh(false)
    }
  }, [isFetching, isManualRefresh])

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

  // Empty trash mutation
  const emptyTrashMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/assets/trash/empty', {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to empty trash')
      }
      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['deletedAssets'] })
      toast.success(data.message || 'Trash emptied successfully')
      setIsEmptyTrashDialogOpen(false)
      setRowSelection({})
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to empty trash')
    },
  })

  const handleRestore = useCallback((asset: DeletedAsset) => {
    if (!canManageTrash) {
      toast.error('You do not have permission to restore assets')
      return
    }
    setSelectedAsset(asset)
    setIsRestoreDialogOpen(true)
  }, [canManageTrash])

  const handleDelete = useCallback((asset: DeletedAsset) => {
    if (!canManageTrash) {
      toast.error('You do not have permission to permanently delete assets')
      return
    }
    setSelectedAsset(asset)
    setIsDeleteDialogOpen(true)
  }, [canManageTrash])

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

  const deletedAssets = useMemo(() => data?.assets || [], [data?.assets])
  const pagination = data?.pagination

  // Create column definitions
  const columns = useMemo<ColumnDef<DeletedAsset>[]>(() => [
    {
      id: 'select',
      enableHiding: false,
      enableSorting: false,
      header: ({ table }) => {
        const isAllSelected = table.getIsAllPageRowsSelected()
        const isSomeSelected = table.getIsSomePageRowsSelected()
        return (
          <Checkbox
            checked={isAllSelected}
            {...(isSomeSelected && !isAllSelected && { 'aria-checked': 'mixed' as const })}
            onCheckedChange={(checked) => {
              if (checked === true) {
                table.toggleAllPageRowsSelected(true)
              } else {
                table.toggleAllPageRowsSelected(false)
              }
            }}
          />
        )
      },
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(checked) => {
            if (typeof checked === 'boolean') {
              row.toggleSelected(checked)
            }
          }}
        />
      ),
    },
    {
      accessorKey: 'assetTagId',
      id: 'assetTag',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
          >
            Asset Tag
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        )
      },
      cell: ({ row }) => (
        <div className="font-medium">{row.original.assetTagId}</div>
      ),
      enableSorting: true,
    },
    {
      accessorKey: 'description',
      id: 'description',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
          >
            Description
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        )
      },
      cell: ({ row }) => (
        <div className="max-w-[300px] truncate">{row.original.description}</div>
      ),
      enableSorting: true,
    },
    {
      id: 'category',
      accessorFn: (row) => {
        const category = row.category?.name || ''
        const subCategory = row.subCategory?.name || ''
        return `${category} / ${subCategory}`
      },
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
          >
            Category
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        )
      },
      cell: ({ row }) => (
        <div>
          {row.original.category?.name || '-'} / {row.original.subCategory?.name || '-'}
        </div>
      ),
      sortingFn: (rowA, rowB) => {
        const categoryA = rowA.original.category?.name || ''
        const categoryB = rowB.original.category?.name || ''
        const subCategoryA = rowA.original.subCategory?.name || ''
        const subCategoryB = rowB.original.subCategory?.name || ''
        const combinedA = `${categoryA} / ${subCategoryA}`
        const combinedB = `${categoryB} / ${subCategoryB}`
        return combinedA.localeCompare(combinedB)
      },
      enableSorting: true,
    },
    {
      accessorKey: 'status',
      id: 'status',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
          >
            Status
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        )
      },
      cell: ({ row }) => (
        <div>
          {row.original.status ? (
            getStatusBadge(row.original.status)
          ) : (
            '-'
          )}
        </div>
      ),
      enableSorting: true,
    },
    {
      accessorKey: 'location',
      id: 'location',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
          >
            Location
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        )
      },
      cell: ({ row }) => <div>{row.original.location || '-'}</div>,
      enableSorting: true,
    },
    {
      accessorKey: 'deletedAt',
      id: 'deletedDate',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
          >
            Deleted Date
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        )
      },
      cell: ({ row }) => (
        <div className="text-muted-foreground">
          {format(new Date(row.original.deletedAt), 'MMM dd, yyyy')}
        </div>
      ),
      enableSorting: true,
    },
    {
      id: 'daysLeft',
      accessorFn: (row) => getDaysUntilPermanentDelete(row.deletedAt),
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
          >
            Days Left
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        )
      },
      cell: ({ row }) => {
        const daysLeft = getDaysUntilPermanentDelete(row.original.deletedAt)
        return (
          <div>
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
          </div>
        )
      },
      enableSorting: true,
    },
    {
      id: 'actions',
      enableHiding: false,
      enableSorting: false,
      header: () => <div className="text-center">Actions</div>,
      cell: ({ row }) => (
        <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="h-8 w-8 p-0 rounded-full"
              >
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => handleRestore(row.original)}
                className="cursor-pointer"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Restore
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleDelete(row.original)}
                className="cursor-pointer text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Permanently
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ], [handleRestore, handleDelete])

  // Track initial mount for animations - only animate stagger on first load
  useEffect(() => {
    if (isInitialMount.current && data && deletedAssets.length > 0) {
      // Disable staggered animations after first data load
      // Use a short delay to allow first animation to start
      const timer = setTimeout(() => {
        isInitialMount.current = false
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [data, deletedAssets.length])

  // Create table instance
  const table = useReactTable({
    data: deletedAssets,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    getRowId: (row) => row.id,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      rowSelection,
    },
  })

  // Get selected assets from table row selection
  // Compute directly to ensure reactivity when rowSelection changes
  const selectedAssets = (() => {
    const selected = new Set<string>()
    table.getSelectedRowModel().rows.forEach(row => {
      selected.add(row.original.id)
    })
    return selected
  })()

  // Bulk restore handler
  const handleBulkRestore = async () => {
    if (selectedAssets.size === 0) return
    setIsBulkRestoring(true)
    const selectedArray = Array.from(selectedAssets)
    setBulkProgress({ current: 0, total: selectedArray.length })

    try {
      for (let i = 0; i < selectedArray.length; i++) {
        const assetId = selectedArray[i]
        const response = await fetch(`/api/assets/${assetId}/restore`, {
          method: 'PATCH',
        })
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || `Failed to restore asset ${assetId}`)
        }
        setBulkProgress({ current: i + 1, total: selectedArray.length })
      }

      toast.success(`Successfully restored ${selectedArray.length} asset(s)`)
      setRowSelection({})
      setIsBulkRestoreDialogOpen(false)
      setIsBulkRestoring(false)
      queryClient.invalidateQueries({ queryKey: ['deletedAssets'] })
      queryClient.invalidateQueries({ queryKey: ['assets'] })
    } catch (error) {
      console.error('Bulk restore error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to restore assets')
      setIsBulkRestoring(false)
    }
  }

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (selectedAssets.size === 0) return
    setIsBulkDeleting(true)
    const selectedArray = Array.from(selectedAssets)
    setBulkProgress({ current: 0, total: selectedArray.length })

    try {
      for (let i = 0; i < selectedArray.length; i++) {
        const assetId = selectedArray[i]
        const response = await fetch(`/api/assets/${assetId}?permanent=true`, {
          method: 'DELETE',
        })
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || `Failed to permanently delete asset ${assetId}`)
        }
        setBulkProgress({ current: i + 1, total: selectedArray.length })
      }

      toast.success(`Successfully permanently deleted ${selectedArray.length} asset(s)`)
      setRowSelection({})
      setIsBulkDeleteDialogOpen(false)
      setIsBulkDeleting(false)
      queryClient.invalidateQueries({ queryKey: ['deletedAssets'] })
    } catch (error) {
      console.error('Bulk delete error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to permanently delete assets')
      setIsBulkDeleting(false)
    }
  }

  // Set mobile dock content
  useEffect(() => {
    if (isMobile) {
      setDockContent(
        selectedAssets.size > 0 ? (
          <>
            <Button
              onClick={() => {
                if (!canManageTrash) {
                  toast.error('You do not have permission to restore assets')
                  return
                }
                setIsBulkRestoreDialogOpen(true)
              }}
              variant="outline"
              size="lg"
              className="rounded-full btn-glass-elevated"
            >
              Recover
            </Button>
            <Button
              onClick={() => {
                if (!canManageTrash) {
                  toast.error('You do not have permission to permanently delete assets')
                  return
                }
                setIsBulkDeleteDialogOpen(true)
              }}
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full btn-glass-elevated"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={() => {
                if (!canManageTrash) {
                  toast.error('You do not have permission to restore assets')
                  return
                }
                // Select all assets and restore them
                const allAssetIds = deletedAssets.map((asset: DeletedAsset) => asset.id)
                setRowSelection(
                  allAssetIds.reduce((acc: Record<string, boolean>, id: string) => ({ ...acc, [id]: true }), {})
                )
                setIsBulkRestoreDialogOpen(true)
              }}
              disabled={!pagination?.total || pagination.total === 0 || !canManageTrash}
              variant="outline"
              size="lg"
              className="rounded-full btn-glass-elevated"
            >
              Recover All
            </Button>
            <Button
              onClick={() => {
                if (!canManageTrash) {
                  toast.error('You do not have permission to permanently delete assets')
                  return
                }
                if (selectedAssets.size > 0) {
                  setIsBulkDeleteDialogOpen(true)
                } else {
                  setIsEmptyTrashDialogOpen(true)
                }
              }}
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full btn-glass-elevated"
              disabled={!pagination?.total || pagination.total === 0}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )
      )
    } else {
      setDockContent(null)
    }
    
    return () => {
      setDockContent(null)
    }
  }, [isMobile, setDockContent, selectedAssets.size, canManageTrash, setIsBulkRestoreDialogOpen, setIsBulkDeleteDialogOpen, setIsEmptyTrashDialogOpen, deletedAssets, pagination?.total, setRowSelection])

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-3xl font-bold">Recently Deleted</h1>
        <p className="text-muted-foreground">
          View and manage deleted assets. Assets will be permanently deleted after 30 days.
        </p>
      </div>

      <Card className="gap-0 pb-0">
        <CardHeader className="shrink-0 pb-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center w-full md:flex-1 md:max-w-md gap-2">
              <div className="flex items-center flex-1 border rounded-md overflow-hidden">
              <Select
                value={searchType}
                onValueChange={(value: 'unified' | 'assetTag' | 'description' | 'category' | 'location' | 'status') => {
                  setSearchType(value)
                  updateURL({ searchType: value })
                }}
              >
                <SelectTrigger className={cn("w-[140px] h-8 rounded-none border-0 border-r focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none", isMobile && "w-[100px]")} size='sm'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unified">Unified Search</SelectItem>
                  <SelectItem value="assetTag">Asset Tag</SelectItem>
                  <SelectItem value="description">Description</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="location">Location</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                {searchInput ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('')
                       updateURL({ search: '' })
                    }}
                    className="absolute left-2 top-2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors cursor-pointer z-10"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : (
                  <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                )}
                <Input
                  placeholder={
                    searchType === 'unified'
                      ? 'Search by asset tag, description, category, location...'
                      : searchType === 'assetTag'
                      ? 'Search by Asset Tag'
                      : searchType === 'description'
                      ? 'Search by Description'
                      : searchType === 'category'
                      ? 'Search by Category'
                      : searchType === 'location'
                      ? 'Search by Location'
                      : 'Search by Status'
                  }
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-8 h-8 rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
                />
              </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setIsManualRefresh(true)
                  queryClient.invalidateQueries({ queryKey: ['deletedAssets'] })
                }}
                className="h-8 w-8 shrink-0 md:hidden"
                title="Refresh table"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>
            <div className={cn("flex gap-2 sm:gap-3 items-center justify-end", isMobile && "hidden")}>
              {selectedAssets.size > 0 && (
                <>
                  <Button
                    onClick={() => {
                      if (!canManageTrash) {
                        toast.error('You do not have permission to restore assets')
                        return
                      }
                      setIsBulkRestoreDialogOpen(true)
                    }}
                    variant="default"
                    size="sm"
                    className="flex-1 sm:flex-initial"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    <span className="sm:hidden">Restore</span>
                    <span className="hidden sm:inline">Restore ({selectedAssets.size})</span>
                  </Button>
                  <Button
                    onClick={() => {
                      if (!canManageTrash) {
                        toast.error('You do not have permission to permanently delete assets')
                        return
                      }
                      setIsBulkDeleteDialogOpen(true)
                    }}
                    variant="destructive"
                    size="sm"
                    className="flex-1 sm:flex-initial"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    <span className="sm:hidden">Delete</span>
                    <span className="hidden sm:inline">Delete ({selectedAssets.size})</span>
                  </Button>
                </>
              )}
              {selectedAssets.size === 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!canManageTrash) {
                      toast.error('You do not have permission to empty trash')
                      return
                    }
                    setIsEmptyTrashDialogOpen(true)
                  }}
                  disabled={!pagination?.total || pagination.total === 0}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Empty
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setIsManualRefresh(true)
                  queryClient.invalidateQueries({ queryKey: ['deletedAssets'] })
                }}
                className="h-8 w-8"
                title="Refresh table"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 px-0 relative">
          {isFetching && data && deletedAssets.length > 0 && (
            <div className={cn("absolute left-0 right-[10px] top-[33px] bottom-0 bg-background/50 backdrop-blur-sm z-20 flex items-center justify-center", isMobile && "right-0 rounded-b-2xl")}>
              <Spinner variant="default" size={24} className="text-muted-foreground" />
            </div>
          )}
          {permissionsLoading || isLoading ? (
            <div className="h-140 pt-12 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Spinner className="h-8 w-8" />
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            </div>
          ) : deletedAssets.length === 0 ? (
            <div className="min-w-full">
              <ScrollArea className="h-140">
                <div className="flex items-center justify-center h-full">
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No deleted assets found</p>
                    <p className="text-sm">Deleted assets will appear here</p>
                  </div>
                </div>
                <ScrollBar orientation="horizontal" />
                <ScrollBar orientation="vertical" className='z-10' />
              </ScrollArea>
            </div>
          ) : (
            <div className="min-w-full">
              <ScrollArea className="h-140">
                <div className="sticky top-0 z-30 h-px bg-border w-full"></div>
                <div className="pr-2.5 relative after:content-[''] after:absolute after:right-[10px] after:top-0 after:bottom-0 after:w-px after:bg-border after:z-50 after:h-full">
                  <Table className="border-b">
                    <TableHeader className="sticky -top-1 z-20 bg-card [&_tr]:border-b-0 -mr-2.5">
                      {table.getHeaderGroups().map((headerGroup: HeaderGroup<DeletedAsset>) => (
                        <TableRow key={headerGroup.id} className="group hover:bg-muted/50 relative border-b-0 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-[1.5px] after:h-px after:bg-border after:z-30">
                          {headerGroup.headers.map((header: Header<DeletedAsset, unknown>) => {
                            const isActionsColumn = header.column.id === 'actions'
                            return (
                              <TableHead 
                                key={header.id}
                                className={cn(
                                  isActionsColumn ? "text-center" : "text-left",
                                  "bg-card transition-colors",
                                  !isActionsColumn && "group-hover:bg-muted/50",
                                  isActionsColumn && "sticky z-10 right-0 group-hover:bg-card before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border before:z-50 "
                                )}
                              >
                                {header.isPlaceholder
                                  ? null
                                  : flexRender(header.column.columnDef.header, header.getContext())}
                              </TableHead>
                            )
                          })}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence mode='popLayout'>
                      {table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map((row, index) => (
                          <motion.tr
                            key={row.id}
                            layout
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ 
                              duration: 0.2, 
                              delay: isInitialMount.current ? index * 0.05 : 0 
                            }}
                            data-state={row.getIsSelected() && 'selected'}
                            className="group relative hover:bg-muted/90 data-[state=selected]:bg-muted border-b transition-colors"
                          >
                            {row.getVisibleCells().map((cell) => {
                              const isActionsColumn = cell.column.id === 'actions'
                              return (
                                <TableCell 
                                  key={cell.id}
                                  className={cn(
                                    isActionsColumn && "sticky text-center right-0 bg-card z-10 before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border before:z-50 rounded-br-2xl"
                                  )}
                                >
                                  {flexRender(
                                    cell.column.columnDef.cell,
                                    cell.getContext()
                                  )}
                                </TableCell>
                              )
                            })}
                          </motion.tr>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={columns.length}
                            className="h-24 text-center"
                          >
                            No results.
                          </TableCell>
                        </TableRow>
                      )}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>
                <ScrollBar orientation="horizontal" />
                <ScrollBar orientation="vertical" className='z-50' />
              </ScrollArea>
            </div>
          )}
        </CardContent>
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

      {/* Bulk Restore Confirmation Dialog */}
      <BulkDeleteDialog
        open={isBulkRestoreDialogOpen}
        onOpenChange={(newOpen) => {
          setIsBulkRestoreDialogOpen(newOpen)
          // Clear selection when dialog is closed (cancelled) and not currently restoring
          if (!newOpen && !isBulkRestoring) {
            setRowSelection({})
          }
        }}
        onConfirm={handleBulkRestore}
        itemCount={selectedAssets.size}
        itemName="Asset"
        isDeleting={isBulkRestoring}
        progress={isBulkRestoring ? { current: bulkProgress.current, total: bulkProgress.total } : undefined}
        title={isBulkRestoring ? undefined : `Restore ${selectedAssets.size} Asset(s)?`}
        description={`${selectedAssets.size} selected asset(s) will be restored and made available again.`}
        confirmLabel={`Restore ${selectedAssets.size} Asset(s)`}
        loadingLabel="Restoring assets, please wait..."
        progressTitle={`Restoring Assets... ${bulkProgress.current}/${bulkProgress.total}`}
        variant="restore"
      />

      {/* Bulk Delete Confirmation Dialog */}
      <BulkDeleteDialog
        open={isBulkDeleteDialogOpen}
        onOpenChange={setIsBulkDeleteDialogOpen}
        onConfirm={handleBulkDelete}
        itemCount={selectedAssets.size}
        itemName="Asset"
        isDeleting={isBulkDeleting}
        progress={isBulkDeleting ? { current: bulkProgress.current, total: bulkProgress.total } : undefined}
        title={isBulkDeleting ? undefined : `Permanently Delete ${selectedAssets.size} Asset(s)?`}
        description={`Are you sure you want to permanently delete ${selectedAssets.size} selected asset(s)? This action cannot be undone.`}
        confirmLabel={`Delete ${selectedAssets.size} Asset(s) Permanently`}
        loadingLabel="Deleting assets permanently, please wait..."
        progressTitle={`Deleting Assets... ${bulkProgress.current}/${bulkProgress.total}`}
        variant="delete"
      />

      {/* Empty Trash Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={isEmptyTrashDialogOpen}
        onOpenChange={setIsEmptyTrashDialogOpen}
        onConfirm={() => emptyTrashMutation.mutate()}
        itemName={`all ${pagination?.total || 0} trash item(s)`}
        isLoading={emptyTrashMutation.isPending}
        title="Empty Trash"
        description={`Are you sure you want to permanently delete all ${pagination?.total || 0} item(s) in trash? This action cannot be undone.`}
        confirmLabel="Empty Trash"
        loadingLabel="Emptying trash..."
      />
    </motion.div>
  )
}

export default function TrashPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Trash</h1>
          <p className="text-muted-foreground">
            View and manage deleted assets
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <Spinner className="h-8 w-8" />
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <TrashPageContent />
    </Suspense>
  )
}

