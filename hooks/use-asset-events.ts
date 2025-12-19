import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase-client'

const getApiBaseUrl = () => {
  const useFastAPI = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true'
  const fastApiUrl = process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000'
  return useFastAPI ? fastApiUrl : ''
}

const getAuthToken = async (): Promise<string | null> => {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  } catch {
    return null
  }
}

export interface AssetEvent {
  id: string
  assetId: string
  eventType: string
  field: string | null
  changeFrom: string | null
  changeTo: string | null
  actionBy: string | null
  createdAt: string
  asset: {
    id: string
    assetTagId: string
    description: string | null
  } | null
}

export interface PaginationInfo {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface AssetEventsResponse {
  logs: AssetEvent[]
  uniqueFields: string[]
  pagination: PaginationInfo
}

// Hook to fetch asset events with pagination and filtering
export const useAssetEvents = (params: {
  search?: string
  eventType?: string
  field?: string
  page?: number
  pageSize?: number
}) => {
  return useQuery<AssetEventsResponse>({
    queryKey: ['assetEvents', params],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl()
      const token = await getAuthToken()

      const searchParams = new URLSearchParams()
      if (params.page) searchParams.set('page', params.page.toString())
      if (params.pageSize) searchParams.set('pageSize', params.pageSize.toString())
      if (params.search) searchParams.set('search', params.search)
      if (params.eventType && params.eventType !== 'all') {
        searchParams.set('eventType', params.eventType)
      }
      if (params.field && params.field !== 'all') {
        searchParams.set('field', params.field)
      }

      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${baseUrl}/api/settings/asset-events?${searchParams.toString()}`, {
        headers,
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || error.error || 'Failed to fetch asset events')
      }

      return response.json()
    },
  })
}

// Hook to delete a single asset event
export const useDeleteAssetEvent = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (eventId: string) => {
      const baseUrl = getApiBaseUrl()
      const token = await getAuthToken()

      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${baseUrl}/api/settings/asset-events/${eventId}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || error.error || 'Failed to delete event')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assetEvents'] })
    },
  })
}

// Hook to bulk delete asset events
export const useBulkDeleteAssetEvents = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ids: string[]) => {
      const baseUrl = getApiBaseUrl()
      const token = await getAuthToken()

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${baseUrl}/api/settings/asset-events/bulk-delete`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
        body: JSON.stringify({ ids }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || error.error || 'Failed to delete events')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assetEvents'] })
    },
  })
}

