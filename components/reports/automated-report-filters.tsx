'use client'

import { useState } from 'react'
import { useEmployees } from '@/hooks/use-employees'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Filter, X, Info } from 'lucide-react'
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
  const [badgesOpen, setBadgesOpen] = useState(false)
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
  const shouldFetchCategories = ['assets', 'transaction', 'maintenance', 'audit', 'depreciation', 'lease', 'reservation'].includes(reportType)
  const { data: categories = [] } = useCategories(shouldFetchCategories)

  const shouldFetchLocations = ['assets', 'checkout', 'transaction', 'location', 'audit', 'depreciation', 'lease', 'reservation', 'maintenance'].includes(reportType)
  const { data: locations = [] } = useLocations(shouldFetchLocations)

  const shouldFetchSites = ['assets', 'checkout', 'transaction', 'location', 'audit', 'depreciation', 'lease', 'reservation', 'maintenance'].includes(reportType)
  const { data: sites = [] } = useSites(shouldFetchSites)

  const shouldFetchDepartments = ['assets', 'checkout', 'transaction', 'reservation', 'maintenance'].includes(reportType)
  const { data: departments = [] } = useDepartments(shouldFetchDepartments)

  const { data: employeesData } = useEmployees(
    ['checkout', 'reservation'].includes(reportType),
    undefined,
    'unified',
    1,
    1000
  )
  const employees = employeesData?.employees || []

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
                <SelectTrigger id="report-type-filter" className="w-full min-w-0">
                  <SelectValue placeholder="Select report type" className="truncate" />
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
                <SelectTrigger id="status-filter" className="w-full min-w-0">
                  <SelectValue placeholder="All statuses" className="truncate" />
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
                <SelectTrigger id="category-filter" className="w-full min-w-0">
                  <SelectValue placeholder="All categories" className="truncate" />
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
                <SelectTrigger id="location-filter" className="w-full min-w-0">
                  <SelectValue placeholder="All locations" className="truncate" />
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
            <div className="space-y-2">
              <Label htmlFor="department-filter">Department</Label>
              <Select
                value={(localFilters.department as string) || 'all'}
                onValueChange={(value) => handleFilterChange('department', value === 'all' ? undefined : value)}
                disabled={disabled}
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
            <div className="space-y-2 min-w-0">
              <Label htmlFor="start-date-filter">Start Date</Label>
              <div className="w-full overflow-hidden">
                <DatePicker
                  id="start-date-filter"
                  value={(localFilters.startDate as string) || ''}
                  onChange={(value) => handleFilterChange('startDate', value || undefined)}
                  disabled={disabled}
                  placeholder="Select start date"
                  className="gap-2 w-full"
                  labelClassName="hidden"
                />
              </div>
            </div>
            <div className="space-y-2 min-w-0">
              <Label htmlFor="end-date-filter">End Date</Label>
              <div className="w-full overflow-hidden">
                <DatePicker
                  id="end-date-filter"
                  value={(localFilters.endDate as string) || ''}
                  onChange={(value) => handleFilterChange('endDate', value || undefined)}
                  disabled={disabled}
                  placeholder="Select end date"
                  className="gap-2 w-full"
                  labelClassName="hidden"
                />
              </div>
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
            <div className="space-y-2 min-w-0">
              <Label htmlFor="due-date-filter">Due Date</Label>
              <div className="w-full overflow-hidden">
                <DatePicker
                  id="due-date-filter"
                  value={(localFilters.dueDate as string) || ''}
                  onChange={(value) => handleFilterChange('dueDate', value || undefined)}
                  disabled={disabled}
                  placeholder="Select due date"
                  className="gap-2 w-full"
                  labelClassName="hidden"
                />
              </div>
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
                <SelectTrigger id="location-filter" className="w-full min-w-0">
                  <SelectValue placeholder="All locations" className="truncate" />
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
            <div className="space-y-2">
              <Label htmlFor="department-filter">Department</Label>
              <Select
                value={(localFilters.department as string) || 'all'}
                onValueChange={(value) => handleFilterChange('department', value === 'all' ? undefined : value)}
                disabled={disabled}
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
            <div className="space-y-2 min-w-0">
              <Label htmlFor="start-date-filter">Checkout From</Label>
              <div className="w-full overflow-hidden">
                <DatePicker
                  id="start-date-filter"
                  value={(localFilters.startDate as string) || ''}
                  onChange={(value) => handleFilterChange('startDate', value || undefined)}
                  disabled={disabled}
                  placeholder="Select start date"
                  className="gap-2 w-full"
                  labelClassName="hidden"
                />
              </div>
            </div>
            <div className="space-y-2 min-w-0">
              <Label htmlFor="end-date-filter">Checkout To</Label>
              <div className="w-full overflow-hidden">
                <DatePicker
                  id="end-date-filter"
                  value={(localFilters.endDate as string) || ''}
                  onChange={(value) => handleFilterChange('endDate', value || undefined)}
                  disabled={disabled}
                  placeholder="Select end date"
                  className="gap-2 w-full"
                  labelClassName="hidden"
                />
              </div>
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
                <SelectTrigger id="transaction-type-filter" className="w-full min-w-0">
                  <SelectValue placeholder="All transaction types" className="truncate" />
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
                <SelectTrigger id="category-filter" className="w-full min-w-0">
                  <SelectValue placeholder="All categories" className="truncate" />
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
                <SelectTrigger id="location-filter" className="w-full min-w-0">
                  <SelectValue placeholder="All locations" className="truncate" />
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
            <div className="space-y-2">
              <Label htmlFor="department-filter">Department</Label>
              <Select
                value={(localFilters.department as string) || 'all'}
                onValueChange={(value) => handleFilterChange('department', value === 'all' ? undefined : value)}
                disabled={disabled}
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
            <div className="space-y-2 min-w-0">
              <Label htmlFor="start-date-filter">Start Date</Label>
              <div className="w-full overflow-hidden">
                <DatePicker
                  id="start-date-filter"
                  value={(localFilters.startDate as string) || ''}
                  onChange={(value) => handleFilterChange('startDate', value || undefined)}
                  disabled={disabled}
                  placeholder="Select start date"
                  className="gap-2 w-full"
                  labelClassName="hidden"
                />
              </div>
            </div>
            <div className="space-y-2 min-w-0">
              <Label htmlFor="end-date-filter">End Date</Label>
              <div className="w-full overflow-hidden">
                <DatePicker
                  id="end-date-filter"
                  value={(localFilters.endDate as string) || ''}
                  onChange={(value) => handleFilterChange('endDate', value || undefined)}
                  disabled={disabled}
                  placeholder="Select end date"
                  className="gap-2 w-full"
                  labelClassName="hidden"
                />
              </div>
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
                <SelectTrigger id="location-filter" className="w-full min-w-0">
                  <SelectValue placeholder="All locations" className="truncate" />
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
          </div>
        )

      case 'maintenance':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category-filter">Asset Category</Label>
              <Select
                value={(localFilters.category as string) || 'all'}
                onValueChange={(value) => handleFilterChange('category', value === 'all' ? undefined : value)}
                disabled={disabled}
              >
                <SelectTrigger id="category-filter" className="w-full min-w-0">
                  <SelectValue placeholder="All categories" className="truncate" />
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
              <Label htmlFor="location-filter">Asset Location</Label>
              <Select
                value={(localFilters.location as string) || 'all'}
                onValueChange={(value) => handleFilterChange('location', value === 'all' ? undefined : value)}
                disabled={disabled}
              >
                <SelectTrigger id="location-filter" className="w-full min-w-0">
                  <SelectValue placeholder="All locations" className="truncate" />
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
              <Label htmlFor="site-filter">Asset Site</Label>
              <Select
                value={(localFilters.site as string) || 'all'}
                onValueChange={(value) => handleFilterChange('site', value === 'all' ? undefined : value)}
                disabled={disabled}
              >
                <SelectTrigger id="site-filter" className="w-full min-w-0">
                  <SelectValue placeholder="All sites" className="truncate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sites</SelectItem>
                  {sites?.map((s: { id: string; name: string }) => (
                    <SelectItem key={s.id} value={s.name}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="department-filter">Asset Department</Label>
              <Select
                value={(localFilters.department as string) || 'all'}
                onValueChange={(value) => handleFilterChange('department', value === 'all' ? undefined : value)}
                disabled={disabled}
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
            <div className="space-y-2 min-w-0">
              <Label htmlFor="start-date-filter">Due Date From</Label>
              <div className="w-full overflow-hidden">
                <DatePicker
                  id="start-date-filter"
                  value={(localFilters.startDate as string) || ''}
                  onChange={(value) => handleFilterChange('startDate', value || undefined)}
                  disabled={disabled}
                  placeholder="Select start date"
                  className="gap-2 w-full"
                  labelClassName="hidden"
                />
              </div>
            </div>
            <div className="space-y-2 min-w-0">
              <Label htmlFor="end-date-filter">Due Date To</Label>
              <div className="w-full overflow-hidden">
                <DatePicker
                  id="end-date-filter"
                  value={(localFilters.endDate as string) || ''}
                  onChange={(value) => handleFilterChange('endDate', value || undefined)}
                  disabled={disabled}
                  placeholder="Select end date"
                  className="gap-2 w-full"
                  labelClassName="hidden"
                />
              </div>
            </div>
          </div>
        )

      case 'audit':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category-filter">Category</Label>
              <Select
                value={(localFilters.category as string) || 'all'}
                onValueChange={(value) => handleFilterChange('category', value === 'all' ? undefined : value)}
                disabled={disabled}
              >
                <SelectTrigger id="category-filter" className="w-full min-w-0">
                  <SelectValue placeholder="All categories" className="truncate" />
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
              <Label htmlFor="audit-type-filter">Audit Type</Label>
              <Input
                id="audit-type-filter"
                placeholder="Filter by audit type"
                value={(localFilters.auditType as string) || ''}
                onChange={(e) => handleFilterChange('auditType', e.target.value || undefined)}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location-filter">Location</Label>
              <Select
                value={(localFilters.location as string) || 'all'}
                onValueChange={(value) => handleFilterChange('location', value === 'all' ? undefined : value)}
                disabled={disabled}
              >
                <SelectTrigger id="location-filter" className="w-full min-w-0">
                  <SelectValue placeholder="All locations" className="truncate" />
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
            <div className="space-y-2">
              <Label htmlFor="auditor-filter">Auditor</Label>
              <Input
                id="auditor-filter"
                placeholder="Filter by auditor name"
                value={(localFilters.auditor as string) || ''}
                onChange={(e) => handleFilterChange('auditor', e.target.value || undefined)}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2 min-w-0">
              <Label htmlFor="start-date-filter">Start Date</Label>
              <div className="w-full overflow-hidden">
                <DatePicker
                  id="start-date-filter"
                  value={(localFilters.startDate as string) || ''}
                  onChange={(value) => handleFilterChange('startDate', value || undefined)}
                  disabled={disabled}
                  placeholder="Select start date"
                  className="gap-2 w-full"
                  labelClassName="hidden"
                />
              </div>
            </div>
            <div className="space-y-2 min-w-0">
              <Label htmlFor="end-date-filter">End Date</Label>
              <div className="w-full overflow-hidden">
                <DatePicker
                  id="end-date-filter"
                  value={(localFilters.endDate as string) || ''}
                  onChange={(value) => handleFilterChange('endDate', value || undefined)}
                  disabled={disabled}
                  placeholder="Select end date"
                  className="gap-2 w-full"
                  labelClassName="hidden"
                />
              </div>
            </div>
          </div>
        )

      case 'depreciation':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category-filter">Category</Label>
              <Select
                value={(localFilters.category as string) || 'all'}
                onValueChange={(value) => handleFilterChange('category', value === 'all' ? undefined : value)}
                disabled={disabled}
              >
                <SelectTrigger id="category-filter" className="w-full min-w-0">
                  <SelectValue placeholder="All categories" className="truncate" />
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
              <Label htmlFor="depreciation-method-filter">Depreciation Method</Label>
              <Select
                value={(localFilters.depreciationMethod as string) || 'all'}
                onValueChange={(value) => handleFilterChange('depreciationMethod', value === 'all' ? undefined : value)}
                disabled={disabled}
              >
                <SelectTrigger id="depreciation-method-filter" className="w-full min-w-0">
                  <SelectValue placeholder="All methods" className="truncate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All methods</SelectItem>
                  <SelectItem value="Straight-line">Straight-line</SelectItem>
                  <SelectItem value="Declining Balance">Declining Balance</SelectItem>
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
                <SelectTrigger id="location-filter" className="w-full min-w-0">
                  <SelectValue placeholder="All locations" className="truncate" />
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
            <div className="space-y-2 flex items-end">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="depreciable-filter"
                  checked={(localFilters.isDepreciable as boolean) || false}
                  onCheckedChange={(checked) => handleFilterChange('isDepreciable', checked === true)}
                  disabled={disabled}
                />
                <Label htmlFor="depreciable-filter" className="cursor-pointer">
                  Depreciable Assets Only
                </Label>
              </div>
            </div>
            <div className="space-y-2 min-w-0">
              <Label htmlFor="start-date-filter">Date Acquired From</Label>
              <div className="w-full overflow-hidden">
                <DatePicker
                  id="start-date-filter"
                  value={(localFilters.startDate as string) || ''}
                  onChange={(value) => handleFilterChange('startDate', value || undefined)}
                  disabled={disabled}
                  placeholder="Select start date"
                  className="gap-2 w-full"
                  labelClassName="hidden"
                />
              </div>
            </div>
            <div className="space-y-2 min-w-0">
              <Label htmlFor="end-date-filter">Date Acquired To</Label>
              <div className="w-full overflow-hidden">
                <DatePicker
                  id="end-date-filter"
                  value={(localFilters.endDate as string) || ''}
                  onChange={(value) => handleFilterChange('endDate', value || undefined)}
                  disabled={disabled}
                  placeholder="Select end date"
                  className="gap-2 w-full"
                  labelClassName="hidden"
                />
              </div>
            </div>
          </div>
        )

      case 'lease':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category-filter">Category</Label>
              <Select
                value={(localFilters.category as string) || 'all'}
                onValueChange={(value) => handleFilterChange('category', value === 'all' ? undefined : value)}
                disabled={disabled}
              >
                <SelectTrigger id="category-filter" className="w-full min-w-0">
                  <SelectValue placeholder="All categories" className="truncate" />
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
              <Label htmlFor="lessee-filter">Lessee</Label>
              <Input
                id="lessee-filter"
                placeholder="Search lessee..."
                value={(localFilters.lessee as string) || ''}
                onChange={(e) => handleFilterChange('lessee', e.target.value || undefined)}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location-filter">Location</Label>
              <Select
                value={(localFilters.location as string) || 'all'}
                onValueChange={(value) => handleFilterChange('location', value === 'all' ? undefined : value)}
                disabled={disabled}
              >
                <SelectTrigger id="location-filter" className="w-full min-w-0">
                  <SelectValue placeholder="All locations" className="truncate" />
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
            <div className="space-y-2">
              <Label htmlFor="status-filter">Lease Status</Label>
              <Select
                value={(localFilters.status as string) || 'all'}
                onValueChange={(value) => handleFilterChange('status', value === 'all' ? undefined : value)}
                disabled={disabled}
              >
                <SelectTrigger id="status-filter" className="w-full min-w-0">
                  <SelectValue placeholder="All statuses" className="truncate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 min-w-0">
              <Label htmlFor="start-date-filter">Lease Start From</Label>
              <div className="w-full overflow-hidden">
                <DatePicker
                  id="start-date-filter"
                  value={(localFilters.startDate as string) || ''}
                  onChange={(value) => handleFilterChange('startDate', value || undefined)}
                  disabled={disabled}
                  placeholder="Select start date"
                  className="gap-2 w-full"
                  labelClassName="hidden"
                />
              </div>
            </div>
            <div className="space-y-2 min-w-0">
              <Label htmlFor="end-date-filter">Lease Start To</Label>
              <div className="w-full overflow-hidden">
                <DatePicker
                  id="end-date-filter"
                  value={(localFilters.endDate as string) || ''}
                  onChange={(value) => handleFilterChange('endDate', value || undefined)}
                  disabled={disabled}
                  placeholder="Select end date"
                  className="gap-2 w-full"
                  labelClassName="hidden"
                />
              </div>
            </div>
          </div>
        )

      case 'reservation':
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category-filter">Category</Label>
              <Select
                value={(localFilters.category as string) || 'all'}
                onValueChange={(value) => handleFilterChange('category', value === 'all' ? undefined : value)}
                disabled={disabled}
              >
                <SelectTrigger id="category-filter" className="w-full min-w-0">
                  <SelectValue placeholder="All categories" className="truncate" />
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
              <Label htmlFor="reservation-type-filter">Reservation Type</Label>
              <Select
                value={(localFilters.reservationType as string) || 'all'}
                onValueChange={(value) => handleFilterChange('reservationType', value === 'all' ? undefined : value)}
                disabled={disabled}
              >
                <SelectTrigger id="reservation-type-filter" className="w-full min-w-0">
                  <SelectValue placeholder="All types" className="truncate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="Employee">Employee</SelectItem>
                  <SelectItem value="Department">Department</SelectItem>
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
                <SelectTrigger id="location-filter" className="w-full min-w-0">
                  <SelectValue placeholder="All locations" className="truncate" />
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
            <div className="space-y-2">
              <Label htmlFor="department-filter">Department</Label>
              <Input
                id="department-filter"
                placeholder="Search department..."
                value={(localFilters.department as string) || ''}
                onChange={(e) => handleFilterChange('department', e.target.value || undefined)}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employee-filter">Employee</Label>
              <Select
                value={(localFilters.employeeId as string) || 'all'}
                onValueChange={(value) => handleFilterChange('employeeId', value === 'all' ? undefined : value)}
                disabled={disabled}
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
            <div className="space-y-2 min-w-0">
              <Label htmlFor="start-date-filter">Reservation Date From</Label>
              <div className="w-full overflow-hidden">
                <DatePicker
                  id="start-date-filter"
                  value={(localFilters.startDate as string) || ''}
                  onChange={(value) => handleFilterChange('startDate', value || undefined)}
                  disabled={disabled}
                  placeholder="Select start date"
                  className="gap-2 w-full"
                  labelClassName="hidden"
                />
              </div>
            </div>
            <div className="space-y-2 min-w-0">
              <Label htmlFor="end-date-filter">Reservation Date To</Label>
              <div className="w-full overflow-hidden">
                <DatePicker
                  id="end-date-filter"
                  value={(localFilters.endDate as string) || ''}
                  onChange={(value) => handleFilterChange('endDate', value || undefined)}
                  disabled={disabled}
                  placeholder="Select end date"
                  className="gap-2 w-full"
                  labelClassName="hidden"
                />
              </div>
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
    <div className="flex items-end gap-2">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            size="default" 
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
      {hasActiveFilters && (
        <Popover open={badgesOpen} onOpenChange={setBadgesOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="default"
              className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 hover:text-primary"
              onMouseEnter={() => setBadgesOpen(true)}
              onMouseLeave={() => setBadgesOpen(false)}
            >
              <Info className="h-4 w-4 mr-2" />
              Active Filters ({Object.values(filters || {}).filter(v => v !== undefined && v !== '' && v !== null).length})
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="max-w-[400px] w-[calc(100vw-2rem)] sm:w-full" 
            align="start"
            onMouseEnter={() => setBadgesOpen(true)}
            onMouseLeave={() => setBadgesOpen(false)}
          >
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Active Filters</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  disabled={disabled}
                  className="h-7 text-xs"
                >
                  Clear All
                </Button>
              </div>
              <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
                {Object.entries(filters || {}).map(([key, value]) => {
                  if (!value || value === '') return null
                  
                  // Format the value for display
                  let displayValue = String(value)
                  if (key === 'startDate' || key === 'endDate' || key === 'dueDate') {
                    try {
                      displayValue = new Date(value as string).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })
                    } catch {
                      displayValue = String(value)
                    }
                  } else if (key === 'employeeId' && employees) {
                    const employee = employees.find((emp: { id: string; name: string }) => emp.id === value)
                    if (employee) {
                      displayValue = employee.name
                    }
                  } else if (key === 'category' && categories) {
                    const category = categories.find((cat: { id: string; name: string }) => cat.id === value || cat.name === value)
                    if (category) {
                      displayValue = category.name
                    }
                  } else if (key === 'location' && locations) {
                    const location = locations.find((loc: { id: string; name: string }) => loc.name === value)
                    if (location) {
                      displayValue = location.name
                    }
                  } else if (key === 'site' && sites) {
                    const site = sites.find((s: { id: string; name: string }) => s.name === value)
                    if (site) {
                      displayValue = site.name
                    }
                  } else if (key === 'department' && departments) {
                    const dept = departments.find((d: { id: string; name: string }) => d.name === value)
                    if (dept) {
                      displayValue = dept.name
                    }
                  }
                  
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-sm max-w-full"
                    >
                      <span className="font-medium capitalize shrink-0">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                      <span className="truncate max-w-[200px]" title={displayValue}>{displayValue}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-primary/20 shrink-0"
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
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}

