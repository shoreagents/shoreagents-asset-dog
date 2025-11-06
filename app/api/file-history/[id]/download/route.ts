import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { getUserPermissions } from '@/lib/permission-utils'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    // Fetch file history record
    const fileHistory = await prisma.fileHistory.findUnique({
      where: { id },
    })

    if (!fileHistory) {
      return NextResponse.json(
        { error: 'File history not found' },
        { status: 404 }
      )
    }

    // Verify user owns this file history
    if (fileHistory.userId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized to access this file' },
        { status: 403 }
      )
    }

    // Check if file exists in storage
    if (!fileHistory.filePath) {
      return NextResponse.json(
        { error: 'File not found in storage' },
        { status: 404 }
      )
    }

    // Create Supabase admin client
    let supabaseAdmin
    try {
      supabaseAdmin = createAdminSupabaseClient()
    } catch (clientError) {
      console.error('Failed to create Supabase admin client:', clientError)
      return NextResponse.json(
        { error: 'Storage service unavailable' },
        { status: 503 }
      )
    }

    // Download file from storage
    const { data, error: downloadError } = await supabaseAdmin.storage
      .from('file-history')
      .download(fileHistory.filePath)

    if (downloadError || !data) {
      console.error('Storage download error:', downloadError)
      return NextResponse.json(
        { error: 'Failed to download file from storage' },
        { status: 500 }
      )
    }

    // Convert blob to buffer
    const buffer = Buffer.from(await data.arrayBuffer())

    // Return file with appropriate headers
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': fileHistory.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileHistory.fileName}"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error: unknown) {
    console.error('Error downloading file:', error)
    return NextResponse.json(
      { error: 'Failed to download file' },
      { status: 500 }
    )
  }
}

