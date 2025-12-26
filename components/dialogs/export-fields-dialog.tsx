'use client'

import { Download } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/shadcn-io/spinner'

interface ExportField {
  key: string
  label: string
}

interface ExportFieldsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fields: ExportField[]
  selectedFields: Set<string>
  onFieldToggle: (fieldKey: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  onExport: () => void
  title?: string
  description?: string
  exportButtonLabel?: string
  isExporting?: boolean
  summaryFields?: ExportField[]
  selectedSummaryFields?: Set<string>
  onSummaryFieldToggle?: (fieldKey: string) => void
  onSelectAllSummary?: () => void
  onDeselectAllSummary?: () => void
}

export function ExportFieldsDialog({
  open,
  onOpenChange,
  fields,
  selectedFields,
  onFieldToggle,
  onSelectAll,
  onDeselectAll,
  onExport,
  title = 'Select Fields to Export',
  description = 'Choose which fields to include in your export file',
  exportButtonLabel = 'Export',
  isExporting = false,
  summaryFields = [],
  selectedSummaryFields = new Set(),
  onSummaryFieldToggle,
  onSelectAllSummary,
  onDeselectAllSummary,
}: ExportFieldsDialogProps) {
  const allSelected = selectedFields.size === fields.length
  const toggleSelectAll = allSelected ? onDeselectAll : onSelectAll
  const allSummarySelected = summaryFields.length > 0 && selectedSummaryFields.size === summaryFields.length
  const toggleSelectAllSummary = allSummarySelected ? onDeselectAllSummary : onSelectAllSummary

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

       <ScrollArea className="h-[500px]">
       <div className="space-y-4 py-4">
          {/* Summary Fields Section */}
          {summaryFields.length > 0 && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-sm font-semibold">Summary Fields</span>
                  {onSelectAllSummary && onDeselectAllSummary && (
                    <Button variant="outline" size="sm" className='bg-transparent dark:bg-input/30' onClick={toggleSelectAllSummary}>
                      {allSummarySelected ? 'Deselect All' : 'Select All'}
                    </Button>
                  )}
                </div>
                <div className="space-y-2 pl-2">
                  {summaryFields.map((field) => (
                    <label
                      key={field.key}
                      className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-2 rounded-md"
                    >
                      <Checkbox
                        checked={selectedSummaryFields.has(field.key)}
                        onCheckedChange={() => onSummaryFieldToggle?.(field.key)}
                      />
                      <span className="text-sm">{field.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="border-t pt-2" />
            </>
          )}

          {/* Item Fields Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-sm font-semibold">
                Item Fields ({selectedFields.size} of {fields.length} selected)
              </span>
              <Button variant="outline" size="sm" className='bg-transparent dark:bg-input/30' onClick={toggleSelectAll}>
                {allSelected ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2 pr-4">
                {fields.map((field) => (
                  <label
                    key={field.key}
                    className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-2 rounded-md"
                  >
                    <Checkbox
                      checked={selectedFields.has(field.key)}
                      onCheckedChange={() => onFieldToggle(field.key)}
                    />
                    <span className="text-sm">{field.label}</span>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
       </ScrollArea>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
            className='btn-glass'
          >
            Cancel
          </Button>
          <Button onClick={onExport} disabled={(selectedFields.size === 0 && selectedSummaryFields.size === 0) || isExporting}>
            {isExporting ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Exporting...
              </>
            ) : (
              <>
            <Download className="mr-2 h-4 w-4" />
            {exportButtonLabel}
            {((selectedFields.size > 0 || selectedSummaryFields.size > 0) && 
              ` (${selectedFields.size + selectedSummaryFields.size} ${selectedFields.size + selectedSummaryFields.size === 1 ? 'field' : 'fields'})`)}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

