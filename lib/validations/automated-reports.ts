import { z } from 'zod'

/**
 * Automated report schedule validation schema
 */
export const automatedReportScheduleSchema = z.object({
  reportName: z
    .string()
    .min(1, 'Report name is required')
    .max(255, 'Report name must be less than 255 characters'),
  reportType: z
    .string()
    .min(1, 'Report type is required')
    .refine(
      (val) => ['assets', 'checkout', 'location', 'maintenance', 'audit', 'depreciation', 'lease', 'reservation', 'transaction'].includes(val),
      { message: 'Invalid report type' }
    ),
  frequency: z
    .string()
    .min(1, 'Frequency is required')
    .refine(
      (val) => ['daily', 'weekly', 'monthly', 'yearly'].includes(val),
      { message: 'Invalid frequency' }
    ),
  frequencyDay: z
    .number()
    .int()
    .min(0)
    .max(31)
    .nullable()
    .optional(),
  frequencyMonth: z
    .number()
    .int()
    .min(1)
    .max(12)
    .nullable()
    .optional(),
  scheduledTime: z
    .string()
    .min(1, 'Scheduled time is required')
    .regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format. Use HH:mm format (24-hour)'),
  format: z.enum(['pdf', 'csv', 'excel']),
  includeList: z.boolean(),
})
.refine(
  (data) => {
    // For weekly frequency, frequencyDay should be 0-6 (day of week)
    if (data.frequency === 'weekly') {
      return data.frequencyDay === null || data.frequencyDay === undefined || (data.frequencyDay >= 0 && data.frequencyDay <= 6)
    }
    // For monthly frequency, frequencyDay should be 1-31 (day of month)
    if (data.frequency === 'monthly') {
      return data.frequencyDay === null || data.frequencyDay === undefined || (data.frequencyDay >= 1 && data.frequencyDay <= 31)
    }
    // For yearly frequency, both frequencyMonth and frequencyDay should be set
    if (data.frequency === 'yearly') {
      return data.frequencyMonth !== null && data.frequencyMonth !== undefined &&
             data.frequencyDay !== null && data.frequencyDay !== undefined &&
             data.frequencyDay >= 1 && data.frequencyDay <= 31
    }
    return true
  },
  {
    message: 'Invalid frequency configuration',
    path: ['frequencyDay'],
  }
)

export type AutomatedReportScheduleFormData = z.infer<typeof automatedReportScheduleSchema>

