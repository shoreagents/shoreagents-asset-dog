"use client"

import { useQuery } from '@tanstack/react-query'
import { useState, useTransition, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePermissions } from '@/hooks/use-permissions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { QRCodeDisplayDialog } from '@/components/qr-code-display-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  Activity, 
  ArrowRight, 
  ArrowLeft, 
  Calendar, 
  FileText, 
  Wrench, 
  Trash2,
  MapPin,
  Archive,
  RefreshCw
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'

interface ActivityItem {
  id: string
  type: string
  assetId: string
  assetTagId: string
  assetDescription: string
  timestamp: string
  details: Record<string, unknown>
}

const activityTypes = [
  { value: 'all', label: 'All Activities', icon: Activity },
  { value: 'checkout', label: 'Check Outs', icon: ArrowRight },
  { value: 'checkin', label: 'Check Ins', icon: ArrowLeft },
  { value: 'move', label: 'Moves', icon: MapPin },
  { value: 'reserve', label: 'Reservations', icon: Calendar },
  { value: 'lease', label: 'Leases', icon: FileText },
  { value: 'leaseReturn', label: 'Lease Returns', icon: Archive },
  { value: 'dispose', label: 'Disposals', icon: Trash2 },
  { value: 'maintenance', label: 'Maintenance', icon: Wrench },
]

function getActivityIcon(type: string) {
  switch (type) {
    case 'checkout':
      return ArrowRight
    case 'checkin':
      return ArrowLeft
    case 'move':
      return MapPin
    case 'reserve':
      return Calendar
    case 'lease':
      return FileText
    case 'leaseReturn':
      return Archive
    case 'dispose':
      return Trash2
    case 'maintenance':
      return Wrench
    default:
      return Activity
  }
}

function getActivityColor(type: string) {
  switch (type) {
    case 'checkout':
      return 'bg-blue-500'
    case 'checkin':
      return 'bg-green-500'
    case 'move':
      return 'bg-purple-500'
    case 'reserve':
      return 'bg-amber-500'
    case 'lease':
      return 'bg-indigo-500'
    case 'leaseReturn':
      return 'bg-teal-500'
    case 'dispose':
      return 'bg-red-500'
    case 'maintenance':
      return 'bg-orange-500'
    default:
      return 'bg-gray-500'
  }
}

function getActivityBadgeStyle(type: string): { variant: 'default' | 'secondary' | 'destructive' | 'outline', className: string } {
  switch (type) {
    case 'checkout':
      // Matches "checked out" status: destructive variant, bg-blue-500
      return { variant: 'destructive', className: 'bg-blue-500' }
    case 'checkin':
      // Matches "available" status: default variant, bg-green-500
      return { variant: 'default', className: 'bg-green-500' }
    case 'lease':
      // Matches "leased" status: secondary variant, bg-yellow-500
      return { variant: 'secondary', className: 'bg-yellow-500' }
    case 'maintenance':
      // Matches "maintenance" status: bg-red-600 text-white
      return { variant: 'outline', className: 'bg-red-600 text-white' }
    case 'dispose':
      // Matches "disposed" status: secondary variant, bg-purple-500
      return { variant: 'secondary', className: 'bg-purple-500' }
    case 'move':
    case 'reserve':
    case 'leaseReturn':
      // No direct status match, use neutral colors
      return { variant: 'outline', className: 'bg-gray-500' }
    default:
      return { variant: 'outline', className: 'bg-gray-500' }
  }
}

function getActivityLabel(type: string) {
  switch (type) {
    case 'checkout':
      return 'Checked Out'
    case 'checkin':
      return 'Checked In'
    case 'move':
      return 'Moved'
    case 'reserve':
      return 'Reserved'
    case 'lease':
      return 'Leased'
    case 'leaseReturn':
      return 'Lease Returned'
    case 'dispose':
      return 'Disposed'
    case 'maintenance':
      return 'Maintenance'
    default:
      return 'Activity'
  }
}

