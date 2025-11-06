'use client'

import { useState, useEffect } from 'react'
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
import { Spinner } from '@/components/ui/shadcn-io/spinner'

interface CategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: { name: string; description?: string }) => Promise<void>
  mode?: 'create' | 'edit'
  initialData?: {
    name: string
    description?: string
  }
  isLoading?: boolean
}

export function CategoryDialog({
  open,
  onOpenChange,
  onSubmit,
  mode = 'create',
  initialData,
  isLoading = false,
}: CategoryDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  // Reset form when dialog opens/closes or initialData changes
  useEffect(() => {
    if (!open) {
      // Reset on close
      setName('')
      setDescription('')
      return
    }

    // Only update when dialog opens and we have initialData
    if (initialData) {
      setName(initialData.name || '')
      setDescription(initialData.description || '')
    } else {
      setName('')
      setDescription('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  
  // Update form when initialData changes while dialog is open
  useEffect(() => {
    if (open && initialData) {
      setName(initialData.name || '')
      setDescription(initialData.description || '')
    }
  }, [open, initialData])

  const handleSubmit = async () => {
    if (!name.trim()) return
    
    await onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
    })
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isLoading) {
      onOpenChange(newOpen)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit' ? 'Edit Category' : 'Create Category'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'edit'
              ? 'Update category information'
              : 'Add a new category for assets'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="category-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Category name"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category-description">Description</Label>
            <textarea
              id="category-description"
              className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Category description (optional)"
              disabled={isLoading}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || isLoading}
          >
            {isLoading ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                {mode === 'edit' ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              mode === 'edit' ? 'Update' : 'Create'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

