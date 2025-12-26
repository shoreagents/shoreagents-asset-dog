'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { usePermissions } from '@/hooks/use-permissions'
import { useForm, Controller, useWatch, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { automatedReportScheduleSchema, type AutomatedReportScheduleFormData } from '@/lib/validations/automated-reports'
import { useMobileDock } from '@/components/mobile-dock-provider'
import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'

/**
 * Parse a datetime string as local time (not UTC).
 * The backend stores times in the configured local timezone, so we need to
 * interpret them as local time without any UTC conversion.
 */
function parseAsLocalTime(dateStr: string): Date {
  // Remove any Z suffix (UTC indicator) to prevent UTC conversion
  const cleanStr = dateStr.replace(/Z$/, '').replace(' ', 'T')
  
  // Parse the datetime parts manually to create a local date
  const [datePart, timePart] = cleanStr.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute, second = 0] = (timePart || '00:00:00').split(':').map(n => parseInt(n) || 0)
  
  // Create date in local timezone
  return new Date(year, month - 1, day, hour, minute, second)
}
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TimePicker } from '@/components/ui/time-picker'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Mail, 
  Clock, 
  FileText,
  Calendar,
  X,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'
import { DeleteConfirmationDialog } from '@/components/dialogs/delete-confirmation-dialog'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { format } from 'date-fns'
import { formatFrequencyDescription } from '@/lib/report-schedule-utils'
import { Suspense } from 'react'
import { AnimatePresence } from 'framer-motion'
import { AutomatedReportFilters } from '@/components/reports/automated-report-filters'
import { createClient } from '@/lib/supabase-client'

interface AutomatedReportSchedule {
  id: string
  reportName: string
  reportType: string
  frequency: string
  frequencyDay: number | null
  frequencyMonth: number | null
  scheduledTime: string
  emailRecipients: string[]
  filters: Record<string, unknown> | null
  format: string
  includeList: boolean
  isActive: boolean
  lastSentAt: string | null
  nextRunAt: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

const REPORT_TYPES = [
  { value: 'assets', label: 'Asset Reports' },
  { value: 'checkout', label: 'Checkout Reports' },
  { value: 'location', label: 'Location Reports' },
  { value: 'maintenance', label: 'Maintenance Reports' },
  { value: 'audit', label: 'Audit Reports' },
  { value: 'depreciation', label: 'Depreciation Reports' },
  { value: 'lease', label: 'Lease Reports' },
  { value: 'reservation', label: 'Reservation Reports' },
  { value: 'transaction', label: 'Transaction Reports' },
]

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
]

const FORMATS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'csv', label: 'CSV' },
  { value: 'excel', label: 'Excel' },
]

