"use client"

import { useState, useRef, useMemo, useEffect, useCallback, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { use } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, Sparkles, ImageIcon, Upload, FileText, PlusIcon, Eye, X, Trash2, Package, RefreshCw, ChevronLeft } from "lucide-react"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { usePermissions } from '@/hooks/use-permissions'
import { useSidebar } from '@/components/ui/sidebar'
import { useIsMobile } from '@/hooks/use-mobile'
import { useMobileDock } from '@/components/mobile-dock-provider'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { toast } from 'sonner'
import { useCategories, useSubCategories, useCreateCategory, useCreateSubCategory } from "@/hooks/use-categories"
import { useAsset, useUpdateAsset, useAssetMaintenances, useDeleteMaintenance } from "@/hooks/use-assets"
import { createClient } from '@/lib/supabase-client'

const getApiBaseUrl = () => {
  const useFastAPI = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true'
  const fastApiUrl = process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000'
  return useFastAPI ? fastApiUrl : ''
}

const getAuthToken = async (): Promise<string | null> => {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  } catch {
    return null
  }
}
import { CategoryDialog } from "@/components/dialogs/category-dialog"
import { SubCategoryDialog } from "@/components/dialogs/subcategory-dialog"
import { MediaBrowserDialog } from "@/components/dialogs/media-browser-dialog"
import { DocumentBrowserDialog } from "@/components/dialogs/document-browser-dialog"
import { editAssetSchema, type EditAssetFormData } from "@/lib/validations/assets"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldLabel, FieldContent, FieldError } from "@/components/ui/field"
import { DatePicker } from "@/components/ui/date-picker"
import { LocationSelectField } from "@/components/fields/location-select-field"
import { SiteSelectField } from "@/components/fields/site-select-field"
import { DepartmentSelectField } from "@/components/fields/department-select-field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { ImagePreviewDialog } from "@/components/dialogs/image-preview-dialog"
import { DeleteConfirmationDialog } from "@/components/dialogs/delete-confirmation-dialog"
import { DownloadConfirmationDialog } from "@/components/dialogs/download-confirmation-dialog"
import type { Category, SubCategory } from "@/hooks/use-categories"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// Removed fetchAsset - now using useAsset hook from use-assets.ts

async function fetchHistoryLogs(assetId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
    ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
    : ''
  const url = `${baseUrl}/api/assets/${assetId}/history`
  
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
    const errorText = await response.text()
    console.error(`Failed to fetch history logs: ${response.status} ${response.statusText}`, errorText)
    return { logs: [] }
  }
  return response.json()
}

// Removed fetchMaintenance - now using useAssetMaintenances hook from use-assets.ts

async function fetchReserve(assetId: string) {
      const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
        ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
        : ''
      const url = `${baseUrl}/api/assets/reserve?assetId=${assetId}`
      
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
    return { reservations: [] }
  }
  return response.json()
}


// Removed updateAsset - now using useUpdateAsset hook from use-assets.ts

