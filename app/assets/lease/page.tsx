"use client"

import { useState, useRef, useEffect, useMemo, useCallback, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
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
import { DatePicker } from "@/components/ui/date-picker"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { leaseSchema, type LeaseFormData } from "@/lib/validations/assets"
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
  leases?: Array<{
    id: string
    leaseStartDate: string
    leaseEndDate?: string | null
    returns?: Array<{
      id: string
    }>
  }>
}

// Helper function to check if asset has an active lease
const hasActiveLease = (asset: Asset): boolean => {
  if (!asset.leases || asset.leases.length === 0) return false
  
  return asset.leases.some(lease => {
    // Check if lease is active (no end date or end date in future)
    const isActive = !lease.leaseEndDate || new Date(lease.leaseEndDate) >= new Date()
    // Check if lease hasn't been returned
    const notReturned = !lease.returns || lease.returns.length === 0
    return isActive && notReturned
  })
}

// Helper function to get status badge with colors (only for Available status on lease page)
const getStatusBadge = (status: string | null) => {
  // Treat null/undefined as "Available"
  const statusToCheck = status || "Available"
  const statusLC = statusToCheck.toLowerCase()
  
  // Only show green badge for Available status, others use default outline
  if (statusLC === 'active' || statusLC === 'available') {
    return <Badge variant="default" className="bg-green-500">{statusToCheck}</Badge>
  }
  
  // For any other status (shouldn't happen for lease, but just in case)
  return <Badge variant="outline">{statusToCheck}</Badge>
}

// Helper function to get badge for asset suggestions (shows "Leased" if has active lease)
const getSuggestionBadge = (asset: Asset) => {
  if (hasActiveLease(asset)) {
    return <Badge variant="secondary" className="bg-yellow-500">Leased</Badge>
  }
  // Use getStatusBadge to show green badge for Available status
  return getStatusBadge(asset.status || null)
}

