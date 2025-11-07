import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/permission-utils'
import { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // All authenticated users can view users list (read-only)
  // Only admins can create/edit/delete users (enforced in POST/PUT/DELETE endpoints)

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const role = searchParams.get('role')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '100', 10)
    const skip = (page - 1) * pageSize
    
    const whereClause: Prisma.AssetUserWhereInput = {}
    
    if (search) {
      whereClause.userId = { contains: search, mode: 'insensitive' }
    }
    
    if (role && role !== 'all') {
      whereClause.role = role
    }

    // Get total count for pagination
    const totalCount = await prisma.assetUser.count({ where: whereClause })

    const users = await prisma.assetUser.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: pageSize,
    })

    // Fetch emails from Supabase Auth for each user
    const supabaseAdmin = createAdminSupabaseClient()
    const usersWithEmail = await Promise.all(
      users.map(async (user) => {
        try {
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(user.userId)
          return {
            ...user,
            email: authUser?.user?.email || '-',
          }
        } catch {
          return {
            ...user,
            email: '-',
          }
        }
      })
    )

    const totalPages = Math.ceil(totalCount / pageSize)

    return NextResponse.json({ 
      users: usersWithEmail,
      pagination: {
        page,
        pageSize,
        total: totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      }
    })
  } catch (error: unknown) {
    const prismaError = error as { code?: string; message?: string }
    if (prismaError?.code !== 'P1001') {
      console.error('Error fetching users:', error)
    }
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

// Helper function to generate random password
function generateRandomPassword(length: number = 12): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?/~`'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length))
  }
  return password
}

export async function POST(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // Only users with canManageUsers permission can create users
  const permissionCheck = await requirePermission('canManageUsers')
  if (!permissionCheck.allowed) return permissionCheck.error

  try {
    const body = await request.json()
    const { email, password, role, permissions } = body

    if (!email || !role) {
      return NextResponse.json(
        { error: 'Email and role are required' },
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

    if (role !== 'admin' && role !== 'user') {
      return NextResponse.json(
        { error: 'Role must be either "admin" or "user"' },
        { status: 400 }
      )
    }

    // Generate password if not provided
    const userPassword = password || generateRandomPassword()

    // Validate password length
    if (userPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      )
    }

    // Create user in Supabase Auth
    const supabaseAdmin = createAdminSupabaseClient()
    
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: userPassword,
      email_confirm: true,
    })

    if (authError) {
      if (authError.message?.includes('already registered') || authError.message?.includes('already exists')) {
        return NextResponse.json(
          { error: 'User already exists' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: authError.message || 'Failed to create user' },
        { status: authError.status || 400 }
      )
    }

    if (!authData?.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 400 }
      )
    }

    const userId = authData.user.id

    // Build permissions object (only for "user" role)
    const permissionsData = role === 'user' ? {
      canDeleteAssets: permissions?.canDeleteAssets ?? false,
      canManageImport: permissions?.canManageImport ?? false,
      canManageExport: permissions?.canManageExport ?? true,
      canCreateAssets: permissions?.canCreateAssets ?? true,
      canEditAssets: permissions?.canEditAssets ?? true,
      canViewAssets: permissions?.canViewAssets ?? true,
      canManageEmployees: permissions?.canManageEmployees ?? false,
      canManageCategories: permissions?.canManageCategories ?? false,
      canCheckout: permissions?.canCheckout ?? true,
      canCheckin: permissions?.canCheckin ?? true,
      canReserve: permissions?.canReserve ?? true,
      canMove: permissions?.canMove ?? false,
      canLease: permissions?.canLease ?? false,
      canDispose: permissions?.canDispose ?? false,
      canManageMaintenance: permissions?.canManageMaintenance ?? false,
      canAudit: permissions?.canAudit ?? false,
      canManageMedia: permissions?.canManageMedia ?? true,
      canManageTrash: permissions?.canManageTrash ?? true,
      canManageUsers: permissions?.canManageUsers ?? false,
    } : {}

    // Create asset_users record
    const user = await prisma.assetUser.create({
      data: {
        userId,
        role,
        ...permissionsData,
      },
    })

    return NextResponse.json({ 
      user,
      generatedPassword: password ? undefined : userPassword,
    }, { status: 201 })
  } catch (error: unknown) {
    const prismaError = error as { code?: string; message?: string }
    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}

