/**
 * @deprecated Use useUserProfile() instead for unified user data
 * This hook is kept for backward compatibility
 * All new code should use useUserProfile()
 */
import { useUserProfile } from './use-user-profile'

export function usePermissions() {
  const { permissions, isLoading, error, hasPermission, isAdmin } = useUserProfile()

  return {
    permissions,
    isLoading,
    error,
    hasPermission,
    isAdmin,
  }
}

