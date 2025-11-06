'use client'

import { useRef, useState } from 'react'
import { Upload, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { ImagePreviewDialog } from './image-preview-dialog'

interface ImageUploadProps {
  selectedImages: File[]
  onImagesChange: (images: File[]) => void
  maxSizeMB?: number
  className?: string
  variant?: 'default' | 'icon-only'
  showLabel?: boolean
  showSupportedFormats?: boolean
  hideSelectedCount?: boolean
}

export function ImageUpload({ 
  selectedImages, 
  onImagesChange, 
  maxSizeMB = 5,
  className = '',
  variant = 'default',
  showSupportedFormats = true,
  hideSelectedCount = false
}: ImageUploadProps) {
  const [imagesDialogOpen, setImagesDialogOpen] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    // Validate file types
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    const validFiles = files.filter(file => {
      if (!allowedTypes.includes(file.type)) {
        toast.error(`${file.name} is not a valid image type. Only JPEG, PNG, GIF, and WebP are allowed.`)
        return false
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        toast.error(`${file.name} is too large. Maximum size is ${maxSizeMB}MB.`)
        return false
      }
      return true
    })

    onImagesChange([...selectedImages, ...validFiles])
    
    // Reset input
    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
  }

  const handleRemoveImage = (index: number) => {
    onImagesChange(selectedImages.filter((_, i) => i !== index))
  }

  if (variant === 'icon-only') {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => imageInputRef.current?.click()}
          className={className}
        >
          <Plus className="h-4 w-4" />
        </Button>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
          multiple
          className="hidden"
          onChange={handleImageSelect}
        />
        {selectedImages.length > 0 && !hideSelectedCount && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setImagesDialogOpen(true)}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {selectedImages.length} image{selectedImages.length !== 1 ? 's' : ''} selected
          </Button>
        )}
        <ImagePreviewDialog
          open={imagesDialogOpen}
          onOpenChange={setImagesDialogOpen}
          images={selectedImages}
          onRemoveImage={handleRemoveImage}
        />
      </>
    )
  }

  return (
    <>
      <div className={`space-y-3 ${className}`}>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => imageInputRef.current?.click()}
            className="w-full sm:w-auto"
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload Images
          </Button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            multiple
            className="hidden"
            onChange={handleImageSelect}
          />
          {selectedImages.length > 0 && !hideSelectedCount && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setImagesDialogOpen(true)}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {selectedImages.length} image{selectedImages.length !== 1 ? 's' : ''} selected
            </Button>
          )}
        </div>
        {showSupportedFormats && (
          <p className="text-xs text-muted-foreground">
            Supported formats: JPEG, PNG, GIF, WebP (Max {maxSizeMB}MB per image)
          </p>
        )}
      </div>

      <ImagePreviewDialog
        open={imagesDialogOpen}
        onOpenChange={setImagesDialogOpen}
        images={selectedImages}
        onRemoveImage={handleRemoveImage}
      />
    </>
  )
}

