"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

function formatDate(date: Date | undefined) {
  if (!date) {
    return ""
  }

  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

// Convert Date to YYYY-MM-DD using local timezone (not UTC)
function toLocalISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Parse YYYY-MM-DD string as local date (not UTC)
function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

interface DatePickerProps {
  id?: string
  label?: string
  placeholder?: string
  value?: string // ISO date string (YYYY-MM-DD)
  onChange?: (value: string) => void // Returns ISO date string
  onBlur?: () => void
  disabled?: boolean
  className?: string
  labelClassName?: string
  error?: string
}

export function DatePicker({
  id,
  label,
  placeholder = "Select date",
  value,
  onChange,
  onBlur,
  disabled = false,
  className,
  labelClassName,
  error,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const dateValue = value ? parseLocalDate(value) : undefined
  const [month, setMonth] = React.useState<Date | undefined>(
    dateValue || new Date()
  )

  // Update month when value prop changes
  React.useEffect(() => {
    if (value) {
      const date = parseLocalDate(value)
      if (!isNaN(date.getTime())) {
        setMonth(date)
      }
    }
  }, [value])

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      const isoDate = toLocalISODate(date)
      onChange?.(isoDate)
      setOpen(false)
    }
  }

  const handleClear = () => {
    onChange?.("")
    setOpen(false)
  }

  const handleToday = () => {
    const today = new Date()
    const isoDate = toLocalISODate(today)
    onChange?.(isoDate)
    setMonth(today)
    setOpen(false)
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {label && (
        <Label htmlFor={id} className={cn("px-1", labelClassName)}>
          {label}
        </Label>
      )}
      <Popover open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen)
        if (!isOpen) {
          onBlur?.()
        }
      }}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal bg-card!",
              !dateValue && "text-muted-foreground",
              error && "border-destructive focus-visible:ring-destructive"
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateValue ? formatDate(dateValue) : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0"
          align="start"
          sideOffset={4}
        >
          <Calendar
            mode="single"
            selected={dateValue}
            captionLayout="dropdown"
            month={month}
            onMonthChange={setMonth}
            onSelect={handleCalendarSelect}
            onClear={handleClear}
            onToday={handleToday}
          />
        </PopoverContent>
      </Popover>
      {error && (
        <p className="text-sm text-destructive px-1">{error}</p>
      )}
    </div>
  )
}

