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
import { DatePicker } from '@/components/ui/date-picker'
import { Filter, X } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'

interface DepreciationReportFiltersProps {
  filters: {
    category?: string
    depreciationMethod?: string
    location?: string
    site?: string
    isDepreciable?: boolean
    startDate?: string
    endDate?: string
  }
  onFiltersChange: (filters: DepreciationReportFiltersProps['filters']) => void
  disabled?: boolean
  isMobilePopover?: boolean
}

export function DepreciationReportFilters({ filters, onFiltersChange, disabled = false, isMobilePopover = false }: DepreciationReportFiltersProps) {
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

  const depreciationMethods = [
    'Straight-line',
    'Declining Balance',
  ]

  const handleFilterChange = (key: string, value: string | boolean | undefined) => {
    const newFilters = { ...localFilters, [key]: value || undefined }
    // If value is false for checkbox, remove it
    if (value === false) {
      delete newFilters[key as keyof typeof newFilters]
    }
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

  const hasActiveFilters = Object.values(filters).some((value) => value !== undefined && value !== '' && value !== false)

  const content = (
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

        {/* Depreciation Method Filter */}
        <div className="space-y-2">
          <Label htmlFor="depreciation-method-filter">Depreciation Method</Label>
          <Select
            value={localFilters.depreciationMethod || 'all'}
            onValueChange={(value) => handleFilterChange('depreciationMethod', value === 'all' ? undefined : value)}
          >
            <SelectTrigger id="depreciation-method-filter" className="w-full truncate">
              <SelectValue placeholder="All Methods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              {depreciationMethods.map((method) => (
                <SelectItem key={method} value={method} className="truncate">
                  {method}
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

        {/* Depreciable Asset Filter */}
        <div className="space-y-2 flex items-end">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="depreciable-filter"
              checked={localFilters.isDepreciable || false}
              onCheckedChange={(checked) => handleFilterChange('isDepreciable', checked === true)}
            />
            <Label htmlFor="depreciable-filter" className="cursor-pointer">
              Depreciable Assets Only
            </Label>
          </div>
        </div>

        {/* Start Date Filter */}
        <div className="space-y-2 min-w-0">
          <Label htmlFor="start-date-filter">Date Acquired From</Label>
          <div className="w-full overflow-hidden">
            <DatePicker
              id="start-date-filter"
              value={localFilters.startDate || ''}
              onChange={(value) => handleFilterChange('startDate', value || undefined)}
              placeholder="Select start date"
              className="gap-2 w-full"
              labelClassName="hidden"
            />
          </div>
        </div>

        {/* End Date Filter */}
        <div className="space-y-2 min-w-0">
          <Label htmlFor="end-date-filter">Date Acquired To</Label>
          <div className="w-full overflow-hidden">
            <DatePicker
              id="end-date-filter"
              value={localFilters.endDate || ''}
              onChange={(value) => handleFilterChange('endDate', value || undefined)}
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

