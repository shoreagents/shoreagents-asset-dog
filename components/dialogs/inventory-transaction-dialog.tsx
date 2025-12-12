'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import {
  ArrowUpFromLine,
  ArrowDownToLine,
  Settings,
  Package,
} from 'lucide-react'
import { toast } from 'sonner'

export interface InventoryItem {
  id: string
  name: string
  currentStock: number
  unit: string | null
  unitCost?: number | null
}

interface InventoryItemOption {
  id: string
  itemCode: string
  name: string
}

interface InventoryTransactionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: {
    transactionType: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER'
    quantity: number
    unitCost?: number | null
    reference?: string | null
    notes?: string | null
    destinationItemId?: string | null
  }) => void
  item: InventoryItem | null
  isLoading?: boolean
}

export function InventoryTransactionDialog({
  open,
  onOpenChange,
  onSubmit,
  item,
  isLoading = false,
}: InventoryTransactionDialogProps) {
  const [transactionData, setTransactionData] = useState<{
    transactionType: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER'
    quantity: string
    unitCost: string
    reference: string
    notes: string
    destinationItemId: string
  }>({
    transactionType: 'IN',
    quantity: '',
    unitCost: '',
    reference: '',
    notes: '',
    destinationItemId: '',
  })

  // Fetch inventory items for destination selector (only when TRANSFER is selected)
  const { data: inventoryItemsData } = useQuery<{ items: InventoryItemOption[] }>({
    queryKey: ['inventory-items-for-transfer'],
    queryFn: async () => {
      const response = await fetch('/api/inventory?pageSize=1000')
      if (!response.ok) throw new Error('Failed to fetch inventory items')
      return response.json()
    },
    enabled: open && transactionData.transactionType === 'TRANSFER',
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  useEffect(() => {
    if (open) {
      // Pre-fill unit cost from item when dialog opens (if available)
      setTransactionData((prev) => ({
        ...prev,
        unitCost: item?.unitCost?.toString() || '',
      }))
    } else {
      // Reset form when dialog closes
      setTransactionData({
        transactionType: 'IN',
        quantity: '',
        unitCost: '',
        reference: '',
        notes: '',
        destinationItemId: '',
      })
    }
  }, [open, item])

  const handleSubmit = () => {
    if (!item) return

    const quantity = parseFloat(transactionData.quantity)
    if (!quantity || quantity <= 0) {
      toast.error('Please enter a valid quantity')
      return
    }

    if (transactionData.transactionType === 'OUT' || transactionData.transactionType === 'TRANSFER') {
      const currentStock = Math.floor(parseFloat(item.currentStock.toString()))
      if (quantity > currentStock) {
        toast.error(`Insufficient stock. Current stock: ${currentStock}`)
        return
      }
    }

    // Validate destination item for TRANSFER
    if (transactionData.transactionType === 'TRANSFER' && !transactionData.destinationItemId) {
      toast.error('Please select a destination item for transfer')
      return
    }

    if (transactionData.transactionType === 'TRANSFER' && transactionData.destinationItemId === item.id) {
      toast.error('Cannot transfer to the same item')
      return
    }

    onSubmit({
      transactionType: transactionData.transactionType,
      quantity: quantity,
      unitCost: transactionData.unitCost ? parseFloat(transactionData.unitCost) : null,
      reference: transactionData.reference.trim() || null,
      notes: transactionData.notes.trim() || null,
      destinationItemId: transactionData.transactionType === 'TRANSFER' ? transactionData.destinationItemId : null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg!">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
          <DialogDescription>
            {item && (
              <>
                Update stock for <strong>{item.name}</strong>
                <br />
                Current stock: <strong>{Math.floor(parseFloat(item.currentStock.toString()))} {item.unit || 'pcs'}</strong>
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="transactionType">Transaction Type *</Label>
            <Select
              value={transactionData.transactionType}
              onValueChange={(value: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER') =>
                setTransactionData({ ...transactionData, transactionType: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="IN">
                  <span className="flex items-center">
                    <ArrowUpFromLine className="mr-2 h-4 w-4 text-green-600" />
                    IN (Add Stock)
                  </span>
                </SelectItem>
                <SelectItem value="OUT">
                  <span className="flex items-center">
                    <ArrowDownToLine className="mr-2 h-4 w-4 text-red-600" />
                    OUT (Remove Stock)
                  </span>
                </SelectItem>
                <SelectItem value="ADJUSTMENT">
                  <span className="flex items-center">
                    <Settings className="mr-2 h-4 w-4 text-blue-600" />
                    ADJUSTMENT (Adjust Stock)
                  </span>
                </SelectItem>
                <SelectItem value="TRANSFER">
                  <span className="flex items-center">
                    <Package className="mr-2 h-4 w-4 text-orange-600" />
                    TRANSFER (Move to Another Item)
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          {transactionData.transactionType === 'TRANSFER' && (
            <div className="space-y-2">
              <Label htmlFor="destinationItem">Destination Item *</Label>
              <Select
                value={transactionData.destinationItemId}
                onValueChange={(value) =>
                  setTransactionData({ ...transactionData, destinationItemId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select destination item" />
                </SelectTrigger>
                <SelectContent>
                  {inventoryItemsData?.items
                    ?.filter((invItem) => invItem.id !== item?.id)
                    .map((invItem) => (
                      <SelectItem key={invItem.id} value={invItem.id}>
                        {invItem.itemCode} - {invItem.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Stock will be transferred from <strong>{item?.name}</strong> to the selected item
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                min="0"
                value={transactionData.quantity}
                onChange={(e) =>
                  setTransactionData({ ...transactionData, quantity: e.target.value })
                }
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unitCost">Unit Cost</Label>
              <Input
                id="unitCost"
                type="number"
                step="0.01"
                min="0"
                value={transactionData.unitCost}
                onChange={(e) =>
                  setTransactionData({ ...transactionData, unitCost: e.target.value })
                }
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reference">Reference</Label>
            <Input
              id="reference"
              value={transactionData.reference}
              onChange={(e) =>
                setTransactionData({ ...transactionData, reference: e.target.value })
              }
              placeholder="PO number, invoice, etc."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={transactionData.notes}
              onChange={(e) =>
                setTransactionData({ ...transactionData, notes: e.target.value })
              }
              placeholder="Additional notes..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !transactionData.quantity}
          >
            {isLoading ? (
              <Spinner className="mr-2 h-4 w-4" />
            ) : null}
            Create Transaction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

