"use client"

import { useState, useRef, useEffect, useMemo, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useForm, Controller, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { XIcon, History, QrCode, Search } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { usePermissions } from '@/hooks/use-permissions'
import { useSidebar } from '@/components/ui/sidebar'
import { useIsMobile } from '@/hooks/use-mobile'
import { useMobileDock } from '@/components/mobile-dock-provider'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { QRScannerDialog } from '@/components/dialogs/qr-scanner-dialog'
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
import { DatePicker } from "@/components/ui/date-picker"
import { EmployeeSelectField } from "@/components/fields/employee-select-field"
import { DepartmentSelectField } from "@/components/fields/department-select-field"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { QRCodeDisplayDialog } from "@/components/dialogs/qr-code-display-dialog"
import { reserveSchema, type ReserveFormData } from "@/lib/validations/assets"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClient } from '@/lib/supabase-client'
import { useAssetSuggestions, type Asset as AssetFromHook } from '@/hooks/use-assets'

// Get API base URL - use FastAPI if enabled
const getApiBaseUrl = () => {
  const useFastAPI = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true'
  const fastApiUrl = process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000'
  return useFastAPI ? fastApiUrl : ''
}

// Helper function to get auth token from Supabase session
async function getAuthToken(): Promise<string | null> {
  try {
    const supabase = createClient()
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) {
      console.error('Failed to get auth token:', error)
      return null
    }
    if (!session?.access_token) {
      return null
    }
    return session.access_token
  } catch (error) {
    console.error('Error getting auth token:', error)
    return null
  }
}

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
  // Treat null/undefined as "Available"
  const statusToCheck = status || "Available"
  const statusLC = statusToCheck.toLowerCase()
  
  // Only show green badge for Available status, others use default outline
  if (statusLC === 'active' || statusLC === 'available') {
    return <Badge variant="default" className="bg-green-500">{statusToCheck}</Badge>
  }
  
  // For any other status (shouldn't happen for reserve, but just in case)
  return <Badge variant="outline">{statusToCheck}</Badge>
}

