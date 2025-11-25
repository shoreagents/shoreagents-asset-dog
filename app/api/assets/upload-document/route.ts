import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { prisma } from '@/lib/prisma'
import { clearCache } from '@/lib/cache-utils'

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const auth = await verifyAuth()
    if (auth.error || !auth.user) {
      return auth.error || NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check create permission
    const permissionCheck = await requirePermission('canCreateAssets')
    if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

    // Check if request is JSON (for linking existing documents) or FormData (for uploading new files)
    const contentType = request.headers.get('content-type') || ''
    let file: File | null = null
    let assetTagId: string | null = null
    let documentUrl: string | null = null
    let linkExisting = false
    let documentType: string | null = null

    if (contentType.includes('application/json')) {
      // Handle linking existing documents
      const body = await request.json()
      assetTagId = body.assetTagId
      documentUrl = body.documentUrl
      linkExisting = body.linkExisting === true
      documentType = body.documentType || null

      if (!documentUrl) {
        return NextResponse.json(
          { error: 'Document URL is required' },
          { status: 400 }
        )
      }
    } else {
      // Handle file upload (FormData)
      const formData = await request.formData()
      file = formData.get('file') as File
      assetTagId = formData.get('assetTagId') as string | null
      documentType = formData.get('documentType') as string | null

      if (!file) {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400 }
        )
      }
    }

    if (!assetTagId) {
      return NextResponse.json(
        { error: 'Asset Tag ID is required' },
        { status: 400 }
      )
    }

    // Verify asset exists
    const asset = await prisma.assets.findUnique({
      where: { assetTagId },
      select: { id: true, assetTagId: true },
    })

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      )
    }

    // If linking existing document, just create the database record
    if (linkExisting && documentUrl) {
      // Extract document type from URL if possible
      const urlExtension = documentUrl.split('.').pop()?.split('?')[0]?.toLowerCase() || null
      let mimeType: string | null = null
      if (urlExtension) {
        const mimeTypes: Record<string, string> = {
          'pdf': 'application/pdf',
          'doc': 'application/msword',
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'xls': 'application/vnd.ms-excel',
          'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'txt': 'text/plain',
          'csv': 'text/csv',
          'rtf': 'application/rtf',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp',
        }
        mimeType = mimeTypes[urlExtension] || null
      }
      
      // Try to get file size from Supabase Storage
      let documentSize: number | null = null
      try {
        // Create Supabase admin client for storage operations
        const supabaseAdmin = createAdminSupabaseClient()
        
        // Extract bucket and path from URL
        // URL format: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
        const urlMatch = documentUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/)
        if (urlMatch) {
          const bucket = urlMatch[1]
          const fullPath = urlMatch[2]
          const pathParts = fullPath.split('/')
          const fileName = pathParts[pathParts.length - 1]
          const folderPath = pathParts.slice(0, -1).join('/')
          
          // List files in the folder to find the matching file
          const { data: fileData, error: listError } = await supabaseAdmin.storage
            .from(bucket)
            .list(folderPath || '', {
              limit: 1000,
            })
          
          if (!listError && fileData && fileData.length > 0) {
            const file = fileData.find(f => f.name === fileName)
            if (file && file.metadata?.size) {
              documentSize = file.metadata.size
            }
          }
        }
      } catch (error) {
        // If we can't get size from storage, that's okay - just log it
        console.warn('Could not fetch file size from storage for linked document:', error)
      }
      
      // Extract filename from URL
      const urlParts = documentUrl.split('/')
      const fileName = urlParts[urlParts.length - 1]?.split('?')[0] || null
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const documentRecord = await (prisma as any).assetsDocument.create({
        data: {
          assetTagId: assetTagId,
          documentUrl: documentUrl,
          documentType: documentType,
          documentSize: documentSize,
          fileName: fileName,
          mimeType: mimeType,
        },
      })

      // Clear document files cache so new documents appear immediately
      if (typeof globalThis !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(globalThis as any).documentFilesCache = undefined
      }

      // Clear assets cache so the assets list updates immediately with new document count
      await clearCache('assets')

      return NextResponse.json({
        id: documentRecord.id,
        assetTagId: documentRecord.assetTagId,
        documentUrl: documentRecord.documentUrl,
        publicUrl: documentUrl,
      })
    }

    // Validate file type (only for file uploads)
    if (!file) {
      return NextResponse.json(
        { error: 'File is required for upload' },
        { status: 400 }
      )
    }

    // Validate file type - allow documents and images
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
      'application/rtf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
    ]
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv', '.rtf', '.jpg', '.jpeg', '.png', '.gif', '.webp']
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF, DOC, DOCX, XLS, XLSX, TXT, CSV, RTF, JPEG, PNG, GIF, and WebP files are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size (max 5MB per file)
    const maxFileSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxFileSize) {
      return NextResponse.json(
        { error: 'File size too large. Maximum size is 5MB.' },
        { status: 400 }
      )
    }

    // Generate unique file path
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const sanitizedExtension = fileExtension.substring(1) // Remove the dot
    const fileName = `${assetTagId}-${timestamp}.${sanitizedExtension}`
    const filePath = `assets_documents/${fileName}`

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Create Supabase admin client for storage operations
    const supabaseAdmin = createAdminSupabaseClient()

    // Upload to Supabase storage bucket 'assets' (or 'file-history/assets' if assets bucket doesn't exist)
    let publicUrl: string | null = null
    let finalFilePath = filePath

    const { error: uploadError } = await supabaseAdmin.storage
      .from('assets')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      // If assets bucket doesn't exist, try file-history bucket
      if (uploadError.message.includes('Bucket not found') || uploadError.message.includes('not found')) {
        const fallbackPath = `assets/${filePath}`
        const { error: fallbackError } = await supabaseAdmin.storage
          .from('file-history')
          .upload(fallbackPath, buffer, {
            contentType: file.type,
            upsert: false,
          })

        if (fallbackError) {
          console.error('Storage upload error:', fallbackError)
          return NextResponse.json(
            { error: 'Failed to upload document to storage', details: fallbackError.message },
            { status: 500 }
          )
        }

        // Get public URL
        const { data: urlData } = supabaseAdmin.storage
          .from('file-history')
          .getPublicUrl(fallbackPath)

        publicUrl = urlData?.publicUrl || null
        finalFilePath = fallbackPath
      } else {
        console.error('Storage upload error:', uploadError)
        return NextResponse.json(
          { error: 'Failed to upload document to storage', details: uploadError.message },
          { status: 500 }
        )
      }
    } else {
      // Get public URL
      const { data: urlData } = supabaseAdmin.storage
        .from('assets')
        .getPublicUrl(filePath)

      publicUrl = urlData?.publicUrl || null
    }

    if (!publicUrl) {
      return NextResponse.json(
        { error: 'Failed to get public URL for uploaded document' },
        { status: 500 }
      )
    }

    // Save document record to database
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const documentRecord = await (prisma as any).assetsDocument.create({
      data: {
        assetTagId: assetTagId,
        documentUrl: publicUrl,
        documentType: documentType,
        documentSize: file.size,
        fileName: file.name,
        mimeType: file.type,
      },
    })

    // Clear document files cache so new documents appear immediately
    if (typeof globalThis !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(globalThis as any).documentFilesCache = undefined
    }

    // Clear assets cache so the assets list updates immediately with new document count
    await clearCache('assets')

    return NextResponse.json({
      id: documentRecord.id,
      assetTagId: documentRecord.assetTagId,
      documentUrl: documentRecord.documentUrl,
      publicUrl: publicUrl,
      filePath: finalFilePath,
    })
  } catch (error) {
    console.error('Error uploading/linking document:', error)
    return NextResponse.json(
      { error: 'Failed to upload/link document' },
      { status: 500 }
    )
  }
}

