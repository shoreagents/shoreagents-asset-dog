"use client"

import { useState, useRef, useEffect, useMemo, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useForm, useWatch, type Control } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { XIcon, Package, CheckCircle2, Users, History, QrCode } from "lucide-react"
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
import { LocationSelectField } from "@/components/location-select-field"
import { SiteSelectField } from "@/components/site-select-field"
import { DepartmentSelectField } from "@/components/department-select-field"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { checkoutSchema, type CheckoutFormData } from "@/lib/validations/checkout"

interface Asset {
  id: string
  assetTagId: string
  description: string
  status?: string
  department?: string
  site?: string
  location?: string
  category?: {
    id: string
    name: string
  } | null
  subCategory?: {
    id: string
    name: string
  } | null
  employeeUser?: {
    id: string
    name: string
    email: string
  }
}

interface EmployeeUser {
  id: string
  name: string
  email: string
  department: string | null
  checkouts?: Array<{
    asset: {
      assetTagId: string
    }
  }>
}

interface CheckoutAsset extends Asset {
  newDepartment?: string
  newSite?: string
  newLocation?: string
}

// Helper function to get status badge with colors (only for Available status on checkout page)
const getStatusBadge = (status: string | null) => {
  if (!status) return null
  const statusLC = status.toLowerCase()
  
  // Only show green badge for Available status, others use default outline
  if (statusLC === 'active' || statusLC === 'available') {
    return <Badge variant="default" className="bg-green-500">{status}</Badge>
  }
  
  // For any other status (shouldn't happen for checkout, but just in case)
  return <Badge variant="outline">{status}</Badge>
}

