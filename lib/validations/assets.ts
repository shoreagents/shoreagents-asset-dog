import { z } from 'zod'

/**
 * Asset form validation schema
 * Validates all asset fields with proper types and constraints
 */
export const assetSchema = z.object({
  // Required fields
  assetTagId: z
    .string()
    .min(1, 'Asset Tag ID is required')
    .max(100, 'Asset Tag ID must be 100 characters or less')
    .regex(
      /^[0-9]{2}-[0-9]{6}[A-Z]-SA$/,
      'Asset Tag ID must match format: YY-XXXXXX[S]-SA (e.g., 25-016011U-SA)'
    ),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(65535, 'Description is too long'),

  // Optional string fields
  purchasedFrom: z
    .string()
    .max(255, 'Purchased From must be 255 characters or less')
    .optional()
    .or(z.literal('')),
  brand: z
    .string()
    .min(1, 'Brand is required')
    .max(100, 'Brand must be 100 characters or less'),
  model: z
    .string()
    .min(1, 'Model is required')
    .max(100, 'Model must be 100 characters or less'),
  serialNo: z
    .string()
    .max(100, 'Serial Number must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  additionalInformation: z
    .string()
    .max(65535, 'Additional Information is too long')
    .optional()
    .or(z.literal('')),
  xeroAssetNo: z
    .string()
    .max(100, 'Xero Asset Number must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  owner: z
    .string()
    .max(255, 'Owner must be 255 characters or less')
    .optional()
    .or(z.literal('')),
  pbiNumber: z
    .string()
    .max(100, 'PBI Number must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  issuedTo: z
    .string()
    .max(255, 'Issued To must be 255 characters or less')
    .optional()
    .or(z.literal('')),
  poNumber: z
    .string()
    .max(100, 'PO Number must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  paymentVoucherNumber: z
    .string()
    .max(100, 'Payment Voucher Number must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  assetType: z
    .string()
    .max(100, 'Asset Type must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  remarks: z
    .string()
    .max(65535, 'Remarks is too long')
    .optional()
    .or(z.literal('')),
  qr: z
    .string()
    .max(255, 'QR code must be 255 characters or less')
    .optional()
    .or(z.literal('')),
  oldAssetTag: z
    .string()
    .max(100, 'Old Asset Tag must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  department: z
    .string()
    .max(100, 'Department must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  site: z
    .string()
    .max(100, 'Site must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  location: z
    .string()
    .max(255, 'Location must be 255 characters or less')
    .optional()
    .or(z.literal('')),

  // Optional select fields
  status: z
    .string()
    .optional()
    .or(z.literal('')),
  depreciationMethod: z
    .string()
    .max(50, 'Depreciation Method must be 50 characters or less')
    .optional()
    .or(z.literal('')),

  // Optional date fields (as strings from input)
  purchaseDate: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || !isNaN(Date.parse(val)),
      'Purchase Date must be a valid date'
    ),
  deliveryDate: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || !isNaN(Date.parse(val)),
      'Delivery Date must be a valid date'
    ),
  dateAcquired: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || !isNaN(Date.parse(val)),
      'Date Acquired must be a valid date'
    ),

  // Optional number fields (as strings from input, validated but kept as strings for form)
  cost: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || (!isNaN(Number(val)) && Number(val) >= 0),
      'Cost must be a valid positive number'
    ),
  depreciableCost: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || (!isNaN(Number(val)) && Number(val) >= 0),
      'Depreciable Cost must be a valid positive number'
    ),
  salvageValue: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || (!isNaN(Number(val)) && Number(val) >= 0),
      'Salvage Value must be a valid positive number'
    ),
  assetLifeMonths: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || (!isNaN(Number(val)) && Number(val) > 0 && Number.isInteger(Number(val))),
      'Asset Life (Months) must be a valid positive integer'
    ),

  // Boolean fields
  depreciableAsset: z.boolean(),
  unaccountedInventory: z.boolean(),

  // Required relation fields
  categoryId: z
    .string()
    .min(1, 'Category is required'),
  subCategoryId: z
    .string()
    .min(1, 'Sub Category is required'),
})

export type AssetFormData = z.infer<typeof assetSchema>

/**
 * Edit asset form validation schema
 * Same required fields as assetSchema for consistency
 */
export const editAssetSchema = z.object({
  // Required fields
  assetTagId: z
    .string()
    .min(1, 'Asset Tag ID is required')
    .max(100, 'Asset Tag ID must be 100 characters or less')
    .regex(
      /^[0-9]{2}-[0-9]{6}[A-Z]-SA$/,
      'Asset Tag ID must match format: YY-XXXXXX[S]-SA (e.g., 25-016011U-SA)'
    ),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(65535, 'Description is too long'),

  // Required string fields (same as add form)
  brand: z
    .string()
    .min(1, 'Brand is required')
    .max(100, 'Brand must be 100 characters or less'),
  model: z
    .string()
    .min(1, 'Model is required')
    .max(100, 'Model must be 100 characters or less'),

  // Optional string fields
  purchasedFrom: z
    .string()
    .max(255, 'Purchased From must be 255 characters or less')
    .optional()
    .or(z.literal('')),
  serialNo: z
    .string()
    .max(100, 'Serial Number must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  additionalInformation: z
    .string()
    .max(65535, 'Additional Information is too long')
    .optional()
    .or(z.literal('')),
  xeroAssetNo: z
    .string()
    .max(100, 'Xero Asset Number must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  owner: z
    .string()
    .max(255, 'Owner must be 255 characters or less')
    .optional()
    .or(z.literal('')),
  issuedTo: z
    .string()
    .max(255, 'Issued To must be 255 characters or less')
    .optional()
    .or(z.literal('')),
  poNumber: z
    .string()
    .max(100, 'PO Number must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  assetType: z
    .string()
    .max(100, 'Asset Type must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  remarks: z
    .string()
    .max(65535, 'Remarks is too long')
    .optional()
    .or(z.literal('')),
  department: z
    .string()
    .max(100, 'Department must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  site: z
    .string()
    .max(100, 'Site must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  location: z
    .string()
    .max(255, 'Location must be 255 characters or less')
    .optional()
    .or(z.literal('')),
  qr: z
    .string()
    .max(255, 'QR code must be 255 characters or less')
    .optional()
    .or(z.literal('')),
  oldAssetTag: z
    .string()
    .max(100, 'Old Asset Tag must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  pbiNumber: z
    .string()
    .max(100, 'PBI Number must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  paymentVoucherNumber: z
    .string()
    .max(100, 'Payment Voucher Number must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  depreciationMethod: z
    .string()
    .max(50, 'Depreciation Method must be 50 characters or less')
    .optional()
    .or(z.literal('')),

  // Optional date fields (as strings from input)
  purchaseDate: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || !isNaN(Date.parse(val)),
      'Purchase Date must be a valid date'
    ),
  deliveryDate: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || !isNaN(Date.parse(val)),
      'Delivery Date must be a valid date'
    ),
  dateAcquired: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || !isNaN(Date.parse(val)),
      'Date Acquired must be a valid date'
    ),

  // Optional number fields (as strings from input, validated but kept as strings for form)
  cost: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || (!isNaN(Number(val)) && Number(val) >= 0),
      'Cost must be a valid positive number'
    ),
  depreciableCost: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || (!isNaN(Number(val)) && Number(val) >= 0),
      'Depreciable Cost must be a valid positive number'
    ),
  salvageValue: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || (!isNaN(Number(val)) && Number(val) >= 0),
      'Salvage Value must be a valid positive number'
    ),
  assetLifeMonths: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || (!isNaN(Number(val)) && Number(val) > 0 && Number.isInteger(Number(val))),
      'Asset Life (Months) must be a valid positive integer'
    ),

  // Boolean fields
  depreciableAsset: z.boolean(),
  unaccountedInventory: z.boolean(),

  // Required relation fields (same as add form)
  categoryId: z
    .string()
    .min(1, 'Category is required'),
  subCategoryId: z
    .string()
    .min(1, 'Sub Category is required'),
})

export type EditAssetFormData = z.infer<typeof editAssetSchema>

/**
 * Checkin form validation schema
 * Validates checkin form fields with proper types and constraints
 */
export const checkinSchema = z.object({
  // Required fields
  checkinDate: z
    .string()
    .min(1, 'Check-in date is required')
    .refine(
      (val) => !isNaN(Date.parse(val)),
      'Check-in date must be a valid date'
    ),
  
  // Asset updates - array of updates for each asset
  assetUpdates: z.array(
    z.object({
      assetId: z.string().min(1, 'Asset ID is required'),
      condition: z
        .string()
        .min(1, 'Asset condition is required')
        .refine(
          (val) => ['Excellent', 'Good', 'Fair', 'Poor', 'Damaged', 'Needs Repair'].includes(val),
          'Condition must be one of: Excellent, Good, Fair, Poor, Damaged, Needs Repair'
        ),
      notes: z
        .string()
        .max(65535, 'Notes must be 65535 characters or less')
        .optional()
        .or(z.literal('')),
      returnLocation: z
        .string()
        .max(255, 'Return location must be 255 characters or less')
        .optional()
        .or(z.literal('')),
    })
  ).min(1, 'At least one asset must be selected for check-in'),
})

export type CheckinFormData = z.infer<typeof checkinSchema>

/**
 * Move form validation schema
 * Validates move form fields with proper types and constraints
 * Has conditional validation based on moveType
 */
export const moveSchema = z.object({
  // Required fields
  assetId: z
    .string()
    .min(1, 'Asset selection is required'),
  moveType: z
    .string()
    .min(1, 'Move type is required')
    .refine(
      (val) => ['Location Transfer', 'Employee Assignment', 'Department Transfer'].includes(val),
      'Move type must be one of: Location Transfer, Employee Assignment, or Department Transfer'
    ),
  moveDate: z
    .string()
    .min(1, 'Move date is required')
    .refine(
      (val) => !isNaN(Date.parse(val)),
      'Move date must be a valid date'
    ),
  
  // Conditional required fields based on moveType
  location: z
    .string()
    .max(255, 'Location must be 255 characters or less')
    .optional()
    .or(z.literal('')),
  employeeUserId: z
    .string()
    .optional()
    .or(z.literal('')),
  department: z
    .string()
    .max(100, 'Department must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  
  // Optional fields
  reason: z
    .string()
    .max(65535, 'Reason must be 65535 characters or less')
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .max(65535, 'Notes must be 65535 characters or less')
    .optional()
    .or(z.literal('')),
}).refine(
  (data) => {
    // Location Transfer requires location
    if (data.moveType === 'Location Transfer') {
      return data.location && data.location.trim().length > 0
    }
    return true
  },
  {
    message: 'Location is required for Location Transfer',
    path: ['location'],
  }
).refine(
  (data) => {
    // Employee Assignment requires employeeUserId
    if (data.moveType === 'Employee Assignment') {
      return data.employeeUserId && data.employeeUserId.trim().length > 0
    }
    return true
  },
  {
    message: 'Employee is required for Employee Assignment',
    path: ['employeeUserId'],
  }
).refine(
  (data) => {
    // Department Transfer requires department
    if (data.moveType === 'Department Transfer') {
      return data.department && data.department.trim().length > 0
    }
    return true
  },
  {
    message: 'Department is required for Department Transfer',
    path: ['department'],
  }
)

export type MoveFormData = z.infer<typeof moveSchema>

export const reserveSchema = z.object({
  // Required fields
  assetId: z
    .string()
    .min(1, 'Asset selection is required'),
  reservationType: z
    .string()
    .min(1, 'Reservation type is required')
    .refine(
      (val) => ['Employee', 'Department'].includes(val),
      'Reservation type must be either Employee or Department'
    ),
  reservationDate: z
    .string()
    .min(1, 'Reservation date is required')
    .refine(
      (val) => !isNaN(Date.parse(val)),
      'Reservation date must be a valid date'
    ),
  
  // Conditional required fields based on reservationType
  employeeUserId: z
    .string()
    .optional()
    .or(z.literal('')),
  department: z
    .string()
    .max(100, 'Department must be 100 characters or less')
    .optional()
    .or(z.literal('')),
  
  // Optional fields
  purpose: z
    .string()
    .max(65535, 'Purpose must be 65535 characters or less')
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .max(65535, 'Notes must be 65535 characters or less')
    .optional()
    .or(z.literal('')),
}).refine(
  (data) => {
    // Employee reservation requires employeeUserId
    if (data.reservationType === 'Employee') {
      return data.employeeUserId && data.employeeUserId.trim().length > 0
    }
    return true
  },
  {
    message: 'Employee is required for Employee reservation',
    path: ['employeeUserId'],
  }
).refine(
  (data) => {
    // Department reservation requires department
    if (data.reservationType === 'Department') {
      return data.department && data.department.trim().length > 0
    }
    return true
  },
  {
    message: 'Department is required for Department reservation',
    path: ['department'],
  }
)

export type ReserveFormData = z.infer<typeof reserveSchema>

export const leaseSchema = z.object({
  // Required fields
  assetId: z
    .string()
    .min(1, 'Asset selection is required'),
  lessee: z
    .string()
    .min(1, 'Lessee (third party name/organization) is required')
    .max(255, 'Lessee must be 255 characters or less'),
  leaseStartDate: z
    .string()
    .min(1, 'Lease start date is required')
    .refine(
      (val) => !isNaN(Date.parse(val)),
      'Lease start date must be a valid date'
    ),
  
  // Optional fields
  leaseEndDate: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || !isNaN(Date.parse(val)),
      'Lease end date must be a valid date'
    ),
  conditions: z
    .string()
    .max(65535, 'Conditions must be 65535 characters or less')
    .optional()
    .or(z.literal('')),
  notes: z
    .string()
    .max(65535, 'Notes must be 65535 characters or less')
    .optional()
    .or(z.literal('')),
}).refine(
  (data) => {
    // If leaseEndDate is provided, it must be after leaseStartDate
    if (data.leaseEndDate && data.leaseEndDate.trim()) {
      const startDate = new Date(data.leaseStartDate)
      const endDate = new Date(data.leaseEndDate)
      return endDate >= startDate
    }
    return true
  },
  {
    message: 'Lease end date must be after or equal to start date',
    path: ['leaseEndDate'],
  }
)

export type LeaseFormData = z.infer<typeof leaseSchema>

export const leaseReturnSchema = z.object({
  // Required fields
  assetIds: z
    .array(z.string().min(1, 'Asset ID is required'))
    .min(1, 'At least one asset must be selected for return'),
  returnDate: z
    .string()
    .min(1, 'Return date is required')
    .refine(
      (val) => !isNaN(Date.parse(val)),
      'Return date must be a valid date'
    ),
  
  // Asset-specific updates
  assetUpdates: z
    .array(
      z.object({
        assetId: z.string().min(1, 'Asset ID is required'),
        condition: z
          .string()
          .max(255, 'Condition must be 255 characters or less')
          .optional()
          .or(z.literal('')),
        notes: z
          .string()
          .max(65535, 'Notes must be 65535 characters or less')
          .optional()
          .or(z.literal('')),
      })
    )
    .optional()
    .default([]),
})

export type LeaseReturnFormData = z.infer<typeof leaseReturnSchema>

export const disposeSchema = z.object({
  // Required fields
  assetIds: z
    .array(z.string().min(1, 'Asset ID is required'))
    .min(1, 'At least one asset must be selected for disposal'),
  disposeDate: z
    .string()
    .min(1, 'Dispose date is required')
    .refine(
      (val) => !isNaN(Date.parse(val)),
      'Dispose date must be a valid date'
    ),
  disposalMethod: z
    .string()
    .min(1, 'Disposal method is required')
    .refine(
      (val) => ['Sold', 'Donated', 'Scrapped', 'Lost/Missing', 'Destroyed'].includes(val),
      'Disposal method must be one of: Sold, Donated, Scrapped, Lost/Missing, or Destroyed'
    ),
  
  // Optional fields
  disposeReason: z
    .string()
    .max(65535, 'Dispose reason must be 65535 characters or less')
    .optional()
    .or(z.literal('')),
  
  // Asset-specific updates
  assetUpdates: z
    .array(
      z.object({
        assetId: z.string().min(1, 'Asset ID is required'),
        disposeValue: z
          .string()
          .optional()
          .or(z.literal('')),
        notes: z
          .string()
          .max(65535, 'Notes must be 65535 characters or less')
          .optional()
          .or(z.literal('')),
      })
    )
    .optional()
    .default([]),
}).superRefine((data, ctx) => {
  // If disposal method is "Sold", validate dispose value for each asset
  if (data.disposalMethod === 'Sold') {
    data.assetUpdates.forEach((update, index) => {
      if (!update.disposeValue || update.disposeValue.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Dispose value is required when disposal method is "Sold"',
          path: ['assetUpdates', index, 'disposeValue'],
        })
      } else {
        const value = parseFloat(update.disposeValue)
        if (isNaN(value) || value <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Dispose value must be a valid number greater than 0',
            path: ['assetUpdates', index, 'disposeValue'],
          })
        }
      }
    })
  }
})

