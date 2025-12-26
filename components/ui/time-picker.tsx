"use client"

import * as React from "react"
import { Clock } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface TimePickerProps {
  id?: string
  label?: string
  placeholder?: string
  value?: string // Time string (HH:mm or HH:mm:ss)
  onChange?: (value: string) => void // Returns time string
  onBlur?: () => void
  disabled?: boolean
  className?: string
  labelClassName?: string
  error?: string
  step?: number | string // Step for time input (default: 60 for minutes-only, 1 for seconds)
  showSeconds?: boolean // Whether to show seconds (default: false)
}

export function TimePicker({
  id,
  label,
  placeholder = "Select time",
  value,
  onChange,
  onBlur,
  disabled = false,
  className,
  labelClassName,
  error,
  step,
  showSeconds = false,
}: TimePickerProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Determine step value - if showSeconds is false, use 60 (minutes), otherwise use provided step or 1
  const timeStep = step !== undefined ? step : (showSeconds ? "1" : "60")

  // Format time value for display (ensure HH:mm format when showSeconds is false)
  const formatTimeValue = (timeValue: string | undefined): string => {
    if (!timeValue) return ""
    
    // Always remove seconds if showSeconds is false
    if (!showSeconds && timeValue.length >= 8) {
      // Remove seconds part (last 3 characters: :ss)
      return timeValue.substring(0, 5)
    }
    
    // If seconds are shown and value doesn't have seconds, add :00
    if (showSeconds && timeValue.length === 5) {
      return `${timeValue}:00`
    }
    
    return timeValue
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange?.(newValue)
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {label && (
        <Label htmlFor={id} className={cn("px-1", labelClassName)}>
          {label}
        </Label>
      )}
      <div className="relative">
        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          id={id}
          type="time"
          step={timeStep}
          value={formatTimeValue(value)}
          onChange={handleChange}
          onBlur={onBlur}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            "bg-background appearance-none pl-9",
            "[&::-webkit-calendar-picker-indicator]:hidden",
            "[&::-webkit-calendar-picker-indicator]:appearance-none",
            error && "border-destructive focus-visible:ring-destructive"
          )}
        />
      </div>
      {error && (
        <p className="text-sm text-destructive px-1">{error}</p>
      )}
    </div>
  )
}

