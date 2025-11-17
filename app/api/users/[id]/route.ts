import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { requirePermission, clearPermissionCache } from '@/lib/permission-utils'
import { Prisma } from '@prisma/client'
import { retryDbOperation } from '@/lib/db-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // Only users with canManageUsers permission can view users
  const permissionCheck = await requirePermission('canManageUsers')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const { id } = await params

    const user = await retryDbOperation(() => prisma.assetUser.findUnique({
      where: {
        id,
      },
    }))

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ user })
  } catch (error: unknown) {
    const prismaError = error as { code?: string; message?: string }
    if (prismaError?.code === 'P1001' || prismaError?.code === 'P2024') {
      return NextResponse.json(
        { error: 'Database connection limit reached. Please try again in a moment.' },
        { status: 503 }
      )
    }
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // Only users with canManageUsers permission can update users
  const permissionCheck = await requirePermission('canManageUsers')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const { id } = await params
    const body = await request.json()
    const { role, permissions, isActive, isApproved } = body

    if (!role) {
      return NextResponse.json(
        { error: 'Role is required' },
        { status: 400 }
      )
    }

    if (role !== 'admin' && role !== 'user') {
      return NextResponse.json(
        { error: 'Role must be either "admin" or "user"' },
        { status: 400 }
      )
    }

    // Get the user being updated
    const userToUpdate = await retryDbOperation(() => prisma.assetUser.findUnique({
      where: { id },
      select: { userId: true, role: true },
    }))

    if (!userToUpdate) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Prevent user from changing their own role
    if (userToUpdate.userId === auth.user.id && userToUpdate.role !== role) {
      return NextResponse.json(
        { error: 'You cannot change your own role' },
        { status: 403 }
      )
    }

    // Prevent user from setting their own status to inactive
    if (userToUpdate.userId === auth.user.id && isActive === false) {
      return NextResponse.json(
        { error: 'You cannot set your own status to inactive' },
        { status: 403 }
      )
    }

    // Build update data
    const updateData: Prisma.AssetUserUpdateInput = {
      role,
      isActive: isActive !== undefined ? isActive : true,
      // Only update isApproved if explicitly provided (for approval action)
      // Don't allow un-approving a user
      ...(isApproved !== undefined && { isApproved: isApproved }),
    }

    // Add permissions only for "user" role
    if (role === 'user' && permissions) {
      updateData.canDeleteAssets = permissions.canDeleteAssets !== undefined ? permissions.canDeleteAssets : false
      updateData.canManageImport = permissions.canManageImport !== undefined ? permissions.canManageImport : false
      updateData.canManageExport = permissions.canManageExport !== undefined ? permissions.canManageExport : true
      updateData.canCreateAssets = permissions.canCreateAssets !== undefined ? permissions.canCreateAssets : true
      updateData.canEditAssets = permissions.canEditAssets !== undefined ? permissions.canEditAssets : true
      updateData.canViewAssets = permissions.canViewAssets !== undefined ? permissions.canViewAssets : true
      updateData.canManageEmployees = permissions.canManageEmployees !== undefined ? permissions.canManageEmployees : false
      updateData.canManageCategories = permissions.canManageCategories !== undefined ? permissions.canManageCategories : false
      updateData.canCheckout = permissions.canCheckout !== undefined ? permissions.canCheckout : true
      updateData.canCheckin = permissions.canCheckin !== undefined ? permissions.canCheckin : true
      updateData.canReserve = permissions.canReserve !== undefined ? permissions.canReserve : true
      updateData.canMove = permissions.canMove !== undefined ? permissions.canMove : false
      updateData.canLease = permissions.canLease !== undefined ? permissions.canLease : false
      updateData.canDispose = permissions.canDispose !== undefined ? permissions.canDispose : false
      updateData.canManageMaintenance = permissions.canManageMaintenance !== undefined ? permissions.canManageMaintenance : false
      updateData.canAudit = permissions.canAudit !== undefined ? permissions.canAudit : false
      updateData.canManageMedia = permissions.canManageMedia !== undefined ? permissions.canManageMedia : true
      updateData.canManageTrash = permissions.canManageTrash !== undefined ? permissions.canManageTrash : true
      updateData.canManageUsers = permissions.canManageUsers !== undefined ? permissions.canManageUsers : false
      updateData.canManageReturnForms = permissions.canManageReturnForms !== undefined ? permissions.canManageReturnForms : false
      updateData.canViewReturnForms = permissions.canViewReturnForms !== undefined ? permissions.canViewReturnForms : true
      updateData.canManageAccountabilityForms = permissions.canManageAccountabilityForms !== undefined ? permissions.canManageAccountabilityForms : false
      updateData.canViewAccountabilityForms = permissions.canViewAccountabilityForms !== undefined ? permissions.canViewAccountabilityForms : true
      updateData.canManageReports = permissions.canManageReports !== undefined ? permissions.canManageReports : false
    }

    const user = await retryDbOperation(() => prisma.assetUser.update({
      where: {
        id,
      },
      data: updateData,
      select: { userId: true },
    }))

    // Clear permission cache for the updated user
    if (user.userId) {
      clearPermissionCache(user.userId)
    }

    // Fetch full user data for response
    const fullUser = await retryDbOperation(() => prisma.assetUser.findUnique({
      where: { id },
    }))

    if (!fullUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Fetch email from Supabase Auth
    const supabaseAdmin = createAdminSupabaseClient()
    let email: string | null = null
    try {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(fullUser.userId)
      email = authUser?.user?.email || null
    } catch {
      email = null
    }

    return NextResponse.json({ 
      user: {
        ...fullUser,
        email,
      }
    })
  } catch (error: unknown) {
    console.error('Error updating user:', error)
    const prismaError = error as { code?: string; message?: string }
    
    // Handle connection pool errors
    if (prismaError?.code === 'P1001' || prismaError?.code === 'P2024') {
      return NextResponse.json(
        { error: 'Database connection limit reached. Please try again in a moment.' },
        { status: 503 }
      )
    }
    
    // Handle not found
    if (prismaError?.code === 'P2025') {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // Only users with canManageUsers permission can delete users
  const permissionCheck = await requirePermission('canManageUsers')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const { id } = await params

    // Get the user being deleted
    const userToDelete = await retryDbOperation(() => prisma.assetUser.findUnique({
      where: { id },
      select: { userId: true },
    }))

    if (!userToDelete) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Prevent user from deleting their own account
    if (userToDelete.userId === auth.user.id) {
      return NextResponse.json(
        { error: 'You cannot delete your own account' },
        { status: 403 }
      )
    }

    // Delete from Supabase Auth first
    const supabaseAdmin = createAdminSupabaseClient()
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userToDelete.userId)
    
    if (authError) {
      console.error('Error deleting user from Supabase Auth:', authError)
      return NextResponse.json(
        { error: 'Failed to delete user from authentication system' },
        { status: 500 }
      )
    }

    // Delete from asset_users
    await retryDbOperation(() => prisma.assetUser.delete({
      where: {
        id,
      },
    }))

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error deleting user:', error)
    const prismaError = error as { code?: string; message?: string }
    
    // Handle connection pool errors
    if (prismaError?.code === 'P1001' || prismaError?.code === 'P2024') {
      return NextResponse.json(
        { error: 'Database connection limit reached. Please try again in a moment.' },
        { status: 503 }
      )
    }
    
    // Handle not found
    if (prismaError?.code === 'P2025') {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}

