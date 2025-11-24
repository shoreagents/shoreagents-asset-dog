'use client'

import { useState, use, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ImageIcon, FileText, Edit, CheckCircle2, ArrowRight, Trash2, Move, Package, FileText as FileTextIcon, Wrench, ChevronDown, Download } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
import { ImagePreviewDialog } from '@/components/image-preview-dialog'
import { DownloadConfirmationDialog } from '@/components/download-confirmation-dialog'
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
      const response = await fetch(`/api/assets/images/${assetTagId}`)
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
      const response = await fetch(`/api/assets/documents/${assetTagId}`)
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
  
  // Add timestamp to prevent caching and ensure fresh data
  const response = await fetch(`/api/assets/${id}?t=${Date.now()}`, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
    },
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `Failed to fetch asset: ${response.status}`)
  }
  
  const data = await response.json()
  if (!data || !data.asset) {
    throw new Error('Invalid response format from server')
  }
  
  return data
}

async function fetchHistoryLogs(assetId: string) {
  const response = await fetch(`/api/assets/${assetId}/history`)
  if (!response.ok) {
    return { logs: [] }
  }
  return response.json()
}

async function fetchMaintenance(assetId: string) {
  const response = await fetch(`/api/assets/maintenance?assetId=${assetId}`)
  if (!response.ok) {
    return { maintenances: [] }
  }
  return response.json()
}

