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

export interface EmployeeInfo {
  id: string
  name?: string | null
  email?: string | null
  department?: string | null
}

export interface AccountabilityForm {
  id: string
  employeeUserId: string
  dateIssued: string
  department?: string | null
  accountabilityFormNo?: string | null
  formData?: Record<string, unknown> | null
  employeeUser?: EmployeeInfo | null
  createdAt?: string | null
  updatedAt?: string | null
}

export interface ReturnForm {
  id: string
  employeeUserId: string
  dateReturned: string
  department?: string | null
  ctrlNo?: string | null
  returnType?: string
  formData?: Record<string, unknown> | null
  employeeUser?: EmployeeInfo | null
  createdAt?: string | null
  updatedAt?: string | null
}

export interface PaginationInfo {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface FormHistoryCounts {
  returnForms: number
  accountabilityForms: number
}

export interface AccountabilityFormsResponse {
  accountabilityForms: AccountabilityForm[]
}

export interface ReturnFormsResponse {
  returnForms: ReturnForm[]
}

export interface AccountabilityFormResponse {
  accountabilityForm: AccountabilityForm
}

export interface ReturnFormResponse {
  returnForm: ReturnForm
}

export interface FormHistoryResponse {
  returnForms?: ReturnForm[] | null
  accountabilityForms?: AccountabilityForm[] | null
  pagination: PaginationInfo
  counts: FormHistoryCounts
}

export interface CreateAccountabilityFormData {
  employeeUserId: string
  dateIssued: string
  department?: string | null
  accountabilityFormNo?: string | null
  formData?: Record<string, unknown> | null
}

export interface CreateReturnFormData {
  employeeUserId: string
  dateReturned: string
  department?: string | null
  ctrlNo?: string | null
  returnType?: string
  formData?: Record<string, unknown> | null
}

// Hook to fetch accountability forms
export const useAccountabilityForms = (employeeId?: string) => {
  return useQuery<AccountabilityFormsResponse>({
    queryKey: ['accountabilityForms', employeeId],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl()
      const token = await getAuthToken()

      const searchParams = new URLSearchParams()
      if (employeeId) searchParams.set('employeeId', employeeId)

      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${baseUrl}/api/forms/accountability-form?${searchParams.toString()}`, {
        headers,
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || error.error || 'Failed to fetch accountability forms')
      }

      return response.json()
    },
  })
}

// Hook to create accountability form
export const useCreateAccountabilityForm = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateAccountabilityFormData) => {
      const baseUrl = getApiBaseUrl()
      const token = await getAuthToken()

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${baseUrl}/api/forms/accountability-form`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || error.error || 'Failed to create accountability form')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accountabilityForms'] })
      queryClient.invalidateQueries({ queryKey: ['formHistory'] })
    },
  })
}

// Hook to fetch return forms
export const useReturnForms = (employeeId?: string) => {
  return useQuery<ReturnFormsResponse>({
    queryKey: ['returnForms', employeeId],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl()
      const token = await getAuthToken()

      const searchParams = new URLSearchParams()
      if (employeeId) searchParams.set('employeeId', employeeId)

      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${baseUrl}/api/forms/return-form?${searchParams.toString()}`, {
        headers,
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || error.error || 'Failed to fetch return forms')
      }

      return response.json()
    },
  })
}

// Hook to create return form
export const useCreateReturnForm = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateReturnFormData) => {
      const baseUrl = getApiBaseUrl()
      const token = await getAuthToken()

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${baseUrl}/api/forms/return-form`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || error.error || 'Failed to create return form')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returnForms'] })
      queryClient.invalidateQueries({ queryKey: ['formHistory'] })
    },
  })
}

// Hook to fetch form history
export const useFormHistory = (params: {
  formType?: string
  search?: string
  searchType?: string
  page?: number
  pageSize?: number
}) => {
  return useQuery<FormHistoryResponse>({
    queryKey: ['formHistory', params],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl()
      const token = await getAuthToken()

      const searchParams = new URLSearchParams()
      if (params.formType) searchParams.set('formType', params.formType)
      if (params.search) searchParams.set('search', params.search)
      if (params.searchType) searchParams.set('searchType', params.searchType)
      if (params.page) searchParams.set('page', params.page.toString())
      if (params.pageSize) searchParams.set('pageSize', params.pageSize.toString())

      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${baseUrl}/api/forms/history?${searchParams.toString()}`, {
        headers,
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || error.error || 'Failed to fetch form history')
      }

      return response.json()
    },
  })
}

// Hook to fetch a single form by ID
export const useFormById = (formId: string, formType: string = 'accountability', enabled: boolean = true) => {
  return useQuery<AccountabilityFormResponse | ReturnFormResponse>({
    queryKey: ['form', formId, formType],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl()
      const token = await getAuthToken()

      const searchParams = new URLSearchParams()
      searchParams.set('type', formType)

      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${baseUrl}/api/forms/history/${formId}?${searchParams.toString()}`, {
        headers,
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || error.error || 'Failed to fetch form')
      }

      return response.json()
    },
    enabled: !!formId && enabled,
  })
}

// Hook to delete a form
export const useDeleteForm = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ formId, formType }: { formId: string; formType: string }) => {
      const baseUrl = getApiBaseUrl()
      const token = await getAuthToken()

      const searchParams = new URLSearchParams()
      searchParams.set('type', formType)

      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${baseUrl}/api/forms/history/${formId}?${searchParams.toString()}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || error.error || 'Failed to delete form')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formHistory'] })
      queryClient.invalidateQueries({ queryKey: ['accountabilityForms'] })
      queryClient.invalidateQueries({ queryKey: ['returnForms'] })
    },
  })
}

