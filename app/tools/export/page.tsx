'use client'

import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { usePermissions } from '@/hooks/use-permissions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download, History, FileDown, Trash2, MoreHorizontal, Package } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { ExportFieldsDialog } from '@/components/export-fields-dialog'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
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
]

interface Asset {
  id: string
  assetTagId: string
  description: string
  status: string | null
  category: {
    name: string
  } | null
  subCategory: {
    name: string
  } | null
  location: string | null
  issuedTo: string | null
  purchasedFrom: string | null
  purchaseDate: string | null
  brand: string | null
  cost: number | null
  model: string | null
  serialNo: string | null
  additionalInformation: string | null
  xeroAssetNo: string | null
  owner: string | null
  pbiNumber: string | null
  poNumber: string | null
  paymentVoucherNumber: string | null
  assetType: string | null
  deliveryDate: string | null
  unaccountedInventory: boolean | null
  remarks: string | null
  qr: string | null
  oldAssetTag: string | null
  depreciableAsset: boolean | null
  depreciableCost: number | null
  salvageValue: number | null
  assetLifeMonths: number | null
  depreciationMethod: string | null
  dateAcquired: string | null
  department: string | null
  site: string | null
}

async function fetchAssets(page: number = 1, pageSize: number = 10, search?: string, category?: string, status?: string): Promise<{ assets: Asset[], pagination: { total: number, page: number, pageSize: number, totalPages: number } }> {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
  })
  if (search) params.append('search', search)
  if (category && category !== 'all') params.append('category', category)
  if (status && status !== 'all') params.append('status', status)
  
  const response = await fetch(`/api/assets?${params.toString()}`)
  if (!response.ok) {
    throw new Error('Failed to fetch assets')
  }
  const data = await response.json()
  return { assets: data.assets, pagination: data.pagination }
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return '-'
  try {
    return new Date(dateString).toLocaleDateString()
  } catch {
    return dateString
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
    default:
      return '-'
  }
}

export default function ExportPage() {
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canManageExport = hasPermission('canManageExport')
  const canViewAssets = hasPermission('canViewAssets')
  
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [selectedExportFields, setSelectedExportFields] = useState<Set<string>>(
    new Set(['assetTag', 'description', 'category', 'subCategory', 'status', 'location', 'issuedTo'])
  )
  const [historyPage, setHistoryPage] = useState(1)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedHistory, setSelectedHistory] = useState<FileHistory | null>(null)

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
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['exportHistory', historyPage],
    queryFn: () => fetchExportHistory(historyPage),
    enabled: canViewAssets,
  })

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
  
  // Fetch all assets for export
  const { data, isLoading: assetsLoading } = useQuery({
    queryKey: ['assets', 'export'],
    queryFn: () => fetchAssets(1, 10000),
    enabled: canViewAssets,
  })

  // Combine loading states
  const isLoading = permissionsLoading || (canViewAssets && (historyLoading || assetsLoading))

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

    try {
      const assetsToExport = data.assets
      
      // Use selected export fields
      const fieldsToExport = Array.from(selectedExportFields)
      
      // Map selected fields to header names
      const headers = fieldsToExport.map(key => {
        const column = ALL_COLUMNS.find(c => c.key === key)
        return column ? column.label : key
      })
      
      // Create data rows
      const rows = assetsToExport.map(asset => 
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
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Export Assets</h1>
          <p className="text-muted-foreground">
            Export asset data to Excel format with custom field selection
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
          <h1 className="text-3xl font-bold">Export Assets</h1>
          <p className="text-muted-foreground">
            Export asset data to Excel format with custom field selection
          </p>
        </div>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3 text-center">
            <Package className="h-12 w-12 text-muted-foreground opacity-50" />
            <p className="text-lg font-medium">Access Denied</p>
            <p className="text-sm text-muted-foreground">
              You do not have permission to view export history. Please contact your administrator.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Export Assets</h1>
        <p className="text-muted-foreground">
          Export asset data to Excel format with custom field selection
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Export Assets</CardTitle>
          <CardDescription>
            Select which fields to include in your export and download the data as an Excel file
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Spinner className="h-6 w-6" />
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {data?.assets.length || 0} asset(s) available for export
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedExportFields.size} field(s) selected
                  </p>
                </div>
                <Button 
                  onClick={() => {
                    if (!canManageExport) {
                      toast.error('You do not have permission to export assets')
                      return
                    }
                    setIsExportDialogOpen(true)
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Select Fields & Export
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ExportFieldsDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        fields={ALL_COLUMNS}
        selectedFields={selectedExportFields}
        onFieldToggle={handleFieldToggle}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        onExport={handleExport}
      />

      {/* Export History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Export History
          </CardTitle>
          <CardDescription>
            Recent export operations
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
              No export history found
            </div>
          ) : (
            <>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File Name</TableHead>
                      <TableHead>Records</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Exported By</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className={cn("text-right sticky right-0 bg-card z-10")}>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyData.fileHistory.map((history: FileHistory) => (
                      <TableRow key={history.id}>
                        <TableCell className="font-medium">{history.fileName}</TableCell>
                        <TableCell>
                          <div className="text-sm space-y-1">
                            {history.recordsExported !== null && (
                              <div>Exported: {history.recordsExported}</div>
                            )}
                            {history.fieldsExported !== null && (
                              <div className="text-muted-foreground">
                                Fields: {history.fieldsExported}
                              </div>
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
                          {history.userEmail || 'Unknown'}
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
                                >
                                  <FileDown className="mr-2 h-4 w-4" />
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
    </div>
  )
}

