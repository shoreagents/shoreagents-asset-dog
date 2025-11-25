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
import { Checkbox } from '@/components/ui/checkbox'
import { MoreHorizontal, Trash2, Edit, Plus, MapPin, ArrowUpDown, Clock, Text as TextIcon } from 'lucide-react'
import { toast } from 'sonner'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'
import { BulkDeleteDialog } from '@/components/bulk-delete-dialog'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { usePermissions } from '@/hooks/use-permissions'
import { useQueryClient } from '@tanstack/react-query'
import { 
  useLocations, 
  useCreateLocation, 
  useUpdateLocation, 
  useDeleteLocation,
  type Location,
} from '@/hooks/use-locations'
import { LocationDialog } from '@/components/location-dialog'
import { useIsMobile } from '@/hooks/use-mobile'

export default function LocationsPage() {
  const queryClient = useQueryClient()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canManageSetup = hasPermission('canManageSetup')
  const isMobile = useIsMobile()
  
  const { data: locations = [], isLoading: locationsLoading, error: locationsError } = useLocations()
  const createLocationMutation = useCreateLocation()
  const updateLocationMutation = useUpdateLocation()
  const deleteLocationMutation = useDeleteLocation()

  // Dialog states
  const [isCreateLocationDialogOpen, setIsCreateLocationDialogOpen] = useState(false)
  const [isEditLocationDialogOpen, setIsEditLocationDialogOpen] = useState(false)
  const [isDeleteLocationDialogOpen, setIsDeleteLocationDialogOpen] = useState(false)
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)
  
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [selectedLocations, setSelectedLocations] = useState<Set<string>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'date'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const sortedLocations = useMemo(() => {
    return [...locations].sort((a, b) => {
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
  }, [locations, sortBy, sortOrder])

  // Location handlers
  const handleCreateLocation = async (data: { name: string; description?: string }) => {
    if (!canManageSetup) {
      toast.error('You do not have permission to manage locations')
      return
    }

    try {
      await createLocationMutation.mutateAsync(data)
      setIsCreateLocationDialogOpen(false)
      toast.success('Location created successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create location')
    }
  }

  const handleEditLocation = (location: Location) => {
    if (!canManageSetup) {
      toast.error('You do not have permission to manage locations')
      return
    }
    setSelectedLocation(location)
    setIsEditLocationDialogOpen(true)
  }

  const handleUpdateLocation = async (data: { name: string; description?: string }) => {
    if (!selectedLocation || !canManageSetup) return

    try {
      await updateLocationMutation.mutateAsync({
        id: selectedLocation.id,
        ...data,
      })
      setIsEditLocationDialogOpen(false)
      setSelectedLocation(null)
      toast.success('Location updated successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update location')
    }
  }

  const handleDeleteLocation = (location: Location) => {
    if (!canManageSetup) {
      toast.error('You do not have permission to manage locations')
      return
    }
    
    setSelectedLocation(location)
    setIsDeleteLocationDialogOpen(true)
  }

  const confirmDeleteLocation = async () => {
    if (!selectedLocation) return

    try {
      await deleteLocationMutation.mutateAsync(selectedLocation.id)
      setIsDeleteLocationDialogOpen(false)
      setSelectedLocation(null)
      toast.success('Location deleted successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete location')
    }
  }

  // Handle checkbox selection
  const handleLocationSelect = (e: React.MouseEvent, locationId: string) => {
    e.stopPropagation()
    toggleLocationSelection(locationId)
  }

  // Toggle location selection
  const toggleLocationSelection = (locationId: string) => {
    setSelectedLocations(prev => {
      const newSet = new Set(prev)
      if (newSet.has(locationId)) {
        newSet.delete(locationId)
      } else {
        newSet.add(locationId)
      }
      return newSet
    })
  }

  // Handle card click in selection mode
  const handleCardClick = (locationId: string) => {
    if (isSelectionMode) {
      toggleLocationSelection(locationId)
    }
  }

  // Toggle selection mode
  const handleToggleSelectionMode = () => {
    setIsSelectionMode(prev => !prev)
    if (isSelectionMode) {
      // Clear selections when exiting selection mode
      setSelectedLocations(new Set())
    }
  }

  // Handle select/deselect all
  const handleToggleSelectAll = () => {
    if (selectedLocations.size === locations.length) {
      setSelectedLocations(new Set())
    } else {
      setSelectedLocations(new Set(locations.map(loc => loc.id)))
    }
  }

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (selectedLocations.size === 0) return
    
    const selectedArray = Array.from(selectedLocations)
    
    try {
      // Delete locations one by one (since we need to check for associated assets)
      for (const locationId of selectedArray) {
        await deleteLocationMutation.mutateAsync(locationId)
      }
      
      toast.success(`Successfully deleted ${selectedArray.length} location(s)`)
      setSelectedLocations(new Set())
      setIsBulkDeleteDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ['locations'] })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete locations')
      setIsBulkDeleteDialogOpen(false)
    }
  }

  if (permissionsLoading || locationsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Spinner className="h-8 w-8" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (locationsError) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Locations</CardTitle>
            <CardDescription>Manage asset locations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MapPin className="h-12 w-12 text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error Loading Locations</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {locationsError instanceof Error ? locationsError.message : 'Failed to load locations'}
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
            <CardTitle>Locations</CardTitle>
            <CardDescription>Manage asset locations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
              <p className="text-sm text-muted-foreground">
                You do not have permission to manage locations. Please contact an administrator.
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
            <h1 className="text-3xl font-bold tracking-tight">Locations</h1>
            <p className="text-muted-foreground">
              Manage asset locations
            </p>
          </div>
          {/* Desktop: All controls on right */}
          {!isMobile && (
            <div className="flex items-center gap-2 self-end sm:self-auto">
              {isSelectionMode && (
                <div className="flex items-center gap-2 px-2">
                  <Checkbox
                    id="select-all-locations"
                    checked={selectedLocations.size === locations.length && locations.length > 0}
                    onCheckedChange={handleToggleSelectAll}
                    disabled={locations.length === 0}
                    title={selectedLocations.size === locations.length && locations.length > 0
                      ? 'Deselect All'
                      : 'Select All'}
                    className='cursor-pointer'
                  />
                  <span className="text-sm text-muted-foreground">
                    {selectedLocations.size} selected
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
              {isSelectionMode && selectedLocations.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setIsBulkDeleteDialogOpen(true)}
                  className="h-9"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete ({selectedLocations.size})
                </Button>
              )}
              <Button onClick={() => setIsCreateLocationDialogOpen(true)} size='sm' className="shadow-sm hover:shadow-md transition-all h-9">
                <Plus className="mr-2 h-4 w-4" />
                Add Location
              </Button>
            </div>
          )}
        </div>
        {/* Mobile: Selection controls when selection mode is active */}
        {isMobile && isSelectionMode && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <div className="flex items-center gap-2 px-2">
              <Checkbox
                id="select-all-locations-mobile"
                checked={selectedLocations.size === locations.length && locations.length > 0}
                onCheckedChange={handleToggleSelectAll}
                disabled={locations.length === 0}
                title={selectedLocations.size === locations.length && locations.length > 0
                  ? 'Deselect All'
                  : 'Select All'}
                className='cursor-pointer'
              />
              <span className="text-sm text-muted-foreground">
                {selectedLocations.size} selected
              </span>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={handleToggleSelectionMode}
            >
              Cancel
            </Button>
            {selectedLocations.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsBulkDeleteDialogOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete ({selectedLocations.size})
              </Button>
            )}
          </div>
        )}
        {/* Mobile: Select and Add Location buttons when selection mode is NOT active */}
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
            <Button onClick={() => setIsCreateLocationDialogOpen(true)} size='sm' className="w-full h-9 shadow-sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Location
            </Button>
          </div>
        )}
      </div>

      {locations.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="p-4 rounded-full bg-muted/50 mb-4">
                <MapPin className="h-12 w-12 text-muted-foreground/50" />
              </div>
            <h3 className="text-lg font-semibold mb-2">No Locations</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm text-center">
                Get started by creating your first location to track where your assets are stored.
            </p>
            <Button onClick={() => setIsCreateLocationDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Location
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
            {sortedLocations.map((location) => (
              <motion.div 
                key={location.id}
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
                selectedLocations.has(location.id)
                      ? 'border-primary bg-primary/5'
                  : ''
              }`}
              onClick={() => handleCardClick(location.id)}
            >
              {/* Checkbox - visible when in selection mode */}
                  <AnimatePresence>
              {isSelectionMode && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute top-3 left-3 z-20"
                  onClick={(e) => handleLocationSelect(e, location.id)}
                >
                  <Checkbox
                    checked={selectedLocations.has(location.id)}
                    onCheckedChange={() => toggleLocationSelection(location.id)}
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
                          <MapPin className="h-4 w-4" />
                        </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                          <CardTitle className="text-base font-semibold leading-tight line-clamp-2">{location.name}</CardTitle>
                      {location.description && (
                            <CardDescription className="mt-1.5 line-clamp-2 text-xs">
                          {location.description}
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
                        <DropdownMenuItem onClick={() => handleEditLocation(location)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteLocation(location)}
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

      {/* Create Location Dialog */}
      <LocationDialog
        open={isCreateLocationDialogOpen}
        onOpenChange={setIsCreateLocationDialogOpen}
        onSubmit={handleCreateLocation}
        mode="create"
        isLoading={createLocationMutation.isPending}
      />

      {/* Edit Location Dialog */}
      <LocationDialog
        open={isEditLocationDialogOpen}
        onOpenChange={setIsEditLocationDialogOpen}
        onSubmit={handleUpdateLocation}
        mode="edit"
        initialData={selectedLocation ? {
          name: selectedLocation.name,
          description: selectedLocation.description || undefined,
        } : undefined}
        isLoading={updateLocationMutation.isPending}
      />

      {/* Delete Location Confirmation */}
      <DeleteConfirmationDialog
        open={isDeleteLocationDialogOpen}
        onOpenChange={setIsDeleteLocationDialogOpen}
        onConfirm={confirmDeleteLocation}
        title="Delete Location"
        description={`Are you sure you want to delete location "${selectedLocation?.name}"? This action cannot be undone.`}
        isLoading={deleteLocationMutation.isPending}
      />

      {/* Bulk Delete Confirmation */}
      <BulkDeleteDialog
        open={isBulkDeleteDialogOpen}
        onOpenChange={setIsBulkDeleteDialogOpen}
        onConfirm={handleBulkDelete}
        itemCount={selectedLocations.size}
        itemName="Location"
        title={`Delete ${selectedLocations.size} Location(s)?`}
        description={`Are you sure you want to permanently delete ${selectedLocations.size} selected location(s)? This action cannot be undone.`}
        confirmLabel={`Delete ${selectedLocations.size} Location(s)`}
      />
    </motion.div>
  )
}

