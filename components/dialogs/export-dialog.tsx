'use client'

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Download, FileText, FileSpreadsheet, Filter } from 'lucide-react'
import { format } from 'date-fns'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import type { LucideIcon } from 'lucide-react'

export interface ExportDialogFilters {
  [key: string]: string | boolean | null | undefined
}

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reportType: string
  reportTypeIcon?: LucideIcon
  exportFormat: 'csv' | 'excel' | 'pdf' | null
  filters: ExportDialogFilters
  includeList: boolean
  onIncludeListChange: (checked: boolean) => void
  includeListLabel: string
  includeListDescription?: string
  exportDescription?: (format: 'csv' | 'excel' | 'pdf', includeList: boolean) => string
  isExporting: boolean
  onConfirm: () => void
  onCancel?: () => void
  formatFilterValue?: (key: string, value: unknown) => string | React.ReactNode
}

export function ExportDialog({
  open,
  onOpenChange,
  reportType,
  reportTypeIcon: ReportTypeIcon = FileText,
  exportFormat,
  filters,
  includeList,
  onIncludeListChange,
  includeListLabel,
  includeListDescription,
  exportDescription,
  isExporting,
  onConfirm,
  onCancel,
  formatFilterValue,
}: ExportDialogProps) {
  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    } else {
      onOpenChange(false)
    }
  }

  // Default filter value formatter
  const defaultFormatFilterValue = (key: string, value: unknown): string => {
    if (value === true) {
      return key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')
    }
    if (typeof value === 'string') {
      // Try to parse as date
      const date = new Date(value)
      if (!isNaN(date.getTime()) && value.includes('-')) {
        return format(date, 'MMM d, yyyy')
      }
      return value
    }
    return String(value)
  }

  const formatValue = formatFilterValue || defaultFormatFilterValue

  // Get active filters - ensure filters is always an object
  const safeFilters = filters || {}
  const activeFilters = Object.entries(safeFilters).filter(([, value]) => {
    if (value === null || value === undefined || value === '') return false
    if (typeof value === 'boolean') return value === true
    return true
  })

  // Default export description generator
  const defaultExportDescription = (format: 'csv' | 'excel' | 'pdf', includeList: boolean): string => {
    const listIncluded = includeList ? 'Details table will be included.' : 'Details table will not be included.'
    
    if (format === 'pdf') {
      return `This will export ${reportType.toLowerCase()} information. ${listIncluded}`
    }
    
    return `This will export ${reportType.toLowerCase()} information. ${includeList ? 'Details table with complete data will be included.' : 'Only summary statistics will be exported (no details list).'}`
  }

  const getDescription = exportDescription || defaultExportDescription

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-400 bg-clip-padding backdrop-filter backdrop-blur-md bg-opacity-10 border shadow-2xl max-w-2xl! max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Download className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
            <span className="wrap-break-word">Confirm Export</span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Review your export settings before downloading
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-y-auto">
          {/* Report Type */}
          <div className="space-y-2">
            <h4 className="text-xs sm:text-sm font-semibold flex items-center gap-2">
              <ReportTypeIcon className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
              <span>Report Type</span>
            </h4>
            <div className="pl-4 sm:pl-6">
              <Badge variant="default" className="text-xs sm:text-sm wrap-break-word max-w-full inline-block">
                {reportType}
              </Badge>
            </div>
          </div>

          {/* Export Format */}
          {exportFormat && (
            <div className="space-y-2">
              <h4 className="text-xs sm:text-sm font-semibold flex items-center gap-2">
                <FileSpreadsheet className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                <span>Export Format</span>
              </h4>
              <div className="pl-4 sm:pl-6">
                <Badge variant="secondary" className="text-xs sm:text-sm uppercase">
                  {exportFormat}
                </Badge>
              </div>
            </div>
          )}

          {/* Active Filters */}
          <div className="space-y-2">
            <h4 className="text-xs sm:text-sm font-semibold flex items-center gap-2">
              <Filter className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
              <span>Active Filters</span>
            </h4>
            <div className="pl-4 sm:pl-6 space-y-1">
              {activeFilters.length === 0 ? (
                <p className="text-xs sm:text-sm text-muted-foreground wrap-break-word">
                  No filters applied - All records will be included
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {activeFilters.map(([key, value]) => {
                    const formattedValue = formatValue(key, value)
                    const displayKey = key
                      .replace(/([A-Z])/g, ' $1')
                      .replace(/^./, (str) => str.toUpperCase())
                      .trim()

                    return (
                      <Badge key={key} variant="outline" className="text-xs wrap-break-word max-w-full">
                        <span className="wrap-break-word">{displayKey}: {typeof formattedValue === 'string' ? formattedValue : String(formattedValue)}</span>
                      </Badge>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Include List Option */}
          {exportFormat && includeListDescription && (
            <div className="space-y-2">
              <div className="flex items-start sm:items-center gap-2 p-2 sm:p-3 rounded-lg border border-border bg-muted/30">
                <Checkbox
                  id="include-list"
                  checked={includeList}
                  onCheckedChange={(checked) => onIncludeListChange(checked === true)}
                  className="mt-0.5 sm:mt-0 shrink-0"
                />
                <Label
                  htmlFor="include-list"
                  className="text-xs sm:text-sm font-medium cursor-pointer flex-1 wrap-break-word"
                >
                  {includeListLabel}
                </Label>
              </div>
              <p className="text-xs text-muted-foreground pl-2 sm:pl-3 wrap-break-word">
                {includeListDescription}
              </p>
            </div>
          )}

          {/* Export Description */}
          {exportFormat && (
            <div className="bg-muted/50 p-2 sm:p-3 rounded-lg">
              <p className="text-xs sm:text-sm text-muted-foreground wrap-break-word">
                {getDescription(exportFormat, includeList)}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isExporting}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isExporting} className="w-full sm:w-auto">
            {isExporting ? (
              <>
                <Spinner className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Exporting...</span>
                <span className="sm:hidden">Exporting</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

