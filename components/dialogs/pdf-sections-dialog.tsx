'use client'

import { useState } from 'react'
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
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'

export interface PdfSections {
  basicDetails: boolean
  checkout: boolean
  creation: boolean
  auditHistory: boolean
  maintenance: boolean
  reservations: boolean
  historyLogs: boolean
  photos: boolean
  documents: boolean
}

interface PdfSectionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (sections: PdfSections) => void
  defaultSections?: Partial<PdfSections>
}

const defaultSections: PdfSections = {
  basicDetails: true,
  checkout: true,
  creation: true,
  auditHistory: true,
  maintenance: true,
  reservations: true,
  historyLogs: true,
  photos: true,
  documents: true,
}

export function PdfSectionsDialog({
  open,
  onOpenChange,
  onConfirm,
  defaultSections: initialSections,
}: PdfSectionsDialogProps) {
  const [sections, setSections] = useState<PdfSections>({
    ...defaultSections,
    ...initialSections,
  })

  const handleToggle = (key: keyof PdfSections) => {
    setSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const allSelected = Object.values(sections).every((value) => value === true)
  
  const handleToggleAll = () => {
    if (allSelected) {
      setSections({
        basicDetails: false,
        checkout: false,
        creation: false,
        auditHistory: false,
        maintenance: false,
        reservations: false,
        historyLogs: false,
        photos: false,
        documents: false,
      })
    } else {
      setSections({
        basicDetails: true,
        checkout: true,
        creation: true,
        auditHistory: true,
        maintenance: true,
        reservations: true,
        historyLogs: true,
        photos: true,
        documents: true,
      })
    }
  }

  const handleConfirm = () => {
    // Ensure at least one section is selected
    const hasSelection = Object.values(sections).some((value) => value === true)
    if (!hasSelection) {
      return
    }
    onConfirm(sections)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Select PDF Sections</DialogTitle>
          <DialogDescription>
            Choose which sections to include in the PDF download
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-end mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleAll}
                className="h-8"
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="basicDetails"
                  checked={sections.basicDetails}
                  onCheckedChange={() => handleToggle('basicDetails')}
                />
                <Label
                  htmlFor="basicDetails"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Basic Details
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="checkout"
                  checked={sections.checkout}
                  onCheckedChange={() => handleToggle('checkout')}
                />
                <Label
                  htmlFor="checkout"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Checkout Information
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="creation"
                  checked={sections.creation}
                  onCheckedChange={() => handleToggle('creation')}
                />
                <Label
                  htmlFor="creation"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Creation Details
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="auditHistory"
                  checked={sections.auditHistory}
                  onCheckedChange={() => handleToggle('auditHistory')}
                />
                <Label
                  htmlFor="auditHistory"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Audit History
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="maintenance"
                  checked={sections.maintenance}
                  onCheckedChange={() => handleToggle('maintenance')}
                />
                <Label
                  htmlFor="maintenance"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Maintenance Records
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="reservations"
                  checked={sections.reservations}
                  onCheckedChange={() => handleToggle('reservations')}
                />
                <Label
                  htmlFor="reservations"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Reservations
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="historyLogs"
                  checked={sections.historyLogs}
                  onCheckedChange={() => handleToggle('historyLogs')}
                />
                <Label
                  htmlFor="historyLogs"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  History Logs
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="photos"
                  checked={sections.photos}
                  onCheckedChange={() => handleToggle('photos')}
                />
                <Label
                  htmlFor="photos"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Photos
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="documents"
                  checked={sections.documents}
                  onCheckedChange={() => handleToggle('documents')}
                />
                <Label
                  htmlFor="documents"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Documents
                </Label>
              </div>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!Object.values(sections).some((value) => value === true)}
          >
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

