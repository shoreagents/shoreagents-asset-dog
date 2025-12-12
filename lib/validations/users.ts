import { z } from 'zod'

/**
 * User permissions validation schema
 * Validates all permission fields as booleans
 */
export const userPermissionsSchema = z.object({
  canDeleteAssets: z.boolean(),
  canManageImport: z.boolean(),
  canManageExport: z.boolean(),
  canCreateAssets: z.boolean(),
  canEditAssets: z.boolean(),
  canViewAssets: z.boolean(),
  canManageEmployees: z.boolean(),
  canManageSetup: z.boolean(),
  canCheckout: z.boolean(),
  canCheckin: z.boolean(),
  canReserve: z.boolean(),
  canMove: z.boolean(),
  canLease: z.boolean(),
  canDispose: z.boolean(),
  canManageMaintenance: z.boolean(),
  canAudit: z.boolean(),
  canManageMedia: z.boolean(),
  canManageTrash: z.boolean(),
  canManageUsers: z.boolean(),
  canManageReturnForms: z.boolean(),
  canViewReturnForms: z.boolean(),
  canManageAccountabilityForms: z.boolean(),
  canViewAccountabilityForms: z.boolean(),
  canManageReports: z.boolean(),
  canManageInventory: z.boolean(),
})

/**
 * User form validation schema for creating a new user
 * Validates email, password, role, and permissions
 */
export const createUserSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .max(255, 'Email must be 255 characters or less')
    .trim()
    .toLowerCase(),
  password: z
    .string()
    .optional()
    .refine((val) => !val || val.length === 0 || val.length >= 8, {
      message: 'Password must be at least 8 characters long',
    }),
  name: z
    .string()
    .max(255, 'Name must be 255 characters or less')
    .trim()
    .optional()
    .nullable(),
  role: z
    .string()
    .min(1, 'Role is required')
    .refine(
      (val) => ['admin', 'user'].includes(val),
      'Role must be either admin or user'
    ),
  permissions: userPermissionsSchema.optional(),
}).refine(
  (data) => {
    // If role is 'user', permissions are required
    if (data.role === 'user') {
      return data.permissions !== undefined
    }
    return true
  },
  {
    message: 'Permissions are required for user role',
    path: ['permissions'],
  }
)

/**
 * User form validation schema for updating an existing user
 * Validates role, permissions, isActive, and isApproved
 */
export const updateUserSchema = z.object({
  role: z
    .string()
    .min(1, 'Role is required')
    .refine(
      (val) => ['admin', 'user'].includes(val),
      'Role must be either admin or user'
    ),
  isActive: z.boolean(),
  isApproved: z.boolean(),
  permissions: userPermissionsSchema.optional(),
}).refine(
  (data) => {
    // If role is 'user', permissions are required
    if (data.role === 'user') {
      return data.permissions !== undefined
    }
    return true
  },
  {
    message: 'Permissions are required for user role',
    path: ['permissions'],
  }
)

export type CreateUserFormData = z.infer<typeof createUserSchema>
export type UpdateUserFormData = z.infer<typeof updateUserSchema>
export type UserPermissionsFormData = z.infer<typeof userPermissionsSchema>

