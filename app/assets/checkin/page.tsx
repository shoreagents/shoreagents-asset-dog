"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { XIcon, Package, CheckCircle2, DollarSign, History, QrCode } from "lucide-react"
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface Asset {
  id: string
  assetTagId: string
  description: string
  status?: string
  location?: string | null
  cost?: number | null
  category?: {
    id: string
    name: string
  } | null
  subCategory?: {
    id: string
    name: string
  } | null
  checkouts?: {
    id: string
    checkoutDate: string
    expectedReturnDate?: string | null
    employeeUser: {
      id: string
      name: string
      email: string
      department: string | null
    }
  }[]
}

interface CheckinAsset extends Asset {
  checkoutId?: string
  employeeName?: string
  employeeEmail?: string
  employeeDepartment?: string | null
  checkoutDate?: string
  expectedReturnDate?: string | null
  condition?: string
  notes?: string
  returnLocation?: string
}

// Helper function to get status badge with colors (for Checked out status on checkin page)
const getStatusBadge = (status: string | null) => {
  if (!status) return null
  const statusLC = status.toLowerCase()
  
  // Show blue badge for Checked out status (checkin page only handles checked out assets)
  if (statusLC === 'checked out' || statusLC === 'in use') {
    return <Badge variant="destructive" className="bg-blue-500">{status}</Badge>
  }
  
  // For any other status (shouldn't happen for checkin, but just in case)
  return <Badge variant="outline">{status}</Badge>
}

