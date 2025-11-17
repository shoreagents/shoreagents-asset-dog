'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useMemo, useRef, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePermissions } from '@/hooks/use-permissions'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table'
import React from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { MoreHorizontal, Trash2, Edit, Download, Upload, Search, Package, CheckCircle2, User, DollarSign, XIcon, ArrowUpDown, ArrowUp, ArrowDown, ArrowRight, Image as ImageIcon, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { AssetMediaDialog } from '@/components/asset-media-dialog'
import { ImagePreviewDialog } from '@/components/image-preview-dialog'
import * as XLSX from 'xlsx'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination'
import { SelectValue } from '@radix-ui/react-select'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { Skeleton } from '@/components/ui/skeleton'
import { QRCodeDisplayDialog } from '@/components/qr-code-display-dialog'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { ExportFieldsDialog } from '@/components/export-fields-dialog'
import { BulkDeleteDialog } from '@/components/bulk-delete-dialog'
import { ManagerDialog } from '@/components/manager-dialog'
import { AuditHistoryManager } from '@/components/audit-history-manager'
import { CheckoutManager } from '@/components/checkout-manager'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

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
  categoryId: string | null
  subCategoryId: string | null
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
  checkouts?: {
    id: string
    checkoutDate: string | null
    expectedReturnDate: string | null
    employeeUser: {
      id: string
      name: string
      email: string
      department: string | null
    } | null
  }[]
  auditHistory?: {
    id: string
    auditType: string
    auditDate: string
    auditor: string | null
    status: string | null
    notes: string | null
  }[]
  imagesCount?: number
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

async function fetchAssets(page: number = 1, pageSize: number = 10, search?: string, category?: string, status?: string): Promise<{ 
  assets: Asset[], 
  pagination: { total: number, page: number, pageSize: number, totalPages: number },
  summary?: {
    totalAssets: number
    totalValue: number
    availableAssets: number
    checkedOutAssets: number
  }
}> {
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
  return { 
    assets: data.assets, 
    pagination: data.pagination,
    summary: data.summary
  }
}

async function deleteAsset(id: string) {
  const response = await fetch(`/api/assets/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error('Failed to delete asset')
  }
  return response.json()
}


// Helper functions for formatting
const formatDate = (dateString: string | null) => {
  if (!dateString) return '-'
  try {
    return new Date(dateString).toLocaleDateString()
  } catch {
    return dateString
  }
}

const formatCurrency = (value: number | null) => {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(Number(value))
}

const getStatusBadge = (status: string | null) => {
  if (!status) return '-'
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

// Create column definitions for TanStack Table
const createColumns = (AssetActionsComponent: React.ComponentType<{ asset: Asset }>): ColumnDef<Asset>[] => [
  {
    id: 'select',
    enableHiding: false,
    enableSorting: false,
    header: ({ table }) => {
      const isAllSelected = table.getIsAllPageRowsSelected()
      const isSomeSelected = table.getIsSomePageRowsSelected()
      return (
        <Checkbox
          checked={isAllSelected}
          {...(isSomeSelected && !isAllSelected && { 'aria-checked': 'mixed' as const })}
          onCheckedChange={(checked) => {
            if (checked === true) {
              table.toggleAllPageRowsSelected(true)
            } else {
              table.toggleAllPageRowsSelected(false)
            }
          }}
      />
      )
    },
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(checked) => {
          if (typeof checked === 'boolean') {
            row.toggleSelected(checked)
          }
        }}
      />
    ),
  },
  {
    accessorKey: 'assetTagId',
    id: 'assetTag',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Asset Tag ID
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => <AssetTagCell asset={row.original} />,
    enableSorting: true,
  },
  {
    accessorKey: 'description',
    id: 'description',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Description
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => row.original.description,
    enableSorting: true,
  },
  {
    accessorKey: 'category.name',
    id: 'category',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Category
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => row.original.category?.name || '-',
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.category?.name || ''
      const b = rowB.original.category?.name || ''
      return a.localeCompare(b)
    },
  },
  {
    accessorKey: 'subCategory.name',
    id: 'subCategory',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Sub Category
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => row.original.subCategory?.name || '-',
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.subCategory?.name || ''
      const b = rowB.original.subCategory?.name || ''
      return a.localeCompare(b)
    },
  },
  {
    accessorKey: 'status',
    id: 'status',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Status
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => getStatusBadge(row.original.status),
    enableSorting: true,
  },
  {
    accessorKey: 'location',
    id: 'location',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Location
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => row.original.location || '-',
    enableSorting: true,
  },
  {
    accessorKey: 'issuedTo',
    id: 'issuedTo',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Issued To
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => row.original.issuedTo || '-',
    enableSorting: true,
  },
  {
    accessorKey: 'purchasedFrom',
    id: 'purchasedFrom',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Purchased From
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => row.original.purchasedFrom || '-',
    enableSorting: true,
  },
  {
    accessorKey: 'purchaseDate',
    id: 'purchaseDate',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Purchase Date
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => formatDate(row.original.purchaseDate),
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.purchaseDate ? new Date(rowA.original.purchaseDate).getTime() : 0
      const b = rowB.original.purchaseDate ? new Date(rowB.original.purchaseDate).getTime() : 0
      return a - b
    },
  },
  {
    accessorKey: 'brand',
    id: 'brand',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Brand
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => row.original.brand || '-',
    enableSorting: true,
  },
  {
    accessorKey: 'cost',
    id: 'cost',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Cost
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => formatCurrency(row.original.cost),
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.cost ?? 0
      const b = rowB.original.cost ?? 0
      return a - b
    },
  },
  {
    accessorKey: 'model',
    id: 'model',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Model
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => row.original.model || '-',
    enableSorting: true,
  },
  {
    accessorKey: 'serialNo',
    id: 'serialNo',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Serial No
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => row.original.serialNo || '-',
    enableSorting: true,
  },
  {
    accessorKey: 'additionalInformation',
    id: 'additionalInformation',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Additional Information
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => row.original.additionalInformation || '-',
    enableSorting: true,
  },
  {
    accessorKey: 'xeroAssetNo',
    id: 'xeroAssetNo',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Xero Asset No.
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => row.original.xeroAssetNo || '-',
    enableSorting: true,
  },
  {
    accessorKey: 'owner',
    id: 'owner',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Owner
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => row.original.owner || '-',
    enableSorting: true,
  },
  {
    accessorKey: 'pbiNumber',
    id: 'pbiNumber',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          PBI Number
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => row.original.pbiNumber || '-',
    enableSorting: true,
  },
  {
    accessorKey: 'poNumber',
    id: 'poNumber',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          PO Number
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => row.original.poNumber || '-',
    enableSorting: true,
  },
  {
    accessorKey: 'paymentVoucherNumber',
    id: 'paymentVoucherNumber',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Payment Voucher Number
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => row.original.paymentVoucherNumber || '-',
    enableSorting: true,
  },
  {
    accessorKey: 'assetType',
    id: 'assetType',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Asset Type
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => row.original.assetType || '-',
    enableSorting: true,
  },
  {
    accessorKey: 'deliveryDate',
    id: 'deliveryDate',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Delivery Date
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => formatDate(row.original.deliveryDate),
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.deliveryDate ? new Date(rowA.original.deliveryDate).getTime() : 0
      const b = rowB.original.deliveryDate ? new Date(rowB.original.deliveryDate).getTime() : 0
      return a - b
    },
  },
  {
    accessorKey: 'unaccountedInventory',
    id: 'unaccountedInventory',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Unaccounted Inventory
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => row.original.unaccountedInventory ? 'Yes' : 'No',
    enableSorting: true,
  },
  {
    accessorKey: 'remarks',
    id: 'remarks',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Remarks
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => row.original.remarks || '-',
    enableSorting: true,
  },
  {
    accessorKey: 'qr',
    id: 'qr',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          QR
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => row.original.qr || '-',
    enableSorting: true,
  },
  {
    accessorKey: 'oldAssetTag',
    id: 'oldAssetTag',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Old Asset Tag
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => row.original.oldAssetTag || '-',
    enableSorting: true,
  },
  {
    accessorKey: 'depreciableAsset',
    id: 'depreciableAsset',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Depreciable Asset
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => row.original.depreciableAsset ? 'Yes' : 'No',
    enableSorting: true,
  },
  {
    accessorKey: 'depreciableCost',
    id: 'depreciableCost',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Depreciable Cost
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => formatCurrency(row.original.depreciableCost),
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.depreciableCost ?? 0
      const b = rowB.original.depreciableCost ?? 0
      return a - b
    },
  },
  {
    accessorKey: 'salvageValue',
    id: 'salvageValue',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Salvage Value
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => formatCurrency(row.original.salvageValue),
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.salvageValue ?? 0
      const b = rowB.original.salvageValue ?? 0
      return a - b
    },
  },
  {
    accessorKey: 'assetLifeMonths',
    id: 'assetLifeMonths',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Asset Life (months)
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => row.original.assetLifeMonths?.toString() || '-',
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.assetLifeMonths ?? 0
      const b = rowB.original.assetLifeMonths ?? 0
      return a - b
    },
  },
  {
    accessorKey: 'depreciationMethod',
    id: 'depreciationMethod',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Depreciation Method
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => row.original.depreciationMethod || '-',
    enableSorting: true,
  },
  {
    accessorKey: 'dateAcquired',
    id: 'dateAcquired',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Date Acquired
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => formatDate(row.original.dateAcquired),
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.dateAcquired ? new Date(rowA.original.dateAcquired).getTime() : 0
      const b = rowB.original.dateAcquired ? new Date(rowB.original.dateAcquired).getTime() : 0
      return a - b
    },
  },
  {
    accessorKey: 'department',
    id: 'department',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Department
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => row.original.department || '-',
    enableSorting: true,
  },
  {
    accessorKey: 'site',
    id: 'site',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Site
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => row.original.site || '-',
    enableSorting: true,
  },
  {
    accessorFn: (row) => row.checkouts?.[0]?.checkoutDate || null,
    id: 'checkoutDate',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Checkout Date
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => formatDate(row.original.checkouts?.[0]?.checkoutDate || null),
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.checkouts?.[0]?.checkoutDate ? new Date(rowA.original.checkouts[0].checkoutDate).getTime() : 0
      const b = rowB.original.checkouts?.[0]?.checkoutDate ? new Date(rowB.original.checkouts[0].checkoutDate).getTime() : 0
      return a - b
    },
  },
  {
    accessorFn: (row) => row.checkouts?.[0]?.expectedReturnDate || null,
    id: 'expectedReturnDate',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Expected Return Date
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => formatDate(row.original.checkouts?.[0]?.expectedReturnDate || null),
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.checkouts?.[0]?.expectedReturnDate ? new Date(rowA.original.checkouts[0].expectedReturnDate).getTime() : 0
      const b = rowB.original.checkouts?.[0]?.expectedReturnDate ? new Date(rowB.original.checkouts[0].expectedReturnDate).getTime() : 0
      return a - b
    },
  },
  {
    accessorFn: (row) => (row as Asset).auditHistory?.[0]?.auditDate || null,
    id: 'lastAuditDate',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Last Audit Date
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => {
      const lastAudit = row.original.auditHistory?.[0]
      if (!lastAudit?.auditDate) return '-'
      try {
        const date = new Date(lastAudit.auditDate)
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const year = date.getFullYear()
        return `${month}/${day}/${year}`
      } catch {
        return formatDate(lastAudit.auditDate)
      }
    },
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.auditHistory?.[0]?.auditDate ? new Date(rowA.original.auditHistory[0].auditDate).getTime() : 0
      const b = rowB.original.auditHistory?.[0]?.auditDate ? new Date(rowB.original.auditHistory[0].auditDate).getTime() : 0
      return a - b
    },
  },
  {
    accessorFn: (row) => (row as Asset).auditHistory?.[0]?.auditType || null,
    id: 'lastAuditType',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Last Audit Type
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => row.original.auditHistory?.[0]?.auditType || '-',
    enableSorting: true,
  },
  {
    accessorFn: (row) => (row as Asset).auditHistory?.[0]?.auditor || null,
    id: 'lastAuditor',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Last Auditor
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => row.original.auditHistory?.[0]?.auditor || '-',
    enableSorting: true,
  },
  {
    accessorFn: (row) => (row as Asset).auditHistory?.length || 0,
    id: 'auditCount',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Audit Count
          {column.getIsSorted() === 'asc' ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : column.getIsSorted() === 'desc' ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      )
    },
    cell: ({ row }) => {
      const count = row.original.auditHistory?.length || 0
      if (count === 0) return '-'
      return (
        <Badge variant="outline" className="font-medium">
          {count}
        </Badge>
      )
    },
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.auditHistory?.length || 0
      const b = rowB.original.auditHistory?.length || 0
      return a - b
    },
  },
  {
    id: 'images',
    enableHiding: true,
    enableSorting: false,
    header: 'Images',
    cell: ({ row }) => <AssetImagesCell asset={row.original} />,
  },
  {
    id: 'actions',
    enableHiding: false,
    enableSorting: false,
    header: 'Actions',
    cell: ({ row }) => <AssetActionsComponent asset={row.original} />,
  },
]

// Component for asset images icon with dialog
function AssetImagesCell({ asset }: { asset: Asset }) {
  const [imagesDialogOpen, setImagesDialogOpen] = useState(false)

  // If no images, show dash
  if (!asset.imagesCount || asset.imagesCount === 0) {
    return <span className="text-muted-foreground">-</span>
  }

  return (
    <AssetMediaDialog
      asset={asset}
      open={imagesDialogOpen}
      onOpenChange={setImagesDialogOpen}
      trigger={
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setImagesDialogOpen(true)}
        className="h-8 w-8"
      >
        <ImageIcon className="h-4 w-4" />
      </Button>
      }
    />
  )
}

// Component for clickable Asset Tag ID with QR code dialog
function AssetTagCell({ asset }: { asset: Asset }) {
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  
  return (
    <>
      <button
        onClick={() => setQrDialogOpen(true)}
        className="font-medium text-primary hover:underline cursor-pointer"
      >
        {asset.assetTagId}
      </button>
      <QRCodeDisplayDialog
        open={qrDialogOpen}
        onOpenChange={setQrDialogOpen}
        assetTagId={asset.assetTagId}
        status={asset.status}
        statusBadge={getStatusBadge(asset.status)}
        purchaseDate={asset.purchaseDate}
      />
    </>
  )
}

function AssetActions({ asset }: { asset: Asset }) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { hasPermission } = usePermissions()
  
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isAuditOpen, setIsAuditOpen] = useState(false)
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: deleteAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      setIsDeleteOpen(false)
      toast.success('Asset deleted successfully. It will be permanently deleted after 30 days.')
    },
    onError: () => {
      toast.error('Failed to delete asset')
    },
  })

  const confirmDelete = () => {
    deleteMutation.mutate(asset.id)
  }

  const handleEdit = () => {
    if (!hasPermission('canEditAssets')) {
      toast.error('You do not have permission to edit assets')
      return
    }
    router.push(`/assets/${asset.id}`)
  }

  const handleAudit = () => {
    if (!hasPermission('canAudit')) {
      toast.error('You do not have permission to manage audits')
      return
    }
    setIsAuditOpen(true)
  }

  const handleCheckout = () => {
    if (!hasPermission('canCheckout')) {
      toast.error('You do not have permission to manage checkouts')
      return
    }
    setIsCheckoutOpen(true)
  }

  const handleDelete = () => {
    if (!hasPermission('canDeleteAssets')) {
      toast.error('You do not have permission to delete assets')
      return
    }
    setIsDeleteOpen(true)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 p-0 hover:bg-transparent!"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleAudit}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Manage Audits
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCheckout}>
            <ArrowRight className="mr-2 h-4 w-4" />
            Manage Checkouts
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleDelete}
            variant="destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Move to Trash
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Image Preview Dialog */}
      <ImagePreviewDialog
        open={isPreviewDialogOpen}
        onOpenChange={setIsPreviewDialogOpen}
        image={previewImageUrl ? {
          imageUrl: previewImageUrl,
          alt: 'Image Preview',
        } : null}
        maxHeight="h-[70vh] max-h-[600px]"
      />

      {/* Delete Dialog */}
      <DeleteConfirmationDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onConfirm={confirmDelete}
        itemName={asset.assetTagId}
        isLoading={deleteMutation.isPending}
        title={`Move ${asset.assetTagId} to Trash?`}
        description={`This asset will be moved to Trash and can be restored later if needed.`}
        confirmLabel="Move to Trash"
      />

      {/* Audit History Dialog */}
      <ManagerDialog
        open={isAuditOpen}
        onOpenChange={setIsAuditOpen}
        title={`Audit History - ${asset.assetTagId}`}
        description="Manage audit records for this asset"
      >
          <AuditHistoryManager assetId={asset.id} assetTagId={asset.assetTagId} />
      </ManagerDialog>

      {/* Checkout History Dialog */}
      <ManagerDialog
        open={isCheckoutOpen}
        onOpenChange={setIsCheckoutOpen}
        title={`Checkout History - ${asset.assetTagId}`}
        description="View and assign employees to checkout records"
      >
          <CheckoutManager assetId={asset.id} assetTagId={asset.assetTagId} invalidateQueryKey={['assets']} />
      </ManagerDialog>
    </>
  )
}



export default function AssetsPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  
  // Initialize state from URL params
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '') // Local input state for immediate UI updates
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null) // Ref for debounce timeout
  const lastSearchQueryRef = useRef<string>(searchParams.get('search') || '') // Track last searchQuery to avoid sync loops
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all')
  const [categoryFilter, setCategoryFilter] = useState<string>(searchParams.get('category') || 'all')
  const [, startTransition] = useTransition()

  // TanStack Table state - initialize from URL
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState({
    pageIndex: parseInt(searchParams.get('page') || '1', 10) - 1,
    pageSize: parseInt(searchParams.get('pageSize') || '10', 10),
  })
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    select: true,
    assetTag: true,
    description: true,
    category: true,
    subCategory: true,
    status: true,
    location: true,
    issuedTo: true,
    purchasedFrom: false,
    purchaseDate: false,
    brand: false,
    cost: false,
    model: false,
    serialNo: false,
    additionalInformation: false,
    xeroAssetNo: false,
    owner: false,
    pbiNumber: false,
    poNumber: false,
    paymentVoucherNumber: false,
    assetType: false,
    deliveryDate: false,
    unaccountedInventory: false,
    remarks: false,
    qr: false,
    oldAssetTag: false,
    depreciableAsset: false,
    depreciableCost: false,
    salvageValue: false,
    assetLifeMonths: false,
    depreciationMethod: false,
    dateAcquired: false,
    department: false,
    site: false,
    checkoutDate: false,
    expectedReturnDate: false,
    lastAuditDate: false,
    lastAuditType: false,
    lastAuditor: false,
    auditCount: false,
    images: true,
    actions: true,
  })
  const [rowSelection, setRowSelection] = useState({})
  
  // Convert column visibility to visible columns array for compatibility
  // Exclude Actions from count since it's always visible and not selectable
  const visibleColumns = useMemo(() => {
    return Object.entries(columnVisibility)
      .filter(([, visible]) => visible)
      .map(([key]) => key)
      .filter(key => key !== 'select' && key !== 'actions')
  }, [columnVisibility])

  const [isSelectOpen, setIsSelectOpen] = useState(false)
  const [shouldCloseSelect, setShouldCloseSelect] = useState(false)
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deletingProgress, setDeletingProgress] = useState({ current: 0, total: 0 })
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [selectedExportFields, setSelectedExportFields] = useState<Set<string>>(
    new Set(visibleColumns)
  )
  
  // Check if user has permission to view assets
  const canViewAssets = hasPermission('canViewAssets')
  
  // Fetch assets with server-side pagination and filtering
  // Summary is now included in the same response, eliminating separate API call
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['assets', pagination.pageIndex + 1, pagination.pageSize, searchQuery, categoryFilter, statusFilter],
    queryFn: () => fetchAssets(
      pagination.pageIndex + 1,
      pagination.pageSize,
      searchQuery || undefined,
      categoryFilter !== 'all' ? categoryFilter : undefined,
      statusFilter !== 'all' ? statusFilter : undefined
    ),
    enabled: canViewAssets, // Only fetch if user has permission
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  })

  const assets = useMemo(() => data?.assets || [], [data?.assets])
  const totalCount = data?.pagination?.total || 0

  // Summary is now included in the main assets API response
  // No need for a separate query - this eliminates the 33-second delay
  const summaryData = data?.summary

  // Lazy load categories - only fetch when category dropdown is opened
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false)
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await fetch('/api/categories')
      if (!response.ok) {
        // Return empty array on error instead of throwing
        return []
      }
      const data = await response.json()
      // Ensure we always return an array, never undefined
      return (data.categories || []) as Array<{ id: string; name: string }>
    },
    enabled: canViewAssets && isCategoryDropdownOpen, // Only fetch when dropdown is opened
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  })

  // Lazy load statuses - only fetch when status dropdown is opened
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false)
  const { data: allStatusesData } = useQuery({
    queryKey: ['assets', 'all-statuses'],
    queryFn: async () => {
      // Use optimized endpoint that returns only unique statuses
      const response = await fetch('/api/assets?statuses=true')
      if (!response.ok) throw new Error('Failed to fetch statuses')
      const data = await response.json()
      return data.statuses as string[]
    },
    enabled: canViewAssets && isStatusDropdownOpen, // Only fetch when dropdown is opened
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  })

  // Create columns
  const columns = useMemo(() => createColumns(AssetActions), [])

  // Server-side pagination: data is already filtered and paginated from API
  const filteredData = assets

  // Create table instance with server-side pagination
  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id, // Use asset ID as stable row identifier
    manualPagination: true, // Enable server-side pagination
    pageCount: data?.pagination?.totalPages || 0,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    enableRowSelection: true,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      pagination,
      },
  })

  // Sync URL params with state changes
  useEffect(() => {
    const params = new URLSearchParams()
    
    if (pagination.pageIndex > 0) {
      params.set('page', (pagination.pageIndex + 1).toString())
    }
    if (pagination.pageSize !== 10) {
      params.set('pageSize', pagination.pageSize.toString())
    }
    if (searchQuery) {
      params.set('search', searchQuery)
    }
    if (categoryFilter && categoryFilter !== 'all') {
      params.set('category', categoryFilter)
    }
    if (statusFilter && statusFilter !== 'all') {
      params.set('status', statusFilter)
    }
    
    const newUrl = params.toString() ? `/assets?${params.toString()}` : '/assets'
    startTransition(() => {
    router.replace(newUrl, { scroll: false })
    })
  }, [pagination, searchQuery, categoryFilter, statusFilter, router, startTransition])
  
  // Reset to first page when filters change
  useEffect(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }))
  }, [searchQuery, categoryFilter, statusFilter])

  // Debounce search input - update searchQuery after user stops typing
  useEffect(() => {
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Set new timeout to update searchQuery after 500ms of no typing
    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(searchInput)
    }, 500)

    // Cleanup function
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
        searchTimeoutRef.current = null
      }
    }
  }, [searchInput])

  // Sync searchInput with URL params only on initial mount or external navigation (browser back/forward)
  useEffect(() => {
    const urlSearch = searchParams.get('search') || ''
    const currentSearchQuery = lastSearchQueryRef.current || ''
    
    // Only sync if URL param differs from our last known searchQuery
    // This handles browser back/forward navigation, not our own updates
    if (urlSearch !== currentSearchQuery) {
      // Clear any pending debounce
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
        searchTimeoutRef.current = null
      }
      setSearchInput(urlSearch)
      setSearchQuery(urlSearch)
      lastSearchQueryRef.current = urlSearch
    }
  }, [searchParams])
  
  // Update ref when searchQuery changes from our debounce
  useEffect(() => {
    lastSearchQueryRef.current = searchQuery
  }, [searchQuery])

  // For export - we'll need to fetch all assets when exporting
  // This is handled in the export function

  // Get selected assets from table row selection
  // Compute directly to ensure reactivity when rowSelection changes
  const selectedAssets = (() => {
    const selected = new Set<string>()
    table.getSelectedRowModel().rows.forEach(row => {
      selected.add(row.original.id)
    })
    return selected
  })()

  // Sync selected export fields with visible columns when they change
  useEffect(() => {
    setSelectedExportFields(new Set(visibleColumns))
  }, [visibleColumns])

  const handleSelectOpenChange = (open: boolean) => {
    if (open) {
      // Opening the select
      setIsSelectOpen(true)
    } else {
      // Trying to close - only allow if shouldCloseSelect is true
      if (shouldCloseSelect) {
        setIsSelectOpen(false)
        setShouldCloseSelect(false)
      } else {
        // Don't close for individual selections - keep it open
        setIsSelectOpen(true)
      }
    }
  }

  // Handle clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // If select is open and we're not clicking a select item, close it
      if (isSelectOpen && !shouldCloseSelect) {
        const target = event.target as HTMLElement
        const isSelectItem = target.closest('[role="option"]')
        const isSelectContent = target.closest('[role="listbox"]')
        
        // If clicked outside select content, close it
        if (!isSelectContent && !isSelectItem) {
          setIsSelectOpen(false)
        }
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isSelectOpen, shouldCloseSelect])

  // Exclude Actions from the "all selected" check since it's always visible
  const allSelected = Object.keys(columnVisibility)
    .filter(key => key !== 'select' && key !== 'actions')
    .filter(key => columnVisibility[key as keyof VisibilityState])
    .length === ALL_COLUMNS.length

  const toggleColumn = (columnKey: string) => {
    // Don't allow toggling Actions column (always visible)
    if (columnKey === 'actions') {
      return
    }
    
    if (columnKey === 'select-all') {
      const newVisibility: VisibilityState = {}
      columns.forEach(col => {
        // Skip Actions as it's always visible
        if (col.id && col.id !== 'select' && col.id !== 'actions') {
          newVisibility[col.id] = true
    }
      })
      setColumnVisibility(prev => ({ ...prev, ...newVisibility }))
      setShouldCloseSelect(true)
      return
    }
    if (columnKey === 'deselect-all') {
      const newVisibility: VisibilityState = {}
      columns.forEach(col => {
        // Skip Actions as it's always visible
        if (col.id && col.id !== 'select' && col.id !== 'actions') {
          newVisibility[col.id] = false
        }
      })
      setColumnVisibility(prev => ({ ...prev, ...newVisibility }))
      setShouldCloseSelect(true)
      return
    }
    table.getColumn(columnKey)?.toggleVisibility()
    setShouldCloseSelect(false)
  }

  // Export field functions
  const toggleExportField = (fieldKey: string) => {
    setSelectedExportFields((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(fieldKey)) {
        newSet.delete(fieldKey)
      } else {
        newSet.add(fieldKey)
      }
      return newSet
    })
  }


  // Export to Excel/CSV
  const handleExport = async () => {
    if (selectedExportFields.size === 0) {
      toast.error('Please select at least one field to export')
      setIsExportDialogOpen(true)
      return
    }

    setIsExporting(true)

    try {
      // For export, fetch all assets matching current filters (without pagination)
      const exportData = await fetchAssets(
        1,
        10000, // Large page size to get all matching assets
        searchQuery || undefined,
        categoryFilter !== 'all' ? categoryFilter : undefined,
        statusFilter !== 'all' ? statusFilter : undefined
      )
      let assetsToExport = exportData.assets
      
      // If images column is selected, fetch image URLs for all assets
      if (selectedExportFields.has('images')) {
        const assetTagIds = assetsToExport.map(a => a.assetTagId)
        try {
          const imagesResponse = await fetch(`/api/assets/images/bulk?assetTagIds=${assetTagIds.join(',')}`)
          if (imagesResponse.ok) {
            const imagesData = await imagesResponse.json()
            // Create a map of assetTagId to comma-separated image URLs
            const imageUrlMap = new Map<string, string>()
            imagesData.forEach((item: { assetTagId: string; images: Array<{ imageUrl: string }> }) => {
              const urls = item.images.map((img: { imageUrl: string }) => img.imageUrl).join(', ')
              imageUrlMap.set(item.assetTagId, urls)
            })
            // Add images to each asset
            assetsToExport = assetsToExport.map(asset => ({
              ...asset,
              images: imageUrlMap.get(asset.assetTagId) || '',
            }))
          }
        } catch (error) {
          console.warn('Failed to fetch images for export:', error)
        }
      }
      
      // Use selected export fields instead of visible columns
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
      XLSX.writeFile(wb, `assets-${new Date().toISOString().split('T')[0]}.xlsx`)
      
      toast.success(`Exported ${assetsToExport.length} asset(s) with ${selectedExportFields.size} field(s)`)
      setIsExportDialogOpen(false)
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export assets')
    } finally {
      setIsExporting(false)
    }
  }

  // Import from Excel/CSV
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    if (!hasPermission('canManageImport')) {
      toast.error('You do not have permission to import assets')
      // Reset the input
      event.target.value = ''
      return
    }
    
    try {
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
      const importedAssets = jsonData
        .map((row) => {
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
          // Images field - comma or semicolon separated URLs
          images: row['Images'] || row['images'] || null,
        }
        
        return assetData
      })
        .filter((asset) => {
          // Filter out rows without a valid assetTagId (e.g., sample data row or empty rows)
          return asset.assetTagId && typeof asset.assetTagId === 'string' && asset.assetTagId.trim() !== ''
        })
      
      // Validate that we have at least one valid asset
      if (importedAssets.length === 0) {
        toast.error('No valid assets found in the file. Please ensure the file contains at least one row with an Asset Tag ID.')
        event.target.value = ''
        return
      }
      
      // Remove duplicate rows within the same file (keep first occurrence)
      const uniqueAssets: typeof importedAssets = []
      const seenAssetTags = new Set<string>()
      const duplicateTags: string[] = []
      
      importedAssets.forEach((asset, index) => {
        if (!asset.assetTagId || (typeof asset.assetTagId === 'string' && asset.assetTagId.trim() === '')) {
          // Skip rows without assetTagId (should already be filtered, but double-check)
          return
        }
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
        const response = await fetch('/api/assets/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ assets: batch }),
        })
        
        if (!response.ok) {
          throw new Error('Failed to import assets')
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
      const skippedInTrash = allResults.filter(r => r.action === 'skipped' && r.reason === 'Asset exists in trash').length
      const skippedDuplicates = skippedCount - skippedInTrash
      
      toast.dismiss(toastId)
      
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
      
      // Refresh assets
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      
      // Reset file input
      event.target.value = ''
    } catch (error) {
      console.error('Import error:', error)
      toast.dismiss()
      toast.error('Failed to import assets')
    }
  }

  const handleBulkDeleteClick = () => {
    if (selectedAssets.size === 0) return
    setIsBulkDeleteDialogOpen(true)
  }

  const confirmBulkDelete = async () => {
    setIsDeleting(true)
    const selectedArray = Array.from(selectedAssets)
    setDeletingProgress({ current: 0, total: selectedArray.length })

    try {
      // Use bulk delete endpoint for faster deletion
      const response = await fetch('/api/assets/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: selectedArray }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete assets')
      }

      const result = await response.json()
      setDeletingProgress({ current: selectedArray.length, total: selectedArray.length })

      toast.success(`Successfully deleted ${result.deletedCount} asset(s). They will be permanently deleted after 30 days.`)
      setRowSelection({})
      setIsBulkDeleteDialogOpen(false)
      setIsDeleting(false)

      // Refresh assets
      queryClient.invalidateQueries({ queryKey: ['assets'] })
    } catch (error) {
      console.error('Bulk delete error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete assets')
      setIsDeleting(false)
    }
  }

  const getCellValue = (asset: Asset, columnKey: string) => {
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
        return formatCurrency(asset.cost)
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
        if (!asset.status) return '-'
        const statusLC = asset.status.toLowerCase()
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
        
        return <Badge variant={statusVariant} className={statusColor}>{asset.status}</Badge>
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
        return formatCurrency(asset.depreciableCost)
      case 'salvageValue':
        return formatCurrency(asset.salvageValue)
      case 'assetLifeMonths':
        return asset.assetLifeMonths || '-'
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
          const date = new Date(lastAudit.auditDate)
          const month = String(date.getMonth() + 1).padStart(2, '0')
          const day = String(date.getDate()).padStart(2, '0')
          const year = date.getFullYear()
          return `${month}/${day}/${year}`
        } catch {
          return formatDate(lastAudit.auditDate)
        }
      case 'lastAuditType':
        return asset.auditHistory?.[0]?.auditType || '-'
      case 'lastAuditor':
        return asset.auditHistory?.[0]?.auditor || '-'
      case 'auditCount':
        return (asset.auditHistory?.length || 0).toString()
      case 'images':
        // Images will be fetched separately and added to asset
        return (asset as Asset & { images?: string }).images || '-'
      default:
        return '-'
    }
  }

  // Calculate summary statistics from main assets API response - use 0 only if no data exists yet
  const totalAssets = summaryData?.totalAssets ?? 0
  const availableAssets = summaryData?.availableAssets ?? 0
  const checkedOutAssets = summaryData?.checkedOutAssets ?? 0
  const totalValue = summaryData?.totalValue ?? 0
  
  // Summary loading state is now tied to main assets query
  const isLoadingSummary = isLoading

  return (
    <>
      <div className="flex items-center justify-between ">
        <div>
          <h1 className="text-3xl font-bold">All Assets</h1>
          <p className="text-muted-foreground">
            Manage and track all your assets in one place
          </p>
        </div>
        <Link href="/assets/add">
          <Button
            onClick={(e) => {
              if (!hasPermission('canCreateAssets')) {
                e.preventDefault()
                toast.error('You do not have permission to create assets')
              }
            }}
            size='sm'
          >
            Add Asset
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-6 ">
        {/* Total Assets */}
        <Card className="flex flex-col py-0 gap-2">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-green-100 text-green-500">
                <Package className="h-4 w-4" />
              </div>
              <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col grow justify-center p-4 pt-0">
            {permissionsLoading || isLoadingSummary ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : (
              <>
            <div className="text-2xl font-bold">{totalAssets}</div>
            <p className="text-xs text-muted-foreground">
              Total number of assets
            </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Available Assets */}
        <Card className="flex flex-col py-0 gap-2">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-green-100 text-green-500">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <CardTitle className="text-sm font-medium">Available</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col grow justify-center p-4 pt-0">
            {permissionsLoading || isLoadingSummary ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : (
              <>
            <div className="text-2xl font-bold">{availableAssets}</div>
            <p className="text-xs text-muted-foreground">Ready for assignment</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Checked Out */}
        <Card className="flex flex-col py-0 gap-2">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 text-blue-500">
                <User className="h-4 w-4" />
              </div>
              <CardTitle className="text-sm font-medium">Check Out</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col grow justify-center p-4 pt-0">
            {permissionsLoading || isLoadingSummary ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : (
              <>
            <div className="text-2xl font-bold">{checkedOutAssets}</div>
            <p className="text-xs text-muted-foreground">{totalAssets > 0 ? Math.round((checkedOutAssets / totalAssets) * 100) : 0}% utilization</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Total Value */}
        <Card className="flex flex-col py-0 gap-2">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-100 text-amber-500">
                <DollarSign className="h-4 w-4" />
              </div>
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col grow justify-center p-4 pt-0">
            {permissionsLoading || isLoadingSummary ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : (
              <>
            <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
            <p className="text-xs text-muted-foreground">Active asset portfolio</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
        <Card className="mt-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Assets List</CardTitle>
              <CardDescription>
                View and manage all assets in the system
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['assets'] })
                }}
                className="h-8 w-8"
                title="Refresh table"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => {
                  if (!hasPermission('canManageExport')) {
                    toast.error('You do not have permission to export assets')
                    return
                  }
                  setIsExportDialogOpen(true)
                }}
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-initial"
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
                <>
              <Button
                  onClick={() => {
                    if (!hasPermission('canManageImport')) {
                      toast.error('You do not have permission to import assets')
                      return
                    }
                    document.getElementById('import-file')?.click()
                  }}
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-initial"
              >
                <Upload className="mr-2 h-4 w-4" />
                Import
              </Button>
              <input
                id="import-file"
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleImport}
              />
                </>
              {selectedAssets.size > 0 && (
                <Button
                  onClick={() => {
                    if (!hasPermission('canDeleteAssets')) {
                      toast.error('You do not have permission to delete assets')
                      return
                    }
                    handleBulkDeleteClick()
                  }}
                  variant="destructive"
                  size="sm"
                  className="flex-1 sm:flex-initial"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span className="sm:hidden">Move to Trash</span>
                  <span className="hidden sm:inline">Move to Trash ({selectedAssets.size})</span>
                </Button>
              )}
              <Select value={table.getState().pagination.pageSize.toString()} onValueChange={(value) => {
                table.setPageSize(Number(value))
              }}>
                <SelectTrigger className="w-full sm:w-[120px]" size='sm'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 rows</SelectItem>
                  <SelectItem value="25">25 rows</SelectItem>
                  <SelectItem value="50">50 rows</SelectItem>
                  <SelectItem value="100">100 rows</SelectItem>
                  <SelectItem value="250">250 rows</SelectItem>
                </SelectContent>
              </Select>
              <Select 
              open={isSelectOpen} 
              onOpenChange={handleSelectOpenChange}
              value=""
              onValueChange={(value) => {
                toggleColumn(value)
              }}
            >
              <SelectTrigger className="w-full sm:w-[200px]" size='sm'>
                <span className="flex-1 text-left truncate">
                  {visibleColumns.length > 0 
                    ? `${visibleColumns.length} column${visibleColumns.length !== 1 ? 's' : ''} selected`
                      : 'Select columns'
                  }
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  value={allSelected ? 'deselect-all' : 'select-all'}
                  className="font-semibold border-b"
                >
                  {allSelected ? 'Deselect All' : 'Select All'}
                </SelectItem>
                {ALL_COLUMNS.map((column) => {
                  const isVisible = column.key === 'images' 
                    ? columnVisibility.images 
                    : visibleColumns.includes(column.key)
                  return (
                  <SelectItem
                    key={column.key}
                    value={column.key}
                    className={isVisible ? 'bg-accent' : ''}
                    disabled={false}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox checked={isVisible} />
                      {column.label}
                    </div>
                  </SelectItem>
                )
                })}
              </SelectContent>
            </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 relative">
          {/* Search Bar and Filters - Always visible */}
              <div className="p-4 sm:p-6 pb-4 border-b">
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search assets by tag, description, category..."
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      className={cn("pl-10 h-8", searchInput && "pr-10")}
                    />
                    {searchInput && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 hover:bg-transparent cursor-pointer"
                        onClick={() => {
                          setSearchInput('')
                          // Clear immediately when X is clicked
                          if (searchTimeoutRef.current) {
                            clearTimeout(searchTimeoutRef.current)
                            searchTimeoutRef.current = null
                          }
                          setSearchQuery('')
                          lastSearchQueryRef.current = ''
                        }}
                      >
                        <XIcon className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="flex gap-3 sm:gap-4">
                    {/* Category Filter */}
                    <Select 
                      value={categoryFilter} 
                      onValueChange={setCategoryFilter}
                      open={isCategoryDropdownOpen}
                      onOpenChange={setIsCategoryDropdownOpen}
                    >
                      <SelectTrigger className="w-full sm:w-[180px]" size='sm'>
                        <span className="flex-1 text-left truncate">
                          {categoryFilter === 'all' || !categoryFilter ? 'All Categories' : categoryFilter}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categoriesData?.map(category => (
                          <SelectItem key={category.id} value={category.name}>{category.name}</SelectItem>
                        ))}
                        {isCategoryDropdownOpen && !categoriesData && (
                          <SelectItem value="loading" disabled>
                            <div className="flex items-center gap-2">
                              <Spinner className="h-4 w-4" />
                              <span>Loading categories...</span>
                            </div>
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>

                    {/* Status Filter */}
                    <Select 
                      value={statusFilter} 
                      onValueChange={setStatusFilter}
                      open={isStatusDropdownOpen}
                      onOpenChange={setIsStatusDropdownOpen}
                    >
                      <SelectTrigger className="w-full sm:w-[150px]" size='sm'>
                        <span className="flex-1 text-left truncate">
                          {statusFilter === 'all' || !statusFilter ? 'All Status' : statusFilter}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        {allStatusesData?.map(status => (
                          <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                        {isStatusDropdownOpen && !allStatusesData && (
                          <SelectItem value="loading" disabled>
                            <div className="flex items-center gap-2">
                              <Spinner className="h-4 w-4" />
                              <span>Loading statuses...</span>
                            </div>
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

          {isFetching && data && (
            <div className="absolute inset-x-0 top-[83px] bottom-19 bg-background/50 backdrop-blur-sm z-20 flex items-center justify-center">
              <Spinner variant="default" size={24} className="text-muted-foreground" />
            </div>
          )}
          
          {/* Table Section - with loading/error states */}
          {permissionsLoading || (isLoading && !data) ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="flex flex-col items-center gap-3">
                <Spinner variant="default" size={32} className="text-muted-foreground" />
                <p className="text-muted-foreground text-sm">Loading...</p>
              </div>
            </div>
          ) : !canViewAssets ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="flex flex-col items-center gap-3 text-center">
                <Package className="h-12 w-12 text-muted-foreground opacity-50" />
                <p className="text-lg font-medium">Access Denied</p>
                <p className="text-sm text-muted-foreground">
                  You do not have permission to view assets. Please contact your administrator.
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="p-6">
              <p className="text-destructive">
                {error instanceof Error ? error.message : 'Failed to fetch assets'}
              </p>
            </div>
          ) : (
            <>
              <ScrollArea>
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => {
                        const isActionsColumn = header.column.id === 'actions'
                        return (
                          <TableHead 
                            key={header.id} 
                            className={cn(
                              header.id === 'assetTag' ? 'font-medium' : '',
                              isActionsColumn ? "text-center" : "text-left",
                              isActionsColumn && "sticky right-0 bg-card z-10 after:content-[''] after:absolute after:left-0 after:top-0 after:bottom-0 after:w-px after:bg-border after:z-30  "
                            )}
                          >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                    </TableHead>
                        )
                      })}
                  </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && 'selected'}
                        className="group"
                      >
                        {row.getVisibleCells().map((cell) => {
                          const isActionsColumn = cell.column.id === 'actions'
                          return (
                            <TableCell 
                              key={cell.id}
                              className={cn(
                                isActionsColumn && "sticky text-center right-0 bg-card z-10 after:content-[''] after:absolute after:left-0 after:top-0 after:bottom-0 after:w-px after:bg-border after:z-30 "
                              )}
                            >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                          )
                        })}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center">
                        No assets found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" className='z-10' />
              </ScrollArea>
              {/* Pagination */}
              {table.getPageCount() > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    {(() => {
                      const pageIndex = table.getState().pagination.pageIndex
                      const pageSize = table.getState().pagination.pageSize
                      const start = pageIndex * pageSize + 1
                      const end = Math.min((pageIndex + 1) * pageSize, totalCount)
                      return `Showing ${start} to ${end} of ${totalCount} assets`
                    })()}
                  </div>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          href="#" 
                          onClick={(e) => {
                            e.preventDefault()
                            table.previousPage()
                          }}
                          className={!table.getCanPreviousPage() ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                      
                      {Array.from({ length: Math.min(5, table.getPageCount()) }, (_, i) => {
                        let pageNum
                        const totalPages = table.getPageCount()
                        const currentPage = table.getState().pagination.pageIndex + 1
                        if (totalPages <= 5) {
                          pageNum = i + 1
                        } else if (currentPage <= 3) {
                          pageNum = i + 1
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i
                        } else {
                          pageNum = currentPage - 2 + i
                        }
                        
                        return (
                          <PaginationItem key={pageNum}>
                            <PaginationLink
                              href="#"
                              isActive={currentPage === pageNum}
                              onClick={(e) => {
                                e.preventDefault()
                                table.setPageIndex(pageNum - 1)
                              }}
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      })}
                      
                      {table.getPageCount() > 5 && table.getState().pagination.pageIndex + 1 < table.getPageCount() - 2 && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}
                      
                      <PaginationItem>
                        <PaginationNext 
                          href="#" 
                          onClick={(e) => {
                            e.preventDefault()
                            table.nextPage()
                          }}
                          className={!table.getCanNextPage() ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
        </Card>
      {/* Export Fields Selection Dialog */}
      <ExportFieldsDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        fields={ALL_COLUMNS}
        selectedFields={selectedExportFields}
        onFieldToggle={toggleExportField}
        onSelectAll={() => setSelectedExportFields(new Set(ALL_COLUMNS.map((col) => col.key)))}
        onDeselectAll={() => setSelectedExportFields(new Set())}
        onExport={handleExport}
        isExporting={isExporting}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <BulkDeleteDialog
        open={isBulkDeleteDialogOpen} 
        onOpenChange={setIsBulkDeleteDialogOpen}
        onConfirm={confirmBulkDelete}
        itemCount={selectedAssets.size}
        itemName="Asset"
        isDeleting={isDeleting}
        progress={isDeleting ? { current: deletingProgress.current, total: deletingProgress.total } : undefined}
      />
    </>
  )
}

