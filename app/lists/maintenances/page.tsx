'use client'

import { useQuery } from '@tanstack/react-query'
import { useState, useMemo, useCallback, useEffect, useRef, useTransition, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { usePermissions } from '@/hooks/use-permissions'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  VisibilityState,
  HeaderGroup,
  Header,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, ArrowUpDown, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Package, Edit2, Image as ImageIcon, X, RefreshCw } from 'lucide-react'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldLabel, FieldContent } from '@/components/ui/field'
import { Badge } from '@/components/ui/badge'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import Image from 'next/image'
import { Checkbox } from '@/components/ui/checkbox'
import { ImagePreviewDialog } from '@/components/dialogs/image-preview-dialog'
import { useMobileDock } from '@/components/mobile-dock-provider'
import { useMobilePagination } from '@/components/mobile-pagination-provider'
import { useIsMobile } from '@/hooks/use-mobile'
import Link from 'next/link'

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
  brand: string | null
  model: string | null
  cost: number | null
  purchaseDate: string | null
  purchasedFrom: string | null
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
  issuedTo: string | null
  checkouts?: {
    id: string
    checkoutDate: string | null
    expectedReturnDate: string | null
  }[]
  auditHistory?: {
    id: string
    auditDate: string | null
    auditType: string | null
    auditor: string | null
  }[]
  maintenances?: {
    id: string
    title: string
    status: string
    maintenanceBy: string | null
    dueDate: string | null
    cost: number | null
    dateCompleted: string | null
    dateCancelled: string | null
    createdAt: string
  }[]
  imagesCount?: number
  createdAt: string
}

interface PaginationInfo {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

async function fetchMaintenances(search?: string, searchFields?: string[], page: number = 1, pageSize: number = 50): Promise<{ assets: Asset[], pagination: PaginationInfo }> {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
    status: 'Maintenance',
    withMaintenance: 'true',
  })
  if (search) {
    params.append('search', search)
    if (searchFields && searchFields.length > 0) {
      params.append('searchFields', searchFields.join(','))
    }
  }
  
  const response = await fetch(`/api/assets?${params.toString()}`)
  if (!response.ok) {
    throw new Error('Failed to fetch maintenances')
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

const formatCurrency = (value: number | null) => {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(Number(value))
}

// Helper function to get badge color classes for maintenance status
const getMaintenanceStatusBadgeClass = (status: string): string => {
  const statusLC = status.toLowerCase().replace(' ', '')
  switch (statusLC) {
    case "scheduled":
      return "bg-yellow-500 text-white"
    case "inprogress":
      return "bg-blue-500 text-white"
    case "completed":
      return "bg-green-500 text-white"
    case "cancelled":
      return "bg-red-500 text-white"
    default:
      return "bg-gray-500 text-white"
  }
}

// Calculate time ago
const getTimeAgo = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return 'Just now'
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  }
  const diffInDays = Math.floor(diffInSeconds / 86400)
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

type MaintenanceStatus = "Scheduled" | "In progress" | "Completed" | "Cancelled" | ""

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
  { key: 'maintenanceTitle', label: 'Maintenance Title' },
  { key: 'maintenanceStatus', label: 'Maintenance Status' },
  { key: 'maintenanceBy', label: 'Maintenance By' },
  { key: 'maintenanceDueDate', label: 'Maintenance Due Date' },
  { key: 'maintenanceCost', label: 'Maintenance Cost' },
  { key: 'maintenanceTimeAgo', label: 'Maintenance Time Ago' },
  { key: 'images', label: 'Images' },
]

// Map column keys to API search field names
const COLUMN_TO_SEARCH_FIELD: Record<string, string[]> = {
  'assetTag': ['assetTagId'],
  'description': ['description'],
  'brand': ['brand'],
  'model': ['model'],
  'serialNo': ['serialNo'],
  'owner': ['owner'],
  'issuedTo': ['issuedTo'],
  'department': ['department'],
  'site': ['site'],
  'location': ['location'],
  'category': ['category.name'],
  'subCategory': ['subCategory.name'],
  'status': ['status'],
  'purchasedFrom': ['purchasedFrom'],
  'purchaseDate': ['purchaseDate'],
  'cost': ['cost'],
  'additionalInformation': ['additionalInformation'],
  'xeroAssetNo': ['xeroAssetNo'],
  'pbiNumber': ['pbiNumber'],
  'poNumber': ['poNumber'],
  'paymentVoucherNumber': ['paymentVoucherNumber'],
  'assetType': ['assetType'],
  'deliveryDate': ['deliveryDate'],
  'unaccountedInventory': ['unaccountedInventory'],
  'remarks': ['remarks'],
  'qr': ['qr'],
  'oldAssetTag': ['oldAssetTag'],
  'depreciableAsset': ['depreciableAsset'],
  'depreciableCost': ['depreciableCost'],
  'salvageValue': ['salvageValue'],
  'assetLifeMonths': ['assetLifeMonths'],
  'depreciationMethod': ['depreciationMethod'],
  'dateAcquired': ['dateAcquired'],
  'checkoutDate': ['checkouts.checkoutDate'],
  'expectedReturnDate': ['checkouts.expectedReturnDate'],
  'lastAuditDate': ['auditHistory.auditDate'],
  'lastAuditType': ['auditHistory.auditType'],
  'lastAuditor': ['auditHistory.auditor'],
  'auditCount': [], // Not searchable
  'maintenanceTitle': ['maintenances.title'],
  'maintenanceStatus': ['maintenances.status'],
  'maintenanceBy': ['maintenances.maintenanceBy'],
  'maintenanceDueDate': ['maintenances.dueDate'],
  'maintenanceCost': ['maintenances.cost'],
  'maintenanceTimeAgo': [], // Not searchable (computed field)
  'images': [], // Not searchable
}

