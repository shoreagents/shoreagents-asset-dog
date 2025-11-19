"use client"

import { useState, useRef, useMemo, useEffect, useCallback, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { use } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, Sparkles, ImageIcon, Upload, FileText, PlusIcon, Eye, X, ArrowRight, ClipboardCheck, Scroll } from "lucide-react"
import Image from "next/image"
import { usePermissions } from '@/hooks/use-permissions'
import { useSidebar } from '@/components/ui/sidebar'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { toast } from 'sonner'
import { useCategories, useSubCategories, useCreateCategory, useCreateSubCategory } from "@/hooks/use-categories"
import { CategoryDialog } from "@/components/category-dialog"
import { SubCategoryDialog } from "@/components/subcategory-dialog"
import { MediaBrowserDialog } from "@/components/media-browser-dialog"
import { DocumentBrowserDialog } from "@/components/document-browser-dialog"
import { editAssetSchema, type EditAssetFormData } from "@/lib/validations/assets"
import { Input } from "@/components/ui/input"
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
import { LocationSelectField } from "@/components/location-select-field"
import { SiteSelectField } from "@/components/site-select-field"
import { DepartmentSelectField } from "@/components/department-select-field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { ImagePreviewDialog } from "@/components/image-preview-dialog"
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog"
import { DownloadConfirmationDialog } from "@/components/download-confirmation-dialog"
import { CheckoutManager } from "@/components/checkout-manager"
import { AuditHistoryManager } from "@/components/audit-history-manager"
import type { Category, SubCategory } from "@/hooks/use-categories"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

