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
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { QRCodeDisplayDialog } from "@/components/qr-code-display-dialog"
import { reserveSchema, type ReserveFormData } from "@/lib/validations/assets"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
}


type ReservationType = "Employee" | "Department" | ""

// Helper function to get status badge with colors (only for Available status on reserve page)
const getStatusBadge = (status: string | null) => {
  if (!status) return null
  const statusLC = status.toLowerCase()
  
  // Only show green badge for Available status, others use default outline
  if (statusLC === 'active' || statusLC === 'available') {
    return <Badge variant="default" className="bg-green-500">{status}</Badge>
  }
  
  // For any other status (shouldn't happen for reserve, but just in case)
  return <Badge variant="outline">{status}</Badge>
}

export default function ReserveAssetPage() {
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const { state: sidebarState, open: sidebarOpen } = useSidebar()
  const canViewAssets = hasPermission('canViewAssets')
  const canReserve = hasPermission('canReserve')
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionRef = useRef<HTMLDivElement>(null)
  const [assetIdInput, setAssetIdInput] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [qrDisplayDialogOpen, setQrDisplayDialogOpen] = useState(false)
  const [selectedAssetTagForQR, setSelectedAssetTagForQR] = useState<string>("")

  const form = useForm<ReserveFormData>({
    resolver: zodResolver(reserveSchema),
    defaultValues: {
      assetId: '',
      reservationType: '',
      reservationDate: new Date().toISOString().split('T')[0],
      employeeUserId: '',
      department: '',
      purpose: '',
      notes: '',
    },
  })

  // Watch reservationType to handle conditional fields
  const reservationType = useWatch({
    control: form.control,
    name: 'reservationType',
  })



  // Fetch reservation statistics
  const { data: reserveStats, isLoading: isLoadingReserveStats, error: reserveStatsError } = useQuery<{
    totalReserved: number
    recentReservations: Array<{
      id: string
      reservationType: string
      reservationDate: string
      purpose?: string | null
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
      department?: string | null
    }>
  }>({
    queryKey: ["reserve-stats"],
    queryFn: async () => {
      const response = await fetch("/api/assets/reserve/stats")
      if (!response.ok) {
        throw new Error('Failed to fetch reservation statistics')
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

  // Fetch asset suggestions based on input (only Available assets)
  const { data: assetSuggestions = [], isLoading: isLoadingSuggestions } = useQuery<Asset[]>({
    queryKey: ["asset-reserve-suggestions", assetIdInput, showSuggestions],
    queryFn: async () => {
      // If input is empty, show recent/available assets
      if (!assetIdInput.trim() || assetIdInput.length < 1) {
        const response = await fetch(`/api/assets?search=&pageSize=1000`)
        if (!response.ok) {
          throw new Error('Failed to fetch assets')
        }
        const data = await response.json()
        const assets = data.assets as Asset[]
        
        // Filter to only show Available assets
        return assets
          .filter(a => !a.status || a.status === "Available")
          .slice(0, 10)
      }
      
      // If there's input, search for matching assets
      const response = await fetch(`/api/assets?search=${encodeURIComponent(assetIdInput.trim())}&pageSize=1000`)
      if (!response.ok) {
        throw new Error('Failed to fetch assets')
      }
      const data = await response.json()
      const assets = data.assets as Asset[]
      
      // Filter to only show Available assets
      return assets
        .filter(a => !a.status || a.status === "Available")
        .slice(0, 10)
    },
    enabled: showSuggestions && canViewAssets && canReserve,
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

  // Find asset by ID without status check (for error messages)
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

  // Asset lookup by ID (only returns if available for reservation)
  const lookupAsset = async (assetTagId: string): Promise<Asset | null> => {
    const asset = await findAssetById(assetTagId)
      
      // Check if asset is available for reservation
      if (asset && asset.status && asset.status !== "Available") {
        return null
      }
      
      return asset || null
  }

  // Handle suggestion selection
  const handleSelectSuggestion = (asset: Asset) => {
    setSelectedAsset(asset)
    setAssetIdInput(asset.assetTagId)
    form.setValue('assetId', asset.id)
    setShowSuggestions(false)
    setSelectedSuggestionIndex(-1)
    toast.success('Asset selected')
  }

  // Handle asset selection
  const handleSelectAsset = async (asset?: Asset) => {
    const assetToSelect = asset || await lookupAsset(assetIdInput.trim())
    if (assetToSelect) {
      setSelectedAsset(assetToSelect)
      setAssetIdInput(assetToSelect.assetTagId)
      form.setValue('assetId', assetToSelect.id)
      setShowSuggestions(false)
      toast.success('Asset selected')
    } else {
      if (!asset) {
      toast.error(`Asset with ID "${assetIdInput}" not found or not available for reservation`)
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

  // Clear selected asset
  const handleClearAsset = () => {
    setSelectedAsset(null)
    setAssetIdInput("")
    form.setValue('assetId', '')
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
            
            // Check if asset is available for reservation
            if (asset.status && asset.status !== "Available") {
              toast.error(`Asset "${asset.assetTagId}" is not available for reservation. Current status: ${asset.status}`)
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
      reservationType: '',
      reservationDate: new Date().toISOString().split('T')[0],
      employeeUserId: '',
      department: '',
      purpose: '',
      notes: '',
    })
  }

  // Handle QR code scan result
  const handleQRScan = async (decodedText: string) => {
    // First check if asset exists (regardless of status)
    const assetExists = await findAssetById(decodedText)
    
    if (!assetExists) {
      toast.error(`Asset with ID "${decodedText}" not found`)
      return
    }
    
    // Check if asset is available for reservation
    if (assetExists.status && assetExists.status !== "Available") {
      toast.error(`Asset "${assetExists.assetTagId}" is not available for reservation. Current status: ${assetExists.status}`)
      return
    }
    
    // Asset exists and is available, proceed to select it
    await handleSelectAsset(assetExists)
  }

  // Handle reservation type change - reset conditional fields
  const handleReservationTypeChange = (value: ReservationType) => {
    form.setValue('reservationType', value)
    // Reset conditional fields when changing reservation type
    form.setValue('employeeUserId', '')
    form.setValue('department', '')
    // Trigger validation for conditional fields
    if (value === 'Employee') {
      form.trigger('employeeUserId')
    } else if (value === 'Department') {
      form.trigger('department')
    }
  }

  // Reserve mutation
  const reserveMutation = useMutation({
    mutationFn: async (data: {
      assetId: string
      reservationType: string
      reservationDate: string
      employeeUserId?: string
      department?: string
      purpose?: string
      notes?: string
    }) => {
      const response = await fetch('/api/assets/reserve', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to reserve asset')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] })
      queryClient.invalidateQueries({ queryKey: ["reserve-stats"] })
      toast.success('Asset reserved successfully')
      clearForm()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to reserve asset')
    },
  })

  // Handle form submission
  const handleSubmit = form.handleSubmit(async (data) => {
    if (!selectedAsset) {
      toast.error('Please select an asset')
      return
    }

    reserveMutation.mutate({
      assetId: selectedAsset.id,
      reservationType: data.reservationType,
      reservationDate: data.reservationDate,
      employeeUserId: data.reservationType === 'Employee' ? data.employeeUserId : undefined,
      department: data.reservationType === 'Department' ? data.department : undefined,
      purpose: data.purpose || undefined,
      notes: data.notes || undefined,
    })
  })

  const recentReservations = reserveStats?.recentReservations || []

  return (
    <div className={isFormDirty ? "pb-16" : ""}>
      <div>
        <h1 className="text-3xl font-bold">Reserve Asset</h1>
        <p className="text-muted-foreground">
          Book an asset for future use by an employee or department
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
            {permissionsLoading || isLoadingReserveStats ? (
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
            ) : reserveStatsError ? (
              <p className="text-sm text-destructive text-center py-4">
                Failed to load history. Please try again.
              </p>
            ) : recentReservations.length > 0 ? (
              <ScrollArea className="h-52">
                <div className="relative w-full">
                  <Table className="w-full caption-bottom text-sm">
                    <TableHeader className="sticky top-0 z-0 bg-card">
                    <TableRow>
                        <TableHead className="h-8 text-xs bg-card">Asset ID</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Description</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Type</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Reserved For</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Purpose</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Reservation Date</TableHead>
                        <TableHead className="h-8 text-xs text-right bg-card">Time Ago</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentReservations.map((reservation) => (
                      <TableRow key={reservation.id} className="h-10">
                        <TableCell className="py-1.5">
                          <Badge 
                            variant="outline" 
                            className="text-xs cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors"
                            onClick={() => {
                              setSelectedAssetTagForQR(reservation.asset.assetTagId)
                              setQrDisplayDialogOpen(true)
                            }}
                          >
                            {reservation.asset.assetTagId}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5 text-xs max-w-[200px] truncate">
                          {reservation.asset.description}
                        </TableCell>
                        <TableCell className="py-1.5">
                          <span className="text-xs text-muted-foreground">
                            {reservation.reservationType}
                          </span>
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground">
                          {reservation.reservationType === 'Employee' && reservation.employeeUser
                            ? reservation.employeeUser.name
                            : reservation.reservationType === 'Department' && reservation.department
                            ? reservation.department
                            : '-'}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground max-w-[150px] truncate">
                          {reservation.purpose || '-'}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground">
                          {formatDate(reservation.reservationDate)}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground text-right">
                          {getTimeAgo(reservation.createdAt)}
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
                No recent reservations
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
                  disabled={!canViewAssets || !canReserve}
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
                        No assets found. Start typing to search...
                      </div>
                    )}
                  </div>
                )}
              </div>
              {canViewAssets && canReserve && (
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

        {/* Reservation Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Reservation Details</CardTitle>
            <CardDescription className="text-xs">
              Select the reservation type and provide the required information
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2 pb-4 space-y-4">
            <Field>
              <FieldLabel htmlFor="reservationType">
                Reservation Type <span className="text-destructive">*</span>
              </FieldLabel>
              <FieldContent>
                <Controller
                  name="reservationType"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <>
                      <Select
                        value={field.value || ""}
                        onValueChange={(value) => {
                          field.onChange(value)
                          handleReservationTypeChange(value as ReservationType)
                        }}
                        disabled={!canViewAssets || !canReserve || !selectedAsset}
                      >
                        <SelectTrigger className="w-full" aria-invalid={fieldState.error ? 'true' : 'false'}>
                          <SelectValue placeholder="Select reservation type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Employee">Employee</SelectItem>
                          <SelectItem value="Department">Department</SelectItem>
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

            {reservationType === 'Employee' && (
              <Controller
                name="employeeUserId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <>
                    <EmployeeSelectField
                      value={field.value || ""}
                      onValueChange={(value) => {
                        field.onChange(value)
                      }}
                      label="Employee"
                      required
                      disabled={!canViewAssets || !canReserve || !selectedAsset}
                      queryKey={["employees", "reserve"]}
                    />
                    {fieldState.error && (
                      <FieldError>{fieldState.error.message}</FieldError>
                    )}
                  </>
                )}
              />
            )}

            {reservationType === 'Department' && (
              <Field>
                <FieldLabel htmlFor="department">
                  Department <span className="text-destructive">*</span>
                </FieldLabel>
                <FieldContent>
                  <Controller
                    name="department"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <>
                        <Input
                          id="department"
                          placeholder="Enter department name"
                          {...field}
                          className="w-full"
                          disabled={!canViewAssets || !canReserve || !selectedAsset}
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
              <FieldLabel htmlFor="reservationDate">
                Reservation Date <span className="text-destructive">*</span>
              </FieldLabel>
              <FieldContent>
                <Controller
                  name="reservationDate"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <>
                      <Input
                        id="reservationDate"
                        type="date"
                        {...field}
                        className="w-full"
                        disabled={!canViewAssets || !canReserve || !selectedAsset}
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
              <FieldLabel htmlFor="purpose">
                Purpose
              </FieldLabel>
              <FieldContent>
                <Controller
                  name="purpose"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <>
                      <Textarea
                        id="purpose"
                        placeholder="Enter the purpose of this reservation"
                        {...field}
                        className="w-full"
                        rows={3}
                        disabled={!canViewAssets || !canReserve || !selectedAsset}
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
                Notes
              </FieldLabel>
              <FieldContent>
                <Controller
                  name="notes"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <>
                      <Textarea
                        id="notes"
                        placeholder="Enter any additional notes"
                        {...field}
                        className="w-full"
                        rows={3}
                        disabled={!canViewAssets || !canReserve || !selectedAsset}
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
      {isFormDirty && canViewAssets && canReserve && (
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
            disabled={reserveMutation.isPending || !selectedAsset || !canViewAssets || !canReserve}
            className="min-w-[120px]"
          >
            {reserveMutation.isPending ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Reserving...
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
