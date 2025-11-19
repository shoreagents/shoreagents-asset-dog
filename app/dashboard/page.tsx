import { Suspense } from 'react'
import { DashboardClient } from './dashboard-client'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { getDashboardStats } from '@/lib/data/dashboard-stats'

// Loading fallback component
function DashboardLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[600px]">
      <Spinner className="h-12 w-12 mb-4" />
      <p className="text-lg text-muted-foreground">Loading dashboard...</p>
                  </div>
                )
              }

// Server Component - Fetches data directly from database (no HTTP)
export default async function DashboardPage() {
  // Fetch data directly on server - FAST, no HTTP roundtrip, cached
  const stats = await getDashboardStats()
  
  // Pass server data to client component for hydration
                            return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardClient initialData={stats} />
    </Suspense>
  )
}
