'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { usePermissions } from '@/hooks/use-permissions'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { automatedReportScheduleSchema, type AutomatedReportScheduleFormData } from '@/lib/validations/automated-reports'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Mail, 
  Clock, 
  FileText,
  Calendar,
  ToggleLeft,
  ToggleRight,
  Play,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { DeleteConfirmationDialog } from '@/components/dialogs/delete-confirmation-dialog'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { format } from 'date-fns'
import { formatFrequencyDescription } from '@/lib/report-schedule-utils'
import { Suspense } from 'react'
import { AutomatedReportFilters } from '@/components/reports/automated-report-filters'

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
  const { hasPermission } = usePermissions()
  const queryClient = useQueryClient()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<AutomatedReportSchedule | null>(null)
  const [deleteScheduleId, setDeleteScheduleId] = useState<string | null>(null)
  const [emailInput, setEmailInput] = useState('')
  const [emailRecipients, setEmailRecipients] = useState<string[]>([])
  const [reportFilters, setReportFilters] = useState<Record<string, unknown>>({})

  const { data: schedules, isLoading } = useQuery<{ schedules: AutomatedReportSchedule[] }>({
    queryKey: ['automated-reports'],
    queryFn: async () => {
      const response = await fetch('/api/reports/automated')
      if (!response.ok) throw new Error('Failed to fetch schedules')
      return response.json()
    },
  })

  const form = useForm<AutomatedReportScheduleFormData>({
    resolver: zodResolver(automatedReportScheduleSchema),
    defaultValues: {
      reportName: '',
      reportType: '' as AutomatedReportScheduleFormData['reportType'],
      frequency: '' as AutomatedReportScheduleFormData['frequency'],
      frequencyDay: null,
      frequencyMonth: null,
      scheduledTime: '09:00',
      format: 'pdf' as AutomatedReportScheduleFormData['format'],
      includeList: true,
    },
    mode: 'onBlur', // Only validate on blur to prevent immediate errors on empty fields
  })

  const { register, handleSubmit, control, reset, watch, setValue, formState: { errors } } = form
  const frequency = watch('frequency')
  const reportType = watch('reportType')

  const createMutation = useMutation({
    mutationFn: async (data: AutomatedReportScheduleFormData) => {
      const response = await fetch('/api/reports/automated', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          emailRecipients,
        }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create schedule')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automated-reports'] })
      setIsDialogOpen(false)
      reset()
      setEmailRecipients([])
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
      const response = await fetch(`/api/reports/automated/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          emailRecipients,
          filters: reportFilters,
        }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update schedule')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automated-reports'] })
      setIsDialogOpen(false)
      setEditingSchedule(null)
      reset()
      setEmailRecipients([])
      setReportFilters({})
      toast.success('Automated report schedule updated successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/reports/automated/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete schedule')
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
      const response = await fetch(`/api/reports/automated/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })
      if (!response.ok) throw new Error('Failed to update schedule')
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

  const testEmailMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/reports/automated/${id}/test`, {
        method: 'POST',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to send test email')
      }
      return response.json()
    },
    onSuccess: () => {
      toast.success('Test email sent successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message)
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
      })
      setEmailRecipients([...schedule.emailRecipients])
    } else {
      setEditingSchedule(null)
      reset()
      setEmailRecipients([])
      setReportFilters({})
    }
    setIsDialogOpen(true)
  }, [reset])

  const handleCloseDialog = useCallback(() => {
    setIsDialogOpen(false)
    setEditingSchedule(null)
    reset()
    setEmailRecipients([])
  }, [reset])

  const onSubmit = useCallback((data: AutomatedReportScheduleFormData) => {
    // Validate email recipients
    if (emailRecipients.length === 0) {
      toast.error('Please add at least one email recipient')
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const invalidEmails = emailRecipients.filter(email => !emailRegex.test(email))
    if (invalidEmails.length > 0) {
      toast.error(`Invalid email address(es): ${invalidEmails.join(', ')}`)
      return
    }

    if (editingSchedule) {
      updateMutation.mutate({ id: editingSchedule.id, data })
    } else {
      createMutation.mutate(data)
    }
  }, [emailRecipients, editingSchedule, createMutation, updateMutation])

  const handleAddEmail = useCallback(() => {
    const email = emailInput.trim()
    if (!email) return
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast.error('Invalid email address')
      return
    }
    
    if (emailRecipients.includes(email)) {
      toast.error('Email already added')
      return
    }
    
    setEmailRecipients([...emailRecipients, email])
    setEmailInput('')
  }, [emailInput, emailRecipients])

  const handleRemoveEmail = useCallback((email: string) => {
    setEmailRecipients(emailRecipients.filter(e => e !== email))
  }, [emailRecipients])

  if (!hasPermission('canManageReports')) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-2xl border border-white/30 dark:border-white/10">
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">You don&apos;t have permission to manage automated reports.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

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
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Button 
              onClick={() => handleOpenDialog()} 
              className="gap-2 bg-gray-400 bg-clip-padding backdrop-filter backdrop-blur-md bg-opacity-10 border shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Create Schedule
            </Button>
          </motion.div>
        </motion.div>

        {/* Scheduled Reports Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-sm backdrop-saturate-150">
          <CardHeader>
            <CardTitle>Scheduled Reports</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Spinner />
              </div>
            ) : schedules?.schedules.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No automated report schedules found.</p>
                <p className="text-sm mt-2">Create your first schedule to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
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
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{schedule.emailRecipients.length} recipient(s)</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{schedule.format.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell>
                          {schedule.nextRunAt ? (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">
                                {format(new Date(schedule.nextRunAt), 'MMM d, yyyy HH:mm')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Not scheduled</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={schedule.isActive ? 'default' : 'secondary'}>
                            {schedule.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleActiveMutation.mutate({ id: schedule.id, isActive: !schedule.isActive })}
                                disabled={toggleActiveMutation.isPending}
                              >
                                {schedule.isActive ? (
                                  <ToggleRight className="h-4 w-4" />
                                ) : (
                                  <ToggleLeft className="h-4 w-4" />
                                )}
                              </Button>
                            </motion.div>
                            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => testEmailMutation.mutate(schedule.id)}
                                disabled={testEmailMutation.isPending}
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                            </motion.div>
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
              </div>
            )}
          </CardContent>
        </Card>
        </motion.div>

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

              <div className="space-y-2">
                <Label htmlFor="reportType">Report Type *</Label>
                <Controller
                  name="reportType"
                  control={control}
                  render={({ field }) => (
                    <div>
                      <Select onValueChange={field.onChange} value={field.value}>
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
                <AutomatedReportFilters
                  reportType={reportType}
                  filters={reportFilters}
                  onFiltersChange={setReportFilters}
                  disabled={false}
                />
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="frequency">Frequency *</Label>
                  <Controller
                    name="frequency"
                    control={control}
                    render={({ field }) => (
                      <div>
                        <Select onValueChange={field.onChange} value={field.value}>
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
                  <Label htmlFor="scheduledTime">Time *</Label>
                  <Input
                    id="scheduledTime"
                    type="time"
                    {...register('scheduledTime')}
                    className={errors.scheduledTime ? 'border-destructive' : ''}
                  />
                  {errors.scheduledTime && (
                    <p className="text-sm text-destructive">{errors.scheduledTime.message}</p>
                  )}
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
                  />
                  <Button type="button" onClick={handleAddEmail}>
                    Add
                  </Button>
                </div>
                {emailRecipients.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {emailRecipients.map((email) => (
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

                <div className="space-y-2 flex items-end">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeList"
                      {...register('includeList')}
                      checked={watch('includeList')}
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
                  {(createMutation.isPending || updateMutation.isPending) && <Spinner className="mr-2" />}
                  {editingSchedule ? 'Update' : 'Create'}
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

