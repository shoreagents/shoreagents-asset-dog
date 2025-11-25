'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { MoreHorizontal, Trash2, Edit, Plus, Building2, ArrowUpDown, Clock, Text as TextIcon } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { BulkDeleteDialog } from '@/components/bulk-delete-dialog'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { usePermissions } from '@/hooks/use-permissions'
import { useQueryClient } from '@tanstack/react-query'
import { 
  useDepartments, 
  useCreateDepartment, 
  useUpdateDepartment, 
  useDeleteDepartment,
  type Department,
} from '@/hooks/use-departments'
import { DepartmentDialog } from '@/components/department-dialog'
import { useIsMobile } from '@/hooks/use-mobile'

export default function DepartmentsPage() {
  const queryClient = useQueryClient()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canManageSetup = hasPermission('canManageSetup')
  const isMobile = useIsMobile()
  
  const { data: departments = [], isLoading: departmentsLoading, error: departmentsError } = useDepartments()
  const createDepartmentMutation = useCreateDepartment()
  const updateDepartmentMutation = useUpdateDepartment()
  const deleteDepartmentMutation = useDeleteDepartment()

  // Dialog states
  const [isCreateDepartmentDialogOpen, setIsCreateDepartmentDialogOpen] = useState(false)
  const [isEditDepartmentDialogOpen, setIsEditDepartmentDialogOpen] = useState(false)
  const [isDeleteDepartmentDialogOpen, setIsDeleteDepartmentDialogOpen] = useState(false)
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)
  
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null)
  const [selectedDepartments, setSelectedDepartments] = useState<Set<string>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'date'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const sortedDepartments = useMemo(() => {
    return [...departments].sort((a, b) => {
      if (sortBy === 'name') {
        return sortOrder === 'asc' 
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name)
      } else {
        const dateA = new Date(a.createdAt).getTime()
        const dateB = new Date(b.createdAt).getTime()
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA
      }
    })
  }, [departments, sortBy, sortOrder])

  // Department handlers
  const handleCreateDepartment = async (data: { name: string; description?: string }) => {
    if (!canManageSetup) {
      toast.error('You do not have permission to manage departments')
      return
    }

    try {
      await createDepartmentMutation.mutateAsync(data)
      setIsCreateDepartmentDialogOpen(false)
      toast.success('Department created successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create department')
    }
  }

  const handleEditDepartment = (department: Department) => {
    if (!canManageSetup) {
      toast.error('You do not have permission to manage departments')
      return
    }
    setSelectedDepartment(department)
    setIsEditDepartmentDialogOpen(true)
  }

  const handleUpdateDepartment = async (data: { name: string; description?: string }) => {
    if (!selectedDepartment || !canManageSetup) return

    try {
      await updateDepartmentMutation.mutateAsync({
        id: selectedDepartment.id,
        ...data,
      })
      setIsEditDepartmentDialogOpen(false)
      setSelectedDepartment(null)
      toast.success('Department updated successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update department')
    }
  }

  const handleDeleteDepartment = (department: Department) => {
    if (!canManageSetup) {
      toast.error('You do not have permission to manage departments')
      return
    }
    
    setSelectedDepartment(department)
    setIsDeleteDepartmentDialogOpen(true)
  }

  const confirmDeleteDepartment = async () => {
    if (!selectedDepartment) return

    try {
      await deleteDepartmentMutation.mutateAsync(selectedDepartment.id)
      setIsDeleteDepartmentDialogOpen(false)
      setSelectedDepartment(null)
      toast.success('Department deleted successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete department')
    }
  }

  // Handle checkbox selection
  const handleDepartmentSelect = (e: React.MouseEvent, departmentId: string) => {
    e.stopPropagation()
    toggleDepartmentSelection(departmentId)
  }

  // Toggle department selection
  const toggleDepartmentSelection = (departmentId: string) => {
    setSelectedDepartments(prev => {
      const newSet = new Set(prev)
      if (newSet.has(departmentId)) {
        newSet.delete(departmentId)
      } else {
        newSet.add(departmentId)
      }
      return newSet
    })
  }

  // Handle card click in selection mode
  const handleCardClick = (departmentId: string) => {
    if (isSelectionMode) {
      toggleDepartmentSelection(departmentId)
    }
  }

  // Toggle selection mode
  const handleToggleSelectionMode = () => {
    setIsSelectionMode(prev => !prev)
    if (isSelectionMode) {
      // Clear selections when exiting selection mode
      setSelectedDepartments(new Set())
    }
  }

  // Handle select/deselect all
  const handleToggleSelectAll = () => {
    if (selectedDepartments.size === departments.length) {
      setSelectedDepartments(new Set())
    } else {
      setSelectedDepartments(new Set(departments.map(dept => dept.id)))
    }
  }

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (!canManageSetup) {
      toast.error('You do not have permission to manage departments')
      return
    }
    if (selectedDepartments.size === 0) return
    
    const selectedArray = Array.from(selectedDepartments)
    
    try {
      // Delete departments one by one (since we need to check for associated assets)
      for (const departmentId of selectedArray) {
        await deleteDepartmentMutation.mutateAsync(departmentId)
      }
      
      toast.success(`Successfully deleted ${selectedArray.length} department(s)`)
      setSelectedDepartments(new Set())
      setIsBulkDeleteDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ['departments'] })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete departments')
      setIsBulkDeleteDialogOpen(false)
    }
  }

  if (permissionsLoading || departmentsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Spinner className="h-8 w-8" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (departmentsError) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Departments</CardTitle>
            <CardDescription>Manage asset departments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-12 w-12 text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error Loading Departments</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {departmentsError instanceof Error ? departmentsError.message : 'Failed to load departments'}
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
            <CardTitle>Departments</CardTitle>
            <CardDescription>Manage asset departments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
              <p className="text-sm text-muted-foreground">
                You do not have permission to manage departments. Please contact an administrator.
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
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Departments</h1>
            <p className="text-muted-foreground">
              Manage asset departments
            </p>
          </div>
          {/* Desktop: All controls on right */}
          {!isMobile && (
            <div className="flex items-center gap-2 self-end sm:self-auto">
              {isSelectionMode && (
                <div className="flex items-center gap-2 px-2">
                  <Checkbox
                    id="select-all-departments"
                    checked={selectedDepartments.size === departments.length && departments.length > 0}
                    onCheckedChange={handleToggleSelectAll}
                    disabled={departments.length === 0}
                    title={selectedDepartments.size === departments.length && departments.length > 0
                      ? 'Deselect All'
                      : 'Select All'}
                    className='cursor-pointer'
                  />
                  <span className="text-sm text-muted-foreground">
                    {selectedDepartments.size} selected
                  </span>
                </div>
              )}
              
              {!isSelectionMode && (
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
              )}

              <Button
                variant={isSelectionMode ? "default" : "outline"}
                size="sm"
                onClick={handleToggleSelectionMode}
                className="h-9"
              >
                {isSelectionMode ? "Cancel" : "Select"}
              </Button>
              {isSelectionMode && selectedDepartments.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setIsBulkDeleteDialogOpen(true)}
                  className="h-9"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete ({selectedDepartments.size})
                </Button>
              )}
              <Button onClick={() => setIsCreateDepartmentDialogOpen(true)} size='sm' className="shadow-sm hover:shadow-md transition-all h-9">
                <Plus className="mr-2 h-4 w-4" />
                Add Department
              </Button>
            </div>
          )}
        </div>
        {/* Mobile: Selection controls when selection mode is active */}
        {isMobile && isSelectionMode && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <div className="flex items-center gap-2 px-2">
              <Checkbox
                id="select-all-departments-mobile"
                checked={selectedDepartments.size === departments.length && departments.length > 0}
                onCheckedChange={handleToggleSelectAll}
                disabled={departments.length === 0}
                title={selectedDepartments.size === departments.length && departments.length > 0
                  ? 'Deselect All'
                  : 'Select All'}
                className='cursor-pointer'
              />
              <span className="text-sm text-muted-foreground">
                {selectedDepartments.size} selected
              </span>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={handleToggleSelectionMode}
            >
              Cancel
            </Button>
            {selectedDepartments.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsBulkDeleteDialogOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete ({selectedDepartments.size})
              </Button>
            )}
          </div>
        )}
        {/* Mobile: Select and Add Department buttons when selection mode is NOT active */}
        {isMobile && !isSelectionMode && (
          <div className="flex flex-col gap-2">
          <div className="flex items-center justify-end gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 flex-1">
                    <ArrowUpDown className="mr-2 h-4 w-4" />
                    Sort
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleSelectionMode}
                className="h-9 flex-1"
            >
              Select
            </Button>
            </div>
            <Button onClick={() => setIsCreateDepartmentDialogOpen(true)} size='sm' className="w-full h-9 shadow-sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Department
            </Button>
          </div>
        )}
      </div>

      {departments.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="p-4 rounded-full bg-muted/50 mb-4">
                <Building2 className="h-12 w-12 text-muted-foreground/50" />
              </div>
            <h3 className="text-lg font-semibold mb-2">No Departments</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm text-center">
                Get started by creating your first department to manage your organization.
            </p>
            <Button onClick={() => setIsCreateDepartmentDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Department
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
                staggerChildren: 0.05
              }
            }
          }}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          <AnimatePresence mode='popLayout'>
            {sortedDepartments.map((department) => (
              <motion.div 
                key={department.id}
                layout 
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  show: { opacity: 1, y: 0 }
                }}
                className="h-full"
              >
            <Card 
                  className={`flex flex-col h-full group relative transition-all duration-200 hover:shadow-md border-muted/60 ${
                    isSelectionMode ? 'cursor-pointer hover:border-primary/50' : ''
              } ${
                selectedDepartments.has(department.id)
                      ? 'border-primary bg-primary/5'
                  : ''
              }`}
              onClick={() => handleCardClick(department.id)}
            >
              {/* Checkbox - visible when in selection mode */}
                  <AnimatePresence>
              {isSelectionMode && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute top-3 left-3 z-20"
                  onClick={(e) => handleDepartmentSelect(e, department.id)}
                >
                  <Checkbox
                    checked={selectedDepartments.has(department.id)}
                    onCheckedChange={() => toggleDepartmentSelection(department.id)}
                    onClick={(e) => e.stopPropagation()}
                          className="border-muted-foreground/40 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground cursor-pointer bg-background shadow-sm"
                  />
                      </motion.div>
              )}
                  </AnimatePresence>
                  
                  <CardHeader className={`pb-3 ${isSelectionMode ? 'pl-10' : ''} transition-all`}>
                <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 flex-1 min-w-0 pr-1">
                        <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0 mt-0.5">
                          <Building2 className="h-4 w-4" />
                        </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                          <CardTitle className="text-base font-semibold leading-tight line-clamp-2">{department.name}</CardTitle>
                      {department.description && (
                            <CardDescription className="mt-1.5 line-clamp-2 text-xs">
                          {department.description}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  {canManageSetup && !isSelectionMode && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                              className="h-8 w-8 p-0 shrink-0 hover:bg-background/80 data-[state=open]:bg-background/80"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditDepartment(department)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteDepartment(department)}
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
            </Card>
              </motion.div>
          ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Create Department Dialog */}
      <DepartmentDialog
        open={isCreateDepartmentDialogOpen}
        onOpenChange={setIsCreateDepartmentDialogOpen}
        onSubmit={handleCreateDepartment}
        mode="create"
        isLoading={createDepartmentMutation.isPending}
      />

      {/* Edit Department Dialog */}
      <DepartmentDialog
        open={isEditDepartmentDialogOpen}
        onOpenChange={setIsEditDepartmentDialogOpen}
        onSubmit={handleUpdateDepartment}
        mode="edit"
        initialData={selectedDepartment ? {
          name: selectedDepartment.name,
          description: selectedDepartment.description || undefined,
        } : undefined}
        isLoading={updateDepartmentMutation.isPending}
      />

      {/* Delete Department Confirmation */}
      <DeleteConfirmationDialog
        open={isDeleteDepartmentDialogOpen}
        onOpenChange={setIsDeleteDepartmentDialogOpen}
        onConfirm={confirmDeleteDepartment}
        title="Delete Department"
        description={`Are you sure you want to delete department "${selectedDepartment?.name}"? This action cannot be undone.`}
        isLoading={deleteDepartmentMutation.isPending}
      />

      {/* Bulk Delete Confirmation */}
      <BulkDeleteDialog
        open={isBulkDeleteDialogOpen}
        onOpenChange={setIsBulkDeleteDialogOpen}
        onConfirm={handleBulkDelete}
        itemCount={selectedDepartments.size}
        itemName="Department"
        title={`Delete ${selectedDepartments.size} Department(s)?`}
        description={`Are you sure you want to permanently delete ${selectedDepartments.size} selected department(s)? This action cannot be undone.`}
        confirmLabel={`Delete ${selectedDepartments.size} Department(s)`}
      />
    </motion.div>
  )
}

