"use client"

import * as React from "react"
import { useState, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { QrCode, Upload } from "lucide-react"
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

const routeLabels: Record<string, string> = {
  '/': 'Home',
  '/dashboard': 'Dashboard',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/activity': 'Recent Activity',
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
  '/lists': 'Lists',
  '/lists/assets': 'Assets List',
  '/lists/maintenances': 'Maintenances List',
  '/lists/warranties': 'Warranties List',
  '/tools': 'Tools',
  '/tools/media': 'Media',
  '/tools/trash': 'Trash',
  '/tools/import': 'Import',
  '/tools/export': 'Export',
  '/settings': 'Settings',
  '/settings/users': 'Users',
  '/settings/categories': 'Categories',
  '/settings/password': 'Password',
  '/employees': 'Employees',
  '/reports': 'Reports',
  '/reports/assets': 'Asset Reports',
}

function generateBreadcrumbs(pathname: string) {
  const paths = pathname.split('/').filter(Boolean)
  const breadcrumbs = []

  // Build breadcrumb trail
  let currentPath = ''
  paths.forEach((segment, index) => {
    currentPath += `/${segment}`
    const isLast = index === paths.length - 1
    const label = routeLabels[currentPath] || segment.charAt(0).toUpperCase() + segment.slice(1)
    
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
  const { hasPermission } = usePermissions()
  const canViewAssets = hasPermission('canViewAssets')
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [scannedAsset, setScannedAsset] = useState<Asset | null>(null)
  const [isLoadingAsset, setIsLoadingAsset] = useState(false)
  const [scanMode, setScanMode] = useState<'camera' | 'upload'>('camera')
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
      const response = await fetch(`/api/assets?search=${encodeURIComponent(assetTagId)}`)
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
    <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 border-b bg-background">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
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
            className="hover:bg-transparent!"
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Scan QR Code to View Asset Details</DialogTitle>
            <DialogDescription>
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

            {/* Asset Details */}
            {scannedAsset && !isLoadingAsset && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h3 className="text-lg font-semibold">{scannedAsset.assetTagId}</h3>
                    <p className="text-sm text-muted-foreground">{scannedAsset.description}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>
            )}
          </div>

          <DialogFooter>
            {scannedAsset && (
              <Button
                variant="outline"
                onClick={() => {
                  setScannedAsset(null)
                  lastScannedCodeRef.current = null
                  if (scanTimeoutRef.current) {
                    clearTimeout(scanTimeoutRef.current)
                  }
                }}
              >
                Scan Another
              </Button>
            )}
            <Button variant="outline" onClick={() => {
              setQrDialogOpen(false)
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

