import { Suspense } from 'react'
import { ActivityClient } from './activity-client'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { getActivities } from '@/lib/data/activities'

// Revalidate every 30 seconds - allows caching and prefetching while keeping data fresh
export const revalidate = 30 // Cache for 30 seconds, then revalidate

// Loading fallback component
function ActivityLoading() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Recent Activity</h1>
        <p className="text-muted-foreground">
          Track all asset-related activities and transactions
        </p>
      </div>
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <Spinner className="h-8 w-8" />
          <p className="text-sm text-muted-foreground">Loading activities...</p>
        </div>
      </div>
    </div>
  )
}

interface ActivityPageProps {
  searchParams: Promise<{ page?: string; pageSize?: string; type?: string }>
}

// Server Component - Fetches data directly from database (no HTTP)
export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  const params = await searchParams
  const page = parseInt(params.page || '1', 10)
  const pageSize = parseInt(params.pageSize || '50', 10)
  const activityType = params.type || 'all'
  
  // Fetch data directly on server - FAST, no HTTP roundtrip, cached
  const activities = await getActivities({
    page,
    pageSize,
    activityType: activityType === 'all' ? null : activityType
  })
  
  // Pass server data to client component for hydration
  return (
    <Suspense fallback={<ActivityLoading />}>
      <ActivityClient 
        initialData={activities} 
        initialPage={page}
        initialPageSize={pageSize}
        initialType={activityType}
      />
    </Suspense>
  )
}
