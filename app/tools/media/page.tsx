'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePermissions } from '@/hooks/use-permissions'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationEllipsis,
} from '@/components/ui/pagination'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Eye, ChevronLeft, ChevronRight, MoreVertical, Trash2, Link2, ChevronDown, RotateCw, Upload } from 'lucide-react'
import { format } from 'date-fns'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

interface MediaImage {
  id: string
  imageUrl: string
  assetTagId: string
  fileName: string
  createdAt: string
  isLinked?: boolean
  linkedAssetTagId?: string | null // For backward compatibility
  linkedAssetTagIds?: string[] // Array of all linked asset tag IDs
  linkedAssetsInfo?: Array<{ assetTagId: string; isDeleted: boolean }> // Info about each linked asset
  assetIsDeleted?: boolean
}

export default function MediaPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canManageMedia = hasPermission('canManageMedia')

  const [previewImage, setPreviewImage] = useState<MediaImage | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [imageToDelete, setImageToDelete] = useState<MediaImage | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Get page from URL params
  const currentPage = parseInt(searchParams.get('page') || '1', 10)

  // Grid columns selection (stored in localStorage)
  const [gridColumns, setGridColumns] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('media-grid-columns')
      return saved ? parseInt(saved, 10) : 8
    }
    return 8
  })

  // Save grid columns to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('media-grid-columns', gridColumns.toString())
    }
  }, [gridColumns])

  // Grid column classes mapping (4-10 columns)
  const gridClasses = {
    4: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5',
    6: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
    7: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7',
    8: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8',
    9: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-9',
    10: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-10',
  }

  // Calculate page size based on grid columns (show 2 rows of images per page)
  // This ensures pagination adjusts based on how many images fit per row
  const pageSize = useMemo(() => {
    // Calculate based on columns * 2 rows
    return gridColumns * 2
  }, [gridColumns])

  // Generate a consistent color for an asset tag ID
  // Same asset tag ID will always get the same color
  // Using a comprehensive Tailwind color palette
  const getAssetColor = (assetTagId: string | null | undefined): string => {
    if (!assetTagId) return 'bg-blue-500/90'
    
    // Simple hash function to convert asset tag ID to a number
    let hash = 0
    for (let i = 0; i < assetTagId.length; i++) {
      hash = assetTagId.charCodeAt(i) + ((hash << 5) - hash)
    }
    
    // Use hash to select from a comprehensive Tailwind color palette
    // Using colors that are visually distinct and have good contrast
    const colors = [
      'bg-blue-500/90',
      'bg-green-500/90',
      'bg-purple-500/90',
      'bg-orange-500/90',
      'bg-pink-500/90',
      'bg-cyan-500/90',
      'bg-yellow-500/90',
      'bg-indigo-500/90',
      'bg-red-500/90',
      'bg-teal-500/90',
      'bg-amber-500/90',
      'bg-violet-500/90',
      'bg-emerald-500/90',
      'bg-lime-500/90',
      'bg-rose-500/90',
      'bg-fuchsia-500/90',
      'bg-sky-500/90',
      'bg-slate-500/90',
      'bg-gray-500/90',
      'bg-zinc-500/90',
      'bg-neutral-500/90',
      'bg-stone-500/90',
      'bg-blue-600/90',
      'bg-green-600/90',
      'bg-purple-600/90',
      'bg-orange-600/90',
      'bg-pink-600/90',
      'bg-cyan-600/90',
      'bg-yellow-600/90',
      'bg-indigo-600/90',
      'bg-red-600/90',
      'bg-teal-600/90',
      'bg-amber-600/90',
      'bg-violet-600/90',
      'bg-emerald-600/90',
      'bg-lime-600/90',
      'bg-rose-600/90',
      'bg-fuchsia-600/90',
      'bg-sky-600/90',
      'bg-blue-400/90',
      'bg-green-400/90',
      'bg-purple-400/90',
      'bg-orange-400/90',
      'bg-pink-400/90',
      'bg-cyan-400/90',
      'bg-yellow-400/90',
      'bg-indigo-400/90',
      'bg-red-400/90',
      'bg-teal-400/90',
      'bg-amber-400/90',
      'bg-violet-400/90',
      'bg-emerald-400/90',
      'bg-lime-400/90',
      'bg-rose-400/90',
      'bg-fuchsia-400/90',
      'bg-sky-400/90',
    ]
    
    const index = Math.abs(hash) % colors.length
    return colors[index]
  }

  // Get color for an image - if linked to multiple assets, use a special color
  const getImageColor = (image: MediaImage): string => {
    if (image.assetIsDeleted) return 'bg-gray-500/90'
    
    // If linked to multiple assets, use a special gradient/mixed color
    if (image.linkedAssetTagIds && image.linkedAssetTagIds.length > 1) {
      return 'bg-gradient-to-br from-purple-500/90 to-indigo-500/90' // Special color for multi-asset links
    }
    
    // Single asset - use the asset's color
    return getAssetColor(image.linkedAssetTagId)
  }

  // Get hover color for an asset tag ID (darker version)
  const getAssetHoverColor = (assetTagId: string | null | undefined): string => {
    if (!assetTagId) return 'hover:bg-blue-600/90'
    
    const baseColor = getAssetColor(assetTagId)
    // Convert base color to hover color by making it darker
    // Replace 400/500 with 600, and 600 with 700
    if (baseColor.includes('400')) {
      return baseColor.replace('400', '500')
    } else if (baseColor.includes('500')) {
      return baseColor.replace('500', '600')
    } else {
      return baseColor.replace('600', '700')
    }
  }

  // Fetch images with pagination
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['assets', 'media', currentPage, gridColumns],
    queryFn: async () => {
      const response = await fetch(`/api/assets/media?page=${currentPage}&pageSize=${pageSize}`)
      if (!response.ok) {
        throw new Error('Failed to fetch media')
      }
      return response.json() as Promise<{
        images: MediaImage[]
        pagination: {
          total: number
          page: number
          pageSize: number
          totalPages: number
        }
      }>
    },
    enabled: canManageMedia && !permissionsLoading,
    staleTime: 0, // Always refetch when invalidated
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  })

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['assets', 'media'] })
    refetch()
    toast.success('Media refreshed')
  }

  const uploadImage = async (file: File, onProgress?: (progress: number) => void) => {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const formData = new FormData()
      formData.append('file', file)

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const progress = (e.loaded / e.total) * 100
          onProgress(progress)
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          resolve()
        } else {
          try {
            const error = JSON.parse(xhr.responseText)
            reject(new Error(error.error || 'Upload failed'))
          } catch {
            reject(new Error('Upload failed'))
          }
        }
      })

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'))
      })

      xhr.open('POST', '/api/assets/media/upload')
      xhr.send(formData)
    })
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    if (files.length === 0) return

    // Validate file types
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    const maxSize = 5 * 1024 * 1024 // 5MB
    
    const validFiles = files.filter(file => {
      if (!allowedTypes.includes(file.type)) {
        toast.error(`${file.name} is not a valid image type. Only JPEG, PNG, GIF, and WebP are allowed.`)
        return false
      }
      if (file.size > maxSize) {
        toast.error(`${file.name} is too large. Maximum size is 5MB.`)
        return false
      }
      return true
    })

    if (validFiles.length === 0) return

    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Upload files sequentially to track progress properly
      const totalFiles = validFiles.length
      let uploadedCount = 0

      for (let i = 0; i < validFiles.length; i++) {
        await uploadImage(validFiles[i], (progress) => {
          // Calculate overall progress: (uploaded files + current file progress) / total
          const overallProgress = ((uploadedCount + progress / 100) / totalFiles) * 100
          setUploadProgress(Math.min(overallProgress, 100))
        })
        uploadedCount++
        setUploadProgress((uploadedCount / totalFiles) * 100)
      }

      toast.success(`Successfully uploaded ${validFiles.length} image(s)`)
      
      // Invalidate and refetch media
      await queryClient.invalidateQueries({ queryKey: ['assets', 'media'] })
      await refetch()
      
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Error uploading images:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to upload images')
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const handlePageChange = (page: number) => {
    router.push(`/tools/media?page=${page}`)
    // Scroll to top when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleImageClick = (image: MediaImage) => {
    setPreviewImage(image)
    setIsPreviewOpen(true)
  }

  const handleDeleteClick = (e: React.MouseEvent, image: MediaImage) => {
    e.stopPropagation()
    setImageToDelete(image)
    setIsDeleteDialogOpen(true)
  }

  // Delete image mutation - deletes ALL links for this image and the file from storage
  const deleteImageMutation = useMutation({
    mutationFn: async (image: MediaImage) => {
      const response = await fetch(`/api/assets/media/delete?imageUrl=${encodeURIComponent(image.imageUrl)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to delete image')
      }

      return response.json()
    },
    onSuccess: async (data) => {
      const deletedLinks = data.deletedLinks || 0
      if (deletedLinks > 0) {
        toast.success(`Image deleted successfully. Removed ${deletedLinks} link(s) from asset(s).`)
      } else {
        toast.success('Image deleted successfully')
      }
      setIsDeleteDialogOpen(false)
      setImageToDelete(null)
      // Invalidate media query to refresh the list and update linked status
      await queryClient.invalidateQueries({ queryKey: ['assets', 'media'] })
      // Refetch media to show updated list immediately
      await refetch()
      // Also invalidate assets query to update image counts
      await queryClient.invalidateQueries({ queryKey: ['assets'] })
      // Invalidate all asset images queries for linked assets
      if (imageToDelete?.linkedAssetTagIds && imageToDelete.linkedAssetTagIds.length > 0) {
        imageToDelete.linkedAssetTagIds.forEach((assetTagId) => {
          queryClient.invalidateQueries({ queryKey: ['assets', 'images', assetTagId] })
        })
      } else if (imageToDelete?.linkedAssetTagId) {
        queryClient.invalidateQueries({ queryKey: ['assets', 'images', imageToDelete.linkedAssetTagId] })
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete image')
      setIsDeleteDialogOpen(false)
      setImageToDelete(null)
    },
  })

  const handleConfirmDelete = () => {
    if (imageToDelete) {
      deleteImageMutation.mutate(imageToDelete)
    }
  }

  // Combined loading state
  const isLoadingData = permissionsLoading || isLoading

  if (!canManageMedia && !permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              You don&apos;t have permission to manage media.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isError && !permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-destructive">
              Failed to load media. Please try again.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const images = data?.images || []
  const pagination = data?.pagination

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Media</h1>
          <p className="text-muted-foreground mt-1">
            {pagination ? `Total: ${pagination.total} images` : 'Loading...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            disabled={isUploading}
          />
          <Button
            variant="outline"
            onClick={() => {
              if (!canManageMedia) {
                toast.error('You do not have permission to take actions')
                return
              }
              if (isUploading) {
                return
              }
              fileInputRef.current?.click()
            }}
            disabled={isUploading}
          >
            <Upload className={`h-4 w-4 mr-2 ${isUploading ? 'animate-pulse' : ''}`} />
            {isUploading ? `Uploading... ${Math.round(uploadProgress)}%` : 'Upload Images'}
          </Button>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isLoadingData}
          >
            <RotateCw className={`h-4 w-4 mr-2 ${isLoadingData ? 'animate-spin' : ''}`} />
            Reload
          </Button>
          <Select
            value={gridColumns.toString()}
            onValueChange={(value) => setGridColumns(parseInt(value, 10))}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="4">4 Columns</SelectItem>
              <SelectItem value="5">5 Columns</SelectItem>
              <SelectItem value="6">6 Columns</SelectItem>
              <SelectItem value="7">7 Columns</SelectItem>
              <SelectItem value="8">8 Columns</SelectItem>
              <SelectItem value="9">9 Columns</SelectItem>
              <SelectItem value="10">10 Columns</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoadingData ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
          <Spinner className="h-8 w-8" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      ) : images.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No images found.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Image Grid */}
          <div className={`grid ${gridClasses[gridColumns as keyof typeof gridClasses]} gap-3 mb-6`}>
            {images.map((image) => (
              <div
                key={image.id}
                className="relative group aspect-square rounded-lg overflow-hidden border cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => handleImageClick(image)}
              >
                <Image
                  src={image.imageUrl}
                  alt={`Asset ${image.assetTagId} image`}
                  fill
                  className="object-cover"
                  unoptimized
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="bg-white/90 rounded-full p-2">
                    <Eye className="h-5 w-5 text-black" />
                  </div>
                </div>
                {/* Linked to Asset Indicator */}
                {image.isLinked && (
                  <div className="absolute top-0 left-0 z-10">
                    {image.linkedAssetTagIds && image.linkedAssetTagIds.length > 1 ? (
                      // Multiple assets - show dropdown
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <div 
                            className={`${getImageColor(image)} hover:opacity-80 text-white p-1 rounded-full shadow-lg cursor-pointer transition-all flex items-center gap-0.5`}
                            onClick={(e) => e.stopPropagation()}
                            title={`Linked to ${image.linkedAssetTagIds.length} assets (Click to view)`}
                          >
                            <Link2 className="h-2.5 w-2.5" />
                            <ChevronDown className="h-2 w-2" />
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
                          <div className="max-h-60 overflow-y-auto">
                            {image.linkedAssetsInfo?.map((assetInfo) => (
                              <DropdownMenuItem
                                key={assetInfo.assetTagId}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (assetInfo.isDeleted) {
                                    router.push(`/tools/trash?search=${encodeURIComponent(assetInfo.assetTagId)}`)
                                  } else {
                                    router.push(`/assets?search=${encodeURIComponent(assetInfo.assetTagId)}`)
                                  }
                                }}
                              >
                                <Link2 className="mr-2 h-3.5 w-3.5" />
                                {assetInfo.assetTagId}
                                {assetInfo.isDeleted && (
                                  <span className="ml-2 text-xs text-muted-foreground">(Archived)</span>
                                )}
                              </DropdownMenuItem>
                            ))}
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      // Single asset - show simple link
                      <div 
                        className={`${getImageColor(image)} ${image.assetIsDeleted ? 'hover:bg-gray-600/90' : getAssetHoverColor(image.linkedAssetTagId)} text-white p-1 rounded-full shadow-lg cursor-pointer transition-colors`}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (image.linkedAssetTagId) {
                            // Navigate to trash page if asset is deleted, otherwise to assets page
                            if (image.assetIsDeleted) {
                              router.push(`/tools/trash?search=${encodeURIComponent(image.linkedAssetTagId)}`)
                            } else {
                              router.push(`/assets?search=${encodeURIComponent(image.linkedAssetTagId)}`)
                            }
                          }
                        }}
                        title={image.linkedAssetTagId 
                          ? image.assetIsDeleted 
                            ? `Linked to archived asset: ${image.linkedAssetTagId} (Click to view in Trash)`
                            : `Linked to asset: ${image.linkedAssetTagId}`
                          : 'Linked to asset'}
                      >
                        <Link2 className="h-2.5 w-2.5" />
                      </div>
                    )}
                  </div>
                )}
                {/* Asset Tag Badge */}
                <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/60 via-black/30 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-white text-xs truncate" title={image.fileName || image.assetTagId}>
                    {image.fileName || image.assetTagId}
                  </p>
                </div>
                {/* 3-dot menu */}
                {canManageMedia && (
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8 bg-black/50 hover:bg-black/70 border-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4 text-white" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => handleDeleteClick(e, image)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination && (
            <div className="flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </PaginationItem>

                  {/* Page numbers */}
                  {Array.from({ length: Math.min(7, pagination.totalPages) }, (_, i) => {
                    let pageNum: number
                    if (pagination.totalPages <= 7) {
                      pageNum = i + 1
                    } else if (currentPage <= 4) {
                      pageNum = i + 1
                    } else if (currentPage >= pagination.totalPages - 3) {
                      pageNum = pagination.totalPages - 6 + i
                    } else {
                      pageNum = currentPage - 3 + i
                    }

                    return (
                      <PaginationItem key={pageNum}>
                        {pageNum === currentPage ? (
                          <PaginationLink isActive>{pageNum}</PaginationLink>
                        ) : (
                          <Button
                            variant="ghost"
                            onClick={() => handlePageChange(pageNum)}
                            className="w-10"
                          >
                            {pageNum}
                          </Button>
                        )}
                      </PaginationItem>
                    )
                  })}

                  {pagination.totalPages > 7 && currentPage < pagination.totalPages - 3 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}

                  <PaginationItem>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === pagination.totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}

          {/* Delete Confirmation Dialog */}
          <DeleteConfirmationDialog
            open={isDeleteDialogOpen}
            onOpenChange={setIsDeleteDialogOpen}
            onConfirm={handleConfirmDelete}
            isLoading={deleteImageMutation.isPending}
            title="Delete Image"
            description={
              imageToDelete?.linkedAssetsInfo && imageToDelete.linkedAssetsInfo.length > 0
                ? `Are you sure you want to delete this image? This will remove it from ${imageToDelete.linkedAssetsInfo.length} linked asset(s). This action cannot be undone.`
                : imageToDelete?.isLinked
                  ? `Are you sure you want to delete this image? This will remove it from the linked asset. This action cannot be undone.`
                  : `Are you sure you want to delete this image? This action cannot be undone.`
            }
            itemName="image"
            affectedAssets={imageToDelete?.linkedAssetsInfo || undefined}
          />

          {/* Image Preview Dialog */}
          <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>
                  <div className="space-y-1">
                    <div>{previewImage?.fileName || previewImage?.assetTagId}</div>
                    {previewImage?.assetTagId && previewImage.fileName !== previewImage.assetTagId && (
                      <div className="text-sm text-muted-foreground font-normal">
                        Asset: {previewImage.assetTagId}
                      </div>
                    )}
                    {previewImage?.createdAt && (
                      <div className="text-sm text-muted-foreground font-normal">
                        {format(new Date(previewImage.createdAt), 'PPp')}
                      </div>
                    )}
                  </div>
                </DialogTitle>
              </DialogHeader>
              {previewImage && (
                <div className="flex items-center justify-center mt-4">
                  <div className="relative w-full h-[70vh] max-h-[600px]">
                    <Image
                      src={previewImage.imageUrl}
                      alt={`Asset ${previewImage.assetTagId} image`}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </>
  )
}

