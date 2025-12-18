'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useCategories } from '@/hooks/use-categories'
import { useAssets, useAssetsStatuses, useDeleteAsset, useBulkDeleteAssets } from '@/hooks/use-assets'
import { createClient } from '@/lib/supabase-client'
import { useState, useEffect, useMemo, useRef, useTransition, Suspense, useCallback, memo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePermissions } from '@/hooks/use-permissions'
import { useIsMobile } from '@/hooks/use-mobile'
import { useMobileDock } from '@/components/mobile-dock-provider'
import { motion, AnimatePresence } from 'framer-motion'
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
import { MoreHorizontal, Trash2, Edit, Download, Upload, Search, Package, CheckCircle2, User, DollarSign, XIcon, ArrowUpDown, ArrowUp, ArrowDown, ArrowRight, ArrowLeft, Move, FileText as FileTextIcon, Wrench, Image as ImageIcon, RefreshCw, Eye, ChevronLeft, MoreVertical } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { AssetMediaDialog } from '@/components/dialogs/asset-media-dialog'
import { ImagePreviewDialog } from '@/components/dialogs/image-preview-dialog'
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
import { QRCodeDisplayDialog } from '@/components/dialogs/qr-code-display-dialog'
import { DeleteConfirmationDialog } from '@/components/dialogs/delete-confirmation-dialog'
import { ExportFieldsDialog } from '@/components/dialogs/export-fields-dialog'
import { BulkDeleteDialog } from '@/components/dialogs/bulk-delete-dialog'
import { ManagerDialog } from '@/components/dialogs/manager-dialog'
import { AuditHistoryManager } from '@/components/audit-history-manager'
import { CheckoutManager } from '@/components/checkout-manager'
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

// Removed fetchAssets function - now using useAssets hook
// Removed deleteAsset function - now using useDeleteAsset hook from use-assets.ts


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

