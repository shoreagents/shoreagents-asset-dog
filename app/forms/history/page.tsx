"use client"

import { useState, useCallback, useEffect, useRef, useTransition, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { FileText, ClipboardList, Search, X, RefreshCw, ArrowLeft, ArrowRight, Eye, MoreHorizontal, Trash2 } from "lucide-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { usePermissions } from "@/hooks/use-permissions"
import { Spinner } from "@/components/ui/shadcn-io/spinner"
import { motion, AnimatePresence } from "framer-motion"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DeleteConfirmationDialog } from "@/components/dialogs/delete-confirmation-dialog"
import { toast } from "sonner"
import { useMutation } from "@tanstack/react-query"

interface ReturnForm {
  id: string
  dateReturned: string
  department: string | null
  ctrlNo: string | null
  returnType: string
  formData: unknown | null
  employeeUser: {
    id: string
    name: string
    email: string
    department: string | null
  }
}

interface AccountabilityForm {
  id: string
  dateIssued: string
  department: string | null
  accountabilityFormNo: string | null
  formData: unknown | null
  employeeUser: {
    id: string
    name: string
    email: string
    department: string | null
  }
}

interface PaginationInfo {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

interface FormCounts {
  returnForms: number
  accountabilityForms: number
}

async function fetchForms(
  formType: "accountability" | "return",
  search?: string,
  searchType: string = "unified",
  page: number = 1,
  pageSize: number = 50
): Promise<{
  returnForms?: ReturnForm[]
  accountabilityForms?: AccountabilityForm[]
  pagination: PaginationInfo
  counts?: FormCounts
}> {
  const params = new URLSearchParams({
    formType,
    page: page.toString(),
    pageSize: pageSize.toString(),
  })
  if (search) {
    params.append("search", search)
    params.append("searchType", searchType)
  }

  const response = await fetch(`/api/forms/history?${params.toString()}`)
  if (!response.ok) {
    throw new Error("Failed to fetch form history")
  }
  return response.json()
}

function FormsHistoryPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const queryClient = useQueryClient()
  const [, startTransition] = useTransition()

  const canViewReturnForms = hasPermission("canViewReturnForms")
  const canViewAccountabilityForms = hasPermission("canViewAccountabilityForms")
  const canManageReturnForms = hasPermission("canManageReturnForms")
  const canManageAccountabilityForms = hasPermission("canManageAccountabilityForms")

  // Get page, pageSize, and search from URL
  const page = parseInt(searchParams.get("page") || "1", 10)
  const pageSize = parseInt(searchParams.get("pageSize") || "50", 10)
  const activeTab = (searchParams.get("tab") as "accountability" | "return") || "accountability"

