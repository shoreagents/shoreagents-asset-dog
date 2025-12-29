'use client'

import { useState, use, useEffect, useCallback, useTransition } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ImageIcon, FileText, Edit, CheckCircle2, ArrowRight, Trash2, Move, Package, FileText as FileTextIcon, Wrench, ChevronDown, ChevronLeft, Download, MoreHorizontal } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import { usePermissions } from '@/hooks/use-permissions'
import { useIsMobile } from '@/hooks/use-mobile'
import { useMobileDock } from '@/components/mobile-dock-provider'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ImagePreviewDialog } from '@/components/dialogs/image-preview-dialog'
import { DownloadConfirmationDialog } from '@/components/dialogs/download-confirmation-dialog'
import { DeleteConfirmationDialog } from '@/components/dialogs/delete-confirmation-dialog'
import { PdfSectionsDialog, type PdfSections } from '@/components/dialogs/pdf-sections-dialog'
import { useDeleteAsset } from '@/hooks/use-assets'
import { toast } from 'sonner'
import Image from 'next/image'
// Format utilities
const formatDate = (dateString: string | Date | null | undefined) => {
  if (!dateString) return 'N/A'
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    })
  } catch {
    return String(dateString)
  }
}

const formatDateTime = (dateString: string | Date | null | undefined) => {
  if (!dateString) return 'N/A'
  try {
    return new Date(dateString).toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return String(dateString)
  }
}

const formatCurrency = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) return 'N/A'
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(Number(value))
}

// Calculate time ago
const getTimeAgo = (date: Date): string => {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) {
    return 'just now'
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`
  }
  
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 30) {
    return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`
  }
  
  const diffInMonths = Math.floor(diffInDays / 30)
  if (diffInMonths < 12) {
    return `${diffInMonths} ${diffInMonths === 1 ? 'month' : 'months'} ago`
  }
  
  const diffInYears = Math.floor(diffInMonths / 12)
  return `${diffInYears} ${diffInYears === 1 ? 'year' : 'years'} ago`
}

