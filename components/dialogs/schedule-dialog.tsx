'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { format } from 'date-fns'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Clock, QrCode, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { Badge } from '@/components/ui/badge'
import { Field, FieldLabel, FieldContent, FieldError } from '@/components/ui/field'
import { DatePicker } from '@/components/ui/date-picker'
import { TimePicker } from '@/components/ui/time-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { QRScannerDialog } from '@/components/dialogs/qr-scanner-dialog'
import { EmployeeSelectField } from '@/components/fields/employee-select-field'
import { LocationSelectField } from '@/components/fields/location-select-field'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { scheduleSchema, type ScheduleFormData } from '@/lib/validations/schedule'
import { useAssets, useAsset } from '@/hooks/use-assets'
import type { Asset } from '@/hooks/use-assets'

export const scheduleTypeLabels: Record<string, string> = {
  maintenance: 'Maintenance',
  dispose: 'Dispose',
  lease_return: 'Lease Return',
  lease: 'Lease',
  reserve: 'Reserve',
  move: 'Move',
  checkin: 'Check In',
  checkout: 'Check Out',
}

// Helper function to get status badge with colors (matching the pattern used in assets pages)
const getStatusBadge = (status: string | null | undefined) => {
  if (!status) return null
  const statusLC = status.toLowerCase()
  let statusVariant: 'default' | 'secondary' | 'destructive' | 'outline' = 'outline'
  let statusColor = ''
  
  if (statusLC === 'active' || statusLC === 'available') {
    statusVariant = 'default'
    statusColor = 'bg-green-500'
  } else if (statusLC === 'checked out' || statusLC === 'in use') {
    statusVariant = 'destructive'
    statusColor = ''
  } else if (statusLC === 'leased') {
    statusVariant = 'secondary'
    statusColor = 'bg-yellow-500'
  } else if (statusLC === 'inactive' || statusLC === 'unavailable') {
    statusVariant = 'secondary'
    statusColor = 'bg-gray-500'
  } else if (statusLC === 'maintenance' || statusLC === 'repair') {
    statusColor = 'bg-red-600 text-white'
  } else if (statusLC === 'lost' || statusLC === 'missing') {
    statusVariant = 'destructive'
    statusColor = 'bg-orange-500'
  } else if (statusLC === 'disposed' || statusLC === 'disposal') {
    statusVariant = 'secondary'
    statusColor = 'bg-purple-500'
  } else if (statusLC === 'reserved') {
    statusVariant = 'secondary'
    statusColor = 'bg-yellow-500'
  } else if (statusLC === 'sold') {
    statusVariant = 'default'
    statusColor = 'bg-teal-500 text-white border-0'
  } else if (statusLC === 'donated') {
    statusVariant = 'default'
    statusColor = 'bg-blue-500 text-white border-0'
  } else if (statusLC === 'scrapped') {
    statusVariant = 'default'
    statusColor = 'bg-orange-500 text-white border-0'
  } else if (statusLC === 'lost/missing' || statusLC.replace(/\s+/g, '').replace('/', '').toLowerCase() === 'lostmissing') {
    statusVariant = 'default'
    statusColor = 'bg-yellow-500 text-white border-0'
  } else if (statusLC === 'destroyed') {
    statusVariant = 'default'
    statusColor = 'bg-red-500 text-white border-0'
  }
  
  return <Badge variant={statusVariant} className={statusColor}>{status}</Badge>
}


interface ScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: ScheduleFormData) => Promise<void> | void
  isLoading?: boolean
  defaultDate?: Date | null
  defaultAssetId?: string
  mode?: 'create' | 'edit'
  initialData?: Partial<ScheduleFormData> & { scheduledDate?: Date | string }
}

