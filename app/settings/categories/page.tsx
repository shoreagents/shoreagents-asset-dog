'use client'

import { useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { MoreHorizontal, Trash2, Edit, Plus, Folder, FolderOpen, FolderTree } from 'lucide-react'
import { toast } from 'sonner'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { usePermissions } from '@/hooks/use-permissions'
import { 
  useCategories, 
  useCreateCategory, 
  useUpdateCategory, 
  useDeleteCategory,
  useCreateSubCategory,
  useUpdateSubCategory,
  useDeleteSubCategory,
  type Category,
  type SubCategory,
} from '@/hooks/use-categories'
import { CategoryDialog } from '@/components/category-dialog'
import { SubCategoryDialog } from '@/components/subcategory-dialog'

export default function CategoriesPage() {
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canManageCategories = hasPermission('canManageCategories')
  
  const { data: categories = [], isLoading: categoriesLoading, error: categoriesError } = useCategories()
  const createCategoryMutation = useCreateCategory()
  const updateCategoryMutation = useUpdateCategory()
  const deleteCategoryMutation = useDeleteCategory()
  const createSubCategoryMutation = useCreateSubCategory()
  const updateSubCategoryMutation = useUpdateSubCategory()
  const deleteSubCategoryMutation = useDeleteSubCategory()

  // Dialog states
  const [isCreateCategoryDialogOpen, setIsCreateCategoryDialogOpen] = useState(false)
  const [isEditCategoryDialogOpen, setIsEditCategoryDialogOpen] = useState(false)
  const [isDeleteCategoryDialogOpen, setIsDeleteCategoryDialogOpen] = useState(false)
  const [isCreateSubCategoryDialogOpen, setIsCreateSubCategoryDialogOpen] = useState(false)
  const [isEditSubCategoryDialogOpen, setIsEditSubCategoryDialogOpen] = useState(false)
  const [isDeleteSubCategoryDialogOpen, setIsDeleteSubCategoryDialogOpen] = useState(false)
  
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [selectedSubCategory, setSelectedSubCategory] = useState<SubCategory & { categoryId: string } | null>(null)

  // Category handlers
  const handleCreateCategory = async (data: { name: string; description?: string }) => {
    if (!canManageCategories) {
      toast.error('You do not have permission to manage categories')
      return
    }

    try {
      await createCategoryMutation.mutateAsync(data)
      setIsCreateCategoryDialogOpen(false)
      toast.success('Category created successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create category')
    }
  }

  const handleEditCategory = (category: Category) => {
    if (!canManageCategories) {
      toast.error('You do not have permission to manage categories')
      return
    }
    setSelectedCategory(category)
    setIsEditCategoryDialogOpen(true)
  }

  const handleUpdateCategory = async (data: { name: string; description?: string }) => {
    if (!selectedCategory || !canManageCategories) return

    try {
      await updateCategoryMutation.mutateAsync({
        id: selectedCategory.id,
        ...data,
      })
      setIsEditCategoryDialogOpen(false)
      setSelectedCategory(null)
      toast.success('Category updated successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update category')
    }
  }

  const handleDeleteCategory = (category: Category) => {
    if (!canManageCategories) {
      toast.error('You do not have permission to manage categories')
      return
    }
    
    setSelectedCategory(category)
    setIsDeleteCategoryDialogOpen(true)
  }

  const confirmDeleteCategory = async () => {
    if (!selectedCategory) return

    try {
      await deleteCategoryMutation.mutateAsync(selectedCategory.id)
      setIsDeleteCategoryDialogOpen(false)
      setSelectedCategory(null)
      toast.success('Category deleted successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete category')
    }
  }

  // Subcategory handlers
  const handleCreateSubCategory = (category: Category) => {
    if (!canManageCategories) {
      toast.error('You do not have permission to manage categories')
      return
    }
    setSelectedCategory(category)
    setIsCreateSubCategoryDialogOpen(true)
  }

  const handleCreateSubCategorySubmit = async (data: { name: string; description?: string; categoryId: string }) => {
    if (!canManageCategories) return

    try {
      await createSubCategoryMutation.mutateAsync(data)
      setIsCreateSubCategoryDialogOpen(false)
      setSelectedCategory(null)
      toast.success('Subcategory created successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create subcategory')
    }
  }

  const handleEditSubCategory = (subCategory: SubCategory, categoryId: string) => {
    if (!canManageCategories) {
      toast.error('You do not have permission to manage categories')
      return
    }
    setSelectedSubCategory({ ...subCategory, categoryId })
    setIsEditSubCategoryDialogOpen(true)
  }

  const handleUpdateSubCategory = async (data: { name: string; description?: string; categoryId: string }) => {
    if (!selectedSubCategory || !canManageCategories) return

    try {
      await updateSubCategoryMutation.mutateAsync({
        id: selectedSubCategory.id,
        ...data,
      })
      setIsEditSubCategoryDialogOpen(false)
      setSelectedSubCategory(null)
      toast.success('Subcategory updated successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update subcategory')
    }
  }

  const handleDeleteSubCategory = (subCategory: SubCategory) => {
    if (!canManageCategories) {
      toast.error('You do not have permission to manage categories')
      return
    }
    setSelectedSubCategory({ ...subCategory, categoryId: '' })
    setIsDeleteSubCategoryDialogOpen(true)
  }

  const confirmDeleteSubCategory = async () => {
    if (!selectedSubCategory) return

    try {
      await deleteSubCategoryMutation.mutateAsync(selectedSubCategory.id)
      setIsDeleteSubCategoryDialogOpen(false)
      setSelectedSubCategory(null)
      toast.success('Subcategory deleted successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete subcategory')
    }
  }

  if (permissionsLoading || categoriesLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Spinner className="h-8 w-8" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (categoriesError) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Categories Management</CardTitle>
            <CardDescription>Manage asset categories and subcategories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FolderTree className="h-12 w-12 text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error Loading Categories</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {categoriesError instanceof Error ? categoriesError.message : 'Failed to load categories'}
              </p>
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!canManageCategories) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Categories Management</CardTitle>
            <CardDescription>Manage asset categories and subcategories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FolderTree className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
              <p className="text-sm text-muted-foreground">
                You do not have permission to manage categories. Please contact an administrator.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categories Management</h1>
          <p className="text-muted-foreground">
            Manage asset categories and their subcategories
          </p>
        </div>
        <Button onClick={() => setIsCreateCategoryDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Category
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Folder className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Categories</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get started by creating your first category
            </p>
            <Button onClick={() => setIsCreateCategoryDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Category
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => (
            <Card key={category.id} className="flex flex-col h-full">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0 pr-1">
                    <FolderOpen className="h-5 w-5 mt-0.5 shrink-0 text-primary" />
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <CardTitle className="text-base leading-tight line-clamp-2">{category.name}</CardTitle>
                      {category.description && (
                        <CardDescription className="mt-1 line-clamp-2 text-xs">
                          {category.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  {canManageCategories && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 shrink-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditCategory(category)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteCategory(category)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col pt-0">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
                    Subcategories ({category.subCategories?.length || 0})
                  </span>
                  {canManageCategories && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCreateSubCategory(category)}
                      className="h-7 text-xs shrink-0"
                    >
                      <Plus className="mr-1.5 h-3 w-3" />
                      Add
                    </Button>
                  )}
                </div>
                {category.subCategories && category.subCategories.length > 0 ? (
                  <ScrollArea className="flex-1 max-h-52">
                    <div className="space-y-1.5">
                      {category.subCategories.map((subCategory) => (
                        <div
                          key={subCategory.id}
                          className="flex items-start justify-between gap-2 p-2.5 border rounded-md hover:bg-accent/50 transition-colors group"
                        >
                          <div className="flex-1 min-w-0 overflow-hidden pr-1">
                            <div className="font-medium text-sm leading-tight line-clamp-2">{subCategory.name}</div>
                            {subCategory.description && (
                              <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {subCategory.description}
                              </div>
                            )}
                          </div>
                          {canManageCategories && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  className="h-7 w-7 p-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <span className="sr-only">Open menu</span>
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => handleEditSubCategory(subCategory, category.id)}
                                >
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDeleteSubCategory(subCategory)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      ))}
                    </div>
                    <ScrollBar orientation="vertical" />
                  </ScrollArea>
                ) : (
                  <div className="flex-1 flex items-center justify-center py-6">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-2">No subcategories yet</p>
                      {canManageCategories && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCreateSubCategory(category)}
                          className="h-7 text-xs"
                        >
                          <Plus className="mr-1.5 h-3 w-3" />
                          Add Subcategory
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Category Dialog */}
      <CategoryDialog
        open={isCreateCategoryDialogOpen}
        onOpenChange={setIsCreateCategoryDialogOpen}
        onSubmit={handleCreateCategory}
        mode="create"
        isLoading={createCategoryMutation.isPending}
      />

      {/* Edit Category Dialog */}
      <CategoryDialog
        open={isEditCategoryDialogOpen}
        onOpenChange={setIsEditCategoryDialogOpen}
        onSubmit={handleUpdateCategory}
        mode="edit"
        initialData={selectedCategory ? {
          name: selectedCategory.name,
          description: selectedCategory.description || undefined,
        } : undefined}
        isLoading={updateCategoryMutation.isPending}
      />

      {/* Create Subcategory Dialog */}
      <SubCategoryDialog
        open={isCreateSubCategoryDialogOpen}
        onOpenChange={setIsCreateSubCategoryDialogOpen}
        onSubmit={handleCreateSubCategorySubmit}
        mode="create"
        categories={categories}
        selectedCategoryName={selectedCategory?.name}
        initialData={selectedCategory ? {
          name: '',
          description: undefined,
          categoryId: selectedCategory.id,
        } : undefined}
        isLoading={createSubCategoryMutation.isPending}
      />

      {/* Edit Subcategory Dialog */}
      <SubCategoryDialog
        open={isEditSubCategoryDialogOpen}
        onOpenChange={setIsEditSubCategoryDialogOpen}
        onSubmit={handleUpdateSubCategory}
        mode="edit"
        categories={categories}
        initialData={selectedSubCategory ? {
          name: selectedSubCategory.name,
          description: selectedSubCategory.description || undefined,
          categoryId: selectedSubCategory.categoryId,
        } : undefined}
        isLoading={updateSubCategoryMutation.isPending}
      />

      {/* Delete Category Confirmation */}
      <DeleteConfirmationDialog
        open={isDeleteCategoryDialogOpen}
        onOpenChange={setIsDeleteCategoryDialogOpen}
        onConfirm={confirmDeleteCategory}
        title="Delete Category"
        description={
          selectedCategory?.subCategories && selectedCategory.subCategories.length > 0
            ? `Are you sure you want to delete category "${selectedCategory.name}"? This will also delete ${selectedCategory.subCategories.length} subcategor${selectedCategory.subCategories.length === 1 ? 'y' : 'ies'} under this category. This action cannot be undone.`
            : `Are you sure you want to delete category "${selectedCategory?.name}"? This action cannot be undone.`
        }
        isLoading={deleteCategoryMutation.isPending}
      />

      {/* Delete Subcategory Confirmation */}
      <DeleteConfirmationDialog
        open={isDeleteSubCategoryDialogOpen}
        onOpenChange={setIsDeleteSubCategoryDialogOpen}
        onConfirm={confirmDeleteSubCategory}
        title="Delete Subcategory"
        description={`Are you sure you want to delete subcategory "${selectedSubCategory?.name}"? This action cannot be undone.`}
        isLoading={deleteSubCategoryMutation.isPending}
      />
    </div>
  )
}

