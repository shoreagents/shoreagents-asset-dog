"use client"

import { useState, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, Sparkles, ImageIcon, Upload, ChevronDown, Info, FileText } from "lucide-react"
import { usePermissions } from '@/hooks/use-permissions'
import { useSidebar } from '@/components/ui/sidebar'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { toast } from 'sonner'
import { useCategories, useSubCategories, useCreateCategory, useCreateSubCategory, useCreateAsset } from "@/hooks/use-categories"
import { CategoryDialog } from "@/components/category-dialog"
import { SubCategoryDialog } from "@/components/subcategory-dialog"
import { MediaBrowserDialog } from "@/components/media-browser-dialog"
import { DocumentBrowserDialog } from "@/components/document-browser-dialog"
import { SelectedImagesListDialog } from "@/components/selected-images-list-dialog"
import { SelectedDocumentsListDialog } from "@/components/selected-documents-list-dialog"
import { assetSchema, type AssetFormData } from "@/lib/validations/assets"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Category, SubCategory } from "@/hooks/use-categories"

export default function AddAssetPage() {
  const router = useRouter()
  const { hasPermission, isLoading } = usePermissions()
  const { state: sidebarState, open: sidebarOpen } = useSidebar()
  const canCreateAssets = hasPermission('canCreateAssets')
  const canManageCategories = hasPermission('canManageCategories')
  
  // React Query hooks - will be set up after form initialization
  const { data: categories = [] } = useCategories()
  const createCategoryMutation = useCreateCategory()
  const createSubCategoryMutation = useCreateSubCategory()
  const createAssetMutation = useCreateAsset()
  
  const loading = createAssetMutation.isPending
  
  // Dialog states
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [subCategoryDialogOpen, setSubCategoryDialogOpen] = useState(false)
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [selectedExistingImages, setSelectedExistingImages] = useState<Array<{ id: string; imageUrl: string; fileName: string }>>([])
  const [selectedDocuments, setSelectedDocuments] = useState<File[]>([])
  const [selectedExistingDocuments, setSelectedExistingDocuments] = useState<Array<{ id: string; documentUrl: string; fileName: string }>>([])
  const [uploadingImages, setUploadingImages] = useState(false)
  const [uploadingDocuments, setUploadingDocuments] = useState(false)
  const [mediaBrowserOpen, setMediaBrowserOpen] = useState(false)
  const [documentBrowserOpen, setDocumentBrowserOpen] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [documentValidationError, setDocumentValidationError] = useState<string | null>(null)
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const [documentTooltipOpen, setDocumentTooltipOpen] = useState(false)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [previewDocumentsDialogOpen, setPreviewDocumentsDialogOpen] = useState(false)
  const [isGeneratingTag, setIsGeneratingTag] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)
  const assetTagIdInputRef = useRef<HTMLInputElement>(null)

  const form = useForm<AssetFormData>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
    assetTagId: "",
    description: "",
    purchasedFrom: "",
    purchaseDate: "",
    brand: "",
    cost: "",
    model: "",
    serialNo: "",
    additionalInformation: "",
    xeroAssetNo: "",
    owner: "",
      status: "Available",
    issuedTo: "",
    poNumber: "",
    paymentVoucherNumber: "",
    assetType: "",
    deliveryDate: "",
    remarks: "",
    qr: "",
    oldAssetTag: "",
    depreciableAsset: false,
    depreciableCost: "",
    salvageValue: "",
    assetLifeMonths: "",
    depreciationMethod: "",
    dateAcquired: "",
    pbiNumber: "",
    unaccountedInventory: false,
    categoryId: "",
    subCategoryId: "",
    department: "",
    site: "",
    location: "",
    },
  })

  // Watch categoryId to sync with selectedCategory state
  const categoryId = form.watch("categoryId")
  const selectedCategory = categoryId || ""
  const { data: subCategories = [] } = useSubCategories(selectedCategory || null)

  // Reset subcategory when category changes
  const handleCategoryChange = (value: string) => {
    form.setValue("categoryId", value)
    form.setValue("subCategoryId", "")
  }

  const handleCreateCategory = async (data: { name: string; description?: string }) => {
    if (!canManageCategories) {
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
    if (!canManageCategories) {
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


  const uploadImage = async (file: File, assetTagId: string): Promise<void> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('assetTagId', assetTagId)

    const response = await fetch('/api/assets/upload-image', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to upload image')
    }
  }

  // Link an existing image URL to a new asset
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

  const uploadDocument = async (file: File, assetTagId: string): Promise<void> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('assetTagId', assetTagId)

    const response = await fetch('/api/assets/upload-document', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to upload document')
    }
  }

  // Link an existing document URL to a new asset
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

  const onSubmit = async (data: AssetFormData) => {
    if (!canCreateAssets) {
      toast.error('You do not have permission to create assets')
      return
    }

    try {
      // Create asset first
      await createAssetMutation.mutateAsync({
        ...data,
        categoryId: data.categoryId || null,
        status: data.status || "Available", // Ensure status defaults to "Available"
      })

      // Upload images and link existing images after asset is created
      const totalImages = selectedImages.length + selectedExistingImages.length
      const totalDocuments = selectedDocuments.length + selectedExistingDocuments.length
      
      if (totalImages > 0 && data.assetTagId) {
        setUploadingImages(true)
        try {
          // Upload new images
          if (selectedImages.length > 0) {
          await Promise.all(
            selectedImages.map(file => uploadImage(file, data.assetTagId))
          )
          }
          // Link existing images
          if (selectedExistingImages.length > 0) {
            await Promise.all(
              selectedExistingImages.map(img => linkExistingImage(img.imageUrl, data.assetTagId))
            )
          }
        } catch (error) {
          console.error('Error uploading/linking images:', error)
          toast.error('Asset created but some images failed to upload/link')
        } finally {
          setUploadingImages(false)
        }
      }

      // Upload documents and link existing documents after asset is created
      if (totalDocuments > 0 && data.assetTagId) {
        setUploadingDocuments(true)
        try {
          // Upload new documents
          if (selectedDocuments.length > 0) {
            await Promise.all(
              selectedDocuments.map(file => uploadDocument(file, data.assetTagId))
            )
          }
          // Link existing documents
          if (selectedExistingDocuments.length > 0) {
            await Promise.all(
              selectedExistingDocuments.map(doc => linkExistingDocument(doc.documentUrl, data.assetTagId))
            )
          }
        } catch (error) {
          console.error('Error uploading/linking documents:', error)
          toast.error('Asset created but some documents failed to upload/link')
        } finally {
          setUploadingDocuments(false)
        }
      }

      // Show success message
      if (totalImages > 0 || totalDocuments > 0) {
        const parts: string[] = []
        if (totalImages > 0) parts.push(`${totalImages} image${totalImages !== 1 ? 's' : ''}`)
        if (totalDocuments > 0) parts.push(`${totalDocuments} document${totalDocuments !== 1 ? 's' : ''}`)
        toast.success(`Asset created successfully with ${parts.join(' and ')}`)
      } else {
        toast.success('Asset created successfully')
      }

      router.push("/assets")
      router.refresh()
    } catch {
      toast.error('Failed to create asset')
    }
  }

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

  // Check if asset tag exists
  const checkAssetTagExists = async (assetTag: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/assets?search=${encodeURIComponent(assetTag)}&pageSize=1`)
      if (!response.ok) return false
      const data = await response.json()
      return data.assets?.some((asset: { assetTagId: string }) => asset.assetTagId === assetTag) || false
    } catch {
      return false
    }
  }

  // Generate unique asset tag
  const handleGenerateAssetTag = async () => {
    setIsGeneratingTag(true)
    try {
      // Check if subcategory is selected
      const subCategoryId = form.getValues("subCategoryId")
      if (!subCategoryId) {
        toast.error('Please select a subcategory first to generate the asset tag')
        setIsGeneratingTag(false)
        return
      }

      // Get year from purchase date or use current year
      const purchaseDate = form.getValues("purchaseDate")
      let year: string
      if (purchaseDate) {
        const purchaseYear = new Date(purchaseDate).getFullYear()
        year = purchaseYear.toString().slice(-2) // Last 2 digits
      } else {
        year = new Date().getFullYear().toString().slice(-2)
      }

      // Get first letter of subcategory (required)
      const currentSubCategoryId = form.getValues("subCategoryId")
      const selectedSubCategory = subCategories.find(sc => sc.id === currentSubCategoryId)
      if (!selectedSubCategory?.name) {
        toast.error('Please select a valid subcategory first')
        setIsGeneratingTag(false)
        return
      }
      const subCategoryLetter = selectedSubCategory.name.charAt(0).toUpperCase()

      // Generate unique tag (retry up to 100 times to find unique)
      let attempts = 0
      let generatedTag = ''
      let isUnique = false

      while (!isUnique && attempts < 100) {
        // Generate 6-digit random number (000000-999999)
        const randomNum = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
        
        // Build tag: YY-XXXXXX[S]-SA
        generatedTag = `${year}-${randomNum}${subCategoryLetter}-SA`
        
        // Check if tag exists
        const exists = await checkAssetTagExists(generatedTag)
        if (!exists) {
          isUnique = true
        }
        attempts++
      }

      if (!isUnique) {
        toast.error('Failed to generate unique asset tag. Please try again.')
        setIsGeneratingTag(false)
        return
      }

      // Set the generated tag and trigger validation
      form.setValue("assetTagId", generatedTag, { shouldValidate: true })

      toast.success('Asset tag generated successfully')
    } catch (error) {
      console.error('Error generating asset tag:', error)
      toast.error('Failed to generate asset tag')
    } finally {
      setIsGeneratingTag(false)
    }
  }

  // Track form changes to show floating buttons
  const formValues = form.watch()
  const isFormDirty = useMemo(() => {
    return !!(
      formValues.assetTagId?.trim() ||
      formValues.description?.trim() ||
      formValues.purchasedFrom?.trim() ||
      formValues.purchaseDate ||
      formValues.brand?.trim() ||
      formValues.cost ||
      formValues.model?.trim() ||
      formValues.serialNo?.trim() ||
      formValues.additionalInformation?.trim() ||
      formValues.xeroAssetNo?.trim() ||
      formValues.owner?.trim() ||
      (formValues.status && formValues.status !== "Available") ||
      formValues.issuedTo?.trim() ||
      formValues.poNumber?.trim() ||
      formValues.paymentVoucherNumber?.trim() ||
      formValues.assetType?.trim() ||
      formValues.deliveryDate ||
      formValues.remarks?.trim() ||
      formValues.qr ||
      formValues.oldAssetTag?.trim() ||
      formValues.depreciableAsset ||
      formValues.depreciableCost ||
      formValues.salvageValue ||
      formValues.assetLifeMonths ||
      formValues.depreciationMethod ||
      formValues.dateAcquired ||
      formValues.pbiNumber?.trim() ||
      formValues.unaccountedInventory ||
      formValues.categoryId ||
      formValues.subCategoryId ||
      formValues.department?.trim() ||
      formValues.site?.trim() ||
      formValues.location?.trim() ||
      selectedImages.length > 0 ||
      selectedExistingImages.length > 0 ||
      selectedDocuments.length > 0 ||
      selectedExistingDocuments.length > 0
    )
  }, [formValues, selectedImages, selectedExistingImages, selectedDocuments, selectedExistingDocuments])

  // Clear form function
  const clearForm = () => {
    form.reset()
  }

  // Show loading state while permissions are being fetched
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
          <Spinner className="h-8 w-8" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Show access denied only after permissions have loaded
  if (!canCreateAssets) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex flex-col items-center gap-4 max-w-md">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <PlusIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Access Denied</h2>
            <p className="text-muted-foreground mt-2">
              You do not have permission to create assets. Please contact your administrator if you need access.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={isFormDirty ? "pb-16" : ""}>
      <div>
        <h1 className="text-3xl font-bold">Add Asset</h1>
        <p className="text-muted-foreground">
          Create a new asset in the system
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <div className="grid gap-2.5 md:grid-cols-2 mt-6">
          {/* Basic Information & Asset Details */}
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
                                // Count characters before cursor in old value
                                const beforeCursor = oldValue.substring(0, cursorPosition)
                                // Count non-formatting characters (excluding hyphens)
                                const nonFormattingBefore = beforeCursor.replace(/-/g, '').length
                                
                                // Find position in formatted string
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
                                
                                // Set the formatted value
                                form.setValue("assetTagId", formatted, { shouldValidate: false })
                                
                                // Restore cursor position after a brief delay to ensure DOM update
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
                    <FieldLabel htmlFor="status">Status</FieldLabel>
                    <FieldContent>
                      <Controller
                        name="status"
                        control={form.control}
                        render={({ field }) => (
                          <Select value={field.value || "Available"} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Available">Available</SelectItem>
                        </SelectContent>
                      </Select>
                        )}
                      />
                    </FieldContent>
                  </Field>

                  <Field>
                    <div className="flex items-center justify-between w-full">
                      <FieldLabel htmlFor="category">
                        Category <span className="text-destructive">*</span>
                      </FieldLabel>
                      {canManageCategories && (
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
                      {canManageCategories && (
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="images">Asset Images</FieldLabel>
                    <FieldContent>
                      <div className="space-y-4">
                        {/* Hidden file input */}
                        <input
                          ref={imageInputRef}
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            const files = Array.from(e.target.files || [])
                            
                            // Validate file types
                            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
                            const maxSize = 5 * 1024 * 1024 // 5MB
                            
                              const errors: string[] = []
                            const validFiles = files.filter(file => {
                              if (!allowedTypes.includes(file.type)) {
                                  errors.push(`${file.name} is not a valid image type. Only JPEG, PNG, GIF, and WebP are allowed.`)
                                toast.error(`${file.name} is not a valid image type. Only JPEG, PNG, GIF, and WebP are allowed.`)
                                return false
                              }
                              if (file.size > maxSize) {
                                  errors.push(`${file.name} is too large. Maximum size is 5MB.`)
                                toast.error(`${file.name} is too large. Maximum size is 5MB.`)
                                return false
                              }
                              return true
                            })

                              // Set validation error and open tooltip if there are errors
                              if (errors.length > 0) {
                                setValidationError(errors.join(' '))
                                setTooltipOpen(true)
                                // Auto-close tooltip after 5 seconds
                                setTimeout(() => {
                                  setTooltipOpen(false)
                                  setValidationError(null)
                                }, 5000)
                              } else {
                                setValidationError(null)
                                setTooltipOpen(false)
                              }

                            setSelectedImages(prev => [...prev, ...validFiles])
                            
                            // Reset input
                            if (imageInputRef.current) {
                              imageInputRef.current.value = ''
                            }
                          }}
                        />
                        
                        {/* Single button with dropdown and count */}
                          <div className="flex items-center gap-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                className="flex items-center gap-2"
                              >
                                <Upload className="h-4 w-4" />
                                Add Images
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              <DropdownMenuItem
                                onClick={() => {
                                  imageInputRef.current?.click()
                                }}
                              >
                                <Upload className="mr-2 h-4 w-4" />
                                Upload Images
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setMediaBrowserOpen(true)
                                }}
                              >
                                <ImageIcon className="mr-2 h-4 w-4" />
                                Select from Media
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          
                          {/* Selected Images Count */}
                          {(selectedImages.length > 0 || selectedExistingImages.length > 0) && (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => setPreviewDialogOpen(true)}
                              className="text-sm text-muted-foreground hover:text-foreground"
                            >
                              {selectedImages.length + selectedExistingImages.length} image{(selectedImages.length + selectedExistingImages.length) !== 1 ? 's' : ''} selected
                            </Button>
                          )}

                            {/* Supported formats info */}
                            <Tooltip open={tooltipOpen || undefined} onOpenChange={(open) => {
                              // Allow manual control when no validation error, or when closing after error
                              if (!validationError || !open) {
                                setTooltipOpen(open ?? false)
                              }
                            }}>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
                                  aria-label="Image format requirements"
                                >
                                  <Info className="h-4 w-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" >
                                {validationError ? (
                                  <>
                                    <p className="text-xs text-red-500">{validationError}</p>
                                  </>
                                ) : (
                                  <p className="text-xs">Supported formats: JPEG, PNG, GIF, WebP (Max 5MB per image)</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                        </div>
                        </div>
                      </FieldContent>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="documents">Asset Documents</FieldLabel>
                      <FieldContent>
                        <div className="space-y-4">
                          {/* Hidden file input for documents */}
                          <input
                            ref={documentInputRef}
                            type="file"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.rtf,.jpg,.jpeg,.png,.gif,.webp"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              const files = Array.from(e.target.files || [])
                              
                              // Validate file types
                              const allowedTypes = [
                                'application/pdf',
                                'application/msword',
                                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                                'application/vnd.ms-excel',
                                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                                'text/plain',
                                'text/csv',
                                'application/rtf',
                                'image/jpeg',
                                'image/jpg',
                                'image/png',
                                'image/gif',
                                'image/webp',
                              ]
                              const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv', '.rtf', '.jpg', '.jpeg', '.png', '.gif', '.webp']
                              const maxSize = 5 * 1024 * 1024 // 5MB
                              
                              const errors: string[] = []
                              const validFiles = files.filter(file => {
                                const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
                                if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
                                  errors.push(`${file.name} is not a valid document type. Only PDF, DOC, DOCX, XLS, XLSX, TXT, CSV, RTF, JPEG, PNG, GIF, and WebP are allowed.`)
                                  toast.error(`${file.name} is not a valid document type.`)
                                  return false
                                }
                                if (file.size > maxSize) {
                                  errors.push(`${file.name} is too large. Maximum size is 5MB.`)
                                  toast.error(`${file.name} is too large. Maximum size is 5MB.`)
                                  return false
                                }
                                return true
                              })

                              // Set validation error and open tooltip if there are errors
                              if (errors.length > 0) {
                                setDocumentValidationError(errors.join(' '))
                                setDocumentTooltipOpen(true)
                                // Auto-close tooltip after 5 seconds
                                setTimeout(() => {
                                  setDocumentTooltipOpen(false)
                                  setDocumentValidationError(null)
                                }, 5000)
                              } else {
                                setDocumentValidationError(null)
                                setDocumentTooltipOpen(false)
                              }

                              setSelectedDocuments(prev => [...prev, ...validFiles])
                              
                              // Reset input
                              if (documentInputRef.current) {
                                documentInputRef.current.value = ''
                              }
                            }}
                          />
                          
                          {/* Single button with dropdown and count */}
                          <div className="flex items-center gap-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="flex items-center gap-2"
                                >
                                  <Upload className="h-4 w-4" />
                                  Add Documents
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                <DropdownMenuItem
                                  onClick={() => {
                                    documentInputRef.current?.click()
                                  }}
                                >
                                  <Upload className="mr-2 h-4 w-4" />
                                  Upload Documents
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setDocumentBrowserOpen(true)
                                  }}
                                >
                                  <FileText className="mr-2 h-4 w-4" />
                                  Select from Media
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            
                            {/* Selected Documents Count */}
                            {(selectedDocuments.length > 0 || selectedExistingDocuments.length > 0) && (
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setPreviewDocumentsDialogOpen(true)}
                                className="text-sm text-muted-foreground hover:text-foreground"
                              >
                                {selectedDocuments.length + selectedExistingDocuments.length} document{(selectedDocuments.length + selectedExistingDocuments.length) !== 1 ? 's' : ''} selected
                              </Button>
                            )}

                        {/* Supported formats info */}
                            <Tooltip open={documentTooltipOpen || undefined} onOpenChange={(open) => {
                              // Allow manual control when no validation error, or when closing after error
                              if (!documentValidationError || !open) {
                                setDocumentTooltipOpen(open ?? false)
                              }
                            }}>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
                                  aria-label="Document format requirements"
                                >
                                  <Info className="h-4 w-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                {documentValidationError ? (
                                  <>
                                    <p className="text-xs text-red-500">{documentValidationError}</p>
                                  </>
                                ) : (
                                  <p className="text-xs">Supported formats: PDF, DOC, DOCX, XLS, XLSX, TXT, CSV, RTF, JPEG, PNG, GIF, WebP (Max 5MB per document)</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                      </div>
                    </FieldContent>
                  </Field>
                  </div>

                  
              </div>
            </CardContent>
          </Card>

          {/* Purchase & Additional Information */}
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

                <Field>
                  <FieldLabel htmlFor="department">Department</FieldLabel>
                  <FieldContent>
                    <Input
                      id="department"
                      {...form.register("department")}
                      placeholder="Department name"
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="site">Site</FieldLabel>
                  <FieldContent>
                    <Input
                      id="site"
                      {...form.register("site")}
                      placeholder="Site location"
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="location">Location</FieldLabel>
                  <FieldContent>
                    <Input
                      id="location"
                      {...form.register("location")}
                      placeholder="Specific location"
                    />
                  </FieldContent>
                </Field>

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
                  <FieldLabel htmlFor="qr">QR Code</FieldLabel>
                  <FieldContent>
                    <Controller
                      name="qr"
                      control={form.control}
                      render={({ field }) => (
                        <Select value={field.value || ""} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select option" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="YES">YES</SelectItem>
                        <SelectItem value="NO">NO</SelectItem>
                      </SelectContent>
                    </Select>
                      )}
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

          {/* Depreciation Information */}
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Depreciation Information</CardTitle>
              <CardDescription className="text-xs">
                Depreciation details and asset lifecycle
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-4">
              <div className="space-y-4">
                {/* Checkboxes Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field>
                    <div className="flex items-center space-x-2.5 py-1">
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
                      <FieldLabel htmlFor="depreciableAsset" className="cursor-pointer font-medium">
                        Depreciable Asset
                      </FieldLabel>
                    </div>
                  </Field>

                  <Field>
                    <div className="flex items-center space-x-2.5 py-1">
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
                      <FieldLabel htmlFor="unaccountedInventory" className="cursor-pointer font-medium">
                        Unaccounted Inventory
                      </FieldLabel>
                    </div>
                  </Field>
                </div>

                {/* Cost and Value Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
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
                </div>

                {/* Lifecycle Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                  <Field>
                    <FieldLabel htmlFor="assetLifeMonths">Asset Life (Months)</FieldLabel>
                    <FieldContent>
                      <Input
                        id="assetLifeMonths"
                        type="number"
                        {...form.register("assetLifeMonths")}
                        placeholder="e.g., 36"
                      />
                      {form.formState.errors.assetLifeMonths && (
                        <FieldError>{form.formState.errors.assetLifeMonths.message}</FieldError>
                      )}
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="dateAcquired">Date Acquired</FieldLabel>
                    <FieldContent>
                      <Input
                        id="dateAcquired"
                        type="date"
                        {...form.register("dateAcquired")}
                      />
                    </FieldContent>
                  </Field>
                </div>

                {/* Depreciation Method */}
                <Field>
                  <FieldLabel htmlFor="depreciationMethod">Depreciation Method</FieldLabel>
                  <FieldContent>
                    <Controller
                      name="depreciationMethod"
                      control={form.control}
                      render={({ field }) => (
                        <Select value={field.value || ""} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select method" />
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
                  </FieldContent>
                </Field>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>

      {/* Floating Action Buttons - Only show when form has changes */}
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
              const form = document.querySelector('form') as HTMLFormElement
              if (form) {
                form.requestSubmit()
              }
            }}
            disabled={loading || uploadingImages || uploadingDocuments}
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

      {/* Media Browser Dialog */}
      <MediaBrowserDialog
        open={mediaBrowserOpen}
        onOpenChange={setMediaBrowserOpen}
        selectedImages={selectedExistingImages}
        onSelectImages={setSelectedExistingImages}
        pageSize={24}
      />

      {/* Document Browser Dialog */}
      <DocumentBrowserDialog
        open={documentBrowserOpen}
        onOpenChange={setDocumentBrowserOpen}
        selectedDocuments={selectedExistingDocuments}
        onSelectDocuments={setSelectedExistingDocuments}
        pageSize={24}
      />

      {/* Selected Images List Dialog */}
      <SelectedImagesListDialog
        open={previewDialogOpen}
        onOpenChange={setPreviewDialogOpen}
        images={selectedImages}
        existingImages={selectedExistingImages}
        onRemoveImage={(index: number) => {
          setSelectedImages(prev => prev.filter((_, i) => i !== index))
        }}
        onRemoveExistingImage={(id: string) => {
          setSelectedExistingImages(prev => prev.filter(img => img.id !== id))
        }}
        title="Selected Images"
        description="Preview and manage your selected images. Click the remove button to remove an image from the list."
      />

      {/* Selected Documents List Dialog */}
      <SelectedDocumentsListDialog
        open={previewDocumentsDialogOpen}
        onOpenChange={setPreviewDocumentsDialogOpen}
        documents={selectedDocuments}
        existingDocuments={selectedExistingDocuments}
        onRemoveDocument={(index: number) => {
          setSelectedDocuments(prev => prev.filter((_, i) => i !== index))
        }}
        onRemoveExistingDocument={(id: string) => {
          setSelectedExistingDocuments(prev => prev.filter(doc => doc.id !== id))
        }}
        title="Selected Documents"
        description="Preview and manage your selected documents. Click the remove button to remove a document from the list."
      />

    </div>
  )
}
