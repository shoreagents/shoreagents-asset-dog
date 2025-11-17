"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { useForm, Controller, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { XIcon, History, QrCode } from "lucide-react"
import { usePermissions } from '@/hooks/use-permissions'
import { useSidebar } from '@/components/ui/sidebar'
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldLabel, FieldContent, FieldError } from "@/components/ui/field"
import { EmployeeSelectField } from "@/components/employee-select-field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { moveSchema, type MoveFormData } from "@/lib/validations/assets"

interface Asset {
  id: string
  assetTagId: string
  description: string
  status?: string
  location?: string | null
  department?: string | null
  category?: {
    id: string
    name: string
  } | null
  subCategory?: {
    id: string
    name: string
  } | null
  checkouts?: Array<{
    id: string
    employeeUser: {
      id: string
      name: string
      email: string
      department: string | null
    } | null
  }>
  leases?: Array<{
    id: string
    lessee: string
    leaseStartDate: string
    leaseEndDate?: string | null
  }>
}



type MoveType = "Location Transfer" | "Employee Assignment" | "Department Transfer" | ""

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
  }
  
  return <Badge variant={statusVariant} className={statusColor}>{status}</Badge>
}

export default function MoveAssetPage() {
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const { state: sidebarState, open: sidebarOpen } = useSidebar()
  const canViewAssets = hasPermission('canViewAssets')
  const canMove = hasPermission('canMove')
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionRef = useRef<HTMLDivElement>(null)
  const [assetIdInput, setAssetIdInput] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [qrDisplayDialogOpen, setQrDisplayDialogOpen] = useState(false)
  const [selectedAssetTagForQR, setSelectedAssetTagForQR] = useState<string>("")

  const form = useForm<MoveFormData>({
    resolver: zodResolver(moveSchema),
    defaultValues: {
      assetId: '',
      moveType: '',
      moveDate: new Date().toISOString().split('T')[0],
      location: '',
      employeeUserId: '',
      department: '',
      reason: '',
      notes: '',
    },
  })

  // Watch moveType to handle conditional fields
  const moveType = useWatch({
    control: form.control,
    name: 'moveType',
  })


  // Fetch move statistics
  const { data: moveStats, isLoading: isLoadingMoveStats, error: moveStatsError } = useQuery<{
    movedTodayCount: number
    recentMoves: Array<{
      id: string
      moveType: string
      moveDate: string
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
      } | null
    }>
  }>({
    queryKey: ["move-stats"],
    queryFn: async () => {
      const response = await fetch("/api/assets/move/stats")
      if (!response.ok) {
        throw new Error('Failed to fetch move statistics')
      }
      const data = await response.json()
      return data
    },
    enabled: canViewAssets,
    retry: 2,
    retryDelay: 1000,
  })

  // Format date for display
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString()
    } catch {
      return 'N/A'
    }
  }

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

  // Fetch asset suggestions based on input (exclude leased assets)
  const { data: assetSuggestions = [], isLoading: isLoadingSuggestions } = useQuery<Asset[]>({
    queryKey: ["asset-move-suggestions", assetIdInput, showSuggestions],
    queryFn: async () => {
      // If input is empty, show recent assets
      if (!assetIdInput.trim() || assetIdInput.length < 1) {
        const response = await fetch(`/api/assets?search=`)
        if (!response.ok) {
          throw new Error('Failed to fetch assets')
        }
        const data = await response.json()
        const assets = data.assets as Asset[]
        
        // Filter out leased assets
        return assets
          .filter(a => a.status !== "Leased" && (!a.leases || a.leases.length === 0))
          .slice(0, 10)
      }
      
      // If there's input, search for matching assets
      const response = await fetch(`/api/assets?search=${encodeURIComponent(assetIdInput.trim())}`)
      if (!response.ok) {
        throw new Error('Failed to fetch assets')
      }
      const data = await response.json()
      const assets = data.assets as Asset[]
      
      // Filter out leased assets
      return assets
        .filter(a => a.status !== "Leased" && (!a.leases || a.leases.length === 0))
        .slice(0, 10)
    },
    enabled: showSuggestions && canViewAssets && canMove,
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
      const response = await fetch(`/api/assets?search=${encodeURIComponent(assetTagId)}`)
      const data = await response.json()
      const assets = data.assets as Asset[]
      
      // Find exact match by assetTagId (case-insensitive)
      const asset = assets.find(
        (a) => a.assetTagId.toLowerCase() === assetTagId.toLowerCase()
      )
      
      // Check if asset is leased
      if (asset && (asset.status === "Leased" || (asset.leases && asset.leases.length > 0))) {
        return null
      }
      
      return asset || null
    } catch (error) {
      console.error('Error looking up asset:', error)
      return null
    }
  }

  // Handle asset selection
  const handleSelectAsset = async (asset?: Asset) => {
    const assetToAdd = asset || await lookupAsset(assetIdInput.trim())
    
    if (!assetToAdd) {
      if (!asset) {
        toast.error(`Asset with ID "${assetIdInput}" not found or is currently leased`)
      }
      return
    }

    setSelectedAsset(assetToAdd)
    form.setValue('assetId', assetToAdd.id)
    setAssetIdInput("")
    setShowSuggestions(false)
    setSelectedSuggestionIndex(-1)
    
    // If Employee Assignment is already selected, pre-select current employee
    if (moveType === 'Employee Assignment') {
      const currentEmployeeId = assetToAdd.checkouts?.[0]?.employeeUser?.id
      if (currentEmployeeId) {
        form.setValue('employeeUserId', currentEmployeeId)
      }
    }
    
    toast.success('Asset selected')
  }

  // Handle suggestion selection
  const handleSelectSuggestion = (asset: Asset) => {
    handleSelectAsset(asset)
  }

  // Handle keyboard navigation in suggestions
  const handleSuggestionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || assetSuggestions.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (assetIdInput.trim()) {
          handleSelectAsset()
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

  // Clear selected asset
  const handleClearAsset = () => {
    setSelectedAsset(null)
    setAssetIdInput("")
    toast.success('Asset cleared')
  }

  // Handle URL query parameters for assetId
  useEffect(() => {
    const urlAssetId = searchParams.get('assetId')

    if (urlAssetId && !selectedAsset) {
      // Fetch and select the asset from URL
      const selectAssetFromUrl = async () => {
        try {
          const response = await fetch(`/api/assets/${urlAssetId}`)
          if (response.ok) {
            const data = await response.json()
            const asset = data.asset as Asset
            
            // Check if asset is eligible for move (not leased)
            const hasActiveLease = asset.leases?.some(
              (lease: { endDate: string | null }) => !lease.endDate
            )
            
            if (hasActiveLease) {
              toast.error(`Asset "${asset.assetTagId}" is currently leased and cannot be moved`)
              return
            }

            setSelectedAsset(asset)
            form.setValue('assetId', asset.id)
            setAssetIdInput(asset.assetTagId)
          }
        } catch (error) {
          console.error('Error fetching asset from URL:', error)
        }
      }
      
      selectAssetFromUrl()
    }
  }, [searchParams, selectedAsset, form])

  // Track form changes to show floating buttons - only show when asset is selected
  const isFormDirty = useMemo(() => {
    // Only show floating buttons when an asset is actually selected
    return !!selectedAsset
  }, [selectedAsset])

  // Clear form function
  const clearForm = () => {
    setSelectedAsset(null)
    setAssetIdInput("")
    form.reset({
      assetId: '',
      moveType: '',
      moveDate: new Date().toISOString().split('T')[0],
      location: '',
      employeeUserId: '',
      department: '',
      reason: '',
      notes: '',
    })
  }

  // Handle QR code scan result
  const handleQRScan = async (decodedText: string) => {
    // Lookup asset by the scanned QR code (which should be the assetTagId)
    const asset = await lookupAsset(decodedText)
    if (asset) {
      await handleSelectAsset(asset)
    } else {
      toast.error(`Asset with ID "${decodedText}" not found`)
    }
  }

  // Handle move type change - reset conditional fields
  const handleMoveTypeChange = (value: MoveType) => {
    form.setValue('moveType', value as 'Location Transfer' | 'Employee Assignment' | 'Department Transfer')
    // Reset conditional fields when changing move type
    form.setValue('location', '')
    form.setValue('department', '')
    
    // For Employee Assignment, pre-select current employee if asset is checked out
    if (value === 'Employee Assignment' && selectedAsset) {
      const currentEmployeeId = selectedAsset.checkouts?.[0]?.employeeUser?.id
      if (currentEmployeeId) {
        form.setValue('employeeUserId', currentEmployeeId)
      } else {
        form.setValue('employeeUserId', '')
      }
    } else {
      form.setValue('employeeUserId', '')
    }
    // Trigger validation for conditional fields
    form.trigger(['location', 'employeeUserId', 'department'])
  }

  // Move mutation
  const moveMutation = useMutation({
    mutationFn: async (data: {
      assetId: string
      moveType: string
      moveDate: string
      location?: string
      employeeUserId?: string
      department?: string
      reason?: string
      notes?: string
    }) => {
      const response = await fetch('/api/assets/move', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to move asset')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] })
      queryClient.invalidateQueries({ queryKey: ["move-stats"] })
      toast.success('Asset moved successfully')
      clearForm()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to move asset')
    },
  })

  // Handle form submission
  const handleSubmit = form.handleSubmit(async (data) => {
    if (!selectedAsset) {
      toast.error('Please select an asset')
      return
    }

    moveMutation.mutate({
      assetId: data.assetId,
      moveType: data.moveType,
      moveDate: data.moveDate,
      location: data.moveType === 'Location Transfer' ? data.location : undefined,
      employeeUserId: data.moveType === 'Employee Assignment' ? data.employeeUserId : undefined,
      department: data.moveType === 'Department Transfer' ? data.department : undefined,
      reason: data.reason || undefined,
      notes: data.notes || undefined,
    })
  })

  const recentMoves = moveStats?.recentMoves || []

  return (
    <div className={isFormDirty ? "pb-16" : ""}>
      <div>
        <h1 className="text-3xl font-bold">Move Asset</h1>
        <p className="text-muted-foreground">
          Transfer an asset to a different location, employee, or department
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
            {permissionsLoading || isLoadingMoveStats ? (
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
            ) : moveStatsError ? (
              <p className="text-sm text-destructive text-center py-4">
                Failed to load history. Please try again.
              </p>
            ) : recentMoves.length > 0 ? (
              <ScrollArea className="h-52">
                <div className="relative w-full">
                  <Table className="w-full caption-bottom text-sm">
                    <TableHeader className="sticky top-0 z-0 bg-card">
                    <TableRow>
                        <TableHead className="h-8 text-xs bg-card">Asset ID</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Description</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Type</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Employee</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Move Date</TableHead>
                        <TableHead className="h-8 text-xs text-right bg-card">Time Ago</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentMoves.map((move) => (
                      <TableRow key={move.id} className="h-10">
                        <TableCell className="py-1.5">
                          <Badge 
                            variant="outline" 
                            className="text-xs cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors"
                            onClick={() => {
                              setSelectedAssetTagForQR(move.asset.assetTagId)
                              setQrDisplayDialogOpen(true)
                            }}
                          >
                            {move.asset.assetTagId}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5 text-xs max-w-[200px] truncate">
                          {move.asset.description}
                        </TableCell>
                        <TableCell className="py-1.5">
                          <span className="text-xs text-muted-foreground">
                            {move.moveType}
                          </span>
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground">
                          {move.employeeUser ? move.employeeUser.name : '-'}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground">
                          {formatDate(move.moveDate)}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground text-right">
                          {getTimeAgo(move.createdAt)}
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
                No recent moves
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
            {!selectedAsset ? (
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
                  disabled={!canViewAssets || !canMove}
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
                            {getStatusBadge(asset.status || 'Available')}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No assets found. Start typing to search...
                      </div>
                    )}
                  </div>
                )}
              </div>
              {canViewAssets && canMove && (
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
            ) : (
              <div className="flex items-center justify-between gap-2 p-3 border rounded-md bg-muted/50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{selectedAsset.assetTagId}</Badge>
                    <span className="text-sm font-medium truncate">
                      {selectedAsset.category?.name || 'No Category'}
                      {selectedAsset.subCategory?.name && ` - ${selectedAsset.subCategory.name}`}
                    </span>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {selectedAsset.location && (
                      <p className="text-xs text-muted-foreground">
                        Current Location: {selectedAsset.location}
                      </p>
                    )}
                    {selectedAsset.department && (
                      <p className="text-xs text-muted-foreground">
                        Current Department: {selectedAsset.department}
                      </p>
                    )}
                    {selectedAsset.status === "Checked out" && selectedAsset.checkouts?.[0]?.employeeUser && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                        Assigned to: {selectedAsset.checkouts[0].employeeUser.name} ({selectedAsset.checkouts[0].employeeUser.email}){selectedAsset.checkouts[0].employeeUser.department && <span className="text-muted-foreground"> - {selectedAsset.checkouts[0].employeeUser.department}</span>}
                      </p>
                    )}
        </div>
      </div>
                <div className="flex items-center gap-2 shrink-0">
                  {getStatusBadge(selectedAsset.status || null)}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleClearAsset}
                    className="h-8 w-8"
                >
                  <XIcon className="h-4 w-4" />
                </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Move Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Move Details</CardTitle>
            <CardDescription className="text-xs">
              {selectedAsset 
                ? "Select the type of move and provide the required information"
                : "Select an asset first to enable move options"}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2 pb-4 space-y-4">
                <Field>
                  <FieldLabel htmlFor="moveType">
                    Type of Move <span className="text-destructive">*</span>
                  </FieldLabel>
                  <FieldContent>
                    <Controller
                      name="moveType"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <>
                          <Select
                            value={field.value || ""}
                            onValueChange={(value) => {
                              field.onChange(value)
                              handleMoveTypeChange(value as MoveType)
                            }}
                            disabled={!canViewAssets || !canMove || !selectedAsset}
                          >
                            <SelectTrigger className="w-full" aria-invalid={fieldState.error ? 'true' : 'false'}>
                              <SelectValue placeholder="Select move type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Location Transfer">Location Transfer</SelectItem>
                              <SelectItem value="Employee Assignment">Employee Assignment</SelectItem>
                              <SelectItem value="Department Transfer">Department Transfer</SelectItem>
                            </SelectContent>
                          </Select>
                          {fieldState.error && (
                            <FieldError>{fieldState.error.message}</FieldError>
                          )}
                        </>
                      )}
                    />
                  </FieldContent>
                </Field>

                {/* Conditional fields based on move type */}
                {moveType === 'Location Transfer' && (
                  <Field>
                    <FieldLabel htmlFor="location">
                      Location <span className="text-destructive">*</span>
                      {selectedAsset?.location && (
                        <span className="text-xs text-muted-foreground font-normal ml-2">
                          (Current: {selectedAsset.location})
                        </span>
                      )}
                    </FieldLabel>
                    <FieldContent>
                      <Controller
                        name="location"
                        control={form.control}
                        render={({ field, fieldState }) => (
                          <>
                            <Input
                              id="location"
                              placeholder={selectedAsset?.location || "Enter location"}
                              {...field}
                              disabled={!canViewAssets || !canMove || !selectedAsset}
                              aria-invalid={fieldState.error ? 'true' : 'false'}
                              aria-required="true"
                            />
                            {fieldState.error && (
                              <FieldError>{fieldState.error.message}</FieldError>
                            )}
                          </>
                        )}
                      />
                    </FieldContent>
                  </Field>
                )}

                {moveType === 'Employee Assignment' && (
                  <Controller
                    name="employeeUserId"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <EmployeeSelectField
                        value={field.value || ""}
                        onValueChange={(value) => {
                          field.onChange(value)
                          form.trigger('employeeUserId')
                        }}
                        label="Assign To Employee"
                        required
                        disabled={!canViewAssets || !canMove || !selectedAsset}
                        currentEmployeeId={selectedAsset?.checkouts?.[0]?.employeeUser?.id}
                        queryKey={["employees", "move"]}
                        error={fieldState.error}
                      />
                    )}
                  />
                )}

                {moveType === 'Department Transfer' && (
                  <Field>
                    <FieldLabel htmlFor="department">
                      Department <span className="text-destructive">*</span>
                      {selectedAsset?.department && (
                        <span className="text-xs text-muted-foreground font-normal ml-2">
                          (Current: {selectedAsset.department})
                        </span>
                      )}
                    </FieldLabel>
                    <FieldContent>
                      <Controller
                        name="department"
                        control={form.control}
                        render={({ field, fieldState }) => (
                          <>
                            <Input
                              id="department"
                              placeholder={selectedAsset?.department || "Enter department"}
                              {...field}
                              disabled={!canViewAssets || !canMove || !selectedAsset}
                              aria-invalid={fieldState.error ? 'true' : 'false'}
                              aria-required="true"
                            />
                            {fieldState.error && (
                              <FieldError>{fieldState.error.message}</FieldError>
                            )}
                          </>
                        )}
                      />
                    </FieldContent>
                  </Field>
                )}

                <Field>
                  <FieldLabel htmlFor="moveDate">
                    Move Date <span className="text-destructive">*</span>
                  </FieldLabel>
                  <FieldContent>
                    <Controller
                      name="moveDate"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <>
                          <Input
                            id="moveDate"
                            type="date"
                            {...field}
                            disabled={!canViewAssets || !canMove || !selectedAsset}
                            aria-invalid={fieldState.error ? 'true' : 'false'}
                            aria-required="true"
                          />
                          {fieldState.error && (
                            <FieldError>{fieldState.error.message}</FieldError>
                          )}
                        </>
                      )}
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="reason">
                    Reason for Move
                  </FieldLabel>
                  <FieldContent>
                    <Controller
                      name="reason"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <>
                          <Textarea
                            id="reason"
                            placeholder="Explain the reason for this move"
                            {...field}
                            rows={3}
                            disabled={!canViewAssets || !canMove || !selectedAsset}
                            aria-invalid={fieldState.error ? 'true' : 'false'}
                          />
                          {fieldState.error && (
                            <FieldError>{fieldState.error.message}</FieldError>
                          )}
                        </>
                      )}
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="notes">
                    Notes <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
                  </FieldLabel>
                  <FieldContent>
                    <Controller
                      name="notes"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <>
                          <Textarea
                            id="notes"
                            placeholder="Any additional notes about this move"
                            {...field}
                            rows={3}
                            disabled={!canViewAssets || !canMove || !selectedAsset}
                            aria-invalid={fieldState.error ? 'true' : 'false'}
                          />
                          {fieldState.error && (
                            <FieldError>{fieldState.error.message}</FieldError>
                          )}
                        </>
                      )}
                    />
                  </FieldContent>
                </Field>
          </CardContent>
        </Card>
      </form>

      {/* Floating Action Buttons - Only show when form has changes */}
      {isFormDirty && canViewAssets && canMove && (
        <div 
          className="fixed bottom-6 z-50 flex items-center justify-center gap-3"
          style={{
            left: !sidebarOpen 
              ? '50%'
              : sidebarState === 'collapsed' 
                ? 'calc(var(--sidebar-width-icon, 3rem) + ((100vw - var(--sidebar-width-icon, 3rem)) / 2))'
                : 'calc(var(--sidebar-width, 16rem) + ((100vw - var(--sidebar-width, 16rem)) / 2))',
            transform: 'translateX(-50%)'
          }}
        >
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
            disabled={moveMutation.isPending || !selectedAsset || !canViewAssets || !canMove}
            className="min-w-[120px]"
              >
            {moveMutation.isPending ? (
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
