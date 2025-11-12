'use client'

import { useState, useEffect, useRef, useMemo, useCallback, useTransition } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { MediaBrowserDialog } from '@/components/media-browser-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Field, FieldLabel, FieldContent, FieldError } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Controller } from 'react-hook-form'
import { Upload, Image as ImageIcon, Eye, X, PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { ImagePreviewDialog } from '@/components/image-preview-dialog'
import { editAssetSchema, type EditAssetFormData } from '@/lib/validations/assets'
import { useCategories, useSubCategories, useCreateCategory, useCreateSubCategory, type Category } from '@/hooks/use-categories'
import { CategoryDialog } from '@/components/category-dialog'
import { SubCategoryDialog } from '@/components/subcategory-dialog'
import { usePermissions } from '@/hooks/use-permissions'

async function updateAsset(id: string, data: Partial<Asset>) {
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

interface Asset {
  id: string
  assetTagId: string
  description: string
  brand: string | null
  model: string | null
  serialNo: string | null
  cost: number | null
  assetType: string | null
  location: string | null
  department: string | null
  site: string | null
  owner: string | null
  issuedTo: string | null
  purchasedFrom: string | null
  purchaseDate: string | null
  poNumber: string | null
  xeroAssetNo: string | null
  remarks: string | null
  additionalInformation: string | null
  categoryId: string | null
  subCategoryId: string | null
}

interface EditAssetDialogProps {
  asset: Asset
  open: boolean
  onOpenChange: (open: boolean) => void
  onPreviewImage?: (imageUrl: string) => void
}

export function EditAssetDialog({
  asset,
  open,
  onOpenChange,
}: EditAssetDialogProps) {
  const queryClient = useQueryClient()
  const { hasPermission } = usePermissions()
  const canManageCategories = hasPermission('canManageCategories')
  const [isCheckingAssetTag, setIsCheckingAssetTag] = useState(false)
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [selectedExistingImages, setSelectedExistingImages] = useState<Array<{ id: string; imageUrl: string; fileName: string }>>([])
  const [uploadingImages, setUploadingImages] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [imageToDelete, setImageToDelete] = useState<string | null>(null)
  const [isDeleteImageDialogOpen, setIsDeleteImageDialogOpen] = useState(false)
  const [isDeletingImage, setIsDeletingImage] = useState(false)
  const [mediaBrowserOpen, setMediaBrowserOpen] = useState(false)
  const [previewImageIndex, setPreviewImageIndex] = useState(0)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [, startTransition] = useTransition()
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [subCategoryDialogOpen, setSubCategoryDialogOpen] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)

  // Categories and subcategories - only fetch when dialog is open to avoid unnecessary requests
  const { data: categories = [] } = useCategories(open)
  const createCategoryMutation = useCreateCategory()
  const createSubCategoryMutation = useCreateSubCategory()

  const form = useForm<EditAssetFormData>({
    resolver: zodResolver(editAssetSchema),
    defaultValues: {
      assetTagId: asset.assetTagId,
      description: asset.description,
      brand: asset.brand || '',
      model: asset.model || '',
      serialNo: asset.serialNo || '',
      cost: asset.cost?.toString() || '',
      assetType: asset.assetType || '',
      location: asset.location || '',
      department: asset.department || '',
      site: asset.site || '',
      owner: asset.owner || '',
      issuedTo: asset.issuedTo || '',
      purchasedFrom: asset.purchasedFrom || '',
      purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : '',
      poNumber: asset.poNumber || '',
      xeroAssetNo: asset.xeroAssetNo || '',
      remarks: asset.remarks || '',
      additionalInformation: asset.additionalInformation || '',
      categoryId: asset.categoryId || '',
      subCategoryId: asset.subCategoryId || '',
    },
  })

  // Watch categoryId to sync with selectedCategory state
  const categoryId = form.watch('categoryId')
  const selectedCategory = categoryId || ''
  // Only fetch subcategories when dialog is open to avoid unnecessary requests
  const { data: subCategories = [] } = useSubCategories(open ? (selectedCategory || null) : null)

  // Reset subcategory when category changes
  const handleCategoryChange = (value: string) => {
    form.setValue('categoryId', value)
    form.setValue('subCategoryId', '')
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

  // Create object URLs for selected images
  const selectedImageUrls = useMemo(() => {
    return selectedImages.map(file => URL.createObjectURL(file))
  }, [selectedImages])

  // Reset form when dialog opens/closes or asset changes
  useEffect(() => {
    if (open) {
      form.reset({
        assetTagId: asset.assetTagId,
        description: asset.description,
        brand: asset.brand || '',
        model: asset.model || '',
        serialNo: asset.serialNo || '',
        cost: asset.cost?.toString() || '',
        assetType: asset.assetType || '',
        location: asset.location || '',
        department: asset.department || '',
        site: asset.site || '',
        owner: asset.owner || '',
        issuedTo: asset.issuedTo || '',
        purchasedFrom: asset.purchasedFrom || '',
        purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : '',
        poNumber: asset.poNumber || '',
        xeroAssetNo: asset.xeroAssetNo || '',
        remarks: asset.remarks || '',
        additionalInformation: asset.additionalInformation || '',
        categoryId: asset.categoryId || '',
        subCategoryId: asset.subCategoryId || '',
      })
    } else {
      setSelectedImages([])
      setSelectedExistingImages([])
    }
  }, [open, asset, form])

  // Cleanup object URLs when component unmounts or selectedImages change
  useEffect(() => {
    return () => {
      selectedImageUrls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [selectedImageUrls])

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Asset> }) => updateAsset(id, data),
    onSuccess: (updatedAsset) => {
      queryClient.setQueriesData<{ assets: Asset[]; pagination: { total: number; page: number; pageSize: number; totalPages: number } }>(
        { queryKey: ['assets'] },
        (oldData) => {
          if (!oldData?.assets) return oldData
          return {
            ...oldData,
            assets: oldData.assets.map((a: Asset) =>
              a.id === updatedAsset.id ? { ...a, ...updatedAsset } : a
            ),
          }
        }
      )
    },
    onError: () => {
      toast.error('Failed to update asset')
    },
  })

  // Fetch images using React Query for caching
  const { data: existingImagesData, isLoading: loadingExistingImages, refetch: refetchExistingImages } = useQuery({
    queryKey: ['assets', 'images', asset.assetTagId],
    queryFn: async () => {
      if (!asset.assetTagId) return { images: [] }
      const response = await fetch(`/api/assets/images/${asset.assetTagId}`)
      if (response.ok) {
        const data = await response.json()
        return { images: data.images || [] }
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Failed to fetch images:', errorData)
        return { images: [] }
      }
    },
    enabled: open && !!asset.assetTagId,
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
  })

  const existingImages = existingImagesData?.images || []

  // Check if asset tag ID exists (excluding current asset)
  const checkAssetTagExists = useCallback(async (assetTagId: string): Promise<boolean> => {
    if (!assetTagId || assetTagId.trim() === '' || assetTagId === asset.assetTagId) {
      return false
    }

    try {
      const response = await fetch(`/api/assets?search=${encodeURIComponent(assetTagId.trim())}&pageSize=1`)
      if (!response.ok) return false
      const data = await response.json()
      return data.assets?.some((a: { assetTagId: string; id: string }) => 
        a.assetTagId === assetTagId.trim() && a.id !== asset.id
      ) || false
    } catch {
      return false
    }
  }, [asset.assetTagId, asset.id])

  // Watch assetTagId for uniqueness check
  const assetTagId = form.watch('assetTagId')
  const assetTagValidationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) return

    if (assetTagValidationTimeoutRef.current) {
      clearTimeout(assetTagValidationTimeoutRef.current)
    }

    if (assetTagId === asset.assetTagId) {
      form.clearErrors('assetTagId')
      return
    }

    if (!assetTagId || assetTagId.trim() === '') {
      return
    }

    setIsCheckingAssetTag(true)
    assetTagValidationTimeoutRef.current = setTimeout(async () => {
      const exists = await checkAssetTagExists(assetTagId)
      if (exists) {
        form.setError('assetTagId', {
          type: 'manual',
          message: 'This Asset Tag ID already exists',
        })
      } else {
        form.clearErrors('assetTagId')
      }
      setIsCheckingAssetTag(false)
    }, 500)

    return () => {
      if (assetTagValidationTimeoutRef.current) {
        clearTimeout(assetTagValidationTimeoutRef.current)
      }
    }
  }, [assetTagId, open, asset.assetTagId, checkAssetTagExists, form])

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
        queryClient.invalidateQueries({ queryKey: ['assets', 'images', asset.assetTagId] })
        queryClient.invalidateQueries({ queryKey: ['assets'] })
        queryClient.invalidateQueries({ queryKey: ['assets-list'] })
        queryClient.invalidateQueries({ queryKey: ['assets', 'media'] })
        toast.success('Image deleted successfully')
        setIsDeleteImageDialogOpen(false)
        setImageToDelete(null)
      } else {
        const errorData = await response.json().catch(() => ({}))
        if (response.status === 404) {
          queryClient.invalidateQueries({ queryKey: ['assets', 'images', asset.assetTagId] })
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

  const onSubmit = async (data: EditAssetFormData) => {
    // Final uniqueness check if asset tag changed
    if (data.assetTagId !== asset.assetTagId) {
      const exists = await checkAssetTagExists(data.assetTagId)
      if (exists) {
        form.setError('assetTagId', {
          type: 'manual',
          message: 'This Asset Tag ID already exists',
        })
        toast.error('This Asset Tag ID already exists')
        return
      }
    }

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

    try {
      await updateMutation.mutateAsync({ id: asset.id, data: updateData })

      const updatedAssetTagId = data.assetTagId.trim()
      const totalImages = selectedImages.length + selectedExistingImages.length
      if (totalImages > 0 && updatedAssetTagId) {
        setUploadingImages(true)
        setUploadProgress(0)
        try {
          if (selectedImages.length > 0) {
            const totalNewImages = selectedImages.length
            let uploadedCount = 0

            for (let i = 0; i < selectedImages.length; i++) {
              await uploadImage(selectedImages[i], updatedAssetTagId, (progress) => {
                const overallProgress = ((uploadedCount + progress / 100) / totalNewImages) * 100
                setUploadProgress(Math.min(overallProgress, 100))
              })
              uploadedCount++
              setUploadProgress((uploadedCount / totalNewImages) * 100)
            }
          }

          if (selectedExistingImages.length > 0) {
            await Promise.all(
              selectedExistingImages.map(img => linkExistingImage(img.imageUrl, updatedAssetTagId))
            )
          }

          toast.success(`Asset updated successfully with ${totalImages} image(s)`)
          // Close dialog immediately for responsive UX
          onOpenChange(false)
          // Cleanup state in transition (non-urgent)
          startTransition(() => {
            setSelectedImages([])
            setSelectedExistingImages([])
            setUploadProgress(0)
          })
          // Invalidate queries in background (non-blocking)
          queryClient.invalidateQueries({ queryKey: ['assets', 'images', updatedAssetTagId] })
          if (updatedAssetTagId !== asset.assetTagId) {
            queryClient.invalidateQueries({ queryKey: ['assets', 'images', asset.assetTagId] })
          }
          queryClient.invalidateQueries({ queryKey: ['assets', 'media'] })
          refetchExistingImages()
          queryClient.refetchQueries({ queryKey: ['assets'] })
          queryClient.refetchQueries({ queryKey: ['assets-list'] })
        } catch (error) {
          console.error('Error uploading images:', error)
          toast.error('Asset updated but some images failed to upload')
          setUploadProgress(0)
        } finally {
          setUploadingImages(false)
        }
      } else {
        toast.success('Asset updated successfully')
        // Close dialog immediately for better UX
        onOpenChange(false)
        // Invalidate queries in background (non-blocking)
        queryClient.invalidateQueries({ queryKey: ['assets', 'images', asset.assetTagId] })
        refetchExistingImages()
        queryClient.refetchQueries({ queryKey: ['assets'] })
        queryClient.refetchQueries({ queryKey: ['assets-list'] })
      }
    } catch {
      // Error already handled by mutation
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Asset</DialogTitle>
            <DialogDescription>
              Update the details of this asset. Click save when you&apos;re done.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea>
              <div className="max-h-[70vh]">
                <div className="grid gap-4 py-4">
                  <Field>
                    <FieldLabel htmlFor="assetTagId">
                      Asset Tag ID <span className="text-destructive">*</span>
                    </FieldLabel>
                    <FieldContent>
                      <Input
                        id="assetTagId"
                        {...form.register("assetTagId")}
                        aria-invalid={form.formState.errors.assetTagId ? "true" : "false"}
                        className={form.formState.errors.assetTagId ? 'border-destructive' : ''}
                      />
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
                        rows={3}
                        aria-invalid={form.formState.errors.description ? "true" : "false"}
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
                              {subCategories?.map((subCat) => (
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

                  <div className="grid grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel htmlFor="brand">
                        Brand <span className="text-destructive">*</span>
                      </FieldLabel>
                      <FieldContent>
                        <Input
                          id="brand"
                          {...form.register("brand")}
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
                          aria-invalid={form.formState.errors.model ? "true" : "false"}
                        />
                        {form.formState.errors.model && (
                          <FieldError>{form.formState.errors.model.message}</FieldError>
                        )}
                      </FieldContent>
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel htmlFor="serialNo">Serial No</FieldLabel>
                      <FieldContent>
                        <Input
                          id="serialNo"
                          {...form.register("serialNo")}
                          aria-invalid={form.formState.errors.serialNo ? "true" : "false"}
                        />
                        {form.formState.errors.serialNo && (
                          <FieldError>{form.formState.errors.serialNo.message}</FieldError>
                        )}
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
                          aria-invalid={form.formState.errors.cost ? "true" : "false"}
                        />
                        {form.formState.errors.cost && (
                          <FieldError>{form.formState.errors.cost.message}</FieldError>
                        )}
                      </FieldContent>
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel htmlFor="assetType">Asset Type</FieldLabel>
                      <FieldContent>
                        <Input
                          id="assetType"
                          {...form.register("assetType")}
                          aria-invalid={form.formState.errors.assetType ? "true" : "false"}
                        />
                        {form.formState.errors.assetType && (
                          <FieldError>{form.formState.errors.assetType.message}</FieldError>
                        )}
                      </FieldContent>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="location">Location</FieldLabel>
                      <FieldContent>
                        <Input
                          id="location"
                          {...form.register("location")}
                          aria-invalid={form.formState.errors.location ? "true" : "false"}
                        />
                        {form.formState.errors.location && (
                          <FieldError>{form.formState.errors.location.message}</FieldError>
                        )}
                      </FieldContent>
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel htmlFor="department">Department</FieldLabel>
                      <FieldContent>
                        <Input
                          id="department"
                          {...form.register("department")}
                          aria-invalid={form.formState.errors.department ? "true" : "false"}
                        />
                        {form.formState.errors.department && (
                          <FieldError>{form.formState.errors.department.message}</FieldError>
                        )}
                      </FieldContent>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="site">Site</FieldLabel>
                      <FieldContent>
                        <Input
                          id="site"
                          {...form.register("site")}
                          aria-invalid={form.formState.errors.site ? "true" : "false"}
                        />
                        {form.formState.errors.site && (
                          <FieldError>{form.formState.errors.site.message}</FieldError>
                        )}
                      </FieldContent>
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel htmlFor="owner">Owner</FieldLabel>
                      <FieldContent>
                        <Input
                          id="owner"
                          {...form.register("owner")}
                          aria-invalid={form.formState.errors.owner ? "true" : "false"}
                        />
                        {form.formState.errors.owner && (
                          <FieldError>{form.formState.errors.owner.message}</FieldError>
                        )}
                      </FieldContent>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="issuedTo">Issued To</FieldLabel>
                      <FieldContent>
                        <Input
                          id="issuedTo"
                          {...form.register("issuedTo")}
                          aria-invalid={form.formState.errors.issuedTo ? "true" : "false"}
                        />
                        {form.formState.errors.issuedTo && (
                          <FieldError>{form.formState.errors.issuedTo.message}</FieldError>
                        )}
                      </FieldContent>
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel htmlFor="purchasedFrom">Purchased From</FieldLabel>
                      <FieldContent>
                        <Input
                          id="purchasedFrom"
                          {...form.register("purchasedFrom")}
                          aria-invalid={form.formState.errors.purchasedFrom ? "true" : "false"}
                        />
                        {form.formState.errors.purchasedFrom && (
                          <FieldError>{form.formState.errors.purchasedFrom.message}</FieldError>
                        )}
                      </FieldContent>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="purchaseDate">Purchase Date</FieldLabel>
                      <FieldContent>
                        <Input
                          id="purchaseDate"
                          type="date"
                          {...form.register("purchaseDate")}
                          aria-invalid={form.formState.errors.purchaseDate ? "true" : "false"}
                        />
                        {form.formState.errors.purchaseDate && (
                          <FieldError>{form.formState.errors.purchaseDate.message}</FieldError>
                        )}
                      </FieldContent>
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel htmlFor="poNumber">PO Number</FieldLabel>
                      <FieldContent>
                        <Input
                          id="poNumber"
                          {...form.register("poNumber")}
                          aria-invalid={form.formState.errors.poNumber ? "true" : "false"}
                        />
                        {form.formState.errors.poNumber && (
                          <FieldError>{form.formState.errors.poNumber.message}</FieldError>
                        )}
                      </FieldContent>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="xeroAssetNo">Xero Asset No</FieldLabel>
                      <FieldContent>
                        <Input
                          id="xeroAssetNo"
                          {...form.register("xeroAssetNo")}
                          aria-invalid={form.formState.errors.xeroAssetNo ? "true" : "false"}
                        />
                        {form.formState.errors.xeroAssetNo && (
                          <FieldError>{form.formState.errors.xeroAssetNo.message}</FieldError>
                        )}
                      </FieldContent>
                    </Field>
                  </div>

                  <Field>
                    <FieldLabel htmlFor="remarks">Remarks</FieldLabel>
                    <FieldContent>
                      <Textarea
                        id="remarks"
                        {...form.register("remarks")}
                        rows={3}
                        aria-invalid={form.formState.errors.remarks ? "true" : "false"}
                      />
                      {form.formState.errors.remarks && (
                        <FieldError>{form.formState.errors.remarks.message}</FieldError>
                      )}
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="additionalInformation">Additional Information</FieldLabel>
                    <FieldContent>
                      <Textarea
                        id="additionalInformation"
                        {...form.register("additionalInformation")}
                        rows={3}
                        aria-invalid={form.formState.errors.additionalInformation ? "true" : "false"}
                      />
                      {form.formState.errors.additionalInformation && (
                        <FieldError>{form.formState.errors.additionalInformation.message}</FieldError>
                      )}
                    </FieldContent>
                  </Field>

                  <div className="grid gap-2">
                    <Label htmlFor="images">Asset Images</Label>

                    {loadingExistingImages ? (
                      <div className="flex items-center justify-center py-4">
                        <Spinner className="h-4 w-4" />
                      </div>
                    ) : (
                      <div className="space-y-2 mb-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {existingImages.map((image: { id: string; imageUrl: string; assetTagId: string; fileName?: string; createdAt?: string }, index: number) => (
                            <div
                              key={image.id}
                              className="relative group border rounded-lg overflow-visible cursor-pointer"
                              onClick={() => {
                                // Set the index of the clicked image and open preview
                                setPreviewImageIndex(index)
                                setIsPreviewOpen(true)
                              }}
                            >
                              <div className="aspect-square bg-muted relative overflow-hidden rounded-lg">
                                <Image
                                  src={image.imageUrl}
                                  alt={`Asset ${asset.assetTagId} image`}
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
                              onChange={(e) => {
                                const files = Array.from(e.target.files || [])

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
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending || uploadingImages}>
                {updateMutation.isPending ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Saving...
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <MediaBrowserDialog
        open={mediaBrowserOpen}
        onOpenChange={setMediaBrowserOpen}
        selectedImages={selectedExistingImages}
        onSelectImages={setSelectedExistingImages}
        pageSize={24}
        currentAssetTagId={asset.assetTagId}
        existingImageUrls={existingImages.map((img: { imageUrl: string }) => img.imageUrl)}
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

      {/* Image Preview Dialog */}
      <ImagePreviewDialog
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        existingImages={existingImages.map((img: { id: string; imageUrl: string; assetTagId: string; fileName?: string; createdAt?: string }) => ({
          id: img.id,
          imageUrl: img.imageUrl,
          fileName: img.fileName || `Image ${img.id}`,
        }))}
        title={`Asset Images - ${asset.assetTagId}`}
        maxHeight="h-[70vh] max-h-[600px]"
        initialIndex={previewImageIndex}
      />
    </>
  )
}

