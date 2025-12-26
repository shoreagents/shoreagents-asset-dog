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

interface AuditReportFiltersProps {
  filters: {
    category?: string
    auditType?: string
    location?: string
    site?: string
    auditor?: string
    startDate?: string
    endDate?: string
  }
  onFiltersChange: (filters: AuditReportFiltersProps['filters']) => void
  disabled?: boolean
  isMobilePopover?: boolean
}

export function AuditReportFilters({ filters, onFiltersChange, disabled = false, isMobilePopover = false }: AuditReportFiltersProps) {
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

        {/* Audit Type Filter */}
        <div className="space-y-2">
          <Label htmlFor="audit-type-filter">Audit Type</Label>
          <Input
            id="audit-type-filter"
            placeholder="Filter by audit type"
            value={localFilters.auditType || ''}
            onChange={(e) => handleFilterChange('auditType', e.target.value)}
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

        {/* Auditor Filter */}
        <div className="space-y-2">
          <Label htmlFor="auditor-filter">Auditor</Label>
          <Input
            id="auditor-filter"
            placeholder="Filter by auditor name"
            value={localFilters.auditor || ''}
            onChange={(e) => handleFilterChange('auditor', e.target.value)}
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

