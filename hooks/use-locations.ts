import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

export interface Location {
  id: string
  name: string
  description: string | null
  createdAt: Date
  updatedAt: Date
}

interface CreateLocationData {
  name: string
  description?: string | null
}

// Fetch locations
export const useLocations = (enabled: boolean = true, search?: string) => {
  return useQuery({
    queryKey: ["locations", search],
    queryFn: async () => {
      const url = search
        ? `/api/locations?search=${encodeURIComponent(search)}`
        : "/api/locations"
      const response = await fetch(url)
      if (!response.ok) {
        return []
      }
      const data = await response.json()
      return (data.locations || []) as Location[]
    },
    enabled,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

// Create location mutation
export const useCreateLocation = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: CreateLocationData) => {
      const response = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create location")
      }
      return response.json()
    },
    onMutate: async (newLocationData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["locations"] })
      
      // Snapshot all previous values
      const previousQueries = queryClient.getQueriesData({ 
        predicate: (query) => query.queryKey[0] === "locations" 
      })
      
      // Create a temporary location object for optimistic update
      const tempId = `temp-${Date.now()}`
      const optimisticLocation: Location = {
        id: tempId,
        name: newLocationData.name,
        description: newLocationData.description || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      
      // Optimistically update all locations queries
      queryClient.setQueriesData<Location[]>(
        { 
          predicate: (query) => query.queryKey[0] === "locations" 
        }, 
        (old = []) => {
          // Check if location with same name already exists (avoid duplicates)
          if (old.some(location => location.name.toLowerCase() === newLocationData.name.toLowerCase().trim())) {
            return old
          }
          return [...old, optimisticLocation]
        }
      )
      
      return { previousQueries, tempId }
    },
    onError: (err, newLocationData, context) => {
      // Rollback to previous values on error (e.g., duplicate name)
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
    },
    onSuccess: (data, variables, context) => {
      // Ensure dates are properly serialized
      const newLocation: Location = {
        ...data.location,
        createdAt: new Date(data.location.createdAt),
        updatedAt: new Date(data.location.updatedAt),
      }
      
      // Replace the temporary optimistic location with the real one
      queryClient.setQueriesData<Location[]>(
        { 
          predicate: (query) => query.queryKey[0] === "locations" 
        }, 
        (old = []) => {
          // Remove temporary location if it exists
          const filtered = old.filter(location => location.id !== context?.tempId)
          // Check if real location already exists (avoid duplicates)
          if (filtered.some(location => location.id === newLocation.id)) {
            return filtered
          }
          return [...filtered, newLocation]
        }
      )
    },
  })
}

// Update location mutation
export const useUpdateLocation = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, ...data }: CreateLocationData & { id: string }) => {
      const response = await fetch(`/api/locations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update location")
      }
      return response.json()
    },
    onSuccess: (data) => {
      // Update all locations queries (with and without search) using predicate
      queryClient.setQueriesData<Location[]>(
        { 
          predicate: (query) => query.queryKey[0] === "locations" 
        }, 
        (old = []) => {
          return old.map(location => location.id === data.location.id ? {
            ...data.location,
            createdAt: new Date(data.location.createdAt),
            updatedAt: new Date(data.location.updatedAt),
          } : location)
        }
      )
      // Mark queries as stale but don't refetch immediately (let staleTime handle it)
      queryClient.invalidateQueries({ queryKey: ["locations"], refetchType: 'none' })
    },
  })
}

// Delete location mutation
export const useDeleteLocation = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/locations/${id}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete location")
      }
      return response.json()
    },
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["locations"] })
      
      // Snapshot all previous values
      const previousQueries = queryClient.getQueriesData({ 
        predicate: (query) => query.queryKey[0] === "locations" 
      })
      
      // Optimistically update all locations queries to remove the location
      queryClient.setQueriesData<Location[]>(
        { 
          predicate: (query) => query.queryKey[0] === "locations" 
        }, 
        (old = []) => {
          return old.filter(location => location.id !== id)
        }
      )
      
      return { previousQueries }
    },
    onError: (err, id, context) => {
      // Rollback to previous values on error
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
    },
    onSuccess: () => {
      // Mark queries as stale but don't refetch immediately (optimistic update already handled it)
      queryClient.invalidateQueries({ queryKey: ["locations"], refetchType: 'none' })
    },
  })
}

