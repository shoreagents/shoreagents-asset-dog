import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase-client'
import { toast } from 'sonner'

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

export interface FileHistory {
  id: string
  operationType: 'import' | 'export'
  fileName: string
  filePath: string | null
  fileSize: number | null
  mimeType: string | null
  userId: string
  userEmail: string | null
  recordsProcessed: number | null
  recordsCreated: number | null
  recordsSkipped: number | null
  recordsFailed: number | null
  recordsExported: number | null
  fieldsExported: number | null
  status: 'success' | 'failed' | 'partial'
  errorMessage: string | null
  metadata: string | null
  createdAt: string
  updatedAt: string
}

export interface FileHistoryListResponse {
  fileHistory: FileHistory[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export interface FileHistoryCreate {
  operationType: 'import' | 'export'
  fileName: string
  filePath?: string | null
  fileSize?: number | null
  mimeType?: string | null
  recordsProcessed?: number | null
  recordsCreated?: number | null
  recordsSkipped?: number | null
  recordsFailed?: number | null
  recordsExported?: number | null
  fieldsExported?: number | null
  status: 'success' | 'failed' | 'partial'
  errorMessage?: string | null
  metadata?: Record<string, unknown> | null
}

export interface FileUploadResponse {
  filePath: string
  fileName: string
  fileSize: number
  mimeType: string | null
  publicUrl: string | null
}

/**
 * Hook to fetch file history with pagination
 */
export const useFileHistory = (
  operationType: 'import' | 'export',
  page: number = 1,
  pageSize: number = 10,
  enabled: boolean = true
) => {
  return useQuery<FileHistoryListResponse>({
    queryKey: ['fileHistory', operationType, page, pageSize],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/file-history?operationType=${operationType}&page=${page}&pageSize=${pageSize}`
      
      const token = await getAuthToken()
      const headers: HeadersInit = {}
      if (baseUrl && token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(url, {
        credentials: 'include',
        headers,
      })
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.detail || error.error || 'Failed to fetch history')
      }
      
      return response.json()
    },
    enabled,
    staleTime: 30 * 1000, // Cache for 30 seconds
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  })
}

/**
 * Hook to upload a file to Supabase storage
 */
export const useUploadFile = () => {
  return useMutation<FileUploadResponse, Error, { file: File; operationType: 'import' | 'export' }>({
    mutationFn: async ({ file, operationType }) => {
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/file-history/upload`
      
      const token = await getAuthToken()
      const headers: HeadersInit = {}
      if (baseUrl && token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const formData = new FormData()
      formData.append('file', file)
      formData.append('operationType', operationType)
      
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: formData,
      })
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.detail || error.error || 'Failed to upload file')
      }
      
      return response.json()
    },
  })
}

/**
 * Hook to create a file history record
 */
export const useCreateFileHistory = () => {
  const queryClient = useQueryClient()
  
  return useMutation<FileHistory, Error, FileHistoryCreate>({
    mutationFn: async (data) => {
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/file-history`
      
      const token = await getAuthToken()
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      }
      if (baseUrl && token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(data),
      })
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.detail || error.error || 'Failed to create file history')
      }
      
      return response.json()
    },
    onSuccess: (_, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['fileHistory', variables.operationType] })
    },
  })
}

/**
 * Hook to delete a file history record
 */
export const useDeleteFileHistory = () => {
  const queryClient = useQueryClient()
  
  return useMutation<{ message: string }, Error, { historyId: string; operationType: 'import' | 'export' }>({
    mutationFn: async ({ historyId }) => {
      const baseUrl = getApiBaseUrl()
      const url = `${baseUrl}/api/file-history/${historyId}`
      
      const token = await getAuthToken()
      const headers: HeadersInit = {}
      if (baseUrl && token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch(url, {
        method: 'DELETE',
        credentials: 'include',
        headers,
      })
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.detail || error.error || 'Failed to delete file history')
      }
      
      return response.json()
    },
    onSuccess: (_, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['fileHistory', variables.operationType] })
      toast.success('File history deleted successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete file history')
    },
  })
}

/**
 * Function to download a file from file history
 */
export const downloadFileHistory = async (historyId: string, fileName: string): Promise<void> => {
  try {
    const baseUrl = getApiBaseUrl()
    const url = `${baseUrl}/api/file-history/${historyId}/download`
    
    const token = await getAuthToken()
    const headers: HeadersInit = {}
    if (baseUrl && token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    
    const response = await fetch(url, {
      credentials: 'include',
      headers,
    })
    
    if (!response.ok) {
      throw new Error('Failed to download file')
    }
    
    const blob = await response.blob()
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(downloadUrl)
  } catch (error) {
    toast.error('Failed to download file')
    throw error
  }
}

