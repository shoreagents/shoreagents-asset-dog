'use client'

import { useState, useEffect } from 'react'
import { useLocations } from '@/hooks/use-locations'
import { useSites } from '@/hooks/use-sites'
import { useDepartments } from '@/hooks/use-departments'
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
import { DatePicker } from '@/components/ui/date-picker'
import { Filter, X } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface ReportFiltersProps {
  filters: {
    status?: string
    category?: string
    location?: string
    site?: string
    department?: string
    startDate?: string
    endDate?: string
  }
  onFiltersChange: (filters: ReportFiltersProps['filters']) => void
  disabled?: boolean
  hideStatus?: boolean
  isMobilePopover?: boolean
}

export function ReportFilters({ filters, onFiltersChange, disabled = false, hideStatus = false, isMobilePopover = false }: ReportFiltersProps) {
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
  const { data: departments = [] } = useDepartments(true)

  const statusOptions = [
    'Available',
    'Checked out',
    'Under repair',
    'Disposed',
    'Leased',
    'Reserved',
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

  // Content that can be rendered standalone or inside a popover
  const filterContent = (
    <div className="space-y-4">
      <div className={isMobilePopover ? "space-y-3" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"}>
        {/* Status Filter */}
        {!hideStatus && (
          <div className="space-y-2">
            <Label htmlFor="status-filter">Status</Label>
            <Select
              value={localFilters.status || 'all'}
              onValueChange={(value) => handleFilterChange('status', value === 'all' ? undefined : value)}
            >
              <SelectTrigger id="status-filter" className="w-full min-w-0">
                <SelectValue placeholder="All statuses" className="truncate" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Category Filter */}
        <div className="space-y-2">
          <Label htmlFor="category-filter">Category</Label>
          <Select
            value={localFilters.category || 'all'}
            onValueChange={(value) => handleFilterChange('category', value === 'all' ? undefined : value)}
          >
            <SelectTrigger id="category-filter" className="w-full min-w-0">
              <SelectValue placeholder="All categories" className="truncate" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories?.map((category: { id: string; name: string }) => (
                <SelectItem key={category.id} value={category.name}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Location Filter */}
        <div className="space-y-2">
          <Label htmlFor="location-filter">Location</Label>
          <Select
            value={localFilters.location || 'all'}
            onValueChange={(value) => handleFilterChange('location', value === 'all' ? undefined : value)}
          >
            <SelectTrigger id="location-filter" className="w-full min-w-0">
              <SelectValue placeholder="All locations" className="truncate" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locations?.map((location: { id: string; name: string }) => (
                <SelectItem key={location.id} value={location.name}>
                  {location.name}
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
            <SelectTrigger id="site-filter" className="w-full min-w-0">
              <SelectValue placeholder="All sites" className="truncate" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sites</SelectItem>
              {sites?.map((site: { id: string; name: string }) => (
                <SelectItem key={site.id} value={site.name}>
                  {site.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Department Filter */}
        <div className="space-y-2">
          <Label htmlFor="department-filter">Department</Label>
          <Select
            value={localFilters.department || 'all'}
            onValueChange={(value) => handleFilterChange('department', value === 'all' ? undefined : value)}
          >
            <SelectTrigger id="department-filter" className="w-full min-w-0">
              <SelectValue placeholder="All departments" className="truncate" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments?.map((dept: { id: string; name: string }) => (
                <SelectItem key={dept.id} value={dept.name}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Range */}
        <div className="space-y-2 min-w-0">
          <Label htmlFor="start-date">Start Date</Label>
          <div className="w-full overflow-hidden">
            <DatePicker
              id="start-date"
              value={localFilters.startDate || ''}
              onChange={(value) => handleFilterChange('startDate', value || '')}
              placeholder="Select start date"
              className="gap-2 w-full"
              labelClassName="hidden"
            />
          </div>
        </div>

        <div className="space-y-2 min-w-0">
          <Label htmlFor="end-date">End Date</Label>
          <div className="w-full overflow-hidden">
            <DatePicker
              id="end-date"
              value={localFilters.endDate || ''}
              onChange={(value) => handleFilterChange('endDate', value || '')}
              placeholder="Select end date"
              className="gap-2 w-full"
              labelClassName="hidden"
            />
          </div>
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
  )

  // If used inside a mobile popover, just return the content
  if (isMobilePopover) {
    return filterContent
  }

  // Otherwise, wrap in a Popover
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
        {filterContent}
      </PopoverContent>
    </Popover>
  )
}

