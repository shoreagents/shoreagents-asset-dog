'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useInventoryItems, useCreateInventoryItem, useUpdateInventoryItem, useDeleteInventoryItem, useExportInventory } from '@/hooks/use-inventory'
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
  VisibilityState,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Search,
  Plus,
  MoreHorizontal,
  MoreVertical,
  Trash2,
  Edit,
  Package,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  X,
  RefreshCw,
  CheckCircle2,
  XCircle,
  TrendingUp,
  History,
  Upload,
  Download,
  FileSpreadsheet,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import * as XLSX from 'xlsx'
import { DeleteConfirmationDialog } from '@/components/dialogs/delete-confirmation-dialog'
import { InventoryItemDialog, type InventoryItem as InventoryItemType } from '@/components/dialogs/inventory-item-dialog'
import { InventoryTransactionDialog } from '@/components/dialogs/inventory-transaction-dialog'
import { ExportFieldsDialog } from '@/components/dialogs/export-fields-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { HeaderGroup, Header } from '@tanstack/react-table'
import { useMobileDock } from '@/components/mobile-dock-provider'
import { useMobilePagination } from '@/components/mobile-pagination-provider'
import { useIsMobile } from '@/hooks/use-mobile'

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


interface CategorySummary {
  category: string
  count: number
  totalStock: number
  totalCost: number
}

interface StatusSummary {
  status: string
  count: number
  totalStock: number
  totalCost: number
}

interface SummaryData {
  totalItems: number
  totalStock: number
  totalCost: number
  byCategory: CategorySummary[]
  byStatus: StatusSummary[]
  lowStockItems: InventoryItem[]
}


import { useCreateInventoryTransaction } from '@/hooks/use-inventory'

// Column definitions for visibility control
const ALL_COLUMNS = [
  { key: 'itemCode', label: 'Item Code' },
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Category' },
  { key: 'currentStock', label: 'Stock' },
  { key: 'status', label: 'Status' },
  { key: 'unitCost', label: 'Unit Cost' },
  { key: 'location', label: 'Location' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'brand', label: 'Brand' },
  { key: 'model', label: 'Model' },
  { key: 'sku', label: 'SKU' },
  { key: 'barcode', label: 'Barcode' },
  { key: 'unit', label: 'Unit' },
  { key: 'description', label: 'Description' },
  { key: 'remarks', label: 'Remarks' },
  { key: 'actions', label: 'Actions' },
]

