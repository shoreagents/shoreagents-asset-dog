'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/use-permissions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, History, Download, MoreHorizontal, Trash2, RefreshCw, CheckCircle2, XCircle, AlertCircle, FileUp, FileType, Info, Package } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
// Use xlsx-js-style for styling support (drop-in replacement for xlsx)
import * as XLSX from 'xlsx-js-style'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { format } from 'date-fns'
import { ExportFieldsDialog } from '@/components/dialogs/export-fields-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DeleteConfirmationDialog } from '@/components/dialogs/delete-confirmation-dialog'
import { cn } from '@/lib/utils'
import { useMobileDock } from '@/components/mobile-dock-provider'
import { useIsMobile } from '@/hooks/use-mobile'
import { is } from 'date-fns/locale'

interface FileHistory {
  id: string
  operationType: 'import' | 'export'
  fileName: string
  fileSize: number | null
  recordsProcessed: number | null
  recordsCreated: number | null
  recordsSkipped: number | null
  recordsFailed: number | null
  status: 'success' | 'failed' | 'partial'
  userId: string
  userEmail: string | null
  createdAt: string
}

interface ImportHistoryResponse {
  fileHistory: FileHistory[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

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
]

async function fetchImportHistory(page: number = 1) {
  const response = await fetch(`/api/file-history?operationType=import&page=${page}&pageSize=10`)
  if (!response.ok) throw new Error('Failed to fetch history')
  return response.json()
}

export default function ImportPage() {
  const router = useRouter()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canManageImport = hasPermission('canManageImport')
  const canViewAssets = hasPermission('canViewAssets')
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isInitialMount = useRef(true)
  const isMobile = useIsMobile()
  const { setDockContent } = useMobileDock()
  const [historyPage, setHistoryPage] = useState(1)
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)
  const [selectedTemplateFields, setSelectedTemplateFields] = useState<Set<string>>(
    new Set(['assetTag', 'description', 'category', 'subCategory', 'status', 'location', 'issuedTo'])
  )
  const [isDragging, setIsDragging] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedHistory, setSelectedHistory] = useState<FileHistory | null>(null)

  useEffect(() => {
    isInitialMount.current = false
  }, [])

  // Fetch import history
  const { data: historyData, isLoading: historyLoading, isFetching: isHistoryFetching, refetch: refetchHistory } = useQuery<ImportHistoryResponse>({
    queryKey: ['importHistory', historyPage],
    queryFn: () => fetchImportHistory(historyPage),
    enabled: !permissionsLoading && canViewAssets,
    staleTime: 30000, // Cache for 30 seconds
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on mount if data exists
    placeholderData: (previousData) => previousData,
  })

  // Set mobile dock content
  useEffect(() => {
    if (isMobile) {
      setDockContent(
        <>
          <Button
            variant="outline"
            size="lg"
            className="rounded-full btn-glass-elevated"
            disabled={permissionsLoading || !canViewAssets}
            onClick={(e) => {
              e.stopPropagation()
              if (!canManageImport) {
                toast.error('You do not have permission to import assets')
                return
              }
              fileInputRef.current?.click()
            }}
          >
            <Upload className="mr-2 h-4 w-4" />
            Select File
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              refetchHistory()
            }}
            disabled={isHistoryFetching || historyLoading}
            className="h-10 w-10 rounded-full btn-glass-elevated"
            title="Refresh history"
          >
            <RefreshCw className={cn("h-4 w-4", isHistoryFetching && "animate-spin")} />
          </Button>
        </>
      )
    } else {
      setDockContent(null)
    }
    
    return () => {
      setDockContent(null)
    }
  }, [isMobile, setDockContent, canManageImport, permissionsLoading, canViewAssets, isHistoryFetching, historyLoading, refetchHistory])

  // Delete file history mutation
  const deleteMutation = useMutation({
    mutationFn: async (historyId: string) => {
      const response = await fetch(`/api/file-history/${historyId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete import record')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['importHistory'] })
      toast.success('Import record deleted successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete import record')
    },
  })

  const handleDelete = (history: FileHistory) => {
    if (!canManageImport) {
      toast.error('You do not have permission to delete import history')
      return
    }
    setSelectedHistory(history)
    setIsDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (selectedHistory) {
      deleteMutation.mutate(selectedHistory.id)
      setIsDeleteDialogOpen(false)
    }
  }

  // Handle template field selection
  const handleTemplateFieldToggle = (fieldKey: string) => {
    setSelectedTemplateFields(prev => {
      const newSet = new Set(prev)
      // Always keep assetTag as it's required
      if (fieldKey === 'assetTag') return prev
      if (newSet.has(fieldKey)) {
        newSet.delete(fieldKey)
      } else {
        newSet.add(fieldKey)
      }
      return newSet
    })
  }

  const handleTemplateSelectAll = () => {
    setSelectedTemplateFields(new Set(ALL_COLUMNS.map(c => c.key)))
  }

  const handleTemplateDeselectAll = () => {
    // Always keep assetTag as it's required
    setSelectedTemplateFields(new Set(['assetTag']))
  }

  // Sample data mapping for each field
  const getSampleData = (fieldKey: string): string => {
    const sampleDataMap: Record<string, string> = {
      assetTag: '12-345678U-SA',
      description: 'Sample Asset Description',
      purchasedFrom: 'Sample Vendor Inc.',
      purchaseDate: '2024-01-15',
      brand: 'Sample Brand',
      cost: '1000.00',
      model: 'Model-XYZ',
      serialNo: 'SN123456789',
      additionalInformation: 'Additional details here',
      xeroAssetNo: 'XERO-001',
      owner: 'John Doe',
      subCategory: 'Laptop',
      pbiNumber: 'PBI-001',
      status: 'Available',
      issuedTo: 'Jane Smith',
      poNumber: 'PO-2024-001',
      paymentVoucherNumber: 'PV-2024-001',
      assetType: 'Equipment',
      deliveryDate: '2024-01-20',
      unaccountedInventory: 'No',
      remarks: 'Sample remarks',
      qr: 'QR123456',
      oldAssetTag: 'OLD-001',
      depreciableAsset: 'Yes',
      depreciableCost: '1000.00',
      salvageValue: '100.00',
      assetLifeMonths: '36',
      depreciationMethod: 'Straight Line',
      dateAcquired: '2024-01-15',
      category: 'IT Equipment',
      department: 'IT Department',
      site: 'Main Office',
      location: 'Building A, Floor 2',
      checkoutDate: '2024-02-01',
      expectedReturnDate: '2024-02-15',
      lastAuditDate: '2024-01-10',
      lastAuditType: 'Physical',
      lastAuditor: 'Auditor Name',
      auditCount: '1',
      images: 'image1.jpg, image2.jpg',
    }
    return sampleDataMap[fieldKey] || ''
  }

  // Download template with selected columns
  const handleDownloadTemplate = () => {
    try {
      // Ensure assetTag is always included
      const fieldsToInclude = Array.from(selectedTemplateFields)
      if (!fieldsToInclude.includes('assetTag')) {
        fieldsToInclude.unshift('assetTag')
      }

      // Map selected fields to header names
      const headers = fieldsToInclude.map(key => {
        const column = ALL_COLUMNS.find(c => c.key === key)
        return column ? column.label : key
      })

      // Create sample data row
      const sampleRow = fieldsToInclude.map(key => getSampleData(key))

      // Create worksheet with headers and sample data
      const wsData = [headers, sampleRow]
      const ws = XLSX.utils.aoa_to_sheet(wsData)

      // Make header row bold using xlsx-js-style
      const headerRange = XLSX.utils.decode_range(ws['!ref'] || 'A1')
      for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
        if (!ws[cellAddress]) continue
        
        // Set cell style with bold font
        ws[cellAddress].s = {
          font: { bold: true },
          alignment: { horizontal: 'left', vertical: 'top' },
        }
      }

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Assets')

      // Generate Excel file with cell styles enabled
      const fileName = `asset-import-template-${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, fileName, { cellStyles: true })

      toast.success(`Template downloaded with ${fieldsToInclude.length} column(s)`)
      setIsTemplateDialogOpen(false)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to download template'
      toast.error(errorMessage)
    }
  }

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      // Check if file is a valid type
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'application/vnd.ms-excel', // .xls
        'text/csv', // .csv
      ]
      const validExtensions = ['.xlsx', '.xls', '.csv']
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
      
      if (validTypes.includes(file.type) || validExtensions.includes(fileExtension)) {
        processImportFile(file)
      } else {
        toast.error('Invalid file type. Please upload .xlsx, .xls, or .csv files only.')
      }
    }
  }

  // Process import file (used by both file input and drag & drop)
  const processImportFile = async (file: File) => {
    if (!file) return
    
    if (!canManageImport) {
      toast.error('You do not have permission to import assets')
      return
    }
    
    let filePath: string | null = null
    
    try {
      // Upload file to Supabase storage first
      const uploadFormData = new FormData()
      uploadFormData.append('file', file)
      uploadFormData.append('operationType', 'import')
      
      const uploadResponse = await fetch('/api/file-history/upload', {
        method: 'POST',
        body: uploadFormData,
      })
      
      if (uploadResponse.ok) {
        const uploadData = await uploadResponse.json()
        filePath = uploadData.filePath
      } else {
        console.warn('Failed to upload file to storage, continuing with import...')
      }
      
      // Read file for processing
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const jsonData = XLSX.utils.sheet_to_json(sheet) as Record<string, any>[]
      
      // Helper function to safely parse numbers from Excel
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parseNumber = (value: any): number | null => {
        if (value === null || value === undefined || value === '') {
          return null
        }
        // Handle string values (remove commas, spaces)
        if (typeof value === 'string') {
          const cleaned = value.replace(/,/g, '').trim()
          if (cleaned === '') return null
          const num = parseFloat(cleaned)
          return isNaN(num) ? null : num
        }
        // Handle numeric values
        const num = Number(value)
        return isNaN(num) ? null : num
      }
      
      // Process imported data
      const importedAssets = jsonData.map((row) => {
        // Map Excel column names to asset fields
        // Check both template labels and legacy formats for backward compatibility
        const assetData = {
          assetTagId: row['Asset Tag ID'] || row['assetTagId'] || null,
          description: row['Description'] || '',
          purchasedFrom: row['Purchased From'] || row['Purchased from'] || row['purchasedFrom'] || null,
          purchaseDate: row['Purchase Date'] || row['purchaseDate'] || null,
          brand: row['Brand'] || row['brand'] || null,
          cost: parseNumber(row['Cost'] || row['cost']),
          model: row['Model'] || row['model'] || null,
          serialNo: row['Serial No'] || row['Serial No.'] || row['serialNo'] || null,
          additionalInformation: row['Additional Information'] || row['additionalInformation'] || null,
          xeroAssetNo: row['Xero Asset No.'] || row['Xero Asset No'] || row['xeroAssetNo'] || null,
          owner: row['Owner'] || row['owner'] || null,
          pbiNumber: row['PBI Number'] || row['PBI NUMBER'] || row['pbiNumber'] || null,
          status: row['Status'] || row['status'] || null,
          issuedTo: row['Issued To'] || row['ISSUED TO:'] || row['issuedTo'] || null,
          poNumber: row['PO Number'] || row['PO NUMBER'] || row['poNumber'] || null,
          paymentVoucherNumber: row['Payment Voucher Number'] || row['PAYMENT VOUCHER NUMBER'] || row['paymentVoucherNumber'] || null,
          assetType: row['Asset Type'] || row['ASSET TYPE'] || row['assetType'] || null,
          deliveryDate: row['Delivery Date'] || row['DELIVERY DATE'] || row['deliveryDate'] || null,
          unaccountedInventory: row['Unaccounted Inventory'] || row['UNACCOUNTED INVENTORY'] || row['UNACCOUNTED 2021 INVENTORY'] || row['unaccountedInventory'] || row['unaccounted2021Inventory'] || null,
          remarks: row['Remarks'] || row['REMARKS'] || row['remarks'] || null,
          qr: row['QR'] || row['qr'] || null,
          oldAssetTag: row['Old Asset Tag'] || row['OLD ASSET TAG'] || row['oldAssetTag'] || null,
          depreciableAsset: row['Depreciable Asset'] || row['depreciableAsset'] || null,
          depreciableCost: parseNumber(row['Depreciable Cost'] || row['depreciableCost']),
          salvageValue: parseNumber(row['Salvage Value'] || row['salvageValue']),
          assetLifeMonths: parseNumber(row['Asset Life (months)'] || row['Asset Life (Months)'] || row['assetLifeMonths']),
          depreciationMethod: row['Depreciation Method'] || row['depreciationMethod'] || null,
          dateAcquired: row['Date Acquired'] || row['dateAcquired'] || null,
          category: row['Category'] || row['category'] || null,
          subCategory: row['Sub Category'] || row['SUB-CATEGORY'] || row['subCategory'] || null,
          department: row['Department'] || row['department'] || null,
          site: row['Site'] || row['site'] || null,
          location: row['Location'] || row['location'] || null,
          // Audit fields - these will create audit history records
          lastAuditDate: row['Last Audit Date'] || row['lastAuditDate'] || null,
          lastAuditType: row['Last Audit Type'] || row['lastAuditType'] || null,
          lastAuditor: row['Last Auditor'] || row['lastAuditor'] || null,
          auditCount: row['Audit Count'] || row['auditCount'] || null,
          // Images field - comma or semicolon separated URLs
          images: row['Images'] || row['images'] || null,
        }
        
        return assetData
      })
      
       // Validate data before sending to API to prevent HTTP errors
       // First, check if the file has the required "Asset Tag ID" column at all
       const hasAssetTagColumn = jsonData.length > 0 && (
         jsonData[0]['Asset Tag ID'] !== undefined || 
         jsonData[0]['assetTagId'] !== undefined
       )
       
       if (!hasAssetTagColumn) {
         // Get the actual column names from the first row
         const actualColumns = jsonData.length > 0 ? Object.keys(jsonData[0]) : []
         const actualColumnsList = actualColumns.length > 0 
           ? actualColumns.join(', ') 
           : 'No columns found'
         
         toast.error(
           `Invalid file format: The Excel file does not contain the required "Asset Tag ID" column. Found columns: ${actualColumnsList}. Please ensure your Excel file has the correct column headers matching the asset import template.`,
           { duration: 10000 }
         )
         // Reset file input
         if (fileInputRef.current) {
           fileInputRef.current.value = ''
         }
         return // Stop processing, don't make HTTP request
       }
       
       // If the column exists, check which rows are missing the value
       const invalidRows: number[] = []
       importedAssets.forEach((asset, index) => {
         if (!asset.assetTagId || (typeof asset.assetTagId === 'string' && asset.assetTagId.trim() === '')) {
           invalidRows.push(index + 2) // +2 because row 1 is header
         }
       })
       
       if (invalidRows.length > 0) {
         toast.error(
           `Invalid file format: ${invalidRows.length} row(s) are missing required "Asset Tag ID" field. Please ensure your Excel file has the correct column headers.${invalidRows.length <= 10 ? ` Rows: ${invalidRows.join(', ')}` : ` First 10 rows: ${invalidRows.slice(0, 10).join(', ')}...`}`,
           { duration: 8000 }
         )
         // Reset file input
         if (fileInputRef.current) {
           fileInputRef.current.value = ''
         }
         return // Stop processing, don't make HTTP request
       }
      
      // Remove duplicate rows within the same file (keep first occurrence)
      const uniqueAssets: typeof importedAssets = []
      const seenAssetTags = new Set<string>()
      const duplicateTags: string[] = []
      
      importedAssets.forEach((asset, index) => {
        if (seenAssetTags.has(asset.assetTagId)) {
          duplicateTags.push(`Row ${index + 2}`) // +2 because row 1 is header
        } else {
          seenAssetTags.add(asset.assetTagId)
          uniqueAssets.push(asset)
        }
      })
      
      if (duplicateTags.length > 0) {
        toast.warning(
          `Skipped ${duplicateTags.length} duplicate row(s) within file: ${duplicateTags.slice(0, 5).join(', ')}${duplicateTags.length > 5 ? ` and ${duplicateTags.length - 5} more` : ''}`,
          { duration: 6000 }
        )
      }
      
      const totalAssets = uniqueAssets.length
      let processedCount = 0
      
      const toastId = toast.loading(`Importing assets... 0% (0/${totalAssets})`)
      
      // Import assets in batches to show progress
      const batchSize = 10
      const batches = []
      for (let i = 0; i < uniqueAssets.length; i += batchSize) {
        batches.push(uniqueAssets.slice(i, i + batchSize))
      }
      
      const allResults: Array<{ asset: string; action: string; reason?: string; error?: string }> = []
      
      for (const batch of batches) {
        let response: Response
        try {
          const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
            ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
            : ''
          const url = `${baseUrl}/api/assets/import`
          
          // Get auth token
          const { createClient } = await import('@/lib/supabase-client')
          const supabase = createClient()
          const { data: { session } } = await supabase.auth.getSession()
          const headers: HeadersInit = { 'Content-Type': 'application/json' }
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`
          }
          
          response = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers,
            body: JSON.stringify({ assets: batch }),
          })
        } catch {
          // Network error (not HTTP error)
          toast.dismiss(toastId)
          toast.error('Network error. Please check your connection and try again.')
          throw new Error('Network error occurred')
        }
        
        if (!response.ok) {
          // Handle HTTP errors (400, 500, etc.) gracefully
          let errorData: { error?: string; message?: string; details?: string } = {}
          try {
            errorData = await response.json()
          } catch {
            // If response is not JSON, use status text
            errorData = { error: response.statusText || 'Failed to import assets' }
          }
          
          const errorMessage = errorData.error || errorData.message || 'Failed to import assets'
          const errorDetails = errorData.details
          toast.dismiss(toastId)
          
          // Show error with details if available
          if (errorDetails) {
            toast.error(`${errorMessage} ${errorDetails}`, { duration: 6000 })
          } else {
            toast.error(errorMessage)
          }
          
          // Throw error to stop processing, but don't let it bubble as unhandled
          throw new Error(errorMessage)
        }
        
        const data = await response.json()
        if (data.results) {
          allResults.push(...data.results)
        }
        
        processedCount += batch.length
        const percentage = Math.round((processedCount / totalAssets) * 100)
        
        toast.loading(
          `Importing assets... ${percentage}% (${processedCount}/${totalAssets})`,
          { id: toastId }
        )
      }
      
      // Count successful imports and skipped items
      const createdCount = allResults.filter(r => r.action === 'created').length
      const skippedCount = allResults.filter(r => r.action === 'skipped').length
      const failedCount = allResults.filter(r => r.action === 'failed').length
      const skippedInTrash = allResults.filter(r => r.action === 'skipped' && r.reason === 'Asset exists in trash').length
      const skippedDuplicates = skippedCount - skippedInTrash
      
      toast.dismiss(toastId)
      
      // Save file history
      try {
        await fetch('/api/file-history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            operationType: 'import',
            fileName: file.name,
            filePath: filePath,
            fileSize: file.size,
            mimeType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            recordsProcessed: totalAssets,
            recordsCreated: createdCount,
            recordsSkipped: skippedCount,
            recordsFailed: failedCount,
            status: failedCount > 0 ? 'partial' : (createdCount > 0 ? 'success' : 'failed'),
            errorMessage: failedCount > 0 ? `${failedCount} record(s) failed to import` : null,
            metadata: JSON.stringify({
              duplicateRowsInFile: duplicateTags?.length || 0,
              totalBatches: batches.length,
            }),
          }),
        })
      } catch {
        // Silently fail history save, don't show toast for this
      }
      
      // Show results with distinction between duplicates and trash
      if (skippedCount > 0) {
        let message = `Import complete: ${createdCount} created`
        const skipParts: string[] = []
        if (skippedDuplicates > 0) {
          skipParts.push(`${skippedDuplicates} duplicate${skippedDuplicates !== 1 ? 's' : ''}`)
        }
        if (skippedInTrash > 0) {
          skipParts.push(`${skippedInTrash} in trash`)
        }
        if (skipParts.length > 0) {
          message += `, ${skipParts.join(', ')} skipped`
        }
        
        toast.info(message, { duration: 6000 })
      } else {
        toast.success(`Successfully imported ${createdCount} asset(s)`)
      }
      
      // Show details of skipped items if any
      if (skippedCount > 0) {
        const skippedInTrashAssets = allResults
          .filter(r => r.action === 'skipped' && r.reason === 'Asset exists in trash')
          .map(r => r.asset)
          .slice(0, 5)
        
        const skippedDuplicateAssets = allResults
          .filter(r => r.action === 'skipped' && r.reason !== 'Asset exists in trash')
          .map(r => r.asset)
          .slice(0, 5)
        
          setTimeout(() => {
          if (skippedInTrashAssets.length > 0) {
            toast.warning(
              `Skipped (in trash): ${skippedInTrashAssets.join(', ')}${skippedInTrash > 5 ? ` and ${skippedInTrash - 5} more` : ''}. Permanently delete from trash first if you want to import them as new assets.`,
              { 
                duration: 10000,
                action: (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/tools/trash')}
                  >
                    Go to Trash
                  </Button>
                ),
              }
            )
          }
          if (skippedDuplicateAssets.length > 0) {
            toast.info(
              `Skipped (duplicates): ${skippedDuplicateAssets.join(', ')}${skippedDuplicates > 5 ? ` and ${skippedDuplicates - 5} more` : ''}. These assets already exist.`,
              { duration: 6000 }
            )
          }
          }, 1000)
      }
      
      // Refresh assets and history
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['importHistory'] })
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      toast.dismiss()
      
      // Get error message
      const errorMessage = error instanceof Error ? error.message : 'Failed to import assets'
      
      // Save failed file history
      try {
        await fetch('/api/file-history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            operationType: 'import',
            fileName: file.name,
            filePath: filePath,
            fileSize: file.size,
            mimeType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            status: 'failed',
            errorMessage: errorMessage,
          }),
        })
      } catch {
        // Silently fail history save, don't show toast for this
      }
      
      // Show error toast with the actual error message
      toast.error(errorMessage)
    }
  }

  // Import from Excel/CSV (file input handler)
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    processImportFile(file)
  }

  if (!canViewAssets && !permissionsLoading) {
    return (
      <div className="space-y-6 h-[60vh] flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center max-w-md">
          <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center mb-4">
            <Package className="h-12 w-12 text-muted-foreground opacity-50" />
          </div>
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="text-muted-foreground">
            You do not have permission to view import history. Please contact your administrator.
          </p>
        </div>
      </div>
    )
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-8 max-w-[1600px] mx-auto"
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Import Assets</h1>
        <p className="text-muted-foreground text-lg">
          Bulk import asset data from Excel or CSV files
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="overflow-hidden border-primary/10 shadow-md gap-0">
            <CardHeader className='pb-1'>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <FileUp className="h-5 w-5 text-primary" />
                    Upload File
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Drag and drop or select a file to begin import
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setIsTemplateDialogOpen(true)}
                  size="sm"
                  disabled={permissionsLoading}
                  className="shrink-0 gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary"
                >
                  <Download className="h-4 w-4" />
                  Download Template
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 sm:p-10">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => {
                  if (!canManageImport) {
                    e.preventDefault()
                    toast.error('You do not have permission to import assets')
                    return
                  }
                  handleDrop(e)
                }}
                className={cn(
                  "relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-10 transition-all duration-200 ease-in-out min-h-[300px] group cursor-pointer",
                  isDragging
                    ? 'border-primary bg-primary/5 scale-[1.01]'
                    : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
                )}
                onClick={() => {
                  if (!canManageImport) {
                    toast.error('You do not have permission to import assets')
                    return
                  }
                  fileInputRef.current?.click()
                }}
              >
                <div className={cn(
                  "p-4 rounded-full mb-6 transition-colors duration-200",
                  isDragging ? "bg-primary/10" : "bg-muted group-hover:bg-primary/5"
                )}>
                  <Upload className={cn(
                    "h-10 w-10 transition-colors duration-200",
                    isDragging ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                  )} />
                </div>
                
                <div className="text-center space-y-2 max-w-sm mx-auto">
                  <h3 className="font-semibold text-lg">
                    {isDragging ? 'Drop file to upload' : 'Click or drag file here'}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Supported formats: .xlsx, .xls, .csv
                  </p>
                </div>

                <Button
                  variant="default"
                  className="mt-8 w-full sm:w-auto min-w-[140px]"
                  disabled={permissionsLoading || !canViewAssets}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!canManageImport) {
                      toast.error('You do not have permission to import assets')
                      return
                    }
                    fileInputRef.current?.click()
                  }}
                >
                  Select File
                </Button>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleImport}
                />
              </div>
            </CardContent>
          </Card>

          {/* Import Instructions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="h-full gap-0 pb-8">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary" />
                  Requirements
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 rounded-full bg-primary shrink-0" />
                  First row must contain column headers
                </p>
                <p className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 rounded-full bg-primary shrink-0" />
                  &quot;Asset Tag ID&quot; column is required
                </p>
                <p className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 rounded-full bg-primary shrink-0" />
                  Use the template for best results
                </p>
              </CardContent>
            </Card>
            
            <Card className="h-full gap-0 pb-8">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileType className="h-4 w-4 text-primary" />
                  Data Handling
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 rounded-full bg-primary shrink-0" />
                  Existing asset tags will be skipped
                </p>
                <p className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 rounded-full bg-primary shrink-0" />
                  Duplicates in file are automatically removed
                </p>
                <p className="flex items-start gap-2">
                  <span className="mt-1.5 h-1 w-1 rounded-full bg-primary shrink-0" />
                  Large files are processed in batches
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          {/* Import History */}
          <Card className="h-full flex flex-col pb-0 gap-0">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <History className="h-5 w-5 text-primary" />
                    Import History
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Recent import operations
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    refetchHistory()
                  }}
                  disabled={isHistoryFetching || historyLoading}
                  className={cn("h-8 w-8 shrink-0", isMobile && "hidden")}
                  title="Refresh history"
                >
                  <RefreshCw className={cn("h-4 w-4", isHistoryFetching && "animate-spin")} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 relative flex-1 min-h-[400px]">
              {/* Glass effect overlay when fetching */}
              {isHistoryFetching && historyData?.fileHistory && historyData.fileHistory.length > 0 && (
                <div className={cn("absolute left-0 right-[10px] top-0 bottom-0 bg-background/50 backdrop-blur-sm z-20 flex items-center justify-center rounded-b-2xl", isMobile && "right-0 rounded-b-2xl")}>
                  <Spinner variant="default" size={24} className="text-muted-foreground" />
                </div>
              )}

              {permissionsLoading || (historyLoading && !historyData) ? (
                <div className="flex flex-col items-center justify-center h-[400px] text-center gap-3">
                  <Spinner className="h-8 w-8 text-primary" />
                  <p className="text-sm text-muted-foreground animate-pulse">Loading history...</p>
                </div>
              ) : !historyData?.fileHistory || historyData.fileHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[400px] text-center text-muted-foreground gap-2 p-6">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-2">
                    <History className="h-6 w-6 opacity-50" />
                  </div>
                  <p className="font-medium">No import history found</p>
                  <p className="text-sm max-w-[200px]">Your recent imports will appear here</p>
                </div>
              ) : (
                <>
                  <ScrollArea className="h-[600px]">
                    <div className="sticky top-0 z-30 h-px bg-border w-full"></div>
                    <div className="pr-2.5 relative after:content-[''] after:absolute after:right-[10px] after:top-0 after:bottom-0 after:w-px after:bg-border after:z-50 after:h-full">
                      <Table className="border-b">
                        <TableHeader className="sticky -top-1 z-20 bg-card [&_tr]:border-b-0 -mr-2.5">
                          <TableRow className="group hover:bg-muted/50 relative border-b-0 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-[1.5px] after:h-px after:bg-border after:z-30">
                            <TableHead className="w-[180px] bg-card transition-colors group-hover:bg-muted/50 pl-6">File Name</TableHead>
                            <TableHead className="bg-card transition-colors group-hover:bg-muted/50">Records</TableHead>
                            <TableHead className="bg-card transition-colors group-hover:bg-muted/50">Status</TableHead>
                            <TableHead className="bg-card transition-colors group-hover:bg-muted/50">Imported By</TableHead>
                            <TableHead className="bg-card transition-colors group-hover:bg-muted/50">Date</TableHead>
                            <TableHead className="text-center sticky z-10 right-0 bg-card group-hover:bg-card before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border before:z-50">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <AnimatePresence mode='popLayout'>
                            {historyData?.fileHistory?.map((history: FileHistory, index: number) => (
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
                                <TableCell className="font-medium pl-6">
                                  <span className="truncate font-medium" title={history.fileName}>
                                    {history.fileName}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <div className="text-xs space-y-1">
                                    {history.recordsProcessed !== null && (
                                      <div>Processed: {history.recordsProcessed}</div>
                                    )}
                                    {history.recordsCreated !== null && (
                                      <div className="text-green-600">Created: {history.recordsCreated}</div>
                                    )}
                                    {history.recordsSkipped !== null && history.recordsSkipped > 0 && (
                                      <div className="text-yellow-600">Skipped: {history.recordsSkipped}</div>
                                    )}
                                    {history.recordsFailed !== null && history.recordsFailed > 0 && (
                                      <div className="text-red-600">Failed: {history.recordsFailed}</div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center pl-2">
                                    {history.status === 'success' ? (
                                      <div className="flex items-center justify-center h-8 w-8 text-green-600" title="Success">
                                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                                      </div>
                                    ) : history.status === 'partial' ? (
                                      <div className="flex items-center justify-center h-8 w-8 text-yellow-600" title="Partial">
                                        <AlertCircle className="h-4 w-4 shrink-0" />
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-center h-8 w-8 text-red-600" title="Failed">
                                        <XCircle className="h-4 w-4 shrink-0" />
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs">
                                  <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">
                                      {(history.userEmail || '?')[0].toUpperCase()}
                                    </div>
                                    <span className="truncate max-w-[120px]" title={history.userEmail || 'Unknown'}>
                                      {history.userEmail || 'Unknown'}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs">
                                  <div className="flex flex-col gap-0.5">
                                    <span>{format(new Date(history.createdAt), 'MMM dd')}</span>
                                    <span className="text-[10px] opacity-70">{format(new Date(history.createdAt), 'HH:mm')}</span>
                                  </div>
                                </TableCell>
                                <TableCell className={cn("sticky text-center right-0 bg-card z-10 before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border before:z-50")}>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        onClick={() => handleDelete(history)}
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
                  
                  {historyData?.pagination && historyData.pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t bg-card">
                      <div className="text-xs text-muted-foreground">
                        Page {historyData.pagination.page} of {historyData.pagination.totalPages}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                          disabled={historyPage === 1 || isHistoryFetching}
                          className="h-8 px-2 text-xs"
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setHistoryPage(p => Math.min(historyData.pagination.totalPages, p + 1))}
                          disabled={historyPage === historyData.pagination.totalPages || isHistoryFetching}
                          className="h-8 px-2 text-xs"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Template Download Dialog */}
      <ExportFieldsDialog
        open={isTemplateDialogOpen}
        onOpenChange={setIsTemplateDialogOpen}
        fields={ALL_COLUMNS}
        selectedFields={selectedTemplateFields}
        onFieldToggle={handleTemplateFieldToggle}
        onSelectAll={handleTemplateSelectAll}
        onDeselectAll={handleTemplateDeselectAll}
        onExport={handleDownloadTemplate}
        title="Select Template Columns"
        description="Choose which columns to include in your import template file"
        exportButtonLabel="Download Template"
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Delete Import Record"
        description={
          selectedHistory
            ? `Are you sure you want to delete "${selectedHistory.fileName}"? This will permanently remove this import. This action cannot be undone.`
            : 'Are you sure you want to delete this import? This will permanently remove it. This action cannot be undone.'
        }
        isLoading={deleteMutation.isPending}
      />
    </motion.div>
  )
}