function formatActivityDetails(activity: ActivityItem) {
  const { type, details } = activity

  switch (type) {
    case 'checkout':
      return {
        primary: `Checked out to ${details.employeeName as string || 'Unknown'}`,
        secondary: details.employeeEmail as string || '',
        metadata: [
          details.checkoutDate && `Checkout: ${new Date(details.checkoutDate as string).toLocaleDateString()}`,
          details.expectedReturnDate && `Expected return: ${new Date(details.expectedReturnDate as string).toLocaleDateString()}`,
        ].filter(Boolean),
      }
    case 'checkin':
      return {
        primary: `Checked in by ${details.employeeName as string || 'Unknown'}`,
        secondary: details.employeeEmail as string || '',
        metadata: [
          details.checkinDate && `Checkin: ${new Date(details.checkinDate as string).toLocaleDateString()}`,
          details.condition && `Condition: ${details.condition as string}`,
        ].filter(Boolean),
      }
    case 'move':
      return {
        primary: `Move: ${details.moveType as string || 'Unknown'}`,
        secondary: details.employeeName ? `Employee: ${details.employeeName as string}` : '',
        metadata: [
          details.moveDate && `Date: ${new Date(details.moveDate as string).toLocaleDateString()}`,
          details.reason && `Reason: ${(details.reason as string).substring(0, 50)}`,
        ].filter(Boolean),
      }
    case 'reserve':
      return {
        primary: `Reserved: ${details.reservationType as string || 'Unknown'}`,
        secondary: details.employeeName 
          ? `Employee: ${details.employeeName as string}`
          : details.department 
          ? `Department: ${details.department as string}`
          : '',
        metadata: [
          details.reservationDate && `Date: ${new Date(details.reservationDate as string).toLocaleDateString()}`,
          details.purpose && `Purpose: ${(details.purpose as string).substring(0, 50)}`,
        ].filter(Boolean),
      }
    case 'lease':
      return {
        primary: `Leased to ${details.lessee as string || 'Unknown'}`,
        secondary: '',
        metadata: [
          details.leaseStartDate && `Start: ${new Date(details.leaseStartDate as string).toLocaleDateString()}`,
          details.leaseEndDate && `End: ${new Date(details.leaseEndDate as string).toLocaleDateString()}`,
        ].filter(Boolean),
      }
    case 'leaseReturn':
      return {
        primary: `Lease returned from ${details.lessee as string || 'Unknown'}`,
        secondary: '',
        metadata: [
          details.returnDate && `Return date: ${new Date(details.returnDate as string).toLocaleDateString()}`,
          details.condition && `Condition: ${details.condition as string}`,
        ].filter(Boolean),
      }
    case 'dispose':
      return {
        primary: `Disposed via ${details.disposalMethod as string || 'Unknown'}`,
        secondary: '',
        metadata: [
          details.disposeDate && `Date: ${new Date(details.disposeDate as string).toLocaleDateString()}`,
          details.disposeValue && `Value: ${Number(details.disposeValue).toLocaleString('en-US', { style: 'currency', currency: 'PHP' })}`,
          details.disposeReason && `Reason: ${(details.disposeReason as string).substring(0, 50)}`,
        ].filter(Boolean),
      }
    case 'maintenance':
      return {
        primary: details.title as string || 'Maintenance',
        secondary: details.maintenanceBy as string || '',
        metadata: [
          details.status && `Status: ${details.status as string}`,
          details.dueDate && `Due: ${new Date(details.dueDate as string).toLocaleDateString()}`,
          details.dateCompleted && `Completed: ${new Date(details.dateCompleted as string).toLocaleDateString()}`,
          details.cost && `Cost: ${Number(details.cost).toLocaleString('en-US', { style: 'currency', currency: 'PHP' })}`,
        ].filter(Boolean),
      }
    default:
      return {
        primary: 'Activity',
        secondary: '',
        metadata: [],
      }
  }
}

interface PaginationInfo {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

function ActivityPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  
  const canViewAssets = hasPermission('canViewAssets')
  
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [selectedAssetTag, setSelectedAssetTag] = useState<string>('')
  const [, startTransition] = useTransition()
  