// Create column definitions for TanStack Table
const createColumns = (
  onEditMaintenance?: (maintenance: { id: string; status: string; dateCompleted?: string | null; dateCancelled?: string | null }) => void,
  canManageMaintenance?: boolean
): ColumnDef<Asset>[] => [
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
    cell: ({ row }) => <div className="font-medium">{row.original.assetTagId}</div>,
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
    cell: ({ row }) => <div className="max-w-[300px] truncate">{row.original.description}</div>,
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
    cell: ({ row }) => {
      const category = row.original.category?.name || '-'
      return <div>{category}</div>
    },
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
    cell: ({ row }) => {
      const subCategory = row.original.subCategory?.name || '-'
      return <div>{subCategory}</div>
    },
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
    cell: ({ row }) => <div>{row.original.status || '-'}</div>,
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
    cell: ({ row }) => <div>{row.original.location || '-'}</div>,
    enableSorting: true,
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
    cell: ({ row }) => <div>{row.original.brand || '-'}</div>,
    enableSorting: true,
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
    cell: ({ row }) => <div>{row.original.model || '-'}</div>,
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
    cell: ({ row }) => <div>{formatCurrency(row.original.cost)}</div>,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.cost ?? 0
      const b = rowB.original.cost ?? 0
      return a - b
    },
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
    cell: ({ row }) => <div>{row.original.purchasedFrom || '-'}</div>,
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
    cell: ({ row }) => <div>{row.original.serialNo || '-'}</div>,
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
    cell: ({ row }) => <div className="max-w-[300px] truncate">{row.original.additionalInformation || '-'}</div>,
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
    cell: ({ row }) => <div>{row.original.xeroAssetNo || '-'}</div>,
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
    cell: ({ row }) => <div>{row.original.owner || '-'}</div>,
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
    cell: ({ row }) => <div>{row.original.pbiNumber || '-'}</div>,
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
    cell: ({ row }) => <div>{row.original.poNumber || '-'}</div>,
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
    cell: ({ row }) => <div>{row.original.paymentVoucherNumber || '-'}</div>,
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
    cell: ({ row }) => <div>{row.original.assetType || '-'}</div>,
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
    cell: ({ row }) => <div>{row.original.department || '-'}</div>,
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
    cell: ({ row }) => <div>{row.original.site || '-'}</div>,
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
    cell: ({ row }) => <div>{row.original.issuedTo || '-'}</div>,
    enableSorting: true,
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
    cell: ({ row }) => <div>{row.original.unaccountedInventory ? 'Yes' : 'No'}</div>,
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
    cell: ({ row }) => <div className="max-w-[300px] truncate">{row.original.remarks || '-'}</div>,
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
    cell: ({ row }) => <div>{row.original.qr || '-'}</div>,
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
    cell: ({ row }) => <div>{row.original.oldAssetTag || '-'}</div>,
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
    cell: ({ row }) => <div>{row.original.depreciableAsset ? 'Yes' : 'No'}</div>,
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
    cell: ({ row }) => <div>{formatCurrency(row.original.depreciableCost)}</div>,
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
    cell: ({ row }) => <div>{formatCurrency(row.original.salvageValue)}</div>,
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
    cell: ({ row }) => <div>{row.original.assetLifeMonths?.toString() || '-'}</div>,
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
    cell: ({ row }) => <div>{row.original.depreciationMethod || '-'}</div>,
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
    cell: ({ row }) => <div>{row.original.auditHistory?.[0]?.auditType || '-'}</div>,
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
    cell: ({ row }) => <div>{row.original.auditHistory?.[0]?.auditor || '-'}</div>,
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
        <div className="inline-flex items-center justify-center rounded-md border px-2 py-1 text-xs font-medium">
          {count}
        </div>
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
    accessorFn: (row) => (row as Asset).maintenances?.[0]?.title || null,
    id: 'maintenanceTitle',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Maintenance Title
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
    cell: ({ row }) => <div>{row.original.maintenances?.[0]?.title || '-'}</div>,
    enableSorting: true,
  },
  {
    accessorFn: (row) => (row as Asset).maintenances?.[0]?.status || null,
    id: 'maintenanceStatus',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Maintenance Status
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
      const maintenance = row.original.maintenances?.[0]
      if (!maintenance) return '-'
      return (
        <Badge className={cn("text-xs text-white border-0", getMaintenanceStatusBadgeClass(maintenance.status))}>
          {maintenance.status}
        </Badge>
      )
    },
    enableSorting: true,
  },
  {
    accessorFn: (row) => (row as Asset).maintenances?.[0]?.maintenanceBy || null,
    id: 'maintenanceBy',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Maintenance By
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
    cell: ({ row }) => <div>{row.original.maintenances?.[0]?.maintenanceBy || '-'}</div>,
    enableSorting: true,
  },
  {
    accessorFn: (row) => (row as Asset).maintenances?.[0]?.dueDate || null,
    id: 'maintenanceDueDate',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Maintenance Due Date
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
      const dueDate = row.original.maintenances?.[0]?.dueDate
      return dueDate ? formatDate(dueDate) : '-'
    },
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.maintenances?.[0]?.dueDate ? new Date(rowA.original.maintenances[0].dueDate).getTime() : 0
      const b = rowB.original.maintenances?.[0]?.dueDate ? new Date(rowB.original.maintenances[0].dueDate).getTime() : 0
      return a - b
    },
  },
  {
    accessorFn: (row) => (row as Asset).maintenances?.[0]?.cost || null,
    id: 'maintenanceCost',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Maintenance Cost
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
      const cost = row.original.maintenances?.[0]?.cost
      return <div>{cost ? formatCurrency(cost) : '-'}</div>
    },
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.maintenances?.[0]?.cost ?? 0
      const b = rowB.original.maintenances?.[0]?.cost ?? 0
      return a - b
    },
  },
  {
    accessorFn: (row) => (row as Asset).maintenances?.[0]?.createdAt || null,
    id: 'maintenanceTimeAgo',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="h-8 px-0 hover:bg-transparent! has-[>svg]:px-0"
        >
          Maintenance Time Ago
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
      const createdAt = row.original.maintenances?.[0]?.createdAt
      return createdAt ? <div className="text-xs text-muted-foreground">{getTimeAgo(createdAt)}</div> : '-'
    },
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const a = rowA.original.maintenances?.[0]?.createdAt ? new Date(rowA.original.maintenances[0].createdAt).getTime() : 0
      const b = rowB.original.maintenances?.[0]?.createdAt ? new Date(rowB.original.maintenances[0].createdAt).getTime() : 0
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
    id: 'maintenanceActions',
    header: () => <div className="text-center">Actions</div>,
    cell: ({ row }) => {
      const maintenance = row.original.maintenances?.[0]
      if (!maintenance) return <div>-</div>
      return (
        <div className="text-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 p-0 rounded-full"
            onClick={() => {
              if (!canManageMaintenance) {
                toast.error('You do not have permission to take actions')
                return
              }
              onEditMaintenance?.({
                id: maintenance.id,
                status: maintenance.status,
                dateCompleted: maintenance.dateCompleted,
                dateCancelled: maintenance.dateCancelled,
              })
            }}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
        </div>
      )
    },
    enableSorting: false,
    enableHiding: false,
  },
]

