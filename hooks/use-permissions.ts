import { useQuery } from '@tanstack/react-query'

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
}

export function usePermissions() {
  const { data, isLoading, error } = useQuery<UserPermissions>({
    queryKey: ['user-permissions'],
    queryFn: async () => {
      const response = await fetch('/api/auth/me')
      if (!response.ok) {
        throw new Error('Failed to fetch user permissions')
      }
      const data = await response.json()
      return data.permissions || null
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
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

