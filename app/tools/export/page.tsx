'use client'

import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { usePermissions } from '@/hooks/use-permissions'
import { useAssets, Asset } from '@/hooks/use-assets'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, History, FileDown, Trash2, MoreHorizontal, Package, RefreshCw, FileSpreadsheet, Layers, Database, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { ExportFieldsDialog } from '@/components/dialogs/export-fields-dialog'
import { DeleteConfirmationDialog } from '@/components/dialogs/delete-confirmation-dialog'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { useMobileDock } from '@/components/mobile-dock-provider'
import { useIsMobile } from '@/hooks/use-mobile'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

const ALL_COLUMNS = [
  { key: 'assetTag', label: 'Asset Tag ID' },
  { key: 'description', label: 'Description' },
  { key: 'purchasedFrom', label: 'Purchased From' },
  { key: 'purchaseDate', label: 'Purchase Date' },
  { key: 'brand', label: 'Brand' },
  { key: 'cost', label: 'Cost' },
  { key: 'model', label: 'Model' },
  { key: 'serialNo', label: 'Serial No' },
  { key: 'additionalInformation', label: 'Additional Information' },
  { key: 'xeroAssetNo', label: 'Xero Asset No.' },
  { key: 'owner', label: 'Owner' },
  { key: 'subCategory', label: 'Sub Category' },
  { key: 'pbiNumber', label: 'PBI Number' },
  { key: 'status', label: 'Status' },
  { key: 'issuedTo', label: 'Issued To' },
  { key: 'poNumber', label: 'PO Number' },
  { key: 'paymentVoucherNumber', label: 'Payment Voucher Number' },
  { key: 'assetType', label: 'Asset Type' },
  { key: 'deliveryDate', label: 'Delivery Date' },
  { key: 'unaccountedInventory', label: 'Unaccounted Inventory' },
  { key: 'remarks', label: 'Remarks' },
  { key: 'qr', label: 'QR' },
  { key: 'oldAssetTag', label: 'Old Asset Tag' },
  { key: 'depreciableAsset', label: 'Depreciable Asset' },
  { key: 'depreciableCost', label: 'Depreciable Cost' },
  { key: 'salvageValue', label: 'Salvage Value' },
  { key: 'assetLifeMonths', label: 'Asset Life (months)' },
  { key: 'depreciationMethod', label: 'Depreciation Method' },
  { key: 'dateAcquired', label: 'Date Acquired' },
  { key: 'category', label: 'Category' },
  { key: 'department', label: 'Department' },
  { key: 'site', label: 'Site' },
  { key: 'location', label: 'Location' },
  { key: 'checkoutDate', label: 'Checkout Date' },
  { key: 'expectedReturnDate', label: 'Expected Return Date' },
  { key: 'lastAuditDate', label: 'Last Audit Date' },
  { key: 'lastAuditType', label: 'Last Audit Type' },
  { key: 'lastAuditor', label: 'Last Auditor' },
  { key: 'auditCount', label: 'Audit Count' },
  { key: 'images', label: 'Images' },
  { key: 'documents', label: 'Documents' },
]

const formatDate = (dateValue: string | Date | null | undefined): string => {
  if (!dateValue) return '-'
  try {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue)
    return date.toLocaleDateString()
  } catch {
    return String(dateValue)
  }
}

const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-'
  // Format with 2 decimal places and comma separators
  return Number(value).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

