import { z } from 'zod'

/**
 * Asset Report form validation schema
 * Validates all report fields with proper types and constraints
 */
export const assetReportSchema = z
  .object({
    // Required fields
    reportName: z
      .string()
      .min(1, 'Report name is required')
      .max(255, 'Report name must be 255 characters or less')
      .trim(),
    reportType: z
      .string()
      .min(1, 'Report type is required')
      .refine(
        (val) => ['category', 'location', 'cost', 'depreciation', 'custom'].includes(val),
        { message: 'Please select a valid report type' }
      ),

    // Optional fields
    description: z
      .string()
      .max(65535, 'Description is too long')
      .optional()
      .or(z.literal('')),
    notes: z
      .string()
      .max(65535, 'Notes are too long')
      .optional()
      .or(z.literal('')),

    // Category/Subcategory fields
    categoryId: z.string().optional(),
    subCategoryId: z.string().optional(),

    // Status field
    status: z.string().optional(),

    // Location fields
    location: z
      .string()
      .max(255, 'Location must be 255 characters or less')
      .optional()
      .or(z.literal('')),
    department: z
      .string()
      .max(255, 'Department must be 255 characters or less')
      .optional()
      .or(z.literal('')),
    site: z
      .string()
      .max(255, 'Site must be 255 characters or less')
      .optional()
      .or(z.literal('')),

    // Cost fields
    minCost: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (!val || val === '') return true
          const num = parseFloat(val)
          return !isNaN(num) && num >= 0
        },
        { message: 'Minimum cost must be a valid positive number' }
      )
      .or(z.literal('')),
    maxCost: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (!val || val === '') return true
          const num = parseFloat(val)
          return !isNaN(num) && num >= 0
        },
        { message: 'Maximum cost must be a valid positive number' }
      )
      .or(z.literal('')),

    // Date fields
    purchaseDateFrom: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (!val || val === '') return true
          return !isNaN(Date.parse(val))
        },
        { message: 'Purchase date from must be a valid date' }
      )
      .or(z.literal('')),
    purchaseDateTo: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (!val || val === '') return true
          return !isNaN(Date.parse(val))
        },
        { message: 'Purchase date to must be a valid date' }
      )
      .or(z.literal('')),
    dateAcquiredFrom: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (!val || val === '') return true
          return !isNaN(Date.parse(val))
        },
        { message: 'Date acquired from must be a valid date' }
      )
      .or(z.literal('')),
    dateAcquiredTo: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (!val || val === '') return true
          return !isNaN(Date.parse(val))
        },
        { message: 'Date acquired to must be a valid date' }
      )
      .or(z.literal('')),

    // Depreciation fields
    includeDepreciableOnly: z.boolean(),
    depreciationMethod: z.string().optional(),
  })
  .refine(
    (data) => {
      // Validate cost range: maxCost should be >= minCost
      if (data.minCost && data.maxCost && data.minCost !== '' && data.maxCost !== '') {
        const min = parseFloat(data.minCost)
        const max = parseFloat(data.maxCost)
        if (!isNaN(min) && !isNaN(max) && max < min) {
          return false
        }
      }
      return true
    },
    {
      message: 'Maximum cost must be greater than or equal to minimum cost',
      path: ['maxCost'],
    }
  )
  .refine(
    (data) => {
      // Validate date ranges: "to" dates should be >= "from" dates
      if (data.purchaseDateFrom && data.purchaseDateTo && data.purchaseDateFrom !== '' && data.purchaseDateTo !== '') {
        const from = new Date(data.purchaseDateFrom)
        const to = new Date(data.purchaseDateTo)
        if (to < from) {
          return false
        }
      }
      return true
    },
    {
      message: 'Purchase date to must be after or equal to purchase date from',
      path: ['purchaseDateTo'],
    }
  )
  .refine(
    (data) => {
      // Validate date ranges: "to" dates should be >= "from" dates
      if (data.dateAcquiredFrom && data.dateAcquiredTo && data.dateAcquiredFrom !== '' && data.dateAcquiredTo !== '') {
        const from = new Date(data.dateAcquiredFrom)
        const to = new Date(data.dateAcquiredTo)
        if (to < from) {
          return false
        }
      }
      return true
    },
    {
      message: 'Date acquired to must be after or equal to date acquired from',
      path: ['dateAcquiredTo'],
    }
  )
  .refine(
    (data) => {
      // Validate category selection for category type reports
      if (data.reportType === 'category' && (!data.categoryId || data.categoryId === 'all')) {
        return false
      }
      return true
    },
    {
      message: 'Category is required for category type reports',
      path: ['categoryId'],
    }
  )
  .refine(
    (data) => {
      // Validate location fields for location type reports
      if (data.reportType === 'location') {
        const hasLocation = data.location && data.location.trim() !== ''
        const hasDepartment = data.department && data.department.trim() !== ''
        const hasSite = data.site && data.site.trim() !== ''
        return hasLocation || hasDepartment || hasSite
      }
      return true
    },
    {
      message: 'At least one location field (location, department, or site) is required for location type reports',
      path: ['location'],
    }
  )
  .refine(
    (data) => {
      // Validate cost fields for cost type reports
      if (data.reportType === 'cost') {
        const hasMinCost = data.minCost && data.minCost.trim() !== ''
        const hasMaxCost = data.maxCost && data.maxCost.trim() !== ''
        return hasMinCost || hasMaxCost
      }
      return true
    },
    {
      message: 'At least one cost field (minimum or maximum) is required for cost type reports',
      path: ['minCost'],
    }
  )
  .refine(
    (data) => {
      // Validate that custom reports have at least one filter applied
      if (data.reportType === 'custom') {
        // Check category filter
        const hasCategory = data.categoryId && data.categoryId !== 'all'
        
        // Check location filters
        const hasLocation = data.location && data.location.trim() !== ''
        const hasDepartment = data.department && data.department.trim() !== ''
        const hasSite = data.site && data.site.trim() !== ''
        const hasLocationFilter = hasLocation || hasDepartment || hasSite
        
        // Check cost filters
        const hasMinCost = data.minCost && data.minCost.trim() !== ''
        const hasMaxCost = data.maxCost && data.maxCost.trim() !== ''
        const hasCostFilter = hasMinCost || hasMaxCost
        
        // Check date filters
        const hasPurchaseDateFrom = data.purchaseDateFrom && data.purchaseDateFrom.trim() !== ''
        const hasPurchaseDateTo = data.purchaseDateTo && data.purchaseDateTo.trim() !== ''
        const hasDateAcquiredFrom = data.dateAcquiredFrom && data.dateAcquiredFrom.trim() !== ''
        const hasDateAcquiredTo = data.dateAcquiredTo && data.dateAcquiredTo.trim() !== ''
        const hasDateFilter = hasPurchaseDateFrom || hasPurchaseDateTo || hasDateAcquiredFrom || hasDateAcquiredTo
        
        // Check depreciation filter
        const hasDepreciationFilter = data.includeDepreciableOnly || (data.depreciationMethod && data.depreciationMethod !== 'all')
        
        // Check status filter
        const hasStatusFilter = data.status && data.status !== 'all'
        
        // At least one filter must be applied
        return hasCategory || hasLocationFilter || hasCostFilter || hasDateFilter || hasDepreciationFilter || hasStatusFilter
      }
      return true
    },
    {
      message: 'At least one filter must be applied for custom reports (category, location, cost, dates, depreciation, or status)',
      path: ['categoryId'],
    }
  )

export type AssetReportFormData = z.infer<typeof assetReportSchema>

