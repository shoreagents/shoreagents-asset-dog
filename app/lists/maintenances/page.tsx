'use client'

import { useQuery } from '@tanstack/react-query'
import { useState, useMemo, useCallback, useEffect, useRef, useTransition, Suspense } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, ArrowUpDown, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Package, Edit2, X, RefreshCw, Trash2, ChevronDown } from 'lucide-react'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldLabel, FieldContent } from '@/components/ui/field'
import { DatePicker } from '@/components/ui/date-picker'
import { Badge } from '@/components/ui/badge'
import { useQueryClient } from '@tanstack/react-query'
import { useUpdateMaintenance, useDeleteMaintenance } from '@/hooks/use-assets'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { useMobileDock } from '@/components/mobile-dock-provider'
import { useMobilePagination } from '@/components/mobile-pagination-provider'
import { useIsMobile } from '@/hooks/use-mobile'
import Link from 'next/link'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { DeleteConfirmationDialog } from '@/components/dialogs/delete-confirmation-dialog'

interface PaginationInfo {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

interface MaintenanceRecord {
  id: string
  assetId: string
  title: string
  details: string | null
  status: string
  dueDate: string | null
  dateCompleted: string | null
  dateCancelled: string | null
  maintenanceBy: string | null
  cost: number | null
  isRepeating: boolean
  createdAt: string
  updatedAt: string
  asset: {
    id: string
    assetTagId: string
    description: string | null
    category: {
      id: string
      name: string
    } | null
    subCategory: {
      id: string
      name: string
    } | null
  }
  inventoryItems: Array<{
    id: string
    quantity: number
    unitCost: number | null
    inventoryItem: {
      id: string
      itemCode: string
      name: string
      unit: string | null
      unitCost: number | null
    }
  }>
}

async function fetchMaintenances(search?: string, page: number = 1, pageSize: number = 50, searchFields?: string): Promise<{ maintenances: MaintenanceRecord[], pagination: PaginationInfo }> {
  const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
    ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
    : ''
  
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
  })
  if (search) {
    params.append('search', search)
  }
  if (searchFields) {
    params.append('searchFields', searchFields)
  }
  
  // Get auth token
  const { createClient } = await import('@/lib/supabase-client')
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const headers: HeadersInit = {}
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }
  
  const response = await fetch(`${baseUrl}/api/assets/maintenance?${params.toString()}`, {
    credentials: 'include',
    headers,
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    let errorMessage = 'Failed to fetch maintenances'
    try {
      const errorData = JSON.parse(errorText)
      errorMessage = errorData.detail || errorData.error || errorMessage
    } catch {
      errorMessage = errorText || errorMessage
    }
    throw new Error(errorMessage)
  }
  
  const data = await response.json()
  return { maintenances: data.maintenances, pagination: data.pagination }
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-'
  try {
    return new Date(dateString).toLocaleDateString()
  } catch {
    return dateString
  }
}

const formatCurrency = (value: number | null) => {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(Number(value))
}


type MaintenanceStatus = "Scheduled" | "In progress" | "Completed" | "Cancelled" | ""

const ALL_COLUMNS = [
  { key: 'assetTag', label: 'Asset Tag ID' },
  { key: 'description', label: 'Description' },
  { key: 'title', label: 'Title' },
  { key: 'status', label: 'Status' },
  { key: 'dueDate', label: 'Due Date' },
  { key: 'dateCompleted', label: 'Date Completed' },
  { key: 'maintenanceBy', label: 'Maintenance By' },
  { key: 'cost', label: 'Cost' },
  { key: 'inventoryItems', label: 'Inventory Items' },
  { key: 'actions', label: 'Actions' },
]

// Mapping from column keys to API search field names
const COLUMN_TO_SEARCH_FIELD: Record<string, string[]> = {
  'assetTag': ['asset.assetTagId'],
  'description': ['asset.description'],
  'title': ['title'],
  'status': ['status'],
  'maintenanceBy': ['maintenanceBy'],
  'cost': ['cost'],
}