const createColumns = (
  onEdit: (item: InventoryItem) => void,
  onDelete: (item: InventoryItem) => void,
  onAddTransaction: (item: InventoryItem) => void,
  onViewTransactions: (item: InventoryItem) => void
): ColumnDef<InventoryItem>[] => [
  {
    id: 'itemCode',
    accessorKey: 'itemCode',
    header: ({ column }) => (
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
    ),
    cell: ({ row }) => (
      <div className="font-medium">{row.original.itemCode}</div>
    ),
  },
  {
    id: 'name',
    accessorKey: 'name',
    header: ({ column }) => (
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
    ),
  },
  {
    id: 'category',
    accessorKey: 'category',
    header: ({ column }) => (
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
    ),
    cell: ({ row }) => row.original.category || 'N/A',
  },
  {
    id: 'currentStock',
    accessorFn: (row) => parseFloat(row.currentStock.toString()),
    header: ({ column }) => (
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
    ),
    cell: ({ row }) => {
      const item = row.original
      const stock = Math.floor(parseFloat(item.currentStock.toString()))
      const unit = item.unit || 'pcs'

      return (
        <span className="font-medium">
          {stock.toLocaleString()} {unit}
        </span>
      )
    },
  },
  {
    id: 'status',
    accessorFn: (row) => {
      const stock = Math.floor(parseFloat(row.currentStock.toString()))
      const minStock = row.minStockLevel
        ? Math.floor(parseFloat(row.minStockLevel.toString()))
        : null
      const maxStock = row.maxStockLevel
        ? Math.floor(parseFloat(row.maxStockLevel.toString()))
        : null
      
      // Return a sortable value: 0 = Out of Stock, 1 = Low Stock, 2 = In Stock, 3 = Overstock
      if (stock === 0) return 0
      if (minStock !== null && stock <= minStock) return 1
      if (maxStock !== null && stock > maxStock) return 3
      return 2
    },
    header: ({ column }) => (
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
    ),
    cell: ({ row }) => {
      const item = row.original
      const stock = Math.floor(parseFloat(item.currentStock.toString()))
      const minStock = item.minStockLevel
        ? Math.floor(parseFloat(item.minStockLevel.toString()))
        : null
      const maxStock = item.maxStockLevel
        ? Math.floor(parseFloat(item.maxStockLevel.toString()))
        : null
      
      let statusLabel = 'In Stock'
      let statusVariant: 'default' | 'destructive' | 'secondary' | 'outline' = 'default'
      let statusIcon = CheckCircle2
      
      if (stock === 0) {
        statusLabel = 'Out of Stock'
        statusVariant = 'destructive'
        statusIcon = XCircle
      } else if (minStock !== null && stock <= minStock) {
        statusLabel = 'Low Stock'
        statusVariant = 'destructive'
        statusIcon = AlertTriangle
      } else if (maxStock !== null && stock > maxStock) {
        statusLabel = 'Overstock'
        statusVariant = 'secondary'
        statusIcon = TrendingUp
      } else {
        statusLabel = 'In Stock'
        statusVariant = 'default'
        statusIcon = CheckCircle2
      }

      const Icon = statusIcon
      return (
        <Badge variant={statusVariant} className="text-xs">
          <Icon className="h-3 w-3 mr-1" />
          {statusLabel}
        </Badge>
      )
    },
  },
  {
    id: 'unitCost',
    accessorFn: (row) => row.unitCost ? parseFloat(row.unitCost.toString()) : 0,
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
      >
        Unit Cost
        {column.getIsSorted() === 'asc' ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : column.getIsSorted() === 'desc' ? (
          <ArrowDown className="ml-2 h-4 w-4" />
        ) : (
          <ArrowUpDown className="ml-2 h-4 w-4" />
        )}
      </Button>
    ),
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
    id: 'location',
    accessorKey: 'location',
    header: ({ column }) => (
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
    ),
    cell: ({ row }) => row.original.location || 'N/A',
  },
  {
    id: 'supplier',
    accessorKey: 'supplier',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
      >
        Supplier
        {column.getIsSorted() === 'asc' ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : column.getIsSorted() === 'desc' ? (
          <ArrowDown className="ml-2 h-4 w-4" />
        ) : (
          <ArrowUpDown className="ml-2 h-4 w-4" />
        )}
      </Button>
    ),
    cell: ({ row }) => row.original.supplier || 'N/A',
  },
  {
    id: 'brand',
    accessorKey: 'brand',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
      >
        Brand
        {column.getIsSorted() === 'asc' ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : column.getIsSorted() === 'desc' ? (
          <ArrowDown className="ml-2 h-4 w-4" />
        ) : (
          <ArrowUpDown className="ml-2 h-4 w-4" />
        )}
      </Button>
    ),
    cell: ({ row }) => row.original.brand || 'N/A',
  },
  {
    id: 'model',
    accessorKey: 'model',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
      >
        Model
        {column.getIsSorted() === 'asc' ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : column.getIsSorted() === 'desc' ? (
          <ArrowDown className="ml-2 h-4 w-4" />
        ) : (
          <ArrowUpDown className="ml-2 h-4 w-4" />
        )}
      </Button>
    ),
    cell: ({ row }) => row.original.model || 'N/A',
  },
  {
    id: 'sku',
    accessorKey: 'sku',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
      >
        SKU
        {column.getIsSorted() === 'asc' ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : column.getIsSorted() === 'desc' ? (
          <ArrowDown className="ml-2 h-4 w-4" />
        ) : (
          <ArrowUpDown className="ml-2 h-4 w-4" />
        )}
      </Button>
    ),
    cell: ({ row }) => row.original.sku || 'N/A',
  },
  {
    id: 'barcode',
    accessorKey: 'barcode',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
      >
        Barcode
        {column.getIsSorted() === 'asc' ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : column.getIsSorted() === 'desc' ? (
          <ArrowDown className="ml-2 h-4 w-4" />
        ) : (
          <ArrowUpDown className="ml-2 h-4 w-4" />
        )}
      </Button>
    ),
    cell: ({ row }) => row.original.barcode || 'N/A',
  },
  {
    id: 'unit',
    accessorKey: 'unit',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
      >
        Unit
        {column.getIsSorted() === 'asc' ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : column.getIsSorted() === 'desc' ? (
          <ArrowDown className="ml-2 h-4 w-4" />
        ) : (
          <ArrowUpDown className="ml-2 h-4 w-4" />
        )}
      </Button>
    ),
    cell: ({ row }) => row.original.unit || 'N/A',
  },
  {
    id: 'description',
    accessorKey: 'description',
    header: ({ column }) => (
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
    ),
    cell: ({ row }) => row.original.description || 'N/A',
  },
  {
    id: 'remarks',
    accessorKey: 'remarks',
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
      >
        Remarks
        {column.getIsSorted() === 'asc' ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : column.getIsSorted() === 'desc' ? (
          <ArrowDown className="ml-2 h-4 w-4" />
        ) : (
          <ArrowUpDown className="ml-2 h-4 w-4" />
        )}
      </Button>
    ),
    cell: ({ row }) => row.original.remarks || 'N/A',
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
              <DropdownMenuItem onClick={() => onAddTransaction(item)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Transaction
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewTransactions(item)}>
                <History className="mr-2 h-4 w-4" />
                View Transactions
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
  const [, startTransition] = useTransition()
  const queryClient = useQueryClient()
  const isInitialMount = useRef(true)
  const [isManualRefresh, setIsManualRefresh] = useState(false)
  const { hasPermission } = usePermissions()
  const isMobile = useIsMobile()
  const { setDockContent } = useMobileDock()
  const { setPaginationContent } = useMobilePagination()
  
  // Get page, pageSize, and filters from URL
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)
  const searchQuery = searchParams.get('search') || ''
  const categoryFilter = searchParams.get('category') || 'all'
  const lowStockFilter = searchParams.get('lowStock') === 'true'
  
  const [searchInput, setSearchInput] = useState(searchQuery)
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    itemCode: true,
    name: true,
    category: true,
    currentStock: true,
    status: true,
    unitCost: true,
    location: true,
    supplier: false,
    brand: false,
    model: false,
    sku: false,
    barcode: false,
    unit: false,
    description: false,
    remarks: false,
    actions: true,
  })
  const [isSelectOpen, setIsSelectOpen] = useState(false)
  const [shouldCloseSelect, setShouldCloseSelect] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [selectedExportFields, setSelectedExportFields] = useState<Set<string>>(new Set())
  const [selectedSummaryFields, setSelectedSummaryFields] = useState<Set<string>>(new Set())
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf'>('excel')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const canManageInventory = hasPermission('canManageInventory')
  const canManageImport = hasPermission('canManageImport')

  // Available export fields
  const exportFields = useMemo(() => [
    { key: 'itemCode', label: 'Item Code' },
    { key: 'name', label: 'Name' },
    { key: 'description', label: 'Description' },
    { key: 'category', label: 'Category' },
    { key: 'unit', label: 'Unit' },
    { key: 'currentStock', label: 'Current Stock' },
    { key: 'minStockLevel', label: 'Min Stock Level' },
    { key: 'maxStockLevel', label: 'Max Stock Level' },
    { key: 'unitCost', label: 'Unit Cost' },
    { key: 'location', label: 'Location' },
    { key: 'supplier', label: 'Supplier' },
    { key: 'brand', label: 'Brand' },
    { key: 'model', label: 'Model' },
    { key: 'sku', label: 'SKU' },
    { key: 'barcode', label: 'Barcode' },
    { key: 'remarks', label: 'Remarks' },
  ], [])

  // Summary fields for export
  const summaryFields = useMemo(() => [
    { key: 'summary', label: 'Summary' },
    { key: 'byCategory', label: 'By Category' },
    { key: 'byStatus', label: 'By Status' },
    { key: 'totalCost', label: 'Total Cost' },
    { key: 'lowStock', label: 'Low Stock Items' },
  ], [])

  // Initialize export fields - select all by default when dialog opens
  useEffect(() => {
    if (isExportDialogOpen && selectedExportFields.size === 0) {
      setSelectedExportFields(new Set(exportFields.map(f => f.key)))
    }
    if (isExportDialogOpen && selectedSummaryFields.size === 0) {
      setSelectedSummaryFields(new Set(summaryFields.map(f => f.key)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExportDialogOpen])

  // Convert column visibility to visible columns array
  const visibleColumns = useMemo(() => {
    return Object.entries(columnVisibility)
      .filter(([, visible]) => visible)
      .map(([key]) => key)
      .filter(key => key !== 'actions') // Exclude Actions from count
  }, [columnVisibility])

  // Exclude Actions from the "all selected" check since it's always visible
  const allSelected = Object.keys(columnVisibility)
    .filter(key => key !== 'actions')
    .filter(key => columnVisibility[key as keyof VisibilityState])
    .length === ALL_COLUMNS.filter(col => col.key !== 'actions').length


  const handleSelectOpenChange = (open: boolean) => {
    if (open) {
      // Opening the select
      setIsSelectOpen(true)
    } else {
      // Trying to close - only allow if shouldCloseSelect is true
      if (shouldCloseSelect) {
        setIsSelectOpen(false)
        setShouldCloseSelect(false)
      } else {
        // Don't close for individual selections - keep it open
        setIsSelectOpen(true)
      }
    }
  }

  // Handle clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // If select is open and we're not clicking a select item, close it
      if (isSelectOpen && !shouldCloseSelect) {
        const target = event.target as HTMLElement
        const isSelectItem = target.closest('[role="option"]')
        const isSelectContent = target.closest('[role="listbox"]')
        
        // If clicked outside select content, close it
        if (!isSelectContent && !isSelectItem) {
          setIsSelectOpen(false)
        }
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isSelectOpen, shouldCloseSelect])

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

  const { data, isLoading, isFetching, error } = useInventoryItems({
    search: searchQuery || undefined,
    category: categoryFilter && categoryFilter !== 'all' ? categoryFilter : undefined,
    lowStock: lowStockFilter,
    page,
    pageSize,
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

  const handlePageSizeChange = useCallback((newPageSize: string) => {
    updateURL({ pageSize: parseInt(newPageSize), page: 1 })
  }, [updateURL])

  const handlePageChange = useCallback((newPage: number) => {
    updateURL({ page: newPage })
  }, [updateURL])

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

  const createMutation = useCreateInventoryItem()
  const updateMutation = useUpdateInventoryItem()
  const deleteMutation = useDeleteInventoryItem()

  // Wrap mutations with toast notifications
  useEffect(() => {
    if (createMutation.isSuccess) {
      toast.success('Inventory item created successfully')
      setIsAddDialogOpen(false)
      setSelectedItem(null)
      createMutation.reset()
    }
    if (createMutation.isError) {
      toast.error(createMutation.error?.message || 'Failed to create inventory item')
      createMutation.reset()
    }
  }, [createMutation.isSuccess, createMutation.isError, createMutation.error, createMutation])

  useEffect(() => {
    if (updateMutation.isSuccess) {
      toast.success('Inventory item updated successfully')
      setIsEditDialogOpen(false)
      setSelectedItem(null)
      updateMutation.reset()
    }
    if (updateMutation.isError) {
      toast.error(updateMutation.error?.message || 'Failed to update inventory item')
      updateMutation.reset()
    }
  }, [updateMutation.isSuccess, updateMutation.isError, updateMutation.error, updateMutation])

  useEffect(() => {
    if (deleteMutation.isSuccess) {
      toast.success('Inventory item deleted successfully. It will be permanently deleted after 30 days.')
      setIsDeleteDialogOpen(false)
      setSelectedItem(null)
      deleteMutation.reset()
    }
    if (deleteMutation.isError) {
      toast.error(deleteMutation.error?.message || 'Failed to delete inventory item')
      deleteMutation.reset()
    }
  }, [deleteMutation.isSuccess, deleteMutation.isError, deleteMutation.error, deleteMutation])


  // Create transaction mutation
  const createTransactionMutation = useCreateInventoryTransaction()

  // Wrap with toast notifications
  useEffect(() => {
    if (createTransactionMutation.isSuccess) {
      toast.success('Transaction created successfully')
      setIsTransactionDialogOpen(false)
      createTransactionMutation.reset()
    }
    if (createTransactionMutation.isError) {
      toast.error(createTransactionMutation.error?.message || 'Failed to create transaction')
      createTransactionMutation.reset()
    }
  }, [createTransactionMutation.isSuccess, createTransactionMutation.isError, createTransactionMutation.error, createTransactionMutation])

  const handleAdd = useCallback(() => {
    if (!canManageInventory) {
      toast.error('You do not have permission to add inventory')
      return
    }
    setSelectedItem(null)
    setIsAddDialogOpen(true)
  }, [canManageInventory])

  const handleEdit = useCallback((item: InventoryItem) => {
    if (!canManageInventory) {
      toast.error('You do not have permission to edit inventory')
      return
    }
    setSelectedItem(item)
    setIsEditDialogOpen(true)
  }, [canManageInventory])

  const handleDelete = useCallback((item: InventoryItem) => {
    if (!canManageInventory) {
      toast.error('You do not have permission to delete inventory')
      return
    }
    setSelectedItem(item)
    setIsDeleteDialogOpen(true)
  }, [canManageInventory])

  const handleAddTransaction = useCallback((item: InventoryItem) => {
    if (!canManageInventory) {
      toast.error('You do not have permission to add inventory transaction')
      return
    }
    setSelectedItem(item)
    setIsTransactionDialogOpen(true)
  }, [canManageInventory])

  const handleViewTransactions = useCallback((item: InventoryItem) => {
    router.push(`/inventory/${item.itemCode}/transaction-history`)
  }, [router])

  // Format number with commas and 2 decimal places
  const formatNumber = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return ''
    }
    return Number(value).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  // Calculate summary data
  const calculateSummaryData = useCallback((): SummaryData | null => {
    if (!data?.items) return null

    const items = data.items
    const totalItems = items.length
    const totalStock = items.reduce((sum, item) => sum + parseFloat(item.currentStock.toString()), 0)
    const totalCost = items.reduce((sum, item) => {
      const stock = parseFloat(item.currentStock.toString())
      const cost = item.unitCost ? parseFloat(item.unitCost.toString()) : 0
      return sum + (stock * cost)
    }, 0)

    // Group by category
    const byCategory = new Map<string, { count: number; totalStock: number; totalCost: number }>()
    items.forEach(item => {
      const category = item.category || 'Uncategorized'
      if (!byCategory.has(category)) {
        byCategory.set(category, { count: 0, totalStock: 0, totalCost: 0 })
      }
      const group = byCategory.get(category)!
      group.count++
      group.totalStock += parseFloat(item.currentStock.toString())
      const cost = item.unitCost ? parseFloat(item.unitCost.toString()) : 0
      group.totalCost += parseFloat(item.currentStock.toString()) * cost
    })

    // Group by status (for inventory, we'll use stock status: In Stock, Low Stock, Out of Stock)
    const byStatus = new Map<string, { count: number; totalStock: number; totalCost: number }>()
    items.forEach(item => {
      const stock = parseFloat(item.currentStock.toString())
      const minLevel = item.minStockLevel ? parseFloat(item.minStockLevel.toString()) : null
      let status = 'In Stock'
      if (stock === 0) {
        status = 'Out of Stock'
      } else if (minLevel !== null && stock <= minLevel) {
        status = 'Low Stock'
      }
      
      if (!byStatus.has(status)) {
        byStatus.set(status, { count: 0, totalStock: 0, totalCost: 0 })
      }
      const group = byStatus.get(status)!
      group.count++
      group.totalStock += stock
      const cost = item.unitCost ? parseFloat(item.unitCost.toString()) : 0
      group.totalCost += stock * cost
    })

    // Low stock items
    const lowStockItems = items.filter(item => {
      const stock = parseFloat(item.currentStock.toString())
      const minLevel = item.minStockLevel ? parseFloat(item.minStockLevel.toString()) : null
      return minLevel !== null && stock <= minLevel
    })

    return {
      totalItems,
      totalStock,
      totalCost,
      byCategory: Array.from(byCategory.entries()).map(([category, data]) => ({
        category,
        count: data.count,
        totalStock: data.totalStock,
        totalCost: data.totalCost,
      })),
      byStatus: Array.from(byStatus.entries()).map(([status, data]) => ({
        status,
        count: data.count,
        totalStock: data.totalStock,
        totalCost: data.totalCost,
      })),
      lowStockItems,
    }
  }, [data?.items])

  // Generate HTML for PDF report
  const generateInventoryReportHTML = useCallback((_allData: InventoryItem[], summaryData: SummaryData | null, summaryFields: Set<string>, itemFields: Set<string>, items: InventoryItem[]) => {
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Inventory Report</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
          h2 { color: #666; margin-top: 20px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 10px; }
          th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          .summary { background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .metric { margin: 10px 0; }
        </style>
      </head>
      <body>
        <h1>Inventory Report</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
    `

    if (summaryFields.size > 0 && summaryData) {
      if (summaryFields.has('summary')) {
        html += `
          <div class="summary">
            <h2>Summary</h2>
            <div class="metric"><strong>Total Items:</strong> ${summaryData.totalItems}</div>
            <div class="metric"><strong>Total Stock:</strong> ${Math.floor(summaryData.totalStock)}</div>
            <div class="metric"><strong>Total Cost:</strong> ₱${formatNumber(summaryData.totalCost)}</div>
          </div>
        `
      }

      if (summaryFields.has('byCategory') && summaryData.byCategory && summaryData.byCategory.length > 0) {
        html += `
          <h2>By Category</h2>
          <table>
            <tr><th>Category</th><th>Count</th><th>Total Stock</th><th>Total Cost</th></tr>
        `
        summaryData.byCategory.forEach((cat) => {
          html += `<tr><td>${cat.category}</td><td>${cat.count}</td><td>${Math.floor(cat.totalStock)}</td><td>₱${formatNumber(cat.totalCost)}</td></tr>`
        })
        html += `</table>`
      }

      if (summaryFields.has('byStatus') && summaryData.byStatus && summaryData.byStatus.length > 0) {
        html += `
          <h2>By Status</h2>
          <table>
            <tr><th>Status</th><th>Count</th><th>Total Stock</th><th>Total Cost</th></tr>
        `
        summaryData.byStatus.forEach((statusItem) => {
          html += `<tr><td>${statusItem.status}</td><td>${statusItem.count}</td><td>${Math.floor(statusItem.totalStock)}</td><td>₱${formatNumber(statusItem.totalCost)}</td></tr>`
        })
        html += `</table>`
      }

      if (summaryFields.has('totalCost') && summaryData) {
        html += `
          <div class="summary">
            <h2>Total Cost</h2>
            <div class="metric"><strong>Total Inventory Value:</strong> ₱${formatNumber(summaryData.totalCost)}</div>
          </div>
        `
      }

      if (summaryFields.has('lowStock') && summaryData.lowStockItems && summaryData.lowStockItems.length > 0) {
        html += `
          <h2>Low Stock Items</h2>
          <table>
            <tr><th>Item Code</th><th>Name</th><th>Current Stock</th><th>Min Level</th></tr>
        `
        summaryData.lowStockItems.forEach((item) => {
          html += `<tr><td>${item.itemCode}</td><td>${item.name}</td><td>${Math.floor(parseFloat(item.currentStock.toString()))}</td><td>${item.minStockLevel ? Math.floor(parseFloat(item.minStockLevel.toString())) : ''}</td></tr>`
        })
        html += `</table>`
      }
    }

    if (itemFields.size > 0 && items.length > 0) {
      html += `<h2>Inventory Items</h2><table><tr>`
      
      // Build header row based on selected fields
      const fieldLabels: Record<string, string> = {
        itemCode: 'Item Code',
        name: 'Name',
        description: 'Description',
        category: 'Category',
        unit: 'Unit',
        currentStock: 'Current Stock',
        minStockLevel: 'Min Stock Level',
        maxStockLevel: 'Max Stock Level',
        unitCost: 'Unit Cost',
        location: 'Location',
        supplier: 'Supplier',
        brand: 'Brand',
        model: 'Model',
        sku: 'SKU',
        barcode: 'Barcode',
        remarks: 'Remarks',
      }
      
      // Add headers for all selected fields
      itemFields.forEach(fieldKey => {
        if (fieldLabels[fieldKey]) {
          html += `<th>${fieldLabels[fieldKey]}</th>`
        }
      })
      html += `</tr>`
      
      // Add data rows
      items.forEach(item => {
        html += `<tr>`
        itemFields.forEach(fieldKey => {
          let cellValue = ''
          switch (fieldKey) {
            case 'itemCode':
              cellValue = item.itemCode
              break
            case 'name':
              cellValue = item.name
              break
            case 'description':
              cellValue = item.description || ''
              break
            case 'category':
              cellValue = item.category || ''
              break
            case 'unit':
              cellValue = item.unit || ''
              break
            case 'currentStock':
              cellValue = Math.floor(parseFloat(item.currentStock.toString())).toString()
              break
            case 'minStockLevel':
              cellValue = item.minStockLevel ? Math.floor(parseFloat(item.minStockLevel.toString())).toString() : ''
              break
            case 'maxStockLevel':
              cellValue = item.maxStockLevel ? Math.floor(parseFloat(item.maxStockLevel.toString())).toString() : ''
              break
            case 'unitCost':
              cellValue = item.unitCost ? `₱${formatNumber(parseFloat(item.unitCost.toString()))}` : ''
              break
            case 'location':
              cellValue = item.location || ''
              break
            case 'supplier':
              cellValue = item.supplier || ''
              break
            case 'brand':
              cellValue = item.brand || ''
              break
            case 'model':
              cellValue = item.model || ''
              break
            case 'sku':
              cellValue = item.sku || ''
              break
            case 'barcode':
              cellValue = item.barcode || ''
              break
            case 'remarks':
              cellValue = item.remarks || ''
              break
            default:
              cellValue = ''
          }
          html += `<td>${cellValue}</td>`
        })
        html += `</tr>`
      })
      html += `</table>`
    }

    html += `</body></html>`
    return html
  }, [])

  // Helper functions for FastAPI integration
  const getApiBaseUrl = useCallback(() => {
    const useFastAPI = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true'
    const fastApiUrl = process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000'
    return useFastAPI ? fastApiUrl : ''
  }, [])

  const getAuthToken = useCallback(async (): Promise<string | null> => {
    try {
      const { createClient } = await import('@/lib/supabase-client')
      const supabase = createClient()
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) {
        console.error('Failed to get auth token:', error)
        return null
      }
      if (!session?.access_token) {
        console.warn('No active session found')
        return null
      }
      return session.access_token
    } catch (error) {
      console.error('Failed to get auth token:', error)
      return null
    }
  }, [])

  // PDF Export handler - using FastAPI endpoint with same pattern as reports
  const handlePDFExport = useCallback(async () => {
    // Use FastAPI base URL
    const baseUrl = getApiBaseUrl()
    
    // Build query params
    const params = new URLSearchParams()
    params.set('format', 'pdf')
    if (searchQuery) params.set('search', searchQuery)
    if (categoryFilter && categoryFilter !== 'all') params.set('category', categoryFilter)
    if (lowStockFilter) params.set('lowStock', 'true')
    if (selectedSummaryFields.has('summary')) params.set('includeSummary', 'true')
    if (selectedSummaryFields.has('byCategory')) params.set('includeByCategory', 'true')
    if (selectedSummaryFields.has('byStatus')) params.set('includeByStatus', 'true')
    if (selectedSummaryFields.has('totalCost')) params.set('includeTotalCost', 'true')
    if (selectedSummaryFields.has('lowStock')) params.set('includeLowStock', 'true')
    if (selectedExportFields.size > 0) {
      params.set('includeItemList', 'true')
      params.set('itemFields', Array.from(selectedExportFields).join(','))
    }
    
    const url = `${baseUrl}/api/inventory/export?${params.toString()}`
    
    // Get auth token
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
    a.download = `inventory-report-${new Date().toISOString().split('T')[0]}.pdf`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(downloadUrl)
    document.body.removeChild(a)

    toast.success('PDF exported successfully')
  }, [searchQuery, categoryFilter, lowStockFilter, selectedSummaryFields, selectedExportFields, getApiBaseUrl, getAuthToken])

  // Export inventory hook
  const exportMutation = useExportInventory()

  // Export inventory items to Excel or PDF
  const handleExport = useCallback(async () => {
    if (selectedExportFields.size === 0 && selectedSummaryFields.size === 0) {
      toast.error('Please select at least one field to export')
      return
    }

    setIsExporting(true)
    try {
      if (exportFormat === 'pdf') {
        // Handle PDF export using FastAPI endpoint
        await handlePDFExport()
      } else {
        // Handle Excel export via hook
        const blob = await exportMutation.mutateAsync({
          format: 'excel',
          search: searchQuery || undefined,
          category: categoryFilter && categoryFilter !== 'all' ? categoryFilter : undefined,
          lowStock: lowStockFilter || undefined,
          includeSummary: selectedSummaryFields.has('summary'),
          includeByCategory: selectedSummaryFields.has('byCategory'),
          includeByStatus: selectedSummaryFields.has('byStatus'),
          includeTotalCost: selectedSummaryFields.has('totalCost'),
          includeLowStock: selectedSummaryFields.has('lowStock'),
          includeItemList: selectedExportFields.size > 0,
          itemFields: selectedExportFields.size > 0 ? Array.from(selectedExportFields) : undefined,
        })

        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `inventory-export-${new Date().toISOString().split('T')[0]}.xlsx`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)

        toast.success('Inventory exported successfully')
      }
      
      setIsExportDialogOpen(false)
    } catch (error) {
      console.error('Export error:', error)
      toast.error(`Failed to export inventory items as ${exportFormat.toUpperCase()}`)
    } finally {
      setIsExporting(false)
    }
  }, [selectedExportFields, selectedSummaryFields, exportFormat, searchQuery, categoryFilter, lowStockFilter, handlePDFExport, exportMutation])

  const handleExportClick = useCallback((format: 'excel' | 'pdf' = 'excel') => {
    if (!data?.items || data.items.length === 0) {
      toast.error('No items to export')
      return
    }
    setExportFormat(format)
    setIsExportDialogOpen(true)
  }, [data?.items])

  const handleExportFieldToggle = useCallback((fieldKey: string) => {
    setSelectedExportFields(prev => {
      const newSet = new Set(prev)
      if (newSet.has(fieldKey)) {
        newSet.delete(fieldKey)
      } else {
        newSet.add(fieldKey)
      }
      return newSet
    })
  }, [])

  const handleSelectAllExportFields = useCallback(() => {
    setSelectedExportFields(new Set(exportFields.map(f => f.key)))
  }, [exportFields])

  const handleDeselectAllExportFields = useCallback(() => {
    setSelectedExportFields(new Set())
  }, [])

  const handleSummaryFieldToggle = useCallback((fieldKey: string) => {
    setSelectedSummaryFields(prev => {
      const newSet = new Set(prev)
      if (newSet.has(fieldKey)) {
        newSet.delete(fieldKey)
      } else {
        newSet.add(fieldKey)
      }
      return newSet
    })
  }, [])

  const handleSelectAllSummaryFields = useCallback(() => {
    setSelectedSummaryFields(new Set(summaryFields.map(f => f.key)))
  }, [summaryFields])

  const handleDeselectAllSummaryFields = useCallback(() => {
    setSelectedSummaryFields(new Set())
  }, [])

  // Download template with sample data
  const handleDownloadTemplate = useCallback(() => {
    const templateData = [
      {
        'Item Code': 'INV-001-SA',
        'Name': 'Sample Item 1',
        'Description': 'Sample description',
        'Category': 'Consumables',
        'Unit': 'pcs',
        'Current Stock': 100,
        'Min Stock Level': 10,
        'Max Stock Level': 500,
        'Unit Cost': 50.00,
        'Location': 'Warehouse A',
        'Supplier': 'Supplier Name',
        'Brand': 'Brand Name',
        'Model': 'Model XYZ',
        'SKU': 'SKU-001',
        'Barcode': '1234567890123',
        'Remarks': 'Sample remarks',
      },
      {
        'Item Code': 'INV-002-SA',
        'Name': 'Sample Item 2',
        'Description': '',
        'Category': 'Spare Parts',
        'Unit': 'boxes',
        'Current Stock': 50,
        'Min Stock Level': 5,
        'Max Stock Level': 200,
        'Unit Cost': 125.00,
        'Location': '',
        'Supplier': '',
        'Brand': '',
        'Model': '',
        'SKU': '',
        'Barcode': '',
        'Remarks': '',
      },
    ]

    const worksheet = XLSX.utils.json_to_sheet(templateData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory Items')
    
    XLSX.writeFile(workbook, 'inventory-import-template.xlsx')
    toast.success('Template downloaded successfully')
  }, [])

  // Check which item codes already exist (batch check including soft-deleted items)
  const checkItemCodesExist = async (itemCodes: string[], token: string | null): Promise<Set<string>> => {
    try {
      if (itemCodes.length === 0) return new Set()
      
      const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
        ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
        : ''
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(`${baseUrl}/api/inventory/check-codes`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ itemCodes }),
      })
      
      if (!response.ok) {
        console.error('Failed to check item codes')
        return new Set()
      }
      
      const data = await response.json()
      return new Set(data.existingCodes || [])
    } catch (error) {
      console.error('Error checking item codes:', error)
      return new Set()
    }
  }

  // Generate new item code
  const generateNewItemCode = async (): Promise<string> => {
    try {
      // Use FastAPI if enabled
      const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
        ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
        : ''
      const url = `${baseUrl}/api/inventory/generate-code`
      
      // Get auth token
      const { createClient } = await import('@/lib/supabase-client')
      const supabase = createClient()
      const { data: sessionData } = await supabase.auth.getSession()
      const headers: HeadersInit = {}
      if (sessionData?.session?.access_token) {
        headers['Authorization'] = `Bearer ${sessionData.session.access_token}`
      }
      
      const response = await fetch(url, { headers })
      if (!response.ok) throw new Error('Failed to generate item code')
      const data = await response.json()
      return data.itemCode
    } catch (error) {
      console.error('Error generating item code:', error)
      throw error
    }
  }

  // Import inventory items from Excel
  const handleImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const createItem = async (itemData: {
      itemCode: string
      name: string
      description?: string | null
      category?: string | null
      unit?: string | null
      currentStock?: number
      minStockLevel?: number | null
      maxStockLevel?: number | null
      unitCost?: number | null
      location?: string | null
      supplier?: string | null
      brand?: string | null
      model?: string | null
      sku?: string | null
      barcode?: string | null
      remarks?: string | null
    }) => {
      const baseUrl = getApiBaseUrl()
      const token = await getAuthToken()
      const headers: HeadersInit = { 
        "Content-Type": "application/json",
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(`${baseUrl}/api/inventory`, {
        method: "POST",
        headers,
        credentials: 'include',
        body: JSON.stringify(itemData),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || error.error || "Failed to create inventory item")
      }
      return response.json()
    }
    const file = event.target.files?.[0]
    if (!file) return

    if (!canManageImport) {
      toast.error('You do not have permission to import inventory items')
      event.target.value = ''
      return
    }

    setIsImporting(true)
    try {
      const fileData = await file.arrayBuffer()
      const workbook = XLSX.read(fileData)
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(sheet) as Record<string, string | number | null | undefined>[]

      if (jsonData.length === 0) {
        toast.error('No data found in the file')
        return
      }

      // Helper function to safely parse numbers
      const parseNumber = (value: string | number | null | undefined): number | null => {
        if (value === null || value === undefined || value === '') return null
        if (typeof value === 'string') {
          const cleaned = value.replace(/,/g, '').trim()
          if (cleaned === '') return null
          const num = parseFloat(cleaned)
          return isNaN(num) ? null : num
        }
        const num = Number(value)
        return isNaN(num) ? null : num
      }

      // Process imported data and collect validation errors
      const validationErrors: string[] = []
      const itemsToImport = jsonData.map((row, index) => {
        const itemCode = row['Item Code']?.toString().trim() || ''
        const name = row['Name']?.toString().trim() || ''

        if (!name) {
          validationErrors.push(`Row ${index + 2}: Name is required`)
          return null // Return null for invalid rows
        }

        return {
          itemCode, // Will be checked and regenerated if needed
          name,
          description: row['Description']?.toString().trim() || null,
          category: row['Category']?.toString().trim() || null,
          unit: row['Unit']?.toString().trim() || null,
          currentStock: parseNumber(row['Current Stock']) || 0,
          minStockLevel: parseNumber(row['Min Stock Level']),
          maxStockLevel: parseNumber(row['Max Stock Level']),
          unitCost: parseNumber(row['Unit Cost']),
          location: row['Location']?.toString().trim() || null,
          supplier: row['Supplier']?.toString().trim() || null,
          brand: row['Brand']?.toString().trim() || null,
          model: row['Model']?.toString().trim() || null,
          sku: row['SKU']?.toString().trim() || null,
          barcode: row['Barcode']?.toString().trim() || null,
          remarks: row['Remarks']?.toString().trim() || null,
        }
      }).filter((item): item is NonNullable<typeof item> => item !== null) // Filter out null values

      // If there are validation errors, show them and stop import
      if (validationErrors.length > 0) {
        const errorMessage = validationErrors.length === 1 
          ? `${validationErrors[0]}. Please check the sample template for the correct format.`
          : `${validationErrors.length} validation errors found:\n${validationErrors.slice(0, 5).join('\n')}${validationErrors.length > 5 ? `\n... and ${validationErrors.length - 5} more` : ''}\n\nPlease check the sample template for the correct format.`
        toast.error(errorMessage)
        return
      }

      // Get auth token for API calls
      const token = await getAuthToken()

      // Batch check all item codes that are provided (single API call instead of multiple)
      const itemCodesFromImport = itemsToImport
        .map(item => item.itemCode)
        .filter((code): code is string => !!code && code.length > 0)
      
      const existingCodes = await checkItemCodesExist(itemCodesFromImport, token)

      // Import items via API
      let successCount = 0
      let skippedCount = 0
      let errorCount = 0
      const totalItems = itemsToImport.length
      
      // Create a loading toast with progress
      const toastId = toast.loading(`Importing items... 0/${totalItems} (0%)`, {
        duration: Infinity,
      })

      for (let i = 0; i < itemsToImport.length; i++) {
        const item = itemsToImport[i]
        const processed = i + 1
        const percentage = Math.round((processed / totalItems) * 100)
        
        // Update toast with progress
        toast.loading(`Importing items... ${processed}/${totalItems} (${percentage}%)`, {
          id: toastId,
          duration: Infinity,
        })
        
        try {
          let finalItemCode = item.itemCode

          // If item code is provided, check if it exists using pre-fetched data
          if (finalItemCode) {
            if (existingCodes.has(finalItemCode)) {
              // Skip this item if code already exists (even if soft-deleted)
              skippedCount++
              continue
            }
          } else {
            // If no item code provided, generate one
            finalItemCode = await generateNewItemCode()
          }

          // Create item with final item code
          await createItem({
            itemCode: finalItemCode,
            name: item.name,
            description: item.description,
            category: item.category,
            unit: item.unit,
            currentStock: item.currentStock,
            minStockLevel: item.minStockLevel,
            maxStockLevel: item.maxStockLevel,
            unitCost: item.unitCost,
            location: item.location,
            supplier: item.supplier,
            brand: item.brand,
            model: item.model,
            sku: item.sku,
            barcode: item.barcode,
            remarks: item.remarks,
          })
          successCount++
        } catch (error) {
          // Don't log validation or format errors to console
          const errorMessage = error instanceof Error ? error.message : String(error)
          // Only count as error if it's not an "already exists" error (which is handled as skipped)
          if (!errorMessage.includes('already exists')) {
            errorCount++
          }
        }
      }
      
      // Dismiss the loading toast
      toast.dismiss(toastId)

      // Refresh the inventory list
      queryClient.invalidateQueries({ queryKey: ['inventory'] })

      let message = `Successfully imported ${successCount} items`
      if (skippedCount > 0) {
        message += `. ${skippedCount} item(s) skipped (item code already exists).`
      }
      
      if (errorCount === 0) {
        toast.success(message)
      } else {
        toast.warning(`${message} ${errorCount} item(s) failed to import.`)
      }
    } catch (error) {
      // Don't log to console, just show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Failed to import inventory items'
      toast.error(errorMessage)
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [canManageImport, queryClient])

  const columns = useMemo(
    () => createColumns(handleEdit, handleDelete, handleAddTransaction, handleViewTransactions),
    [handleEdit, handleDelete, handleAddTransaction, handleViewTransactions]
  )

  const items = useMemo(() => data?.items || [], [data?.items])
  const pagination = data?.pagination

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnVisibility,
    },
  })

  // Update toggleColumn to use table columns
  const toggleColumn = useCallback((columnKey: string) => {
    // Don't allow toggling Actions column (always visible)
    if (columnKey === 'actions') {
      return
    }
    
    if (columnKey === 'select-all') {
      const newVisibility: VisibilityState = {}
      ALL_COLUMNS.forEach(col => {
        // Skip Actions as it's always visible
        if (col.key && col.key !== 'actions') {
          newVisibility[col.key] = true
        }
      })
      setColumnVisibility(prev => ({ ...prev, ...newVisibility }))
      setShouldCloseSelect(true)
      return
    }
    if (columnKey === 'deselect-all') {
      const newVisibility: VisibilityState = {}
      ALL_COLUMNS.forEach(col => {
        // Skip Actions as it's always visible
        if (col.key && col.key !== 'actions') {
          newVisibility[col.key] = false
        }
      })
      setColumnVisibility(prev => ({ ...prev, ...newVisibility }))
      setShouldCloseSelect(true)
      return
    }
    table.getColumn(columnKey)?.toggleVisibility()
    setShouldCloseSelect(false)
  }, [table])

  // Set mobile dock content
  useEffect(() => {
    if (isMobile) {
      setDockContent(
        <>
          <Button 
            onClick={handleAdd}
            variant="outline"
            size="lg"
            className="rounded-full btn-glass-elevated"
          >
            Add Item
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-full btn-glass-elevated h-10 w-10">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger disabled={!data?.items || data.items.length === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => handleExportClick('excel')} disabled={!data?.items || data.items.length === 0}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportClick('pdf')} disabled={!data?.items || data.items.length === 0}>
                    <FileText className="mr-2 h-4 w-4" />
                    PDF
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onClick={handleDownloadTemplate}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Download Template
              </DropdownMenuItem>
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => {
                    if (!canManageImport) {
                      toast.error('You do not have permission to import inventory items')
                      return
                    }
                    fileInputRef.current?.click()
                  }}
                  disabled={isImporting}
                >
                  {isImporting ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Import from Excel
                    </>
                  )}
                </DropdownMenuItem>
              </>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/inventory/trash')}>
                <Trash2 className="mr-2 h-4 w-4" />
                Recently Deleted
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )
    } else {
      setDockContent(null)
    }
    
    return () => {
      setDockContent(null)
    }
  }, [isMobile, setDockContent, handleAdd, handleExportClick, handleDownloadTemplate, canManageImport, isImporting, data?.items, router, fileInputRef])

  // Set mobile pagination content
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
              disabled={!pagination?.hasPreviousPage || isLoading}
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
                if (pagination?.hasNextPage) {
                  handlePageChange(page + 1)
                }
              }}
              disabled={!pagination?.hasNextPage || isLoading}
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
  }, [isMobile, setPaginationContent, pagination, page, pageSize, isLoading, handlePageChange, handlePageSizeChange])

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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Inventory</h1>
          <p className="text-muted-foreground">
            Manage stock-type items (consumables, spare parts)
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <Button 
            onClick={handleAdd}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger disabled={!data?.items || data.items.length === 0}>
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => handleExportClick('excel')} disabled={!data?.items || data.items.length === 0}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportClick('pdf')} disabled={!data?.items || data.items.length === 0}>
                    <FileText className="mr-2 h-4 w-4" />
                    PDF
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onClick={handleDownloadTemplate}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Download Template
              </DropdownMenuItem>
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => {
                    if (!canManageImport) {
                      toast.error('You do not have permission to import inventory items')
                      return
                    }
                    fileInputRef.current?.click()
                  }}
                  disabled={isImporting}
                >
                  {isImporting ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Import from Excel
                    </>
                  )}
                </DropdownMenuItem>
              </>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/inventory/trash')}>
                <Trash2 className="mr-2 h-4 w-4" />
                Recently Deleted
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleImport}
            className="hidden"
          />
        </div>
      </div>

      <Card className="relative flex flex-col flex-1 min-h-0 pb-0 gap-0">
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            {/* Search - always on top, full width on mobile/tablet, constrained on lg */}
            <div className="flex items-center w-full lg:flex-1 lg:max-w-md border rounded-md overflow-hidden">
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
            {/* Filters and buttons - wrap on md, single line on lg */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap md:justify-between lg:flex-nowrap items-stretch sm:items-center gap-2">
              {/* First row on sm: Category + Low Stock */}
              <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                <Select 
                  value={categoryFilter} 
                  onValueChange={(value) => updateURL({ category: value, page: 1 })}
                >
                  <SelectTrigger className="w-full sm:w-[180px] h-8" size='sm'>
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
                  className="h-8 flex-1 sm:flex-initial bg-transparent dark:bg-input/30"
                >
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Low Stock
                </Button>
              </div>
              {/* Second row on sm: Column selection + Refresh */}
              <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                <Select 
                  open={isSelectOpen} 
                  onOpenChange={handleSelectOpenChange}
                  value=""
                  onValueChange={(value) => {
                    toggleColumn(value)
                  }}
                >
                  <SelectTrigger className="w-full sm:w-[200px] h-8" size='sm'>
                    <span className="flex-1 text-left truncate">
                      {visibleColumns.length > 0 
                        ? `${visibleColumns.length} column${visibleColumns.length !== 1 ? 's' : ''} selected`
                        : 'Select columns'
                      }
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value={allSelected ? 'deselect-all' : 'select-all'}
                      className="font-semibold border-b"
                    >
                      {allSelected ? 'Deselect All' : 'Select All'}
                    </SelectItem>
                    {ALL_COLUMNS.map((column) => {
                      const isAlwaysVisible = column.key === 'actions'
                      const isVisible = visibleColumns.includes(column.key)
                      
                      return (
                        <SelectItem
                          key={column.key}
                          value={column.key}
                          disabled={isAlwaysVisible}
                        >
                          <div className="flex items-center gap-2">
                            <Checkbox checked={isVisible} disabled={isAlwaysVisible} className={isAlwaysVisible ? 'opacity-50' : ''} />
                            <span>
                              {column.label}
                              {isAlwaysVisible && ' (Always visible)'}
                            </span>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setIsManualRefresh(true)
                    queryClient.invalidateQueries({ queryKey: ['inventory'] })
                  }}
                  className="h-8 w-8 shrink-0 bg-transparent dark:bg-input/30"
                  title="Refresh table"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 px-0 relative">
          {isFetching && data && (
            <div className={cn("absolute left-0 right-[10px] top-[33px] bottom-0 bg-background/50 backdrop-blur-sm z-20 flex items-center justify-center", isMobile && "right-0 rounded-b-2xl")}>
              <Spinner variant="default" size={24} className="text-muted-foreground" />
            </div>
          )}
          <div className={cn("h-140 pt-6", isMobile && "max-h-120")}>
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
                <ScrollArea className={cn('h-132 relative', isMobile && "max-h-[456px]")}>
                <div className="sticky top-0 z-30 h-px bg-border w-full"></div>
                <div className="pr-2.5 relative after:content-[''] after:absolute after:right-[10px] after:top-0 after:bottom-0 after:w-px after:bg-border after:z-50 after:h-full">
                <Table>
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
                                    isActionsColumn && "sticky text-center right-0 bg-card z-10 before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border before:z-50 rounded-br-2xl",
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
      <InventoryItemDialog
        open={isAddDialogOpen || isEditDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false)
            setIsEditDialogOpen(false)
            setSelectedItem(null)
          }
        }}
        onSave={(data) => {
          if (isEditDialogOpen && selectedItem) {
            updateMutation.mutate({ 
              id: selectedItem.id, 
              itemCode: data.itemCode || selectedItem.itemCode,
              name: data.name || selectedItem.name,
              ...data 
            })
          } else {
            if (!data.itemCode || !data.name) {
              toast.error('Item code and name are required')
              return
            }
            createMutation.mutate(data as { itemCode: string; name: string; [key: string]: unknown })
          }
        }}
        item={selectedItem as InventoryItemType | null}
        isEdit={isEditDialogOpen}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={() => {
          if (selectedItem) {
            deleteMutation.mutate({ id: selectedItem.id, permanent: false })
          }
        }}
        itemName={selectedItem?.itemCode || ''}
        isLoading={deleteMutation.isPending}
        title={selectedItem ? `Move ${selectedItem.itemCode} to Trash?` : 'Move to Trash?'}
        description="This item will be moved to Trash and can be restored later if needed."
        confirmLabel="Move to Trash"
        loadingLabel="Moving to Trash..."
      />

      {/* Add Transaction Dialog */}
      <InventoryTransactionDialog
        open={isTransactionDialogOpen}
        onOpenChange={setIsTransactionDialogOpen}
        onSubmit={(data) => {
          if (selectedItem) {
            createTransactionMutation.mutate({ itemId: selectedItem.id, data })
          }
        }}
        item={selectedItem ? {
          id: selectedItem.id,
          name: selectedItem.name,
          currentStock: selectedItem.currentStock,
          unit: selectedItem.unit,
          unitCost: selectedItem.unitCost,
        } : null}
        isLoading={createTransactionMutation.isPending}
      />


      {/* Export Fields Dialog */}
      <ExportFieldsDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        fields={exportFields}
        selectedFields={selectedExportFields}
        onFieldToggle={handleExportFieldToggle}
        onSelectAll={handleSelectAllExportFields}
        onDeselectAll={handleDeselectAllExportFields}
        onExport={handleExport}
        title={`Select Fields to Export (${exportFormat.toUpperCase()})`}
        description="Choose which fields to include in your export file"
        exportButtonLabel={`Export to ${exportFormat.toUpperCase()}`}
        isExporting={isExporting}
        summaryFields={summaryFields}
        selectedSummaryFields={selectedSummaryFields}
        onSummaryFieldToggle={handleSummaryFieldToggle}
        onSelectAllSummary={handleSelectAllSummaryFields}
        onDeselectAllSummary={handleDeselectAllSummaryFields}
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

