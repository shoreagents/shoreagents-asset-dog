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
import { useSites, useCreateSite, type Site } from '@/hooks/use-sites'
import { SiteDialog } from '@/components/site-dialog'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/shadcn-io/spinner'

interface SiteSelectFieldProps {
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
  canCreate?: boolean // Allow creating new sites (requires canManageSetup permission)
}

export function SiteSelectField({
  name,
  control,
  error,
  value,
  onValueChange,
  label = 'Site',
  required = false,
  disabled = false,
  placeholder = 'Select or search site',
  canCreate = true,
}: SiteSelectFieldProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [pendingSiteName, setPendingSiteName] = useState<string>('')
  const onChangeCallbackRef = useRef<((value: string) => void) | null>(null)
  
  const { data: sites = [], isLoading: isLoadingSites } = useSites(true, searchQuery)
  const createSiteMutation = useCreateSite()

  // Store the onChange callback in a ref (only for regular state management)
  useEffect(() => {
    if (onValueChange && !control) {
      onChangeCallbackRef.current = onValueChange
    }
  }, [onValueChange, control])

  const handleCreateSite = async (data: { name: string; description?: string }) => {
    // Check if site name already exists (case-insensitive)
    const trimmedName = data.name.trim()
    const nameExists = sites.some(
      site => site.name.toLowerCase().trim() === trimmedName.toLowerCase()
    )

    if (nameExists) {
      toast.error('A site with this name already exists')
      return
    }

    try {
      const result = await createSiteMutation.mutateAsync({
        name: data.name.trim(),
        description: data.description?.trim() || null,
      })
      
      // Set the newly created site as selected
      const callback = onChangeCallbackRef.current
      if (callback) {
        callback(result.site.name)
      } else if (onValueChange) {
        onValueChange(result.site.name)
      }
      
      setIsCreateDialogOpen(false)
      setPendingSiteName('')
      setOpen(false)
      toast.success('Site created successfully')
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create site'
      toast.error(errorMessage)
    }
  }

  const renderCombobox = (currentValue: string | undefined, onChange: (value: string) => void) => {
    const selected = sites.find((site: Site) => site.name === currentValue)

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled || isLoadingSites}
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
              placeholder="Search sites..." 
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList className="max-h-none">
              <CommandEmpty>
                {isLoadingSites ? (
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
                        setPendingSiteName(searchQuery)
                        setIsCreateDialogOpen(true)
                        setOpen(false)
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create &quot;{searchQuery}&quot;
                    </Button>
                  </div>
                ) : (
                  'No sites found.'
                )}
              </CommandEmpty>
              <ScrollArea className="h-[300px]">
                <CommandGroup>
                  {sites.map((site: Site) => {
                    const isSelected = currentValue === site.name

                    return (
                      <CommandItem
                        key={site.id}
                        value={site.name}
                        onSelect={() => {
                          onChange(site.name)
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
                        <span>{site.name}</span>
                        {site.description && (
                          <span className="text-muted-foreground ml-2 text-sm">
                            - {site.description}
                          </span>
                        )}
                      </CommandItem>
                    )
                  })}
                  {canCreate && searchQuery.trim() && !sites.some((site: Site) => 
                    site.name.toLowerCase() === searchQuery.toLowerCase()
                  ) && (
                    <CommandItem
                      value={`create-${searchQuery}`}
                      onSelect={() => {
                        setPendingSiteName(searchQuery)
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
        <SiteDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onSubmit={handleCreateSite}
          mode="create"
          initialData={pendingSiteName ? { name: pendingSiteName } : undefined}
          isLoading={createSiteMutation.isPending}
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
        <FieldLabel htmlFor="site-select">
          {label} {required && <span className="text-destructive">*</span>}
        </FieldLabel>
        <FieldContent>
          {renderCombobox(value, handleValueChange)}
        </FieldContent>
      </Field>
      <SiteDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleCreateSite}
        mode="create"
        initialData={pendingSiteName ? { name: pendingSiteName } : undefined}
        isLoading={createSiteMutation.isPending}
      />
    </>
  )
}