  // Get page, pageSize, and type from URL, default to 1, 100, and 'all'
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '100', 10)
  const selectedType = searchParams.get('type') || 'all'

  // Update URL parameters
  const updateURL = (updates: { page?: number; pageSize?: number; type?: string }) => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (updates.page !== undefined) {
      if (updates.page === 1) {
        params.delete('page')
      } else {
        params.set('page', updates.page.toString())
      }
    }
    
    if (updates.pageSize !== undefined) {
      if (updates.pageSize === 100) {
        params.delete('pageSize')
      } else {
        params.set('pageSize', updates.pageSize.toString())
      }
    }
    
    if (updates.type !== undefined) {
      if (updates.type === 'all') {
        params.delete('type')
      } else {
        params.set('type', updates.type)
      }
      // Reset to page 1 when type changes
      params.delete('page')
    }
    
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false })
    })
  }

  const { data, isLoading, error, refetch, isFetching } = useQuery<{ activities: ActivityItem[], pagination: PaginationInfo }>({
    queryKey: ['activities', selectedType, page, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams({ 
        page: page.toString(),
        pageSize: pageSize.toString(),
      })
      if (selectedType !== 'all') {
        params.append('type', selectedType)
      }
      const response = await fetch(`/api/activities?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch activities')
      }
      return response.json()
    },
    enabled: canViewAssets, // Only fetch if user has permission
    staleTime: 30000, // Cache for 30 seconds
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
  })

  const activities = data?.activities || []
  const pagination = data?.pagination

  // Reset to page 1 when type or pageSize changes
  const handleTypeChange = (type: string) => {
    updateURL({ type, page: 1 })
  }

  const handlePageSizeChange = (newPageSize: string) => {
    updateURL({ pageSize: parseInt(newPageSize), page: 1 })
  }

  const handlePageChange = (newPage: number) => {
    updateURL({ page: newPage })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Recent Activity</h1>
        <p className="text-muted-foreground">
          Track all asset-related activities and transactions
        </p>
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        {activityTypes.map((type) => {
          const Icon = type.icon
          return (
            <Button
              key={type.value}
              variant={selectedType === type.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleTypeChange(type.value)}
              className="gap-2"
            >
              <Icon className="h-4 w-4" />
              {type.label}
            </Button>
          )
        })}
      </div>

      {/* Activity Feed */}
      <Card className="relative flex flex-col flex-1 min-h-0 pb-0">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <Activity className="h-5 w-5 shrink-0" />
              <span className="truncate">Activity Feed</span>
              {selectedType !== 'all' && (
                <Badge variant="secondary" className="shrink-0">
                  {activities.length} {activityTypes.find(t => t.value === selectedType)?.label}
                </Badge>
              )}
            </CardTitle>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching || isLoading}
              className="h-8 w-8 shrink-0"
              title="Refresh activities"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <CardDescription className="mt-1.5">
            {selectedType === 'all' 
              ? 'All asset activities across the system'
              : `Showing ${activityTypes.find(t => t.value === selectedType)?.label.toLowerCase()} only`
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 px-0">
          <div className="h-120">
          {permissionsLoading || isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <Spinner className="h-8 w-8" />
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            </div>
          ) : !canViewAssets ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3 text-center">
                <Activity className="h-12 w-12 text-muted-foreground opacity-50" />
                <p className="text-lg font-medium">Access Denied</p>
                <p className="text-sm text-muted-foreground">
                  You do not have permission to view assets. Please contact your administrator.
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-muted-foreground">
              Failed to load activities. Please try again.
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No activities found</p>
              <p className="text-sm">Activities will appear here as they happen</p>
            </div>
          ) : (
            <div className="min-w-full">
              <ScrollArea className='h-[calc(100vh-30rem)] min-h-[500px]'>
              <Table className='border-t'>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Type</TableHead>
                    <TableHead className="w-[150px]">Asset Tag</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Activity Details</TableHead>
                    <TableHead className="w-[120px]">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.map((activity) => {
                    const Icon = getActivityIcon(activity.type)
                    const colorClass = getActivityColor(activity.type)
                    const badgeStyle = getActivityBadgeStyle(activity.type)
                    const activityLabel = getActivityLabel(activity.type)
                    const formatted = formatActivityDetails(activity)
                    const timeAgo = formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })

                    return (
                      <TableRow
                        key={activity.id}
                        className="cursor-pointer hover:bg-accent/50"
                        onClick={() => {
                          window.location.href = `/assets?search=${encodeURIComponent(activity.assetTagId)}`
                        }}
                      >
                        <TableCell>
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full ${colorClass} text-white`}>
                            <Icon className="h-4 w-4" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className="font-medium cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedAssetTag(activity.assetTagId)
                              setQrDialogOpen(true)
                            }}
                          >
                            {activity.assetTagId}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={badgeStyle.variant} className={`text-xs font-medium ${badgeStyle.className}`}>
                            {activityLabel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[300px]">
                            <p className="text-sm font-medium truncate">
                              {activity.assetDescription || 'No description'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="text-sm font-medium">
                              {formatted.primary}
                            </p>
                            {formatted.secondary && (
                              <p className="text-xs text-muted-foreground">
                                {formatted.secondary}
                              </p>
                            )}
                            {formatted.metadata.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-1">
                                {formatted.metadata.map((meta, idx) => (
                                  <span
                                    key={idx}
                                    className="text-xs text-muted-foreground"
                                  >
                                    {String(meta)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span>{timeAgo}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" className='z-10' />
              <ScrollBar orientation="vertical" className='z-10' />
              </ScrollArea>
            </div>
          )}
          </div>
        </CardContent>
        
        {/* Pagination Bar - Fixed at Bottom */}
        <div className="sticky bottom-0 border-t bg-card z-10 shadow-sm mt-auto rounded-bl-lg rounded-br-lg">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 px-4 sm:px-6 py-3">
            {/* Left Side - Navigation */}
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (pagination?.hasPreviousPage) {
                    handlePageChange(page - 1)
                  }
                }}
                disabled={!pagination?.hasPreviousPage || isLoading}
                className="h-8 px-2 sm:px-3"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              
              {/* Page Info */}
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                <span className="text-muted-foreground">Page</span>
                <div className="px-1.5 sm:px-2 py-1 rounded-md bg-primary/10 text-primary font-medium text-xs sm:text-sm">
                  {isLoading ? '...' : (pagination?.page || page)}
                </div>
                <span className="text-muted-foreground">of</span>
                <span className="text-muted-foreground">{isLoading ? '...' : (pagination?.totalPages || 1)}</span>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (pagination?.hasNextPage) {
                    handlePageChange(page + 1)
                  }
                }}
                disabled={!pagination?.hasNextPage || isLoading}
                className="h-8 px-2 sm:px-3"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Right Side - Rows and Records */}
            <div className="flex items-center justify-center sm:justify-end gap-2 sm:gap-4">
              {/* Row Selection - Clickable */}
              <Select value={pageSize.toString()} onValueChange={handlePageSizeChange} disabled={isLoading}>
                <SelectTrigger className="h-8 w-auto min-w-[90px] sm:min-w-[100px] text-xs sm:text-sm border-primary/20 bg-primary/10 text-primary font-medium hover:bg-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">100 rows</SelectItem>
                  <SelectItem value="200">200 rows</SelectItem>
                  <SelectItem value="300">300 rows</SelectItem>
                  <SelectItem value="400">400 rows</SelectItem>
                  <SelectItem value="500">500 rows</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Total Records */}
              <div className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                {isLoading ? (
                  <Spinner className="h-4 w-4" variant="default" />
                ) : (
                  <>
                    <span className="hidden sm:inline">{pagination?.total || 0} records</span>
                    <span className="sm:hidden">{pagination?.total || 0}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* QR Code Display Dialog */}
      <QRCodeDisplayDialog
        open={qrDialogOpen}
        onOpenChange={setQrDialogOpen}
        assetTagId={selectedAssetTag}
      />
    </div>
  )
}

export default function ActivityPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Activity</h1>
          <p className="text-muted-foreground">
            View recent activity and changes
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Spinner className="h-8 w-8" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <ActivityPageContent />
    </Suspense>
  )
}