function ReserveAssetPageContent() {
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const { state: sidebarState, open: sidebarOpen } = useSidebar()
  const isMobile = useIsMobile()
  const { setDockContent } = useMobileDock()
  const canViewAssets = hasPermission('canViewAssets')
  const canReserve = hasPermission('canReserve')
  const canManageSetup = hasPermission('canManageSetup')
  const hasProcessedUrlParams = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionRef = useRef<HTMLDivElement>(null)
  const [assetIdInput, setAssetIdInput] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [qrDisplayDialogOpen, setQrDisplayDialogOpen] = useState(false)
  const [selectedAssetTagForQR, setSelectedAssetTagForQR] = useState<string>("")
  const [loadingAssets, setLoadingAssets] = useState<Set<string>>(new Set())
  const isInitialMount = useRef(true)

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
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/assets/reserve/stats`
      
      const token = await getAuthToken()
      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(url, {
        headers,
        credentials: 'include',
        cache: 'no-store', // Don't cache the fetch request
      })
      if (!response.ok) {
        throw new Error('Failed to fetch reservation statistics')
      }
      const data = await response.json()
      return data
    },
    enabled: canViewAssets,
    retry: 2,
    retryDelay: 1000,
    staleTime: 0, // Always consider data stale to allow immediate refetch
    placeholderData: (previousData) => previousData, // Keep showing previous data during refetch
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

  // Fetch asset suggestions using reusable hook (only Available assets)
  const { suggestions: assetSuggestions, isLoading: isLoadingSuggestions } = useAssetSuggestions(
    assetIdInput,
    "Available", // Filter for Available status only
    [],
    canViewAssets && canReserve,
    showSuggestions,
    10 // max results - limit to 10 suggestions
  )

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

  // Find asset by ID without status check (for error messages) using FastAPI
  const findAssetById = async (assetTagId: string): Promise<Asset | null> => {
    try {
      // Use a cache-busting timestamp to ensure fresh data
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/assets?search=${encodeURIComponent(assetTagId)}&pageSize=10&_t=${Date.now()}`
      
      const token = await getAuthToken()
      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(url, {
        credentials: 'include',
        headers,
      })
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
  const handleSelectSuggestion = (asset: AssetFromHook) => {
    // Convert AssetFromHook to local Asset type - use type assertion since types are compatible
    const assetToSelect = asset as unknown as Asset
    setSelectedAsset(assetToSelect)
    setAssetIdInput(asset.assetTagId)
    form.setValue('assetId', asset.id)
    setShowSuggestions(false)
    setSelectedSuggestionIndex(-1)
    toast.success('Asset selected')
  }

  // Handle asset selection
  const handleSelectAsset = async (asset?: Asset) => {
    let assetToSelect = asset || await lookupAsset(assetIdInput.trim())
    if (!assetToSelect) {
      if (!asset) {
        toast.error(`Asset with ID "${assetIdInput}" not found or not available for reservation`)
      }
      return
    }

    // Always fetch fresh asset data to ensure we have the latest values
    try {
      const baseUrl = getApiBaseUrl()
      const token = await getAuthToken()
      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      const response = await fetch(`${baseUrl}/api/assets/${assetToSelect.id}`, { headers })
      if (response.ok) {
        const result = await response.json()
        assetToSelect = result.asset as Asset
      }
    } catch (error) {
      console.error('Error fetching fresh asset data:', error)
      // Continue with the asset we have if fetch fails
    }

    setSelectedAsset(assetToSelect)
    setAssetIdInput(assetToSelect.assetTagId)
    form.setValue('assetId', assetToSelect.id)
    setShowSuggestions(false)
    setSelectedSuggestionIndex(-1)
    
    // Pre-populate fields based on reservationType and current asset values
    if (reservationType === 'Employee') {
      // For employee reservation, we don't pre-populate employeeUserId
      // User needs to select the employee they want to reserve for
      form.setValue('employeeUserId', '', { shouldValidate: false })
      form.clearErrors('employeeUserId')
    }
    
    if (reservationType === 'Department' && assetToSelect.department) {
      form.setValue('department', assetToSelect.department, { shouldValidate: false })
      form.clearErrors('department')
    }
    
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

  // Clear selected asset
  const handleClearAsset = () => {
    setSelectedAsset(null)
    setAssetIdInput("")
    form.setValue('assetId', '')
    toast.success('Asset cleared')
  }

  // Clear URL parameters helper
  const clearUrlParams = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('assetId')
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname
    router.replace(newUrl)
    // Don't reset hasProcessedUrlParams here - let it be controlled by the caller
  }, [searchParams, router])

  // Handle URL query parameters for assetId
  useEffect(() => {
    // Skip if we've already processed URL params (prevents re-population after save)
    if (hasProcessedUrlParams.current) {
      return
    }

    const urlAssetId = searchParams.get('assetId')

    if (urlAssetId && !selectedAsset) {
      // Mark as processed to prevent re-population
      hasProcessedUrlParams.current = true
      
      // Fetch and select the asset from URL
      const selectAssetFromUrl = async () => {
        try {
          const baseUrl = getApiBaseUrl()
          const token = await getAuthToken()
          const headers: HeadersInit = {}
          if (token) {
            headers['Authorization'] = `Bearer ${token}`
          }
          const response = await fetch(`${baseUrl}/api/assets/${urlAssetId}`, { headers })
          if (response.ok) {
            const data = await response.json()
            const asset = data.asset as Asset
            
            // Check if asset is available for reservation
            if (asset.status && asset.status !== "Available") {
              toast.error(`Asset "${asset.assetTagId}" is not available for reservation. Current status: ${asset.status}`)
              clearUrlParams()
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
  }, [searchParams, selectedAsset, form, clearUrlParams])

  // Track form changes to show floating buttons - only show when asset is selected
  const isFormDirty = useMemo(() => {
    // Only show floating buttons when an asset is actually selected
    return !!selectedAsset
  }, [selectedAsset])

  // Set mobile dock content
  useEffect(() => {
    if (isMobile) {
      setDockContent(
        <>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              if (inputRef.current) {
                inputRef.current.focus()
              }
            }}
            className="h-10 w-10 rounded-full btn-glass-elevated"
            title="Search"
            disabled={!canViewAssets || !canReserve}
          >
            <Search className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setQrDialogOpen(true)}
            className="h-10 w-10 rounded-full btn-glass-elevated"
            title="QR Code"
            disabled={!canViewAssets || !canReserve}
          >
            <QrCode className="h-4 w-4" />
          </Button>
        </>
      )
    } else {
      setDockContent(null)
    }
    
    return () => {
      setDockContent(null)
    }
  }, [isMobile, setDockContent, canViewAssets, canReserve])

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
    // Only reset the flag if URL params are already cleared (allows new URL params to be processed)
    if (!searchParams.get('assetId')) {
      hasProcessedUrlParams.current = false
    }
  }

  // Handle QR code scan result
  const handleQRScan = async (decodedText: string) => {
    // Add to loading set
    setLoadingAssets(prev => new Set(prev).add(decodedText))
    
    try {
      // First check if asset exists (regardless of status)
      const assetExists = await findAssetById(decodedText)
      
      if (!assetExists) {
        const errorMessage = `Asset with ID "${decodedText}" not found`
        toast.error(errorMessage)
        throw new Error(errorMessage)
      }
      
      // Check if asset is already checked out
      if (assetExists.status === "Checked out" || assetExists.status?.toLowerCase() === "checked out" || assetExists.status?.toLowerCase() === "in use") {
        const errorMessage = `Asset "${assetExists.assetTagId}" is already checked out. Cannot reserve an asset that is already checked out.`
        toast.error(errorMessage)
        throw new Error(errorMessage)
      }
      
      // Check if asset is available for reservation
      if (assetExists.status && assetExists.status !== "Available" && assetExists.status !== null && assetExists.status !== undefined) {
        const errorMessage = `Asset "${assetExists.assetTagId}" is not available for reservation. Current status: ${assetExists.status}`
        toast.error(errorMessage)
        throw new Error(errorMessage)
      }
      
      // Asset exists and is available, proceed to select it
      await handleSelectAsset(assetExists)
    } finally {
      // Remove from loading set
      setLoadingAssets(prev => {
        const newSet = new Set(prev)
        newSet.delete(decodedText)
        return newSet
      })
    }
  }

  // Handle reservation type change - reset conditional fields
  const handleReservationTypeChange = (value: ReservationType) => {
    form.setValue('reservationType', value)
    
    // Reset and populate conditional fields based on selected asset
    if (value === 'Employee') {
      form.setValue('employeeUserId', '', { shouldValidate: false })
      form.setValue('department', '', { shouldValidate: false })
      form.clearErrors(['employeeUserId', 'department'])
    } else if (value === 'Department') {
      form.setValue('department', selectedAsset?.department || '', { shouldValidate: false })
      form.setValue('employeeUserId', '', { shouldValidate: false })
      form.clearErrors(['employeeUserId', 'department'])
    } else {
      // Reset all when no reservation type selected
      form.setValue('employeeUserId', '', { shouldValidate: false })
      form.setValue('department', '', { shouldValidate: false })
      form.clearErrors(['employeeUserId', 'department'])
    }
    // Don't trigger validation immediately - let user interact first
    // Validation will happen on submit
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
      const baseUrl = getApiBaseUrl()
      const token = await getAuthToken()
      const headers: HeadersInit = { "Content-Type": "application/json" }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${baseUrl}/api/assets/reserve`, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to reserve asset')
      }

      return response.json()
    },
    onSuccess: async (data, variables) => {
      // Invalidate all asset-related queries to get fresh data
      queryClient.invalidateQueries({ queryKey: ["assets"] })
      queryClient.invalidateQueries({ queryKey: ["reserve-stats"] })
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "asset-reserve-suggestions" })
      // Refetch in background without removing existing data
      queryClient.refetchQueries({ queryKey: ["reserve-stats"] })
      
      // Fetch fresh asset data to update selectedAsset if it's still selected
      if (selectedAsset && selectedAsset.id === variables.assetId) {
        try {
          const baseUrl = getApiBaseUrl()
          const token = await getAuthToken()
          const headers: HeadersInit = {}
          if (token) {
            headers['Authorization'] = `Bearer ${token}`
          }
          const response = await fetch(`${baseUrl}/api/assets/${variables.assetId}`, { headers })
          if (response.ok) {
            const result = await response.json()
            const updatedAsset = result.asset as Asset
            setSelectedAsset(updatedAsset)
          }
        } catch (error) {
          console.error('Error fetching updated asset:', error)
        }
      }
      
      // Mark URL params as processed BEFORE clearing form to prevent re-processing
      hasProcessedUrlParams.current = true
      toast.success('Asset reserved successfully')
      clearUrlParams()
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

  // Track initial mount for animations
  useEffect(() => {
    if (isInitialMount.current && recentReservations.length > 0) {
      const timer = setTimeout(() => {
        isInitialMount.current = false
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [recentReservations.length])

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={isFormDirty ? "pb-16" : ""}
    >
      <div>
        <h1 className="text-3xl font-bold">Reserve Asset</h1>
        <p className="text-muted-foreground">
          Book an asset for future use by an employee or department
        </p>
      </div>

      {/* Summary Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid gap-4 grid-cols-1 mt-6"
      >
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
            {permissionsLoading || (isLoadingReserveStats && !reserveStats) ? (
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
              <ScrollArea className="h-52" key={`reserve-history-${recentReservations.length}-${recentReservations[0]?.id}`}>
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
                    <AnimatePresence mode='popLayout' initial={false}>
                      {recentReservations.map((reservation, index) => (
                        <motion.tr
                          key={reservation.id}
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
                          className="h-10 border-b"
                        >
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
                        </motion.tr>
                    ))}
                    </AnimatePresence>
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
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-6 mt-6">
        {/* Asset Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Asset Selection</CardTitle>
            <CardDescription className="text-xs">
              Type asset ID and press Enter, or select an asset from the suggestions
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2 pb-4 space-y-4">
            <AnimatePresence>
              {loadingAssets.size > 0 && (
              <div className="space-y-2">
                {Array.from(loadingAssets).map((code) => (
                    <motion.div
                    key={`loading-${code}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.2 }}
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
                    </motion.div>
                ))}
              </div>
              )}
            </AnimatePresence>
            {!selectedAsset && (
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
                    className="absolute z-50 w-full mt-1 bg-clip-padding backdrop-filter backdrop-blur-md bg-opacity-10 border shadow-2xl rounded-md max-h-60 overflow-auto"
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
                        <motion.div
                          key={asset.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2, delay: index * 0.05 }}
                          onClick={() => handleSelectSuggestion(asset)}
                          onMouseEnter={() => setSelectedSuggestionIndex(index)}
                          className={cn(
                            "px-4 py-3 cursor-pointer transition-colors",
                            "hover:bg-gray-400/20 hover:bg-clip-padding hover:backdrop-filter hover:backdrop-blur-sm",
                            selectedSuggestionIndex === index && "bg-gray-400/20 bg-clip-padding backdrop-filter backdrop-blur-sm"
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
                            {getStatusBadge(asset.status || null)}
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No assets found. Start typing to search...
                      </div>
                    )}
                  </div>
                )}
              </div>
              {canViewAssets && canReserve && !isMobile && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setQrDialogOpen(true)}
                title="QR Code"
                className="bg-transparent dark:bg-input/30"
              >
                <QrCode className="h-4 w-4" />
              </Button>
              )}
              </div>
            )}
            <AnimatePresence>
              {selectedAsset && (
                <motion.div
                  key={selectedAsset.id}
                  initial={{ opacity: 0, x: -20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 20, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center justify-between gap-2 p-3 border rounded-md bg-muted/50"
                >
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
                </motion.div>
            )}
            </AnimatePresence>
          </CardContent>
        </Card>
        </motion.div>

        {/* Reservation Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
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
                        // Trigger validation after value change to clear error
                        // Since the refine validation checks the entire form, trigger both fields
                        setTimeout(() => {
                          form.trigger(['reservationType', 'employeeUserId'])
                        }, 0)
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
              <Controller
                name="department"
                control={form.control}
                render={({ field, fieldState }) => (
                  <>
                    <DepartmentSelectField
                      value={field.value || ""}
                      onValueChange={(value) => {
                        field.onChange(value)
                        form.clearErrors('department')
                      }}
                      label={
                        <>
                          Department <span className="text-destructive">*</span>
                          {selectedAsset?.department && (
                            <span className="text-xs text-muted-foreground font-normal ml-2">
                              (Current: {selectedAsset.department})
                            </span>
                          )}
                        </>
                      }
                      required
                      disabled={!canViewAssets || !canReserve || !selectedAsset}
                      placeholder={selectedAsset?.department || "Select or search department"}
                      canCreate={canManageSetup}
                    />
                    {fieldState.error && (
                      <FieldError>{fieldState.error.message}</FieldError>
                    )}
                  </>
                )}
              />
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
                    <DatePicker
                      id="reservationDate"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      disabled={!canViewAssets || !canReserve || !selectedAsset}
                      placeholder="Select reservation date"
                      error={fieldState.error?.message}
                      className="gap-2"
                      labelClassName="hidden"
                    />
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
        </motion.div>
      </form>

      {/* Floating Action Buttons - Only show when form has changes */}
      <AnimatePresence>
      {isFormDirty && canViewAssets && canReserve && (
          <motion.div 
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed bottom-20 md:bottom-6 z-50 flex items-center justify-center gap-3"
          style={{
              left: isMobile 
                ? '50%'
                : !sidebarOpen 
              ? '50%'
              : sidebarState === 'collapsed' 
                ? 'calc(var(--sidebar-width-icon, 3rem) + ((100vw - var(--sidebar-width-icon, 3rem)) / 2))'
                    : 'calc(var(--sidebar-width, 16rem) + ((100vw - var(--sidebar-width, 16rem)) / 2))'
          }}
        >
              <Button
                type="button"
                variant="outline"
            size="lg"
            onClick={clearForm}
            className="min-w-[120px] btn-glass"
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Code Scanner Dialog */}
      <QRScannerDialog
        open={qrDialogOpen}
        onOpenChange={setQrDialogOpen}
        onScan={handleQRScan}
        multiScan={true}
        existingCodes={selectedAsset ? [selectedAsset.assetTagId] : []}
        loadingCodes={Array.from(loadingAssets)}
        description="Scan or upload QR codes to select an asset. Continue scanning to change selection."
      />

      {/* QR Code Display Dialog */}
      <QRCodeDisplayDialog
        open={qrDisplayDialogOpen}
        onOpenChange={setQrDisplayDialogOpen}
        assetTagId={selectedAssetTagForQR}
      />
    </motion.div>
  )
}

export default function ReserveAssetPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Reserve Asset</h1>
          <p className="text-muted-foreground">
            Reserve an asset for future use
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
      <ReserveAssetPageContent />
    </Suspense>
  )
}
