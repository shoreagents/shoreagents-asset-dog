'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo, useCallback, useEffect, useRef, useTransition, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useUserProfile } from '@/hooks/use-user-profile'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  HeaderGroup,
  Header,
  RowSelectionState,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { MoreHorizontal, Trash2, Search, ArrowUpDown, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RefreshCw, X, History } from 'lucide-react'
import { toast } from 'sonner'
import { DeleteConfirmationDialog } from '@/components/dialogs/delete-confirmation-dialog'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { Badge } from '@/components/ui/badge'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface AssetEvent {
  id: string
  assetId: string
  eventDate: string
  eventType: string
  field: string | null
  changeFrom: string | null
  changeTo: string | null
  actionBy: string
  createdAt: string
  asset: {
    id: string
    assetTagId: string
    description: string | null
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

async function fetchAssetEvents(
  search?: string,
  searchType: string = 'unified',
  eventType?: string,
  field?: string,
  page: number = 1,
  pageSize: number = 50
): Promise<{ logs: AssetEvent[], uniqueFields: string[], pagination: PaginationInfo }> {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
  })
  if (search) {
    params.append('search', search)
    params.append('searchType', searchType)
  }
  if (eventType && eventType !== 'all') {
    params.append('eventType', eventType)
  }
  if (field && field !== 'all') {
    params.append('field', field)
  }
  
  const response = await fetch(`/api/settings/asset-events?${params.toString()}`)
  if (!response.ok) {
    throw new Error('Failed to fetch asset events')
  }
  const data = await response.json()
  return { logs: data.logs, uniqueFields: data.uniqueFields || [], pagination: data.pagination }
}

