'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { Field, FieldLabel, FieldContent, FieldError } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { categorySchema, type CategoryFormData } from '@/lib/validations/categories'

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
  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      description: '',
    },
  })

  // Reset form when dialog opens/closes or initialData changes
  useEffect(() => {
    if (!open) {
      // Reset on close
      form.reset({
        name: '',
        description: '',
      })
      return
    }

    // Only update when dialog opens and we have initialData
    if (initialData) {
      form.reset({
        name: initialData.name || '',
        description: initialData.description || '',
      })
    } else {
      form.reset({
        name: '',
        description: '',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  
  // Update form when initialData changes while dialog is open
  useEffect(() => {
    if (open && initialData) {
      form.reset({
        name: initialData.name || '',
        description: initialData.description || '',
      })
    }
  }, [open, initialData, form])

  const handleSubmit = async (data: CategoryFormData) => {
    await onSubmit({
      name: data.name.trim(),
      description: data.description?.trim() || undefined,
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
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="space-y-4">
            <Field>
              <FieldLabel htmlFor="category-name">
                Name <span className="text-destructive">*</span>
              </FieldLabel>
              <FieldContent>
                <Input
                  id="category-name"
                  {...form.register('name')}
                  placeholder="Category name"
                  disabled={isLoading}
                  aria-invalid={form.formState.errors.name ? 'true' : 'false'}
                />
              </FieldContent>
              <FieldError>{form.formState.errors.name?.message}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="category-description">Description</FieldLabel>
              <FieldContent>
                <Textarea
                  id="category-description"
                  {...form.register('description')}
                  placeholder="Category description (optional)"
                  disabled={isLoading}
                  className="min-h-[80px]"
                  aria-invalid={form.formState.errors.description ? 'true' : 'false'}
                />
              </FieldContent>
              <FieldError>{form.formState.errors.description?.message}</FieldError>
            </Field>
          </div>
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
              className='btn-glass'
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
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
        </form>
      </DialogContent>
    </Dialog>
  )
}

