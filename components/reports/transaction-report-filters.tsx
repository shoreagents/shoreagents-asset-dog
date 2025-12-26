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

interface TransactionReportFiltersProps {
  filters: {
    category?: string
    location?: string
    site?: string
    department?: string
    actionBy?: string
    startDate?: string
    endDate?: string
  }
  onFiltersChange: (filters: TransactionReportFiltersProps['filters']) => void
  disabled?: boolean
  isMobilePopover?: boolean
}

export function TransactionReportFilters({ filters, onFiltersChange, disabled = false, isMobilePopover = false }: TransactionReportFiltersProps) {
  const [open, setOpen] = useState(false)
  const [localFilters, setLocalFilters] = useState(filters)

  // Sync local filters with props
  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  // Fetch categories
  const { data: categories = [] } = useCategories(true)

  // Fetch locations
  const { data: locations = [] } = useLocations(true)

  // Fetch sites
  const { data: sites = [] } = useSites(true)

  // Fetch departments
  const { data: departments = [] } = useDepartments(true)

  const handleFilterChange = (key: string, value: string | undefined) => {
    const newFilters = { ...localFilters, [key]: value || undefined }
    setLocalFilters(newFilters)
  }

  const handleApplyFilters = () => {
    onFiltersChange(localFilters)
    setOpen(false)
  }

  const handleClearFilters = () => {
    const clearedFilters: TransactionReportFiltersProps['filters'] = {}
    setLocalFilters(clearedFilters)
    onFiltersChange(clearedFilters)
  }

  const hasActiveFilters = Object.values(filters).some((value) => value !== undefined && value !== '')

  const content = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Category Filter */}
        <div className="space-y-2">
          <Label htmlFor="category-filter">Category</Label>
          <Select
            value={localFilters.category || 'all'}
            onValueChange={(value) => handleFilterChange('category', value === 'all' ? undefined : value)}
            disabled={disabled}
          >
            <SelectTrigger id="category-filter" className="w-full min-w-0">
              <SelectValue placeholder="All categories" className="truncate" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories?.map((cat: { id: string; name: string }) => (
                <SelectItem key={cat.id} value={cat.name} className="truncate">
                  {cat.name}
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
            disabled={disabled}
          >
            <SelectTrigger id="location-filter" className="w-full min-w-0">
              <SelectValue placeholder="All locations" className="truncate" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
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
            disabled={disabled}
          >
            <SelectTrigger id="site-filter" className="w-full min-w-0">
              <SelectValue placeholder="All sites" className="truncate" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sites</SelectItem>
              {sites?.map((site: { id: string; name: string }) => (
                <SelectItem key={site.id} value={site.name} className="truncate">
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
            disabled={disabled}
          >
            <SelectTrigger id="department-filter" className="w-full min-w-0">
              <SelectValue placeholder="All departments" className="truncate" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments?.map((dept: { id: string; name: string }) => (
                <SelectItem key={dept.id} value={dept.name} className="truncate">
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action By Filter */}
        <div className="space-y-2">
          <Label htmlFor="action-by-filter">Action By (User)</Label>
          <Input
            id="action-by-filter"
            placeholder="Filter by user..."
            value={localFilters.actionBy || ''}
            onChange={(e) => handleFilterChange('actionBy', e.target.value || undefined)}
            disabled={disabled}
            className="w-full"
          />
        </div>

        {/* Start Date Filter */}
        <div className="space-y-2 min-w-0">
          <Label htmlFor="start-date-filter">Start Date</Label>
          <div className="w-full overflow-hidden">
            <DatePicker
              id="start-date-filter"
              value={localFilters.startDate || ''}
              onChange={(value) => handleFilterChange('startDate', value || undefined)}
              disabled={disabled}
              placeholder="Select start date"
              className="gap-2 w-full"
              labelClassName="hidden"
            />
          </div>
        </div>

        {/* End Date Filter */}
        <div className="space-y-2 min-w-0">
          <Label htmlFor="end-date-filter">End Date</Label>
          <div className="w-full overflow-hidden">
            <DatePicker
              id="end-date-filter"
              value={localFilters.endDate || ''}
              onChange={(value) => handleFilterChange('endDate', value || undefined)}
              disabled={disabled}
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
        <Button size="sm" onClick={handleApplyFilters} disabled={disabled} className="w-full sm:w-auto">
          Apply Filters
        </Button>
      </div>
    </div>
  )

  if (isMobilePopover) {
    return content
  }

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
        {content}
      </PopoverContent>
    </Popover>
  )
}

