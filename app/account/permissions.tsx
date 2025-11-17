'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { Shield, ShieldCheck } from 'lucide-react'

interface UserPermissions {
  role: string
  canDeleteAssets: boolean
  canManageImport: boolean
  canManageExport: boolean
  canCreateAssets: boolean
  canEditAssets: boolean
  canViewAssets: boolean
  canManageEmployees: boolean
  canManageCategories: boolean
  canCheckout: boolean
  canCheckin: boolean
  canReserve: boolean
  canMove: boolean
  canLease: boolean
  canDispose: boolean
  canManageMaintenance: boolean
  canAudit: boolean
  canManageMedia: boolean
  canManageTrash: boolean
  canManageUsers: boolean
  canManageReturnForms: boolean
  canViewReturnForms: boolean
  canManageAccountabilityForms: boolean
  canViewAccountabilityForms: boolean
  canManageReports: boolean
}

async function fetchPermissions(): Promise<UserPermissions> {
  const response = await fetch('/api/auth/me')
  if (!response.ok) {
    throw new Error('Failed to fetch permissions')
  }
  const data = await response.json()
  return data.permissions
}

const permissionLabels: Record<keyof Omit<UserPermissions, 'role'>, string> = {
  canDeleteAssets: 'Delete Assets',
  canManageImport: 'Manage Import',
  canManageExport: 'Manage Export',
  canCreateAssets: 'Create Assets',
  canEditAssets: 'Edit Assets',
  canViewAssets: 'View Assets',
  canManageEmployees: 'Manage Employees',
  canManageCategories: 'Manage Categories',
  canCheckout: 'Checkout Assets',
  canCheckin: 'Checkin Assets',
  canReserve: 'Reserve Assets',
  canMove: 'Move Assets',
  canLease: 'Lease Assets',
  canDispose: 'Dispose Assets',
  canManageMaintenance: 'Manage Maintenance',
  canAudit: 'Audit Assets',
  canManageMedia: 'Manage Media',
  canManageTrash: 'Manage Trash',
  canManageUsers: 'Manage Users',
  canManageReturnForms: 'Manage Return Forms',
  canViewReturnForms: 'View Return Forms',
  canManageAccountabilityForms: 'Manage Accountability Forms',
  canViewAccountabilityForms: 'View Accountability Forms',
  canManageReports: 'Manage Reports',
}

export default function Permissions() {
  const { data: permissions, isLoading } = useQuery({
    queryKey: ['user-permissions'],
    queryFn: fetchPermissions,
  })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner className="h-8 w-8" />
        </CardContent>
      </Card>
    )
  }

  if (!permissions) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">Failed to load permissions</p>
        </CardContent>
      </Card>
    )
  }

  const isAdmin = permissions.role === 'admin'
  const enabledPermissions = Object.entries(permissions)
    .filter(([key, value]) => key !== 'role' && value === true)
    .map(([key]) => key as keyof Omit<UserPermissions, 'role'>)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Permissions</CardTitle>
        <CardDescription>
          View your current permissions and access levels
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Role</h3>
          </div>
          <Badge variant={isAdmin ? 'default' : 'secondary'} className="text-sm">
            {permissions.role.charAt(0).toUpperCase() + permissions.role.slice(1)}
          </Badge>
          {isAdmin && (
            <p className="text-sm text-muted-foreground mt-2">
              As an administrator, you have access to all features and permissions.
            </p>
          )}
        </div>

        {!isAdmin && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold">Enabled Permissions</h3>
            </div>
            {enabledPermissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No specific permissions enabled. Contact your administrator for access.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {enabledPermissions.map((permission) => (
                  <div
                    key={permission}
                    className="flex items-center gap-2 p-2 rounded-md bg-muted/50"
                  >
                    <ShieldCheck className="h-4 w-4 text-green-600" />
                    <span className="text-sm">{permissionLabels[permission]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

