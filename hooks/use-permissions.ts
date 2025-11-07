import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

interface UserPermissions {
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
}

export function usePermissions() {
  const router = useRouter()
  
  const { data, isLoading, error } = useQuery<UserPermissions>({
    queryKey: ['user-permissions'],
    queryFn: async () => {
      const response = await fetch('/api/auth/me')
      
      // Handle inactive user (403 with isActive: false)
      if (response.status === 403) {
        const errorData = await response.json().catch(() => ({}))
        if (errorData.isActive === false) {
          // User is inactive, automatically log them out
          try {
            await fetch('/api/auth/logout', { method: 'POST' })
          } catch (logoutError) {
            console.error('Logout failed:', logoutError)
          }
          // Redirect to login with message
          router.push('/login?message=Your account has been deactivated. Please contact your administrator.')
          throw new Error('User account is inactive')
        }
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch user permissions')
      }
      const data = await response.json()
      return data.permissions || null
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry on auth errors
  })

  const hasPermission = (permission: keyof Omit<UserPermissions, 'role'>): boolean => {
    if (!data) return false
    if (data.role === 'admin') return true
    return data[permission] === true
  }

  const isAdmin = data?.role === 'admin'

  return {
    permissions: data,
    isLoading,
    error,
    hasPermission,
    isAdmin,
  }
}

