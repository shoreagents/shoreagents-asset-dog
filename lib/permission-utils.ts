import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { NextResponse } from 'next/server'

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
}

interface AssetUser {
  role: string
  isActive: boolean
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

/**
 * Get current user's permissions from database
 */
export async function getUserPermissions(): Promise<{ user: AssetUser | null; error: NextResponse | null }> {
  const auth = await verifyAuth()
  if (auth.error) {
    return { user: null, error: auth.error }
  }

  try {
    const assetUser = await prisma.assetUser.findUnique({
      where: { userId: auth.user.id },
      select: {
        role: true,
        isActive: true,
        canDeleteAssets: true,
        canManageImport: true,
        canManageExport: true,
        canCreateAssets: true,
        canEditAssets: true,
        canViewAssets: true,
        canManageEmployees: true,
        canManageCategories: true,
        canCheckout: true,
        canCheckin: true,
        canReserve: true,
        canMove: true,
        canLease: true,
        canDispose: true,
        canManageMaintenance: true,
        canAudit: true,
        canManageMedia: true,
        canManageTrash: true,
      },
    })

    if (!assetUser || !assetUser.isActive) {
      return {
        user: null,
        error: NextResponse.json(
          { error: 'User account is inactive' },
          { status: 403 }
        ),
      }
    }

    return { user: assetUser, error: null }
  } catch (error) {
    console.error('Error fetching user permissions:', error)
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Failed to fetch user permissions' },
        { status: 500 }
      ),
    }
  }
}

/**
 * Check if user has a specific permission
 * Admins have all permissions
 */
export function hasPermission(user: AssetUser | null, permission: keyof UserPermissions): boolean {
  if (!user) return false
  if (user.role === 'admin') return true
  return user[permission] === true
}

/**
 * Require a specific permission - returns error response if not allowed
 */
export async function requirePermission(
  permission: keyof UserPermissions
): Promise<{ allowed: boolean; error: NextResponse | null }> {
  const { user, error } = await getUserPermissions()
  
  if (error) {
    return { allowed: false, error }
  }

  if (!hasPermission(user, permission)) {
    return {
      allowed: false,
      error: NextResponse.json(
        { error: 'You do not have permission to perform this action' },
        { status: 403 }
      ),
    }
  }

  return { allowed: true, error: null }
}

/**
 * Require admin role
 */
export async function requireAdmin(): Promise<{ allowed: boolean; error: NextResponse | null }> {
  const { user, error } = await getUserPermissions()
  
  if (error) {
    return { allowed: false, error }
  }

  if (user?.role !== 'admin') {
    return {
      allowed: false,
      error: NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      ),
    }
  }

  return { allowed: true, error: null }
}

