'use client'

import { useState } from 'react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Wrench, Clock, Plus, CheckCircle2, XCircle, List, MoreVertical, Eye, Trash2 } from 'lucide-react'
import { DashboardStats } from '@/types/dashboard'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { ScheduleDialog, scheduleTypeLabels } from '@/components/dialogs/schedule-dialog'
import { DeleteConfirmationDialog } from '@/components/dialogs/delete-confirmation-dialog'
import { type ScheduleFormData } from '@/lib/validations/schedule'
import { cn } from '@/lib/utils'

interface CalendarWidgetProps {
  data: DashboardStats['calendar'] | undefined
  isLoading: boolean
}

interface Schedule {
  id: string
  assetId: string
  scheduleType: string
  scheduledDate: string
  scheduledTime: string | null
  title: string
  notes: string | null
  status: string
  assignedTo: string | null
  location: string | null
  asset: {
    id: string
    assetTagId: string
    description: string
  }
}


// All scheduled events use purple color to match the legend
const getScheduleTypeColor = (): string => {
  return 'bg-purple-100 text-purple-800 dark:bg-purple-900/80 dark:text-purple-100'
}

// Get API base URL - use FastAPI if enabled
const getApiBaseUrl = () => {
  const useFastAPI = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true'
  const fastApiUrl = process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000'
  return useFastAPI ? fastApiUrl : ''
}

// Helper function to get auth token from Supabase session
async function getAuthToken(): Promise<string | null> {
  try {
    const supabase = (await import('@/lib/supabase-client')).createClient()
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) {
      console.error('Failed to get auth token:', error)
      return null
    }
    if (!session?.access_token) {
      return null
    }
    return session.access_token
  } catch (error) {
    console.error('Error getting auth token:', error)
    return null
  }
}

async function fetchSchedules(startDate: Date, endDate: Date): Promise<Schedule[]> {
  const startDateStr = format(startDate, 'yyyy-MM-dd')
  const endDateStr = format(endDate, 'yyyy-MM-dd')
  
  const baseUrl = getApiBaseUrl()
  const url = `${baseUrl}/api/assets/schedules?startDate=${startDateStr}&endDate=${endDateStr}`
  
  const token = await getAuthToken()
  const headers: HeadersInit = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  const response = await fetch(url, {
    headers,
    credentials: 'include',
  })
  
  if (!response.ok) {
    throw new Error('Failed to fetch schedules')
  }
  
  const data = await response.json()
  return data.schedules || []
}

async function createSchedule(data: ScheduleFormData): Promise<Schedule> {
  const baseUrl = getApiBaseUrl()
  const url = `${baseUrl}/api/assets/schedules`
  
  const token = await getAuthToken()
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({
      ...data,
      scheduledDate: format(data.scheduledDate, 'yyyy-MM-dd'),
    }),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || error.detail || 'Failed to create schedule')
  }
  
  const result = await response.json()
  return result.schedule
}

async function deleteSchedule(scheduleId: string): Promise<void> {
  const baseUrl = getApiBaseUrl()
  const url = `${baseUrl}/api/assets/schedules/${scheduleId}`
  
  const token = await getAuthToken()
  const headers: HeadersInit = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers,
    credentials: 'include',
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || error.detail || 'Failed to delete schedule')
  }
}

