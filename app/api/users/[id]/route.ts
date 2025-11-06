import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/permission-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // Only admins can view users
  const adminCheck = await requireAdmin()
  if (!adminCheck.allowed) return adminCheck.error

  try {
    const { id } = await params

    const user = await prisma.assetUser.findUnique({
      where: {
        id,
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ user })
  } catch (error) {
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

  // Only admins can update users
  const adminCheck = await requireAdmin()
  if (!adminCheck.allowed) return adminCheck.error

  try {
    const { id } = await params
    const body = await request.json()
    const { role, permissions, isActive } = body

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
    const userToUpdate = await prisma.assetUser.findUnique({
      where: { id },
      select: { userId: true, role: true },
    })

    if (!userToUpdate) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get current authenticated user's asset_users record
    const currentUser = await prisma.assetUser.findUnique({
      where: { userId: auth.user.id },
      select: { role: true },
    })

    // Prevent admin from changing their own role from admin to user
    if (
      currentUser?.role === 'admin' &&
      userToUpdate.userId === auth.user.id &&
      userToUpdate.role === 'admin' &&
      role === 'user'
    ) {
      return NextResponse.json(
        { error: 'You cannot change your own role from admin to user' },
        { status: 403 }
      )
    }

    // Prevent admin from setting their own status to inactive
    if (
      currentUser?.role === 'admin' &&
      userToUpdate.userId === auth.user.id &&
      isActive === false
    ) {
      return NextResponse.json(
        { error: 'You cannot set your own status to inactive' },
        { status: 403 }
      )
    }

    // Build update data
    const updateData: any = {
      role,
      isActive: isActive !== undefined ? isActive : true,
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
    }

    const user = await prisma.assetUser.update({
      where: {
        id,
      },
      data: updateData,
    })

    return NextResponse.json({ user })
  } catch (error: unknown) {
    console.error('Error updating user:', error)
    const prismaError = error as { code?: string; message?: string }
    
    // Handle not found
    if (prismaError.code === 'P2025') {
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

  // Only admins can delete users
  const adminCheck = await requireAdmin()
  if (!adminCheck.allowed) return adminCheck.error

  try {
    const { id } = await params

    // Get the user being deleted
    const userToDelete = await prisma.assetUser.findUnique({
      where: { id },
      select: { userId: true },
    })

    if (!userToDelete) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Get current authenticated user's asset_users record
    const currentUser = await prisma.assetUser.findUnique({
      where: { userId: auth.user.id },
      select: { role: true },
    })

    // Prevent admin from deleting their own account
    if (currentUser?.role === 'admin' && userToDelete.userId === auth.user.id) {
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
    await prisma.assetUser.delete({
      where: {
        id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error deleting user:', error)
    const prismaError = error as { code?: string; message?: string }
    
    // Handle not found
    if (prismaError.code === 'P2025') {
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

