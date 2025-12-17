/**
 * Layout-level data hook for user profile, roles, and permissions
 * Uses React Query for caching and automatic refetching
 * Shared across all components that need user data
 */

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

const getApiBaseUrl = () => {
  const useFastAPI = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true'
  const fastApiUrl = process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000'
  return useFastAPI ? fastApiUrl : ''
}

async function getAuthToken(): Promise<string | null> {
  try {
    const supabase = createClient()
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) {
      console.error('Failed to get auth token:', error)
      return null
    }
    return session?.access_token || null
  } catch (error) {
    console.error('Failed to get auth token:', error)
    return null
  }
}

export interface UserProfile {
  id: string
  email: string
  name: string
  avatar?: string
  role: string
  isActive: boolean
}

export interface UserPermissions {
  role: string
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
}

export interface UserData {
  profile: UserProfile
  permissions: UserPermissions
}

/**
 * Unified hook for layout-level user data
 * Fetches user profile, role, and permissions in a single request
 * Cached globally and shared across all components
 */
export function useUserProfile() {
  const router = useRouter()

  const { data, isLoading, error, refetch } = useQuery<UserData>({
    queryKey: ['user-profile'], // Global cache key - shared across all components
    queryFn: async () => {
      const baseUrl = getApiBaseUrl()
      const token = await getAuthToken()
      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(`${baseUrl}/api/auth/me`, {
        credentials: 'include', // Send cookies for authentication (fallback)
        headers,
      })

      // Handle inactive user (403 with isActive: false)
      if (response.status === 403) {
        const errorData = await response.json().catch(() => ({}))
        if (errorData.isActive === false) {
          // User is inactive, automatically log them out
          try {
            const logoutBaseUrl = getApiBaseUrl()
            const logoutToken = await getAuthToken()
            const logoutHeaders: HeadersInit = {}
            if (logoutToken) {
              logoutHeaders['Authorization'] = `Bearer ${logoutToken}`
            }
            await fetch(`${logoutBaseUrl}/api/auth/logout`, { 
              method: 'POST',
              credentials: 'include',
              headers: logoutHeaders
            })
          } catch (logoutError) {
            console.error('Logout failed:', logoutError)
          }
          // Redirect to login with message
          router.push('/login?message=Your account has been deactivated. Please contact your administrator.')
          throw new Error('User account is inactive')
        }
      }

      if (!response.ok) {
        throw new Error('Failed to fetch user data')
      }

      const data = await response.json()
      
      return {
        profile: {
          id: data.user?.id || '',
          email: data.user?.email || '',
          name: data.user?.name || data.user?.user_metadata?.name || data.user?.user_metadata?.full_name || '',
          avatar: data.user?.user_metadata?.avatar_url || '',
          role: data.role || 'user',
          isActive: data.isActive !== false,
        },
        permissions: data.permissions || null,
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - data doesn't change often
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache longer
    retry: false, // Don't retry on auth errors
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchOnMount: false, // Don't refetch on every mount (use cache)
  })

  const hasPermission = (permission: keyof Omit<UserPermissions, 'role'>): boolean => {
    if (!data?.permissions) return false
    if (data.permissions.role === 'admin') return true
    return data.permissions[permission] === true
  }

  const isAdmin = data?.permissions?.role === 'admin'

  return {
    profile: data?.profile,
    permissions: data?.permissions,
    isLoading,
    error,
    hasPermission,
    isAdmin,
    refetch, // Expose refetch for manual updates
  }
}

