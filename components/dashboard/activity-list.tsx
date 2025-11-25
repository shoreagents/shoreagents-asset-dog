'use client'

import { useState, useEffect } from 'react'
import { ActivityItem, PaginationInfo } from '@/lib/data/activities'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Activity, ArrowLeft, ArrowRight, MapPin, Calendar, FileText, Archive, Trash2, Wrench, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { QRCodeDisplayDialog } from '@/components/qr-code-display-dialog'
import { activityTypes } from './activity-filters'

interface ActivityListProps {
  activities: ActivityItem[]
  pagination: PaginationInfo | undefined
  isLoading: boolean
  isFetching: boolean
  selectedType: string
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: string) => void
  onRefresh: () => void
}

// Helper functions (moved from activity-client.tsx)
function getActivityIcon(type: string) {
  switch (type) {
    case 'checkout': return ArrowRight
    case 'checkin': return ArrowLeft
    case 'move': return MapPin
    case 'reserve': return Calendar
    case 'lease': return FileText
    case 'leaseReturn': return Archive
    case 'dispose': return Trash2
    case 'maintenance': return Wrench
    default: return Activity
  }
}

function getActivityColor(type: string) {
  switch (type) {
    case 'checkout': return 'bg-blue-500'
    case 'checkin': return 'bg-green-500'
    case 'move': return 'bg-purple-500'
    case 'reserve': return 'bg-amber-500'
    case 'lease': return 'bg-indigo-500'
    case 'leaseReturn': return 'bg-teal-500'
    case 'dispose': return 'bg-red-500'
    case 'maintenance': return 'bg-orange-500'
    default: return 'bg-gray-500'
  }
}

function getActivityBadgeStyle(type: string): { variant: 'default' | 'secondary' | 'destructive' | 'outline', className: string } {
  switch (type) {
    case 'checkout': return { variant: 'destructive', className: 'bg-blue-500 hover:bg-blue-600' }
    case 'checkin': return { variant: 'default', className: 'bg-green-500 hover:bg-green-600' }
    case 'lease': return { variant: 'secondary', className: 'bg-yellow-500 hover:bg-yellow-600' }
    case 'maintenance': return { variant: 'outline', className: 'bg-orange-500 text-white hover:bg-orange-600 border-orange-600' }
    case 'dispose': return { variant: 'secondary', className: 'bg-red-500 text-white hover:bg-red-600' }
    default: return { variant: 'outline', className: 'bg-gray-500 text-white hover:bg-gray-600 border-gray-600' }
  }
}

