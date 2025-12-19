import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase-client'

const getApiBaseUrl = () => {
  const useFastAPI = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true'
  const fastApiUrl = process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000'
  return useFastAPI ? fastApiUrl : ''
}

const getAuthToken = async (): Promise<string | null> => {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  } catch {
    return null
  }
}

export interface UserPermissions {
  canDeleteAssets?: boolean
  canManageImport?: boolean
  canManageExport?: boolean
  canCreateAssets?: boolean
  canEditAssets?: boolean
  canViewAssets?: boolean
  canManageEmployees?: boolean
  canManageSetup?: boolean
  canCheckout?: boolean
  canCheckin?: boolean
  canReserve?: boolean
  canMove?: boolean
  canLease?: boolean
  canDispose?: boolean
  canManageMaintenance?: boolean
  canAudit?: boolean
  canManageMedia?: boolean
  canManageTrash?: boolean
  canManageUsers?: boolean
  canManageReturnForms?: boolean
  canViewReturnForms?: boolean
  canManageAccountabilityForms?: boolean
  canViewAccountabilityForms?: boolean
  canManageReports?: boolean
  canManageInventory?: boolean
}

export interface AssetUser {
  id: string
  userId: string
  email?: string
  name?: string | null
  role: string
  isActive: boolean
  isApproved: boolean
  canDeleteAssets: boolean
  canManageImport: boolean
  canManageExport: boolean
  canCreateAssets: boolean
  canEditAssets: boolean
  canViewAssets: boolean
  canManageEmployees: boolean
  canManageSetup: boolean
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
  canManageInventory: boolean
  createdAt?: string
  updatedAt?: string
}

export interface PaginationInfo {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface UsersResponse {
  users: AssetUser[]
  pagination: PaginationInfo
}

export interface CreateUserData {
  email: string
  password?: string
  role: string
  name?: string
  permissions?: UserPermissions
}

export interface UpdateUserData {
  role: string
  name?: string | null
  permissions?: UserPermissions
  isActive?: boolean
  isApproved?: boolean
}

// Hook to fetch users with pagination and search
export const useUsers = (params: {
  search?: string
  searchType?: string
  role?: string
  page?: number
  pageSize?: number
}) => {
  return useQuery<UsersResponse>({
    queryKey: ['users', params],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl()
      const token = await getAuthToken()

      const searchParams = new URLSearchParams()
      if (params.search) searchParams.set('search', params.search)
      if (params.searchType) searchParams.set('searchType', params.searchType)
      if (params.role) searchParams.set('role', params.role)
      if (params.page) searchParams.set('page', params.page.toString())
      if (params.pageSize) searchParams.set('pageSize', params.pageSize.toString())

      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${baseUrl}/api/users?${searchParams.toString()}`, {
        headers,
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || error.error || 'Failed to fetch users')
      }

      return response.json()
    },
  })
}

// Hook to fetch a single user
export const useUser = (userId: string) => {
  return useQuery<{ user: AssetUser }>({
    queryKey: ['user', userId],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl()
      const token = await getAuthToken()

      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${baseUrl}/api/users/${userId}`, {
        headers,
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || error.error || 'Failed to fetch user')
      }

      return response.json()
    },
    enabled: !!userId,
  })
}

// Hook to create a user
export const useCreateUser = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateUserData) => {
      const baseUrl = getApiBaseUrl()
      const token = await getAuthToken()

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${baseUrl}/api/users`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || error.error || 'Failed to create user')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

// Hook to update a user
export const useUpdateUser = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: UpdateUserData }) => {
      const baseUrl = getApiBaseUrl()
      const token = await getAuthToken()

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${baseUrl}/api/users/${userId}`, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || error.error || 'Failed to update user')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

// Hook to delete a user
export const useDeleteUser = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string) => {
      const baseUrl = getApiBaseUrl()
      const token = await getAuthToken()

      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${baseUrl}/api/users/${userId}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || error.error || 'Failed to delete user')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

// Hook to send password reset email
export const useSendPasswordReset = () => {
  return useMutation({
    mutationFn: async (userId: string) => {
      const baseUrl = getApiBaseUrl()
      const token = await getAuthToken()

      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${baseUrl}/api/users/${userId}/send-password-reset`, {
        method: 'POST',
        headers,
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || error.error || 'Failed to send password reset email')
      }

      return response.json()
    },
  })
}

