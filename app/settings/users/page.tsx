'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo, useCallback, useEffect, useRef, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePermissions } from '@/hooks/use-permissions'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createUserSchema, type CreateUserFormData } from '@/lib/validations/users'
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
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
import { Checkbox } from '@/components/ui/checkbox'
import { MoreHorizontal, Trash2, Edit, Search, UserPlus, ArrowUpDown, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Shield, ShieldCheck, Eye, EyeOff, Copy, Check, X, CheckCircle, RefreshCw, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { Badge } from '@/components/ui/badge'
import { Field, FieldLabel, FieldContent, FieldError } from '@/components/ui/field'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface AssetUser {
  id: string
  userId: string
  email?: string
  role: string
  canDeleteAssets: boolean
  canManageImport: boolean
  canManageExport: boolean
  canCreateAssets: boolean
  canEditAssets: boolean
  canViewAssets: boolean
  canManageEmployees: boolean
  canManageCategories: boolean
  canCheckout: boolean
  canCheckin: boolean
  canReserve: boolean
  canMove: boolean
  canLease: boolean
  canDispose: boolean
  canManageMaintenance: boolean
  canAudit: boolean
  canManageMedia: boolean
  canManageTrash: boolean
  canManageUsers: boolean
  canManageReturnForms: boolean
  canViewReturnForms: boolean
  canManageAccountabilityForms: boolean
  canViewAccountabilityForms: boolean
  canManageReports: boolean
  isActive: boolean
  isApproved: boolean
  createdAt: string
  updatedAt: string
}

interface PaginationInfo {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

interface UserPermissions {
  canDeleteAssets: boolean
  canManageImport: boolean
  canManageExport: boolean
  canCreateAssets: boolean
  canEditAssets: boolean
  canViewAssets: boolean
  canManageEmployees: boolean
  canManageCategories: boolean
  canCheckout: boolean
  canCheckin: boolean
  canReserve: boolean
  canMove: boolean
  canLease: boolean
  canDispose: boolean
  canManageMaintenance: boolean
  canAudit: boolean
  canManageMedia: boolean
  canManageTrash: boolean
  canManageUsers: boolean
  canManageReturnForms: boolean
  canViewReturnForms: boolean
  canManageAccountabilityForms: boolean
  canViewAccountabilityForms: boolean
  canManageReports: boolean
}

async function fetchUsers(search?: string, searchType: string = 'unified', page: number = 1, pageSize: number = 100): Promise<{ users: AssetUser[], pagination: PaginationInfo }> {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
  })
  if (search) {
    params.append('search', search)
    params.append('searchType', searchType)
  }
  
  const response = await fetch(`/api/users?${params.toString()}`)
  if (!response.ok) {
    throw new Error('Failed to fetch users')
  }
  const data = await response.json()
  return { users: data.users, pagination: data.pagination }
}

async function createUser(data: { email: string; password?: string; role: string; permissions?: UserPermissions }) {
  const response = await fetch('/api/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create user')
  }
  return response.json()
}