export default function EditAssetPage({ params }: { params: Promise<{ assetTagId: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const { state: sidebarState, open: sidebarOpen } = useSidebar()
  const isMobile = useIsMobile()
  const { setDockContent } = useMobileDock()
  const canEditAssets = hasPermission('canEditAssets')
  const canManageSetup = hasPermission('canManageSetup')
  const [, startTransition] = useTransition()
  
  // Fetch asset data using FastAPI hook - now using assetTagId from URL
  const { data: asset, isLoading: assetLoading, error: assetError } = useAsset(resolvedParams.assetTagId, !!resolvedParams.assetTagId)
  
  // Update asset mutation using FastAPI hook
  const updateAssetMutation = useUpdateAsset()

  // Fetch thumbnail image (first image) for top section
  const { data: thumbnailData } = useQuery({
    queryKey: ['asset-thumbnail', asset?.assetTagId],
    queryFn: async () => {
      if (!asset?.assetTagId) return { images: [] }
      const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
        ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
        : ''
      const url = `${baseUrl}/api/assets/images/${asset.assetTagId}`
      
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
        cache: 'no-store',
      })
      if (!response.ok) return { images: [] }
      const data = await response.json()
      return { images: data.images || [] }
    },
    enabled: !!asset?.assetTagId,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })

  // Get the first image (most recent by createdAt desc)
  const thumbnailImage = thumbnailData?.images?.[0]

  // Tab state from URL - moved up to use in queries
  const activeTab = (searchParams.get('tab') as 'details' | 'photos' | 'docs' | 'depreciation' | 'maintenance' | 'reserve' | 'audit' | 'history') || 'details'

  // Fetch existing images only when photos tab is active
  // Add retry logic to reduce connection pool pressure
  const { data: existingImagesData, isLoading: loadingExistingImages } = useQuery({
    queryKey: ['assets', 'images', asset?.assetTagId],
    queryFn: async () => {
      if (!asset?.assetTagId) return { images: [] }
      const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
        ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
        : ''
      const url = `${baseUrl}/api/assets/images/${asset.assetTagId}`
      
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
      if (response.ok) {
        const data = await response.json()
        return { images: data.images || [] }
      } else {
        return { images: [] }
      }
    },
    enabled: !!asset?.assetTagId && activeTab === 'photos', // Only fetch when photos tab is active
    staleTime: 0, // Always refetch when component mounts to get latest data
    gcTime: 10 * 60 * 1000,
    retry: 2, // Retry up to 2 times on failure
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  })

  const existingImages = existingImagesData?.images || []

  // Fetch documents only when docs tab is active (after images are loaded to reduce concurrent connections)
  const { data: existingDocumentsData, isLoading: loadingExistingDocuments } = useQuery({
    queryKey: ['assets', 'documents', asset?.assetTagId],
    queryFn: async () => {
      if (!asset?.assetTagId) return { documents: [] }
      
      const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
        ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
        : ''
      const url = `${baseUrl}/api/assets/documents/${asset.assetTagId}`
      
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
      if (response.ok) {
        const data = await response.json()
        return { documents: data.documents || [] }
      } else {
        return { documents: [] }
      }
    },
    enabled: !!asset?.assetTagId && activeTab === 'docs' && !loadingExistingImages, // Only fetch when docs tab is active and images are loaded
    staleTime: 0, // Always refetch when component mounts to get latest data
    gcTime: 10 * 60 * 1000,
    retry: 2, // Retry up to 2 times on failure
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  })

  const existingDocuments = existingDocumentsData?.documents || []

  // Dialog states
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [subCategoryDialogOpen, setSubCategoryDialogOpen] = useState(false)
  
  // Lazy load categories and subcategories - only fetch when dropdowns are opened
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false)
  const [isSubCategoryDropdownOpen, setIsSubCategoryDropdownOpen] = useState(false)

  // Update URL parameters
  const updateURL = useCallback(
    (updates: { tab?: 'details' | 'photos' | 'docs' | 'depreciation' | 'maintenance' | 'reserve' | 'audit' | 'history' }) => {
      const params = new URLSearchParams(searchParams.toString())

      if (updates.tab !== undefined) {
        if (updates.tab === 'details') {
          params.delete('tab')
        } else {
          params.set('tab', updates.tab)
        }
      }

      startTransition(() => {
        router.replace(`/assets/${resolvedParams.assetTagId}?${params.toString()}`, { scroll: false })
      })
    },
    [searchParams, router, resolvedParams.assetTagId, startTransition]
  )

  const handleTabChange = (tab: 'details' | 'photos' | 'docs' | 'depreciation' | 'maintenance' | 'reserve' | 'audit' | 'history') => {
    updateURL({ tab })
  }

  // Fetch history logs, maintenance, and reserve data for read-only tabs
  const { data: historyData, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['asset-history', resolvedParams.assetTagId],
    queryFn: () => fetchHistoryLogs(resolvedParams.assetTagId),
    enabled: !!resolvedParams.assetTagId && activeTab === 'history',
  })

  // Fetch maintenance records using FastAPI hook
  const { data: maintenanceData, isLoading: isLoadingMaintenance } = useAssetMaintenances(
    resolvedParams.assetTagId,
    !!resolvedParams.assetTagId && activeTab === 'maintenance'
  )
  
  // Delete maintenance mutation using FastAPI hook
  const deleteMaintenanceMutation = useDeleteMaintenance()

  const { data: reserveData, isLoading: isLoadingReserve } = useQuery({
    queryKey: ['asset-reserve', resolvedParams.assetTagId],
    queryFn: () => fetchReserve(resolvedParams.assetTagId),
    enabled: !!resolvedParams.assetTagId && activeTab === 'reserve',
  })

  const historyLogs = historyData?.logs || []
  const maintenances = maintenanceData?.maintenances || []
  const reservations = reserveData?.reservations || []

  // React Query hooks - lazy load categories and subcategories only when dropdowns are opened
  // Fetch categories when dropdown is open OR when asset has a categoryId (to display selected value)
  const shouldFetchCategories = isCategoryDropdownOpen || !!asset?.categoryId
  const { data: categories = [], isLoading: categoriesLoading, error: categoriesError } = useCategories(shouldFetchCategories)
  const createCategoryMutation = useCreateCategory()
  const createSubCategoryMutation = useCreateSubCategory()
  
  // Wrapper for handling additional cache invalidation after update
  const handleUpdateSuccess = useCallback(async (updatedAsset: { assetTagId?: string }) => {
    const updatedAssetTagId = updatedAsset?.assetTagId || asset?.assetTagId
    
    // Invalidate ALL assets queries (including paginated/filtered ones)
    queryClient.invalidateQueries({ 
      predicate: (query) => {
        const key = query.queryKey
        return Array.isArray(key) && (
          key[0] === 'assets' || 
          key[0] === 'assets-list'
        )
      },
      refetchType: 'all' // Refetch all matching queries
    })
    
    // Invalidate specific asset and history queries
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['asset', resolvedParams.assetTagId], refetchType: 'active' }),
      queryClient.invalidateQueries({ queryKey: ['asset-history', resolvedParams.assetTagId], refetchType: 'active' }),
    ])
    
    // If assetTagId changed, also invalidate queries for the old assetTagId
    if (asset?.assetTagId && updatedAssetTagId && asset.assetTagId !== updatedAssetTagId) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['asset-thumbnail', asset.assetTagId] }),
        queryClient.invalidateQueries({ queryKey: ['asset-images', asset.assetTagId] }),
        queryClient.invalidateQueries({ queryKey: ['asset-documents', asset.assetTagId] }),
      ])
    }
    
    // Invalidate queries for the updated assetTagId
    if (updatedAssetTagId) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['asset-thumbnail', updatedAssetTagId] }),
        queryClient.invalidateQueries({ queryKey: ['asset-images', updatedAssetTagId] }),
        queryClient.invalidateQueries({ queryKey: ['asset-documents', updatedAssetTagId] }),
        queryClient.invalidateQueries({ queryKey: ['assets', 'images', updatedAssetTagId] }),
        queryClient.invalidateQueries({ queryKey: ['assets', 'documents', updatedAssetTagId] }),
      ])
    }
    
    // Refetch the current asset data to update the form
    await queryClient.refetchQueries({ queryKey: ['asset', resolvedParams.assetTagId] })
  }, [asset?.assetTagId, queryClient, resolvedParams.assetTagId])

  const loading = updateAssetMutation.isPending
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [selectedExistingImages, setSelectedExistingImages] = useState<Array<{ id: string; imageUrl: string; fileName: string }>>([])
  const [selectedDocuments, setSelectedDocuments] = useState<File[]>([])
  const [selectedExistingDocuments, setSelectedExistingDocuments] = useState<Array<{ id: string; documentUrl: string; fileName: string }>>([])
  const [uploadingImages, setUploadingImages] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [imageToDelete, setImageToDelete] = useState<string | null>(null)
  const [isDeleteImageDialogOpen, setIsDeleteImageDialogOpen] = useState(false)
  const [isDeletingImage, setIsDeletingImage] = useState(false)
  const [uploadingDocuments, setUploadingDocuments] = useState(false)
  const [documentUploadProgress, setDocumentUploadProgress] = useState<number>(0)
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null)
  const [isDeleteDocumentDialogOpen, setIsDeleteDocumentDialogOpen] = useState(false)
  const [isDeletingDocument, setIsDeletingDocument] = useState(false)
  const [documentToDownload, setDocumentToDownload] = useState<{ id: string; documentUrl: string; fileName?: string; mimeType?: string | null; documentSize?: number | null } | null>(null)
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false)
  const [maintenanceToDelete, setMaintenanceToDelete] = useState<string | null>(null)
  const [isDeleteMaintenanceDialogOpen, setIsDeleteMaintenanceDialogOpen] = useState(false)
  const [isDeletingMaintenance, setIsDeletingMaintenance] = useState(false)
  const [reservationToDelete, setReservationToDelete] = useState<string | null>(null)
  const [isDeleteReservationDialogOpen, setIsDeleteReservationDialogOpen] = useState(false)
  const [isDeletingReservation, setIsDeletingReservation] = useState(false)
  const [auditToDelete, setAuditToDelete] = useState<string | null>(null)
  const [isDeleteAuditDialogOpen, setIsDeleteAuditDialogOpen] = useState(false)
  const [isDeletingAudit, setIsDeletingAudit] = useState(false)
  const [historyLogToDelete, setHistoryLogToDelete] = useState<string | null>(null)
  const [isDeleteHistoryDialogOpen, setIsDeleteHistoryDialogOpen] = useState(false)
  const [isDeletingHistory, setIsDeletingHistory] = useState(false)
  const [mediaBrowserOpen, setMediaBrowserOpen] = useState(false)
  const [documentBrowserOpen, setDocumentBrowserOpen] = useState(false)
  const [previewImageIndex, setPreviewImageIndex] = useState(0)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewSource, setPreviewSource] = useState<'images' | 'documents'>('images')
  const [isCheckingAssetTag, setIsCheckingAssetTag] = useState(false)
  const [isGeneratingTag, setIsGeneratingTag] = useState(false)
  const [companySuffix, setCompanySuffix] = useState<string>("") // Store the company suffix (e.g., "SA")
  const imageInputRef = useRef<HTMLInputElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)
  const assetTagIdInputRef = useRef<HTMLInputElement>(null)

  // Handle refresh
  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['asset', resolvedParams.assetTagId] })
    queryClient.invalidateQueries({ queryKey: ['asset-thumbnail', asset?.assetTagId] })
    queryClient.invalidateQueries({ queryKey: ['assets', 'images', asset?.assetTagId] })
    queryClient.invalidateQueries({ queryKey: ['assets', 'documents', asset?.assetTagId] })
    queryClient.invalidateQueries({ queryKey: ['asset-history', resolvedParams.assetTagId] })
    queryClient.invalidateQueries({ queryKey: ['asset-maintenances', resolvedParams.assetTagId] })
    queryClient.invalidateQueries({ queryKey: ['asset-reservations', resolvedParams.assetTagId] })
    toast.success('Asset refreshed')
  }, [queryClient, resolvedParams.assetTagId, asset?.assetTagId])

  // Set mobile dock content
  useEffect(() => {
    if (isMobile) {
      setDockContent(
        <>
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.back()}
            className="h-10 w-10 rounded-full btn-glass-elevated"
            title="Go Back"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            className="h-10 w-10 rounded-full btn-glass-elevated"
            title="Refresh"
          >
            <RefreshCw className="h-5 w-5" />
          </Button>
        </>
      )
    }
    
    // Cleanup on unmount
    return () => {
      if (isMobile) {
        setDockContent(null)
      }
    }
  }, [isMobile, setDockContent, router, handleRefresh])

  // Extract suffix from full tag (e.g., "25-579811C-SA" -> "SA")
  const extractSuffix = (fullTag: string): string => {
    const parts = fullTag.split('-')
    if (parts.length >= 3) {
      return parts[parts.length - 1] // Last part is the suffix
    }
    return ""
  }

  // Extract main part from full tag (e.g., "25-579811C-SA" -> "25-579811C")
  const extractMainPart = (fullTag: string): string => {
    const parts = fullTag.split('-')
    if (parts.length >= 3) {
      return parts.slice(0, -1).join('-') // Everything except last part
    }
    return fullTag
  }

  // Format asset tag main part only (without suffix) as user types
  const formatAssetTagMainPart = (value: string): string => {
    // Remove all non-alphanumeric characters except hyphens
    let cleaned = value.replace(/[^A-Za-z0-9-]/g, '').toUpperCase()
    
    // Remove existing hyphens to rebuild format
    const parts = cleaned.split('-').filter(p => p.length > 0)
    cleaned = parts.join('')
    
    // Format: YY-XXXXXX[S] (main part only, no suffix)
    // Max length: 2 (year) + 6 (random) + 1 (subcategory) = 9 chars + 1 hyphen = 10
    if (cleaned.length === 0) return ''
    
    let formatted = ''
    
    // Year (first 2 digits)
    if (cleaned.length > 0) {
      formatted = cleaned.substring(0, 2)
      if (cleaned.length > 2) {
        formatted += '-'
        // Random number (next 6 digits)
        const randomPart = cleaned.substring(2, 8)
        formatted += randomPart
        if (cleaned.length > 8) {
          // Subcategory letter (next 1 character)
          const subcatPart = cleaned.substring(8, 9)
          formatted += subcatPart
        }
      }
    }
    
    return formatted
  }

  // Format asset tag as user types (legacy function, kept for compatibility)
  const formatAssetTag = (value: string): string => {
    // Remove all non-alphanumeric characters except hyphens
    let cleaned = value.replace(/[^A-Za-z0-9-]/g, '').toUpperCase()
    
    // Remove existing hyphens to rebuild format
    const parts = cleaned.split('-').filter(p => p.length > 0)
    cleaned = parts.join('')
    
    // Format: YY-XXXXXX[S]-SA
    // Max length: 2 (year) + 6 (random) + 1 (subcategory) + 2 (SA) = 11 chars + 2 hyphens = 13
    if (cleaned.length === 0) return ''
    
    let formatted = ''
    
    // Year (first 2 digits)
    if (cleaned.length > 0) {
      formatted = cleaned.substring(0, 2)
      if (cleaned.length > 2) {
        formatted += '-'
        // Random number (next 6 digits)
        const randomPart = cleaned.substring(2, 8)
        formatted += randomPart
        if (cleaned.length > 8) {
          // Subcategory letter (next 1 character)
          const subcatPart = cleaned.substring(8, 9)
          formatted += subcatPart
          if (cleaned.length > 9) {
            formatted += '-'
            // SA (last 2 characters)
            const saPart = cleaned.substring(9, 11)
            formatted += saPart
          }
        }
      }
    }
    
    return formatted
  }

  // Initialize companySuffix when asset loads
  useEffect(() => {
    if (asset?.assetTagId) {
      const suffix = extractSuffix(asset.assetTagId)
      setCompanySuffix(suffix)
    }
  }, [asset?.assetTagId])

  const handleGenerateAssetTag = async () => {
    setIsGeneratingTag(true)
    try {
      // Check if subcategory is selected
      const subCategoryId = form.getValues("subCategoryId")
      if (!subCategoryId) {
        toast.error('Please select a subcategory first')
        setIsGeneratingTag(false)
        return
      }

      // Fetch subcategory to get the letter
      const subCategory = subCategories.find(sc => sc.id === subCategoryId)
      if (!subCategory) {
        toast.error('Subcategory not found')
        setIsGeneratingTag(false)
        return
      }

      // Get the first letter of the subcategory name
      const subCategoryLetter = subCategory.name.charAt(0).toUpperCase()

      // Generate random 6-digit number
      const randomNum = Math.floor(100000 + Math.random() * 900000).toString()

      // Get current year (last 2 digits)
      const year = new Date().getFullYear().toString().slice(-2)

      // Format: YY-XXXXXX[S]-SA
      const generatedTag = `${year}-${randomNum}${subCategoryLetter}-SA`

      // Extract and store the company suffix
      const suffix = extractSuffix(generatedTag)
      setCompanySuffix(suffix)

      // Check if tag already exists
      const exists = await checkAssetTagExists(generatedTag)
      if (exists) {
        // Retry once
        const retryRandomNum = Math.floor(100000 + Math.random() * 900000).toString()
        const retryTag = `${year}-${retryRandomNum}${subCategoryLetter}-SA`
        const retrySuffix = extractSuffix(retryTag)
        setCompanySuffix(retrySuffix)
        const retryExists = await checkAssetTagExists(retryTag)
        if (retryExists) {
          toast.error('Failed to generate unique tag. Please try again.')
          setIsGeneratingTag(false)
          return
        }
        form.setValue("assetTagId", retryTag, { shouldValidate: true, shouldDirty: true })
      } else {
        form.setValue("assetTagId", generatedTag, { shouldValidate: true, shouldDirty: true })
      }

      // Focus the input
      setTimeout(() => {
        assetTagIdInputRef.current?.focus()
      }, 0)
    } catch {
      toast.error('Failed to generate asset tag')
    } finally {
      setIsGeneratingTag(false)
    }
  }

  const form = useForm<EditAssetFormData>({
    resolver: zodResolver(editAssetSchema),
    defaultValues: {
      assetTagId: "",
      description: "",
      brand: "",
      model: "",
      serialNo: "",
      cost: "",
      assetType: "",
      location: "",
      department: "",
      site: "",
      owner: "",
      issuedTo: "",
      purchasedFrom: "",
      purchaseDate: "",
      poNumber: "",
      xeroAssetNo: "",
      remarks: "",
      additionalInformation: "",
      categoryId: "",
      subCategoryId: "",
      qr: "",
      oldAssetTag: "",
      deliveryDate: "",
      pbiNumber: "",
      paymentVoucherNumber: "",
      depreciableAsset: false,
      depreciableCost: "",
      salvageValue: "",
      assetLifeMonths: "",
      depreciationMethod: "",
      dateAcquired: "",
      unaccountedInventory: false,
    },
  })

  // Populate form when asset data is loaded
  // Don't wait for categories to be loaded - set values directly from asset data
  useEffect(() => {
    if (asset && !assetLoading) {
      const resetData = {
        assetTagId: asset.assetTagId || "",
        description: asset.description || "",
        brand: asset.brand || "",
        model: asset.model || "",
        serialNo: asset.serialNo || "",
        cost: asset.cost?.toString() || "",
        assetType: asset.assetType || "",
        location: asset.location || "",
        department: asset.department || "",
        site: asset.site || "",
        owner: asset.owner || "",
        issuedTo: asset.issuedTo || "",
        purchasedFrom: asset.purchasedFrom || "",
        purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : "",
        poNumber: asset.poNumber || "",
        xeroAssetNo: asset.xeroAssetNo || "",
        remarks: asset.remarks || "",
        additionalInformation: asset.additionalInformation || "",
        categoryId: asset.categoryId || "",
        subCategoryId: asset.subCategoryId || "",
        qr: asset.qr ? (asset.qr.trim().toUpperCase() === "YES" ? "YES" : asset.qr.trim().toUpperCase() === "NO" ? "NO" : "") : "",
        oldAssetTag: asset.oldAssetTag || "",
        deliveryDate: asset.deliveryDate ? new Date(asset.deliveryDate).toISOString().split('T')[0] : "",
        pbiNumber: asset.pbiNumber || "",
        paymentVoucherNumber: asset.paymentVoucherNumber || "",
        depreciableAsset: asset.depreciableAsset || false,
        depreciableCost: asset.depreciableCost?.toString() || "",
        salvageValue: asset.salvageValue?.toString() || "",
        assetLifeMonths: asset.assetLifeMonths?.toString() || "",
        depreciationMethod: asset.depreciationMethod || "",
        dateAcquired: asset.dateAcquired ? new Date(asset.dateAcquired).toISOString().split('T')[0] : "",
        unaccountedInventory: asset.unaccountedInventory || false,
      }
      form.reset(resetData)
    }
  }, [asset, assetLoading, form])

  // Create object URLs for selected images and documents
  const selectedImageUrls = useMemo(() => {
    return selectedImages.map(file => URL.createObjectURL(file))
  }, [selectedImages])

  const selectedDocumentUrls = useMemo(() => {
    return selectedDocuments.map(file => URL.createObjectURL(file))
  }, [selectedDocuments])

  // Cleanup object URLs when component unmounts
  useEffect(() => {
    return () => {
      selectedImageUrls.forEach(url => URL.revokeObjectURL(url))
      selectedDocumentUrls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [selectedImageUrls, selectedDocumentUrls])

  // Watch categoryId to sync with selectedCategory state
  // Fetch subcategories when dropdown is opened OR when category is selected (to display selected value)
  const categoryId = form.watch("categoryId")
  const subCategoryId = form.watch("subCategoryId")
  const selectedCategory = categoryId || ""
  // Fetch subcategories if: dropdown is open OR category is selected (to show selected subcategory name)
  const shouldFetchSubCategories = (isSubCategoryDropdownOpen || (selectedCategory && subCategoryId)) && selectedCategory
  const { data: subCategories = [], isLoading: subCategoriesLoading, error: subCategoriesError } = useSubCategories(
    shouldFetchSubCategories ? selectedCategory : null
  )

  // Reset subcategory when category changes
  const handleCategoryChange = (value: string) => {
    form.setValue("categoryId", value)
    form.setValue("subCategoryId", "")
  }

  const handleCreateCategory = async (data: { name: string; description?: string }) => {
    if (!canManageSetup) {
      toast.error('You do not have permission to manage categories')
      return
    }

    try {
      const result = await createCategoryMutation.mutateAsync(data)
      // Auto-select the newly created category
      if (result?.category?.id) {
        form.setValue("categoryId", result.category.id, { shouldValidate: true, shouldDirty: true })
        // Reset subcategory when category changes
        form.setValue("subCategoryId", "", { shouldValidate: true, shouldDirty: true })
      }
      setCategoryDialogOpen(false)
      toast.success('Category created successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create category')
    }
  }

  const handleCreateSubCategory = async (data: { name: string; description?: string; categoryId: string }) => {
    if (!canManageSetup) {
      toast.error('You do not have permission to manage categories')
      return
    }

    if (!selectedCategory) {
      toast.error('Please select a category first')
      return
    }

    try {
      const result = await createSubCategoryMutation.mutateAsync({
        ...data,
        categoryId: selectedCategory,
      })
      // Invalidate and refetch subcategories for the selected category
      await queryClient.invalidateQueries({ queryKey: ["subcategories", selectedCategory] })
      await queryClient.refetchQueries({ queryKey: ["subcategories", selectedCategory] })
      // Auto-select the newly created subcategory
      if (result?.subcategory?.id) {
        form.setValue("subCategoryId", result.subcategory.id, { shouldValidate: true, shouldDirty: true })
      }
      setSubCategoryDialogOpen(false)
      toast.success('Sub category created successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create subcategory')
    }
  }

  const uploadImage = async (file: File, assetTagId: string, onProgress?: (progress: number) => void): Promise<void> => {
    const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
      ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
      : ''
    const url = `${baseUrl}/api/assets/upload-image`
    
    // Get auth token for FastAPI
    let authToken: string | null = null
    if (baseUrl) {
      const { createClient } = await import('@/lib/supabase-client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      authToken = session?.access_token || null
    }
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const formData = new FormData()
      formData.append('file', file)
      formData.append('assetTagId', assetTagId)

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const percentComplete = (e.loaded / e.total) * 100
          onProgress(percentComplete)
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          try {
            const error = JSON.parse(xhr.responseText)
            reject(new Error(error.error || 'Failed to upload image'))
          } catch {
            reject(new Error('Failed to upload image'))
          }
        }
      })

      xhr.addEventListener('error', () => {
        reject(new Error('Failed to upload image'))
      })

      if (authToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${authToken}`)
      }
      
      xhr.open('POST', url)
      xhr.send(formData)
    })
  }

  // Link an existing image URL to an asset
  const linkExistingImage = async (imageUrl: string, assetTagId: string): Promise<void> => {
    const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
      ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
      : ''
    const url = `${baseUrl}/api/assets/upload-image`
    
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
        imageUrl,
        assetTagId,
        linkExisting: true,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to link image')
    }
  }

  const uploadDocument = async (file: File, assetTagId: string, onProgress?: (progress: number) => void): Promise<void> => {
    const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
      ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
      : ''
    const url = `${baseUrl}/api/assets/upload-document`
    
    // Get auth token for FastAPI
    let authToken: string | null = null
    if (baseUrl) {
      const { createClient } = await import('@/lib/supabase-client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      authToken = session?.access_token || null
    }
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const formData = new FormData()
      formData.append('file', file)
      formData.append('assetTagId', assetTagId)

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const percentComplete = (e.loaded / e.total) * 100
          onProgress(percentComplete)
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          try {
            const error = JSON.parse(xhr.responseText)
            reject(new Error(error.error || 'Failed to upload document'))
          } catch {
            reject(new Error('Failed to upload document'))
          }
        }
      })

      xhr.addEventListener('error', () => {
        reject(new Error('Network error while uploading document'))
      })

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload aborted'))
      })

      if (authToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${authToken}`)
      }
      
      xhr.open('POST', url)
      xhr.send(formData)
    })
  }

  // Link an existing document URL to an asset
  const linkExistingDocument = async (documentUrl: string, assetTagId: string): Promise<void> => {
    const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
      ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
      : ''
    const url = `${baseUrl}/api/assets/upload-document`
    
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
        documentUrl,
        assetTagId,
        linkExisting: true,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to link document')
    }
  }

  // Delete image function
  const handleDeleteImageClick = (imageId: string) => {
    setImageToDelete(imageId)
    setIsDeleteImageDialogOpen(true)
  }

  const deleteExistingImage = async () => {
    if (!imageToDelete) return

    setIsDeletingImage(true)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
        ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
        : ''
      const url = `${baseUrl}/api/assets/images/delete/${imageToDelete}`
      
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
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['assets', 'images', asset?.assetTagId] })
        queryClient.invalidateQueries({ queryKey: ['assets'] })
        queryClient.invalidateQueries({ queryKey: ['assets-list'] })
        queryClient.invalidateQueries({ queryKey: ['assets', 'media'] })
        toast.success('Image deleted successfully')
        setIsDeleteImageDialogOpen(false)
        setImageToDelete(null)
      } else {
        const errorData = await response.json().catch(() => ({}))
        if (response.status === 404) {
          queryClient.invalidateQueries({ queryKey: ['assets', 'images', asset?.assetTagId] })
          queryClient.invalidateQueries({ queryKey: ['assets'] })
          queryClient.invalidateQueries({ queryKey: ['assets-list'] })
          queryClient.invalidateQueries({ queryKey: ['assets', 'media'] })
          toast.success('Image removed')
        } else {
          toast.error(errorData.error || 'Failed to delete image')
        }
        setIsDeleteImageDialogOpen(false)
        setImageToDelete(null)
      }
    } catch (error) {
      console.error('Error deleting image:', error)
      toast.error('Failed to delete image')
      setIsDeleteImageDialogOpen(false)
      setImageToDelete(null)
    } finally {
      setIsDeletingImage(false)
    }
  }

  // Delete document function
  const handleDeleteDocumentClick = (documentId: string) => {
    setDocumentToDelete(documentId)
    setIsDeleteDocumentDialogOpen(true)
  }

  const deleteExistingDocument = async () => {
    if (!documentToDelete) return

    setIsDeletingDocument(true)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
        ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
        : ''
      const url = `${baseUrl}/api/assets/documents/delete/${documentToDelete}`
      
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
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['assets', 'documents', asset?.assetTagId] })
        queryClient.invalidateQueries({ queryKey: ['assets'] })
        queryClient.invalidateQueries({ queryKey: ['assets-list'] })
        queryClient.invalidateQueries({ queryKey: ['assets', 'documents'] })
        toast.success('Document deleted successfully')
        setIsDeleteDocumentDialogOpen(false)
        setDocumentToDelete(null)
      } else {
        const errorData = await response.json().catch(() => ({}))
        if (response.status === 404) {
          queryClient.invalidateQueries({ queryKey: ['assets', 'documents', asset?.assetTagId] })
          queryClient.invalidateQueries({ queryKey: ['assets'] })
          queryClient.invalidateQueries({ queryKey: ['assets-list'] })
          queryClient.invalidateQueries({ queryKey: ['assets', 'documents'] })
          toast.success('Document removed')
        } else {
          toast.error(errorData.error || 'Failed to delete document')
        }
        setIsDeleteDocumentDialogOpen(false)
        setDocumentToDelete(null)
      }
    } catch (error) {
      console.error('Error deleting document:', error)
      toast.error('Failed to delete document')
      setIsDeleteDocumentDialogOpen(false)
      setDocumentToDelete(null)
    } finally {
      setIsDeletingDocument(false)
    }
  }

  // Delete maintenance function using FastAPI hook
  const deleteMaintenance = async () => {
    if (!maintenanceToDelete) return

    setIsDeletingMaintenance(true)
    try {
      await deleteMaintenanceMutation.mutateAsync(maintenanceToDelete)
      queryClient.invalidateQueries({ queryKey: ['asset-maintenance', resolvedParams.assetTagId] })
      toast.success('Maintenance record deleted successfully')
      setIsDeleteMaintenanceDialogOpen(false)
      setMaintenanceToDelete(null)
    } catch (error) {
      console.error('Error deleting maintenance:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete maintenance record')
      setIsDeleteMaintenanceDialogOpen(false)
      setMaintenanceToDelete(null)
    } finally {
      setIsDeletingMaintenance(false)
    }
  }

  // Delete reservation function
  const deleteReservation = async () => {
    if (!reservationToDelete) return

    setIsDeletingReservation(true)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
        ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
        : ''
      const url = `${baseUrl}/api/assets/reserve/${reservationToDelete}`
      
      // Get auth token
      const { createClient } = await import('@/lib/supabase-client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = {}
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      
      const response = await fetch(url, {
        method: 'DELETE',
        credentials: 'include',
        headers,
      })
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['asset-reserve', resolvedParams.assetTagId] })
        toast.success('Reservation deleted successfully')
        setIsDeleteReservationDialogOpen(false)
        setReservationToDelete(null)
      } else {
        const errorData = await response.json().catch(() => ({}))
        toast.error(errorData.error || 'Failed to delete reservation')
        setIsDeleteReservationDialogOpen(false)
        setReservationToDelete(null)
      }
    } catch (error) {
      console.error('Error deleting reservation:', error)
      toast.error('Failed to delete reservation')
      setIsDeleteReservationDialogOpen(false)
      setReservationToDelete(null)
    } finally {
      setIsDeletingReservation(false)
    }
  }

  // Delete audit function
  const deleteAudit = async () => {
    if (!auditToDelete) return

    setIsDeletingAudit(true)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
        ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
        : ''
      const url = `${baseUrl}/api/assets/audit/${auditToDelete}`
      
      // Get auth token
      const { createClient } = await import('@/lib/supabase-client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = {}
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      
      const response = await fetch(url, {
        method: 'DELETE',
        credentials: 'include',
        headers,
      })
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['asset', resolvedParams.assetTagId] })
        queryClient.invalidateQueries({ queryKey: ['asset-details', resolvedParams.assetTagId] })
        toast.success('Audit record deleted successfully')
        setIsDeleteAuditDialogOpen(false)
        setAuditToDelete(null)
      } else {
        const errorData = await response.json().catch(() => ({}))
        toast.error(errorData.error || 'Failed to delete audit record')
        setIsDeleteAuditDialogOpen(false)
        setAuditToDelete(null)
      }
    } catch (error) {
      console.error('Error deleting audit:', error)
      toast.error('Failed to delete audit record')
      setIsDeleteAuditDialogOpen(false)
      setAuditToDelete(null)
    } finally {
      setIsDeletingAudit(false)
    }
  }

  // Delete history log function
  const deleteHistoryLog = async () => {
    if (!historyLogToDelete) return

    setIsDeletingHistory(true)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
        ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
        : ''
      const url = `${baseUrl}/api/assets/history/${historyLogToDelete}`
      
      // Get auth token
      const { createClient } = await import('@/lib/supabase-client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = {}
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      
      const response = await fetch(url, {
        method: 'DELETE',
        credentials: 'include',
        headers,
      })
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['asset-history', resolvedParams.assetTagId] })
        toast.success('History log deleted successfully')
        setIsDeleteHistoryDialogOpen(false)
        setHistoryLogToDelete(null)
      } else {
        const errorData = await response.json().catch(() => ({}))
        toast.error(errorData.error || 'Failed to delete history log')
        setIsDeleteHistoryDialogOpen(false)
        setHistoryLogToDelete(null)
      }
    } catch (error) {
      console.error('Error deleting history log:', error)
      toast.error('Failed to delete history log')
      setIsDeleteHistoryDialogOpen(false)
      setHistoryLogToDelete(null)
    } finally {
      setIsDeletingHistory(false)
    }
  }

  // Check if asset tag exists using FastAPI
  const checkAssetTagExists = async (assetTag: string): Promise<boolean> => {
    try {
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/assets?search=${encodeURIComponent(assetTag)}&pageSize=10`
      
      const token = await getAuthToken()
      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(url, {
        credentials: 'include',
        headers,
      })
      if (!response.ok) return false
      const data = await response.json()
      return data.assets?.some((a: { assetTagId: string; id: string }) => a.assetTagId === assetTag && a.id !== resolvedParams.assetTagId) || false
    } catch {
      return false
    }
  }

  const onSubmit = async (data: EditAssetFormData) => {
    if (!canEditAssets) {
      toast.error('You do not have permission to edit assets')
      return
    }

    // Final uniqueness check if asset tag changed
    if (data.assetTagId !== asset?.assetTagId) {
      setIsCheckingAssetTag(true)
      const exists = await checkAssetTagExists(data.assetTagId)
      setIsCheckingAssetTag(false)
      if (exists) {
        form.setError('assetTagId', {
          type: 'manual',
          message: 'This Asset Tag ID already exists',
        })
        toast.error('This Asset Tag ID already exists')
        return
      }
    }

    try {
      const updateData = {
        assetTagId: data.assetTagId.trim(),
        description: data.description,
        brand: data.brand || null,
        model: data.model || null,
        serialNo: data.serialNo || null,
        cost: data.cost ? parseFloat(data.cost) : null,
        assetType: data.assetType || null,
        location: data.location || null,
        department: data.department || null,
        site: data.site || null,
        owner: data.owner || null,
        issuedTo: data.issuedTo || null,
        purchasedFrom: data.purchasedFrom || null,
        purchaseDate: data.purchaseDate || null,
        poNumber: data.poNumber || null,
        xeroAssetNo: data.xeroAssetNo || null,
        remarks: data.remarks || null,
        additionalInformation: data.additionalInformation || null,
        categoryId: data.categoryId || null,
        subCategoryId: data.subCategoryId || null,
        qr: data.qr || null,
        oldAssetTag: data.oldAssetTag || null,
        deliveryDate: data.deliveryDate || null,
        pbiNumber: data.pbiNumber || null,
        paymentVoucherNumber: data.paymentVoucherNumber || null,
        depreciableAsset: data.depreciableAsset || false,
        depreciableCost: data.depreciableCost ? parseFloat(data.depreciableCost) : null,
        salvageValue: data.salvageValue ? parseFloat(data.salvageValue) : null,
        assetLifeMonths: data.assetLifeMonths ? parseInt(data.assetLifeMonths) : null,
        depreciationMethod: data.depreciationMethod || null,
        dateAcquired: data.dateAcquired || null,
        unaccountedInventory: data.unaccountedInventory || false,
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updatedAsset = await updateAssetMutation.mutateAsync({ id: resolvedParams.assetTagId, ...updateData as any })
      // Trigger additional cache invalidation for images/documents
      await handleUpdateSuccess(updatedAsset)

      // Upload images and link existing images after asset is updated
      const totalImages = selectedImages.length + selectedExistingImages.length
      const totalDocuments = selectedDocuments.length + selectedExistingDocuments.length
      
      if (totalImages > 0 && data.assetTagId) {
        setUploadingImages(true)
        setUploadProgress(0)
        try {
          if (selectedImages.length > 0) {
            const totalNewImages = selectedImages.length
            let uploadedCount = 0

            for (let i = 0; i < selectedImages.length; i++) {
              await uploadImage(selectedImages[i], data.assetTagId, (progress) => {
                const overallProgress = ((uploadedCount + progress / 100) / totalNewImages) * 100
                setUploadProgress(Math.min(overallProgress, 100))
              })
              uploadedCount++
              setUploadProgress((uploadedCount / totalNewImages) * 100)
            }
          }

          if (selectedExistingImages.length > 0) {
            await Promise.all(
              selectedExistingImages.map(img => linkExistingImage(img.imageUrl, data.assetTagId))
            )
          }
          
          // Invalidate images query after upload/link
          queryClient.invalidateQueries({ queryKey: ['assets', 'images', data.assetTagId] })
        } catch (error) {
          console.error('Error uploading/linking images:', error)
          toast.error('Asset updated but some images failed to upload/link')
          setUploadProgress(0)
        } finally {
          setUploadingImages(false)
        }
      }

      // Upload documents and link existing documents after asset is updated
      if (totalDocuments > 0 && data.assetTagId) {
        setUploadingDocuments(true)
        setDocumentUploadProgress(0)
        try {
          if (selectedDocuments.length > 0) {
            const totalNewDocuments = selectedDocuments.length
            let uploadedCount = 0

            for (let i = 0; i < selectedDocuments.length; i++) {
              await uploadDocument(selectedDocuments[i], data.assetTagId, (progress) => {
                const overallProgress = ((uploadedCount + progress / 100) / totalNewDocuments) * 100
                setDocumentUploadProgress(Math.min(overallProgress, 100))
              })
              uploadedCount++
              setDocumentUploadProgress((uploadedCount / totalNewDocuments) * 100)
            }
          }

          if (selectedExistingDocuments.length > 0) {
            await Promise.all(
              selectedExistingDocuments.map(doc => linkExistingDocument(doc.documentUrl, data.assetTagId))
            )
          }
          
          // Invalidate documents query after upload/link
          queryClient.invalidateQueries({ queryKey: ['assets', 'documents', data.assetTagId] })
        } catch (error) {
          console.error('Error uploading/linking documents:', error)
          toast.error('Asset updated but some documents failed to upload/link')
          setDocumentUploadProgress(0)
        } finally {
          setUploadingDocuments(false)
        }
      }

      // Show success message
      if (totalImages > 0 || totalDocuments > 0) {
        const parts: string[] = []
        if (totalImages > 0) parts.push(`${totalImages} image${totalImages !== 1 ? 's' : ''}`)
        if (totalDocuments > 0) parts.push(`${totalDocuments} document${totalDocuments !== 1 ? 's' : ''}`)
        toast.success(`Asset updated successfully with ${parts.join(' and ')}`)
      } else {
        toast.success('Asset updated successfully')
      }

      // Invalidate ALL assets queries (including paginated/filtered ones)
      // Use predicate to match all queries starting with 'assets' or 'assets-list'
      // This marks them as stale so they will refetch when the page loads
      await queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey
          return Array.isArray(key) && (
            key[0] === 'assets' || 
            key[0] === 'assets-list'
          )
        },
        refetchType: 'active' // Refetch active queries immediately
      })
      
      // Remove cached data to force fresh fetch
      queryClient.removeQueries({
        predicate: (query) => {
          const key = query.queryKey
          return Array.isArray(key) && (
            key[0] === 'assets' || 
            key[0] === 'assets-list'
          )
        }
      })

      router.push("/assets")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update asset')
    }
  }

  // Track form changes to show floating buttons
  // Use React Hook Form's built-in isDirty state combined with file selections
  const isFormDirty = useMemo(() => {
    if (!asset) return false
    
    // Check if form is dirty using React Hook Form's built-in state
    const formIsDirty = form.formState.isDirty
    
    // Check if there are pending file uploads/selections
    const hasPendingFiles = selectedImages.length > 0 ||
      selectedDocuments.length > 0 ||
      selectedExistingImages.length > 0 ||
      selectedExistingDocuments.length > 0
    
    return formIsDirty || hasPendingFiles
  }, [form.formState.isDirty, asset, selectedImages.length, selectedDocuments.length, selectedExistingImages.length, selectedExistingDocuments.length])

  // Clear form function - reset to original asset values
  const clearForm = () => {
    if (asset) {
      const resetData = {
        assetTagId: asset.assetTagId || "",
        description: asset.description || "",
        brand: asset.brand || "",
        model: asset.model || "",
        serialNo: asset.serialNo || "",
        cost: asset.cost?.toString() || "",
        assetType: asset.assetType || "",
        location: asset.location || "",
        department: asset.department || "",
        site: asset.site || "",
        owner: asset.owner || "",
        issuedTo: asset.issuedTo || "",
        purchasedFrom: asset.purchasedFrom || "",
        purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : "",
        poNumber: asset.poNumber || "",
        xeroAssetNo: asset.xeroAssetNo || "",
        remarks: asset.remarks || "",
        additionalInformation: asset.additionalInformation || "",
        categoryId: asset.categoryId || "",
        subCategoryId: asset.subCategoryId || "",
        qr: asset.qr ? (asset.qr.trim().toUpperCase() === "YES" ? "YES" : asset.qr.trim().toUpperCase() === "NO" ? "NO" : "") : "",
        oldAssetTag: asset.oldAssetTag || "",
        deliveryDate: asset.deliveryDate ? new Date(asset.deliveryDate).toISOString().split('T')[0] : "",
        pbiNumber: asset.pbiNumber || "",
        paymentVoucherNumber: asset.paymentVoucherNumber || "",
        depreciableAsset: asset.depreciableAsset || false,
        depreciableCost: asset.depreciableCost?.toString() || "",
        salvageValue: asset.salvageValue?.toString() || "",
        assetLifeMonths: asset.assetLifeMonths?.toString() || "",
        depreciationMethod: asset.depreciationMethod || "",
        dateAcquired: asset.dateAcquired ? new Date(asset.dateAcquired).toISOString().split('T')[0] : "",
        unaccountedInventory: asset.unaccountedInventory || false,
      }
      form.reset(resetData)
      
      // Clear any pending file selections
      setSelectedImages([])
      setSelectedDocuments([])
      setSelectedExistingImages([])
      setSelectedExistingDocuments([])
    }
  }

  // Show loading state while permissions or asset are being fetched
  if (permissionsLoading || assetLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Spinner className="h-6 w-6" />
        <p className="text-sm text-muted-foreground">Loading asset details...</p>
      </div>
    )
  }

  // Show error state
  if (assetError || !asset) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex flex-col items-center gap-4 max-w-md">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Asset Not Found</h2>
            <p className="text-muted-foreground mt-2">
              The asset you&apos;re looking for doesn&apos;t exist or has been deleted.
            </p>
          </div>
          <Link href="/assets" className="hidden md:block">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Assets
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Show access denied only after permissions have loaded
  if (!canEditAssets) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex flex-col items-center gap-4 max-w-md">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Sparkles className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Access Denied</h2>
            <p className="text-muted-foreground mt-2">
              You do not have permission to edit assets. Please contact your administrator if you need access.
            </p>
          </div>
          <Link href="/assets" className="hidden md:block">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Assets
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Format utilities for display
  const formatDate = (dateString: string | Date | null | undefined) => {
    if (!dateString) return 'N/A'
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
      })
    } catch {
      return String(dateString)
    }
  }

  const formatCurrency = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return 'N/A'
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(Number(value))
  }

  const getTimeAgo = (date: Date): string => {
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

  // Get assigned to user from active checkout or active reservation
  const activeCheckout = asset?.checkouts?.find(
    (checkout) => {
      const checkinsCount = checkout.checkins?.length ?? 0
      return checkinsCount === 0
    }
  )
  
  // Get active reservation (first one since it's already sorted by date desc and filtered by status=Active)
  const activeReservation = asset?.reservations?.[0]
  
  // Determine assigned to display value
  const getAssignedToDisplay = () => {
    // If there's an active checkout with employee, show the employee name
    if (activeCheckout?.employeeUser?.name?.trim()) {
      return activeCheckout.employeeUser.name
    }
    
    // If asset is reserved and there's an active reservation
    if (asset?.status?.toLowerCase() === 'reserved' && activeReservation) {
      if (activeReservation.reservationType === 'Employee' && activeReservation.employeeUser?.name) {
        return `Reserved for ${activeReservation.employeeUser.name}`
      }
      if (activeReservation.reservationType === 'Department' && activeReservation.department) {
        return `Reserved for ${activeReservation.department}`
      }
    }
    
    return 'N/A'
  }
  
  const assignedToUser = getAssignedToDisplay()

  // Get status badge
  const getStatusBadge = (status: string | null | undefined) => {
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
    } else if (statusLC === 'reserved') {
      statusVariant = 'secondary'
      statusColor = 'bg-yellow-500'
    } else if (statusLC === 'sold') {
      statusVariant = 'default'
      statusColor = 'bg-teal-500 text-white border-0'
    } else if (statusLC === 'donated') {
      statusVariant = 'default'
      statusColor = 'bg-blue-500 text-white border-0'
    } else if (statusLC === 'scrapped') {
      statusVariant = 'default'
      statusColor = 'bg-orange-500 text-white border-0'
    } else if (statusLC === 'lost/missing' || statusLC.replace(/\s+/g, '').replace('/', '').toLowerCase() === 'lostmissing') {
      statusVariant = 'default'
      statusColor = 'bg-yellow-500 text-white border-0'
    } else if (statusLC === 'destroyed') {
      statusVariant = 'default'
      statusColor = 'bg-red-500 text-white border-0'
    }
    
    return <Badge variant={statusVariant} className={statusColor}>{status}</Badge>
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`space-y-6 ${isFormDirty ? 'pb-16' : ''}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Edit Asset</h1>
          <p className="text-muted-foreground">
            Update asset details and information
          </p>
        </div>
        <Link href="/assets" className="hidden md:block">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Assets
          </Button>
        </Link>
      </div>

      {/* Top Section with Thumbnail and Key Fields */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 border rounded-lg p-4 bg-card">
        {/* Thumbnail Image */}
        <div className="lg:col-span-1">
          <div className="relative w-full aspect-square lg:h-full bg-muted rounded-lg overflow-hidden flex items-center justify-center">
            {thumbnailImage ? (
              <Image
                src={thumbnailImage.imageUrl}
                alt={asset?.assetTagId || 'Asset'}
                fill
                className="object-contain p-2"
                unoptimized
                loading="eager"
                priority
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <ImageIcon className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
          </div>
        </div>

        {/* Key Fields */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="border-b pb-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Asset Tag ID</p>
            <p className="text-sm font-medium">{asset?.assetTagId || 'N/A'}</p>
          </div>
          <div className="border-b pb-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Purchase Date</p>
            <p className="text-sm">{formatDate(asset?.purchaseDate || null)}</p>
          </div>
          <div className="border-b pb-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Cost</p>
            <p className="text-sm">{formatCurrency(asset?.cost)}</p>
          </div>
          <div className="border-b pb-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Brand</p>
            <p className="text-sm">{asset?.brand || 'N/A'}</p>
          </div>
          <div className="border-b pb-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Model</p>
            <p className="text-sm">{asset?.model || 'N/A'}</p>
          </div>
          <div className="border-b pb-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Site</p>
            <p className="text-sm">{asset?.site || 'N/A'}</p>
          </div>
          <div className="border-b pb-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Location</p>
            <p className="text-sm">{asset?.location || 'N/A'}</p>
          </div>
          <div className="border-b pb-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Category</p>
            <p className="text-sm">{asset?.category?.name || 'N/A'}</p>
          </div>
          <div className="border-b pb-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Department</p>
            <p className="text-sm">{asset?.department || 'N/A'}</p>
          </div>
          <div className="border-b pb-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Assigned To</p>
            <p className="text-sm">{assignedToUser}</p>
          </div>
          <div className="border-b pb-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Status</p>
            <div className="flex items-center">
              {getStatusBadge(asset?.status) || <span className="text-sm">N/A</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <ScrollArea className="w-full border-b">
        <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
            onClick={() => handleTabChange('details')}
          className={`px-4 py-2 h-auto text-sm font-medium transition-colors border-b-2 rounded-none ${
              activeTab === 'details'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
            Details
        </Button>
        <Button
          type="button"
          variant="ghost"
            onClick={() => handleTabChange('photos')}
          className={`px-4 py-2 h-auto text-sm font-medium transition-colors border-b-2 rounded-none ${
              activeTab === 'photos'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
            Photos
        </Button>
        <Button
          type="button"
          variant="ghost"
            onClick={() => handleTabChange('docs')}
          className={`px-4 py-2 h-auto text-sm font-medium transition-colors border-b-2 rounded-none ${
              activeTab === 'docs'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
            Docs
        </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleTabChange('depreciation')}
            className={`px-4 py-2 h-auto text-sm font-medium transition-colors border-b-2 rounded-none ${
              activeTab === 'depreciation'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Depreciation
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleTabChange('maintenance')}
            className={`px-4 py-2 h-auto text-sm font-medium transition-colors border-b-2 rounded-none ${
              activeTab === 'maintenance'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Maintenance
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleTabChange('reserve')}
            className={`px-4 py-2 h-auto text-sm font-medium transition-colors border-b-2 rounded-none ${
              activeTab === 'reserve'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Reserve
          </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => handleTabChange('audit')}
          className={`px-4 py-2 h-auto text-sm font-medium transition-colors border-b-2 rounded-none ${
            activeTab === 'audit'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
            Audit
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleTabChange('history')}
            className={`px-4 py-2 h-auto text-sm font-medium transition-colors border-b-2 rounded-none ${
              activeTab === 'history'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            History
        </Button>
      </div>
      <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Tab Content */}
      <div className="min-h-[400px]">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <div className="grid gap-2.5 md:grid-cols-2">
          <AnimatePresence>
          {/* Details Tab - Basic Information & Asset Details */}
          {activeTab === 'details' && (
          <motion.div
            key="details"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="md:col-span-2"
          >
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Basic Information & Asset Details</CardTitle>
              <CardDescription className="text-xs">
                Essential asset information and specifications
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                <Field>
                    <FieldLabel htmlFor="assetTagId">
                      Asset Tag ID <span className="text-destructive">*</span>
                    </FieldLabel>
                    <FieldContent>
                      <div className="flex gap-2">
                        <div className="flex items-center border border-input rounded-md overflow-hidden flex-1">
                          <Controller
                            name="assetTagId"
                            control={form.control}
                            render={({ field }) => {
                              const displayValue = extractMainPart(field.value || "")
                              return (
                                <Input
                                  id="assetTagId"
                                  value={displayValue}
                                  onChange={(e) => {
                                    const input = e.target as HTMLInputElement
                                    const cursorPosition = input.selectionStart || 0
                                    const currentMainPart = displayValue
                                    const newValue = e.target.value
                                    
                                    // Format only the main part
                                    const formattedMainPart = formatAssetTagMainPart(newValue)
                                    
                                    // Calculate new cursor position
                                    const beforeCursor = currentMainPart.substring(0, cursorPosition)
                                    const nonFormattingBefore = beforeCursor.replace(/-/g, '').length
                                    
                                    let newCursorPosition = 0
                                    let nonFormattingCount = 0
                                    for (let i = 0; i < formattedMainPart.length; i++) {
                                      if (formattedMainPart[i] !== '-') {
                                        nonFormattingCount++
                                        if (nonFormattingCount > nonFormattingBefore) {
                                          newCursorPosition = i
                                          break
                                        }
                                      }
                                      if (nonFormattingCount === nonFormattingBefore) {
                                        newCursorPosition = i + 1
                                        break
                                      }
                                    }
                                    
                                    // Combine main part with suffix for form value
                                    const fullTag = companySuffix 
                                      ? `${formattedMainPart}-${companySuffix}`
                                      : formattedMainPart
                                    
                                    // Set the full tag in the form
                                    field.onChange(fullTag)
                                    
                                    // Restore cursor position
                                    setTimeout(() => {
                                      if (assetTagIdInputRef.current) {
                                        assetTagIdInputRef.current.setSelectionRange(
                                          Math.min(newCursorPosition, formattedMainPart.length),
                                          Math.min(newCursorPosition, formattedMainPart.length)
                                        )
                                      }
                                    }, 0)
                                  }}
                                  onBlur={field.onBlur}
                                  ref={(e) => {
                                    assetTagIdInputRef.current = e
                                    field.ref(e)
                                  }}
                                  aria-invalid={form.formState.errors.assetTagId ? "true" : "false"}
                                  placeholder="e.g., 25-016011C"
                                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none rounded-r-none bg-transparent dark:bg-input/30"
                                  maxLength={10}
                                />
                              )
                            }}
                          />
                          {companySuffix && (
                            <span className="px-2 py-2 text-sm font-medium text-muted-foreground border-l border-input bg-muted/50 whitespace-nowrap">
                              -{companySuffix}
                            </span>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleGenerateAssetTag}
                          title="Auto-generate asset tag"
                          className="h-10 w-10 shrink-0 bg-transparent dark:bg-input/30"
                          disabled={isGeneratingTag}
                          size="icon"
                        >
                          {isGeneratingTag ? (
                            <Spinner className="h-4 w-4" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {isCheckingAssetTag && (
                        <p className="text-xs text-muted-foreground">Checking availability...</p>
                      )}
                      {form.formState.errors.assetTagId && (
                        <FieldError>{form.formState.errors.assetTagId.message}</FieldError>
                      )}
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="description">
                      Description <span className="text-destructive">*</span>
                    </FieldLabel>
                    <FieldContent>
                      <Textarea
                        id="description"
                        {...form.register("description")}
                        aria-invalid={form.formState.errors.description ? "true" : "false"}
                        placeholder="Asset description"
                      />
                      {form.formState.errors.description && (
                        <FieldError>{form.formState.errors.description.message}</FieldError>
                      )}
                    </FieldContent>
                  </Field>

                  <Field>
                    <div className="flex items-center justify-between w-full">
                      <FieldLabel htmlFor="category">
                        Category <span className="text-destructive">*</span>
                      </FieldLabel>
                      {canManageSetup && (
                        <>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-6 w-6 bg-transparent dark:bg-input/30"
                            onClick={() => setCategoryDialogOpen(true)}
                          >
                            <PlusIcon className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                    <FieldContent>
                      <Controller
                        name="categoryId"
                        control={form.control}
                        render={({ field }) => (
                      <Select
                            value={field.value || ""}
                            onValueChange={(value) => {
                              field.onChange(value)
                              handleCategoryChange(value)
                            }}
                            open={isCategoryDropdownOpen}
                            onOpenChange={setIsCategoryDropdownOpen}
                            key={`category-${asset?.id || 'new'}-${field.value || ''}`}
                      >
                        <SelectTrigger className="w-full" aria-invalid={form.formState.errors.categoryId ? "true" : "false"}>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories?.map((category: Category) => (
                                <SelectItem key={category.id} value={category.id}>
                                  {category.name}
                                </SelectItem>
                              ))}
                              {isCategoryDropdownOpen && categoriesLoading && !categories.length && (
                                <SelectItem value="loading" disabled>
                                  <div className="flex items-center gap-2">
                                    <Spinner className="h-4 w-4" />
                                    <span>Loading categories...</span>
                                  </div>
                                </SelectItem>
                              )}
                        </SelectContent>
                      </Select>
                        )}
                      />
                      {form.formState.errors.categoryId && (
                        <FieldError>{form.formState.errors.categoryId.message}</FieldError>
                      )}
                    </FieldContent>
                  </Field>

                  <Field>
                    <div className="flex items-center justify-between w-full">
                      <FieldLabel htmlFor="subCategory">
                        Sub Category <span className="text-destructive">*</span>
                      </FieldLabel>
                      {canManageSetup && (
                        <>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            disabled={!selectedCategory}
                            className="h-6 w-6 bg-transparent dark:bg-input/30"
                            onClick={() => setSubCategoryDialogOpen(true)}
                          >
                            <PlusIcon className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                    <FieldContent>
                      <Controller
                        name="subCategoryId"
                        control={form.control}
                        render={({ field }) => (
                      <Select
                            value={field.value || ""}
                            onValueChange={field.onChange}
                        disabled={!selectedCategory}
                        open={isSubCategoryDropdownOpen}
                        onOpenChange={setIsSubCategoryDropdownOpen}
                        key={`subcategory-${asset?.id || 'new'}-${field.value || ''}-${selectedCategory || ''}`}
                      >
                        <SelectTrigger className="w-full" disabled={!selectedCategory} aria-invalid={form.formState.errors.subCategoryId ? "true" : "false"}>
                          <SelectValue 
                            placeholder={
                              selectedCategory 
                                ? "Select a sub category" 
                                : "Select a category first"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {subCategories?.map((subCat: SubCategory) => (
                                <SelectItem key={subCat.id} value={subCat.id}>
                                  {subCat.name}
                                </SelectItem>
                              ))}
                              {isSubCategoryDropdownOpen && selectedCategory && subCategoriesLoading && !subCategories.length && (
                                <SelectItem value="loading" disabled>
                                  <div className="flex items-center gap-2">
                                    <Spinner className="h-4 w-4" />
                                    <span>Loading sub categories...</span>
                                  </div>
                                </SelectItem>
                              )}
                              {isSubCategoryDropdownOpen && selectedCategory && !subCategoriesLoading && subCategories.length === 0 && (
                                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                                  No subcategories available for this category
                                </div>
                              )}
                        </SelectContent>
                      </Select>
                        )}
                      />
                      {form.formState.errors.subCategoryId && (
                        <FieldError>{form.formState.errors.subCategoryId.message}</FieldError>
                      )}
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="brand">
                      Brand <span className="text-destructive">*</span>
                    </FieldLabel>
                    <FieldContent>
                      <Input
                        id="brand"
                        {...form.register("brand")}
                        placeholder="e.g., Dell, HP"
                        aria-invalid={form.formState.errors.brand ? "true" : "false"}
                      />
                      {form.formState.errors.brand && (
                        <FieldError>{form.formState.errors.brand.message}</FieldError>
                      )}
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="model">
                      Model <span className="text-destructive">*</span>
                    </FieldLabel>
                    <FieldContent>
                      <Input
                        id="model"
                        {...form.register("model")}
                        placeholder="e.g., OptiPlex 3090"
                        aria-invalid={form.formState.errors.model ? "true" : "false"}
                      />
                      {form.formState.errors.model && (
                        <FieldError>{form.formState.errors.model.message}</FieldError>
                      )}
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="serialNo">Serial Number</FieldLabel>
                    <FieldContent>
                      <Input
                        id="serialNo"
                        {...form.register("serialNo")}
                        placeholder="Serial number"
                      />
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="assetType">Asset Type</FieldLabel>
                    <FieldContent>
                      <Input
                        id="assetType"
                        {...form.register("assetType")}
                        placeholder="e.g., Desktop, Laptop, Monitor"
                      />
                    </FieldContent>
                  </Field>

              </div>
            </CardContent>
          </Card>
          </motion.div>
          )}

          {/* Photos Tab */}
          {activeTab === 'photos' && (
          <motion.div
            key="photos"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="md:col-span-2"
          >
          <>
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Asset Images</CardTitle>
              <CardDescription className="text-xs">
                Upload and manage asset images
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-4">
              <div className="grid gap-2">
                <Label htmlFor="images">Asset Images</Label>

                {loadingExistingImages ? (
                  <div className="flex items-center justify-center py-4">
                    <Spinner className="h-4 w-4" />
                  </div>
                ) : (
                  <div className="space-y-2 mb-4">
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
                      {existingImages.map((image: { id: string; imageUrl: string; assetTagId: string; fileName?: string; createdAt?: string }, index: number) => (
                        <div
                          key={image.id}
                          className="relative group border rounded-lg overflow-visible cursor-pointer"
                          onClick={() => {
                            setPreviewSource('images')
                            setPreviewImageIndex(index)
                            setIsPreviewOpen(true)
                          }}
                        >
                          <div className="aspect-square bg-muted relative overflow-hidden rounded-lg">
                            <Image
                              src={image.imageUrl}
                              alt={`Asset ${asset?.assetTagId} image`}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center z-10">
                              <div className="bg-white/50 rounded-full p-3 shadow-lg">
                                <Eye className="h-6 w-6 text-black" />
                              </div>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="default"
                            size="icon"
                            className="absolute top-0 right-0 h-5 w-5 bg-red-500 hover:bg-red-400 rounded-tr-lg rounded-br-none rounded-tl-none z-20 shadow-lg"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteImageClick(image.id)
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {selectedExistingImages.map((img) => (
                        <div key={img.id} className="relative group border rounded-lg overflow-hidden">
                          <div className="aspect-square bg-muted relative overflow-hidden rounded-lg">
                            <Image
                              src={img.imageUrl}
                              alt={img.fileName}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                          {!uploadingImages && (
                            <Button
                              type="button"
                              variant="default"
                              size="icon"
                              className="absolute top-0 right-0 h-5 w-5 bg-red-500 hover:bg-red-400 rounded-tr-lg rounded-br-none rounded-tl-none z-20 shadow-lg"
                              onClick={() => setSelectedExistingImages(prev => prev.filter(i => i.id !== img.id))}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                      {selectedImages.map((file, index) => (
                        <div key={`selected-${index}`} className="relative group border rounded-lg overflow-hidden">
                          <div className="aspect-square bg-muted relative overflow-hidden rounded-lg">
                            <Image
                              src={selectedImageUrls[index]}
                              alt={`Selected image ${index + 1}`}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                            {uploadingImages && (
                              <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30">
                                <div className="text-center">
                                  <div className="text-white text-sm font-medium mb-1">
                                    {Math.round(uploadProgress)}%
                                  </div>
                                  <div className="w-16 h-1 bg-white/30 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-white transition-all duration-300"
                                      style={{ width: `${uploadProgress}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                          {!uploadingImages && (
                            <Button
                              type="button"
                              variant="default"
                              size="icon"
                              className="absolute top-0 right-0 h-5 w-5 bg-red-500 hover:bg-red-400 rounded-tr-lg rounded-br-none rounded-tl-none z-20 shadow-lg"
                              onClick={() => setSelectedImages(prev => prev.filter((_, i) => i !== index))}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <div className="aspect-square border-2 border-dashed border-muted rounded-lg flex items-center justify-center">
                        <input
                          ref={imageInputRef}
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                          multiple
                          className="hidden"
                          onClick={(e) => {
                            e.stopPropagation()
                          }}
                          onChange={(e) => {
                            e.stopPropagation()
                            const files = Array.from(e.target.files || [])
                            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
                            const maxSize = 5 * 1024 * 1024
                            const validFiles = files.filter(file => {
                              if (!allowedTypes.includes(file.type)) {
                                toast.error(`${file.name} is not a valid image type. Only JPEG, PNG, GIF, and WebP are allowed.`)
                                return false
                              }
                              if (file.size > maxSize) {
                                toast.error(`${file.name} is too large. Maximum size is 5MB.`)
                                return false
                              }
                              return true
                            })
                            setSelectedImages(prev => [...prev, ...validFiles])
                            if (imageInputRef.current) {
                              imageInputRef.current.value = ''
                            }
                          }}
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-full w-full"
                            >
                              <Upload className="h-6 w-6" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                imageInputRef.current?.click()
                              }}
                            >
                              <Upload className="mr-2 h-4 w-4" />
                              Upload Images
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setMediaBrowserOpen(true)
                              }}
                            >
                              <ImageIcon className="mr-2 h-4 w-4" />
                              Select from Media
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          </>
          </motion.div>
          )}

          {/* Docs Tab */}
          {activeTab === 'docs' && (
          <motion.div
            key="docs"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="md:col-span-2"
          >
          <>
          {/* Asset Documents */}
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Asset Documents</CardTitle>
              <CardDescription className="text-xs">
                Upload and manage asset documents
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-4">
              <div className="grid gap-2">
                <Label htmlFor="documents">Asset Documents</Label>

                {loadingExistingDocuments ? (
                  <div className="flex items-center justify-center py-4">
                    <Spinner className="h-4 w-4" />
                  </div>
                ) : (
                  <div className="space-y-2 mb-4">
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
                      {existingDocuments.map((doc: { id: string; documentUrl: string; assetTagId: string; fileName?: string; mimeType?: string | null; documentSize?: number | null; createdAt?: string }) => {
                        const isImage = doc.mimeType?.startsWith('image/') || 
                          /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.fileName || '')
                        return (
                          <div
                            key={doc.id}
                            className="relative group border rounded-lg overflow-visible cursor-pointer"
                            onClick={() => {
                              if (isImage) {
                                const imageDocuments = existingDocuments.filter((document: { mimeType?: string | null; fileName?: string }) => {
                                  const docIsImage = document.mimeType?.startsWith('image/') || 
                                    /\.(jpg|jpeg|png|gif|webp)$/i.test(document.fileName || '')
                                  return docIsImage
                                })
                                const imageIndex = imageDocuments.findIndex((document: { id: string }) => document.id === doc.id)
                                if (imageIndex >= 0) {
                                  setPreviewSource('documents')
                                  setPreviewImageIndex(imageIndex)
                                  setIsPreviewOpen(true)
                                }
                              } else {
                                const isPdf = doc.mimeType === 'application/pdf' || 
                                  /\.pdf$/i.test(doc.fileName || '')
                                const isDownloadable = doc.mimeType?.includes('excel') || 
                                  doc.mimeType?.includes('spreadsheet') ||
                                  doc.mimeType?.includes('word') ||
                                  doc.mimeType?.includes('document') ||
                                  /\.(xls|xlsx|doc|docx)$/i.test(doc.fileName || '')
                                
                                if (isPdf) {
                                  window.open(doc.documentUrl, '_blank')
                                } else if (isDownloadable) {
                                  setDocumentToDownload({
                                    id: doc.id,
                                    documentUrl: doc.documentUrl,
                                    fileName: doc.fileName,
                                    mimeType: doc.mimeType,
                                    documentSize: doc.documentSize,
                                  })
                                  setIsDownloadDialogOpen(true)
                                } else {
                                  window.open(doc.documentUrl, '_blank')
                                }
                              }
                            }}
                          >
                            <div className="aspect-square bg-muted relative overflow-hidden rounded-lg flex items-center justify-center">
                              {isImage ? (
                                <Image
                                  src={doc.documentUrl}
                                  alt={doc.fileName || 'Document'}
                                  fill
                                  className="object-cover"
                                  unoptimized
                                />
                              ) : (
                                <FileText className="h-12 w-12 text-muted-foreground" />
                              )}
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center z-10">
                                <div className="bg-white/50 rounded-full p-3 shadow-lg">
                                  <Eye className="h-6 w-6 text-black" />
                                </div>
                              </div>
                            </div>
                            {doc.fileName && !isImage && (
                              <div className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-[10px] px-1 py-0.5 truncate rounded-b-lg">
                                {doc.fileName}
                              </div>
                            )}
                            <Button
                              type="button"
                              variant="default"
                              size="icon"
                              className="absolute top-0 right-0 h-5 w-5 bg-red-500 hover:bg-red-400 rounded-tr-lg rounded-br-none rounded-tl-none z-20 shadow-lg"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteDocumentClick(doc.id)
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )
                      })}
                      {selectedExistingDocuments.map((doc) => {
                        const isImage = doc.documentUrl && (
                          doc.documentUrl.includes('.jpg') || 
                          doc.documentUrl.includes('.jpeg') || 
                          doc.documentUrl.includes('.png') || 
                          doc.documentUrl.includes('.gif') || 
                          doc.documentUrl.includes('.webp')
                        )
                        return (
                          <div key={doc.id} className="relative group border rounded-lg overflow-hidden">
                            <div className="aspect-square bg-muted relative overflow-hidden rounded-lg flex items-center justify-center">
                              {isImage ? (
                                <Image
                                  src={doc.documentUrl}
                                  alt={doc.fileName}
                                  fill
                                  className="object-cover"
                                  unoptimized
                                />
                              ) : (
                                <FileText className="h-12 w-12 text-muted-foreground" />
                              )}
                              {uploadingDocuments && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30">
                                  <div className="text-center">
                                    <div className="text-white text-sm font-medium mb-1">
                                      {Math.round(documentUploadProgress)}%
                                    </div>
                                    <div className="w-16 h-1 bg-white/30 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-white transition-all duration-300"
                                        style={{ width: `${documentUploadProgress}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                            {doc.fileName && !isImage && (
                              <div className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-[10px] px-1 py-0.5 truncate rounded-b-lg">
                                {doc.fileName}
                              </div>
                            )}
                            {!uploadingDocuments && (
                              <Button
                                type="button"
                                variant="default"
                                size="icon"
                                className="absolute top-0 right-0 h-5 w-5 bg-red-500 hover:bg-red-400 rounded-tr-lg rounded-br-none rounded-tl-none z-20 shadow-lg"
                                onClick={() => setSelectedExistingDocuments(prev => prev.filter(d => d.id !== doc.id))}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        )
                      })}
                      {selectedDocuments.map((file, index) => {
                        const isImage = file.type.startsWith('image/')
                        return (
                          <div key={`selected-doc-${index}`} className="relative group border rounded-lg overflow-hidden">
                            <div className="aspect-square bg-muted relative overflow-hidden rounded-lg flex items-center justify-center">
                              {isImage ? (
                                <Image
                                  src={selectedDocumentUrls[index]}
                                  alt={file.name}
                                  fill
                                  className="object-cover"
                                  unoptimized
                                />
                              ) : (
                                <FileText className="h-12 w-12 text-muted-foreground" />
                              )}
                              {uploadingDocuments && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-30">
                                  <div className="text-center">
                                    <div className="text-white text-sm font-medium mb-1">
                                      {Math.round(documentUploadProgress)}%
                                    </div>
                                    <div className="w-16 h-1 bg-white/30 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-white transition-all duration-300"
                                        style={{ width: `${documentUploadProgress}%` }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                            {file.name && !isImage && (
                              <div className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-[10px] px-1 py-0.5 truncate rounded-b-lg">
                                {file.name}
                              </div>
                            )}
                            {!uploadingDocuments && (
                              <Button
                                type="button"
                                variant="default"
                                size="icon"
                                className="absolute top-0 right-0 h-5 w-5 bg-red-500 hover:bg-red-400 rounded-tr-lg rounded-br-none rounded-tl-none z-20 shadow-lg"
                                onClick={() => setSelectedDocuments(prev => prev.filter((_, i) => i !== index))}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        )
                      })}
                      <div className="aspect-square border-2 border-dashed border-muted rounded-lg flex items-center justify-center">
                        <input
                          ref={documentInputRef}
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.rtf,.jpg,.jpeg,.png,.gif,.webp"
                          multiple
                          className="hidden"
                          onClick={(e) => {
                            e.stopPropagation()
                          }}
                          onChange={(e) => {
                            e.stopPropagation()
                            const files = Array.from(e.target.files || [])
                            const allowedTypes = [
                              'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                              'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                              'text/plain', 'text/csv', 'application/rtf',
                              'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
                            ]
                            const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv', '.rtf', '.jpg', '.jpeg', '.png', '.gif', '.webp']
                            const maxSize = 5 * 1024 * 1024
                            const validFiles = files.filter(file => {
                              const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
                              if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
                                toast.error(`${file.name} is not a valid document type. Only PDF, DOC, DOCX, XLS, XLSX, TXT, CSV, RTF, JPEG, PNG, GIF, and WebP are allowed.`)
                                return false
                              }
                              if (file.size > maxSize) {
                                toast.error(`${file.name} is too large. Maximum size is 5MB.`)
                                return false
                              }
                              return true
                            })
                            setSelectedDocuments(prev => [...prev, ...validFiles])
                            if (documentInputRef.current) {
                              documentInputRef.current.value = ''
                            }
                          }}
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-full w-full"
                            >
                              <Upload className="h-6 w-6" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                documentInputRef.current?.click()
                              }}
                            >
                              <Upload className="mr-2 h-4 w-4" />
                              Upload Documents
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setDocumentBrowserOpen(true)
                              }}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              Select from Media
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          </>
          </motion.div>
          )}

          {/* Purchase & Additional Information - Part of Details Tab */}
          {activeTab === 'details' && (
          <motion.div
            key="details-purchase"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="md:col-span-2"
          >
          <>
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Purchase & Additional Information</CardTitle>
              <CardDescription className="text-xs">
                Purchase details and additional information
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                <Field>
                  <FieldLabel htmlFor="purchasedFrom">Purchased From</FieldLabel>
                  <FieldContent>
                    <Input
                      id="purchasedFrom"
                      {...form.register("purchasedFrom")}
                      placeholder="Vendor name"
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="purchaseDate">Purchase Date</FieldLabel>
                  <FieldContent>
                    <Controller
                      name="purchaseDate"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <DatePicker
                          id="purchaseDate"
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          placeholder="Select purchase date"
                          error={fieldState.error?.message}
                          className="gap-2"
                          labelClassName="hidden"
                        />
                      )}
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="cost">Cost</FieldLabel>
                  <FieldContent>
                    <Input
                      id="cost"
                      type="number"
                      step="0.01"
                      {...form.register("cost")}
                      placeholder="0.00"
                    />
                    {form.formState.errors.cost && (
                      <FieldError>{form.formState.errors.cost.message}</FieldError>
                    )}
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="poNumber">PO Number</FieldLabel>
                  <FieldContent>
                    <Input
                      id="poNumber"
                      {...form.register("poNumber")}
                      placeholder="Purchase order number"
                    />
                  </FieldContent>
                </Field>

                <DepartmentSelectField
                  name="department"
                  control={form.control}
                  error={form.formState.errors.department}
                  label="Department"
                  placeholder="Select or search department"
                  canCreate={canManageSetup}
                />

                <SiteSelectField
                  name="site"
                  control={form.control}
                  error={form.formState.errors.site}
                  label="Site"
                  placeholder="Select or search site"
                  canCreate={canManageSetup}
                />

                <LocationSelectField
                  name="location"
                  control={form.control}
                  error={form.formState.errors.location}
                  label="Location"
                  placeholder="Select or search location"
                  canCreate={canManageSetup}
                />

                <Field>
                  <FieldLabel htmlFor="owner">Owner</FieldLabel>
                  <FieldContent>
                    <Input
                      id="owner"
                      {...form.register("owner")}
                      placeholder="Asset owner"
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="issuedTo">Issued To</FieldLabel>
                  <FieldContent>
                    <Input
                      id="issuedTo"
                      {...form.register("issuedTo")}
                      placeholder="Person issued to"
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="xeroAssetNo">Xero Asset Number</FieldLabel>
                  <FieldContent>
                    <Input
                      id="xeroAssetNo"
                      {...form.register("xeroAssetNo")}
                      placeholder="Xero reference"
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="pbiNumber">PBI Number</FieldLabel>
                  <FieldContent>
                    <Input
                      id="pbiNumber"
                      {...form.register("pbiNumber")}
                      placeholder="PBI number"
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="paymentVoucherNumber">Payment Voucher Number</FieldLabel>
                  <FieldContent>
                    <Input
                      id="paymentVoucherNumber"
                      {...form.register("paymentVoucherNumber")}
                      placeholder="Payment voucher number"
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="deliveryDate">Delivery Date</FieldLabel>
                  <FieldContent>
                    <Controller
                      name="deliveryDate"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <DatePicker
                          id="deliveryDate"
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          placeholder="Select delivery date"
                          error={fieldState.error?.message}
                          className="gap-2"
                          labelClassName="hidden"
                        />
                      )}
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="qr">QR Code</FieldLabel>
                  <FieldContent>
                    <Controller
                      name="qr"
                      control={form.control}
                      render={({ field }) => {
                        const normalizedValue = field.value ? (field.value.trim().toUpperCase() === "YES" ? "YES" : field.value.trim().toUpperCase() === "NO" ? "NO" : "") : ""
                        return (
                          <Select
                            value={normalizedValue}
                            onValueChange={field.onChange}
                            key={`qr-${asset?.id || 'new'}-${normalizedValue || ''}`}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select QR code status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="YES">YES</SelectItem>
                              <SelectItem value="NO">NO</SelectItem>
                            </SelectContent>
                          </Select>
                        )
                      }}
                    />
                    {form.formState.errors.qr && (
                      <FieldError>{form.formState.errors.qr.message}</FieldError>
                    )}
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="oldAssetTag">Old Asset Tag</FieldLabel>
                  <FieldContent>
                    <Input
                      id="oldAssetTag"
                      {...form.register("oldAssetTag")}
                      placeholder="Previous asset tag"
                    />
                  </FieldContent>
                </Field>

                <Field className="md:col-span-2">
                  <div className="flex items-center space-x-2">
                    <Controller
                      name="unaccountedInventory"
                      control={form.control}
                      render={({ field }) => (
                        <Checkbox
                          id="unaccountedInventory"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                    <Label htmlFor="unaccountedInventory" className="text-sm font-normal cursor-pointer">
                      Unaccounted Inventory
                    </Label>
                  </div>
                </Field>

                <Field>
                  <FieldLabel htmlFor="additionalInformation">Additional Information</FieldLabel>
                  <FieldContent>
                    <Textarea
                      id="additionalInformation"
                      {...form.register("additionalInformation")}
                      placeholder="Any additional notes"
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="remarks">Remarks</FieldLabel>
                  <FieldContent>
                    <Textarea
                      id="remarks"
                      {...form.register("remarks")}
                      placeholder="Additional remarks"
                    />
                  </FieldContent>
                </Field>
              </div>
            </CardContent>
          </Card>
          </>
          </motion.div>
          )}

          {/* Depreciation Tab */}
          {activeTab === 'depreciation' && (
          <motion.div
            key="depreciation"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="md:col-span-2"
          >
          <>
            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
              <CardTitle className="text-base">Depreciation Information</CardTitle>
                <CardDescription className="text-xs">
                Depreciation settings and calculations
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                <Field className="md:col-span-2">
                  <div className="flex items-center space-x-2">
                    <Controller
                      name="depreciableAsset"
                      control={form.control}
                      render={({ field }) => (
                        <Checkbox
                          id="depreciableAsset"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      )}
                    />
                    <Label htmlFor="depreciableAsset" className="text-sm font-normal cursor-pointer">
                      Depreciable Asset
                    </Label>
                  </div>
                </Field>

                {form.watch("depreciableAsset") && (
                  <>
                    <Field>
                      <FieldLabel htmlFor="depreciableCost">Depreciable Cost</FieldLabel>
                      <FieldContent>
                        <Input
                          id="depreciableCost"
                          type="number"
                          step="0.01"
                          {...form.register("depreciableCost")}
                          placeholder="0.00"
                        />
                        {form.formState.errors.depreciableCost && (
                          <FieldError>{form.formState.errors.depreciableCost.message}</FieldError>
                        )}
                      </FieldContent>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="salvageValue">Salvage Value</FieldLabel>
                      <FieldContent>
                        <Input
                          id="salvageValue"
                          type="number"
                          step="0.01"
                          {...form.register("salvageValue")}
                          placeholder="0.00"
                        />
                        {form.formState.errors.salvageValue && (
                          <FieldError>{form.formState.errors.salvageValue.message}</FieldError>
                        )}
                      </FieldContent>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="assetLifeMonths">Asset Life (Months)</FieldLabel>
                      <FieldContent>
                        <Input
                          id="assetLifeMonths"
                          type="number"
                          step="1"
                          {...form.register("assetLifeMonths")}
                          placeholder="e.g., 60"
                        />
                        {form.formState.errors.assetLifeMonths && (
                          <FieldError>{form.formState.errors.assetLifeMonths.message}</FieldError>
                        )}
                      </FieldContent>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="depreciationMethod">Depreciation Method</FieldLabel>
                      <FieldContent>
                        <Controller
                          name="depreciationMethod"
                          control={form.control}
                          render={({ field }) => (
                            <Select
                              value={field.value || ""}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select depreciation method" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Straight Line">Straight Line</SelectItem>
                                <SelectItem value="Declining Balance">Declining Balance</SelectItem>
                                <SelectItem value="Sum of Years">Sum of Years</SelectItem>
                                <SelectItem value="Units of Production">Units of Production</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                        {form.formState.errors.depreciationMethod && (
                          <FieldError>{form.formState.errors.depreciationMethod.message}</FieldError>
                        )}
                      </FieldContent>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="dateAcquired">Date Acquired</FieldLabel>
                      <FieldContent>
                        <Controller
                          name="dateAcquired"
                          control={form.control}
                          render={({ field, fieldState }) => (
                            <DatePicker
                              id="dateAcquired"
                              value={field.value}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              placeholder="Select date acquired"
                              error={fieldState.error?.message}
                              className="gap-2"
                              labelClassName="hidden"
                            />
                          )}
                        />
                        {form.formState.errors.dateAcquired && (
                          <FieldError>{form.formState.errors.dateAcquired.message}</FieldError>
                        )}
                      </FieldContent>
                    </Field>
                  </>
                )}
              </div>
              </CardContent>
            </Card>
          </>
          </motion.div>
          )}
          </AnimatePresence>
        </div>
      </form>
        {/* Audit Tab */}
        <AnimatePresence mode="wait">
        {activeTab === 'audit' && (
        <motion.div
          key="audit"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <div className="space-y-4">
            {assetLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <Spinner className="h-8 w-8" />
                  <p className="text-sm text-muted-foreground">Loading audit records...</p>
                </div>
              </div>
            ) : !asset?.auditHistory || asset.auditHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No audit records found.</p>
            ) : (
              <div className="min-w-full">
                <ScrollArea className="h-[500px] relative border">
                  <div className="sticky top-0 z-30 h-px bg-border w-full"></div>
                  <div className="pr-2.5 relative after:content-[''] after:absolute after:right-[10px] after:top-0 after:bottom-0 after:w-px after:bg-border after:z-50 after:h-full">
                    <Table className="border-b">
                      <TableHeader className="sticky -top-1 z-20 bg-card [&_tr]:border-b-0 -mr-2.5">
                        <TableRow className="group hover:bg-muted/50 relative border-b-0 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-[1.5px] after:h-px after:bg-border after:z-30">
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[11%]">Date</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[16%]">Audit Type</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[11%]">Status</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[16%]">Auditor</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[36%]">Notes</TableHead>
                          <TableHead className="bg-card transition-colors sticky z-10 right-0 group-hover:bg-card before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border before:z-50 text-center w-[10%]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {asset.auditHistory.map((audit) => (
                          <TableRow key={audit.id} className="group relative">
                            <TableCell className="font-medium">
                              {formatDate(audit.auditDate || null)}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-medium">{audit.auditType || 'N/A'}</span>
                            </TableCell>
                            <TableCell>
                              {audit.status ? (
                                <span className={`px-2 py-1 text-xs font-medium rounded ${
                                  audit.status.toLowerCase() === 'completed' ? 'bg-green-500/10 text-green-500' :
                                  audit.status.toLowerCase() === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                                  audit.status.toLowerCase() === 'failed' ? 'bg-red-500/10 text-red-500' :
                                  'bg-gray-500/10 text-gray-500'
                                }`}>
                                  {audit.status}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{audit.auditor || <span className="text-muted-foreground">-</span>}</span>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm wrap-break-word">
                                {audit.notes || <span className="text-muted-foreground">-</span>}
                              </p>
                            </TableCell>
                            <TableCell className="sticky text-center right-0 bg-card z-10 before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border before:z-50 group-hover:bg-card">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full"
                                onClick={() => {
                                  setAuditToDelete(audit.id)
                                  setIsDeleteAuditDialogOpen(true)
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <ScrollBar orientation="horizontal" />
                  <ScrollBar orientation="vertical" className="z-50" />
                </ScrollArea>
              </div>
            )}
          </div>
        </motion.div>
        )}
        </AnimatePresence>

        {/* Maintenance Tab */}
        <AnimatePresence mode="wait">
        {activeTab === 'maintenance' && (
        <motion.div
          key="maintenance"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <div className="space-y-4">
            {isLoadingMaintenance ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <Spinner className="h-8 w-8" />
                  <p className="text-sm text-muted-foreground">Loading maintenance records...</p>
                </div>
              </div>
            ) : maintenances.length === 0 ? (
              <p className="text-sm text-muted-foreground">No maintenance records found.</p>
            ) : (
              <div className="min-w-full">
                <ScrollArea className="h-[500px] relative border">
                  <div className="sticky top-0 z-30 h-px bg-border w-full"></div>
                  <div className="pr-2.5 relative after:content-[''] after:absolute after:right-[10px] after:top-0 after:bottom-0 after:w-px after:bg-border after:z-50 after:h-full">
                    <Table className="border-b">
                      <TableHeader className="sticky -top-1 z-20 bg-card [&_tr]:border-b-0 -mr-2.5">
                        <TableRow className="group hover:bg-muted/50 relative border-b-0 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-[1.5px] after:h-px after:bg-border after:z-30">
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[18%]">Title</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[13%]">Status</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[11%]">Due Date</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[11%]">Date Completed</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[13%]">Maintenance By</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[10%]">Cost</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[12%]">Inventory Items</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[12%]">Details</TableHead>
                          <TableHead className="bg-card transition-colors sticky z-10 right-0 group-hover:bg-card before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border before:z-50 text-center w-[12%]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {maintenances.map((maintenance) => (
                          <TableRow key={maintenance.id} className="group relative">
                            <TableCell>
                              <span className="text-sm font-medium">{maintenance.title || 'N/A'}</span>
                            </TableCell>
                            <TableCell>
                              {maintenance.status ? (
                                <span className={`px-2 py-1 text-xs font-medium rounded capitalize ${
                                  maintenance.status.toLowerCase() === 'completed' ? 'bg-green-500/10 text-green-500' :
                                  maintenance.status.toLowerCase() === 'in progress' ? 'bg-blue-500/10 text-blue-500' :
                                  maintenance.status.toLowerCase() === 'scheduled' ? 'bg-yellow-500/10 text-yellow-500' :
                                  maintenance.status.toLowerCase() === 'cancelled' ? 'bg-red-500/10 text-red-500' :
                                  'bg-gray-500/10 text-gray-500'
                                }`}>
                                  {maintenance.status}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{formatDate(maintenance.dueDate || null)}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{formatDate(maintenance.dateCompleted || null)}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{maintenance.maintenanceBy || <span className="text-muted-foreground">-</span>}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{formatCurrency(maintenance.cost)}</span>
                            </TableCell>
                            <TableCell>
                              {maintenance.inventoryItems && maintenance.inventoryItems.length > 0 ? (
                                <div className="flex flex-col gap-1">
                                  <Badge variant="outline" className="text-xs w-fit">
                                    <Package className="h-3 w-3 mr-1" />
                                    {maintenance.inventoryItems.length} {maintenance.inventoryItems.length === 1 ? 'item' : 'items'}
                                  </Badge>
                                  <div className="text-xs text-muted-foreground">
                                    {maintenance.inventoryItems.slice(0, 2).map((item, idx) => (
                                      <span key={item.id}>
                                        {item.inventoryItem?.itemCode} ({item.quantity} {item.inventoryItem?.unit || ''})
                                        {idx < Math.min(maintenance.inventoryItems!.length, 2) - 1 && ', '}
                                      </span>
                                    ))}
                                    {maintenance.inventoryItems.length > 2 && ` +${maintenance.inventoryItems.length - 2} more`}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="max-w-[200px]">
                                <p className="text-sm wrap-break-word">
                                  {maintenance.details || <span className="text-muted-foreground">-</span>}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="sticky text-center right-0 bg-card z-10 before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border before:z-50 group-hover:bg-card">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full"
                                onClick={() => {
                                  setMaintenanceToDelete(maintenance.id)
                                  setIsDeleteMaintenanceDialogOpen(true)
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <ScrollBar orientation="horizontal" />
                  <ScrollBar orientation="vertical" className="z-50" />
                </ScrollArea>
              </div>
            )}
          </div>
        </motion.div>
        )}
        </AnimatePresence>

        {/* Reserve Tab */}
        <AnimatePresence mode="wait">
        {activeTab === 'reserve' && (
        <motion.div
          key="reserve"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <div className="space-y-4">
            {isLoadingReserve ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <Spinner className="h-8 w-8" />
                  <p className="text-sm text-muted-foreground">Loading reservations...</p>
                </div>
              </div>
            ) : reservations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reservations found.</p>
            ) : (
              <div className="min-w-full">
                <ScrollArea className="h-[500px] relative border">
                  <div className="sticky top-0 z-30 h-px bg-border w-full"></div>
                  <div className="pr-2.5 relative after:content-[''] after:absolute after:right-[10px] after:top-0 after:bottom-0 after:w-px after:bg-border after:z-50 after:h-full">
                    <Table className="border-b">
                      <TableHeader className="sticky -top-1 z-20 bg-card [&_tr]:border-b-0 -mr-2.5">
                        <TableRow className="group hover:bg-muted/50 relative border-b-0 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-[1.5px] after:h-px after:bg-border after:z-30">
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[13%]">Asset ID</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[16%]">Description</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[10%]">Type</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[13%]">Reserved For</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[13%]">Purpose</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[11%]">Reservation Date</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[11%]">Time Ago</TableHead>
                          <TableHead className="bg-card transition-colors sticky z-10 right-0 group-hover:bg-card before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border before:z-50 text-center w-[13%]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reservations.map((reservation: { 
                          id: string
                          reservationType: string
                          purpose?: string | null
                          reservationDate: string | Date
                          employeeUser?: { name: string } | null
                          department?: string | null
                          asset?: { assetTagId: string; description: string } | null
                        }) => {
                          const reservationDate = reservation.reservationDate ? new Date(reservation.reservationDate) : null
                          const timeAgo = reservationDate ? getTimeAgo(reservationDate) : '-'
                          
                          return (
                            <TableRow key={reservation.id} className="group relative">
                              <TableCell>
                                {reservation.asset?.assetTagId ? (
                                  <Badge variant="outline" className="font-medium">
                                    {reservation.asset.assetTagId}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <span className="text-sm">{reservation.asset?.description || asset?.description || 'N/A'}</span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm capitalize">{reservation.reservationType || 'N/A'}</span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm">
                                  {reservation.reservationType === 'Employee' && reservation.employeeUser
                                    ? reservation.employeeUser.name
                                    : reservation.reservationType === 'Department' && reservation.department
                                    ? reservation.department
                                    : <span className="text-muted-foreground">-</span>}
                                </span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm">{reservation.purpose || <span className="text-muted-foreground">-</span>}</span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm">{formatDate(reservation.reservationDate)}</span>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-muted-foreground">{timeAgo}</span>
                              </TableCell>
                              <TableCell className="sticky text-center right-0 bg-card z-10 before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border before:z-50 group-hover:bg-card">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full"
                                  onClick={() => {
                                    setReservationToDelete(reservation.id)
                                    setIsDeleteReservationDialogOpen(true)
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <ScrollBar orientation="horizontal" />
                  <ScrollBar orientation="vertical" className="z-50" />
                </ScrollArea>
              </div>
            )}
          </div>
        </motion.div>
        )}
        </AnimatePresence>

        {/* History Tab */}
        <AnimatePresence mode="wait">
        {activeTab === 'history' && (
        <motion.div
          key="history"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <div className="space-y-4">
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <Spinner className="h-8 w-8" />
                  <p className="text-sm text-muted-foreground">Loading history logs...</p>
                </div>
              </div>
            ) : historyLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No history logs found.</p>
            ) : (
              <div className="min-w-full">
                <ScrollArea className="h-[500px] relative border">
                  <div className="sticky top-0 z-30 h-px bg-border w-full"></div>
                  <div className="pr-2.5 relative after:content-[''] after:absolute after:right-[10px] after:top-0 after:bottom-0 after:w-px after:bg-border after:z-50 after:h-full">
                    <Table className="border-b">
                      <TableHeader className="sticky -top-1 z-20 bg-card [&_tr]:border-b-0 -mr-2.5">
                        <TableRow className="group hover:bg-muted/50 relative border-b-0 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-[1.5px] after:h-px after:bg-border after:z-30">
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[130px]">Date</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[110px]">Event</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[130px]">Field</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left">Changed from</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left">Changed to</TableHead>
                          <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left w-[160px]">Action by</TableHead>
                          <TableHead className="bg-card transition-colors sticky z-10 right-0 group-hover:bg-card before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border before:z-50 text-center w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historyLogs.map((log: { id: string; eventType: string; eventDate: string; field?: string; changeFrom?: string; changeTo?: string; actionBy: string }) => {
                          const eventLabel = log.eventType === 'added' ? 'Asset added' : 
                                            log.eventType === 'edited' ? 'Asset edit' : 
                                            'Asset deleted'
                          
                          return (
                            <TableRow key={log.id} className="group relative">
                              <TableCell className="font-medium">
                                {formatDate(log.eventDate)}
                              </TableCell>
                              <TableCell>
                                <span className={`px-2 py-1 text-xs font-medium rounded ${
                                  log.eventType === 'added' ? 'bg-green-500/10 text-green-500' :
                                  log.eventType === 'edited' ? 'bg-blue-500/10 text-blue-500' :
                                  'bg-red-500/10 text-red-500'
                                }`}>
                                  {eventLabel}
                                </span>
                              </TableCell>
                              <TableCell className="font-medium">
                                {log.field ? (
                                  <span className="capitalize">{log.field}</span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="max-w-[300px]">
                                  <p className="text-sm wrap-break-word">
                                    {log.changeFrom || <span className="text-muted-foreground">(empty)</span>}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="max-w-[300px]">
                                  <p className="text-sm wrap-break-word">
                                    {log.changeTo || <span className="text-muted-foreground">(empty)</span>}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm">{log.actionBy}</span>
                              </TableCell>
                              <TableCell className="sticky text-center right-0 bg-card z-10 before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border before:z-50 group-hover:bg-card">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full"
                                  onClick={() => {
                                    setHistoryLogToDelete(log.id)
                                    setIsDeleteHistoryDialogOpen(true)
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <ScrollBar orientation="horizontal" />
                  <ScrollBar orientation="vertical" className="z-50" />
                </ScrollArea>
              </div>
            )}
          </div>
        </motion.div>
        )}
        </AnimatePresence>
      </div>

      {/* Floating Action Buttons */}
      <AnimatePresence>
      {isFormDirty && (
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
              const formElement = document.querySelector('form') as HTMLFormElement
              if (formElement) {
                formElement.requestSubmit()
              }
            }}
            disabled={loading || uploadingImages || uploadingDocuments || isCheckingAssetTag}
            className="min-w-[120px]"
          >
            {loading || uploadingImages || uploadingDocuments ? (
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

      {/* Dialogs */}
      <MediaBrowserDialog
        open={mediaBrowserOpen}
        onOpenChange={setMediaBrowserOpen}
        selectedImages={selectedExistingImages}
        onSelectImages={setSelectedExistingImages}
        pageSize={24}
        currentAssetTagId={asset?.assetTagId}
        existingImageUrls={existingImages.map((img: { imageUrl: string }) => img.imageUrl)}
      />

      <DocumentBrowserDialog
        open={documentBrowserOpen}
        onOpenChange={setDocumentBrowserOpen}
        selectedDocuments={selectedExistingDocuments}
        onSelectDocuments={setSelectedExistingDocuments}
        pageSize={24}
        currentAssetTagId={asset?.assetTagId}
      />

      <DeleteConfirmationDialog
        open={isDeleteImageDialogOpen}
        onOpenChange={setIsDeleteImageDialogOpen}
        onConfirm={deleteExistingImage}
        title="Delete Image"
        description="Are you sure you want to delete this image? This action cannot be undone."
        confirmLabel="Delete Image"
        isLoading={isDeletingImage}
      />

      <DeleteConfirmationDialog
        open={isDeleteDocumentDialogOpen}
        onOpenChange={setIsDeleteDocumentDialogOpen}
        onConfirm={deleteExistingDocument}
        title="Delete Document"
        description="Are you sure you want to delete this document? This action cannot be undone."
        confirmLabel="Delete Document"
        isLoading={isDeletingDocument}
      />

      <DeleteConfirmationDialog
        open={isDeleteMaintenanceDialogOpen}
        onOpenChange={setIsDeleteMaintenanceDialogOpen}
        onConfirm={deleteMaintenance}
        title="Delete Maintenance Record"
        description="Are you sure you want to delete this maintenance record? This action cannot be undone."
        confirmLabel="Delete Maintenance"
        isLoading={isDeletingMaintenance}
      />

      <DeleteConfirmationDialog
        open={isDeleteReservationDialogOpen}
        onOpenChange={setIsDeleteReservationDialogOpen}
        onConfirm={deleteReservation}
        title="Delete Reservation"
        description="Are you sure you want to delete this reservation? This action cannot be undone."
        confirmLabel="Delete Reservation"
        isLoading={isDeletingReservation}
      />

      <DeleteConfirmationDialog
        open={isDeleteAuditDialogOpen}
        onOpenChange={setIsDeleteAuditDialogOpen}
        onConfirm={deleteAudit}
        title="Delete Audit Record"
        description="Are you sure you want to delete this audit record? This action cannot be undone."
        confirmLabel="Delete Audit"
        isLoading={isDeletingAudit}
      />

      <DeleteConfirmationDialog
        open={isDeleteHistoryDialogOpen}
        onOpenChange={setIsDeleteHistoryDialogOpen}
        onConfirm={deleteHistoryLog}
        title="Delete History Log"
        description="Are you sure you want to delete this history log? This action cannot be undone."
        confirmLabel="Delete History"
        isLoading={isDeletingHistory}
      />

      <DownloadConfirmationDialog
        open={isDownloadDialogOpen}
        onOpenChange={setIsDownloadDialogOpen}
        fileName={documentToDownload?.fileName || null}
        fileSize={documentToDownload?.documentSize || null}
        onConfirm={() => {
          if (documentToDownload) {
            const link = document.createElement('a')
            link.href = documentToDownload.documentUrl
            link.download = documentToDownload.fileName || 'download'
            link.target = '_blank'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
          }
          setDocumentToDownload(null)
        }}
        onCancel={() => {
          setDocumentToDownload(null)
        }}
      />

      <ImagePreviewDialog
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        existingImages={
          previewSource === 'images'
            ? existingImages.map((img: { id: string; imageUrl: string; assetTagId: string; fileName?: string; createdAt?: string }) => ({
                id: img.id,
                imageUrl: img.imageUrl,
                fileName: img.fileName || `Image ${img.id}`,
              }))
            : existingDocuments
                .filter((doc: { mimeType?: string | null; fileName?: string }) => {
                  const isImage = doc.mimeType?.startsWith('image/') || 
                    /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.fileName || '')
                  return isImage
                })
                .map((doc: { id: string; documentUrl: string; fileName?: string }) => ({
                  id: doc.id,
                  imageUrl: doc.documentUrl,
                  fileName: doc.fileName || `Document ${doc.id}`,
                }))
        }
        title={previewSource === 'images' ? `Asset Images - ${asset?.assetTagId}` : `Asset Documents - ${asset?.assetTagId}`}
        maxHeight="h-[70vh] max-h-[600px]"
        initialIndex={previewImageIndex}
      />

      <CategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        onSubmit={handleCreateCategory}
      />

      <SubCategoryDialog
        open={subCategoryDialogOpen}
        onOpenChange={setSubCategoryDialogOpen}
        onSubmit={handleCreateSubCategory}
        mode="create"
        categories={categories}
        selectedCategoryName={categories.find(c => c.id === selectedCategory)?.name}
        initialData={selectedCategory ? { categoryId: selectedCategory, name: '', description: '' } : undefined}
        isLoading={createSubCategoryMutation.isPending}
      />
    </motion.div>
  )
}

