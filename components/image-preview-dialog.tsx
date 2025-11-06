'use client'

import Image from 'next/image'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from './ui/scroll-area'

interface ImagePreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  images: File[]
  existingImages?: Array<{ id: string; imageUrl: string; fileName: string }>
  onRemoveImage: (index: number) => void
  onRemoveExistingImage?: (id: string) => void
  title?: string
  description?: string
}

export function ImagePreviewDialog({
  open,
  onOpenChange,
  images,
  existingImages = [],
  onRemoveImage,
  onRemoveExistingImage,
  title = 'Selected Images',
  description = 'Manage your selected images. Click the remove button to remove an image from the list.',
}: ImagePreviewDialogProps) {
  const totalImages = images.length + existingImages.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {totalImages === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No images selected
            </p>
          ) : (
            <div className="space-y-2">
              <ScrollArea className="max-h-[500px]">
                {/* Existing images from media */}
                {existingImages.map((img) => (
                  <div key={img.id} className="flex items-center gap-3 p-2 border-b last:border-b-0 rounded-none hover:bg-muted/50 transition-colors">
                    <div className="w-12 h-12 shrink-0 rounded border overflow-hidden bg-muted relative">
                      <Image
                        src={img.imageUrl}
                        alt={img.fileName}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <span className="text-sm text-foreground truncate flex-1" title={img.fileName}>
                      {img.fileName}
                    </span>
                    {onRemoveExistingImage && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => onRemoveExistingImage(img.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {/* New upload images */}
                {images.map((file, index) => (
                  <div key={`file-${index}`} className="flex items-center gap-3 p-2 border-b last:border-b-0 rounded-none hover:bg-muted/50 transition-colors">
                    <div className="w-12 h-12 shrink-0 rounded border overflow-hidden bg-muted relative">
                      <Image
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <span className="text-sm text-foreground truncate flex-1" title={file.name}>
                      {file.name}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => onRemoveImage(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

