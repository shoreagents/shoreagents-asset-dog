'use client'

import { useState, useRef } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { usePermissions } from '@/hooks/use-permissions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Upload, FileSpreadsheet, History, Package, Download, MoreHorizontal, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { format } from 'date-fns'
import { ExportFieldsDialog } from '@/components/export-fields-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { cn } from '@/lib/utils'

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
  createdAt: string
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
]

async function fetchImportHistory(page: number = 1) {
  const response = await fetch(`/api/file-history?operationType=import&page=${page}&pageSize=10`)
  if (!response.ok) throw new Error('Failed to fetch history')
  return response.json()
}

export default function ImportPage() {
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canManageImport = hasPermission('canManageImport')
  const canViewAssets = hasPermission('canViewAssets')
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [historyPage, setHistoryPage] = useState(1)
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)
  const [selectedTemplateFields, setSelectedTemplateFields] = useState<Set<string>>(
    new Set(['assetTag', 'description', 'category', 'subCategory', 'status', 'location', 'issuedTo'])
  )
  const [isDragging, setIsDragging] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedHistory, setSelectedHistory] = useState<FileHistory | null>(null)

  // Fetch import history
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['importHistory', historyPage],
    queryFn: () => fetchImportHistory(historyPage),
    enabled: canViewAssets,
  })

  // Combine loading states
  const isLoading = permissionsLoading || (canViewAssets && historyLoading)

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

      // Create empty worksheet with just headers
      const wsData = [headers]
      const ws = XLSX.utils.aoa_to_sheet(wsData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Assets')

      // Generate Excel file
      const fileName = `asset-import-template-${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, fileName)

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
        const assetData = {
          assetTagId: row['Asset Tag ID'] || row['assetTagId'] || null,
          description: row['Description'] || '',
          purchasedFrom: row['Purchased from'] || null,
          purchaseDate: row['Purchase Date'] || null,
          brand: row['Brand'] || null,
          cost: parseNumber(row['Cost']),
          model: row['Model'] || null,
          serialNo: row['Serial No'] || null,
          additionalInformation: row['Additional Information'] || null,
          xeroAssetNo: row['Xero Asset No.'] || null,
          owner: row['Owner'] || null,
          pbiNumber: row['PBI NUMBER'] || row['pbiNumber'] || null,
          status: row['Status'] || null,
          issuedTo: row['ISSUED TO:'] || row['issuedTo'] || null,
          poNumber: row['PO NUMBER'] || row['poNumber'] || null,
          paymentVoucherNumber: row['PAYMENT VOUCHER NUMBER'] || row['paymentVoucherNumber'] || null,
          assetType: row['ASSET TYPE'] || row['assetType'] || null,
          deliveryDate: row['DELIVERY DATE'] || row['deliveryDate'] || null,
          unaccountedInventory: row['UNACCOUNTED INVENTORY'] || row['UNACCOUNTED 2021 INVENTORY'] || row['unaccountedInventory'] || row['unaccounted2021Inventory'] || null,
          remarks: row['REMARKS'] || row['remarks'] || null,
          qr: row['QR'] || row['qr'] || null,
          oldAssetTag: row['OLD ASSET TAG'] || row['oldAssetTag'] || null,
          depreciableAsset: row['Depreciable Asset'] || row['depreciableAsset'] || null,
          depreciableCost: parseNumber(row['Depreciable Cost']),
          salvageValue: parseNumber(row['Salvage Value']),
          assetLifeMonths: parseNumber(row['Asset Life (months)']),
          depreciationMethod: row['Depreciation Method'] || row['depreciationMethod'] || null,
          dateAcquired: row['Date Acquired'] || row['dateAcquired'] || null,
          category: row['Category'] || null,
          subCategory: row['SUB-CATEGORY'] || row['subCategory'] || null,
          department: row['Department'] || null,
          site: row['Site'] || null,
          location: row['Location'] || null,
          // Audit fields - these will create audit history records
          lastAuditDate: row['Last Audit Date'] || row['lastAuditDate'] || null,
          lastAuditType: row['Last Audit Type'] || row['lastAuditType'] || null,
          lastAuditor: row['Last Auditor'] || row['lastAuditor'] || null,
          auditCount: row['Audit Count'] || row['auditCount'] || null,
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
          response = await fetch('/api/assets/import', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ assets: batch }),
          })
        } catch (fetchError) {
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
      } catch (historyError) {
        // Silently fail history save, don't show toast for this
      }
      
      // Show results
      if (skippedCount > 0) {
        toast.info(
          `Import complete: ${createdCount} created, ${skippedCount} skipped (duplicates)`,
          { duration: 5000 }
        )
      } else {
        toast.success(`Successfully imported ${createdCount} asset(s)`)
      }
      
      // Show details of skipped items if any
      if (skippedCount > 0) {
        const skippedAssets = allResults
          .filter(r => r.action === 'skipped')
          .map(r => r.asset)
          .slice(0, 5) // Show first 5
        
        if (skippedAssets.length > 0) {
          setTimeout(() => {
            toast.info(
              `Skipped assets: ${skippedAssets.join(', ')}${skippedCount > 5 ? ` and ${skippedCount - 5} more` : ''}`,
              { duration: 6000 }
            )
          }, 1000)
        }
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
      } catch (historyError) {
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Import Assets</h1>
          <p className="text-muted-foreground">
            Import asset data from Excel or CSV files
          </p>
        </div>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
          <Spinner className="h-8 w-8" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!canViewAssets) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Import Assets</h1>
          <p className="text-muted-foreground">
            Import asset data from Excel or CSV files
          </p>
        </div>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3 text-center">
            <Package className="h-12 w-12 text-muted-foreground opacity-50" />
            <p className="text-lg font-medium">Access Denied</p>
            <p className="text-sm text-muted-foreground">
              You do not have permission to view import history. Please contact your administrator.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Import Assets</h1>
        <p className="text-muted-foreground">
          Import asset data from Excel or CSV files
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card >
        <CardHeader className="shrink-0 pb-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
            <div>
              <CardTitle>Import Assets</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Upload an Excel (.xlsx, .xls) or CSV file to import assets into the system
              </CardDescription>
            </div>
            <div className="flex gap-2 sm:gap-3 items-center">
              <Button
                variant="outline"
                onClick={() => setIsTemplateDialogOpen(true)}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Template
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col h-full min-h-[400px]">
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
            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 space-y-4 transition-colors flex-1 ${
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-gray-300 dark:border-gray-700 hover:border-primary/50'
            }`}
          >
            <FileSpreadsheet className={`h-12 w-12 transition-colors ${
              isDragging ? 'text-primary' : 'text-muted-foreground'
            }`} />
            <div className="text-center space-y-2">
              {isDragging ? (
                <>
                  <p className="text-sm font-medium text-primary">Drop your file here</p>
                  <p className="text-xs text-muted-foreground">
                    Supported formats: .xlsx, .xls, .csv
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">Drag and drop your file here</p>
                  <p className="text-xs text-muted-foreground">
                    or click the button below to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supported formats: .xlsx, .xls, .csv
                  </p>
                </>
              )}
            </div>
            <Button
              onClick={() => {
                if (!canManageImport) {
                  toast.error('You do not have permission to import assets')
                  return
                }
                fileInputRef.current?.click()
              }}
              className="w-full sm:w-auto"
            >
              <Upload className="mr-2 h-4 w-4" />
              Choose File
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

        {/* Import History */}
        <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Import History
          </CardTitle>
          <CardDescription>
            Recent import operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Spinner className="h-6 w-6" />
              <p className="text-muted-foreground mt-2">Loading history...</p>
            </div>
          ) : !historyData?.fileHistory || historyData.fileHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No import history found
            </div>
          ) : (
            <>
              <ScrollArea className="h-[350px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File Name</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className={cn("text-right sticky right-0 bg-card z-10")}>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyData?.fileHistory?.map((history: FileHistory) => (
                      <TableRow key={history.id}>
                        <TableCell className="font-medium">{history.fileName}</TableCell>
                        <TableCell>
                          <div className="text-sm space-y-1">
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
                          {history.status === 'success' ? (
                            <Badge variant="default" className="bg-green-600">Success</Badge>
                          ) : history.status === 'partial' ? (
                            <Badge variant="default" className="bg-yellow-600">Partial</Badge>
                          ) : (
                            <Badge variant="destructive">Failed</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(history.createdAt), 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                        <TableCell className={cn("text-right sticky right-0 bg-card z-10")}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleDelete(history)}
                                disabled={deleteMutation.isPending}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
                <ScrollBar orientation="vertical" className='z-10' />
              </ScrollArea>
              {historyData?.pagination && historyData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Page {historyData.pagination.page} of {historyData.pagination.totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                      disabled={historyPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistoryPage(p => Math.min(historyData.pagination.totalPages, p + 1))}
                      disabled={historyPage === historyData.pagination.totalPages}
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

        {/* Import Instructions */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Import Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>First row should contain column headers</li>
                <li>Required field: Asset Tag ID</li>
                <li>Duplicate asset tags within the file will be skipped</li>
                <li>Assets with existing asset tags will be skipped</li>
                <li>Supported column names include: Asset Tag ID, Description, Category, Status, Location, etc.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
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
    </div>
  )
}

