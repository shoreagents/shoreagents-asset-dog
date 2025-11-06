'use client'

import { useState, useRef, useEffect } from 'react'
import { QrCode, Upload } from 'lucide-react'
import { Scanner } from '@yudiel/react-qr-scanner'
import { Html5Qrcode } from 'html5-qrcode'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface QRScannerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScan: (decodedText: string) => void | Promise<void>
  title?: string
  description?: string
  scanButtonLabel?: string
  uploadButtonLabel?: string
}

export function QRScannerDialog({
  open,
  onOpenChange,
  onScan,
  title = 'QR Code Scanner',
  description = 'Scan or upload a QR code',
  scanButtonLabel = 'Scan',
  uploadButtonLabel = 'Upload',
}: QRScannerDialogProps) {
  const qrScanContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [qrMode, setQrMode] = useState<'scan' | 'upload'>('scan')
  const [scannedCode, setScannedCode] = useState<string>('')

  // Reset scanned code when dialog closes
  useEffect(() => {
    if (!open) {
      // Use setTimeout to avoid cascading renders
      setTimeout(() => {
        setScannedCode('')
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }, 0)
    }
  }, [open])

  // Handle QR code scan result
  const handleQRScanResult = async (
    results: Array<{ rawValue?: string; text?: string }> | string | undefined
  ) => {
    if (!results) return

    let decodedText: string | undefined

    // Handle different result types
    if (typeof results === 'string') {
      decodedText = results
    } else if (Array.isArray(results) && results.length > 0) {
      const result = results[0]
      decodedText = result.rawValue || result.text || (typeof result === 'string' ? result : undefined)
    }

    if (!decodedText || !decodedText.trim()) return

    const trimmedText = decodedText.trim()
    setScannedCode(trimmedText)
    onOpenChange(false)

    // Call the onScan callback
    try {
      await onScan(trimmedText)
    } catch (error) {
      console.error('Error in onScan callback:', error)
      toast.error('Failed to process scanned QR code')
    }
  }

  // Handle QR code upload
  const handleQRUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    let html5QrCode: Html5Qrcode | null = null

    try {
      html5QrCode = new Html5Qrcode('qr-reader')

      const decodedText = await html5QrCode.scanFile(file, false)

      // Clean up the scanner
      try {
        html5QrCode.clear()
      } catch {
        // Ignore cleanup errors
      }
      html5QrCode = null

      const trimmedText = decodedText.trim()
      setScannedCode(trimmedText)
      onOpenChange(false)

      // Call the onScan callback
      try {
        await onScan(trimmedText)
      } catch (error) {
        console.error('Error in onScan callback:', error)
        toast.error('Failed to process scanned QR code')
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      console.error('Error scanning QR code:', err)
      toast.error('Failed to scan QR code from image. Please try again.')

      // Clean up on error
      if (html5QrCode) {
        try {
          html5QrCode.clear()
        } catch {
          // Ignore cleanup errors
        }
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {/* Mode Toggle */}
          <div className="flex gap-2 mb-4">
            <Button
              type="button"
              variant={qrMode === 'scan' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setQrMode('scan')}
            >
              <QrCode className="mr-2 h-4 w-4" />
              {scanButtonLabel}
            </Button>
            <Button
              type="button"
              variant={qrMode === 'upload' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => {
                setQrMode('upload')
                setTimeout(() => {
                  fileInputRef.current?.click()
                }, 100)
              }}
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploadButtonLabel}
            </Button>
          </div>

          {/* Scan Mode */}
          {qrMode === 'scan' && (
            <div className="flex flex-col items-center justify-center py-4">
              <div ref={qrScanContainerRef} className="w-full max-w-sm">
                {open && (
                  <Scanner
                    onScan={(results) => handleQRScanResult(results)}
                    onError={(error) => {
                      console.error('QR scan error:', error)
                    }}
                    constraints={{
                      facingMode: 'environment',
                      width: { ideal: 1920 },
                      height: { ideal: 1080 },
                      advanced: [
                        { focusMode: 'continuous' },
                        { zoom: { min: 1, max: 5 } },
                      ],
                    } as MediaTrackConstraints & { advanced?: Array<Record<string, unknown>> }}
                    components={{
                      zoom: true,
                    }}
                  />
                )}
              </div>
              {scannedCode && (
                <p className="mt-4 text-sm text-muted-foreground">
                  Scanned: <span className="font-medium">{scannedCode}</span>
                </p>
              )}
            </div>
          )}

          {/* Upload Mode */}
          {qrMode === 'upload' && (
            <div className="flex flex-col items-center justify-center py-4">
              <div id="qr-reader" className="w-full min-h-[200px]"></div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleQRUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 h-4 w-4" />
                Choose Image
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

