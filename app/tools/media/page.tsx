'use client'

import { useState, useEffect, useMemo, useRef, useTransition, Suspense, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePermissions } from '@/hooks/use-permissions'
import { useIsMobile } from '@/hooks/use-mobile'
import { useMobileDock } from '@/components/mobile-dock-provider'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { Eye, ChevronLeft, ChevronRight, MoreVertical, Trash2, Link2, ChevronDown, RotateCw, FileText, Image as ImageIcon } from 'lucide-react'
import { format } from 'date-fns'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DeleteConfirmationDialog } from '@/components/dialogs/delete-confirmation-dialog'
import { BulkDeleteDialog } from '@/components/dialogs/bulk-delete-dialog'
import { DownloadConfirmationDialog } from '@/components/dialogs/download-confirmation-dialog'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { ImagePreviewDialog } from '@/components/dialogs/image-preview-dialog'
import { cn } from '@/lib/utils'

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
  imageType?: string | null
  imageSize?: number | null
}

interface MediaDocument {
  id: string
  documentUrl: string
  assetTagId: string
  fileName: string
  createdAt: string
  isLinked?: boolean
  linkedAssetTagId?: string | null
  linkedAssetTagIds?: string[]
  linkedAssetsInfo?: Array<{ assetTagId: string; isDeleted: boolean }>
  assetIsDeleted?: boolean
  documentType?: string | null
  documentSize?: number | null
  mimeType?: string | null
}

function MediaPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canManageMedia = hasPermission('canManageMedia')
  const isMobile = useIsMobile()
  const { setDockContent } = useMobileDock()

  // Initialize activeTab from URL params, default to 'media'
  const tabFromUrl = searchParams.get('tab') as 'media' | 'documents' | null
  const [activeTab, setActiveTab] = useState<'media' | 'documents'>(tabFromUrl === 'documents' ? 'documents' : 'media')
  const [reloadKey, setReloadKey] = useState(0) // Key to trigger re-animation on reload

  // Sync activeTab with URL params when URL changes (e.g., back/forward navigation)
  useEffect(() => {
    const currentTabFromUrl = searchParams.get('tab') as 'media' | 'documents' | null
    const urlTab = currentTabFromUrl === 'documents' ? 'documents' : 'media'
    setActiveTab(prevTab => {
      // Only update if different to avoid unnecessary re-renders
      return prevTab !== urlTab ? urlTab : prevTab
    })
  }, [searchParams])
  const [previewImageIndex, setPreviewImageIndex] = useState<number>(0)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [imageToDelete, setImageToDelete] = useState<MediaImage | null>(null)
  const [documentToDelete, setDocumentToDelete] = useState<MediaDocument | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)
  const [imageDetails, setImageDetails] = useState<MediaImage | null>(null)
  const [documentDetails, setDocumentDetails] = useState<MediaDocument | null>(null)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const [documentToDownload, setDocumentToDownload] = useState<MediaDocument | null>(null)
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false)
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set())
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)
  const [, startTransition] = useTransition()

  // Get page from URL params
  const currentPage = parseInt(searchParams.get('page') || '1', 10)

  // Update URL when tab changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString())
    if (activeTab === 'documents') {
      params.set('tab', 'documents')
    } else {
      params.delete('tab') // Remove tab param for media (default)
    }
    
    const newUrl = params.toString() 
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname
    
    // Only update URL if it's different to avoid unnecessary navigation
    if (window.location.search !== (params.toString() ? `?${params.toString()}` : '')) {
      router.replace(newUrl, { scroll: false })
    }
  }, [activeTab, router, searchParams])

  // Grid columns selection (stored in localStorage)
  const [gridColumns, setGridColumns] = useState<number>(8)
  const [isClient, setIsClient] = useState(false)

  // Load gridColumns from localStorage after mount to prevent hydration mismatch
  useEffect(() => {
    setIsClient(true)
    const saved = localStorage.getItem('media-grid-columns')
    if (saved) {
      const parsed = parseInt(saved, 10)
      if (parsed >= 4 && parsed <= 10) {
        setGridColumns(parsed)
      }
    }
  }, [])

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

  // Ensure component is mounted before rendering Radix UI components to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Fetch images with pagination - allow viewing even without permission
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
        storage?: {
          used: number
          limit: number
        }
      }>
    },
    enabled: !permissionsLoading && activeTab === 'media', // Allow viewing even without canManageMedia permission
    staleTime: 0, // Always refetch when invalidated
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  })

  // Fetch documents with pagination
  const { data: documentsData, isLoading: isLoadingDocuments, isError: isDocumentsError, refetch: refetchDocuments } = useQuery({
    queryKey: ['assets', 'documents', currentPage, gridColumns],
    queryFn: async () => {
      const response = await fetch(`/api/assets/documents?page=${currentPage}&pageSize=${pageSize}`)
      if (!response.ok) {
        throw new Error('Failed to fetch documents')
      }
      return response.json() as Promise<{
        documents: MediaDocument[]
        pagination: {
          total: number
          page: number
          pageSize: number
          totalPages: number
        }
        storage?: {
          used: number
          limit: number
        }
      }>
    },
    enabled: !permissionsLoading && activeTab === 'documents',
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  })

  const handleRefresh = () => {
    // Trigger reload animation by updating key
    setReloadKey(prev => prev + 1)
    
    if (activeTab === 'media') {
    refetch()
    toast.success('Media refreshed')
    } else {
      refetchDocuments()
      toast.success('Documents refreshed')
    }
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

    // Check storage limit before uploading
    const storageLimit = data?.storage?.limit || 5 * 1024 * 1024 // 5MB default
    const currentStorageUsed = data?.storage?.used || 0
    const totalNewSize = validFiles.reduce((sum, file) => sum + file.size, 0)
    
    if (currentStorageUsed + totalNewSize > storageLimit) {
      toast.error(
        `Storage limit exceeded. Current usage: ${formatFileSize(currentStorageUsed)} / ${formatFileSize(storageLimit)}. ` +
        `Cannot upload ${formatFileSize(totalNewSize)}. Please delete some images first.`
      )
      return
    }

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
      // Also invalidate documents cache in case storage changed
      await queryClient.invalidateQueries({ queryKey: ['assets', 'documents'] })
      
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

  const uploadDocument = async (file: File, onProgress?: (progress: number) => void) => {
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

      xhr.open('POST', '/api/assets/documents/upload')
      xhr.send(formData)
    })
  }

  const handleDocumentFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    if (files.length === 0) return

    // Validate file types - allow documents and images
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
    const maxSize = 5 * 1024 * 1024 // 5MB
    
    const validFiles = files.filter(file => {
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
        toast.error(`${file.name} is not a valid document type. Only PDF, DOC, DOCX, XLS, XLSX, TXT, CSV, RTF, JPEG, PNG, GIF, and WebP are allowed.`)
        return false
      }
      if (file.size > maxSize) {
        toast.error(`${file.name} is too large. Maximum size is 5MB.`)
        return false
      }
      return true
    })

    if (validFiles.length === 0) return

    // Check storage limit before uploading
    const storageLimit = documentsData?.storage?.limit || 5 * 1024 * 1024 // 5MB default
    const currentStorageUsed = documentsData?.storage?.used || 0
    const totalNewSize = validFiles.reduce((sum, file) => sum + file.size, 0)
    
    if (currentStorageUsed + totalNewSize > storageLimit) {
      toast.error(
        `Storage limit exceeded. Current usage: ${formatFileSize(currentStorageUsed)} / ${formatFileSize(storageLimit)}. ` +
        `Cannot upload ${formatFileSize(totalNewSize)}. Please delete some documents first.`
      )
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Upload files sequentially to track progress properly
      const totalFiles = validFiles.length
      let uploadedCount = 0

      for (let i = 0; i < validFiles.length; i++) {
        await uploadDocument(validFiles[i], (progress) => {
          // Calculate overall progress: (uploaded files + current file progress) / total
          const overallProgress = ((uploadedCount + progress / 100) / totalFiles) * 100
          setUploadProgress(Math.min(overallProgress, 100))
        })
        uploadedCount++
        setUploadProgress((uploadedCount / totalFiles) * 100)
      }

      toast.success(`Successfully uploaded ${validFiles.length} document(s)`)
      
      // Invalidate and refetch documents
      await queryClient.invalidateQueries({ queryKey: ['assets', 'documents'] })
      await refetchDocuments()
      // Also invalidate media cache in case storage changed
      await queryClient.invalidateQueries({ queryKey: ['assets', 'media'] })
      
      // Reset input
      if (documentInputRef.current) {
        documentInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Error uploading documents:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to upload documents')
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const handlePageChange = (page: number) => {
    startTransition(() => {
      router.push(`/tools/media?page=${page}`)
      // Clear selections when page changes
      setSelectedImages(new Set())
      setSelectedDocuments(new Set())
    })
    // Scroll to top when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleImageClick = (image: MediaImage) => {
    const index = images.findIndex(img => img.id === image.id)
    setPreviewImageIndex(index >= 0 ? index : 0)
    setIsPreviewOpen(true)
  }

  const handleDeleteClick = (e: React.MouseEvent, image: MediaImage) => {
    e.stopPropagation()
    setImageToDelete(image)
    setIsDeleteDialogOpen(true)
  }

  const handleDetailsClick = (e: React.MouseEvent, image: MediaImage) => {
    e.stopPropagation()
    setImageDetails(image)
    setIsDetailsDialogOpen(true)
  }

  const handleDocumentDetailsClick = (e: React.MouseEvent, document: MediaDocument) => {
    e.stopPropagation()
    setDocumentDetails(document)
    setIsDetailsDialogOpen(true)
  }

  const formatFileSize = (bytes: number | null | undefined): string => {
    if (!bytes) return 'Unknown'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
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


  // Handle checkbox selection
  const handleImageSelect = (e: React.MouseEvent, imageId: string) => {
    e.stopPropagation()
    toggleImageSelection(imageId)
  }

  // Toggle image selection
  const toggleImageSelection = (imageId: string) => {
    setSelectedImages(prev => {
      const newSet = new Set(prev)
      if (newSet.has(imageId)) {
        newSet.delete(imageId)
      } else {
        newSet.add(imageId)
      }
      return newSet
    })
  }

  // Handle card click in selection mode
  const handleImageCardClick = (image: MediaImage) => {
    if (isSelectionMode) {
      toggleImageSelection(image.id)
    } else {
      handleImageClick(image)
    }
  }


  // Toggle selection mode
  const handleToggleSelectionMode = useCallback(() => {
    setIsSelectionMode(prev => {
      if (prev) {
        // Clear selections when exiting selection mode
        setSelectedImages(new Set())
        setSelectedDocuments(new Set())
      }
      return !prev
    })
  }, [])

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (imageUrls: string[]) => {
      const response = await fetch('/api/assets/media/bulk-delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageUrls }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to delete images')
      }

      return response.json()
    },
    onSuccess: async (data) => {
      const deletedCount = data.deletedCount || 0
      const deletedLinks = data.deletedLinks || 0
      if (deletedLinks > 0) {
        toast.success(`Deleted ${deletedCount} image(s) and removed ${deletedLinks} link(s)`)
      } else {
        toast.success(`Deleted ${deletedCount} image(s)`)
      }
      setIsBulkDeleteDialogOpen(false)
      setSelectedImages(new Set())
      // Invalidate media query to refresh the list
      await queryClient.invalidateQueries({ queryKey: ['assets', 'media'] })
      await refetch()
      // Also invalidate assets query to update image counts
      await queryClient.invalidateQueries({ queryKey: ['assets'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete images')
      setIsBulkDeleteDialogOpen(false)
    },
  })

  const handleBulkDelete = () => {
    if (activeTab === 'media') {
    const selectedImageUrls = images
      .filter(img => selectedImages.has(img.id))
      .map(img => img.imageUrl)
    
    if (selectedImageUrls.length === 0) {
      toast.error('No images selected')
      return
    }

    bulkDeleteMutation.mutate(selectedImageUrls)
    } else {
      const selectedDocumentUrls = documents
        .filter(doc => selectedDocuments.has(doc.id))
        .map(doc => doc.documentUrl)
      
      if (selectedDocumentUrls.length === 0) {
        toast.error('No documents selected')
        return
      }

      bulkDeleteDocumentMutation.mutate(selectedDocumentUrls)
    }
  }

  // Delete document mutation
  const deleteDocumentMutation = useMutation({
    mutationFn: async (document: MediaDocument) => {
      const response = await fetch(`/api/assets/documents/delete?documentUrl=${encodeURIComponent(document.documentUrl)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to delete document')
      }

      return response.json()
    },
    onSuccess: async (data) => {
      const deletedLinks = data.deletedLinks || 0
      if (deletedLinks > 0) {
        toast.success(`Document deleted successfully. Removed ${deletedLinks} link(s) from asset(s).`)
      } else {
        toast.success('Document deleted successfully')
      }
      setIsDeleteDialogOpen(false)
      setDocumentToDelete(null)
      await queryClient.invalidateQueries({ queryKey: ['assets', 'documents'] })
      await refetchDocuments()
      await queryClient.invalidateQueries({ queryKey: ['assets'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete document')
      setIsDeleteDialogOpen(false)
      setDocumentToDelete(null)
    },
  })

  // Bulk delete document mutation
  const bulkDeleteDocumentMutation = useMutation({
    mutationFn: async (documentUrls: string[]) => {
      const response = await fetch('/api/assets/documents/bulk-delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentUrls }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to delete documents')
      }

      return response.json()
    },
    onSuccess: async (data) => {
      const deletedCount = data.deletedCount || 0
      const deletedLinks = data.deletedLinks || 0
      if (deletedLinks > 0) {
        toast.success(`Deleted ${deletedCount} document(s) and removed ${deletedLinks} link(s)`)
      } else {
        toast.success(`Deleted ${deletedCount} document(s)`)
      }
      setIsBulkDeleteDialogOpen(false)
      setSelectedDocuments(new Set())
      await queryClient.invalidateQueries({ queryKey: ['assets', 'documents'] })
      await refetchDocuments()
      await queryClient.invalidateQueries({ queryKey: ['assets'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete documents')
      setIsBulkDeleteDialogOpen(false)
    },
  })

  const handleDocumentDeleteClick = (e: React.MouseEvent, document: MediaDocument) => {
    e.stopPropagation()
    setDocumentToDelete(document)
    setIsDeleteDialogOpen(true)
  }

  const handleDocumentSelect = (e: React.MouseEvent, documentId: string) => {
    e.stopPropagation()
    toggleDocumentSelection(documentId)
  }

  // Toggle document selection
  const toggleDocumentSelection = (documentId: string) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev)
      if (newSet.has(documentId)) {
        newSet.delete(documentId)
      } else {
        newSet.add(documentId)
      }
      return newSet
    })
  }

  // Handle document card click in selection mode
  const handleDocumentCardClick = (document: MediaDocument) => {
    if (isSelectionMode) {
      toggleDocumentSelection(document.id)
    } else {
      // Original document click behavior
      const isImage = document.mimeType?.startsWith('image/') || 
        /\.(jpg|jpeg|png|gif|webp)$/i.test(document.fileName || '')
      
      if (isImage) {
        // For images, open in preview dialog (similar to media tab)
        const imageDocs = documents.filter(doc => {
          const docIsImage = doc.mimeType?.startsWith('image/') || 
            /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.fileName || '')
          return docIsImage
        })
        const index = imageDocs.findIndex(doc => doc.id === document.id)
        setPreviewImageIndex(index >= 0 ? index : 0)
        setIsPreviewOpen(true)
      } else {
        // Check file type
        const isPdf = document.mimeType === 'application/pdf' || 
          /\.pdf$/i.test(document.fileName || '')
        const isDownloadable = document.mimeType?.includes('excel') || 
          document.mimeType?.includes('spreadsheet') ||
          document.mimeType?.includes('word') ||
          document.mimeType?.includes('document') ||
          /\.(xls|xlsx|doc|docx)$/i.test(document.fileName || '')
        
        if (isPdf) {
          // PDF: open in new tab
          window.open(document.documentUrl, '_blank')
        } else if (isDownloadable) {
          // Excel, Word, etc.: show download confirmation dialog
          setDocumentToDownload(document)
          setIsDownloadDialogOpen(true)
        } else {
          // Other files: try to open in new tab
          window.open(document.documentUrl, '_blank')
        }
      }
    }
  }

  const handleConfirmDelete = () => {
    if (activeTab === 'media' && imageToDelete) {
      deleteImageMutation.mutate(imageToDelete)
    } else if (activeTab === 'documents' && documentToDelete) {
      deleteDocumentMutation.mutate(documentToDelete)
    }
  }

  // Combined loading state
  const isLoadingData = permissionsLoading || (activeTab === 'media' ? isLoading : isLoadingDocuments)

  const images = useMemo(() => data?.images || [], [data?.images])
  const documents = useMemo(() => documentsData?.documents || [], [documentsData?.documents])
  const pagination = activeTab === 'media' ? data?.pagination : documentsData?.pagination
  const storage = activeTab === 'media' ? data?.storage : documentsData?.storage

  // Handle select/deselect all - defined after images/documents are available
  const handleToggleSelectAll = useCallback(() => {
    if (selectedImages.size === images.length) {
      // If all are selected, just deselect all (don't exit selection mode)
      setSelectedImages(new Set())
    } else {
      setSelectedImages(new Set(images.map(img => img.id)))
    }
  }, [selectedImages.size, images])

  const handleToggleSelectAllDocuments = useCallback(() => {
    if (selectedDocuments.size === documents.length) {
      // If all are selected, just deselect all (don't exit selection mode)
      setSelectedDocuments(new Set())
    } else {
      setSelectedDocuments(new Set(documents.map(doc => doc.id)))
    }
  }, [selectedDocuments.size, documents])

  // Set mobile dock content - defined after images/documents and handlers are available
  useEffect(() => {
    if (isMobile) {
      if (isSelectionMode) {
        // Selection mode: Select All / Deselect All (left) + Cancel (middle, when items selected) + Delete icon (right, only when items selected)
        const hasSelectedItems = activeTab === 'media' 
          ? selectedImages.size > 0 
          : selectedDocuments.size > 0
        const allSelected = activeTab === 'media'
          ? (selectedImages.size === images.length && images.length > 0)
          : (selectedDocuments.size === documents.length && documents.length > 0)
        
        setDockContent(
          <>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="lg"
                onClick={activeTab === 'media' ? handleToggleSelectAll : handleToggleSelectAllDocuments}
                className="rounded-full btn-glass-elevated"
              >
                {activeTab === 'media' 
                  ? (allSelected ? 'Deselect All' : 'Select All')
                  : (allSelected ? 'Deselect All' : 'Select All')
                }
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={handleToggleSelectionMode}
                className="rounded-full btn-glass-elevated"
              >
                Cancel
              </Button>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                if (!canManageMedia) {
                  toast.error(`You do not have permission to delete ${activeTab === 'media' ? 'images' : 'documents'}`)
                  return
                }
                setIsBulkDeleteDialogOpen(true)
              }}
              disabled={!hasSelectedItems}
              className="h-10 w-10 rounded-full btn-glass-elevated"
              title="Delete Selected"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )
      } else {
        // Normal mode: Select (left) + 3 dots (right)
        setDockContent(
          <>
            <Button
              variant="outline"
              size="lg"
              onClick={handleToggleSelectionMode}
              className="rounded-full btn-glass-elevated"
            >
              Select
            </Button>
            {isMounted && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-10 w-10 rounded-full btn-glass-elevated">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {/* Column selection for mobile */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Grid</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <AnimatePresence>
                        {[4, 5, 6, 7, 8, 9, 10].map((cols, index) => (
                          <motion.div
                            key={cols}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.15, delay: index * 0.02 }}
                          >
                            <DropdownMenuItem
                              onClick={() => setGridColumns(cols)}
                              className={gridColumns === cols ? 'bg-accent' : ''}
                            >
                              {cols} Columns
                            </DropdownMenuItem>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  {activeTab === 'media' && (
                    <DropdownMenuItem
                      onClick={() => {
                        if (!canManageMedia) {
                          toast.error('You do not have permission to upload images')
                          return
                        }
                        if (isUploading) {
                          return
                        }
                        fileInputRef.current?.click()
                      }}
                      disabled={isUploading}
                    >
                      {isUploading ? `Uploading... ${Math.round(uploadProgress)}%` : 'Upload Images'}
                    </DropdownMenuItem>
                  )}
                  {activeTab === 'documents' && (
                    <DropdownMenuItem
                      onClick={() => {
                        if (!canManageMedia) {
                          toast.error('You do not have permission to upload documents')
                          return
                        }
                        if (isUploading) {
                          return
                        }
                        documentInputRef.current?.click()
                      }}
                      disabled={isUploading}
                    >
                      {isUploading ? `Uploading... ${Math.round(uploadProgress)}%` : 'Upload Documents'}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        )
      }
    } else {
      setDockContent(null)
    }
    
    return () => {
      setDockContent(null)
    }
  }, [isMobile, setDockContent, isSelectionMode, isMounted, activeTab, canManageMedia, isUploading, uploadProgress, gridColumns, handleToggleSelectionMode, handleToggleSelectAll, handleToggleSelectAllDocuments, selectedImages.size, selectedDocuments.size, images.length, documents.length, setIsBulkDeleteDialogOpen])

  // Calculate storage usage percentage
  const storageUsed = storage?.used || 0
  const storageLimit = storage?.limit || 5 * 1024 * 1024 // 5MB default
  const storagePercentage = storageLimit > 0 ? (storageUsed / storageLimit) * 100 : 0

  // Clear selections when images change (e.g., after delete)
  // Use a ref to track previous image IDs to avoid infinite loops
  // IMPORTANT: This hook must be called before any early returns to avoid React hooks errors
  const prevImageIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const currentImageIds = new Set(images.map(img => img.id))
    const prevImageIds = prevImageIdsRef.current
    
    // Only update if image IDs actually changed
    const idsChanged = 
      currentImageIds.size !== prevImageIds.size ||
      Array.from(currentImageIds).some(id => !prevImageIds.has(id)) ||
      Array.from(prevImageIds).some(id => !currentImageIds.has(id))
    
    if (idsChanged) {
      // Remove selections for images that no longer exist
      setSelectedImages(prev => {
        return new Set(Array.from(prev).filter(id => currentImageIds.has(id)))
      })
      prevImageIdsRef.current = currentImageIds
    }
  }, [images])

  // Early returns must come AFTER all hooks
  if ((activeTab === 'media' && isError && !permissionsLoading) || (activeTab === 'documents' && isDocumentsError && !permissionsLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-destructive">
              Failed to load {activeTab === 'media' ? 'media' : 'documents'}. Please try again.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="mb-6 space-y-4">
        {/* Tabs */}
        <div className="flex items-center gap-2 border-b relative">
          <button
            onClick={() => setActiveTab('media')}
            className={`px-4 py-2 text-sm font-medium transition-colors relative z-10 ${
              activeTab === 'media'
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Media
            </div>
            {activeTab === 'media' && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-2 text-sm font-medium transition-colors relative z-10 ${
              activeTab === 'documents'
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documents
            </div>
            {activeTab === 'documents' && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        </div>

        {/* Header Section */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {activeTab === 'media' ? 'Media' : 'Documents'}
              </h1>
              <p className="text-muted-foreground mt-1">
                {activeTab === 'media' 
                  ? (pagination ? `${pagination.total} Images` : 'Loading...')
                  : (pagination ? `${pagination.total} documents` : 'Loading...')
                }
              </p>
            </div>
            {/* Desktop: All controls on right */}
            {!isMobile && (
              <div className="flex items-center gap-2">
                {isSelectionMode && (
                  <>
                    {activeTab === 'media' && (
                      <div className="flex items-center gap-2 px-2">
                        <Checkbox
                          id="select-all-media"
                          checked={selectedImages.size === images.length && images.length > 0}
                          onCheckedChange={handleToggleSelectAll}
                          disabled={images.length === 0}
                          title={selectedImages.size === images.length && images.length > 0
                            ? 'Deselect All'
                            : 'Select All'}
                          className='cursor-pointer'
                        />
                        <span className="text-sm text-muted-foreground">
                          {selectedImages.size} selected
                        </span>
                      </div>
                    )}
                    {activeTab === 'documents' && (
                      <div className="flex items-center gap-2 px-2">
                        <Checkbox
                          id="select-all-documents"
                          checked={selectedDocuments.size === documents.length && documents.length > 0}
                          onCheckedChange={handleToggleSelectAllDocuments}
                          disabled={documents.length === 0}
                          title={selectedDocuments.size === documents.length && documents.length > 0
                            ? 'Deselect All'
                            : 'Select All'}
                          className='cursor-pointer'
                        />
                        <span className="text-sm text-muted-foreground">
                          {selectedDocuments.size} selected
                        </span>
                      </div>
                    )}
                  </>
                )}
                <Button
                  variant={isSelectionMode ? "default" : "outline"}
                  size="sm"
                  onClick={handleToggleSelectionMode}
                  className="btn-glass"
                >
                  {isSelectionMode ? "Cancel" : "Select"}
                </Button>
                {isSelectionMode && (
                  <>
                    {activeTab === 'media' && selectedImages.size > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (!canManageMedia) {
                            toast.error('You do not have permission to delete images')
                            return
                          }
                          setIsBulkDeleteDialogOpen(true)
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete ({selectedImages.size})
                      </Button>
                    )}
                    {activeTab === 'documents' && selectedDocuments.size > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (!canManageMedia) {
                            toast.error('You do not have permission to delete documents')
                            return
                          }
                          setIsBulkDeleteDialogOpen(true)
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete ({selectedDocuments.size})
                      </Button>
                    )}
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                  disabled={isUploading}
                />
                <input
                  ref={documentInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.rtf,.jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  multiple
                  className="hidden"
                  onChange={handleDocumentFileSelect}
                  disabled={isUploading}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isLoadingData}
                  className="btn-glass"
                >
                  <RotateCw className={`h-4 w-4 mr-2 ${isLoadingData ? 'animate-spin' : ''}`} />
                  Reload
                </Button>
                <Select
                  value={gridColumns.toString()}
                  onValueChange={(value) => setGridColumns(parseInt(value, 10))}
                >
                  <SelectTrigger className="w-[120px] btn-glass" size="sm">
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
                {isMounted && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {activeTab === 'media' && (
                    <DropdownMenuItem
                      onClick={() => {
                        if (!canManageMedia) {
                          toast.error('You do not have permission to upload images')
                          return
                        }
                        if (isUploading) {
                          return
                        }
                        fileInputRef.current?.click()
                      }}
                      disabled={isUploading}
                    >
                      {isUploading ? `Uploading... ${Math.round(uploadProgress)}%` : 'Upload Images'}
                    </DropdownMenuItem>
                    )}
                    {activeTab === 'documents' && (
                      <DropdownMenuItem
                        onClick={() => {
                          if (!canManageMedia) {
                            toast.error('You do not have permission to upload documents')
                            return
                          }
                          if (isUploading) {
                            return
                          }
                          documentInputRef.current?.click()
                        }}
                        disabled={isUploading}
                      >
                        {isUploading ? `Uploading... ${Math.round(uploadProgress)}%` : 'Upload Documents'}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                )}
              </div>
            )}
            {/* Mobile: Reload and 3-dots on right side of title (always visible) */}
            {isMobile && (
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
                <input
                  ref={documentInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.rtf,.jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  multiple
                  className="hidden"
                  onChange={handleDocumentFileSelect}
                  disabled={isUploading}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isLoadingData}
                  className="btn-glass-elevated"
                >
                  <RotateCw className={`h-4 w-4 mr-2 ${isLoadingData ? 'animate-spin' : ''}`} />
                  Reload
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Upload Progress */}
        {isUploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {activeTab === 'media' ? 'Uploading images...' : 'Uploading documents...'}
              </span>
              <span className="text-muted-foreground">{Math.round(uploadProgress)}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        {/* Storage Usage Card */}
        {storage && (
          <div className="p-5 border rounded-lg bg-linear-to-br from-muted/50 to-muted/30 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-semibold">Storage Usage</span>
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                {formatFileSize(storageUsed)} / {formatFileSize(storageLimit)}
              </span>
            </div>
            <div className="space-y-2">
              <Progress 
                value={Math.min(storagePercentage, 100)} 
                className={`h-3 rounded-none ${
                    storagePercentage >= 90
                    ? '[&>div]:bg-destructive'
                      : storagePercentage >= 70
                      ? '[&>div]:bg-amber-500'
                      : ''
                  }`}
                />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {storagePercentage.toFixed(1)}% used
                </span>
                {storageUsed >= storageLimit ? (
                  <span className="text-xs font-medium text-destructive flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                    Storage limit reached
                  </span>
                ) : storagePercentage >= 90 ? (
                  <span className="text-xs font-medium text-amber-600 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Storage almost full
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
      {isLoadingData && activeTab === 'media' ? (
          <motion.div
            key="loading-media"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
          {/* Placeholder Storage Usage Card */}
          <div className="p-5 border rounded-lg bg-linear-to-br from-muted/50 to-muted/30 shadow-sm animate-pulse mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-semibold bg-muted h-4 w-24 rounded" />
              </div>
              <span className="text-sm font-medium bg-muted h-4 w-32 rounded" />
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-muted rounded-none" />
              <div className="flex items-center justify-between">
                <span className="text-xs bg-muted h-3 w-16 rounded" />
                <span className="text-xs bg-muted h-3 w-20 rounded" />
              </div>
            </div>
          </div>
          {/* Placeholder cards for images */}
          {isClient && (
            <div className={`grid ${gridClasses[gridColumns as keyof typeof gridClasses]} gap-3 mb-6`}>
              {Array.from({ length: pageSize }).map((_, index) => (
                <div
                  key={`placeholder-${index}`}
                  className="relative aspect-square rounded-lg overflow-hidden border bg-muted"
                >
                  <div className="absolute inset-0 bg-linear-to-br from-muted via-muted/50 to-muted flex items-center justify-center animate-pulse">
                    <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                </div>
              ))}
            </div>
          )}
          </motion.div>
      ) : isLoadingData && activeTab === 'documents' ? (
          <motion.div
            key="loading-documents"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
          {/* Placeholder Storage Usage Card */}
          <div className="p-5 border rounded-lg bg-linear-to-br from-muted/50 to-muted/30 shadow-sm animate-pulse mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-semibold bg-muted h-4 w-24 rounded" />
              </div>
              <span className="text-sm font-medium bg-muted h-4 w-32 rounded" />
            </div>
            <div className="space-y-2">
              <div className="h-3 bg-muted rounded-none" />
              <div className="flex items-center justify-between">
                <span className="text-xs bg-muted h-3 w-16 rounded" />
                <span className="text-xs bg-muted h-3 w-20 rounded" />
              </div>
            </div>
          </div>
          {/* Placeholder cards for documents */}
          {isClient && (
            <div className={`grid ${gridClasses[gridColumns as keyof typeof gridClasses]} gap-3 mb-6`}>
              {Array.from({ length: pageSize }).map((_, index) => (
                <div
                  key={`placeholder-doc-${index}`}
                  className="relative aspect-square rounded-lg overflow-hidden border bg-muted"
                >
                  <div className="absolute inset-0 bg-linear-to-br from-muted via-muted/50 to-muted flex items-center justify-center animate-pulse">
                    <FileText className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                </div>
              ))}
            </div>
          )}
          </motion.div>
      ) : activeTab === 'media' && images.length === 0 ? (
          <motion.div
            key="empty-media"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No images found.
            </p>
          </CardContent>
        </Card>
          </motion.div>
      ) : activeTab === 'documents' && documents.length === 0 ? (
          <motion.div
            key="empty-documents"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No documents found.
            </p>
          </CardContent>
        </Card>
          </motion.div>
      ) : !isClient ? (
        null
      ) : activeTab === 'media' ? (
          <motion.div
            key="media-content"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
          {/* Image Grid */}
          <motion.div 
            layout
            className={`grid ${gridClasses[gridColumns as keyof typeof gridClasses]} gap-3 mb-6`}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <AnimatePresence mode="popLayout">
              {images.map((image, index) => (
                <motion.div
                  key={`${image.id}-${reloadKey}`}
                  layout
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ 
                    opacity: 1, 
                    scale: 1, 
                    y: 0,
                    transition: {
                      type: "spring",
                      stiffness: 300,
                      damping: 20,
                      delay: index * 0.03
                    }
                  }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ scale: 1.02 }}
                  transition={{ 
                    duration: 0.2, 
                    delay: index * 0.03,
                    layout: { duration: 0.3 }
                  }}
                className={`relative group aspect-square rounded-lg overflow-hidden border ${
                  isSelectionMode ? 'cursor-pointer' : 'cursor-pointer hover:opacity-90'
                } ${
                  selectedImages.has(image.id)
                    ? 'border-primary'
                    : ''
                }`}
                style={{ transition: 'opacity 0.2s, border-color 0.2s' }}
                onClick={() => handleImageCardClick(image)}
              >
                {/* Checkbox - visible when in selection mode */}
                {isSelectionMode && (
                  <div 
                    className="absolute top-2 left-2 z-20"
                    onClick={(e) => handleImageSelect(e, image.id)}
                  >
                    <div>
                      <Checkbox
                        checked={selectedImages.has(image.id)}
                        onCheckedChange={() => toggleImageSelection(image.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="border-white data-[state=checked]:bg-white data-[state=checked]:text-black cursor-pointer"
                      />
                    </div>
                  </div>
                )}
                {/* Selection overlay */}
                {selectedImages.has(image.id) && (
                  <div className="absolute inset-0 bg-primary/20 border-2 border-primary rounded-lg pointer-events-none z-10" />
                )}
                <Image
                  src={image.imageUrl}
                  alt={`Asset ${image.assetTagId} image`}
                  fill
                  className="object-cover"
                  unoptimized
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"/>
                {/* Linked to Asset Indicator */}
                {(image.isLinked || (image.linkedAssetTagIds && image.linkedAssetTagIds.length > 0) || image.linkedAssetTagId) && (
                  <div className="absolute top-0 right-0 z-10">
                    {image.linkedAssetTagIds && image.linkedAssetTagIds.length > 1 ? (
                      // Multiple assets - show dropdown
                      isMounted ? (
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
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
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
                        // Show indicator during SSR (before mount) - always visible
                        <div 
                          className={`${getImageColor(image)} text-white p-1 rounded-full shadow-lg flex items-center gap-0.5 cursor-pointer`}
                          title={`Linked to ${image.linkedAssetTagIds.length} assets`}
                          onClick={(e) => {
                            e.stopPropagation()
                            // Navigate to first asset if available
                            const firstAsset = image.linkedAssetTagIds?.[0]
                            if (firstAsset) {
                              const assetInfo = image.linkedAssetsInfo?.find(info => info.assetTagId === firstAsset)
                              if (assetInfo?.isDeleted) {
                                router.push(`/tools/trash?search=${encodeURIComponent(firstAsset)}`)
                              } else {
                                router.push(`/assets?search=${encodeURIComponent(firstAsset)}`)
                              }
                            }
                          }}
                        >
                          <Link2 className="h-2.5 w-2.5" />
                          <ChevronDown className="h-2 w-2" />
                        </div>
                      )
                    ) : (
                      // Single asset - show simple link
                      (() => {
                        const tagId = image.linkedAssetTagId || image.linkedAssetTagIds?.[0]
                        const assetInfo = image.linkedAssetsInfo?.find(info => info.assetTagId === tagId)
                        const isDeleted = image.assetIsDeleted || assetInfo?.isDeleted || false
                        
                        if (!tagId) return null
                        
                        return (
                      <div 
                            className={`${getImageColor(image)} ${isDeleted ? 'hover:bg-gray-600/90' : getAssetHoverColor(tagId)} text-white p-1 rounded-full shadow-lg cursor-pointer transition-colors`}
                        onClick={(e) => {
                          e.stopPropagation()
                            // Navigate to trash page if asset is deleted, otherwise to assets page
                              if (isDeleted) {
                                router.push(`/tools/trash?search=${encodeURIComponent(tagId)}`)
                            } else {
                                router.push(`/assets?search=${encodeURIComponent(tagId)}`)
                          }
                        }}
                            title={isDeleted 
                              ? `Linked to archived asset: ${tagId} (Click to view in Trash)`
                              : `Linked to asset: ${tagId}`}
                      >
                        <Link2 className="h-2.5 w-2.5" />
                      </div>
                        )
                      })()
                    )}
                  </div>
                )}
                {/* Asset Tag Badge */}
                <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/60 via-black/30 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-white text-xs truncate" title={image.fileName || image.assetTagId}>
                    {image.fileName || image.assetTagId}
                  </p>
                </div>
                {/* 3-dot menu - show Details for all users, Delete for all but with permission check */}
                {!isSelectionMode && (
                  <div className={cn("absolute top-2 right-2 transition-opacity z-10", isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                    {isMounted && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4 text-white" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={(e) => handleDetailsClick(e, image)}>
                          <Eye className="mr-2 h-4 w-4 text-black" />
                          Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            if (!canManageMedia) {
                              toast.error('You do not have permission to delete images')
                              return
                            }
                            handleDeleteClick(e, image)
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4 text-black" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
            </AnimatePresence>
          </motion.div>

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
          </motion.div>
      ) : activeTab === 'documents' && isClient ? (
          <motion.div
            key="documents-content"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
          {/* Documents Grid */}
            <motion.div 
            layout
            className={`grid ${gridClasses[gridColumns as keyof typeof gridClasses]} gap-3 mb-6`}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <AnimatePresence mode="popLayout">
              {documents.map((document, index) => {
              
              return (
                  <motion.div
                  key={`${document.id}-${reloadKey}`}
                    layout
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ 
                      opacity: 1, 
                      scale: 1, 
                      y: 0,
                      transition: {
                        type: "spring",
                        stiffness: 300,
                        damping: 20,
                        delay: index * 0.03
                      }
                    }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    whileHover={{ scale: 1.02 }}
                    transition={{ 
                      duration: 0.2, 
                      delay: index * 0.03,
                      layout: { duration: 0.3 }
                    }}
                className={`relative group aspect-square rounded-lg overflow-hidden border transition-all bg-muted flex flex-col ${
                  isSelectionMode ? 'cursor-pointer' : 'cursor-pointer hover:opacity-90'
                } ${
                  selectedDocuments.has(document.id)
                    ? 'border-primary'
                    : ''
                }`}
                onClick={() => handleDocumentCardClick(document)}
              >
                {/* Checkbox - visible when in selection mode */}
                {isSelectionMode && (
                  <div 
                    className="absolute top-2 left-2 z-20"
                    onClick={(e) => handleDocumentSelect(e, document.id)}
                  >
                    <div>
                      <Checkbox
                        checked={selectedDocuments.has(document.id)}
                        onCheckedChange={() => toggleDocumentSelection(document.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="border-white data-[state=checked]:bg-white data-[state=checked]:text-black cursor-pointer"
                      />
                    </div>
                  </div>
                )}
                {/* Selection overlay */}
                {selectedDocuments.has(document.id) && (
                  <div className="absolute inset-0 bg-primary/20 border-2 border-primary rounded-lg pointer-events-none z-10" />
                )}
                {/* Check if document is an image */}
                {(() => {
                  const isImage = document.mimeType?.startsWith('image/') || 
                    /\.(jpg|jpeg|png|gif|webp)$/i.test(document.fileName || '')
                  
                  if (isImage) {
                    // Display image
                    return (
                      <>
                        <Image
                          src={document.documentUrl}
                          alt={document.fileName || 'Document'}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        {/* Image overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"/>
                        {/* Document Info */}
                        <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/60 via-black/30 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-white text-xs truncate" title={document.fileName}>
                            {document.fileName}
                          </p>
                          {document.documentSize && (
                            <p className="text-white/80 text-xs">
                              {formatFileSize(document.documentSize)}
                            </p>
                          )}
                        </div>
                      </>
                    )
                  } else {
                    // Display file icon for non-image documents
                    return (
                      <>
                        <div className="flex-1 flex items-center justify-center p-4">
                          <FileText className="h-16 w-16 text-muted-foreground" />
                        </div>
                        {/* Document Info */}
                        <div className="p-2 bg-background/80 backdrop-blur-sm">
                          <p className="text-xs font-medium truncate" title={document.fileName}>
                            {document.fileName}
                          </p>
                          {document.documentSize && (
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(document.documentSize)}
                            </p>
                          )}
                        </div>
                      </>
                    )
                  }
                })()}
                {/* Linked to Asset Indicator */}
                {(() => {
                  // Filter out STANDALONE from linked assets
                  const realLinkedAssetIds = document.linkedAssetTagIds?.filter(id => id !== 'STANDALONE') || []
                  const realLinkedAssetId = document.linkedAssetTagId && document.linkedAssetTagId !== 'STANDALONE' ? document.linkedAssetTagId : null
                  const hasRealLinks = realLinkedAssetIds.length > 0 || realLinkedAssetId !== null || (document.isLinked && realLinkedAssetIds.length > 0)
                  
                  if (!hasRealLinks) return null
                  
                  return (
                    <div className="absolute top-0 right-0 z-10">
                      {realLinkedAssetIds.length > 1 ? (
                      isMounted ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <div 
                            className={`${getAssetColor(realLinkedAssetIds[0])} hover:opacity-80 text-white p-1 rounded-full shadow-lg cursor-pointer transition-all flex items-center gap-0.5`}
                            onClick={(e) => e.stopPropagation()}
                            title={`Linked to ${realLinkedAssetIds.length} assets (Click to view)`}
                          >
                            <Link2 className="h-2.5 w-2.5" />
                            <ChevronDown className="h-2 w-2" />
                          </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          {realLinkedAssetIds.map((tagId) => {
                            const assetInfo = document.linkedAssetsInfo?.find(info => info.assetTagId === tagId)
                            return (
                              <DropdownMenuItem
                                key={tagId}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (assetInfo?.isDeleted) {
                                    router.push(`/tools/trash?search=${encodeURIComponent(tagId)}`)
                                  } else {
                                    router.push(`/assets?search=${encodeURIComponent(tagId)}`)
                                  }
                                }}
                                disabled={assetInfo?.isDeleted}
                              >
                                <span className={assetInfo?.isDeleted ? 'line-through text-muted-foreground' : ''}>
                                  {tagId}
                                </span>
                                {assetInfo?.isDeleted && (
                                  <span className="ml-2 text-xs text-muted-foreground">(Archived)</span>
                                )}
                              </DropdownMenuItem>
                            )
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      ) : (
                        // Show indicator during SSR (before mount) - always visible
                        <div 
                          className={`${getAssetColor(realLinkedAssetIds[0])} text-white p-1 rounded-full shadow-lg flex items-center gap-0.5 cursor-pointer`}
                          title={`Linked to ${realLinkedAssetIds.length} assets`}
                          onClick={(e) => {
                            e.stopPropagation()
                            // Navigate to first asset if available
                            const firstAsset = realLinkedAssetIds[0]
                            if (firstAsset) {
                              const assetInfo = document.linkedAssetsInfo?.find(info => info.assetTagId === firstAsset)
                              if (assetInfo?.isDeleted) {
                                router.push(`/tools/trash?search=${encodeURIComponent(firstAsset)}`)
                              } else {
                                router.push(`/assets?search=${encodeURIComponent(firstAsset)}`)
                              }
                            }
                          }}
                        >
                          <Link2 className="h-2.5 w-2.5" />
                          <ChevronDown className="h-2 w-2" />
                        </div>
                      )
                    ) : (
                      (() => {
                        const tagId = realLinkedAssetId || realLinkedAssetIds[0]
                        const assetInfo = document.linkedAssetsInfo?.find(info => info.assetTagId === tagId)
                        const isDeleted = document.assetIsDeleted || assetInfo?.isDeleted || false
                        
                        if (!tagId) return null
                        
                        return (
                          <div 
                            className={`${getAssetColor(tagId)} ${isDeleted ? 'hover:bg-gray-600/90' : getAssetHoverColor(tagId)} text-white p-1 rounded-full shadow-lg cursor-pointer transition-colors`}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (isDeleted) {
                                router.push(`/tools/trash?search=${encodeURIComponent(tagId)}`)
                              } else {
                                router.push(`/assets?search=${encodeURIComponent(tagId)}`)
                              }
                            }}
                            title={isDeleted 
                              ? `Linked to archived asset: ${tagId} (Click to view in Trash)`
                              : `Linked to asset: ${tagId}`}
                          >
                            <Link2 className="h-2.5 w-2.5" />
                          </div>
                        )
                      })()
                    )}
                  </div>
                  )
                })()}
                {/* 3-dot menu - show Details for all users, Delete for all but with permission check */}
                {!isSelectionMode && (
                  <div className={cn("absolute top-2 right-2 transition-opacity z-10", isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                    {isMounted && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4 text-white" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={(e) => handleDocumentDetailsClick(e, document)}>
                          <Eye className="mr-2 h-4 w-4 text-black" />
                          Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            if (!canManageMedia) {
                              toast.error('You do not have permission to delete documents')
                              return
                            }
                            handleDocumentDeleteClick(e, document)
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4 text-black" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    )}
                  </div>
                )}
                </motion.div>
              )
            })}
            </AnimatePresence>
          </motion.div>

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
                        <PaginationLink
                          onClick={() => handlePageChange(pageNum)}
                          isActive={currentPage === pageNum}
                        >
                          {pageNum}
                        </PaginationLink>
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
          </motion.div>
      ) : null}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        isLoading={activeTab === 'media' ? deleteImageMutation.isPending : deleteDocumentMutation.isPending}
        title={activeTab === 'media' ? 'Delete Image' : 'Delete Document'}
        description={
          activeTab === 'media' 
            ? (imageToDelete?.linkedAssetsInfo && imageToDelete.linkedAssetsInfo.length > 0
            ? `Are you sure you want to permanently delete this image? This will remove it from ${imageToDelete.linkedAssetsInfo.length} linked asset(s). This action cannot be undone.`
            : imageToDelete?.isLinked
              ? `Are you sure you want to permanently delete this image? This will remove it from the linked asset. This action cannot be undone.`
                  : `Are you sure you want to permanently delete this image? This action cannot be undone.`)
            : (documentToDelete?.linkedAssetsInfo && documentToDelete.linkedAssetsInfo.length > 0
                ? `Are you sure you want to permanently delete this document? This will remove it from ${documentToDelete.linkedAssetsInfo.length} linked asset(s). This action cannot be undone.`
                : documentToDelete?.isLinked
                  ? `Are you sure you want to permanently delete this document? This will remove it from the linked asset. This action cannot be undone.`
                  : `Are you sure you want to permanently delete this document? This action cannot be undone.`)
        }
        itemName={activeTab === 'media' ? 'image' : 'document'}
        confirmLabel="Delete"
        loadingLabel="Deleting..."
        affectedAssets={activeTab === 'media' ? (imageToDelete?.linkedAssetsInfo || undefined) : (documentToDelete?.linkedAssetsInfo || undefined)}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <BulkDeleteDialog
        open={isBulkDeleteDialogOpen}
        onOpenChange={setIsBulkDeleteDialogOpen}
        onConfirm={handleBulkDelete}
        itemCount={activeTab === 'media' ? selectedImages.size : selectedDocuments.size}
        itemName={activeTab === 'media' ? 'image' : 'document'}
        isDeleting={activeTab === 'media' ? bulkDeleteMutation.isPending : bulkDeleteDocumentMutation.isPending}
      />

      {/* Image Preview Dialog */}
          <ImagePreviewDialog
            open={isPreviewOpen}
            onOpenChange={setIsPreviewOpen}
        existingImages={activeTab === 'media' 
          ? images.map(img => ({
              id: img.id,
              imageUrl: img.imageUrl,
              fileName: img.fileName,
            }))
          : documents
              .filter(doc => {
                const isImage = doc.mimeType?.startsWith('image/') || 
                  /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.fileName || '')
                return isImage
              })
              .map(doc => ({
                id: doc.id,
                imageUrl: doc.documentUrl,
                fileName: doc.fileName,
              }))
        }
        initialIndex={previewImageIndex}
        title={activeTab === 'media' ? 'Media Preview' : 'Document Preview'}
        description={
          activeTab === 'media' 
            ? (images.length > 1 ? `Browse through ${images.length} images` : undefined)
            : (documents.filter(doc => {
                const isImage = doc.mimeType?.startsWith('image/') || 
                  /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.fileName || '')
                return isImage
              }).length > 1 
                ? `Browse through ${documents.filter(doc => {
                    const isImage = doc.mimeType?.startsWith('image/') || 
                      /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.fileName || '')
                    return isImage
                  }).length} images` 
                : undefined)
        }
          />

      {/* Image/Document Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={(open) => {
        setIsDetailsDialogOpen(open)
        if (!open) {
          setImageDetails(null)
          setDocumentDetails(null)
        }
      }}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
            <DialogTitle className="text-white">{imageDetails ? 'Image Details' : 'Document Details'}</DialogTitle>
              </DialogHeader>
              {imageDetails && (
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-white">File Name</div>
                    <div className="text-sm text-white/90 break-all">
                      {imageDetails.fileName || 'N/A'}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-white">URL</div>
                    <div className="text-sm text-blue-300 break-all">
                      <a
                        href={imageDetails.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-300 hover:text-blue-200 hover:underline"
                      >
                        {imageDetails.imageUrl}
                      </a>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-white">Type</div>
                      <div className="text-sm text-white/90">
                        {imageDetails.imageType || 'Unknown'}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-white">Size</div>
                      <div className="text-sm text-white/90">
                        {formatFileSize(imageDetails.imageSize)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium text-white">Created At</div>
                    <div className="text-sm text-white/90">
                      {imageDetails.createdAt
                        ? format(new Date(imageDetails.createdAt), 'PPp')
                        : 'Unknown'}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium text-white">
                      Linked Asset{imageDetails.linkedAssetTagIds && imageDetails.linkedAssetTagIds.length > 1 ? 's' : ''}
                    </div>
                    {imageDetails.linkedAssetTagIds && imageDetails.linkedAssetTagIds.length > 0 ? (
                      <div className="space-y-1">
                        {imageDetails.linkedAssetsInfo?.map((assetInfo) => (
                          <div
                            key={assetInfo.assetTagId}
                            className="flex items-center gap-2 text-sm"
                          >
                            <Link2 className="h-3.5 w-3.5 text-blue-300" />
                            <button
                              onClick={() => {
                                if (assetInfo.isDeleted) {
                                  router.push(`/tools/trash?search=${encodeURIComponent(assetInfo.assetTagId)}`)
                                } else {
                                  router.push(`/assets?search=${encodeURIComponent(assetInfo.assetTagId)}`)
                                }
                                setIsDetailsDialogOpen(false)
                              }}
                              className="text-blue-300 hover:text-blue-200 hover:underline cursor-pointer"
                            >
                              {assetInfo.assetTagId}
                            </button>
                            {assetInfo.isDeleted && (
                              <span className="text-xs text-white/70">(Archived)</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-white/90">Not linked to any asset</div>
                    )}
                  </div>
                </div>
              )}
          {documentDetails && (
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <div className="text-sm font-medium text-white">File Name</div>
                <div className="text-sm text-white/90 break-all">
                  {documentDetails.fileName || 'N/A'}
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="text-sm font-medium text-white">URL</div>
                <div className="text-sm text-blue-300 break-all">
                  <a
                    href={documentDetails.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-300 hover:text-blue-200 hover:underline"
                  >
                    {documentDetails.documentUrl}
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium text-white">Type</div>
                  <div className="text-sm text-white/90 truncate" title={documentDetails.mimeType || documentDetails.documentType || 'Unknown'}>
                    {documentDetails.mimeType || documentDetails.documentType || 'Unknown'}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="text-sm font-medium text-white">Size</div>
                  <div className="text-sm text-white/90">
                    {formatFileSize(documentDetails.documentSize)}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-white">Created At</div>
                <div className="text-sm text-white/90">
                  {documentDetails.createdAt
                    ? format(new Date(documentDetails.createdAt), 'PPp')
                    : 'Unknown'}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-white">
                  Linked Asset{(() => {
                    // Filter out STANDALONE from linked assets
                    const realLinkedAssets = documentDetails.linkedAssetTagIds?.filter(id => id !== 'STANDALONE') || []
                    return realLinkedAssets.length > 1 ? 's' : ''
                  })()}
                </div>
                {(() => {
                  // Filter out STANDALONE from linked assets
                  const realLinkedAssets = documentDetails.linkedAssetTagIds?.filter(id => id !== 'STANDALONE') || []
                  const realLinkedAssetsInfo = documentDetails.linkedAssetsInfo?.filter(info => info.assetTagId !== 'STANDALONE') || []
                  
                  if (realLinkedAssets.length > 0) {
                    return (
                      <div className="space-y-1">
                        {realLinkedAssetsInfo.map((assetInfo) => (
                          <div
                            key={assetInfo.assetTagId}
                            className="flex items-center gap-2 text-sm"
                          >
                            <Link2 className="h-3.5 w-3.5 text-blue-300" />
                            <button
                              onClick={() => {
                                if (assetInfo.isDeleted) {
                                  router.push(`/tools/trash?search=${encodeURIComponent(assetInfo.assetTagId)}`)
                                } else {
                                  router.push(`/assets?search=${encodeURIComponent(assetInfo.assetTagId)}`)
                                }
                                setIsDetailsDialogOpen(false)
                              }}
                              className="text-blue-300 hover:text-blue-200 hover:underline cursor-pointer"
                            >
                              {assetInfo.assetTagId}
                            </button>
                            {assetInfo.isDeleted && (
                              <span className="text-xs text-white/70">(Archived)</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  } else {
                    return (
                      <div className="text-sm text-white/90">Not linked to any asset</div>
                    )
                  }
                })()}
              </div>
            </div>
          )}
            </DialogContent>
          </Dialog>

      {/* Download Confirmation Dialog */}
      <DownloadConfirmationDialog
        open={isDownloadDialogOpen}
        onOpenChange={setIsDownloadDialogOpen}
        fileName={documentToDownload?.fileName || null}
        fileSize={documentToDownload?.documentSize || null}
        onConfirm={() => {
          if (documentToDownload) {
            // Create a temporary anchor element to trigger download
            const link = document.createElement('a')
            link.href = documentToDownload.documentUrl
            link.download = documentToDownload.fileName || 'download'
            link.target = '_blank'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
          }
          setDocumentToDownload(null)
        }}
        onCancel={() => {
          setDocumentToDownload(null)
        }}
      />
    </motion.div>
  )
}

export default function MediaPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Media Management</h1>
          <p className="text-muted-foreground">
            Manage images and documents for assets
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <MediaPageContent />
    </Suspense>
  )
}

