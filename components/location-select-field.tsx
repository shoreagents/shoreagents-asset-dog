'use client'

import { useState, useRef, useEffect } from 'react'
import type React from 'react'
import { Controller, Control, FieldError } from 'react-hook-form'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Field, FieldLabel, FieldContent, FieldError as FieldErrorComponent } from '@/components/ui/field'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useLocations, useCreateLocation, type Location } from '@/hooks/use-locations'
import { LocationDialog } from '@/components/location-dialog'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/shadcn-io/spinner'

interface LocationSelectFieldProps {
  // For react-hook-form integration
  name?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control?: Control<any>
  error?: FieldError
  
  // For regular state management
  value?: string
  onValueChange?: (value: string) => void
  
  label?: string | React.ReactNode
  required?: boolean
  disabled?: boolean
  placeholder?: string
  canCreate?: boolean // Allow creating new locations (requires canManageSetup permission)
}

export function LocationSelectField({
  name,
  control,
  error,
  value,
  onValueChange,
  label = 'Location',
  required = false,
  disabled = false,
  placeholder = 'Select or search location',
  canCreate = true,
}: LocationSelectFieldProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [pendingLocationName, setPendingLocationName] = useState<string>('')
  const onChangeCallbackRef = useRef<((value: string) => void) | null>(null)
  
  const { data: locations = [], isLoading: isLoadingLocations } = useLocations(true, searchQuery)
  const createLocationMutation = useCreateLocation()

  // Store the onChange callback in a ref (only for regular state management)
  useEffect(() => {
    if (onValueChange && !control) {
      onChangeCallbackRef.current = onValueChange
    }
  }, [onValueChange, control])

  const handleCreateLocation = async (data: { name: string; description?: string }) => {
    // Check if location name already exists (case-insensitive)
    const trimmedName = data.name.trim()
    const nameExists = locations.some(
      location => location.name.toLowerCase().trim() === trimmedName.toLowerCase()
    )

    if (nameExists) {
      toast.error('A location with this name already exists')
      return
    }

    try {
      const result = await createLocationMutation.mutateAsync({
        name: data.name.trim(),
        description: data.description?.trim() || null,
      })
      
      // Set the newly created location as selected
      const callback = onChangeCallbackRef.current
      if (callback) {
        callback(result.location.name)
      } else if (onValueChange) {
        onValueChange(result.location.name)
      }
      
      setIsCreateDialogOpen(false)
      setPendingLocationName('')
      setOpen(false)
      toast.success('Location created successfully')
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create location'
      toast.error(errorMessage)
    }
  }

  const renderCombobox = (currentValue: string | undefined, onChange: (value: string) => void) => {
    const selected = locations.find((loc: Location) => loc.name === currentValue)

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled || isLoadingLocations}
            aria-invalid={error ? 'true' : 'false'}
          >
            {selected ? (
              <span className="truncate">{selected.name}</span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder="Search locations..." 
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList className="max-h-none">
              <CommandEmpty>
                {isLoadingLocations ? (
                  <div className="flex items-center justify-center py-4">
                    <Spinner className="h-4 w-4" />
                  </div>
                ) : canCreate && searchQuery.trim() ? (
                  <div className="p-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setPendingLocationName(searchQuery)
                        setIsCreateDialogOpen(true)
                        setOpen(false)
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create &quot;{searchQuery}&quot;
                    </Button>
                  </div>
                ) : (
                  'No locations found.'
                )}
              </CommandEmpty>
              <ScrollArea className="h-[300px]">
                <CommandGroup>
                  {locations.map((location: Location) => {
                    const isSelected = currentValue === location.name

                    return (
                      <CommandItem
                        key={location.id}
                        value={location.name}
                        onSelect={() => {
                          onChange(location.name)
                          setOpen(false)
                          setSearchQuery('')
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            isSelected ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span>{location.name}</span>
                        {location.description && (
                          <span className="text-muted-foreground ml-2 text-sm">
                            - {location.description}
                          </span>
                        )}
                      </CommandItem>
                    )
                  })}
                  {canCreate && searchQuery.trim() && !locations.some((loc: Location) => 
                    loc.name.toLowerCase() === searchQuery.toLowerCase()
                  ) && (
                    <CommandItem
                      value={`create-${searchQuery}`}
                      onSelect={() => {
                        setPendingLocationName(searchQuery)
                        setIsCreateDialogOpen(true)
                        setOpen(false)
                      }}
                      className="text-primary"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create &quot;{searchQuery}&quot;
                    </CommandItem>
                  )}
                </CommandGroup>
              </ScrollArea>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    )
  }

  // If using react-hook-form
  if (control && name) {
    return (
      <>
        <Field>
          <FieldLabel htmlFor={name}>
            {label} {required && <span className="text-destructive">*</span>}
          </FieldLabel>
          <FieldContent>
            <Controller
              name={name}
              control={control}
              render={({ field }) => {
                // Store the onChange function for use in dialog (only set once)
                if (!onChangeCallbackRef.current) {
                  onChangeCallbackRef.current = field.onChange
                }
                return renderCombobox(
                  typeof field.value === 'string' ? field.value : undefined,
                  (value) => {
                    field.onChange(value)
                    onChangeCallbackRef.current = field.onChange
                  }
                )
              }}
            />
            {error && <FieldErrorComponent>{error.message}</FieldErrorComponent>}
          </FieldContent>
        </Field>
        <LocationDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onSubmit={handleCreateLocation}
          mode="create"
          initialData={pendingLocationName ? { name: pendingLocationName } : undefined}
          isLoading={createLocationMutation.isPending}
        />
      </>
    )
  }

  // If using regular state management
  const handleValueChange = (newValue: string) => {
    if (onValueChange) {
      onValueChange(newValue)
    }
  }

  return (
    <>
      <Field>
        <FieldLabel htmlFor="location-select">
          {label} {required && <span className="text-destructive">*</span>}
        </FieldLabel>
        <FieldContent>
          {renderCombobox(value, handleValueChange)}
        </FieldContent>
      </Field>
      <LocationDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleCreateLocation}
        mode="create"
        initialData={pendingLocationName ? { name: pendingLocationName } : undefined}
        isLoading={createLocationMutation.isPending}
      />
    </>
  )
}

