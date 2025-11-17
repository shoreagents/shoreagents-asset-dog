import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth-utils'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { requirePermission } from '@/lib/permission-utils'
import { Prisma } from '@prisma/client'
import { sendWelcomeEmail } from '@/lib/email'
import { retryDbOperation } from '@/lib/db-utils'

export async function GET(request: NextRequest) {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // All authenticated users can view users list (read-only)
  // Only admins can create/edit/delete users (enforced in POST/PUT/DELETE endpoints)

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const searchType = searchParams.get('searchType') || 'unified'
    const role = searchParams.get('role')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '100', 10)
    const skip = (page - 1) * pageSize
    
    const supabaseAdmin = createAdminSupabaseClient()
    
    // Build base where clause for role filter
    const baseWhereClause: Prisma.AssetUserWhereInput = {}
    if (role && role !== 'all') {
      baseWhereClause.role = role
    }

    let users: Array<{ id: string; userId: string; role: string; email?: string | null; [key: string]: unknown }> = []
    let totalCount = 0

    // If there's a search term, we need to search by email, userId, or role based on searchType
    // Since emails are in Supabase Auth, we'll fetch users and filter by email
    if (search) {
      // Fetch all users (or a reasonable limit) to search
      // We'll filter in JavaScript since we need to check email from Supabase Auth anyway
      const allUsers = await retryDbOperation(() => prisma.assetUser.findMany({
        where: baseWhereClause,
        orderBy: {
          createdAt: 'desc',
        },
        take: 10000, // Reasonable limit for search
      }))

      // Fetch emails from Supabase Auth for all users
      const usersWithEmailData = await Promise.all(
        allUsers.map(async (user) => {
          try {
            const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(user.userId)
            return {
              ...user,
              email: authUser?.user?.email || null,
            }
          } catch {
            return {
              ...user,
              email: null,
            }
          }
        })
      )

      // Filter by searchType (case-insensitive)
      const searchLower = search.toLowerCase()
      const filteredUsers = usersWithEmailData.filter(user => {
        if (searchType === 'email') {
          return user.email?.toLowerCase().includes(searchLower) ?? false
        } else if (searchType === 'userId') {
          return user.userId.toLowerCase().includes(searchLower)
        } else if (searchType === 'role') {
          return user.role.toLowerCase().includes(searchLower)
        } else {
          // unified search - search by email OR userId OR role
        const emailMatch = user.email?.toLowerCase().includes(searchLower) ?? false
        const userIdMatch = user.userId.toLowerCase().includes(searchLower)
          const roleMatch = user.role.toLowerCase().includes(searchLower)
          return emailMatch || userIdMatch || roleMatch
        }
      })

      totalCount = filteredUsers.length
      
      // Apply pagination
      users = filteredUsers.slice(skip, skip + pageSize) as Array<{ id: string; userId: string; role: string; email?: string | null; [key: string]: unknown }>
    } else {
      // No search term - normal query with pagination
      totalCount = await retryDbOperation(() => prisma.assetUser.count({ where: baseWhereClause }))

      users = await retryDbOperation(() => prisma.assetUser.findMany({
        where: baseWhereClause,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: pageSize,
      }))
    }

    // Fetch emails from Supabase Auth for each user (if not already fetched)
    const usersWithEmail = search 
      ? users.map(user => ({
          ...user,
          email: user.email || '-',
        }))
      : await Promise.all(
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
    if (prismaError?.code === 'P1001' || prismaError?.code === 'P2024') {
      return NextResponse.json(
        { error: 'Database connection limit reached. Please try again in a moment.' },
        { status: 503 }
      )
    }
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
    if (userPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
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
      canManageReturnForms: permissions?.canManageReturnForms ?? false,
      canViewReturnForms: permissions?.canViewReturnForms ?? true,
      canManageAccountabilityForms: permissions?.canManageAccountabilityForms ?? false,
      canViewAccountabilityForms: permissions?.canViewAccountabilityForms ?? true,
      canManageReports: permissions?.canManageReports ?? false,
    } : {}

    // Create asset_users record
    // When admin creates an account, automatically approve it
    const user = await retryDbOperation(() => prisma.assetUser.create({
      data: {
        userId,
        role,
        isApproved: true, // Automatically approve accounts created by admin
        ...permissionsData,
      },
    }))

    // Always send welcome email with password when user is created
    // The password is either auto-generated or provided by admin, but we send it via email either way
    let emailSent = false
    let emailError: string | undefined = undefined
    
    try {
      const emailResult = await sendWelcomeEmail(email, userPassword, role)
      emailSent = emailResult.success
      emailError = emailResult.error
      
      if (!emailResult.success) {
        // Log error but don't fail user creation
        console.error('[USER CREATION] Failed to send welcome email:', emailResult.error)
      }
    } catch (emailErr) {
      console.error('[USER CREATION] Exception while sending email:', emailErr)
      emailError = emailErr instanceof Error ? emailErr.message : 'Unknown error'
    }

    return NextResponse.json({ 
      user,
      generatedPassword: password ? undefined : userPassword,
      emailSent: emailSent, // Email sent status
      emailError: !emailSent ? emailError : undefined,
    }, { status: 201 })
  } catch (error: unknown) {
    const prismaError = error as { code?: string; message?: string }
    if (prismaError?.code === 'P1001' || prismaError?.code === 'P2024') {
      return NextResponse.json(
        { error: 'Database connection limit reached. Please try again in a moment.' },
        { status: 503 }
      )
    }
    if (prismaError?.code === 'P2002') {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      )
    }
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}

