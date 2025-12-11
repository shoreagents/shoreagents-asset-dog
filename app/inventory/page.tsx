'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo, useCallback, useTransition, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { usePermissions } from '@/hooks/use-permissions'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Search,
  Plus,
  MoreHorizontal,
  Trash2,
  Edit,
  Package,
  AlertTriangle,
  ArrowUpDown,
  ArrowLeft,
  ArrowRight,
  X,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { DeleteConfirmationDialog } from '@/components/dialogs/delete-confirmation-dialog'
import { cn } from '@/lib/utils'
import { HeaderGroup, Header } from '@tanstack/react-table'

interface InventoryItem {
  id: string
  itemCode: string
  name: string
  description: string | null
  category: string | null
  unit: string | null
  currentStock: number
  minStockLevel: number | null
  maxStockLevel: number | null
  unitCost: number | null
  location: string | null
  supplier: string | null
  brand: string | null
  model: string | null
  sku: string | null
  barcode: string | null
  remarks: string | null
  createdAt: string
  updatedAt: string
  _count?: {
    transactions: number
  }
}

interface PaginationInfo {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

async function fetchInventoryItems(params: {
  search?: string
  category?: string
  lowStock?: boolean
  page?: number
  pageSize?: number
}): Promise<{ items: InventoryItem[]; pagination: PaginationInfo }> {
  const queryParams = new URLSearchParams()
  if (params.search) queryParams.set('search', params.search)
  if (params.category) queryParams.set('category', params.category)
  if (params.lowStock) queryParams.set('lowStock', 'true')
  if (params.page) queryParams.set('page', params.page.toString())
  if (params.pageSize) queryParams.set('pageSize', params.pageSize.toString())

  const response = await fetch(`/api/inventory?${queryParams.toString()}`)
  if (!response.ok) {
    throw new Error('Failed to fetch inventory items')
  }
  const data = await response.json()
  return { items: data.items, pagination: data.pagination }
}

async function createInventoryItem(data: Partial<InventoryItem>) {
  const response = await fetch('/api/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create inventory item')
  }
  return response.json()
}

async function updateInventoryItem(id: string, data: Partial<InventoryItem>) {
  const response = await fetch(`/api/inventory/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update inventory item')
  }
  return response.json()
}

async function deleteInventoryItem(id: string) {
  const response = await fetch(`/api/inventory/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete inventory item')
  }
  return response.json()
}

