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
  useSites, 
  useCreateSite, 
  useUpdateSite, 
  useDeleteSite,
  type Site,
} from '@/hooks/use-sites'
import { SiteDialog } from '@/components/site-dialog'
import { useIsMobile } from '@/hooks/use-mobile'

export default function SitesPage() {
  const queryClient = useQueryClient()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canManageSetup = hasPermission('canManageSetup')
  const isMobile = useIsMobile()
  
  const { data: sites = [], isLoading: sitesLoading, error: sitesError } = useSites()
  const createSiteMutation = useCreateSite()
  const updateSiteMutation = useUpdateSite()
  const deleteSiteMutation = useDeleteSite()

  // Dialog states
  const [isCreateSiteDialogOpen, setIsCreateSiteDialogOpen] = useState(false)
  const [isEditSiteDialogOpen, setIsEditSiteDialogOpen] = useState(false)
  const [isDeleteSiteDialogOpen, setIsDeleteSiteDialogOpen] = useState(false)
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)
  
  const [selectedSite, setSelectedSite] = useState<Site | null>(null)
  const [selectedSites, setSelectedSites] = useState<Set<string>>(new Set())
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'date'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  const sortedSites = useMemo(() => {
    return [...sites].sort((a, b) => {
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
  }, [sites, sortBy, sortOrder])

  // Site handlers
  const handleCreateSite = async (data: { name: string; description?: string }) => {
    if (!canManageSetup) {
      toast.error('You do not have permission to manage sites')
      return
    }

    try {
      await createSiteMutation.mutateAsync(data)
      setIsCreateSiteDialogOpen(false)
      toast.success('Site created successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create site')
    }
  }

  const handleEditSite = (site: Site) => {
    if (!canManageSetup) {
      toast.error('You do not have permission to manage sites')
      return
    }
    setSelectedSite(site)
    setIsEditSiteDialogOpen(true)
  }

  const handleUpdateSite = async (data: { name: string; description?: string }) => {
    if (!selectedSite || !canManageSetup) return

    try {
      await updateSiteMutation.mutateAsync({
        id: selectedSite.id,
        ...data,
      })
      setIsEditSiteDialogOpen(false)
      setSelectedSite(null)
      toast.success('Site updated successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update site')
    }
  }

  const handleDeleteSite = (site: Site) => {
    if (!canManageSetup) {
      toast.error('You do not have permission to manage sites')
      return
    }
    
    setSelectedSite(site)
    setIsDeleteSiteDialogOpen(true)
  }

  const confirmDeleteSite = async () => {
    if (!selectedSite) return

    try {
      await deleteSiteMutation.mutateAsync(selectedSite.id)
      setIsDeleteSiteDialogOpen(false)
      setSelectedSite(null)
      toast.success('Site deleted successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete site')
    }
  }

  // Handle checkbox selection
  const handleSiteSelect = (e: React.MouseEvent, siteId: string) => {
    e.stopPropagation()
    toggleSiteSelection(siteId)
  }

  // Toggle site selection
  const toggleSiteSelection = (siteId: string) => {
    setSelectedSites(prev => {
      const newSet = new Set(prev)
      if (newSet.has(siteId)) {
        newSet.delete(siteId)
      } else {
        newSet.add(siteId)
      }
      return newSet
    })
  }

  // Handle card click in selection mode
  const handleCardClick = (siteId: string) => {
    if (isSelectionMode) {
      toggleSiteSelection(siteId)
    }
  }

  // Toggle selection mode
  const handleToggleSelectionMode = () => {
    setIsSelectionMode(prev => !prev)
    if (isSelectionMode) {
      // Clear selections when exiting selection mode
      setSelectedSites(new Set())
    }
  }

  // Handle select/deselect all
  const handleToggleSelectAll = () => {
    if (selectedSites.size === sites.length) {
      setSelectedSites(new Set())
    } else {
      setSelectedSites(new Set(sites.map(site => site.id)))
    }
  }

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (!canManageSetup) {
      toast.error('You do not have permission to manage sites')
      return
    }
    if (selectedSites.size === 0) return
    
    const selectedArray = Array.from(selectedSites)
    
    try {
      // Delete sites one by one (since we need to check for associated assets)
      for (const siteId of selectedArray) {
        await deleteSiteMutation.mutateAsync(siteId)
      }
      
      toast.success(`Successfully deleted ${selectedArray.length} site(s)`)
      setSelectedSites(new Set())
      setIsBulkDeleteDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ['sites'] })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete sites')
      setIsBulkDeleteDialogOpen(false)
    }
  }

  if (permissionsLoading || sitesLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Spinner className="h-8 w-8" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (sitesError) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Sites</CardTitle>
            <CardDescription>Manage company sites/branches</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-12 w-12 text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2">Error Loading Sites</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {sitesError instanceof Error ? sitesError.message : 'Failed to load sites'}
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
            <CardTitle>Sites</CardTitle>
            <CardDescription>Manage company sites/branches</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
              <p className="text-sm text-muted-foreground">
                You do not have permission to manage sites. Please contact an administrator.
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
            <h1 className="text-3xl font-bold tracking-tight">Sites</h1>
            <p className="text-muted-foreground">
              Manage company sites/branches
            </p>
          </div>
          {/* Desktop: All controls on right */}
          {!isMobile && (
            <div className="flex items-center gap-2 self-end sm:self-auto">
              {isSelectionMode && (
                <div className="flex items-center gap-2 px-2">
                  <Checkbox
                    id="select-all-sites"
                    checked={selectedSites.size === sites.length && sites.length > 0}
                    onCheckedChange={handleToggleSelectAll}
                    disabled={sites.length === 0}
                    title={selectedSites.size === sites.length && sites.length > 0
                      ? 'Deselect All'
                      : 'Select All'}
                    className='cursor-pointer'
                  />
                  <span className="text-sm text-muted-foreground">
                    {selectedSites.size} selected
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
              {isSelectionMode && selectedSites.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setIsBulkDeleteDialogOpen(true)}
                  className="h-9"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete ({selectedSites.size})
                </Button>
              )}
              <Button onClick={() => setIsCreateSiteDialogOpen(true)} size='sm' className="shadow-sm hover:shadow-md transition-all h-9">
                <Plus className="mr-2 h-4 w-4" />
                Add Site
              </Button>
            </div>
          )}
        </div>
        {/* Mobile: Selection controls when selection mode is active */}
        {isMobile && isSelectionMode && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <div className="flex items-center gap-2 px-2">
              <Checkbox
                id="select-all-sites-mobile"
                checked={selectedSites.size === sites.length && sites.length > 0}
                onCheckedChange={handleToggleSelectAll}
                disabled={sites.length === 0}
                title={selectedSites.size === sites.length && sites.length > 0
                  ? 'Deselect All'
                  : 'Select All'}
                className='cursor-pointer'
              />
              <span className="text-sm text-muted-foreground">
                {selectedSites.size} selected
              </span>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={handleToggleSelectionMode}
            >
              Cancel
            </Button>
            {selectedSites.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsBulkDeleteDialogOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete ({selectedSites.size})
              </Button>
            )}
          </div>
        )}
        {/* Mobile: Select and Add Site buttons when selection mode is NOT active */}
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
            <Button onClick={() => setIsCreateSiteDialogOpen(true)} size='sm' className="w-full h-9 shadow-sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Site
            </Button>
          </div>
        )}
      </div>

      {sites.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="border-dashed border-2">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="p-4 rounded-full bg-muted/50 mb-4">
                <Building2 className="h-12 w-12 text-muted-foreground/50" />
              </div>
            <h3 className="text-lg font-semibold mb-2">No Sites</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm text-center">
                Get started by creating your first site to track where your assets are stored.
            </p>
            <Button onClick={() => setIsCreateSiteDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Site
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
            {sortedSites.map((site) => (
              <motion.div 
                key={site.id}
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
                selectedSites.has(site.id)
                      ? 'border-primary bg-primary/5'
                  : ''
              }`}
              onClick={() => handleCardClick(site.id)}
            >
              {/* Checkbox - visible when in selection mode */}
                  <AnimatePresence>
              {isSelectionMode && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute top-3 left-3 z-20"
                  onClick={(e) => handleSiteSelect(e, site.id)}
                >
                  <Checkbox
                    checked={selectedSites.has(site.id)}
                    onCheckedChange={() => toggleSiteSelection(site.id)}
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
                          <CardTitle className="text-base font-semibold leading-tight line-clamp-2">{site.name}</CardTitle>
                      {site.description && (
                            <CardDescription className="mt-1.5 line-clamp-2 text-xs">
                          {site.description}
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
                        <DropdownMenuItem onClick={() => handleEditSite(site)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteSite(site)}
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

      {/* Create Site Dialog */}
      <SiteDialog
        open={isCreateSiteDialogOpen}
        onOpenChange={setIsCreateSiteDialogOpen}
        onSubmit={handleCreateSite}
        mode="create"
        isLoading={createSiteMutation.isPending}
      />

      {/* Edit Site Dialog */}
      <SiteDialog
        open={isEditSiteDialogOpen}
        onOpenChange={setIsEditSiteDialogOpen}
        onSubmit={handleUpdateSite}
        mode="edit"
        initialData={selectedSite ? {
          name: selectedSite.name,
          description: selectedSite.description || undefined,
        } : undefined}
        isLoading={updateSiteMutation.isPending}
      />

      {/* Delete Site Confirmation */}
      <DeleteConfirmationDialog
        open={isDeleteSiteDialogOpen}
        onOpenChange={setIsDeleteSiteDialogOpen}
        onConfirm={confirmDeleteSite}
        title="Delete Site"
        description={`Are you sure you want to delete site "${selectedSite?.name}"? This action cannot be undone.`}
        isLoading={deleteSiteMutation.isPending}
      />

      {/* Bulk Delete Confirmation */}
      <BulkDeleteDialog
        open={isBulkDeleteDialogOpen}
        onOpenChange={setIsBulkDeleteDialogOpen}
        onConfirm={handleBulkDelete}
        itemCount={selectedSites.size}
        itemName="Site"
        title={`Delete ${selectedSites.size} Site(s)?`}
        description={`Are you sure you want to permanently delete ${selectedSites.size} selected site(s)? This action cannot be undone.`}
        confirmLabel={`Delete ${selectedSites.size} Site(s)`}
      />
    </motion.div>
  )
}