export function CalendarWidget({ data, isLoading }: CalendarWidgetProps) {
  const { resolvedTheme } = useTheme()
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false)
  const [scheduleDate, setScheduleDate] = useState<Date | null>(null)
  const [eventsPopoverOpen, setEventsPopoverOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)

  // Fetch schedules for the current month
  const { data: schedules = [] } = useQuery({
    queryKey: ['schedules', monthStart.toISOString(), monthEnd.toISOString()],
    queryFn: () => fetchSchedules(monthStart, monthEnd),
  })

  const createScheduleMutation = useMutation({
    mutationFn: createSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      toast.success('Schedule created successfully')
      setIsScheduleDialogOpen(false)
      setScheduleDate(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create schedule')
    },
  })

  // Update schedule status mutation
  const updateScheduleStatusMutation = useMutation({
    mutationFn: async ({ scheduleId, status }: { scheduleId: string; status: 'completed' | 'cancelled' }) => {
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/assets/schedules/${scheduleId}`
      
      const token = await getAuthToken()
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(url, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({ status }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || error.detail || 'Failed to update schedule')
      }
      
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      toast.success('Schedule updated successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update schedule')
    },
  })

  // Delete schedule mutation
  const deleteScheduleMutation = useMutation({
    mutationFn: deleteSchedule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] })
      toast.success('Schedule deleted successfully')
      setIsDeleteDialogOpen(false)
      setScheduleToDelete(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete schedule')
    },
  })

  const handleDeleteClick = (scheduleId: string) => {
    setScheduleToDelete(scheduleId)
    setIsDeleteDialogOpen(true)
  }

  const handleConfirmDelete = () => {
    if (scheduleToDelete) {
      deleteScheduleMutation.mutate(scheduleToDelete)
    }
  }

  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
  }

  const handleAddSchedule = (date: Date) => {
    setScheduleDate(date)
    setIsScheduleDialogOpen(true)
  }

  const handleSubmitSchedule = async (data: ScheduleFormData) => {
    await createScheduleMutation.mutateAsync(data)
  }

  if (isLoading) {
    return (
      <Card className="flex flex-col h-[500px] relative overflow-hidden !bg-transparent bg-[linear-gradient(135deg,rgba(255,255,255,0.15)_0%,rgba(255,255,255,0.08)_100%)] backdrop-blur-[20px] backdrop-saturate-[180%] rounded-[24px] border-[1px_solid_rgba(255,255,255,0.2)] shadow-[0_8px_32px_0_rgba(0,0,0,0.12),0_2px_8px_0_rgba(0,0,0,0.08),inset_0_1px_0_0_rgba(255,255,255,0.4),inset_0_-1px_0_0_rgba(255,255,255,0.15)]">
        {/* 3D Bubble Highlight - Top */}
        <div className="absolute top-0 left-0 right-0 h-1/2 pointer-events-none z-0 rounded-t-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.25)_0%,rgba(255,255,255,0)_100%)] opacity-60" />
        
        {/* Inner Shadow for Depth */}
        <div className="absolute inset-0 pointer-events-none z-0 rounded-[24px] shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.06)]" />
        
        <CardHeader className="relative z-10">
          <div className="h-6 w-1/2 bg-muted rounded mb-2" />
          <div className="h-4 w-1/3 bg-muted rounded" />
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center relative z-10">
          <Spinner className="h-8 w-8" />
        </CardContent>
      </Card>
    )
  }

  const leaseDates = new Set<string>()
  const maintenanceDates = new Set<string>()
  const eventsByDate = new Map<string, Array<{ 
    type: 'lease' | 'maintenance' | 'schedule'
    assetId: string
    assetTagId: string
    scheduleId?: string
    scheduleType?: string
    title?: string
    status?: string
  }>>()

  data?.leasesExpiring.forEach((lease) => {
    if (lease.leaseEndDate) {
      const dateStr = lease.leaseEndDate
      leaseDates.add(dateStr)
      if (!eventsByDate.has(dateStr)) eventsByDate.set(dateStr, [])
      eventsByDate.get(dateStr)!.push({
        type: 'lease',
        assetId: lease.asset.id,
        assetTagId: lease.asset.assetTagId,
      })
    }
  })

  data?.maintenanceDue.forEach((maintenance) => {
    if (maintenance.dueDate) {
      const dateStr = maintenance.dueDate
      maintenanceDates.add(dateStr)
      if (!eventsByDate.has(dateStr)) eventsByDate.set(dateStr, [])
      eventsByDate.get(dateStr)!.push({
        type: 'maintenance',
        assetId: maintenance.asset.id,
        assetTagId: maintenance.asset.assetTagId,
      })
    }
  })

  // Add schedules to events
  schedules.forEach((schedule) => {
    // Format the scheduledDate to match the date format used in the calendar (yyyy-MM-dd)
    const scheduleDate = new Date(schedule.scheduledDate)
    const dateStr = format(scheduleDate, 'yyyy-MM-dd')
    if (!eventsByDate.has(dateStr)) eventsByDate.set(dateStr, [])
    eventsByDate.get(dateStr)!.push({
      type: 'schedule',
      assetId: schedule.assetId,
      assetTagId: schedule.asset.assetTagId,
      scheduleId: schedule.id,
      scheduleType: schedule.scheduleType,
      title: schedule.title,
      status: schedule.status,
    })
  })

  const today = new Date()

  // Render Day View
  if (selectedDate) {
    const year = selectedDate.getFullYear()
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
    const day = String(selectedDate.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    const dayEvents = eventsByDate.get(dateStr) || []

    return (
      <>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="h-full"
      >
        <Card className="flex flex-col h-full min-h-[500px] relative overflow-hidden transition-all duration-300 group !bg-transparent bg-[linear-gradient(135deg,rgba(255,255,255,0.15)_0%,rgba(255,255,255,0.08)_100%)] backdrop-blur-[20px] backdrop-saturate-[180%] rounded-[24px] border-[1px_solid_rgba(255,255,255,0.2)] shadow-[0_8px_32px_0_rgba(0,0,0,0.12),0_2px_8px_0_rgba(0,0,0,0.08),inset_0_1px_0_0_rgba(255,255,255,0.4),inset_0_-1px_0_0_rgba(255,255,255,0.15)]">
          {/* 3D Bubble Highlight - Top */}
          <div className="absolute top-0 left-0 right-0 h-1/2 pointer-events-none z-0 rounded-t-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.25)_0%,rgba(255,255,255,0)_100%)] opacity-60" />
          
          {/* Inner Shadow for Depth */}
          <div className="absolute inset-0 pointer-events-none z-0 rounded-[24px] shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.06)]" />
          
          <CardHeader className="pb-4 border-b  relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedDate(null)}
                  className="h-8 w-8 rounded-full hover:bg-background"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div>
                  <CardTitle className="text-lg">
                    {format(selectedDate, 'MMMM d, yyyy')}
                  </CardTitle>
                  <CardDescription>
                    {format(selectedDate, 'EEEE')}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    const prevDay = new Date(selectedDate)
                    prevDay.setDate(prevDay.getDate() - 1)
                    setSelectedDate(prevDay)
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setSelectedDate(today)}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    const nextDay = new Date(selectedDate)
                    nextDay.setDate(nextDay.getDate() + 1)
                    setSelectedDate(nextDay)
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 gap-2"
                  onClick={() => {
                    setScheduleDate(selectedDate)
                    setIsScheduleDialogOpen(true)
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Add Schedule
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-4 relative z-10">
            {dayEvents.length > 0 ? (
              <div className="space-y-3">
                {dayEvents.map((event, idx) => (
                    <div
                    key={idx}
                    className="block"
                  >
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                        className={cn(
                          "flex items-start gap-3 sm:gap-4 p-3 sm:p-4 border rounded-lg transition-all hover:shadow-sm group",
                          event.type === 'schedule' && event.status === 'completed'
                            ? "bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900/50 opacity-75 hover:bg-green-50 dark:hover:bg-green-950/30"
                            : event.type === 'schedule' && event.status === 'cancelled'
                            ? "bg-gray-50/50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-900/50 opacity-60 hover:bg-gray-50 dark:hover:bg-gray-950/30"
                            : "hover:bg-accent/50 hover:border-primary/50"
                        )}
                    >
                        {/* Icon */}
                        <div className={cn(
                          "p-2.5 sm:p-2 rounded-lg shrink-0",
                        event.type === 'maintenance'
                          ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                            : event.type === 'schedule'
                            ? event.status === 'completed'
                              ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                              : event.status === 'cancelled'
                              ? 'bg-gray-100 text-gray-500 dark:bg-gray-900/30 dark:text-gray-500'
                              : 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                          : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                        )}>
                        {event.type === 'maintenance' ? <Wrench className="h-5 w-5 sm:h-4 sm:w-4" /> : <Clock className="h-5 w-5 sm:h-4 sm:w-4" />}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-1.5">
                          {/* Asset Tag ID and Badge */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={cn(
                              "font-semibold text-sm sm:text-base break-all",
                              event.type === 'schedule' && (event.status === 'completed' || event.status === 'cancelled')
                                ? "line-through opacity-70"
                                : ""
                            )}>
                          {event.assetTagId}
                            </span>
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-[10px] px-2 py-0.5 h-5 shrink-0",
                                event.type === 'schedule' && event.status === 'completed'
                                  ? "bg-green-100 text-green-900 border-green-400 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                                  : event.type === 'schedule' && event.status === 'cancelled'
                                  ? "bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-900/30 dark:text-gray-500 dark:border-gray-800"
                                  : event.type === 'schedule'
                                  ? 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800'
                                  : ""
                              )}
                            >
                              {event.type === 'maintenance' 
                                ? 'Maintenance' 
                                : event.type === 'schedule'
                                ? event.status === 'completed'
                                  ? '✓ Completed'
                                  : event.status === 'cancelled'
                                  ? '✕ Cancelled'
                                  : scheduleTypeLabels[event.scheduleType || ''] || 'Scheduled'
                                : 'Lease Expiring'}
                          </Badge>
                          </div>
                          
                          {/* Description */}
                          <div className={cn(
                            "text-xs sm:text-sm break-all",
                            event.type === 'schedule' && (event.status === 'completed' || event.status === 'cancelled')
                              ? "text-muted-foreground opacity-60"
                              : "text-muted-foreground"
                          )}>
                            {event.type === 'maintenance' 
                              ? 'Scheduled maintenance due' 
                              : event.type === 'schedule'
                              ? event.title || 'Scheduled operation'
                              : 'Lease contract expires'}
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 sm:h-8 sm:w-8 touch-manipulation"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                }}
                              >
                                <MoreVertical className="h-5 w-5 sm:h-4 sm:w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              {event.type === 'schedule' && event.scheduleId && (!event.status || event.status === 'pending') && (
                                <>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      if (event.scheduleId) {
                                        updateScheduleStatusMutation.mutate({ scheduleId: event.scheduleId, status: 'completed' })
                                      }
                                    }}
                                    disabled={updateScheduleStatusMutation.isPending}
                                  >
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Complete
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      if (event.scheduleId) {
                                        updateScheduleStatusMutation.mutate({ scheduleId: event.scheduleId, status: 'cancelled' })
                                      }
                                    }}
                                    disabled={updateScheduleStatusMutation.isPending}
                                  >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Cancel
                                  </DropdownMenuItem>
                                </>
                              )}
                              {event.type === 'schedule' && event.scheduleId && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    if (event.scheduleId) {
                                      handleDeleteClick(event.scheduleId)
                                    }
                                  }}
                                  disabled={deleteScheduleMutation.isPending}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/assets?search=${encodeURIComponent(event.assetTagId)}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  View
                                </Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </motion.div>
                      </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-12 text-muted-foreground">
                <CalendarIcon className="h-12 w-12 mb-4 opacity-20" />
                <p className="font-medium">No events scheduled</p>
                <p className="text-sm opacity-70 mt-1">
                    No maintenance, lease, or scheduled events for this date
                </p>
                  <Button
                    variant="outline"
                    className="mt-4 gap-2"
                    onClick={() => {
                      setScheduleDate(selectedDate)
                      setIsScheduleDialogOpen(true)
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Add Schedule
                  </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

        {/* Schedule Dialog - Included in Day View */}
        <ScheduleDialog
          open={isScheduleDialogOpen}
          onOpenChange={setIsScheduleDialogOpen}
          onSubmit={handleSubmitSchedule}
          isLoading={createScheduleMutation.isPending}
          defaultDate={scheduleDate}
        />

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmationDialog
          open={isDeleteDialogOpen}
          onOpenChange={(open) => {
            setIsDeleteDialogOpen(open)
            if (!open) {
              setScheduleToDelete(null)
            }
          }}
          onConfirm={handleConfirmDelete}
          title="Delete Schedule"
          description="Are you sure you want to delete this schedule? This action cannot be undone."
          isLoading={deleteScheduleMutation.isPending}
          confirmLabel="Delete Schedule"
          cancelLabel="Cancel"
        />
      </>
    )
  }

  // Render Month View
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startDayOfWeek = firstDay.getDay()
  
  const prevMonthLastDay = new Date(year, month, 0).getDate()
  const trailingDays = []
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    trailingDays.push(new Date(year, month - 1, prevMonthLastDay - i))
  }
  
  const currentMonthDays = []
  for (let i = 1; i <= daysInMonth; i++) {
    currentMonthDays.push(new Date(year, month, i))
  }
  
  const nextMonthDays = []
  const totalCells = trailingDays.length + currentMonthDays.length
  const remainingCells = 42 - totalCells
  for (let i = 1; i <= remainingCells; i++) {
    nextMonthDays.push(new Date(year, month + 1, i))
  }
  
  const allDays = [...trailingDays, ...currentMonthDays, ...nextMonthDays]

  // Collect all events for the current month view
  const allEventsList: Array<{
    date: string
    dateObj: Date
    events: Array<{
      type: 'lease' | 'maintenance' | 'schedule'
      assetId: string
      assetTagId: string
      scheduleId?: string
      scheduleType?: string
      title?: string
      status?: string
    }>
  }> = []
  
  allDays.forEach((date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    const events = eventsByDate.get(dateStr) || []
    
    if (events.length > 0) {
      allEventsList.push({
        date: dateStr,
        dateObj: date,
        events,
      })
    }
  })

  // Sort events by date
  allEventsList.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())

  // Filter events for current month only (for badge count)
  const currentMonthEvents = allEventsList.filter((item) => {
    return item.dateObj.getMonth() === currentMonth.getMonth() &&
           item.dateObj.getFullYear() === currentMonth.getFullYear()
  })

  const currentMonthEventCount = currentMonthEvents.reduce((sum, item) => sum + item.events.length, 0)

  return (
    <>
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="h-full"
    >
      <Card className="flex flex-col h-full min-h-[500px] relative overflow-hidden transition-all duration-300 group !bg-transparent bg-[linear-gradient(135deg,rgba(255,255,255,0.15)_0%,rgba(255,255,255,0.08)_100%)] backdrop-blur-[20px] backdrop-saturate-[180%] rounded-[24px] border-[1px_solid_rgba(255,255,255,0.2)] shadow-[0_8px_32px_0_rgba(0,0,0,0.12),0_2px_8px_0_rgba(0,0,0,0.08),inset_0_1px_0_0_rgba(255,255,255,0.4),inset_0_-1px_0_0_rgba(255,255,255,0.15)]">
        {/* 3D Bubble Highlight - Top */}
        <div className="absolute top-0 left-0 right-0 h-1/2 pointer-events-none z-0 rounded-t-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.25)_0%,rgba(255,255,255,0)_100%)] opacity-60" />
        
        {/* Inner Shadow for Depth */}
        <div className="absolute inset-0 pointer-events-none z-0 rounded-[24px] shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.06)]" />
        
        <CardHeader className="pb-4 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-primary" />
                Calendar
              </CardTitle>
              <CardDescription>
                  Lease expiries, maintenance, and scheduled operations
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center gap-1 bg-muted/30 flex-1 sm:flex-initial">
              <Button
                variant="ghost"
                size="icon"
                className="h-8"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium flex-1 text-center sm:min-w-[100px]">
                {format(currentMonth, 'MMMM yyyy')}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              </div>
              <Popover open={eventsPopoverOpen} onOpenChange={setEventsPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 sm:h-8 gap-2 flex-1 sm:flex-initial bg-gray-400 bg-clip-padding backdrop-filter backdrop-blur-md bg-opacity-10 border shadow-sm"
                  >
                    <List className="h-4 w-4" />
                    <span>Events</span>
                    {currentMonthEventCount > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-[10px] !bg-transparent bg-[linear-gradient(135deg,rgba(255,255,255,0.2)_0%,rgba(255,255,255,0.1)_100%)] backdrop-blur-md backdrop-saturate-150 border-[1px_solid_rgba(255,255,255,0.3)] shadow-[0_2px_8px_0_rgba(0,0,0,0.1),inset_0_1px_0_0_rgba(255,255,255,0.3)]">
                        {currentMonthEventCount}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  <div className="p-4 border-b border-white/20 dark:border-white/10">
                    <h4 className="font-semibold text-sm">All Events - {format(currentMonth, 'MMMM yyyy')}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {currentMonthEventCount} total events
                    </p>
                  </div>
                  <ScrollArea className="h-[400px]">
                    <div className="p-2">
                      {currentMonthEvents.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-20" />
                          <p>No events scheduled</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {currentMonthEvents.map((item) => (
                            <div key={item.date} className="space-y-1">
                              <div className="flex items-center gap-2 px-2 py-1">
                                <span className="text-xs font-semibold text-muted-foreground">
                                  {format(item.dateObj, 'MMM d, yyyy')}
                                </span>
                                <Badge variant="outline" className="h-4 text-[9px] px-1.5">
                                  {item.events.length} {item.events.length === 1 ? 'event' : 'events'}
                                </Badge>
                              </div>
                              <div className="space-y-1">
                                {item.events.map((event, idx) => (
                                  <div
                                    key={`${item.date}-${idx}`}
                                    className="flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 transition-colors group"
                                  >
                                    <Link
                                      href={`/assets?search=${encodeURIComponent(event.assetTagId)}`}
                                      onClick={() => setEventsPopoverOpen(false)}
                                      className="flex items-center gap-2 flex-1 min-w-0"
                                    >
                                      <div className={cn(
                                        "p-1.5 rounded-full",
                                        event.type === 'maintenance'
                                          ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                                          : event.type === 'schedule'
                                          ? event.status === 'completed'
                                            ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                                            : event.status === 'cancelled'
                                            ? 'bg-gray-100 text-gray-500 dark:bg-gray-900/30 dark:text-gray-500'
                                            : 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                                          : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                      )}>
                                        {event.type === 'maintenance' ? (
                                          <Wrench className="h-3 w-3" />
                                        ) : event.type === 'schedule' ? (
                                          <Clock className="h-3 w-3" />
                                        ) : (
                                          <CalendarIcon className="h-3 w-3" />
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm font-medium truncate">
                                            {event.assetTagId}
                                          </span>
                                          <Badge
                                            variant="outline"
                                            className={cn(
                                              "text-[9px] h-4",
                                              event.type === 'schedule' && event.status === 'completed'
                                                ? "bg-green-100 text-green-900 border-green-400 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                                                : event.type === 'schedule' && event.status === 'cancelled'
                                                ? "bg-slate-100 text-slate-700 border-slate-300 dark:bg-gray-900/30 dark:text-gray-500 dark:border-gray-800"
                                                : event.type === 'schedule'
                                                ? 'bg-purple-100 text-purple-900 border-purple-400 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800'
                                                : ""
                                            )}
                                          >
                                            {event.type === 'maintenance'
                                              ? 'Maintenance'
                                              : event.type === 'schedule'
                                              ? event.status === 'completed'
                                                ? '✓ Completed'
                                                : event.status === 'cancelled'
                                                ? '✕ Cancelled'
                                                : scheduleTypeLabels[event.scheduleType || ''] || 'Scheduled'
                                              : 'Lease Expiring'}
                                          </Badge>
                                        </div>
                                        {event.type === 'schedule' && event.title && (
                                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                                            {event.title}
                                          </p>
                                        )}
                                      </div>
                                    </Link>
                                    {event.type === 'schedule' && event.scheduleId && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                        onClick={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          if (event.scheduleId) {
                                            handleDeleteClick(event.scheduleId)
                                            setEventsPopoverOpen(false)
                                          }
                                        }}
                                        disabled={deleteScheduleMutation.isPending}
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                      </Button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0 relative z-10">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
              <div key={day} className="text-xs font-medium text-muted-foreground text-center py-2">
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1 flex-1 auto-rows-fr">
            {allDays.map((date, idx) => {
              const year = date.getFullYear()
              const month = String(date.getMonth() + 1).padStart(2, '0')
              const day = String(date.getDate()).padStart(2, '0')
              const dateStr = `${year}-${month}-${day}`
              const events = eventsByDate.get(dateStr) || []
              const isToday = format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
              const isCurrentMonth = date.getMonth() === currentMonth.getMonth()
              
              return (
                <motion.div
                  key={`${dateStr}-${idx}-${resolvedTheme}`}
                  whileHover={{ scale: 0.98, backgroundColor: "var(--accent)" }}
                    onClick={() => handleDateClick(date)}
                    className={cn(
                      "group/day-cell relative border rounded-md p-1 flex flex-col cursor-pointer transition-colors min-h-[80px]",
                      isCurrentMonth ? 'bg-accent hover:bg-accent/50' : 'bg-muted/20 opacity-50',
                      isToday && 'ring-2 ring-primary ring-inset'
                    )}
                >
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn(
                        "text-[10px] font-medium w-fit px-1 rounded",
                    isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                      )}>
                    {date.getDate()}
                  </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAddSchedule(date)
                        }}
                        className="opacity-0 group-hover/day-cell:opacity-100 hover:opacity-100 transition-opacity p-0.5 hover:bg-primary/10 rounded"
                        title="Add schedule"
                      >
                        <Plus className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </div>
                  
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    {events.slice(0, 2).map((event, eventIdx) => (
                      <div
                        key={eventIdx}
                        onClick={(e) => {
                          e.stopPropagation()
                        }}
                      >
                        <div
                            className={cn(
                              "text-[10px] h-4 px-1 py-0.5 w-full flex items-center rounded-sm",
                            event.type === 'maintenance'
                              ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/80 dark:text-orange-100'
                                : event.type === 'schedule'
                                ? event.status === 'completed'
                                  ? 'bg-green-100 text-green-900 dark:bg-green-900/50 dark:text-green-300 opacity-70 line-through'
                                  : event.status === 'cancelled'
                                  ? 'bg-gray-100 text-gray-500 dark:bg-gray-900/50 dark:text-gray-500 opacity-60 line-through'
                                  : getScheduleTypeColor()
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/80 dark:text-blue-100'
                            )}
                        >
                            <span className={cn(
                              "truncate font-medium",
                              event.type === 'schedule' && (event.status === 'completed' || event.status === 'cancelled')
                                ? "line-through"
                                : ""
                            )}>
                              {event.type === 'schedule' && event.status === 'completed'
                                ? `✓ ${event.assetTagId}`
                                : event.type === 'schedule' && event.status === 'cancelled'
                                ? `✕ ${event.assetTagId}`
                                : event.assetTagId}
                            </span>
                        </div>
                      </div>
                    ))}
                    {events.length > 2 && (
                      <div className="text-[9px] text-muted-foreground px-1">
                        +{events.length - 2} more
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>

          <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
             <div className="flex items-center gap-2">
                <div className="h-3 w-3 shrink-0 rounded-full bg-orange-400" />
                Maintenance
             </div>
             <div className="flex items-center gap-2">
                <div className="h-3 w-3 shrink-0 rounded-full bg-blue-400" />
                Lease Expiring
             </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 shrink-0 rounded-full bg-purple-400" />
                Scheduled
             </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>

      {/* Schedule Dialog */}
      <ScheduleDialog
        open={isScheduleDialogOpen}
        onOpenChange={setIsScheduleDialogOpen}
        onSubmit={handleSubmitSchedule}
        isLoading={createScheduleMutation.isPending}
        defaultDate={scheduleDate}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open)
          if (!open) {
            setScheduleToDelete(null)
          }
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Schedule"
        description="Are you sure you want to delete this schedule? This action cannot be undone."
        isLoading={deleteScheduleMutation.isPending}
        confirmLabel="Delete Schedule"
        cancelLabel="Cancel"
      />
    </>
  )
}
