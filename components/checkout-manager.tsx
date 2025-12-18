'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useAllEmployees } from '@/hooks/use-employees'
import { createClient } from '@/lib/supabase-client'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { UserPlus, X, Check, History, Save, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { cn } from '@/lib/utils'

interface CheckoutManagerProps {
  assetId: string
  assetTagId: string
  assetStatus?: string // Asset status to check if reserved
  invalidateQueryKey?: string[] // Optional query key to invalidate after updates
  readOnly?: boolean // If true, disable editing functionality
  open?: boolean // Control dialog visibility
  onOpenChange?: (open: boolean) => void // Handle dialog open/close
}

export function CheckoutManager({ assetId, assetStatus, invalidateQueryKey = ['assets'], readOnly = false, open, onOpenChange }: CheckoutManagerProps) {
  const queryClient = useQueryClient()
  const [editingCheckoutId, setEditingCheckoutId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'assign' | 'history'>('assign')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [isCommandOpen, setIsCommandOpen] = useState(false)

  // Fetch checkout records
  const { data: checkoutData, isLoading: isLoadingCheckouts } = useQuery({
    queryKey: ['checkoutHistory', assetId],
    queryFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
        ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
        : ''
      const url = `${baseUrl}/api/assets/${assetId}/checkout`
      
      // Get auth token
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = {}
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      
      const response = await fetch(url, {
        credentials: 'include',
        headers,
      })
      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = 'Failed to fetch checkout history'
        try {
          const error = JSON.parse(errorText)
          errorMessage = error.detail || error.error || errorMessage
        } catch {
          errorMessage = errorText || errorMessage
        }
        throw new Error(errorMessage)
      }
      return response.json()
    },
    enabled: true,
    refetchOnMount: true,
    staleTime: 0, // Always consider stale to force refetch
  })

  const checkouts = checkoutData?.checkouts || []

  // Fetch reservations for this asset
  const { data: reservationData, isLoading: isLoadingReservations } = useQuery({
    queryKey: ['reservations', assetId],
    queryFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
        ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
        : ''
      const url = `${baseUrl}/api/assets/reserve?assetId=${assetId}`
      
      // Get auth token
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = {}
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      
      const response = await fetch(url, {
        credentials: 'include',
        headers,
      })
      if (!response.ok) throw new Error('Failed to fetch reservations')
      return response.json()
    },
    enabled: true,
    refetchOnMount: true,
    staleTime: 0,
  })

  const reservations = reservationData?.reservations || []
  // Get the most recent active reservation (Employee type)
  const activeReservation = reservations.find((r: { reservationType: string; employeeUserId: string | null }) => 
    r.reservationType === 'Employee' && r.employeeUserId
  )

  // Fetch employees - fetch all pages to get complete list
  const { data: employees = [] } = useAllEmployees(true)

  // Update checkout mutation
  const updateMutation = useMutation({
    mutationFn: async ({ checkoutId, employeeUserId }: { checkoutId: string; employeeUserId: string | null }) => {
      const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
        ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
        : ''
      const url = `${baseUrl}/api/assets/checkout/${checkoutId}`
      
      // Get auth token
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      
      const response = await fetch(url, {
        method: 'PATCH',
        credentials: 'include',
        headers,
        body: JSON.stringify({ employeeUserId }),
      })
      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = 'Failed to update checkout'
        try {
          const error = JSON.parse(errorText)
          errorMessage = error.detail || error.error || errorMessage
        } catch {
          errorMessage = errorText || errorMessage
        }
        throw new Error(errorMessage)
      }
      return response.json()
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['checkoutHistory', assetId] })
      queryClient.invalidateQueries({ queryKey: ['historyLogs', assetId] })
      queryClient.invalidateQueries({ queryKey: ['reservations', assetId] })
      // Invalidate the provided query key or default to 'assets'
      queryClient.invalidateQueries({ queryKey: invalidateQueryKey })
      // Refetch history immediately if dialog is still open
      if (open) {
        await queryClient.refetchQueries({ queryKey: ['historyLogs', assetId] })
      }
      // Clear selections immediately
      setSelectedEmployeeId(null)
      setEditingCheckoutId(null)
      setActiveTab('assign')
      toast.success('Employee assigned successfully')
      // Close dialog if onOpenChange is provided
      if (onOpenChange) {
        onOpenChange(false)
      }
    },
    onError: () => {
      toast.error('Failed to assign employee')
    },
  })

  // Checkout from reservation mutation
  const checkoutFromReservationMutation = useMutation({
    mutationFn: async ({ reservationId, employeeUserId }: { reservationId: string; employeeUserId: string }) => {
      const response = await fetch('/api/assets/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetIds: [assetId],
          employeeUserId,
          checkoutDate: new Date().toISOString().split('T')[0],
        }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to checkout asset')
      }
      const result = await response.json()
      
      // Delete the reservation after successful checkout
      const deleteBaseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
        ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
        : ''
      const deleteUrl = `${deleteBaseUrl}/api/assets/reserve/${reservationId}`
      
      // Get auth token for delete
      const deleteSupabase = createClient()
      const { data: { session: deleteSession } } = await deleteSupabase.auth.getSession()
      const deleteHeaders: HeadersInit = {}
      if (deleteSession?.access_token) {
        deleteHeaders['Authorization'] = `Bearer ${deleteSession.access_token}`
      }
      
      const deleteResponse = await fetch(deleteUrl, {
        method: 'DELETE',
        credentials: 'include',
        headers: deleteHeaders,
      })
      if (!deleteResponse.ok) {
        console.error('Failed to delete reservation after checkout')
      }
      
      return result
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['checkoutHistory', assetId] })
      queryClient.invalidateQueries({ queryKey: ['historyLogs', assetId] })
      queryClient.invalidateQueries({ queryKey: ['reservations', assetId] })
      queryClient.invalidateQueries({ queryKey: invalidateQueryKey })
      // Also invalidate general assets queries to refetch assets table
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['assets-list'] })
      toast.success('Asset checked out successfully')
      if (onOpenChange) {
        onOpenChange(false)
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to checkout asset')
    },
  })

  // Cancel reservation mutation
  const cancelReservationMutation = useMutation({
    mutationFn: async (reservationId: string) => {
      const response = await fetch(`/api/assets/reserve/${reservationId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to cancel reservation')
      }
      return response.json()
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['reservations', assetId] })
      queryClient.invalidateQueries({ queryKey: ['historyLogs', assetId] })
      queryClient.invalidateQueries({ queryKey: invalidateQueryKey })
      toast.success('Reservation cancelled successfully')
      if (onOpenChange) {
        onOpenChange(false)
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to cancel reservation')
    },
  })

  const handleSaveEmployee = () => {
    const checkoutId = editingCheckoutId || activeCheckout?.id
    if (!checkoutId) return
    const employeeUserId = selectedEmployeeId ?? null
    updateMutation.mutate({ checkoutId, employeeUserId })
  }

  // Fetch history logs for assignedEmployee field
  const { data: historyData, isLoading: isLoadingHistory, refetch: refetchHistory } = useQuery({
    queryKey: ['historyLogs', assetId],
    queryFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
        ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
        : ''
      const url = `${baseUrl}/api/assets/${assetId}/history`
      
      // Get auth token
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = {}
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      
      const response = await fetch(url, {
        credentials: 'include',
        headers,
      })
      if (!response.ok) {
        throw new Error('Failed to fetch history logs')
      }
      return response.json()
    },
    enabled: true, // Always fetch when component is mounted (open prop is for dialog wrapper, not query control)
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    staleTime: 0, // Always consider stale to force refetch
  })

  const historyLogs = historyData?.logs || []
  const assignedEmployeeLogs = historyLogs.filter((log: { field?: string }) => log.field === 'assignedEmployee')


  // Sort checkouts: active first, then by date
  const sortedCheckouts = [...checkouts].sort((a, b) => {
    const aCheckedIn = a.checkins.length > 0
    const bCheckedIn = b.checkins.length > 0
    if (aCheckedIn !== bCheckedIn) return aCheckedIn ? 1 : -1
    return new Date(b.checkoutDate).getTime() - new Date(a.checkoutDate).getTime()
  })

  // Find the first active checkout (not checked in) for assignment
  const activeCheckout = sortedCheckouts.find((c: { checkins: Array<{ id: string }>; employeeUser: { id: string } | null }) => !c.checkins.length)
  const selectedCheckoutEmployeeId = editingCheckoutId ? sortedCheckouts.find((c: { id: string }) => c.id === editingCheckoutId)?.employeeUser?.id || null : null

  // Auto-select first active checkout when dialog opens or when activeCheckout changes
  useEffect(() => {
    if (open && activeCheckout) {
      // Use setTimeout to avoid synchronous setState in effect
      const timeoutId = setTimeout(() => {
        // Only set if not already set or if the active checkout changed
        if (!editingCheckoutId || editingCheckoutId !== activeCheckout.id) {
      setEditingCheckoutId(activeCheckout.id)
      setSelectedEmployeeId(null) // Reset to null so user must explicitly select a new employee
        }
      }, 0)
      return () => clearTimeout(timeoutId)
    } else if (open && !activeCheckout) {
      // Clear editingCheckoutId if no active checkout
      const timeoutId = setTimeout(() => {
        setEditingCheckoutId(null)
        setSelectedEmployeeId(null)
      }, 0)
      return () => clearTimeout(timeoutId)
    }
  }, [open, activeCheckout, editingCheckoutId])

  // Refetch history when component mounts (always fetch, not dependent on open prop)
  useEffect(() => {
    refetchHistory()
  }, [refetchHistory])
  
  // Also refetch when open prop changes to true (for dialog wrapper usage)
  useEffect(() => {
    if (open === true) {
      refetchHistory()
    }
  }, [open, refetchHistory])

  const content = (
    <div className="flex flex-col gap-4 h-full">
      {/* Tabs */}
      <div className="flex items-center gap-2 border-b">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setActiveTab('assign')}
          className={`px-4 py-2 h-auto text-sm font-medium transition-colors border-b-2 rounded-none ${
            activeTab === 'assign'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Assign Employee
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setActiveTab('history')
            // Refetch history when switching to history tab
            if (open) {
              refetchHistory()
            }
          }}
          className={`px-4 py-2 h-auto text-sm font-medium transition-colors border-b-2 rounded-none ${
            activeTab === 'history'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <History className="h-4 w-4 mr-2" />
          History ({assignedEmployeeLogs.length})
        </Button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'assign' ? (
          <div className="space-y-4">
            {/* Loading State */}
            {(isLoadingReservations || isLoadingCheckouts) ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-2">
                  <Spinner className="h-6 w-6" />
                  <p className="text-sm text-muted-foreground">Loading records...</p>
                </div>
              </div>
            ) : (
              <>
                {/* Reservation Display */}
                {activeReservation && assetStatus === 'Reserved' && activeReservation.employeeUser && (
                  <div className="space-y-3 p-3 border rounded-md">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Reserved by:</span>{' '}
                      <span className="font-medium">{activeReservation.employeeUser.name}</span>
                      {activeReservation.reservationDate && (
                        <span className="text-muted-foreground ml-2">
                          • {new Date(activeReservation.reservationDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          checkoutFromReservationMutation.mutate({
                            reservationId: activeReservation.id,
                            employeeUserId: activeReservation.employeeUserId!,
                          })
                        }}
                        disabled={checkoutFromReservationMutation.isPending || cancelReservationMutation.isPending}
                        className="flex-1"
                      >
                        {checkoutFromReservationMutation.isPending ? (
                          <>
                            <Spinner className="mr-2 h-4 w-4" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            Checkout
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => {
                          if (confirm('Cancel this reservation?')) {
                            cancelReservationMutation.mutate(activeReservation.id)
                          }
                        }}
                        disabled={checkoutFromReservationMutation.isPending || cancelReservationMutation.isPending}
                        variant="outline"
                      >
                        {cancelReservationMutation.isPending ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

            {/* Current Assignment Display */}
            {activeCheckout && (
              <div className="space-y-2 pb-4 border-b">
                <label className="text-sm font-medium text-muted-foreground">Current Assignment</label>
                <div className="text-sm">
                  {activeCheckout.employeeUser ? (
                    <>
                      <div>
                        Assigned to: <span className="font-medium">{activeCheckout.employeeUser.name}</span>
                        {activeCheckout.checkoutDate && (
                          <span className="text-muted-foreground ml-2">
                            • {new Date(activeCheckout.checkoutDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                            })}
                          </span>
                        )}
                              </div>
                      {(activeCheckout.employeeUser.email || activeCheckout.employeeUser.department) && (
                                <div className="text-xs text-muted-foreground mt-0.5">
                          {activeCheckout.employeeUser.email}
                          {activeCheckout.employeeUser.department && ` • ${activeCheckout.employeeUser.department}`}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">No employee assigned</span>
                          )}
                        </div>
                      </div>
            )}

            {!activeCheckout && (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No active checkout record found.</p>
                <p className="text-xs mt-1">Check out this asset first to assign an employee.</p>
              </div>
                )}
              </>
            )}

            {activeCheckout && (
               <>
                 {!readOnly && (
               <>
                 <div className="space-y-2">
                   <label className="text-sm font-medium">Change Assignment</label>
                 <Command>
                   <CommandInput 
                     placeholder="Search employees..." 
                     onFocus={() => setIsCommandOpen(true)}
                     onBlur={() => setTimeout(() => setIsCommandOpen(false), 200)}
                   />
                   {isCommandOpen && (
                     <CommandList className="max-h-[300px]">
                    <CommandEmpty>
                      No employees found.
                    </CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="none"
                        onSelect={() => {
                          setSelectedEmployeeId(null)
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedEmployeeId === null ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <X className="mr-2 h-4 w-4 text-muted-foreground" />
                        <span>Unassign employee</span>
                      </CommandItem>
                      {employees.map((emp: { id: string; name: string; email: string; department?: string | null }) => {
                        const isSelected = selectedEmployeeId === emp.id
                        return (
                          <CommandItem
                            key={emp.id}
                            value={`${emp.name} ${emp.email} ${emp.department || ''}`}
                            onSelect={() => {
                              setSelectedEmployeeId(emp.id)
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                isSelected ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                              <span className="font-medium text-sm truncate text-left">{emp.name}</span>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <span className="truncate">{emp.email}</span>
                                {emp.department && (
                                  <>
                                    <span className="shrink-0">•</span>
                                    <span className="truncate">{emp.department}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                    </CommandList>
                   )}
                 </Command>
                 </div>

                 {/* Reassign to section */}
                 {selectedEmployeeId !== null && (() => {
                   const selectedEmployee = employees.find((emp: { id: string }) => emp.id === selectedEmployeeId)
                   return selectedEmployee ? (
                     <div className="text-sm pt-2 border-t">
                       <div className="font-medium">Reassign to: {selectedEmployee.name}</div>
                       {selectedEmployee.email && (
                         <div className="text-xs text-muted-foreground mt-0.5">
                           {selectedEmployee.email}
                           {selectedEmployee.department && ` • ${selectedEmployee.department}`}
                         </div>
                       )}
                     </div>
                   ) : null
                 })()}
                
                {/* Save Button */}
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    onClick={handleSaveEmployee}
                    disabled={updateMutation.isPending || selectedEmployeeId === selectedCheckoutEmployeeId}
                  >
                    {updateMutation.isPending ? (
                      <>
                        <Spinner className="mr-2 h-4 w-4" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save
                      </>
                    )}
                  </Button>
                </div>
                   </>
                 )}
              </>
            )}
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            {isLoadingHistory ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Spinner className="h-8 w-8 mb-3" />
                <p className="text-sm text-muted-foreground">Loading history...</p>
              </div>
            ) : assignedEmployeeLogs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <History className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="font-medium text-base mb-1">No assignment history</p>
                <p className="text-sm">Employee assignment changes will appear here</p>
              </div>
            ) : (
              <div className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                      <TableHead className="min-w-[180px]">Date & Time</TableHead>
                      <TableHead>Changed From</TableHead>
                      <TableHead>Changed To</TableHead>
                    <TableHead>Action By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignedEmployeeLogs.map((log: { 
                    id: string
                    eventDate: string
                    changeFrom?: string
                    changeTo?: string
                    actionBy: string
                  }) => {
                    const eventDate = log.eventDate ? new Date(log.eventDate) : null
                    const formattedDate = eventDate ? eventDate.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    }) : '-'
                      const formattedTime = eventDate ? eventDate.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      }) : ''
                    
                    return (
                      <TableRow key={log.id}>
                          <TableCell className="font-medium text-sm whitespace-nowrap">
                            <div className="flex flex-col">
                              <span>{formattedDate}</span>
                              {formattedTime && (
                                <span className="text-xs text-muted-foreground">{formattedTime}</span>
                              )}
                            </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.changeFrom || <span className="text-muted-foreground">(empty)</span>}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.changeTo || <span className="text-muted-foreground">(empty)</span>}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.actionBy}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              </div>
            )}
          </ScrollArea>
        )}
      </div>
    </div>
  )

  // If open/onOpenChange props are provided, wrap in Dialog
  if (open !== undefined && onOpenChange !== undefined) {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => {
        onOpenChange(isOpen)
        if (!isOpen) {
          setEditingCheckoutId(null)
          setSelectedEmployeeId(null)
          setActiveTab('assign')
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Manage Employee Assignment</DialogTitle>
            <DialogDescription>
              Assign or change employee assignment for checkout records.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {content}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Otherwise, render content directly (for read-only or embedded use cases)
  return content
}
