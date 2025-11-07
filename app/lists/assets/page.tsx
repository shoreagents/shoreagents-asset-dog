'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo, useCallback, useEffect, useRef, useTransition } from 'react'
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
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Search, ArrowUpDown, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Package, MoreHorizontal, Trash2, Edit, CheckCircle2, Image as ImageIcon, UserPlus, Calendar, UserCircle, Clock, CheckCircle, Edit2, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import Image from 'next/image'
import { EditAssetDialog } from '@/components/edit-asset-dialog'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { ManagerDialog } from '@/components/manager-dialog'

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
    status: string | null
    notes: string | null
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

async function fetchAssets(search?: string, page: number = 1, pageSize: number = 100): Promise<{ assets: Asset[], pagination: PaginationInfo }> {
  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
  })
  if (search) params.append('search', search)
  
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

const formatCurrency = (value: number | null) => {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(Number(value))
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

// Create column definitions for TanStack Table
const createColumns = (): ColumnDef<Asset>[] => [
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
    cell: ({ row }) => <AssetActions asset={row.original} />,
  },
]

// Component for asset images icon with dialog
function AssetImagesCell({ asset }: { asset: Asset }) {
  const [imagesDialogOpen, setImagesDialogOpen] = useState(false)
  const [images, setImages] = useState<Array<{ id: string; imageUrl: string; assetTagId: string }>>([])
  const [loadingImages, setLoadingImages] = useState(false)

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
                {images.map((image) => (
                  <div key={image.id} className="relative group border rounded-lg overflow-hidden">
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
    </>
  )
}

// Asset Actions Component
function AssetActions({ asset }: { asset: Asset }) {
  const queryClient = useQueryClient()
  const { hasPermission } = usePermissions()
  
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isAuditOpen, setIsAuditOpen] = useState(false)
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false)

  async function deleteAsset(id: string) {
    const response = await fetch(`/api/assets/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to delete asset')
    }
    return response.json()
  }

  const deleteMutation = useMutation({
    mutationFn: deleteAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets-list'] })
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
    setIsEditOpen(true)
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
      <div className="flex justify-end">
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
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
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

      {/* Edit Dialog */}
      <EditAssetDialog
        asset={asset}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onPreviewImage={(imageUrl) => {
          setPreviewImageUrl(imageUrl)
          setIsPreviewDialogOpen(true)
        }}
      />

      {/* Image Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Image Preview</DialogTitle>
          </DialogHeader>
          {previewImageUrl && (
            <div className="flex items-center justify-center">
              <div className="relative w-full h-[70vh] max-h-[600px]">
                <Image
                  src={previewImageUrl}
                  alt="Preview"
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <DeleteConfirmationDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        onConfirm={confirmDelete}
        itemName={asset.assetTagId}
        isLoading={deleteMutation.isPending}
        title={`Delete ${asset.assetTagId}?`}
        description={`Are you sure you want to delete "${asset.assetTagId}"? This asset will be moved to Trash and can be restored within 30 days. After 30 days, it will be permanently deleted.`}
        confirmLabel="Delete Asset"
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
        <CheckoutManager assetId={asset.id} assetTagId={asset.assetTagId} />
      </ManagerDialog>
    </>
  )
}

// Audit History Manager Component
function AuditHistoryManager({ assetId }: { assetId: string; assetTagId: string }) {
  const queryClient = useQueryClient()
  const [isAdding, setIsAdding] = useState(false)

  // Fetch audit history
  const { data: auditData, isLoading } = useQuery({
    queryKey: ['auditHistory', assetId],
    queryFn: async () => {
      const response = await fetch(`/api/assets/${assetId}/audit`)
      if (!response.ok) throw new Error('Failed to fetch audit history')
      return response.json()
    },
  })

  const audits = auditData?.audits || []

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (auditId: string) => {
      const response = await fetch(`/api/assets/audit/${auditId}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete audit')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auditHistory', assetId] })
      toast.success('Audit record deleted')
    },
    onError: () => {
      toast.error('Failed to delete audit record')
    },
  })
  
  // Add mutation
  const addMutation = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/assets/${assetId}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error('Failed to create audit')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auditHistory', assetId] })
      setIsAdding(false)
      toast.success('Audit record created')
    },
    onError: () => {
      toast.error('Failed to create audit record')
    },
  })

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    const auditData = {
      auditType: formData.get('auditType') as string,
      auditDate: formData.get('auditDate') as string,
      auditor: formData.get('auditor') as string || null,
      status: formData.get('status') as string || 'Completed',
      notes: formData.get('notes') as string || null,
    }

    addMutation.mutate(auditData)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {audits.length} audit record{audits.length !== 1 ? 's' : ''}
        </div>
        {!isAdding && (
          <Button onClick={() => setIsAdding(true)} size="sm" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Add Audit Record
          </Button>
        )}
      </div>

      {/* Add Form */}
      {isAdding && (
        <Card className="border-2 border-primary/20 bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              New Audit Record
            </CardTitle>
            <CardDescription>Fill in the details for this audit</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="auditType" className="text-sm font-medium">
                    Audit Type <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="auditType"
                    name="auditType"
                    required
                    placeholder="e.g., October Audit, Annual Audit"
                    className="w-full"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="auditDate" className="text-sm font-medium">
                    Audit Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="auditDate"
                    name="auditDate"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="status" className="text-sm font-medium">Status</Label>
                  <Select name="status" defaultValue="Completed">
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="auditor" className="text-sm font-medium">Auditor</Label>
                  <Input
                    id="auditor"
                    name="auditor"
                    placeholder="Auditor name"
                    className="w-full"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Additional notes or observations..."
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAdding(false)}
                  className="min-w-[100px]"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={addMutation.isPending} className="min-w-[100px]">
                  {addMutation.isPending ? (
                    <>
                      <Spinner className="mr-2 h-4 w-4" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Add Audit
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Audit List */}
      <ScrollArea className="h-[450px] pr-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Spinner className="h-8 w-8 mb-2" />
            <p className="text-sm text-muted-foreground">Loading audit history...</p>
          </div>
        ) : audits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-3 mb-4">
              <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No audit records yet</p>
            <p className="text-xs text-muted-foreground">Add your first audit record to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {audits.map((audit: any) => {
              const auditDate = audit.auditDate ? new Date(audit.auditDate) : null
              const formattedDate = auditDate ? auditDate.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              }) : '-'
              
              return (
                <Card key={audit.id} className="hover:bg-accent/50 transition-colors border-border/50 py-2">
                  <CardContent className="py-2.5 px-4">
                    <div className="flex justify-between items-start gap-3">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="font-medium text-xs">
                            {audit.auditType}
                          </Badge>
                          {audit.status && (
                            <Badge
                              variant={
                                audit.status === 'Completed'
                                  ? 'default'
                                  : audit.status === 'Pending'
                                  ? 'secondary'
                                  : audit.status === 'In Progress'
                                  ? 'outline'
                                  : 'destructive'
                              }
                              className="font-medium text-xs"
                            >
                              {audit.status}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-sm">
                            <div className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                            <span className="text-muted-foreground text-xs">Date:</span>
                            <span className="text-foreground text-sm">{formattedDate}</span>
                          </div>
                          
                          {audit.auditor && (
                            <div className="flex items-center gap-1.5 text-sm">
                              <div className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                              <span className="text-muted-foreground text-xs">Auditor:</span>
                              <span className="text-foreground text-sm">{audit.auditor}</span>
                            </div>
                          )}
                          
                          {audit.notes && (
                            <div className="pt-1 mt-1 border-t border-border/50">
                              <p className="text-sm text-foreground leading-snug">{audit.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`Delete audit record "${audit.auditType}"?`)) {
                            deleteMutation.mutate(audit.id)
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="shrink-0 text-muted-foreground hover:text-destructive h-7 w-7"
                      >
                        {deleteMutation.isPending ? (
                          <Spinner className="h-3.5 w-3.5" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

// Checkout Manager Component
function CheckoutManager({ assetId }: { assetId: string; assetTagId: string }) {
  const queryClient = useQueryClient()
  const [editingCheckoutId, setEditingCheckoutId] = useState<string | null>(null)
  const [employeeSearch, setEmployeeSearch] = useState<Record<string, string>>({})

  // Fetch checkout records
  const { data: checkoutData, isLoading } = useQuery({
    queryKey: ['checkoutHistory', assetId],
    queryFn: async () => {
      const response = await fetch(`/api/assets/${assetId}/checkout`)
      if (!response.ok) throw new Error('Failed to fetch checkout history')
      return response.json()
    },
  })

  const checkouts = checkoutData?.checkouts || []

  // Fetch employees
  const { data: employees = [] } = useQuery({
    queryKey: ['employees', 'checkout-manager'],
    queryFn: async () => {
      const response = await fetch('/api/employees')
      if (!response.ok) throw new Error('Failed to fetch employees')
      const data = await response.json()
      return data.employees || []
    },
  })

  // Update checkout mutation
  const updateMutation = useMutation({
    mutationFn: async ({ checkoutId, employeeUserId }: { checkoutId: string; employeeUserId: string | null }) => {
      const response = await fetch(`/api/assets/checkout/${checkoutId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeUserId }),
      })
      if (!response.ok) throw new Error('Failed to update checkout')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkoutHistory', assetId] })
      queryClient.invalidateQueries({ queryKey: ['assets-list'] })
      setEditingCheckoutId(null)
      toast.success('Employee assigned successfully')
    },
    onError: () => {
      toast.error('Failed to assign employee')
    },
  })

  const handleAssignEmployee = (checkoutId: string, employeeUserId: string | null) => {
    updateMutation.mutate({ checkoutId, employeeUserId })
  }

  // Filter employees based on search
  const getFilteredEmployees = (checkoutId: string) => {
    const searchTerm = employeeSearch[checkoutId]?.toLowerCase() || ''
    if (!searchTerm) return employees
    return employees.filter((emp: { id: string; name: string; email: string; department?: string | null }) =>
      emp.name.toLowerCase().includes(searchTerm) || 
      emp.email.toLowerCase().includes(searchTerm) ||
      (emp.department && emp.department.toLowerCase().includes(searchTerm))
    )
  }

  // Sort checkouts: active first, then by date
  const sortedCheckouts = [...checkouts].sort((a, b) => {
    const aCheckedIn = a.checkins.length > 0
    const bCheckedIn = b.checkins.length > 0
    if (aCheckedIn !== bCheckedIn) return aCheckedIn ? 1 : -1
    return new Date(b.checkoutDate).getTime() - new Date(a.checkoutDate).getTime()
  })

  return (
    <div className="flex flex-col gap-4">
      {checkouts.length > 0 && (
        <div className="flex items-center justify-between px-1">
          <div className="text-sm text-muted-foreground">
            {checkouts.length} checkout record{checkouts.length !== 1 ? 's' : ''}
            {sortedCheckouts.filter(c => !c.checkins.length && !c.employeeUser).length > 0 && (
              <span className="ml-2 text-yellow-600 dark:text-yellow-500 font-medium">
                ({sortedCheckouts.filter(c => !c.checkins.length && !c.employeeUser).length} need assignment)
              </span>
            )}
          </div>
        </div>
      )}

      <ScrollArea>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Spinner className="h-8 w-8 mb-3" />
            <p className="text-sm text-muted-foreground">Loading checkout history...</p>
          </div>
        ) : checkouts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ArrowRight className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <p className="font-medium text-base mb-1">No checkout records found</p>
            <p className="text-sm">Checkout records will appear here when assets are checked out</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedCheckouts.map((checkout: {
              id: string
              checkoutDate: string
              expectedReturnDate: string | null
              employeeUser: { id: string; name: string; email: string; department: string | null } | null
              checkins: Array<{ id: string }>
            }) => {
              const checkoutDate = checkout.checkoutDate ? new Date(checkout.checkoutDate) : null
              const formattedDate = checkoutDate ? checkoutDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              }) : '-'
              
              const expectedReturnDate = checkout.expectedReturnDate ? new Date(checkout.expectedReturnDate) : null
              const formattedReturnDate = expectedReturnDate ? expectedReturnDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              }) : '-'

              const isCheckedIn = checkout.checkins.length > 0
              const needsAssignment = !checkout.employeeUser && !isCheckedIn
              const isEditing = editingCheckoutId === checkout.id
              const filteredEmployees = getFilteredEmployees(checkout.id)

              return (
                <Card 
                  key={checkout.id} 
                  className={`hover:bg-accent/50 transition-all border-2 ${
                    needsAssignment 
                      ? 'border-yellow-500/60 bg-yellow-50/30 dark:bg-yellow-950/20 shadow-sm' 
                      : isCheckedIn
                      ? 'border-border/40 bg-muted/20'
                      : 'border-border/50'
                  }`}
                >
                  <CardContent className="p-5 relative">
                    <div className="space-y-4">
                      {/* Header: Status badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="font-medium text-xs gap-1.5 px-2.5 py-1">
                          <Calendar className="h-3 w-3" />
                          {formattedDate}
                        </Badge>
                        {isCheckedIn ? (
                          <Badge variant="default" className="text-xs gap-1 px-2.5 py-1">
                            <CheckCircle className="h-3 w-3" />
                            Checked In
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs gap-1 px-2.5 py-1">
                            <Clock className="h-3 w-3" />
                            Active
                          </Badge>
                        )}
                        {needsAssignment && (
                          <Badge variant="secondary" className="text-xs gap-1 px-2.5 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700">
                            <UserPlus className="h-3 w-3" />
                            Needs Assignment
                          </Badge>
                        )}
                        {!isCheckedIn && !isEditing && checkout.employeeUser && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 shrink-0 ml-auto"
                            onClick={() => {
                              setEditingCheckoutId(checkout.id)
                              setEmployeeSearch(prev => ({ ...prev, [checkout.id]: '' }))
                            }}
                            disabled={updateMutation.isPending}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {isEditing && checkout.employeeUser && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 shrink-0 ml-auto"
                            onClick={() => {
                              setEditingCheckoutId(null)
                              setEmployeeSearch(prev => ({ ...prev, [checkout.id]: '' }))
                            }}
                            disabled={updateMutation.isPending}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      
                      {/* Divider */}
                      <div className="h-px bg-border/50" />
                      
                      {/* Details Section */}
                      <div className="space-y-3">
                        {/* Expected Return Date */}
                        {checkout.expectedReturnDate && (
                          <div className="flex items-center gap-2 text-sm">
                            <div className="h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
                            <span className="text-muted-foreground text-xs">Expected Return:</span>
                            <span className="text-foreground">{formattedReturnDate}</span>
                          </div>
                        )}
                        
                        {/* Employee Assignment */}
                        {isEditing ? (
                          <div className="space-y-2 p-3 bg-muted/50 rounded-md border border-primary/20">
                            <Label className="text-xs font-medium">Search Employee</Label>
                            <Input
                              placeholder="Search by name, email, or department..."
                              value={employeeSearch[checkout.id] || ''}
                              onChange={(e) => setEmployeeSearch(prev => ({ ...prev, [checkout.id]: e.target.value }))}
                              className="h-8 text-sm"
                            />
                            <div className="max-h-48 overflow-y-auto space-y-1">
                              {filteredEmployees.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-2">No employees found</p>
                              ) : (
                                filteredEmployees.slice(0, 10).map((emp: { id: string; name: string; email: string; department: string | null }) => (
                                  <Button
                                    key={emp.id}
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start h-auto py-2 px-3 text-left"
                                    onClick={() => handleAssignEmployee(checkout.id, emp.id)}
                                    disabled={updateMutation.isPending}
                                  >
                                    <div className="flex flex-col items-start gap-0.5">
                                      <span className="text-sm font-medium">{emp.name}</span>
                                      <span className="text-xs text-muted-foreground">{emp.email}</span>
                                      {emp.department && (
                                        <span className="text-xs text-muted-foreground">{emp.department}</span>
                                      )}
                                    </div>
                                  </Button>
                                ))
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full h-8 text-xs"
                                onClick={() => handleAssignEmployee(checkout.id, null)}
                                disabled={updateMutation.isPending}
                              >
                                Remove Assignment
                              </Button>
                            </div>
                          </div>
                        ) : checkout.employeeUser ? (
                          <div className="flex items-center gap-2 text-sm p-2 bg-muted/30 rounded-md">
                            <UserCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="font-medium text-sm truncate">{checkout.employeeUser.name}</span>
                              <span className="text-xs text-muted-foreground truncate">{checkout.employeeUser.email}</span>
                              {checkout.employeeUser.department && (
                                <span className="text-xs text-muted-foreground">{checkout.employeeUser.department}</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground p-2 bg-yellow-50/50 dark:bg-yellow-950/10 rounded-md border border-yellow-200 dark:border-yellow-800">
                            No employee assigned
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

export default function ListOfAssetsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  
  const canViewAssets = hasPermission('canViewAssets')
  
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    assetTag: true,
    description: true,
    category: true,
    subCategory: true,
    status: true,
    location: true,
    issuedTo: true,
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
    images: true,
  })
  const [isSelectOpen, setIsSelectOpen] = useState(false)
  const [shouldCloseSelect, setShouldCloseSelect] = useState(false)
  const [isPending, startTransition] = useTransition()
  
  // Convert column visibility to visible columns array for compatibility
  // Exclude Actions from count since it's always visible and not selectable
  const visibleColumns = useMemo(() => {
    return Object.entries(columnVisibility)
      .filter(([, visible]) => visible)
      .map(([key]) => key)
      .filter(key => key !== 'actions') // Exclude Actions from count
  }, [columnVisibility])
  
  // Get page, pageSize, and search from URL
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '100', 10)
  
  // Separate states for search input (immediate UI) and search query (debounced API calls)
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '')
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSearchQueryRef = useRef<string>(searchParams.get('search') || '')
  const previousSearchInputRef = useRef<string>(searchParams.get('search') || '')

  // Update URL parameters
  const updateURL = useCallback((updates: { page?: number; pageSize?: number; search?: string }) => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (updates.page !== undefined) {
      if (updates.page === 1) {
        params.delete('page')
      } else {
        params.set('page', updates.page.toString())
      }
    }
    
    if (updates.pageSize !== undefined) {
      if (updates.pageSize === 100) {
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
      } else {
        params.set('search', updates.search)
      }
      // Reset to page 1 when search changes
      params.delete('page')
    }
    
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false })
    })
  }, [searchParams, router, startTransition])

  const { data, isLoading, error } = useQuery({
    queryKey: ['assets-list', searchQuery, page, pageSize],
    queryFn: () => fetchAssets(searchQuery || undefined, page, pageSize),
    enabled: canViewAssets, // Only fetch if user has permission
  })

  const handlePageSizeChange = (newPageSize: string) => {
    updateURL({ pageSize: parseInt(newPageSize), page: 1 })
  }

  const handlePageChange = (newPage: number) => {
    updateURL({ page: newPage })
  }

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

  // Sync searchInput with URL params only on initial mount or external navigation
  useEffect(() => {
    const urlSearch = searchParams.get('search') || ''
    const currentSearchQuery = lastSearchQueryRef.current || ''
    
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
  }, [searchParams])
  
  useEffect(() => {
    lastSearchQueryRef.current = searchQuery
  }, [searchQuery])

  // Create columns
  const columns = useMemo(() => createColumns(), [])

  // Memoize assets data
  const assets = useMemo(() => data?.assets || [], [data?.assets])

  // eslint-disable-next-line react-hooks/incompatible-library
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

  // Exclude Actions from the "all selected" check since it's always visible
  const allSelected = Object.keys(columnVisibility)
    .filter(key => key !== 'actions')
    .filter(key => columnVisibility[key as keyof VisibilityState])
    .length === ALL_COLUMNS.filter(col => col.key !== 'actions').length

  const toggleColumn = (columnKey: string) => {
    // Don't allow toggling Actions column (always visible)
    if (columnKey === 'actions') {
      return
    }
    
    if (columnKey === 'select-all') {
      const newVisibility: VisibilityState = {}
      columns.forEach(col => {
        // Skip Actions as it's always visible
        if (col.id && col.id !== 'actions') {
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
        if (col.id && col.id !== 'actions') {
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

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-600">Error loading assets: {(error as Error).message}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">List of Assets</h1>
        <p className="text-muted-foreground">
          View and manage all assets in the system
        </p>
      </div>

      <Card className="relative flex flex-col flex-1 min-h-0 pb-0 ">
        <CardHeader>
          <div>
            <CardTitle>List of Assets</CardTitle>
            <CardDescription>View and manage all assets in the system</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex-1 px-0">
          <div className="flex items-center justify-between p-4 gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search assets..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select 
              open={isSelectOpen} 
              onOpenChange={handleSelectOpenChange}
              value=""
              onValueChange={(value) => {
                toggleColumn(value)
              }}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
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
                  const isAlwaysVisible = column.key === 'actions'
                  const isVisible = visibleColumns.includes(column.key)
                  
                  return (
                    <SelectItem
                      key={column.key}
                      value={column.key}
                      className={isVisible ? 'bg-accent' : ''}
                      disabled={isAlwaysVisible}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`size-4 rounded border flex items-center justify-center ${
                            isVisible
                              ? 'bg-primary border-primary'
                              : 'border-input'
                          } ${isAlwaysVisible ? 'opacity-50' : ''}`}
                        >
                          {isVisible && (
                            <svg
                              className="size-3 text-primary-foreground"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                        <span className={isAlwaysVisible ? 'opacity-50' : ''}>
                          {column.label}
                          {isAlwaysVisible && ' (Always visible)'}
                        </span>
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="h-125">
            {permissionsLoading || isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <Spinner className="h-8 w-8" />
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              </div>
            ) : !canViewAssets ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3 text-center">
                  <Package className="h-12 w-12 text-muted-foreground opacity-50" />
                  <p className="text-lg font-medium">Access Denied</p>
                  <p className="text-sm text-muted-foreground">
                    You do not have permission to view assets. Please contact your administrator.
                  </p>
                </div>
              </div>
            ) : assets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No assets found</p>
                <p className="text-sm">No assets match your search criteria</p>
              </div>
            ) : (
              <div className="min-w-full">
                <ScrollArea className='h-[calc(100vh-27rem)] min-h-[520px]'>
                <Table className='border-t'>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => {
                          const isActionsColumn = header.column.id === 'actions'
                          return (
                            <TableHead 
                              key={header.id}
                              className={cn(
                                isActionsColumn ? "text-right" : "text-left",
                                isActionsColumn && "sticky right-0 bg-card z-10"
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
                    {table.getRowModel().rows?.length ? (
                      table.getRowModel().rows.map((row) => (
                        <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                          {row.getVisibleCells().map((cell) => {
                            const isActionsColumn = cell.column.id === 'actions'
                            return (
                              <TableCell 
                                key={cell.id}
                                className={cn(
                                  isActionsColumn && "sticky right-0 bg-card z-10"
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
                          No assets found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                <ScrollBar orientation="horizontal" />
                <ScrollBar orientation="vertical" className='z-10' />
                </ScrollArea>
              </div>
            )}
          </div>
        </CardContent>
        
        {/* Pagination Bar - Fixed at Bottom */}
        <div className="sticky bottom-0 border-t bg-card z-10 shadow-sm mt-auto rounded-bl-lg rounded-br-lg">
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
                  <SelectItem value="100">100 rows</SelectItem>
                  <SelectItem value="200">200 rows</SelectItem>
                  <SelectItem value="300">300 rows</SelectItem>
                  <SelectItem value="400">400 rows</SelectItem>
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
    </div>
  )
}
