'use client'

import { useState, useEffect } from 'react'
import { Controller, Control, FieldError } from 'react-hook-form'
import { useEmployees } from '@/hooks/use-employees'
import { Check, ChevronsUpDown } from 'lucide-react'
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

interface EmployeeUser {
  id: string
  name: string
  email: string
  department: string | null
  checkouts?: Array<{
    asset: {
      assetTagId: string
    }
  }>
}

interface EmployeeSelectFieldProps {
  // For react-hook-form integration
  name?: string
  control?: Control<Record<string, unknown>>
  error?: FieldError
  
  // For regular state management
  value?: string
  onValueChange?: (value: string) => void
  
  // Common props
  label?: string
  required?: boolean
  disabled?: boolean
  placeholder?: string
  currentEmployeeId?: string // For highlighting current employee (used in move page)
  queryKey?: string[] // Custom query key for employees
}

export function EmployeeSelectField({
  name,
  control,
  error,
  value,
  onValueChange,
  label = 'Assign To',
  required = true,
  disabled = false,
  placeholder = 'Select an employee',
  currentEmployeeId,
  queryKey = ['employees'],
}: EmployeeSelectFieldProps) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch by only rendering Popover after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch employees - fetch all pages to get complete list
  const { data: employeesData, isLoading: isLoadingEmployees } = useEmployees(true, undefined, 'unified', 1, 1000)
  const employees: EmployeeUser[] = employeesData?.employees || []

  // Get selected employee for display
  const getSelectedEmployee = (employeeId: string | undefined) => {
    if (!employeeId) return null
    return employees.find((emp) => emp.id === employeeId)
  }

  // Shared combobox content
  const renderCombobox = (currentValue: string | undefined, onChange: (value: string) => void) => {
    const selectedEmployee = getSelectedEmployee(currentValue)

    // Render button without Popover on server to avoid hydration mismatch
    if (!mounted) {
      return (
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={false}
          className="w-full justify-between"
          disabled={disabled || isLoadingEmployees}
          aria-invalid={error ? 'true' : 'false'}
        >
          {selectedEmployee ? (
            <span className="truncate">
              {selectedEmployee.name} ({selectedEmployee.email})
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      )
    }

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled || isLoadingEmployees}
            aria-invalid={error ? 'true' : 'false'}
          >
            {selectedEmployee ? (
              <span className="truncate">
                {selectedEmployee.name} ({selectedEmployee.email})
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command>
            <CommandInput placeholder="Search employees..." />
            <CommandList className="max-h-none">
              <CommandEmpty>
                {isLoadingEmployees ? 'Loading employees...' : 'No employees found.'}
              </CommandEmpty>
              <ScrollArea className="h-[300px]">
                <CommandGroup>
                  {employees.map((employee) => {
                      const activeCheckouts = employee.checkouts || []
                      const hasCheckedOutAssets = activeCheckouts.length > 0
                      const assetTagIds = hasCheckedOutAssets
                        ? activeCheckouts.map((co) => co.asset.assetTagId).join(', ')
                        : ''
                      const isCurrentEmployee = currentEmployeeId === employee.id
                  const isSelected = currentValue === employee.id

                      return (
                    <CommandItem
                          key={employee.id}
                      value={`${employee.name} ${employee.email} ${employee.department || ''}`}
                      onSelect={() => {
                        onChange(employee.id)
                        setOpen(false)
                      }}
                      className={cn(
                        isCurrentEmployee && 'bg-primary/10'
                      )}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col flex-1 min-w-0">
                          <span>
                            {employee.name} ({employee.email})
                            {employee.department && (
                              <span className="text-muted-foreground"> - {employee.department}</span>
                            )}
                        </span>
                        {(isCurrentEmployee || hasCheckedOutAssets) && (
                          <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
                            {isCurrentEmployee && (
                              <span className="font-medium">(Current)</span>
                            )}
                            {hasCheckedOutAssets && (
                              <span>- Checked out: {assetTagIds}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </CommandItem>
                      )
                })}
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
      <Field>
        <FieldLabel htmlFor={name}>
          {label} {required && <span className="text-destructive">*</span>}
        </FieldLabel>
        <FieldContent>
          <Controller
            name={name}
            control={control}
            render={({ field }) => (
              renderCombobox(
                typeof field.value === 'string' ? field.value : undefined,
                (value) => field.onChange(value)
              )
            )}
          />
          {error && <FieldErrorComponent>{error.message}</FieldErrorComponent>}
        </FieldContent>
      </Field>
    )
  }

  // If using regular state management
  return (
    <Field>
      <FieldLabel htmlFor="employee-select">
        {label} {required && <span className="text-destructive">*</span>}
      </FieldLabel>
      <FieldContent>
        {renderCombobox(value, (value) => onValueChange?.(value))}
      </FieldContent>
    </Field>
  )
}