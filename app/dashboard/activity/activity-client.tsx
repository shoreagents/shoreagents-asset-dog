"use client"

import { useQuery } from '@tanstack/react-query'
import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePermissions } from '@/hooks/use-permissions'
import { ActivityList } from '@/components/dashboard/activity-list'
import { ActivityFilters } from '@/components/dashboard/activity-filters'
import type { ActivitiesResult } from '@/lib/data/activities'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Activity } from 'lucide-react'

interface ActivityClientProps {
  initialData: ActivitiesResult
  initialPage: number
  initialPageSize: number
  initialType: string
}

export function ActivityClient({ initialData, initialPage, initialPageSize, initialType }: ActivityClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  
  const canViewAssets = hasPermission('canViewAssets')
  const [, startTransition] = useTransition()
  
  // Get page, pageSize, and type from URL (default to 50 rows)
  const page = parseInt(searchParams.get('page') || String(initialPage), 10)
  const pageSize = parseInt(searchParams.get('pageSize') || String(initialPageSize), 10)
  const selectedType = searchParams.get('type') || initialType

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
      if (updates.pageSize === 50) {
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

  const { data, isLoading, error, refetch, isFetching } = useQuery<ActivitiesResult>({
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
    initialData,
    enabled: canViewAssets,
    staleTime: 30000,
    refetchOnWindowFocus: false,
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

  if (!canViewAssets && !permissionsLoading) {
    return (
      <div className="flex items-center justify-center py-12 h-[60vh]">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 text-center pt-6">
            <div className="p-4 rounded-full bg-destructive/10">
              <Activity className="h-12 w-12 text-destructive opacity-50" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Access Denied</h2>
              <p className="text-sm text-muted-foreground mt-1">
                You do not have permission to view assets. Please contact your administrator.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold tracking-tight">Recent Activity</h1>
        <p className="text-muted-foreground">
          Track all asset-related activities and transactions
        </p>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="border-destructive/50 bg-destructive/10">
            <CardContent className="pt-6">
              <div className="text-center text-destructive font-medium">
                Failed to load activities. Please try again later.
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <ActivityFilters 
        selectedType={selectedType} 
        onTypeChange={handleTypeChange}
        disabled={isLoading || isFetching}
      />

      <ActivityList 
        activities={activities}
        pagination={pagination}
        isLoading={permissionsLoading || isLoading}
        isFetching={isFetching}
        selectedType={selectedType}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        onRefresh={() => refetch()}
      />
    </div>
  )
}
