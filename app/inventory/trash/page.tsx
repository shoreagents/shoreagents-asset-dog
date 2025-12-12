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
import { Trash2, RotateCcw, AlertTriangle, Package, Search, RotateCw, X, MoreHorizontal, ArrowLeft, ArrowRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
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

interface DeletedInventoryItem {
  id: string
  itemCode: string
  name: string
  description: string | null
  category: string | null
  unit: string | null
  currentStock: number
  location: string | null
  supplier: string | null
  deletedAt: string
}

async function fetchDeletedInventoryItems(page: number = 1, pageSize: number = 50, search?: string, searchType: string = 'unified') {
  // Fetch all deleted inventory items with a large page size to get accurate count
  const response = await fetch(`/api/inventory?includeDeleted=true&page=1&pageSize=10000`)
  if (!response.ok) throw new Error('Failed to fetch deleted inventory items')
  const data = await response.json()
  // Filter to only show soft-deleted items
  let allDeletedItems = data.items?.filter((item: { isDeleted?: boolean }) => item.isDeleted) || []
  
  // Apply search filter if provided
  if (search && search.trim()) {
    const searchLower = search.toLowerCase().trim()
    allDeletedItems = allDeletedItems.filter((item: DeletedInventoryItem) => {
      if (searchType === 'itemCode') {
        return item.itemCode?.toLowerCase().includes(searchLower)
      } else if (searchType === 'name') {
        return item.name?.toLowerCase().includes(searchLower)
      } else if (searchType === 'category') {
        return item.category?.toLowerCase().includes(searchLower)
      } else if (searchType === 'location') {
        return item.location?.toLowerCase().includes(searchLower)
      } else if (searchType === 'supplier') {
        return item.supplier?.toLowerCase().includes(searchLower)
      } else {
        // unified search
        return (
          item.itemCode?.toLowerCase().includes(searchLower) ||
          item.name?.toLowerCase().includes(searchLower) ||
          item.description?.toLowerCase().includes(searchLower) ||
          item.category?.toLowerCase().includes(searchLower) ||
          item.location?.toLowerCase().includes(searchLower) ||
          item.supplier?.toLowerCase().includes(searchLower)
        )
      }
    })
  }
  
  // Calculate pagination based on filtered results
  const total = allDeletedItems.length
  const totalPages = Math.ceil(total / pageSize)
  const skip = (page - 1) * pageSize
  const paginatedItems = allDeletedItems.slice(skip, skip + pageSize)
  
  return {
    items: paginatedItems,
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

function InventoryTrashPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canViewInventory = hasPermission('canViewAssets')
  const canManageTrash = hasPermission('canManageTrash')
  const queryClient = useQueryClient()
  
  // Get page, pageSize, and search from URL
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)
  
  // Separate states for search input (immediate UI) and search query (debounced API calls)
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '')
  const [searchType, setSearchType] = useState<'unified' | 'itemCode' | 'name' | 'category' | 'location' | 'supplier'>(
    (searchParams.get('searchType') as 'unified' | 'itemCode' | 'name' | 'category' | 'location' | 'supplier') || 'unified'
  )
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previousSearchInputRef = useRef<string>(searchParams.get('search') || '')
  
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<DeletedInventoryItem | null>(null)
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
  const updateURL = useCallback((updates: { page?: number; pageSize?: number; search?: string; searchType?: string }) => {
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
    
    if (updates.search !== undefined) {
      if (updates.search === '') {
        params.delete('search')
        params.delete('searchType')
      } else {
        params.set('search', updates.search)
      }
      params.delete('page')
    }

    if (updates.searchType !== undefined) {
      if (updates.searchType === 'unified') {
        params.delete('searchType')
      } else {
        params.set('searchType', updates.searchType)
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
        updateURL({ search: searchInput, searchType, page: 1 })
      }
    }, 500)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
        searchTimeoutRef.current = null
      }
    }
  }, [searchInput, searchParams, searchType, updateURL])


  // Fetch deleted inventory items
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['deletedInventoryItems', page, pageSize, searchQuery, searchType],
    queryFn: () => fetchDeletedInventoryItems(page, pageSize, searchQuery || undefined, searchType),
    enabled: (canViewInventory || canManageTrash) && !permissionsLoading,
    placeholderData: (previousData) => previousData,
  })

  // Reset manual refresh flag after successful fetch
  useEffect(() => {
    if (!isFetching && isManualRefresh) {
      setIsManualRefresh(false)
    }
  }, [isFetching, isManualRefresh])

  const handlePageSizeChange = (newPageSize: string) => {
    updateURL({ pageSize: parseInt(newPageSize), page: 1 })
  }

  const handlePageChange = (newPage: number) => {
    updateURL({ page: newPage })
  }

  // Restore mutation
  const restoreMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const response = await fetch(`/api/inventory/${itemId}/restore`, {
        method: 'PATCH',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to restore inventory item')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deletedInventoryItems'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      toast.success('Inventory item restored successfully')
      setIsRestoreDialogOpen(false)
      setSelectedItem(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to restore inventory item')
    },
  })

  // Permanent delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const response = await fetch(`/api/inventory/${itemId}?permanent=true`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to permanently delete inventory item')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deletedInventoryItems'] })
      toast.success('Inventory item permanently deleted')
      setIsDeleteDialogOpen(false)
      setSelectedItem(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to permanently delete inventory item')
    },
  })

  // Empty trash mutation
  const emptyTrashMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/inventory/trash/empty', {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to empty trash')
      }
      return response.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['deletedInventoryItems'] })
      toast.success(data.message || 'Trash emptied successfully')
      setIsEmptyTrashDialogOpen(false)
      setRowSelection({})
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to empty trash')
    },
  })

  const handleRestore = useCallback((item: DeletedInventoryItem) => {
    if (!canManageTrash) {
      toast.error('You do not have permission to restore inventory items')
      return
    }
    setSelectedItem(item)
    setIsRestoreDialogOpen(true)
  }, [canManageTrash])

  const handleDelete = useCallback((item: DeletedInventoryItem) => {
    if (!canManageTrash) {
      toast.error('You do not have permission to permanently delete inventory items')
      return
    }
    setSelectedItem(item)
    setIsDeleteDialogOpen(true)
  }, [canManageTrash])

  const confirmRestore = () => {
    if (selectedItem) {
      restoreMutation.mutate(selectedItem.id)
    }
  }

  const confirmDelete = () => {
    if (selectedItem) {
      deleteMutation.mutate(selectedItem.id)
    }
  }

  const getDaysUntilPermanentDelete = (deletedAt: string) => {
    const deletedDate = new Date(deletedAt)
    const daysSinceDeleted = differenceInDays(new Date(), deletedDate)
    return Math.max(0, 30 - daysSinceDeleted)
  }

  const deletedItems = data?.items || []
  const pagination = data?.pagination

  // Create column definitions
  const columns = useMemo<ColumnDef<DeletedInventoryItem>[]>(() => [
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
      accessorKey: 'itemCode',
      id: 'itemCode',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
          >
            Item Code
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
        <div className="font-medium">{row.original.itemCode}</div>
      ),
      enableSorting: true,
    },
    {
      accessorKey: 'name',
      id: 'name',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
          >
            Name
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
        <div className="max-w-[300px] truncate">{row.original.name}</div>
      ),
      enableSorting: true,
    },
    {
      id: 'category',
      accessorKey: 'category',
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
        <div>{row.original.category || '-'}</div>
      ),
      enableSorting: true,
    },
    {
      accessorKey: 'currentStock',
      id: 'stock',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
          >
            Stock
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
        const stock = Math.floor(parseFloat(row.original.currentStock.toString()))
        const unit = row.original.unit || 'pcs'
        return (
          <div>
            {stock.toLocaleString()} {unit}
          </div>
        )
      },
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
    if (isInitialMount.current && data && deletedItems.length > 0) {
      // Disable staggered animations after first data load
      // Use a short delay to allow first animation to start
      const timer = setTimeout(() => {
        isInitialMount.current = false
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [data, deletedItems.length])

  // Create table instance
  const table = useReactTable({
    data: deletedItems,
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

  // Get selected items from table row selection
  // Compute directly to ensure reactivity when rowSelection changes
  const selectedItems = (() => {
    const selected = new Set<string>()
    table.getSelectedRowModel().rows.forEach(row => {
      selected.add(row.original.id)
    })
    return selected
  })()

  // Bulk restore handler
  const handleBulkRestore = async () => {
    if (selectedItems.size === 0) return
    setIsBulkRestoring(true)
    const selectedArray = Array.from(selectedItems)
    setBulkProgress({ current: 0, total: selectedArray.length })

    try {
      for (let i = 0; i < selectedArray.length; i++) {
        const itemId = selectedArray[i]
        const response = await fetch(`/api/inventory/${itemId}/restore`, {
          method: 'PATCH',
        })
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || `Failed to restore inventory item ${itemId}`)
        }
        setBulkProgress({ current: i + 1, total: selectedArray.length })
      }

      toast.success(`Successfully restored ${selectedArray.length} item(s)`)
      setRowSelection({})
      setIsBulkRestoreDialogOpen(false)
      setIsBulkRestoring(false)
      queryClient.invalidateQueries({ queryKey: ['deletedInventoryItems'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
    } catch (error) {
      console.error('Bulk restore error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to restore items')
      setIsBulkRestoring(false)
    }
  }

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return
    setIsBulkDeleting(true)
    const selectedArray = Array.from(selectedItems)
    setBulkProgress({ current: 0, total: selectedArray.length })

    try {
      for (let i = 0; i < selectedArray.length; i++) {
        const itemId = selectedArray[i]
        const response = await fetch(`/api/inventory/${itemId}?permanent=true`, {
          method: 'DELETE',
        })
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || `Failed to permanently delete inventory item ${itemId}`)
        }
        setBulkProgress({ current: i + 1, total: selectedArray.length })
      }

      toast.success(`Successfully permanently deleted ${selectedArray.length} item(s)`)
      setRowSelection({})
      setIsBulkDeleteDialogOpen(false)
      setIsBulkDeleting(false)
      queryClient.invalidateQueries({ queryKey: ['deletedInventoryItems'] })
    } catch (error) {
      console.error('Bulk delete error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to permanently delete items')
      setIsBulkDeleting(false)
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Recently Deleted</h1>
          <p className="text-muted-foreground">
            View and manage deleted inventory items. Items will be permanently deleted after 30 days.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push('/inventory')}
          className="shrink-0"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Inventory
        </Button>
      </div>

      <Card className="gap-0 pb-0">
        <CardHeader className="shrink-0 pb-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center w-full md:flex-1 md:max-w-md border rounded-md overflow-hidden">
              <Select
                value={searchType}
                onValueChange={(value: 'unified' | 'itemCode' | 'name' | 'category' | 'location' | 'supplier') => {
                  setSearchType(value)
                  updateURL({ searchType: value, page: 1 })
                }}
              >
                <SelectTrigger className="w-[140px] h-8 rounded-none border-0 border-r focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none" size='sm'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unified">Unified Search</SelectItem>
                  <SelectItem value="itemCode">Item Code</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="location">Location</SelectItem>
                  <SelectItem value="supplier">Supplier</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                {searchInput ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('')
                      updateURL({ search: '', page: 1 })
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
                      ? 'Search by item code, name, category, location...'
                      : searchType === 'itemCode'
                      ? 'Search by Item Code'
                      : searchType === 'name'
                      ? 'Search by Name'
                      : searchType === 'category'
                      ? 'Search by Category'
                      : searchType === 'location'
                      ? 'Search by Location'
                      : 'Search by Supplier'
                  }
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-8 h-8 rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
                />
              </div>
            </div>
            <div className="flex gap-2 sm:gap-3 items-center justify-end">
              {selectedItems.size > 0 && (
                <>
                  <Button
                    onClick={() => {
                      if (!canManageTrash) {
                        toast.error('You do not have permission to restore items')
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
                    <span className="hidden sm:inline">Restore ({selectedItems.size})</span>
                  </Button>
                  <Button
                    onClick={() => {
                      if (!canManageTrash) {
                        toast.error('You do not have permission to permanently delete items')
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
                    <span className="hidden sm:inline">Delete ({selectedItems.size})</span>
                  </Button>
                </>
              )}
              {selectedItems.size === 0 && (
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
                  queryClient.invalidateQueries({ queryKey: ['deletedInventoryItems'] })
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
          {isFetching && data && deletedItems.length > 0 && (
            <div className="absolute left-0 right-[10px] top-[33px] bottom-0 bg-background/50 backdrop-blur-sm z-20 flex items-center justify-center">
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
          ) : deletedItems.length === 0 ? (
            <div className="min-w-full">
              <ScrollArea className="h-140">
                <div className="flex items-center justify-center h-full">
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No deleted items found</p>
                    <p className="text-sm">Deleted inventory items will appear here</p>
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
                      {table.getHeaderGroups().map((headerGroup: HeaderGroup<DeletedInventoryItem>) => (
                        <TableRow key={headerGroup.id} className="group hover:bg-muted/50 relative border-b-0 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-[1.5px] after:h-px after:bg-border after:z-30">
                          {headerGroup.headers.map((header: Header<DeletedInventoryItem, unknown>) => {
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
                                    isActionsColumn && "sticky text-center right-0 bg-card z-10 before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border before:z-50 "
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

        {/* Pagination Bar */}
        <div className="sticky bottom-0 border-t bg-card z-10 shadow-sm mt-auto rounded-b-lg">
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
                disabled={!pagination?.hasPreviousPage || isLoading}
                className="h-8 px-2 sm:px-3"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
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
                  if (pagination?.hasNextPage) {
                    handlePageChange(Math.min(pagination.totalPages, page + 1))
                  }
                }}
                disabled={!pagination?.hasNextPage || isLoading}
                className="h-8 px-2 sm:px-3"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center justify-center sm:justify-end gap-2 sm:gap-4">
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

      {/* Restore Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={isRestoreDialogOpen}
        onOpenChange={setIsRestoreDialogOpen}
        onConfirm={confirmRestore}
        itemName={selectedItem?.itemCode || 'item'}
        isLoading={restoreMutation.isPending}
        title="Restore Inventory Item"
        description={`Are you sure you want to restore "${selectedItem?.itemCode}"? This will make the item available again.`}
        confirmLabel="Restore"
        loadingLabel="Restoring..."
      />

      {/* Permanent Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={confirmDelete}
        itemName={selectedItem?.itemCode || 'item'}
        isLoading={deleteMutation.isPending}
        title="Permanently Delete Inventory Item"
        description={`Are you sure you want to permanently delete "${selectedItem?.itemCode}"? This action cannot be undone.`}
        confirmLabel="Delete Permanently"
      />

      {/* Bulk Restore Confirmation Dialog */}
      <BulkDeleteDialog
        open={isBulkRestoreDialogOpen}
        onOpenChange={setIsBulkRestoreDialogOpen}
        onConfirm={handleBulkRestore}
        itemCount={selectedItems.size}
        itemName="Item"
        isDeleting={isBulkRestoring}
        progress={isBulkRestoring ? { current: bulkProgress.current, total: bulkProgress.total } : undefined}
        title={isBulkRestoring ? undefined : `Restore ${selectedItems.size} Item(s)?`}
        description={`${selectedItems.size} selected item(s) will be restored and made available again.`}
        confirmLabel={`Restore ${selectedItems.size} Item(s)`}
        loadingLabel="Restoring items, please wait..."
        progressTitle={`Restoring Items... ${bulkProgress.current}/${bulkProgress.total}`}
        variant="restore"
      />

      {/* Bulk Delete Confirmation Dialog */}
      <BulkDeleteDialog
        open={isBulkDeleteDialogOpen}
        onOpenChange={setIsBulkDeleteDialogOpen}
        onConfirm={handleBulkDelete}
        itemCount={selectedItems.size}
        itemName="Item"
        isDeleting={isBulkDeleting}
        progress={isBulkDeleting ? { current: bulkProgress.current, total: bulkProgress.total } : undefined}
        title={isBulkDeleting ? undefined : `Permanently Delete ${selectedItems.size} Item(s)?`}
        description={`Are you sure you want to permanently delete ${selectedItems.size} selected item(s)? This action cannot be undone.`}
        confirmLabel={`Delete ${selectedItems.size} Item(s) Permanently`}
        loadingLabel="Deleting items permanently, please wait..."
        progressTitle={`Deleting Items... ${bulkProgress.current}/${bulkProgress.total}`}
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

export default function InventoryTrashPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Recently Deleted</h1>
          <p className="text-muted-foreground">
            View and manage deleted inventory items
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
      <InventoryTrashPageContent />
    </Suspense>
  )
}