const createColumns = (
  onEdit: (item: InventoryItem) => void,
  onDelete: (item: InventoryItem) => void
): ColumnDef<InventoryItem>[] => [
  {
    accessorKey: 'itemCode',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="h-8 px-2"
      >
        Item Code
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="font-medium">{row.original.itemCode}</div>
    ),
  },
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="h-8 px-2"
      >
        Name
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => row.original.category || 'N/A',
  },
  {
    accessorKey: 'currentStock',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="h-8 px-2"
      >
        Stock
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const item = row.original
      const stock = parseFloat(item.currentStock.toString())
      const minStock = item.minStockLevel
        ? parseFloat(item.minStockLevel.toString())
        : null
      const isLowStock = minStock !== null && stock <= minStock
      const unit = item.unit || 'pcs'

      return (
        <div className="flex items-center gap-2">
          <span className={cn(isLowStock && 'text-red-600 font-medium')}>
            {stock.toLocaleString()} {unit}
          </span>
          {isLowStock && (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Low
            </Badge>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: 'unitCost',
    header: 'Unit Cost',
    cell: ({ row }) => {
      const cost = row.original.unitCost
      return cost
        ? `₱${parseFloat(cost.toString()).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
        : 'N/A'
    },
  },
  {
    accessorKey: 'location',
    header: 'Location',
    cell: ({ row }) => row.original.location || 'N/A',
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => {
      const item = row.original
      return (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(item)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(item)}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    },
  },
]

function InventoryPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const queryClient = useQueryClient()
  const isInitialMount = useRef(true)
  const [isManualRefresh, setIsManualRefresh] = useState(false)
  const { hasPermission } = usePermissions()
  
  // Get page, pageSize, and filters from URL
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)
  const searchQuery = searchParams.get('search') || ''
  const categoryFilter = searchParams.get('category') || 'all'
  const lowStockFilter = searchParams.get('lowStock') === 'true'
  
  const [searchInput, setSearchInput] = useState(searchQuery)
  const [sorting, setSorting] = useState<SortingState>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [formData, setFormData] = useState<Partial<InventoryItem>>({})

  const canEdit = hasPermission('canEditAssets')

  // Update URL parameters
  const updateURL = useCallback((updates: { 
    page?: number
    pageSize?: number
    search?: string
    category?: string
    lowStock?: boolean
  }) => {
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
      } else {
        params.set('search', updates.search)
      }
      params.delete('page')
    }
    
    if (updates.category !== undefined) {
      if (updates.category === 'all') {
        params.delete('category')
      } else {
        params.set('category', updates.category)
      }
      params.delete('page')
    }
    
    if (updates.lowStock !== undefined) {
      if (updates.lowStock) {
        params.set('lowStock', 'true')
      } else {
        params.delete('lowStock')
      }
      params.delete('page')
    }
    
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false })
    })
  }, [searchParams, router, startTransition])

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['inventory', searchQuery, categoryFilter, lowStockFilter, page, pageSize],
    queryFn: () =>
      fetchInventoryItems({
        search: searchQuery || undefined,
        category: categoryFilter && categoryFilter !== 'all' ? categoryFilter : undefined,
        lowStock: lowStockFilter,
        page,
        pageSize,
      }),
    placeholderData: (previousData) => previousData,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  })

  // Reset manual refresh flag when fetch completes
  useEffect(() => {
    if (!isFetching && isManualRefresh) {
      setIsManualRefresh(false)
    }
  }, [isFetching, isManualRefresh])

  // Sync search input with URL param
  useEffect(() => {
    setSearchInput(searchQuery)
  }, [searchQuery])

  const handlePageSizeChange = (newPageSize: string) => {
    updateURL({ pageSize: parseInt(newPageSize), page: 1 })
  }

  const handlePageChange = (newPage: number) => {
    updateURL({ page: newPage })
  }

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== searchQuery) {
        updateURL({ search: searchInput, page: 1 })
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [searchInput, searchQuery, updateURL])

  // Mark initial mount as complete after first render
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
    }
  }, [])

  const createMutation = useMutation({
    mutationFn: createInventoryItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      toast.success('Inventory item created successfully')
      setIsAddDialogOpen(false)
      setFormData({})
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create inventory item')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InventoryItem> }) =>
      updateInventoryItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      toast.success('Inventory item updated successfully')
      setIsEditDialogOpen(false)
      setSelectedItem(null)
      setFormData({})
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update inventory item')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteInventoryItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      toast.success('Inventory item deleted successfully')
      setIsDeleteDialogOpen(false)
      setSelectedItem(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete inventory item')
    },
  })

  const handleAdd = () => {
    setFormData({})
    setIsAddDialogOpen(true)
  }

  const handleEdit = useCallback((item: InventoryItem) => {
    setSelectedItem(item)
    setFormData({
      itemCode: item.itemCode,
      name: item.name,
      description: item.description || '',
      category: item.category || '',
      unit: item.unit || '',
      currentStock: item.currentStock,
      minStockLevel: item.minStockLevel,
      maxStockLevel: item.maxStockLevel,
      unitCost: item.unitCost,
      location: item.location || '',
      supplier: item.supplier || '',
      brand: item.brand || '',
      model: item.model || '',
      sku: item.sku || '',
      barcode: item.barcode || '',
      remarks: item.remarks || '',
    })
    setIsEditDialogOpen(true)
  }, [])

  const handleDelete = useCallback((item: InventoryItem) => {
    setSelectedItem(item)
    setIsDeleteDialogOpen(true)
  }, [])

  const handleSubmit = () => {
    if (isEditDialogOpen && selectedItem) {
      updateMutation.mutate({ id: selectedItem.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const columns = useMemo(
    () => createColumns(handleEdit, handleDelete),
    [handleEdit, handleDelete]
  )

  const items = useMemo(() => data?.items || [], [data?.items])
  const pagination = data?.pagination

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  })

  if (error) {
    return (
      <div className="space-y-6 p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-600">
              Error loading inventory: {(error as Error).message}
            </p>
          </CardContent>
        </Card>
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
      <div>
        <h1 className="text-3xl font-bold">Inventory</h1>
        <p className="text-muted-foreground">
          Manage stock-type items (consumables, spare parts)
        </p>
      </div>

      <Card className="relative flex flex-col flex-1 min-h-0 pb-0 gap-0">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center w-full md:flex-1 md:max-w-md border rounded-md overflow-hidden">
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
                  placeholder="Search items..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-8 h-8 rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select 
                value={categoryFilter} 
                onValueChange={(value) => updateURL({ category: value, page: 1 })}
              >
                <SelectTrigger className="w-full sm:w-[180px] h-8">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Consumables">Consumables</SelectItem>
                  <SelectItem value="Spare Parts">Spare Parts</SelectItem>
                  <SelectItem value="Supplies">Supplies</SelectItem>
                  <SelectItem value="Tools">Tools</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={lowStockFilter ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateURL({ lowStock: !lowStockFilter, page: 1 })}
                className="h-8"
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Low Stock
              </Button>
              {canEdit && (
                <Button 
                  onClick={handleAdd}
                  size='sm'
                  className="flex-1 md:flex-initial h-8"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setIsManualRefresh(true)
                  queryClient.invalidateQueries({ queryKey: ['inventory'] })
                }}
                className="h-8 w-8"
                title="Refresh table"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 px-0 relative">
          {isFetching && data && (
            <div className="absolute left-0 right-[10px] top-[33px] bottom-0 bg-background/50 backdrop-blur-sm z-20 flex items-center justify-center">
              <Spinner variant="default" size={24} className="text-muted-foreground" />
            </div>
          )}
          <div className="h-140 pt-8">
            {isLoading && !data ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <Spinner className="h-8 w-8" />
                  <p className="text-sm text-muted-foreground">Loading inventory items...</p>
                </div>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No items found</p>
                <p className="text-sm">Add your first inventory item to get started</p>
              </div>
            ) : (
              <div className="min-w-full">
                <ScrollArea className='h-132 relative'>
                <div className="sticky top-0 z-30 h-px bg-border w-full"></div>
                <div className="pr-2.5 relative after:content-[''] after:absolute after:right-[10px] after:top-0 after:bottom-0 after:w-px after:bg-border after:z-50 after:h-full">
                <Table className='border-b'>
                  <TableHeader className="sticky -top-1 z-20 bg-card [&_tr]:border-b-0 -mr-1.5">
                    {table.getHeaderGroups().map((headerGroup: HeaderGroup<InventoryItem>) => (
                      <TableRow key={headerGroup.id} className="group hover:bg-muted/50 relative border-b-0 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-[1.5px] after:h-px after:bg-border after:z-30">
                        {headerGroup.headers.map((header: Header<InventoryItem, unknown>) => {
                          const isActionsColumn = header.column.id === 'actions'
                          return (
                            <TableHead 
                              key={header.id}
                              className={cn(
                                isActionsColumn ? "text-center " : "text-left",
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
                                delay: isInitialMount.current ? index * 0.05 : 0,
                                layout: {
                                  duration: 0.15,
                                  ease: [0.4, 0, 0.2, 1]
                                }
                              }}
                            data-state={row.getIsSelected() && 'selected'}
                            className="group relative border-b transition-colors"
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
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                              )
                            })}
                            </motion.tr>
                        ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={columns.length} className="h-24 text-center">
                          No items found.
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
        <div className="sticky bottom-0 border-t bg-card z-10 shadow-sm mt-auto rounded-b-lg">
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
                disabled={!pagination?.hasPreviousPage || isLoading}
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
                  if (pagination?.hasNextPage) {
                    handlePageChange(page + 1)
                  }
                }}
                disabled={!pagination?.hasNextPage || isLoading}
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

      {/* Add/Edit Dialog */}
      <Dialog
        open={isAddDialogOpen || isEditDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false)
            setIsEditDialogOpen(false)
            setFormData({})
            setSelectedItem(null)
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditDialogOpen ? 'Edit Inventory Item' : 'Add Inventory Item'}
            </DialogTitle>
            <DialogDescription>
              {isEditDialogOpen
                ? 'Update inventory item details'
                : 'Create a new inventory item'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="itemCode">Item Code *</Label>
                <Input
                  id="itemCode"
                  value={formData.itemCode || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, itemCode: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description || ''}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category || undefined}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category: value || null })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Consumables">Consumables</SelectItem>
                    <SelectItem value="Spare Parts">Spare Parts</SelectItem>
                    <SelectItem value="Supplies">Supplies</SelectItem>
                    <SelectItem value="Tools">Tools</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="unit">Unit</Label>
                <Input
                  id="unit"
                  value={formData.unit || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, unit: e.target.value })
                  }
                  placeholder="pcs, boxes, liters, etc."
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="currentStock">Current Stock</Label>
                <Input
                  id="currentStock"
                  type="number"
                  value={formData.currentStock || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      currentStock: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="minStockLevel">Min Stock Level</Label>
                <Input
                  id="minStockLevel"
                  type="number"
                  value={formData.minStockLevel || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      minStockLevel: parseFloat(e.target.value) || null,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="maxStockLevel">Max Stock Level</Label>
                <Input
                  id="maxStockLevel"
                  type="number"
                  value={formData.maxStockLevel || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      maxStockLevel: parseFloat(e.target.value) || null,
                    })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="unitCost">Unit Cost</Label>
                <Input
                  id="unitCost"
                  type="number"
                  step="0.01"
                  value={formData.unitCost || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      unitCost: parseFloat(e.target.value) || null,
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="supplier">Supplier</Label>
                <Input
                  id="supplier"
                  value={formData.supplier || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, supplier: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="brand">Brand</Label>
                <Input
                  id="brand"
                  value={formData.brand || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, brand: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  value={formData.model || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, model: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  value={formData.sku || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, sku: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <Label htmlFor="barcode">Barcode</Label>
              <Input
                id="barcode"
                value={formData.barcode || ''}
                onChange={(e) =>
                  setFormData({ ...formData, barcode: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="remarks">Remarks</Label>
              <Input
                id="remarks"
                value={formData.remarks || ''}
                onChange={(e) =>
                  setFormData({ ...formData, remarks: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false)
                setIsEditDialogOpen(false)
                setFormData({})
                setSelectedItem(null)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                createMutation.isPending ||
                updateMutation.isPending ||
                !formData.itemCode ||
                !formData.name
              }
            >
              {createMutation.isPending || updateMutation.isPending ? (
                <Spinner className="mr-2 h-4 w-4" />
              ) : null}
              {isEditDialogOpen ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={() => {
          if (selectedItem) {
            deleteMutation.mutate(selectedItem.id)
          }
        }}
        itemName={selectedItem?.name || ''}
        isLoading={deleteMutation.isPending}
      />
    </motion.div>
  )
}

export default function InventoryPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Inventory</h1>
          <p className="text-muted-foreground">
            Manage stock-type items (consumables, spare parts)
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
      <InventoryPageContent />
    </Suspense>
  )
}

