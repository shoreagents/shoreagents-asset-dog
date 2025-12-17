'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { DashboardStats } from '@/types/dashboard'
import { SummaryCards } from '@/components/dashboard/summary-cards'
import { AssetValueChart } from '@/components/dashboard/asset-value-chart'
import { CalendarWidget } from '@/components/dashboard/calendar-widget'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase-client'

// Get API base URL - use FastAPI if enabled
const getApiBaseUrl = () => {
  const useFastAPI = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true'
  const fastApiUrl = process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000'
  return useFastAPI ? fastApiUrl : ''
}

// Helper function to get auth token from Supabase session
async function getAuthToken(): Promise<string | null> {
  try {
    const supabase = createClient()
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

async function fetchDashboardStats(): Promise<DashboardStats> {
  const baseUrl = getApiBaseUrl()
  const url = `${baseUrl}/api/dashboard/stats`
  
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
    throw new Error('Failed to fetch dashboard statistics')
  }
  return response.json()
}

interface DashboardClientProps {
  initialData: DashboardStats
}

export function DashboardClient({ initialData }: DashboardClientProps) {
  // Use React Query with server-provided initial data
  const { data, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
    initialData, // Hydrate with server data
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
  })

  return (
    <div className="space-y-6 pb-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your asset management system
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
                Failed to load dashboard data. Please try again later.
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <SummaryCards data={data?.summary} isLoading={isLoading} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AssetValueChart data={data?.assetValueByCategory} isLoading={isLoading} />
        <CalendarWidget data={data?.calendar} isLoading={isLoading} />
      </div>

      <ActivityFeed data={data} isLoading={isLoading} />
    </div>
  )
}
