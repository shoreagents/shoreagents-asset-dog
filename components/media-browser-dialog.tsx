"use client"

import { useState, useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { PlusIcon, Link2 } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/shadcn-io/spinner"

interface MediaImage {
  id: string
  imageUrl: string
  fileName: string
  assetTagId: string
  isLinked?: boolean
  linkedAssetTagId?: string | null // For backward compatibility
  linkedAssetTagIds?: string[] // Array of all linked asset tag IDs
  linkedAssetsInfo?: Array<{ assetTagId: string; isDeleted: boolean }> // Info about each linked asset
  assetIsDeleted?: boolean
}

interface MediaBrowserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectImages: (images: Array<{ id: string; imageUrl: string; fileName: string }>) => void
  selectedImages?: Array<{ id: string; imageUrl: string; fileName: string }>
  pageSize?: number
  currentAssetTagId?: string // Current asset tag ID to filter out already linked images
  existingImageUrls?: string[] // URLs of images already linked to this asset
}

export function MediaBrowserDialog({
  open,
  onOpenChange,
  onSelectImages,
  selectedImages = [],
  pageSize = 24,
  currentAssetTagId,
}: MediaBrowserDialogProps) {
  const [mediaPage, setMediaPage] = useState(1)
  const prevOpenRef = useRef(false)
  
  // Initialize local selection from props - use lazy initialization
  const getInitialSelection = () => new Set(selectedImages.map(img => img.id))
  const [localSelectedImages, setLocalSelectedImages] = useState<Set<string>>(getInitialSelection)

  // Reset selection when dialog opens
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      // Dialog just opened - reset to props
      const initialIds = new Set(selectedImages.map(img => img.id))
      // Use setTimeout to defer state update outside of effect
      setTimeout(() => {
        setLocalSelectedImages(initialIds)
      }, 0)
    }
    prevOpenRef.current = open
  }, [open, selectedImages])

  // Fetch media images
  const { data: mediaData, isLoading: mediaLoading } = useQuery({
    queryKey: ['assets', 'media', 'browser', mediaPage, pageSize],
    queryFn: async () => {
      const response = await fetch(`/api/assets/media?page=${mediaPage}&pageSize=${pageSize}`)
      if (!response.ok) throw new Error('Failed to fetch media')
      return response.json() as Promise<{
        images: MediaImage[]
        pagination: { total: number; page: number; pageSize: number; totalPages: number }
      }>
    },
    enabled: open,
  })

  const handleImageClick = (image: MediaImage) => {
    // Check if this image is already linked to the current asset
    // Check both the single linkedAssetTagId (for backward compatibility) and the array
    const isAlreadyLinked = currentAssetTagId && image.isLinked && (
      image.linkedAssetTagId === currentAssetTagId ||
      (image.linkedAssetTagIds && image.linkedAssetTagIds.includes(currentAssetTagId))
    )
    
    // Don't allow selection if already linked to this asset
    if (isAlreadyLinked) {
      return
    }

    const isSelected = localSelectedImages.has(image.id)
    const newSelected = new Set(localSelectedImages)
    
    if (isSelected) {
      newSelected.delete(image.id)
    } else {
      newSelected.add(image.id)
    }
    
    setLocalSelectedImages(newSelected)
    
    // Convert Set to array and call onSelectImages
    const selectedArray = Array.from(newSelected)
      .map(id => {
        const img = mediaData?.images.find(i => i.id === id)
        return img ? { id: img.id, imageUrl: img.imageUrl, fileName: img.fileName } : null
      })
      .filter((img): img is { id: string; imageUrl: string; fileName: string } => img !== null)
    
    onSelectImages(selectedArray)
  }

  const handleClearSelection = () => {
    setLocalSelectedImages(new Set())
    onSelectImages([])
  }

  const handleDone = () => {
    onOpenChange(false)
  }

  // Generate a consistent color for an asset tag ID
  const getAssetColor = (assetTagId: string | null | undefined): string => {
    if (!assetTagId) return 'bg-blue-500/90'

    let hash = 0
    for (let i = 0; i < assetTagId.length; i++) {
      hash = assetTagId.charCodeAt(i) + ((hash << 5) - hash)
    }

    const colors = [
      'bg-blue-500/90', 'bg-green-500/90', 'bg-purple-500/90', 'bg-orange-500/90', 'bg-pink-500/90',
      'bg-cyan-500/90', 'bg-yellow-500/90', 'bg-indigo-500/90', 'bg-red-500/90', 'bg-teal-500/90',
      'bg-amber-500/90', 'bg-violet-500/90', 'bg-emerald-500/90', 'bg-lime-500/90', 'bg-rose-500/90',
      'bg-fuchsia-500/90', 'bg-sky-500/90', 'bg-slate-500/90', 'bg-gray-500/90', 'bg-zinc-500/90',
      'bg-neutral-500/90', 'bg-stone-500/90',
      'bg-blue-600/90', 'bg-green-600/90', 'bg-purple-600/90', 'bg-orange-600/90', 'bg-pink-600/90',
      'bg-cyan-600/90', 'bg-yellow-600/90', 'bg-indigo-600/90', 'bg-red-600/90', 'bg-teal-600/90',
      'bg-amber-600/90', 'bg-violet-600/90', 'bg-emerald-600/90', 'bg-lime-600/90', 'bg-rose-600/90',
      'bg-fuchsia-600/90', 'bg-sky-600/90',
      'bg-blue-400/90', 'bg-green-400/90', 'bg-purple-400/90', 'bg-orange-400/90', 'bg-pink-400/90',
      'bg-cyan-400/90', 'bg-yellow-400/90', 'bg-indigo-400/90', 'bg-red-400/90', 'bg-teal-400/90',
      'bg-amber-400/90', 'bg-violet-400/90', 'bg-emerald-400/90', 'bg-lime-400/90', 'bg-rose-400/90',
      'bg-fuchsia-400/90', 'bg-sky-400/90',
    ]
    const index = Math.abs(hash) % colors.length
    return colors[index]
  }

  // Get color for an image - if linked to multiple assets, use a special color
  const getImageColor = (image: MediaImage): string => {
    if (image.assetIsDeleted) return 'bg-gray-500/90'
    
    // If linked to multiple assets, use a special gradient/mixed color
    if (image.linkedAssetTagIds && image.linkedAssetTagIds.length > 1) {
      return 'bg-gradient-to-br from-purple-500/90 to-indigo-500/90' // Special color for multi-asset links
    }
    
    // Single asset - use the asset's color
    return getAssetColor(image.linkedAssetTagId)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Browse Media Library</DialogTitle>
          <DialogDescription>
            Select images to link to this asset. You can select multiple images.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto">
          {mediaLoading ? (
            <div className="flex flex-col items-center gap-3">
            <Spinner className="h-6 w-6" />
            <p className="text-sm text-muted-foreground">Loading media library...</p>
          </div>
          ) : mediaData?.images ? (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {mediaData.images.map((image) => {
                const isSelected = localSelectedImages.has(image.id)
                // Check if this image is already linked to the current asset
                // Check both the single linkedAssetTagId (for backward compatibility) and the array
                const isAlreadyLinked = currentAssetTagId && image.isLinked && (
                  image.linkedAssetTagId === currentAssetTagId ||
                  (image.linkedAssetTagIds && image.linkedAssetTagIds.includes(currentAssetTagId))
                )
                
                return (
                  <div
                    key={image.id}
                    className={`relative aspect-square group border-2 rounded ${
                      isAlreadyLinked 
                        ? 'border-gray-300 opacity-50 cursor-not-allowed' 
                        : `cursor-pointer ${isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-transparent hover:border-gray-300'}`
                    }`}
                    onClick={() => handleImageClick(image)}
                  >
                    <Image
                      src={image.imageUrl}
                      alt={image.fileName}
                      fill
                      className="object-cover rounded"
                    />
                    {/* Linked to Asset Indicator */}
                    {image.isLinked && (
                      <div className="absolute -top-1 -left-1 z-10">
                        <div 
                          className={`${getImageColor(image)} text-white p-1 rounded-full shadow-lg transition-colors`}
                          title={
                            image.linkedAssetTagIds && image.linkedAssetTagIds.length > 1
                              ? isAlreadyLinked
                                ? `Already linked to this asset (and ${image.linkedAssetTagIds.length - 1} other asset${image.linkedAssetTagIds.length - 1 !== 1 ? 's' : ''})`
                                : `Linked to ${image.linkedAssetTagIds.length} assets`
                              : image.linkedAssetTagId 
                                ? image.assetIsDeleted 
                                  ? `Linked to archived asset: ${image.linkedAssetTagId}`
                                  : isAlreadyLinked
                                    ? `Already linked to this asset: ${image.linkedAssetTagId}`
                                    : `Linked to asset: ${image.linkedAssetTagId}`
                                : 'Linked to asset'
                          }
                          onClick={(e) => {
                            e.stopPropagation()
                          }}
                        >
                          <Link2 className="h-2.5 w-2.5" />
                        </div>
                      </div>
                    )}
                    
                    {isSelected && (
                      <div className="absolute inset-0 bg-blue-500/30 flex items-center justify-center z-20">
                        <div className="bg-blue-500 text-white rounded-full p-2">
                          <PlusIcon className="h-5 w-5" />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No images found
            </div>
          )}
        </div>

        {/* Pagination */}
        {mediaData?.pagination && mediaData.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMediaPage(p => Math.max(1, p - 1))}
              disabled={mediaPage === 1 || mediaLoading}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {mediaData.pagination.page} of {mediaData.pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMediaPage(p => Math.min(mediaData.pagination.totalPages, p + 1))}
              disabled={mediaPage >= mediaData.pagination.totalPages || mediaLoading}
            >
              Next
            </Button>
          </div>
        )}

        {/* Footer with selected count and actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {localSelectedImages.size} image{localSelectedImages.size !== 1 ? 's' : ''} selected
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClearSelection}
            >
              Clear Selection
            </Button>
            <Button onClick={handleDone}>
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

