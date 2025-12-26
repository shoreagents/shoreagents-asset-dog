'use client'

import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Plus, Package, AlertTriangle, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface InventoryItem {
  id: string
  itemCode: string
  name: string
  currentStock: number
  unit: string | null
  unitCost: number | null
  minStockLevel: number | null
}

interface SelectedInventoryItem {
  inventoryItemId: string
  itemCode: string
  name: string
  quantity: number
  unitCost: number | null
  availableStock: number
  unit: string | null
  minStockLevel: number | null
}

// Format currency in PHP with commas
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

interface InventoryItemsSelectorProps {
  value?: SelectedInventoryItem[]
  onChange?: (items: SelectedInventoryItem[]) => void
  disabled?: boolean
  showStockWarnings?: boolean
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
    const { createClient } = await import('@/lib/supabase-client')
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

async function fetchInventoryItems(search?: string): Promise<InventoryItem[]> {
  const baseUrl = getApiBaseUrl()
  const params = new URLSearchParams()
  if (search) {
    params.append('search', search)
  }
  params.append('pageSize', '100') // Fetch more items for selection
  
  const token = await getAuthToken()
  const headers: HeadersInit = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  const response = await fetch(`${baseUrl}/api/inventory?${params.toString()}`, {
    credentials: 'include',
    headers,
  })
  if (!response.ok) {
    throw new Error('Failed to fetch inventory items')
  }
  const data = await response.json()
  return data.items || []
}

export function InventoryItemsSelector({
  value = [],
  onChange,
  disabled = false,
  showStockWarnings = true,
}: InventoryItemsSelectorProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItems, setSelectedItems] = useState<SelectedInventoryItem[]>(value)

  // Update local state when value prop changes
  useEffect(() => {
    setSelectedItems(value)
  }, [value])

