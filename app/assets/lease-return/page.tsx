"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { XIcon, History, QrCode, Table } from "lucide-react"
import { usePermissions } from '@/hooks/use-permissions'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { QRScannerDialog } from '@/components/qr-scanner-dialog'
import { QRCodeDisplayDialog } from '@/components/qr-code-display-dialog'
import {
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

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
  leases?: Array<{
    id: string
    lessee: string
    leaseStartDate: string
    leaseEndDate?: string | null
    returns?: Array<{
      id: string
      returnDate: string
    }>
  }>
}

interface LeaseReturnAsset extends Asset {
  leaseId?: string
  lessee?: string
  leaseStartDate?: string
  leaseEndDate?: string | null
  condition?: string
  notes?: string
}

export default function LeaseReturnPage() {
  const queryClient = useQueryClient()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canViewAssets = hasPermission('canViewAssets')
  const canLease = hasPermission('canLease')
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionRef = useRef<HTMLDivElement>(null)
  const [assetIdInput, setAssetIdInput] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const [selectedAssets, setSelectedAssets] = useState<LeaseReturnAsset[]>([])
  const [returnDate, setReturnDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [qrDisplayDialogOpen, setQrDisplayDialogOpen] = useState(false)
  const [selectedAssetTagForQR, setSelectedAssetTagForQR] = useState<string>("")

  // Fetch lease return statistics
  const { data: returnStats, isLoading: isLoadingReturnStats, error: returnStatsError } = useQuery<{
    totalReturned: number
    recentReturns: Array<{
      id: string
      returnDate: string
      condition?: string | null
      createdAt: string
      asset: {
        id: string
        assetTagId: string
        description: string
      }
      lease: {
        id: string
        lessee: string
        leaseStartDate: string
      }
    }>
  }>({
    queryKey: ["lease-return-stats"],
    queryFn: async () => {
      const response = await fetch("/api/assets/lease-return/stats")
      if (!response.ok) {
        throw new Error('Failed to fetch lease return statistics')
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

  // Fetch asset suggestions based on input (only Leased assets)
  const { data: assetSuggestions = [], isLoading: isLoadingSuggestions } = useQuery<Asset[]>({
    queryKey: ["asset-lease-return-suggestions", assetIdInput, selectedAssets.length, showSuggestions],
    queryFn: async () => {
      // Filter out assets already in selected list
      const selectedIds = selectedAssets.map(a => a.id.toLowerCase())
      
      // If input is empty, show all leased assets
      if (!assetIdInput.trim() || assetIdInput.length < 1) {
        // Fetch with larger page size to get more results
        const response = await fetch(`/api/assets?search=&pageSize=100`)
        if (!response.ok) {
          throw new Error('Failed to fetch assets')
        }
        const data = await response.json()
        const assets = data.assets as Asset[]
        
        // Filter to only show assets with active leases that haven't been returned
        return assets
          .filter(a => {
            const notSelected = !selectedIds.includes(a.id.toLowerCase())
            const activeLease = a.leases && a.leases.length > 0 ? a.leases[0] : null
            const hasActiveLease = !!activeLease
            // Check if the active lease has already been returned
            const isAlreadyReturned = activeLease?.returns && activeLease.returns.length > 0
            return notSelected && hasActiveLease && !isAlreadyReturned
          })
          .slice(0, 20)
      }
      
      // If there's input, search for matching assets with larger page size
      // Use a large pageSize to ensure we find the asset even if paginated
      const response = await fetch(`/api/assets?search=${encodeURIComponent(assetIdInput.trim())}&pageSize=100`)
      if (!response.ok) {
        throw new Error('Failed to fetch assets')
      }
      const data = await response.json()
      const assets = data.assets as Asset[]
      
        // Filter to only show assets with active leases that haven't been returned
        return assets
          .filter(a => {
            const notSelected = !selectedIds.includes(a.id.toLowerCase())
            const activeLease = a.leases && a.leases.length > 0 ? a.leases[0] : null
            const hasActiveLease = !!activeLease
            // Check if the active lease has already been returned
            const isAlreadyReturned = activeLease?.returns && activeLease.returns.length > 0
            return notSelected && hasActiveLease && !isAlreadyReturned
          })
          .slice(0, 10)
    },
    enabled: showSuggestions && canViewAssets && canLease,
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

  // Find asset by ID without lease check (for error messages)
  const findAssetById = async (assetTagId: string): Promise<Asset | null> => {
    try {
      // Use larger pageSize to ensure we find the asset even if paginated
      const response = await fetch(`/api/assets?search=${encodeURIComponent(assetTagId)}&pageSize=100`)
      if (!response.ok) {
        throw new Error('Failed to fetch assets')
      }
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

  // Asset lookup by ID (only returns if has active lease that hasn't been returned)
  const lookupAsset = async (assetTagId: string): Promise<Asset | null> => {
    const asset = await findAssetById(assetTagId)
    
    if (!asset) {
      return null
    }
      
      // Check if asset has an active lease that hasn't been returned
        const activeLease = asset.leases && asset.leases.length > 0 ? asset.leases[0] : null
        if (!activeLease) {
          return null
        }
        // Check if the active lease has already been returned
        if (activeLease.returns && activeLease.returns.length > 0) {
          return null
        }
      
    return asset
  }

  // Handle suggestion selection
  const handleSelectSuggestion = (asset: Asset) => {
    // Get the most recent active lease
    const activeLease = asset.leases?.[0]
    
    if (!activeLease) {
      toast.error('No active lease found for this asset')
      return
    }

    const leaseReturnAsset: LeaseReturnAsset = {
      ...asset,
      leaseId: activeLease.id,
      lessee: activeLease.lessee,
      leaseStartDate: activeLease.leaseStartDate,
      leaseEndDate: activeLease.leaseEndDate || null,
    }

    setSelectedAssets((prev) => [...prev, leaseReturnAsset])
    setAssetIdInput("")
    setShowSuggestions(false)
    setSelectedSuggestionIndex(-1)
    toast.success('Asset selected')
  }

  // Handle asset selection
  const handleSelectAsset = async (asset?: Asset) => {
    const assetToSelect = asset || await lookupAsset(assetIdInput.trim())
    
    if (!assetToSelect) {
    if (!asset) {
        // Check if asset exists but doesn't meet lease return criteria
        const assetExists = await findAssetById(assetIdInput.trim())
        if (assetExists) {
          const activeLease = assetExists.leases?.[0]
          if (!activeLease) {
            toast.error(`Asset "${assetExists.assetTagId}" is not currently leased`)
          } else if (activeLease.returns && activeLease.returns.length > 0) {
            toast.error(`Asset "${assetExists.assetTagId}" has already been returned`)
          } else {
            toast.error(`Asset "${assetExists.assetTagId}" is not available for return`)
          }
        } else {
          toast.error(`Asset with ID "${assetIdInput}" not found`)
        }
      }
      return
    }

    // Get the most recent active lease
    const activeLease = assetToSelect.leases?.[0]
    
    if (!activeLease) {
      toast.error('No active lease found for this asset')
      return
    }

    const leaseReturnAsset: LeaseReturnAsset = {
      ...assetToSelect,
      leaseId: activeLease.id,
      lessee: activeLease.lessee,
      leaseStartDate: activeLease.leaseStartDate,
      leaseEndDate: activeLease.leaseEndDate || null,
    }

    setSelectedAssets((prev) => [...prev, leaseReturnAsset])
    setAssetIdInput("")
    setShowSuggestions(false)
    toast.success('Asset selected')
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
    setSelectedAssets((prev) => prev.filter((a) => a.id !== assetId))
    toast.success('Asset removed')
  }

  // Track form changes to show floating buttons - only show when asset is selected
  const isFormDirty = useMemo(() => {
    // Only show floating buttons when assets are actually selected
    return selectedAssets.length > 0
  }, [selectedAssets])

  // Clear form function
  const clearForm = () => {
    setSelectedAssets([])
    setAssetIdInput("")
    setReturnDate(new Date().toISOString().split('T')[0])
  }

  // Handle QR code scan result
  const handleQRScan = async (decodedText: string) => {
    // First check if asset exists (regardless of lease status)
    const assetExists = await findAssetById(decodedText)
    
    if (!assetExists) {
      toast.error(`Asset with ID "${decodedText}" not found`)
      return
    }
    
    // Check if asset has active lease
    const activeLease = assetExists.leases?.[0]
    if (!activeLease) {
      toast.error(`Asset "${assetExists.assetTagId}" is not currently leased`)
      return
    }
    
    // Check if lease has already been returned
    if (activeLease.returns && activeLease.returns.length > 0) {
      toast.error(`Asset "${assetExists.assetTagId}" has already been returned`)
      return
    }
    
    // Asset exists and has active lease that hasn't been returned, proceed to select it
    await handleSelectAsset(assetExists)
  }

  // Update asset condition/notes
  const handleUpdateAsset = (assetId: string, field: 'condition' | 'notes', value: string) => {
    setSelectedAssets((prev) =>
      prev.map((a) => (a.id === assetId ? { ...a, [field]: value } : a))
    )
  }

  // Lease return mutation
  const returnMutation = useMutation({
    mutationFn: async (data: {
      assetIds: string[]
      returnDate: string
      updates: Record<string, { condition?: string; notes?: string }>
    }) => {
      const response = await fetch('/api/assets/lease-return', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to return leased assets')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] })
      queryClient.invalidateQueries({ queryKey: ["lease-return-stats"] })
      queryClient.invalidateQueries({ queryKey: ["lease-stats"] })
      toast.success('Leased assets returned successfully')
      clearForm()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to return leased assets')
    },
  })

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedAssets.length === 0) {
      toast.error('Please select at least one asset to return')
      return
    }

    if (!returnDate) {
      toast.error('Please select a return date')
      return
    }

    // Build updates object
    const updates: Record<string, { condition?: string; notes?: string }> = {}
    selectedAssets.forEach((asset) => {
      updates[asset.id] = {
        condition: asset.condition || undefined,
        notes: asset.notes || undefined,
      }
    })

    returnMutation.mutate({
      assetIds: selectedAssets.map((a) => a.id),
      returnDate,
      updates,
    })
  }

  const recentReturns = returnStats?.recentReturns || []

  return (
    <div className={isFormDirty ? "pb-16" : ""}>
      <div>
        <h1 className="text-3xl font-bold">Lease Return</h1>
        <p className="text-muted-foreground">
          Return leased assets back into the system
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 mt-6">
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
            {permissionsLoading || isLoadingReturnStats ? (
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
            ) : returnStatsError ? (
              <p className="text-sm text-destructive text-center py-4">
                Failed to load history. Please try again.
              </p>
            ) : recentReturns.length > 0 ? (
              <ScrollArea className="h-52">
                <div className="relative w-full">
                  <Table className="w-full caption-bottom text-sm">
                    <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                        <TableHead className="h-8 text-xs bg-card">Asset ID</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Lessee</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Condition</TableHead>
                        <TableHead className="h-8 text-xs text-right bg-card">Time Ago</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentReturns.map((returnRecord) => (
                      <TableRow key={returnRecord.id} className="h-10">
                        <TableCell className="py-1.5">
                          <Badge 
                            variant="outline" 
                            className="text-xs cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors"
                            onClick={() => {
                              setSelectedAssetTagForQR(returnRecord.asset.assetTagId)
                              setQrDisplayDialogOpen(true)
                            }}
                          >
                            {returnRecord.asset.assetTagId}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground">
                          {returnRecord.lease.lessee}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground">
                          {returnRecord.condition || '-'}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground text-right">
                          {getTimeAgo(returnRecord.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  </Table>
              </div>
              <ScrollBar orientation="horizontal" />
              <ScrollBar orientation="vertical" className='z-10' />
              </ScrollArea>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No recent returns
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 mt-6">
        {/* Asset Selection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Asset Selection</CardTitle>
            <CardDescription className="text-xs">
              Type asset ID and press Enter, or select an asset from the suggestions
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
                disabled={!canViewAssets || !canLease}
              />
              
              {/* Suggestions dropdown */}
              {showSuggestions && (
                <div
                  ref={suggestionRef}
                  className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-auto"
                >
                  {isLoadingSuggestions ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="flex flex-col items-center gap-2">
                        <Spinner variant="default" size={20} className="text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Loading assets...</p>
                      </div>
                    </div>
                  ) : assetSuggestions.length > 0 ? (
                    assetSuggestions.map((asset, index) => (
                      <div
                        key={asset.id}
                        onClick={() => handleSelectSuggestion(asset)}
                        onMouseEnter={() => setSelectedSuggestionIndex(index)}
                        className={cn(
                          "px-4 py-3 cursor-pointer transition-colors",
                          "hover:bg-accent",
                          selectedSuggestionIndex === index && "bg-accent"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{asset.assetTagId}</div>
                            <div className="text-sm text-muted-foreground">
                              {asset.category?.name || 'No Category'}
                              {asset.subCategory?.name && ` - ${asset.subCategory.name}`}
                            </div>
                          </div>
                          <Badge variant="outline">{asset.status || 'Leased'}</Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No leased assets found. Start typing to search...
                      </div>
                    )}
                </div>
              )}
              </div>
              {canViewAssets && canLease && (
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
          </CardContent>
        </Card>

        {/* Selected Assets and Return Details */}
        {selectedAssets.length > 0 && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Selected Assets for Return</CardTitle>
                <CardDescription className="text-xs">
                  Review and provide return details for each asset
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2 pb-4 space-y-4">
                <Field>
                  <FieldLabel htmlFor="returnDate">
                    Return Date <span className="text-destructive">*</span>
                  </FieldLabel>
                  <FieldContent>
                    <Input
                      id="returnDate"
                      type="date"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="w-full"
                      disabled={!canViewAssets || !canLease}
                    />
                  </FieldContent>
                </Field>

                {selectedAssets.map((asset) => (
                  <div key={asset.id} className="p-4 border rounded-md space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{asset.assetTagId}</Badge>
                          <span className="text-sm font-medium truncate">
                            {asset.category?.name || 'No Category'}
                            {asset.subCategory?.name && ` - ${asset.subCategory.name}`}
                          </span>
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          {asset.lessee && (
                            <p>Leased to: {asset.lessee}</p>
                          )}
                          {asset.leaseStartDate && (
                            <p>Lease Start: {new Date(asset.leaseStartDate).toLocaleDateString()}</p>
                          )}
                          {asset.location && (
                            <p>Location: {asset.location}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveAsset(asset.id)}
                        className="h-8 w-8 shrink-0"
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-3 pt-2 border-t">
                      <Field>
                        <FieldLabel htmlFor={`condition-${asset.id}`}>
                          Asset Condition
                        </FieldLabel>
                        <FieldContent>
                          <Select
                            value={asset.condition || ""}
                            onValueChange={(value) => handleUpdateAsset(asset.id, 'condition', value)}
                            disabled={!canViewAssets || !canLease}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select condition" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Excellent">Excellent</SelectItem>
                              <SelectItem value="Good">Good</SelectItem>
                              <SelectItem value="Fair">Fair</SelectItem>
                              <SelectItem value="Poor">Poor</SelectItem>
                              <SelectItem value="Damaged">Damaged</SelectItem>
                            </SelectContent>
                          </Select>
                        </FieldContent>
                      </Field>

                      <Field>
                        <FieldLabel htmlFor={`notes-${asset.id}`}>
                          Notes
                        </FieldLabel>
                        <FieldContent>
                          <Textarea
                            id={`notes-${asset.id}`}
                            placeholder="Enter any notes about the return"
                            value={asset.notes || ""}
                            onChange={(e) => handleUpdateAsset(asset.id, 'notes', e.target.value)}
                            className="w-full"
                            rows={2}
                            disabled={!canViewAssets || !canLease}
                          />
                        </FieldContent>
                      </Field>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </form>

      {/* Floating Action Buttons - Only show when form has changes */}
      {isFormDirty && canViewAssets && canLease && (
        <div className="fixed bottom-6 z-50 flex items-center justify-center gap-3 left-1/2 -translate-x-1/2 md:left-[calc(var(--sidebar-width,16rem)+((100vw-var(--sidebar-width,16rem))/2))] md:translate-x-[-50%]">
              <Button
                type="button"
                variant="outline"
            size="lg"
            onClick={clearForm}
            className="min-w-[120px] bg-accent!"
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
            disabled={returnMutation.isPending || selectedAssets.length === 0 || !canViewAssets || !canLease}
            className="min-w-[120px]"
          >
            {returnMutation.isPending ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Returning...
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
        description="Scan or upload a QR code to select an asset"
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