// Photos Tab Content Component
function PhotosTabContent({ assetTagId, isActive }: { assetTagId: string; isActive: boolean }) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewImageIndex, setPreviewImageIndex] = useState(0)

  const { data: imagesData, isLoading: loadingImages } = useQuery({
    queryKey: ['asset-images', assetTagId],
    queryFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
        ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
        : ''
      const url = `${baseUrl}/api/assets/images/${assetTagId}`
      
      // Get auth token
      const { createClient } = await import('@/lib/supabase-client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (baseUrl && session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      
      const response = await fetch(url, {
        headers,
        credentials: 'include',
      })
      if (!response.ok) return { images: [] }
      const data = await response.json()
      return { images: data.images || [] }
    },
    enabled: !!assetTagId && isActive, // Only fetch when tab is active
  })

  const images = imagesData?.images || []

  const handleImageClick = (index: number) => {
    setPreviewImageIndex(index)
    setIsPreviewOpen(true)
  }

  return (
    <>
      <ScrollArea className="h-[400px]">
        {loadingImages ? (
          <div className="flex items-center justify-center py-8">
            <Spinner className="h-6 w-6" />
          </div>
        ) : images.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No photos found for this asset
          </p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
            {images.map((image: { id: string; imageUrl: string; fileName?: string }, index: number) => (
              <div
                key={image.id}
                className="relative group rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity aspect-square"
                  onClick={() => handleImageClick(index)}
                  role="button"
                  tabIndex={0}
              >
                <Image
                  src={image.imageUrl}
                  alt={image.fileName || 'Image'}
                  fill
                  className="object-cover"
                  unoptimized
                />
                {image.fileName && (
                  <div className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-[10px] px-1 py-0.5 truncate">
                    {image.fileName}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <ImagePreviewDialog
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        existingImages={images.map((img: { id: string; imageUrl: string; fileName?: string }) => ({
          id: img.id,
          imageUrl: img.imageUrl,
          fileName: img.fileName || 'Image',
        }))}
        title={`Asset Photos - ${assetTagId}`}
        maxHeight="h-[70vh] max-h-[600px]"
        initialIndex={previewImageIndex}
      />
    </>
  )
}

// Docs Tab Content Component
function DocsTabContent({ assetTagId, isActive }: { assetTagId: string; isActive: boolean }) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewImageIndex, setPreviewImageIndex] = useState(0)
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false)
  const [documentToDownload, setDocumentToDownload] = useState<{ id: string; documentUrl: string; fileName?: string; documentSize?: number | null } | null>(null)

  const { data: documentsData, isLoading: loadingDocuments } = useQuery({
    queryKey: ['asset-documents', assetTagId],
    queryFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
        ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
        : ''
      const url = `${baseUrl}/api/assets/documents/${assetTagId}`
      
      // Get auth token
      const { createClient } = await import('@/lib/supabase-client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (baseUrl && session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      
      const response = await fetch(url, {
        headers,
        credentials: 'include',
      })
      if (!response.ok) return { documents: [] }
      const data = await response.json()
      return { documents: data.documents || [] }
    },
    enabled: !!assetTagId && isActive, // Only fetch when tab is active
  })

  const documents = documentsData?.documents || []

  const handleDocumentClick = (doc: { id: string; documentUrl: string; fileName?: string; documentSize?: number | null; mimeType?: string | null }) => {
    const isImage = doc.mimeType?.startsWith('image/') || 
      /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.fileName || '')
    
    const isPdf = doc.mimeType === 'application/pdf' || 
      /\.pdf$/i.test(doc.fileName || '')
    
    if (isImage) {
      const imageDocs = documents.filter((d: { mimeType?: string | null; fileName?: string }) => {
        const docIsImage = d.mimeType?.startsWith('image/') || 
          /\.(jpg|jpeg|png|gif|webp)$/i.test(d.fileName || '')
        return docIsImage
      })
      const imageDocIndex = imageDocs.findIndex((d: { id: string }) => d.id === doc.id)
      setPreviewImageIndex(imageDocIndex)
      setIsPreviewOpen(true)
    } else if (isPdf) {
      window.open(doc.documentUrl, '_blank', 'noopener,noreferrer')
    } else {
      setDocumentToDownload(doc)
      setIsDownloadDialogOpen(true)
    }
  }

  const imageDocuments = documents.filter((doc: { mimeType?: string | null; fileName?: string }) => {
    const isImage = doc.mimeType?.startsWith('image/') || 
      /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.fileName || '')
    return isImage
  })

  return (
    <>
      <ScrollArea className="h-[400px]">
        {loadingDocuments ? (
          <div className="flex items-center justify-center py-8">
            <Spinner className="h-6 w-6" />
          </div>
        ) : documents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No documents found for this asset
          </p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
            {documents.map((document: { id: string; documentUrl: string; fileName?: string; mimeType?: string | null; documentSize?: number | null }) => {
              const isImage = document.mimeType?.startsWith('image/') || 
                /\.(jpg|jpeg|png|gif|webp)$/i.test(document.fileName || '')
              return (
                <div
                  key={document.id}
                  className="relative group rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity aspect-square"
                  onClick={() => handleDocumentClick(document)}
                >
                  <div className="w-full h-full bg-muted relative flex items-center justify-center">
                    {isImage ? (
                      <Image
                        src={document.documentUrl}
                        alt={document.fileName || 'Document'}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <FileText className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  {document.fileName && (
                    <div className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-[10px] px-1 py-0.5 truncate">
                      {document.fileName}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>

      <ImagePreviewDialog
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        existingImages={imageDocuments.map((doc: { id: string; documentUrl: string; fileName?: string }) => ({
          id: doc.id,
          imageUrl: doc.documentUrl,
          fileName: doc.fileName || 'Image',
        }))}
        title={`Asset Documents - ${assetTagId}`}
        maxHeight="h-[70vh] max-h-[600px]"
        initialIndex={previewImageIndex}
      />

      <DownloadConfirmationDialog
        open={isDownloadDialogOpen}
        onOpenChange={setIsDownloadDialogOpen}
        onConfirm={() => {
          if (documentToDownload) {
            window.open(documentToDownload.documentUrl, '_blank', 'noopener,noreferrer')
          }
          setIsDownloadDialogOpen(false)
        }}
        fileName={documentToDownload?.fileName || 'document'}
        fileSize={documentToDownload?.documentSize || null}
      />
    </>
  )
}

async function fetchAsset(id: string) {
  if (!id) {
    throw new Error('Asset ID is required')
  }
  
  const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
    ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
    : ''
  const url = `${baseUrl}/api/assets/${id}?t=${Date.now()}`
  
  // Get auth token
  const { createClient } = await import('@/lib/supabase-client')
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const headers: HeadersInit = {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
  }
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }
  
  const response = await fetch(url, {
    cache: 'no-store',
    credentials: 'include',
    headers,
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    let errorMessage = 'Unknown error'
    try {
      const errorData = JSON.parse(errorText)
      errorMessage = errorData.detail || errorData.error || errorMessage
    } catch {
      errorMessage = errorText || errorMessage
    }
    throw new Error(errorMessage || `Failed to fetch asset: ${response.status}`)
  }
  
  const data = await response.json()
  if (!data || !data.asset) {
    throw new Error('Invalid response format from server')
  }
  
  return data
}

async function fetchHistoryLogs(assetId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
    ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
    : ''
  const url = `${baseUrl}/api/assets/${assetId}/history`
  
  // Get auth token
  const { createClient } = await import('@/lib/supabase-client')
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const headers: HeadersInit = {}
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }
  
  const response = await fetch(url, {
    credentials: 'include',
    headers,
  })
  if (!response.ok) {
    const errorText = await response.text()
    console.error(`Failed to fetch history logs: ${response.status} ${response.statusText}`, errorText)
    return { logs: [] }
  }
  return response.json()
}

async function fetchMaintenance(assetId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
    ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
    : ''
  const url = `${baseUrl}/api/assets/maintenance?assetId=${assetId}`
  
  // Get auth token
  const { createClient } = await import('@/lib/supabase-client')
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const headers: HeadersInit = {}
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }
  
  const response = await fetch(url, {
    credentials: 'include',
    headers,
  })
  if (!response.ok) {
    const errorText = await response.text()
    console.error(`Failed to fetch maintenance: ${response.status} ${response.statusText}`, errorText)
    return { maintenances: [] }
  }
  return response.json()
}

async function fetchReserve(assetId: string) {
      const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
        ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
        : ''
      const url = `${baseUrl}/api/assets/reserve?assetId=${assetId}`
      
      // Get auth token
      const { createClient } = await import('@/lib/supabase-client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = {}
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      
      const response = await fetch(url, {
        credentials: 'include',
        headers,
      })
  if (!response.ok) {
    return { reservations: [] }
  }
  return response.json()
}

function getStatusBadge(status: string | null | undefined) {
  if (!status) return null
  
  const statusLC = status.toLowerCase()
  let statusVariant: 'default' | 'secondary' | 'destructive' | 'outline' = 'outline'
  let statusColor = ''
  
  if (statusLC === 'active' || statusLC === 'available') {
    statusVariant = 'default'
    statusColor = 'bg-green-500'
  } else if (statusLC === 'checked out' || statusLC === 'in use') {
    statusVariant = 'destructive'
    statusColor = ''
  } else if (statusLC === 'leased') {
    statusVariant = 'secondary'
    statusColor = 'bg-yellow-500'
  } else if (statusLC === 'inactive' || statusLC === 'unavailable') {
    statusVariant = 'secondary'
    statusColor = 'bg-gray-500'
  } else if (statusLC === 'maintenance' || statusLC === 'repair') {
    statusColor = 'bg-red-600 text-white'
  } else if (statusLC === 'lost' || statusLC === 'missing') {
    statusVariant = 'destructive'
    statusColor = 'bg-orange-500'
  } else if (statusLC === 'disposed' || statusLC === 'disposal') {
    statusVariant = 'secondary'
    statusColor = 'bg-purple-500'
  } else if (statusLC === 'reserved') {
    statusVariant = 'secondary'
    statusColor = 'bg-yellow-500'
  } else if (statusLC === 'sold') {
    statusVariant = 'default'
    statusColor = 'bg-teal-500 text-white border-0'
  } else if (statusLC === 'donated') {
    statusVariant = 'default'
    statusColor = 'bg-blue-500 text-white border-0'
  } else if (statusLC === 'scrapped') {
    statusVariant = 'default'
    statusColor = 'bg-orange-500 text-white border-0'
  } else if (statusLC === 'lost/missing' || statusLC.replace(/\s+/g, '').replace('/', '').toLowerCase() === 'lostmissing') {
    statusVariant = 'default'
    statusColor = 'bg-yellow-500 text-white border-0'
  } else if (statusLC === 'destroyed') {
    statusVariant = 'default'
    statusColor = 'bg-red-500 text-white border-0'
  }
  
  return <Badge variant={statusVariant} className={statusColor}>{status}</Badge>
}

export default function AssetDetailsPage({ params }: { params: Promise<{ assetTagId: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { hasPermission } = usePermissions()
  const isMobile = useIsMobile()
  const { setDockContent } = useMobileDock()
  const [, startTransition] = useTransition()
  const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [isPdfSectionsDialogOpen, setIsPdfSectionsDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  
  // Tab state from URL
  const activeTab = (searchParams.get('tab') as 'details' | 'photos' | 'docs' | 'depreciation' | 'maintenance' | 'reserve' | 'audit' | 'history') || 'details'
  
  // Update URL parameters
  const updateURL = useCallback(
    (updates: { tab?: 'details' | 'photos' | 'docs' | 'depreciation' | 'maintenance' | 'reserve' | 'audit' | 'history' }) => {
      const params = new URLSearchParams(searchParams.toString())

      if (updates.tab !== undefined) {
        if (updates.tab === 'details') {
          params.delete('tab')
        } else {
          params.set('tab', updates.tab)
        }
      }

      startTransition(() => {
        router.replace(`/assets/details/${resolvedParams.assetTagId}${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false })
      })
    },
    [searchParams, router, resolvedParams.assetTagId, startTransition]
  )

  const handleTabChange = (tab: 'details' | 'photos' | 'docs' | 'depreciation' | 'maintenance' | 'reserve' | 'audit' | 'history') => {
    updateURL({ tab })
  }
  
  // Delete asset mutation
  const deleteAssetMutation = useDeleteAsset()

  const canEditAssets = hasPermission('canEditAssets')
  const canAudit = hasPermission('canAudit')
  const canCheckout = hasPermission('canCheckout')
  const canCheckin = hasPermission('canCheckin')
  const canMove = hasPermission('canMove')
  const canReserve = hasPermission('canReserve')
  const canLease = hasPermission('canLease')
  const canDispose = hasPermission('canDispose')
  const canManageMaintenance = hasPermission('canManageMaintenance')
  const canDeleteAssets = hasPermission('canDeleteAssets')

  // Use assetTagId from URL - backend now accepts both UUID and assetTagId
  const assetId = resolvedParams.assetTagId

  const { data: assetData, isLoading: assetLoading, error: assetError, refetch, isFetching } = useQuery({
    queryKey: ['asset-details', resolvedParams.assetTagId],
    queryFn: () => {
      if (!resolvedParams.assetTagId) {
        throw new Error('Asset ID is missing')
      }
      return fetchAsset(resolvedParams.assetTagId)
    },
    enabled: !!resolvedParams.assetTagId && resolvedParams.assetTagId.trim().length > 0,
    retry: 3, // Retry up to 3 times on failure
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: false, // Don't refetch on window focus
    staleTime: 0, // Consider data stale immediately to ensure fresh fetch
    gcTime: 0, // Don't cache data
  })

  const asset = assetData?.asset

  // Fetch thumbnail image (first image) - only for details tab
  const { data: thumbnailData } = useQuery({
    queryKey: ['asset-thumbnail', asset?.assetTagId],
    queryFn: async () => {
      if (!asset?.assetTagId) return { images: [] }
      const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
        ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
        : ''
      const url = `${baseUrl}/api/assets/images/${asset.assetTagId}`
      
      // Get auth token
      const { createClient } = await import('@/lib/supabase-client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (baseUrl && session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      
      const response = await fetch(url, {
        headers,
        credentials: 'include',
        cache: 'no-store',
      })
      if (!response.ok) return { images: [] }
      const data = await response.json()
      return { images: data.images || [] }
    },
    enabled: !!asset?.assetTagId && activeTab === 'details', // Only fetch when details tab is active
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })

  // Get the first image (most recent by createdAt desc, so [0] is the latest)
  const thumbnailImage = thumbnailData?.images?.[0]

  // Preload the thumbnail image for LCP optimization
  useEffect(() => {
    if (thumbnailImage?.imageUrl) {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'image'
      link.href = thumbnailImage.imageUrl
      link.setAttribute('fetchpriority', 'high')
      link.setAttribute('data-preload-thumbnail', 'true')
      document.head.appendChild(link)
      
      return () => {
        // Cleanup: remove the preload link when component unmounts or image changes
        const existingLink = document.querySelector('link[data-preload-thumbnail="true"]')
        if (existingLink && existingLink.parentNode) {
          existingLink.parentNode.removeChild(existingLink)
        }
      }
    }
  }, [thumbnailImage?.imageUrl])

  // Handle delete - opens confirmation dialog
  const handleDelete = useCallback(() => {
    setIsDeleteDialogOpen(true)
  }, [])

  // Confirm delete - calls the delete mutation
  const confirmDelete = useCallback(() => {
    if (!asset?.id) return
    deleteAssetMutation.mutate(asset.id, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['assets'] })
        queryClient.invalidateQueries({ queryKey: ['deletedAssets'] })
        setIsDeleteDialogOpen(false)
        toast.success('Asset deleted successfully. It will be permanently deleted after 30 days.')
        router.push('/assets')
      },
      onError: () => {
        toast.error('Failed to delete asset')
      },
    })
  }, [deleteAssetMutation, asset?.id, queryClient, router])

  // Set mobile dock content
  useEffect(() => {
    if (isMobile && asset) {
      setDockContent(
        <>
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.back()}
            className="h-10 w-10 rounded-full btn-glass-elevated"
            title="Go Back"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          {canEditAssets && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.push(`/assets/${asset.assetTagId}`)}
              className="h-10 w-10 rounded-full btn-glass-elevated"
              title="Edit Asset"
            >
              <Edit className="h-5 w-5" />
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsPdfSectionsDialogOpen(true)}
            className="h-10 w-10 rounded-full btn-glass-elevated"
            title="Download PDF"
            disabled={isGeneratingPDF}
          >
            <Download className="h-5 w-5" />
          </Button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full btn-glass-elevated"
                title="More Actions"
                disabled={isGeneratingPDF}
              >
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="w-56 mb-2 z-[100]">
              <DropdownMenuItem 
                onSelect={() => router.push(`/tools/audit?assetId=${asset.assetTagId}`)}
                disabled={!canAudit}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Manage Audits
              </DropdownMenuItem>
              <DropdownMenuItem 
                onSelect={() => router.push(`/assets/checkout?assetId=${asset.assetTagId}`)}
                disabled={!canCheckout}
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                Checkout
              </DropdownMenuItem>
              <DropdownMenuItem 
                onSelect={() => router.push(`/assets/checkin?assetId=${asset.assetTagId}`)}
                disabled={!canCheckin}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Checkin
              </DropdownMenuItem>
              <DropdownMenuItem 
                onSelect={() => router.push(`/assets/move?assetId=${asset.assetTagId}`)}
                disabled={!canMove}
              >
                <Move className="mr-2 h-4 w-4" />
                Move
              </DropdownMenuItem>
              <DropdownMenuItem 
                onSelect={() => router.push(`/assets/reserve?assetId=${asset.assetTagId}`)}
                disabled={!canReserve}
              >
                <Package className="mr-2 h-4 w-4" />
                Reserve
              </DropdownMenuItem>
              <DropdownMenuItem 
                onSelect={() => router.push(`/assets/lease?assetId=${asset.assetTagId}`)}
                disabled={!canLease}
              >
                <FileTextIcon className="mr-2 h-4 w-4" />
                Lease
              </DropdownMenuItem>
              {canLease && (
                <DropdownMenuItem onSelect={() => router.push(`/assets/lease-return?assetId=${asset.assetTagId}`)}>
                  <FileTextIcon className="mr-2 h-4 w-4" />
                  Lease Return
                </DropdownMenuItem>
              )}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger disabled={isGeneratingPDF || !canDispose}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Dispose
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onSelect={() => router.push(`/assets/dispose?assetId=${asset.assetTagId}&method=Sold`)} disabled={!canDispose}>
                    Sold
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => router.push(`/assets/dispose?assetId=${asset.assetTagId}&method=Donated`)} disabled={!canDispose}>
                    Donated
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => router.push(`/assets/dispose?assetId=${asset.assetTagId}&method=Scrapped`)} disabled={!canDispose}>
                    Scrapped
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => router.push(`/assets/dispose?assetId=${asset.assetTagId}&method=Lost/Missing`)} disabled={!canDispose}>
                    Lost/Missing
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => router.push(`/assets/dispose?assetId=${asset.assetTagId}&method=Destroyed`)} disabled={!canDispose}>
                    Destroyed
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger disabled={isGeneratingPDF || !canManageMaintenance}>
                  <Wrench className="mr-2 h-4 w-4" />
                  Maintenance
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem 
                    onSelect={() => router.push(`/assets/maintenance?assetId=${asset.assetTagId}&status=Scheduled`)}
                    disabled={!canManageMaintenance}
                  >
                    Scheduled
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onSelect={() => router.push(`/assets/maintenance?assetId=${asset.assetTagId}&status=In progress`)}
                    disabled={!canManageMaintenance}
                  >
                    In Progress
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onSelect={handleDelete}
                className="text-destructive focus:text-destructive"
                disabled={!canDeleteAssets}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Move to Trash
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )
    }
    
    // Cleanup on unmount
    return () => {
      if (isMobile) {
        setDockContent(null)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, setDockContent, router, asset?.assetTagId, canEditAssets, canCheckout, canCheckin, canMove, canReserve, canLease, canManageMaintenance, canAudit, canDispose, canDeleteAssets, isGeneratingPDF, handleDelete])

  const { data: historyData, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['asset-history', resolvedParams.assetTagId],
    queryFn: () => fetchHistoryLogs(resolvedParams.assetTagId),
    enabled: !!resolvedParams.assetTagId && (activeTab === 'history' || activeTab === 'details'),
  })

  const { data: maintenanceData, isLoading: isLoadingMaintenance } = useQuery({
    queryKey: ['asset-maintenance', resolvedParams.assetTagId],
    queryFn: () => fetchMaintenance(resolvedParams.assetTagId),
    enabled: !!resolvedParams.assetTagId && activeTab === 'maintenance',
  })

  const { data: reserveData, isLoading: isLoadingReserve } = useQuery({
    queryKey: ['asset-reserve', resolvedParams.assetTagId],
    queryFn: () => fetchReserve(resolvedParams.assetTagId),
    enabled: !!resolvedParams.assetTagId, // Always load reservations for "Assigned To" display
  })

  const historyLogs = historyData?.logs || []
  const maintenances = maintenanceData?.maintenances || []
  const reservations = reserveData?.reservations || []
  
  // Find the creator from history logs (eventType: 'added')
  const creationLog = historyLogs.find((log: { eventType: string }) => log.eventType === 'added')
  const createdBy = creationLog?.actionBy || 'N/A'

  if (assetLoading || isFetching) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Spinner className="h-6 w-6" />
        <p className="text-sm text-muted-foreground">Loading asset details...</p>
      </div>
    )
  }

  if (assetError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-destructive">
          {assetError instanceof Error ? assetError.message : 'Failed to load asset details'}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
          <Link href="/assets">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Assets
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!assetData || !asset) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-destructive">Asset not found</p>
        <Link href="/assets">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Assets
          </Button>
        </Link>
      </div>
    )
  }

  // Get audit info
  const lastAudit = asset.auditHistory?.[0]
  const auditCount = asset.auditHistory?.length || 0

  // Find the active checkout (most recent checkout without a checkin)
  // A checkout is active if it has no checkins (empty array)
  const activeCheckout = asset.checkouts?.find(
    (checkout: { checkins?: Array<{ id: string }> | null }) => {
      const checkinsCount = checkout.checkins?.length ?? 0
      return checkinsCount === 0
    }
  )

  // Get active reservation (first one since it's already sorted by date desc)
  const activeReservation = reservations?.[0]
  
  // Determine assigned to display value - same pattern as edit page
  const getAssignedToDisplay = () => {
    // If there's an active checkout with employee, show the employee name
    if (activeCheckout?.employeeUser?.name?.trim()) {
      return activeCheckout.employeeUser.name
    }
    
    // If asset is reserved and there's an active reservation
    if (asset?.status?.toLowerCase() === 'reserved' && activeReservation) {
      if (activeReservation.reservationType === 'Employee' && activeReservation.employeeUser?.name) {
        return `Reserved for ${activeReservation.employeeUser.name}`
      }
      if (activeReservation.reservationType === 'Department' && activeReservation.department) {
        return `Reserved for ${activeReservation.department}`
      }
    }
    
    return 'N/A'
  }
  
  const assignedToUser = getAssignedToDisplay()
  
  // Issued To: Original issued to field from the asset (static field)
  const issuedToUser = asset.issuedTo || 'N/A'

  // Handle PDF download - opens dialog first
  const handleDownloadPDF = () => {
    setIsPdfSectionsDialogOpen(true)
  }

  // Actually download PDF with selected sections
  const downloadPDFWithSections = async (sections: PdfSections) => {
    setIsGeneratingPDF(true)
    
    // Get auth token for FastAPI
    const { createClient } = await import('@/lib/supabase-client')
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    // Use XMLHttpRequest to track download progress
    const xhr = new XMLHttpRequest()
    let simulatedProgress = 0
    let progressInterval: NodeJS.Timeout | null = null
    let hasStartedDownload = false
    
    // Build URL with FastAPI base URL if enabled
    const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
      ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
      : ''
    const pdfUrl = `${baseUrl}/api/assets/${asset.assetTagId}/pdf`
    
    return new Promise<void>((resolve, reject) => {
      try {
        toast.loading('Generating PDF... 0%', { id: 'pdf-generation' })

        // Simulate progress during generation phase (0-70%)
        // This gives feedback while the server is generating the PDF
        progressInterval = setInterval(() => {
          if (!hasStartedDownload && simulatedProgress < 70) {
            simulatedProgress += 5  // Faster progress since FastAPI is much faster
            if (simulatedProgress > 70) simulatedProgress = 70
            toast.loading(`Generating PDF... ${simulatedProgress}%`, { id: 'pdf-generation' })
          }
        }, 100) // Update every 100ms (faster since FastAPI is faster)

        xhr.open('POST', pdfUrl, true)
        xhr.setRequestHeader('Content-Type', 'application/json')
        if (session?.access_token) {
          xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`)
        }
        xhr.responseType = 'blob'
        
        // Send sections in request body
        xhr.send(JSON.stringify(sections))

        // Track real download progress (70-100%)
        xhr.addEventListener('progress', (event) => {
          hasStartedDownload = true
          if (progressInterval) {
            clearInterval(progressInterval)
            progressInterval = null
          }
          
          if (event.lengthComputable && event.total > 0) {
            // Map download progress to 70-100% range
            const downloadPercent = Math.round((event.loaded / event.total) * 100)
            const totalPercent = 70 + Math.round(downloadPercent * 0.3) // 70% + (download% * 30%)
            toast.loading(`Generating PDF... ${totalPercent}%`, { id: 'pdf-generation' })
          } else if (event.loaded > 0) {
            // If content length is unknown but we have loaded bytes, show progress
            toast.loading('Generating PDF... 75%', { id: 'pdf-generation' })
          }
        })

        xhr.addEventListener('load', () => {
          // Clear progress interval if still running
          if (progressInterval) {
            clearInterval(progressInterval)
            progressInterval = null
          }
          
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const blob = xhr.response
              
              // Create download link
              const url = window.URL.createObjectURL(blob)
              const link = document.createElement('a')
              link.href = url
              link.download = `asset-details-${asset.assetTagId}-${new Date().toISOString().split('T')[0]}.pdf`
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
              window.URL.revokeObjectURL(url)

              toast.success('PDF downloaded successfully', { id: 'pdf-generation' })
              setIsGeneratingPDF(false)
              resolve()
            } catch (error) {
              console.error('Error processing PDF:', error)
              toast.error('Failed to process PDF', { id: 'pdf-generation' })
              setIsGeneratingPDF(false)
              reject(error)
            }
          } else {
            // Try to parse error response
            if (progressInterval) {
              clearInterval(progressInterval)
              progressInterval = null
            }
            
            const reader = new FileReader()
            reader.onload = () => {
              try {
                const errorData = JSON.parse(reader.result as string)
                const errorMessage = errorData.error || 'Failed to generate PDF'
                toast.error(errorMessage, { id: 'pdf-generation' })
                setIsGeneratingPDF(false)
                reject(new Error(errorMessage))
              } catch {
                toast.error('Failed to generate PDF', { id: 'pdf-generation' })
                setIsGeneratingPDF(false)
                reject(new Error('Failed to generate PDF'))
              }
            }
            reader.onerror = () => {
              toast.error('Failed to generate PDF', { id: 'pdf-generation' })
              setIsGeneratingPDF(false)
              reject(new Error('Failed to generate PDF'))
            }
            if (xhr.response) {
              reader.readAsText(xhr.response)
            } else {
              toast.error('Failed to generate PDF', { id: 'pdf-generation' })
              setIsGeneratingPDF(false)
              reject(new Error('Failed to generate PDF'))
            }
          }
        })

        xhr.addEventListener('error', () => {
          if (progressInterval) {
            clearInterval(progressInterval)
            progressInterval = null
          }
          toast.error('Network error while generating PDF', { id: 'pdf-generation' })
          setIsGeneratingPDF(false)
          reject(new Error('Network error'))
        })

        xhr.addEventListener('abort', () => {
          if (progressInterval) {
            clearInterval(progressInterval)
            progressInterval = null
          }
          toast.error('PDF generation cancelled', { id: 'pdf-generation' })
          setIsGeneratingPDF(false)
          reject(new Error('Cancelled'))
        })
      } catch (error) {
        if (progressInterval) {
          clearInterval(progressInterval)
          progressInterval = null
        }
        console.error('Error generating PDF:', error)
        toast.error(error instanceof Error ? error.message : 'Failed to generate PDF', { id: 'pdf-generation' })
        setIsGeneratingPDF(false)
        reject(error)
      }
    })
  }

  return (
    <motion.div 
      key={assetId} 
      id="asset-details-content" 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold truncate">{asset.assetTagId}</h1>
          <p className="text-muted-foreground break-words">
            {asset.description}
          </p>
        </div>
        <div className="hidden md:grid md:grid-cols-2 lg:flex lg:flex-row lg:justify-end items-center gap-2 w-full xl:w-auto flex-shrink-0">
          <Button 
            variant="outline"
            onClick={handleDownloadPDF}
            className="w-full lg:w-auto"
            disabled={isGeneratingPDF}
          >
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
          {canEditAssets && (
            <Button 
              variant="default"
              onClick={() => {
                router.push(`/assets/${asset.assetTagId}`)
              }}
              className="w-full lg:w-auto"
              disabled={isGeneratingPDF}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit Asset
            </Button>
          )}
          <DropdownMenu open={isMoreActionsOpen} onOpenChange={setIsMoreActionsOpen}>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full lg:w-auto"
                title="More Actions"
                disabled={isGeneratingPDF}
              >
                More Actions
                <ChevronDown className={`ml-2 h-4 w-4 transition-transform duration-200 ${isMoreActionsOpen ? 'rotate-180' : ''}`} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={() => router.push(`/assets/${asset.assetTagId}`)}
                  disabled={isGeneratingPDF || !canEditAssets}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Asset
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => {
                    router.push(`/tools/audit?assetId=${asset.assetTagId}`)
                  }}
                  disabled={isGeneratingPDF || !canAudit}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Manage Audits
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => router.push(`/assets/checkout?assetId=${asset.assetTagId}`)}
                  disabled={isGeneratingPDF || !canCheckout}
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Checkout
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => router.push(`/assets/checkin?assetId=${asset.assetTagId}`)}
                  disabled={isGeneratingPDF || !canCheckin}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Checkin
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => router.push(`/assets/move?assetId=${asset.assetTagId}`)}
                  disabled={isGeneratingPDF || !canMove}
                >
                  <Move className="mr-2 h-4 w-4" />
                  Move
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => router.push(`/assets/reserve?assetId=${asset.assetTagId}`)}
                  disabled={isGeneratingPDF || !canReserve}
                >
                  <Package className="mr-2 h-4 w-4" />
                  Reserve
                </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => router.push(`/assets/lease?assetId=${asset.assetTagId}`)}
                    disabled={isGeneratingPDF || !canLease}
                  >
                    <FileTextIcon className="mr-2 h-4 w-4" />
                    Lease
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => router.push(`/assets/lease-return?assetId=${asset.assetTagId}`)}
                    disabled={isGeneratingPDF || !canLease}
                  >
                    <FileTextIcon className="mr-2 h-4 w-4" />
                    Lease Return
                  </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger disabled={isGeneratingPDF || !canDispose}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Dispose
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem
                      onClick={() => router.push(`/assets/dispose?assetId=${asset.assetTagId}&method=Sold`)}
                      disabled={isGeneratingPDF || !canDispose}
                    >
                      Sold
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => router.push(`/assets/dispose?assetId=${asset.assetTagId}&method=Donated`)}
                      disabled={isGeneratingPDF || !canDispose}
                    >
                      Donated
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => router.push(`/assets/dispose?assetId=${asset.assetTagId}&method=Scrapped`)}
                      disabled={isGeneratingPDF || !canDispose}
                    >
                      Scrapped
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => router.push(`/assets/dispose?assetId=${asset.assetTagId}&method=Lost/Missing`)}
                      disabled={isGeneratingPDF || !canDispose}
                    >
                      Lost/Missing
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => router.push(`/assets/dispose?assetId=${asset.assetTagId}&method=Destroyed`)}
                      disabled={isGeneratingPDF || !canDispose}
                    >
                      Destroyed
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger disabled={isGeneratingPDF || !canManageMaintenance}>
                    <Wrench className="mr-2 h-4 w-4" />
                    Maintenance
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem
                      onClick={() => {
                        router.push(`/assets/maintenance?assetId=${asset.assetTagId}&status=Scheduled`)
                      }}
                      disabled={isGeneratingPDF || !canManageMaintenance}
                    >
                      Scheduled
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        router.push(`/assets/maintenance?assetId=${asset.assetTagId}&status=In progress`)
                      }}
                      disabled={isGeneratingPDF || !canManageMaintenance}
                    >
                      In Progress
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="text-destructive focus:text-destructive"
                    disabled={isGeneratingPDF || !canDeleteAssets}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Move to Trash
                  </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href="/assets" className="w-full lg:w-auto">
            <Button variant="outline" className="w-full lg:w-auto" disabled={isGeneratingPDF}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Assets
            </Button>
          </Link>
        </div>
      </div>

      {/* Top Section with Thumbnail and Key Fields */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 border rounded-lg p-4">
        {/* Thumbnail Image */}
        <div className="lg:col-span-1">
          <div className="relative w-full aspect-square lg:h-full bg-muted rounded-lg overflow-hidden flex items-center justify-center">
            {thumbnailImage ? (
              <Image
                src={thumbnailImage.imageUrl}
                alt={asset.assetTagId}
                fill
                className="object-contain p-2"
                unoptimized
                loading="eager"
                priority
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <ImageIcon className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
          </div>
        </div>

        {/* Key Fields */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="border-b pb-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Asset Tag ID</p>
            <p className="text-sm font-medium">{asset.assetTagId}</p>
          </div>
          <div className="border-b pb-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Purchase Date</p>
            <p className="text-sm">{formatDate(asset.purchaseDate || null)}</p>
          </div>
          <div className="border-b pb-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Cost</p>
            <p className="text-sm">{formatCurrency(asset.cost)}</p>
          </div>
          <div className="border-b pb-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Brand</p>
            <p className="text-sm">{asset.brand || 'N/A'}</p>
          </div>
          <div className="border-b pb-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Model</p>
            <p className="text-sm">{asset.model || 'N/A'}</p>
          </div>
          <div className="border-b pb-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Site</p>
            <p className="text-sm">{asset.site || 'N/A'}</p>
          </div>
          <div className="border-b pb-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Location</p>
            <p className="text-sm">{asset.location || 'N/A'}</p>
          </div>
          <div className="border-b pb-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Category</p>
            <p className="text-sm">{asset.category?.name || 'N/A'}</p>
          </div>
          <div className="border-b pb-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Department</p>
            <p className="text-sm">{asset.department || 'N/A'}</p>
          </div>
            <div className="border-b pb-2">
             <p className="text-xs font-medium text-muted-foreground mb-1">Assigned To</p>
             <p className="text-sm">
               {assignedToUser}
             </p>
            </div>
          <div className="border-b pb-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Status</p>
            <div className="flex items-center">
              {getStatusBadge(asset.status) || <span className="text-sm">N/A</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <ScrollArea className="w-full border-b">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleTabChange('details')}
            disabled={isGeneratingPDF}
            className={`px-4 py-2 h-auto text-sm font-medium transition-colors border-b-2 rounded-none ${
              activeTab === 'details'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Details
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleTabChange('photos')}
            disabled={isGeneratingPDF}
            className={`px-4 py-2 h-auto text-sm font-medium transition-colors border-b-2 rounded-none ${
              activeTab === 'photos'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
              Photos
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleTabChange('docs')}
            disabled={isGeneratingPDF}
            className={`px-4 py-2 h-auto text-sm font-medium transition-colors border-b-2 rounded-none ${
              activeTab === 'docs'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
              Docs
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleTabChange('depreciation')}
            disabled={isGeneratingPDF}
            className={`px-4 py-2 h-auto text-sm font-medium transition-colors border-b-2 rounded-none ${
              activeTab === 'depreciation'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
              Depreciation
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleTabChange('maintenance')}
            disabled={isGeneratingPDF}
            className={`px-4 py-2 h-auto text-sm font-medium transition-colors border-b-2 rounded-none ${
              activeTab === 'maintenance'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
              Maintenance 
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleTabChange('reserve')}
            disabled={isGeneratingPDF}
            className={`px-4 py-2 h-auto text-sm font-medium transition-colors border-b-2 rounded-none ${
              activeTab === 'reserve'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
              Reserve 
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleTabChange('audit')}
            disabled={isGeneratingPDF}
            className={`px-4 py-2 h-auto text-sm font-medium transition-colors border-b-2 rounded-none ${
              activeTab === 'audit'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
              Audit
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleTabChange('history')}
            disabled={isGeneratingPDF}
            className={`px-4 py-2 h-auto text-sm font-medium transition-colors border-b-2 rounded-none ${
              activeTab === 'history'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
              History
          </Button>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        <AnimatePresence mode="wait">
        {activeTab === 'details' && (
        <motion.div
          key="details"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Serial No</p>
              <p className="text-sm">{asset.serialNo || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Additional Information</p>
              <p className="text-sm">{asset.additionalInformation || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Owner</p>
              <p className="text-sm">{asset.owner || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Sub-Category</p>
              <p className="text-sm">{asset.subCategory?.name || 'N/A'}</p>
            </div>
              <div>
               <p className="text-xs font-medium text-muted-foreground mb-1">Issued To</p>
               <p className="text-sm">
                 {issuedToUser}
               </p>
              </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">PO Number</p>
              <p className="text-sm">{asset.poNumber || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Last Audit Type</p>
              <p className="text-sm">{lastAudit?.auditType || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Last Audit Date</p>
              <p className="text-sm">{lastAudit?.auditDate ? formatDate(lastAudit.auditDate) : 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Last Auditor</p>
              <p className="text-sm">{lastAudit?.auditor || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Audit Count</p>
              <p className="text-sm">{auditCount}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">QR</p>
              <p className="text-sm">{asset.qr || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Purchased From</p>
              <p className="text-sm">{asset.purchasedFrom || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Xero Asset No</p>
              <p className="text-sm">{asset.xeroAssetNo || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">PBI Number</p>
              <p className="text-sm">{asset.pbiNumber || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Payment Voucher Number</p>
              <p className="text-sm">{asset.paymentVoucherNumber || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Asset Type</p>
              <p className="text-sm">{asset.assetType || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Delivery Date</p>
              <p className="text-sm">{formatDate(asset.deliveryDate || null)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Old Asset Tag</p>
              <p className="text-sm">{asset.oldAssetTag || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Remarks</p>
              <p className="text-sm">{asset.remarks || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Unaccounted Inventory</p>
              <p className="text-sm">{asset.unaccountedInventory ? 'Yes' : 'No'}</p>
            </div>
            {asset.description && (
              <div className="md:col-span-2">
                <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                <p className="text-sm">{asset.description}</p>
              </div>
            )}
            {activeCheckout && (
              <>
                <div className="md:col-span-2 pt-2 border-t">
                  <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Check out</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Checkout Date</p>
                  <p className="text-sm">{formatDate(activeCheckout.checkoutDate || null)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Expected Return Date</p>
                  <p className="text-sm">{activeCheckout.expectedReturnDate ? formatDate(activeCheckout.expectedReturnDate) : 'N/A'}</p>
                </div>
                {activeCheckout.employeeUser && (
                  <>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Assigned To</p>
                      <p className="text-sm">{activeCheckout.employeeUser.name || 'N/A'}</p>
                    </div>
                    {activeCheckout.employeeUser.email && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Employee Email</p>
                        <p className="text-sm">{activeCheckout.employeeUser.email}</p>
                      </div>
                    )}
                    {activeCheckout.employeeUser.department && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Department</p>
                        <p className="text-sm">{activeCheckout.employeeUser.department}</p>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
            <div className="md:col-span-2 pt-2 border-t">
              <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Creation</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Created By</p>
              <p className="text-sm">{createdBy}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Created At</p>
              <p className="text-sm">{formatDateTime(asset.createdAt || null)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Updated At</p>
              <p className="text-sm">{formatDateTime(asset.updatedAt || null)}</p>
            </div>
          </div>
        </motion.div>
        )}

        {activeTab === 'photos' && asset && (
          <motion.div
            key="photos"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
          <PhotosTabContent assetTagId={asset.assetTagId} isActive={activeTab === 'photos'} />
          </motion.div>
        )}

        {activeTab === 'docs' && asset && (
          <motion.div
            key="docs"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
          <DocsTabContent assetTagId={asset.assetTagId} isActive={activeTab === 'docs'} />
          </motion.div>
        )}

        {activeTab === 'depreciation' && (
        <motion.div
          key="depreciation"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Depreciable Asset</p>
                <p className="text-sm">{asset.depreciableAsset ? 'Yes' : 'No'}</p>
              </div>
              {asset.depreciableAsset && (
                <>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Depreciable Cost</p>
                    <p className="text-sm">{formatCurrency(asset.depreciableCost)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Salvage Value</p>
                    <p className="text-sm">{formatCurrency(asset.salvageValue)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Asset Life (Months)</p>
                    <p className="text-sm">{asset.assetLifeMonths || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Depreciation Method</p>
                    <p className="text-sm">{asset.depreciationMethod || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Date Acquired</p>
                    <p className="text-sm">{formatDate(asset.dateAcquired || null)}</p>
                  </div>
                </>
              )}
            </div>
            {!asset.depreciableAsset && (
              <p className="text-sm text-muted-foreground">This asset is not marked as depreciable.</p>
            )}
          </div>
        </motion.div>
        )}
        </AnimatePresence>

        {/* Maintenance Tab */}
        <AnimatePresence mode="wait">
        {activeTab === 'maintenance' && (
        <motion.div
          key="maintenance"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <div className="space-y-4">
              <div className="min-w-full">
                <ScrollArea className="h-[500px] relative border rounded-lg">
                  <div className="sticky top-0 z-30 h-px bg-border w-full"></div>
                    <Table>
                      <TableHeader className="sticky -top-1 z-20 bg-card [&_tr]:border-b-0">
                        <TableRow className="group hover:bg-muted/50 relative border-b-0 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-border after:z-30">
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[18%]">Title</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[13%]">Status</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[11%]">Due Date</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[11%]">Date Completed</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[13%]">Maintenance By</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[10%]">Cost</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[12%]">Inventory Items</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[12%]">Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoadingMaintenance ? (
                          <TableRow>
                            <TableCell colSpan={8} className="h-[200px]">
                              <div className="flex items-center justify-center">
                                <div className="flex flex-col items-center gap-3">
                                  <Spinner className="h-8 w-8" />
                                  <p className="text-sm text-muted-foreground">Loading maintenance records...</p>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : maintenances.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                              No maintenance records found.
                            </TableCell>
                          </TableRow>
                        ) : maintenances.map((maintenance: { 
                          id: string
                          title: string
                          details?: string | null
                          dueDate?: string | Date | null
                          status?: string | null
                          maintenanceBy?: string | null
                          dateCompleted?: string | Date | null
                          cost?: number | string | null
                          inventoryItems?: {
                            id: string
                            quantity: number | string
                            unitCost: number | null
                            inventoryItem: {
                              id: string
                              itemCode: string
                              name: string
                              unit: string | null
                            }
                          }[]
                        }) => (
                          <TableRow key={maintenance.id}>
                            <TableCell>
                              <span className="text-sm font-medium">{maintenance.title || 'N/A'}</span>
                            </TableCell>
                            <TableCell>
                              {maintenance.status ? (
                                <span className={`px-2 py-1 text-xs font-medium rounded capitalize ${
                                  maintenance.status.toLowerCase() === 'completed' ? 'bg-green-500/10 text-green-500' :
                                  maintenance.status.toLowerCase() === 'in progress' ? 'bg-blue-500/10 text-blue-500' :
                                  maintenance.status.toLowerCase() === 'scheduled' ? 'bg-yellow-500/10 text-yellow-500' :
                                  maintenance.status.toLowerCase() === 'cancelled' ? 'bg-red-500/10 text-red-500' :
                                  'bg-gray-500/10 text-gray-500'
                                }`}>
                                  {maintenance.status}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{formatDate(maintenance.dueDate || null)}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{formatDate(maintenance.dateCompleted || null)}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{maintenance.maintenanceBy || <span className="text-muted-foreground">-</span>}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{formatCurrency(maintenance.cost)}</span>
                            </TableCell>
                            <TableCell>
                              {maintenance.inventoryItems && maintenance.inventoryItems.length > 0 ? (
                                <div className="flex flex-col gap-1">
                                  <Badge variant="outline" className="text-xs w-fit">
                                    <Package className="h-3 w-3 mr-1" />
                                    {maintenance.inventoryItems.length} {maintenance.inventoryItems.length === 1 ? 'item' : 'items'}
                                  </Badge>
                                  <div className="text-xs text-muted-foreground">
                                    {maintenance.inventoryItems.slice(0, 2).map((item, idx) => (
                                      <span key={item.id}>
                                        {item.inventoryItem.itemCode} ({item.quantity} {item.inventoryItem.unit || ''})
                                        {idx < Math.min(maintenance.inventoryItems!.length, 2) - 1 && ', '}
                                      </span>
                                    ))}
                                    {maintenance.inventoryItems.length > 2 && ` +${maintenance.inventoryItems.length - 2} more`}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="max-w-[200px]">
                                <p className="text-sm wrap-break-word">
                                  {maintenance.details || <span className="text-muted-foreground">-</span>}
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  <ScrollBar orientation="horizontal" />
                  <ScrollBar orientation="vertical" className="z-50" />
                </ScrollArea>
              </div>
          </div>
        </motion.div>
        )}
        </AnimatePresence>

        {/* Reserve Tab */}
        <AnimatePresence mode="wait">
        {activeTab === 'reserve' && (
        <motion.div
          key="reserve"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <div className="space-y-4">
              <div className="min-w-full">
                <ScrollArea className="h-[500px] relative border rounded-lg">
                  <div className="sticky top-0 z-30 h-px bg-border w-full"></div>
                    <Table>
                      <TableHeader className="sticky -top-1 z-20 bg-card [&_tr]:border-b-0">
                        <TableRow className="group hover:bg-muted/50 relative border-b-0 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-border after:z-30">
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[14%]">Asset ID</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[20%]">Description</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[10%]">Type</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[14%]">Reserved For</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[14%]">Purpose</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[14%]">Reservation Date</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[14%]">Time Ago</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoadingReserve ? (
                          <TableRow>
                            <TableCell colSpan={7} className="h-[200px]">
                              <div className="flex items-center justify-center">
                                <div className="flex flex-col items-center gap-3">
                                  <Spinner className="h-8 w-8" />
                                  <p className="text-sm text-muted-foreground">Loading reservations...</p>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : reservations.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                              No reservations found.
                            </TableCell>
                          </TableRow>
                        ) : reservations.map((reservation: { 
                          id: string
                          reservationType: string
                          purpose?: string | null
                          reservationDate: string | Date
                          employeeUser?: { name: string } | null
                          department?: string | null
                          asset?: { assetTagId: string; description: string } | null
                        }) => {
                          const reservationDate = reservation.reservationDate ? new Date(reservation.reservationDate) : null
                          const timeAgo = reservationDate ? getTimeAgo(reservationDate) : '-'
                          
                          return (
                            <TableRow key={reservation.id}>
                              <TableCell>
                                {reservation.asset?.assetTagId ? (
                                  <Badge variant="outline" className="font-medium">
                                    {reservation.asset.assetTagId}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <span className="text-sm">{reservation.asset?.description || asset?.description || 'N/A'}</span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm capitalize">{reservation.reservationType || 'N/A'}</span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm">
                                  {reservation.reservationType === 'Employee' && reservation.employeeUser
                                    ? reservation.employeeUser.name
                                    : reservation.reservationType === 'Department' && reservation.department
                                    ? reservation.department
                                    : <span className="text-muted-foreground">-</span>}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm">{reservation.purpose || <span className="text-muted-foreground">-</span>}</span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm">{formatDate(reservation.reservationDate)}</span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-muted-foreground">{timeAgo}</span>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  <ScrollBar orientation="horizontal" />
                  <ScrollBar orientation="vertical" className="z-50" />
                </ScrollArea>
              </div>
          </div>
        </motion.div>
        )}
        </AnimatePresence>

        {/* Audit Tab */}
        <AnimatePresence mode="wait">
        {activeTab === 'audit' && (
        <motion.div
          key="audit"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <div className="space-y-4">
              <div className="min-w-full">
                <ScrollArea className="h-[500px] relative border rounded-lg">
                  <div className="sticky top-0 z-30 h-px bg-border w-full"></div>
                    <Table>
                      <TableHeader className="sticky -top-1 z-20 bg-card [&_tr]:border-b-0">
                        <TableRow className="group hover:bg-muted/50 relative border-b-0 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-border after:z-30">
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[12%]">Date</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[18%]">Audit Type</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[12%]">Status</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[18%]">Auditor</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[40%]">Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assetLoading ? (
                          <TableRow>
                            <TableCell colSpan={5} className="h-[200px]">
                              <div className="flex items-center justify-center">
                                <div className="flex flex-col items-center gap-3">
                                  <Spinner className="h-8 w-8" />
                                  <p className="text-sm text-muted-foreground">Loading audit records...</p>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : !asset?.auditHistory || asset.auditHistory.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                              No audit records found.
                            </TableCell>
                          </TableRow>
                        ) : asset.auditHistory.map((audit: { id: string; auditType: string; auditDate: string | Date; auditor: string | null; status: string | null; notes: string | null }) => (
                          <TableRow key={audit.id}>
                            <TableCell className="font-medium">
                              {formatDate(audit.auditDate || null)}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-medium">{audit.auditType || 'N/A'}</span>
                            </TableCell>
                            <TableCell>
                              {audit.status ? (
                                <span className={`px-2 py-1 text-xs font-medium rounded ${
                                  audit.status.toLowerCase() === 'completed' ? 'bg-green-500/10 text-green-500' :
                                  audit.status.toLowerCase() === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                                  audit.status.toLowerCase() === 'failed' ? 'bg-red-500/10 text-red-500' :
                                  'bg-gray-500/10 text-gray-500'
                                }`}>
                                  {audit.status}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{audit.auditor || <span className="text-muted-foreground">-</span>}</span>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm wrap-break-word">
                                {audit.notes || <span className="text-muted-foreground">-</span>}
                              </p>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  <ScrollBar orientation="horizontal" />
                  <ScrollBar orientation="vertical" className="z-50" />
                </ScrollArea>
              </div>
          </div>
        </motion.div>
        )}
        </AnimatePresence>

        {/* History Tab */}
        <AnimatePresence mode="wait">
        {activeTab === 'history' && (
        <motion.div
          key="history"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <div className="space-y-4">
              <div className="min-w-full">
                <ScrollArea className="h-[500px] relative border rounded-lg">
                  <div className="sticky top-0 z-30 h-px bg-border w-full"></div>
                    <Table>
                      <TableHeader className="sticky -top-1 z-20 bg-card [&_tr]:border-b-0">
                        <TableRow className="group hover:bg-muted/50 relative border-b-0 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-border after:z-30">
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[14%]">Date</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[12%]">Event</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[14%]">Field</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[22%]">Changed from</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[22%]">Changed to</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[16%]">Action by</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoadingHistory ? (
                          <TableRow>
                            <TableCell colSpan={6} className="h-[200px]">
                              <div className="flex items-center justify-center">
                                <div className="flex flex-col items-center gap-3">
                                  <Spinner className="h-8 w-8" />
                                  <p className="text-sm text-muted-foreground">Loading history logs...</p>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : historyLogs.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                              No history logs found.
                            </TableCell>
                          </TableRow>
                        ) : historyLogs.map((log: { id: string; eventType: string; eventDate: string; field?: string; changeFrom?: string; changeTo?: string; actionBy: string }) => {
                          const eventLabel = log.eventType === 'added' ? 'Asset added' : 
                                            log.eventType === 'edited' ? 'Asset edit' : 
                                            'Asset deleted'
                          
                          return (
                            <TableRow key={log.id}>
                              <TableCell className="font-medium">
                                {formatDateTime(log.eventDate)}
                              </TableCell>
                              <TableCell>
                                <span className={`px-2 py-1 text-xs font-medium rounded ${
                                  log.eventType === 'added' ? 'bg-green-500/10 text-green-500' :
                                  log.eventType === 'edited' ? 'bg-blue-500/10 text-blue-500' :
                                  'bg-red-500/10 text-red-500'
                                }`}>
                                  {eventLabel}
                                </span>
                              </TableCell>
                              <TableCell className="font-medium">
                                {log.field ? (
                                  <span className="capitalize">{log.field}</span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="max-w-[200px]" title={log.changeFrom || ''}>
                                  <p className="text-sm truncate">
                                    {log.changeFrom || <span className="text-muted-foreground">(empty)</span>}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="max-w-[200px]" title={log.changeTo || ''}>
                                  <p className="text-sm truncate">
                                    {log.changeTo || <span className="text-muted-foreground">(empty)</span>}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm">{log.actionBy}</span>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  <ScrollBar orientation="horizontal" />
                  <ScrollBar orientation="vertical" className="z-50" />
                </ScrollArea>
              </div>
          </div>
        </motion.div>
        )}
        </AnimatePresence>
      </div>
      
      {/* PDF Sections Selection Dialog */}
      <PdfSectionsDialog
        open={isPdfSectionsDialogOpen}
        onOpenChange={setIsPdfSectionsDialogOpen}
        onConfirm={downloadPDFWithSections}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={confirmDelete}
        itemName={asset.assetTagId}
        isLoading={deleteAssetMutation.isPending}
        title={`Move ${asset.assetTagId} to Trash?`}
        description="This asset will be moved to Trash and can be restored later if needed."
        confirmLabel="Move to Trash"
      />
    </motion.div>
  )
}

