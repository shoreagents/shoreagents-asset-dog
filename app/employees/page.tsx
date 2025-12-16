'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo, useCallback, useEffect, useRef, useTransition, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
import { Label } from '@/components/ui/label'
import { MoreHorizontal, Trash2, Edit, Search, UserPlus, ArrowUpDown, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Package, Calendar, MapPin, X, RefreshCw, ChevronLeft, Move, Eye, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { DeleteConfirmationDialog } from '@/components/dialogs/delete-confirmation-dialog'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { usePermissions } from '@/hooks/use-permissions'
import { useMobileDock } from '@/components/mobile-dock-provider'
import { useMobilePagination } from '@/components/mobile-pagination-provider'
import { useIsMobile } from '@/hooks/use-mobile'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { employeeSchema, type EmployeeFormData } from '@/lib/validations/employees'
import { FieldError } from '@/components/ui/field'
import { QRCodeDisplayDialog } from '@/components/dialogs/qr-code-display-dialog'

interface Employee {
  id: string
  name: string
  email: string
  department: string | null
  createdAt: string
  updatedAt: string
  checkouts?: {
    id: string
    checkoutDate: string
    expectedReturnDate: string | null
    asset: {
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
      brand: string | null
      model: string | null
    }
  }[]
}

interface PaginationInfo {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

async function fetchEmployees(search?: string, searchType: string = 'unified', page: number = 1, pageSize: number = 50): Promise<{ employees: Employee[], pagination: PaginationInfo }> {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
  })
  if (search) {
    params.append('search', search)
    params.append('searchType', searchType)
  }
  
  const response = await fetch(`/api/employees?${params.toString()}`)
  if (!response.ok) {
    throw new Error('Failed to fetch employees')
  }
  const data = await response.json()
  return { employees: data.employees, pagination: data.pagination }
}

async function createEmployee(data: { name: string; email: string; department?: string }) {
  const response = await fetch('/api/employees', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create employee')
  }
  return response.json()
}

async function updateEmployee(id: string, data: { name: string; email: string; department?: string }) {
  const response = await fetch(`/api/employees/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update employee')
  }
  return response.json()
}

async function deleteEmployee(id: string) {
  const response = await fetch(`/api/employees/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete employee')
  }
  return response.json()
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-'
  try {
    return new Date(dateString).toLocaleDateString()
  } catch {
    return dateString
  }
}

