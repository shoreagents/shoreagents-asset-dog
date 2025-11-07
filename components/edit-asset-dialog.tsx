'use client'

import { useState, useEffect, useRef, useMemo, useCallback, useTransition } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
import { Upload, Image as ImageIcon, Eye, X } from 'lucide-react'
import { toast } from 'sonner'
import { ImagePreviewDialog, type ImagePreviewData } from '@/components/image-preview-dialog'

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
  onPreviewImage,
}: EditAssetDialogProps) {
  const queryClient = useQueryClient()
  const [assetTagIdInput, setAssetTagIdInput] = useState<string>(asset.assetTagId)
  const [assetTagIdError, setAssetTagIdError] = useState<string>('')
  const [isCheckingAssetTag, setIsCheckingAssetTag] = useState(false)
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [selectedExistingImages, setSelectedExistingImages] = useState<Array<{ id: string; imageUrl: string; fileName: string }>>([])
  const [uploadingImages, setUploadingImages] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [imageToDelete, setImageToDelete] = useState<string | null>(null)
  const [isDeleteImageDialogOpen, setIsDeleteImageDialogOpen] = useState(false)
  const [isDeletingImage, setIsDeletingImage] = useState(false)
  const [mediaBrowserOpen, setMediaBrowserOpen] = useState(false)
  const [previewImage, setPreviewImage] = useState<ImagePreviewData | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const imageInputRef = useRef<HTMLInputElement>(null)

  // Create object URLs for selected images
  const selectedImageUrls = useMemo(() => {
    return selectedImages.map(file => URL.createObjectURL(file))
  }, [selectedImages])

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setAssetTagIdInput(asset.assetTagId)
      setAssetTagIdError('')
    } else {
      setSelectedImages([])
      setSelectedExistingImages([])
      setAssetTagIdError('')
    }
  }, [open, asset.assetTagId])

  // Cleanup object URLs when component unmounts or selectedImages change
  useEffect(() => {
    return () => {
      selectedImageUrls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [selectedImageUrls])

  const formatDateForInput = (dateString: string | null) => {
    if (!dateString) return ''
    try {
      const date = new Date(dateString)
      return date.toISOString().split('T')[0]
    } catch {
      return ''
    }
  }

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

  // Debounced validation for asset tag ID
  const assetTagValidationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) return

    if (assetTagValidationTimeoutRef.current) {
      clearTimeout(assetTagValidationTimeoutRef.current)
    }

    if (assetTagIdInput === asset.assetTagId) {
      setAssetTagIdError('')
      return
    }

    if (assetTagIdInput.trim() === '') {
      setAssetTagIdError('Asset Tag ID is required')
      return
    }

    setIsCheckingAssetTag(true)
    assetTagValidationTimeoutRef.current = setTimeout(async () => {
      const exists = await checkAssetTagExists(assetTagIdInput)
      if (exists) {
        setAssetTagIdError('This Asset Tag ID already exists')
      } else {
        setAssetTagIdError('')
      }
      setIsCheckingAssetTag(false)
    }, 500)

    return () => {
      if (assetTagValidationTimeoutRef.current) {
        clearTimeout(assetTagValidationTimeoutRef.current)
      }
    }
  }, [assetTagIdInput, open, asset.assetTagId, checkAssetTagExists])

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
        queryClient.invalidateQueries({ queryKey: ['assets', 'media'] })
        toast.success('Image deleted successfully')
        setIsDeleteImageDialogOpen(false)
        setImageToDelete(null)
      } else {
        const errorData = await response.json().catch(() => ({}))
        if (response.status === 404) {
          queryClient.invalidateQueries({ queryKey: ['assets', 'images', asset.assetTagId] })
          queryClient.invalidateQueries({ queryKey: ['assets'] })
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (assetTagIdError) {
      toast.error('Please fix the Asset Tag ID error before saving')
      return
    }

    if (assetTagIdInput !== asset.assetTagId) {
      const exists = await checkAssetTagExists(assetTagIdInput)
      if (exists) {
        setAssetTagIdError('This Asset Tag ID already exists')
        toast.error('This Asset Tag ID already exists')
        return
      }
    }

    if (!assetTagIdInput || assetTagIdInput.trim() === '') {
      setAssetTagIdError('Asset Tag ID is required')
      toast.error('Asset Tag ID is required')
      return
    }

    const formData = new FormData(e.currentTarget)

    const data = {
      assetTagId: assetTagIdInput.trim(),
      description: formData.get('description') as string,
      brand: formData.get('brand') as string,
      model: formData.get('model') as string,
      serialNo: formData.get('serialNo') as string,
      cost: formData.get('cost') ? parseFloat(formData.get('cost') as string) : null,
      assetType: formData.get('assetType') as string,
      location: formData.get('location') as string,
      department: formData.get('department') as string,
      site: formData.get('site') as string,
      owner: formData.get('owner') as string,
      issuedTo: formData.get('issuedTo') as string,
      purchasedFrom: formData.get('purchasedFrom') as string,
      purchaseDate: formData.get('purchaseDate') as string,
      poNumber: formData.get('poNumber') as string,
      xeroAssetNo: formData.get('xeroAssetNo') as string,
      remarks: formData.get('remarks') as string,
      additionalInformation: formData.get('additionalInformation') as string,
    }

    try {
      await updateMutation.mutateAsync({ id: asset.id, data })

      const updatedAssetTagId = assetTagIdInput.trim()
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
          <form onSubmit={handleSubmit}>
            <ScrollArea>
              <div className="max-h-[70vh]">
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="assetTagId">Asset Tag ID</Label>
                    <div className="space-y-1">
                      <Input
                        id="assetTagId"
                        name="assetTagId"
                        value={assetTagIdInput}
                        onChange={(e) => setAssetTagIdInput(e.target.value)}
                        className={assetTagIdError ? 'border-destructive' : ''}
                      />
                      {isCheckingAssetTag && (
                        <p className="text-xs text-muted-foreground">Checking availability...</p>
                      )}
                      {assetTagIdError && (
                        <p className="text-xs text-destructive">{assetTagIdError}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" name="description" defaultValue={asset.description} rows={3} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="brand">Brand</Label>
                      <Input id="brand" name="brand" defaultValue={asset.brand || ''} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="model">Model</Label>
                      <Input id="model" name="model" defaultValue={asset.model || ''} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="serialNo">Serial No</Label>
                      <Input id="serialNo" name="serialNo" defaultValue={asset.serialNo || ''} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="cost">Cost</Label>
                      <Input id="cost" name="cost" type="number" step="0.01" defaultValue={asset.cost?.toString() || ''} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="assetType">Asset Type</Label>
                      <Input id="assetType" name="assetType" defaultValue={asset.assetType || ''} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="location">Location</Label>
                      <Input id="location" name="location" defaultValue={asset.location || ''} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="department">Department</Label>
                      <Input id="department" name="department" defaultValue={asset.department || ''} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="site">Site</Label>
                      <Input id="site" name="site" defaultValue={asset.site || ''} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="owner">Owner</Label>
                      <Input id="owner" name="owner" defaultValue={asset.owner || ''} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="issuedTo">Issued To</Label>
                      <Input id="issuedTo" name="issuedTo" defaultValue={asset.issuedTo || ''} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="purchasedFrom">Purchased From</Label>
                      <Input id="purchasedFrom" name="purchasedFrom" defaultValue={asset.purchasedFrom || ''} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="purchaseDate">Purchase Date</Label>
                      <Input id="purchaseDate" name="purchaseDate" type="date" defaultValue={formatDateForInput(asset.purchaseDate)} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="poNumber">PO Number</Label>
                      <Input id="poNumber" name="poNumber" defaultValue={asset.poNumber || ''} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="xeroAssetNo">Xero Asset No</Label>
                      <Input id="xeroAssetNo" name="xeroAssetNo" defaultValue={asset.xeroAssetNo || ''} />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="remarks">Remarks</Label>
                    <Textarea id="remarks" name="remarks" defaultValue={asset.remarks || ''} rows={3} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="additionalInformation">Additional Information</Label>
                    <Textarea id="additionalInformation" name="additionalInformation" defaultValue={asset.additionalInformation || ''} rows={3} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="images">Asset Images</Label>

                    {loadingExistingImages ? (
                      <div className="flex items-center justify-center py-4">
                        <Spinner className="h-4 w-4" />
                      </div>
                    ) : (
                      <div className="space-y-2 mb-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {existingImages.map((image: { id: string; imageUrl: string; assetTagId: string; fileName?: string; createdAt?: string }) => (
                            <div
                              key={image.id}
                              className="relative group border rounded-lg overflow-visible cursor-pointer"
                              onClick={() => {
                                // Use the reusable ImagePreviewDialog component
                                setPreviewImage({
                                  imageUrl: image.imageUrl,
                                  fileName: image.fileName,
                                  assetTagId: image.assetTagId || asset.assetTagId,
                                  alt: `Asset ${asset.assetTagId} image`,
                                  createdAt: image.createdAt,
                                })
                                setIsPreviewOpen(true)
                                // Also call the callback for backward compatibility
                                if (onPreviewImage) {
                                  onPreviewImage(image.imageUrl)
                                }
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
        image={previewImage}
        maxHeight="h-[70vh] max-h-[600px]"
      />
    </>
  )
}

