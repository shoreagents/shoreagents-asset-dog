"use client"

import * as React from "react"
import { useState, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { QrCode, Upload, Edit, CheckCircle2, ArrowRight, ArrowLeft, Trash2, Move, Package, FileText, Wrench, ImageIcon, ClipboardCheck, User, MoreVertical, ChevronLeft } from "lucide-react"
import { Scanner } from '@yudiel/react-qr-scanner'
import { Html5Qrcode } from 'html5-qrcode'
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { usePermissions } from '@/hooks/use-permissions'
import { useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea, ScrollBar } from "./ui/scroll-area"
import { useQuery } from "@tanstack/react-query"
import { CheckoutManager } from "@/components/checkout-manager"
import { AuditHistoryManager } from "@/components/audit-history-manager"
import { ImagePreviewDialog } from "@/components/dialogs/image-preview-dialog"
import { DownloadConfirmationDialog } from "@/components/dialogs/download-confirmation-dialog"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { useIsMobile } from "@/hooks/use-mobile"

const routeLabels: Record<string, string> = {
  '/': 'Home',
  '/dashboard': 'Dashboard',
  '/assets': 'Assets',
  '/assets/add': 'Add Asset',
  '/assets/checkout': 'Check Out',
  '/assets/checkin': 'Check In',
  '/assets/move': 'Move Asset',
  '/assets/reserve': 'Reserve Asset',
  '/assets/lease': 'Lease Asset',
  '/assets/lease-return': 'Lease Return',
  '/assets/dispose': 'Dispose Asset',
  '/assets/maintenance': 'Maintenance',
  '/forms': 'Forms',
  '/forms/return-form': 'Return Forms',
  '/forms/accountability-form': 'Accountability Form',
  '/forms/history': 'Forms History',
  '/lists': 'Lists',
  '/lists/assets': 'Assets List',
  '/lists/maintenances': 'Maintenances List',
  '/tools': 'Tools',
  '/tools/media': 'Media',
  '/tools/audit': 'Audit',
  '/tools/trash': 'Trash',
  '/tools/import': 'Import',
  '/tools/export': 'Export',
  '/setup': 'Setup',
  '/setup/categories': 'Categories',
  '/setup/locations': 'Locations',
  '/setup/sites': 'Sites',
  '/setup/departments': 'Departments',
  '/setup/company-info': 'Company Info',
  '/settings': 'Settings',
  '/settings/users': 'Users',
  '/settings/password': 'Password',
  '/employees': 'Employees',
  '/reports': 'Reports',
  '/reports/assets': 'Asset Reports',
  '/account': 'Account Settings',
}

function generateBreadcrumbs(pathname: string) {
  const paths = pathname.split('/').filter(Boolean)
  const breadcrumbs = []

  // Build breadcrumb trail
  let currentPath = ''
  paths.forEach((segment, index) => {
    currentPath += `/${segment}`
    const isLast = index === paths.length - 1
    
    // Handle dynamic routes
    let label = routeLabels[currentPath]
    if (!label) {
      // Check if this is an asset edit page (/assets/[id])
      if (currentPath.startsWith('/assets/') && paths.length === 2 && paths[0] === 'assets' && isLast) {
        // Check if segment looks like a UUID (basic check)
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (uuidPattern.test(segment)) {
          label = 'Edit Asset'
        } else {
          label = segment.charAt(0).toUpperCase() + segment.slice(1)
        }
      } else {
        label = segment.charAt(0).toUpperCase() + segment.slice(1)
      }
    }
    
    breadcrumbs.push({
      label,
      href: currentPath,
      isLast,
    })
  })

  // If at root, add Dashboard
  if (breadcrumbs.length === 0) {
    breadcrumbs.push({
      label: 'Overview',
      href: '/',
      isLast: true,
    })
  }

  return breadcrumbs
}

// Asset Media Tab Content Component
export function AssetMediaTabContent({ assetTagId }: { assetTagId: string }) {
  const [activeMediaTab, setActiveMediaTab] = useState<'images' | 'documents'>('images')
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewImageIndex, setPreviewImageIndex] = useState(0)
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false)
  const [documentToDownload, setDocumentToDownload] = useState<{ id: string; documentUrl: string; fileName?: string; documentSize?: number | null } | null>(null)
  
  const { data: imagesData, isLoading: loadingImages } = useQuery({
    queryKey: ['asset-images', assetTagId],
    queryFn: async () => {
      const response = await fetch(`/api/assets/images/${assetTagId}`)
      if (!response.ok) return { images: [] }
      const data = await response.json()
      return { images: data.images || [] }
    },
    enabled: !!assetTagId,
  })

  const { data: documentsData, isLoading: loadingDocuments } = useQuery({
    queryKey: ['asset-documents', assetTagId],
    queryFn: async () => {
      const response = await fetch(`/api/assets/documents/${assetTagId}`)
      if (!response.ok) return { documents: [] }
      const data = await response.json()
      return { documents: data.documents || [] }
    },
    enabled: !!assetTagId,
  })

  const images = imagesData?.images || []
  const documents = documentsData?.documents || []

  const handleImageClick = (index: number) => {
    setPreviewImageIndex(index)
    setIsPreviewOpen(true)
  }

  const handleDocumentClick = (doc: { id: string; documentUrl: string; fileName?: string; documentSize?: number | null; mimeType?: string | null }) => {
    // Check if it's an image document
    const isImage = doc.mimeType?.startsWith('image/') || 
      /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.fileName || '')
    
    // Check if it's a PDF
    const isPdf = doc.mimeType === 'application/pdf' || 
      /\.pdf$/i.test(doc.fileName || '')
    
    if (isImage) {
      // For image documents, show them in preview but only include documents
      const imageDocs = documents.filter((d: { mimeType?: string | null; fileName?: string }) => {
        const docIsImage = d.mimeType?.startsWith('image/') || 
          /\.(jpg|jpeg|png|gif|webp)$/i.test(d.fileName || '')
        return docIsImage
      })
      const imageDocIndex = imageDocs.findIndex((d: { id: string }) => d.id === doc.id)
      setPreviewImageIndex(imageDocIndex)
      setIsPreviewOpen(true)
    } else if (isPdf) {
      // For PDFs, open directly in a new tab
      window.open(doc.documentUrl, '_blank', 'noopener,noreferrer')
    } else {
      // Show download confirmation for other non-image documents
      setDocumentToDownload(doc)
      setIsDownloadDialogOpen(true)
    }
  }

  return (
    <div className="space-y-4 h-[300px] flex flex-col">
      <div className="flex items-center gap-2 border-b">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setActiveMediaTab('images')}
          className={`px-4 py-2 h-auto text-sm font-medium transition-colors border-b-2 rounded-none ${
            activeMediaTab === 'images'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Images ({images.length})
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setActiveMediaTab('documents')}
          className={`px-4 py-2 h-auto text-sm font-medium transition-colors border-b-2 rounded-none ${
            activeMediaTab === 'documents'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Documents ({documents.length})
        </Button>
      </div>

      <ScrollArea className="h-[300px]">
        {activeMediaTab === 'images' ? (
          loadingImages ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="h-6 w-6" />
            </div>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ImageIcon className="h-12 w-12 text-muted-foreground opacity-50 mb-2" />
              <p className="text-sm font-medium">No images found</p>
              <p className="text-xs text-muted-foreground">Images will appear here when uploaded</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-2">
              {images.map((img: { id: string; imageUrl: string; fileName?: string }, index: number) => (
                <div
                  key={img.id}
                  className="relative aspect-square rounded-lg overflow-hidden border border-border hover:border-primary transition-colors cursor-pointer group"
                  onClick={() => handleImageClick(index)}
                >
                  <Image
                    src={img.imageUrl}
                    alt={img.fileName || 'Asset image'}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center z-10">
                    <div className="bg-white/50 rounded-full p-3 shadow-lg">
                      <ImageIcon className="h-6 w-6 text-black" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          loadingDocuments ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="h-6 w-6" />
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground opacity-50 mb-2" />
              <p className="text-sm font-medium">No documents found</p>
              <p className="text-xs text-muted-foreground">Documents will appear here when uploaded</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-2">
              {documents.map((doc: { id: string; documentUrl: string; fileName?: string; documentSize?: number | null; mimeType?: string | null }) => {
                const isImage = doc.mimeType?.startsWith('image/') || 
                  /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.fileName || '')
                
                return (
                  <div
                    key={doc.id}
                    onClick={() => handleDocumentClick(doc)}
                    className="relative aspect-square rounded-lg overflow-hidden border border-border hover:border-primary transition-colors cursor-pointer group bg-muted flex flex-col"
                  >
                    {isImage ? (
                      <>
                        <div className="relative flex-1 overflow-hidden">
                          <Image
                            src={doc.documentUrl}
                            alt={doc.fileName || 'Document image'}
                            fill
                            className="object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center z-10">
                            <div className="bg-white/50 rounded-full p-3 shadow-lg">
                              <ImageIcon className="h-6 w-6 text-black" />
                            </div>
                          </div>
                        </div>
                        <div className="p-2 bg-background">
                          <p className="text-xs font-medium truncate">{doc.fileName || 'Document'}</p>
                          {doc.documentSize && (
                            <p className="text-xs text-muted-foreground">
                              {(doc.documentSize / 1024 / 1024).toFixed(2)} MB
                            </p>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 flex items-center justify-center p-4">
                          <FileText className="h-12 w-12 text-muted-foreground" />
                        </div>
                        <div className="p-2 bg-background border-t">
                          <p className="text-xs font-medium truncate">{doc.fileName || 'Document'}</p>
                          {doc.documentSize && (
                            <p className="text-xs text-muted-foreground">
                              {(doc.documentSize / 1024 / 1024).toFixed(2)} MB
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )
        )}
      </ScrollArea>

      {/* Image Preview Dialog */}
      <ImagePreviewDialog
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        existingImages={
          activeMediaTab === 'images'
            ? // Images tab: only show actual images
              images.map((img: { id: string; imageUrl: string; fileName?: string }) => ({
                id: img.id,
                imageUrl: img.imageUrl,
                fileName: img.fileName || 'Image',
              }))
            : // Documents tab: only show image documents
              documents
                .filter((doc: { mimeType?: string | null; fileName?: string }) => {
                  const isImage = doc.mimeType?.startsWith('image/') || 
                    /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.fileName || '')
                  return isImage
                })
                .map((doc: { id: string; documentUrl: string; fileName?: string }) => ({
                  id: doc.id,
                  imageUrl: doc.documentUrl,
                  fileName: doc.fileName || 'Image',
                }))
        }
        title={activeMediaTab === 'images' ? `Asset Images - ${assetTagId}` : `Asset Documents - ${assetTagId}`}
        maxHeight="h-[70vh] max-h-[600px]"
        initialIndex={previewImageIndex}
      />

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
    </div>
  )
}

interface Asset {
  id: string
  assetTagId: string
  description: string
  status?: string | null
  category?: {
    id: string
    name: string
  } | null
  subCategory?: {
    id: string
    name: string
  } | null
  purchasedFrom?: string | null
  purchaseDate?: string | null
  brand?: string | null
  cost?: number | string | null
  model?: string | null
  serialNo?: string | null
  location?: string | null
  department?: string | null
  site?: string | null
  owner?: string | null
  issuedTo?: string | null
  checkouts?: Array<{
    id: string
    checkoutDate: string | null
    employeeUser?: {
      id: string
      name: string
      email: string
    } | null
  }>
}

// Helper function to get status badge with colors
const getStatusBadge = (status: string | null | undefined) => {
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

export function AppHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const { hasPermission } = usePermissions()
  const isMobile = useIsMobile()
  const canViewAssets = hasPermission('canViewAssets')
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
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [scannedAsset, setScannedAsset] = useState<Asset | null>(null)
  const [isLoadingAsset, setIsLoadingAsset] = useState(false)
  const [scanMode, setScanMode] = useState<'camera' | 'upload'>('camera')
  const [activeTab, setActiveTab] = useState<'details' | 'media' | 'checkout' | 'audit'>('details')
  const qrScanContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lastScannedCodeRef = useRef<string | null>(null)
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Don't show header on login page
  if (!pathname || pathname === '/login') {
    return null
  }

  const breadcrumbs = generateBreadcrumbs(pathname)

  // Find asset by assetTagId
  const findAssetById = async (assetTagId: string): Promise<Asset | null> => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
        ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
        : ''
      const url = `${baseUrl}/api/assets?search=${encodeURIComponent(assetTagId)}`
      
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
        console.error(`Failed to fetch asset: ${response.status} ${response.statusText}`, errorText)
        return null
      }
      
      const data = await response.json()
      const assets = data.assets as Asset[]
      
      // Find exact match by assetTagId (case-insensitive)
      const asset = assets.find(
        (a) => a.assetTagId.toLowerCase() === assetTagId.toLowerCase()
      )
      
      return asset || null
    } catch (error) {
      console.error('Error looking up asset:', error)
      return null
    }
  }

  // Handle QR code scan result
  const handleQRScanResult = async (results: Array<{ rawValue?: string; text?: string }> | string | undefined) => {
    if (!results) return
    
    let decodedText: string | undefined
    
    // Handle different result types
    if (typeof results === 'string') {
      decodedText = results
    } else if (Array.isArray(results) && results.length > 0) {
      const result = results[0]
      decodedText = result.rawValue || result.text || (typeof result === 'string' ? result : undefined)
    }
    
    if (!decodedText || !decodedText.trim()) return
    
    const trimmedCode = decodedText.trim()
    
    // Prevent duplicate scans - if we're already loading or just scanned the same code, ignore
    if (isLoadingAsset || lastScannedCodeRef.current === trimmedCode) {
      return
    }
    
    // Clear any pending timeout
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current)
    }
    
    // Debounce: Wait a bit before processing to avoid rapid multiple scans
    scanTimeoutRef.current = setTimeout(async () => {
      lastScannedCodeRef.current = trimmedCode
      setIsLoadingAsset(true)
      setScannedAsset(null)
      
      // Find asset by scanned QR code (assetTagId)
      const asset = await findAssetById(trimmedCode)
      
      setIsLoadingAsset(false)
      
      if (!asset) {
        toast.error(`Asset with ID "${trimmedCode}" not found`)
        // Clear the last scanned code after a delay to allow rescanning
        setTimeout(() => {
          lastScannedCodeRef.current = null
        }, 2000)
        return
      }
      
      setScannedAsset(asset)
      toast.success('Asset found!')
    }, 300) // 300ms debounce
  }

  const formatCurrency = (value: number | string | null | undefined) => {
    if (!value) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PHP',
    }).format(Number(value))
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A'
    try {
      return new Date(dateString).toLocaleDateString()
    } catch {
      return dateString
    }
  }

  // Handle QR code upload
  const handleQRUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    let html5QrCode: Html5Qrcode | null = null
    
    try {
      html5QrCode = new Html5Qrcode("qr-reader")
      
      const decodedText = await html5QrCode.scanFile(file, false)
      
      // Clean up the scanner (scanFile doesn't require stop, just clear)
      try {
        html5QrCode.clear()
      } catch {
        // Ignore cleanup errors
      }
      html5QrCode = null
      
      // Process the scanned code
      await handleQRScanResult(decodedText.trim())
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      console.error('Error scanning QR code:', err)
      toast.error('Failed to scan QR code from image. Please try again.')
      
      // Clean up on error (scanFile doesn't require stop, just clear)
      if (html5QrCode) {
        try {
          html5QrCode.clear()
        } catch {
          // Ignore cleanup errors
        }
      }
      
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <>
    <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 border-b border-white/20 bg-white/10 dark:bg-white/5 bg-clip-padding backdrop-filter backdrop-blur-md shadow-sm">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1 rounded-full p-4" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.href}>
                <BreadcrumbItem>
                  {crumb.isLast ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.href}>
                        {crumb.label}
                      </Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="flex items-center gap-2 px-4">
          {canViewAssets && (
          <Button
            type="button"
            className="rounded-full"
            variant="ghost"
            size="icon"
            onClick={() => {
              setQrDialogOpen(true)
              setScannedAsset(null)
              lastScannedCodeRef.current = null
              if (scanTimeoutRef.current) {
                clearTimeout(scanTimeoutRef.current)
              }
            }}
            title="Scan QR Code"
          >
            <QrCode className="h-4 w-4" />
          </Button>
          )}
        <ThemeToggle />
      </div>
    </header>

      {/* QR Scanner Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={(open) => {
        if (!open) {
          // Clean up camera streams before closing
          const videoElements = document.querySelectorAll('video')
          videoElements.forEach((video) => {
            if (video.srcObject) {
              const stream = video.srcObject as MediaStream
              stream.getTracks().forEach((track) => {
                track.stop()
              })
              video.srcObject = null
            }
            video.pause()
          })
        }
        setQrDialogOpen(open)
        if (!open) {
          setScanMode('camera')
          setScannedAsset(null)
          lastScannedCodeRef.current = null
          if (scanTimeoutRef.current) {
            clearTimeout(scanTimeoutRef.current)
          }
        }
      }}>
        <DialogContent className="max-w-4xl! max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sm:text-lg text-sm">Scan QR Code to View Asset Details</DialogTitle>
            <DialogDescription className="sm:text-sm text-xs">
              {scanMode === 'camera' 
                ? 'Point your camera at the QR code on the asset to view its details'
                : 'Upload an image containing a QR code to view asset details'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Mode Toggle */}
            {!scannedAsset && (
              <div className="flex gap-2 justify-center">
                <Button
                  type="button"
                  variant={scanMode === 'camera' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setScanMode('camera')}
                  className={cn(scanMode !== "camera" && "btn-glass")}
                >
                  <QrCode className="mr-2 h-4 w-4" />
                  Camera Scan
                </Button>
                <Button
                  type="button"
                  variant={scanMode === 'upload' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setScanMode('upload')
                    fileInputRef.current?.click()
                  }}
                  className={cn(scanMode !== "upload" && "btn-glass")}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Image
                </Button>
                <input
                  id="qr-upload-file"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleQRUpload}
                />
              </div>
            )}

            {/* QR Scanner */}
            {!scannedAsset && scanMode === 'camera' && (
              <div className="flex flex-col items-center justify-center py-4">
                <div ref={qrScanContainerRef} className="w-full max-w-sm">
                  {qrDialogOpen && (
                    <Scanner
                      key={`scanner-${qrDialogOpen}`}
                      onScan={(results) => handleQRScanResult(results)}
                      onError={(error) => {
                        // Ignore AbortError - it's expected when dialog closes during stream initialization
                        if (error instanceof Error) {
                          if (error.name === 'AbortError' || 
                              error.message.includes('interrupted') ||
                              error.message.includes('media was removed')) {
                            return
                          }
                        } else if (typeof error === 'object' && error !== null) {
                          const errorObj = error as { name?: string; message?: string }
                          if (errorObj.name === 'AbortError' || 
                              errorObj.message?.includes('interrupted') ||
                              errorObj.message?.includes('media was removed')) {
                            return
                          }
                        }
                        console.error('QR scan error:', error)
                      }}
                      constraints={{
                        facingMode: 'environment',
                        width: { ideal: 1920 },
                        height: { ideal: 1080 },
                        advanced: [
                          { focusMode: 'continuous' },
                          { zoom: { min: 1, max: 5 } }
                        ]
                      } as MediaTrackConstraints & { advanced?: Array<Record<string, unknown>> }}
                      components={{
                        zoom: true
                      }}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Upload Area */}
            {!scannedAsset && scanMode === 'upload' && (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Upload an image containing a QR code
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-glass"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Choose File
                  </Button>
                </div>
                <div id="qr-reader" className="hidden"></div>
              </div>
            )}

            {/* Loading State */}
            {isLoadingAsset && (
              <div className="flex items-center justify-center py-8">
                <div className="flex flex-col items-center gap-3">
                  <Spinner variant="default" size={24} className="text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">Loading asset details...</p>
                </div>
              </div>
            )}

            {/* Asset Details with Tabs */}
            {scannedAsset && !isLoadingAsset && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h3 className="text-lg font-semibold">{scannedAsset.assetTagId}</h3>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="outline" 
                        size={isMobile ? "icon" : "sm"}
                        className={cn(
                          isMobile ? "h-8 w-8 btn-glass" : "btn-glass"
                        )}
                        title="More Actions"
                      >
                        {isMobile ? (
                          <MoreVertical className="h-4 w-4" />
                        ) : (
                          <>
                          <ChevronLeft className="h-4 w-4"  />
                          <span>More Actions</span>
                          </>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => {
                          if (!canEditAssets) {
                            toast.error('You do not have permission to edit assets')
                            return
                          }
                            router.push(`/assets/${scannedAsset.id}`)
                            setQrDialogOpen(false)
                          }}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Asset
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => {
                          if (!canAudit) {
                            toast.error('You do not have permission to manage audits')
                            return
                          }
                            router.push(`/tools/audit?assetId=${scannedAsset.id}`)
                            setQrDialogOpen(false)
                          }}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Manage Audits
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => {
                          if (!canCheckout) {
                            toast.error('You do not have permission to checkout assets')
                            return
                          }
                            router.push(`/assets/checkout?assetId=${scannedAsset.id}`)
                            setQrDialogOpen(false)
                          }}
                        >
                          <ArrowRight className="mr-2 h-4 w-4" />
                          Checkout
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => {
                          if (!canCheckin) {
                            toast.error('You do not have permission to checkin assets')
                            return
                          }
                            router.push(`/assets/checkin?assetId=${scannedAsset.id}`)
                            setQrDialogOpen(false)
                          }}
                        >
                          <ArrowLeft className="mr-2 h-4 w-4" />
                          Checkin
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => {
                          if (!canMove) {
                            toast.error('You do not have permission to move assets')
                            return
                          }
                            router.push(`/assets/move?assetId=${scannedAsset.id}`)
                            setQrDialogOpen(false)
                          }}
                        >
                          <Move className="mr-2 h-4 w-4" />
                          Move
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => {
                          if (!canReserve) {
                            toast.error('You do not have permission to reserve assets')
                            return
                          }
                            router.push(`/assets/reserve?assetId=${scannedAsset.id}`)
                            setQrDialogOpen(false)
                          }}
                        >
                          <Package className="mr-2 h-4 w-4" />
                          Reserve
                        </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => {
                          if (!canLease) {
                            toast.error('You do not have permission to lease assets')
                            return
                          }
                              router.push(`/assets/lease?assetId=${scannedAsset.id}`)
                              setQrDialogOpen(false)
                            }}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Lease
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => {
                          if (!canLease) {
                            toast.error('You do not have permission to return leased assets')
                            return
                          }
                              router.push(`/assets/lease-return?assetId=${scannedAsset.id}`)
                              setQrDialogOpen(false)
                            }}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Lease Return
                          </DropdownMenuItem>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Dispose
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            <DropdownMenuItem
                              onClick={() => {
                              if (!canDispose) {
                                toast.error('You do not have permission to dispose assets')
                                return
                              }
                                router.push(`/assets/dispose?assetId=${scannedAsset.id}&method=Sold`)
                                setQrDialogOpen(false)
                              }}
                            >
                              Sold
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                              if (!canDispose) {
                                toast.error('You do not have permission to dispose assets')
                                return
                              }
                                router.push(`/assets/dispose?assetId=${scannedAsset.id}&method=Donated`)
                                setQrDialogOpen(false)
                              }}
                            >
                              Donated
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                              if (!canDispose) {
                                toast.error('You do not have permission to dispose assets')
                                return
                              }
                                router.push(`/assets/dispose?assetId=${scannedAsset.id}&method=Scrapped`)
                                setQrDialogOpen(false)
                              }}
                            >
                              Scrapped
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                              if (!canDispose) {
                                toast.error('You do not have permission to dispose assets')
                                return
                              }
                                router.push(`/assets/dispose?assetId=${scannedAsset.id}&method=Lost/Missing`)
                                setQrDialogOpen(false)
                              }}
                            >
                              Lost/Missing
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                              if (!canDispose) {
                                toast.error('You do not have permission to dispose assets')
                                return
                              }
                                router.push(`/assets/dispose?assetId=${scannedAsset.id}&method=Destroyed`)
                                setQrDialogOpen(false)
                              }}
                            >
                              Destroyed
                            </DropdownMenuItem>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <Wrench className="mr-2 h-4 w-4" />
                            Maintenance
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            <DropdownMenuItem
                              onClick={() => {
                              if (!canManageMaintenance) {
                                toast.error('You do not have permission to manage maintenance')
                                return
                              }
                                router.push(`/assets/maintenance?assetId=${scannedAsset.id}&status=Scheduled`)
                                setQrDialogOpen(false)
                              }}
                            >
                              Scheduled
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                              if (!canManageMaintenance) {
                                toast.error('You do not have permission to manage maintenance')
                                return
                              }
                                router.push(`/assets/maintenance?assetId=${scannedAsset.id}&status=In progress`)
                                setQrDialogOpen(false)
                              }}
                            >
                              In Progress
                            </DropdownMenuItem>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                          if (!canDeleteAssets) {
                            toast.error('You do not have permission to delete assets')
                            return
                          }
                              router.push(`/assets?delete=${scannedAsset.id}`)
                              setQrDialogOpen(false)
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Move to Trash
                          </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Tabs */}
                <ScrollArea className="border-b">
                  <div className="flex items-center gap-2 w-10 ">
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
                      Asset Details
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setActiveTab('media')}
                      className={`px-4 py-2 h-auto text-sm font-medium transition-colors border-b-2 rounded-none ${
                        activeTab === 'media'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Media
                      </span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setActiveTab('checkout')}
                      className={`px-4 py-2 h-auto text-sm font-medium transition-colors border-b-2 rounded-none ${
                        activeTab === 'checkout'
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Check-Out
                      </span>
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
                      <span className="flex items-center gap-2">
                        <ClipboardCheck className="h-4 w-4" />
                        Audit
                      </span>
                    </Button>
                  </div>
                <ScrollBar orientation="horizontal" />
                </ScrollArea>

                {/* Tab Content */}
                <div className="min-h-[300px]">
                  {activeTab === 'details' && (
                    <ScrollArea className="h-[300px]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                    <p className="text-sm text-muted-foreground break">{scannedAsset.description}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Category</p>
                    <p className="text-sm">
                      {scannedAsset.category?.name || 'N/A'}
                      {scannedAsset.subCategory?.name && ` - ${scannedAsset.subCategory.name}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Status</p>
                    <div className="flex items-center">
                      {getStatusBadge(scannedAsset.status) || <span className="text-sm">N/A</span>}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Location</p>
                    <p className="text-sm">{scannedAsset.location || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Department</p>
                    <p className="text-sm">{scannedAsset.department || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Site</p>
                    <p className="text-sm">{scannedAsset.site || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Cost</p>
                    <p className="text-sm">{formatCurrency(scannedAsset.cost)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Brand</p>
                    <p className="text-sm">{scannedAsset.brand || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Model</p>
                    <p className="text-sm">{scannedAsset.model || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Serial No</p>
                    <p className="text-sm">{scannedAsset.serialNo || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Purchased From</p>
                    <p className="text-sm">{scannedAsset.purchasedFrom || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Purchase Date</p>
                    <p className="text-sm">{formatDate(scannedAsset.purchaseDate || null)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Owner</p>
                    <p className="text-sm">{scannedAsset.owner || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Issued To</p>
                    <p className="text-sm">{scannedAsset.issuedTo || 'N/A'}</p>
                  </div>
                </div>
                      <ScrollArea/>
                    </ScrollArea>
                  )}

                  {activeTab === 'media' && scannedAsset && (
                    <AssetMediaTabContent assetTagId={scannedAsset.assetTagId} />
                  )}

                  {activeTab === 'checkout' && scannedAsset && (
                    <div className="h-[300px]">
                      <CheckoutManager 
                        assetId={scannedAsset.id} 
                        assetTagId={scannedAsset.assetTagId}
                        invalidateQueryKey={[]}
                        readOnly={true}
                      />
                    </div>
                  )}

                  {activeTab === 'audit' && scannedAsset && (
                    <div className="h-[300px]">
                      <AuditHistoryManager 
                        assetId={scannedAsset.id} 
                        assetTagId={scannedAsset.assetTagId}
                        readOnly={true}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            {scannedAsset && (
              <Button
                variant="outline"
                onClick={() => {
                  setScannedAsset(null)
                  setActiveTab('details')
                  lastScannedCodeRef.current = null
                  if (scanTimeoutRef.current) {
                    clearTimeout(scanTimeoutRef.current)
                  }
                }}
                className="btn-glass"
              >
                Scan Another
              </Button>
            )}
            <Button variant="outline" className="btn-glass" onClick={() => {
              setQrDialogOpen(false)
              setScannedAsset(null)
              setActiveTab('details')
              lastScannedCodeRef.current = null
              if (scanTimeoutRef.current) {
                clearTimeout(scanTimeoutRef.current)
              }
            }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

