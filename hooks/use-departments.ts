import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from '@/lib/supabase-client'

export interface Department {
  id: string
  name: string
  description: string | null
  createdAt: Date
  updatedAt: Date
}

interface CreateDepartmentData {
  name: string
  description?: string | null
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

// Fetch departments
export const useDepartments = (enabled: boolean = true, search?: string) => {
  return useQuery({
    queryKey: ["departments", search],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl()
      const url = search
        ? `${baseUrl}/api/departments?search=${encodeURIComponent(search)}`
        : `${baseUrl}/api/departments`
      
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
        console.error(`Failed to fetch departments: ${response.status} ${response.statusText}`, errorText)
        if (response.status === 401) {
          throw new Error('Unauthorized - please login again')
        }
        throw new Error('Failed to fetch departments')
      }
      const data = await response.json()
      return (data.departments || []) as Department[]
    },
    enabled,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

// Create department mutation
export const useCreateDepartment = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: CreateDepartmentData) => {
      const baseUrl = getApiBaseUrl()
      const token = await getAuthToken()
      const headers: HeadersInit = {
        "Content-Type": "application/json"
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(`${baseUrl}/api/departments`, {
        method: "POST",
        credentials: 'include',
        headers,
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = "Failed to create department"
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
    onMutate: async (newDepartment) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ 
        predicate: (query) => query.queryKey[0] === "departments" 
      })
      
      // Snapshot the previous value
      const previousDepartments = queryClient.getQueryData<Department[]>(["departments"])
      
      // Optimistically update to the new value
      queryClient.setQueriesData<Department[]>(
        { predicate: (query) => query.queryKey[0] === "departments" },
        (old = []) => {
          const tempId = `temp-${Date.now()}`
          const optimisticDepartment: Department = {
            id: tempId,
            name: newDepartment.name,
            description: newDepartment.description || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
          return [...old, optimisticDepartment]
        }
      )
      
      return { previousDepartments }
    },
    onError: (_err, _newDepartment, context) => {
      // Rollback to the previous value
      if (context?.previousDepartments) {
        queryClient.setQueriesData(
          { predicate: (query) => query.queryKey[0] === "departments" },
          context.previousDepartments
        )
      }
    },
    onSuccess: (data) => {
      // Replace optimistic department with real data
      queryClient.setQueriesData<Department[]>(
        { predicate: (query) => query.queryKey[0] === "departments" },
        (old = []) => {
          if (!old) return [data.department]
          // Find and replace the temporary department with the real one
          const tempIndex = old.findIndex(dept => dept.id.startsWith('temp-'))
          if (tempIndex !== -1) {
            const updated = [...old]
            updated[tempIndex] = {
              ...data.department,
              createdAt: new Date(data.department.createdAt),
              updatedAt: new Date(data.department.updatedAt),
            }
            return updated
          }
          return old
        }
      )
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === "departments",
        refetchType: 'none' 
      })
    },
  })
}

// Update department mutation
export const useUpdateDepartment = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, ...data }: CreateDepartmentData & { id: string }) => {
      const baseUrl = getApiBaseUrl()
      const token = await getAuthToken()
      const headers: HeadersInit = {
        "Content-Type": "application/json"
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(`${baseUrl}/api/departments/${id}`, {
        method: "PUT",
        credentials: 'include',
        headers,
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = "Failed to update department"
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
    onMutate: async ({ id, ...updatedData }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ 
        predicate: (query) => query.queryKey[0] === "departments" 
      })
      
      // Snapshot the previous value
      const previousDepartments = queryClient.getQueryData<Department[]>(["departments"])
      
      // Optimistically update to the new value
      queryClient.setQueriesData<Department[]>(
        { predicate: (query) => query.queryKey[0] === "departments" },
        (old = []) => {
          return old.map(department =>
            department.id === id
              ? { ...department, ...updatedData, updatedAt: new Date() }
              : department
          )
        }
      )
      
      return { previousDepartments }
    },
    onError: (_err, _variables, context) => {
      // Rollback to the previous value
      if (context?.previousDepartments) {
        queryClient.setQueriesData(
          { predicate: (query) => query.queryKey[0] === "departments" },
          context.previousDepartments
        )
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === "departments",
        refetchType: 'none' 
      })
    },
  })
}

// Delete department mutation
export const useDeleteDepartment = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      const baseUrl = getApiBaseUrl()
      const token = await getAuthToken()
      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(`${baseUrl}/api/departments/${id}`, {
        method: "DELETE",
        credentials: 'include',
        headers,
      })
      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = "Failed to delete department"
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
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ 
        predicate: (query) => query.queryKey[0] === "departments" 
      })
      
      // Snapshot the previous value
      const previousDepartments = queryClient.getQueryData<Department[]>(["departments"])
      
      // Optimistically update to the new value
      queryClient.setQueriesData<Department[]>(
        { predicate: (query) => query.queryKey[0] === "departments" },
        (old = []) => {
          return old.filter(department => department.id !== id)
        }
      )
      
      return { previousDepartments }
    },
    onError: (_err, _variables, context) => {
      // Rollback to the previous value
      if (context?.previousDepartments) {
        queryClient.setQueriesData(
          { predicate: (query) => query.queryKey[0] === "departments" },
          context.previousDepartments
        )
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === "departments",
        refetchType: 'none' 
      })
    },
  })
}