async function fetchAsset(id: string) {
  const response = await fetch(`/api/assets/${id}`)
  if (!response.ok) {
    throw new Error('Failed to fetch asset')
  }
  return response.json()
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateAsset(id: string, data: any) {
  const response = await fetch(`/api/assets/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update asset')
  }
  return response.json()
}

export default function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const { state: sidebarState, open: sidebarOpen } = useSidebar()
  const canEditAssets = hasPermission('canEditAssets')
  const canManageSetup = hasPermission('canManageSetup')
  const [, startTransition] = useTransition()
  
  // Fetch asset data with retry logic
  const { data: assetData, isLoading: assetLoading, error: assetError } = useQuery({
    queryKey: ['asset', resolvedParams.id],
    queryFn: () => fetchAsset(resolvedParams.id),
    enabled: !!resolvedParams.id,
    retry: 2, // Retry up to 2 times on failure
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
  })

  const asset = assetData?.asset

  // Tab state from URL - moved up to use in queries
  const activeTab = (searchParams.get('tab') as 'basic' | 'media' | 'purchase' | 'checkout' | 'audit') || 'basic'

  // Fetch existing images only when media tab is active
  // Add retry logic to reduce connection pool pressure
  const { data: existingImagesData, isLoading: loadingExistingImages } = useQuery({
    queryKey: ['assets', 'images', asset?.assetTagId],
    queryFn: async () => {
      if (!asset?.assetTagId) return { images: [] }
      const response = await fetch(`/api/assets/images/${asset.assetTagId}`)
      if (response.ok) {
        const data = await response.json()
        return { images: data.images || [] }
      } else {
        return { images: [] }
      }
    },
    enabled: !!asset?.assetTagId && activeTab === 'media', // Only fetch when media tab is active
    staleTime: 0, // Always refetch when component mounts to get latest data
    gcTime: 10 * 60 * 1000,
    retry: 2, // Retry up to 2 times on failure
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  })

  const existingImages = existingImagesData?.images || []

  // Fetch documents only when media tab is active (after images are loaded to reduce concurrent connections)
  const { data: existingDocumentsData, isLoading: loadingExistingDocuments } = useQuery({
    queryKey: ['assets', 'documents', asset?.assetTagId],
    queryFn: async () => {
      if (!asset?.assetTagId) return { documents: [] }
      const response = await fetch(`/api/assets/documents/${asset.assetTagId}`)
      if (response.ok) {
        const data = await response.json()
        return { documents: data.documents || [] }
      } else {
        return { documents: [] }
      }
    },
    enabled: !!asset?.assetTagId && activeTab === 'media' && !loadingExistingImages, // Only fetch when media tab is active and images are loaded
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
    (updates: { tab?: 'basic' | 'media' | 'purchase' | 'checkout' | 'audit' }) => {
      const params = new URLSearchParams(searchParams.toString())

      if (updates.tab !== undefined) {
        if (updates.tab === 'basic') {
          params.delete('tab')
        } else {
          params.set('tab', updates.tab)
        }
      }

      startTransition(() => {
        router.replace(`/assets/${resolvedParams.id}?${params.toString()}`, { scroll: false })
      })
    },
    [searchParams, router, resolvedParams.id, startTransition]
  )

  const handleTabChange = (tab: 'basic' | 'media' | 'purchase' | 'checkout' | 'audit') => {
    updateURL({ tab })
  }

  // Check if asset has checkout
  const hasCheckout = asset?.checkouts && asset.checkouts.length > 0

  // React Query hooks - lazy load categories and subcategories only when dropdowns are opened
  const { data: categories = [], isLoading: categoriesLoading } = useCategories(isCategoryDropdownOpen)
  const createCategoryMutation = useCreateCategory()
  const createSubCategoryMutation = useCreateSubCategory()
  
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<EditAssetFormData> }) => updateAsset(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['asset', resolvedParams.id] })
      if (asset?.assetTagId) {
        queryClient.invalidateQueries({ queryKey: ['assets', 'images', asset.assetTagId] })
        queryClient.invalidateQueries({ queryKey: ['assets', 'documents', asset.assetTagId] })
      }
    },
  })

  const loading = updateMutation.isPending
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
  const [mediaBrowserOpen, setMediaBrowserOpen] = useState(false)
  const [documentBrowserOpen, setDocumentBrowserOpen] = useState(false)
  const [previewImageIndex, setPreviewImageIndex] = useState(0)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewSource, setPreviewSource] = useState<'images' | 'documents'>('images')
  const [isCheckingAssetTag, setIsCheckingAssetTag] = useState(false)
  const [isGeneratingTag, setIsGeneratingTag] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)
  const assetTagIdInputRef = useRef<HTMLInputElement>(null)

  // Format asset tag as user types
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

      // Check if tag already exists
      const exists = await checkAssetTagExists(generatedTag)
      if (exists) {
        // Retry once
        const retryRandomNum = Math.floor(100000 + Math.random() * 900000).toString()
        const retryTag = `${year}-${retryRandomNum}${subCategoryLetter}-SA`
        const retryExists = await checkAssetTagExists(retryTag)
        if (retryExists) {
          toast.error('Failed to generate unique tag. Please try again.')
          setIsGeneratingTag(false)
          return
        }
        form.setValue("assetTagId", retryTag, { shouldValidate: true })
      } else {
        form.setValue("assetTagId", generatedTag, { shouldValidate: true })
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
  const { data: subCategories = [], isLoading: subCategoriesLoading } = useSubCategories(
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
      await createCategoryMutation.mutateAsync(data)
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
      await createSubCategoryMutation.mutateAsync({
        ...data,
        categoryId: selectedCategory,
      })
      setSubCategoryDialogOpen(false)
      toast.success('Sub category created successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create subcategory')
    }
  }

  const uploadImage = async (file: File, assetTagId: string, onProgress?: (progress: number) => void): Promise<void> => {
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

      xhr.open('POST', '/api/assets/upload-image')
      xhr.send(formData)
    })
  }

  // Link an existing image URL to an asset
  const linkExistingImage = async (imageUrl: string, assetTagId: string): Promise<void> => {
    const response = await fetch('/api/assets/upload-image', {
      method: 'POST',
      body: JSON.stringify({
        imageUrl,
        assetTagId,
        linkExisting: true,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to link image')
    }
  }

  const uploadDocument = async (file: File, assetTagId: string, onProgress?: (progress: number) => void): Promise<void> => {
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

      xhr.open('POST', '/api/assets/upload-document')
      xhr.send(formData)
    })
  }

  // Link an existing document URL to an asset
  const linkExistingDocument = async (documentUrl: string, assetTagId: string): Promise<void> => {
    const response = await fetch('/api/assets/upload-document', {
      method: 'POST',
      body: JSON.stringify({
        documentUrl,
        assetTagId,
        linkExisting: true,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
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
      const response = await fetch(`/api/assets/images/delete/${imageToDelete}`, {
        method: 'DELETE',
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
      const response = await fetch(`/api/assets/documents/delete/${documentToDelete}`, {
        method: 'DELETE',
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

  // Check if asset tag exists
  const checkAssetTagExists = async (assetTag: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/assets?search=${encodeURIComponent(assetTag)}&pageSize=1`)
      if (!response.ok) return false
      const data = await response.json()
      return data.assets?.some((a: { assetTagId: string; id: string }) => a.assetTagId === assetTag && a.id !== resolvedParams.id) || false
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
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await updateMutation.mutateAsync({ id: resolvedParams.id, data: updateData as any })

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

      router.push("/assets")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update asset')
    }
  }

  // Track form changes to show floating buttons
  const formValues = form.watch()
  const isFormDirty = useMemo(() => {
    if (!asset) return false
    return !!(
      formValues.assetTagId?.trim() !== asset.assetTagId ||
      formValues.description?.trim() !== asset.description ||
      formValues.brand?.trim() !== (asset.brand || '') ||
      formValues.model?.trim() !== (asset.model || '') ||
      formValues.serialNo?.trim() !== (asset.serialNo || '') ||
      formValues.cost !== (asset.cost?.toString() || '') ||
      formValues.assetType?.trim() !== (asset.assetType || '') ||
      formValues.location?.trim() !== (asset.location || '') ||
      formValues.department?.trim() !== (asset.department || '') ||
      formValues.site?.trim() !== (asset.site || '') ||
      formValues.owner?.trim() !== (asset.owner || '') ||
      formValues.issuedTo?.trim() !== (asset.issuedTo || '') ||
      formValues.purchasedFrom?.trim() !== (asset.purchasedFrom || '') ||
      formValues.purchaseDate !== (asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : '') ||
      formValues.poNumber?.trim() !== (asset.poNumber || '') ||
      formValues.xeroAssetNo?.trim() !== (asset.xeroAssetNo || '') ||
      formValues.remarks?.trim() !== (asset.remarks || '') ||
      formValues.additionalInformation?.trim() !== (asset.additionalInformation || '') ||
      formValues.categoryId !== (asset.categoryId || '') ||
      formValues.subCategoryId !== (asset.subCategoryId || '') ||
      selectedImages.length > 0 ||
      selectedDocuments.length > 0 ||
      selectedExistingImages.length > 0 ||
      selectedExistingDocuments.length > 0
    )
  }, [formValues, asset, selectedImages.length, selectedDocuments.length, selectedExistingImages.length, selectedExistingDocuments.length])

  // Clear form function
  const clearForm = () => {
    router.back()
  }

  // Show loading state while permissions or asset are being fetched
  if (permissionsLoading || assetLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
          <Spinner className="h-8 w-8" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
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
          <Link href="/assets">
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
          <Link href="/assets">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Assets
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Edit Asset</h1>
          <p className="text-muted-foreground">
            Update asset details and information
          </p>
        </div>
        <Link href="/assets">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Assets
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <ScrollArea className="max-w-sm sm:max-w-full border-b">
      <div className="flex items-center gap-2 ">
        <Button
          type="button"
          variant="ghost"
          onClick={() => handleTabChange('basic')}
          className={`px-4 py-2 h-auto text-sm font-medium transition-colors border-b-2 rounded-none ${
            activeTab === 'basic'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Basic Details
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => handleTabChange('media')}
          className={`px-4 py-2 h-auto text-sm font-medium transition-colors border-b-2 rounded-none ${
            activeTab === 'media'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Asset Media
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => handleTabChange('purchase')}
          className={`px-4 py-2 h-auto text-sm font-medium transition-colors border-b-2 rounded-none ${
            activeTab === 'purchase'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Purchase & Additional Information
        </Button>
        {hasCheckout && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleTabChange('checkout')}
            className={`px-4 py-2 h-auto text-sm font-medium transition-colors border-b-2 rounded-none ${
              activeTab === 'checkout'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4" />
              Checkout
            </span>
          </Button>
        )}
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
          <span className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Audit
          </span>
        </Button>
      </div>
      <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <div className="grid gap-2.5 md:grid-cols-2 mt-6">
          {/* Basic Information & Asset Details */}
          {activeTab === 'basic' && (
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
                        <Input
                          id="assetTagId"
                          {...(() => {
                            const { ref, onChange, ...rest } = form.register("assetTagId", {
                              onChange: (e) => {
                                const input = e.target as HTMLInputElement
                                const cursorPosition = input.selectionStart || 0
                                const oldValue = form.getValues("assetTagId") || ""
                                const newValue = e.target.value
                                
                                const formatted = formatAssetTag(newValue)
                                
                                // Calculate new cursor position
                                const beforeCursor = oldValue.substring(0, cursorPosition)
                                const nonFormattingBefore = beforeCursor.replace(/-/g, '').length
                                
                                let newCursorPosition = 0
                                let nonFormattingCount = 0
                                for (let i = 0; i < formatted.length; i++) {
                                  if (formatted[i] !== '-') {
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
                                
                                form.setValue("assetTagId", formatted, { shouldValidate: false })
                                
                                setTimeout(() => {
                                  if (assetTagIdInputRef.current) {
                                    assetTagIdInputRef.current.setSelectionRange(
                                      Math.min(newCursorPosition, formatted.length),
                                      Math.min(newCursorPosition, formatted.length)
                                    )
                                  }
                                }, 0)
                              }
                            })
                            return {
                              ...rest,
                              onChange,
                              ref: (e: HTMLInputElement | null) => {
                                assetTagIdInputRef.current = e
                                ref(e)
                              }
                            }
                          })()}
                          aria-invalid={form.formState.errors.assetTagId ? "true" : "false"}
                          placeholder="e.g., 25-016011U-SA"
                          className="flex-1"
                          maxLength={13}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleGenerateAssetTag}
                          title="Auto-generate asset tag"
                          className="shrink-0"
                          disabled={isGeneratingTag}
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
                      <textarea
                        id="description"
                        {...form.register("description")}
                        aria-invalid={form.formState.errors.description ? "true" : "false"}
                        className="min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
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
                            className="h-6 w-6"
                            onClick={() => setCategoryDialogOpen(true)}
                          >
                            <PlusIcon className="h-3.5 w-3.5" />
                          </Button>
                          <CategoryDialog
                            open={categoryDialogOpen}
                            onOpenChange={setCategoryDialogOpen}
                            onSubmit={handleCreateCategory}
                            mode="create"
                            isLoading={createCategoryMutation.isPending}
                          />
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
                            className="h-6 w-6"
                            onClick={() => setSubCategoryDialogOpen(true)}
                          >
                            <PlusIcon className="h-3.5 w-3.5" />
                          </Button>
                          <SubCategoryDialog
                            open={subCategoryDialogOpen}
                            onOpenChange={setSubCategoryDialogOpen}
                            onSubmit={handleCreateSubCategory}
                            mode="create"
                            categories={categories}
                            selectedCategoryName={categories.find(c => c.id === selectedCategory)?.name}
                            isLoading={createSubCategoryMutation.isPending}
                          />
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
          )}

          {/* Asset Images */}
          {activeTab === 'media' && (
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
          )}

          {/* Purchase & Additional Information */}
          {activeTab === 'purchase' && (
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
                    <Input
                      id="purchaseDate"
                      type="date"
                      {...form.register("purchaseDate")}
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
                  <FieldLabel htmlFor="additionalInformation">Additional Information</FieldLabel>
                  <FieldContent>
                    <textarea
                      id="additionalInformation"
                      {...form.register("additionalInformation")}
                      className="min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
                      placeholder="Any additional notes"
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="remarks">Remarks</FieldLabel>
                  <FieldContent>
                    <textarea
                      id="remarks"
                      {...form.register("remarks")}
                      className="min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
                      placeholder="Additional remarks"
                    />
                  </FieldContent>
                </Field>
              </div>
            </CardContent>
          </Card>
          )}

          {/* Checkout History */}
          {activeTab === 'checkout' && asset && (
            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Checkout History</CardTitle>
                <CardDescription className="text-xs">
                  View and manage checkout records for this asset
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2 pb-4">
                <ScrollArea className="max-h-[450px]">
                    <CheckoutManager 
                    assetId={asset.id} 
                    assetTagId={asset.assetTagId}
                    invalidateQueryKey={['asset', asset.id]}
                    />
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Audit History */}
          {activeTab === 'audit' && asset && (
            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Audit History</CardTitle>
                <CardDescription className="text-xs">
                  View and manage audit records for this asset
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2 pb-4">
                <ScrollArea className="max-h-[450px]">
                    <AuditHistoryManager 
                    assetId={asset.id} 
                    assetTagId={asset.assetTagId}
                    />
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </form>

      {/* Floating Action Buttons */}
      {isFormDirty && (
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
        </div>
      )}

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
        isLoading={createSubCategoryMutation.isPending}
      />
    </div>
  )
}

