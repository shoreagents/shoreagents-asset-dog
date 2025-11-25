import { AssetsClient } from './assets-client'
import { getAssets } from '@/lib/data/assets'

// Revalidate every 30 seconds - allows caching and prefetching while keeping data fresh
export const revalidate = 30 // Cache for 30 seconds, then revalidate

// Server Component - Fetches data directly from database (no HTTP)
// Loading.tsx will show instantly while this fetches
export default async function AssetsPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ [key: string]: string | string[] | undefined }> 
}) {
  const params = await searchParams
  
  // Extract search params with defaults
  const page = parseInt((params.page as string) || '1', 10)
  const pageSize = parseInt((params.pageSize as string) || '10', 10)
  const search = (params.search as string) || undefined
  const category = (params.category as string) || undefined
  const status = (params.status as string) || undefined

  // Fetch data directly on server - FAST, no HTTP roundtrip, cached
  // This runs in parallel with the loading.tsx UI
  const assetsData = await getAssets({
    page,
    pageSize,
    search,
    category: category && category !== 'all' ? category : undefined,
    status: status && status !== 'all' ? status : undefined,
  })
  
  // Pass server data to client component for hydration
  return <AssetsClient initialData={assetsData} />
}

