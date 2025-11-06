import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      )
    }

    // Create user in Supabase Auth
    const supabaseAdmin = createAdminSupabaseClient()
    
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      if (authError.message?.includes('already registered') || authError.message?.includes('already exists')) {
        return NextResponse.json(
          { error: 'An account with this email already exists' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: authError.message || 'Failed to create account' },
        { status: authError.status || 400 }
      )
    }

    if (!authData?.user) {
      return NextResponse.json(
        { error: 'Failed to create account' },
        { status: 400 }
      )
    }

    const userId = authData.user.id

    // Create asset_users record with role='user', isActive=false (pending approval)
    // Default permissions are all false - admin will set them when approving
    const user = await prisma.assetUser.create({
      data: {
        userId,
        role: 'user',
        isActive: false, // Pending admin approval
        canDeleteAssets: false,
        canManageImport: false,
        canManageExport: true,
        canCreateAssets: false,
        canEditAssets: false,
        canViewAssets: false,
        canManageEmployees: false,
        canManageCategories: false,
        canCheckout: false,
        canCheckin: false,
        canReserve: false,
        canMove: false,
        canLease: false,
        canDispose: false,
        canManageMaintenance: false,
        canAudit: false,
      },
    })

    return NextResponse.json({ 
      message: 'Account created successfully. Please wait for admin approval.',
      user: {
        id: user.id,
        email: authData.user.email,
      }
    }, { status: 201 })
  } catch (error: unknown) {
    const prismaError = error as { code?: string; message?: string }
    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      )
    }
    console.error('Error creating account:', error)
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    )
  }
}

