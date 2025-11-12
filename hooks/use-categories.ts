import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

export interface Category {
  id: string
  name: string
  description?: string
  subCategories: SubCategory[]
}

export interface SubCategory {
  id: string
  name: string
  description?: string
}

interface CreateCategoryData {
  name: string
  description?: string
}

interface CreateSubCategoryData {
  name: string
  description?: string
  categoryId: string
}

// Fetch categories
export const useCategories = (enabled: boolean = true) => {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await fetch("/api/categories")
      if (!response.ok) {
        // Return empty array on error instead of undefined
        return []
      }
      const data = await response.json()
      // Ensure we always return an array, never undefined
      return (data.categories || []) as Category[]
    },
    enabled,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes to reduce API calls
  })
}

// Fetch subcategories by category
export const useSubCategories = (categoryId: string | null) => {
  return useQuery({
    queryKey: ["subcategories", categoryId],
    queryFn: async () => {
      if (!categoryId) return []
      const response = await fetch(`/api/subcategories?categoryId=${categoryId}`)
      if (!response.ok) {
        // Return empty array on error instead of undefined
        return []
      }
      const data = await response.json()
      // Ensure we always return an array, never undefined
      return (data.subcategories || []) as SubCategory[]
    },
    enabled: !!categoryId,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes to reduce API calls
  })
}

// Create category mutation
export const useCreateCategory = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: CreateCategoryData) => {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error("Failed to create category")
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] })
    },
  })
}

// Create subcategory mutation
export const useCreateSubCategory = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: CreateSubCategoryData) => {
      const response = await fetch("/api/subcategories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create subcategory")
      }
      return response.json()
    },
    onSuccess: (_data: unknown, variables: CreateSubCategoryData) => {
      // Invalidate both subcategories and categories since categories include subcategories
      queryClient.invalidateQueries({ queryKey: ["subcategories", variables.categoryId] })
      queryClient.invalidateQueries({ queryKey: ["categories"] })
    },
  })
}

// Update category mutation
export const useUpdateCategory = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, ...data }: CreateCategoryData & { id: string }) => {
      const response = await fetch(`/api/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update category")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] })
    },
  })
}

// Delete category mutation
export const useDeleteCategory = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/categories/${id}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete category")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] })
    },
  })
}

// Update subcategory mutation
export const useUpdateSubCategory = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, ...data }: CreateSubCategoryData & { id: string }) => {
      const response = await fetch(`/api/subcategories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update subcategory")
      }
      return response.json()
    },
    onSuccess: (_data: unknown, variables: CreateSubCategoryData & { id: string }) => {
      queryClient.invalidateQueries({ queryKey: ["subcategories"] })
      queryClient.invalidateQueries({ queryKey: ["categories"] })
    },
  })
}

// Delete subcategory mutation
export const useDeleteSubCategory = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/subcategories/${id}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete subcategory")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subcategories"] })
      queryClient.invalidateQueries({ queryKey: ["categories"] })
    },
  })
}

// Create asset mutation
export const useCreateAsset = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error("Failed to create asset")
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] })
    },
  })
}

