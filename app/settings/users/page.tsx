'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo, useCallback, useEffect, useRef, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
import { MoreHorizontal, Trash2, Edit, Search, UserPlus, ArrowUpDown, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Shield, ShieldCheck, Eye, EyeOff, Copy, Check, X, CheckCircle, RotateCw } from 'lucide-react'
import { toast } from 'sonner'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { Badge } from '@/components/ui/badge'
import { Field, FieldLabel, FieldContent } from '@/components/ui/field'
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
}

async function fetchUsers(search?: string, role?: string, page: number = 1, pageSize: number = 100): Promise<{ users: AssetUser[], pagination: PaginationInfo }> {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
  })
  if (search) params.append('search', search)
  if (role && role !== 'all') params.append('role', role)
  
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
  onApprove: (user: AssetUser) => void,
  canManageUsers: boolean
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
              <Button variant="ghost" className="h-8 w-8 p-0">
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
  const { hasPermission, isLoading: permissionsLoading, permissions } = usePermissions()
  const canManageUsers = hasPermission('canManageUsers')
  
  const [sorting, setSorting] = useState<SortingState>([])
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<AssetUser | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [copiedPassword, setCopiedPassword] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  
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
  const [formData, setFormData] = useState({
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
    },
  })
  const queryClient = useQueryClient()

  // Get page, pageSize, search, and role from URL
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '100', 10)
  const roleFilter = searchParams.get('role') || 'all'
  
  // Separate states for search input (immediate UI) and search query (debounced API calls)
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '')
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSearchQueryRef = useRef<string>(searchParams.get('search') || '')
  const previousSearchInputRef = useRef<string>(searchParams.get('search') || '')

  // Update URL parameters
  const updateURL = useCallback((updates: { page?: number; pageSize?: number; search?: string; role?: string }) => {
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
      } else {
        params.set('search', updates.search)
      }
      params.delete('page')
    }

    if (updates.role !== undefined) {
      if (updates.role === 'all') {
        params.delete('role')
      } else {
        params.set('role', updates.role)
      }
      params.delete('page')
    }
    
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false })
    })
  }, [searchParams, router, startTransition])

  const { data, isLoading } = useQuery({
    queryKey: ['users', searchQuery, roleFilter, page, pageSize],
    queryFn: () => fetchUsers(searchQuery || undefined, roleFilter !== 'all' ? roleFilter : undefined, page, pageSize),
  })

  const handlePageSizeChange = (newPageSize: string) => {
    updateURL({ pageSize: parseInt(newPageSize), page: 1 })
  }

  const handlePageChange = (newPage: number) => {
    updateURL({ page: newPage })
  }

  const handleRoleFilterChange = (newRole: string) => {
    updateURL({ role: newRole, page: 1 })
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

  // Sync searchInput with URL params
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

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setIsCreateDialogOpen(false)
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
        },
      })
      if (data.generatedPassword) {
        toast.success(`User created successfully. Generated password: ${data.generatedPassword}`, {
          duration: 15000,
        })
      } else {
        toast.success('User created successfully')
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
      const wasApproving = selectedUser && !selectedUser.isApproved && variables.data.isApproved
      const approvedEmail = selectedUser?.email
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

  const handleCreate = () => {
    if (!canManageUsers) {
      toast.error('You do not have permission to create users')
      return
    }
    if (!formData.email) {
      toast.error('Email is required')
      return
    }
    if (!formData.password) {
      toast.error('Password is required')
      return
    }
    createMutation.mutate({
      email: formData.email,
      password: formData.password,
      role: formData.role,
      permissions: formData.role === 'user' ? formData.permissions : undefined,
    })
  }

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
    
    // Check if this is an approval action (user was not approved before, now being approved)
    const wasApproving = selectedUser && !selectedUser.isApproved && formData.isApproved
    
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
    const defaultPermissions = {
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
      formData.permissions.canManageUsers

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
      },
    })
  }, [formData])

  const columns = useMemo(() => createColumns(handleEdit, handleDelete, handleApprove, canManageUsers), [handleEdit, handleDelete, handleApprove, canManageUsers])

  const users = useMemo(() => data?.users || [], [data?.users])
  const pagination = data?.pagination
