'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Filter, X } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface AutomatedReportFiltersProps {
  reportType: string
  filters: Record<string, unknown>
  onFiltersChange: (filters: Record<string, unknown>) => void
  disabled?: boolean
}

export function AutomatedReportFilters({ 
  reportType, 
  filters, 
  onFiltersChange, 
  disabled = false 
}: AutomatedReportFiltersProps) {
  const [open, setOpen] = useState(false)
  const [localFilters, setLocalFilters] = useState<Record<string, unknown>>(filters || {})

  // Sync local filters when popover opens
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (newOpen) {
      // When opening, sync with current filters
      setLocalFilters(filters || {})
    }
  }

  // Fetch common data
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await fetch('/api/categories')
      if (!response.ok) return []
      const data = await response.json()
      return data.categories || []
    },
    enabled: ['assets', 'transaction'].includes(reportType),
  })

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const response = await fetch('/api/locations')
      if (!response.ok) return []
      const data = await response.json()
      return data.locations || []
    },
    enabled: ['assets', 'checkout', 'transaction', 'location'].includes(reportType),
  })

  const { data: sites } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => {
      const response = await fetch('/api/sites')
      if (!response.ok) return []
      const data = await response.json()
      return data.sites || []
    },
    enabled: ['assets', 'checkout', 'transaction', 'location'].includes(reportType),
  })

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const response = await fetch('/api/departments')
      if (!response.ok) return []
      const data = await response.json()
      return data.departments || []
    },
    enabled: ['assets', 'checkout', 'transaction'].includes(reportType),
  })

  const { data: employeesData } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const response = await fetch('/api/employees?pageSize=1000')
      if (!response.ok) return []
      const data = await response.json()
      return data.employees || []
    },
    enabled: reportType === 'checkout',
  })

  const handleFilterChange = (key: string, value: string | boolean | undefined) => {
    const newFilters = { ...localFilters, [key]: value || undefined }
    // If value is false for checkbox, remove it
    if (value === false || value === '') {
      delete newFilters[key]
    }
    setLocalFilters(newFilters)
  }

  const handleApplyFilters = () => {
    onFiltersChange(localFilters)
    setOpen(false)
  }


  const handleClearFilters = () => {
    const clearedFilters: Record<string, unknown> = {}
    setLocalFilters(clearedFilters)
    onFiltersChange(clearedFilters)
  }

  const hasActiveFilters = Object.values(filters || {}).some(
    (value) => value !== undefined && value !== '' && value !== null
  )

  if (!reportType) {
    return null
  }

  const renderFilters = () => {
    switch (reportType) {
      case 'assets':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="report-type-filter">Report Type</Label>
              <Select
                value={(localFilters.reportType as string) || 'summary'}
                onValueChange={(value) => handleFilterChange('reportType', value)}
                disabled={disabled}
              >
                <SelectTrigger id="report-type-filter">
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">Summary</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status-filter">Status</Label>
              <Select
                value={(localFilters.status as string) || 'all'}
                onValueChange={(value) => handleFilterChange('status', value === 'all' ? undefined : value)}
                disabled={disabled}
              >
                <SelectTrigger id="status-filter">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="Available">Available</SelectItem>
                  <SelectItem value="Checked out">Checked out</SelectItem>
                  <SelectItem value="Under repair">Under repair</SelectItem>
                  <SelectItem value="Disposed">Disposed</SelectItem>
                  <SelectItem value="Leased">Leased</SelectItem>
                  <SelectItem value="Reserved">Reserved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-filter">Category</Label>
              <Select
                value={(localFilters.category as string) || 'all'}
                onValueChange={(value) => handleFilterChange('category', value === 'all' ? undefined : value)}
                disabled={disabled}
              >
                <SelectTrigger id="category-filter">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories?.map((cat: { id: string; name: string }) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location-filter">Location</Label>
              <Select
                value={(localFilters.location as string) || 'all'}
                onValueChange={(value) => handleFilterChange('location', value === 'all' ? undefined : value)}
                disabled={disabled}
              >
                <SelectTrigger id="location-filter">
                  <SelectValue placeholder="All locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  {locations?.map((loc: { id: string; name: string }) => (
                    <SelectItem key={loc.id} value={loc.name}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-filter">Site</Label>
              <Select
                value={(localFilters.site as string) || 'all'}
                onValueChange={(value) => handleFilterChange('site', value === 'all' ? undefined : value)}
                disabled={disabled}
              >
                <SelectTrigger id="site-filter">
                  <SelectValue placeholder="All sites" />
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
            <div className="space-y-2">
              <Label htmlFor="department-filter">Department</Label>
              <Select
                value={(localFilters.department as string) || 'all'}
                onValueChange={(value) => handleFilterChange('department', value === 'all' ? undefined : value)}
                disabled={disabled}
              >
                <SelectTrigger id="department-filter">
                  <SelectValue placeholder="All departments" />
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
            <div className="space-y-2">
              <Label htmlFor="start-date-filter">Start Date</Label>
              <Input
                id="start-date-filter"
                type="date"
                value={(localFilters.startDate as string) || ''}
                onChange={(e) => handleFilterChange('startDate', e.target.value || undefined)}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date-filter">End Date</Label>
              <Input
                id="end-date-filter"
                type="date"
                value={(localFilters.endDate as string) || ''}
                onChange={(e) => handleFilterChange('endDate', e.target.value || undefined)}
                disabled={disabled}
              />
            </div>
          </div>
        )

      case 'checkout':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="employee-filter">Employee</Label>
              <Select
                value={(localFilters.employeeId as string) || 'all'}
                onValueChange={(value) => handleFilterChange('employeeId', value === 'all' ? undefined : value)}
                disabled={disabled}
              >
                <SelectTrigger id="employee-filter">
                  <SelectValue placeholder="All employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All employees</SelectItem>
                  {employeesData?.map((employee: { id: string; name: string; email: string }) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name} ({employee.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="due-date-filter">Due Date</Label>
              <Input
                id="due-date-filter"
                type="date"
                value={(localFilters.dueDate as string) || ''}
                onChange={(e) => handleFilterChange('dueDate', e.target.value || undefined)}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2 flex items-end">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="past-due-filter"
                  checked={(localFilters.isOverdue as boolean) || false}
                  onCheckedChange={(checked) => handleFilterChange('isOverdue', checked === true)}
                  disabled={disabled}
                />
                <Label htmlFor="past-due-filter" className="cursor-pointer">
                  Past Due Only
                </Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location-filter">Location</Label>
              <Select
                value={(localFilters.location as string) || 'all'}
                onValueChange={(value) => handleFilterChange('location', value === 'all' ? undefined : value)}
                disabled={disabled}
              >
                <SelectTrigger id="location-filter">
                  <SelectValue placeholder="All locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  {locations?.map((loc: { id: string; name: string }) => (
                    <SelectItem key={loc.id} value={loc.name}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-filter">Site</Label>
              <Select
                value={(localFilters.site as string) || 'all'}
                onValueChange={(value) => handleFilterChange('site', value === 'all' ? undefined : value)}
                disabled={disabled}
              >
                <SelectTrigger id="site-filter">
                  <SelectValue placeholder="All sites" />
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
            <div className="space-y-2">
              <Label htmlFor="department-filter">Department</Label>
              <Select
                value={(localFilters.department as string) || 'all'}
                onValueChange={(value) => handleFilterChange('department', value === 'all' ? undefined : value)}
                disabled={disabled}
              >
                <SelectTrigger id="department-filter">
                  <SelectValue placeholder="All departments" />
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
            <div className="space-y-2">
              <Label htmlFor="start-date-filter">Checkout From</Label>
              <Input
                id="start-date-filter"
                type="date"
                value={(localFilters.startDate as string) || ''}
                onChange={(e) => handleFilterChange('startDate', e.target.value || undefined)}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date-filter">Checkout To</Label>
              <Input
                id="end-date-filter"
                type="date"
                value={(localFilters.endDate as string) || ''}
                onChange={(e) => handleFilterChange('endDate', e.target.value || undefined)}
                disabled={disabled}
              />
            </div>
          </div>
        )

      case 'transaction':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="transaction-type-filter">Transaction Type</Label>
              <Select
                value={(localFilters.transactionType as string) || 'all'}
                onValueChange={(value) => handleFilterChange('transactionType', value === 'all' ? undefined : value)}
                disabled={disabled}
              >
                <SelectTrigger id="transaction-type-filter">
                  <SelectValue placeholder="All transaction types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All transaction types</SelectItem>
                  <SelectItem value="Add Asset">Add Asset</SelectItem>
                  <SelectItem value="Sold Asset">Sold Asset</SelectItem>
                  <SelectItem value="Donated Asset">Donated Asset</SelectItem>
                  <SelectItem value="Scrapped Asset">Scrapped Asset</SelectItem>
                  <SelectItem value="Lost/Missing Asset">Lost/Missing Asset</SelectItem>
                  <SelectItem value="Destroyed Asset">Destroyed Asset</SelectItem>
                  <SelectItem value="Edit Asset">Edit Asset</SelectItem>
                  <SelectItem value="Lease Out">Lease Out</SelectItem>
                  <SelectItem value="Lease Return">Lease Return</SelectItem>
                  <SelectItem value="Repair Asset">Repair Asset</SelectItem>
                  <SelectItem value="Move Asset">Move Asset</SelectItem>
                  <SelectItem value="Checkout Asset">Checkout Asset</SelectItem>
                  <SelectItem value="Checkin Asset">Checkin Asset</SelectItem>
                  <SelectItem value="Delete Asset">Delete Asset</SelectItem>
                  <SelectItem value="Actions By Users">Actions By Users</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-filter">Category</Label>
              <Select
                value={(localFilters.category as string) || 'all'}
                onValueChange={(value) => handleFilterChange('category', value === 'all' ? undefined : value)}
                disabled={disabled}
              >
                <SelectTrigger id="category-filter">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories?.map((cat: { id: string; name: string }) => (
                    <SelectItem key={cat.id} value={cat.name}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location-filter">Location</Label>
              <Select
                value={(localFilters.location as string) || 'all'}
                onValueChange={(value) => handleFilterChange('location', value === 'all' ? undefined : value)}
                disabled={disabled}
              >
                <SelectTrigger id="location-filter">
                  <SelectValue placeholder="All locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  {locations?.map((loc: { id: string; name: string }) => (
                    <SelectItem key={loc.id} value={loc.name}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-filter">Site</Label>
              <Select
                value={(localFilters.site as string) || 'all'}
                onValueChange={(value) => handleFilterChange('site', value === 'all' ? undefined : value)}
                disabled={disabled}
              >
                <SelectTrigger id="site-filter">
                  <SelectValue placeholder="All sites" />
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
            <div className="space-y-2">
              <Label htmlFor="department-filter">Department</Label>
              <Select
                value={(localFilters.department as string) || 'all'}
                onValueChange={(value) => handleFilterChange('department', value === 'all' ? undefined : value)}
                disabled={disabled}
              >
                <SelectTrigger id="department-filter">
                  <SelectValue placeholder="All departments" />
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
            <div className="space-y-2">
              <Label htmlFor="action-by-filter">Action By (User)</Label>
              <Input
                id="action-by-filter"
                placeholder="Filter by user..."
                value={(localFilters.actionBy as string) || ''}
                onChange={(e) => handleFilterChange('actionBy', e.target.value || undefined)}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start-date-filter">Start Date</Label>
              <Input
                id="start-date-filter"
                type="date"
                value={(localFilters.startDate as string) || ''}
                onChange={(e) => handleFilterChange('startDate', e.target.value || undefined)}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date-filter">End Date</Label>
              <Input
                id="end-date-filter"
                type="date"
                value={(localFilters.endDate as string) || ''}
                onChange={(e) => handleFilterChange('endDate', e.target.value || undefined)}
                disabled={disabled}
              />
            </div>
          </div>
        )

      case 'location':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location-filter">Location</Label>
              <Select
                value={(localFilters.location as string) || 'all'}
                onValueChange={(value) => handleFilterChange('location', value === 'all' ? undefined : value)}
                disabled={disabled}
              >
                <SelectTrigger id="location-filter">
                  <SelectValue placeholder="All locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  {locations?.map((loc: { id: string; name: string }) => (
                    <SelectItem key={loc.id} value={loc.name}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-filter">Site</Label>
              <Select
                value={(localFilters.site as string) || 'all'}
                onValueChange={(value) => handleFilterChange('site', value === 'all' ? undefined : value)}
                disabled={disabled}
              >
                <SelectTrigger id="site-filter">
                  <SelectValue placeholder="All sites" />
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
          </div>
        )

      default:
        return (
          <div className="text-sm text-muted-foreground">
            No filters available for this report type.
          </div>
        )
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Report Filters</Label>
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              disabled={disabled}
              className="bg-gray-400 bg-clip-padding backdrop-filter backdrop-blur-md bg-opacity-10 border shadow-sm"
            >
              <Filter className="h-4 w-4 mr-2" />
              Configure Filters
              {hasActiveFilters && (
                <span className="ml-2 h-2 w-2 rounded-full bg-primary" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="max-w-[600px] w-[calc(100vw-2rem)] sm:w-full" align="start">
            <div className="space-y-4">
              {renderFilters()}
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
          </PopoverContent>
        </Popover>
      </div>
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(filters || {}).map(([key, value]) => {
            if (!value || value === '') return null
            return (
              <div
                key={key}
                className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm"
              >
                <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                <span>{String(value)}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-primary/20"
                  onClick={() => {
                    const newFilters = { ...localFilters }
                    delete newFilters[key]
                    setLocalFilters(newFilters)
                    onFiltersChange(newFilters)
                  }}
                  disabled={disabled}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

