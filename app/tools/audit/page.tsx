'use client'

import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useSearchParams, useRouter } from 'next/navigation'
import { QrCode, CheckCircle2, X, FileText, History, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { QRScannerDialog } from '@/components/dialogs/qr-scanner-dialog'
import { AuditDialog } from '@/components/dialogs/audit-dialog'
import { DeleteConfirmationDialog } from '@/components/dialogs/delete-confirmation-dialog'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { usePermissions } from '@/hooks/use-permissions'
import { cn } from '@/lib/utils'
import type { AuditFormData } from '@/lib/validations/audit'
import { useMobileDock } from '@/components/mobile-dock-provider'
import { useIsMobile } from '@/hooks/use-mobile'

interface Asset {
  id: string
  assetTagId: string
  description: string
  status: string | null
  category: {
    name: string
  } | null
  subCategory: {
    name: string
  } | null
  location: string | null
  brand: string | null
  model: string | null
  serialNo: string | null
  cost: number | null
  purchaseDate: string | null
  department: string | null
  site: string | null
}

interface ScannedAsset extends Asset {
  scannedAt: Date
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

function AuditPageContent() {
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canAudit = hasPermission('canAudit')
  const canViewAssets = hasPermission('canViewAssets')
  const isMobile = useIsMobile()
  const { setDockContent } = useMobileDock()
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [scannedAssets, setScannedAssets] = useState<ScannedAsset[]>([])
  const [selectedAsset, setSelectedAsset] = useState<ScannedAsset | null>(null)
  const [isAuditDialogOpen, setIsAuditDialogOpen] = useState(false)
  const [assetIdInput, setAssetIdInput] = useState('')
  const [auditToDelete, setAuditToDelete] = useState<{ id: string; auditType: string; assetTagId: string } | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const [loadingAssets, setLoadingAssets] = useState<Set<string>>(new Set()) // Track assets being loaded
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionRef = useRef<HTMLDivElement>(null)
  const lastScannedCodeRef = useRef<string | null>(null)
  const isInitialMount = useRef(true)
  const hasProcessedUrlParams = useRef(false)

  useEffect(() => {
    isInitialMount.current = false
  }, [])

  // Set mobile dock content
  useEffect(() => {
    if (isMobile) {
      setDockContent(
        <div className="flex items-center justify-center w-full">
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              if (!canAudit) {
                toast.error('You do not have permission to conduct audits')
                return
              }
              setIsScannerOpen(true)
            }}
            className="h-10 w-10 rounded-full btn-glass-elevated"
            title="Scan QR Code"
          >
            <QrCode className="h-4 w-4" />
          </Button>
        </div>
      )
    } else {
      setDockContent(null)
    }
    
    return () => {
      setDockContent(null)
    }
  }, [isMobile, setDockContent, canAudit, setIsScannerOpen])


  // Fetch recent audit history
  const { 
    data: auditStatsData, 
    isLoading: isLoadingAuditStats, 
    error: auditStatsError 
  } = useQuery<{ recentAudits: Array<{
    id: string
    assetId: string
    auditType: string
    auditDate: string
    auditor: string | null
    status: string | null
    notes: string | null
    createdAt: string
    asset: {
      id: string
      assetTagId: string
      description: string
    }
  }> }>({
    queryKey: ['audit-stats'],
    queryFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
        ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
        : ''
      const url = `${baseUrl}/api/assets/audit/stats`
      
      // Get auth token
      const { createClient } = await import('@/lib/supabase-client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = {}
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      
      const response = await fetch(url, {
        credentials: 'include',
        headers,
      })
      if (!response.ok) {
        throw new Error('Failed to fetch audit statistics')
      }
      return response.json()
    },
    enabled: canAudit,
    staleTime: 30000, // Cache for 30 seconds
    refetchOnWindowFocus: false,
  })

  const recentAudits = auditStatsData?.recentAudits || []

  // Helper function to format time ago
  const getTimeAgo = (dateString: string) => {
    try {
      const date = new Date(dateString)
      const now = new Date()
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
      
      if (diffInSeconds < 60) {
        return 'Just now'
      } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60)
        return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
      } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600)
        return `${hours} hour${hours !== 1 ? 's' : ''} ago`
      } else if (diffInSeconds < 604800) {
        const days = Math.floor(diffInSeconds / 86400)
        return `${days} day${days !== 1 ? 's' : ''} ago`
      } else {
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        })
      }
    } catch {
      return 'Unknown'
    }
  }

  // Fetch asset suggestions based on input
  const { data: assetSuggestions = [], isLoading: isLoadingSuggestions } = useQuery<Asset[]>({
    queryKey: ['asset-suggestions', assetIdInput, scannedAssets.length, showSuggestions],
    queryFn: async () => {
      const searchTerm = assetIdInput.trim() || ''
      const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
        ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
        : ''
      const url = `${baseUrl}/api/assets?search=${encodeURIComponent(searchTerm)}&pageSize=10000`
      
      // Get auth token
      const { createClient } = await import('@/lib/supabase-client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (baseUrl && session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      
      const response = await fetch(url, {
        headers,
        credentials: 'include',
      })
      if (!response.ok) {
        throw new Error('Failed to fetch assets')
      }
      const data = await response.json()
      const assets = data.assets as Asset[]
      
      // Filter out assets already scanned
      const scannedIds = scannedAssets.map(a => a.id.toLowerCase())
      const filtered = assets
        .filter(a => !scannedIds.includes(a.id.toLowerCase()))
        .slice(0, 10) // Limit suggestions to 10 for UI
      
      return filtered
    },
    enabled: showSuggestions && canAudit,
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

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Find asset by assetTagId
  const findAssetById = useCallback(async (assetTagId: string): Promise<Asset | null> => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
        ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
        : ''
      const url = `${baseUrl}/api/assets?search=${encodeURIComponent(assetTagId)}&pageSize=100`
      
      // Get auth token
      const { createClient } = await import('@/lib/supabase-client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (baseUrl && session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      
      const response = await fetch(url, {
        headers,
        credentials: 'include',
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
  }, [])

  // Find asset by UUID (internal ID)
  const findAssetByUuid = useCallback(async (assetId: string): Promise<Asset | null> => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
        ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
        : ''
      const url = `${baseUrl}/api/assets/${assetId}`
      
      // Get auth token
      const { createClient } = await import('@/lib/supabase-client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (baseUrl && session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      
      const response = await fetch(url, {
        headers,
        credentials: 'include',
      })
      if (!response.ok) {
        throw new Error('Failed to fetch asset')
      }
      const data = await response.json()
      return data.asset as Asset
    } catch (error) {
      console.error('Error looking up asset by UUID:', error)
      return null
    }
  }, [])

  // Handle URL query parameters for assetId
  useEffect(() => {
    // Skip if we've already processed URL params (prevents re-population)
    if (hasProcessedUrlParams.current) {
      return
    }

    const urlAssetId = searchParams.get('assetId')

    if (urlAssetId && canAudit && !selectedAsset) {
      // Mark as processed to prevent re-population
      hasProcessedUrlParams.current = true
      
      // Check if it's a UUID (contains dashes) or assetTagId
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(urlAssetId)
      
      // Clear URL parameters helper
      const clearUrlParams = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('assetId')
        const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname
        router.replace(newUrl)
      }
      
      // Fetch and add the asset from URL
      const selectAssetFromUrl = async () => {
        try {
          const asset = isUuid 
            ? await findAssetByUuid(urlAssetId)
            : await findAssetById(urlAssetId)
          
          if (asset) {
            // Check if already scanned
            const alreadyScanned = scannedAssets.find(
              (a) => a.id.toLowerCase() === asset.id.toLowerCase()
            )
            
            if (alreadyScanned) {
              setSelectedAsset(alreadyScanned)
              toast.info(`Asset "${asset.assetTagId}" already in audit list`)
            } else {
              // Add to scanned assets
              const scannedAsset: ScannedAsset = {
                ...asset,
                scannedAt: new Date(),
              }
              
              setScannedAssets((prev) => [...prev, scannedAsset])
              setSelectedAsset(scannedAsset)
              toast.success(`Asset "${asset.assetTagId}" added to audit list`)
            }
            
            // Clear URL parameter
            clearUrlParams()
          } else {
            toast.error(`Asset with ID "${urlAssetId}" not found`)
            clearUrlParams()
          }
        } catch (error) {
          console.error('Error fetching asset from URL:', error)
          toast.error('Failed to load asset from URL')
          const params = new URLSearchParams(searchParams.toString())
          params.delete('assetId')
          const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname
          router.replace(newUrl)
        }
      }
      
      selectAssetFromUrl()
    }
  }, [searchParams, canAudit, selectedAsset, scannedAssets, router, findAssetByUuid, findAssetById])

  // Handle QR code scan
  const handleQRScan = async (scannedCode: string) => {
    if (!canAudit) {
      toast.error('You do not have permission to conduct audits')
      setIsScannerOpen(false)
      return
    }
    
    // Prevent duplicate scans
    if (lastScannedCodeRef.current === scannedCode) {
      return
    }

    // Check if already scanned or loading
    const alreadyScanned = scannedAssets.find(
      (a) => a.assetTagId.toLowerCase() === scannedCode.toLowerCase()
    )
    if (alreadyScanned) {
      toast.info(`Asset "${scannedCode}" already scanned`)
      return
    }

    if (loadingAssets.has(scannedCode)) {
      return // Already loading this asset
    }

    lastScannedCodeRef.current = scannedCode
    // Don't close scanner - allow multi-scan

    // Add to loading state
    setLoadingAssets(prev => new Set(prev).add(scannedCode))

    try {
      // Set the input value and look up asset
      setAssetIdInput(scannedCode)
      const asset = await findAssetById(scannedCode)
      
      if (asset) {
        await handleAddAsset(asset)
      } else {
        toast.error(`Asset with ID "${scannedCode}" not found`)
      }
    } finally {
      // Remove from loading state
      setLoadingAssets(prev => {
        const newSet = new Set(prev)
        newSet.delete(scannedCode)
        return newSet
      })
    }
    
    // Clear last scanned code after a delay
    setTimeout(() => {
      lastScannedCodeRef.current = null
    }, 2000)
  }

  // Handle QR code removal from multi-scan
  const handleQRRemove = (code: string) => {
    // Remove from loading state if present
    setLoadingAssets(prev => {
      const newSet = new Set(prev)
      newSet.delete(code)
      return newSet
    })
    // Remove from scanned assets
    setScannedAssets(prev => prev.filter(asset => asset.assetTagId !== code))
    toast.success(`Asset ${code} removed from scan list`)
  }

  // Add asset to scanned list
  const handleAddAsset = async (asset?: Asset) => {
    if (!canAudit) {
      toast.error('You do not have permission to conduct audits')
      return
    }
    
    const assetToAdd = asset || await findAssetById(assetIdInput.trim())
    
    if (!assetToAdd) {
      if (!asset) {
        toast.error(`Asset with ID "${assetIdInput}" not found`)
      }
      return
    }

    // Check if already scanned
    const alreadyScanned = scannedAssets.find(
      (a) => a.assetTagId.toLowerCase() === assetToAdd.assetTagId.toLowerCase()
    )
    if (alreadyScanned) {
      toast.info(`Asset "${assetToAdd.assetTagId}" already scanned in this session`)
      setSelectedAsset(alreadyScanned)
      setAssetIdInput('')
      setShowSuggestions(false)
      return
    }

    // Add to scanned assets
    const scannedAsset: ScannedAsset = {
      ...assetToAdd,
      scannedAt: new Date(),
    }
    
    setScannedAssets((prev) => [...prev, scannedAsset])
    setSelectedAsset(scannedAsset)
    setAssetIdInput('')
    setShowSuggestions(false)
    setSelectedSuggestionIndex(-1)
    toast.success(`Asset "${assetToAdd.assetTagId}" found and added to audit list`)
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

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAssetIdInput(e.target.value)
    setShowSuggestions(true)
    setSelectedSuggestionIndex(-1)
  }

  // Create audit record mutation
  const createAuditMutation = useMutation({
    mutationFn: async ({ assetId, data }: { assetId: string; data: AuditFormData }) => {
      const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
        ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
        : ''
      const url = `${baseUrl}/api/assets/${assetId}/audit`
      
      // Get auth token
      const { createClient } = await import('@/lib/supabase-client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (baseUrl && session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          auditType: data.auditType,
          auditDate: data.auditDate,
          auditor: data.auditor || null,
          status: data.status || 'Completed',
          notes: data.notes || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        // Handle permission errors (403)
        if (response.status === 403) {
          // Invalidate permissions cache to force refresh
          await queryClient.invalidateQueries({ queryKey: ['user-permissions'] })
          throw new Error(errorData.error || 'You do not have permission to conduct audits')
        }
        throw new Error(errorData.error || 'Failed to create audit record')
      }

      return response.json()
    },
    onSuccess: async (result, variables) => {
      // Remove asset from scanned list after successful audit
      setScannedAssets((prev) => prev.filter((a) => a.id !== variables.assetId))
      
      // Clear selected asset if it was the one that was audited
      setSelectedAsset(null)

      setIsAuditDialogOpen(false)
      
      // Invalidate queries
      await queryClient.invalidateQueries({ queryKey: ['auditHistory', variables.assetId] })
      await queryClient.invalidateQueries({ queryKey: ['audit-stats'] })
      await queryClient.invalidateQueries({ queryKey: ['assets'] })
      
      toast.success('Audit record created successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create audit record')
    },
  })

  // Delete audit record mutation
  const deleteAuditMutation = useMutation({
    mutationFn: async (auditId: string) => {
      const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
        ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
        : ''
      const url = `${baseUrl}/api/assets/audit/${auditId}`
      
      // Get auth token
      const { createClient } = await import('@/lib/supabase-client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (baseUrl && session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        // Handle permission errors (403)
        if (response.status === 403) {
          // Invalidate permissions cache to force refresh
          await queryClient.invalidateQueries({ queryKey: ['user-permissions'] })
          throw new Error(errorData.error || 'You do not have permission to delete audit records')
        }
        throw new Error(errorData.error || 'Failed to delete audit record')
      }
      return response.json()
    },
    onSuccess: async () => {
      // Invalidate queries to refresh the list
      await queryClient.invalidateQueries({ queryKey: ['audit-stats'] })
      await queryClient.invalidateQueries({ queryKey: ['auditHistory'] })
      setIsDeleteDialogOpen(false)
      setAuditToDelete(null)
      toast.success('Audit record deleted successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete audit record')
    },
  })

  // Handle audit form submit
  const handleAuditSubmit = async (data: AuditFormData) => {
    if (!selectedAsset) return
    await createAuditMutation.mutateAsync({ assetId: selectedAsset.id, data })
  }

  // Remove asset from scanned list
  const handleRemoveAsset = (assetTagId: string) => {
    setScannedAssets((prev) => prev.filter((a) => a.assetTagId !== assetTagId))
    if (selectedAsset?.assetTagId === assetTagId) {
      setSelectedAsset(null)
    }
  }

  // Format currency
  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PHP',
    }).format(value)
  }

  // Format date
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A'
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return dateString
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Asset Audit</h1>
          <p className="text-muted-foreground mt-1">
            Scan QR codes or search manually to verify and audit assets
          </p>
        </div>
        <Button
          onClick={() => {
            if (!canAudit) {
              toast.error('You do not have permission to conduct audits')
              return
            }
            setIsScannerOpen(true)
          }}
          size="sm"
          className={cn("gap-2 shrink-0", isMobile && "hidden")}
        >
          <QrCode className="h-5 w-5" />
          Scan QR Code
        </Button>
      </div>

      {/* Recent History - Always visible to show access denied message if needed */}
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
          {permissionsLoading || isLoadingAuditStats ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-3">
                <Spinner variant="default" size={24} className="text-muted-foreground" />
                <p className="text-muted-foreground text-sm">Loading...</p>
              </div>
            </div>
          ) : !canAudit ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <History className="h-8 w-8 text-muted-foreground opacity-50 mb-2" />
              <p className="text-sm font-medium">Access Denied</p>
              <p className="text-xs text-muted-foreground">
                You do not have permission to conduct audits. Please contact your administrator.
              </p>
            </div>
          ) : !canViewAssets ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <History className="h-8 w-8 text-muted-foreground opacity-50 mb-2" />
              <p className="text-sm font-medium">Access Denied</p>
              <p className="text-xs text-muted-foreground">
                You do not have permission to view assets.
              </p>
            </div>
          ) : auditStatsError ? (
            <p className="text-sm text-destructive text-center py-4">
              Failed to load history. Please try again.
            </p>
          ) : recentAudits.length > 0 ? (
            <ScrollArea className="h-52">
              <div className="relative w-full">
                <Table className="w-full caption-bottom text-sm">
                  <TableHeader className="sticky top-0 z-0 bg-card">
                    <TableRow>
                      <TableHead className="h-8 text-xs bg-card">Asset ID</TableHead>
                      <TableHead className="h-8 text-xs bg-card">Description</TableHead>
                      <TableHead className="h-8 text-xs bg-card">Audit Type</TableHead>
                      <TableHead className="h-8 text-xs bg-card">Auditor</TableHead>
                      <TableHead className="h-8 text-xs bg-card">Status</TableHead>
                      <TableHead className="h-8 text-xs bg-card">Audit Date</TableHead>
                      <TableHead className="h-8 text-xs text-right bg-card">Time Ago</TableHead>
                      <TableHead className="h-8 text-xs text-center bg-card">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence mode="popLayout">
                      {recentAudits.map((audit, index) => (
                        <motion.tr
                          key={audit.id}
                          layout
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ 
                            duration: 0.2, 
                            delay: isInitialMount.current ? index * 0.05 : 0 
                          }}
                          className="h-10"
                        >
                        <TableCell className="py-1.5">
                          <Badge variant="outline" className="text-xs">
                            {audit.asset.assetTagId}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-1.5 text-xs max-w-[200px] truncate">
                          {audit.asset.description}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground">
                          {audit.auditType}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground">
                          {audit.auditor || '-'}
                        </TableCell>
                        <TableCell className="py-1.5">
                          {audit.status ? (
                            <Badge
                              variant={
                                audit.status === 'Completed'
                                  ? 'default'
                                  : audit.status === 'Pending'
                                  ? 'secondary'
                                  : 'destructive'
                              }
                              className="text-xs"
                            >
                              {audit.status}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground">
                          {formatDate(audit.auditDate)}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground text-right">
                          {getTimeAgo(audit.createdAt)}
                        </TableCell>
                        <TableCell className="py-1.5 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive rounded-full"
                            onClick={() => {
                              setAuditToDelete({
                                id: audit.id,
                                auditType: audit.auditType,
                                assetTagId: audit.asset.assetTagId,
                              })
                              setIsDeleteDialogOpen(true)
                            }}
                            title="Delete audit record"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                        </motion.tr>
                    ))}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              </div>
              <ScrollBar orientation="horizontal" />
              <ScrollBar orientation="vertical" className="z-30" />
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent audits
            </p>
          )}
        </CardContent>
      </Card>

      {/* Asset Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Asset Selection</CardTitle>
          <CardDescription className="text-xs">
            Type asset ID and press Enter, or select an asset from the suggestions to add to the audit list
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2 pb-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                ref={inputRef}
                placeholder="Enter asset ID (e.g., AT-001) or select from suggestions"
                value={assetIdInput}
                onChange={handleInputChange}
                onKeyDown={handleSuggestionKeyDown}
                onFocus={() => {
                  if (!canAudit) {
                    toast.error('You do not have permission to conduct audits')
                    return
                  }
                  setShowSuggestions(true)
                }}
                className="w-full"
                autoComplete="off"
                disabled={!canAudit}
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
                <AnimatePresence>
                  {assetSuggestions.map((asset, index) => (
                    <motion.div
                    key={asset.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.15, delay: index * 0.03 }}
                    onClick={() => handleSelectSuggestion(asset)}
                    onMouseEnter={() => setSelectedSuggestionIndex(index)}
                    className={cn(
                      'px-4 py-3 cursor-pointer transition-colors',
                      'hover:bg-gray-400/20 hover:bg-clip-padding hover:backdrop-filter hover:backdrop-blur-sm',
                      selectedSuggestionIndex === index && 'bg-gray-400/20 bg-clip-padding backdrop-filter backdrop-blur-sm'
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
                  ))}
                </AnimatePresence>
              ) : (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  No assets found. Start typing to search...
                </div>
              )}
            </div>
          )}
        </div>
        {canAudit && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setIsScannerOpen(true)}
            title="Scan QR Code"
          >
            <QrCode className="h-4 w-4" />
          </Button>
        )}
      </div>
    </CardContent>
  </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:grid-rows-1">
        {/* Scanned Assets List */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          <Card className="flex flex-col flex-1 min-h-0">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Scanned Assets ({scannedAssets.length})</CardTitle>
                </div>
                {scannedAssets.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setScannedAssets([])
                      setSelectedAsset(null)
                    }}
                    className='btn-glass'
                  >
                    Clear All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0">
              {scannedAssets.length === 0 && loadingAssets.size === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 py-12 text-center">
                  <div className="rounded-full bg-muted p-3 mb-4">
                    <QrCode className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">
                    No assets scanned yet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Scan a QR code or search manually to get started
                  </p>
                </div>
              ) : (
                <ScrollArea className="flex-1">
                  <div className="space-y-2">
                    {/* Show loading placeholders for assets being fetched */}
                    <AnimatePresence>
                    {Array.from(loadingAssets).map((code) => (
                        <motion.div
                        key={`loading-${code}`}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                      >
                          <Card className="border py-0 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0 space-y-2.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-semibold text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                                  <Spinner className="h-3 w-3" />
                                  {code}
                                </span>
                               
                              </div>
                              <p className="text-sm text-muted-foreground italic">
                                Looking up asset details...
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                        </motion.div>
                    ))}
                    </AnimatePresence>
                    {/* Show actual scanned assets */}
                    <AnimatePresence mode="popLayout">
                      {scannedAssets.map((asset, index) => (
                        <motion.div
                        key={asset.assetTagId}
                          layout
                          initial={{ opacity: 0, y: 20, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -20, scale: 0.95 }}
                          transition={{ 
                            duration: 0.2, 
                            delay: isInitialMount.current ? index * 0.05 : 0 
                          }}
                        >
                          <Card
                        className={`cursor-pointer transition-all border py-0 ${
                          selectedAsset?.assetTagId === asset.assetTagId
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'hover:bg-accent/50 hover:border-border'
                        }`}
                        onClick={() => setSelectedAsset(asset)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0 space-y-2.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-semibold text-sm text-foreground">
                                  {asset.assetTagId}
                                </span>
                                {getStatusBadge(asset.status)}
                              </div>
                              <p className="text-sm text-foreground font-medium line-clamp-1">
                                {asset.description}
                              </p>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                {asset.category && (
                                  <span className="flex items-center gap-1">
                                    <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                                    {asset.category.name}
                                    {asset.subCategory?.name && ` - ${asset.subCategory.name}`}
                                  </span>
                                )}
                                {asset.location && (
                                  <span className="flex items-center gap-1">
                                    <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                                    {asset.location}
                                  </span>
                                )}
                                {asset.brand && (
                                  <span className="flex items-center gap-1">
                                    <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                                    {asset.brand}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                                Scanned: {asset.scannedAt.toLocaleTimeString()}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedAsset(asset)
                                  setIsAuditDialogOpen(true)
                                }}
                                className="shrink-0 btn-glass"
                              >
                                <FileText className="h-3.5 w-3.5 mr-1" />
                                Audit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRemoveAsset(asset.assetTagId)
                                }}
                                className="text-muted-foreground hover:text-destructive shrink-0 rounded-full"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                        </motion.div>
                    ))}
                    </AnimatePresence>
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Asset Details */}
        <div className="flex flex-col min-h-0 h-full">
          {/* Selected Asset Details */}
          <AnimatePresence mode="wait">
          {selectedAsset ? (
              <motion.div
                key={selectedAsset.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
            <Card className="flex flex-col flex-1 min-h-0">
              <CardHeader>
                <CardTitle>Asset Details</CardTitle>
                <CardDescription>Verify asset information</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col space-y-4 min-h-0">
                <ScrollArea className="flex-1">
                  <div className="space-y-3 pr-4">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">
                        Asset Tag ID
                      </div>
                      <div className="font-mono font-semibold">{selectedAsset.assetTagId}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">
                        Description
                      </div>
                      <div className="text-sm">{selectedAsset.description}</div>
                    </div>
                    {selectedAsset.category && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          Category
                        </div>
                        <div className="text-sm">{selectedAsset.category.name}</div>
                      </div>
                    )}
                    {selectedAsset.subCategory && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          Sub Category
                        </div>
                        <div className="text-sm">{selectedAsset.subCategory.name}</div>
                      </div>
                    )}
                    {selectedAsset.status && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          Status
                        </div>
                        {getStatusBadge(selectedAsset.status)}
                      </div>
                    )}
                    {selectedAsset.location && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          Location
                        </div>
                        <div className="text-sm">{selectedAsset.location}</div>
                      </div>
                    )}
                    {selectedAsset.department && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          Department
                        </div>
                        <div className="text-sm">{selectedAsset.department}</div>
                      </div>
                    )}
                    {selectedAsset.brand && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          Brand
                        </div>
                        <div className="text-sm">{selectedAsset.brand}</div>
                      </div>
                    )}
                    {selectedAsset.model && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          Model
                        </div>
                        <div className="text-sm">{selectedAsset.model}</div>
                      </div>
                    )}
                    {selectedAsset.serialNo && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          Serial Number
                        </div>
                        <div className="text-sm font-mono">{selectedAsset.serialNo}</div>
                      </div>
                    )}
                    {selectedAsset.cost && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          Cost
                        </div>
                        <div className="text-sm">{formatCurrency(selectedAsset.cost)}</div>
                      </div>
                    )}
                    {selectedAsset.purchaseDate && (
                      <div>
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          Purchase Date
                        </div>
                        <div className="text-sm">{formatDate(selectedAsset.purchaseDate)}</div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
                <Button
                  className="w-full mt-4"
                  onClick={() => setIsAuditDialogOpen(true)}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Create Audit Record
                </Button>
              </CardContent>
            </Card>
              </motion.div>
          ) : (
              <motion.div
                key="no-selection"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
            <Card className="flex flex-col flex-1 min-h-0">
              <CardContent className="flex flex-col items-center justify-center flex-1 py-12 text-center">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">
                  No asset selected
                </p>
                <p className="text-xs text-muted-foreground max-w-[200px]">
                  Select an asset from the scanned list to view details and create an audit record
                </p>
              </CardContent>
            </Card>
              </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>
      {/* QR Scanner Dialog */}
      <QRScannerDialog
        open={isScannerOpen}
        onOpenChange={setIsScannerOpen}
        onScan={handleQRScan}
        onRemove={handleQRRemove}
        multiScan={true}
        existingCodes={scannedAssets.map(asset => asset.assetTagId)}
        loadingCodes={Array.from(loadingAssets)}
        title="Scan Asset QR Code"
        description="Scan or upload QR codes to add assets. Continue scanning to add multiple assets."
      />

      {/* Audit Dialog */}
      {selectedAsset && (
        <AuditDialog
          open={isAuditDialogOpen}
          onOpenChange={setIsAuditDialogOpen}
          onSubmit={handleAuditSubmit}
          isLoading={createAuditMutation.isPending}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open)
          if (!open) {
            setAuditToDelete(null)
          }
        }}
        onConfirm={() => {
          if (auditToDelete) {
            deleteAuditMutation.mutate(auditToDelete.id)
          }
        }}
        title="Delete Audit Record"
        description={
          auditToDelete
            ? `Are you sure you want to delete audit record "${auditToDelete.auditType}" for asset "${auditToDelete.assetTagId}"? This action cannot be undone.`
            : 'Are you sure you want to delete this audit record? This action cannot be undone.'
        }
        isLoading={deleteAuditMutation.isPending}
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />
    </motion.div>
  )
}

export default function AuditPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="h-8 w-8" />
      </div>
    }>
      <AuditPageContent />
    </Suspense>
  )
}