function AutomatedReportsPageContent() {
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canManageReports = hasPermission('canManageReports')
  const queryClient = useQueryClient()
  const isMobile = useIsMobile()
  const { setDockContent } = useMobileDock()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<AutomatedReportSchedule | null>(null)
  const [deleteScheduleId, setDeleteScheduleId] = useState<string | null>(null)
  const [emailInput, setEmailInput] = useState('')
  const [reportFilters, setReportFilters] = useState<Record<string, unknown>>({})

  // Helper functions for FastAPI
  const getApiBaseUrl = () => {
    const useFastAPI = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true'
    const fastApiUrl = process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000'
    return useFastAPI ? fastApiUrl : ''
  }

  const getAuthToken = async (): Promise<string | null> => {
    try {
      const supabase = createClient()
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) {
        console.error('Failed to get auth token:', error)
        return null
      }
      return session?.access_token || null
    } catch (error) {
      console.error('Error getting auth token:', error)
      return null
    }
  }

  const { data: schedules, isLoading, isFetching, error, refetch } = useQuery<{ schedules: AutomatedReportSchedule[] }>({
    queryKey: ['automated-reports'],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/reports/automated`
      
      const token = await getAuthToken()
      const headers: HeadersInit = {}
      if (baseUrl && token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(url, {
        credentials: 'include',
        headers,
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.detail || error.error || 'Failed to fetch schedules')
      }
      return response.json()
    },
    enabled: canManageReports, // Only fetch if user has permission
  })

  const form = useForm<AutomatedReportScheduleFormData>({
    resolver: zodResolver(automatedReportScheduleSchema),
    defaultValues: {
      reportName: '',
      reportType: '' as AutomatedReportScheduleFormData['reportType'],
      frequency: '' as AutomatedReportScheduleFormData['frequency'],
      frequencyDay: null,
      frequencyMonth: null,
      scheduledTime: '02:00',
      format: 'pdf' as AutomatedReportScheduleFormData['format'],
      includeList: true,
      emailRecipients: [],
    },
    mode: 'onSubmit', // Only validate when form is submitted
    reValidateMode: 'onBlur', // Re-validate on blur after first submit
    shouldUnregister: false, // Keep form state when dialog closes
  })

  const { register, handleSubmit, control, reset, setValue, clearErrors, formState: { errors } } = form
  
  // Use useWatch for reactive form field watching
  const frequency = useWatch({ control, name: 'frequency' })
  const reportType = useWatch({ control, name: 'reportType' })
  const emailRecipientsValue = useWatch({ control, name: 'emailRecipients' })
  const includeList = useWatch({ control, name: 'includeList' })
  const formEmailRecipients = useMemo(() => emailRecipientsValue || [], [emailRecipientsValue])

  const createMutation = useMutation({
    mutationFn: async (data: AutomatedReportScheduleFormData) => {
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/reports/automated`
      
      const token = await getAuthToken()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (baseUrl && token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          ...data,
        }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.detail || error.error || 'Failed to create schedule')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automated-reports'] })
      setIsDialogOpen(false)
      reset()
      setReportFilters({})
      toast.success('Automated report schedule created successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { 
      id: string
      data: Partial<AutomatedReportScheduleFormData> & { isActive?: boolean }
    }) => {
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/reports/automated/${id}`
      
      const token = await getAuthToken()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (baseUrl && token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(url, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          ...data,
          filters: reportFilters,
        }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.detail || error.error || 'Failed to update schedule')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automated-reports'] })
      setIsDialogOpen(false)
      setEditingSchedule(null)
      reset()
      setReportFilters({})
      toast.success('Automated report schedule updated successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/reports/automated/${id}`
      
      const token = await getAuthToken()
      const headers: HeadersInit = {}
      if (baseUrl && token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(url, {
        method: 'DELETE',
        credentials: 'include',
        headers,
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.detail || error.error || 'Failed to delete schedule')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automated-reports'] })
      setDeleteScheduleId(null)
      toast.success('Automated report schedule deleted successfully')
    },
    onError: () => {
      toast.error('Failed to delete schedule')
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/reports/automated/${id}`
      
      const token = await getAuthToken()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (baseUrl && token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(url, {
        method: 'PUT',
        headers,
        credentials: 'include',
        body: JSON.stringify({ isActive }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.detail || error.error || 'Failed to update schedule')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automated-reports'] })
      toast.success('Schedule status updated')
    },
    onError: () => {
      toast.error('Failed to update schedule')
    },
  })

  const handleOpenDialog = useCallback((schedule?: AutomatedReportSchedule) => {
    if (schedule) {
      setEditingSchedule(schedule)
      reset({
        reportName: schedule.reportName,
        reportType: schedule.reportType as AutomatedReportScheduleFormData['reportType'],
        frequency: schedule.frequency as AutomatedReportScheduleFormData['frequency'],
        frequencyDay: schedule.frequencyDay,
        frequencyMonth: schedule.frequencyMonth,
        scheduledTime: schedule.scheduledTime,
        format: schedule.format as AutomatedReportScheduleFormData['format'],
        includeList: schedule.includeList,
        emailRecipients: schedule.emailRecipients || [], // Set email recipients from schedule
      }, { keepErrors: false }) // Clear errors when opening dialog
      setReportFilters(schedule.filters || {})
    } else {
      setEditingSchedule(null)
      reset(undefined, { keepErrors: false }) // Clear errors and reset to default values
      setReportFilters({})
    }
    setIsDialogOpen(true)
  }, [reset])

  const handleCloseDialog = useCallback(() => {
    setIsDialogOpen(false)
    setEditingSchedule(null)
    // Reset form to default values when closing
    reset({
      reportName: '',
      reportType: '' as AutomatedReportScheduleFormData['reportType'],
      frequency: '' as AutomatedReportScheduleFormData['frequency'],
      frequencyDay: null,
      frequencyMonth: null,
      scheduledTime: '02:00',
      format: 'pdf' as AutomatedReportScheduleFormData['format'],
      includeList: true,
      emailRecipients: [],
    }, { keepErrors: false, keepDefaultValues: false })
    setReportFilters({})
    setEmailInput('')
  }, [reset])

  const onSubmit: SubmitHandler<AutomatedReportScheduleFormData> = useCallback((data) => {
    // Ensure scheduledTime is set (defaults to '02:00')
    const formData = {
      ...data,
      scheduledTime: data.scheduledTime || '02:00',
    }

    if (editingSchedule) {
      updateMutation.mutate({ id: editingSchedule.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }, [editingSchedule, createMutation, updateMutation])

  const handleAddEmail = useCallback(() => {
    const email = emailInput.trim()
    if (!email) return
    
    // Check if email already exists
    if (formEmailRecipients.includes(email)) {
      // Add duplicate to trigger Zod validation error
      const withDuplicate = [...formEmailRecipients, email]
      setValue('emailRecipients', withDuplicate, { shouldValidate: true })
      return
    }
    
    // Add email to form
    const updatedRecipients = [...formEmailRecipients, email]
    setValue('emailRecipients', updatedRecipients, { shouldValidate: true })
    setEmailInput('')
    // Clear errors if validation passes
    clearErrors('emailRecipients')
  }, [emailInput, formEmailRecipients, setValue, clearErrors])

  const handleRemoveEmail = useCallback((email: string) => {
    const updatedRecipients = formEmailRecipients.filter(e => e !== email)
    setValue('emailRecipients', updatedRecipients, { shouldValidate: true })
  }, [formEmailRecipients, setValue])

  // Set mobile dock content
  useEffect(() => {
    if (isMobile) {
      setDockContent(
        <>
          <Button 
            onClick={() => handleOpenDialog()} 
            className="h-10 px-4 rounded-full btn-glass-elevated"
            disabled={!canManageReports}
            variant="outline"
          >
            Create Schedule
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isLoading}
            className="h-10 w-10 rounded-full btn-glass-elevated"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading || isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </>
      )
    } else {
      setDockContent(null)
    }
    
    return () => {
      setDockContent(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, isLoading, isFetching, canManageReports])

  return (
    <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold">Automated Reports</h1>
            <p className="text-muted-foreground mt-1">
              Schedule reports to be automatically generated and delivered via email
            </p>
          </div>
          <div className={cn("flex items-center gap-2", isMobile && "hidden")}>
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button 
                onClick={() => handleOpenDialog()} 
                className="gap-2 bg-gray-400 bg-clip-padding backdrop-filter backdrop-blur-md bg-opacity-10 border shadow-sm"
                disabled={!canManageReports}
                variant="outline"
                size="sm"
              >
                <Plus className="h-4 w-4" />
                Create Schedule
              </Button>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                variant="outline"
                size="icon"
                onClick={() => refetch()}
                disabled={isLoading}
                className="h-8 w-8 bg-gray-400 bg-clip-padding backdrop-filter backdrop-blur-md bg-opacity-10 border shadow-sm"
                title="Refresh table"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading || isFetching ? 'animate-spin' : ''}`} />
              </Button>
            </motion.div>
          </div>
        </motion.div>

        {/* Scheduled Reports Table */}
        <AnimatePresence mode="wait">
          {permissionsLoading || (isLoading && !schedules) ? (
            // Initial loading state for permissions or data
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-sm backdrop-saturate-150">
                <CardHeader>
                  <CardTitle>Scheduled Reports</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <Spinner className="h-8 w-8" />
                      <p className="text-sm text-muted-foreground">Loading...</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : !canManageReports ? (
            // Access denied state - only show when permissions are done loading
            <motion.div
              key="access-denied"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-sm backdrop-saturate-150">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
                    <p className="text-muted-foreground">You do not have permission to manage automated reports</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : error ? (
            // Error state
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card className="bg-destructive/10 border-destructive/20">
                <CardContent className="pt-6">
                  <div className="text-center text-destructive">
                    <p className="font-medium">Failed to load automated reports</p>
                    <p className="text-sm mt-1">Please try again or check your connection</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            // Content
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-sm backdrop-saturate-150">
                <CardHeader>
                  <CardTitle>Scheduled Reports</CardTitle>
                </CardHeader>
                <CardContent>
                  {schedules?.schedules.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No automated report schedules found.</p>
                      <p className="text-sm mt-2">Create your first schedule to get started.</p>
                    </div>
                  ) : (
                    <>
                      {/* Desktop Table View */}
                      <div className={cn("", isMobile && "hidden")}>
                        <ScrollArea className="w-full h-128">
                          <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Report Name</TableHead>
                              <TableHead>Report Type</TableHead>
                              <TableHead>Frequency</TableHead>
                              <TableHead>Recipients</TableHead>
                              <TableHead>Format</TableHead>
                              <TableHead>Next Run</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {schedules?.schedules.map((schedule) => (
                              <TableRow key={schedule.id}>
                                <TableCell className="font-medium">{schedule.reportName}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    {REPORT_TYPES.find(t => t.value === schedule.reportType)?.label || schedule.reportType}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">
                                      {formatFrequencyDescription({
                                        frequency: schedule.frequency,
                                        frequencyDay: schedule.frequencyDay,
                                        frequencyMonth: schedule.frequencyMonth,
                                        scheduledTime: schedule.scheduledTime,
                                      })}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button className="flex items-center gap-2 hover:text-primary transition-colors cursor-pointer">
                                        <Mail className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm">{schedule.emailRecipients.length} recipient(s)</span>
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto max-w-[300px]" align="start">
                                      <div className="space-y-2">
                                        <h4 className="text-sm font-semibold">Email Recipients</h4>
                                        <div className="flex flex-col gap-1">
                                          {schedule.emailRecipients.map((email, index) => (
                                            <div key={index} className="text-sm text-muted-foreground">
                                              {email}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary">{schedule.format.toUpperCase()}</Badge>
                                </TableCell>
                                <TableCell>
                                  {schedule.nextRunAt ? (
                                    <div className="flex items-center gap-2">
                                      <Calendar className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-sm">
                                        {format(parseAsLocalTime(schedule.nextRunAt), 'MMM d, yyyy h:mm a')}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">Not scheduled</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={schedule.isActive ? 'default' : 'destructive'}>
                                    {schedule.isActive ? 'Active' : 'Inactive'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-3">
                                    <Switch
                                      checked={schedule.isActive}
                                      onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: schedule.id, isActive: checked })}
                                      disabled={toggleActiveMutation.isPending}
                                      loading={toggleActiveMutation.isPending}
                                    />
                                    <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleOpenDialog(schedule)}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                    </motion.div>
                                    <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setDeleteScheduleId(schedule.id)}
                                      >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </motion.div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                          <ScrollBar orientation="horizontal" />
                        </ScrollArea>
                      </div>

                      {/* Mobile Card View */}
                      <div className={cn("hidden", isMobile && "flex flex-col gap-4")}>
                        {schedules?.schedules.map((schedule) => (
                          <Card key={schedule.id} className="bg-white/5 dark:bg-white/5 border border-white/20 dark:border-white/10">
                            <CardContent className="p-4 space-y-3">
                              {/* Header: Name and Switch */}
                              <div className="flex items-center justify-between gap-2">
                                <h3 className="font-semibold text-base truncate flex-1">{schedule.reportName}</h3>
                                <Switch
                                  checked={schedule.isActive}
                                  onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: schedule.id, isActive: checked })}
                                  disabled={toggleActiveMutation.isPending}
                                  loading={toggleActiveMutation.isPending}
                                />
                              </div>

                              {/* Info Grid */}
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <span className="text-muted-foreground text-xs">Report Type</span>
                                  <div className="mt-0.5">
                                    <Badge variant="outline">
                                      {REPORT_TYPES.find(t => t.value === schedule.reportType)?.label || schedule.reportType}
                                    </Badge>
                                  </div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground text-xs">Status</span>
                                  <div className="mt-0.5">
                                    <Badge variant={schedule.isActive ? 'default' : 'destructive'}>
                                      {schedule.isActive ? 'Active' : 'Inactive'}
                                    </Badge>
                                  </div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground text-xs">Frequency</span>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-xs">
                                      {formatFrequencyDescription({
                                        frequency: schedule.frequency,
                                        frequencyDay: schedule.frequencyDay,
                                        frequencyMonth: schedule.frequencyMonth,
                                        scheduledTime: schedule.scheduledTime,
                                      })}
                                    </span>
                                  </div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground text-xs">Format</span>
                                  <div className="mt-0.5">
                                    <Badge variant="secondary" className="text-xs">{schedule.format.toUpperCase()}</Badge>
                                  </div>
                                </div>
                                <div>
                                  <span className="text-muted-foreground text-xs">Recipients</span>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button className="flex items-center gap-1.5 mt-0.5 hover:text-primary transition-colors cursor-pointer">
                                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-xs">{schedule.emailRecipients.length} recipient(s)</span>
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto max-w-[280px]" align="start">
                                      <div className="space-y-2">
                                        <h4 className="text-sm font-semibold">Email Recipients</h4>
                                        <div className="flex flex-col gap-1">
                                          {schedule.emailRecipients.map((email, index) => (
                                            <div key={index} className="text-sm text-muted-foreground break-all">
                                              {email}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                </div>
                                <div>
                                  <span className="text-muted-foreground text-xs">Next Run</span>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    {schedule.nextRunAt ? (
                                      <>
                                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-xs">
                                          {format(parseAsLocalTime(schedule.nextRunAt), 'MMM d, h:mm a')}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">Not scheduled</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center justify-end gap-1 pt-2 border-t border-white/10">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenDialog(schedule)}
                                  className="h-8 px-2"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteScheduleId(schedule.id)}
                                  className="h-8 px-2"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </>
                  )}
          </CardContent>
        </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!open) {
            handleCloseDialog()
          } else {
            setIsDialogOpen(true)
          }
        }}>
          <DialogContent className="max-w-2xl! max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingSchedule ? 'Edit Automated Report Schedule' : 'Create Automated Report Schedule'}
              </DialogTitle>
              <DialogDescription>
                Configure a report to be automatically generated and sent via email on a schedule.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reportName">Report Name *</Label>
                <Input
                  id="reportName"
                  {...register('reportName')}
                  placeholder="e.g., Weekly Checkout Report"
                  className={errors.reportName ? 'border-destructive' : ''}
                />
                {errors.reportName && (
                  <p className="text-sm text-destructive">{errors.reportName.message}</p>
                )}
              </div>

              <div className="flex items-end gap-4">
                <div className="space-y-2 flex-1">
                  <Label htmlFor="reportType">Report Type *</Label>
                  <Controller
                    name="reportType"
                    control={control}
                    render={({ field }) => (
                      <div>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value)
                            // Clear the error when a value is selected
                            if (errors.reportType) {
                              clearErrors('reportType')
                            }
                          }} 
                          value={field.value || undefined}
                        >
                          <SelectTrigger className={errors.reportType ? 'border-destructive' : ''}>
                            <SelectValue placeholder="Select report type" />
                          </SelectTrigger>
                          <SelectContent>
                            {REPORT_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.reportType && (
                          <p className="text-sm text-destructive mt-1">{errors.reportType.message}</p>
                        )}
                      </div>
                    )}
                  />
                </div>

                {/* Report Filters */}
                {reportType && (
                  <div className="pb-0">
                    <AutomatedReportFilters
                      reportType={reportType}
                      filters={reportFilters}
                      onFiltersChange={setReportFilters}
                      disabled={false}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="frequency">Frequency *</Label>
                  <Controller
                    name="frequency"
                    control={control}
                    render={({ field }) => (
                      <div>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value)
                            // Clear the error when a value is selected
                            if (errors.frequency) {
                              clearErrors('frequency')
                            }
                          }} 
                          value={field.value || undefined}
                        >
                          <SelectTrigger className={errors.frequency ? 'border-destructive' : ''}>
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                          <SelectContent>
                            {FREQUENCIES.map((freq) => (
                              <SelectItem key={freq.value} value={freq.value}>
                                {freq.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.frequency && (
                          <p className="text-sm text-destructive mt-1">{errors.frequency.message}</p>
                        )}
                      </div>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Controller
                    name="scheduledTime"
                    control={control}
                    render={({ field, fieldState }) => (
                      <TimePicker
                        id="scheduledTime"
                        label="Time (24-hour) *"
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        placeholder="Select time"
                        error={fieldState.error?.message}
                        showSeconds={false}
                      />
                    )}
                  />
                </div>
              </div>

              {frequency === 'weekly' && (
                <div className="space-y-2">
                  <Label htmlFor="frequencyDay">Day of Week</Label>
                  <Controller
                    name="frequencyDay"
                    control={control}
                    render={({ field }) => (
                      <div>
                        <Select
                          onValueChange={(value) => field.onChange(parseInt(value))}
                          value={field.value?.toString()}
                        >
                          <SelectTrigger className={errors.frequencyDay ? 'border-destructive' : ''}>
                            <SelectValue placeholder="Select day" />
                          </SelectTrigger>
                          <SelectContent>
                            {DAYS_OF_WEEK.map((day) => (
                              <SelectItem key={day.value} value={day.value.toString()}>
                                {day.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.frequencyDay && (
                          <p className="text-sm text-destructive mt-1">{errors.frequencyDay.message}</p>
                        )}
                      </div>
                    )}
                  />
                </div>
              )}

              {frequency === 'monthly' && (
                <div className="space-y-2">
                  <Label htmlFor="frequencyDay">Day of Month (1-31)</Label>
                  <Input
                    id="frequencyDay"
                    type="number"
                    min="1"
                    max="31"
                    {...register('frequencyDay', { valueAsNumber: true })}
                    className={errors.frequencyDay ? 'border-destructive' : ''}
                  />
                  {errors.frequencyDay && (
                    <p className="text-sm text-destructive">{errors.frequencyDay.message}</p>
                  )}
                </div>
              )}

              {frequency === 'yearly' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="frequencyMonth">Month</Label>
                    <Controller
                      name="frequencyMonth"
                      control={control}
                      render={({ field }) => (
                        <div>
                          <Select
                            onValueChange={(value) => field.onChange(parseInt(value))}
                            value={field.value?.toString()}
                          >
                            <SelectTrigger className={errors.frequencyMonth ? 'border-destructive' : ''}>
                              <SelectValue placeholder="Select month" />
                            </SelectTrigger>
                            <SelectContent>
                              {MONTHS.map((month) => (
                                <SelectItem key={month.value} value={month.value.toString()}>
                                  {month.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {errors.frequencyMonth && (
                            <p className="text-sm text-destructive mt-1">{errors.frequencyMonth.message}</p>
                          )}
                        </div>
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="frequencyDay">Day of Month (1-31)</Label>
                    <Input
                      id="frequencyDay"
                      type="number"
                      min="1"
                      max="31"
                      {...register('frequencyDay', { valueAsNumber: true })}
                      className={errors.frequencyDay ? 'border-destructive' : ''}
                    />
                    {errors.frequencyDay && (
                      <p className="text-sm text-destructive">{errors.frequencyDay.message}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="emailRecipients">Email Recipients *</Label>
                <div className="flex gap-2">
                  <Input
                    id="emailRecipients"
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddEmail()
                      }
                    }}
                    placeholder="Enter email address"
                    className={errors.emailRecipients ? 'border-destructive' : ''}
                  />
                  <Button type="button" onClick={handleAddEmail} variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {formEmailRecipients.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formEmailRecipients.map((email) => (
                      <Badge key={email} variant="secondary" className="gap-1">
                        {email}
                        <button
                          type="button"
                          onClick={() => handleRemoveEmail(email)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                {errors.emailRecipients && (
                  <p className="text-sm text-destructive mt-1">{errors.emailRecipients.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="format">Format</Label>
                  <Controller
                    name="format"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FORMATS.map((format) => (
                            <SelectItem key={format.value} value={format.value}>
                              {format.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-2 flex justify-end items-end">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeList"
                      {...register('includeList')}
                      checked={includeList}
                      onCheckedChange={(checked) => setValue('includeList', checked as boolean)}
                    />
                    <Label htmlFor="includeList" className="cursor-pointer">
                      Include detailed list (PDF only)
                    </Label>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) && <Spinner className="mr-2 h-4 w-4" />}
                  {editingSchedule 
                    ? (updateMutation.isPending ? 'Updating...' : 'Update')
                    : (createMutation.isPending ? 'Creating...' : 'Create')
                  }
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <DeleteConfirmationDialog
          open={deleteScheduleId !== null}
          onOpenChange={(open) => !open && setDeleteScheduleId(null)}
          onConfirm={() => {
            if (deleteScheduleId) {
              deleteMutation.mutate(deleteScheduleId)
            }
          }}
          title="Delete Automated Report Schedule"
          description="Are you sure you want to delete this schedule? This action cannot be undone."
          isLoading={deleteMutation.isPending}
        />
      </div>
  )
}

export default function AutomatedReportsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    }>
      <AutomatedReportsPageContent />
    </Suspense>
  )
}

