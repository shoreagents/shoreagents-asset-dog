import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { prisma } from '@/lib/prisma'

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
    if (!permissionCheck.allowed) return permissionCheck.error

    // Check if request is JSON (for linking existing images) or FormData (for uploading new files)
    const contentType = request.headers.get('content-type') || ''
    let file: File | null = null
    let assetTagId: string | null = null
    let imageUrl: string | null = null
    let linkExisting = false

    if (contentType.includes('application/json')) {
      // Handle linking existing images
      const body = await request.json()
      assetTagId = body.assetTagId
      imageUrl = body.imageUrl
      linkExisting = body.linkExisting === true

      if (!imageUrl) {
        return NextResponse.json(
          { error: 'Image URL is required' },
          { status: 400 }
        )
      }
    } else {
      // Handle file upload (FormData)
      const formData = await request.formData()
      file = formData.get('file') as File
      assetTagId = formData.get('assetTagId') as string | null

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

    // If linking existing image, just create the database record
    if (linkExisting && imageUrl) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imageRecord = await (prisma as any).assetsImage.create({
        data: {
          assetTagId: assetTagId,
          imageUrl: imageUrl,
        },
      })

      return NextResponse.json({
        id: imageRecord.id,
        assetTagId: imageRecord.assetTagId,
        imageUrl: imageRecord.imageUrl,
        publicUrl: imageUrl,
      })
    }

    // Validate file type (only for file uploads)
    if (!file) {
      return NextResponse.json(
        { error: 'File is required for upload' },
        { status: 400 }
      )
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size too large. Maximum size is 5MB.' },
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
    const fileExtension = file.name.split('.').pop() || 'jpg'
    const sanitizedExtension = fileExtension.toLowerCase()
    const fileName = `${assetTagId}-${timestamp}.${sanitizedExtension}`
    const filePath = `assets/${fileName}`

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase storage bucket 'assets' (or 'file-history' if assets bucket doesn't exist)
    const { error: uploadError } = await supabaseAdmin.storage
      .from('assets')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    let publicUrl: string | null = null
    let finalFilePath = filePath

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
            { error: 'Failed to upload image to storage', details: fallbackError.message },
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
          { error: 'Failed to upload image to storage', details: uploadError.message },
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
        { error: 'Failed to get public URL for uploaded image' },
        { status: 500 }
      )
    }

    // Save image record to database
    // Note: Type assertion needed until Prisma client is regenerated after migration
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imageRecord = await (prisma as any).assetsImage.create({
      data: {
        assetTagId: assetTagId,
        imageUrl: publicUrl,
      },
    })

    return NextResponse.json({
      id: imageRecord.id,
      assetTagId: imageRecord.assetTagId,
      imageUrl: imageRecord.imageUrl,
      filePath: finalFilePath,
      fileName: fileName,
      fileSize: file.size,
      mimeType: file.type,
      publicUrl: publicUrl,
    })
  } catch (error: unknown) {
    console.error('Error uploading image:', error)
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    )
  }
}