// Create column definitions for TanStack Table
const createColumns = (
  AssetActionsComponent: React.ComponentType<{ asset: Asset; isSelectionMode?: boolean; hasSelectedAssets?: boolean }>,
  AssetTagCellComponent: React.ComponentType<{ asset: Asset; isSelectionMode?: boolean; hasSelectedAssets?: boolean }>,
  isSelectionMode?: boolean,
  hasSelectedAssets?: boolean
): ColumnDef<Asset, unknown>[] => [
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
    cell: ({ row }) => <AssetTagCellComponent asset={row.original} isSelectionMode={isSelectionMode} hasSelectedAssets={hasSelectedAssets} />,
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
    cell: ({ row }) => (
      <div className="max-w-[300px] truncate" title={row.original.description}>
        {row.original.description}
      </div>
    ),
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
    cell: ({ row }) => <AssetActionsComponent asset={row.original} isSelectionMode={isSelectionMode} hasSelectedAssets={hasSelectedAssets} />,
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
function AssetTagCell({ asset, isSelectionMode, hasSelectedAssets }: { asset: Asset; isSelectionMode?: boolean; hasSelectedAssets?: boolean }) {
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const isDisabled = isSelectionMode || hasSelectedAssets
  
  return (
    <>
      <button
        onClick={() => {
          if (!isDisabled) {
            setQrDialogOpen(true)
          }
        }}
        disabled={isDisabled}
        className={cn(
          "font-medium text-primary hover:underline",
          isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
        )}
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

const AssetActions = memo(function AssetActions({ asset, isSelectionMode, hasSelectedAssets }: { asset: Asset; isSelectionMode?: boolean; hasSelectedAssets?: boolean }) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { hasPermission } = usePermissions()
  
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isAuditOpen, setIsAuditOpen] = useState(false)
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false)

  // Use the FastAPI-integrated delete hook
  const deleteAssetMutation = useDeleteAsset()

  const confirmDelete = useCallback(() => {
    deleteAssetMutation.mutate(asset.id, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['assets'] })
        setIsDeleteOpen(false)
        toast.success('Asset deleted successfully. It will be permanently deleted after 30 days.')
      },
      onError: () => {
        toast.error('Failed to delete asset')
      },
    })
  }, [deleteAssetMutation, asset.id, queryClient])

  const handleEdit = useCallback(() => {
    if (!hasPermission('canEditAssets')) {
      toast.error('You do not have permission to edit assets')
      return
    }
    router.push(`/assets/${asset.id}`)
  }, [hasPermission, router, asset.id])

  const handleAudit = useCallback(() => {
    if (!hasPermission('canAudit')) {
      toast.error('You do not have permission to manage audits')
      return
    }
    setIsAuditOpen(true)
  }, [hasPermission])

  const handleCheckout = useCallback(() => {
    if (!hasPermission('canCheckout')) {
      toast.error('You do not have permission to manage checkouts')
      return
    }
    setIsCheckoutOpen(true)
  }, [hasPermission])

  const handleCheckoutAction = useCallback(() => {
    if (!hasPermission('canCheckout')) {
      toast.error('You do not have permission to checkout assets')
      return
    }
    router.push(`/assets/checkout?assetId=${asset.id}`)
  }, [hasPermission, router, asset.id])

  const handleDelete = useCallback(() => {
    if (!hasPermission('canDeleteAssets')) {
      toast.error('You do not have permission to delete assets')
      return
    }
    setIsDeleteOpen(true)
  }, [hasPermission])

  const handleViewDetails = useCallback(() => {
    if (!asset.id) return
    router.push(`/assets/details/${asset.id}`)
  }, [router, asset.id])

  const handleCheckin = useCallback(() => {
    if (!hasPermission('canCheckin')) {
      toast.error('You do not have permission to check in assets')
      return
    }
    router.push(`/assets/checkin?assetId=${asset.id}`)
  }, [hasPermission, router, asset.id])

  const handleMove = useCallback(() => {
    if (!hasPermission('canMove')) {
      toast.error('You do not have permission to move assets')
      return
    }
    router.push(`/assets/move?assetId=${asset.id}`)
  }, [hasPermission, router, asset.id])

  const handleReserve = useCallback(() => {
    if (!hasPermission('canReserve')) {
      toast.error('You do not have permission to reserve assets')
      return
    }
    router.push(`/assets/reserve?assetId=${asset.id}`)
  }, [hasPermission, router, asset.id])

  const handleLease = useCallback(() => {
    if (!hasPermission('canLease')) {
      toast.error('You do not have permission to lease assets')
      return
    }
    router.push(`/assets/lease?assetId=${asset.id}`)
  }, [hasPermission, router, asset.id])

  const handleLeaseReturn = useCallback(() => {
    if (!hasPermission('canLease')) {
      toast.error('You do not have permission to return leased assets')
      return
    }
    router.push(`/assets/lease-return?assetId=${asset.id}`)
  }, [hasPermission, router, asset.id])

  const handleDispose = useCallback((method: string) => {
    if (!hasPermission('canDispose')) {
      toast.error('You do not have permission to dispose assets')
      return
    }
    router.push(`/assets/dispose?assetId=${asset.id}&method=${method}`)
  }, [hasPermission, router, asset.id])

  const handleMaintenance = useCallback((status: string) => {
    if (!hasPermission('canManageMaintenance')) {
      toast.error('You do not have permission to manage maintenance')
      return
    }
    router.push(`/assets/maintenance?assetId=${asset.id}&status=${status}`)
  }, [hasPermission, router, asset.id])


  const isDisabled = isSelectionMode || hasSelectedAssets

  return (
    <>
      <DropdownMenu key={`dropdown-${asset.id}`}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 p-0 rounded-full"
            disabled={isDisabled}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={4}>
          <DropdownMenuItem 
            onClick={(e) => {
              e.preventDefault()
              handleViewDetails()
            }}
          >
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </DropdownMenuItem>
          <DropdownMenuSeparator />
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
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="[&>svg:last-child]:hidden">
              <ChevronLeft className="mr-2 h-4 w-4" />
              More Actions
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
                <DropdownMenuItem onClick={handleCheckoutAction}>
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Checkout
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCheckin}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Checkin
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleMove}>
                  <Move className="mr-2 h-4 w-4" />
                  Move
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleReserve}>
                  <Package className="mr-2 h-4 w-4" />
                  Reserve
                </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLease}>
                    <FileTextIcon className="mr-2 h-4 w-4" />
                    Lease
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLeaseReturn}>
                    <FileTextIcon className="mr-2 h-4 w-4" />
                    Lease Return
                  </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Dispose
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => handleDispose('Sold')}>
                      Sold
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDispose('Donated')}>
                      Donated
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDispose('Scrapped')}>
                      Scrapped
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDispose('Lost/Missing')}>
                      Lost/Missing
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDispose('Destroyed')}>
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
                    <DropdownMenuItem onClick={() => handleMaintenance('Scheduled')}>
                      Scheduled
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleMaintenance('In progress')}>
                      In Progress
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
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
        image={null}
        maxHeight="h-[70vh] max-h-[600px]"
      />

      {/* Delete Dialog */}
      <DeleteConfirmationDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onConfirm={confirmDelete}
        itemName={asset.assetTagId}
        isLoading={deleteAssetMutation.isPending}
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
          <CheckoutManager assetId={asset.id} assetTagId={asset.assetTagId} assetStatus={asset.status || undefined} invalidateQueryKey={['assets']} />
      </ManagerDialog>
    </>
  )
})



