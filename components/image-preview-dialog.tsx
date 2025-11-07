'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import Image from 'next/image'
import { format } from 'date-fns'

export interface ImagePreviewData {
  imageUrl: string
  fileName?: string
  assetTagId?: string | null
  linkedAssetTagIds?: string[]
  linkedAssetTagId?: string | null
  createdAt?: string
  alt?: string
}

interface ImagePreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  image: ImagePreviewData | null
  maxHeight?: string
}

export function ImagePreviewDialog({
  open,
  onOpenChange,
  image,
  maxHeight = 'h-[50vh] max-h-[500px]',
}: ImagePreviewDialogProps) {
  if (!image) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            <div className="space-y-1">
              <div>{image.fileName || image.assetTagId || 'Image'}</div>
              {/* Only show asset info if the image is actually linked to an asset */}
              {image.linkedAssetTagIds && image.linkedAssetTagIds.length > 0 && (
                <div className="text-sm text-muted-foreground font-normal">
                  Asset{image.linkedAssetTagIds.length > 1 ? 's' : ''}: {image.linkedAssetTagIds.join(', ')}
                </div>
              )}
              {image.linkedAssetTagId && !image.linkedAssetTagIds && (
                <div className="text-sm text-muted-foreground font-normal">
                  Asset: {image.linkedAssetTagId}
                </div>
              )}
              {image.createdAt && (
                <div className="text-sm text-muted-foreground font-normal">
                  {format(new Date(image.createdAt), 'PPp')}
                </div>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center mt-4">
          <div className={`relative w-full ${maxHeight}`}>
            <Image
              src={image.imageUrl}
              alt={image.alt || `Image ${image.fileName || image.assetTagId || ''}`}
              fill
              className="object-contain"
              unoptimized
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