  const { data: inventoryItems = [], isLoading: isLoadingItems } = useQuery({
    queryKey: ['inventory-items-for-maintenance', searchQuery],
    queryFn: () => fetchInventoryItems(searchQuery),
    enabled: open,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Filter out already selected items
  const availableItems = inventoryItems.filter(
    (item) => !selectedItems.some((selected) => selected.inventoryItemId === item.id)
  )

  const handleAddItem = (item: InventoryItem) => {
    const newItem: SelectedInventoryItem = {
      inventoryItemId: item.id,
      itemCode: item.itemCode,
      name: item.name,
      quantity: 1,
      unitCost: item.unitCost ? parseFloat(item.unitCost.toString()) : null,
      availableStock: parseFloat(item.currentStock.toString()),
      unit: item.unit,
      minStockLevel: item.minStockLevel ? parseFloat(item.minStockLevel.toString()) : null,
    }
    
    const updatedItems = [...selectedItems, newItem]
    setSelectedItems(updatedItems)
    onChange?.(updatedItems)
    setOpen(false)
    setSearchQuery('')
  }

  const handleRemoveItem = (itemId: string) => {
    const updatedItems = selectedItems.filter((item) => item.inventoryItemId !== itemId)
    setSelectedItems(updatedItems)
    onChange?.(updatedItems)
  }

  const handleQuantityChange = (itemId: string, quantity: string) => {
    const numQuantity = parseFloat(quantity) || 0
    const updatedItems = selectedItems.map((item) =>
      item.inventoryItemId === itemId
        ? { ...item, quantity: numQuantity }
        : item
    )
    setSelectedItems(updatedItems)
    onChange?.(updatedItems)
  }

  const getStockWarning = (item: SelectedInventoryItem) => {
    if (!showStockWarnings) return null
    
    if (item.quantity > item.availableStock) {
      return { type: 'error', message: 'Insufficient stock' }
    }
    if (item.minStockLevel !== null && item.availableStock - item.quantity <= item.minStockLevel) {
      return { type: 'warning', message: 'Stock will be below minimum level' }
    }
    return null
  }

  const calculateTotal = () => {
    return selectedItems.reduce((total, item) => {
      const cost = item.unitCost ? item.unitCost * item.quantity : 0
      return total + cost
    }, 0)
  }

  return (
    <div className="space-y-4">
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex-1">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                Inventory Items Used
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Add parts, consumables, or supplies used in this maintenance
              </CardDescription>
            </div>
            <div className="shrink-0">
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    className="h-9 gap-2 w-full md:w-auto bg-transparent dark:bg-input/30"
                  >
                    <Plus className="h-4 w-4" />
                    Add Item
                  </Button>
                </PopoverTrigger>
              <PopoverContent className="w-[calc(100vw-2rem)] md:w-[450px] p-0" align={isMobile ? "center" : "end"}>
                <Command>
                  <div className="flex items-center border-b px-3">
                    <Package className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <CommandInput
                      placeholder="Search by item code or name..."
                      value={searchQuery}
                      onValueChange={setSearchQuery}
                      className="border-0 focus:ring-0"
                    />
                  </div>
                  <CommandList className="max-h-[320px]">
                    <CommandEmpty>
                      {isLoadingItems ? (
                        <div className="flex flex-col items-center justify-center py-8">
                          <Spinner className="h-5 w-5 mb-2" />
                          <p className="text-sm text-muted-foreground">Loading items...</p>
                        </div>
                      ) : (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No inventory items found</p>
                          <p className="text-xs mt-1">Try a different search term</p>
                        </div>
                      )}
                    </CommandEmpty>
                    <CommandGroup>
                      {availableItems.map((item) => {
                        const stock = parseFloat(item.currentStock.toString())
                        const isLowStock = item.minStockLevel !== null && stock <= item.minStockLevel
                        
                        return (
                          <CommandItem
                            key={item.id}
                            value={`${item.itemCode} ${item.name}`}
                            onSelect={() => handleAddItem(item)}
                            className="flex items-start gap-3 py-3 px-4 cursor-pointer"
                          >
                            <div className="mt-0.5">
                              <Package className={cn(
                                "h-4 w-4",
                                isLowStock ? "text-destructive" : "text-muted-foreground"
                              )} />
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-semibold text-sm">{item.itemCode}</span>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-sm font-medium truncate">{item.name}</span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <TrendingDown className="h-3 w-3" />
                                  Stock: <span className="font-medium">{stock}</span> {item.unit || 'units'}
                                </span>
                                {item.unitCost && (
                                  <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                      ₱{formatCurrency(parseFloat(item.unitCost.toString()))}
                                    </span>
                                  </>
                                )}
                              </div>
                              {isLowStock && (
                                <Badge variant="destructive" className="text-xs mt-1 w-fit">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Low Stock
                                </Badge>
                              )}
                            </div>
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {selectedItems.length > 0 ? (
            <div className="space-y-4">
              {/* Desktop Table View */}
              <div className="hidden md:block rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-semibold">Item Details</TableHead>
                      <TableHead className="font-semibold">Quantity</TableHead>
                      <TableHead className="font-semibold">Unit Cost</TableHead>
                      <TableHead className="font-semibold text-right">Line Total</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedItems.map((item, index) => {
                      const warning = getStockWarning(item)
                      const total = item.unitCost ? item.unitCost * item.quantity : 0
                      const stockPercentage = item.availableStock > 0 
                        ? (item.quantity / item.availableStock) * 100 
                        : 0
                      
                      return (
                        <React.Fragment key={item.inventoryItemId}>
                          <TableRow 
                            className={cn(
                              "group",
                              warning?.type === 'error' && "bg-destructive/5"
                            )}
                          >
                            <TableCell>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <div>
                                    <div className="font-mono font-semibold text-sm">{item.itemCode}</div>
                                    <div className="text-sm text-muted-foreground">{item.name}</div>
                                  </div>
                                </div>
                                {warning && (
                                  <div className={cn(
                                    "flex items-center gap-1.5 text-xs px-2 py-1 rounded-md",
                                    warning.type === 'error' 
                                      ? "bg-destructive/10 text-destructive border border-destructive/20" 
                                      : "bg-yellow-500/10 text-yellow-700 dark:text-yellow-500 border border-yellow-500/20"
                                  )}>
                                    <AlertTriangle className="h-3 w-3 shrink-0" />
                                    <span className="font-medium">{warning.message}</span>
                                  </div>
                                )}
                                {!warning && item.availableStock > 0 && (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                      <div 
                                        className={cn(
                                          "h-full transition-all",
                                          stockPercentage > 80 ? "bg-destructive" :
                                          stockPercentage > 50 ? "bg-yellow-500" :
                                          "bg-green-500"
                                        )}
                                        style={{ width: `${Math.min(stockPercentage, 100)}%` }}
                                      />
                                    </div>
                                    <span className="shrink-0">
                                      {item.availableStock} {item.unit || 'available'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1.5">
                                <Input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={item.quantity || ''}
                                  onChange={(e) => handleQuantityChange(item.inventoryItemId, e.target.value)}
                                  disabled={disabled}
                                  className={cn(
                                    "h-9 w-24 font-medium",
                                    warning?.type === 'error' && "border-destructive focus-visible:ring-destructive"
                                  )}
                                />
                                {item.unit && (
                                  <div className="text-xs text-muted-foreground">{item.unit}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm font-medium text-muted-foreground">
                                {item.unitCost ? `₱${formatCurrency(item.unitCost)}` : '-'}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-right">
                                <div className="font-semibold text-sm">
                                  {total > 0 ? `₱${formatCurrency(total)}` : '-'}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveItem(item.inventoryItemId)}
                                disabled={disabled}
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                          {index < selectedItems.length - 1 && (
                            <TableRow className="hover:bg-transparent">
                              <TableCell colSpan={5} className="p-0">
                                <Separator />
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {selectedItems.map((item, index) => {
                  const warning = getStockWarning(item)
                  const total = item.unitCost ? item.unitCost * item.quantity : 0
                  const stockPercentage = item.availableStock > 0 
                    ? (item.quantity / item.availableStock) * 100 
                    : 0
                  
                  return (
                    <Card
                      key={item.inventoryItemId}
                      className={cn(
                        warning?.type === 'error' && "bg-destructive/5 border-destructive/20"
                      )}
                    >
                      <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <div className="font-mono font-semibold text-sm">{item.itemCode}</div>
                              <div className="text-sm text-muted-foreground truncate">{item.name}</div>
                            </div>
                          </div>
                          {warning && (
                            <div className={cn(
                              "flex items-center gap-1.5 text-xs px-2 py-1 rounded-md mt-2",
                              warning.type === 'error' 
                                ? "bg-destructive/10 text-destructive border border-destructive/20" 
                                : "bg-yellow-500/10 text-yellow-700 dark:text-yellow-500 border border-yellow-500/20"
                            )}>
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              <span className="font-medium">{warning.message}</span>
                            </div>
                          )}
                          {!warning && item.availableStock > 0 && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={cn(
                                    "h-full transition-all",
                                    stockPercentage > 80 ? "bg-destructive" :
                                    stockPercentage > 50 ? "bg-yellow-500" :
                                    "bg-green-500"
                                  )}
                                  style={{ width: `${Math.min(stockPercentage, 100)}%` }}
                                />
                              </div>
                              <span className="shrink-0">
                                {item.availableStock} {item.unit || 'available'}
                              </span>
                            </div>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveItem(item.inventoryItemId)}
                          disabled={disabled}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3 pt-2 border-t">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Quantity</div>
                          <div className="space-y-1">
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              value={item.quantity || ''}
                              onChange={(e) => handleQuantityChange(item.inventoryItemId, e.target.value)}
                              disabled={disabled}
                              className={cn(
                                "h-9 font-medium",
                                warning?.type === 'error' && "border-destructive focus-visible:ring-destructive"
                              )}
                            />
                            {item.unit && (
                              <div className="text-xs text-muted-foreground">{item.unit}</div>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Unit Cost</div>
                          <div className="text-sm font-medium">
                            {item.unitCost ? `₱${formatCurrency(item.unitCost)}` : '-'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Line Total</div>
                          <div className="text-sm font-semibold">
                            {total > 0 ? `₱${formatCurrency(total)}` : '-'}
                          </div>
                        </div>
                      </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
              
              {calculateTotal() > 0 && (
                <div className="flex items-center justify-end gap-4 ">
                  <div className="flex items-center gap-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Total Inventory Cost</div>
                      <div className="text-xl font-bold">₱{formatCurrency(calculateTotal())}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-muted/20 p-8 text-center">
              <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground mb-1">No inventory items selected</p>
              <p className="text-xs text-muted-foreground mb-4">
                Click &quot;Add Item&quot; to add parts, consumables, or supplies used in this maintenance
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(true)}
                disabled={disabled}
                className="gap-2 bg-transparent dark:bg-input/30"
              >
                <Plus className="h-4 w-4" />
                Add Your First Item
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