const getCellValue = (asset: Asset, columnKey: string): string | number => {
  switch (columnKey) {
    case 'assetTag':
      return asset.assetTagId
    case 'description':
      return asset.description
    case 'purchasedFrom':
      return asset.purchasedFrom || '-'
    case 'purchaseDate':
      return formatDate(asset.purchaseDate)
    case 'brand':
      return asset.brand || '-'
    case 'cost':
      // Return formatted number with 2 decimal places and comma separators
      return formatNumber(asset.cost)
    case 'model':
      return asset.model || '-'
    case 'serialNo':
      return asset.serialNo || '-'
    case 'additionalInformation':
      return asset.additionalInformation || '-'
    case 'xeroAssetNo':
      return asset.xeroAssetNo || '-'
    case 'owner':
      return asset.owner || '-'
    case 'subCategory':
      return asset.subCategory?.name || '-'
    case 'pbiNumber':
      return asset.pbiNumber || '-'
    case 'status':
      return asset.status || '-'
    case 'issuedTo':
      return asset.issuedTo || '-'
    case 'poNumber':
      return asset.poNumber || '-'
    case 'paymentVoucherNumber':
      return asset.paymentVoucherNumber || '-'
    case 'assetType':
      return asset.assetType || '-'
    case 'deliveryDate':
      return formatDate(asset.deliveryDate)
    case 'unaccountedInventory':
      return asset.unaccountedInventory ? 'Yes' : 'No'
    case 'remarks':
      return asset.remarks || '-'
    case 'qr':
      return asset.qr || '-'
    case 'oldAssetTag':
      return asset.oldAssetTag || '-'
    case 'depreciableAsset':
      return asset.depreciableAsset ? 'Yes' : 'No'
    case 'depreciableCost':
      // Return formatted number with 2 decimal places and comma separators
      return formatNumber(asset.depreciableCost)
    case 'salvageValue':
      // Return formatted number with 2 decimal places and comma separators
      return formatNumber(asset.salvageValue)
    case 'assetLifeMonths':
      return asset.assetLifeMonths?.toString() || '-'
    case 'depreciationMethod':
      return asset.depreciationMethod || '-'
    case 'dateAcquired':
      return formatDate(asset.dateAcquired)
    case 'category':
      return asset.category?.name || '-'
    case 'department':
      return asset.department || '-'
    case 'site':
      return asset.site || '-'
    case 'location':
      return asset.location || '-'
    case 'checkoutDate':
      return formatDate(asset.checkouts?.[0]?.checkoutDate || null)
    case 'expectedReturnDate':
      return formatDate(asset.checkouts?.[0]?.expectedReturnDate || null)
    case 'lastAuditDate':
      const lastAudit = asset.auditHistory?.[0]
      if (!lastAudit?.auditDate) return '-'
      try {
        const date = lastAudit.auditDate instanceof Date 
          ? lastAudit.auditDate 
          : new Date(lastAudit.auditDate)
        return date.toLocaleDateString()
      } catch {
        return '-'
      }
    case 'lastAuditType':
      return asset.auditHistory?.[0]?.auditType || '-'
    case 'lastAuditor':
      return asset.auditHistory?.[0]?.auditor || '-'
    case 'auditCount':
      return (asset.auditHistory?.length || 0).toString()
    case 'images':
      // Images will be fetched separately and added to asset
      const imageValue = (asset as Asset & { images?: string }).images
      return imageValue !== undefined && imageValue !== null ? imageValue : '-'
    case 'documents':
      // Documents will be fetched separately and added to asset
      const documentValue = (asset as Asset & { documents?: string }).documents
      return documentValue !== undefined && documentValue !== null ? documentValue : '-'
    default:
      return '-'
  }
}

