import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

export interface Category {
  id: string
  name: string
  description?: string
  subCategories: SubCategory[]
  createdAt?: string
  updatedAt?: string
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
    retry: 2, // Retry up to 2 times on failure
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
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
    retry: 2, // Retry up to 2 times on failure
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
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
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create category")
      }
      return response.json()
    },
    onMutate: async (newCategory) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["categories"] })
      
      // Snapshot the previous value
      const previousCategories = queryClient.getQueryData<Category[]>(["categories"])
      
      // Optimistically update to the new value
      queryClient.setQueryData<Category[]>(["categories"], (old = []) => {
        const tempId = `temp-${Date.now()}`
        const optimisticCategory: Category = {
          id: tempId,
          name: newCategory.name,
          description: newCategory.description,
          subCategories: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        return [...old, optimisticCategory]
      })
      
      return { previousCategories }
    },
    onError: (_err, _newCategory, context) => {
      // Rollback to the previous value
      if (context?.previousCategories) {
        queryClient.setQueryData(["categories"], context.previousCategories)
      }
    },
    onSuccess: (data, _variables, context) => {
      // Replace optimistic category with real data
      queryClient.setQueryData<Category[]>(["categories"], (old = []) => {
        if (!old) return [data.category]
        // Find and replace the temporary category with the real one
        const tempIndex = old.findIndex(cat => cat.id.startsWith('temp-'))
        if (tempIndex !== -1) {
          const updated = [...old]
          updated[tempIndex] = {
            ...data.category,
            subCategories: data.category.subCategories || [],
            createdAt: data.category.createdAt || new Date().toISOString(),
            updatedAt: data.category.updatedAt || new Date().toISOString(),
          }
          return updated
        }
        return old
      })
      queryClient.invalidateQueries({ queryKey: ["categories"], refetchType: 'none' })
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
    onMutate: async (newSubCategory) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["categories"] })
      await queryClient.cancelQueries({ queryKey: ["subcategories", newSubCategory.categoryId] })
      
      // Snapshot the previous value
      const previousCategories = queryClient.getQueryData<Category[]>(["categories"])
      
      // Optimistically update categories to include the new subcategory
      queryClient.setQueryData<Category[]>(["categories"], (old = []) => {
        return old.map(category => {
          if (category.id === newSubCategory.categoryId) {
            const tempId = `temp-sub-${Date.now()}`
            const optimisticSubCategory: SubCategory = {
              id: tempId,
              name: newSubCategory.name,
              description: newSubCategory.description,
            }
            return {
              ...category,
              subCategories: [...(category.subCategories || []), optimisticSubCategory],
            }
          }
          return category
        })
      })
      
      return { previousCategories }
    },
    onError: (_err, _variables, context) => {
      // Rollback to the previous value
      if (context?.previousCategories) {
        queryClient.setQueryData(["categories"], context.previousCategories)
      }
    },
    onSuccess: (data, variables) => {
      // Replace optimistic subcategory with real data
      queryClient.setQueryData<Category[]>(["categories"], (old = []) => {
        return old.map(category => {
          if (category.id === variables.categoryId) {
            const updatedSubCategories = category.subCategories.map(sub => {
              if (sub.id.startsWith('temp-sub-')) {
                return {
                  id: data.subcategory.id,
                  name: data.subcategory.name,
                  description: data.subcategory.description,
                }
              }
              return sub
            })
            return {
              ...category,
              subCategories: updatedSubCategories,
            }
          }
          return category
        })
      })
      queryClient.invalidateQueries({ queryKey: ["subcategories", variables.categoryId], refetchType: 'none' })
      queryClient.invalidateQueries({ queryKey: ["categories"], refetchType: 'none' })
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
    onMutate: async ({ id, ...updatedData }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["categories"] })
      
      // Snapshot the previous value
      const previousCategories = queryClient.getQueryData<Category[]>(["categories"])
      
      // Optimistically update to the new value
      queryClient.setQueryData<Category[]>(["categories"], (old = []) => {
        return old.map(category =>
          category.id === id
            ? { ...category, ...updatedData, updatedAt: new Date().toISOString() }
            : category
        )
      })
      
      return { previousCategories }
    },
    onError: (_err, _variables, context) => {
      // Rollback to the previous value
      if (context?.previousCategories) {
        queryClient.setQueryData(["categories"], context.previousCategories)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"], refetchType: 'none' })
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
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["categories"] })
      
      // Snapshot the previous value
      const previousCategories = queryClient.getQueryData<Category[]>(["categories"])
      
      // Optimistically update to the new value
      queryClient.setQueryData<Category[]>(["categories"], (old = []) => {
        return old.filter(category => category.id !== id)
      })
      
      return { previousCategories }
    },
    onError: (_err, _variables, context) => {
      // Rollback to the previous value
      if (context?.previousCategories) {
        queryClient.setQueryData(["categories"], context.previousCategories)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"], refetchType: 'none' })
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
    onMutate: async ({ id, categoryId, ...updatedData }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["categories"] })
      
      // Snapshot the previous value
      const previousCategories = queryClient.getQueryData<Category[]>(["categories"])
      
      // Optimistically update to the new value
      queryClient.setQueryData<Category[]>(["categories"], (old = []) => {
        return old.map(category => {
          if (category.id === categoryId) {
            return {
              ...category,
              subCategories: category.subCategories.map(sub =>
                sub.id === id ? { ...sub, ...updatedData } : sub
              ),
            }
          }
          return category
        })
      })
      
      return { previousCategories }
    },
    onError: (_err, _variables, context) => {
      // Rollback to the previous value
      if (context?.previousCategories) {
        queryClient.setQueryData(["categories"], context.previousCategories)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subcategories"], refetchType: 'none' })
      queryClient.invalidateQueries({ queryKey: ["categories"], refetchType: 'none' })
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
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["categories"] })
      
      // Snapshot the previous value
      const previousCategories = queryClient.getQueryData<Category[]>(["categories"])
      
      // Optimistically update to the new value
      queryClient.setQueryData<Category[]>(["categories"], (old = []) => {
        return old.map(category => ({
          ...category,
          subCategories: category.subCategories.filter(sub => sub.id !== id),
        }))
      })
      
      return { previousCategories }
    },
    onError: (_err, _variables, context) => {
      // Rollback to the previous value
      if (context?.previousCategories) {
        queryClient.setQueryData(["categories"], context.previousCategories)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subcategories"], refetchType: 'none' })
      queryClient.invalidateQueries({ queryKey: ["categories"], refetchType: 'none' })
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

