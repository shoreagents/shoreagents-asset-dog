import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { getUserPermissions } from '@/lib/permission-utils'

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

    // Get file from form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const operationType = formData.get('operationType') as string // 'import' or 'export'

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!operationType || (operationType !== 'import' && operationType !== 'export')) {
      return NextResponse.json(
        { error: 'Invalid operationType. Must be "import" or "export"' },
        { status: 400 }
      )
    }

    // Create Supabase admin client for storage operations
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

    // Generate unique file path
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileExtension = file.name.split('.').pop() || 'xlsx'
    const fileName = `${operationType}-${timestamp}-${userId}.${fileExtension}`
    const filePath = `${operationType}/${fileName}`

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase storage bucket 'file-history'
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('file-history')
      .upload(filePath, buffer, {
        contentType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload file to storage', details: uploadError.message },
        { status: 500 }
      )
    }

    if (!uploadData) {
      return NextResponse.json(
        { error: 'Upload failed: No data returned' },
        { status: 500 }
      )
    }

    // Get public URL (if needed)
    const { data: urlData } = supabaseAdmin.storage
      .from('file-history')
      .getPublicUrl(filePath)

    return NextResponse.json({
      filePath: uploadData.path,
      fileName: fileName,
      fileSize: file.size,
      mimeType: file.type,
      publicUrl: urlData?.publicUrl || null,
    })
  } catch (error: unknown) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}