export default function CheckinPage() {
  const queryClient = useQueryClient()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canViewAssets = hasPermission('canViewAssets')
  const canCheckin = hasPermission('canCheckin')
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionRef = useRef<HTMLDivElement>(null)
  const [assetIdInput, setAssetIdInput] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const [selectedAssets, setSelectedAssets] = useState<CheckinAsset[]>([])
  const [checkinDate, setCheckinDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [qrDisplayDialogOpen, setQrDisplayDialogOpen] = useState(false)
  const [selectedAssetTagForQR, setSelectedAssetTagForQR] = useState<string>("")

  // Fetch asset suggestions based on input (only Checked out assets)
  const { data: assetSuggestions = [], isLoading: isLoadingSuggestions } = useQuery<Asset[]>({
    queryKey: ["asset-checkin-suggestions", assetIdInput, selectedAssets.length, showSuggestions],
    queryFn: async () => {
      // Fetch all assets with large page size to get all checked out assets
      const searchTerm = assetIdInput.trim() || ''
      const response = await fetch(`/api/assets?search=${encodeURIComponent(searchTerm)}&pageSize=10000`)
        if (!response.ok) {
          throw new Error('Failed to fetch assets')
        }
        const data = await response.json()
        const assets = data.assets as Asset[]
        
        // Filter out assets already in selected list and only show Checked out assets
      const selectedIds = selectedAssets.map(a => a.id.toLowerCase())
      const filtered = assets
          .filter(a => {
            const notSelected = !selectedIds.includes(a.id.toLowerCase())
            const isCheckedOut = a.status === "Checked out"
            return notSelected && isCheckedOut
          })
      
      // Show more when input is empty, less when searching
      if (!searchTerm) {
        return filtered.slice(0, 20)
      }
      return filtered.slice(0, 10)
    },
    enabled: showSuggestions,
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

  // Asset lookup by ID
  const lookupAsset = async (assetTagId: string): Promise<Asset | null> => {
    try {
      const response = await fetch(`/api/assets?search=${encodeURIComponent(assetTagId)}&pageSize=10000`)
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

  // Add asset to checkin list
  const handleAddAsset = async (asset?: Asset) => {
    const assetToAdd = asset || await lookupAsset(assetIdInput.trim())
    
    if (!assetToAdd) {
      if (!asset) {
        toast.error(`Asset with ID "${assetIdInput}" not found`)
      }
      return
    }

    // Check if asset is checked out
    if (assetToAdd.status !== "Checked out") {
      toast.error(`Asset "${assetToAdd.assetTagId}" is not checked out. Current status: ${assetToAdd.status || 'Unknown'}`)
      setAssetIdInput("")
      setShowSuggestions(false)
      return
    }

    // Check if asset has an active checkout
    const activeCheckout = assetToAdd.checkouts?.[0]
    if (!activeCheckout) {
      toast.error(`No active checkout found for asset "${assetToAdd.assetTagId}"`)
      setAssetIdInput("")
      setShowSuggestions(false)
      return
    }

    // Check if asset is already in the list
    if (selectedAssets.some(a => a.id === assetToAdd.id)) {
      toast.error('Asset is already in the check-in list')
      setAssetIdInput("")
      setShowSuggestions(false)
      return
    }

    setSelectedAssets((prev) => [
      ...prev,
      {
        ...assetToAdd,
        checkoutId: activeCheckout.id,
        employeeName: activeCheckout.employeeUser?.name,
        employeeEmail: activeCheckout.employeeUser?.email,
        employeeDepartment: activeCheckout.employeeUser?.department || null,
        checkoutDate: activeCheckout.checkoutDate,
        expectedReturnDate: activeCheckout.expectedReturnDate,
      },
    ])
    setAssetIdInput("")
    setShowSuggestions(false)
    setSelectedSuggestionIndex(-1)
    toast.success('Asset added to check-in list')
  }

  // Handle suggestion selection
  const handleSelectSuggestion = (asset: Asset) => {
    handleAddAsset(asset)
  }

  // Handle keyboard navigation in suggestions
  const handleSuggestionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || assetSuggestions.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (assetIdInput.trim()) {
          handleAddAsset()
        }
      }
      return
    }

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
          handleAddAsset()
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowSuggestions(false)
        setSelectedSuggestionIndex(-1)
        break
    }
  }

  // Remove asset from checkin list
  const handleRemoveAsset = (assetId: string) => {
    setSelectedAssets((prev) => prev.filter((a) => a.id !== assetId))
    toast.success('Asset removed from check-in list')
  }

  // Track form changes to show floating buttons - only show when assets are selected
  const isFormDirty = useMemo(() => {
    // Only show floating buttons when assets are actually selected
    return selectedAssets.length > 0
  }, [selectedAssets])

  // Clear form function
  const clearForm = () => {
    setSelectedAssets([])
    setAssetIdInput("")
    setCheckinDate(new Date().toISOString().split('T')[0])
  }

  // Handle QR code scan result
  const handleQRScan = async (decodedText: string) => {
    // Lookup asset by the scanned QR code (which should be the assetTagId)
    const asset = await lookupAsset(decodedText)
    if (asset) {
      await handleAddAsset(asset)
    } else {
      toast.error(`Asset with ID "${decodedText}" not found`)
    }
  }

  // Update asset condition or notes in checkin list
  const handleUpdateAssetInfo = (assetId: string, field: string, value: string) => {
    setSelectedAssets((prev) =>
      prev.map((asset) =>
        asset.id === assetId ? { ...asset, [field]: value } : asset
      )
    )
  }

  // Checkin mutation
  const checkinMutation = useMutation({
    mutationFn: async (data: {
      assetIds: string[]
      checkinDate: string
      updates: Record<string, { condition?: string; notes?: string; returnLocation?: string }>
    }) => {
      const response = await fetch('/api/assets/checkin', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to check in assets')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] })
      queryClient.invalidateQueries({ queryKey: ["checkin-stats"] })
      toast.success('Assets checked in successfully')
      clearForm()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to check in assets')
    },
  })

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedAssets.length === 0) {
      toast.error('Please add at least one asset to check in')
      return
    }

    if (!checkinDate) {
      toast.error('Please select a check-in date')
      return
    }

    const updates: Record<string, { condition?: string; notes?: string; returnLocation?: string }> = {}
    selectedAssets.forEach((asset) => {
      updates[asset.id] = {
        ...(asset.condition ? { condition: asset.condition } : {}),
        ...(asset.notes ? { notes: asset.notes } : {}),
        ...(asset.returnLocation !== undefined ? { returnLocation: asset.returnLocation } : {}),
      }
    })

    checkinMutation.mutate({
      assetIds: selectedAssets.map((a) => a.id),
      checkinDate,
      updates,
    })
  }

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAssetIdInput(e.target.value)
    if (!showSuggestions) {
      setShowSuggestions(true)
    }
    setSelectedSuggestionIndex(-1)
  }

  // Handle focus to show all checked out assets
  const handleInputFocus = () => {
    setShowSuggestions(true)
  }

  // Fetch all checked out assets for statistics
  const { data: allAssets = [], isLoading: isLoadingAssets } = useQuery<Asset[]>({
    queryKey: ["assets", "checkin-stats"],
    queryFn: async () => {
      const response = await fetch('/api/assets?search=&pageSize=10000')
      const data = await response.json()
      return data.assets as Asset[]
    },
    enabled: canViewAssets,
    staleTime: 5 * 60 * 1000,
  })

  // Calculate summary statistics
  const totalCheckedOutAssets = allAssets.filter(a => a.status === "Checked out").length
  const selectedAssetsCount = selectedAssets.length
  const totalValueOfCheckoutAssets = useMemo(() => {
    return allAssets
      .filter(a => a.status === "Checked out")
      .reduce((sum, asset) => {
        return sum + (asset.cost ? Number(asset.cost) : 0)
      }, 0)
  }, [allAssets])

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PHP',
    }).format(value)
  }

  // Fetch check-in statistics
  const { data: checkinStats, isLoading: isLoadingCheckinStats, error: checkinStatsError } = useQuery<{
    recentCheckins: Array<{
      id: string
      checkinDate: string
      condition?: string | null
      createdAt: string
      asset: {
        id: string
        assetTagId: string
        description: string
      }
      employeeUser: {
        id: string
        name: string
        email: string
        department: string | null
      }
    }>
  }>({
    queryKey: ["checkin-stats"],
    queryFn: async () => {
      const response = await fetch("/api/assets/checkin/stats")
      if (!response.ok) {
        throw new Error('Failed to fetch check-in statistics')
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

  // Format date for display
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString()
    } catch {
      return dateString
    }
  }

  const recentCheckins = checkinStats?.recentCheckins || []

  return (
    <div className={isFormDirty ? "pb-16" : ""}>
      <div>
        <h1 className="text-3xl font-bold">Check In Asset</h1>
        <p className="text-muted-foreground">
          Return checked out assets back to inventory
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 mt-6">
        {/* Total Checked Out Assets */}
        <Card className="flex flex-col py-0 gap-2">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 text-blue-500">
                <Package className="h-4 w-4" />
              </div>
              <CardTitle className="text-sm font-medium">Checked Out Assets</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col grow justify-center p-4 pt-0">
            {permissionsLoading || isLoadingAssets ? (
              <>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-4 w-32" />
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">{totalCheckedOutAssets}</div>
                <p className="text-xs text-muted-foreground">
                  Assets currently checked out
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Selected Assets */}
        <Card className="flex flex-col py-0 gap-2">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-green-100 text-green-500">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <CardTitle className="text-sm font-medium">Selected for Check-in</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col grow justify-center p-4 pt-0">
            {permissionsLoading ? (
              <>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-4 w-32" />
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">{selectedAssetsCount}</div>
                <p className="text-xs text-muted-foreground">
                  Assets in check-in list
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Total Value of Checkout Assets */}
        <Card className="flex flex-col py-0 gap-2">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-100 text-amber-500">
                <DollarSign className="h-4 w-4" />
              </div>
              <CardTitle className="text-sm font-medium">Total Value of Checkout Assets</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col grow justify-center p-4 pt-0">
            {permissionsLoading || isLoadingAssets ? (
              <>
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-4 w-32" />
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrency(totalValueOfCheckoutAssets)}</div>
                <p className="text-xs text-muted-foreground">
                  Value of checked out assets
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Recent History - Always visible to show access denied message if needed */}
        <Card className="flex flex-col py-0 gap-2 col-span-1 md:col-span-2 lg:col-span-3">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-purple-100 text-purple-500">
                <History className="h-4 w-4" />
              </div>
              <CardTitle className="text-sm font-medium">Recent History</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {permissionsLoading || isLoadingCheckinStats ? (
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
            ) : checkinStatsError ? (
              <p className="text-sm text-destructive text-center py-4">
                Failed to load history. Please try again.
              </p>
            ) : recentCheckins.length > 0 ? (
              <ScrollArea className="h-52">
                <div className="relative w-full">
                  <Table className="w-full caption-bottom text-sm">
                    <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                        <TableHead className="h-8 text-xs bg-card">Asset ID</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Description</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Employee</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Condition</TableHead>
                        <TableHead className="h-8 text-xs text-right bg-card">Time Ago</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentCheckins.map((checkin) => (
                      <TableRow key={checkin.id} className="h-10">
                        <TableCell className="py-1.5">
                          <Badge 
                            variant="outline" 
                            className="text-xs cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors"
                            onClick={() => {
                              setSelectedAssetTagForQR(checkin.asset.assetTagId)
                              setQrDisplayDialogOpen(true)
                            }}
                          >
                            {checkin.asset.assetTagId}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5 text-xs max-w-[200px] truncate">
                          {checkin.asset.description}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground">
                          {checkin.employeeUser.name}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground">
                          {checkin.condition || '-'}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground text-right">
                          {getTimeAgo(checkin.createdAt)}
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
                No recent check-ins
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 mt-6">
        {/* Asset Selection Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Asset Selection</CardTitle>
            <CardDescription className="text-xs">
              Type asset ID and press Enter, or select an asset from the suggestions to add to the check-in list
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
                disabled={!canViewAssets || !canCheckin}
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
                          <Badge variant="outline">{asset.status || 'Available'}</Badge>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No checked out assets found. Start typing to search...
                    </div>
                  )}
                </div>
              )}
              </div>
              {canViewAssets && canCheckin && (
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

            {selectedAssets.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Selected Assets ({selectedAssets.length})
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-center justify-between gap-2 p-3 border rounded-md bg-muted/50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{asset.assetTagId}</Badge>
                          <span className="text-sm font-medium truncate">
                            {asset.category?.name || 'No Category'}
                            {asset.subCategory?.name && ` - ${asset.subCategory.name}`}
                          </span>
                        </div>
                        {asset.employeeName && (
                          <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                            <p>Checked out to: <span className="font-medium">{asset.employeeName}</span> ({asset.employeeEmail}){asset.employeeDepartment && <span className="text-muted-foreground"> - {asset.employeeDepartment}</span>}</p>
                            {asset.checkoutDate && (
                              <p>Checkout Date: {formatDate(asset.checkoutDate)}</p>
                            )}
                            {asset.expectedReturnDate && (
                              <p>Expected Return: {formatDate(asset.expectedReturnDate)}</p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {getStatusBadge(asset.status || null)}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveAsset(asset.id)}
                          className="h-8 w-8"
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

        {/* Asset Condition and Notes */}
        {selectedAssets.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Asset Condition & Notes</CardTitle>
              <CardDescription className="text-xs">
                Record the condition and any notes for each returned asset
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-4">
              <div className="space-y-4">
                {selectedAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="p-4 border rounded-md space-y-3"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{asset.assetTagId}</Badge>
                      <span className="text-sm font-medium truncate">
                        {asset.description}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <Field>
                        <FieldLabel htmlFor={`condition-${asset.id}`}>
                          Asset Condition
                        </FieldLabel>
                        <FieldContent>
                          <Select
                            value={asset.condition || ""}
                            onValueChange={(value) =>
                              handleUpdateAssetInfo(asset.id, "condition", value)
                            }
                            disabled={!canViewAssets || !canCheckin}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select the condition of the returned asset" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Excellent">Excellent</SelectItem>
                              <SelectItem value="Good">Good</SelectItem>
                              <SelectItem value="Fair">Fair</SelectItem>
                              <SelectItem value="Poor">Poor</SelectItem>
                              <SelectItem value="Damaged">Damaged</SelectItem>
                              <SelectItem value="Needs Repair">Needs Repair</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-1">
                            Assess the condition of the returned asset
                          </p>
                        </FieldContent>
                      </Field>

                      <Field>
                        <FieldLabel htmlFor={`returnLocation-${asset.id}`}>
                          Return Location
                          {asset.location && (
                            <span className="text-xs text-muted-foreground font-normal ml-2">
                              (Current: {asset.location})
                            </span>
                          )}
                        </FieldLabel>
                        <FieldContent>
                          <Input
                            id={`returnLocation-${asset.id}`}
                            placeholder={asset.location || "Enter return location"}
                            value={asset.returnLocation || ""}
                            onChange={(e) =>
                              handleUpdateAssetInfo(asset.id, "returnLocation", e.target.value)
                            }
                            disabled={!canViewAssets || !canCheckin}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            This will update the asset&apos;s location in the assets table
                          </p>
                        </FieldContent>
                      </Field>

                      <Field>
                        <FieldLabel htmlFor={`notes-${asset.id}`}>
                          Notes <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
                        </FieldLabel>
                        <FieldContent>
                          <Textarea
                            id={`notes-${asset.id}`}
                            placeholder="Any observations about the asset condition, issues found, or special notes"
                            value={asset.notes || ""}
                            onChange={(e) =>
                              handleUpdateAssetInfo(asset.id, "notes", e.target.value)
                            }
                            rows={3}
                            disabled={!canViewAssets || !canCheckin}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Any additional information about the returned asset
                          </p>
                        </FieldContent>
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Check-in Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Check-in Details</CardTitle>
            <CardDescription className="text-xs">
              Set the check-in date for the selected assets
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2 pb-4">
            <Field>
              <FieldLabel htmlFor="checkinDate">
                Check-in Date <span className="text-destructive">*</span>
              </FieldLabel>
              <FieldContent>
                <Input
                  id="checkinDate"
                  type="date"
                  value={checkinDate}
                  onChange={(e) => setCheckinDate(e.target.value)}
                  required
                  disabled={!canViewAssets || !canCheckin}
                />
              </FieldContent>
            </Field>
          </CardContent>
        </Card>
      </form>

      {/* Floating Action Buttons - Only show when form has changes */}
      {isFormDirty && canViewAssets && canCheckin && (
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
            disabled={checkinMutation.isPending || selectedAssets.length === 0 || !canViewAssets || !canCheckin}
            className="min-w-[120px]"
          >
            {checkinMutation.isPending ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Processing...
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