// Create column definitions for TanStack Table
// Create columns for maintenance records
const createMaintenanceColumns = (
  onEditMaintenance?: (maintenance: { id: string; status: string; dateCompleted?: string | null; dateCancelled?: string | null }) => void,
  canManageMaintenance?: boolean,
  onDeleteMaintenance?: (id: string) => void
): ColumnDef<MaintenanceRecord>[] => [
  {
    accessorKey: 'asset.assetTagId',
    id: 'assetTag',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Asset Tag ID
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
    cell: ({ row }) => <div className="font-medium">{row.original.asset.assetTagId}</div>,
    enableSorting: true,
  },
  {
    accessorKey: 'asset.description',
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
    cell: ({ row }) => <div className="max-w-[300px] truncate">{row.original.asset.description || '-'}</div>,
    enableSorting: true,
  },
  {
    accessorKey: 'title',
    id: 'title',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Title
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
    cell: ({ row }) => <div>{row.original.title}</div>,
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
    cell: ({ row }) => {
      const status = row.original.status
      return (
        <Badge className={cn("text-xs text-white border-0", 
          status === 'Completed' ? 'bg-green-500' :
          status === 'In progress' ? 'bg-blue-500' :
          status === 'Scheduled' ? 'bg-yellow-500' :
          status === 'Cancelled' ? 'bg-red-500' :
          'bg-gray-500'
        )}>
          {status}
        </Badge>
      )
    },
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const statusA = rowA.original.status
      const statusB = rowB.original.status
      
      // Priority order: Scheduled (1), In progress (2), then others alphabetically
      const getStatusPriority = (status: string): number => {
        if (status === 'Scheduled') return 1
        if (status === 'In progress') return 2
        return 3
      }
      
      const priorityA = getStatusPriority(statusA)
      const priorityB = getStatusPriority(statusB)
      
      // If priorities are different, sort by priority
      if (priorityA !== priorityB) {
        return priorityA - priorityB
      }
      
      // If same priority, sort by dueDate (earlier dates first)
      const dueDateA = rowA.original.dueDate ? new Date(rowA.original.dueDate).getTime() : Number.MAX_SAFE_INTEGER
      const dueDateB = rowB.original.dueDate ? new Date(rowB.original.dueDate).getTime() : Number.MAX_SAFE_INTEGER
      
      if (dueDateA !== dueDateB) {
        return dueDateA - dueDateB
      }
      
      // If same dueDate, sort alphabetically by status
      return statusA.localeCompare(statusB)
    },
  },
  {
    accessorKey: 'dueDate',
    id: 'dueDate',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Due Date
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
    cell: ({ row }) => formatDate(row.original.dueDate),
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.dueDate ? new Date(rowA.original.dueDate).getTime() : 0
      const b = rowB.original.dueDate ? new Date(rowB.original.dueDate).getTime() : 0
      return a - b
    },
  },
  {
    accessorKey: 'dateCompleted',
    id: 'dateCompleted',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Date Completed
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
    cell: ({ row }) => formatDate(row.original.dateCompleted),
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.dateCompleted ? new Date(rowA.original.dateCompleted).getTime() : 0
      const b = rowB.original.dateCompleted ? new Date(rowB.original.dateCompleted).getTime() : 0
      return a - b
    },
  },
  {
    accessorKey: 'maintenanceBy',
    id: 'maintenanceBy',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Maintenance By
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
    cell: ({ row }) => <div>{row.original.maintenanceBy || '-'}</div>,
    enableSorting: true,
  },
  {
    accessorKey: 'cost',
    id: 'cost',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Cost
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
      const cost = row.original.cost
      return <div>{cost ? formatCurrency(cost) : '-'}</div>
    },
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.cost ?? 0
      const b = rowB.original.cost ?? 0
      return a - b
    },
  },
  {
    accessorFn: (row) => row.inventoryItems?.length || 0,
    id: 'inventoryItems',
    header: () => {
      return (
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span>Inventory Items</span>
        </div>
      )
    },
    cell: ({ row }) => {
      const inventoryItems = row.original.inventoryItems || []
      if (inventoryItems.length === 0) {
        return <div className="text-muted-foreground">-</div>
      }
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {inventoryItems.length} {inventoryItems.length === 1 ? 'item' : 'items'}
                  <ChevronDown className="h-3 w-3" />
                </Badge>
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-semibold text-sm">Inventory Items Used</h4>
              </div>
              <Separator />
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {inventoryItems.map((item, index) => (
                  <div key={item.id}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{item.inventoryItem.itemCode}</div>
                        <div className="text-xs text-muted-foreground">{item.inventoryItem.name}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {item.quantity} {item.inventoryItem.unit || 'units'}
                        </div>
                        {item.unitCost && (
                          <div className="text-xs text-muted-foreground">
                            ₱{new Intl.NumberFormat('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }).format(item.unitCost)} each
                          </div>
                        )}
                      </div>
                    </div>
                    {index < inventoryItems.length - 1 && <Separator className="my-2" />}
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )
    },
    enableSorting: false,
  },
  {
    id: 'actions',
    header: () => <div className="text-center">Actions</div>,
    cell: ({ row }) => {
      const maintenance = row.original
      const isReadOnly = maintenance.status === 'Completed' || maintenance.status === 'Cancelled'
      
      return (
        <div className="flex items-center justify-center gap-1">
          {!isReadOnly && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 p-0 rounded-full"
              onClick={() => {
                if (!canManageMaintenance) {
                  toast.error('You do not have permission to take actions')
                  return
                }
                onEditMaintenance?.({
                  id: maintenance.id,
                  status: maintenance.status,
                  dateCompleted: maintenance.dateCompleted,
                  dateCancelled: maintenance.dateCancelled,
                })
              }}
              title="Edit"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 p-0 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => {
              if (!canManageMaintenance) {
                toast.error('You do not have permission to delete maintenance records')
                return
              }
              onDeleteMaintenance?.(maintenance.id)
            }}
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    },
    enableSorting: false,
    enableHiding: false,
  },
]
    
function ListOfMaintenancesPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const isMobile = useIsMobile()
  const { setDockContent } = useMobileDock()
  const { setPaginationContent } = useMobilePagination()
  
  const canManageMaintenance = hasPermission('canManageMaintenance')
  
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'status', desc: false }
  ])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    assetTag: true,
    description: false,
    category: true,
    subCategory: true,
    status: true,
    location: true,
    issuedTo: false,
    brand: false,
    model: false,
    cost: false,
    purchaseDate: false,
    purchasedFrom: false,
    serialNo: false,
    additionalInformation: false,
    xeroAssetNo: false,
    owner: false,
    pbiNumber: false,
    poNumber: false,
    paymentVoucherNumber: false,
    assetType: false,
    deliveryDate: false,
    unaccountedInventory: false,
    remarks: false,
    qr: false,
    oldAssetTag: false,
    depreciableAsset: false,
    depreciableCost: false,
    salvageValue: false,
    assetLifeMonths: false,
    depreciationMethod: false,
    dateAcquired: false,
    department: false,
    site: false,
    checkoutDate: false,
    expectedReturnDate: false,
    lastAuditDate: false,
    lastAuditType: false,
    lastAuditor: false,
    auditCount: false,
    maintenanceTitle: true,
    maintenanceStatus: true,
    maintenanceBy: true,
    maintenanceDueDate: true,
    maintenanceCost: false,
    maintenanceInventoryItems: true,
    maintenanceTimeAgo: false,
    images: false,
  })
  const [isSelectOpen, setIsSelectOpen] = useState(false)
  const [shouldCloseSelect, setShouldCloseSelect] = useState(false)
  const [isManualRefresh, setIsManualRefresh] = useState(false)
  const [, startTransition] = useTransition()
  const isInitialMount = useRef(true)
  
  // Edit maintenance dialog state
  const [editingMaintenance, setEditingMaintenance] = useState<{
    id: string
    status: string
    dateCompleted?: string | null
    dateCancelled?: string | null
  } | null>(null)
  const [editStatus, setEditStatus] = useState<MaintenanceStatus>("")
  const [editDateCompleted, setEditDateCompleted] = useState<string>("")
  const [editDateCancelled, setEditDateCancelled] = useState<string>("")
  
  // Delete maintenance dialog state
  const [deletingMaintenanceId, setDeletingMaintenanceId] = useState<string | null>(null)
  
  const queryClient = useQueryClient()
  
  // Get page, pageSize, and search from URL
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)
  
  // Separate states for search input (immediate UI) and search query (debounced API calls)
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '')
  const [searchType, setSearchType] = useState<string>(
    searchParams.get('searchType') || 'unified'
  )
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSearchQueryRef = useRef<string>(searchParams.get('search') || '')
  const previousSearchInputRef = useRef<string>(searchParams.get('search') || '')
  
  // Convert column visibility to visible columns array for compatibility
  const visibleColumns = useMemo(() => {
    return Object.entries(columnVisibility)
      .filter(([, visible]) => visible)
      .map(([key]) => key)
      .filter(key => key !== 'actions') // Exclude Actions from count
  }, [columnVisibility])

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
      // Reset to page 1 when pageSize changes
      params.delete('page')
    }
    
    if (updates.search !== undefined) {
      if (updates.search === '') {
        params.delete('search')
        // Preserve searchType when clearing search - don't delete it
      } else {
        params.set('search', updates.search)
      }
      // Reset to page 1 when search changes
      params.delete('page')
    }

    if (updates.searchType !== undefined) {
      if (updates.searchType === 'unified') {
        params.delete('searchType')
      } else {
        params.set('searchType', updates.searchType)
      }
      // Reset to page 1 when searchType changes
      params.delete('page')
    }
    
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false })
    })
  }, [searchParams, router, startTransition])

  // Get search fields based on visible columns and searchType
  const searchFields = useMemo(() => {
    if (searchType === 'unified') {
      // Unified search: search in all visible columns
      const fields: string[] = []
      visibleColumns.forEach(colKey => {
        const fieldMappings = COLUMN_TO_SEARCH_FIELD[colKey] || []
        fields.push(...fieldMappings)
      })
      // Remove duplicates
      return Array.from(new Set(fields))
    } else {
      // Specific column search: only search in the selected column
      const fieldMappings = COLUMN_TO_SEARCH_FIELD[searchType] || []
      return fieldMappings
    }
  }, [visibleColumns, searchType])

  // Only send searchFields when there's actually a non-empty search query
  const hasSearchQuery = searchQuery && searchQuery.trim().length > 0
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['maintenances-list', searchQuery, searchType, page, pageSize],
    queryFn: () => fetchMaintenances(
      hasSearchQuery ? searchQuery : undefined, 
      page, 
      pageSize,
      hasSearchQuery && searchFields.length > 0 ? searchFields.join(',') : undefined
    ),
    enabled: canManageMaintenance, // Only fetch if user has permission
    placeholderData: (previousData) => previousData,
  })

  // Reset manual refresh flag after successful fetch
  useEffect(() => {
    if (!isFetching && isManualRefresh) {
      setIsManualRefresh(false)
    }
  }, [isFetching, isManualRefresh])

  // Update maintenance mutation - using FastAPI hook
  const updateMaintenanceHook = useUpdateMaintenance()
  
  // Delete maintenance mutation - using FastAPI hook
  const deleteMaintenanceHook = useDeleteMaintenance()
  
  // Mutation functions using FastAPI hooks
  const doUpdateMaintenance = useCallback((data: { id: string; status: string; dateCompleted?: string; dateCancelled?: string }) => {
    updateMaintenanceHook.mutate(data, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["maintenances-list"] })
        toast.success('Maintenance status updated successfully')
        setEditingMaintenance(null)
        setEditStatus("")
        setEditDateCompleted("")
        setEditDateCancelled("")
      },
      onError: (error: Error) => {
        toast.error(error.message || 'Failed to update maintenance')
      }
    })
  }, [updateMaintenanceHook, queryClient])
  
  const doDeleteMaintenance = useCallback((id: string) => {
    deleteMaintenanceHook.mutate(id, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["maintenances-list"] })
        toast.success('Maintenance record deleted successfully')
      },
      onError: (error: Error) => {
        toast.error(error.message || 'Failed to delete maintenance')
      }
    })
  }, [deleteMaintenanceHook, queryClient])

  // Handle delete maintenance
  const handleDeleteMaintenance = useCallback((id: string) => {
    if (!canManageMaintenance) {
      toast.error('You do not have permission to delete maintenance records')
      return
    }
    
    setDeletingMaintenanceId(id)
  }, [canManageMaintenance])

  // Handle confirm delete
  const handleConfirmDelete = useCallback(() => {
    if (deletingMaintenanceId) {
      doDeleteMaintenance(deletingMaintenanceId)
      setDeletingMaintenanceId(null)
    }
  }, [deletingMaintenanceId, doDeleteMaintenance])


  // Handle edit status change
  useEffect(() => {
    if (editStatus === 'Completed') {
      setEditDateCancelled("")
    } else if (editStatus === 'Cancelled') {
      setEditDateCompleted("")
    }
  }, [editStatus])

  // Handle update maintenance
  const handleUpdateMaintenance = () => {
    if (!editingMaintenance) return

    if (!canManageMaintenance) {
      toast.error('You do not have permission to manage maintenance')
      return
    }

    if (!editStatus) {
      toast.error('Maintenance status is required')
      return
    }

    if (editStatus === 'Completed' && !editDateCompleted) {
      toast.error('Date completed is required when status is Completed')
      return
    }

    if (editStatus === 'Cancelled' && !editDateCancelled) {
      toast.error('Date cancelled is required when status is Cancelled')
      return
    }

    doUpdateMaintenance({
      id: editingMaintenance.id,
      status: editStatus,
      dateCompleted: editStatus === 'Completed' ? editDateCompleted : undefined,
      dateCancelled: editStatus === 'Cancelled' ? editDateCancelled : undefined,
    })
  }

  const handlePageSizeChange = useCallback((newPageSize: string) => {
    updateURL({ pageSize: parseInt(newPageSize), page: 1 })
  }, [updateURL])

  const handlePageChange = useCallback((newPage: number) => {
    updateURL({ page: newPage })
  }, [updateURL])

  const handleRefresh = useCallback(() => {
    setIsManualRefresh(true)
    queryClient.invalidateQueries({ queryKey: ['maintenances-list'] })
  }, [queryClient])

  // Sync searchInput and searchType with URL params only on initial mount or external navigation
  useEffect(() => {
    const urlSearchType = searchParams.get('searchType') || 'unified'
    const urlSearch = searchParams.get('search') || ''
    
    if (urlSearchType !== searchType) {
      setSearchType(urlSearchType)
    }
    
    if (urlSearch !== searchInput && urlSearch !== previousSearchInputRef.current) {
      setSearchInput(urlSearch)
      setSearchQuery(urlSearch)
      previousSearchInputRef.current = urlSearch
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]) // Only depend on searchParams, not on state

  // Debounce search input - update searchQuery after user stops typing
  useEffect(() => {
    // Skip if search input hasn't actually changed (e.g., when URL changes from page navigation)
    if (searchInput === previousSearchInputRef.current) {
      return
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(searchInput)
      previousSearchInputRef.current = searchInput
      // Only update URL if search input actually changed from URL value
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

    // Sync searchInput with URL params only on initial mount or external navigation
  useEffect(() => {
    const urlSearch = searchParams.get('search') || ''
    const currentSearchQuery = lastSearchQueryRef.current || ''
    
    if (urlSearch !== currentSearchQuery) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
        searchTimeoutRef.current = null
      }
      setSearchInput(urlSearch)
      setSearchQuery(urlSearch)
      previousSearchInputRef.current = urlSearch
      lastSearchQueryRef.current = urlSearch
    }
  }, [searchParams])
  
  useEffect(() => {
    lastSearchQueryRef.current = searchQuery
  }, [searchQuery])

  // Handle opening edit dialog
  const handleEditMaintenance = useCallback((maintenance: {
    id: string
    status: string
    dateCompleted?: string | null
    dateCancelled?: string | null
  }) => {
    setEditingMaintenance(maintenance)
    setEditStatus(maintenance.status as MaintenanceStatus)
    setEditDateCompleted(maintenance.dateCompleted ? new Date(maintenance.dateCompleted).toISOString().split('T')[0] : "")
    setEditDateCancelled(maintenance.dateCancelled ? new Date(maintenance.dateCancelled).toISOString().split('T')[0] : "")
  }, [])

  // Create columns for maintenance records
  const columns = useMemo(() => createMaintenanceColumns(handleEditMaintenance, canManageMaintenance, handleDeleteMaintenance), [handleEditMaintenance, canManageMaintenance, handleDeleteMaintenance])

  // Memoize maintenance records data
  const maintenances = useMemo(() => data?.maintenances || [], [data?.maintenances])

  // Track initial mount for animations - only animate stagger on first load
  useEffect(() => {
    if (isInitialMount.current && data && maintenances.length > 0) {
      // Disable staggered animations after first data load
      // Use a short delay to allow first animation to start
      const timer = setTimeout(() => {
        isInitialMount.current = false
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [data, maintenances.length])

  const table = useReactTable({
    data: maintenances,
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

  const allSelected = Object.keys(columnVisibility).filter(
    key => columnVisibility[key as keyof VisibilityState]
  ).length === ALL_COLUMNS.length

  const getColumnLabel = (columnId: string | undefined): string => {
    if (!columnId) return ''
    const column = ALL_COLUMNS.find(col => col.key === columnId)
    return column?.label || columnId
  }

  const toggleColumn = (columnKey: string) => {
    if (columnKey === 'select-all') {
      const newVisibility: VisibilityState = {}
      columns.forEach(col => {
        if (col.id) {
          newVisibility[col.id] = true
        }
      })
      setColumnVisibility(prev => ({ ...prev, ...newVisibility }))
      setShouldCloseSelect(true)
      return
    }
    if (columnKey === 'deselect-all') {
      const newVisibility: VisibilityState = {}
      columns.forEach(col => {
        if (col.id) {
          newVisibility[col.id] = false
        }
      })
      setColumnVisibility(prev => ({ ...prev, ...newVisibility }))
      setShouldCloseSelect(true)
      return
    }
    table.getColumn(columnKey)?.toggleVisibility()
    setShouldCloseSelect(false)
  }

  const pagination = data?.pagination

  // Set mobile dock content
  useEffect(() => {
    if (isMobile) {
      setDockContent(
        <>
          <Button 
            asChild
            variant="outline"
            size="lg"
            className="rounded-full btn-glass-elevated"
          >
            <Link href="/assets/maintenance">
              Add Maintenance
            </Link>
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            className="h-10 w-10 rounded-full btn-glass-elevated"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </>
      )
    } else {
      setDockContent(null)
    }
    
    return () => {
      setDockContent(null)
    }
  }, [isMobile, setDockContent, handleRefresh])

  // Set mobile pagination content
  useEffect(() => {
    if (isMobile && pagination && pagination.totalPages > 0) {
      setPaginationContent(
        <>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (page > 1) {
                  handlePageChange(page - 1)
                }
              }}
              disabled={page <= 1 || isLoading}
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
                if (pagination && page < pagination.totalPages) {
                  handlePageChange(page + 1)
                }
              }}
              disabled={!pagination || page >= (pagination.totalPages || 1) || isLoading}
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
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-600">Error loading maintenances: {(error as Error).message}</p>
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
        <h1 className="text-3xl font-bold">List of Maintenances</h1>
        <p className="text-muted-foreground">
          View and manage all assets with Maintenance status
        </p>
      </div>

      <Card className="relative flex flex-col flex-1 min-h-0 pb-0 gap-0">
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex items-center w-full lg:flex-1 lg:max-w-md border rounded-md overflow-hidden">
              <Select
                value={searchType}
                onValueChange={(value: string) => {
                  setSearchType(value)
                  updateURL({ searchType: value, page: 1 })
                }}
              >
                <SelectTrigger className={cn("w-[140px] h-8 rounded-none border-0 border-r focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none", isMobile && "w-[100px]")} size='sm'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unified">Unified Search</SelectItem>
                  {visibleColumns
                    .filter(colKey => {
                      // Only show columns that have searchable fields
                      const fieldMappings = COLUMN_TO_SEARCH_FIELD[colKey] || []
                      return fieldMappings.length > 0
                    })
                    .map(colKey => {
                      const column = ALL_COLUMNS.find(c => c.key === colKey)
                      return (
                        <SelectItem key={colKey} value={colKey}>
                          {column?.label || colKey}
                        </SelectItem>
                      )
                    })}
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
                      ? visibleColumns.length > 0
                        ? `Search by ${visibleColumns.slice(0, 3).map(col => ALL_COLUMNS.find(c => c.key === col)?.label).filter(Boolean).join(', ').toLowerCase()}${visibleColumns.length > 3 ? '...' : ''}...`
                        : 'Search maintenances...'
                      : ALL_COLUMNS.find(c => c.key === searchType)?.label
                        ? `Search by ${ALL_COLUMNS.find(c => c.key === searchType)?.label}`
                        : 'Search...'
                  }
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-8 h-8 rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 ">
              <Select 
              open={isSelectOpen} 
              onOpenChange={handleSelectOpenChange}
              value=""
              onValueChange={(value) => {
                toggleColumn(value)
              }}
            >
              <SelectTrigger className="w-full" size='sm'>
                <span className="flex-1 text-left truncate">
                  {Object.values(columnVisibility).filter(Boolean).length > 0 
                    ? `${Object.values(columnVisibility).filter(Boolean).length} column${Object.values(columnVisibility).filter(Boolean).length !== 1 ? 's' : ''} selected`
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
                {table.getAllColumns().filter(col => col.getCanHide()).map((column) => (
                  <SelectItem
                    key={column.id}
                    value={column.id}
                    disabled={false}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox checked={column.getIsVisible()} />
                      {getColumnLabel(column.id)}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                className="h-8 w-8 shrink-0 hidden md:flex"
                title="Refresh table"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 px-0 relative">
          {isFetching && data && maintenances.length > 0 && (
            <div className={cn("absolute left-0 right-[10px] top-[33px] bottom-0 bg-background/50 backdrop-blur-sm z-20 flex items-center justify-center", isMobile && "right-0 rounded-b-2xl")}>
              <Spinner variant="default" size={24} className="text-muted-foreground" />
            </div>
          )}

          <div className={cn('h-140 pt-8', isMobile && "h-136")}>
            {permissionsLoading || (isLoading && !data) ? (
              <div className={cn("flex items-center justify-center py-12", isMobile && "h-136")}>
                <div className="flex flex-col items-center gap-3">
                  <Spinner className="h-8 w-8" />
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              </div>
            ) : !canManageMaintenance ? (
              <div className={cn("flex items-center justify-center py-12", isMobile && "h-136")}>
                <div className="flex flex-col items-center gap-3 text-center">
                  <Package className="h-12 w-12 text-muted-foreground opacity-50" />
                  <p className="text-lg font-medium">Access Denied</p>
                  <p className="text-sm text-muted-foreground">
                    You do not have permission to view maintenance records. Please contact your administrator.
                  </p>
                </div>
              </div>
            ) : maintenances.length === 0 ? (
              <div className={cn("text-center py-8 text-muted-foreground", isMobile && "h-136")}>
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No maintenances found</p>
                <p className="text-sm">No assets with Maintenance status match your search criteria</p>
              </div>
            ) : (
              <div className="min-w-full ">
                <ScrollArea className={cn('h-132 relative', isMobile && "h-130")}>
                <div className="sticky top-0 z-30 h-px bg-border w-full"></div>
                <div className="pr-2.5">
                <Table>
                  <TableHeader className="sticky -top-1 z-20 bg-card [&_tr]:border-b-0 -mr-2.5">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id} className="group hover:bg-muted/50 relative border-b-0 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-border after:z-30">
                        {headerGroup.headers.map((header) => {
                          const isActionsColumn = header.column.id === 'actions'
                          return (
                            <TableHead 
                              key={header.id} 
                              className={cn(
                                isActionsColumn ? "text-center" : "text-left ",
                                "bg-card transition-colors",
                                !isActionsColumn && "group-hover:bg-muted/50",
                                isActionsColumn && "sticky z-10 right-0 border-r after:content-[''] after:absolute after:left-0 after:top-0 after:bottom-0 after:w-px after:bg-border after:z-30 "
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
                          className="group relative hover:bg-muted/90 data-[state=selected]:bg-muted border-b transition-colors after:content-[''] after:absolute after:top-0 after:bottom-0 after:right-0 after:w-px after:bg-border after:z-10"
                        >
                          {row.getVisibleCells().map((cell) => {
                            const isActionsColumn = cell.column.id === 'actions'
                            return (
                              <TableCell 
                                key={cell.id}
                                className={cn(
                                  "bg-card transition-colors",
                                  isActionsColumn && "sticky text-center right-0 bg-card z-10 border-r after:content-[''] after:absolute after:left-0 after:top-0 after:bottom-0 after:w-px after:bg-border after:z-30"
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
                          No maintenances found.
                        </TableCell>
                      </TableRow>
                    )}
                    </AnimatePresence>
                  </TableBody>
                </Table>
                </div>
                <ScrollBar orientation="horizontal" className='z-10' />
                <ScrollBar orientation="vertical" className='z-10' />
                </ScrollArea>
              </div>
            )}
          </div>
        </CardContent>
        
        {/* Pagination Bar - Fixed at Bottom */}
        <div className="sticky bottom-0 border-t bg-transparent z-10 shadow-sm mt-auto rounded-b-2xl hidden md:block">
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
                  <Spinner className="h-4 w-4" variant="default" />
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

      {/* Edit Maintenance Dialog */}
      <Dialog open={!!editingMaintenance} onOpenChange={(open: boolean) => !open && setEditingMaintenance(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Update Maintenance Status</DialogTitle>
            <DialogDescription>
              Update the maintenance status. The asset status will be automatically updated based on the maintenance status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Status and Date Completed/Cancelled */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Maintenance Status <span className="text-destructive">*</span></FieldLabel>
                <FieldContent>
                  <Select
                    value={editStatus}
                    onValueChange={(value) => setEditStatus(value as MaintenanceStatus)}
                    required
                    disabled={!canManageMaintenance}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select maintenance status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Scheduled">Scheduled</SelectItem>
                      <SelectItem value="In progress">In progress</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>

              {/* Date Completed / Date Cancelled - Conditional based on status */}
              {editStatus === 'Completed' && (
                <Field>
                  <FieldLabel>Date Completed <span className="text-destructive">*</span></FieldLabel>
                  <FieldContent>
                    <DatePicker
                      id="editDateCompleted"
                      value={editDateCompleted}
                      onChange={setEditDateCompleted}
                      disabled={!canManageMaintenance}
                      placeholder="Select completion date"
                      className="gap-2"
                      labelClassName="hidden"
                    />
                  </FieldContent>
                </Field>
              )}

              {editStatus === 'Cancelled' && (
                <Field>
                  <FieldLabel>Date Cancelled <span className="text-destructive">*</span></FieldLabel>
                  <FieldContent>
                    <DatePicker
                      id="editDateCancelled"
                      value={editDateCancelled}
                      onChange={setEditDateCancelled}
                      disabled={!canManageMaintenance}
                      placeholder="Select cancellation date"
                      className="gap-2"
                      labelClassName="hidden"
                    />
                  </FieldContent>
                </Field>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingMaintenance(null)
                  setEditStatus("")
                  setEditDateCompleted("")
                  setEditDateCancelled("")
                }}
                className='btn-glass'
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleUpdateMaintenance}
                disabled={updateMaintenanceHook.isPending || !canManageMaintenance}
              >
                {updateMaintenanceHook.isPending ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Updating...
                  </>
                ) : (
                  'Update Status'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Maintenance Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={!!deletingMaintenanceId}
        onOpenChange={(open) => !open && setDeletingMaintenanceId(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Maintenance Record"
        description={
          deletingMaintenanceId
            ? (() => {
                const maintenance = maintenances.find(m => m.id === deletingMaintenanceId)
                return maintenance
                  ? `Are you sure you want to delete the maintenance record "${maintenance.title}"? This action cannot be undone.`
                  : 'Are you sure you want to delete this maintenance record? This action cannot be undone.'
              })()
            : 'Are you sure you want to delete this maintenance record? This action cannot be undone.'
        }
        isLoading={deleteMaintenanceHook.isPending}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loadingLabel="Deleting..."
      />
    </motion.div>
  )
}

export default function ListOfMaintenancesPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">List of Maintenances</h1>
          <p className="text-muted-foreground">
            View and manage all assets with Maintenance status
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
      <ListOfMaintenancesPageContent />
    </Suspense>
  )
}
