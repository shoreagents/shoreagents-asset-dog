'use client'

import { useEffect, useState, useRef } from 'react'
import { format } from 'date-fns'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { QRScannerDialog } from '@/components/qr-scanner-dialog'
import { EmployeeSelectField } from '@/components/employee-select-field'
import { LocationSelectField } from '@/components/location-select-field'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ScrollArea } from './ui/scroll-area'
import { scheduleSchema, type ScheduleFormData } from '@/lib/validations/schedule'

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

interface Asset {
  id: string
  assetTagId: string
  description: string
  status?: string
  category?: {
    id: string
    name: string
  } | null
  subCategory?: {
    id: string
    name: string
  } | null
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

  // Fetch asset suggestions based on debounced input
  const { data: assetSuggestions = [], isLoading: isLoadingSuggestions } = useQuery<Asset[]>({
    queryKey: ['asset-suggestions-schedule', debouncedAssetIdInput.trim(), selectedAsset?.id],
    queryFn: async () => {
      const searchTerm = debouncedAssetIdInput.trim()
      
      // Only fetch 10 items since we only show 10
      // Use pageSize=10 to reduce data transfer
      const response = await fetch(`/api/assets?search=${encodeURIComponent(searchTerm)}&pageSize=10`)
      if (!response.ok) {
        throw new Error('Failed to fetch assets')
      }
      const data = await response.json()
      const assets = data.assets as Asset[]
      
      // Filter out already selected asset
      const filtered = selectedAsset
        ? assets.filter(a => a.id.toLowerCase() !== selectedAsset.id.toLowerCase())
        : assets
      
      return filtered
    },
    enabled: showSuggestions && debouncedAssetIdInput.trim().length >= 0, // Allow empty search to show recent assets
    staleTime: 1000, // Cache for 1 second
    placeholderData: (previousData) => previousData, // Show previous results while loading
  })

  // Asset lookup by ID - optimized to fetch only 10 items
  const lookupAsset = async (assetTagId: string): Promise<Asset | null> => {
    try {
      const response = await fetch(`/api/assets?search=${encodeURIComponent(assetTagId)}&pageSize=10`)
      const data = await response.json()
      const assets = data.assets as Asset[]
      
      // Find exact match by assetTagId (case-insensitive)
      const asset = assets.find(
        (a) => a.assetTagId.toLowerCase() === assetTagId.toLowerCase()
      )
      
      return asset || null
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
        })
        
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
      setSelectedAsset(null)
      setAssetIdInput('')
      setShowSuggestions(false)
    }
  }, [open, initialData, defaultDate, defaultAssetId, form])

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
        form.reset()
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
                          className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-auto"
                        >
                          {isLoadingSuggestions ? (
                            <div className="flex items-center justify-center py-4">
                              <Spinner className="h-4 w-4" />
                            </div>
                          ) : assetSuggestions.length > 0 ? (
                            assetSuggestions.map((asset, index) => (
                              <motion.div
                                key={asset.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.2, delay: index * 0.05 }}
                                onClick={() => handleSelectAsset(asset)}
                                onMouseEnter={() => setSelectedSuggestionIndex(index)}
                                className={cn(
                                  'px-4 py-3 cursor-pointer transition-colors',
                                  'hover:bg-accent',
                                  selectedSuggestionIndex === index && 'bg-accent'
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
                                  {asset.status && (
                                    <Badge variant="outline" className="text-xs">
                                      {asset.status}
                                    </Badge>
                                  )}
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
                          {selectedAsset.status && (
                            <Badge variant="outline" className="text-xs">
                              {selectedAsset.status}
                            </Badge>
                          )}
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
                  <Input
                    id="scheduledTime"
                    type="time"
                    {...form.register('scheduledTime')}
                    disabled={isLoading}
                    placeholder="HH:mm"
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
                  render={({ field }) => (
                    <Input
                      id="scheduledDate"
                      type="date"
                      value={field.value ? format(field.value, 'yyyy-MM-dd') : ''}
                      onChange={(e) => {
                        const dateValue = e.target.value ? new Date(e.target.value) : null
                        field.onChange(dateValue)
                      }}
                      disabled={isLoading}
                      min={new Date().toISOString().split('T')[0]}
                      aria-invalid={form.formState.errors.scheduledDate ? 'true' : 'false'}
                    />
                  )}
                />
                {form.formState.errors.scheduledDate && (
                  <FieldError>{form.formState.errors.scheduledDate.message}</FieldError>
                )}
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
