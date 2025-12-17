"use client"

import { useState, useRef, useEffect, useMemo, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { XIcon, Package, CheckCircle2, DollarSign, History, QrCode } from "lucide-react"
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
import { useAssetSuggestions } from '@/hooks/use-assets'
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
import { Field, FieldLabel, FieldContent, FieldError } from "@/components/ui/field"
import { LocationSelectField } from "@/components/fields/location-select-field"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { checkinSchema, type CheckinFormData } from "@/lib/validations/assets"
import { createClient } from '@/lib/supabase-client'
import type { Asset as AssetFromHook } from '@/hooks/use-assets'

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
  // Checkin page only shows Checked out assets, so always show blue badge
  const statusToShow = status || 'Checked out'
  const statusLC = statusToShow.toLowerCase()
  
  // Show destructive (red) badge for Checked out status
  if (statusLC === 'checked out' || statusLC === 'in use') {
    return <Badge variant="destructive">{statusToShow}</Badge>
  }
  
  // Fallback (shouldn't happen on checkin page, but just in case)
  return <Badge variant="outline">{statusToShow}</Badge>
}

function CheckinPageContent() {
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const hasProcessedUrlParams = useRef(false)
  const { state: sidebarState, open: sidebarOpen } = useSidebar()
  const isMobile = useIsMobile()
  const canViewAssets = hasPermission('canViewAssets')
  const canCheckin = hasPermission('canCheckin')
  const canManageSetup = hasPermission('canManageSetup')
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionRef = useRef<HTMLDivElement>(null)
  const [assetIdInput, setAssetIdInput] = useState("")
  const [debouncedAssetIdInput, setDebouncedAssetIdInput] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const [selectedAssets, setSelectedAssets] = useState<CheckinAsset[]>([])
  const [loadingAssets, setLoadingAssets] = useState<Set<string>>(new Set())
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [qrDisplayDialogOpen, setQrDisplayDialogOpen] = useState(false)
  const [selectedAssetTagForQR, setSelectedAssetTagForQR] = useState<string>("")
  const isInitialMount = useRef(true)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const form = useForm<CheckinFormData>({
    resolver: zodResolver(checkinSchema),
    defaultValues: {
      checkinDate: new Date().toISOString().split('T')[0],
      assetUpdates: [],
    },
  })

  // Debounce input to reduce API calls
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    debounceTimeoutRef.current = setTimeout(() => {
      setDebouncedAssetIdInput(assetIdInput)
    }, 300) // 300ms debounce

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [assetIdInput])

  // Fetch asset suggestions using reusable hook (only Checked out assets)
  const { suggestions: assetSuggestions, isLoading: isLoadingSuggestions } = useAssetSuggestions(
    debouncedAssetIdInput,
    "Checked out", // status filter for checkin
    selectedAssets.map(a => a.id),
    canViewAssets && canCheckin,
    showSuggestions,
    10 // max results when searching, 20 when empty
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

  // Asset lookup by ID - optimized to fetch only 10 items
  const lookupAsset = async (assetTagId: string): Promise<Asset | null> => {
    try {
      const response = await fetch(`/api/assets?search=${encodeURIComponent(assetTagId)}&pageSize=10`)
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

    // Check if asset is already available (already checked in)
    if (assetToAdd.status === "Available" || !assetToAdd.status || assetToAdd.status.toLowerCase() === "available") {
      const errorMessage = `Asset "${assetToAdd.assetTagId}" is already available. Cannot check in an asset that is already checked in.`
      toast.error(errorMessage)
      setAssetIdInput("")
      setShowSuggestions(false)
      throw new Error(errorMessage)
    }

    // Check if asset is checked out
    if (assetToAdd.status !== "Checked out") {
      const errorMessage = `Asset "${assetToAdd.assetTagId}" is not checked out. Current status: ${assetToAdd.status || 'Unknown'}`
      toast.error(errorMessage)
      setAssetIdInput("")
      setShowSuggestions(false)
      throw new Error(errorMessage)
    }

    // Check if asset has an active checkout
    const activeCheckout = assetToAdd.checkouts?.[0]
    if (!activeCheckout) {
      const errorMessage = `No active checkout found for asset "${assetToAdd.assetTagId}"`
      toast.error(errorMessage)
      setAssetIdInput("")
      setShowSuggestions(false)
      throw new Error(errorMessage)
    }

    // Check if asset is already in the list
    if (selectedAssets.some(a => a.id === assetToAdd.id)) {
      const errorMessage = 'Asset is already in the check-in list'
      toast.error(errorMessage)
      setAssetIdInput("")
      setShowSuggestions(false)
      throw new Error(errorMessage)
    }

    const newAsset: CheckinAsset = {
      ...assetToAdd,
      checkoutId: activeCheckout.id,
      employeeName: activeCheckout.employeeUser?.name,
      employeeEmail: activeCheckout.employeeUser?.email,
      employeeDepartment: activeCheckout.employeeUser?.department || null,
      checkoutDate: activeCheckout.checkoutDate,
      expectedReturnDate: activeCheckout.expectedReturnDate,
    }
    setSelectedAssets((prev) => [...prev, newAsset])
    
    // Add to form assetUpdates
    const currentUpdates = form.getValues('assetUpdates') || []
    form.setValue('assetUpdates', [
      ...currentUpdates,
      {
        assetId: newAsset.id,
        condition: '', // Required field - validation will catch if empty
        notes: '',
        returnLocation: '',
      }
    ], { shouldValidate: false }) // Don't validate immediately, wait for user input
    
    setAssetIdInput("")
    setShowSuggestions(false)
    setSelectedSuggestionIndex(-1)
    toast.success('Asset added to check-in list')
  }

  // Handle suggestion selection
  const handleSelectSuggestion = (asset: AssetFromHook) => {
    // Convert AssetFromHook to local Asset type - use type assertion since types are compatible
    handleAddAsset(asset as unknown as Asset)
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
    // Remove from form assetUpdates
    const currentUpdates = form.getValues('assetUpdates') || []
    form.setValue('assetUpdates', currentUpdates.filter(update => update.assetId !== assetId))
    toast.success('Asset removed from check-in list')
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
            
            // Check if asset is already available (already checked in)
            if (asset.status === "Available" || !asset.status || asset.status.toLowerCase() === "available") {
              toast.error(`Asset "${asset.assetTagId}" is already available. Cannot check in an asset that is already checked in.`)
              clearUrlParams()
              return
            }

            // Check if asset is checked out
            if (asset.status !== "Checked out") {
              toast.error(`Asset "${asset.assetTagId}" is not checked out. Current status: ${asset.status || 'Unknown'}`)
              clearUrlParams()
              return
            }

            // Check if asset has an active checkout
            const activeCheckout = asset.checkouts?.[0]
            if (!activeCheckout) {
              toast.error(`No active checkout found for asset "${asset.assetTagId}"`)
              clearUrlParams()
              return
            }

            // Check if asset is already in the list
            if (selectedAssets.some(a => a.id === asset.id)) {
              return
            }

            const checkinAsset: CheckinAsset = {
              ...asset,
              condition: "",
              returnLocation: "",
              notes: "",
            }

            setSelectedAssets([checkinAsset])
            setAssetIdInput(asset.assetTagId)
            
            // Update form assetUpdates
            const currentUpdates = form.getValues('assetUpdates') || []
            form.setValue('assetUpdates', [
              ...currentUpdates,
              {
                assetId: asset.id,
                condition: "",
                returnLocation: "",
                notes: "",
              },
            ])
          }
        } catch (error) {
          console.error('Error fetching asset from URL:', error)
        }
      }
      
      addAssetFromUrl()
    }
  }, [searchParams, selectedAssets, form, clearUrlParams])

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
      checkinDate: new Date().toISOString().split('T')[0],
      assetUpdates: [],
    })
    // Only reset the flag if URL params are already cleared (allows new URL params to be processed)
    if (!searchParams.get('assetId')) {
    hasProcessedUrlParams.current = false
    }
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
      setSelectedAssets((prev) => prev.filter((a) => a.id !== assetToRemove.id))
      // Remove from form assetUpdates
      const currentUpdates = form.getValues('assetUpdates') || []
      form.setValue('assetUpdates', currentUpdates.filter(update => update.assetId !== assetToRemove.id))
      toast.success(`Asset "${assetTagId}" removed from check-in list`)
    }
  }

  // Update asset condition or notes in checkin list
  const handleUpdateAssetInfo = (assetId: string, field: string, value: string) => {
    setSelectedAssets((prev) =>
      prev.map((asset) =>
        asset.id === assetId ? { ...asset, [field]: value } : asset
      )
    )
    // Also update form values
    const currentUpdates = form.getValues('assetUpdates') || []
    const assetUpdateIndex = currentUpdates.findIndex(update => update.assetId === assetId)
    if (assetUpdateIndex >= 0) {
      const newUpdates = [...currentUpdates]
      const existingUpdate = newUpdates[assetUpdateIndex]
      newUpdates[assetUpdateIndex] = { 
        ...existingUpdate, 
        [field]: value,
        // Ensure condition is always present (required field)
        condition: field === 'condition' ? value : (existingUpdate.condition || '')
      }
      form.setValue('assetUpdates', newUpdates)
    } else {
      // Create new update entry with all required fields
      form.setValue('assetUpdates', [...currentUpdates, { 
        assetId, 
        condition: field === 'condition' ? value : '', // Required field
        notes: field === 'notes' ? value : '',
        returnLocation: field === 'returnLocation' ? value : '',
      }])
    }
  }

  // Checkin mutation
  const checkinMutation = useMutation({
    mutationFn: async (data: {
      assetIds: string[]
      checkinDate: string
      updates: Record<string, { condition?: string; notes?: string; returnLocation?: string }>
    }) => {
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/assets/checkin`
      
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
        const error = await response.json().catch(() => ({ error: 'Failed to check in assets' }))
        throw new Error(error.error || error.detail || 'Failed to check in assets')
      }

      return response.json()
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["assets"] })
      queryClient.invalidateQueries({ queryKey: ["checkin-stats"] })
      
      // Invalidate checkout history and history logs for each checked-in asset
      if (data?.checkins && Array.isArray(data.checkins)) {
        data.checkins.forEach((checkin: { assetId: string }) => {
          queryClient.invalidateQueries({ queryKey: ["checkoutHistory", checkin.assetId] })
          queryClient.invalidateQueries({ queryKey: ["historyLogs", checkin.assetId] })
        })
      }
      
      // Mark URL params as processed BEFORE clearing form to prevent re-processing
      hasProcessedUrlParams.current = true
      
      // Refetch in background without removing existing data
      refetchCheckinStats()
      toast.success('Assets checked in successfully')
      clearUrlParams()
      clearForm()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to check in assets')
    },
  })

  // Handle form submission
  const handleSubmit = form.handleSubmit(async (data) => {
    if (selectedAssets.length === 0) {
      toast.error('Please add at least one asset to check in')
      return
    }

    const updates: Record<string, { condition?: string; notes?: string; returnLocation?: string }> = {}
    data.assetUpdates.forEach((update) => {
      updates[update.assetId] = {
        ...(update.condition ? { condition: update.condition } : {}),
        ...(update.notes ? { notes: update.notes } : {}),
        ...(update.returnLocation ? { returnLocation: update.returnLocation } : {}),
      }
    })

    checkinMutation.mutate({
      assetIds: selectedAssets.map((a) => a.id),
      checkinDate: data.checkinDate,
      updates,
    })
  })

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

  // Fetch summary statistics (includes checked out assets value)
  const { data: summaryData, isLoading: isLoadingAssets } = useQuery<{
    summary: {
      totalAssets: number
      availableAssets: number
      checkedOutAssets: number
      checkedOutAssetsValue?: number
    }
  }>({
    queryKey: ["assets", "checkin-stats-summary"],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/assets?summary=true`
      
      const token = await getAuthToken()
      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(url, {
        headers,
        credentials: 'include',
      })
      if (!response.ok) {
        throw new Error('Failed to fetch asset summary')
      }
      return response.json()
    },
    enabled: canViewAssets,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  // Calculate summary statistics
  const totalCheckedOutAssets = summaryData?.summary?.checkedOutAssets || 0
  const selectedAssetsCount = selectedAssets.length
  const totalValueOfCheckoutAssets = summaryData?.summary?.checkedOutAssetsValue || 0

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PHP',
    }).format(value)
  }

  // Fetch check-in statistics
  const { data: checkinStats, isLoading: isLoadingCheckinStats, error: checkinStatsError, refetch: refetchCheckinStats } = useQuery<{
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
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/assets/checkin/stats`
      
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
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || errorData.detail || 'Failed to fetch check-in statistics')
      }
      const data = await response.json()
      return data
    },
    enabled: canViewAssets,
    retry: 2,
    retryDelay: 1000,
    staleTime: 0, // Always consider data stale to allow immediate refetch
    placeholderData: (previousData) => previousData, // Keep showing previous data during refetch
    refetchOnMount: 'always', // Always refetch when component mounts
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

  // Track initial mount for animations
  useEffect(() => {
    if (isInitialMount.current && recentCheckins.length > 0) {
      const timer = setTimeout(() => {
        isInitialMount.current = false
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [recentCheckins.length])

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={isFormDirty ? "pb-16" : ""}
    >
      <div>
        <h1 className="text-3xl font-bold">Check In Asset</h1>
        <p className="text-muted-foreground">
          Return checked out assets back to inventory
        </p>
      </div>

      {/* Summary Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 mt-6"
      >
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="col-span-1 md:col-span-2 lg:col-span-3"
        >
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
            {permissionsLoading || (isLoadingCheckinStats && !checkinStats) ? (
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
              <ScrollArea className="h-52" key={`checkin-history-${recentCheckins.length}-${recentCheckins[0]?.id}`}>
                <div className="relative w-full">
                  <Table className="w-full caption-bottom text-sm">
                    <TableHeader className="sticky top-0 z-0 bg-card">
                    <TableRow>
                        <TableHead className="h-8 text-xs bg-card">Asset ID</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Description</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Employee</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Condition</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Check-in Date</TableHead>
                        <TableHead className="h-8 text-xs text-right bg-card">Time Ago</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence mode='popLayout' initial={false}>
                      {recentCheckins.map((checkin, index) => (
                        <motion.tr
                          key={checkin.id}
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
                        <TableCell className="py-1.5 text-xs text-muted-foreground">
                          {formatDate(checkin.checkinDate)}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground text-right">
                          {getTimeAgo(checkin.createdAt)}
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
                No recent check-ins
              </p>
            )}
          </CardContent>
        </Card>
        </motion.div>
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-6 mt-6">
        {/* Asset Selection Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
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
                          {getStatusBadge(asset.status || 'Checked out')}
                        </div>
                      </motion.div>
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

            <AnimatePresence>
            {(selectedAssets.length > 0 || loadingAssets.size > 0) && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Selected Assets ({selectedAssets.length + loadingAssets.size})
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {/* Loading placeholders */}
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
                  {/* Actual selected assets */}
                    {selectedAssets.map((asset, index) => (
                      <motion.div
                      key={asset.id}
                        initial={{ opacity: 0, x: -20, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 20, scale: 0.95 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
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
                      </motion.div>
                  ))}
                </div>
              </div>
            )}
            </AnimatePresence>
          </CardContent>
        </Card>
        </motion.div>

        {/* Asset Condition and Notes */}
        <AnimatePresence>
        {selectedAssets.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, delay: 0.35 }}
            >
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
                          Asset Condition <span className="text-destructive">*</span>
                        </FieldLabel>
                        <FieldContent>
                          <Controller
                            name={`assetUpdates.${selectedAssets.findIndex(a => a.id === asset.id)}.condition` as const}
                            control={form.control}
                            render={({ field, fieldState }) => (
                              <>
                                <Select
                                  value={asset.condition || field.value || ""}
                                  onValueChange={(value) => {
                                    handleUpdateAssetInfo(asset.id, "condition", value)
                                    field.onChange(value)
                                    // Trigger validation after change
                                    form.trigger(`assetUpdates.${selectedAssets.findIndex(a => a.id === asset.id)}.condition`)
                                  }}
                                  disabled={!canViewAssets || !canCheckin}
                                  required
                                >
                                  <SelectTrigger className="w-full" aria-invalid={fieldState.error ? 'true' : 'false'}>
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
                                {fieldState.error && (
                                  <FieldError>{fieldState.error.message}</FieldError>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">
                                  Assess the condition of the returned asset
                                </p>
                              </>
                            )}
                          />
                        </FieldContent>
                      </Field>

                      <Controller
                        name={`assetUpdates.${selectedAssets.findIndex(a => a.id === asset.id)}.returnLocation` as const}
                        control={form.control}
                        render={({ field, fieldState }) => (
                          <LocationSelectField
                            value={asset.returnLocation || field.value || ""}
                            onValueChange={(value) => {
                              handleUpdateAssetInfo(asset.id, "returnLocation", value)
                              field.onChange(value)
                            }}
                            error={fieldState.error}
                            label={
                              <>
                                Return Location
                                {asset.location && (
                                  <span className="text-xs text-muted-foreground font-normal ml-2">
                                    (Current: {asset.location})
                                  </span>
                                )}
                              </>
                            }
                            placeholder={asset.location || "Select or search return location"}
                            disabled={!canViewAssets || !canCheckin}
                            canCreate={canManageSetup}
                          />
                        )}
                      />

                      <Field>
                        <FieldLabel htmlFor={`notes-${asset.id}`}>
                          Notes <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
                        </FieldLabel>
                        <FieldContent>
                          <Controller
                            name={`assetUpdates.${selectedAssets.findIndex(a => a.id === asset.id)}.notes` as const}
                            control={form.control}
                            render={({ field, fieldState }) => (
                              <>
                                <Textarea
                                  id={`notes-${asset.id}`}
                                  placeholder="Any observations about the asset condition, issues found, or special notes"
                                  value={asset.notes || field.value || ""}
                                  onChange={(e) => {
                                    handleUpdateAssetInfo(asset.id, "notes", e.target.value)
                                    field.onChange(e.target.value)
                                  }}
                                  rows={3}
                                  disabled={!canViewAssets || !canCheckin}
                                  aria-invalid={fieldState.error ? 'true' : 'false'}
                                />
                                {fieldState.error && (
                                  <FieldError>{fieldState.error.message}</FieldError>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">
                                  Any additional information about the returned asset
                                </p>
                              </>
                            )}
                          />
                        </FieldContent>
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
            </motion.div>
        )}
        </AnimatePresence>

        {/* Check-in Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
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
                <Controller
                  name="checkinDate"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <>
                      <Input
                        id="checkinDate"
                        type="date"
                        {...field}
                        disabled={!canViewAssets || !canCheckin || selectedAssets.length === 0}
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
          </CardContent>
        </Card>
        </motion.div>
      </form>

      {/* Floating Action Buttons - Only show when form has changes */}
      <AnimatePresence>
      {isFormDirty && canViewAssets && canCheckin && (
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
          </motion.div>
      )}
      </AnimatePresence>

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
    </motion.div>
  )
}

export default function CheckinPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Check In Asset</h1>
          <p className="text-muted-foreground">
            Return an asset to inventory
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
      <CheckinPageContent />
    </Suspense>
  )
}