// eslint-disable-next-line react-hooks/incompatible-library
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Users</h1>
        <p className="text-muted-foreground">
          Manage user access and permissions for the Asset Management system
        </p>
      </div>

      <Card className="gap-0 ">
        <CardHeader className="shrink-0 pb-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <CardTitle>Users Management</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                View and manage system users, roles, and permissions
              </CardDescription>
            </div>
            <div className="flex gap-2 sm:gap-3 items-center">
              
              
              <Button 
                onClick={() => {
                  if (!canManageUsers) {
                    toast.error('You do not have permission to create users')
                    return
                  }
                  setIsCreateDialogOpen(true)
                }} 
                size="sm"
              >
               <UserPlus className="mr-2 h-4 w-4" />
               Add User
             </Button>
              <Button
                variant="outline"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['users'] })
                  toast.success('Users list refreshed')
                }}
                disabled={isLoading}
                size="sm"
              >
                <RotateCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          <div className="relative flex items-center gap-2 mt-3 w-full md:w-sm">
            <div className="relative flex-1 sm:flex-initial sm:min-w-[250px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by user ID or email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-8"
              />
              
            </div>
            <Select value={roleFilter} onValueChange={handleRoleFilterChange}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
          </div>
        </CardHeader>

        <CardContent className='px-0'>
            {isLoading ? (
              <div className="h-[calc(100vh-25rem)] min-h-[500px] flex items-center justify-center py-12">
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
                <ScrollArea className='h-[calc(100vh-25rem)] min-h-[500px] '>
                <Table className='border-t'>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => {
                          const isActionsColumn = header.column.id === 'actions'
                          return (
                            <TableHead 
                              key={header.id}
                              className={cn(
                                isActionsColumn ? "text-center" : "text-left",
                                isActionsColumn && "sticky right-0 bg-card z-10"
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
                        >
                          {row.getVisibleCells().map((cell) => {
                            const isActionsColumn = cell.column.id === 'actions'
                            return (
                              <TableCell 
                                key={cell.id}
                                className={cn(
                                  isActionsColumn && "sticky right-0 bg-card z-10 "
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
                <ScrollBar orientation="horizontal" />
                <ScrollBar orientation="vertical" className='z-10' />
                </ScrollArea>
              </div>
            )}
        </CardContent>
        
        {/* Pagination Bar */}
        <div className="sticky bottom-0 border-t bg-transparent z-10 shadow-sm mt-auto">
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
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user with role and permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Field>
              <FieldLabel htmlFor="email">
                Email <span className="text-destructive">*</span>
              </FieldLabel>
              <FieldContent>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter user email"
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="password">
                Password <span className="text-destructive">*</span>
              </FieldLabel>
              <FieldContent>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Enter password or click Generate"
                      className="pr-20"
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
                      {formData.password && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(formData.password)
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
                      setFormData({ ...formData, password })
                    }}
                  >
                    Generate
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Password must be at least 6 characters long
                </p>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="role">
                Role <span className="text-destructive">*</span>
              </FieldLabel>
              <FieldContent>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin (Full Access)</SelectItem>
                    <SelectItem value="user">User (Custom Permissions)</SelectItem>
                  </SelectContent>
                </Select>
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
                      id="canViewAssets"
                      checked={formData.permissions.canViewAssets}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canViewAssets: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="canViewAssets" className="cursor-pointer">View Assets</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="canCreateAssets"
                      checked={formData.permissions.canCreateAssets}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canCreateAssets: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="canCreateAssets" className="cursor-pointer">Create Assets</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="canEditAssets"
                      checked={formData.permissions.canEditAssets}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canEditAssets: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="canEditAssets" className="cursor-pointer">Edit Assets</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="canDeleteAssets"
                      checked={formData.permissions.canDeleteAssets}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canDeleteAssets: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="canDeleteAssets" className="cursor-pointer">Delete Assets</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="canManageImport"
                      checked={formData.permissions.canManageImport}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canManageImport: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="canManageImport" className="cursor-pointer">Manage Import</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="canManageExport"
                      checked={formData.permissions.canManageExport}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canManageExport: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="canManageExport" className="cursor-pointer">Manage Export</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="canCheckout"
                      checked={formData.permissions.canCheckout}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canCheckout: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="canCheckout" className="cursor-pointer">Checkout Assets</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="canCheckin"
                      checked={formData.permissions.canCheckin}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canCheckin: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="canCheckin" className="cursor-pointer">Checkin Assets</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="canReserve"
                      checked={formData.permissions.canReserve}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canReserve: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="canReserve" className="cursor-pointer">Reserve Assets</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="canMove"
                      checked={formData.permissions.canMove}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canMove: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="canMove" className="cursor-pointer">Move Assets</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="canLease"
                      checked={formData.permissions.canLease}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canLease: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="canLease" className="cursor-pointer">Lease Assets</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="canDispose"
                      checked={formData.permissions.canDispose}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canDispose: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="canDispose" className="cursor-pointer">Dispose Assets</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="canManageEmployees"
                      checked={formData.permissions.canManageEmployees}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canManageEmployees: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="canManageEmployees" className="cursor-pointer">Manage Employees</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="canManageCategories"
                      checked={formData.permissions.canManageCategories}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canManageCategories: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="canManageCategories" className="cursor-pointer">Manage Categories</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="canManageMaintenance"
                      checked={formData.permissions.canManageMaintenance}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canManageMaintenance: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="canManageMaintenance" className="cursor-pointer">Manage Maintenance</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="canAudit"
                      checked={formData.permissions.canAudit}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canAudit: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="canAudit" className="cursor-pointer">Perform Audits</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="canManageMedia"
                      checked={formData.permissions.canManageMedia}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canManageMedia: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="canManageMedia" className="cursor-pointer">Manage Media</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="canManageTrash"
                      checked={formData.permissions.canManageTrash}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canManageTrash: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="canManageTrash" className="cursor-pointer">Manage Trash</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="canManageUsers"
                      checked={formData.permissions.canManageUsers}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          permissions: { ...formData.permissions, canManageUsers: checked as boolean },
                        })
                      }
                    />
                    <Label htmlFor="canManageUsers" className="cursor-pointer">Manage Users</Label>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
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
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
          <div className="grid gap-4 py-4">
            <Field>
              <FieldLabel htmlFor="edit-userId">User ID</FieldLabel>
              <FieldContent>
                <Input
                  id="edit-userId"
                  value={selectedUser?.userId || ''}
                  disabled
                  className="bg-muted"
                />
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
                </div>
              </div>
            )}
          </div>
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
        description={`Are you sure you want to delete user "${selectedUser?.userId}"? This action cannot be undone.`}
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}

