"use client"

import { useState, useRef, useEffect } from "react"
import { XIcon, History, Edit2, QrCode } from "lucide-react"
import { usePermissions } from '@/hooks/use-permissions'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { QRScannerDialog } from '@/components/qr-scanner-dialog'
import { QRCodeDisplayDialog } from '@/components/qr-code-display-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Field, FieldLabel, FieldContent } from "@/components/ui/field"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

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

type MaintenanceStatus = "Scheduled" | "In progress" | "Completed" | "Cancelled" | ""

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

export default function MaintenancePage() {
  const queryClient = useQueryClient()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  
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
  
  const [title, setTitle] = useState("")
  const [details, setDetails] = useState("")
  const [dueDate, setDueDate] = useState<string>("")
  const [maintenanceBy, setMaintenanceBy] = useState("")
  const [status, setStatus] = useState<MaintenanceStatus>("")
  const [dateCompleted, setDateCompleted] = useState<string>("")
  const [dateCancelled, setDateCancelled] = useState<string>("")
  const [cost, setCost] = useState<string>("")
  const [isRepeating, setIsRepeating] = useState(false)
  const [isFormDirty, setIsFormDirty] = useState(false)
  
  // Edit maintenance dialog state
  const [editingMaintenance, setEditingMaintenance] = useState<{
    id: string
    status: string
    dateCompleted?: string | null
    dateCancelled?: string | null
  } | null>(null)
  const [editStatus, setEditStatus] = useState<MaintenanceStatus>("")
  const [editDateCompleted, setEditDateCompleted] = useState<string>("")
  const [editDateCancelled, setEditDateCancelled] = useState<string>("")

  // Fetch maintenance statistics
  const { data: maintenanceStats, isLoading: isLoadingStats, error: statsError } = useQuery<{
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
      const response = await fetch("/api/assets/maintenance/stats")
      if (!response.ok) {
        throw new Error('Failed to fetch maintenance statistics')
      }
      const data = await response.json()
      return data
    },
    retry: 2,
    retryDelay: 1000,
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

  // Fetch asset suggestions - only Available and Checked out assets
  const { data: assetSuggestions = [], isLoading: isLoadingSuggestions } = useQuery<Asset[]>({
    queryKey: ["asset-maintenance-suggestions", assetIdInput, showSuggestions],
    queryFn: async () => {
      if (!assetIdInput.trim() || assetIdInput.length < 1) {
        const response = await fetch(`/api/assets?search=`)
        if (!response.ok) {
          throw new Error('Failed to fetch assets')
        }
        const data = await response.json()
        const assets = data.assets as Asset[]
        // Filter to only Available and Checked out assets
        const filteredAssets = assets.filter(asset => {
          const status = (asset.status || '').toLowerCase()
          return status === 'available' || status === 'checked out'
        })
        return filteredAssets.slice(0, 20)
      }
      
      const response = await fetch(`/api/assets?search=${encodeURIComponent(assetIdInput.trim())}`)
      if (!response.ok) {
        throw new Error('Failed to fetch assets')
      }
      const data = await response.json()
      const assets = data.assets as Asset[]
      // Filter to only Available and Checked out assets
      const filteredAssets = assets.filter(asset => {
        const status = (asset.status || '').toLowerCase()
        return status === 'available' || status === 'checked out'
      })
      return filteredAssets.slice(0, 10)
    },
    enabled: showSuggestions && canViewAssets, // Only fetch if user has permission
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

  // Find asset by ID without eligibility check (for error messages)
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
  const handleSelectSuggestion = (asset: Asset) => {
    setSelectedAsset(asset)
    setAssetIdInput(asset.assetTagId)
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

  // Format currency in PHP
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'PHP',
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
    }) => {
      const response = await fetch('/api/assets/maintenance', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create maintenance')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] })
      queryClient.invalidateQueries({ queryKey: ["maintenance-stats"] })
      toast.success('Maintenance record created successfully')
      // Reset form
      clearForm()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create maintenance')
    }
  })

  // Update maintenance mutation
  const updateMaintenanceMutation = useMutation({
    mutationFn: async (data: {
      id: string
      status: string
      dateCompleted?: string
      dateCancelled?: string
    }) => {
      const response = await fetch('/api/assets/maintenance', {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update maintenance')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["maintenance-stats"] })
      toast.success('Maintenance status updated successfully')
      setEditingMaintenance(null)
      setEditStatus("")
      setEditDateCompleted("")
      setEditDateCancelled("")
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update maintenance')
    }
  })

  // Handle opening edit dialog
  const handleEditMaintenance = (maintenance: {
    id: string
    status: string
    dateCompleted?: string | null
    dateCancelled?: string | null
  }) => {
    if (!canManageMaintenance) {
      toast.error('You do not have permission to take actions')
      return
    }
    setEditingMaintenance(maintenance)
    setEditStatus(maintenance.status as MaintenanceStatus)
    setEditDateCompleted(maintenance.dateCompleted ? new Date(maintenance.dateCompleted).toISOString().split('T')[0] : "")
    setEditDateCancelled(maintenance.dateCancelled ? new Date(maintenance.dateCancelled).toISOString().split('T')[0] : "")
  }

  // Handle edit status change
  useEffect(() => {
    if (!editingMaintenance) return
    if (editStatus === 'Completed') {
      setEditDateCancelled("")
      if (!editDateCompleted && !editingMaintenance.dateCompleted) {
        setEditDateCompleted(new Date().toISOString().split('T')[0])
      }
    } else if (editStatus === 'Cancelled') {
      setEditDateCompleted("")
      if (!editDateCancelled && !editingMaintenance.dateCancelled) {
        setEditDateCancelled(new Date().toISOString().split('T')[0])
      }
    } else {
      setEditDateCompleted("")
      setEditDateCancelled("")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editStatus, editingMaintenance])

  // Handle edit form submission
  const handleUpdateMaintenance = () => {
    if (!editingMaintenance) return

    if (!editStatus) {
      toast.error('Maintenance status is required')
      return
    }

    if (editStatus === 'Completed' && !editDateCompleted) {
      toast.error('Date completed is required when status is Completed')
      return
    }

    if (editStatus === 'Cancelled' && !editDateCancelled) {
      toast.error('Date cancelled is required when status is Cancelled')
      return
    }

    updateMaintenanceMutation.mutate({
      id: editingMaintenance.id,
      status: editStatus,
      dateCompleted: editStatus === 'Completed' ? editDateCompleted : undefined,
      dateCancelled: editStatus === 'Cancelled' ? editDateCancelled : undefined,
    })
  }

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedAsset) {
      toast.error('Please select an asset')
      return
    }

    if (!title.trim()) {
      toast.error('Maintenance title is required')
      return
    }

    if (!status) {
      toast.error('Maintenance status is required')
      return
    }

    maintenanceMutation.mutate({
      assetId: selectedAsset.id,
      title: title.trim(),
      details: details.trim() || undefined,
      dueDate: dueDate || undefined,
      maintenanceBy: maintenanceBy.trim() || undefined,
      status,
      dateCompleted: dateCompleted || undefined,
      dateCancelled: dateCancelled || undefined,
      cost: cost || undefined,
      isRepeating,
    })
  }

  // Track form changes to show floating buttons
  useEffect(() => {
    const hasChanges = !!(
      selectedAsset ||
      title.trim() ||
      details.trim() ||
      dueDate ||
      maintenanceBy.trim() ||
      status ||
      dateCompleted ||
      dateCancelled ||
      cost ||
      isRepeating
    )
    setIsFormDirty(hasChanges)
  }, [selectedAsset, title, details, dueDate, maintenanceBy, status, dateCompleted, dateCancelled, cost, isRepeating])

  // Clear form function
  const clearForm = () => {
    setSelectedAsset(null)
    setAssetIdInput("")
    setTitle("")
    setDetails("")
    setDueDate("")
    setMaintenanceBy("")
    setStatus("")
    setDateCompleted("")
    setDateCancelled("")
    setCost("")
    setIsRepeating(false)
    setIsFormDirty(false)
  }

  // Handle QR code scan result
  const handleQRScan = async (decodedText: string) => {
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
  }

  return (
    <div className={isFormDirty ? "pb-16" : ""}>
      <div>
        <h1 className="text-3xl font-bold">Maintenance</h1>
        <p className="text-muted-foreground">
          Records scheduled or completed maintenance on assets. Helps track costs and service history.
        </p>
      </div>

      {/* Recent History */}
      <div className="mt-6">
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
                    <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                        <TableHead className="h-8 text-xs bg-card">Asset ID</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Title</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Status</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Maintenance By</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Due Date</TableHead>
                        <TableHead className="h-8 text-xs bg-card">Cost</TableHead>
                        <TableHead className="h-8 text-xs text-right bg-card">Time Ago</TableHead>
                        <TableHead className="h-8 text-xs text-right bg-card">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {maintenanceStats.recentMaintenances.map((maintenance) => (
                      <TableRow key={maintenance.id} className="h-10">
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
                          {maintenance.cost ? formatCurrency(Number(maintenance.cost)) : '-'}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground text-right">
                          {getTimeAgo(maintenance.createdAt)}
                        </TableCell>
                        <TableCell className="py-1.5 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleEditMaintenance({
                              id: maintenance.id,
                              status: maintenance.status,
                              dateCompleted: maintenance.dateCompleted,
                              dateCancelled: maintenance.dateCancelled,
                            })}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  </Table>
                </div>
                <ScrollBar orientation="horizontal" />
                <ScrollBar orientation="vertical" className='z-10' />
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 mt-6">
        {/* Asset Selection Card */}
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
                      className="absolute z-50 w-full mt-2 bg-popover border rounded-md shadow-md max-h-[300px] overflow-auto"
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
                        assetSuggestions.map((asset, index) => (
                          <div
                            key={asset.id}
                            className={cn(
                              "px-4 py-3 cursor-pointer hover:bg-accent",
                              index === selectedSuggestionIndex && "bg-accent"
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
                          </div>
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
            {selectedAsset && (
              <div className="mt-2 p-3 border rounded-md bg-muted/50">
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
              </div>
            )}
          </CardContent>
        </Card>

        {/* Maintenance Form */}
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
              <FieldLabel>Maintenance Title <span className="text-destructive">*</span></FieldLabel>
              <FieldContent>
                <Input
                  placeholder="e.g., Annual Service, Repair Display, Battery Replacement"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  disabled={!canManageMaintenance || !canViewAssets}
                />
              </FieldContent>
            </Field>

            {/* Maintenance Details */}
            <Field>
              <FieldLabel>Maintenance Details</FieldLabel>
              <FieldContent>
                <Textarea
                  placeholder="Enter maintenance details (optional)"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={3}
                  disabled={!canManageMaintenance || !canViewAssets}
                />
              </FieldContent>
            </Field>

            {/* Due Date and Maintenance By */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Maintenance Due Date</FieldLabel>
                <FieldContent>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    disabled={!canManageMaintenance || !canViewAssets}
                  />
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel>Maintenance By</FieldLabel>
                <FieldContent>
                  <Input
                    placeholder="Service provider or technician name"
                    value={maintenanceBy}
                    onChange={(e) => setMaintenanceBy(e.target.value)}
                    disabled={!canManageMaintenance || !canViewAssets}
                  />
                </FieldContent>
              </Field>
            </div>

            {/* Status, Cost and Repeating - Same line */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field>
                <FieldLabel>Maintenance Status <span className="text-destructive">*</span></FieldLabel>
                <FieldContent>
                  <Select
                    value={status}
                    onValueChange={(value) => setStatus(value as MaintenanceStatus)}
                    required
                    disabled={!canManageMaintenance || !canViewAssets}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select maintenance status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Scheduled">Scheduled</SelectItem>
                      <SelectItem value="In progress">In progress</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel>Maintenance Cost</FieldLabel>
                <FieldContent>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    disabled={!canManageMaintenance || !canViewAssets}
                    className="w-full"
                  />
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel>Maintenance Repeating</FieldLabel>
                <FieldContent>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="maintenance-repeating"
                      checked={isRepeating}
                      onCheckedChange={(checked) => setIsRepeating(checked === true)}
                      disabled={!canManageMaintenance || !canViewAssets}
                    />
                    <label
                      htmlFor="maintenance-repeating"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      <span className={isRepeating ? "font-semibold" : "text-muted-foreground"}>Yes</span>
                      <span className="mx-1">/</span>
                      <span className={!isRepeating ? "font-semibold" : "text-muted-foreground"}>No</span>
                    </label>
                  </div>
                </FieldContent>
              </Field>
        </div>
      </div>
          </CardContent>
        </Card>

      </form>

      {/* Floating Action Buttons - Only show when form has changes */}
      {isFormDirty && canViewAssets && canManageMaintenance && (
        <div className="fixed bottom-6 z-50 flex items-center justify-center gap-3 left-1/2 -translate-x-1/2 md:left-[calc(var(--sidebar-width,16rem)+((100vw-var(--sidebar-width,16rem))/2))] md:translate-x-[-50%]">
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
        </div>
      )}

      {/* Edit Maintenance Dialog */}
      <Dialog open={!!editingMaintenance} onOpenChange={(open: boolean) => !open && setEditingMaintenance(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Update Maintenance Status</DialogTitle>
            <DialogDescription>
              Update the maintenance status. The asset status will be automatically updated based on the maintenance status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Status and Date Completed/Cancelled */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field>
                <FieldLabel>Maintenance Status <span className="text-destructive">*</span></FieldLabel>
                <FieldContent>
                  <Select
                    value={editStatus}
                    onValueChange={(value) => setEditStatus(value as MaintenanceStatus)}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select maintenance status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Scheduled">Scheduled</SelectItem>
                      <SelectItem value="In progress">In progress</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>

              {/* Date Completed / Date Cancelled - Conditional based on status */}
              {editStatus === 'Completed' && (
                <Field>
                  <FieldLabel>Date Completed <span className="text-destructive">*</span></FieldLabel>
                  <FieldContent>
                    <Input
                      type="date"
                      value={editDateCompleted}
                      onChange={(e) => setEditDateCompleted(e.target.value)}
                      required
                    />
                  </FieldContent>
                </Field>
              )}

              {editStatus === 'Cancelled' && (
                <Field>
                  <FieldLabel>Date Cancelled <span className="text-destructive">*</span></FieldLabel>
                  <FieldContent>
                    <Input
                      type="date"
                      value={editDateCancelled}
                      onChange={(e) => setEditDateCancelled(e.target.value)}
                      required
                    />
                  </FieldContent>
                </Field>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingMaintenance(null)
                  setEditStatus("")
                  setEditDateCompleted("")
                  setEditDateCancelled("")
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleUpdateMaintenance}
                disabled={updateMaintenanceMutation.isPending}
              >
                {updateMaintenanceMutation.isPending ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Updating...
                  </>
                ) : (
                  'Update Status'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
