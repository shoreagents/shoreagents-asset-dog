import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
    let userData = null
    try {
      const assetUser = await prisma.assetUser.findUnique({
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
        },
      })

      // Check if user account is inactive
      if (assetUser && !assetUser.isActive) {
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

      userData = assetUser
    } catch (dbError) {
      // If user doesn't exist in AssetUser table, userData will remain null
      // This is acceptable for new users who haven't been added to the system yet
      console.error('Error fetching user data:', dbError)
    }

    return NextResponse.json(
      { 
        user,  // Supabase auth user (for backward compatibility)
        role: userData?.role || null,  // User role (for backward compatibility)
        permissions: userData,  // Full permissions object
        isActive: userData?.isActive ?? true,  // User active status
      },
      { status: 200 }
    )
  } catch (error) {
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

