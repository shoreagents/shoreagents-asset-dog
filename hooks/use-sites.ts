import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

export interface Site {
  id: string
  name: string
  description: string | null
  createdAt: Date
  updatedAt: Date
}

interface CreateSiteData {
  name: string
  description?: string | null
}

// Fetch sites
export const useSites = (enabled: boolean = true, search?: string) => {
  return useQuery({
    queryKey: ["sites", search],
    queryFn: async () => {
      const url = search
        ? `/api/sites?search=${encodeURIComponent(search)}`
        : "/api/sites"
      const response = await fetch(url)
      if (!response.ok) {
        return []
      }
      const data = await response.json()
      return (data.sites || []) as Site[]
    },
    enabled,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

// Create site mutation
export const useCreateSite = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: CreateSiteData) => {
      const response = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create site")
      }
      return response.json()
    },
    onMutate: async (newSiteData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["sites"] })
      
      // Snapshot all previous values
      const previousQueries = queryClient.getQueriesData({ 
        predicate: (query) => query.queryKey[0] === "sites" 
      })
      
      // Create a temporary site object for optimistic update
      const tempId = `temp-${Date.now()}`
      const optimisticSite: Site = {
        id: tempId,
        name: newSiteData.name,
        description: newSiteData.description || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      
      // Optimistically update all sites queries
      queryClient.setQueriesData<Site[]>(
        { 
          predicate: (query) => query.queryKey[0] === "sites" 
        }, 
        (old = []) => {
          // Check if site with same name already exists (avoid duplicates)
          if (old.some(site => site.name.toLowerCase() === newSiteData.name.toLowerCase().trim())) {
            return old
          }
          return [...old, optimisticSite]
        }
      )
      
      return { previousQueries, tempId }
    },
    onError: (err, newSiteData, context) => {
      // Rollback to previous values on error (e.g., duplicate name)
      if (context?.previousQueries) {
        context.previousQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
    },
    onSuccess: (data, variables, context) => {
      // Ensure dates are properly serialized
      const newSite: Site = {
        ...data.site,
        createdAt: new Date(data.site.createdAt),
        updatedAt: new Date(data.site.updatedAt),
      }
      
      // Replace the temporary optimistic site with the real one
      queryClient.setQueriesData<Site[]>(
        { 
          predicate: (query) => query.queryKey[0] === "sites" 
        }, 
        (old = []) => {
          // Remove temporary site if it exists
          const filtered = old.filter(site => site.id !== context?.tempId)
          // Check if real site already exists (avoid duplicates)
          if (filtered.some(site => site.id === newSite.id)) {
            return filtered
          }
          return [...filtered, newSite]
        }
      )
    },
  })
}

// Update site mutation
export const useUpdateSite = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, ...data }: CreateSiteData & { id: string }) => {
      const response = await fetch(`/api/sites/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update site")
      }
      return response.json()
    },
    onSuccess: (data) => {
      // Update all sites queries (with and without search) using predicate
      queryClient.setQueriesData<Site[]>(
        { 
          predicate: (query) => query.queryKey[0] === "sites" 
        }, 
        (old = []) => {
          return old.map(site => site.id === data.site.id ? data.site : site)
        }
      )
      // Mark queries as stale but don't refetch immediately (let staleTime handle it)
      queryClient.invalidateQueries({ queryKey: ["sites"], refetchType: 'none' })
    },
  })
}

// Delete site mutation
export const useDeleteSite = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/sites/${id}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete site")
      }
      return response.json()
    },
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["sites"] })
      
      // Snapshot all previous values
      const previousQueries = queryClient.getQueriesData({ 
        predicate: (query) => query.queryKey[0] === "sites" 
      })
      
      // Optimistically update all sites queries to remove the site
      queryClient.setQueriesData<Site[]>(
        { 
          predicate: (query) => query.queryKey[0] === "sites" 
        }, 
        (old = []) => {
          return old.filter(site => site.id !== id)
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
      queryClient.invalidateQueries({ queryKey: ["sites"], refetchType: 'none' })
    },
  })
}

