"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { XIcon, History, QrCode } from "lucide-react"
import { usePermissions } from '@/hooks/use-permissions'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { QRScannerDialog } from '@/components/qr-scanner-dialog'
import { QRCodeDisplayDialog } from '@/components/qr-code-display-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from 'sonner'
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldLabel, FieldContent } from "@/components/ui/field"
import { cn } from "@/lib/utils"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

interface Asset {
  id: string
  assetTagId: string
  description: string
  status?: string
  location?: string | null
  cost?: number | string | null
  category?: {
    id: string
    name: string
  } | null
  subCategory?: {
    id: string
    name: string
  } | null
}

interface DisposeAsset extends Asset {
  disposeReason?: string
  disposeValue?: string
  notes?: string
}

type DisposalMethod = "Sold" | "Donated" | "Scrapped" | "Lost/Missing" | "Destroyed" | ""

// Helper function to get status badge with colors
const getStatusBadge = (status: string | null) => {
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
  }
  
  return <Badge variant={statusVariant} className={statusColor}>{status}</Badge>
}

// Helper function to get badge color classes for disposal methods (solid background with white text)
const getDisposalMethodBadgeClass = (method: string): string => {
  const methodLC = method.toLowerCase().replace('/', '').replace(' ', '')
  switch (methodLC) {
    case "sold":
      return "bg-teal-500 text-white"
    case "donated":
      return "bg-blue-500 text-white"
   case "scrapped":
      return "bg-orange-500 text-white"
    case "lostmissing":
      return "bg-yellow-500 text-white"
    case "destroyed":
      return "bg-red-500 text-white"
    default:
      return "bg-gray-500 text-white"
  }
}

