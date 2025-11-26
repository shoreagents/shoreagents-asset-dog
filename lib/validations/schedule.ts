import { z } from 'zod'

/**
 * Schedule form validation schema
 * Validates schedule form fields with proper types and constraints
 */
export const scheduleSchema = z.object({
  // Required fields
  assetId: z
    .string()
    .min(1, 'Asset Tag ID is required'),
  
  scheduleType: z
    .string()
    .min(1, 'Schedule type is required')
    .refine(
      (val) => [
        'maintenance',
        'dispose',
        'lease_return',
        'lease',
        'reserve',
        'move',
        'checkin',
        'checkout',
      ].includes(val),
      'Invalid schedule type'
    ),
  
  scheduledDate: z
    .date({
      message: 'Scheduled date must be a valid date',
    })
    .refine(
      (date) => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const selectedDate = new Date(date)
        selectedDate.setHours(0, 0, 0, 0)
        return selectedDate >= today
      },
      {
        message: 'Scheduled date cannot be in the past',
      }
    ),
  
  title: z
    .string()
    .min(1, 'Title is required')
    .max(255, 'Title must be 255 characters or less'),
  
  // Optional fields
  scheduledTime: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => {
        if (!val) return true
        // Validate time format HH:mm
        const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/
        return timeRegex.test(val)
      },
      'Time must be in HH:mm format (e.g., 14:30)'
    ),
  
  notes: z
    .string()
    .max(65535, 'Notes must be 65535 characters or less')
    .optional()
    .or(z.literal('')),
  
  assignedTo: z
    .string()
    .max(255, 'Assigned to must be 255 characters or less')
    .optional()
    .or(z.literal('')),
  
  location: z
    .string()
    .max(255, 'Location must be 255 characters or less')
    .optional()
    .or(z.literal('')),
  
  employeeId: z
    .string()
    .max(255, 'Employee ID must be 255 characters or less')
    .optional()
    .or(z.literal('')),
})

export type ScheduleFormData = z.infer<typeof scheduleSchema>

