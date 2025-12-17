import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from '@/lib/supabase-client'

export interface CheckoutForEmployee {
  id: string
  checkoutDate: string
  expectedReturnDate: string | null
  asset: {
    id: string
    assetTagId: string
    description: string
    status: string | null
    category: { name: string } | null
    subCategory: { name: string } | null
    location: string | null
    brand: string | null
    model: string | null
  }
  checkins?: Array<{ id: string }>
}

export interface Employee {
  id: string
  name: string
  email: string
  department: string | null
  createdAt: string
  updatedAt: string
  checkouts?: CheckoutForEmployee[]
}

interface PaginationInfo {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

interface CreateEmployeeData {
  name: string
  email: string
  department?: string | null
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

// Fetch employees
export const useEmployees = (
  enabled: boolean = true,
  search?: string,
  searchType: string = 'unified',
  page: number = 1,
  pageSize: number = 50
) => {
  return useQuery({
    queryKey: ["employees", search, searchType, page, pageSize],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl()
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      })
      if (search) {
        params.append('search', search)
        params.append('searchType', searchType)
      }
      const url = `${baseUrl}/api/employees?${params.toString()}`
      
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
        console.error(`Failed to fetch employees: ${response.status} ${response.statusText}`, errorText)
        if (response.status === 401) {
          throw new Error('Unauthorized - please login again')
        }
        return { employees: [], pagination: { page: 1, pageSize, total: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false } }
      }
      const data = await response.json()
      return {
        employees: (data.employees || []) as Employee[],
        pagination: data.pagination as PaginationInfo
      }
    },
    enabled,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

// Fetch all employees by paginating through all pages
// Useful for dropdowns/selects that need the complete list
export const useAllEmployees = (enabled: boolean = true, search?: string, searchType: string = 'unified') => {
  return useQuery({
    queryKey: ["allEmployees", search, searchType],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl()
      const allEmployees: Employee[] = []
      let page = 1
      const pageSize = 100 // Maximum allowed by backend
      let hasMore = true

      while (hasMore) {
        const params = new URLSearchParams({
          page: page.toString(),
          pageSize: pageSize.toString(),
        })
        if (search) {
          params.append('search', search)
          params.append('searchType', searchType)
        }
        const url = `${baseUrl}/api/employees?${params.toString()}`
        
        // Get auth token and add to headers
        const token = await getAuthToken()
        const headers: HeadersInit = {}
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }
        
        const response = await fetch(url, {
          credentials: 'include',
          headers,
        })
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error(`Failed to fetch employees: ${response.status} ${response.statusText}`, errorText)
          if (response.status === 401) {
            throw new Error('Unauthorized - please login again')
          }
          // If error on later pages, return what we have so far
          if (page === 1) {
            return []
          }
          break
        }
        
        const data = await response.json()
        const employees = (data.employees || []) as Employee[]
        allEmployees.push(...employees)
        
        const pagination = data.pagination as PaginationInfo
        hasMore = pagination.hasNextPage || false
        page++
      }
      
      return allEmployees
    },
    enabled,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

// Fetch single employee
export const useEmployee = (employeeId: string | null, enabled: boolean = true) => {
  return useQuery({
    queryKey: ["employee", employeeId],
    queryFn: async () => {
      if (!employeeId) return null
      
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/employees/${employeeId}`
      
      // Get auth token and add to headers
      const token = await getAuthToken()
      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(url, {
        credentials: 'include',
        headers,
      })
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`Failed to fetch employee: ${response.status} ${response.statusText}`, errorText)
        if (response.status === 401) {
          throw new Error('Unauthorized - please login again')
        }
        if (response.status === 404) {
          return null
        }
        throw new Error('Failed to fetch employee')
      }
      const data = await response.json()
      return data.employee as Employee
    },
    enabled: enabled && !!employeeId,
    staleTime: 10 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

// Create employee mutation
export const useCreateEmployee = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: CreateEmployeeData) => {
      const baseUrl = getApiBaseUrl()
      const token = await getAuthToken()
      const headers: HeadersInit = {
        "Content-Type": "application/json"
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(`${baseUrl}/api/employees`, {
        method: "POST",
        credentials: 'include',
        headers,
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = "Failed to create employee"
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] })
    },
  })
}

// Update employee mutation
export const useUpdateEmployee = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, ...data }: CreateEmployeeData & { id: string }) => {
      const baseUrl = getApiBaseUrl()
      const token = await getAuthToken()
      const headers: HeadersInit = {
        "Content-Type": "application/json"
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(`${baseUrl}/api/employees/${id}`, {
        method: "PUT",
        credentials: 'include',
        headers,
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = "Failed to update employee"
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      queryClient.invalidateQueries({ queryKey: ["employee"] })
    },
  })
}

// Delete employee mutation
export const useDeleteEmployee = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      const baseUrl = getApiBaseUrl()
      const token = await getAuthToken()
      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(`${baseUrl}/api/employees/${id}`, {
        method: "DELETE",
        credentials: 'include',
        headers,
      })
      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = "Failed to delete employee"
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] })
      queryClient.invalidateQueries({ queryKey: ["employee"] })
    },
  })
}

