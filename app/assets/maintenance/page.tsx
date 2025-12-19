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
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { maintenanceSchema, type MaintenanceFormData } from "@/lib/validations/assets"
import { InventoryItemsSelector } from "@/components/maintenance/inventory-items-selector"
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
  category?: {
    id: string
    name: string
  } | null
  subCategory?: {
    id: string
    name: string
  } | null
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

// Helper function to get badge color classes for maintenance status
const getMaintenanceStatusBadgeClass = (status: string): string => {
  const statusLC = status.toLowerCase().replace(' ', '')
  switch (statusLC) {
    case "scheduled":
      return "bg-yellow-500 text-white"
    case "inprogress":
      return "bg-blue-500 text-white"
    case "completed":
      return "bg-green-500 text-white"
    case "cancelled":
      return "bg-red-500 text-white"
    default:
      return "bg-gray-500 text-white"
  }
}

function MaintenancePageContent() {
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const { state: sidebarState, open: sidebarOpen } = useSidebar()
  const isMobile = useIsMobile()
  
  const canViewAssets = hasPermission('canViewAssets')
  const canManageMaintenance = hasPermission('canManageMaintenance')
  
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
  const hasProcessedUrlParams = useRef(false)
  const isInitialMount = useRef(true)

  // State for inventory items (not using form control for easier management)
  const [inventoryItems, setInventoryItems] = useState<Array<{
    inventoryItemId: string
    itemCode: string
    name: string
    quantity: number
    unitCost: number | null
    availableStock: number
    unit: string | null
    minStockLevel: number | null
  }>>([])

  const form = useForm<MaintenanceFormData>({
    resolver: zodResolver(maintenanceSchema),
    defaultValues: {
      assetId: '',
      title: '',
      details: '',
      dueDate: '',
      maintenanceBy: '',
      status: '',
      cost: '',
      dateCompleted: '',
      dateCancelled: '',
      isRepeating: false,
      inventoryItems: [],
    },
  })

  // Watch status to handle conditional fields
  const status = useWatch({
    control: form.control,
    name: 'status',
  })

  // Watch form fields for dirty check
  const title = useWatch({ control: form.control, name: 'title' })
  const details = useWatch({ control: form.control, name: 'details' })
  const dueDate = useWatch({ control: form.control, name: 'dueDate' })
  const maintenanceBy = useWatch({ control: form.control, name: 'maintenanceBy' })
  const cost = useWatch({ control: form.control, name: 'cost' })
  const dateCompleted = useWatch({ control: form.control, name: 'dateCompleted' })
  const dateCancelled = useWatch({ control: form.control, name: 'dateCancelled' })
  const isRepeating = useWatch({ control: form.control, name: 'isRepeating' })

  // Fetch maintenance statistics
  const { data: maintenanceStats, isLoading: isLoadingStats, error: statsError, refetch: refetchMaintenanceStats } = useQuery<{
    scheduledTodayCount: number
    inProgressCount: number
    recentMaintenances: Array<{
      id: string
      title: string
      details?: string | null
      dueDate?: string | null
      maintenanceBy?: string | null
      status: string
      dateCompleted?: string | null
      dateCancelled?: string | null
      cost?: number | null
      isRepeating: boolean
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
    queryKey: ["maintenance-stats"],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/assets/maintenance/stats`
      
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
        throw new Error('Failed to fetch maintenance statistics')
      }
      const data = await response.json()
      return data
    },
    retry: 2,
    retryDelay: 1000,
    staleTime: 0, // Always consider data stale so it refetches when invalidated
    refetchOnWindowFocus: true, // Refetch when window regains focus
  })

  // Calculate time ago
  const getTimeAgo = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60)
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`
    }
    if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600)
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
    }
    const diffInDays = Math.floor(diffInSeconds / 86400)
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

  // Fetch asset suggestions using reusable hook (include all statuses)
  const { suggestions: assetSuggestions, isLoading: isLoadingSuggestions } = useAssetSuggestions(
    assetIdInput,
    "", // No status filter - include all statuses
    selectedAsset ? [selectedAsset.id] : [],
    canViewAssets,
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

  // Find asset by ID without eligibility check (for error messages) using FastAPI
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

  // Asset lookup by ID - only Available and Checked out assets
  const lookupAsset = async (assetTagId: string): Promise<Asset | null> => {
    const asset = await findAssetById(assetTagId)
    
    if (!asset) {
      return null
    }
    
    // Check if asset is eligible for maintenance (Available or Checked out)
    const status = (asset.status || '').toLowerCase()
    const isEligible = status === 'available' || status === 'checked out'
    
    if (!isEligible) {
      return null
    }
    
    return asset
  }

  // Handle suggestion selection
  const handleSelectSuggestion = (asset: AssetFromHook) => {
    // Convert AssetFromHook to local Asset type
    const assetAsLocal = asset as unknown as Asset
    setSelectedAsset(assetAsLocal)
    form.setValue('assetId', assetAsLocal.id)
    setAssetIdInput(assetAsLocal.assetTagId)
    setShowSuggestions(false)
    setSelectedSuggestionIndex(-1)
    inputRef.current?.blur()
    toast.success('Asset selected')
  }

  // Handle asset selection by pressing Enter
  const handleSelectAsset = async (asset?: Asset) => {
    const assetToSelect = asset || await lookupAsset(assetIdInput.trim())

    if (assetToSelect) {
      setSelectedAsset(assetToSelect)
      form.setValue('assetId', assetToSelect.id)
      setShowSuggestions(false)
      toast.success('Asset selected')
    } else {
      if (!asset) {
        // Check if asset exists but is not eligible
        const assetExists = await findAssetById(assetIdInput.trim())
        if (assetExists) {
          const status = (assetExists.status || '').toLowerCase()
          const isEligible = status === 'available' || status === 'checked out'
          if (!isEligible) {
            toast.error(`Asset "${assetExists.assetTagId}" is not available for maintenance. Current status: ${assetExists.status}`)
          } else {
            toast.error(`Asset "${assetExists.assetTagId}" could not be selected`)
          }
        } else {
          toast.error(`Asset with ID "${assetIdInput.trim()}" not found`)
        }
      }
    }
  }

  // Clear URL parameters helper
  const clearUrlParams = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('assetId')
    params.delete('status')
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname
    router.replace(newUrl)
    // Don't reset hasProcessedUrlParams here - let it be controlled by the caller
  }, [searchParams, router])

  // Handle URL query parameters for assetId and status
  useEffect(() => {
    // Skip if we've already processed URL params (prevents re-population after save)
    if (hasProcessedUrlParams.current) {
      return
    }

    const urlAssetId = searchParams.get('assetId')
    const urlStatus = searchParams.get('status')

    if (urlAssetId && !selectedAsset) {
      // Mark as processed to prevent re-population
      hasProcessedUrlParams.current = true
      
      // Fetch and select the asset from URL
      const selectAssetFromUrl = async () => {
        try {
          const response = await fetch(`/api/assets/${urlAssetId}`)
          if (response.ok) {
            const data = await response.json()
            const asset = data.asset as Asset
            
            // Check if asset is eligible for maintenance
            const assetStatus = (asset.status || '').toLowerCase()
            const isEligible = assetStatus === 'available' || assetStatus === 'checked out'
            
            if (isEligible) {
              setSelectedAsset(asset)
              form.setValue('assetId', asset.id)
              setAssetIdInput(asset.assetTagId)
              
              // Set status from URL parameter if provided
              if (urlStatus) {
                const statusMap: Record<string, string> = {
                  'Scheduled': 'Scheduled',
                  'In Progress': 'In progress',
                  'In progress': 'In progress',
                  'Completed': 'Completed',
                  'Cancelled': 'Cancelled',
                }
                const mappedStatus = statusMap[urlStatus] || urlStatus
                form.setValue('status', mappedStatus)
              }
            } else {
              toast.error(`Asset "${asset.assetTagId}" is not available for maintenance. Current status: ${asset.status}`)
              // Clear URL params if asset is not eligible
              clearUrlParams()
            }
          }
        } catch (error) {
          console.error('Error fetching asset from URL:', error)
        }
      }
      
      selectAssetFromUrl()
    } else if (urlAssetId) {
      // If we already have a selected asset, mark as processed
      hasProcessedUrlParams.current = true
    } else if (urlStatus && !selectedAsset) {
      // Only process status if no assetId and we haven't processed yet
      hasProcessedUrlParams.current = true
      const statusMap: Record<string, string> = {
        'Scheduled': 'Scheduled',
        'In Progress': 'In progress',
        'In progress': 'In progress',
        'Completed': 'Completed',
        'Cancelled': 'Cancelled',
      }
      const mappedStatus = statusMap[urlStatus] || urlStatus
      const currentStatus = form.getValues('status')
      if (currentStatus !== mappedStatus) {
        form.setValue('status', mappedStatus)
      }
    }
  }, [searchParams, selectedAsset, form, clearUrlParams])

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setAssetIdInput(value)
    if (value && !selectedAsset) {
      setShowSuggestions(true)
    }
  }

  // Handle input focus
  const handleInputFocus = () => {
    setShowSuggestions(true)
  }

  // Remove selected asset
  const handleRemoveAsset = () => {
    setSelectedAsset(null)
    form.setValue('assetId', '')
    setAssetIdInput("")
    toast.success('Asset removed')
  }

  // Handle keyboard navigation
  const handleSuggestionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedSuggestionIndex(prev => 
        prev < assetSuggestions.length - 1 ? prev + 1 : prev
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedSuggestionIndex >= 0 && assetSuggestions[selectedSuggestionIndex]) {
        handleSelectSuggestion(assetSuggestions[selectedSuggestionIndex])
      } else if (assetIdInput.trim()) {
        handleSelectAsset()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setShowSuggestions(false)
      setSelectedSuggestionIndex(-1)
    }
  }

  // Format currency in PHP with commas
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  // Maintenance mutation
  const maintenanceMutation = useMutation({
    mutationFn: async (data: {
      assetId: string
      title: string
      details?: string
      dueDate?: string
      maintenanceBy?: string
      status: string
      dateCompleted?: string
      dateCancelled?: string
      cost?: string
      isRepeating: boolean
      inventoryItems?: Array<{
        inventoryItemId: string
        quantity: number
        unitCost?: number
      }>
    }) => {
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/assets/maintenance`
      
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
        throw new Error(error.error || error.detail || 'Failed to create maintenance')
      }

      return response.json()
    },
    onSuccess: async () => {
      // Mark URL params as processed BEFORE clearing form to prevent re-processing
      hasProcessedUrlParams.current = true
      queryClient.invalidateQueries({ queryKey: ["assets"] })
      queryClient.invalidateQueries({ queryKey: ["maintenance-stats"] })
      // Explicitly refetch the maintenance stats to update the recent history table
      await refetchMaintenanceStats()
      toast.success('Maintenance record created successfully')
      // Reset form and clear URL params
      clearUrlParams()
      clearForm()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create maintenance')
    }
  })

  // Handle form submission
  const handleSubmit = form.handleSubmit(async (data) => {
    if (!selectedAsset) {
      toast.error('Please select an asset')
      return
    }

    maintenanceMutation.mutate({
      assetId: data.assetId,
      title: data.title.trim(),
      details: data.details?.trim() || undefined,
      dueDate: data.dueDate || undefined,
      maintenanceBy: data.maintenanceBy?.trim() || undefined,
      status: data.status,
      dateCompleted: data.dateCompleted || undefined,
      dateCancelled: data.dateCancelled || undefined,
      cost: data.cost || undefined,
      isRepeating: data.isRepeating,
      inventoryItems: inventoryItems.length > 0 ? inventoryItems.map(item => ({
        inventoryItemId: item.inventoryItemId,
        quantity: item.quantity,
        unitCost: item.unitCost ?? undefined,
      })) : undefined,
    })
  })

  // Track form changes to show floating buttons
  const isFormDirty = useMemo(() => {
    return !!(
      selectedAsset ||
      title?.trim() ||
      details?.trim() ||
      dueDate ||
      maintenanceBy?.trim() ||
      status ||
      dateCompleted ||
      dateCancelled ||
      cost ||
      isRepeating
    )
  }, [selectedAsset, title, details, dueDate, maintenanceBy, status, dateCompleted, dateCancelled, cost, isRepeating])

  // Clear form function
  const clearForm = () => {
    setSelectedAsset(null)
    setAssetIdInput("")
    setInventoryItems([])
    form.reset({
      assetId: '',
      title: '',
      details: '',
      dueDate: '',
      maintenanceBy: '',
      status: '',
      cost: '',
      dateCompleted: '',
      dateCancelled: '',
      isRepeating: false,
      inventoryItems: [],
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
      // First check if asset exists
      const assetExists = await findAssetById(decodedText)
      
      if (!assetExists) {
        toast.error(`Asset with ID "${decodedText}" not found`)
        return
      }
      
      // Check if asset is eligible for maintenance
      const status = (assetExists.status || '').toLowerCase()
      const isEligible = status === 'available' || status === 'checked out'
      
      if (!isEligible) {
        toast.error(`Asset "${assetExists.assetTagId}" is not available for maintenance. Current status: ${assetExists.status}`)
        return
      }
      
      // Asset exists and is eligible, proceed to select it
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

  // Track initial mount for animations
  useEffect(() => {
    if (isInitialMount.current && maintenanceStats?.recentMaintenances && maintenanceStats.recentMaintenances.length > 0) {
      const timer = setTimeout(() => {
        isInitialMount.current = false
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [maintenanceStats?.recentMaintenances])

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={isFormDirty ? "pb-16" : ""}
    >
      <div>
        <h1 className="text-3xl font-bold">Maintenance</h1>
        <p className="text-muted-foreground">
          Records scheduled or completed maintenance on assets. Helps track costs and service history.
        </p>
      </div>

      {/* Recent History */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mt-6"
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
            {permissionsLoading || isLoadingStats ? (
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
            ) : statsError ? (
              <p className="text-sm text-destructive text-center py-4">
                Failed to load history. Please try again.
              </p>
            ) : !maintenanceStats?.recentMaintenances || maintenanceStats.recentMaintenances.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No maintenance history
              </p>
            ) : (
              <ScrollArea className="h-52">
                <div className="relative w-full">
                  <Table className="w-full caption-bottom text-sm">
                    <TableHeader className="sticky top-0 z-0 bg-card">
                    <TableRow>
                        <TableHead className="h-8 text-xs bg-card">Asset ID</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Title</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Status</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Maintenance By</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Due Date</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Cost</TableHead>
                        <TableHead className="h-8 text-xs text-right bg-card">Time Ago</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence mode='popLayout'>
                      {maintenanceStats.recentMaintenances.map((maintenance, index) => (
                        <motion.tr
                          key={maintenance.id}
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
                              setSelectedAssetTagForQR(maintenance.asset.assetTagId)
                              setQrDisplayDialogOpen(true)
                            }}
                          >
                            {maintenance.asset.assetTagId}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground">
                          {maintenance.title}
                        </TableCell>
                        <TableCell className="py-1.5">
                          <Badge className={cn("text-xs text-white border-0", getMaintenanceStatusBadgeClass(maintenance.status))}>
                            {maintenance.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground">
                          {maintenance.maintenanceBy || '-'}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground">
                          {maintenance.dueDate ? new Date(maintenance.dueDate).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground">
                          {maintenance.cost ? `₱${formatCurrency(Number(maintenance.cost))}` : '-'}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground text-right">
                          {getTimeAgo(maintenance.createdAt)}
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
                    disabled={!canManageMaintenance || !canViewAssets}
                  />
                  {assetIdInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setAssetIdInput("")
                        setSelectedAsset(null)
                        setShowSuggestions(false)
                      }}
                      className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 hover:bg-transparent cursor-pointer"
                      disabled={!canManageMaintenance || !canViewAssets}
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
              {canViewAssets && canManageMaintenance && (
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
            {/* Loading state */}
            <AnimatePresence>
            {loadingAssets.size > 0 && (
              <div className="mt-2 space-y-2">
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
            {/* Selected asset */}
            <AnimatePresence>
            {selectedAsset && (
                <motion.div
                  initial={{ opacity: 0, x: -20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 20, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="mt-2 p-3 border rounded-md bg-muted/50"
                >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{selectedAsset.assetTagId}</Badge>
                    <span className="text-sm font-medium">
                      {selectedAsset.category?.name || 'No Category'}
                      {selectedAsset.subCategory?.name && ` - ${selectedAsset.subCategory.name}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(selectedAsset.status || 'Available')}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleRemoveAsset}
                      className="h-8 w-8"
                      disabled={!canManageMaintenance || !canViewAssets}
                    >
                      <XIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                </motion.div>
            )}
            </AnimatePresence>
          </CardContent>
        </Card>
        </motion.div>

        {/* Maintenance Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
        <Card>
          <CardHeader>
            <CardTitle>Create Maintenance Record</CardTitle>
            <CardDescription>
              Record scheduled or completed maintenance on assets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Maintenance Title */}
            <Field>
              <FieldLabel htmlFor="title">
                Maintenance Title <span className="text-destructive">*</span>
              </FieldLabel>
              <FieldContent>
                <Controller
                  name="title"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <>
                      <Input
                        id="title"
                        placeholder="e.g., Annual Service, Repair Display, Battery Replacement"
                        {...field}
                        disabled={!canManageMaintenance || !canViewAssets || !selectedAsset}
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

            {/* Maintenance Details */}
            <Field>
              <FieldLabel htmlFor="details">
                Maintenance Details
              </FieldLabel>
              <FieldContent>
                <Controller
                  name="details"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <>
                      <Textarea
                        id="details"
                        placeholder="Enter maintenance details (optional)"
                        {...field}
                        rows={3}
                        disabled={!canManageMaintenance || !canViewAssets || !selectedAsset}
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

            {/* Due Date and Maintenance By */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="dueDate">
                  Maintenance Due Date
                </FieldLabel>
                <FieldContent>
                  <Controller
                    name="dueDate"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <>
                        <Input
                          id="dueDate"
                          type="date"
                          {...field}
                          disabled={!canManageMaintenance || !canViewAssets || !selectedAsset}
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
                <FieldLabel htmlFor="maintenanceBy">
                  Maintenance By
                </FieldLabel>
                <FieldContent>
                  <Controller
                    name="maintenanceBy"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <>
                        <Input
                          id="maintenanceBy"
                          placeholder="Service provider or technician name"
                          {...field}
                          disabled={!canManageMaintenance || !canViewAssets || !selectedAsset}
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
            </div>

            {/* Status, Cost and Repeating - Same line */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field>
                <FieldLabel htmlFor="status">
                  Maintenance Status <span className="text-destructive">*</span>
                </FieldLabel>
                <FieldContent>
                  <Controller
                    name="status"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <>
                        <Select
                          value={field.value || ""}
                          onValueChange={(value) => {
                            field.onChange(value)
                          }}
                          disabled={!canManageMaintenance || !canViewAssets || !selectedAsset}
                        >
                          <SelectTrigger className="w-full" aria-invalid={fieldState.error ? 'true' : 'false'}>
                            <SelectValue placeholder="Select maintenance status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Scheduled">Scheduled</SelectItem>
                            <SelectItem value="In progress">In progress</SelectItem>
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

              <Field>
                <FieldLabel htmlFor="cost">
                  Maintenance Cost
                  {inventoryItems.length > 0 && (
                    <span className="text-xs text-muted-foreground ml-2">(Auto-calculated from inventory items)</span>
                  )}
                </FieldLabel>
                <FieldContent>
                  <Controller
                    name="cost"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <>
                        <Input
                          id="cost"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          {...field}
                          disabled={!canManageMaintenance || !canViewAssets || !selectedAsset || inventoryItems.length > 0}
                          className="w-full"
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
                <FieldLabel htmlFor="isRepeating">
                  Maintenance Repeating
                </FieldLabel>
                <FieldContent>
                  <Controller
                    name="isRepeating"
                    control={form.control}
                    render={({ field }) => (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="isRepeating"
                          checked={field.value}
                          onCheckedChange={(checked) => field.onChange(checked === true)}
                          disabled={!canManageMaintenance || !canViewAssets || !selectedAsset}
                        />
                        <label
                          htmlFor="isRepeating"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          <span className={field.value ? "font-semibold" : "text-muted-foreground"}>Yes</span>
                          <span className="mx-1">/</span>
                          <span className={!field.value ? "font-semibold" : "text-muted-foreground"}>No</span>
                        </label>
                      </div>
                    )}
                  />
                </FieldContent>
              </Field>
            </div>

            {/* Inventory Items Section */}
            <div className="mt-6 pt-6 border-t">
              <InventoryItemsSelector
                value={inventoryItems}
                onChange={(items) => {
                  setInventoryItems(items)
                  // Calculate total inventory cost and update maintenance cost
                  const totalCost = items.reduce((total, item) => {
                    const cost = item.unitCost ? item.unitCost * item.quantity : 0
                    return total + cost
                  }, 0)
                  form.setValue('cost', totalCost > 0 ? totalCost.toFixed(2) : '')
                }}
                disabled={!canManageMaintenance || !canViewAssets || !selectedAsset}
                showStockWarnings={true}
              />
            </div>

      </div>
          </CardContent>
        </Card>
        </motion.div>

      </form>

      {/* Floating Action Buttons - Only show when form has changes */}
      <AnimatePresence>
      {isFormDirty && canViewAssets && canManageMaintenance && (
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
            disabled={maintenanceMutation.isPending || !selectedAsset}
            className="min-w-[120px]"
          >
            {maintenanceMutation.isPending ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Saving...
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

export default function MaintenancePage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Maintenance</h1>
          <p className="text-muted-foreground">
            Schedule and manage asset maintenance
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
      <MaintenancePageContent />
    </Suspense>
  )
}
