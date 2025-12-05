'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
import { ArrowRight, Calendar, CheckCircle, Clock, UserPlus, UserCircle, Edit2, X, Check, History, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { cn } from '@/lib/utils'

interface CheckoutManagerProps {
  assetId: string
  assetTagId: string
  invalidateQueryKey?: string[] // Optional query key to invalidate after updates
  readOnly?: boolean // If true, disable editing functionality
  open?: boolean // Control dialog visibility
  onOpenChange?: (open: boolean) => void // Handle dialog open/close
}

export function CheckoutManager({ assetId, assetTagId, invalidateQueryKey = ['assets'], readOnly = false, open, onOpenChange }: CheckoutManagerProps) {
  const queryClient = useQueryClient()
  const [editingCheckoutId, setEditingCheckoutId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'assign' | 'history'>('assign')
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const [isCommandOpen, setIsCommandOpen] = useState(false)

  // Fetch checkout records
  const { data: checkoutData, isLoading } = useQuery({
    queryKey: ['checkoutHistory', assetId],
    queryFn: async () => {
      const response = await fetch(`/api/assets/${assetId}/checkout`)
      if (!response.ok) throw new Error('Failed to fetch checkout history')
      return response.json()
    },
  })

  const checkouts = checkoutData?.checkouts || []

  // Fetch employees - fetch all pages to get complete list
  const { data: employees = [] } = useQuery({
    queryKey: ['employees', 'checkout-manager', 'all'],
    queryFn: async () => {
      let allEmployees: any[] = []
      let page = 1
      let hasMore = true
      const pageSize = 1000 // Large page size to minimize requests
      
      while (hasMore) {
        const response = await fetch(`/api/employees?page=${page}&pageSize=${pageSize}`)
        if (!response.ok) throw new Error('Failed to fetch employees')
        const data = await response.json()
        
        allEmployees = [...allEmployees, ...(data.employees || [])]
        
        hasMore = data.pagination?.hasNextPage || false
        page++
      }
      
      return allEmployees
    },
  })

  // Update checkout mutation
  const updateMutation = useMutation({
    mutationFn: async ({ checkoutId, employeeUserId }: { checkoutId: string; employeeUserId: string | null }) => {
      const response = await fetch(`/api/assets/checkout/${checkoutId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeUserId }),
      })
      if (!response.ok) throw new Error('Failed to update checkout')
      return response.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['checkoutHistory', assetId] })
      queryClient.invalidateQueries({ queryKey: ['historyLogs', assetId] })
      // Invalidate the provided query key or default to 'assets'
      queryClient.invalidateQueries({ queryKey: invalidateQueryKey })
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

  const handleSaveEmployee = () => {
    if (!editingCheckoutId) return
    const employeeUserId = selectedEmployeeId ?? null
    updateMutation.mutate({ checkoutId: editingCheckoutId, employeeUserId })
  }

  // Fetch history logs for assignedEmployee field
  const { data: historyData, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['historyLogs', assetId],
    queryFn: async () => {
      const response = await fetch(`/api/assets/${assetId}/history`)
      if (!response.ok) throw new Error('Failed to fetch history logs')
      return response.json()
    },
    enabled: open === true, // Fetch when dialog is open
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

  // Auto-select first active checkout when dialog opens
  useEffect(() => {
    if (open && !editingCheckoutId && activeCheckout) {
      setEditingCheckoutId(activeCheckout.id)
      setSelectedEmployeeId(null) // Reset to null so user must explicitly select a new employee
    }
  }, [open, activeCheckout, editingCheckoutId])

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
          onClick={() => setActiveTab('history')}
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
            {/* Checkout Selection */}
            {sortedCheckouts.filter((c: { checkins: Array<{ id: string }> }) => !c.checkins.length).length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Checkout Record</label>
                <div className="space-y-1">
                  {sortedCheckouts.filter((c: { checkins: Array<{ id: string }> }) => !c.checkins.length).map((checkout: {
                    id: string
                    checkoutDate: string
                    employeeUser: { id: string; name: string; email: string; department: string | null } | null
                  }) => {
                    const checkoutDate = checkout.checkoutDate ? new Date(checkout.checkoutDate) : null
                    const formattedDate = checkoutDate ? checkoutDate.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    }) : '-'
                    const isSelected = editingCheckoutId === checkout.id
                    
                    return (
                      <div
                        key={checkout.id}
                        className="flex items-center gap-2 py-2 cursor-pointer hover:bg-accent/50 rounded px-2 -mx-2"
                        onClick={() => {
                          setEditingCheckoutId(checkout.id)
                          setSelectedEmployeeId(null) // Reset to null so user must explicitly select a new employee
                        }}
                      >
                        {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                        <div className="flex-1 min-w-0 text-sm">
                          {checkout.employeeUser ? (
                            <>
                              <div>
                                Current Assigned to: <span className="font-medium">{checkout.employeeUser.name}</span>
                                <span className="text-muted-foreground ml-2">• {formattedDate}</span>
                              </div>
                              {(checkout.employeeUser.email || checkout.employeeUser.department) && (
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {checkout.employeeUser.email}
                                  {checkout.employeeUser.department && ` • ${checkout.employeeUser.department}`}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">No employee assigned</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

             {editingCheckoutId && (
               <>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Date</TableHead>
                    <TableHead className="w-[150px]">Changed From</TableHead>
                    <TableHead className="w-[150px]">Changed To</TableHead>
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
                    
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium text-sm">
                          {formattedDate}
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