async function updateUser(id: string, data: { role: string; permissions?: UserPermissions; isActive?: boolean; isApproved?: boolean }) {
  const response = await fetch(`/api/users/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update user')
  }
  return response.json()
}

async function deleteUser(id: string) {
  const response = await fetch(`/api/users/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete user')
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

// Helper function to check if user is pending approval (never been approved)
const isPendingApproval = (user: AssetUser): boolean => {
  // A user is pending approval if they have never been approved
  // Approval status is separate from active/inactive status
  return !user.isApproved
}

// Create column definitions for TanStack Table
const createColumns = (
  onEdit: (user: AssetUser) => void,
  onDelete: (user: AssetUser) => void,
  onApprove: (user: AssetUser) => void
): ColumnDef<AssetUser>[] => [
  {
    accessorKey: 'userId',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          User ID
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
    cell: ({ row }) => <div className="font-medium">{row.original.userId}</div>,
    enableSorting: true,
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
    cell: ({ row }) => <div className="text-sm">{row.original.email || '-'}</div>,
    enableSorting: true,
  },
  {
    accessorKey: 'role',
    header: ({ column }) => {
      return (
        <div className="flex items-center justify-center">
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="h-8 px-2 hover:bg-transparent!"
        >
          Role
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
        </div>
      )
    },
    cell: ({ row }) => {
      const role = row.original.role
      return (
        <div className="flex items-center justify-center">
        <Badge variant={role === 'admin' ? 'default' : 'secondary'} className="gap-1.5">
          {role === 'admin' ? (
            <ShieldCheck className="h-3 w-3" />
          ) : (
            <Shield className="h-3 w-3" />
          )}
          {role.charAt(0).toUpperCase() + role.slice(1)}
        </Badge>
        </div>
      )
    },
    enableSorting: true,
  },
  {
    accessorKey: 'isActive',
    header: () => <div className="text-center">Status</div>,
    cell: ({ row }) => {
      const isActive = row.original.isActive
      return (
        <div className="flex items-center justify-center">
          {isActive ? (
            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-green-600">
              <Check className="h-2 w-2 text-white" />
            </div>
          ) : (
            <div className="flex h-4 w-4 items-center justify-center rounded-full bg-red-600">
              <X className="h-2 w-2 text-white" />
            </div>
          )}
        </div>
      )
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
    enableSorting: true,
  },
  {
    id: 'actions',
    header: () => <div className="text-center">Actions</div>,
    cell: ({ row }) => {
      const user = row.original
      return (
        <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-transparent!">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isPendingApproval(user) ? (
                <>
                  <DropdownMenuItem onClick={() => onApprove(user)}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve Account
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(user)}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => onEdit(user)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(user)}
                    className="text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    },
  },
]

export default function UsersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasPermission } = usePermissions()
  const canManageUsers = hasPermission('canManageUsers')
  
  const [sorting, setSorting] = useState<SortingState>([])
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<AssetUser | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [copiedPassword, setCopiedPassword] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isManualRefresh, setIsManualRefresh] = useState(false)
  const [, startTransition] = useTransition()
  
  // Fetch current user ID
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch('/api/auth/me')
        if (response.ok) {
          const data = await response.json()
          setCurrentUserId(data.user?.id || null)
        }
      } catch (error) {
        console.error('Failed to fetch current user:', error)
      }
    }
    fetchCurrentUser()
  }, [])
  
  const isEditingSelf = Boolean(selectedUser && currentUserId && selectedUser.userId === currentUserId)
  const isEditingSelfWithPermission = Boolean(isEditingSelf && canManageUsers)
  // React Hook Form for create user dialog
  const createForm = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: '',
      password: '',
      role: 'user',
      permissions: {
        canDeleteAssets: false,
        canManageImport: false,
        canManageExport: true,
        canCreateAssets: true,
        canEditAssets: true,
        canViewAssets: true,
        canManageEmployees: false,
        canManageCategories: false,
        canCheckout: true,
        canCheckin: true,
        canReserve: true,
        canMove: false,
        canLease: false,
        canDispose: false,
        canManageMaintenance: false,
        canAudit: false,
        canManageMedia: true,
        canManageTrash: true,
        canManageUsers: false,
        canManageReturnForms: false,
        canViewReturnForms: true,
        canManageAccountabilityForms: false,
        canViewAccountabilityForms: true,
        canManageReports: false,
      },
    },
  })

  // Keep formData state for edit dialog (not using react-hook-form for edit yet)
  const [formData, setFormData] = useState<{
    email: string
    password: string
    role: string
    isActive: boolean
    isApproved: boolean
    permissions: UserPermissions
  }>({
    email: '',
    password: '',
    role: 'user',
    isActive: true,
    isApproved: false,
    permissions: {
      canDeleteAssets: false,
      canManageImport: false,
      canManageExport: true,
      canCreateAssets: true,
      canEditAssets: true,
      canViewAssets: true,
      canManageEmployees: false,
      canManageCategories: false,
      canCheckout: true,
      canCheckin: true,
      canReserve: true,
      canMove: false,
      canLease: false,
      canDispose: false,
      canManageMaintenance: false,
      canAudit: false,
      canManageMedia: true,
      canManageTrash: true,
      canManageUsers: false,
      canManageReturnForms: false,
      canViewReturnForms: true,
      canManageAccountabilityForms: false,
      canViewAccountabilityForms: true,
      canManageReports: false,
    },
  })
  const queryClient = useQueryClient()

  // Get page, pageSize, and search from URL
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '100', 10)
  
  // Separate states for search input (immediate UI) and search query (debounced API calls)
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '')
  const [searchType, setSearchType] = useState<'unified' | 'userId' | 'email' | 'role'>(
    (searchParams.get('searchType') as 'unified' | 'userId' | 'email' | 'role') || 'unified'
  )
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSearchQueryRef = useRef<string>(searchParams.get('search') || '')
  const previousSearchInputRef = useRef<string>(searchParams.get('search') || '')

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
    
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false })
    })
  }, [searchParams, router, startTransition])

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['users', searchQuery, searchType, page, pageSize],
    queryFn: () => fetchUsers(searchQuery || undefined, searchType, page, pageSize),
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

  // Sync searchInput and searchType with URL params
  useEffect(() => {
    const urlSearch = searchParams.get('search') || ''
    const urlSearchType = (searchParams.get('searchType') as 'unified' | 'userId' | 'email' | 'role') || 'unified'
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
  
  useEffect(() => {
    lastSearchQueryRef.current = searchQuery
  }, [searchQuery])

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setIsCreateDialogOpen(false)
      createForm.reset()
      const emailSent = data?.emailSent !== false // Default to true if not specified
      if (emailSent) {
        toast.success('User created successfully. Login credentials have been sent to the user\'s email address.')
      } else {
        toast.success('User created successfully, but failed to send email. Please contact the user directly with their credentials.', {
          duration: 8000,
        })
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create user')
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { role: string; permissions?: UserPermissions; isActive?: boolean; isApproved?: boolean } }) =>
      updateUser(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      // Check if we were approving before clearing selectedUser
      const approvedEmail = selectedUser?.email
      const wasApproving = selectedUser && !selectedUser.isApproved && variables.data.isApproved
      setIsEditDialogOpen(false)
      setSelectedUser(null)
      setFormData({
        email: '',
        password: '',
        role: 'user',
        isActive: true,
        isApproved: false,
        permissions: {
          canDeleteAssets: false,
          canManageImport: false,
          canManageExport: true,
          canCreateAssets: true,
          canEditAssets: true,
          canViewAssets: true,
          canManageEmployees: false,
          canManageCategories: false,
          canCheckout: true,
          canCheckin: true,
          canReserve: true,
          canMove: false,
          canLease: false,
          canDispose: false,
          canManageMaintenance: false,
          canAudit: false,
          canManageMedia: true,
          canManageTrash: true,
          canManageUsers: false,
        canManageReturnForms: false,
        canViewReturnForms: true,
        canManageAccountabilityForms: false,
        canViewAccountabilityForms: true,
        canManageReports: false,
        },
      })
      if (wasApproving) {
        toast.success(`Account approved successfully. ${approvedEmail || 'User'} can now access the system.`)
      } else {
        toast.success('User updated successfully')
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update user')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setIsDeleteDialogOpen(false)
      setSelectedUser(null)
      toast.success('User deleted successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete user')
    },
  })

  const sendPasswordResetMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/users/${userId}/send-password-reset`, {
        method: 'POST',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send password reset email')
      }
      return response.json()
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Password reset email sent successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send password reset email')
    },
  })

  const handleCreate = createForm.handleSubmit((data) => {
    if (!canManageUsers) {
      toast.error('You do not have permission to create users')
      return
    }
    createMutation.mutate({
      email: data.email,
      password: data.password || undefined, // Password is optional (can be auto-generated)
      role: data.role,
      permissions: data.role === 'user' ? data.permissions : undefined,
    })
  })

  const handleEdit = useCallback((user: AssetUser) => {
    if (!canManageUsers) {
      toast.error('You do not have permission to edit users')
      return
    }
    setSelectedUser(user)
      setFormData({
        email: '', // Email is not editable, only shown in display
        password: '',
        role: user.role,
        isActive: user.isActive,
        isApproved: user.isApproved,
        permissions: {
        canDeleteAssets: user.canDeleteAssets,
        canManageImport: user.canManageImport,
        canManageExport: user.canManageExport,
        canCreateAssets: user.canCreateAssets,
        canEditAssets: user.canEditAssets,
        canViewAssets: user.canViewAssets,
        canManageEmployees: user.canManageEmployees,
        canManageCategories: user.canManageCategories,
        canCheckout: user.canCheckout,
        canCheckin: user.canCheckin,
        canReserve: user.canReserve,
        canMove: user.canMove,
        canLease: user.canLease,
        canDispose: user.canDispose,
        canManageMaintenance: user.canManageMaintenance,
        canAudit: user.canAudit,
        canManageMedia: user.canManageMedia ?? true,
        canManageTrash: user.canManageTrash ?? true,
        canManageUsers: user.canManageUsers ?? false,
        canManageReturnForms: user.canManageReturnForms ?? false,
        canViewReturnForms: user.canViewReturnForms ?? true,
        canManageAccountabilityForms: user.canManageAccountabilityForms ?? false,
        canViewAccountabilityForms: user.canViewAccountabilityForms ?? true,
        canManageReports: user.canManageReports ?? false,
      },
    })
    setIsEditDialogOpen(true)
  }, [canManageUsers])

  const handleUpdate = () => {
    if (!canManageUsers) {
      toast.error('You do not have permission to update users')
      return
    }
    if (!selectedUser || !formData.role) {
      toast.error('Role is required')
      return
    }
    
    // Prevent user from changing their own role if they have canManageUsers permission
    if (isEditingSelfWithPermission && formData.role !== selectedUser?.role) {
      toast.error('You cannot change your own role')
      return
    }
    
    // Prevent user from setting their own status to inactive
    if (isEditingSelf && !formData.isActive) {
      toast.error('You cannot set your own status to inactive')
      return
    }
    
    updateMutation.mutate({
      id: selectedUser.id,
      data: {
        role: formData.role,
        isActive: formData.isActive,
        isApproved: formData.isApproved,
        permissions: formData.role === 'user' ? formData.permissions : undefined,
      },
    })
  }

  const handleDelete = useCallback((user: AssetUser) => {
    if (!canManageUsers) {
      toast.error('You do not have permission to delete users')
      return
    }
    setSelectedUser(user)
    setIsDeleteDialogOpen(true)
  }, [canManageUsers])

  const handleApprove = useCallback((user: AssetUser) => {
    if (!canManageUsers) {
      toast.error('You do not have permission to approve users')
      return
    }
    // Open edit dialog with default permissions for admin to review and adjust
    // Admin can set permissions before approving the account
    setSelectedUser(user)
    const defaultPermissions: UserPermissions = {
      canDeleteAssets: false,
      canManageImport: false,
      canManageExport: true,
      canCreateAssets: true, // Default permissions for new users
      canEditAssets: true,
      canViewAssets: true,
      canManageEmployees: false,
      canManageCategories: false,
      canCheckout: true,
      canCheckin: true,
      canReserve: true,
      canMove: false,
      canLease: false,
      canDispose: false,
      canManageMaintenance: false,
      canAudit: false,
      canManageMedia: true,
      canManageTrash: true,
      canManageUsers: false,
      canManageReturnForms: false,
      canViewReturnForms: true,
      canManageAccountabilityForms: false,
      canViewAccountabilityForms: true,
      canManageReports: false,
    }
    setFormData({
      email: '', // Email is not editable, only shown in display
      password: '',
      role: user.role,
      isActive: true, // Pre-set to active for approval
      isApproved: true, // Mark as approved
      permissions: defaultPermissions,
    })
    setIsEditDialogOpen(true)
  }, [canManageUsers])

  const handleToggleAllPermissionsCreate = useCallback(() => {
    const currentPermissions = createForm.getValues('permissions')
    if (!currentPermissions) return
    
    const allSelected = Object.values(currentPermissions).every(Boolean)
    const newPermissions = Object.keys(currentPermissions).reduce((acc, key) => {
      acc[key as keyof typeof currentPermissions] = !allSelected
      return acc
    }, {} as typeof currentPermissions)
    createForm.setValue('permissions', newPermissions)
  }, [createForm])

  const handleToggleAllPermissions = useCallback(() => {
    const allSelected = 
      formData.permissions.canDeleteAssets &&
      formData.permissions.canManageImport &&
      formData.permissions.canManageExport &&
      formData.permissions.canCreateAssets &&
      formData.permissions.canEditAssets &&
      formData.permissions.canViewAssets &&
      formData.permissions.canManageEmployees &&
      formData.permissions.canManageCategories &&
      formData.permissions.canCheckout &&
      formData.permissions.canCheckin &&
      formData.permissions.canReserve &&
      formData.permissions.canMove &&
      formData.permissions.canLease &&
      formData.permissions.canDispose &&
      formData.permissions.canManageMaintenance &&
      formData.permissions.canAudit &&
      formData.permissions.canManageMedia &&
      formData.permissions.canManageTrash &&
      formData.permissions.canManageUsers &&
      formData.permissions.canManageReturnForms &&
      formData.permissions.canViewReturnForms &&
      formData.permissions.canManageAccountabilityForms &&
      formData.permissions.canViewAccountabilityForms

    setFormData({
      ...formData,
      permissions: {
        canDeleteAssets: !allSelected,
        canManageImport: !allSelected,
        canManageExport: !allSelected,
        canCreateAssets: !allSelected,
        canEditAssets: !allSelected,
        canViewAssets: !allSelected,
        canManageEmployees: !allSelected,
        canManageCategories: !allSelected,
        canCheckout: !allSelected,
        canCheckin: !allSelected,
        canReserve: !allSelected,
        canMove: !allSelected,
        canLease: !allSelected,
        canDispose: !allSelected,
        canManageMaintenance: !allSelected,
        canAudit: !allSelected,
        canManageMedia: !allSelected,
        canManageTrash: !allSelected,
        canManageUsers: !allSelected,
        canManageReturnForms: !allSelected,
        canViewReturnForms: !allSelected,
        canManageAccountabilityForms: !allSelected,
        canViewAccountabilityForms: !allSelected,
        canManageReports: !allSelected,
      },
    })
  }, [formData])

  const columns = useMemo(() => createColumns(handleEdit, handleDelete, handleApprove), [handleEdit, handleDelete, handleApprove])

  const users = useMemo(() => data?.users || [], [data?.users])
  const pagination = data?.pagination
  const table = useReactTable({
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  })

  return (
    <div className="space-y-6 max-h-screen">
      <div>
        <h1 className="text-3xl font-bold">Users</h1>
        <p className="text-muted-foreground">
          Manage user access and permissions for the Asset Management system
        </p>
      </div>

      <Card className="relative flex flex-col flex-1 min-h-0 pb-0 gap-0">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center w-full md:flex-1 md:max-w-md border rounded-md overflow-hidden">
              <Select
                value={searchType}
                onValueChange={(value: 'unified' | 'userId' | 'email' | 'role') => {
                  setSearchType(value)
                  updateURL({ searchType: value, page: 1 })
                }}
              >
                <SelectTrigger className="w-[140px] h-8 rounded-none border-0 border-r focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none" size='sm'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unified">Unified Search</SelectItem>
                  <SelectItem value="userId">User ID</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="role">Role</SelectItem>
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
                      ? 'Search by user ID, email or role...'
                      : searchType === 'userId'
                      ? 'Search by User ID'
                      : searchType === 'email'
                      ? 'Search by Email'
                      : 'Search by Role'
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
                  if (!canManageUsers) {
                    toast.error('You do not have permission to create users')
                    return
                  }
                  setIsCreateDialogOpen(true)
                }} 
                size="sm"
                className="flex-1 md:flex-initial"
              >
               <UserPlus className="mr-2 h-4 w-4" />
               Add User
             </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setIsManualRefresh(true)
                  queryClient.invalidateQueries({ queryKey: ['users'] })
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
            <div className="absolute left-0 right-[10px] top-[33px] bottom-0 bg-background/50 backdrop-blur-sm z-20 flex items-center justify-center">
              <Spinner variant="default" size={24} className="text-muted-foreground" />
            </div>
          )}
           <div className="h-140 pt-8">
           {isLoading && !data ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <Spinner className="h-8 w-8" />
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No users found</p>
                <p className="text-sm">Add your first user to get started</p>
              </div>
            ) : (
              <div className="min-w-full">
                <ScrollArea className='h-132 relative'>
                <div className="sticky top-0 z-30 h-px bg-border w-full"></div>
                <div className="pr-2.5 relative after:content-[''] after:absolute after:right-[10px] after:top-0 after:bottom-0 after:w-px after:bg-border after:z-50 after:h-full">
                <Table className='border-b'>
                  <TableHeader className="sticky -top-1 z-20 bg-card [&_tr]:border-b-0 -mr-2.5">
                    {table.getHeaderGroups().map((headerGroup: HeaderGroup<AssetUser>) => (
                      <TableRow key={headerGroup.id} className="group hover:bg-muted/50 relative border-b-0 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-[1.5px] after:h-px after:bg-border after:z-30">
                        {headerGroup.headers.map((header: Header<AssetUser, unknown>) => {
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
                    {table.getRowModel().rows?.length ? (
                      table.getRowModel().rows.map((row) => (
                        <TableRow 
                          key={row.id} 
                          data-state={row.getIsSelected() && 'selected'}
                          className="group relative"
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
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={columns.length} className="h-24 text-center">
                          No users found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                </div>
                <ScrollBar orientation="horizontal" />
                <ScrollBar orientation="vertical" className='z-50' />
                </ScrollArea>
              </div>
            )}
           </div>
        </CardContent>
        
        {/* Pagination Bar - Fixed at Bottom */}
        <div className="sticky bottom-0 border-t bg-card z-10 shadow-sm mt-auto">
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
                  <SelectItem value="100">100 rows</SelectItem>
                  <SelectItem value="200">200 rows</SelectItem>
                  <SelectItem value="300">300 rows</SelectItem>
                  <SelectItem value="400">400 rows</SelectItem>
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

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        setIsCreateDialogOpen(open)
        if (!open) {
          setShowPassword(false)
          setCopiedPassword(false)
          createForm.reset()
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user with role and permissions.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="grid gap-4 py-4">
              <Field>
                <FieldLabel htmlFor="email">
                  Email <span className="text-destructive">*</span>
                </FieldLabel>
                <FieldContent>
                  <Controller
                    name="email"
                    control={createForm.control}
                    render={({ field, fieldState }) => (
                      <>
                        <Input
                          id="email"
                          type="email"
                          {...field}
                          placeholder="Enter user email"
                          aria-invalid={fieldState.error ? 'true' : 'false'}
                        />
                        {fieldState.error && (
                          <FieldError>{fieldState.error.message}</FieldError>
                        )}
                      </>
                    )}
                  />
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel htmlFor="password">
                  Password <span className="text-muted-foreground text-xs">(optional - will be auto-generated if not provided)</span>
                </FieldLabel>
                <FieldContent>
                  <Controller
                    name="password"
                    control={createForm.control}
                    render={({ field, fieldState }) => (
                      <>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Input
                              id="password"
                              type={showPassword ? "text" : "password"}
                              {...field}
                              placeholder="Enter password or click Generate"
                              className="pr-20"
                              aria-invalid={fieldState.error ? 'true' : 'false'}
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setShowPassword(!showPassword)}
                              >
                                {showPassword ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                              {field.value && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(field.value || '')
                                      setCopiedPassword(true)
                                      setTimeout(() => setCopiedPassword(false), 2000)
                                    } catch {
                                      toast.error('Failed to copy password')
                                    }
                                  }}
                                >
                                  {copiedPassword ? (
                                    <span className="text-xs text-green-600">✓</span>
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              // Generate random password
                              const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?/~`'
                              let password = ''
                              for (let i = 0; i < 12; i++) {
                                password += charset.charAt(Math.floor(Math.random() * charset.length))
                              }
                              createForm.setValue('password', password)
                            }}
                          >
                            Generate
                          </Button>
                        </div>
                        {fieldState.error && (
                          <FieldError>{fieldState.error.message}</FieldError>
                        ) }
                      </>
                    )}
                  />
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel htmlFor="role">
                  Role <span className="text-destructive">*</span>
                </FieldLabel>
                <FieldContent>
                  <Controller
                    name="role"
                    control={createForm.control}
                    render={({ field, fieldState }) => (
                      <>
                        <Select
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value)
                            // Reset permissions when role changes
                            if (value === 'admin') {
                              createForm.setValue('permissions', undefined)
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin (Full Access)</SelectItem>
                            <SelectItem value="user">User (Custom Permissions)</SelectItem>
                          </SelectContent>
                        </Select>
                        {fieldState.error && (
                          <FieldError>{fieldState.error.message}</FieldError>
                        )}
                      </>
                    )}
                  />
                </FieldContent>
              </Field>

              {createForm.watch('role') === 'user' && (
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Permissions</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleToggleAllPermissionsCreate}
                  >
                    {(() => {
                      const permissions = createForm.watch('permissions')
                      if (!permissions) return 'Select All'
                      const allSelected = Object.values(permissions).every(Boolean)
                      return allSelected ? 'Deselect All' : 'Select All'
                    })()}
                  </Button>
                </div>
                <Controller
                  name="permissions"
                  control={createForm.control}
                  render={({ field, fieldState }) => (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          { key: 'canViewAssets', label: 'View Assets' },
                          { key: 'canCreateAssets', label: 'Create Assets' },
                          { key: 'canEditAssets', label: 'Edit Assets' },
                          { key: 'canDeleteAssets', label: 'Delete Assets' },
                          { key: 'canManageImport', label: 'Manage Import' },
                          { key: 'canManageExport', label: 'Manage Export' },
                          { key: 'canCheckout', label: 'Checkout Assets' },
                          { key: 'canCheckin', label: 'Checkin Assets' },
                          { key: 'canReserve', label: 'Reserve Assets' },
                          { key: 'canMove', label: 'Move Assets' },
                          { key: 'canLease', label: 'Lease Assets' },
                          { key: 'canDispose', label: 'Dispose Assets' },
                          { key: 'canManageEmployees', label: 'Manage Employees' },
                          { key: 'canManageCategories', label: 'Manage Categories' },
                          { key: 'canManageMaintenance', label: 'Manage Maintenance' },
                          { key: 'canAudit', label: 'Perform Audits' },
                          { key: 'canManageMedia', label: 'Manage Media' },
                          { key: 'canManageTrash', label: 'Manage Trash' },
                          { key: 'canManageUsers', label: 'Manage Users' },
                          { key: 'canManageReturnForms', label: 'Manage Return Forms' },
                          { key: 'canViewReturnForms', label: 'View Return Forms' },
                          { key: 'canManageAccountabilityForms', label: 'Manage Accountability Forms' },
                          { key: 'canViewAccountabilityForms', label: 'View Accountability Forms' },
                        ].map(({ key, label }) => (
                          <div key={key} className="flex items-center space-x-2">
                            <Checkbox
                              id={key}
                              checked={field.value?.[key as keyof typeof field.value] || false}
                              onCheckedChange={(checked) => {
                                const currentPermissions = field.value || {}
                                field.onChange({
                                  ...currentPermissions,
                                  [key]: checked as boolean,
                                })
                              }}
                            />
                            <Label htmlFor={key} className="cursor-pointer">{label}</Label>
                          </div>
                        ))}
                      </div>
                      {fieldState.error && (
                        <FieldError>{fieldState.error.message}</FieldError>
                      )}
                    </>
                  )}
                />
              </div>
            )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Creating...
                  </>
                ) : (
                  'Create'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl! max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedUser && isPendingApproval(selectedUser) ? 'Approve User Account' : 'Edit User'}
            </DialogTitle>
            <DialogDescription>
              {selectedUser && isPendingApproval(selectedUser) 
                ? 'Set permissions and approve this account. The user will be able to access the system once approved.'
                : 'Update user role, status, and permissions.'}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className='h-[70vh]'>
          <div className="grid gap-4 py-4">
            <Field>
              <FieldLabel>Account Information</FieldLabel>
              <FieldContent>
                <div className="space-y-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-email" className="text-xs font-medium text-muted-foreground">
                      Email Address
                    </Label>
                    <Input
                      id="edit-email"
                      value={selectedUser?.email || 'N/A'}
                      disabled
                      className="bg-muted font-mono text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="edit-userId" className="text-xs font-medium text-muted-foreground">
                      User ID
                    </Label>
                    <Input
                      id="edit-userId"
                      value={selectedUser?.userId || ''}
                      disabled
                      className="bg-muted font-mono text-sm"
                    />
                  </div>
                </div>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-role">
                Role <span className="text-destructive">*</span>
                {isEditingSelfWithPermission && (
                  <span className="text-sm text-muted-foreground ml-2">
                    (You cannot change your own role)
                  </span>
                )}
              </FieldLabel>
              <FieldContent>
                <Select
                  value={formData.role}
                  onValueChange={(value) => {
                    // Prevent changing own role if editing self
                    if (isEditingSelfWithPermission && formData.role !== value) {
                      toast.error('You cannot change your own role')
                      return
                    }
                    setFormData({ ...formData, role: value })
                  }}
                  disabled={isEditingSelf}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin (Full Access)</SelectItem>
                    <SelectItem 
                      value="user"
                      disabled={isEditingSelf}
                    >
                      User (Custom Permissions)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-isActive">
                Status
                {isEditingSelf && (
                  <span className="text-sm text-muted-foreground ml-2">
                    (You cannot set your own status to inactive)
                  </span>
                )}
              </FieldLabel>
              <FieldContent>
                <Select
                  value={formData.isActive ? 'active' : 'inactive'}
                  onValueChange={(value) => {
                    // Prevent setting status to inactive if editing self
                    if (isEditingSelf && value === 'inactive') {
                      toast.error('You cannot set your own status to inactive')
                      return
                    }
                    setFormData({ ...formData, isActive: value === 'active' })
                  }}
                  disabled={isEditingSelf && formData.isActive}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem 
                      value="inactive"
                      disabled={isEditingSelf}
                    >
                      Inactive
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel>Password Reset</FieldLabel>
              <FieldContent>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!selectedUser) return
                    if (!canManageUsers) {
                      toast.error('You do not have permission to send password reset emails')
                      return
                    }
                    sendPasswordResetMutation.mutate(selectedUser.id)
                  }}
                  disabled={sendPasswordResetMutation.isPending || !selectedUser}
                  className="w-full"
                >
                  {sendPasswordResetMutation.isPending ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Send Password Reset Email
                    </>
                  )}
                </Button>
              </FieldContent>
            </Field>

            {formData.role === 'user' && (
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Permissions</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleToggleAllPermissions}
                  >
                    {formData.permissions.canDeleteAssets &&
                    formData.permissions.canManageImport &&
                    formData.permissions.canManageExport &&
                    formData.permissions.canCreateAssets &&
                    formData.permissions.canEditAssets &&
                    formData.permissions.canViewAssets &&
                    formData.permissions.canManageEmployees &&
                    formData.permissions.canManageCategories &&
                    formData.permissions.canCheckout &&
                    formData.permissions.canCheckin &&
                    formData.permissions.canReserve &&
                    formData.permissions.canMove &&
                    formData.permissions.canLease &&
                    formData.permissions.canDispose &&
                    formData.permissions.canManageMaintenance &&
                    formData.permissions.canAudit &&
                    formData.permissions.canManageMedia &&
                    formData.permissions.canManageTrash &&
                    formData.permissions.canManageUsers
                      ? 'Deselect All'
                      : 'Select All'}
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-canViewAssets"
                      checked={formData.permissions.canViewAssets}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canViewAssets: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="edit-canViewAssets" className="cursor-pointer">View Assets</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-canCreateAssets"
                      checked={formData.permissions.canCreateAssets}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canCreateAssets: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="edit-canCreateAssets" className="cursor-pointer">Create Assets</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-canEditAssets"
                      checked={formData.permissions.canEditAssets}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canEditAssets: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="edit-canEditAssets" className="cursor-pointer">Edit Assets</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-canDeleteAssets"
                      checked={formData.permissions.canDeleteAssets}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canDeleteAssets: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="edit-canDeleteAssets" className="cursor-pointer">Delete Assets</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-canManageImport"
                      checked={formData.permissions.canManageImport}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canManageImport: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="edit-canManageImport" className="cursor-pointer">Manage Import</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-canManageExport"
                      checked={formData.permissions.canManageExport}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canManageExport: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="edit-canManageExport" className="cursor-pointer">Manage Export</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-canCheckout"
                      checked={formData.permissions.canCheckout}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canCheckout: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="edit-canCheckout" className="cursor-pointer">Checkout Assets</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-canCheckin"
                      checked={formData.permissions.canCheckin}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canCheckin: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="edit-canCheckin" className="cursor-pointer">Checkin Assets</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-canReserve"
                      checked={formData.permissions.canReserve}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canReserve: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="edit-canReserve" className="cursor-pointer">Reserve Assets</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-canMove"
                      checked={formData.permissions.canMove}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canMove: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="edit-canMove" className="cursor-pointer">Move Assets</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-canLease"
                      checked={formData.permissions.canLease}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canLease: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="edit-canLease" className="cursor-pointer">Lease Assets</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-canDispose"
                      checked={formData.permissions.canDispose}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canDispose: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="edit-canDispose" className="cursor-pointer">Dispose Assets</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-canManageEmployees"
                      checked={formData.permissions.canManageEmployees}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canManageEmployees: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="edit-canManageEmployees" className="cursor-pointer">Manage Employees</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-canManageCategories"
                      checked={formData.permissions.canManageCategories}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canManageCategories: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="edit-canManageCategories" className="cursor-pointer">Manage Categories</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-canManageMaintenance"
                      checked={formData.permissions.canManageMaintenance}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canManageMaintenance: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="edit-canManageMaintenance" className="cursor-pointer">Manage Maintenance</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-canAudit"
                      checked={formData.permissions.canAudit}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canAudit: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="edit-canAudit" className="cursor-pointer">Perform Audits</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-canManageMedia"
                      checked={formData.permissions.canManageMedia}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canManageMedia: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="edit-canManageMedia" className="cursor-pointer">Manage Media</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-canManageTrash"
                      checked={formData.permissions.canManageTrash}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canManageTrash: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="edit-canManageTrash" className="cursor-pointer">Manage Trash</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-canManageUsers"
                      checked={formData.permissions.canManageUsers}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canManageUsers: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="edit-canManageUsers" className="cursor-pointer">Manage Users</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-canManageReturnForms"
                      checked={formData.permissions.canManageReturnForms}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canManageReturnForms: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="edit-canManageReturnForms" className="cursor-pointer">Manage Return Forms</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-canViewReturnForms"
                      checked={formData.permissions.canViewReturnForms}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canViewReturnForms: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="edit-canViewReturnForms" className="cursor-pointer">View Return Forms</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-canManageAccountabilityForms"
                      checked={formData.permissions.canManageAccountabilityForms}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canManageAccountabilityForms: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="edit-canManageAccountabilityForms" className="cursor-pointer">Manage Accountability Forms</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-canViewAccountabilityForms"
                      checked={formData.permissions.canViewAccountabilityForms}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canViewAccountabilityForms: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="edit-canViewAccountabilityForms" className="cursor-pointer">View Accountability Forms</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="edit-canManageReports"
                      checked={formData.permissions.canManageReports}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canManageReports: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="edit-canManageReports" className="cursor-pointer">Manage Reports</Label>
                  </div>
                </div>
              </div>
            )}
          </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  {selectedUser && isPendingApproval(selectedUser) ? 'Approving...' : 'Updating...'}
                </>
              ) : (
                selectedUser && isPendingApproval(selectedUser) ? 'Approve Account' : 'Update User'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={() => {
          if (selectedUser) {
            deleteMutation.mutate(selectedUser.id)
          }
        }}
        title="Delete User"
        description={`Are you sure you want to delete user "${selectedUser?.email || selectedUser?.userId || 'this user'}"? This action cannot be undone.`}
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}