export function ScheduleDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
  defaultDate,
  defaultAssetId,
  mode = 'create',
  initialData,
}: ScheduleDialogProps) {
  const [assetIdInput, setAssetIdInput] = useState('')
  const [debouncedAssetIdInput, setDebouncedAssetIdInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionRef = useRef<HTMLDivElement>(null)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const form = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      assetId: '',
      scheduleType: 'maintenance',
      scheduledDate: new Date(),
      scheduledTime: '',
      title: '',
      notes: '',
      assignedTo: '',
      location: '',
      employeeId: '',
    },
  })

  // Debounce input to reduce API calls
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    debounceTimeoutRef.current = setTimeout(() => {
      setDebouncedAssetIdInput(assetIdInput)
    }, 300) // 300ms debounce

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [assetIdInput])

  // Fetch asset suggestions using the useAssets hook
  const searchTerm = debouncedAssetIdInput.trim()
  const { data: assetsData, isLoading: isLoadingSuggestions } = useAssets(
    showSuggestions, // enabled
    searchTerm || undefined, // search
    undefined, // category
    undefined, // status
    1, // page
    10, // pageSize
    false, // withMaintenance
    false, // includeDeleted
    undefined, // searchFields
    false, // statusesOnly
    false // summaryOnly
  )

  // Filter out already selected asset and extract assets array
  const assetSuggestions = useMemo(() => {
    const assets = assetsData?.assets || []
    return selectedAsset
      ? assets.filter((a: Asset) => a.id.toLowerCase() !== selectedAsset.id.toLowerCase())
      : assets
  }, [assetsData?.assets, selectedAsset])

  // Asset lookup by assetTagId - check in suggestions first, then search if needed
  const lookupAsset = async (assetTagId: string): Promise<Asset | null> => {
    try {
      // First check if it's in the current suggestions
      const asset = assetSuggestions.find(
        (a: Asset) => a.assetTagId.toLowerCase() === assetTagId.toLowerCase()
      )
      
      if (asset) {
        return asset
      }
      
      // If not in suggestions, the asset might not exist or might be on a different page
      // The useAssets hook will handle fetching, but we need to search specifically
      // For now, return null and let the error handling show a message
      return null
    } catch (error) {
      console.error('Error looking up asset:', error)
      return null
    }
  }

  // Handle asset selection
  const handleSelectAsset = async (asset?: Asset) => {
    const assetToSelect = asset || await lookupAsset(assetIdInput.trim())
    
    if (!assetToSelect) {
      if (!asset) {
        toast.error(`Asset with ID "${assetIdInput}" not found`)
      }
      return
    }

    setSelectedAsset(assetToSelect)
    form.setValue('assetId', assetToSelect.id, { shouldValidate: true }) // Store the UUID id, not assetTagId
    form.clearErrors('assetId')
    setAssetIdInput('')
    setShowSuggestions(false)
    setSelectedSuggestionIndex(-1)
    toast.success(`Asset "${assetToSelect.assetTagId}" selected`)
  }

  // Handle QR code scan
  const handleQRScan = async (decodedText: string) => {
    try {
      const asset = await lookupAsset(decodedText)
      if (asset) {
        await handleSelectAsset(asset)
        setQrDialogOpen(false)
      } else {
        toast.error(`Asset with ID "${decodedText}" not found`)
      }
    } catch {
      toast.error('Failed to lookup asset from QR code')
    }
  }

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setAssetIdInput(value)
    setShowSuggestions(true) // Show suggestions on any input
    setSelectedSuggestionIndex(-1)
  }

  // Handle keyboard navigation
  const handleSuggestionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || assetSuggestions.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (assetIdInput.trim()) {
          handleSelectAsset()
        }
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedSuggestionIndex((prev) =>
          prev < assetSuggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < assetSuggestions.length) {
          handleSelectAsset(assetSuggestions[selectedSuggestionIndex])
        } else if (assetIdInput.trim()) {
          handleSelectAsset()
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowSuggestions(false)
        setSelectedSuggestionIndex(-1)
        break
    }
  }

  // Handle input blur
  const handleInputBlur = () => {
    // Use setTimeout to allow click events on suggestions to fire first
    setTimeout(() => {
      if (suggestionRef.current && !suggestionRef.current.contains(document.activeElement)) {
        setShowSuggestions(false)
        setSelectedSuggestionIndex(-1)
      }
    }, 200)
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    if (!showSuggestions) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      const inputElement = inputRef.current
      const suggestionElement = suggestionRef.current
      
      // Check if click is outside both input and suggestions dropdown
      if (
        inputElement &&
        suggestionElement &&
        !inputElement.contains(target) &&
        !suggestionElement.contains(target)
      ) {
        setShowSuggestions(false)
        setSelectedSuggestionIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSuggestions])

  // Reset form when dialog opens/closes or initialData changes
  useEffect(() => {
    if (open) {
      if (initialData) {
        const scheduledDate = initialData.scheduledDate
          ? typeof initialData.scheduledDate === 'string'
            ? new Date(initialData.scheduledDate)
            : initialData.scheduledDate
          : defaultDate || new Date()

        const assetId = initialData.assetId || defaultAssetId || ''
        form.reset({
          assetId,
          scheduleType: initialData.scheduleType || 'maintenance',
          scheduledDate,
          scheduledTime: initialData.scheduledTime || '',
          title: initialData.title || '',
          notes: initialData.notes || '',
          assignedTo: initialData.assignedTo || '',
          location: initialData.location || '',
          employeeId: initialData.employeeId || '',
        })
        
        // If assetId is provided, lookup and set the asset
        if (assetId) {
          lookupAsset(assetId).then(asset => {
            if (asset) {
              setSelectedAsset(asset)
              form.setValue('assetId', asset.id, { shouldValidate: true }) // Ensure we use the UUID id
              form.clearErrors('assetId')
            }
          })
        } else {
          setSelectedAsset(null)
        }
      } else {
        // Reset to default values when creating (no initialData)
        form.reset({
          assetId: defaultAssetId || '',
          scheduleType: 'maintenance',
          scheduledDate: defaultDate || new Date(),
          scheduledTime: '',
          title: '',
          notes: '',
          assignedTo: '',
          location: '',
          employeeId: '',
        }, { keepDefaultValues: false })
        
        // If defaultAssetId is provided, lookup and set the asset
        if (defaultAssetId) {
          lookupAsset(defaultAssetId).then(asset => {
            if (asset) {
              setSelectedAsset(asset)
              form.setValue('assetId', asset.id, { shouldValidate: true }) // Ensure we use the UUID id
              form.clearErrors('assetId')
            }
          })
        } else {
          setSelectedAsset(null)
        }
      }
      setAssetIdInput('')
      setShowSuggestions(false)
      setSelectedSuggestionIndex(-1)
    } else {
      // Reset everything when dialog closes
      form.reset({
        assetId: '',
        scheduleType: 'maintenance',
        scheduledDate: new Date(),
        scheduledTime: '',
        title: '',
        notes: '',
        assignedTo: '',
        location: '',
        employeeId: '',
      }, { keepDefaultValues: false })
      setSelectedAsset(null)
      setAssetIdInput('')
      setShowSuggestions(false)
      setSelectedSuggestionIndex(-1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialData, defaultDate, defaultAssetId])

  const handleSubmit = async (data: ScheduleFormData) => {
    // Zod validation will handle assetId validation
    // Additional check for selectedAsset is handled by form validation
    if (!selectedAsset) {
      form.setError('assetId', { 
        type: 'manual', 
        message: 'Please select an asset' 
      })
      return
    }
    await onSubmit(data)
    if (!isLoading) {
      form.reset()
      setSelectedAsset(null)
      setAssetIdInput('')
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!isLoading) {
      onOpenChange(newOpen)
      if (!newOpen) {
        // Reset form to default values when closing
        form.reset({
          assetId: '',
          scheduleType: 'maintenance',
          scheduledDate: new Date(),
          scheduledTime: '',
          title: '',
          notes: '',
          assignedTo: '',
          location: '',
          employeeId: '',
        }, { keepDefaultValues: false })
        setSelectedAsset(null)
        setAssetIdInput('')
        setShowSuggestions(false)
        setSelectedSuggestionIndex(-1)
      }
    }
  }

  const scheduleType = form.watch('scheduleType')

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl! max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'edit' ? (
              <Clock className="h-4 w-4 text-primary" />
            ) : (
              <Plus className="h-4 w-4 text-primary" />
            )}
            {mode === 'edit' ? 'Edit Schedule' : 'Create Schedule'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'edit'
              ? 'Update the schedule details below'
              : 'Schedule an operation for an asset'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <ScrollArea className='h-[500px]'>
          <div className="space-y-4">
            <Field>
              <FieldLabel htmlFor="assetId">
                Asset Tag ID <span className="text-destructive">*</span>
              </FieldLabel>
              <FieldContent>
                <div className="space-y-2">
                  {/* Hidden input to register assetId field with react-hook-form */}
                  <input
                    type="hidden"
                    {...form.register('assetId')}
                  />
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        ref={inputRef}
                        id="assetId"
                        value={assetIdInput}
                        onChange={handleInputChange}
                        onKeyDown={handleSuggestionKeyDown}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={handleInputBlur}
                        placeholder="Enter asset ID or scan QR code"
                        disabled={isLoading}
                        autoComplete="off"
                        aria-invalid={form.formState.errors.assetId ? 'true' : 'false'}
                      />
                      
                      {/* Suggestions dropdown */}
                      {showSuggestions && (
                        <div
                          ref={suggestionRef}
                          className="absolute z-50 w-full mt-1 bg-popover/80 dark:bg-popover/80 bg-clip-padding! backdrop-filter! backdrop-blur-md! border shadow-2xl rounded-md max-h-60 overflow-auto"
                        >
                          {isLoadingSuggestions ? (
                            <div className="flex items-center justify-center py-4">
                              <Spinner className="h-4 w-4" />
                            </div>
                          ) : assetSuggestions.length > 0 ? (
                            assetSuggestions.map((asset: Asset, index: number) => (
                              <motion.div
                                key={asset.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.2, delay: index * 0.05 }}
                                onClick={() => handleSelectAsset(asset)}
                                onMouseEnter={() => setSelectedSuggestionIndex(index)}
                                className={cn(
                                  'px-4 py-3 cursor-pointer transition-colors',
                                  'hover:bg-gray-400/20 hover:bg-clip-padding hover:backdrop-filter hover:backdrop-blur-sm',
                                  selectedSuggestionIndex === index && 'bg-gray-400/20 bg-clip-padding backdrop-filter backdrop-blur-sm'
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="font-medium">{asset.assetTagId}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {asset.category?.name || 'No Category'}
                                      {asset.subCategory?.name && ` - ${asset.subCategory.name}`}
                                    </div>
                                  </div>
                                  {getStatusBadge(asset.status)}
                                </div>
                              </motion.div>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-muted-foreground">
                              No assets found. Start typing to search...
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setQrDialogOpen(true)}
                      title="Scan QR Code"
                      disabled={isLoading}
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Selected Asset Display */}
                  {selectedAsset && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between gap-2 p-3 border rounded-md bg-muted/50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-sm">
                            {selectedAsset.assetTagId}
                          </span>
                          {getStatusBadge(selectedAsset.status)}
                        </div>
                        <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                          {selectedAsset.description || 'No description'}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedAsset(null)
                          form.setValue('assetId', '', { shouldValidate: true })
                          form.clearErrors('assetId')
                          setAssetIdInput('')
                        }}
                        className="h-8 w-8"
                        disabled={isLoading}
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  )}
                  
                  {form.formState.errors.assetId && (
                    <FieldError>{form.formState.errors.assetId.message}</FieldError>
                  )}
                </div>
              </FieldContent>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="scheduleType">
                  Schedule Type <span className="text-destructive">*</span>
                </FieldLabel>
                <FieldContent>
                  <Controller
                    name="scheduleType"
                    control={form.control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange} disabled={isLoading}>
                        <SelectTrigger id="scheduleType">
                          <SelectValue placeholder="Select schedule type" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(scheduleTypeLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {form.formState.errors.scheduleType && (
                    <FieldError>{form.formState.errors.scheduleType.message}</FieldError>
                  )}
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel htmlFor="scheduledTime">Time (Optional)</FieldLabel>
                <FieldContent>
                  <Controller
                    name="scheduledTime"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <TimePicker
                        id="scheduledTime"
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        disabled={isLoading}
                        placeholder="HH:mm"
                        error={fieldState.error?.message}
                        className="gap-2"
                        labelClassName="hidden"
                        showSeconds={false}
                      />
                    )}
                  />
                </FieldContent>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="scheduledDate">
                Scheduled Date <span className="text-destructive">*</span>
              </FieldLabel>
              <FieldContent>
                <Controller
                  name="scheduledDate"
                  control={form.control}
                  render={({ field, fieldState }) => {
                    // Convert Date object to ISO string for DatePicker
                    const dateValue = field.value ? format(field.value, 'yyyy-MM-dd') : ''
                    return (
                      <DatePicker
                        id="scheduledDate"
                        value={dateValue}
                        onChange={(value) => {
                          // Convert ISO string back to Date object
                          const dateObj = value ? new Date(value) : null
                          field.onChange(dateObj)
                        }}
                        onBlur={field.onBlur}
                        disabled={isLoading}
                        placeholder="Select scheduled date"
                        error={fieldState.error?.message}
                        className="gap-2"
                        labelClassName="hidden"
                      />
                    )
                  }}
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="title">
                Title <span className="text-destructive">*</span>
              </FieldLabel>
              <FieldContent>
                <Input
                  id="title"
                  {...form.register('title')}
                  placeholder={`e.g., ${scheduleTypeLabels[scheduleType]} for asset`}
                  disabled={isLoading}
                  aria-invalid={form.formState.errors.title ? 'true' : 'false'}
                />
                {form.formState.errors.title && (
                  <FieldError>{form.formState.errors.title.message}</FieldError>
                )}
              </FieldContent>
            </Field>

            {(scheduleType === 'checkout' || scheduleType === 'reserve' || scheduleType === 'lease') && (
              <Controller
                name="employeeId"
                control={form.control}
                render={({ field }) => (
                  <EmployeeSelectField
                    value={field.value || ''}
                    onValueChange={field.onChange}
                    label="Assigned Employee"
                    required={false}
                    disabled={isLoading}
                    placeholder="Select an employee"
                  />
                )}
              />
            )}

            {(scheduleType === 'checkout' || scheduleType === 'reserve') && (
              <Field>
                <FieldLabel htmlFor="assignedTo">Assigned To (Optional)</FieldLabel>
                <FieldContent>
                  <Input
                    id="assignedTo"
                    {...form.register('assignedTo')}
                    placeholder="Employee or department name"
                    disabled={isLoading}
                  />
                </FieldContent>
              </Field>
            )}

            {(scheduleType === 'move' || scheduleType === 'checkout' || scheduleType === 'checkin') && (
              <Controller
                name="location"
                control={form.control}
                render={({ field }) => (
                  <LocationSelectField
                    value={field.value || ''}
                    onValueChange={field.onChange}
                    label={scheduleType === 'move' ? 'New Location' : 'Location'}
                    required={false}
                    disabled={isLoading}
                    placeholder="Select a location"
                  />
                )}
              />
            )}

            <Field>
              <FieldLabel htmlFor="notes">Notes</FieldLabel>
              <FieldContent>
                <Textarea
                  id="notes"
                  {...form.register('notes')}
                  placeholder="Additional notes or details..."
                  disabled={isLoading}
                  rows={4}
                />
              </FieldContent>
            </Field>
          </div>
          </ScrollArea>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
              className='btn-glass'
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Spinner className="mr-2 h-4 w-4" />}
              {mode === 'edit' ? 'Update Schedule' : 'Create Schedule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* QR Scanner Dialog */}
      <QRScannerDialog
        open={qrDialogOpen}
        onOpenChange={setQrDialogOpen}
        onScan={handleQRScan}
        title="Scan Asset QR Code"
        description="Scan the QR code on the asset to automatically select it"
        multiScan={false}
      />
    </Dialog>
  )
}
