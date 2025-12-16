'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { Field, FieldLabel, FieldContent, FieldError } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { subcategorySchema, type SubcategoryFormData } from '@/lib/validations/categories'
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
  const form = useForm<SubcategoryFormData>({
    resolver: zodResolver(subcategorySchema),
    defaultValues: {
      name: '',
      description: '',
      categoryId: '',
    },
  })

  // Reset form when dialog opens/closes or initialData changes
  useEffect(() => {
    if (!open) {
      // Reset on close
      form.reset({
        name: '',
        description: '',
        categoryId: '',
      })
      return
    }

    // Only update when dialog opens and we have initialData
    if (initialData) {
      form.reset({
        name: initialData.name || '',
        description: initialData.description || '',
        categoryId: initialData.categoryId || '',
      })
    } else {
      form.reset({
        name: '',
        description: '',
        categoryId: '',
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
        categoryId: initialData.categoryId || '',
      })
    }
  }, [open, initialData, form])

  const handleSubmit = async (data: SubcategoryFormData) => {
    await onSubmit({
      name: data.name.trim(),
      description: data.description?.trim() || undefined,
      categoryId: data.categoryId,
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
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="space-y-4">
            <Field>
              <FieldLabel htmlFor="subcategory-category">
                Category <span className="text-destructive">*</span>
              </FieldLabel>
              <FieldContent>
                <Controller
                  name="categoryId"
                  control={form.control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isLoading}
                    >
                      <SelectTrigger id="subcategory-category" aria-invalid={form.formState.errors.categoryId ? 'true' : 'false'}>
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
                  )}
                />
              </FieldContent>
              <FieldError>{form.formState.errors.categoryId?.message}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="subcategory-name">
                Name <span className="text-destructive">*</span>
              </FieldLabel>
              <FieldContent>
                <Input
                  id="subcategory-name"
                  {...form.register('name')}
                  placeholder="Subcategory name"
                  disabled={isLoading}
                  aria-invalid={form.formState.errors.name ? 'true' : 'false'}
                />
              </FieldContent>
              <FieldError>{form.formState.errors.name?.message}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="subcategory-description">Description</FieldLabel>
              <FieldContent>
                <Textarea
                  id="subcategory-description"
                  {...form.register('description')}
                  placeholder="Subcategory description (optional)"
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