function LeaseAssetPageContent() {
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const { state: sidebarState, open: sidebarOpen } = useSidebar()
  const isMobile = useIsMobile()
  const hasProcessedUrlParams = useRef(false)
  const canViewAssets = hasPermission('canViewAssets')
  const canLease = hasPermission('canLease')
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

  const form = useForm<LeaseFormData>({
    resolver: zodResolver(leaseSchema),
    defaultValues: {
      assetId: '',
      lessee: '',
      leaseStartDate: new Date().toISOString().split('T')[0],
      leaseEndDate: '',
      conditions: '',
      notes: '',
    },
  })

  // Fetch lease statistics
  const { data: leaseStats, isLoading: isLoadingLeaseStats, error: leaseStatsError } = useQuery<{
    totalLeased: number
    recentLeases: Array<{
      id: string
      lessee: string
      leaseStartDate: string
      leaseEndDate?: string | null
      conditions?: string | null
      createdAt: string
      asset: {
        id: string
        assetTagId: string
        description: string
      }
    }>
  }>({
    queryKey: ["lease-stats"],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/assets/lease/stats`
      
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
        throw new Error('Failed to fetch lease statistics')
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

  // Fetch asset suggestions using reusable hook (only Available assets, exclude Leased)
  const { suggestions: allSuggestions, isLoading: isLoadingSuggestions } = useAssetSuggestions(
    assetIdInput,
    "Available", // Filter for Available status only
    [],
    canViewAssets && canLease,
    showSuggestions,
    10 // max results when searching, 20 when empty
  )

  // Filter out Leased status assets - cannot lease an already leased asset
  const assetSuggestions = useMemo(() => {
    return allSuggestions.filter(a => {
      // Exclude if status is "Leased"
      if (a.status === "Leased") return false
      
      // Convert to Asset type to check for active leases (use unknown first for type safety)
      const asset = a as unknown as Asset
      // Exclude if has active lease
      try {
        if (hasActiveLease(asset)) return false
      } catch {
        // If conversion fails, exclude it to be safe
        return false
      }
      
      return true
    })
  }, [allSuggestions])

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

  // Asset lookup by ID (only returns if available for lease)
  const lookupAsset = async (assetTagId: string): Promise<Asset | null> => {
    const asset = await findAssetById(assetTagId)
    
    if (!asset) {
      return null
    }
    
    // Check if asset is available for lease (must be Available status)
    if (asset.status && asset.status !== "Available") {
      return null
    }
    
    // Check if asset has an active lease (lease without return)
    if (hasActiveLease(asset)) {
      return null
    }
    
    return asset
  }

  // Handle suggestion selection
  const handleSelectSuggestion = (asset: AssetFromHook) => {
    // Convert AssetFromHook to local Asset type
    const assetToSelect = asset as unknown as Asset
    
    // Double-check: asset should already be filtered, but verify it's not leased
    if (hasActiveLease(assetToSelect) || assetToSelect.status === "Leased") {
      toast.error(`Asset "${asset.assetTagId}" already has an active lease`)
      return
    }
    
    setSelectedAsset(assetToSelect)
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
        // Check if asset exists but is not available
        const assetExists = await findAssetById(assetIdInput.trim())
        if (assetExists) {
          // Check if it has an active lease
          if (hasActiveLease(assetExists)) {
            toast.error(`Asset "${assetExists.assetTagId}" already has an active lease`)
          } else if (assetExists.status && assetExists.status !== "Available") {
          toast.error(`Asset "${assetExists.assetTagId}" is not available for lease. Current status: ${assetExists.status || 'Unknown'}`)
          } else {
            toast.error(`Asset "${assetExists.assetTagId}" is not available for lease`)
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
            
            // Check if asset has an active lease
            const hasActiveLease = asset.leases?.some(
              (lease) => !lease.leaseEndDate
            )
            
            if (hasActiveLease) {
              toast.error(`Asset "${asset.assetTagId}" is already leased`)
              clearUrlParams()
              return
            }

            // Check if asset is available
            if (asset.status && asset.status !== "Available") {
              toast.error(`Asset "${asset.assetTagId}" is not available for lease. Current status: ${asset.status}`)
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

  // Clear form function
  const clearForm = () => {
    setSelectedAsset(null)
    setAssetIdInput("")
    form.reset({
      assetId: '',
      lessee: '',
      leaseStartDate: new Date().toISOString().split('T')[0],
      leaseEndDate: '',
      conditions: '',
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
        const errorMessage = `Asset "${assetExists.assetTagId}" is already checked out. Cannot lease an asset that is already checked out.`
        toast.error(errorMessage)
        throw new Error(errorMessage)
      }
      
      // Check if asset is available for lease (must be Available status or null/undefined)
      if (assetExists.status && assetExists.status !== "Available" && assetExists.status !== null && assetExists.status !== undefined) {
        const errorMessage = `Asset "${assetExists.assetTagId}" is not available for lease. Current status: ${assetExists.status}`
        toast.error(errorMessage)
        throw new Error(errorMessage)
      }
      
      // Check if asset has an active lease
      if (hasActiveLease(assetExists)) {
        const errorMessage = `Asset "${assetExists.assetTagId}" already has an active lease`
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

  // Lease mutation
  const leaseMutation = useMutation({
    mutationFn: async (data: {
      assetId: string
      lessee: string
      leaseStartDate: string
      leaseEndDate?: string
      conditions?: string
      notes?: string
    }) => {
      const baseUrl = getApiBaseUrl()
      const token = await getAuthToken()
      const headers: HeadersInit = { "Content-Type": "application/json" }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${baseUrl}/api/assets/lease`, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to lease asset')
      }

      return response.json()
    },
    onSuccess: () => {
      // Mark URL params as processed BEFORE clearing form to prevent re-processing
      hasProcessedUrlParams.current = true
      queryClient.invalidateQueries({ queryKey: ["assets"] })
      queryClient.invalidateQueries({ queryKey: ["lease-stats"] })
      toast.success('Asset leased successfully')
      clearUrlParams()
      clearForm()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to lease asset')
    },
  })

  // Handle form submission
  const handleSubmit = form.handleSubmit(async (data) => {
    if (!selectedAsset) {
      toast.error('Please select an asset')
      return
    }

    leaseMutation.mutate({
      assetId: selectedAsset.id,
      lessee: data.lessee.trim(),
      leaseStartDate: data.leaseStartDate,
      leaseEndDate: data.leaseEndDate || undefined,
      conditions: data.conditions || undefined,
      notes: data.notes || undefined,
    })
  })

  // Track form changes to show floating buttons - only show when asset is selected
  const isFormDirty = useMemo(() => {
    // Only show floating buttons when an asset is actually selected
    return !!selectedAsset
  }, [selectedAsset])

  const recentLeases = leaseStats?.recentLeases || []

  // Track initial mount for animations
  useEffect(() => {
    if (isInitialMount.current && recentLeases.length > 0) {
      const timer = setTimeout(() => {
        isInitialMount.current = false
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [recentLeases.length])

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={isFormDirty ? "pb-16" : ""}
    >
      <div>
        <h1 className="text-3xl font-bold">Lease Asset</h1>
        <p className="text-muted-foreground">
          Record when assets are leased out to third parties
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
            {permissionsLoading || isLoadingLeaseStats ? (
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
            ) : leaseStatsError ? (
              <p className="text-sm text-destructive text-center py-4">
                Failed to load history. Please try again.
              </p>
            ) : recentLeases.length > 0 ? (
              <ScrollArea className="h-52">
                <div className="relative w-full">
                  <Table className="w-full caption-bottom text-sm">
                    <TableHeader className="sticky top-0 z-0 bg-card">
                    <TableRow>
                        <TableHead className="h-8 text-xs bg-card">Asset ID</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Description</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Lessee</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Start Date</TableHead>
                        <TableHead className="h-8 text-xs bg-card">End Date</TableHead>
                        <TableHead className="h-8 text-xs text-right bg-card">Time Ago</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence mode='popLayout'>
                      {recentLeases.map((lease, index) => (
                        <motion.tr
                          key={lease.id}
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
                              setSelectedAssetTagForQR(lease.asset.assetTagId)
                              setQrDisplayDialogOpen(true)
                            }}
                          >
                            {lease.asset.assetTagId}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5 text-xs max-w-[200px] truncate">
                          {lease.asset.description}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground">
                          {lease.lessee}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground">
                          {formatDate(lease.leaseStartDate)}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground">
                          {lease.leaseEndDate 
                            ? formatDate(lease.leaseEndDate)
                            : 'Ongoing'}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground text-right">
                          {getTimeAgo(lease.createdAt)}
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
                No recent leases
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
                  disabled={!canViewAssets || !canLease}
                />
                
                {/* Suggestions dropdown  */}
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
                      assetSuggestions.map((asset: AssetFromHook, index: number) => {
                        // Convert to local Asset type for helper functions
                        const assetAsLocal = asset as unknown as Asset
                        return (
                        <motion.div
                          key={asset.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2, delay: index * 0.05 }}
                          onClick={() => handleSelectSuggestion(asset)}
                          onMouseEnter={() => setSelectedSuggestionIndex(index)}
                          className={cn(
                             "px-4 py-3 transition-colors",
                             hasActiveLease(assetAsLocal) 
                               ? "cursor-not-allowed opacity-60" 
                               : "cursor-pointer hover:bg-gray-400/20 hover:bg-clip-padding hover:backdrop-filter hover:backdrop-blur-sm",
                             selectedSuggestionIndex === index && !hasActiveLease(assetAsLocal) && "bg-gray-400/20 bg-clip-padding backdrop-filter backdrop-blur-sm"
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
                             {getSuggestionBadge(assetAsLocal)}
                          </div>
                        </motion.div>
                        )
                      })
                    ) : (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No assets found. Start typing to search...
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
                  className="bg-transparent dark:bg-input/30"
                >
                  <QrCode className="h-4 w-4" />
                </Button>
              )}
              </div>
            )}
            {selectedAsset && (
              <AnimatePresence>
                <motion.div
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
              </AnimatePresence>
            )}
          </CardContent>
        </Card>
        </motion.div>

        {/* Lease Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Lease Details</CardTitle>
                <CardDescription className="text-xs">
                  Provide information about the lease agreement
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2 pb-4 space-y-4">
                <Field>
                  <FieldLabel htmlFor="lessee">
                    Lessee (Third Party) <span className="text-destructive">*</span>
                  </FieldLabel>
                  <FieldContent>
                <Controller
                  name="lessee"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <>
                    <Input
                      id="lessee"
                      placeholder="Enter lessee name or organization"
                        {...field}
                      className="w-full"
                        disabled={!canViewAssets || !canLease || !selectedAsset}
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
                  <FieldLabel htmlFor="leaseStartDate">
                    Lease Start Date <span className="text-destructive">*</span>
                  </FieldLabel>
                  <FieldContent>
                <Controller
                  name="leaseStartDate"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <DatePicker
                      id="leaseStartDate"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      disabled={!canViewAssets || !canLease || !selectedAsset}
                      placeholder="Select lease start date"
                      error={fieldState.error?.message}
                      className="gap-2"
                      labelClassName="hidden"
                    />
                  )}
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="leaseEndDate">
                    Lease End Date (Optional)
                  </FieldLabel>
                  <FieldContent>
                <Controller
                  name="leaseEndDate"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <DatePicker
                      id="leaseEndDate"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      disabled={!canViewAssets || !canLease || !selectedAsset}
                      placeholder="Select lease end date"
                      error={fieldState.error?.message}
                      className="gap-2"
                      labelClassName="hidden"
                    />
                  )}
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="conditions">
                    Conditions
                  </FieldLabel>
                  <FieldContent>
                <Controller
                  name="conditions"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <>
                    <Textarea
                      id="conditions"
                      placeholder="Enter lease conditions and terms"
                        {...field}
                      className="w-full"
                      rows={3}
                        disabled={!canViewAssets || !canLease || !selectedAsset}
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
                        disabled={!canViewAssets || !canLease || !selectedAsset}
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
      {isFormDirty && canViewAssets && canLease && (
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
            disabled={leaseMutation.isPending || !selectedAsset || !canViewAssets || !canLease}
            className="min-w-[120px]"
          >
            {leaseMutation.isPending ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Leasing...
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

export default function LeaseAssetPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Lease Asset</h1>
          <p className="text-muted-foreground">
            Lease an asset to a vendor
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
      <LeaseAssetPageContent />
    </Suspense>
  )
}
