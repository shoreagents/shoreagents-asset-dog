import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { retryDbOperation } from '@/lib/db-utils'
import { createAdminSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      )
    }

    // Fetch user role and permissions from AssetUser table
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let userData: any = null
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      userData = await retryDbOperation(() => (prisma.assetUser.findUnique as any)({
        where: { userId: user.id },
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

      // Check if user account is inactive
      if (userData && userData.isActive === false) {
        return NextResponse.json(
          { 
            error: 'User account is inactive',
            user,
            role: null,
            permissions: null,
            isActive: false,
          },
          { status: 403 }
        )
      }
    } catch (dbError) {
      // If user doesn't exist in AssetUser table, userData will remain null
      // This is acceptable for new users who haven't been added to the system yet
      console.error('Error fetching user data:', dbError)
    }

    // Extract name from user_metadata (check both 'name' and 'full_name' for compatibility)
    const userName = user.user_metadata?.name || user.user_metadata?.full_name || ''

    return NextResponse.json(
      { 
        user: {
          ...user,
          name: userName,  // Add name property for easier access
        },
        role: userData?.role || null,  // User role (for backward compatibility)
        permissions: userData,  // Full permissions object
        isActive: userData?.isActive ?? true,  // User active status
      },
      { status: 200 }
    )
  } catch {
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, email } = body

    // Prevent users from changing their email address
    if (email !== undefined) {
      return NextResponse.json(
        { error: 'Email address cannot be changed. Please contact your administrator.' },
        { status: 403 }
      )
    }

    const supabaseAdmin = createAdminSupabaseClient()
    
    // Get current user to preserve existing metadata
    const { data: currentUser } = await supabaseAdmin.auth.admin.getUserById(user.id)
    const existingMetadata = currentUser?.user?.user_metadata || {}
    
    const updateData: { user_metadata?: Record<string, unknown> } = {}

    if (name !== undefined) {
      // Merge with existing metadata and set both 'name' and 'full_name' for compatibility
      updateData.user_metadata = {
        ...existingMetadata,
        name,
        full_name: name, // Supabase Auth dashboard uses full_name for Display name
      }
    }

    // Update user in Supabase Auth
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      updateData
    )

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || 'Failed to update user' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      user: {
        id: updatedUser.user.id,
        email: updatedUser.user.email,
        name: updatedUser.user.user_metadata?.name || updatedUser.user.email?.split('@')[0] || '',
      },
    })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

