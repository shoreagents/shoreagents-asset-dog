import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from '@/lib/supabase-client'

export interface CompanyInfo {
  id: string
  companyName: string
  contactEmail: string | null
  contactPhone: string | null
  address: string | null
  zipCode: string | null
  country: string | null
  website: string | null
  primaryLogoUrl: string | null
  secondaryLogoUrl: string | null
  createdAt: Date
  updatedAt: Date
}

interface CompanyInfoFormData {
  companyName: string
  contactEmail?: string | null
  contactPhone?: string | null
  address?: string | null
  zipCode?: string | null
  country?: string | null
  website?: string | null
  primaryLogoUrl?: string | null
  secondaryLogoUrl?: string | null
}

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
      console.warn('No active session found')
      return null
    }
    return session.access_token
  } catch (error) {
    console.error('Failed to get auth token:', error)
    return null
  }
}

// Fetch company info
export const useCompanyInfo = (enabled: boolean = true) => {
  return useQuery({
    queryKey: ["companyInfo"],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/company-info`
      
      // Get auth token and add to headers
      const token = await getAuthToken()
      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(url, {
        credentials: 'include', // Send cookies for authentication
        headers,
      })
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Failed to fetch company info: ${response.status} ${response.statusText}`, errorText)
        if (response.status === 401) {
          throw new Error('Unauthorized - please login again')
        }
        return null
      }
      const data = await response.json()
      const companyInfo = data.companyInfo as CompanyInfo | null
      if (companyInfo) {
        return {
          ...companyInfo,
          createdAt: new Date(companyInfo.createdAt),
          updatedAt: new Date(companyInfo.updatedAt),
        }
      }
      return null
    },
    enabled,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

// Save company info mutation (upsert - create or update)
export const useSaveCompanyInfo = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: CompanyInfoFormData) => {
      const baseUrl = getApiBaseUrl()
      const token = await getAuthToken()
      const headers: HeadersInit = {
        "Content-Type": "application/json"
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(`${baseUrl}/api/company-info`, {
        method: "POST",
        credentials: 'include',
        headers,
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = "Failed to save company info"
        try {
          const error = JSON.parse(errorText)
          errorMessage = error.detail || error.error || errorMessage
        } catch {
          errorMessage = errorText || errorMessage
        }
        throw new Error(errorMessage)
      }
      const result = await response.json()
      const companyInfo = result.companyInfo as CompanyInfo
      return {
        ...companyInfo,
        createdAt: new Date(companyInfo.createdAt),
        updatedAt: new Date(companyInfo.updatedAt),
      }
    },
    onSuccess: (data) => {
      // Update the cache with the new data
      queryClient.setQueryData(["companyInfo"], data)
      queryClient.invalidateQueries({ 
        queryKey: ["companyInfo"],
        refetchType: 'none' 
      })
    },
  })
}

