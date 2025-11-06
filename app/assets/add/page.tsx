"use client"

import { useState, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon, Sparkles, ImageIcon, Upload, ChevronDown } from "lucide-react"
import { usePermissions } from '@/hooks/use-permissions'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { toast } from 'sonner'
import { useCategories, useSubCategories, useCreateCategory, useCreateSubCategory, useCreateAsset } from "@/hooks/use-categories"
import { CategoryDialog } from "@/components/category-dialog"
import { SubCategoryDialog } from "@/components/subcategory-dialog"
import { MediaBrowserDialog } from "@/components/media-browser-dialog"
import { ImagePreviewDialog } from "@/components/image-preview-dialog"
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
import { Field, FieldLabel, FieldContent } from "@/components/ui/field"
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
  const canCreateAssets = hasPermission('canCreateAssets')
  const canManageCategories = hasPermission('canManageCategories')
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  
  // React Query hooks
  const { data: categories = [] } = useCategories()
  const { data: subCategories = [] } = useSubCategories(selectedCategory || null)
  const createCategoryMutation = useCreateCategory()
  const createSubCategoryMutation = useCreateSubCategory()
  const createAssetMutation = useCreateAsset()
  
  const loading = createAssetMutation.isPending
  
  // Dialog states
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [subCategoryDialogOpen, setSubCategoryDialogOpen] = useState(false)
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [selectedExistingImages, setSelectedExistingImages] = useState<Array<{ id: string; imageUrl: string; fileName: string }>>([])
  const [uploadingImages, setUploadingImages] = useState(false)
  const [mediaBrowserOpen, setMediaBrowserOpen] = useState(false)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
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
    status: "",
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
  })

  // Reset subcategory when category changes
  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value)
    setFormData((prev) => ({ ...prev, categoryId: value, subCategoryId: "" }))
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!canCreateAssets) {
      toast.error('You do not have permission to create assets')
      return
    }

    try {
      // Create asset first
      await createAssetMutation.mutateAsync({
        ...formData,
        categoryId: selectedCategory || null,
      })

      // Upload images and link existing images after asset is created
      const totalImages = selectedImages.length + selectedExistingImages.length
      if (totalImages > 0 && formData.assetTagId) {
        setUploadingImages(true)
        try {
          // Upload new images
          if (selectedImages.length > 0) {
          await Promise.all(
            selectedImages.map(file => uploadImage(file, formData.assetTagId))
          )
          }
          // Link existing images
          if (selectedExistingImages.length > 0) {
            await Promise.all(
              selectedExistingImages.map(img => linkExistingImage(img.imageUrl, formData.assetTagId))
            )
          }
          toast.success(`Asset created successfully with ${totalImages} image(s)`)
        } catch (error) {
          console.error('Error uploading/linking images:', error)
          toast.error('Asset created but some images failed to upload/link')
        } finally {
          setUploadingImages(false)
        }
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked
    
    // Apply formatting to asset tag field
    if (name === 'assetTagId' && type !== 'checkbox') {
      const formatted = formatAssetTag(value)
      setFormData((prev) => ({
        ...prev,
        [name]: formatted,
      }))
      return
    }
    
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }))
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
    try {
      // Check if subcategory is selected
      if (!formData.subCategoryId) {
        toast.error('Please select a subcategory first to generate the asset tag')
        return
      }

      // Get year from purchase date or use current year
      let year: string
      if (formData.purchaseDate) {
        const purchaseYear = new Date(formData.purchaseDate).getFullYear()
        year = purchaseYear.toString().slice(-2) // Last 2 digits
      } else {
        year = new Date().getFullYear().toString().slice(-2)
      }

      // Get first letter of subcategory (required)
      const selectedSubCategory = subCategories.find(sc => sc.id === formData.subCategoryId)
      if (!selectedSubCategory?.name) {
        toast.error('Please select a valid subcategory first')
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
        return
      }

      // Set the generated tag
      setFormData((prev) => ({
        ...prev,
        assetTagId: generatedTag,
      }))

      toast.success('Asset tag generated successfully')
    } catch (error) {
      console.error('Error generating asset tag:', error)
      toast.error('Failed to generate asset tag')
    }
  }

  // Track form changes to show floating buttons
  const isFormDirty = useMemo(() => {
    return !!(
      formData.assetTagId.trim() ||
      formData.description.trim() ||
      formData.purchasedFrom.trim() ||
      formData.purchaseDate ||
      formData.brand.trim() ||
      formData.cost ||
      formData.model.trim() ||
      formData.serialNo.trim() ||
      formData.additionalInformation.trim() ||
      formData.xeroAssetNo.trim() ||
      formData.owner.trim() ||
      formData.status ||
      formData.issuedTo.trim() ||
      formData.poNumber.trim() ||
      formData.paymentVoucherNumber.trim() ||
      formData.assetType.trim() ||
      formData.deliveryDate ||
      formData.remarks.trim() ||
      formData.qr ||
      formData.oldAssetTag.trim() ||
      formData.depreciableAsset ||
      formData.depreciableCost ||
      formData.salvageValue ||
      formData.assetLifeMonths ||
      formData.depreciationMethod ||
      formData.dateAcquired ||
      formData.pbiNumber.trim() ||
      formData.unaccountedInventory ||
      formData.categoryId ||
      formData.subCategoryId ||
      formData.department.trim() ||
      formData.site.trim() ||
      formData.location.trim()
    )
  }, [formData])

  // Clear form function
  const clearForm = () => {
    setFormData({
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
      status: "",
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
    })
    setSelectedCategory("")
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

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-2.5 md:grid-cols-2">
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
                          name="assetTagId"
                          value={formData.assetTagId}
                          onChange={handleChange}
                          required
                          placeholder="e.g., 25-016011U-SA"
                          className="flex-1"
                          maxLength={13}
                          pattern="[0-9]{2}-[0-9]{6}[A-Z]-SA"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleGenerateAssetTag}
                          title="Auto-generate asset tag"
                          className="shrink-0"
                        >
                          <Sparkles className="h-4 w-4" />
                        </Button>
                      </div>
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="description">
                      Description <span className="text-destructive">*</span>
                    </FieldLabel>
                    <FieldContent>
                      <textarea
                        id="description"
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        required
                        className="min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
                        placeholder="Asset description"
                      />
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="status">Status</FieldLabel>
                    <FieldContent>
                      <Select
                        value={formData.status}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, status: value }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Available">Available</SelectItem>
                          <SelectItem value="Checked out">Checked out</SelectItem>
                          <SelectItem value="Maintenance">Maintenance</SelectItem>
                          <SelectItem value="Leased">Leased</SelectItem>
                          <SelectItem value="Sold">Sold</SelectItem>
                          <SelectItem value="Donated">Donated</SelectItem>
                          <SelectItem value="Scrapped">Scrapped</SelectItem>
                          <SelectItem value="Lost/Missing">Lost/Missing</SelectItem>
                          <SelectItem value="Destroyed">Destroyed</SelectItem>
                          <SelectItem value="Inactive">Inactive</SelectItem>
                          <SelectItem value="Disposed">Disposed</SelectItem>
                        </SelectContent>
                      </Select>
                    </FieldContent>
                  </Field>

                  <Field>
                    <div className="flex items-center justify-between w-full">
                      <FieldLabel htmlFor="category">Category</FieldLabel>
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
                      <Select
                        value={selectedCategory}
                        onValueChange={handleCategoryChange}
                      >
                        <SelectTrigger className="w-full">
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
                    </FieldContent>
                  </Field>

                  <Field>
                    <div className="flex items-center justify-between w-full">
                      <FieldLabel htmlFor="subCategory">Sub Category</FieldLabel>
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
                      <Select
                        value={formData.subCategoryId}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, subCategoryId: value }))
                        }
                        disabled={!selectedCategory}
                      >
                        <SelectTrigger className="w-full" disabled={!selectedCategory}>
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
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="brand">Brand</FieldLabel>
                    <FieldContent>
                      <Input
                        id="brand"
                        name="brand"
                        value={formData.brand}
                        onChange={handleChange}
                        placeholder="e.g., Dell, HP"
                      />
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="model">Model</FieldLabel>
                    <FieldContent>
                      <Input
                        id="model"
                        name="model"
                        value={formData.model}
                        onChange={handleChange}
                        placeholder="e.g., OptiPlex 3090"
                      />
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="serialNo">Serial Number</FieldLabel>
                    <FieldContent>
                      <Input
                        id="serialNo"
                        name="serialNo"
                        value={formData.serialNo}
                        onChange={handleChange}
                        placeholder="Serial number"
                      />
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="assetType">Asset Type</FieldLabel>
                    <FieldContent>
                      <Input
                        id="assetType"
                        name="assetType"
                        value={formData.assetType}
                        onChange={handleChange}
                        placeholder="e.g., Desktop, Laptop, Monitor"
                      />
                    </FieldContent>
                  </Field>

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
                            
                            // Reset input
                            if (imageInputRef.current) {
                              imageInputRef.current.value = ''
                            }
                          }}
                        />
                        
                        {/* Single button with dropdown and count */}
                        <div className="flex items-center gap-2">
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
                        </div>

                        {/* Supported formats info */}
                        <p className="text-sm text-muted-foreground">
                          Supported formats: JPEG, PNG, GIF, WebP (Max 5MB per image)
                        </p>
                      </div>
                    </FieldContent>
                  </Field>
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
                      name="purchasedFrom"
                      value={formData.purchasedFrom}
                      onChange={handleChange}
                      placeholder="Vendor name"
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="purchaseDate">Purchase Date</FieldLabel>
                  <FieldContent>
                    <Input
                      id="purchaseDate"
                      name="purchaseDate"
                      type="date"
                      value={formData.purchaseDate}
                      onChange={handleChange}
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="cost">Cost</FieldLabel>
                  <FieldContent>
                    <Input
                      id="cost"
                      name="cost"
                      type="number"
                      step="0.01"
                      value={formData.cost}
                      onChange={handleChange}
                      placeholder="0.00"
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="poNumber">PO Number</FieldLabel>
                  <FieldContent>
                    <Input
                      id="poNumber"
                      name="poNumber"
                      value={formData.poNumber}
                      onChange={handleChange}
                      placeholder="Purchase order number"
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="department">Department</FieldLabel>
                  <FieldContent>
                    <Input
                      id="department"
                      name="department"
                      value={formData.department}
                      onChange={handleChange}
                      placeholder="Department name"
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="site">Site</FieldLabel>
                  <FieldContent>
                    <Input
                      id="site"
                      name="site"
                      value={formData.site}
                      onChange={handleChange}
                      placeholder="Site location"
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="location">Location</FieldLabel>
                  <FieldContent>
                    <Input
                      id="location"
                      name="location"
                      value={formData.location}
                      onChange={handleChange}
                      placeholder="Specific location"
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="owner">Owner</FieldLabel>
                  <FieldContent>
                    <Input
                      id="owner"
                      name="owner"
                      value={formData.owner}
                      onChange={handleChange}
                      placeholder="Asset owner"
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="issuedTo">Issued To</FieldLabel>
                  <FieldContent>
                    <Input
                      id="issuedTo"
                      name="issuedTo"
                      value={formData.issuedTo}
                      onChange={handleChange}
                      placeholder="Person issued to"
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="xeroAssetNo">Xero Asset Number</FieldLabel>
                  <FieldContent>
                    <Input
                      id="xeroAssetNo"
                      name="xeroAssetNo"
                      value={formData.xeroAssetNo}
                      onChange={handleChange}
                      placeholder="Xero reference"
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="qr">QR Code</FieldLabel>
                  <FieldContent>
                    <Select
                      value={formData.qr}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, qr: value }))
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select option" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="YES">YES</SelectItem>
                        <SelectItem value="NO">NO</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="pbiNumber">PBI Number</FieldLabel>
                  <FieldContent>
                    <Input
                      id="pbiNumber"
                      name="pbiNumber"
                      value={formData.pbiNumber}
                      onChange={handleChange}
                      placeholder="PBI number"
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="additionalInformation">Additional Information</FieldLabel>
                  <FieldContent>
                    <textarea
                      id="additionalInformation"
                      name="additionalInformation"
                      value={formData.additionalInformation}
                      onChange={handleChange}
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
                      name="remarks"
                      value={formData.remarks}
                      onChange={handleChange}
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
                      <input
                        type="checkbox"
                        id="depreciableAsset"
                        name="depreciableAsset"
                        checked={formData.depreciableAsset}
                        onChange={handleChange}
                        className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                      />
                      <FieldLabel htmlFor="depreciableAsset" className="cursor-pointer font-medium">
                        Depreciable Asset
                      </FieldLabel>
                    </div>
                  </Field>

                  <Field>
                    <div className="flex items-center space-x-2.5 py-1">
                      <input
                        type="checkbox"
                        id="unaccountedInventory"
                        name="unaccountedInventory"
                        checked={formData.unaccountedInventory}
                        onChange={handleChange}
                        className="h-4 w-4 rounded border-gray-300 cursor-pointer"
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
                        name="depreciableCost"
                        type="number"
                        step="0.01"
                        value={formData.depreciableCost}
                        onChange={handleChange}
                        placeholder="0.00"
                      />
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="salvageValue">Salvage Value</FieldLabel>
                    <FieldContent>
                      <Input
                        id="salvageValue"
                        name="salvageValue"
                        type="number"
                        step="0.01"
                        value={formData.salvageValue}
                        onChange={handleChange}
                        placeholder="0.00"
                      />
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
                        name="assetLifeMonths"
                        type="number"
                        value={formData.assetLifeMonths}
                        onChange={handleChange}
                        placeholder="e.g., 36"
                      />
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="dateAcquired">Date Acquired</FieldLabel>
                    <FieldContent>
                      <Input
                        id="dateAcquired"
                        name="dateAcquired"
                        type="date"
                        value={formData.dateAcquired}
                        onChange={handleChange}
                      />
                    </FieldContent>
                  </Field>
                </div>

                {/* Depreciation Method */}
                <Field>
                  <FieldLabel htmlFor="depreciationMethod">Depreciation Method</FieldLabel>
                  <FieldContent>
                    <Select
                      value={formData.depreciationMethod}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, depreciationMethod: value }))
                      }
                    >
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
                  </FieldContent>
                </Field>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>

      {/* Floating Action Buttons - Only show when form has changes */}
      {isFormDirty && (
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
            disabled={loading || uploadingImages}
            className="min-w-[120px]"
          >
            {loading || uploadingImages ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                {uploadingImages ? 'Uploading Images...' : 'Creating...'}
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

      {/* Image Preview Dialog */}
      <ImagePreviewDialog
        open={previewDialogOpen}
        onOpenChange={setPreviewDialogOpen}
        images={selectedImages}
        existingImages={selectedExistingImages}
        onRemoveImage={(index) => {
          setSelectedImages(prev => prev.filter((_, i) => i !== index))
        }}
        onRemoveExistingImage={(id) => {
          setSelectedExistingImages(prev => prev.filter(img => img.id !== id))
        }}
        title="Selected Images"
        description="Preview and manage your selected images. Click the remove button to remove an image from the list."
      />

    </div>
  )
}