async function fetchReserve(assetId: string) {
  const response = await fetch(`/api/assets/reserve?assetId=${assetId}`)
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
    statusColor = 'bg-blue-500'
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

export default function AssetDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { hasPermission } = usePermissions()
  const [activeTab, setActiveTab] = useState<'details' | 'photos' | 'docs' | 'depreciation' | 'maintenance' | 'reserve' | 'audit' | 'history'>('details')
  const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false)

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

  const assetId = resolvedParams.id

  const { data: assetData, isLoading: assetLoading, error: assetError, refetch, isFetching } = useQuery({
    queryKey: ['asset-details', resolvedParams.id],
    queryFn: () => {
      if (!resolvedParams.id) {
        throw new Error('Asset ID is missing')
      }
      return fetchAsset(resolvedParams.id)
    },
    enabled: !!resolvedParams.id && resolvedParams.id.trim().length > 0,
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
      const response = await fetch(`/api/assets/images/${asset.assetTagId}`, {
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

  const { data: historyData } = useQuery({
    queryKey: ['asset-history', resolvedParams.id],
    queryFn: () => fetchHistoryLogs(resolvedParams.id),
    enabled: !!resolvedParams.id && activeTab === 'history',
  })

  const { data: maintenanceData } = useQuery({
    queryKey: ['asset-maintenance', resolvedParams.id],
    queryFn: () => fetchMaintenance(resolvedParams.id),
    enabled: !!resolvedParams.id && activeTab === 'maintenance',
  })

  const { data: reserveData } = useQuery({
    queryKey: ['asset-reserve', resolvedParams.id],
    queryFn: () => fetchReserve(resolvedParams.id),
    enabled: !!resolvedParams.id && activeTab === 'reserve',
  })

  const historyLogs = historyData?.logs || []
  const maintenances = maintenanceData?.maintenances || []
  const reservations = reserveData?.reservations || []

  if (assetLoading || isFetching) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="h-8 w-8" />
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

  // Assigned To: Current active checkout's employee (who currently has the asset)
  // Only show if there's an active checkout with an employee name, otherwise show N/A (no fallback to issuedTo)
  const assignedToUser = (activeCheckout?.employeeUser?.name && activeCheckout.employeeUser.name.trim()) 
    ? activeCheckout.employeeUser.name 
    : 'N/A'
  
  // Issued To: Original issued to field from the asset (static field)
  const issuedToUser = asset.issuedTo || 'N/A'

  // Handle PDF download
  const handleDownloadPDF = async () => {
    try {
      toast.loading('Generating PDF...', { id: 'pdf-generation' })

      // Send to PDF API - API will fetch all data and generate structured PDF
      const response = await fetch(`/api/assets/${asset.id}/pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate PDF')
      }

      // Get PDF blob
      const blob = await response.blob()
      
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
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to generate PDF', { id: 'pdf-generation' })
    }
  }

  return (
    <div key={assetId} id="asset-details-content" className="space-y-6 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold truncate">{asset.assetTagId}</h1>
          <p className="text-muted-foreground truncate">
            {asset.description}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <Button 
            variant="outline"
            onClick={handleDownloadPDF}
            className="w-full sm:w-auto"
          >
            <Download className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Download</span>
            <span className="sm:hidden">PDF</span>
          </Button>
          {canEditAssets && (
            <Button 
              variant="default"
              onClick={() => {
                router.push(`/assets/${asset.id}`)
              }}
              className="w-full sm:w-auto"
            >
              <Edit className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Edit Asset</span>
              <span className="sm:hidden">Edit</span>
            </Button>
          )}
          <DropdownMenu open={isMoreActionsOpen} onOpenChange={setIsMoreActionsOpen}>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full sm:w-auto"
                title="More Actions"
              >
                More Actions
                <ChevronDown className={`ml-2 h-4 w-4 transition-transform duration-200 ${isMoreActionsOpen ? 'rotate-180' : ''}`} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEditAssets && (
                <DropdownMenuItem 
                  onClick={() => {
                    router.push(`/assets/${asset.id}`)
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Asset
                </DropdownMenuItem>
              )}
              {canAudit && (
                <DropdownMenuItem 
                  onClick={() => {
                    router.push(`/tools/audit?assetId=${asset.id}`)
                  }}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Manage Audits
                </DropdownMenuItem>
              )}
              {canCheckout && (
                <DropdownMenuItem 
                  onClick={() => {
                    router.push(`/assets/checkout?assetId=${asset.id}`)
                  }}
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Checkout
                </DropdownMenuItem>
              )}
              {canCheckin && (
                <DropdownMenuItem 
                  onClick={() => {
                    router.push(`/assets/checkin?assetId=${asset.id}`)
                  }}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Checkin
                </DropdownMenuItem>
              )}
              {canMove && (
                <DropdownMenuItem 
                  onClick={() => {
                    router.push(`/assets/move?assetId=${asset.id}`)
                  }}
                >
                  <Move className="mr-2 h-4 w-4" />
                  Move
                </DropdownMenuItem>
              )}
              {canReserve && (
                <DropdownMenuItem 
                  onClick={() => {
                    router.push(`/assets/reserve?assetId=${asset.id}`)
                  }}
                >
                  <Package className="mr-2 h-4 w-4" />
                  Reserve
                </DropdownMenuItem>
              )}
              {canLease && (
                <>
                  <DropdownMenuItem 
                    onClick={() => {
                      router.push(`/assets/lease?assetId=${asset.id}`)
                    }}
                  >
                    <FileTextIcon className="mr-2 h-4 w-4" />
                    Lease
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => {
                      router.push(`/assets/lease-return?assetId=${asset.id}`)
                    }}
                  >
                    <FileTextIcon className="mr-2 h-4 w-4" />
                    Lease Return
                  </DropdownMenuItem>
                </>
              )}
              {canDispose && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Dispose
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem
                      onClick={() => {
                        router.push(`/assets/dispose?assetId=${asset.id}&method=Sold`)
                      }}
                    >
                      Sold
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        router.push(`/assets/dispose?assetId=${asset.id}&method=Donated`)
                      }}
                    >
                      Donated
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        router.push(`/assets/dispose?assetId=${asset.id}&method=Scrapped`)
                      }}
                    >
                      Scrapped
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        router.push(`/assets/dispose?assetId=${asset.id}&method=Lost/Missing`)
                      }}
                    >
                      Lost/Missing
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        router.push(`/assets/dispose?assetId=${asset.id}&method=Destroyed`)
                      }}
                    >
                      Destroyed
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              {canManageMaintenance && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Wrench className="mr-2 h-4 w-4" />
                    Maintenance
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem
                      onClick={() => {
                        router.push(`/assets/maintenance?assetId=${asset.id}&status=Scheduled`)
                      }}
                    >
                      Scheduled
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        router.push(`/assets/maintenance?assetId=${asset.id}&status=In progress`)
                      }}
                    >
                      In Progress
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
              {canDeleteAssets && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      router.push(`/assets?delete=${asset.id}`)
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Move to Trash
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href="/assets" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto">
              <ArrowLeft className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Back to Assets</span>
              <span className="sm:hidden">Back</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Top Section with Thumbnail and Key Fields */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 border rounded-lg p-4">
        {/* Thumbnail Image */}
        <div className="lg:col-span-1">
          <div className="relative w-full h-64 bg-muted rounded-lg overflow-hidden flex items-center justify-center">
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
            onClick={() => setActiveTab('details')}
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
            onClick={() => setActiveTab('photos')}
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
            onClick={() => setActiveTab('docs')}
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
            onClick={() => setActiveTab('depreciation')}
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
            onClick={() => setActiveTab('maintenance')}
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
            onClick={() => setActiveTab('reserve')}
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
            onClick={() => setActiveTab('audit')}
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
            onClick={() => setActiveTab('history')}
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
        {activeTab === 'details' && (
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
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Created At</p>
              <p className="text-sm">{formatDateTime(asset.createdAt || null)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Updated At</p>
              <p className="text-sm">{formatDateTime(asset.updatedAt || null)}</p>
            </div>
            {asset.description && (
              <div className="md:col-span-2">
                <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                <p className="text-sm">{asset.description}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'photos' && asset && (
          <PhotosTabContent assetTagId={asset.assetTagId} isActive={activeTab === 'photos'} />
        )}

        {activeTab === 'docs' && asset && (
          <DocsTabContent assetTagId={asset.assetTagId} isActive={activeTab === 'docs'} />
        )}

        {activeTab === 'depreciation' && (
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
        )}

        {activeTab === 'maintenance' && (
          <div className="space-y-4">
            {maintenances.length === 0 ? (
              <p className="text-sm text-muted-foreground">No maintenance records found.</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[20%]">Title</TableHead>
                      <TableHead className="w-[15%]">Status</TableHead>
                      <TableHead className="w-[12%]">Due Date</TableHead>
                      <TableHead className="w-[12%]">Date Completed</TableHead>
                      <TableHead className="w-[15%]">Maintenance By</TableHead>
                      <TableHead className="w-[12%]">Cost</TableHead>
                      <TableHead className="w-[14%]">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {maintenances.map((maintenance: { 
                      id: string
                      title: string
                      details?: string | null
                      dueDate?: string | Date | null
                      status?: string | null
                      maintenanceBy?: string | null
                      dateCompleted?: string | Date | null
                      cost?: number | string | null
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
              </div>
            )}
          </div>
        )}

        {activeTab === 'reserve' && (
          <div className="space-y-4">
            {reservations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reservations found.</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[15%]">Asset ID</TableHead>
                      <TableHead className="w-[18%]">Description</TableHead>
                      <TableHead className="w-[12%]">Type</TableHead>
                      <TableHead className="w-[15%]">Reserved For</TableHead>
                      <TableHead className="w-[15%]">Purpose</TableHead>
                      <TableHead className="w-[12%]">Reservation Date</TableHead>
                      <TableHead className="w-[13%]">Time Ago</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservations.map((reservation: { 
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
              </div>
            )}
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="space-y-4">
            {!asset?.auditHistory || asset.auditHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No audit records found.</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[12%]">Date</TableHead>
                      <TableHead className="w-[18%]">Audit Type</TableHead>
                      <TableHead className="w-[12%]">Status</TableHead>
                      <TableHead className="w-[18%]">Auditor</TableHead>
                      <TableHead className="w-[40%]">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {asset.auditHistory.map((audit: { id: string; auditType: string; auditDate: string | Date; auditor: string | null; status: string | null; notes: string | null }) => (
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
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            {historyLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No history logs found.</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[150px]">Date</TableHead>
                      <TableHead className="w-[120px]">Event</TableHead>
                      <TableHead className="w-[150px]">Field</TableHead>
                      <TableHead>Changed from</TableHead>
                      <TableHead>Changed to</TableHead>
                      <TableHead className="w-[180px]">Action by</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyLogs.map((log: { id: string; eventType: string; eventDate: string; field?: string; changeFrom?: string; changeTo?: string; actionBy: string }) => {
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
                            <div className="max-w-[300px]">
                              <p className="text-sm wrap-break-word">
                                {log.changeFrom || <span className="text-muted-foreground">(empty)</span>}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[300px]">
                              <p className="text-sm wrap-break-word">
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
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

