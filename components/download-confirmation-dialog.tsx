'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface DownloadConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fileName?: string | null
  fileSize?: number | null
  onConfirm: () => void
  onCancel?: () => void
}

// Format file size helper
const formatFileSize = (bytes: number | null | undefined): string => {
  if (!bytes) return 'Unknown'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function DownloadConfirmationDialog({
  open,
  onOpenChange,
  fileName,
  fileSize,
  onConfirm,
  onCancel,
}: DownloadConfirmationDialogProps) {
  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    }
    onOpenChange(false)
  }

  const handleConfirm = () => {
    onConfirm()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Download Document</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            This file will be downloaded to your device.
          </p>
          <div className="space-y-2">
            <div className="text-sm font-medium">File Name</div>
            <div className="text-sm text-muted-foreground break-all">
              {fileName || 'Unknown'}
            </div>
          </div>
          {fileSize && (
            <div className="space-y-2">
              <div className="text-sm font-medium">File Size</div>
              <div className="text-sm text-muted-foreground">
                {formatFileSize(fileSize)}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleConfirm}>
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}


