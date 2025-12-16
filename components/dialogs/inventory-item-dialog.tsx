'use client'

import { useState, useEffect } from 'react'
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
import { ScrollArea } from '../ui/scroll-area'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { LocationSelectField } from '@/components/fields/location-select-field'
import { usePermissions } from '@/hooks/use-permissions'

export interface InventoryItem {
  id: string
  itemCode: string
  name: string
  description: string | null
  category: string | null
  unit: string | null
  currentStock: number
  minStockLevel: number | null
  maxStockLevel: number | null
  unitCost: number | null
  location: string | null
  supplier: string | null
  brand: string | null
  model: string | null
  sku: string | null
  barcode: string | null
  remarks: string | null
}

interface InventoryItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: Partial<InventoryItem>) => void
  item?: InventoryItem | null
  isEdit?: boolean
  isLoading?: boolean
}

export function InventoryItemDialog({
  open,
  onOpenChange,
  onSave,
  item,
  isEdit = false,
  isLoading = false,
}: InventoryItemDialogProps) {
  const [formData, setFormData] = useState<Partial<InventoryItem>>({})
  const [isGeneratingCode, setIsGeneratingCode] = useState(false)
  const { hasPermission } = usePermissions()
  const canManageSetup = hasPermission('canManageSetup')

  const generateItemCode = async () => {
    setIsGeneratingCode(true)
    try {
      const response = await fetch('/api/inventory/generate-code')
      if (!response.ok) {
        throw new Error('Failed to generate item code')
      }
      const data = await response.json()
      setFormData({ ...formData, itemCode: data.itemCode })
    } catch (error) {
      toast.error('Failed to generate item code')
      console.error('Error generating item code:', error)
    } finally {
      setIsGeneratingCode(false)
    }
  }

  useEffect(() => {
    if (open) {
      if (isEdit && item) {
        setFormData({
          itemCode: item.itemCode,
          name: item.name,
          description: item.description || '',
          category: item.category || '',
          unit: item.unit || '',
          minStockLevel: item.minStockLevel,
          maxStockLevel: item.maxStockLevel,
          unitCost: item.unitCost,
          location: item.location || '',
          supplier: item.supplier || '',
          brand: item.brand || '',
          model: item.model || '',
          sku: item.sku || '',
          barcode: item.barcode || '',
          remarks: item.remarks || '',
        })
      } else {
        // Reset form and auto-generate item code when opening for add
        setFormData({})
        generateItemCode()
      }
    } else {
      // Reset form when dialog closes
      setFormData({})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, item])

  const handleSubmit = () => {
    // Clean up form data: convert empty strings to null for optional fields
    const cleanedData: Partial<InventoryItem> = {
      itemCode: formData.itemCode,
      name: formData.name,
      description: formData.description && formData.description.trim() !== '' ? formData.description.trim() : null,
      category: formData.category && formData.category.trim() !== '' ? formData.category.trim() : null,
      unit: formData.unit && formData.unit.trim() !== '' ? formData.unit.trim() : null,
      minStockLevel: formData.minStockLevel !== undefined && formData.minStockLevel !== null && String(formData.minStockLevel).trim() !== '' 
        ? Number(formData.minStockLevel) 
        : null,
      maxStockLevel: formData.maxStockLevel !== undefined && formData.maxStockLevel !== null && String(formData.maxStockLevel).trim() !== '' 
        ? Number(formData.maxStockLevel) 
        : null,
      unitCost: formData.unitCost !== undefined && formData.unitCost !== null && String(formData.unitCost).trim() !== '' 
        ? Number(formData.unitCost) 
        : null,
      location: formData.location && formData.location.trim() !== '' ? formData.location.trim() : null,
      supplier: formData.supplier && formData.supplier.trim() !== '' ? formData.supplier.trim() : null,
      brand: formData.brand && formData.brand.trim() !== '' ? formData.brand.trim() : null,
      model: formData.model && formData.model.trim() !== '' ? formData.model.trim() : null,
      sku: formData.sku && formData.sku.trim() !== '' ? formData.sku.trim() : null,
      barcode: formData.barcode && formData.barcode.trim() !== '' ? formData.barcode.trim() : null,
      remarks: formData.remarks && formData.remarks.trim() !== '' ? formData.remarks.trim() : null,
    }

    if (isEdit) {
      // For updates, exclude currentStock (should only be updated via transactions)
      const { currentStock, ...updateData } = cleanedData
      onSave(updateData)
    } else {
      // For creates, include currentStock
      cleanedData.currentStock = formData.currentStock !== undefined ? Number(formData.currentStock) : 0
      onSave(cleanedData)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl! max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Edit Inventory Item' : 'Add Inventory Item'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update inventory item details'
              : 'Create a new inventory item'}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className='h-[50vh]'>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="itemCode">Item Code *</Label>
              <div className="flex gap-2">
                <Input
                  id="itemCode"
                  value={formData.itemCode || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, itemCode: e.target.value })
                  }
                  placeholder="e.g., INV-001-SA"
                  required
                  disabled={isEdit}
                  className={isEdit ? 'bg-muted' : ''}
                />
                {!isEdit && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={generateItemCode}
                    disabled={isGeneratingCode}
                    className="shrink-0"
                    title="Generate new item code"
                  >
                    {isGeneratingCode ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name || ''}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., Screwdriver Set"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description || ''}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Enter item description"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category || undefined}
                onValueChange={(value) =>
                  setFormData({ ...formData, category: value || null })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Consumables">Consumables</SelectItem>
                  <SelectItem value="Spare Parts">Spare Parts</SelectItem>
                  <SelectItem value="Supplies">Supplies</SelectItem>
                  <SelectItem value="Tools">Tools</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                value={formData.unit || ''}
                onChange={(e) =>
                  setFormData({ ...formData, unit: e.target.value })
                }
                placeholder="pcs, boxes, liters, etc."
              />
            </div>
          </div>
          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="currentStock">Initial Stock</Label>
              <Input
                id="currentStock"
                type="number"
                value={formData.currentStock || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    currentStock: parseFloat(e.target.value) || 0,
                  })
                }
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Stock can only be updated through transactions after creation
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minStockLevel">Min Stock Level</Label>
              <Input
                id="minStockLevel"
                type="number"
                value={formData.minStockLevel || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    minStockLevel: parseFloat(e.target.value) || null,
                  })
                }
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxStockLevel">Max Stock Level</Label>
              <Input
                id="maxStockLevel"
                type="number"
                value={formData.maxStockLevel || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    maxStockLevel: parseFloat(e.target.value) || null,
                  })
                }
                placeholder="0"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="unitCost">Unit Cost</Label>
              <Input
                id="unitCost"
                type="number"
                step="0.01"
                value={formData.unitCost || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    unitCost: parseFloat(e.target.value) || null,
                  })
                }
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <LocationSelectField
                value={formData.location || ''}
                onValueChange={(value) =>
                  setFormData({ ...formData, location: value || null })
                }
                label="Location"
                placeholder="Select or search location"
                canCreate={canManageSetup}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier</Label>
              <Input
                id="supplier"
                value={formData.supplier || ''}
                onChange={(e) =>
                  setFormData({ ...formData, supplier: e.target.value })
                }
                placeholder="e.g., ABC Supplies Inc."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                value={formData.brand || ''}
                onChange={(e) =>
                  setFormData({ ...formData, brand: e.target.value })
                }
                placeholder="e.g., Brand Name"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={formData.model || ''}
                onChange={(e) =>
                  setFormData({ ...formData, model: e.target.value })
                }
                placeholder="e.g., Model XYZ-123"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={formData.sku || ''}
                onChange={(e) =>
                  setFormData({ ...formData, sku: e.target.value })
                }
                placeholder="e.g., SKU-12345"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="barcode">Barcode</Label>
            <Input
              id="barcode"
              value={formData.barcode || ''}
              onChange={(e) =>
                setFormData({ ...formData, barcode: e.target.value })
              }
              placeholder="e.g., 1234567890123"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="remarks">Remarks</Label>
            <Input
              id="remarks"
              value={formData.remarks || ''}
              onChange={(e) =>
                setFormData({ ...formData, remarks: e.target.value })
              }
              placeholder="Additional notes or comments"
            />
          </div>
        </div>
        </ScrollArea>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className='btn-glass'
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !formData.itemCode || !formData.name}
          >
            {isLoading ? (
              <Spinner className="mr-2 h-4 w-4" />
            ) : null}
            {isEdit ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