function AssetsPageContent() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const isMobile = useIsMobile()
  const { setDockContent } = useMobileDock()
  const isInitialMount = useRef(true)
  
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
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  
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
  
  // Track initial mount to prevent unnecessary refetches
  const hasInitialized = useRef(false)
  
  // Preserve pagination info during refetch to prevent UI flicker
  const lastTotalPagesRef = useRef<number>(0)
  const lastTotalCountRef = useRef<number>(0)
  
  // Fetch assets with server-side pagination and filtering using hook
  // Summary is now included in the same response, eliminating separate API call
  const { data, isLoading, isFetching, error } = useAssets(
    !permissionsLoading && canViewAssets, // enabled: Only fetch when permissions are loaded and user has permission
    searchQuery || undefined, // search
    categoryFilter !== 'all' ? categoryFilter : undefined, // category
    statusFilter !== 'all' ? statusFilter : undefined, // status
    pagination.pageIndex + 1, // page
    pagination.pageSize, // pageSize
    false, // withMaintenance
    false, // includeDeleted
    undefined, // searchFields
    false, // statusesOnly
    false // summaryOnly
  )

  const assets = useMemo(() => data?.assets || [], [data?.assets])
  const totalCount = data?.pagination?.total || lastTotalCountRef.current
  const totalPages = data?.pagination?.totalPages || lastTotalPagesRef.current

  // Update refs when data is available
  useEffect(() => {
    if (data?.pagination?.totalPages) {
      lastTotalPagesRef.current = data.pagination.totalPages
    }
    if (data?.pagination?.total) {
      lastTotalCountRef.current = data.pagination.total
    }
  }, [data?.pagination?.totalPages, data?.pagination?.total])

  // Summary is now included in the main assets API response
  // No need for a separate query - this eliminates the 33-second delay
  const summaryData = data?.summary

  // Lazy load categories - only fetch when category dropdown is opened
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false)
  const { data: categoriesData = [], isLoading: isLoadingCategories } = useCategories(canViewAssets && isCategoryDropdownOpen)

  // Lazy load statuses - only fetch when status dropdown is opened
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false)
  const { data: statusesData } = useAssetsStatuses(canViewAssets && isStatusDropdownOpen)
  const allStatusesData = statusesData?.statuses

  // Bulk delete mutation using FastAPI hook
  const bulkDeleteMutation = useBulkDeleteAssets()

  // Check if any assets are selected (before table is created, use rowSelection directly)
  const hasSelectedAssetsInitial = Object.keys(rowSelection).length > 0

  // Create columns
  const columns = useMemo(() => createColumns(AssetActions, AssetTagCell, isSelectionMode, hasSelectedAssetsInitial), [isSelectionMode, hasSelectedAssetsInitial])

  // Server-side pagination: data is already filtered and paginated from API
  const filteredData = assets

  // Create table instance with server-side pagination
  const table = useReactTable({
    data: filteredData,
    columns: columns as ColumnDef<typeof filteredData[0], unknown>[],
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id, // Use asset ID as stable row identifier
    manualPagination: true, // Enable server-side pagination
    pageCount: totalPages || 0,
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

  // Mark as initialized after first render
  useEffect(() => {
    hasInitialized.current = true
  }, [])
  
  // Sync URL params with state changes (skip on initial mount to prevent unnecessary updates)
  useEffect(() => {
    if (!hasInitialized.current) return
    
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
  
  // Reset to first page when filters change (skip on initial mount)
  useEffect(() => {
    if (!hasInitialized.current) return
    
    setPagination(prev => {
      // Only reset if pageIndex is not already 0
      if (prev.pageIndex === 0) return prev
      return { ...prev, pageIndex: 0 }
    })
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

  const hasSelectedAssets = selectedAssets.size > 0

  // Use ref to store latest assets to avoid dependency issues
  const assetsRef = useRef(assets)
  useEffect(() => {
    assetsRef.current = assets
  }, [assets])

  // Handle toggle selection mode
  const handleToggleSelectionMode = useCallback(() => {
    setIsSelectionMode(prev => {
      if (!prev) {
        // Entering selection mode - show select column
        setColumnVisibility(prev => ({ ...prev, select: true }))
      } else {
        // Exiting selection mode - clear selection
        setRowSelection({})
      }
      return !prev
    })
  }, [])

  // Handle select/deselect all - uses ref to avoid dependency issues
  const handleToggleSelectAll = useCallback(() => {
    const currentAssets = assetsRef.current
    const allSelected = selectedAssets.size === currentAssets.length && currentAssets.length > 0
    
    if (allSelected) {
      setRowSelection({})
    } else {
      const newSelection: Record<string, boolean> = {}
      currentAssets.forEach(asset => {
        newSelection[asset.id] = true
      })
      setRowSelection(newSelection)
    }
  }, [selectedAssets.size])

  // Sync selected export fields with visible columns when they change
  useEffect(() => {
    setSelectedExportFields(new Set(visibleColumns))
  }, [visibleColumns])

  // Automatically enable selection mode when user manually selects an asset
  // Automatically disable selection mode when all assets are unselected on desktop
  useEffect(() => {
    const selectedCount = Object.keys(rowSelection).length
    if (selectedCount > 0 && !isSelectionMode) {
      // User manually selected an asset - automatically enable selection mode
      setIsSelectionMode(true)
      // Ensure select column is visible
      setColumnVisibility(prev => ({ ...prev, select: true }))
    } else if (selectedCount === 0 && isSelectionMode && !isMobile) {
      // User unselected all assets on desktop - automatically disable selection mode
      // On mobile, we keep selection mode active until user clicks cancel button
      // Note: We keep the select column visible so users can still select items
      setIsSelectionMode(false)
    }
  }, [rowSelection, isSelectionMode, isMobile])

  // Update table columns when selection state changes
  useEffect(() => {
    if (table) {
      const hasSelectedAssetsCurrent = Object.keys(rowSelection).length > 0
      const updatedColumns = createColumns(AssetActions, AssetTagCell, isSelectionMode, hasSelectedAssetsCurrent)
      table.setOptions(prev => ({ ...prev, columns: updatedColumns as typeof prev.columns }))
    }
  }, [table, isSelectionMode, rowSelection])

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
      const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
        ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
        : ''
      const params = new URLSearchParams({
        page: '1',
        pageSize: '10000', // Large page size to get all matching assets
      })
      if (searchQuery) params.append('search', searchQuery)
      if (categoryFilter && categoryFilter !== 'all') params.append('category', categoryFilter)
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter)
      
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const fetchHeaders: HeadersInit = {}
      if (session?.access_token) {
        fetchHeaders['Authorization'] = `Bearer ${session.access_token}`
      }
      
      const response = await fetch(`${baseUrl}/api/assets?${params.toString()}`, {
        credentials: 'include',
        headers: fetchHeaders,
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch assets for export')
      }
      
      const exportData = await response.json()
      let assetsToExport = exportData.assets || []
      
      // If images column is selected, fetch image URLs for all assets
      if (selectedExportFields.has('images')) {
        const assetTagIds = assetsToExport.map((a: Asset) => a.assetTagId)
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
            assetsToExport = assetsToExport.map((asset: Asset) => ({
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
      const rows = assetsToExport.map((asset: Asset) => 
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
        
        const response = await fetch(url, {
          method: 'POST',
          credentials: 'include',
          headers,
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

  const handleBulkDeleteClick = useCallback(() => {
    if (selectedAssets.size === 0) return
    setIsBulkDeleteDialogOpen(true)
  }, [selectedAssets.size])

  const confirmBulkDelete = async () => {
    setIsDeleting(true)
    const selectedArray = Array.from(selectedAssets)
    setDeletingProgress({ current: 0, total: selectedArray.length })

    try {
      // Use FastAPI bulk delete hook
      const result = await bulkDeleteMutation.mutateAsync(selectedArray)
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

  // Set mobile dock content
  useEffect(() => {
    if (isMobile) {
      if (isSelectionMode) {
        // Selection mode: Select All / Deselect All (left) + Cancel (middle) + Delete icon (right, only when items selected)
        const assetsCount = assetsRef.current.length
        // Get selected count from rowSelection directly to avoid dependency issues
        const selectedCount = Object.keys(rowSelection).length
        const allSelected = selectedCount === assetsCount && assetsCount > 0
        const hasSelectedItems = selectedCount > 0
        
        setDockContent(
          <>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="lg"
                onClick={handleToggleSelectAll}
                className="rounded-full btn-glass-elevated"
              >
                {allSelected ? 'Deselect All' : 'Select All'}
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
              onClick={handleBulkDeleteClick}
              disabled={!hasSelectedItems}
              className="h-10 w-10 rounded-full btn-glass-elevated"
              title="Delete Selected"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )
      } else {
        // Normal mode: Select (left) + Add Asset (small gap) grouped together, 3 dots with Export/Import (right)
        setDockContent(
          <>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="lg"
                onClick={handleToggleSelectionMode}
                className="rounded-full btn-glass-elevated"
              >
                Select
              </Button>
              <Link href="/assets/add">
                <Button
                  onClick={(e) => {
                    if (!hasPermission('canCreateAssets')) {
                      e.preventDefault()
                      toast.error('You do not have permission to create assets')
                    }
                  }}
                  variant="outline"
                  size="lg"
                  className="rounded-full btn-glass-elevated"
                >
                  Add Asset
                </Button>
              </Link>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="rounded-full btn-glass-elevated h-10 w-10"
                  disabled={isSelectionMode || Object.keys(rowSelection).length > 0}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => {
                    if (!hasPermission('canManageExport')) {
                      toast.error('You do not have permission to export assets')
                      return
                    }
                    setIsExportDialogOpen(true)
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    if (!hasPermission('canManageImport')) {
                      toast.error('You do not have permission to import assets')
                      return
                    }
                    document.getElementById('import-file')?.click()
                  }}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Import
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )
      }
    } else {
      setDockContent(null)
    }
    
    return () => {
      setDockContent(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, setDockContent, isSelectionMode, rowSelection, handleToggleSelectAll, handleToggleSelectionMode, handleBulkDeleteClick])

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

  // Track initial mount for animations
  useEffect(() => {
    if (isInitialMount.current && assets.length > 0) {
      const timer = setTimeout(() => {
        isInitialMount.current = false
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [assets.length])

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center justify-between ">
        <div>
          <h1 className="text-3xl font-bold">All Assets</h1>
          <p className="text-muted-foreground">
            Manage and track all your assets in one place
          </p>
        </div>
        <Link href="/assets/add" className={cn(isMobile && "hidden")}>
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-6"
      >
        {/* Total Assets */}
        <Card className="flex flex-col py-0 gap-2 transition-all hover:shadow-md hover:bg-white/15 dark:hover:bg-white/10 bg-white/10 dark:bg-white/5 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-sm backdrop-saturate-150">
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
        <Card className="flex flex-col py-0 gap-2 transition-all hover:shadow-md hover:bg-white/15 dark:hover:bg-white/10 bg-white/10 dark:bg-white/5 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-sm backdrop-saturate-150">
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
        <Card className="flex flex-col py-0 gap-2 transition-all hover:shadow-md hover:bg-white/15 dark:hover:bg-white/10 bg-white/10 dark:bg-white/5 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-sm backdrop-saturate-150">
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
        <Card className="flex flex-col py-0 gap-2 transition-all hover:shadow-md hover:bg-white/15 dark:hover:bg-white/10 bg-white/10 dark:bg-white/5 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-sm backdrop-saturate-150">
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
      </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-6"
        >
        <Card className="pb-0 gap-0">
          <CardHeader className='px-4 gap-0'>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start justify-between gap-2 sm:block">
            <div>
              <CardTitle>Assets List</CardTitle>
              <CardDescription>
                View and manage all assets in the system
              </CardDescription>
            </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['assets'] })
                }}
                  className={cn("h-8 w-8 bg-white/10 dark:bg-white/5 backdrop-blur-2xl border-white/30 dark:border-white/10 hover:bg-white/20 dark:hover:bg-white/10 shadow-sm backdrop-saturate-150 sm:hidden shrink-0")}
                title="Refresh table"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              </div>
              <div className="flex flex-wrap items-center gap-3 justify-end">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    queryClient.invalidateQueries({ queryKey: ['assets'] })
                  }}
                  className={cn("h-8 w-8 bg-white/10 dark:bg-white/5 backdrop-blur-2xl border-white/30 dark:border-white/10 hover:bg-white/20 dark:hover:bg-white/10 shadow-sm backdrop-saturate-150 hidden sm:flex")}
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
                className={cn("flex-1 sm:flex-initial bg-white/10 dark:bg-white/5 backdrop-blur-2xl border-white/30 dark:border-white/10 hover:bg-white/20 dark:hover:bg-white/10 shadow-sm backdrop-saturate-150", isMobile && "hidden")}
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
                className={cn("flex-1 sm:flex-initial bg-white/10 dark:bg-white/5 backdrop-blur-2xl border-white/30 dark:border-white/10 hover:bg-white/20 dark:hover:bg-white/10 shadow-sm backdrop-saturate-150", isMobile && "hidden")}
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
                  className={cn("flex-1 sm:flex-initial", isMobile && "hidden")}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  <span className="sm:hidden">Move to Trash</span>
                  <span className="hidden sm:inline">Move to Trash ({selectedAssets.size})</span>
                </Button>
              )}
              <Select value={table.getState().pagination.pageSize.toString()} onValueChange={(value) => {
                table.setPageSize(Number(value))
              }}>
                <SelectTrigger className="w-full sm:w-[120px] bg-gray-400 bg-clip-padding backdrop-filter backdrop-blur-md bg-opacity-10 border shadow-sm" size='sm'>
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
              <SelectTrigger className="w-full sm:w-[200px] " size='sm'>
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
              <div className="px-4 pt-3 sm:p-6 pb-4 border-b">
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
                    <Input
                      placeholder="Search assets by tag, description, category..."
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      className={cn("pl-10 h-8 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none ", searchInput && "pr-10")}
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
                        {isLoadingCategories ? (
                          <SelectItem value="loading" disabled>
                            <div className="flex items-center gap-2">
                              <Spinner className="h-4 w-4" />
                              <span>Loading categories...</span>
                            </div>
                          </SelectItem>
                        ) : (
                          categoriesData?.map(category => (
                            <SelectItem key={category.id} value={category.name}>{category.name}</SelectItem>
                          ))
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

          {/* Table Section - with loading/error states */}
          <div className="relative">
            {isFetching && data && (
              <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-20 flex items-center justify-center rounded-b-2xl">
                <Spinner variant="default" size={24} className="text-muted-foreground" />
              </div>
            )}
            
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
                  <AnimatePresence mode='popLayout'>
                  {table.getRowModel().rows?.length ? (
                      table.getRowModel().rows.map((row, index) => (
                        <motion.tr
                        key={row.id}
                          layout
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ 
                            duration: 0.2, 
                            delay: isInitialMount.current ? index * 0.05 : 0,
                            layout: {
                              duration: 0.15,
                              ease: [0.4, 0, 0.2, 1]
                            }
                          }}
                        data-state={row.getIsSelected() && 'selected'}
                          className="group border-b"
                      >
                        {row.getVisibleCells().map((cell) => {
                          const isActionsColumn = cell.column.id === 'actions'
                          const isLastRow = index === table.getRowModel().rows.length - 1
                          return (
                            <TableCell 
                              key={cell.id}
                              className={cn(
                                isActionsColumn && "sticky text-center right-0 bg-card z-10 after:content-[''] after:absolute after:left-0 after:top-0 after:bottom-0 after:w-px after:bg-border after:z-30",
                                isActionsColumn && isLastRow && "rounded-br-2xl"
                              )}
                            >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                          )
                        })}
                        </motion.tr>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center">
                        No assets found
                      </TableCell>
                    </TableRow>
                  )}
                  </AnimatePresence>
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" className='z-10' />
              </ScrollArea>
              {/* Pagination */}
              {totalPages > 1 && (
                <div className={cn("flex flex-col gap-2 px-6 py-4 border-t", hasSelectedAssets && "pointer-events-none opacity-50")}>
                  <div className="flex items-center justify-center">
                    <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          href="#" 
                          onClick={(e) => {
                            e.preventDefault()
                            if (hasSelectedAssets) return
                            table.previousPage()
                          }}
                          className={!table.getCanPreviousPage() ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                      
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum
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
                                if (hasSelectedAssets) return
                                table.setPageIndex(pageNum - 1)
                              }}
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      })}
                      
                      {totalPages > 5 && table.getState().pagination.pageIndex + 1 < totalPages - 2 && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}
                      
                      <PaginationItem>
                        <PaginationNext 
                          href="#" 
                          onClick={(e) => {
                            e.preventDefault()
                            if (hasSelectedAssets) return
                            table.nextPage()
                          }}
                          className={!table.getCanNextPage() ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="text-sm text-muted-foreground">
                      {(() => {
                        const pageIndex = table.getState().pagination.pageIndex
                        const pageSize = table.getState().pagination.pageSize
                        const start = pageIndex * pageSize + 1
                        const end = Math.min((pageIndex + 1) * pageSize, totalCount)
                        return `Showing ${start} to ${end} of ${totalCount} assets`
                      })()}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          </div>
        </CardContent>
        </Card>
        </motion.div>
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
    </motion.div>
  )
}

export default function AssetsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Assets</h1>
          <p className="text-muted-foreground">
            View and manage all assets
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Spinner className="h-8 w-8" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <AssetsPageContent />
    </Suspense>
  )
}

