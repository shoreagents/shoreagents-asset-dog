'use client'

import { useState, useEffect } from 'react'
import { useAllEmployees } from '@/hooks/use-employees'
import { useLocations } from '@/hooks/use-locations'
import { useSites } from '@/hooks/use-sites'
import { useDepartments } from '@/hooks/use-departments'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Filter, X } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface CheckoutReportFiltersProps {
  filters: {
    employeeId?: string
    dueDate?: string
    isOverdue?: boolean
    location?: string
    site?: string
    department?: string
    startDate?: string
    endDate?: string
  }
  onFiltersChange: (filters: CheckoutReportFiltersProps['filters']) => void
  disabled?: boolean
  isMobilePopover?: boolean
}

export function CheckoutReportFilters({ filters, onFiltersChange, disabled = false, isMobilePopover = false }: CheckoutReportFiltersProps) {
  const [open, setOpen] = useState(false)
  const [localFilters, setLocalFilters] = useState(filters)

  // Sync local filters with props
  useEffect(() => {
    setLocalFilters(filters)
  }, [filters])

  // Fetch employees
  const { data: employees = [] } = useAllEmployees(true)

  // Fetch locations
  const { data: locations = [] } = useLocations(true)

  // Fetch sites
  const { data: sites = [] } = useSites(true)

  // Fetch departments
  const { data: departments = [] } = useDepartments(true)

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

  const hasActiveFilters = Object.values(filters).some((value) => value !== undefined && value !== '')

  // Content that can be rendered standalone or inside a popover
  const filterContent = (
    <div className="space-y-4">
      <div className={isMobilePopover ? "space-y-3" : "grid grid-cols-1 sm:grid-cols-2 gap-4"}>
        {/* Employee Filter */}
        <div className="space-y-2">
          <Label htmlFor="employee-filter">Employee</Label>
          <Select
            value={localFilters.employeeId || 'all'}
            onValueChange={(value) => handleFilterChange('employeeId', value === 'all' ? undefined : value)}
          >
            <SelectTrigger id="employee-filter" className="w-full min-w-0">
              <SelectValue placeholder="All employees" className="truncate" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All employees</SelectItem>
              {employees?.map((employee: { id: string; name: string; email: string }) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.name} ({employee.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Due Date Filter */}
        <div className="space-y-2 min-w-0">
          <Label htmlFor="due-date-filter">Due Date</Label>
          <div className="w-full overflow-hidden">
            <DatePicker
              id="due-date-filter"
              value={localFilters.dueDate || ''}
              onChange={(value) => handleFilterChange('dueDate', value || undefined)}
              placeholder="Select due date"
              className="gap-2 w-full"
              labelClassName="hidden"
            />
          </div>
        </div>

        {/* Past Due Filter */}
        <div className="space-y-2 flex items-end">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="past-due-filter"
              checked={localFilters.isOverdue || false}
              onCheckedChange={(checked) => handleFilterChange('isOverdue', checked === true)}
            />
            <Label htmlFor="past-due-filter" className="cursor-pointer">
              Past Due Only
            </Label>
          </div>
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

        {/* Checkout Start Date */}
        <div className="space-y-2 min-w-0">
          <Label htmlFor="start-date">Checkout From</Label>
          <div className="w-full overflow-hidden">
            <DatePicker
              id="start-date"
              value={localFilters.startDate || ''}
              onChange={(value) => handleFilterChange('startDate', value || undefined)}
              placeholder="Select start date"
              className="gap-2 w-full"
              labelClassName="hidden"
            />
          </div>
        </div>

        {/* Checkout End Date */}
        <div className="space-y-2 min-w-0">
          <Label htmlFor="end-date">Checkout To</Label>
          <div className="w-full overflow-hidden">
            <DatePicker
              id="end-date"
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

