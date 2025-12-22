'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  RowSelectionState,
} from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
import { BulkDeleteDialog } from '@/components/dialogs/bulk-delete-dialog'
import { History, ArrowLeft, ArrowRight, ArrowUpFromLine, ArrowDownToLine, Settings, Package, Trash2, MoreHorizontal, RefreshCw, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useMobileDock } from '@/components/mobile-dock-provider'
import { useMobilePagination } from '@/components/mobile-pagination-provider'
import { useIsMobile } from '@/hooks/use-mobile'

export interface InventoryItem {
  id: string
  name: string
  currentStock: number
  unit: string | null
}

export interface RelatedTransaction {
  id: string
  inventoryItemId: string
  transactionType: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER'
  quantity: number
  transactionDate: string
  inventoryItem: {
    id: string
    itemCode: string
    name: string
  }
}

import { useInventoryItem, useInventoryTransactions, useBulkDeleteTransactions, type InventoryTransaction as InventoryTransactionType } from '@/hooks/use-inventory'

// Local interface for display purposes (extends the hook type)
export interface InventoryTransaction extends InventoryTransactionType {
  totalCost?: number | null
}

export default function InventoryTransactionHistoryPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const isMobile = useIsMobile()
  const { setDockContent } = useMobileDock()
  const { setPaginationContent } = useMobilePagination()
  const itemCode = params.itemCode as string
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10)
  const transactionTypeFilter = searchParams.get('type') || 'all'
  const searchQuery = searchParams.get('search') || ''

  const [searchInput, setSearchInput] = useState(searchQuery)
  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deletingProgress, setDeletingProgress] = useState({ current: 0, total: 0 })
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  // On desktop, select column is always visible. On mobile, it's hidden by default and shown when selection mode is active
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({})
  
  // Use ref to track transactions to avoid dependency issues in callbacks
  const transactionsRef = useRef<InventoryTransaction[]>([])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Update URL when debounced search changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    if (debouncedSearch) {
      params.set('search', debouncedSearch)
      params.set('page', '1')
    } else {
      params.delete('search')
    }
    // Only update URL if the search value changed
    if (debouncedSearch !== searchQuery) {
      router.push(`/inventory/${itemCode}/transaction-history?${params.toString()}`)
    }
  }, [debouncedSearch, itemCode, router, searchParams, searchQuery])

  // Sync searchInput with URL when navigating
  useEffect(() => {
    setSearchInput(searchQuery)
  }, [searchQuery])

  // Fetch inventory item
  const { data: item, isLoading: isLoadingItem } = useInventoryItem(itemCode, !!itemCode)

  // Fetch transactions (enable when we have itemCode, don't wait for item to load)
  const { data: transactionHistory, isLoading: isLoadingHistory, isFetching: isFetchingHistory } = useInventoryTransactions(
    itemCode,
    {
      page,
      pageSize,
      type: transactionTypeFilter !== 'all' ? transactionTypeFilter : undefined,
      search: searchQuery || undefined,
    },
    !!itemCode
  )


  const handlePageChange = useCallback((newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', newPage.toString())
    router.push(`/inventory/${itemCode}/transaction-history?${params.toString()}`)
  }, [searchParams, router, itemCode])

  const handlePageSizeChange = useCallback((newPageSize: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('pageSize', newPageSize)
    params.set('page', '1') // Reset to first page when changing page size
    router.push(`/inventory/${itemCode}/transaction-history?${params.toString()}`)
  }, [searchParams, router, itemCode])

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'IN':
        return <Badge variant="default" className="bg-green-600"><ArrowUpFromLine className="h-3 w-3 mr-1" />IN</Badge>
      case 'OUT':
        return <Badge variant="destructive"><ArrowDownToLine className="h-3 w-3 mr-1" />OUT</Badge>
      case 'ADJUSTMENT':
        return <Badge variant="secondary"><Settings className="h-3 w-3 mr-1" />ADJUST</Badge>
      case 'TRANSFER':
        return <Badge variant="outline"><Package className="h-3 w-3 mr-1" />TRANSFER</Badge>
      default:
        return <Badge>{type}</Badge>
    }
  }

  const transactions = useMemo(() => transactionHistory?.transactions || [], [transactionHistory?.transactions])
  const pagination = transactionHistory?.pagination
  const isLoading = isLoadingHistory
  const isFetching = isFetchingHistory
  
  // Combined loading state - show layout immediately
  const isLoadingData = isLoadingItem || (isLoading && !transactionHistory)

  // Update ref when transactions change
  useEffect(() => {
    transactionsRef.current = transactions
  }, [transactions])

  // Initialize column visibility based on mobile state
  useEffect(() => {
    // On desktop, select column is always visible. On mobile, it's hidden by default
    setColumnVisibility({ select: !isMobile })
  }, [isMobile])

  // Check if any transactions are selected (computed from rowSelection directly)
  const hasSelectedTransactions = Object.keys(rowSelection).length > 0

  // Create columns
  const columns = useMemo<ColumnDef<InventoryTransaction>[]>(() => [
    {
      id: 'select',
      enableHiding: false,
      enableSorting: false,
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(checked) => {
            table.toggleAllPageRowsSelected(checked === true)
          }}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(checked) => {
            row.toggleSelected(checked === true)
          }}
        />
      ),
    },
    {
      accessorKey: 'transactionDate',
      id: 'date',
      header: 'Date',
      cell: ({ row }) => (
        <>
          {new Date(row.original.transactionDate).toLocaleDateString()}
          <br />
          <span className="text-xs text-muted-foreground">
            {new Date(row.original.transactionDate).toLocaleTimeString()}
          </span>
        </>
      ),
    },
    {
      accessorKey: 'transactionType',
      id: 'type',
      header: 'Type',
      cell: ({ row }) => (
        <>
          {getTypeBadge(row.original.transactionType)}
          {row.original.transactionType === 'TRANSFER' && row.original.relatedTransaction?.inventoryItem && (
            <div className="mt-1 text-xs text-muted-foreground">
              → {row.original.relatedTransaction.inventoryItem.itemCode} - {row.original.relatedTransaction.inventoryItem.name}
            </div>
          )}
          {row.original.transactionType === 'IN' && row.original.relatedTransaction?.inventoryItem && (
            <div className="mt-1 text-xs text-muted-foreground">
              ← Transfer from {row.original.relatedTransaction.inventoryItem.itemCode}
            </div>
          )}
        </>
      ),
    },
    {
      accessorKey: 'quantity',
      id: 'quantity',
      header: 'Quantity',
      cell: ({ row }) => (
        <span className="font-medium">
          {(row.original.transactionType === 'OUT' || row.original.transactionType === 'TRANSFER') ? '-' : '+'}
          {Math.floor(parseFloat(row.original.quantity.toString()))}
        </span>
      ),
    },
    {
      accessorKey: 'unitCost',
      id: 'unitCost',
      header: 'Unit Cost',
      cell: ({ row }) =>
        row.original.unitCost
          ? `₱${parseFloat(row.original.unitCost.toString()).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          : 'N/A',
    },
    {
      id: 'totalCost',
      header: 'Total Cost',
      cell: ({ row }) =>
        row.original.unitCost
          ? `₱${(parseFloat(row.original.unitCost.toString()) * parseFloat(row.original.quantity.toString())).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          : 'N/A',
    },
    {
      accessorKey: 'reference',
      id: 'reference',
      header: 'Reference',
      cell: ({ row }) => row.original.reference || 'N/A',
    },
    {
      accessorKey: 'actionBy',
      id: 'actionBy',
      header: 'Action By',
      cell: ({ row }) => row.original.actionBy || 'N/A',
    },
    {
      accessorKey: 'notes',
      id: 'notes',
      header: 'Notes',
      cell: ({ row }) => <span className="max-w-xs truncate">{row.original.notes || 'N/A'}</span>,
    },
    {
      id: 'actions',
      enableHiding: false,
      enableSorting: false,
      header: 'Actions',
      cell: ({ row }) => {
        const isDisabled = isSelectionMode || hasSelectedTransactions
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                disabled={isDisabled}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  setRowSelection({ [row.original.id]: true })
                  setIsBulkDeleteDialogOpen(true)
                }}
                className="text-destructive"
                disabled={isDisabled}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ], [isSelectionMode, hasSelectedTransactions])

  // Create table instance
  const table = useReactTable({
    data: transactions,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      rowSelection,
      columnVisibility,
    },
    getRowId: (row) => row.id,
  })

  // Get selected transactions - TanStack Table uses row IDs as keys
  // Compute directly to ensure reactivity when rowSelection changes
  const selectedTransactions = (() => {
    const selected = new Set<string>()
    table.getSelectedRowModel().rows.forEach(row => {
      selected.add(row.original.id)
    })
    return selected
  })()

  const handleToggleSelectionMode = useCallback(() => {
    setIsSelectionMode(prev => {
      if (!prev) {
        // Entering selection mode - show select column
        setColumnVisibility(prev => ({ ...prev, select: true }))
      } else {
        // Exiting selection mode - clear selection and hide select column
        setRowSelection({})
        setColumnVisibility(prev => ({ ...prev, select: false }))
      }
      return !prev
    })
  }, [])

  const handleToggleSelectAll = useCallback(() => {
    const currentTransactions = transactionsRef.current
    const selectedCount = selectedTransactions.size
    const allSelected = selectedCount === currentTransactions.length && currentTransactions.length > 0
    
    if (allSelected) {
      setRowSelection({})
    } else {
      const newSelection: Record<string, boolean> = {}
      currentTransactions.forEach(transaction => {
        newSelection[transaction.id] = true
      })
      setRowSelection(newSelection)
    }
  }, [selectedTransactions.size])

  // Automatically enable selection mode when user manually selects a transaction
  // Automatically disable selection mode when all transactions are unselected on desktop
  useEffect(() => {
    const selectedCount = Object.keys(rowSelection).length
    if (selectedCount > 0 && !isSelectionMode) {
      // User manually selected a transaction - automatically enable selection mode
      setIsSelectionMode(true)
      // Show select column only on mobile
      if (isMobile) {
        setColumnVisibility(prev => ({ ...prev, select: true }))
      }
    } else if (selectedCount === 0 && isSelectionMode && !isMobile) {
      // User unselected all transactions on desktop - automatically disable selection mode
      // On mobile, we keep selection mode active until user clicks cancel button
      setIsSelectionMode(false)
      // On desktop, select column stays visible, so no need to hide it
    }
  }, [rowSelection, isSelectionMode, isMobile])

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] })
    queryClient.invalidateQueries({ queryKey: ['inventory-item'] })
  }, [queryClient])

  const handleBulkDeleteClick = useCallback(() => {
    // If no items are selected, select all items first
    if (selectedTransactions.size === 0) {
      const allTransactionIds = transactions.map((transaction: InventoryTransaction) => transaction.id)
      setRowSelection(
        allTransactionIds.reduce((acc: Record<string, boolean>, id: string) => ({ ...acc, [id]: true }), {})
      )
    }
    setIsBulkDeleteDialogOpen(true)
  }, [selectedTransactions.size, transactions, setRowSelection])

  const bulkDeleteMutation = useBulkDeleteTransactions()

  const confirmBulkDelete = useCallback(async () => {
    setIsDeleting(true)
    const selectedArray = Array.from(selectedTransactions)
    setDeletingProgress({ current: 0, total: selectedArray.length })

    try {
      const result = await bulkDeleteMutation.mutateAsync({ itemId: itemCode, transactionIds: selectedArray })
      setDeletingProgress({ current: selectedArray.length, total: selectedArray.length })
      toast.success(`Successfully deleted ${result.deletedCount} transaction(s)`)
      setRowSelection({})
      setIsBulkDeleteDialogOpen(false)
      setIsDeleting(false)
    } catch (error) {
      console.error('Bulk delete error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete transactions')
      setIsDeleting(false)
    }
  }, [bulkDeleteMutation, itemCode, selectedTransactions, setRowSelection])

  // Set mobile dock content
  useEffect(() => {
    if (isMobile) {
      if (isSelectionMode) {
        // Selection mode: Select All / Deselect All (left) + Cancel (middle) + Delete icon (right, only when items selected)
        const transactionsCount = transactionsRef.current.length
        const selectedCount = Object.keys(rowSelection).length
        const allSelected = selectedCount === transactionsCount && transactionsCount > 0
        const hasSelectedItems = selectedCount > 0
        
        setDockContent(
          <>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="lg"
                onClick={handleToggleSelectAll}
                className="rounded-full btn-glass-elevated"
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={handleToggleSelectionMode}
                className="rounded-full btn-glass-elevated"
              >
                Cancel
              </Button>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={handleBulkDeleteClick}
              disabled={!hasSelectedItems}
              className="h-10 w-10 rounded-full btn-glass-elevated"
              title="Delete Selected"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )
      } else {
        // Normal mode: Select (left) + Refresh (right)
        setDockContent(
          <>
            <Button
              variant="outline"
              size="lg"
              onClick={handleToggleSelectionMode}
              className="rounded-full btn-glass-elevated"
            >
              Select
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full h-10 w-10 btn-glass-elevated"
              onClick={handleRefresh}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </>
        )
      }
    } else {
      setDockContent(null)
    }
    
    return () => {
      setDockContent(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, setDockContent, isSelectionMode, rowSelection])

  // Set mobile pagination content (show even during loading)
  useEffect(() => {
    if (isMobile) {
      setPaginationContent(
        <>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (pagination?.hasPreviousPage) {
                  handlePageChange(page - 1)
                }
              }}
              disabled={!pagination?.hasPreviousPage || isLoadingData}
              className="h-8 px-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Page</span>
              <div className="px-1.5 py-1 rounded-md bg-primary/10 text-primary font-medium text-xs">
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
                  handlePageChange(page + 1)
                }
              }}
              disabled={!pagination?.hasNextPage || isLoadingData}
              className="h-8 px-2"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Select value={pageSize.toString()} onValueChange={handlePageSizeChange} disabled={isLoadingData}>
              <SelectTrigger className="h-8 w-auto min-w-[90px] text-xs border-primary/20 bg-primary/10 text-primary font-medium hover:bg-primary/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20 rows</SelectItem>
                <SelectItem value="50">50 rows</SelectItem>
                <SelectItem value="100">100 rows</SelectItem>
                <SelectItem value="200">200 rows</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {isLoadingData ? (
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
  }, [isMobile, setPaginationContent, pagination, page, pageSize, isLoadingData, handlePageChange, handlePageSizeChange])

  // Show error state only if item failed to load (not just loading)
  if (!isLoadingItem && !item) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex flex-col items-center gap-4 max-w-md">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <History className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Inventory Item Not Found</h2>
            <p className="text-muted-foreground mt-2">
              The inventory item you&apos;re looking for doesn&apos;t exist or has been deleted.
            </p>
          </div>
          <Button onClick={() => router.push('/inventory')} variant="outline" className='btn-glass'>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Inventory
          </Button>
        </div>
      </div>
    )
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6 max-h-screen"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Transaction History</h1>
          <p className="text-muted-foreground">
            History for <strong>{isLoadingItem ? '...' : (item?.name || 'Unknown Item')}</strong>
            {!isLoadingItem && item && (
              <>
                {' • '}
                Current stock: <strong>{Math.floor(parseFloat(item.currentStock.toString()))} {item.unit || 'pcs'}</strong>
              </>
            )}
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => router.push('/inventory')}
          className="hidden sm:flex btn-glass"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Inventory
        </Button>
      </div>

      <Card className="relative flex flex-col flex-1 min-h-0 pb-0 gap-0">
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            {/* Search and Filter - combined */}
            <div className="flex items-center w-full lg:flex-1 lg:max-w-md">
              <div className="flex items-center flex-1 border rounded-md overflow-hidden">
                <Select
                  value={transactionTypeFilter}
                  onValueChange={(value) => {
                    const params = new URLSearchParams(searchParams.toString())
                    if (value === 'all') {
                      params.delete('type')
                    } else {
                      params.set('type', value)
                    }
                    params.set('page', '1')
                    router.push(`/inventory/${itemCode}/transaction-history?${params.toString()}`)
                  }}
                >
                  <SelectTrigger className="w-[140px] h-8 rounded-none border-0 border-r focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none" size='sm'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="IN">IN</SelectItem>
                    <SelectItem value="OUT">OUT</SelectItem>
                    <SelectItem value="ADJUSTMENT">ADJUSTMENT</SelectItem>
                    <SelectItem value="TRANSFER">TRANSFER</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative flex-1">
                  {searchInput ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchInput('')
                        setDebouncedSearch('')
                        // Clear search from URL while preserving type filter
                        const params = new URLSearchParams(searchParams.toString())
                        params.delete('search')
                        params.set('page', '1')
                        router.push(`/inventory/${itemCode}/transaction-history?${params.toString()}`)
                      }}
                      className="absolute left-2 top-2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors cursor-pointer z-10"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : (
                    <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                  )}
                  <Input
                    placeholder="Search transactions..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="pl-8 h-8 rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
                  />
                </div>
              </div>
            </div>
            {/* Actions */}
            <div className="flex items-center gap-2 justify-end">
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                className="h-8 w-8 shrink-0 hidden md:flex"
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              {selectedTransactions.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDeleteClick}
                  className="hidden md:flex"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete ({selectedTransactions.size})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 px-0 relative">
          {isFetching && (transactionHistory || transactions.length > 0) && (
            <div className={cn("absolute left-0 right-[10px] top-[33px] bottom-0 bg-background/50 backdrop-blur-sm z-40 flex items-center justify-center", isMobile && "right-0 rounded-b-2xl")}>
              <Spinner variant="default" size={24} className="text-muted-foreground" />
            </div>
          )}
          <div className={cn("h-140 pt-6", isMobile && "max-h-136")}>
            {isLoadingData ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <Spinner className="h-8 w-8" />
                  <p className="text-sm text-muted-foreground">Loading transactions...</p>
                </div>
              </div>
            ) : !transactions || transactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No transactions found</p>
                <p className="text-sm">Transactions will appear here once created</p>
              </div>
            ) : (
              <div className="min-w-full">
                <ScrollArea className={cn('h-132 relative', isMobile && "max-h-[520px]")}>
                  <div className="sticky top-0 z-30 h-px bg-border w-full"></div>
                  <div className="pr-2.5 relative after:content-[''] after:absolute after:right-[10px] after:top-0 after:bottom-0 after:w-px after:bg-border after:z-50 after:h-full">
                    <Table className='border-b'>
                      <TableHeader className="sticky -top-1 z-20 bg-card [&_tr]:border-b-0 -mr-1.5">
                        {table.getHeaderGroups().map((headerGroup) => (
                          <TableRow key={headerGroup.id} className="group hover:bg-muted/50 relative border-b-0 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-[1.5px] after:h-px after:bg-border after:z-30">
                            {headerGroup.headers.map((header) => {
                              const isSelectColumn = header.column.id === 'select'
                              const isActionsColumn = header.column.id === 'actions'
                              return (
                                <TableHead
                                  key={header.id}
                                  className={cn(
                                    'bg-card transition-colors group-hover:bg-muted/50',
                                    isSelectColumn && 'w-12',
                                    isActionsColumn && 'sticky right-0 text-center z-10 before:content-[""] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border before:z-50 rounded-br-2xl',
                                    !isSelectColumn && !isActionsColumn && 'text-left'
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
                        <AnimatePresence mode="popLayout">
                          {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => {
                              return (
                                <motion.tr
                                  key={row.id}
                                  layout
                                  initial={{ opacity: 0, y: 20 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -20 }}
                                  transition={{
                                    duration: 0.2,
                                    layout: { duration: 0.15, ease: [0.4, 0, 0.2, 1] },
                                  }}
                                  data-state={row.getIsSelected() && 'selected'}
                                  className="group relative border-b transition-colors"
                                >
                                  {row.getVisibleCells().map((cell) => {
                                    const isSelectColumn = cell.column.id === 'select'
                                    const isActionsColumn = cell.column.id === 'actions'
                                    return (
                                      <TableCell
                                        key={cell.id}
                                        className={cn(
                                          isSelectColumn && 'w-12',
                                          isActionsColumn && 'sticky text-center right-0 bg-card z-10 before:content-[""] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border before:z-50 rounded-br-2xl'
                                        )}
                                      >
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                      </TableCell>
                                    )
                                  })}
                                </motion.tr>
                              )
                            })
                          ) : (
                            <TableRow>
                              <TableCell colSpan={columns.length} className="h-24 text-center">
                                No transactions found
                              </TableCell>
                            </TableRow>
                          )}
                        </AnimatePresence>
                      </TableBody>
                    </Table>
                  </div>
                  <ScrollBar orientation="horizontal" className='z-10' />
                  <ScrollBar orientation="vertical" className='z-20' />
                </ScrollArea>
              </div>
            )}
          </div>
        </CardContent>
        
        {/* Pagination Bar - Fixed at Bottom */}
        <div className="sticky bottom-0 border-t bg-card z-10 shadow-sm mt-auto rounded-b-2xl hidden md:block">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 px-4 sm:px-6 py-3">
            {/* Left Side - Navigation */}
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (pagination?.hasPreviousPage) {
                    handlePageChange(page - 1)
                  }
                }}
                disabled={!pagination?.hasPreviousPage || isLoadingData}
                className="h-8 px-2 sm:px-3"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              
              {/* Page Info */}
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
                    handlePageChange(page + 1)
                  }
                }}
                disabled={!pagination?.hasNextPage || isLoadingData}
                className="h-8 px-2 sm:px-3"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Right Side - Rows and Records */}
            <div className="flex items-center justify-center sm:justify-end gap-2 sm:gap-4">
              {/* Row Selection - Clickable */}
              <Select value={pageSize.toString()} onValueChange={handlePageSizeChange} disabled={isLoadingData}>
                <SelectTrigger className="h-8 w-auto min-w-[90px] sm:min-w-[100px] text-xs sm:text-sm border-primary/20 bg-primary/10 text-primary font-medium hover:bg-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20 rows</SelectItem>
                  <SelectItem value="50">50 rows</SelectItem>
                  <SelectItem value="100">100 rows</SelectItem>
                  <SelectItem value="200">200 rows</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Total Records */}
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

      {/* Bulk Delete Dialog */}
      <BulkDeleteDialog
        open={isBulkDeleteDialogOpen}
        onOpenChange={(newOpen) => {
          setIsBulkDeleteDialogOpen(newOpen)
          // Clear selection when dialog is closed (cancelled) and not currently deleting
          if (!newOpen && !isDeleting) {
            setRowSelection({})
          }
        }}
        onConfirm={confirmBulkDelete}
        itemCount={selectedTransactions.size}
        itemName="Transaction"
        isDeleting={isDeleting}
        progress={isDeleting ? { current: deletingProgress.current, total: deletingProgress.total } : undefined}
        description={`Are you sure you want to permanently delete ${selectedTransactions.size} selected transaction(s)? This action cannot be undone.`}
      />

    </motion.div>
  )
}

