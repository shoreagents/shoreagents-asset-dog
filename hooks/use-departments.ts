import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

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

// Fetch departments
export const useDepartments = (enabled: boolean = true, search?: string) => {
  return useQuery<Department[]>({
    queryKey: ["departments", search],
    queryFn: async () => {
      const url = search
        ? `/api/departments?search=${encodeURIComponent(search)}`
        : "/api/departments"
      const response = await fetch(url)
      if (!response.ok) {
        return []
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
      const response = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create department")
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
      const response = await fetch(`/api/departments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update department")
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
      const response = await fetch(`/api/departments/${id}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete department")
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

