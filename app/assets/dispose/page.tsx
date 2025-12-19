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
import { cn } from "@/lib/utils"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { disposeSchema, type DisposeFormData } from "@/lib/validations/assets"
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

function DisposeAssetPageContent() {
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const { state: sidebarState, open: sidebarOpen } = useSidebar()
  const isMobile = useIsMobile()
  const hasProcessedUrlParams = useRef(false)
  const canViewAssets = hasPermission('canViewAssets')
  const canDispose = hasPermission('canDispose')
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionRef = useRef<HTMLDivElement>(null)
  const [assetIdInput, setAssetIdInput] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const [selectedAssets, setSelectedAssets] = useState<DisposeAsset[]>([])
  const [loadingAssets, setLoadingAssets] = useState<Set<string>>(new Set())
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [qrDisplayDialogOpen, setQrDisplayDialogOpen] = useState(false)
  const [selectedAssetTagForQR, setSelectedAssetTagForQR] = useState<string>("")
  const isInitialMount = useRef(true)

  const form = useForm<DisposeFormData>({
    // @ts-expect-error - Zod resolver type mismatch with optional field that has default
    resolver: zodResolver(disposeSchema),
    defaultValues: {
      assetIds: [],
      disposeDate: new Date().toISOString().split('T')[0],
      disposalMethod: '',
      disposeReason: '',
      assetUpdates: [],
    },
  })

  // Watch disposalMethod to handle conditional fields
  const disposalMethod = useWatch({
    control: form.control,
    name: 'disposalMethod',
  })

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
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/assets/dispose/stats`
      
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
        throw new Error('Failed to fetch dispose statistics')
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

  // List of disposal statuses that should be excluded from suggestions
  const disposalStatuses = useMemo(() => ['Disposed', 'Sold', 'Donated', 'Scrapped', 'Lost/Missing', 'Destroyed'], [])

  // Fetch asset suggestions using reusable hook (include all statuses, exclude disposed)
  const { suggestions: allSuggestions, isLoading: isLoadingSuggestions } = useAssetSuggestions(
    assetIdInput,
    "", // No status filter - include all statuses
    selectedAssets.map(a => a.id),
    canViewAssets && canDispose,
    showSuggestions,
    10 // max results when searching, 20 when empty
  )

  // Filter to exclude already disposed assets (any disposal status)
  const assetSuggestions = useMemo(() => {
    return allSuggestions.filter(a => {
      const notDisposed = !a.status || !disposalStatuses.includes(a.status)
      return notDisposed
    })
  }, [allSuggestions, disposalStatuses])

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

  // Find asset by ID without disposal check (for error messages) using FastAPI
  const findAssetById = async (assetTagId: string): Promise<Asset | null> => {
    try {
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/assets?search=${encodeURIComponent(assetTagId)}&pageSize=10`
      
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
  const handleSelectSuggestion = (asset: AssetFromHook) => {
    // Convert AssetFromHook to local Asset type
    const assetAsLocal = asset as unknown as Asset
    const disposeAsset: DisposeAsset = {
      ...assetAsLocal,
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

  // Clear URL parameters helper
  const clearUrlParams = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('assetId')
    params.delete('method')
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname
    router.replace(newUrl)
    // Don't reset hasProcessedUrlParams here - let it be controlled by the caller
  }, [searchParams, router])

  // Handle URL query parameters for assetId and method
  useEffect(() => {
    // Skip if we've already processed URL params (prevents re-population after save)
    if (hasProcessedUrlParams.current) {
      return
    }

    const urlAssetId = searchParams.get('assetId')
    const urlMethod = searchParams.get('method')

    if (urlAssetId && selectedAssets.length === 0) {
      // Mark as processed to prevent re-population
      hasProcessedUrlParams.current = true
      
      // Fetch and add the asset from URL
      const addAssetFromUrl = async () => {
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
            
            // Check if asset is already disposed
            const disposalStatuses = ['Disposed', 'Sold', 'Donated', 'Scrapped', 'Lost/Missing', 'Destroyed']
            if (asset.status && disposalStatuses.includes(asset.status)) {
              toast.error(`Asset "${asset.assetTagId}" is already disposed. Current status: ${asset.status}`)
              clearUrlParams()
              return
            }

            // Check if asset is already in the list
            if (selectedAssets.some(a => a.id === asset.id)) {
              return
            }

            const disposeAsset: DisposeAsset = {
              ...asset,
              disposeValue: "",
              notes: "",
            }

            setSelectedAssets([disposeAsset])
            setAssetIdInput(asset.assetTagId)
            
            // Set disposal method from URL parameter after asset is loaded
            if (urlMethod) {
              // Map URL method to form method values
              const methodMap: Record<string, string> = {
                'Sold': 'Sold',
                'Donated': 'Donated',
                'Scrapped': 'Scrapped',
                'Lost/Missing': 'Lost/Missing',
                'Destroyed': 'Destroyed',
              }
              
              const mappedMethod = methodMap[urlMethod] || urlMethod
              
              // Set the method immediately after setting assets
              form.setValue('disposalMethod', mappedMethod)
              form.setValue('disposeReason', mappedMethod)
            }
          }
        } catch (error) {
          console.error('Error fetching asset from URL:', error)
        }
      }
      
      addAssetFromUrl()
    } else if (urlMethod && !form.getValues('disposalMethod')) {
      // Set disposal method from URL parameter even if no assetId
      // Map URL method to form method values
      const methodMap: Record<string, string> = {
        'Sold': 'Sold',
        'Donated': 'Donated',
        'Scrapped': 'Scrapped',
        'Lost/Missing': 'Lost/Missing',
        'Destroyed': 'Destroyed',
      }
      
      const mappedMethod = methodMap[urlMethod] || urlMethod
      const currentMethod = form.getValues('disposalMethod')
      
      // Only set if different from current value
      if (currentMethod !== mappedMethod) {
        form.setValue('disposalMethod', mappedMethod)
        form.setValue('disposeReason', mappedMethod)
      }
    }
  }, [searchParams, selectedAssets, form, clearUrlParams])

  // Watch disposeReason for form dirty check
  const disposeReason = useWatch({
    control: form.control,
    name: 'disposeReason',
  })

  // Track form changes to show floating buttons
  const isFormDirty = useMemo(() => {
    return !!(
      selectedAssets.length > 0 ||
      disposalMethod ||
      (disposeReason && disposeReason.trim())
    )
  }, [selectedAssets, disposalMethod, disposeReason])

  // Clear form function
  const clearForm = () => {
    setSelectedAssets([])
    setAssetIdInput("")
    form.reset({
      assetIds: [],
      disposeDate: new Date().toISOString().split('T')[0],
      disposalMethod: '',
      disposeReason: '',
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
    } finally {
      // Remove from loading state
      setLoadingAssets(prev => {
        const newSet = new Set(prev)
        newSet.delete(decodedText)
        return newSet
      })
    }
  }

  // Update asset field
  const handleUpdateAsset = (assetId: string, field: keyof DisposeAsset, value: string) => {
    setSelectedAssets(prev => prev.map(a => (a.id === assetId ? { ...a, [field]: value } : a)))
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
      toast.success(`Asset "${assetTagId}" removed from disposal list`)
    }
  }

  // Sync selectedAssets with form state using useEffect to avoid render issues
  useEffect(() => {
    form.setValue('assetIds', selectedAssets.map(a => a.id))
    form.setValue('assetUpdates', selectedAssets.map(a => ({
      assetId: a.id,
      disposeValue: a.disposeValue || '',
      notes: a.notes || '',
    })), { shouldValidate: false })
  }, [selectedAssets, form])

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
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/assets/dispose`
      
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
        const error = await response.json()
        throw new Error(error.error || error.detail || 'Failed to dispose assets')
      }

      return response.json()
    },
    onSuccess: () => {
      // Mark URL params as processed BEFORE clearing form to prevent re-processing
      hasProcessedUrlParams.current = true
      queryClient.invalidateQueries({ queryKey: ["assets"] })
      queryClient.invalidateQueries({ queryKey: ["dispose-stats"] })
      toast.success('Assets disposed successfully')
      // Reset form
      clearUrlParams()
      clearForm()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to dispose assets')
    },
  })

  // Handle form submission
  const handleSubmit = form.handleSubmit(async (data) => {
    if (selectedAssets.length === 0) {
      toast.error('Please select at least one asset to dispose')
      return
    }

    // Build updates object from form data
    const updates: Record<string, { disposeValue?: string; notes?: string }> = {}
    data.assetUpdates.forEach((update: { assetId: string; disposeValue?: string; notes?: string }) => {
      updates[update.assetId] = {
        disposeValue: update.disposeValue || undefined,
        notes: update.notes || undefined,
      }
    })

    // Use the common dispose value for all assets, but allow individual dispose values and notes
    const commonDisposeValue = data.disposalMethod === 'Sold' && selectedAssets.length === 1 
      ? data.assetUpdates[0]?.disposeValue 
      : undefined

    disposeMutation.mutate({
      assetIds: data.assetIds,
      disposeDate: data.disposeDate,
      disposeReason: data.disposalMethod, // API still expects disposeReason for the method
      disposeValue: commonDisposeValue,
      disposeReasonText: data.disposeReason || undefined, // Additional text reason
      updates,
    })
  })

  // Track initial mount for animations
  useEffect(() => {
    if (isInitialMount.current && disposeStats?.recentDisposals && disposeStats.recentDisposals.length > 0) {
      const timer = setTimeout(() => {
        isInitialMount.current = false
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [disposeStats?.recentDisposals])

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={isFormDirty ? "pb-16" : ""}
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dispose Asset</h1>
        <p className="text-muted-foreground">
          Mark assets as disposed (sold, donated, scrapped, lost/missing, etc.)
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
                    <TableHeader className="sticky top-0 z-0 bg-card">
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
                    <AnimatePresence mode='popLayout'>
                      {disposeStats.recentDisposals.map((disposal, index) => (
                        <motion.tr
                          key={disposal.id}
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
                          {formatDate(disposal.disposeDate)}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground text-right">
                          {getTimeAgo(disposal.createdAt)}
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
            )}
          </CardContent>
        </Card>
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-6 mt-6">
        {/* Disposal Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
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
                  className="absolute z-50 w-full mt-2 bg-clip-padding backdrop-filter backdrop-blur-md bg-opacity-10 border shadow-2xl rounded-md max-h-[300px] overflow-auto"
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
                    assetSuggestions.map((asset: AssetFromHook, index: number) => (
                      <motion.div
                        key={asset.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.05 }}
                        className={cn(
                          "px-4 py-3 cursor-pointer hover:bg-gray-400/20 hover:bg-clip-padding hover:backdrop-filter hover:backdrop-blur-sm",
                          index === selectedSuggestionIndex && "bg-gray-400/20 bg-clip-padding backdrop-filter backdrop-blur-sm"
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
                      </motion.div>
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
                      className="flex items-start justify-between gap-2 p-3 border rounded-md bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
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
                      </motion.div>
                  ))}
                </div>
              </div>
            )}
            </AnimatePresence>
          </CardContent>
        </Card>
        </motion.div>

        {/* Disposal Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
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
                <FieldLabel htmlFor="disposeDate">
                  Dispose Date <span className="text-destructive">*</span>
                </FieldLabel>
                <FieldContent>
                  <Controller
                    name="disposeDate"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <>
                        <Input
                          id="disposeDate"
                          type="date"
                          {...field}
                          disabled={!canViewAssets || !canDispose || selectedAssets.length === 0}
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
                <FieldLabel htmlFor="disposalMethod">
                  Disposal Method <span className="text-destructive">*</span>
                </FieldLabel>
                <FieldContent>
                  <Controller
                    name="disposalMethod"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <>
                        <Select
                          value={field.value || ""}
                          onValueChange={(value) => {
                            field.onChange(value)
                            // Clear dispose values if switching away from "Sold"
                            if (value !== 'Sold') {
                              selectedAssets.forEach((asset, index) => {
                                handleUpdateAsset(asset.id, 'disposeValue', '')
                                form.setValue(`assetUpdates.${index}.disposeValue` as const, '')
                              })
                            }
                            // Trigger validation for assetUpdates when method changes
                            if (value === 'Sold') {
                              form.trigger('assetUpdates')
                            }
                          }}
                          disabled={!canViewAssets || !canDispose || selectedAssets.length === 0}
                        >
                          <SelectTrigger className="w-full" aria-invalid={fieldState.error ? 'true' : 'false'}>
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
                        {fieldState.error && (
                          <FieldError>{fieldState.error.message}</FieldError>
                        )}
                      </>
                    )}
                  />
                </FieldContent>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="disposeReason">
                Dispose Reason
              </FieldLabel>
              <FieldContent>
                <Controller
                  name="disposeReason"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <>
                      <Textarea
                        id="disposeReason"
                        placeholder="Enter the reason for disposal (optional)"
                        {...field}
                        rows={3}
                        disabled={!canViewAssets || !canDispose || selectedAssets.length === 0}
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
                        <div className={`grid gap-4 ${disposalMethod === 'Sold' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                          {disposalMethod === 'Sold' && (
                            <Field>
                              <FieldLabel htmlFor={`disposeValue-${asset.id}`}>
                                Dispose Value <span className="text-destructive">*</span>
                              </FieldLabel>
                              <FieldContent>
                                <Controller
                                  name={`assetUpdates.${selectedAssets.findIndex(a => a.id === asset.id)}.disposeValue` as const}
                                  control={form.control}
                                  render={({ field, fieldState }) => (
                                    <>
                                      <Input
                                        id={`disposeValue-${asset.id}`}
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="0.00"
                                        value={asset.disposeValue || field.value || ""}
                                        onChange={(e) => {
                                          handleUpdateAsset(asset.id, 'disposeValue', e.target.value)
                                          field.onChange(e.target.value)
                                          // Trigger validation after change
                                          form.trigger(`assetUpdates.${selectedAssets.findIndex(a => a.id === asset.id)}.disposeValue`)
                                          form.trigger('assetUpdates')
                                        }}
                                        disabled={!canViewAssets || !canDispose || selectedAssets.length === 0}
                                        aria-required="true"
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
                          )}
                          <Field>
                            <FieldLabel htmlFor={`notes-${asset.id}`}>
                              Notes
                            </FieldLabel>
                            <FieldContent>
                              <Textarea
                                id={`notes-${asset.id}`}
                                placeholder="Additional notes..."
                                value={asset.notes || ""}
                                onChange={(e) => handleUpdateAsset(asset.id, 'notes', e.target.value)}
                                rows={2}
                                disabled={!canViewAssets || !canDispose || selectedAssets.length === 0}
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
        </motion.div>

      </form>

      {/* Floating Action Buttons - Only show when form has changes */}
      <AnimatePresence>
      {isFormDirty && canViewAssets && canDispose && (
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

export default function DisposeAssetPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dispose Asset</h1>
          <p className="text-muted-foreground">
            Dispose of an asset from inventory
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
      <DisposeAssetPageContent />
    </Suspense>
  )
}
