'use client'

import { useState, useEffect } from 'react'
import { useLocations } from '@/hooks/use-locations'
import { useSites } from '@/hooks/use-sites'
import { useCategories } from '@/hooks/use-categories'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Filter, X } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface LeaseReportFiltersProps {
  filters: {
    category?: string
    lessee?: string
    location?: string
    site?: string
    status?: string
    startDate?: string
    endDate?: string
  }
  onFiltersChange: (filters: LeaseReportFiltersProps['filters']) => void
  disabled?: boolean
}

export function LeaseReportFilters({ filters, onFiltersChange, disabled = false }: LeaseReportFiltersProps) {
  const [open, setOpen] = useState(false)
  const [localFilters, setLocalFilters] = useState(filters)

  // Sync local filters with props
  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  // Fetch options for dropdowns
  const { data: categories = [] } = useCategories(true)

  const { data: locations = [] } = useLocations(true)
  const { data: sites = [] } = useSites(true)

  const leaseStatuses = [
    { value: 'active', label: 'Active' },
    { value: 'expired', label: 'Expired' },
    { value: 'upcoming', label: 'Upcoming' },
  ]

  const handleFilterChange = (key: string, value: string | undefined) => {
    const newFilters = { ...localFilters, [key]: value || undefined }
    setLocalFilters(newFilters)
  }

  const handleApplyFilters = () => {
    onFiltersChange(localFilters)
    setOpen(false)
  }

  const handleClearFilters = () => {
    const clearedFilters = {}
    setLocalFilters(clearedFilters)
    onFiltersChange(clearedFilters)
  }

  const hasActiveFilters = Object.values(filters).some((value) => value !== undefined && value !== '')

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          disabled={disabled}
          className="bg-gray-400 bg-clip-padding backdrop-filter backdrop-blur-md bg-opacity-10 border shadow-sm"
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {hasActiveFilters && (
            <span className="ml-2 h-2 w-2 rounded-full bg-primary" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-w-[500px] w-[calc(100vw-2rem)] sm:w-full" align="start">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category Filter */}
            <div className="space-y-2">
              <Label htmlFor="category-filter">Category</Label>
              <Select
                value={localFilters.category || 'all'}
                onValueChange={(value) => handleFilterChange('category', value === 'all' ? undefined : value)}
              >
                <SelectTrigger id="category-filter" className="w-full truncate">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories?.map((cat: { id: string; name: string }) => (
                    <SelectItem key={cat.id} value={cat.name} className="truncate">
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Lessee Filter */}
            <div className="space-y-2">
              <Label htmlFor="lessee-filter">Lessee</Label>
              <Input
                id="lessee-filter"
                placeholder="Search lessee..."
                value={localFilters.lessee || ''}
                onChange={(e) => handleFilterChange('lessee', e.target.value || undefined)}
                className="w-full"
              />
            </div>

            {/* Location Filter */}
            <div className="space-y-2">
              <Label htmlFor="location-filter">Location</Label>
              <Select
                value={localFilters.location || 'all'}
                onValueChange={(value) => handleFilterChange('location', value === 'all' ? undefined : value)}
              >
                <SelectTrigger id="location-filter" className="w-full truncate">
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations?.map((loc: { id: string; name: string }) => (
                    <SelectItem key={loc.id} value={loc.name} className="truncate">
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Site Filter */}
            <div className="space-y-2">
              <Label htmlFor="site-filter">Site</Label>
              <Select
                value={localFilters.site || 'all'}
                onValueChange={(value) => handleFilterChange('site', value === 'all' ? undefined : value)}
              >
                <SelectTrigger id="site-filter" className="w-full truncate">
                  <SelectValue placeholder="All Sites" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sites</SelectItem>
                  {sites?.map((site: { id: string; name: string }) => (
                    <SelectItem key={site.id} value={site.name} className="truncate">
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label htmlFor="status-filter">Lease Status</Label>
              <Select
                value={localFilters.status || 'all'}
                onValueChange={(value) => handleFilterChange('status', value === 'all' ? undefined : value)}
              >
                <SelectTrigger id="status-filter" className="w-full truncate">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {leaseStatuses.map((status) => (
                    <SelectItem key={status.value} value={status.value} className="truncate">
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start Date Filter */}
            <div className="space-y-2">
              <Label htmlFor="start-date-filter">Lease Start From</Label>
              <Input
                id="start-date-filter"
                type="date"
                value={localFilters.startDate || ''}
                onChange={(e) => handleFilterChange('startDate', e.target.value || undefined)}
                className="w-full"
              />
            </div>

            {/* End Date Filter */}
            <div className="space-y-2">
              <Label htmlFor="end-date-filter">Lease Start To</Label>
              <Input
                id="end-date-filter"
                type="date"
                value={localFilters.endDate || ''}
                onChange={(e) => handleFilterChange('endDate', e.target.value || undefined)}
                className="w-full"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-0 pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              disabled={!hasActiveFilters}
              className="w-full sm:w-auto"
            >
              <X className="h-4 w-4 mr-2" />
              Clear All
            </Button>
            <Button size="sm" onClick={handleApplyFilters} className="w-full sm:w-auto">
              Apply Filters
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