async function deleteAssetEvent(id: string) {
  const response = await fetch(`/api/settings/asset-events/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete event')
  }
  return response.json()
}

async function deleteAssetEvents(ids: string[]) {
  const response = await fetch('/api/settings/asset-events', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete events')
  }
  return response.json()
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-'
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateString
  }
}

const getEventTypeBadgeVariant = (eventType: string) => {
  switch (eventType) {
    case 'added':
      return 'default'
    case 'edited':
      return 'secondary'
    case 'deleted':
      return 'destructive'
    default:
      return 'outline'
  }
}

// Create column definitions for TanStack Table
const createColumns = (
  onDelete: (event: AssetEvent) => void,
  isAdmin: boolean
): ColumnDef<AssetEvent>[] => [
  {
    id: 'select',
    header: ({ table }) => (
      isAdmin ? (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ) : null
    ),
    cell: ({ row }) => (
      isAdmin ? (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ) : null
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'asset.assetTagId',
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
      <div className="font-medium">{row.original.asset.assetTagId}</div>
    ),
    enableSorting: true,
  },
  {
    accessorKey: 'eventType',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Event Type
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
      const eventType = row.original.eventType
      return (
        <Badge variant={getEventTypeBadgeVariant(eventType)}>
          {eventType.charAt(0).toUpperCase() + eventType.slice(1)}
        </Badge>
      )
    },
    enableSorting: true,
  },
  {
    accessorKey: 'field',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Field
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
      <div className="text-sm">{row.original.field || '-'}</div>
    ),
    enableSorting: true,
  },
  {
    accessorKey: 'changeFrom',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Changed From
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
      <div className="text-sm max-w-[200px] truncate" title={row.original.changeFrom || ''}>
        {row.original.changeFrom || '-'}
      </div>
    ),
    enableSorting: true,
  },
  {
    accessorKey: 'changeTo',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Changed To
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
      <div className="text-sm max-w-[200px] truncate" title={row.original.changeTo || ''}>
        {row.original.changeTo || '-'}
      </div>
    ),
    enableSorting: true,
  },
  {
    accessorKey: 'actionBy',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Action By
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
    cell: ({ row }) => <div className="text-sm">{row.original.actionBy}</div>,
    enableSorting: true,
  },
  {
    accessorKey: 'eventDate',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Event Date
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
    cell: ({ row }) => formatDate(row.original.eventDate),
    enableSorting: true,
  },
  {
    id: 'actions',
    header: () => <div className="text-center">Actions</div>,
    cell: ({ row }) => {
      const event = row.original
      return (
        <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          {isAdmin ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-transparent!">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => onDelete(event)}
                  className="text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="text-muted-foreground text-xs">-</span>
          )}
        </div>
      )
    },
  },
]

function AssetEventsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAdmin } = useUserProfile()
  const queryClient = useQueryClient()
  
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<AssetEvent | null>(null)
  const [isManualRefresh, setIsManualRefresh] = useState(false)
  const [, startTransition] = useTransition()
  const isInitialMount = useRef(true)
  
  // Get page, pageSize, and filters from URL
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)
  const eventTypeFilter = searchParams.get('eventType') || 'all'
  const fieldFilter = searchParams.get('field') || 'all'
  
  // Separate states for search input (immediate UI) and search query (debounced API calls)
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '')
  const [searchType, setSearchType] = useState<'unified' | 'assetTag' | 'field' | 'actionBy' | 'changeFrom' | 'changeTo'>(
    (searchParams.get('searchType') as 'unified' | 'assetTag' | 'field' | 'actionBy' | 'changeFrom' | 'changeTo') || 'unified'
  )
  const [eventType, setEventType] = useState(eventTypeFilter)
  const [field, setField] = useState(fieldFilter)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previousSearchInputRef = useRef<string>(searchParams.get('search') || '')

  // Update URL parameters
  const updateURL = useCallback((updates: { page?: number; pageSize?: number; search?: string; searchType?: string; eventType?: string; field?: string }) => {
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

    if (updates.eventType !== undefined) {
      if (updates.eventType === 'all') {
        params.delete('eventType')
      } else {
        params.set('eventType', updates.eventType)
      }
      params.delete('page')
    }

    if (updates.field !== undefined) {
      if (updates.field === 'all') {
        params.delete('field')
      } else {
        params.set('field', updates.field)
      }
      params.delete('page')
    }
    
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false })
    })
  }, [searchParams, router, startTransition])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['asset-events', searchQuery, searchType, eventType, field, page, pageSize],
    queryFn: () => fetchAssetEvents(searchQuery || undefined, searchType, eventType !== 'all' ? eventType : undefined, field !== 'all' ? field : undefined, page, pageSize),
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

  // Sync searchInput and searchType with URL params
  useEffect(() => {
    const urlSearch = searchParams.get('search') || ''
    const urlSearchType = (searchParams.get('searchType') as 'unified' | 'assetTag' | 'field' | 'actionBy' | 'changeFrom' | 'changeTo') || 'unified'
    const urlEventType = searchParams.get('eventType') || 'all'
    const urlField = searchParams.get('field') || 'all'
    
    if (urlSearchType !== searchType) {
      setSearchType(urlSearchType)
    }
    
    if (urlEventType !== eventType) {
      setEventType(urlEventType)
    }
    
    if (urlField !== field) {
      setField(urlField)
    }
    
    if (urlSearch !== previousSearchInputRef.current) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
        searchTimeoutRef.current = null
      }
      setSearchInput(urlSearch)
      setSearchQuery(urlSearch)
      previousSearchInputRef.current = urlSearch
    }
  }, [searchParams, searchType, eventType, field])

  const deleteMutation = useMutation({
    mutationFn: deleteAssetEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-events'] })
      setIsDeleteDialogOpen(false)
      setSelectedEvent(null)
      toast.success('Event deleted successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete event')
    },
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: deleteAssetEvents,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['asset-events'] })
      setIsBulkDeleteDialogOpen(false)
      setRowSelection({})
      toast.success(`${variables.length} event${variables.length > 1 ? 's' : ''} deleted successfully`)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete events')
    },
  })

  const handleDelete = useCallback((event: AssetEvent) => {
    if (!isAdmin) {
      toast.error('You do not have permission to delete events')
      return
    }
    setSelectedEvent(event)
    setIsDeleteDialogOpen(true)
  }, [isAdmin])

  const handleBulkDelete = useCallback(() => {
    if (!isAdmin) {
      toast.error('You do not have permission to delete events')
      return
    }
    const selectedIds = Object.keys(rowSelection)
    if (selectedIds.length === 0) {
      toast.error('Please select at least one event to delete')
      return
    }
    setIsBulkDeleteDialogOpen(true)
  }, [isAdmin, rowSelection])

  const columns = useMemo(() => createColumns(handleDelete, isAdmin || false), [handleDelete, isAdmin])

  const logs = useMemo(() => data?.logs || [], [data?.logs])
  const pagination = data?.pagination
  const uniqueFields = useMemo(() => data?.uniqueFields || [], [data?.uniqueFields])
  
  // Track initial mount for animations
  useEffect(() => {
    if (isInitialMount.current && data && logs.length > 0) {
      const timer = setTimeout(() => {
        isInitialMount.current = false
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [data, logs.length])
  
  const table = useReactTable({
    data: logs,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: isAdmin || false,
    state: {
      sorting,
      rowSelection,
    },
  })

  const selectedRows = table.getFilteredSelectedRowModel().rows
  const selectedCount = selectedRows.length

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6 max-h-screen"
    >
      <div>
        <h1 className="text-3xl font-bold">Asset Events</h1>
        <p className="text-muted-foreground">
          View and manage asset history logs and events
        </p>
      </div>

      <Card className="pb-0 gap-0">
        <CardHeader className='shrink-0 pb-3'>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center w-full md:flex-1 md:max-w-md border rounded-md overflow-hidden">
              <Select
                value={searchType}
                onValueChange={(value: 'unified' | 'assetTag' | 'field' | 'actionBy' | 'changeFrom' | 'changeTo') => {
                  setSearchType(value)
                  updateURL({ searchType: value, page: 1 })
                }}
              >
                <SelectTrigger className="w-[140px] h-8 rounded-none border-0 border-r focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none" size='sm'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unified">Unified Search</SelectItem>
                  <SelectItem value="assetTag">Asset Tag</SelectItem>
                  <SelectItem value="field">Field</SelectItem>
                  <SelectItem value="actionBy">Action By</SelectItem>
                  <SelectItem value="changeFrom">Changed From</SelectItem>
                  <SelectItem value="changeTo">Changed To</SelectItem>
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
                      ? 'Search by asset tag, field, action by...'
                      : searchType === 'assetTag'
                      ? 'Search by Asset Tag'
                      : searchType === 'field'
                      ? 'Search by Field'
                      : searchType === 'actionBy'
                      ? 'Search by Action By'
                      : searchType === 'changeFrom'
                      ? 'Search by Changed From'
                      : 'Search by Changed To'
                  }
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-8 h-8 rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Event Type Filter */}
              <Select
                value={eventType}
                onValueChange={(value) => {
                  setEventType(value)
                  updateURL({ eventType: value, page: 1 })
                }}
              >
                <SelectTrigger className="w-[140px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="added">Added</SelectItem>
                  <SelectItem value="edited">Edited</SelectItem>
                  <SelectItem value="deleted">Deleted</SelectItem>
                </SelectContent>
              </Select>

              {/* Field Filter */}
              <Select
                value={field}
                onValueChange={(value) => {
                  setField(value)
                  updateURL({ field: value, page: 1 })
                }}
              >
                <SelectTrigger className="w-[140px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Fields</SelectItem>
                  {uniqueFields.map(fieldName => (
                    <SelectItem key={fieldName} value={fieldName}>{fieldName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {isAdmin && selectedCount > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleteMutation.isPending}
                  className="flex-1 md:flex-initial"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Selected ({selectedCount})
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setIsManualRefresh(true)
                  queryClient.invalidateQueries({ queryKey: ['asset-events'] })
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
          {isFetching && data && logs.length > 0 && (
            <div className="absolute left-0 right-[10px] top-[33px] bottom-0 bg-background/50 backdrop-blur-sm z-20 flex items-center justify-center">
              <Spinner variant="default" size={24} className="text-muted-foreground" />
            </div>
          )}
          {isLoading && !data ? (
            <div className="h-140 pt-12 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Spinner className="h-8 w-8" />
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            </div>
          ) : logs.length === 0 ? (
            <div className="h-140 pt-12 text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No events found</p>
              <p className="text-sm">Asset events will appear here</p>
            </div>
          ) : (
            <div className="min-w-full">
              <ScrollArea className='h-140 relative'>
                <div className="sticky top-0 z-30 h-px bg-border w-full"></div>
                <div className="pr-2.5 relative after:content-[''] after:absolute after:right-[10px] after:top-0 after:bottom-0 after:w-px after:bg-border after:z-50 after:h-full">
                  <Table className='border-b'>
                    <TableHeader className="sticky -top-1 z-20 bg-card [&_tr]:border-b-0 -mr-2.5">
                      {table.getHeaderGroups().map((headerGroup: HeaderGroup<AssetEvent>) => (
                        <TableRow key={headerGroup.id} className="group hover:bg-muted/50 relative border-b-0 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-[1.5px] after:h-px after:bg-border after:z-30">
                          {headerGroup.headers.map((header: Header<AssetEvent, unknown>) => {
                            const isActionsColumn = header.column.id === 'actions'
                            const isSelectColumn = header.column.id === 'select'
                            return (
                              <TableHead 
                                key={header.id}
                                className={cn(
                                  isActionsColumn || isSelectColumn ? "text-center" : "text-left",
                                  "bg-card transition-colors",
                                  !isActionsColumn && !isSelectColumn && "group-hover:bg-muted/50",
                                  isActionsColumn && "sticky z-10 right-0 group-hover:bg-card before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border before:z-50",
                                  isSelectColumn && "w-[50px]"
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
                                const isSelectColumn = cell.column.id === 'select'
                                return (
                                  <TableCell 
                                    key={cell.id}
                                    className={cn(
                                      isActionsColumn && "sticky text-center right-0 bg-card z-10 before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border before:z-50",
                                      isSelectColumn && "w-[50px]"
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
                              No events found.
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
        
        {/* Pagination Bar - Fixed at Bottom */}
        <div className="sticky bottom-0 border-t bg-card z-10 shadow-sm mt-auto rounded-b-lg">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 px-4 sm:px-6 py-3">
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

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={() => {
          if (selectedEvent) {
            deleteMutation.mutate(selectedEvent.id)
          }
        }}
        title="Delete Event"
        description={`Are you sure you want to delete this event? This action cannot be undone.`}
        isLoading={deleteMutation.isPending}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={isBulkDeleteDialogOpen}
        onOpenChange={setIsBulkDeleteDialogOpen}
        onConfirm={() => {
          const selectedIds = Object.keys(rowSelection)
          if (selectedIds.length > 0) {
            bulkDeleteMutation.mutate(selectedIds)
          }
        }}
        title="Delete Selected Events"
        description={`Are you sure you want to delete ${selectedCount} event${selectedCount > 1 ? 's' : ''}? This action cannot be undone.`}
        isLoading={bulkDeleteMutation.isPending}
      />
    </motion.div>
  )
}

export default function AssetEventsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Asset Events</h1>
          <p className="text-muted-foreground">
            View and manage asset history logs and events
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
      <AssetEventsPageContent />
    </Suspense>
  )
}