export type DisposeFormData = z.infer<typeof disposeSchema>

export const maintenanceSchema = z.object({
  // Required fields
  assetId: z
    .string()
    .min(1, 'Asset selection is required'),
  title: z
    .string()
    .min(1, 'Maintenance title is required')
    .max(255, 'Title must be 255 characters or less'),
  status: z
    .string()
    .min(1, 'Maintenance status is required')
    .refine(
      (val) => ['Scheduled', 'In progress'].includes(val),
      'Status must be either "Scheduled" or "In progress" when creating a maintenance record'
    ),
  
  // Optional fields
  details: z
    .string()
    .max(65535, 'Details must be 65535 characters or less')
    .optional()
    .or(z.literal('')),
  dueDate: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || !isNaN(Date.parse(val)),
      'Due date must be a valid date'
    ),
  maintenanceBy: z
    .string()
    .max(255, 'Maintenance by must be 255 characters or less')
    .optional()
    .or(z.literal('')),
  cost: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || (!isNaN(Number(val)) && Number(val) >= 0),
      'Cost must be a valid positive number'
    ),
  dateCompleted: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || !isNaN(Date.parse(val)),
      'Date completed must be a valid date'
    ),
  dateCancelled: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => !val || !isNaN(Date.parse(val)),
      'Date cancelled must be a valid date'
    ),
  isRepeating: z.boolean(),
})

export type MaintenanceFormData = z.infer<typeof maintenanceSchema>