  // Separate states for search input (immediate UI) and search query (debounced API calls)
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "")
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "")
  const [searchType, setSearchType] = useState<"unified" | "employee" | "department" | "formNo">(
    (searchParams.get("searchType") as "unified" | "employee" | "department" | "formNo") || "unified"
  )
  const [isManualRefresh, setIsManualRefresh] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [formToDelete, setFormToDelete] = useState<{ id: string; type: "accountability" | "return"; name: string } | null>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSearchQueryRef = useRef<string>(searchParams.get("search") || "")
  const previousSearchInputRef = useRef<string>(searchParams.get("search") || "")
  const isInitialMount = useRef(true)

  useEffect(() => {
    isInitialMount.current = false
  }, [])

  // Update URL parameters
  const updateURL = useCallback(
    (updates: {
      page?: number
      pageSize?: number
      search?: string
      searchType?: string
      tab?: "accountability" | "return"
    }) => {
      const params = new URLSearchParams(searchParams.toString())

      if (updates.page !== undefined) {
        if (updates.page === 1) {
          params.delete("page")
        } else {
          params.set("page", updates.page.toString())
        }
      }

      if (updates.pageSize !== undefined) {
        if (updates.pageSize === 50) {
          params.delete("pageSize")
        } else {
          params.set("pageSize", updates.pageSize.toString())
        }
        params.delete("page")
      }

      if (updates.search !== undefined) {
        if (updates.search === "") {
          params.delete("search")
          params.delete("searchType")
        } else {
          params.set("search", updates.search)
        }
        params.delete("page")
      }

      if (updates.searchType !== undefined) {
        if (updates.searchType === "unified") {
          params.delete("searchType")
        } else {
          params.set("searchType", updates.searchType)
        }
        params.delete("page")
      }

      if (updates.tab !== undefined) {
        params.set("tab", updates.tab)
        params.delete("page")
      }

      startTransition(() => {
        router.push(`?${params.toString()}`, { scroll: false })
      })
    },
    [searchParams, router, startTransition]
  )

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["forms-history", activeTab, searchQuery, searchType, page, pageSize],
    queryFn: () => fetchForms(activeTab, searchQuery || undefined, searchType, page, pageSize),
    placeholderData: (previousData) => previousData,
    enabled: (activeTab === "return" && canViewReturnForms) || (activeTab === "accountability" && canViewAccountabilityForms),
  })

  // Reset manual refresh flag after successful fetch
  useEffect(() => {
    if (!isFetching && isManualRefresh) {
      setIsManualRefresh(false)
    }
  }, [isFetching, isManualRefresh])

  const handlePageSizeChange = (newPageSize: string) => {
    updateURL({ pageSize: parseInt(newPageSize), page: 1 })
  }

  const handlePageChange = (newPage: number) => {
    updateURL({ page: newPage })
  }

  const handleTabChange = (tab: "accountability" | "return") => {
    updateURL({ tab, page: 1 })
  }

  // Debounce search input
  useEffect(() => {
    if (searchInput === previousSearchInputRef.current) {
      return
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(searchInput)
      previousSearchInputRef.current = searchInput
      const currentSearch = searchParams.get("search") || ""
      if (searchInput !== currentSearch) {
        updateURL({ search: searchInput, page: 1 })
      }
    }, 500)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
        searchTimeoutRef.current = null
      }
    }
  }, [searchInput, searchParams, updateURL])

  // Sync searchInput and searchType with URL params
  useEffect(() => {
    const urlSearch = searchParams.get("search") || ""
    const urlSearchType = (searchParams.get("searchType") as "unified" | "employee" | "department" | "formNo") || "unified"
    const currentSearchQuery = lastSearchQueryRef.current || ""

    if (urlSearchType !== searchType) {
      setSearchType(urlSearchType)
    }

    if (urlSearch !== currentSearchQuery) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
        searchTimeoutRef.current = null
      }
      setSearchInput(urlSearch)
      setSearchQuery(urlSearch)
      previousSearchInputRef.current = urlSearch
      lastSearchQueryRef.current = urlSearch
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    lastSearchQueryRef.current = searchQuery
  }, [searchQuery])

  // Delete form mutation
  const deleteFormMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: "accountability" | "return" }) => {
      const response = await fetch(`/api/forms/history/${id}?type=${type}`, {
        method: "DELETE",
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete form")
      }
      return response.json()
    },
    onMutate: async ({ id, type }) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ["forms-history", activeTab, searchQuery, searchType, page, pageSize] })

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<{
        returnForms?: ReturnForm[]
        accountabilityForms?: AccountabilityForm[]
        pagination: PaginationInfo
        counts?: FormCounts
      }>(["forms-history", activeTab, searchQuery, searchType, page, pageSize])

      // Optimistically update the cache
      if (previousData) {
        const updatedData = { ...previousData }
        if (type === "return" && updatedData.returnForms) {
          updatedData.returnForms = updatedData.returnForms.filter(form => form.id !== id)
          updatedData.pagination = {
            ...updatedData.pagination,
            total: updatedData.pagination.total - 1,
          }
          if (updatedData.counts) {
            updatedData.counts.returnForms = Math.max(0, updatedData.counts.returnForms - 1)
          }
        } else if (type === "accountability" && updatedData.accountabilityForms) {
          updatedData.accountabilityForms = updatedData.accountabilityForms.filter(form => form.id !== id)
          updatedData.pagination = {
            ...updatedData.pagination,
            total: updatedData.pagination.total - 1,
          }
          if (updatedData.counts) {
            updatedData.counts.accountabilityForms = Math.max(0, updatedData.counts.accountabilityForms - 1)
          }
        }

        queryClient.setQueryData(
          ["forms-history", activeTab, searchQuery, searchType, page, pageSize],
          updatedData
        )
      }

      return { previousData }
    },
    onSuccess: async () => {
      // Don't immediately refetch - let the optimistic update persist
      // Only invalidate to mark queries as stale for background refetch
      // This prevents the "flash" of old data before server confirms deletion
      queryClient.invalidateQueries({ 
        queryKey: ["forms-history"],
        refetchType: 'none' // Don't refetch immediately, let optimistic update stay
      })
      toast.success("Form deleted successfully")
      setDeleteDialogOpen(false)
      setFormToDelete(null)
    },
    onError: (error: Error, variables, context) => {
      // Rollback optimistic update on error
      if (context?.previousData) {
        queryClient.setQueryData(
          ["forms-history", activeTab, searchQuery, searchType, page, pageSize],
          context.previousData
        )
      }
      toast.error(error.message || "Failed to delete form")
    },
  })

  const handleDeleteClick = (form: ReturnForm | AccountabilityForm, type: "accountability" | "return") => {
    const formName = type === "accountability"
      ? (form as AccountabilityForm).accountabilityFormNo || `Accountability Form - ${(form as AccountabilityForm).employeeUser.name}`
      : (form as ReturnForm).ctrlNo || `Return Form - ${(form as ReturnForm).employeeUser.name}`
    
    setFormToDelete({ id: form.id, type, name: formName })
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = () => {
    if (formToDelete) {
      deleteFormMutation.mutate({ id: formToDelete.id, type: formToDelete.type })
    }
  }

  const returnForms = data?.returnForms || []
  const accountabilityForms = data?.accountabilityForms || []
  const pagination = data?.pagination
  const counts = data?.counts || { returnForms: 0, accountabilityForms: 0 }
  const currentForms = activeTab === "accountability" ? accountabilityForms : returnForms
  
  // Check if we're fetching data for the current tab (to show loading when switching tabs)
  const isFetchingCurrentTab = isFetching && (
    (activeTab === "accountability" && canViewAccountabilityForms) ||
    (activeTab === "return" && canViewReturnForms)
  )

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6 max-h-screen"
    >
      <div>
        <h1 className="text-3xl font-bold">Forms History</h1>
        <p className="text-muted-foreground">
          View history of Return Forms and Accountability Forms
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b relative">
        <button
          onClick={() => handleTabChange("accountability")}
          className={`px-4 py-2 text-sm font-medium transition-colors relative z-10 ${
            activeTab === "accountability"
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          } ${!canViewAccountabilityForms ? "opacity-50" : ""}`}
        >
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Accountability Forms ({counts.accountabilityForms})
          </div>
          {activeTab === "accountability" && (
            <motion.div
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
        </button>
        <button
          onClick={() => handleTabChange("return")}
          className={`px-4 py-2 text-sm font-medium transition-colors relative z-10 ${
            activeTab === "return"
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          } ${!canViewReturnForms ? "opacity-50" : ""}`}
        >
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Return Forms ({counts.returnForms})
          </div>
          {activeTab === "return" && (
            <motion.div
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          )}
        </button>
      </div>

      <Card className="relative flex flex-col flex-1 min-h-0 pb-0 gap-0">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center w-full md:flex-1 md:max-w-md border rounded-md overflow-hidden">
              <Select
                value={searchType}
                onValueChange={(value: "unified" | "employee" | "department" | "formNo") => {
                  setSearchType(value)
                  updateURL({ searchType: value, page: 1 })
                }}
              >
                <SelectTrigger className="w-[140px] h-8 rounded-none border-0 border-r focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unified">Unified Search</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="department">Department</SelectItem>
                  <SelectItem value="formNo">
                    {activeTab === "accountability" ? "AF No" : "Ctrl No"}
                  </SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                {searchInput ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput("")
                      updateURL({ search: "", page: 1 })
                    }}
                    className="absolute left-2 top-2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors cursor-pointer z-10"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : (
                  <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                )}
                <Input
                  placeholder={
                    searchType === "unified"
                      ? activeTab === "accountability"
                        ? "Search by employee name, email, department, or AF No..."
                        : "Search by employee name, email, department, or Ctrl No..."
                      : searchType === "employee"
                      ? "Search by employee name or email..."
                      : searchType === "department"
                      ? "Search by department..."
                      : activeTab === "accountability"
                      ? "Search by AF No..."
                      : "Search by Ctrl No..."
                  }
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-8 h-8 rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  setIsManualRefresh(true)
                  queryClient.invalidateQueries({ queryKey: ["forms-history"] })
                }}
                className="h-8 w-8"
                title="Refresh table"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 px-0 relative">
          {isFetching && data && currentForms.length > 0 && (
            <div className="absolute left-0 right-[10px] top-[33px] bottom-0 bg-background/50 backdrop-blur-sm z-20 flex items-center justify-center">
              <Spinner variant="default" size={24} className="text-muted-foreground" />
            </div>
          )}
          <div className="h-140 pt-8">
            <AnimatePresence mode="wait">
            {/* Show loading spinner if permissions are loading OR data is loading OR fetching current tab */}
            {(permissionsLoading || (isLoading && !data) || (isFetchingCurrentTab && currentForms.length === 0)) ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center justify-center py-12"
                >
                <div className="flex flex-col items-center gap-3">
                  <Spinner className="h-8 w-8" />
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
                </motion.div>
            ) : /* Check if user doesn't have permission for active tab - only show after permissions are loaded */
            (activeTab === "accountability" && !canViewAccountabilityForms) || (activeTab === "return" && !canViewReturnForms) ? (
                <motion.div
                  key="access-denied"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col items-center justify-center py-12 text-center"
                >
                {activeTab === "accountability" ? (
                  <ClipboardList className="h-12 w-12 text-muted-foreground opacity-50 mb-4" />
                ) : (
                  <FileText className="h-12 w-12 text-muted-foreground opacity-50 mb-4" />
                )}
                <p className="text-lg font-medium">Access Denied</p>
                <p className="text-sm text-muted-foreground">
                  You do not have permission to view {activeTab === "accountability" ? "accountability forms" : "return forms"}.
                </p>
                </motion.div>
            ) : currentForms.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
                className="text-center py-8 text-muted-foreground"
              >
                {activeTab === "accountability" ? (
                  <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                ) : (
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                )}
                <p className="font-medium">
                  {activeTab === "accountability" ? "No accountability forms found" : "No return forms found"}
                </p>
                <p className="text-sm">
                  {searchQuery
                    ? "Try adjusting your search criteria"
                    : activeTab === "accountability"
                    ? "Accountability forms will appear here once submitted"
                    : "Return forms will appear here once submitted"}
                </p>
              </motion.div>
            ) : (
              <div className="min-w-full">
                <ScrollArea className="h-132 relative">
                  <div className="sticky top-0 z-30 h-px bg-border w-full"></div>
                  <div className="pr-2.5 relative after:content-[''] after:absolute after:right-[10px] after:top-0 after:bottom-0 after:w-px after:bg-border after:z-50 after:h-full">
                    <Table className="border-b">
                      <TableHeader className="sticky -top-1 z-20 bg-card [&_tr]:border-b-0 -mr-2.5">
                        <TableRow className="group hover:bg-muted/50 relative border-b-0 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-[1.5px] after:h-px after:bg-border after:z-30">
                          {activeTab === "accountability" ? (
                            <>
                              <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left">
                                Employee
                              </TableHead>
                              <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left">
                                Date Issued
                              </TableHead>
                              <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left">
                                Department
                              </TableHead>
                              <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left">
                                AF No
                              </TableHead>
                              <TableHead className="bg-card transition-colors sticky z-10 right-0 group-hover:bg-card before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border before:z-50 text-center">
                                Actions
                              </TableHead>
                            </>
                          ) : (
                            <>
                              <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left">
                                Employee
                              </TableHead>
                              <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left">
                                Date Returned
                              </TableHead>
                              <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left">
                                Department
                              </TableHead>
                              <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left">
                                Ctrl No
                              </TableHead>
                              <TableHead className="bg-card transition-colors group-hover:bg-muted/50 text-left">
                                Type
                              </TableHead>
                              <TableHead className="bg-card transition-colors sticky z-10 right-0 group-hover:bg-card before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border before:z-50 text-center">
                                Actions
                              </TableHead>
                            </>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <AnimatePresence mode="popLayout">
                          {currentForms.map((form, index) => (
                            <motion.tr
                              key={form.id}
                              layout
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -20 }}
                              transition={{ 
                                duration: 0.4, 
                                delay: isInitialMount.current ? index * 0.08 : 0,
                                ease: "easeOut"
                              }}
                              className="group relative hover:bg-muted/50 border-b transition-colors"
                            >
                            {activeTab === "accountability" ? (
                              <>
                                <TableCell className="text-sm">
                                  <div className="flex flex-col">
                                    <span className="font-medium">
                                      {(form as AccountabilityForm).employeeUser.name}
                                    </span>
                                    <span className="text-muted-foreground text-xs">
                                      {(form as AccountabilityForm).employeeUser.email}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {new Date((form as AccountabilityForm).dateIssued).toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {(form as AccountabilityForm).department ||
                                    (form as AccountabilityForm).employeeUser.department ||
                                    "-"}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {(form as AccountabilityForm).accountabilityFormNo ? (
                                    <Badge variant="outline" className="text-xs">
                                      {(form as AccountabilityForm).accountabilityFormNo}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm sticky text-center right-0 bg-card z-10 before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border before:z-50">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem asChild>
                                        <Link href={`/forms/history/${form.id}?type=accountability`} className="flex items-center cursor-pointer">
                                          <Eye className="mr-2 h-4 w-4" />
                                          View
                                  </Link>
                                      </DropdownMenuItem>
                                      {canManageAccountabilityForms && (
                                        <>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            variant="destructive"
                                            onClick={() => handleDeleteClick(form, "accountability")}
                                            className="cursor-pointer"
                                          >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </>
                            ) : (
                              <>
                                <TableCell className="text-sm">
                                  <div className="flex flex-col">
                                    <span className="font-medium">
                                      {(form as ReturnForm).employeeUser.name}
                                    </span>
                                    <span className="text-muted-foreground text-xs">
                                      {(form as ReturnForm).employeeUser.email}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {new Date((form as ReturnForm).dateReturned).toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {(form as ReturnForm).department ||
                                    (form as ReturnForm).employeeUser.department ||
                                    "-"}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {(form as ReturnForm).ctrlNo ? (
                                    <Badge variant="outline" className="text-xs">
                                      {(form as ReturnForm).ctrlNo}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm">
                                  <Badge
                                    variant={
                                      (form as ReturnForm).returnType === "Resigned Staff"
                                        ? "destructive"
                                        : (form as ReturnForm).returnType === "Return to Office, Resigned Staff"
                                        ? "secondary"
                                        : "default"
                                    }
                                    className={`text-xs ${
                                      (form as ReturnForm).returnType === "Return to Office, Resigned Staff"
                                        ? "bg-orange-500 text-white hover:bg-orange-600"
                                        : ""
                                    }`}
                                  >
                                    {(form as ReturnForm).returnType}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm sticky text-center right-0 bg-card z-10 before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-px before:bg-border before:z-50">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem asChild>
                                        <Link href={`/forms/history/${form.id}?type=return`} className="flex items-center cursor-pointer">
                                          <Eye className="mr-2 h-4 w-4" />
                                          View
                                  </Link>
                                      </DropdownMenuItem>
                                      {canManageReturnForms && (
                                        <>
                                          <DropdownMenuSeparator />
                                          <DropdownMenuItem
                                            variant="destructive"
                                            onClick={() => handleDeleteClick(form, "return")}
                                            className="cursor-pointer"
                                          >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete
                                          </DropdownMenuItem>
                                        </>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </>
                            )}
                          </motion.tr>
                        ))}
                        </AnimatePresence>
                      </TableBody>
                    </Table>
                  </div>
                  <ScrollBar orientation="horizontal" />
                  <ScrollBar orientation="vertical" className="z-50" />
                </ScrollArea>
              </div>
            )}
            </AnimatePresence>
          </div>
        </CardContent>

        {/* Pagination Bar - Fixed at Bottom */}
        <div className="sticky bottom-0 border-t bg-card z-10 shadow-sm mt-auto">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 px-4 sm:px-6 py-3">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (pagination?.hasPreviousPage) {
                    handlePageChange(page - 1)
                  }
                }}
                disabled={!pagination?.hasPreviousPage || isLoading}
                className="h-8 px-2 sm:px-3"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>

              <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                <span className="text-muted-foreground">Page</span>
                <div className="px-1.5 sm:px-2 py-1 rounded-md bg-primary/10 text-primary font-medium text-xs sm:text-sm">
                  {isLoading ? "..." : pagination?.page || page}
                </div>
                <span className="text-muted-foreground">of</span>
                <span className="text-muted-foreground">{isLoading ? "..." : pagination?.totalPages || 1}</span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (pagination?.hasNextPage) {
                    handlePageChange(page + 1)
                  }
                }}
                disabled={!pagination?.hasNextPage || isLoading}
                className="h-8 px-2 sm:px-3"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center justify-center sm:justify-end gap-2 sm:gap-4">
              <Select value={pageSize.toString()} onValueChange={handlePageSizeChange} disabled={isLoading}>
                <SelectTrigger className="h-8 w-auto min-w-[90px] sm:min-w-[100px] text-xs sm:text-sm border-primary/20 bg-primary/10 text-primary font-medium hover:bg-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25 rows</SelectItem>
                  <SelectItem value="50">50 rows</SelectItem>
                  <SelectItem value="100">100 rows</SelectItem>
                  <SelectItem value="200">200 rows</SelectItem>
                  <SelectItem value="500">500 rows</SelectItem>
                </SelectContent>
              </Select>

              <div className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                {isLoading ? (
                  <Spinner className="h-4 w-4" variant="default" />
                ) : (
                  <>
                    <span className="hidden sm:inline">{pagination?.total || 0} records</span>
                    <span className="sm:hidden">{pagination?.total || 0}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title="Delete Form"
        description={formToDelete ? `Are you sure you want to delete "${formToDelete.name}"? This action cannot be undone.` : undefined}
        itemName={formToDelete?.name}
        isLoading={deleteFormMutation.isPending}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loadingLabel="Deleting..."
      />
    </motion.div>
  )
}

export default function FormsHistoryPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Forms History</h1>
          <p className="text-muted-foreground">
            View history of return and accountability forms
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Spinner className="h-8 w-8" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <FormsHistoryPageContent />
    </Suspense>
  )
}
