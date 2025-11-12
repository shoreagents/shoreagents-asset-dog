'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo, useCallback, useEffect, useRef, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { MoreHorizontal, Trash2, Edit, Search, UserPlus, ArrowUpDown, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Package, Calendar, MapPin, X, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { QRCodeDisplayDialog } from '@/components/qr-code-display-dialog'
import { usePermissions } from '@/hooks/use-permissions'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { employeeSchema, type EmployeeFormData } from '@/lib/validations/employees'
import { FieldError } from '@/components/ui/field'

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

async function fetchEmployees(search?: string, searchType: string = 'unified', page: number = 1, pageSize: number = 100): Promise<{ employees: Employee[], pagination: PaginationInfo }> {
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
                className="h-8 w-8 p-0"
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

export default function EmployeesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasPermission } = usePermissions()
  const canManageEmployees = hasPermission('canManageEmployees')
  
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
  const pageSize = parseInt(searchParams.get('pageSize') || '100', 10)
  
  // Separate states for search input (immediate UI) and search query (debounced API calls)
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '') // Local input state for immediate UI updates
  const [searchType, setSearchType] = useState<'unified' | 'name' | 'email' | 'department'>(
    (searchParams.get('searchType') as 'unified' | 'name' | 'email' | 'department') || 'unified'
  )
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null) // Ref for debounce timeout
  const lastSearchQueryRef = useRef<string>(searchParams.get('search') || '') // Track last searchQuery to avoid sync loops
  const previousSearchInputRef = useRef<string>(searchParams.get('search') || '') // Track previous search input to prevent unnecessary updates

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
      if (updates.pageSize === 100) {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      setIsEditDialogOpen(false)
      setSelectedEmployee(null)
      editForm.reset()
      toast.success('Employee updated successfully')
    },
    onError: (error: Error) => {
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
    <div className="space-y-6 max-h-screen">
      <div>
        <h1 className="text-3xl font-bold">Employee Users</h1>
        <p className="text-muted-foreground">
          Manage employee users in the system
        </p>
      </div>

      <Card className="relative flex flex-col flex-1 min-h-0 pb-0 gap-0">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center w-full md:flex-1 md:max-w-md border rounded-md overflow-hidden">
              <Select
                value={searchType}
                onValueChange={(value: 'unified' | 'name' | 'email' | 'department') => {
                  setSearchType(value)
                  updateURL({ searchType: value, page: 1 })
                }}
              >
                <SelectTrigger className="w-[140px] h-8 rounded-none border-0 border-r focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none" size='sm'>
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
                className="flex-1 md:flex-initial"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Add Employee
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setIsManualRefresh(true)
                  queryClient.invalidateQueries({ queryKey: ['employees'] })
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
          {isFetching && data && isManualRefresh && (
            <div className="absolute inset-x-0 top-[33px] bottom-0 bg-background/50 backdrop-blur-sm z-20 flex items-center justify-center">
              <Spinner variant="default" size={24} className="text-muted-foreground" />
            </div>
          )}
          <div className="h-140 pt-8">
            {isLoading && !data ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <Spinner className="h-8 w-8" />
                  <p className="text-sm text-muted-foreground">Loading employees...</p>
                </div>
              </div>
            ) : employees.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No employees found</p>
                <p className="text-sm">Add your first employee to get started</p>
              </div>
            ) : (
              <div className="min-w-full">
                <ScrollArea className='h-132'>
                <Table className='border-t'>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id} className="group">
                        {headerGroup.headers.map((header) => {
                          const isActionsColumn = header.column.id === 'actions'
                          return (
                            <TableHead 
                              key={header.id}
                              className={cn(
                                isActionsColumn ? "text-center" : "text-left",
                                isActionsColumn && "sticky right-0 bg-card z-0 border-l group-hover:bg-muted/50 transition-colors"
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
                    {table.getRowModel().rows?.length ? (
                      table.getRowModel().rows.map((row) => {
                        const checkouts = row.original.checkouts || []
                        const hasCheckouts = checkouts.length > 0
                        return (
                          <TableRow 
                            key={row.id} 
                            data-state={row.getIsSelected() && 'selected'}
                            className={cn(
                              hasCheckouts ? 'cursor-pointer hover:bg-muted/50' : '',
                              "group"
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
                                    isActionsColumn && "sticky text-center right-0 bg-card z-10 group-hover:bg-muted/50 border-l transition-colors"
                                  )}
                                >
                                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                              )
                            })}
                          </TableRow>
                        )
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={columns.length} className="h-24 text-center">
                          No employees found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" className='z-10' />
                <ScrollBar orientation="vertical" className='z-10' />
                </ScrollArea>
              </div>
            )}
          </div>
        </CardContent>
        
        {/* Pagination Bar - Fixed at Bottom */}
        <div className="sticky bottom-0 border-t bg-card z-10 shadow-sm mt-auto rounded-bl-xl rounded-br-xl ">
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
                  <SelectItem value="100">100 rows</SelectItem>
                  <SelectItem value="200">200 rows</SelectItem>
                  <SelectItem value="300">300 rows</SelectItem>
                  <SelectItem value="400">400 rows</SelectItem>
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
                            <div className="flex items-center gap-3">
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
    </div>
  )
}


