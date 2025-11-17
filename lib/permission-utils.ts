import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { retryDbOperation } from '@/lib/db-utils'
import { NextResponse } from 'next/server'

// Simple in-memory cache for user permissions (TTL: 30 seconds)
// This reduces database connection usage for permission checks
const permissionCache = new Map<string, { user: AssetUser; expiresAt: number }>()
const CACHE_TTL = 30000 // 30 seconds

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

interface AssetUser {
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

/**
 * Get current user's permissions from database
 * Uses in-memory cache to reduce database connection usage
 */
export async function getUserPermissions(): Promise<{ user: AssetUser | null; error: NextResponse | null }> {
  const auth = await verifyAuth()
  if (auth.error) {
    return { user: null, error: auth.error }
  }

  // Check cache first
  const cacheKey = auth.user.id
  const cached = permissionCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return { user: cached.user, error: null }
  }

  try {
    const assetUser = await retryDbOperation(() => prisma.assetUser.findUnique({
      where: { userId: auth.user.id },
      select: {
        role: true,
        isActive: true,
        isApproved: true,
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
        canManageUsers: true,
        canManageReturnForms: true,
        canViewReturnForms: true,
        canManageAccountabilityForms: true,
        canViewAccountabilityForms: true,
        canManageReports: true,
      },
    }))

    if (!assetUser || !assetUser.isActive) {
      // Clear cache if user is inactive
      permissionCache.delete(cacheKey)
      return {
        user: null,
        error: NextResponse.json(
          { error: 'User account is inactive' },
          { status: 403 }
        ),
      }
    }

    // Cache the result
    permissionCache.set(cacheKey, {
      user: assetUser,
      expiresAt: Date.now() + CACHE_TTL,
    })

    return { user: assetUser, error: null }
  } catch (error) {
    // Handle connection pool errors specifically
    if (error instanceof Error && (
      error.message.includes('connection pool') ||
      error.message.includes('Timed out fetching') ||
      error.message.includes('Can\'t reach database server')
    )) {
      console.error('[Permission Utils] Connection pool error:', error.message)
      return {
        user: null,
        error: NextResponse.json(
          { error: 'Database connection limit reached. Please try again in a moment.' },
          { status: 503 }
        ),
      }
    }
    
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

/**
 * Clear permission cache for a specific user
 * Useful when user permissions are updated
 */
export function clearPermissionCache(userId: string): void {
  permissionCache.delete(userId)
}