export default function DisposeAssetPage() {
  const queryClient = useQueryClient()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canViewAssets = hasPermission('canViewAssets')
  const canDispose = hasPermission('canDispose')
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionRef = useRef<HTMLDivElement>(null)
  const [assetIdInput, setAssetIdInput] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const [selectedAssets, setSelectedAssets] = useState<DisposeAsset[]>([])
  const [disposeDate, setDisposeDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const [disposalMethod, setDisposalMethod] = useState<DisposalMethod>("")
  const [disposeReason, setDisposeReason] = useState<string>("")
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [qrDisplayDialogOpen, setQrDisplayDialogOpen] = useState(false)
  const [selectedAssetTagForQR, setSelectedAssetTagForQR] = useState<string>("")

  // Fetch dispose statistics
  const { data: disposeStats, isLoading: isLoadingDisposeStats, error: disposeStatsError } = useQuery<{
    disposedTodayCount: number
    recentDisposals: Array<{
      id: string
      disposeDate: string
      disposalMethod: string
      disposeReason?: string | null
      disposeValue?: number | null
      notes?: string | null
      createdAt: string
      asset: {
        id: string
        assetTagId: string
        description: string
        category?: {
          id: string
          name: string
        } | null
        subCategory?: {
          id: string
          name: string
        } | null
      }
    }>
  }>({
    queryKey: ["dispose-stats"],
    queryFn: async () => {
      const response = await fetch("/api/assets/dispose/stats")
      if (!response.ok) {
        throw new Error('Failed to fetch dispose statistics')
      }
      const data = await response.json()
      return data
    },
    enabled: canViewAssets,
    retry: 2,
    retryDelay: 1000,
  })

  // Calculate time ago
  const getTimeAgo = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diffInSeconds < 60) {
      return 'just now'
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60)
    if (diffInMinutes < 60) {
      return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) {
      return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`
    }
    
    const diffInDays = Math.floor(diffInHours / 24)
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

  // List of disposal statuses that should be excluded from suggestions
  const disposalStatuses = ['Disposed', 'Sold', 'Donated', 'Scrapped', 'Lost/Missing', 'Destroyed']

  // Fetch asset suggestions based on input (exclude already disposed assets)
  const { data: assetSuggestions = [], isLoading: isLoadingSuggestions } = useQuery<Asset[]>({
    queryKey: ["asset-dispose-suggestions", assetIdInput, selectedAssets.length, showSuggestions],
    queryFn: async () => {
      // Filter out assets already in selected list
      const selectedIds = selectedAssets.map(a => a.id.toLowerCase())
      
      // If input is empty, show all available assets
      if (!assetIdInput.trim() || assetIdInput.length < 1) {
        const response = await fetch(`/api/assets?search=`)
        if (!response.ok) {
          throw new Error('Failed to fetch assets')
        }
        const data = await response.json()
        const assets = data.assets as Asset[]
        
        // Filter to exclude already disposed assets (any disposal status)
        return assets
          .filter(a => {
            const notSelected = !selectedIds.includes(a.id.toLowerCase())
            const notDisposed = !a.status || !disposalStatuses.includes(a.status)
            return notSelected && notDisposed
          })
          .slice(0, 20)
      }
      
      // If there's input, search for matching assets
      const response = await fetch(`/api/assets?search=${encodeURIComponent(assetIdInput.trim())}`)
      if (!response.ok) {
        throw new Error('Failed to fetch assets')
      }
      const data = await response.json()
      const assets = data.assets as Asset[]
      
      // Filter to exclude already disposed assets (any disposal status)
      return assets
        .filter(a => {
          const notSelected = !selectedIds.includes(a.id.toLowerCase())
          const notDisposed = !a.status || !disposalStatuses.includes(a.status)
          return notSelected && notDisposed
        })
        .slice(0, 10)
    },
    enabled: showSuggestions && canViewAssets && canDispose,
    staleTime: 300,
  })

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        suggestionRef.current &&
        !suggestionRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  // Find asset by ID without disposal check (for error messages)
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

  // Asset lookup by ID (only returns if not already disposed)
  const lookupAsset = async (assetTagId: string): Promise<Asset | null> => {
    const asset = await findAssetById(assetTagId)
    
    if (!asset) {
      return null
    }
    
    // Check if asset is already disposed (any disposal status)
    const disposalStatuses = ['Disposed', 'Sold', 'Donated', 'Scrapped', 'Lost/Missing', 'Destroyed']
    if (asset.status && disposalStatuses.includes(asset.status)) {
      return null
    }
    
    return asset
  }

  // Handle suggestion selection
  const handleSelectSuggestion = (asset: Asset) => {
    const disposeAsset: DisposeAsset = {
      ...asset,
      disposeReason: "",
      disposeValue: "",
      notes: "",
    }
    setSelectedAssets(prev => [...prev, disposeAsset])
    setAssetIdInput("")
    setShowSuggestions(false)
    setSelectedSuggestionIndex(-1)
    toast.success('Asset added to disposal list')
  }

  // Handle asset selection
  const handleSelectAsset = async (asset?: Asset) => {
    const assetToSelect = asset || await lookupAsset(assetIdInput.trim())
    
    if (assetToSelect) {
      const disposeAsset: DisposeAsset = {
        ...assetToSelect,
        disposeReason: "",
        disposeValue: "",
        notes: "",
      }
      setSelectedAssets(prev => [...prev, disposeAsset])
      setAssetIdInput("")
      setShowSuggestions(false)
      toast.success('Asset added to disposal list')
    } else {
      if (!asset) {
        // Check if asset exists but is already disposed
        const assetExists = await findAssetById(assetIdInput.trim())
        if (assetExists) {
          const disposalStatuses = ['Disposed', 'Sold', 'Donated', 'Scrapped', 'Lost/Missing', 'Destroyed']
          if (assetExists.status && disposalStatuses.includes(assetExists.status)) {
            toast.error(`Asset "${assetExists.assetTagId}" has already been disposed. Current status: ${assetExists.status}`)
          } else {
            toast.error(`Asset "${assetExists.assetTagId}" is not available for disposal`)
          }
        } else {
          toast.error(`Asset with ID "${assetIdInput}" not found`)
        }
      }
    }
  }

  // Handle keyboard navigation in suggestions
  const handleSuggestionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedSuggestionIndex((prev) =>
          prev < assetSuggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < assetSuggestions.length) {
          handleSelectSuggestion(assetSuggestions[selectedSuggestionIndex])
        } else if (assetIdInput.trim()) {
          handleSelectAsset()
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowSuggestions(false)
        setSelectedSuggestionIndex(-1)
        break
    }
  }

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAssetIdInput(e.target.value)
    setShowSuggestions(true)
    setSelectedSuggestionIndex(-1)
  }

  // Handle focus to show all assets
  const handleInputFocus = () => {
    setShowSuggestions(true)
  }

  // Remove asset from selected list
  const handleRemoveAsset = (assetId: string) => {
    setSelectedAssets(prev => prev.filter(a => a.id !== assetId))
    toast.success('Asset removed from disposal list')
  }

  // Track form changes to show floating buttons
  const isFormDirty = useMemo(() => {
    return !!(
      selectedAssets.length > 0 ||
      disposalMethod ||
      disposeReason.trim()
    )
  }, [selectedAssets, disposalMethod, disposeReason])

  // Clear form function
  const clearForm = () => {
    setSelectedAssets([])
    setAssetIdInput("")
    setDisposalMethod("")
    setDisposeReason("")
  }

  // Handle QR code scan result
  const handleQRScan = async (decodedText: string) => {
    // First check if asset exists (regardless of disposal status)
    const assetExists = await findAssetById(decodedText)
    
    if (!assetExists) {
      toast.error(`Asset with ID "${decodedText}" not found`)
      return
    }
    
    // Check if asset is already disposed
    const disposalStatuses = ['Disposed', 'Sold', 'Donated', 'Scrapped', 'Lost/Missing', 'Destroyed']
    if (assetExists.status && disposalStatuses.includes(assetExists.status)) {
      toast.error(`Asset "${assetExists.assetTagId}" has already been disposed. Current status: ${assetExists.status}`)
      return
    }
    
    // Asset exists and is not disposed, proceed to add it
    await handleSelectAsset(assetExists)
  }

  // Update asset field
  const handleUpdateAsset = (assetId: string, field: keyof DisposeAsset, value: string) => {
    setSelectedAssets(prev =>
      prev.map(a => (a.id === assetId ? { ...a, [field]: value } : a))
    )
  }

  // Format currency in PHP
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PHP',
    }).format(value)
  }

  // Dispose mutation
  const disposeMutation = useMutation({
    mutationFn: async (data: {
      assetIds: string[]
      disposeDate: string
      disposeReason: string
      disposeReasonText?: string
      disposeValue?: string
      updates: Record<string, { disposeValue?: string; notes?: string }>
    }) => {
      const response = await fetch('/api/assets/dispose', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to dispose assets')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] })
      queryClient.invalidateQueries({ queryKey: ["dispose-stats"] })
      toast.success('Assets disposed successfully')
      // Reset form
      clearForm()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to dispose assets')
    },
  })

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedAssets.length === 0) {
      toast.error('Please select at least one asset to dispose')
      return
    }

    if (!disposeDate) {
      toast.error('Please enter a dispose date')
      return
    }

    if (!disposalMethod) {
      toast.error('Please select a disposal method')
      return
    }

    // Validate dispose value for "Sold" method
    if (disposalMethod === 'Sold') {
      const invalidAssets = selectedAssets.filter(a => !a.disposeValue || parseFloat(a.disposeValue) <= 0)
      if (invalidAssets.length > 0) {
        toast.error('Please enter a valid dispose value for all sold assets')
        return
      }
    }

    const assetIds = selectedAssets.map(a => a.id)
    const updates: Record<string, { disposeValue?: string; notes?: string }> = {}
    
    selectedAssets.forEach(asset => {
      updates[asset.id] = {
        disposeValue: asset.disposeValue,
        notes: asset.notes,
      }
    })

    // Use the common dispose value for all assets, but allow individual dispose values and notes
    const commonDisposeValue = disposalMethod === 'Sold' && selectedAssets.length === 1 
      ? selectedAssets[0].disposeValue 
      : undefined

    disposeMutation.mutate({
      assetIds,
      disposeDate,
      disposeReason: disposalMethod, // API still expects disposeReason for the method
      disposeValue: commonDisposeValue,
      disposeReasonText: disposeReason, // Additional text reason
      updates,
    })
  }

  return (
    <div className={isFormDirty ? "pb-16" : ""}>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dispose Asset</h1>
        <p className="text-muted-foreground">
          Mark assets as disposed (sold, donated, scrapped, lost/missing, etc.)
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1">
        {/* Recent History */}
        <Card className="flex flex-col py-0 gap-2">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-purple-100 text-purple-500">
                <History className="h-4 w-4" />
              </div>
              <CardTitle className="text-sm font-medium">Recent History</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {permissionsLoading || isLoadingDisposeStats ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex flex-col items-center gap-3">
                  <Spinner variant="default" size={24} className="text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">Loading...</p>
                </div>
              </div>
            ) : !canViewAssets ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <History className="h-8 w-8 text-muted-foreground opacity-50 mb-2" />
                <p className="text-sm font-medium">Access Denied</p>
                <p className="text-xs text-muted-foreground">
                  You do not have permission to view assets.
                </p>
              </div>
            ) : disposeStatsError ? (
              <p className="text-sm text-destructive text-center py-4">
                Failed to load history. Please try again.
              </p>
            ) : !disposeStats?.recentDisposals || disposeStats.recentDisposals.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No disposal history
              </p>
            ) : (
              <ScrollArea className="h-52">
                <div className="relative w-full">
                  <Table className="w-full caption-bottom text-sm">
                    <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                        <TableHead className="h-8 text-xs bg-card">Asset ID</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Category</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Reason</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Value</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Dispose Date</TableHead>
                        <TableHead className="h-8 text-xs text-right bg-card">Time Ago</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disposeStats.recentDisposals.map((disposal) => (
                      <TableRow key={disposal.id} className="h-10">
                        <TableCell className="py-1.5">
                          <Badge 
                            variant="outline" 
                            className="text-xs cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors"
                            onClick={() => {
                              setSelectedAssetTagForQR(disposal.asset.assetTagId)
                              setQrDisplayDialogOpen(true)
                            }}
                          >
                            {disposal.asset.assetTagId}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground">
                          {disposal.asset.category?.name || 'No Category'}
                          {disposal.asset.subCategory?.name && ` - ${disposal.asset.subCategory.name}`}
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Badge className={cn("text-xs text-white border-0", getDisposalMethodBadgeClass(disposal.disposalMethod))}>
                            {disposal.disposalMethod}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground">
                          {disposal.disposeValue ? formatCurrency(Number(disposal.disposeValue)) : '-'}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground">
                          {new Date(disposal.disposeDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground text-right">
                          {getTimeAgo(disposal.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  </Table>
              </div>
              <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 mt-6">
        {/* Disposal Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Asset Selection</CardTitle>
            <CardDescription className="text-xs">
              Type asset ID and press Enter, or select an asset from the suggestions to add to the disposal list
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2 pb-4 space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
              <Input
                ref={inputRef}
                placeholder="Enter asset ID (e.g., AT-001) or select from suggestions"
                value={assetIdInput}
                onChange={handleInputChange}
                onKeyDown={handleSuggestionKeyDown}
                onFocus={handleInputFocus}
                className="w-full"
                autoComplete="off"
                disabled={!canViewAssets || !canDispose}
              />
              {assetIdInput && (
                <button
                  type="button"
                  onClick={() => {
                    setAssetIdInput("")
                    setShowSuggestions(false)
                  }}
                  className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 hover:bg-transparent cursor-pointer"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              )}

              {/* Suggestions Dropdown */}
              {showSuggestions && (
                <div
                  ref={suggestionRef}
                  className="absolute z-50 w-full mt-2 bg-popover border rounded-md shadow-md max-h-[300px] overflow-auto"
                >
                  {isLoadingSuggestions ? (
                    <div className="flex items-center justify-center p-4">
                      <div className="flex flex-col items-center gap-2">
                        <Spinner variant="default" size={20} className="text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Loading assets...</p>
                      </div>
                    </div>
                  ) : assetSuggestions.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      No assets found
                    </div>
                  ) : (
                    assetSuggestions.map((asset, index) => (
                      <div
                        key={asset.id}
                        className={cn(
                          "px-4 py-3 cursor-pointer hover:bg-accent",
                          index === selectedSuggestionIndex && "bg-accent"
                        )}
                        onClick={() => handleSelectSuggestion(asset)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{asset.assetTagId}</div>
                            <div className="text-sm text-muted-foreground">
                              {asset.category?.name || 'No Category'}
                              {asset.subCategory?.name && ` - ${asset.subCategory.name}`}
                            </div>
                          </div>
                          {getStatusBadge(asset.status || 'Available')}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
              </div>
              {canViewAssets && canDispose && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setQrDialogOpen(true)}
                  title="QR Code"
                >
                  <QrCode className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Selected Assets List */}
            {selectedAssets.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Selected Assets ({selectedAssets.length})
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-start justify-between gap-2 p-3 border rounded-md bg-muted/50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{asset.assetTagId}</Badge>
                          <span className="text-sm font-medium truncate">
                            {asset.category?.name || 'No Category'}
                            {asset.subCategory?.name && ` - ${asset.subCategory.name}`}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {getStatusBadge(asset.status || 'Available')}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleRemoveAsset(asset.id)}
                        >
                          <XIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                
              </div>
            )}
          </CardContent>
        </Card>

        {/* Disposal Details */}
        <Card>
          <CardHeader>
            <CardTitle>Disposal Details</CardTitle>
            <CardDescription>
              Enter disposal information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Dispose Date</FieldLabel>
                <FieldContent>
                  <Input
                    type="date"
                    value={disposeDate}
                    onChange={(e) => setDisposeDate(e.target.value)}
                    required
                    disabled={!canViewAssets || !canDispose}
                  />
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel>Disposal Method</FieldLabel>
                <FieldContent>
                  <Select
                    value={disposalMethod}
                    onValueChange={(value) => setDisposalMethod(value as DisposalMethod)}
                    disabled={!canViewAssets || !canDispose}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select disposal method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sold">Sold</SelectItem>
                      <SelectItem value="Donated">Donated</SelectItem>
                      <SelectItem value="Scrapped">Scrapped</SelectItem>
                      <SelectItem value="Lost/Missing">Lost/Missing</SelectItem>
                      <SelectItem value="Destroyed">Destroyed</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>
            </div>

            <Field>
              <FieldLabel>Dispose Reason</FieldLabel>
              <FieldContent>
                <Textarea
                  placeholder="Enter the reason for disposal (optional)"
                  value={disposeReason || ""}
                  onChange={(e) => setDisposeReason(e.target.value)}
                  rows={3}
                  disabled={!canViewAssets || !canDispose}
                />
              </FieldContent>
            </Field>
            {/* Asset Details Forms */}
            <div className="space-y-4 mt-4">
                  {selectedAssets.map((asset) => (
                    <Card key={asset.id} className="p-4">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{asset.assetTagId}</Badge>
                          <span className="text-sm font-medium">
                            {asset.category?.name || 'No Category'}
                            {asset.subCategory?.name && ` - ${asset.subCategory.name}`}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Field>
                            <FieldLabel>Dispose Value {disposalMethod === 'Sold' && '(Required)'}</FieldLabel>
                            <FieldContent>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={asset.disposeValue || ""}
                                onChange={(e) => handleUpdateAsset(asset.id, 'disposeValue', e.target.value)}
                                disabled={disposalMethod !== 'Sold' || !canViewAssets || !canDispose}
                              />
                            </FieldContent>
                          </Field>
                          <Field>
                            <FieldLabel>Notes</FieldLabel>
                            <FieldContent>
                              <Textarea
                                placeholder="Additional notes..."
                                value={asset.notes || ""}
                                onChange={(e) => handleUpdateAsset(asset.id, 'notes', e.target.value)}
                                rows={2}
                                disabled={!canViewAssets || !canDispose}
                              />
                            </FieldContent>
                          </Field>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
          </CardContent>
        </Card>

      </form>

      {/* Floating Action Buttons - Only show when form has changes */}
      {isFormDirty && canViewAssets && canDispose && (
        <div className="fixed bottom-6 z-50 flex items-center justify-center gap-3 left-1/2 -translate-x-1/2 md:left-[calc(var(--sidebar-width,16rem)+((100vw-var(--sidebar-width,16rem))/2))] md:translate-x-[-50%]">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={clearForm}
            className="min-w-[120px]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={() => {
              const form = document.querySelector('form') as HTMLFormElement
              if (form) {
                form.requestSubmit()
              }
            }}
            disabled={disposeMutation.isPending || selectedAssets.length === 0 || !canViewAssets || !canDispose}
            className="min-w-[120px]"
          >
            {disposeMutation.isPending ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Disposing...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </div>
      )}

      {/* QR Code Scanner Dialog */}
      <QRScannerDialog
        open={qrDialogOpen}
        onOpenChange={setQrDialogOpen}
        onScan={handleQRScan}
        description="Scan or upload a QR code to add an asset"
      />
          
      {/* QR Code Display Dialog */}
      <QRCodeDisplayDialog
        open={qrDisplayDialogOpen}
        onOpenChange={setQrDisplayDialogOpen}
        assetTagId={selectedAssetTagForQR}
      />
    </div>
  )
}