function getActivityLabel(type: string) {
  const found = activityTypes.find(t => t.value === type)
  return found ? found.label.replace('All Activities', 'Activity') : 'Activity'
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

export function ActivityList({ 
  activities, 
  pagination, 
  isLoading, 
  isFetching, 
  selectedType,
  onPageChange,
  onPageSizeChange,
  onRefresh
}: ActivityListProps) {
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [selectedAssetTag, setSelectedAssetTag] = useState<string>('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0)
    return () => clearTimeout(timer)
  }, [])

  if (!mounted) return null

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="relative flex flex-col flex-1 min-h-0 pb-0 overflow-hidden border-t-4 border-t-primary/20 gap-0">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 flex-wrap">
                <Activity className="h-5 w-5 shrink-0 text-primary" />
                <span className="truncate">Activity Feed</span>
                {selectedType !== 'all' && (
                  <Badge variant="secondary" className="shrink-0 animate-in fade-in zoom-in">
                    {pagination?.total || 0} {activityTypes.find(t => t.value === selectedType)?.label}
                  </Badge>
                )}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefresh}
                disabled={isFetching || isLoading}
                className="h-8 w-8 shrink-0 hover:bg-primary/10 hover:text-primary transition-colors"
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
          <CardContent className="flex-1 p-0">
            <div className="h-full min-h-[500px]">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-[400px] gap-3">
                  <Spinner className="h-8 w-8" />
                  <p className="text-sm text-muted-foreground animate-pulse">Loading activities...</p>
                </div>
              ) : activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground gap-2">
                  <div className="p-4 rounded-full bg-muted/50 mb-2">
                    <Activity className="h-8 w-8 opacity-50" />
                  </div>
                  <p className="font-medium">No activities found</p>
                  <p className="text-sm">Activities will appear here as they happen</p>
                </div>
              ) : (
                <div className="relative w-full">
                  <ScrollArea className='h-[500px] w-full rounded-none'>
                    <Table>
                      <TableHeader className="sticky top-0 z-20 bg-card shadow-sm">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-[60px] pl-4">Type</TableHead>
                          <TableHead className="w-[140px]">Asset Tag</TableHead>
                          <TableHead className="w-[120px]">Status</TableHead>
                          <TableHead className="min-w-[200px]">Description</TableHead>
                          <TableHead className="min-w-[250px]">Activity Details</TableHead>
                          <TableHead className="w-[140px] text-right pr-4">Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <AnimatePresence initial={false}>
                          {activities.map((activity, index) => {
                            const Icon = getActivityIcon(activity.type)
                            const colorClass = getActivityColor(activity.type)
                            const badgeStyle = getActivityBadgeStyle(activity.type)
                            const activityLabel = getActivityLabel(activity.type)
                            const formatted = formatActivityDetails(activity)
                            const timeAgo = formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })

                            return (
                              <motion.tr
                                key={activity.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.03 }}
                                className="group cursor-pointer hover:bg-muted/40 border-b last:border-0"
                                onClick={() => {
                                  window.location.href = `/assets?search=${encodeURIComponent(activity.assetTagId)}`
                                }}
                              >
                                <TableCell className="pl-4 py-3">
                                  <div className={`flex h-9 w-9 items-center justify-center rounded-full ${colorClass} text-white shadow-sm group-hover:scale-110 transition-transform`}>
                                    <Icon className="h-4 w-4" />
                                  </div>
                                </TableCell>
                                <TableCell className="py-3">
                                  <Badge 
                                    variant="outline" 
                                    className="font-medium cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-xs px-2 py-0.5"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedAssetTag(activity.assetTagId)
                                      setQrDialogOpen(true)
                                    }}
                                  >
                                    {activity.assetTagId}
                                  </Badge>
                                </TableCell>
                                <TableCell className="py-3">
                                  <Badge variant={badgeStyle.variant} className={`text-[10px] px-2 py-0.5 font-semibold ${badgeStyle.className} border-0`}>
                                    {activityLabel}
                                  </Badge>
                                </TableCell>
                                <TableCell className="py-3">
                                  <div className="max-w-[250px]">
                                    <p className="text-sm font-medium truncate" title={activity.assetDescription}>
                                      {activity.assetDescription || 'No description'}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell className="py-3">
                                  <div className="space-y-1">
                                    <p className="text-sm font-medium text-foreground/90">
                                      {formatted.primary}
                                    </p>
                                    {formatted.secondary && (
                                      <p className="text-xs text-muted-foreground">
                                        {formatted.secondary}
                                      </p>
                                    )}
                                    {formatted.metadata.length > 0 && (
                                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                                        {formatted.metadata.map((meta, idx) => (
                                          <span
                                            key={idx}
                                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border"
                                          >
                                            {String(meta)}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right pr-4 py-3">
                                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                                    {timeAgo}
                                  </span>
                                </TableCell>
                              </motion.tr>
                            )
                          })}
                        </AnimatePresence>
                      </TableBody>
                    </Table>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </div>
              )}
            </div>
          </CardContent>
          
          {/* Pagination Bar */}
          <div className="border-t bg-card/50 backdrop-blur-sm py-3 px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Left Side - Navigation */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (pagination?.hasPreviousPage) {
                      onPageChange((pagination.page || 1) - 1)
                    }
                  }}
                  disabled={!pagination?.hasPreviousPage || isLoading}
                  className="h-8 px-2 sm:px-3"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                
                <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                  <span className="text-muted-foreground">Page</span>
                  <div className="px-1.5 sm:px-2 py-1 rounded-md bg-primary/10 text-primary font-medium text-xs sm:text-sm">
                    {isLoading ? '...' : (pagination?.page || 1)}
                  </div>
                  <span className="text-muted-foreground">of</span>
                  <span className="text-muted-foreground">{isLoading ? '...' : (pagination?.totalPages || 1)}</span>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (pagination?.hasNextPage) {
                      onPageChange((pagination.page || 1) + 1)
                    }
                  }}
                  disabled={!pagination?.hasNextPage || isLoading}
                  className="h-8 px-2 sm:px-3"
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Right Side - Rows and Records */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Select 
                    value={pagination?.pageSize?.toString() || "50"} 
                    onValueChange={onPageSizeChange} 
                    disabled={isLoading}
                  >
                    <SelectTrigger className="h-8 w-auto min-w-[90px] sm:min-w-[100px] text-xs sm:text-sm border-primary/20 bg-primary/10 text-primary font-medium hover:bg-primary/20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25 rows</SelectItem>
                      <SelectItem value="50">50 rows</SelectItem>
                      <SelectItem value="100">100 rows</SelectItem>
                      <SelectItem value="200">200 rows</SelectItem>
                      <SelectItem value="500">500 rows</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
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
      </motion.div>

      <QRCodeDisplayDialog
        open={qrDialogOpen}
        onOpenChange={setQrDialogOpen}
        assetTagId={selectedAssetTag}
      />
    </>
  )
}

