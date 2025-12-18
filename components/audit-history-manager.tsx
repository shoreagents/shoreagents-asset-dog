'use client'

import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CheckCircle2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { AuditDialog } from '@/components/dialogs/audit-dialog'
import { DeleteConfirmationDialog } from '@/components/dialogs/delete-confirmation-dialog'
import type { AuditFormData } from '@/lib/validations/audit'

interface AuditHistoryManagerProps {
  assetId: string
  assetTagId: string
  readOnly?: boolean // If true, disable add/delete functionality
}

export function AuditHistoryManager({ assetId, readOnly = false }: AuditHistoryManagerProps) {
  const queryClient = useQueryClient()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [auditToDelete, setAuditToDelete] = useState<{ id: string; auditType: string } | null>(null)

  // Fetch audit history
  const { data: auditData, isLoading, refetch } = useQuery({
    queryKey: ['auditHistory', assetId],
    queryFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
        ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
        : ''
      const url = `${baseUrl}/api/assets/${assetId}/audit`
      
      // Get auth token
      const { createClient } = await import('@/lib/supabase-client')
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
        let errorMessage = 'Failed to fetch audit history'
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
  })

  const audits = auditData?.audits || []

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (auditId: string) => {
      const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
        ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
        : ''
      const url = `${baseUrl}/api/assets/audit/${auditId}`
      
      // Get auth token
      const { createClient } = await import('@/lib/supabase-client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = {}
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      
      const response = await fetch(url, {
        method: 'DELETE',
        credentials: 'include',
        headers,
      })
      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = 'Failed to delete audit'
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
      // Invalidate and refetch to ensure the list is updated
      await queryClient.invalidateQueries({ queryKey: ['auditHistory', assetId] })
      // Also invalidate assets query since it includes audit history
      await queryClient.invalidateQueries({ queryKey: ['assets'] })
      await refetch()
      setDeleteDialogOpen(false)
      setAuditToDelete(null)
      toast.success('Audit record deleted')
    },
    onError: () => {
      toast.error('Failed to delete audit record')
    },
  })
  
  // Add mutation
  const addMutation = useMutation({
    mutationFn: async (data: AuditFormData) => {
      const baseUrl = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true' 
        ? (process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000')
        : ''
      const url = `${baseUrl}/api/assets/${assetId}/audit`
      
      // Get auth token
      const { createClient } = await import('@/lib/supabase-client')
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
      
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          auditType: data.auditType,
          auditDate: data.auditDate,
          auditor: data.auditor || null,
          status: data.status || 'Completed',
          notes: data.notes || null,
        }),
      })
      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = 'Failed to create audit'
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
      setIsDialogOpen(false)
      // Invalidate and refetch to ensure the list is updated
      await queryClient.invalidateQueries({ queryKey: ['auditHistory', assetId] })
      // Also invalidate assets query since it includes audit history
      await queryClient.invalidateQueries({ queryKey: ['assets'] })
      await refetch()
      toast.success('Audit record created')
    },
    onError: () => {
      toast.error('Failed to create audit record')
    },
  })

  const handleSubmit = async (data: AuditFormData) => {
    await addMutation.mutateAsync(data)
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            {audits.length} audit record{audits.length !== 1 ? 's' : ''}
          </div>
          {!readOnly && (
            <Button 
              type="button"
              onClick={() => setIsDialogOpen(true)} 
              size="sm" 
              className="gap-2 focus-visible:ring-0"
            >
              <CheckCircle2 className="h-4 w-4" />
              Add Audit Record
            </Button>
          )}
        </div>

        {/* Audit List */}
      <ScrollArea className="h-[300px]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Spinner className="h-8 w-8 mb-2" />
            <p className="text-sm text-muted-foreground">Loading audit history...</p>
          </div>
        ) : audits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-3 mb-4">
              <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">No audit records yet</p>
            <p className="text-xs text-muted-foreground">Add your first audit record to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {audits.map((audit: any) => {
              const auditDate = audit.auditDate ? new Date(audit.auditDate) : null
              const formattedDate = auditDate ? auditDate.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              }) : '-'
              
              return (
                <Card key={audit.id} className="hover:bg-accent/50 transition-colors border-border/50 py-2">
                  <CardContent className="py-2.5 px-4">
                    <div className="flex justify-between items-start gap-3">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="font-medium text-xs">
                            {audit.auditType}
                          </Badge>
                          {audit.status && (
                            <Badge
                              variant={
                                audit.status === 'Completed'
                                  ? 'default'
                                  : audit.status === 'Pending'
                                  ? 'secondary'
                                  : audit.status === 'In Progress'
                                  ? 'outline'
                                  : 'destructive'
                              }
                              className="font-medium text-xs"
                            >
                              {audit.status}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-sm">
                            <div className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                            <span className="text-muted-foreground text-xs">Date:</span>
                            <span className="text-foreground text-sm">{formattedDate}</span>
                          </div>
                          
                          {audit.auditor && (
                            <div className="flex items-center gap-1.5 text-sm">
                              <div className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                              <span className="text-muted-foreground text-xs">Auditor:</span>
                              <span className="text-foreground text-sm">{audit.auditor}</span>
                            </div>
                          )}
                          
                          {audit.notes && (
                            <div className="pt-1 mt-1 border-t border-border/50">
                              <p className="text-sm text-foreground leading-snug">{audit.notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {!readOnly && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setAuditToDelete({ id: audit.id, auditType: audit.auditType })
                            setDeleteDialogOpen(true)
                          }}
                          disabled={deleteMutation.isPending}
                          className="shrink-0 text-muted-foreground hover:text-destructive h-7 w-7"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </ScrollArea>
      </div>

      {/* Add Audit Dialog */}
      <AuditDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSubmit={handleSubmit}
        isLoading={addMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) {
            setAuditToDelete(null)
          }
        }}
        onConfirm={() => {
          if (auditToDelete) {
            deleteMutation.mutate(auditToDelete.id)
          }
        }}
        title="Delete Audit Record"
        description={
          auditToDelete
            ? `Are you sure you want to delete audit record "${auditToDelete.auditType}"? This action cannot be undone.`
            : 'Are you sure you want to delete this audit record? This action cannot be undone.'
        }
        isLoading={deleteMutation.isPending}
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />
    </>
  )
}

