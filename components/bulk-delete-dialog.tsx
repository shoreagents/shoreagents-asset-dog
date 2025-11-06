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

interface BulkDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  itemCount: number
  itemName?: string
  isDeleting?: boolean
  progress?: {
    current: number
    total: number
  }
}

export function BulkDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  itemCount,
  itemName = 'item',
  isDeleting = false,
  progress,
}: BulkDeleteDialogProps) {
  const canClose = !isDeleting

  const handleOpenChange = (newOpen: boolean) => {
    if (canClose) {
      onOpenChange(newOpen)
    }
  }

  const progressPercentage = progress
    ? Math.round((progress.current / progress.total) * 100)
    : 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isDeleting
              ? `Deleting ${itemName}s... ${progress?.current || 0}/${progress?.total || 0}`
              : `Delete ${itemCount} ${itemName}(s)?`}
          </DialogTitle>
          {isDeleting ? (
            <div className="space-y-2">
              <span className="text-muted-foreground text-sm">
                Deleting {itemName}s, please wait...
              </span>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-destructive h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <span className="text-sm text-muted-foreground">{progressPercentage}% complete</span>
            </div>
          ) : (
            <DialogDescription>
              {itemName === 'Asset' ? (
                <>
                  Are you sure you want to delete {itemCount} selected {itemName}(s)? These assets
                  will be moved to Trash and can be restored within 30 days. After 30 days, they
                  will be permanently deleted.
                </>
              ) : (
                <>
                  Are you sure you want to delete {itemCount} selected {itemName}(s)? This action
                  cannot be undone and will permanently remove these {itemName}s.
                </>
              )}
            </DialogDescription>
          )}
        </DialogHeader>
        {!isDeleting && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onConfirm}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete {itemCount} {itemName}(s)
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

