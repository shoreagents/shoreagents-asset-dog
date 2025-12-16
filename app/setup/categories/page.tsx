'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MoreHorizontal, Trash2, Edit, Plus, Folder, FolderOpen, FolderTree, ArrowUpDown, Clock, Text as TextIcon } from 'lucide-react'
import { toast } from 'sonner'
import { DeleteConfirmationDialog } from '@/components/dialogs/delete-confirmation-dialog'
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
import { CategoryDialog } from '@/components/dialogs/category-dialog'
import { SubCategoryDialog } from '@/components/dialogs/subcategory-dialog'
import { useMobileDock } from '@/components/mobile-dock-provider'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

export default function CategoriesPage() {
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canManageSetup = hasPermission('canManageSetup')
  const isMobile = useIsMobile()
  const { setDockContent } = useMobileDock()
  
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
  const [sortBy, setSortBy] = useState<'name' | 'date'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      if (sortBy === 'name') {
        return sortOrder === 'asc' 
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name)
      } else {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
      }
    })
  }, [categories, sortBy, sortOrder])

  // Set mobile dock content
  useEffect(() => {
    if (isMobile) {
      setDockContent(
        <>
          <Button 
            onClick={() => setIsCreateCategoryDialogOpen(true)}
            variant="outline"
            size="lg"
            className="rounded-full btn-glass-elevated"
          >
            Add Category
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-full btn-glass-elevated h-10 w-10">
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => setSortBy(v as 'name' | 'date')}>
                <DropdownMenuRadioItem value="name">
                  <TextIcon className="mr-2 h-4 w-4" />
                  Name
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="date">
                  <Clock className="mr-2 h-4 w-4" />
                  Date Created
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={sortOrder} onValueChange={(v) => setSortOrder(v as 'asc' | 'desc')}>
                <DropdownMenuRadioItem value="asc">
                  Ascending
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="desc">
                  Descending
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )
    } else {
      setDockContent(null)
    }
    
    return () => {
      setDockContent(null)
    }
  }, [isMobile, setDockContent, sortBy, sortOrder, setIsCreateCategoryDialogOpen])

  // Category handlers
  const handleCreateCategory = async (data: { name: string; description?: string }) => {
    if (!canManageSetup) {
      toast.error('You do not have permission to manage categories')
      return
    }

    // Client-side validation: check for duplicate category names
    const duplicateCategory = categories.find(
      cat => cat.name.toLowerCase().trim() === data.name.toLowerCase().trim()
    )
    if (duplicateCategory) {
      toast.error('A category with this name already exists')
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
    if (!canManageSetup) {
      toast.error('You do not have permission to manage categories')
      return
    }
    setSelectedCategory(category)
    setIsEditCategoryDialogOpen(true)
  }

  const handleUpdateCategory = async (data: { name: string; description?: string }) => {
    if (!selectedCategory || !canManageSetup) return

    // Client-side validation: check for duplicate category names (excluding current category)
    const duplicateCategory = categories.find(
      cat => cat.id !== selectedCategory.id && cat.name.toLowerCase().trim() === data.name.toLowerCase().trim()
    )
    if (duplicateCategory) {
      toast.error('A category with this name already exists')
      return
    }

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
    if (!canManageSetup) {
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
    if (!canManageSetup) {
      toast.error('You do not have permission to manage categories')
      return
    }
    setSelectedCategory(category)
    setIsCreateSubCategoryDialogOpen(true)
  }

  const handleCreateSubCategorySubmit = async (data: { name: string; description?: string; categoryId: string }) => {
    if (!canManageSetup) return

    // Client-side validation: check for duplicate subcategory names within the same category
    const category = categories.find(cat => cat.id === data.categoryId)
    if (category) {
      const duplicateSubCategory = category.subCategories.find(
        sub => sub.name.toLowerCase().trim() === data.name.toLowerCase().trim()
      )
      if (duplicateSubCategory) {
        toast.error('A subcategory with this name already exists in this category')
        return
      }
    }

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
    if (!canManageSetup) {
      toast.error('You do not have permission to manage categories')
      return
    }
    setSelectedSubCategory({ ...subCategory, categoryId })
    setIsEditSubCategoryDialogOpen(true)
  }

  const handleUpdateSubCategory = async (data: { name: string; description?: string; categoryId: string }) => {
    if (!selectedSubCategory || !canManageSetup) return

    // Client-side validation: check for duplicate subcategory names within the same category (excluding current subcategory)
    const category = categories.find(cat => cat.id === data.categoryId)
    if (category) {
      const duplicateSubCategory = category.subCategories.find(
        sub => sub.id !== selectedSubCategory.id && sub.name.toLowerCase().trim() === data.name.toLowerCase().trim()
      )
      if (duplicateSubCategory) {
        toast.error('A subcategory with this name already exists in this category')
        return
      }
    }

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
    if (!canManageSetup) {
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
            <CardTitle>Categories</CardTitle>
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

  if (!canManageSetup) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
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
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-end gap-4 flex-wrap">
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground">
            Manage asset categories and their subcategories
          </p>
        </div>
        <div className={cn("flex items-center gap-2", isMobile && "hidden")}>
           <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <ArrowUpDown className="mr-2 h-4 w-4" />
                Sort by
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => setSortBy(v as 'name' | 'date')}>
                <DropdownMenuRadioItem value="name">
                  <TextIcon className="mr-2 h-4 w-4" />
                  Name
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="date">
                  <Clock className="mr-2 h-4 w-4" />
                  Date Created
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={sortOrder} onValueChange={(v) => setSortOrder(v as 'asc' | 'desc')}>
                <DropdownMenuRadioItem value="asc">
                  Ascending
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="desc">
                  Descending
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => setIsCreateCategoryDialogOpen(true)} size='sm' className="shadow-sm hover:shadow-md transition-all h-9">
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>
        </div>
      </div>

      {categories.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="p-4 rounded-full bg-muted/50 mb-4">
                <Folder className="h-12 w-12 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Categories</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm text-center">
                Get started by creating your first category to organize your assets efficiently.
              </p>
              <Button onClick={() => setIsCreateCategoryDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Category
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div 
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: {
                staggerChildren: 0.1
              }
            }
          }}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          <AnimatePresence mode='popLayout'>
            {sortedCategories.map((category) => (
              <motion.div 
                key={category.id} 
                layout 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <Card className="flex flex-col h-full hover:shadow-md transition-all duration-300 border-muted/60 group/card overflow-hidden">
                  <CardHeader className="pb-3 bg-muted/10 border-b border-border/50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 flex-1 min-w-0 pr-1">
                        <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0 mt-0.5">
                          <FolderOpen className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <CardTitle className="text-base font-semibold leading-tight line-clamp-2">{category.name}</CardTitle>
                          {category.description && (
                            <CardDescription className="mt-1.5 line-clamp-2 text-xs">
                              {category.description}
                            </CardDescription>
                          )}
                        </div>
                      </div>
                      {canManageSetup && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 shrink-0 hover:bg-background/80 data-[state=open]:bg-background/80 rounded-full">
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
                              className="text-red-600 focus:text-red-600 focus:bg-red-50"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col pt-4">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        <FolderTree className="h-3 w-3" />
                        <span>Subcategories ({category.subCategories?.length || 0})</span>
                      </div>
                      {canManageSetup && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCreateSubCategory(category)}
                          className="h-7 text-xs shrink-0 hover:bg-primary/10 hover:text-primary"
                        >
                          <Plus className="mr-1.5 h-3 w-3" />
                          Add
                        </Button>
                      )}
                    </div>
                    {category.subCategories && category.subCategories.length > 0 ? (
                      <ScrollArea className="flex-1 max-h-[240px] -mr-4 pr-4">
                        <div className="space-y-2 pb-2">
                          <AnimatePresence>
                            {category.subCategories.map((subCategory) => (
                              <motion.div
                                key={subCategory.id}
                                layout
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                className="group flex items-start justify-between gap-2 p-2.5 rounded-lg bg-muted/30 border border-transparent hover:border-border hover:bg-background hover:shadow-sm transition-all duration-200"
                              >
                              <div className="flex-1 min-w-0 overflow-hidden pr-1">
                                <div className="font-medium text-sm leading-tight truncate">{subCategory.name}</div>
                                {subCategory.description && (
                                  <div className="text-xs text-muted-foreground mt-1 truncate opacity-80">
                                    {subCategory.description}
                                  </div>
                                )}
                              </div>
                              {canManageSetup && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button 
                                      variant="ghost" 
                                      className="h-6 w-6 p-0 shrink-0 hover:bg-muted rounded-full"
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
                                      className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                      </ScrollArea>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center py-8 min-h-[100px] rounded-lg border-2 border-dashed border-muted/50 bg-muted/5">
                        <p className="text-xs text-muted-foreground mb-3 font-medium">No subcategories yet</p>
                        {canManageSetup && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCreateSubCategory(category)}
                            className="h-7 text-xs bg-background/50"
                          >
                            <Plus className="mr-1.5 h-3 w-3" />
                            Add First
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
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
    </motion.div>
  )
}