// Create column definitions for TanStack Table
const createColumns = (
  onEdit: (employee: Employee) => void,
  onDelete: (employee: Employee) => void,
  onViewCheckouts: (employee: Employee) => void
): ColumnDef<Employee>[] => [
  {
    accessorKey: 'name',
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
    cell: ({ row }) => <div className="font-medium">{row.original.name}</div>,
  },
  {
    accessorKey: 'email',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Email
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
    cell: ({ row }) => <div>{row.original.email}</div>,
  },
  {
    accessorKey: 'department',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Department
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
    cell: ({ row }) => <div>{row.original.department || '-'}</div>,
    enableSorting: true,
  },
  {
    accessorKey: 'checkouts',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Active Checkouts
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
      const checkouts = row.original.checkouts || []
      return (
        <div 
          className={checkouts.length > 0 ? 'cursor-pointer text-primary hover:underline font-medium' : ''}
          onClick={(e) => {
            e.stopPropagation()
            if (checkouts.length > 0) {
              onViewCheckouts(row.original)
            }
          }}
        >
          {checkouts.length}
        </div>
      )
    },
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.checkouts?.length || 0
      const b = rowB.original.checkouts?.length || 0
      return a - b
    },
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Created At
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
    cell: ({ row }) => formatDate(row.original.createdAt),
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row }) => {
      const employee = row.original
      return (
        <div onClick={(e) => e.stopPropagation()}>
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
              <DropdownMenuItem onClick={() => onEdit(employee)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(employee)}
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

function EmployeesPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasPermission } = usePermissions()
  const canManageEmployees = hasPermission('canManageEmployees')
  const isMobile = useIsMobile()
  const { setDockContent } = useMobileDock()
  const { setPaginationContent } = useMobilePagination()
  
  const [sorting, setSorting] = useState<SortingState>([])
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isCheckoutsDialogOpen, setIsCheckoutsDialogOpen] = useState(false)
  const [isQRDialogOpen, setIsQRDialogOpen] = useState(false)
  const [selectedAssetTagId, setSelectedAssetTagId] = useState<string>('')
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [isManualRefresh, setIsManualRefresh] = useState(false)
  const queryClient = useQueryClient()
  const [, startTransition] = useTransition()

  // Create form
  const createForm = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      name: '',
      email: '',
      department: '',
    },
  })

  // Edit form
  const editForm = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      name: '',
      email: '',
      department: '',
    },
  })

  // Get page, pageSize, and search from URL
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)
  
  // Separate states for search input (immediate UI) and search query (debounced API calls)
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '') // Local input state for immediate UI updates
  const [searchType, setSearchType] = useState<'unified' | 'name' | 'email' | 'department'>(
    (searchParams.get('searchType') as 'unified' | 'name' | 'email' | 'department') || 'unified'
  )
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null) // Ref for debounce timeout
  const lastSearchQueryRef = useRef<string>(searchParams.get('search') || '') // Track last searchQuery to avoid sync loops
  const previousSearchInputRef = useRef<string>(searchParams.get('search') || '') // Track previous search input to prevent unnecessary updates
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
      // Reset to page 1 when pageSize changes
      params.delete('page')
    }
    
    if (updates.search !== undefined) {
      if (updates.search === '') {
        params.delete('search')
        params.delete('searchType')
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

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['employees', searchQuery, searchType, page, pageSize],
    queryFn: () => fetchEmployees(searchQuery || undefined, searchType, page, pageSize),
    placeholderData: (previousData) => previousData, // Keep previous data while fetching new data
    staleTime: 0, // Always consider data stale to ensure fresh data after mutations
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  })

  // Reset manual refresh flag after successful fetch
  useEffect(() => {
    if (!isFetching && isManualRefresh) {
      setIsManualRefresh(false)
    }
  }, [isFetching, isManualRefresh])

  const handlePageSizeChange = useCallback((newPageSize: string) => {
    updateURL({ pageSize: parseInt(newPageSize), page: 1 })
  }, [updateURL])

  const handlePageChange = useCallback((newPage: number) => {
    updateURL({ page: newPage })
  }, [updateURL])

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

  // Sync searchInput and searchType with URL params only on initial mount or external navigation
  useEffect(() => {
    const urlSearch = searchParams.get('search') || ''
    const urlSearchType = (searchParams.get('searchType') as 'unified' | 'name' | 'email' | 'department') || 'unified'
    const currentSearchQuery = lastSearchQueryRef.current || ''
    
    if (urlSearchType !== searchType) {
      setSearchType(urlSearchType)
    }
    
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])
  
  // Update ref when searchQuery changes from our debounce
  useEffect(() => {
    lastSearchQueryRef.current = searchQuery
  }, [searchQuery])

  const createMutation = useMutation({
    mutationFn: createEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      setIsCreateDialogOpen(false)
      createForm.reset()
      toast.success('Employee created successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create employee')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string; email: string; department?: string } }) =>
      updateEmployee(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['employees'] })

      // Snapshot all previous employee queries
      const queryCache = queryClient.getQueryCache()
      const previousQueries = new Map()
      
      // Get all employee queries and snapshot them
      queryCache.findAll({ queryKey: ['employees'] }).forEach(query => {
        const previousData = queryClient.getQueryData<{ employees: Employee[], pagination: PaginationInfo }>(query.queryKey)
        if (previousData) {
          previousQueries.set(JSON.stringify(query.queryKey), previousData)
          
          // Optimistically update each query that contains this employee
          const updatedData = {
            ...previousData,
            employees: previousData.employees.map(employee =>
              employee.id === id
                ? { ...employee, name: data.name, email: data.email, department: data.department || null }
                : employee
            ),
          }
          queryClient.setQueryData(query.queryKey, updatedData)
        }
      })

      return { previousQueries }
    },
    onSuccess: () => {
      // Invalidate queries in background (don't await - let it happen async)
      queryClient.invalidateQueries({ queryKey: ['employees'], refetchType: 'none' })
      setIsEditDialogOpen(false)
      setSelectedEmployee(null)
      editForm.reset()
      toast.success('Employee updated successfully')
    },
    onError: (error: Error, variables, context) => {
      // Rollback all queries to previous data on error
      if (context?.previousQueries) {
        context.previousQueries.forEach((previousData, queryKeyStr) => {
          const queryKey = JSON.parse(queryKeyStr)
          queryClient.setQueryData(queryKey, previousData)
        })
      }
      toast.error(error.message || 'Failed to update employee')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      setIsDeleteDialogOpen(false)
      setSelectedEmployee(null)
      toast.success('Employee deleted successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete employee')
    },
  })

  const handleCreate = createForm.handleSubmit(async (data) => {
    if (!canManageEmployees) {
      toast.error('You do not have permission to create employees')
      return
    }
    createMutation.mutate({
      name: data.name,
      email: data.email,
      department: data.department,
    })
  })

  const handleEdit = useCallback((employee: Employee) => {
    if (!canManageEmployees) {
      toast.error('You do not have permission to edit employees')
      return
    }
    setSelectedEmployee(employee)
    editForm.reset({
      name: employee.name,
      email: employee.email,
      department: employee.department || '',
    })
    setIsEditDialogOpen(true)
  }, [canManageEmployees, editForm])

  const handleUpdate = editForm.handleSubmit(async (data) => {
    if (!canManageEmployees) {
      toast.error('You do not have permission to update employees')
      return
    }
    if (!selectedEmployee) {
      toast.error('No employee selected')
      return
    }
    updateMutation.mutate({ 
      id: selectedEmployee.id, 
      data: {
        name: data.name,
        email: data.email,
        department: data.department,
      }
    })
  })

  const handleDelete = useCallback((employee: Employee) => {
    if (!canManageEmployees) {
      toast.error('You do not have permission to delete employees')
      return
    }
    setSelectedEmployee(employee)
    setIsDeleteDialogOpen(true)
  }, [canManageEmployees])

  const handleViewCheckouts = useCallback((employee: Employee) => {
    setSelectedEmployee(employee)
    setIsCheckoutsDialogOpen(true)
  }, [])

  const confirmDelete = () => {
    if (selectedEmployee) {
      deleteMutation.mutate(selectedEmployee.id)
    }
  }

  // Create columns with handlers
  const columns = useMemo(() => createColumns(handleEdit, handleDelete, handleViewCheckouts), [handleEdit, handleDelete, handleViewCheckouts])

  // Memoize employees data
  const employees = useMemo(() => data?.employees || [], [data?.employees])

  const table = useReactTable({
    data: employees,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  })

  const pagination = data?.pagination

  const handleRefresh = useCallback(() => {
    setIsManualRefresh(true)
    queryClient.invalidateQueries({ queryKey: ['employees'] })
  }, [queryClient])

  // Set mobile dock content
  useEffect(() => {
    if (isMobile) {
      setDockContent(
        <>
          <Button 
            onClick={() => {
              if (!canManageEmployees) {
                toast.error('You do not have permission to add employees')
                return
              }
              setIsCreateDialogOpen(true)
            }} 
            variant="outline"
            size="lg"
            className="rounded-full btn-glass-elevated"
          >
            Add Employee
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
  }, [isMobile, setDockContent, canManageEmployees, handleRefresh])

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
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-600">Error loading employees: {(error as Error).message}</p>
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
        <h1 className="text-3xl font-bold">Employee Users</h1>
        <p className="text-muted-foreground">
          Manage employee users in the system
        </p>
      </div>

      <Card className="relative flex flex-col flex-1 min-h-0 pb-0 gap-0">
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex items-center w-full lg:flex-1 lg:max-w-md border rounded-md overflow-hidden">
              <Select
                value={searchType}
                onValueChange={(value: 'unified' | 'name' | 'email' | 'department') => {
                  setSearchType(value)
                  updateURL({ searchType: value, page: 1 })
                }}
              >
                <SelectTrigger className={cn("w-[140px] h-8 rounded-none border-0 border-r focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none", isMobile && "w-[100px]")} size='sm'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unified">Unified Search</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="department">Department</SelectItem>
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
                      ? 'Search by name, email, or department...'
                      : searchType === 'name'
                      ? 'Search by Name'
                      : searchType === 'email'
                      ? 'Search by Email'
                      : 'Search by Department'
                  }
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-8 h-8 rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={() => {
                  if (!canManageEmployees) {
                    toast.error('You do not have permission to add employees')
                    return
                  }
                  setIsCreateDialogOpen(true)
                }}
                size='sm'
                className="flex-1 hidden md:flex"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Add Employee
              </Button>
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
          {isFetching && data && (
            <div className={cn("absolute left-0 right-[10px] top-[33px] bottom-0 bg-background/50 backdrop-blur-sm z-20 flex items-center justify-center", isMobile && "right-0 rounded-b-2xl")}>
              <Spinner variant="default" size={24} className="text-muted-foreground" />
            </div>
          )}
          <div className={cn("h-140 pt-6", isMobile && "h-136")}>
            {isLoading && !data ? (
              <div className={cn("flex items-center justify-center py-12", isMobile && "h-136")}>
                <div className="flex flex-col items-center gap-3">
                  <Spinner className="h-8 w-8" />
                  <p className="text-sm text-muted-foreground">Loading employees...</p>
                </div>
              </div>
            ) : employees.length === 0 ? (
              <div className={cn("text-center py-8 text-muted-foreground", isMobile && "h-136")}>
                <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No employees found</p>
                <p className="text-sm">Add your first employee to get started</p>
              </div>
            ) : (
              <div className="min-w-full">
                <ScrollArea className={cn('h-132 relative', isMobile && "h-130")}>
                <div className="sticky top-0 z-30 h-px bg-border w-full"></div>
                <div className="pr-2.5 relative after:content-[''] after:absolute after:right-[10px] after:top-0 after:bottom-0 after:w-px after:bg-border after:z-50 after:h-full">
                <Table>
                  <TableHeader className="sticky -top-1 z-20 bg-card [&_tr]:border-b-0 -mr-1.5">
                    {table.getHeaderGroups().map((headerGroup: HeaderGroup<Employee>) => (
                      <TableRow key={headerGroup.id} className="group hover:bg-muted/50 relative border-b-0 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-[1.5px] after:h-px after:bg-border after:z-30">
                        {headerGroup.headers.map((header: Header<Employee, unknown>) => {
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
                        table.getRowModel().rows.map((row, index) => {
                        const checkouts = row.original.checkouts || []
                        const hasCheckouts = checkouts.length > 0
                        return (
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
                            className={cn(
                              hasCheckouts ? 'cursor-pointer hover:bg-muted/50' : '',
                                "group relative border-b transition-colors"
                            )}
                            onClick={() => {
                              if (hasCheckouts) {
                                handleViewCheckouts(row.original)
                              }
                            }}
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
                          No employees found.
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

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        setIsCreateDialogOpen(open)
        if (!open) {
          createForm.reset()
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
            <DialogDescription>
              Create a new employee user in the system.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name <span className="text-destructive">*</span></Label>
                <Controller
                  name="name"
                  control={createForm.control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="name"
                      placeholder="Enter employee name"
                      disabled={!canManageEmployees}
                      aria-invalid={createForm.formState.errors.name ? 'true' : 'false'}
                      aria-required="true"
                    />
                  )}
                />
                <FieldError errors={createForm.formState.errors.name ? [createForm.formState.errors.name] : []} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
                <Controller
                  name="email"
                  control={createForm.control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="email"
                      type="email"
                      placeholder="Enter employee email"
                      disabled={!canManageEmployees}
                      aria-invalid={createForm.formState.errors.email ? 'true' : 'false'}
                      aria-required="true"
                    />
                  )}
                />
                <FieldError errors={createForm.formState.errors.email ? [createForm.formState.errors.email] : []} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="department">Department</Label>
                <Controller
                  name="department"
                  control={createForm.control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="department"
                      value={field.value || ''}
                      placeholder="Enter department (optional)"
                      disabled={!canManageEmployees}
                      aria-invalid={createForm.formState.errors.department ? 'true' : 'false'}
                    />
                  )}
                />
                <FieldError errors={createForm.formState.errors.department ? [createForm.formState.errors.department] : []} />
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button"
                variant="outline" 
                onClick={() => {
                  setIsCreateDialogOpen(false)
                  createForm.reset()
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || !canManageEmployees}>
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open)
        if (!open) {
          editForm.reset()
          setSelectedEmployee(null)
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>
              Update employee information.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Name <span className="text-destructive">*</span></Label>
                <Controller
                  name="name"
                  control={editForm.control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="edit-name"
                      placeholder="Enter employee name"
                      disabled={!canManageEmployees}
                      aria-invalid={editForm.formState.errors.name ? 'true' : 'false'}
                      aria-required="true"
                    />
                  )}
                />
                <FieldError errors={editForm.formState.errors.name ? [editForm.formState.errors.name] : []} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-email">Email <span className="text-destructive">*</span></Label>
                <Controller
                  name="email"
                  control={editForm.control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="edit-email"
                      type="email"
                      placeholder="Enter employee email"
                      disabled={!canManageEmployees}
                      aria-invalid={editForm.formState.errors.email ? 'true' : 'false'}
                      aria-required="true"
                    />
                  )}
                />
                <FieldError errors={editForm.formState.errors.email ? [editForm.formState.errors.email] : []} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-department">Department</Label>
                <Controller
                  name="department"
                  control={editForm.control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      id="edit-department"
                      value={field.value || ''}
                      placeholder="Enter department (optional)"
                      disabled={!canManageEmployees}
                      aria-invalid={editForm.formState.errors.department ? 'true' : 'false'}
                    />
                  )}
                />
                <FieldError errors={editForm.formState.errors.department ? [editForm.formState.errors.department] : []} />
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button"
                variant="outline" 
                onClick={() => {
                  setIsEditDialogOpen(false)
                  editForm.reset()
                  setSelectedEmployee(null)
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending || !canManageEmployees}>
                {updateMutation.isPending ? 'Updating...' : 'Update'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Delete Employee"
        description={`Are you sure you want to delete ${selectedEmployee?.name}? This action cannot be undone.`}
        isLoading={deleteMutation.isPending}
      />

      {/* Checkouts Dialog */}
      <Dialog open={isCheckoutsDialogOpen} onOpenChange={setIsCheckoutsDialogOpen}>
        <DialogContent className="max-w-[95vw] w-full overflow-hidden flex flex-col p-0">
          <div className="shrink-0 px-6 pt-6 pb-4 border-b">
            <DialogHeader>
              <DialogTitle>Active Checkouts - {selectedEmployee?.name}</DialogTitle>
              <DialogDescription>
                Assets currently checked out to this employee
              </DialogDescription>
            </DialogHeader>
          </div>
          <ScrollArea className='h-96'>
            <div className="px-6 py-6">
              {selectedEmployee?.checkouts && selectedEmployee.checkouts.length > 0 ? (
                <div className='flex flex-col gap-2'>
                  {selectedEmployee.checkouts.map((checkout) => {
                    const checkoutDate = checkout.checkoutDate ? new Date(checkout.checkoutDate) : null
                    const formattedCheckoutDate = checkoutDate ? checkoutDate.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    }) : '-'
                    
                    const expectedReturnDate = checkout.expectedReturnDate ? new Date(checkout.expectedReturnDate) : null
                    const formattedReturnDate = expectedReturnDate ? expectedReturnDate.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    }) : '-'

                    return (
                      <Card key={checkout.id} className='gap-0'>
                        <CardHeader className="pb-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 flex-1">
                              <Package className="h-5 w-5 text-primary shrink-0" />
                              <CardTitle 
                                className="text-lg font-semibold cursor-pointer hover:text-primary hover:underline transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedAssetTagId(checkout.asset.assetTagId)
                                  setIsQRDialogOpen(true)
                                }}
                              >
                                {checkout.asset.assetTagId}
                              </CardTitle>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    className="h-8 w-8 p-0 rounded-full"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenuItem 
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (!hasPermission('canViewAssets')) {
                                        toast.error('You do not have permission to view assets')
                                        return
                                      }
                                      router.push(`/assets/details/${checkout.asset.id}`)
                                      setIsCheckoutsDialogOpen(false)
                                    }}
                                  >
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="[&>svg:last-child]:hidden">
                                      <ChevronLeft className="mr-2 h-4 w-4" />
                                      More Actions
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                      <DropdownMenuItem 
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          if (!hasPermission('canCheckin')) {
                                            toast.error('You do not have permission to check in assets')
                                            return
                                          }
                                          router.push(`/assets/checkin?assetId=${checkout.asset.id}`)
                                          setIsCheckoutsDialogOpen(false)
                                        }}
                                      >
                                        <ArrowLeft className="mr-2 h-4 w-4" />
                                        Checkin
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          if (!hasPermission('canMove')) {
                                            toast.error('You do not have permission to move assets')
                                            return
                                          }
                                          router.push(`/assets/move?assetId=${checkout.asset.id}`)
                                          setIsCheckoutsDialogOpen(false)
                                        }}
                                      >
                                        <Move className="mr-2 h-4 w-4" />
                                        Move
                                      </DropdownMenuItem>
                                      <DropdownMenuSub>
                                        <DropdownMenuSubTrigger onClick={(e) => e.stopPropagation()}>
                                          <Trash2 className="mr-2 h-4 w-4" />
                                          Dispose
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent onClick={(e) => e.stopPropagation()}>
                                          <DropdownMenuItem 
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              if (!hasPermission('canDispose')) {
                                                toast.error('You do not have permission to dispose assets')
                                                return
                                              }
                                              router.push(`/assets/dispose?assetId=${checkout.asset.id}&method=Sold`)
                                              setIsCheckoutsDialogOpen(false)
                                            }}
                                          >
                                            Sold
                                          </DropdownMenuItem>
                                          <DropdownMenuItem 
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              if (!hasPermission('canDispose')) {
                                                toast.error('You do not have permission to dispose assets')
                                                return
                                              }
                                              router.push(`/assets/dispose?assetId=${checkout.asset.id}&method=Donated`)
                                              setIsCheckoutsDialogOpen(false)
                                            }}
                                          >
                                            Donated
                                          </DropdownMenuItem>
                                          <DropdownMenuItem 
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              if (!hasPermission('canDispose')) {
                                                toast.error('You do not have permission to dispose assets')
                                                return
                                              }
                                              router.push(`/assets/dispose?assetId=${checkout.asset.id}&method=Scrapped`)
                                              setIsCheckoutsDialogOpen(false)
                                            }}
                                          >
                                            Scrapped
                                          </DropdownMenuItem>
                                          <DropdownMenuItem 
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              if (!hasPermission('canDispose')) {
                                                toast.error('You do not have permission to dispose assets')
                                                return
                                              }
                                              router.push(`/assets/dispose?assetId=${checkout.asset.id}&method=Lost/Missing`)
                                              setIsCheckoutsDialogOpen(false)
                                            }}
                                          >
                                            Lost/Missing
                                          </DropdownMenuItem>
                                          <DropdownMenuItem 
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              if (!hasPermission('canDispose')) {
                                                toast.error('You do not have permission to dispose assets')
                                                return
                                              }
                                              router.push(`/assets/dispose?assetId=${checkout.asset.id}&method=Destroyed`)
                                              setIsCheckoutsDialogOpen(false)
                                            }}
                                          >
                                            Destroyed
                                          </DropdownMenuItem>
                                        </DropdownMenuSubContent>
                                      </DropdownMenuSub>
                                      <DropdownMenuSub>
                                        <DropdownMenuSubTrigger onClick={(e) => e.stopPropagation()}>
                                          <Wrench className="mr-2 h-4 w-4" />
                                          Maintenance
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent onClick={(e) => e.stopPropagation()}>
                                          <DropdownMenuItem 
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              if (!hasPermission('canManageMaintenance')) {
                                                toast.error('You do not have permission to manage maintenance')
                                                return
                                              }
                                              router.push(`/assets/maintenance?assetId=${checkout.asset.id}&status=Scheduled`)
                                              setIsCheckoutsDialogOpen(false)
                                            }}
                                          >
                                            Scheduled
                                          </DropdownMenuItem>
                                          <DropdownMenuItem 
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              if (!hasPermission('canManageMaintenance')) {
                                                toast.error('You do not have permission to manage maintenance')
                                                return
                                              }
                                              router.push(`/assets/maintenance?assetId=${checkout.asset.id}&status=In progress`)
                                              setIsCheckoutsDialogOpen(false)
                                            }}
                                          >
                                            In Progress
                                          </DropdownMenuItem>
                                        </DropdownMenuSubContent>
                                      </DropdownMenuSub>
                                    </DropdownMenuSubContent>
                                  </DropdownMenuSub>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-0">
                          {checkout.asset.category && (
                            <div className="space-y-1">
                              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                                Category
                              </div>
                              <div className="text-sm">
                                <span className="font-medium">{checkout.asset.category.name}</span>
                                {checkout.asset.subCategory && (
                                  <span className="text-muted-foreground"> / {checkout.asset.subCategory.name}</span>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {(checkout.asset.brand || checkout.asset.model) && (
                            <div className="space-y-1">
                              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                                Brand & Model
                              </div>
                              <div className="text-sm">
                                {checkout.asset.brand && (
                                  <span className="font-medium">{checkout.asset.brand}</span>
                                )}
                                {checkout.asset.brand && checkout.asset.model && (
                                  <span className="text-muted-foreground"> - </span>
                                )}
                                {checkout.asset.model && (
                                  <span className="font-medium">{checkout.asset.model}</span>
                                )}
                              </div>
                            </div>
                          )}

                          {checkout.asset.location && (
                            <div className="space-y-1">
                              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                                Location
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="font-medium">{checkout.asset.location}</span>
                              </div>
                            </div>
                          )}

                          <div className="pt-4 border-t space-y-3">
                            <div className="space-y-1">
                              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5" />
                                Checkout Dates
                              </div>
                              <div className="space-y-2 text-sm pl-5">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground min-w-[100px]">Checkout:</span>
                                  <span className="font-medium">{formattedCheckoutDate}</span>
                                </div>
                                {expectedReturnDate && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground min-w-[100px]">Expected Return:</span>
                                    <span className="font-medium">{formattedReturnDate}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">No active checkouts</p>
                  <p className="text-sm">This employee has no assets currently checked out</p>
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="shrink-0 px-6 py-4 border-t">
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCheckoutsDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code Display Dialog */}
      <QRCodeDisplayDialog
        open={isQRDialogOpen}
        onOpenChange={setIsQRDialogOpen}
        assetTagId={selectedAssetTagId}
      />
    </motion.div>
  )
}

export default function EmployeesPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Employees</h1>
          <p className="text-muted-foreground">
            Manage employees and their information
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
      <EmployeesPageContent />
    </Suspense>
  )
}