function CheckoutPageContent() {
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const router = useRouter()
  const hasProcessedUrlParams = useRef(false)
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const { state: sidebarState, open: sidebarOpen } = useSidebar()
  const canViewAssets = hasPermission('canViewAssets')
  const canCheckout = hasPermission('canCheckout')
  const canManageSetup = hasPermission('canManageSetup')
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionRef = useRef<HTMLDivElement>(null)
  const [assetIdInput, setAssetIdInput] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const [selectedAssets, setSelectedAssets] = useState<CheckoutAsset[]>([])
  const [loadingAssets, setLoadingAssets] = useState<Set<string>>(new Set())
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [qrDisplayDialogOpen, setQrDisplayDialogOpen] = useState(false)
  const [selectedAssetTagForQR, setSelectedAssetTagForQR] = useState<string>("")

  const form = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      employeeId: "",
      checkoutDate: new Date().toISOString().split('T')[0],
      expectedReturnDate: "",
      department: "",
      site: "",
      location: "",
    },
  })

  // Watch checkoutDate to update expectedReturnDate min
  const checkoutDate = useWatch({
    control: form.control,
    name: 'checkoutDate',
  })

  // Fetch asset suggestions based on input (only Available assets)
  const { data: assetSuggestions = [], isLoading: isLoadingSuggestions } = useQuery<Asset[]>({
    queryKey: ["asset-suggestions", assetIdInput, selectedAssets.length, showSuggestions],
    queryFn: async () => {
      // Fetch all assets with large page size to get all available assets
      const searchTerm = assetIdInput.trim() || ''
      const response = await fetch(`/api/assets?search=${encodeURIComponent(searchTerm)}&pageSize=10000`)
        if (!response.ok) {
          throw new Error('Failed to fetch assets')
        }
        const data = await response.json()
        const assets = data.assets as Asset[]
        
        // Filter out assets already in selected list and only show Available assets
        const selectedIds = selectedAssets.map(a => a.id.toLowerCase())
      const filtered = assets
          .filter(a => {
            const notSelected = !selectedIds.includes(a.id.toLowerCase())
            const isAvailable = !a.status || a.status === "Available"
            return notSelected && isAvailable
          })
        .slice(0, 10) // Limit suggestions to 10 for UI
      
      return filtered
    },
    enabled: showSuggestions && canViewAssets && canCheckout,
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
      
      return asset || null
    } catch (error) {
      console.error('Error looking up asset:', error)
      return null
    }
  }

  // Add asset to checkout list
  const handleAddAsset = async (asset?: Asset) => {
    const assetToAdd = asset || await lookupAsset(assetIdInput.trim())
    
    if (!assetToAdd) {
      if (!asset) {
        toast.error(`Asset with ID "${assetIdInput}" not found`)
      }
      return
    }

    // Check if asset is already checked out
    if (assetToAdd.status === "Checked out" || assetToAdd.status?.toLowerCase() === "checked out" || assetToAdd.status?.toLowerCase() === "in use") {
      const errorMessage = `Asset "${assetToAdd.assetTagId}" is already checked out. Cannot checkout an asset that is already checked out.`
      toast.error(errorMessage)
      setAssetIdInput("")
      setShowSuggestions(false)
      throw new Error(errorMessage)
    }

    // Check if asset is available
    if (assetToAdd.status && assetToAdd.status !== "Available") {
      const errorMessage = `Asset "${assetToAdd.assetTagId}" is not available. Current status: ${assetToAdd.status}`
      toast.error(errorMessage)
      setAssetIdInput("")
      setShowSuggestions(false)
      throw new Error(errorMessage)
    }

    // Check if asset is already in the list
    if (selectedAssets.some(a => a.id === assetToAdd.id)) {
      const errorMessage = 'Asset is already in the checkout list'
      toast.error(errorMessage)
      setAssetIdInput("")
      setShowSuggestions(false)
      throw new Error(errorMessage)
    }

    setSelectedAssets((prev) => [
      ...prev,
      {
        ...assetToAdd,
        newDepartment: assetToAdd.department || "",
        newSite: assetToAdd.site || "",
        newLocation: assetToAdd.location || "",
      },
    ])
    setAssetIdInput("")
    setShowSuggestions(false)
    setSelectedSuggestionIndex(-1)
    toast.success('Asset added to checkout list')
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

  // Remove asset from checkout list
  const handleRemoveAsset = (assetId: string) => {
    setSelectedAssets((prev) => prev.filter((a) => a.id !== assetId))
    toast.success('Asset removed from checkout list')
  }

  // Handle removing an asset from QR scanner
  const handleQRRemove = async (assetTagId: string) => {
    // Remove from loading state if present
    setLoadingAssets(prev => {
      const newSet = new Set(prev)
      newSet.delete(assetTagId)
      return newSet
    })
    // Remove from selected assets
    const assetToRemove = selectedAssets.find(a => a.assetTagId === assetTagId)
    if (assetToRemove) {
      handleRemoveAsset(assetToRemove.id)
    }
  }

  // Clear URL parameters helper
  const clearUrlParams = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('assetId')
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname
    router.replace(newUrl)
    hasProcessedUrlParams.current = false
  }, [searchParams, router])

  // Handle URL query parameters for assetId
  useEffect(() => {
    // Skip if we've already processed URL params (prevents re-population after save)
    if (hasProcessedUrlParams.current) {
      return
    }

    const urlAssetId = searchParams.get('assetId')

    if (urlAssetId && selectedAssets.length === 0) {
      // Mark as processed to prevent re-population
      hasProcessedUrlParams.current = true
      
      // Fetch and add the asset from URL
      const addAssetFromUrl = async () => {
        try {
          const response = await fetch(`/api/assets/${urlAssetId}`)
          if (response.ok) {
            const data = await response.json()
            const asset = data.asset as Asset
            
            // Check if asset is already checked out
            if (asset.status === "Checked out" || asset.status?.toLowerCase() === "checked out" || asset.status?.toLowerCase() === "in use") {
              toast.error(`Asset "${asset.assetTagId}" is already checked out. Cannot checkout an asset that is already checked out.`)
              clearUrlParams()
              return
            }

            // Check if asset is available
            if (asset.status && asset.status !== "Available") {
              toast.error(`Asset "${asset.assetTagId}" is not available. Current status: ${asset.status}`)
              clearUrlParams()
              return
            }

            // Check if asset is already in the list
            if (selectedAssets.some(a => a.id === asset.id)) {
              return
            }

            setSelectedAssets([
              {
                ...asset,
                newDepartment: asset.department || "",
                newSite: asset.site || "",
                newLocation: asset.location || "",
              },
            ])
            setAssetIdInput(asset.assetTagId)
          }
        } catch (error) {
          console.error('Error fetching asset from URL:', error)
        }
      }
      
      addAssetFromUrl()
    }
  }, [searchParams, selectedAssets, clearUrlParams])

  // Track form changes to show floating buttons - only show when assets are selected
  const isFormDirty = useMemo(() => {
    // Only show floating buttons when assets are actually selected
    return selectedAssets.length > 0
  }, [selectedAssets])

  // Clear form function
  const clearForm = () => {
    setSelectedAssets([])
    setAssetIdInput("")
    form.reset({
      employeeId: "",
      checkoutDate: new Date().toISOString().split('T')[0],
      expectedReturnDate: "",
      department: "",
      site: "",
      location: "",
    })
  }

  // Handle QR code scan result
  const handleQRScan = async (decodedText: string) => {
    // Check if already selected or loading
    const alreadySelected = selectedAssets.find(
      (a) => a.assetTagId.toLowerCase() === decodedText.toLowerCase()
    )
    if (alreadySelected) {
      toast.info(`Asset "${decodedText}" already selected`)
      return
    }

    if (loadingAssets.has(decodedText)) {
      return // Already loading this asset
    }

    // Add to loading state
    setLoadingAssets(prev => new Set(prev).add(decodedText))

    try {
    // Lookup asset by the scanned QR code (which should be the assetTagId)
    const asset = await lookupAsset(decodedText)
    if (asset) {
      await handleAddAsset(asset)
    } else {
      const errorMessage = `Asset with ID "${decodedText}" not found`
      toast.error(errorMessage)
      throw new Error(errorMessage)
      }
    } finally {
      // Remove from loading state
      setLoadingAssets(prev => {
        const newSet = new Set(prev)
        newSet.delete(decodedText)
        return newSet
      })
    }
  }

  // Update asset info in checkout list
  const handleUpdateAssetInfo = (assetId: string, field: string, value: string) => {
    setSelectedAssets((prev) =>
      prev.map((asset) =>
        asset.id === assetId ? { ...asset, [field]: value } : asset
      )
    )
  }

  // Checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: async (data: {
      assetIds: string[]
      employeeUserId: string
      checkoutDate: string
      expectedReturnDate?: string
      updates: Record<string, { department?: string; site?: string; location?: string }>
    }) => {
      const response = await fetch('/api/assets/checkout', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to checkout assets')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] })
      queryClient.invalidateQueries({ queryKey: ["checkout-stats"] })
      toast.success('Assets checked out successfully')
      clearForm()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to checkout assets')
    },
  })

  // Handle form submission
  const onSubmit = async (data: CheckoutFormData) => {
    if (selectedAssets.length === 0) {
      toast.error('Please add at least one asset to checkout')
      return
    }

    const updates: Record<string, { department?: string; site?: string; location?: string }> = {}
    selectedAssets.forEach((asset) => {
      updates[asset.id] = {
        ...(asset.newDepartment && asset.newDepartment !== asset.department
          ? { department: asset.newDepartment }
          : {}),
        ...(asset.newSite && asset.newSite !== asset.site
          ? { site: asset.newSite }
          : {}),
        ...(asset.newLocation && asset.newLocation !== asset.location
          ? { location: asset.newLocation }
          : {}),
      }
    })

    checkoutMutation.mutate({
      assetIds: selectedAssets.map((a) => a.id),
      employeeUserId: data.employeeId,
      checkoutDate: data.checkoutDate,
      expectedReturnDate: data.expectedReturnDate || undefined,
      updates,
    })
  }

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAssetIdInput(e.target.value)
    setShowSuggestions(true)
    setSelectedSuggestionIndex(-1)
  }

  // Fetch all available assets for statistics
  const { data: allAssets = [], isLoading: isLoadingAssets } = useQuery<Asset[]>({
    queryKey: ["assets", "checkout-stats"],
    queryFn: async () => {
      const response = await fetch('/api/assets?search=&pageSize=10000')
      const data = await response.json()
      return data.assets as Asset[]
    },
    enabled: canViewAssets,
    staleTime: 5 * 60 * 1000,
  })

  // Calculate summary statistics
  const totalAvailableAssets = allAssets.filter(a => !a.status || a.status === "Available").length
  const selectedAssetsCount = selectedAssets.length
  
  // Fetch employees count for statistics
  const { data: employees = [] } = useQuery<EmployeeUser[]>({
    queryKey: ["employees", "checkout-stats"],
    queryFn: async () => {
      const response = await fetch("/api/employees")
      if (!response.ok) {
        throw new Error('Failed to fetch employees')
      }
      const data = await response.json()
      return (data.employees || []) as EmployeeUser[]
    },
    enabled: canViewAssets,
    retry: 2,
    retryDelay: 1000,
  })
  const availableEmployeesCount = employees.length

  // Fetch checkout statistics
  const { data: checkoutStats, isLoading: isLoadingCheckoutStats, error: checkoutStatsError } = useQuery<{
    recentCheckouts: Array<{
      id: string
      checkoutDate: string
      expectedReturnDate?: string | null
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
      }
    }>
  }>({
    queryKey: ["checkout-stats"],
    queryFn: async () => {
      const response = await fetch("/api/assets/checkout/stats")
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch checkout statistics')
      }
      const data = await response.json()
      return data
    },
    enabled: canViewAssets,
    retry: (failureCount, error) => {
      // Only retry on network errors or 500s, not on 4xx errors
      if (error instanceof Error && error.message.includes('Failed to fetch')) {
        return failureCount < 2
      }
      return false
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
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

  const recentCheckouts = checkoutStats?.recentCheckouts || []

  return (
    <div className={isFormDirty ? "pb-16" : ""}>
      <div>
        <h1 className="text-3xl font-bold">Check Out Asset</h1>
        <p className="text-muted-foreground">
          Record an asset checkout transaction
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 mt-6">
        {/* Total Available Assets */}
        <Card className="flex flex-col py-0 gap-2">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-green-100 text-green-500">
                <Package className="h-4 w-4" />
              </div>
              <CardTitle className="text-sm font-medium">Available Assets</CardTitle>
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
                <div className="text-2xl font-bold">{totalAvailableAssets}</div>
                <p className="text-xs text-muted-foreground">
                  Assets ready for checkout
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Selected Assets */}
        <Card className="flex flex-col py-0 gap-2">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 text-blue-500">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <CardTitle className="text-sm font-medium">Selected for Checkout</CardTitle>
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
                  Assets in checkout list
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Available Employees */}
        <Card className="flex flex-col py-0 gap-2">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-100 text-amber-500">
                <Users className="h-4 w-4" />
              </div>
              <CardTitle className="text-sm font-medium">Available Employees</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col grow justify-center p-4 pt-0">
            {permissionsLoading || !employees ? (
              <>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-4 w-32" />
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">{availableEmployeesCount}</div>
                <p className="text-xs text-muted-foreground">
                  Employees without checkouts
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
            {permissionsLoading || isLoadingCheckoutStats ? (
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
            ) : checkoutStatsError ? (
              <p className="text-sm text-destructive text-center py-4">
                Failed to load history. Please try again.
              </p>
            ) : recentCheckouts.length > 0 ? (
              <ScrollArea className="h-52">
                <div className="relative w-full">
                  <Table className="w-full caption-bottom text-sm">
                    <TableHeader className="sticky top-0 z-0 bg-card">
                    <TableRow>
                        <TableHead className="h-8 text-xs bg-card">Asset ID</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Description</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Employee</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Checkout Date</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Expected Return</TableHead>
                        <TableHead className="h-8 text-xs text-right bg-card">Time Ago</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentCheckouts.map((checkout) => (
                      <TableRow key={checkout.id} className="h-10">
                        <TableCell className="py-1.5">
                          <Badge 
                            variant="outline" 
                            className="text-xs cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors"
                            onClick={() => {
                              setSelectedAssetTagForQR(checkout.asset.assetTagId)
                              setQrDisplayDialogOpen(true)
                            }}
                          >
                            {checkout.asset.assetTagId}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5 text-xs max-w-[200px] truncate">
                          {checkout.asset.description}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground">
                          {checkout.employeeUser?.name || '-'}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground">
                          {new Date(checkout.checkoutDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground">
                          {checkout.expectedReturnDate 
                            ? new Date(checkout.expectedReturnDate).toLocaleDateString() 
                            : '-'}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground text-right">
                          {getTimeAgo(checkout.createdAt)}
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
                No recent checkouts
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-6">
        {/* Asset Selection Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Asset Selection</CardTitle>
            <CardDescription className="text-xs">
              Type asset ID and press Enter, or select an asset from the suggestions to add to the checkout list
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
                onFocus={() => setShowSuggestions(true)}
                className="w-full"
                autoComplete="off"
                disabled={!canViewAssets || !canCheckout}
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
              {canViewAssets && canCheckout && (
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

            {(selectedAssets.length > 0 || loadingAssets.size > 0) && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Selected Assets ({selectedAssets.length + loadingAssets.size})
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {/* Loading placeholders */}
                  {Array.from(loadingAssets).map((code) => (
                    <div
                      key={`loading-${code}`}
                      className="flex items-center justify-between gap-2 p-3 border rounded-md bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                            <Spinner className="h-3 w-3" />
                            {code}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground italic mt-1">
                          Looking up asset details...
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setLoadingAssets(prev => {
                            const newSet = new Set(prev)
                            newSet.delete(code)
                            return newSet
                          })
                        }}
                        className="h-8 w-8"
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {/* Actual selected assets */}
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

        {/* Assignment & Checkout Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Assignment & Checkout Details</CardTitle>
            <CardDescription className="text-xs">
              Assign assets to an employee and set checkout dates
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2 pb-4">
            <div className="space-y-4">
              <EmployeeSelectField
                name="employeeId"
                control={form.control as unknown as Control<Record<string, unknown>>}
                error={form.formState.errors.employeeId}
                label="Assign To"
                required
                    disabled={!canViewAssets || !canCheckout}
                queryKey={["employees", "checkout"]}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
              <Field>
                <FieldLabel htmlFor="checkoutDate">
                  Checkout Date <span className="text-destructive">*</span>
                </FieldLabel>
                <FieldContent>
                  <Input
                    id="checkoutDate"
                    type="date"
                      {...form.register("checkoutDate")}
                      aria-invalid={form.formState.errors.checkoutDate ? "true" : "false"}
                    disabled={!canViewAssets || !canCheckout}
                  />
                    {form.formState.errors.checkoutDate && (
                      <FieldError>{form.formState.errors.checkoutDate.message}</FieldError>
                    )}
                </FieldContent>
              </Field>

                <Field>
                <FieldLabel htmlFor="expectedReturnDate">
                  Expected Return Date
                </FieldLabel>
                <FieldContent>
                  <Input
                    id="expectedReturnDate"
                    type="date"
                      {...form.register("expectedReturnDate")}
                    min={checkoutDate}
                      aria-invalid={form.formState.errors.expectedReturnDate ? "true" : "false"}
                    disabled={!canViewAssets || !canCheckout}
                  />
                    {form.formState.errors.expectedReturnDate && (
                      <FieldError>{form.formState.errors.expectedReturnDate.message}</FieldError>
                    )}
                </FieldContent>
              </Field>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Additional Information */}
        {selectedAssets.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Additional Information</CardTitle>
              <CardDescription className="text-xs">
                Optionally change site, location and department of assets
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3">
                      <DepartmentSelectField
                        value={asset.newDepartment || ""}
                        onValueChange={(value) =>
                          handleUpdateAssetInfo(asset.id, "newDepartment", value)
                        }
                        label={
                          <>
                            Department
                            {asset.department && (
                              <span className="text-xs text-muted-foreground font-normal ml-2">
                                (Current: {asset.department})
                              </span>
                            )}
                          </>
                        }
                        placeholder={asset.department || "Select or search department"}
                        disabled={!canViewAssets || !canCheckout}
                        canCreate={canManageSetup}
                      />

                      <SiteSelectField
                        value={asset.newSite || ""}
                        onValueChange={(value) =>
                          handleUpdateAssetInfo(asset.id, "newSite", value)
                        }
                        label={
                          <>
                            Site
                            {asset.site && (
                              <span className="text-xs text-muted-foreground font-normal ml-2">
                                (Current: {asset.site})
                              </span>
                            )}
                          </>
                        }
                        placeholder={asset.site || "Select or search site"}
                        disabled={!canViewAssets || !canCheckout}
                        canCreate={canManageSetup}
                      />

                      <LocationSelectField
                        value={asset.newLocation || ""}
                        onValueChange={(value) =>
                          handleUpdateAssetInfo(asset.id, "newLocation", value)
                        }
                        label={
                          <>
                            Location
                            {asset.location && (
                              <span className="text-xs text-muted-foreground font-normal ml-2">
                                (Current: {asset.location})
                              </span>
                            )}
                          </>
                        }
                        placeholder={asset.location || "Select or search location"}
                        disabled={!canViewAssets || !canCheckout}
                        canCreate={canManageSetup}
                      />
        </div>
      </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </form>

      {/* Floating Action Buttons - Only show when form has changes */}
      {isFormDirty && canViewAssets && canCheckout && (
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
            disabled={checkoutMutation.isPending || selectedAssets.length === 0 || !canCheckout}
            className="min-w-[120px]"
          >
            {checkoutMutation.isPending ? (
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
        onRemove={handleQRRemove}
        multiScan={true}
        existingCodes={selectedAssets.map(asset => asset.assetTagId)}
        loadingCodes={Array.from(loadingAssets)}
        description="Scan or upload QR codes to add assets. Continue scanning to add multiple assets."
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

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Check Out Asset</h1>
          <p className="text-muted-foreground">
            Assign an asset to an employee
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
      <CheckoutPageContent />
    </Suspense>
  )
}
