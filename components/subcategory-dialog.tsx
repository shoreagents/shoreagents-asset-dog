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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import type { Category } from '@/hooks/use-categories'

interface SubCategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: { name: string; description?: string; categoryId: string }) => Promise<void>
  mode?: 'create' | 'edit'
  initialData?: {
    name: string
    description?: string
    categoryId: string
  }
  categories: Category[]
  selectedCategoryName?: string // For create mode when category is pre-selected
  isLoading?: boolean
}

export function SubCategoryDialog({
  open,
  onOpenChange,
  onSubmit,
  mode = 'create',
  initialData,
  categories,
  selectedCategoryName,
  isLoading = false,
}: SubCategoryDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')

  // Reset form when dialog opens/closes or initialData changes
  useEffect(() => {
    if (!open) {
      // Reset on close
      setName('')
      setDescription('')
      setCategoryId('')
      return
    }

    // Only update when dialog opens and we have initialData
    if (initialData) {
      setName(initialData.name || '')
      setDescription(initialData.description || '')
      setCategoryId(initialData.categoryId || '')
    } else {
      setName('')
      setDescription('')
      setCategoryId('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  
  // Update form when initialData changes while dialog is open
  useEffect(() => {
    if (open && initialData) {
      if (initialData.name !== undefined) {
        setName(initialData.name)
      }
      if (initialData.description !== undefined) {
        setDescription(initialData.description)
      }
      setCategoryId(initialData.categoryId)
    }
  }, [open, initialData])

  const handleSubmit = async () => {
    if (!name.trim() || !categoryId) return
    
    await onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      categoryId,
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
            {mode === 'edit' ? 'Edit Subcategory' : 'Create Subcategory'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'edit'
              ? 'Update subcategory information'
              : selectedCategoryName
              ? `Add a new subcategory to ${selectedCategoryName}`
              : 'Create a new subcategory for the selected category'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {mode === 'edit' && (
            <div className="space-y-2">
              <Label htmlFor="subcategory-category">Category</Label>
              <Select
                value={categoryId}
                onValueChange={setCategoryId}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="subcategory-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="subcategory-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Subcategory name"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="subcategory-description">Description</Label>
            <textarea
              id="subcategory-description"
              className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Subcategory description (optional)"
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
            disabled={!name.trim() || !categoryId || isLoading}
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