export default function ExportPage() {
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canManageExport = hasPermission('canManageExport')
  const canViewAssets = hasPermission('canViewAssets')
  const isMobile = useIsMobile()
  const { setDockContent } = useMobileDock()
  
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [selectedExportFields, setSelectedExportFields] = useState<Set<string>>(
    new Set(['assetTag', 'description', 'category', 'subCategory', 'status', 'location', 'issuedTo'])
  )
  const [historyPage, setHistoryPage] = useState(1)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedHistory, setSelectedHistory] = useState<FileHistory | null>(null)
  const [isManualRefresh, setIsManualRefresh] = useState(false)
  const isInitialMount = useRef(true)

  interface FileHistory {
    id: string
    operationType: 'import' | 'export'
    fileName: string
    filePath: string | null
    fileSize: number | null
    recordsExported: number | null
    fieldsExported: number | null
    status: 'success' | 'failed' | 'partial'
    userId: string
    userEmail: string | null
    createdAt: string
  }

  async function fetchExportHistory(page: number = 1) {
    const response = await fetch(`/api/file-history?operationType=export&page=${page}&pageSize=10`)
    if (!response.ok) throw new Error('Failed to fetch history')
    return response.json()
  }

  // Fetch export history
  const { data: historyData, isLoading: historyLoading, isFetching: isHistoryFetching, refetch: refetchHistory } = useQuery({
    queryKey: ['exportHistory', historyPage],
    queryFn: () => fetchExportHistory(historyPage),
    enabled: !permissionsLoading && canViewAssets,
    staleTime: 30000, // Cache for 30 seconds
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on mount if data exists
    placeholderData: (previousData: { fileHistory: FileHistory[], pagination: { total: number, page: number, pageSize: number, totalPages: number } } | undefined) => previousData,
  })

  // Reset manual refresh flag after successful fetch
  useEffect(() => {
    if (!isHistoryFetching && isManualRefresh) {
      setIsManualRefresh(false)
    }
  }, [isHistoryFetching, isManualRefresh])

  // Track initial mount for animations
  useEffect(() => {
    if (isInitialMount.current && historyData?.fileHistory && historyData.fileHistory.length > 0) {
      const timer = setTimeout(() => {
        isInitialMount.current = false
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [historyData])

  const queryClient = useQueryClient()

  // Delete file history mutation
  const deleteMutation = useMutation({
    mutationFn: async (historyId: string) => {
      const response = await fetch(`/api/file-history/${historyId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete export record')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exportHistory'] })
      toast.success('Export record deleted successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete export record')
    },
  })

  const handleDelete = (history: FileHistory) => {
    setSelectedHistory(history)
    setIsDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (selectedHistory) {
      deleteMutation.mutate(selectedHistory.id)
      setIsDeleteDialogOpen(false)
    }
  }
  
  // Fetch all assets for export using the useAssets hook
  const { data, isLoading: assetsLoading } = useAssets(
    !permissionsLoading && canViewAssets, // enabled
    undefined, // search
    undefined, // category
    undefined, // status
    1, // page
    10000 // pageSize
  )

  // Set mobile dock content
  useEffect(() => {
    if (isMobile) {
      setDockContent(
        <>
          <Button 
            onClick={() => {
              if (!canManageExport) {
                toast.error('You do not have permission to export assets')
                return
              }
              setIsExportDialogOpen(true)
            }}
            variant="outline"
            size="lg"
            className="rounded-full btn-glass-elevated"
            disabled={permissionsLoading || !canViewAssets || assetsLoading}
          >
            <Download className="mr-2 h-4 w-4" />
            Configure & Export
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setIsManualRefresh(true)
              refetchHistory()
            }}
            disabled={isHistoryFetching || historyLoading}
            className="h-10 w-10 rounded-full btn-glass-elevated"
            title="Refresh history"
          >
            <RefreshCw className={`h-4 w-4 ${isHistoryFetching ? 'animate-spin' : ''}`} />
          </Button>
        </>
      )
    } else {
      setDockContent(null)
    }
    
    return () => {
      setDockContent(null)
    }
  }, [isMobile, setDockContent, canManageExport, permissionsLoading, canViewAssets, assetsLoading, setIsExportDialogOpen, isHistoryFetching, historyLoading, refetchHistory, setIsManualRefresh])

  const handleFieldToggle = (fieldKey: string) => {
    setSelectedExportFields(prev => {
      const newSet = new Set(prev)
      if (newSet.has(fieldKey)) {
        newSet.delete(fieldKey)
      } else {
        newSet.add(fieldKey)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    setSelectedExportFields(new Set(ALL_COLUMNS.map(c => c.key)))
  }

  const handleDeselectAll = () => {
    setSelectedExportFields(new Set())
  }

  const handleExport = async () => {
    if (!canManageExport) {
      toast.error('You do not have permission to export assets')
      return
    }

    if (selectedExportFields.size === 0) {
      toast.error('Please select at least one field to export')
      setIsExportDialogOpen(true)
      return
    }

    if (!data?.assets) {
      toast.error('No assets available to export')
      return
    }

    setIsExporting(true)

    try {
      let assetsToExport = data.assets
      
      // If images column is selected, fetch image URLs for all assets
      if (selectedExportFields.has('images')) {
        const assetTagIds = assetsToExport.map(a => a.assetTagId)
        try {
          const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
            ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
            : ''
          const url = `${baseUrl}/api/assets/images/bulk?assetTagIds=${assetTagIds.join(',')}`
          
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
          
          const imagesResponse = await fetch(url, {
            headers,
            credentials: 'include',
          })
          if (imagesResponse.ok) {
            const imagesData = await imagesResponse.json()
            // Create a map of assetTagId to comma-separated image URLs
            const imageUrlMap = new Map<string, string>()
            if (Array.isArray(imagesData)) {
            imagesData.forEach((item: { assetTagId: string; images: Array<{ imageUrl: string }> }) => {
                if (item && item.assetTagId && item.images && Array.isArray(item.images)) {
                  const urls = item.images
                    .map((img: { imageUrl: string }) => img?.imageUrl)
                    .filter((url: string | undefined): url is string => !!url)
                    .join(', ')
                  // Always set in map, even if empty (so we know the asset was processed)
              imageUrlMap.set(item.assetTagId, urls)
                }
            })
            }
            // Add images to each asset - preserve existing properties
            // Always set images property, even if empty string
            assetsToExport = assetsToExport.map(asset => {
              const imageUrls = imageUrlMap.get(asset.assetTagId) ?? ''
              const result = {
              ...asset,
                images: imageUrls,
              }
              return result
            })
          }
        } catch (error) {
          console.warn('Failed to fetch images for export:', error)
        }
      }

      // If documents column is selected, fetch document URLs for all assets
      if (selectedExportFields.has('documents')) {
        const assetTagIds = assetsToExport.map(a => a.assetTagId)
        try {
          const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
            ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
            : ''
          const url = `${baseUrl}/api/assets/documents/bulk?assetTagIds=${assetTagIds.join(',')}`
          
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
          
          const documentsResponse = await fetch(url, {
            headers,
            credentials: 'include',
          })
          if (documentsResponse.ok) {
            const documentsData = await documentsResponse.json()
            // Create a map of assetTagId to comma-separated document URLs
            const documentUrlMap = new Map<string, string>()
            if (Array.isArray(documentsData)) {
              documentsData.forEach((item: { assetTagId: string; documents: Array<{ documentUrl?: string }> }) => {
                if (item && item.assetTagId && item.documents && Array.isArray(item.documents)) {
                  const urls = item.documents
                    .map((doc: { documentUrl?: string }) => doc?.documentUrl)
                    .filter((url: string | undefined): url is string => !!url)
                    .join(', ')
                  // Always set in map, even if empty (so we know the asset was processed)
                  documentUrlMap.set(item.assetTagId, urls)
                }
              })
            }
            // Add documents to each asset - preserve existing properties including images
            // Always set documents property, even if empty string
            assetsToExport = assetsToExport.map((asset: Asset & { images?: string }) => {
              const documentUrls = documentUrlMap.get(asset.assetTagId) ?? ''
              const result = {
                ...asset,
                documents: documentUrls,
              } as Asset & { images?: string; documents: string }
              return result
            })
          }
        } catch (error) {
          console.warn('Failed to fetch documents for export:', error)
        }
      }
      
      // Use selected export fields
      const fieldsToExport = Array.from(selectedExportFields)
      
      // Map selected fields to header names
      const headers = fieldsToExport.map(key => {
        const column = ALL_COLUMNS.find(c => c.key === key)
        return column ? column.label : key
      })
      
      // Create data rows
      const rows = assetsToExport.map((asset: Asset & { images?: string; documents?: string }) => 
        fieldsToExport.map(key => {
          const value = getCellValue(asset, key)
          return value
        })
      )
      
      // Create worksheet
      const wsData = [headers, ...rows]
      const ws = XLSX.utils.aoa_to_sheet(wsData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Assets')
      
      // Generate Excel file
      const fileName = `assets-${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, fileName)
      
      // Convert workbook to buffer for storage upload
      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
      const file = new File([excelBuffer], fileName, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      
      // Upload file to Supabase storage
      let filePath: string | null = null
      try {
        const uploadFormData = new FormData()
        uploadFormData.append('file', file)
        uploadFormData.append('operationType', 'export')
        
        const uploadResponse = await fetch('/api/file-history/upload', {
          method: 'POST',
          body: uploadFormData,
        })
        
        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json()
          filePath = uploadData.filePath
        } else {
          console.warn('Failed to upload file to storage, continuing...')
        }
      } catch (uploadError) {
        console.error('Upload error:', uploadError)
      }
      
      // Save file history
      try {
        await fetch('/api/file-history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            operationType: 'export',
            fileName: fileName,
            filePath: filePath,
            fileSize: excelBuffer.length,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            recordsExported: assetsToExport.length,
            fieldsExported: fieldsToExport.length,
            status: 'success',
          }),
        })
      } catch (historyError) {
        console.error('Failed to save file history:', historyError)
      }
      
      // Refresh history
      queryClient.invalidateQueries({ queryKey: ['exportHistory'] })
      
      toast.success(`Successfully exported ${assetsToExport.length} asset(s) with ${selectedExportFields.size} field(s)`)
      setIsExportDialogOpen(false)
    } catch (error) {
      console.error('Export error:', error)
      
      // Save failed file history
      try {
        await fetch('/api/file-history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            operationType: 'export',
            fileName: `assets-${new Date().toISOString().split('T')[0]}.xlsx`,
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
          }),
        })
      } catch (historyError) {
        console.error('Failed to save file history:', historyError)
      }
      
      toast.error('Failed to export assets')
    } finally {
      setIsExporting(false)
    }
  }

  if (!canViewAssets && !permissionsLoading) {
    return (
      <div className="space-y-6 h-[60vh] flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center max-w-md">
          <div className="p-4 rounded-full bg-muted/50">
            <Package className="h-12 w-12 text-muted-foreground opacity-50" />
          </div>
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">
            You do not have permission to view export history. Please contact your administrator.
          </p>
        </div>
      </div>
    )
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-3xl font-bold">Export Assets</h1>
        <p className="text-muted-foreground">
          Export asset data to Excel format with custom field selection
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Export Configuration
            </CardTitle>
            <CardDescription>
              Select which fields to include in your export and download the data as an Excel file
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className={cn("grid gap-4", isMobile ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-3 md:grid-cols-2 xl:grid-cols-3")}>
              <div className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm flex flex-col gap-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Database className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-medium uppercase">Available Assets</span>
                </div>
                <div className="text-2xl font-bold">
                  {permissionsLoading || assetsLoading ? (
                    <Spinner className="h-6 w-6" />
                  ) : (
                    data?.assets.length || 0
                  )}
                </div>
              </div>
              
              <div className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm flex flex-col gap-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Layers className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-medium uppercase">Selected Fields</span>
                </div>
                <div className="text-2xl font-bold">
                  {selectedExportFields.size}
                </div>
              </div>

              <div className={cn("p-3 sm:p-4 md:col-span-2 xl:col-span-1 rounded-lg border bg-muted/30 flex items-center justify-center", isMobile && "hidden")}>
                <Button 
                  onClick={() => {
                    if (!canManageExport) {
                      toast.error('You do not have permission to export assets')
                      return
                    }
                    setIsExportDialogOpen(true)
                  }}
                  className="w-full h-full min-h-[60px] sm:min-h-[80px] text-xs sm:text-sm md:text-base px-2 sm:px-3 md:px-4 py-2 sm:py-3 flex items-center justify-center gap-1.5 sm:gap-2 whitespace-normal!"
                  disabled={permissionsLoading || !canViewAssets || assetsLoading}
                >
                  <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 shrink-0" />
                  <span className="text-center leading-tight">Configure & Export</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-1 flex flex-col">
          <CardHeader>
            <CardTitle className="text-lg">Quick Tips</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 text-sm text-muted-foreground space-y-3">
            <p>• Exports include all currently filtered assets.</p>
            <p>• Large exports may take a few moments to generate.</p>
          </CardContent>
        </Card>
      </div>

      <ExportFieldsDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        fields={ALL_COLUMNS}
        selectedFields={selectedExportFields}
        onFieldToggle={handleFieldToggle}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        onExport={handleExport}
        isExporting={isExporting}
      />

      {/* Export History */}
      <Card className='pb-0'>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Export History
              </CardTitle>
              <CardDescription className="mt-1.5">
                Recent export operations and their status
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setIsManualRefresh(true)
                refetchHistory()
              }}
              disabled={isHistoryFetching || historyLoading}
              className="h-8 w-8"
              title="Refresh history"
            >
              <RefreshCw className={`h-4 w-4 ${isHistoryFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 relative">
          {/* Glass effect overlay when fetching */}
          {isHistoryFetching && historyData?.fileHistory && historyData.fileHistory.length > 0 && (
            <div className={cn("absolute left-0 right-[10px] top-0 bottom-0 bg-background/50 backdrop-blur-sm z-20 flex items-center justify-center", isMobile && "right-0 rounded-b-2xl")}>
              <Spinner variant="default" size={24} className="text-muted-foreground" />
            </div>
          )}

          {permissionsLoading || historyLoading ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-center gap-3">
              <Spinner className="h-8 w-8" />
              <p className="text-sm text-muted-foreground animate-pulse">Loading history...</p>
            </div>
          ) : !historyData?.fileHistory || historyData.fileHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-center text-muted-foreground gap-2">
              <div className="p-4 rounded-full bg-muted/50 mb-2">
                <History className="h-8 w-8 opacity-50" />
              </div>
              <p className="font-medium">No export history found</p>
              <p className="text-sm">Your recent exports will appear here</p>
            </div>
          ) : (
            <>
              <ScrollArea className="h-[400px]">
                <div className="sticky top-0 z-30 h-px bg-border w-full"></div>
                <div className="pr-2.5 relative after:content-[''] after:absolute after:right-[10px] after:top-0 after:bottom-0 after:w-px after:bg-border after:z-50 after:h-full">
                  <Table className="border-b">
                    <TableHeader className="sticky -top-1 z-20 bg-card [&_tr]:border-b-0 -mr-2.5">
                      <TableRow className="group hover:bg-muted/50 relative border-b-0 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-[1.5px] after:h-px after:bg-border after:z-30">
                        <TableHead className="w-[250px] bg-card transition-colors group-hover:bg-muted/50">File Name</TableHead>
                        <TableHead className="bg-card transition-colors group-hover:bg-muted/50">Records</TableHead>
                        <TableHead className="bg-card transition-colors group-hover:bg-muted/50">Status</TableHead>
                        <TableHead className="bg-card transition-colors group-hover:bg-muted/50">Exported By</TableHead>
                        <TableHead className="bg-card transition-colors group-hover:bg-muted/50">Date</TableHead>
                        <TableHead className="text-center sticky z-10 right-0 bg-card group-hover:bg-card before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border before:z-50">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    <AnimatePresence mode='popLayout'>
                      {historyData.fileHistory.map((history: FileHistory, index: number) => (
                        <motion.tr
                          key={history.id}
                          layout
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ 
                            duration: 0.2, 
                            delay: isInitialMount.current ? index * 0.05 : 0 
                          }}
                          className="group hover:bg-muted/50 border-b transition-colors"
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <div className="p-2 rounded-md bg-primary/10 text-primary">
                                <FileDown className="h-4 w-4" />
                              </div>
                              {history.fileName}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{history.recordsExported || 0} rows</span>
                              <span className="text-xs text-muted-foreground">{history.fieldsExported || 0} fields</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {history.status === 'success' ? (
                              <div className="flex items-center gap-1.5 text-green-600">
                                <CheckCircle2 className="h-4 w-4" />
                              </div>
                            ) : history.status === 'partial' ? (
                              <div className="flex items-center gap-1.5 text-yellow-600">
                                <AlertCircle className="h-4 w-4" />
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-red-600">
                                <XCircle className="h-4 w-4" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            <div className="flex items-center gap-2 text-sm">
                              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                                {(history.userEmail || '?')[0].toUpperCase()}
                              </div>
                              <span className="truncate max-w-[150px]" title={history.userEmail || 'Unknown'}>
                                {history.userEmail || 'Unknown'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {format(new Date(history.createdAt), 'MMM dd, yyyy HH:mm')}
                          </TableCell>
                          <TableCell className={cn("sticky text-center right-0 bg-card z-10 before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border before:z-50")}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {history.status === 'success' && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      if (!canManageExport) {
                                        toast.error('You do not have permission to download export files')
                                        return
                                      }
                                      const link = document.createElement('a')
                                      link.href = `/api/file-history/${history.id}/download`
                                      link.download = history.fileName
                                      document.body.appendChild(link)
                                      link.click()
                                      document.body.removeChild(link)
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <Download className="mr-2 h-4 w-4" />
                                    Download
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => {
                                    if (!canManageExport) {
                                      toast.error('You do not have permission to delete export history')
                                      return
                                    }
                                    handleDelete(history)
                                  }}
                                  disabled={deleteMutation.isPending}
                                  className="text-destructive focus:text-destructive cursor-pointer"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </TableBody>
                </Table>
                </div>
                <ScrollBar orientation="horizontal" />
                <ScrollBar orientation="vertical" className='z-50' />
              </ScrollArea>
              
              {/* Pagination */}
              {historyData?.pagination && historyData.pagination.totalPages > 1 && (
                <div className="border-t bg-card/50 backdrop-blur-sm py-3 px-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm text-muted-foreground">
                      Page {historyData.pagination.page} of {historyData.pagination.totalPages}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                        disabled={historyPage === 1 || isHistoryFetching}
                        className="h-8"
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setHistoryPage(p => Math.min(historyData.pagination.totalPages, p + 1))}
                        disabled={historyPage === historyData.pagination.totalPages || isHistoryFetching}
                        className="h-8"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Delete Export Record"
        description={
          selectedHistory
            ? `Are you sure you want to delete "${selectedHistory.fileName}"? This will permanently remove this export. This action cannot be undone.`
            : 'Are you sure you want to delete this export? This will permanently remove it. This action cannot be undone.'
        }
        isLoading={deleteMutation.isPending}
      />
    </motion.div>
  )
}

