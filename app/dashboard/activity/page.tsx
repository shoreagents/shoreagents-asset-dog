import { ActivityClient } from './activity-client'
import { getActivities } from '@/lib/data/activities'

// Revalidate every 30 seconds - allows caching and prefetching while keeping data fresh
export const revalidate = 30 // Cache for 30 seconds, then revalidate

interface ActivityPageProps {
  searchParams: Promise<{ page?: string; pageSize?: string; type?: string }>
}

// Server Component - Fetches data directly from database (no HTTP)
// Loading.tsx will show instantly while this fetches
export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  const params = await searchParams
  const page = parseInt(params.page || '1', 10)
  const pageSize = parseInt(params.pageSize || '50', 10)
  const activityType = params.type || 'all'
  
  // Fetch data directly on server - FAST, no HTTP roundtrip, cached
  // This runs in parallel with the loading.tsx UI
  const activities = await getActivities({
    page,
    pageSize,
    activityType: activityType === 'all' ? null : activityType
  })
  
  // Pass server data to client component for hydration
  return (
      <ActivityClient 
        initialData={activities} 
        initialPage={page}
        initialPageSize={pageSize}
        initialType={activityType}
      />
  )
}
