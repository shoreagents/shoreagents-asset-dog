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
import { useDepartments, useCreateDepartment, type Department } from '@/hooks/use-departments'
import { DepartmentDialog } from '@/components/dialogs/department-dialog'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/shadcn-io/spinner'

interface DepartmentSelectFieldProps {
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
  canCreate?: boolean // Allow creating new departments (requires canManageSetup permission)
}

export function DepartmentSelectField({
  name,
  control,
  error,
  value,
  onValueChange,
  label = 'Department',
  required = false,
  disabled = false,
  placeholder = 'Select or search department',
  canCreate = true,
}: DepartmentSelectFieldProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [pendingDepartmentName, setPendingDepartmentName] = useState<string>('')
  const onChangeCallbackRef = useRef<((value: string) => void) | null>(null)
  
  const { data: departments = [], isLoading: isLoadingDepartments, error: departmentsError } = useDepartments(true, searchQuery)
  const createDepartmentMutation = useCreateDepartment()

  // Store the onChange callback in a ref (only for regular state management)
  useEffect(() => {
    if (onValueChange && !control) {
      onChangeCallbackRef.current = onValueChange
    }
  }, [onValueChange, control])

  const handleCreateDepartment = async (data: { name: string; description?: string }) => {
    // Client-side validation: check if a department with the entered name already exists
    const duplicateDepartment = departments.find(
      dept => dept.name.toLowerCase().trim() === data.name.toLowerCase().trim()
    )
    if (duplicateDepartment) {
      toast.error('A department with this name already exists')
      return
    }

    try {
      const result = await createDepartmentMutation.mutateAsync({
        name: data.name.trim(),
        description: data.description?.trim() || null,
      })
      
      // Set the newly created department as selected
      const callback = onChangeCallbackRef.current
      if (callback) {
        callback(result.department.name)
      } else if (onValueChange) {
        onValueChange(result.department.name)
      }
      
      setIsCreateDialogOpen(false)
      setPendingDepartmentName('')
      setOpen(false)
      toast.success('Department created successfully')
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create department'
      toast.error(errorMessage)
    }
  }

  const renderCombobox = (currentValue: string | undefined, onChange: (value: string) => void) => {
    // Normalize values for comparison (trim and case-insensitive)
    const normalizedCurrentValue = currentValue?.trim().toLowerCase()
    const selected = departments.find((dept: Department) => 
      dept.name.trim().toLowerCase() === normalizedCurrentValue
    )

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between bg-transparent dark:bg-input/30"
            disabled={disabled || isLoadingDepartments}
            aria-invalid={error ? 'true' : 'false'}
          >
            {selected ? (
              <span className="truncate">{selected.name}</span>
            ) : currentValue ? (
              <span className="truncate">{currentValue}</span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput 
              placeholder="Search departments..." 
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList className="max-h-none">
              <CommandEmpty>
                    {isLoadingDepartments ? (
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
                            setPendingDepartmentName(searchQuery)
                            setIsCreateDialogOpen(true)
                            setOpen(false)
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Create &quot;{searchQuery}&quot;
                        </Button>
                      </div>
                    ) : (
                      'No departments found.'
                    )}
                  </CommandEmpty>
                  <ScrollArea className="h-[300px]">
                    <CommandGroup>
                  {departments.map((department: Department) => {
                    const isSelected = department.name.trim().toLowerCase() === normalizedCurrentValue

                    return (
                      <CommandItem
                        key={department.id}
                        value={department.name}
                        onSelect={() => {
                          onChange(department.name)
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
                        <span>{department.name}</span>
                        {department.description && (
                          <span className="text-muted-foreground ml-2 text-sm">
                            - {department.description}
                          </span>
                        )}
                      </CommandItem>
                    )
                  })}
                  {canCreate && searchQuery.trim() && !departments.some((dept: Department) => 
                    dept.name.toLowerCase() === searchQuery.toLowerCase()
                  ) && (
                    <CommandItem
                      value={`create-${searchQuery}`}
                      onSelect={() => {
                        setPendingDepartmentName(searchQuery)
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
        <DepartmentDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onSubmit={handleCreateDepartment}
          mode="create"
          initialData={pendingDepartmentName ? { name: pendingDepartmentName } : undefined}
          isLoading={createDepartmentMutation.isPending}
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
        <FieldLabel htmlFor="department-select">
          {label} {required && <span className="text-destructive">*</span>}
        </FieldLabel>
        <FieldContent>
          {renderCombobox(value, handleValueChange)}
        </FieldContent>
      </Field>
      <DepartmentDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleCreateDepartment}
        mode="create"
        initialData={pendingDepartmentName ? { name: pendingDepartmentName } : undefined}
        isLoading={createDepartmentMutation.isPending}
      />
    </>
  )
}

