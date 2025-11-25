import { DashboardClient } from './dashboard-client'
import { getDashboardStats } from '@/lib/data/dashboard-stats'

// Revalidate every 30 seconds - allows caching and prefetching while keeping data fresh
export const revalidate = 30 // Cache for 30 seconds, then revalidate

// Server Component - Fetches data directly from database (no HTTP)
// Loading.tsx will show instantly while this fetches
export default async function DashboardPage() {
  // Fetch data directly on server - FAST, no HTTP roundtrip, cached
  // This runs in parallel with the loading.tsx UI
  const stats = await getDashboardStats()
  
  // Pass server data to client component for hydration
                            return (
      <DashboardClient initialData={stats} />
  )
}
