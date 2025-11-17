'use client'

import { Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/shadcn-io/spinner'

interface AffectedAsset {
  assetTagId: string
  isDeleted?: boolean
}

interface DeleteConfirmationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  title?: string
  description?: string
  itemName?: string
  isLoading?: boolean
  confirmLabel?: string
  cancelLabel?: string
  loadingLabel?: string
  affectedAssets?: AffectedAsset[]
}

export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  itemName,
  isLoading = false,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  loadingLabel = 'Deleting...',
  affectedAssets,
}: DeleteConfirmationDialogProps) {
  const defaultTitle = itemName ? `Delete ${itemName}` : 'Delete'
  const defaultDescription = itemName
    ? `Are you sure you want to delete "${itemName}"? This action cannot be undone.`
    : 'Are you sure you want to delete this item? This action cannot be undone.'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title || defaultTitle}</DialogTitle>
          <DialogDescription asChild>
            <div>
              {description || defaultDescription}
              {affectedAssets && affectedAssets.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-sm font-medium">
                    This will affect {affectedAssets.length} asset{affectedAssets.length !== 1 ? 's' : ''}:
                  </div>
                  <div className="max-h-40 overflow-y-auto rounded-md border bg-muted/50 p-2">
                    <ul className="space-y-1 text-sm">
                      {affectedAssets.map((asset) => (
                        <li key={asset.assetTagId} className="flex items-center gap-2">
                          <span className="font-mono text-xs">{asset.assetTagId}</span>
                          {asset.isDeleted && (
                            <span className="text-xs text-muted-foreground">(Archived)</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                {loadingLabel}
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                {confirmLabel}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

