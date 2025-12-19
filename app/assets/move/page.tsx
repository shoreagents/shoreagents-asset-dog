"use client"

import { useState, useRef, useEffect, useMemo, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useForm, Controller, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { XIcon, History, QrCode } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { usePermissions } from '@/hooks/use-permissions'
import { useSidebar } from '@/components/ui/sidebar'
import { useIsMobile } from '@/hooks/use-mobile'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { QRScannerDialog } from '@/components/dialogs/qr-scanner-dialog'
import { QRCodeDisplayDialog } from '@/components/dialogs/qr-code-display-dialog'
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
import { EmployeeSelectField } from "@/components/fields/employee-select-field"
import { LocationSelectField } from "@/components/fields/location-select-field"
import { DepartmentSelectField } from "@/components/fields/department-select-field"
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
      console.warn('No active session found')
      return null
    }
    return session.access_token
  } catch (error) {
    console.error('Failed to get auth token:', error)
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
  checkouts?: Array<{
    id: string
    employeeUser: {
      id: string
      name: string
      email: string
      department: string | null
    } | null
    checkins?: Array<{
      id: string
    }>
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
    statusColor = ''
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

function MoveAssetPageContent() {
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const { state: sidebarState, open: sidebarOpen } = useSidebar()
  const isMobile = useIsMobile()
  const canViewAssets = hasPermission('canViewAssets')
  const canMove = hasPermission('canMove')
  const canManageSetup = hasPermission('canManageSetup')
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionRef = useRef<HTMLDivElement>(null)
  const hasProcessedUrlParams = useRef(false)
  const [assetIdInput, setAssetIdInput] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [qrDisplayDialogOpen, setQrDisplayDialogOpen] = useState(false)
  const [selectedAssetTagForQR, setSelectedAssetTagForQR] = useState<string>("")
  const [loadingAssets, setLoadingAssets] = useState<Set<string>>(new Set())
  const isInitialMount = useRef(true)

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
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/assets/move/stats`
      
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
        throw new Error('Failed to fetch move statistics')
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

  // Fetch asset suggestions using reusable hook
  // Include all statuses, limit to 10 results
  const { suggestions: assetSuggestions, isLoading: isLoadingSuggestions } = useAssetSuggestions(
    assetIdInput,
    "", // No status filter - include all statuses
    [],
    canViewAssets && canMove,
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

  // Asset lookup by ID - always fetch fresh data using FastAPI
  const lookupAsset = async (assetTagId: string): Promise<Asset | null> => {
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

    // Note: Asset data from suggestions already includes checkouts, leases, and other needed fields
    // No need to fetch again - use the data we already have

    setSelectedAsset(assetToAdd)
    form.setValue('assetId', assetToAdd.id)
    setAssetIdInput("")
    setShowSuggestions(false)
    setSelectedSuggestionIndex(-1)
    
    // Pre-populate fields based on moveType and current asset values
    if (moveType === 'Location Transfer' && assetToAdd.location) {
      form.setValue('location', assetToAdd.location, { shouldValidate: false })
      form.clearErrors('location')
    }
    
    if (moveType === 'Employee Assignment') {
      // Find active checkout (one without checkins)
      const activeCheckout = assetToAdd.checkouts?.find(
        (checkout) => !checkout.checkins || checkout.checkins.length === 0
      )
      const currentEmployeeId = activeCheckout?.employeeUser?.id
      if (currentEmployeeId) {
        form.setValue('employeeUserId', currentEmployeeId, { shouldValidate: false })
        form.clearErrors('employeeUserId')
      }
    }
    
    if (moveType === 'Department Transfer' && assetToAdd.department) {
      form.setValue('department', assetToAdd.department, { shouldValidate: false })
      form.clearErrors('department')
    }
    
    toast.success('Asset selected')
  }

  // Handle suggestion selection
  const handleSelectSuggestion = (asset: AssetFromHook) => {
    // Convert AssetFromHook to local Asset type - use type assertion since types are compatible
    handleSelectAsset(asset as unknown as Asset)
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
          const url = `${baseUrl}/api/assets/${urlAssetId}`
          
          const token = await getAuthToken()
          const headers: HeadersInit = {}
          if (token) {
            headers['Authorization'] = `Bearer ${token}`
          }

          const response = await fetch(url, {
            headers,
            credentials: 'include',
          })
          if (response.ok) {
            const data = await response.json()
            const asset = data.asset as Asset
            
            // Check if asset is eligible for move (not leased)
            const hasActiveLease = asset.leases?.some(
              (lease) => !lease.leaseEndDate
            )
            
            if (hasActiveLease) {
              toast.error(`Asset "${asset.assetTagId}" is currently leased and cannot be moved`)
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

  // Refetch selected asset when window regains focus (to catch updates from other tabs/components)
  useEffect(() => {
    if (!selectedAsset) return

    const handleFocus = () => {
      // Refetch asset data when window regains focus to catch any updates
      const refetchAsset = async () => {
        try {
          const baseUrl = getApiBaseUrl()
          const url = `${baseUrl}/api/assets/${selectedAsset.id}`
          
          const token = await getAuthToken()
          const headers: HeadersInit = {}
          if (token) {
            headers['Authorization'] = `Bearer ${token}`
          }

          const response = await fetch(url, {
            headers,
            credentials: 'include',
          })
          if (response.ok) {
            const result = await response.json()
            const updatedAsset = result.asset as Asset
            // Only update if asset ID matches
            if (updatedAsset.id === selectedAsset.id) {
              setSelectedAsset(updatedAsset)
            }
          }
        } catch {
          // Silently fail - don't disrupt user experience
        }
      }
      refetchAsset()
    }

    window.addEventListener('focus', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [selectedAsset])

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
      // Lookup asset by the scanned QR code (which should be the assetTagId)
      const asset = await lookupAsset(decodedText)
      if (asset) {
        await handleSelectAsset(asset)
      } else {
        toast.error(`Asset with ID "${decodedText}" not found`)
      }
    } finally {
      // Remove from loading set
      setLoadingAssets(prev => {
        const newSet = new Set(prev)
        newSet.delete(decodedText)
        return newSet
      })
    }
  }

  // Handle move type change - reset conditional fields
  const handleMoveTypeChange = (value: MoveType) => {
    form.setValue('moveType', value as 'Location Transfer' | 'Employee Assignment' | 'Department Transfer')
    
    // Reset and populate conditional fields based on selected asset
    if (value === 'Location Transfer') {
      form.setValue('location', selectedAsset?.location || '', { shouldValidate: false })
      form.setValue('employeeUserId', '', { shouldValidate: false })
      form.setValue('department', '', { shouldValidate: false })
      form.clearErrors(['location', 'employeeUserId', 'department'])
    } else if (value === 'Employee Assignment') {
      // Find active checkout (one without checkins)
      const activeCheckout = selectedAsset?.checkouts?.find(
        (checkout) => !checkout.checkins || checkout.checkins.length === 0
      )
      const currentEmployeeId = activeCheckout?.employeeUser?.id
      form.setValue('employeeUserId', currentEmployeeId || '', { shouldValidate: false })
      form.setValue('location', '', { shouldValidate: false })
      form.setValue('department', '', { shouldValidate: false })
      form.clearErrors(['location', 'employeeUserId', 'department'])
    } else if (value === 'Department Transfer') {
      form.setValue('department', selectedAsset?.department || '', { shouldValidate: false })
      form.setValue('location', '', { shouldValidate: false })
      form.setValue('employeeUserId', '', { shouldValidate: false })
      form.clearErrors(['location', 'employeeUserId', 'department'])
    } else {
      // Reset all when no move type selected
      form.setValue('location', '', { shouldValidate: false })
      form.setValue('employeeUserId', '', { shouldValidate: false })
      form.setValue('department', '', { shouldValidate: false })
      form.clearErrors(['location', 'employeeUserId', 'department'])
    }
    // Don't trigger validation immediately - let user interact first
    // Validation will happen on submit
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
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/assets/move`
      
      const token = await getAuthToken()
      const headers: HeadersInit = { "Content-Type": "application/json" }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(url, {
        method: "POST",
        headers,
        credentials: 'include',
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to move asset' }))
        throw new Error(error.error || error.detail || 'Failed to move asset')
      }

      return response.json()
    },
    onSuccess: async (data, variables) => {
      // Invalidate all asset-related queries to get fresh data
      queryClient.invalidateQueries({ queryKey: ["assets"] })
      queryClient.invalidateQueries({ queryKey: ["move-stats"] })
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "asset-move-suggestions" })
      // Refetch in background without removing existing data
      queryClient.refetchQueries({ queryKey: ["move-stats"] })
      
      // Fetch fresh asset data to update selectedAsset if it's still selected
      if (selectedAsset && selectedAsset.id === variables.assetId) {
        try {
          const baseUrl = getApiBaseUrl()
          const url = `${baseUrl}/api/assets/${variables.assetId}`
          
          const token = await getAuthToken()
          const headers: HeadersInit = {}
          if (token) {
            headers['Authorization'] = `Bearer ${token}`
          }

          const response = await fetch(url, {
            headers,
            credentials: 'include',
          })
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
      toast.success('Asset moved successfully')
      clearUrlParams()
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

  // Track initial mount for animations
  useEffect(() => {
    if (isInitialMount.current && recentMoves.length > 0) {
      const timer = setTimeout(() => {
        isInitialMount.current = false
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [recentMoves.length])

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={isFormDirty ? "pb-16" : ""}
    >
      <div>
        <h1 className="text-3xl font-bold">Move Asset</h1>
        <p className="text-muted-foreground">
          Transfer an asset to a different location, employee, or department
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
            {permissionsLoading || (isLoadingMoveStats && !moveStats) ? (
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
              <ScrollArea className="h-52" key={`move-history-${recentMoves.length}-${recentMoves[0]?.id}`}>
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
                    <AnimatePresence mode='popLayout' initial={false}>
                      {recentMoves.map((move, index) => (
                        <motion.tr
                          key={move.id}
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
                No recent moves
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
                  disabled={!canViewAssets || !canMove}
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
                      assetSuggestions.map((asset: AssetFromHook, index: number) => (
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
                            {getStatusBadge(asset.status || 'Available')}
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
                    {selectedAsset.status === "Checked out" && (() => {
                      // Find active checkout (one without checkins)
                      const activeCheckout = selectedAsset.checkouts?.find(
                        (checkout: { checkins?: Array<{ id: string }> }) => !checkout.checkins || checkout.checkins.length === 0
                      )
                      return activeCheckout?.employeeUser ? (
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                          Assigned to: {activeCheckout.employeeUser.name} ({activeCheckout.employeeUser.email}){activeCheckout.employeeUser.department && <span className="text-muted-foreground"> - {activeCheckout.employeeUser.department}</span>}
                      </p>
                      ) : null
                    })()}
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

        {/* Move Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
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
                  <LocationSelectField
                    name="location"
                    control={form.control}
                    error={form.formState.errors.location}
                    label={
                      <>
                        Location <span className="text-destructive">*</span>
                        {selectedAsset?.location && (
                          <span className="text-xs text-muted-foreground font-normal ml-2">
                            (Current: {selectedAsset.location})
                          </span>
                        )}
                      </>
                    }
                    placeholder={selectedAsset?.location || "Select or search location"}
                    disabled={!canViewAssets || !canMove || !selectedAsset}
                    required
                    canCreate={canManageSetup}
                  />
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
                        currentEmployeeId={(() => {
                          // Find active checkout (one without checkins)
                          const activeCheckout = selectedAsset?.checkouts?.find(
                            (checkout) => !checkout.checkins || checkout.checkins.length === 0
                          )
                          return activeCheckout?.employeeUser?.id
                        })()}
                        queryKey={["employees", "move"]}
                        error={fieldState.error}
                      />
                    )}
                  />
                )}

                {moveType === 'Department Transfer' && (
                  <Controller
                    name="department"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <>
                        <DepartmentSelectField
                          value={field.value || ""}
                          onValueChange={(value) => field.onChange(value)}
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
                          placeholder={selectedAsset?.department || "Select or search department"}
                          disabled={!canViewAssets || !canMove || !selectedAsset}
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
        </motion.div>
      </form>

      {/* Floating Action Buttons - Only show when form has changes */}
      <AnimatePresence>
      {isFormDirty && canViewAssets && canMove && (
          <motion.div 
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed bottom-6 z-50 flex items-center justify-center gap-3"
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

export default function MoveAssetPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Move Asset</h1>
          <p className="text-muted-foreground">
            Move an asset to a different location
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
      <MoveAssetPageContent />
    </Suspense>
  )
}