// Component for asset images icon with dialog
function AssetImagesCell({ asset }: { asset: Asset }) {
  const [imagesDialogOpen, setImagesDialogOpen] = useState(false)
  const [images, setImages] = useState<Array<{ id: string; imageUrl: string; assetTagId: string; fileName?: string; createdAt?: string }>>([])
  const [loadingImages, setLoadingImages] = useState(false)
  const [previewImageIndex, setPreviewImageIndex] = useState(0)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  const fetchImages = async () => {
    if (!imagesDialogOpen) return
    
    setLoadingImages(true)
    try {
      const response = await fetch(`/api/assets/images/${asset.assetTagId}`)
      if (response.ok) {
        const data = await response.json()
        setImages(data.images || [])
      } else {
        setImages([])
      }
    } catch (error) {
      console.error('Error fetching images:', error)
      setImages([])
    } finally {
      setLoadingImages(false)
    }
  }

  useEffect(() => {
    if (imagesDialogOpen) {
      fetchImages()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imagesDialogOpen])

  // If no images, show dash
  if (!asset.imagesCount || asset.imagesCount === 0) {
    return <span className="text-muted-foreground">-</span>
  }

  const handleImageClick = (index: number) => {
    setPreviewImageIndex(index)
    setImagesDialogOpen(false) // Close the grid dialog first
    setIsPreviewOpen(true)
  }

  const existingImagesForPreview = images.map((img) => ({
    id: img.id,
    imageUrl: img.imageUrl,
    fileName: img.fileName || `Image ${img.id}`,
  }))

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setImagesDialogOpen(true)}
        className="h-8 w-8"
      >
        <ImageIcon className="h-4 w-4" />
      </Button>
      <Dialog open={imagesDialogOpen} onOpenChange={setImagesDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Asset Images - {asset.assetTagId}</DialogTitle>
            <DialogDescription>
              Images for {asset.description}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            {loadingImages ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="h-6 w-6" />
              </div>
            ) : images.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No images found for this asset
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {images.map((image, index) => (
                  <div
                    key={image.id}
                    className="relative group border rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => handleImageClick(index)}
                  >
                    <div className="aspect-square bg-muted relative">
                      <Image
                        src={image.imageUrl}
                        alt={`Asset ${asset.assetTagId} image`}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog */}
      <ImagePreviewDialog
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        existingImages={existingImagesForPreview}
        title={`Asset Images - ${asset.assetTagId}`}
        maxHeight="h-[70vh] max-h-[600px]"
        initialIndex={previewImageIndex}
      />
    </>
  )
}

function ListOfMaintenancesPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const isMobile = useIsMobile()
  const { setDockContent } = useMobileDock()
  const { setPaginationContent } = useMobilePagination()
  
  const canViewAssets = hasPermission('canViewAssets')
  const canManageMaintenance = hasPermission('canManageMaintenance')
  
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    assetTag: true,
    description: false,
    category: true,
    subCategory: true,
    status: true,
    location: true,
    issuedTo: false,
    brand: false,
    model: false,
    cost: false,
    purchaseDate: false,
    purchasedFrom: false,
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
    maintenanceTitle: true,
    maintenanceStatus: true,
    maintenanceBy: true,
    maintenanceDueDate: true,
    maintenanceCost: false,
    maintenanceTimeAgo: false,
    images: true,
  })
  const [isSelectOpen, setIsSelectOpen] = useState(false)
  const [shouldCloseSelect, setShouldCloseSelect] = useState(false)
  const [isManualRefresh, setIsManualRefresh] = useState(false)
  const [, startTransition] = useTransition()
  const isInitialMount = useRef(true)
  
  // Edit maintenance dialog state
  const [editingMaintenance, setEditingMaintenance] = useState<{
    id: string
    status: string
    dateCompleted?: string | null
    dateCancelled?: string | null
  } | null>(null)
  const [editStatus, setEditStatus] = useState<MaintenanceStatus>("")
  const [editDateCompleted, setEditDateCompleted] = useState<string>("")
  const [editDateCancelled, setEditDateCancelled] = useState<string>("")
  
  const queryClient = useQueryClient()
  
  // Convert column visibility to visible columns array for compatibility
  const visibleColumns = useMemo(() => {
    return Object.entries(columnVisibility)
      .filter(([, visible]) => visible)
      .map(([key]) => key)
  }, [columnVisibility])
  
  // Get page, pageSize, and search from URL
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)
  
  // Separate states for search input (immediate UI) and search query (debounced API calls)
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '')
  const [searchType, setSearchType] = useState<string>(
    searchParams.get('searchType') || 'unified'
  )
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSearchQueryRef = useRef<string>(searchParams.get('search') || '')
  const previousSearchInputRef = useRef<string>(searchParams.get('search') || '')

  // Update URL parameters
  const updateURL = useCallback((updates: { page?: number; pageSize?: number; search?: string; searchType?: string }) => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (updates.page !== undefined) {
      if (updates.page === 1) {
        params.delete('page')
      } else {
        params.set('page', updates.page.toString())
      }
    }
    
    if (updates.pageSize !== undefined) {
      if (updates.pageSize === 50) {
        params.delete('pageSize')
      } else {
        params.set('pageSize', updates.pageSize.toString())
      }
      // Reset to page 1 when pageSize changes
      params.delete('page')
    }
    
    if (updates.search !== undefined) {
      if (updates.search === '') {
        params.delete('search')
        params.delete('searchType')
      } else {
        params.set('search', updates.search)
      }
      // Reset to page 1 when search changes
      params.delete('page')
    }

    if (updates.searchType !== undefined) {
      if (updates.searchType === 'unified') {
        params.delete('searchType')
      } else {
        params.set('searchType', updates.searchType)
      }
      // Reset to page 1 when searchType changes
      params.delete('page')
    }
    
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false })
    })
  }, [searchParams, router, startTransition])

  // Get search fields based on visible columns and searchType
  const searchFields = useMemo(() => {
    if (searchType === 'unified') {
      // Unified search: search in all visible columns
      const fields: string[] = []
      visibleColumns.forEach(colKey => {
        const fieldMappings = COLUMN_TO_SEARCH_FIELD[colKey] || []
        fields.push(...fieldMappings)
      })
      // Remove duplicates
      return Array.from(new Set(fields))
    } else {
      // Specific column search: only search in the selected column
      const fieldMappings = COLUMN_TO_SEARCH_FIELD[searchType] || []
      return fieldMappings
    }
  }, [visibleColumns, searchType])

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['maintenances-list', searchQuery, searchType, searchFields, page, pageSize],
    queryFn: () => fetchMaintenances(searchQuery || undefined, searchFields.length > 0 ? searchFields : undefined, page, pageSize),
    enabled: canViewAssets, // Only fetch if user has permission
    placeholderData: (previousData) => previousData,
  })

  // Reset manual refresh flag after successful fetch
  useEffect(() => {
    if (!isFetching && isManualRefresh) {
      setIsManualRefresh(false)
    }
  }, [isFetching, isManualRefresh])

  // Update maintenance mutation
  const updateMaintenanceMutation = useMutation({
    mutationFn: async (data: {
      id: string
      status: string
      dateCompleted?: string
      dateCancelled?: string
    }) => {
      const response = await fetch('/api/assets/maintenance', {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update maintenance')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenances-list"] })
      toast.success('Maintenance status updated successfully')
      setEditingMaintenance(null)
      setEditStatus("")
      setEditDateCompleted("")
      setEditDateCancelled("")
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update maintenance')
    }
  })


  // Handle edit status change
  useEffect(() => {
    if (editStatus === 'Completed') {
      setEditDateCancelled("")
    } else if (editStatus === 'Cancelled') {
      setEditDateCompleted("")
    }
  }, [editStatus])

  // Handle update maintenance
  const handleUpdateMaintenance = () => {
    if (!editingMaintenance) return

    if (!canManageMaintenance) {
      toast.error('You do not have permission to manage maintenance')
      return
    }

    if (!editStatus) {
      toast.error('Maintenance status is required')
      return
    }

    if (editStatus === 'Completed' && !editDateCompleted) {
      toast.error('Date completed is required when status is Completed')
      return
    }

    if (editStatus === 'Cancelled' && !editDateCancelled) {
      toast.error('Date cancelled is required when status is Cancelled')
      return
    }

    updateMaintenanceMutation.mutate({
      id: editingMaintenance.id,
      status: editStatus,
      dateCompleted: editStatus === 'Completed' ? editDateCompleted : undefined,
      dateCancelled: editStatus === 'Cancelled' ? editDateCancelled : undefined,
    })
  }

  const handlePageSizeChange = useCallback((newPageSize: string) => {
    updateURL({ pageSize: parseInt(newPageSize), page: 1 })
  }, [updateURL])

  const handlePageChange = useCallback((newPage: number) => {
    updateURL({ page: newPage })
  }, [updateURL])

  const handleRefresh = useCallback(() => {
    setIsManualRefresh(true)
    queryClient.invalidateQueries({ queryKey: ['maintenances-list'] })
  }, [queryClient])

  // Debounce search input - update searchQuery after user stops typing
  useEffect(() => {
    // Skip if search input hasn't actually changed (e.g., when URL changes from page navigation)
    if (searchInput === previousSearchInputRef.current) {
      return
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(searchInput)
      previousSearchInputRef.current = searchInput
      // Only update URL if search input actually changed from URL value
      const currentSearch = searchParams.get('search') || ''
      if (searchInput !== currentSearch) {
        updateURL({ search: searchInput, page: 1 })
      }
    }, 500)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
        searchTimeoutRef.current = null
      }
    }
  }, [searchInput, searchParams, updateURL])

  // Sync searchInput and searchType with URL params only on initial mount or external navigation
  useEffect(() => {
    const urlSearch = searchParams.get('search') || ''
    const urlSearchType = searchParams.get('searchType') || 'unified'
    const currentSearchQuery = lastSearchQueryRef.current || ''
    
    if (urlSearchType !== searchType) {
      setSearchType(urlSearchType)
    }
    
    if (urlSearch !== currentSearchQuery) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
        searchTimeoutRef.current = null
      }
      setSearchInput(urlSearch)
      setSearchQuery(urlSearch)
      previousSearchInputRef.current = urlSearch
      lastSearchQueryRef.current = urlSearch
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])
  
  useEffect(() => {
    lastSearchQueryRef.current = searchQuery
  }, [searchQuery])

  // Handle opening edit dialog
  const handleEditMaintenance = useCallback((maintenance: {
    id: string
    status: string
    dateCompleted?: string | null
    dateCancelled?: string | null
  }) => {
    setEditingMaintenance(maintenance)
    setEditStatus(maintenance.status as MaintenanceStatus)
    setEditDateCompleted(maintenance.dateCompleted ? new Date(maintenance.dateCompleted).toISOString().split('T')[0] : "")
    setEditDateCancelled(maintenance.dateCancelled ? new Date(maintenance.dateCancelled).toISOString().split('T')[0] : "")
  }, [])

  // Create columns
  const columns = useMemo(() => createColumns(handleEditMaintenance, canManageMaintenance), [handleEditMaintenance, canManageMaintenance])

  // Memoize assets data
  const assets = useMemo(() => data?.assets || [], [data?.assets])

  // Track initial mount for animations - only animate stagger on first load
  useEffect(() => {
    if (isInitialMount.current && data && assets.length > 0) {
      // Disable staggered animations after first data load
      // Use a short delay to allow first animation to start
      const timer = setTimeout(() => {
        isInitialMount.current = false
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [data, assets.length])

  const table = useReactTable({
    data: assets,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnVisibility,
    },
  })
  
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

  const allSelected = Object.keys(columnVisibility).filter(
    key => columnVisibility[key as keyof VisibilityState]
  ).length === ALL_COLUMNS.length

  const toggleColumn = (columnKey: string) => {
    if (columnKey === 'select-all') {
      const newVisibility: VisibilityState = {}
      columns.forEach(col => {
        if (col.id) {
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
        if (col.id) {
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

  const pagination = data?.pagination

  // Set mobile dock content
  useEffect(() => {
    if (isMobile) {
      setDockContent(
        <>
          <Button 
            asChild
            variant="outline"
            size="lg"
            className="rounded-full btn-glass-elevated"
          >
            <Link href="/assets/maintenance">
              Add Maintenance
            </Link>
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            className="h-10 w-10 rounded-full btn-glass-elevated"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </>
      )
    } else {
      setDockContent(null)
    }
    
    return () => {
      setDockContent(null)
    }
  }, [isMobile, setDockContent, handleRefresh])

  // Set mobile pagination content
  useEffect(() => {
    if (isMobile && pagination && pagination.totalPages > 0) {
      setPaginationContent(
        <>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (page > 1) {
                  handlePageChange(page - 1)
                }
              }}
              disabled={page <= 1 || isLoading}
              className="h-8 px-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Page</span>
              <div className="px-1.5 py-1 rounded-md bg-primary/10 text-primary font-medium text-xs">
                {isLoading ? '...' : (pagination?.page || page)}
              </div>
              <span className="text-muted-foreground">of</span>
              <span className="text-muted-foreground">{isLoading ? '...' : (pagination?.totalPages || 1)}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (pagination && page < pagination.totalPages) {
                  handlePageChange(page + 1)
                }
              }}
              disabled={!pagination || page >= (pagination.totalPages || 1) || isLoading}
              className="h-8 px-2"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Select value={pageSize.toString()} onValueChange={handlePageSizeChange} disabled={isLoading}>
              <SelectTrigger className="h-8 w-auto min-w-[90px] text-xs border-primary/20 bg-primary/10 text-primary font-medium hover:bg-primary/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25 rows</SelectItem>
                <SelectItem value="50">50 rows</SelectItem>
                <SelectItem value="100">100 rows</SelectItem>
                <SelectItem value="200">200 rows</SelectItem>
                <SelectItem value="500">500 rows</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {isLoading ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <span>{pagination?.total || 0}</span>
              )}
            </div>
          </div>
        </>
      )
    } else {
      setPaginationContent(null)
    }
    
    return () => {
      setPaginationContent(null)
    }
  }, [isMobile, setPaginationContent, pagination, page, pageSize, isLoading, handlePageChange, handlePageSizeChange])

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-600">Error loading maintenances: {(error as Error).message}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6 max-h-screen"
    >
      <div>
        <h1 className="text-3xl font-bold">List of Maintenances</h1>
        <p className="text-muted-foreground">
          View and manage all assets with Maintenance status
        </p>
      </div>

      <Card className="relative flex flex-col flex-1 min-h-0 pb-0 gap-0">
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div className="flex items-center w-full lg:flex-1 lg:max-w-md border rounded-md overflow-hidden">
              <Select
                value={searchType}
                onValueChange={(value: string) => {
                  setSearchType(value)
                  updateURL({ searchType: value, page: 1 })
                }}
              >
                <SelectTrigger className={cn("w-[140px] h-8 rounded-none border-0 border-r focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none", isMobile && "w-[100px]")} size='sm'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unified">Unified Search</SelectItem>
                  {visibleColumns
                    .filter(colKey => {
                      // Only show columns that have searchable fields
                      const fieldMappings = COLUMN_TO_SEARCH_FIELD[colKey] || []
                      return fieldMappings.length > 0
                    })
                    .map(colKey => {
                      const column = ALL_COLUMNS.find(c => c.key === colKey)
                      return (
                        <SelectItem key={colKey} value={colKey}>
                          {column?.label || colKey}
                        </SelectItem>
                      )
                    })}
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                {searchInput ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('')
                      updateURL({ search: '', page: 1 })
                    }}
                    className="absolute left-2 top-2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors cursor-pointer z-10"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : (
                  <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                )}
                <Input
                  placeholder={
                    searchType === 'unified'
                      ? visibleColumns.length > 0
                        ? `Search by ${visibleColumns.slice(0, 3).map(col => ALL_COLUMNS.find(c => c.key === col)?.label).filter(Boolean).join(', ').toLowerCase()}${visibleColumns.length > 3 ? '...' : ''}...`
                        : 'Search maintenances...'
                      : ALL_COLUMNS.find(c => c.key === searchType)?.label
                        ? `Search by ${ALL_COLUMNS.find(c => c.key === searchType)?.label}`
                        : 'Search...'
                  }
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-8 h-8 rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-2 ">
              <Select 
              open={isSelectOpen} 
              onOpenChange={handleSelectOpenChange}
              value=""
              onValueChange={(value) => {
                toggleColumn(value)
              }}
            >
              <SelectTrigger className="w-full" size='sm'>
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
                {ALL_COLUMNS.map((column) => (
                  <SelectItem
                    key={column.key}
                    value={column.key}
                    disabled={false}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox checked={visibleColumns.includes(column.key)} />
                      {column.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                className="h-8 w-8 shrink-0 hidden md:flex"
                title="Refresh table"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 px-0 relative">
          {isFetching && data && assets.length > 0 && (
            <div className={cn("absolute left-0 right-[10px] top-[33px] bottom-0 bg-background/50 backdrop-blur-sm z-20 flex items-center justify-center", isMobile && "right-0 rounded-b-2xl")}>
              <Spinner variant="default" size={24} className="text-muted-foreground" />
            </div>
          )}

          <div className={cn('h-140 pt-8', isMobile && "h-136")}>
            {permissionsLoading || (isLoading && !data) ? (
              <div className={cn("flex items-center justify-center py-12", isMobile && "h-136")}>
                <div className="flex flex-col items-center gap-3">
                  <Spinner className="h-8 w-8" />
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              </div>
            ) : !canViewAssets ? (
              <div className={cn("flex items-center justify-center py-12", isMobile && "h-136")}>
                <div className="flex flex-col items-center gap-3 text-center">
                  <Package className="h-12 w-12 text-muted-foreground opacity-50" />
                  <p className="text-lg font-medium">Access Denied</p>
                  <p className="text-sm text-muted-foreground">
                    You do not have permission to view assets. Please contact your administrator.
                  </p>
                </div>
              </div>
            ) : assets.length === 0 ? (
              <div className={cn("text-center py-8 text-muted-foreground", isMobile && "h-136")}>
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No maintenances found</p>
                <p className="text-sm">No assets with Maintenance status match your search criteria</p>
              </div>
            ) : (
              <div className="min-w-full ">
                <ScrollArea className={cn('h-132 relative', isMobile && "h-128")}>
                <div className="sticky top-0 z-30 h-px bg-border w-full"></div>
                <div className="pr-2.5">
                <Table>
                  <TableHeader className="sticky -top-1 z-20 bg-card [&_tr]:border-b-0 -mr-2.5">
                    {table.getHeaderGroups().map((headerGroup: HeaderGroup<Asset>) => (
                      <TableRow key={headerGroup.id} className="group hover:bg-muted/50 relative border-b-0 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-border after:z-30">
                        {headerGroup.headers.map((header: Header<Asset, unknown>) => {
                          const isActionsColumn = header.column.id === 'maintenanceActions'
                          return (
                            <TableHead 
                              key={header.id} 
                              className={cn(
                                isActionsColumn ? "text-center" : "text-left ",
                                "bg-card transition-colors",
                                !isActionsColumn && "group-hover:bg-muted/50",
                                isActionsColumn && "sticky z-10 right-0 border-r after:content-[''] after:absolute after:left-0 after:top-0 after:bottom-0 after:w-px after:bg-border after:z-30 "
                              )}
                            >
                              {header.isPlaceholder
                                ? null
                                : flexRender(header.column.columnDef.header, header.getContext())}
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
                            delay: isInitialMount.current ? index * 0.05 : 0 
                          }}
                          data-state={row.getIsSelected() && 'selected'}
                          className="group relative hover:bg-muted/90 data-[state=selected]:bg-muted border-b transition-colors after:content-[''] after:absolute after:top-0 after:bottom-0 after:right-0 after:w-px after:bg-border after:z-10"
                        >
                          {row.getVisibleCells().map((cell) => {
                            const isActionsColumn = cell.column.id === 'maintenanceActions'
                            return (
                              <TableCell 
                                key={cell.id}
                                className={cn(
                                  isActionsColumn && "sticky text-center right-0 bg-card z-10 after:content-[''] after:absolute after:left-0 after:top-0 after:bottom-0 after:w-px after:bg-border after:z-30 rounded-br-2xl"
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
                          No maintenances found.
                        </TableCell>
                      </TableRow>
                    )}
                    </AnimatePresence>
                  </TableBody>
                </Table>
                </div>
                <ScrollBar orientation="horizontal" className='z-10' />
                <ScrollBar orientation="vertical" className='z-10' />
                </ScrollArea>
              </div>
            )}
          </div>
        </CardContent>
        
        {/* Pagination Bar - Fixed at Bottom */}
        <div className="sticky bottom-0 border-t bg-transparent z-10 shadow-sm mt-auto rounded-b-2xl hidden md:block">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 px-4 sm:px-6 py-3">
            {/* Left Side - Navigation */}
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (page > 1) {
                    handlePageChange(page - 1)
                  }
                }}
                disabled={page <= 1 || isLoading}
                className="h-8 px-2 sm:px-3"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              
              {/* Page Info */}
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                <span className="text-muted-foreground">Page</span>
                <div className="px-1.5 sm:px-2 py-1 rounded-md bg-primary/10 text-primary font-medium text-xs sm:text-sm">
                  {isLoading ? '...' : (pagination?.page || page)}
                </div>
                <span className="text-muted-foreground">of</span>
                <span className="text-muted-foreground">{isLoading ? '...' : (pagination?.totalPages || 1)}</span>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (pagination && page < pagination.totalPages) {
                    handlePageChange(page + 1)
                  }
                }}
                disabled={!pagination || page >= (pagination.totalPages || 1) || isLoading}
                className="h-8 px-2 sm:px-3"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Right Side - Rows and Records */}
            <div className="flex items-center justify-center sm:justify-end gap-2 sm:gap-4">
              {/* Row Selection - Clickable */}
              <Select value={pageSize.toString()} onValueChange={handlePageSizeChange} disabled={isLoading}>
                <SelectTrigger className="h-8 w-auto min-w-[90px] sm:min-w-[100px] text-xs sm:text-sm border-primary/20 bg-primary/10 text-primary font-medium hover:bg-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25 rows</SelectItem>
                  <SelectItem value="50">50 rows</SelectItem>
                  <SelectItem value="100">100 rows</SelectItem>
                  <SelectItem value="200">200 rows</SelectItem>
                  <SelectItem value="500">500 rows</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Total Records */}
              <div className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                {isLoading ? (
                  <Spinner className="h-4 w-4" variant="default" />
                ) : (
                  <>
                    <span className="hidden sm:inline">{pagination?.total || 0} records</span>
                    <span className="sm:hidden">{pagination?.total || 0}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Edit Maintenance Dialog */}
      <Dialog open={!!editingMaintenance} onOpenChange={(open: boolean) => !open && setEditingMaintenance(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Update Maintenance Status</DialogTitle>
            <DialogDescription>
              Update the maintenance status. The asset status will be automatically updated based on the maintenance status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Status and Date Completed/Cancelled */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Maintenance Status <span className="text-destructive">*</span></FieldLabel>
                <FieldContent>
                  <Select
                    value={editStatus}
                    onValueChange={(value) => setEditStatus(value as MaintenanceStatus)}
                    required
                    disabled={!canManageMaintenance}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select maintenance status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Scheduled">Scheduled</SelectItem>
                      <SelectItem value="In progress">In progress</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>

              {/* Date Completed / Date Cancelled - Conditional based on status */}
              {editStatus === 'Completed' && (
                <Field>
                  <FieldLabel>Date Completed <span className="text-destructive">*</span></FieldLabel>
                  <FieldContent>
                    <Input
                      type="date"
                      value={editDateCompleted}
                      onChange={(e) => setEditDateCompleted(e.target.value)}
                      required
                      disabled={!canManageMaintenance}
                    />
                  </FieldContent>
                </Field>
              )}

              {editStatus === 'Cancelled' && (
                <Field>
                  <FieldLabel>Date Cancelled <span className="text-destructive">*</span></FieldLabel>
                  <FieldContent>
                    <Input
                      type="date"
                      value={editDateCancelled}
                      onChange={(e) => setEditDateCancelled(e.target.value)}
                      required
                      disabled={!canManageMaintenance}
                    />
                  </FieldContent>
                </Field>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingMaintenance(null)
                  setEditStatus("")
                  setEditDateCompleted("")
                  setEditDateCancelled("")
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleUpdateMaintenance}
                disabled={updateMaintenanceMutation.isPending || !canManageMaintenance}
              >
                {updateMaintenanceMutation.isPending ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Updating...
                  </>
                ) : (
                  'Update Status'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

export default function ListOfMaintenancesPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">List of Maintenances</h1>
          <p className="text-muted-foreground">
            View and manage all assets with Maintenance status
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <Spinner className="h-8 w-8" />
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <ListOfMaintenancesPageContent />
    </Suspense>
  )
}
