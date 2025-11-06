import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserPermissions } from '@/lib/permission-utils'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const { user, error } = await getUserPermissions()
    if (error || !user) {
      return error || NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get userId from auth
    const { verifyAuth } = await import('@/lib/auth-utils')
    const auth = await verifyAuth()
    if (auth.error || !auth.user) {
      return auth.error || NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    const userId = auth.user.id

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const operationType = searchParams.get('operationType') // 'import' or 'export'
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)
    const skip = (page - 1) * pageSize

    // Check if user is admin or has permission to view all history
    // For export: canViewAssets allows viewing all history (read-only), canManageExport allows managing
    // For import: canViewAssets allows viewing all history (read-only), canManageImport allows managing
    const isAdmin = user.role === 'admin'
    const canViewAllHistory = isAdmin || (
      (operationType === 'export' && (user.canViewAssets || user.canManageExport)) ||
      (operationType === 'import' && (user.canViewAssets || user.canManageImport))
    )
    
    // Check if user can view import history at all (for import type)
    const canViewImportHistory = isAdmin || user.canViewAssets || user.canManageImport
    
    // Check if user can view export history at all (for export type)
    const canViewExportHistory = isAdmin || user.canViewAssets || user.canManageExport

    // Build where clause - if user has permission to view all, show all history, otherwise only their own
    const whereClause: {
      userId?: string
      operationType?: string
    } = {}

    // For export type, check if user can view at all
    if (operationType === 'export' && !canViewExportHistory) {
      return NextResponse.json(
        { error: 'You do not have permission to view export history' },
        { status: 403 }
      )
    }
    
    // For import type, check if user can view at all
    if (operationType === 'import' && !canViewImportHistory) {
      return NextResponse.json(
        { error: 'You do not have permission to view import history' },
        { status: 403 }
      )
    }

    if (!canViewAllHistory) {
      whereClause.userId = userId
    }

    if (operationType && (operationType === 'import' || operationType === 'export')) {
      whereClause.operationType = operationType
    }

    // Fetch file history with pagination
    // Also need to fetch user emails from Supabase Auth
    // Note: Using 'as any' temporarily until Prisma client is regenerated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaClient = prisma as any
    const [fileHistory, total] = await Promise.all([
      prismaClient.fileHistory.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prismaClient.fileHistory.count({ where: whereClause }),
    ])

    // Fetch user emails from Supabase Auth for each history record
    const { createAdminSupabaseClient } = await import('@/lib/supabase-server')
    const supabaseAdmin = createAdminSupabaseClient()
    
    // Get unique user IDs
    const uniqueUserIds = [...new Set(fileHistory.map((h: { userId: string }) => h.userId))]
    
    // Fetch user emails
    const userEmailMap = new Map<string, string>()
    for (const uid of uniqueUserIds) {
      try {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(uid as string)
        if (authUser?.user?.email) {
          userEmailMap.set(uid as string, authUser.user.email)
        }
      } catch (error) {
        console.error(`Failed to fetch user email for ${uid}:`, error)
      }
    }

    // Add user email to each history record
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fileHistoryWithUser = fileHistory.map((history: any) => ({
      ...history,
      userEmail: userEmailMap.get(history.userId) || null,
    }))

    return NextResponse.json({
      fileHistory: fileHistoryWithUser,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (error: unknown) {
    console.error('Error fetching file history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch file history' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { user, error } = await getUserPermissions()
    if (error || !user) {
      return error || NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get userId from auth
    const { verifyAuth } = await import('@/lib/auth-utils')
    const auth = await verifyAuth()
    if (auth.error || !auth.user) {
      return auth.error || NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    const userId = auth.user.id

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }
    const {
      operationType,
      fileName,
      filePath,
      fileSize,
      mimeType,
      recordsProcessed,
      recordsCreated,
      recordsSkipped,
      recordsFailed,
      recordsExported,
      fieldsExported,
      status,
      errorMessage,
      metadata,
    } = body

    // Validate required fields
    if (!operationType || !fileName || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: operationType, fileName, status' },
        { status: 400 }
      )
    }

    if (operationType !== 'import' && operationType !== 'export') {
      return NextResponse.json(
        { error: 'operationType must be "import" or "export"' },
        { status: 400 }
      )
    }

    // Create file history record
    // Note: Using 'as any' temporarily until Prisma client is regenerated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaClient = prisma as any
    const fileHistory = await prismaClient.fileHistory.create({
      data: {
        operationType,
        fileName,
        filePath: filePath || null,
        fileSize: fileSize || null,
        mimeType: mimeType || null,
        userId,
        recordsProcessed: recordsProcessed || null,
        recordsCreated: recordsCreated || null,
        recordsSkipped: recordsSkipped || null,
        recordsFailed: recordsFailed || null,
        recordsExported: recordsExported || null,
        fieldsExported: fieldsExported || null,
        status,
        errorMessage: errorMessage || null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    })

    return NextResponse.json(fileHistory, { status: 201 })
  } catch (error: unknown) {
    console.error('Error creating file history:', error)
    return NextResponse.json(
      { error: 'Failed to create file history' },
      { status: 500 }
    )
  }
}

