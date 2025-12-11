'use client'

import { useState, useRef } from 'react'
import QRCode from 'react-qr-code'
import { Download, Printer } from 'lucide-react'
import { toast } from 'sonner'
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
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Spinner } from '@/components/ui/shadcn-io/spinner'

interface QRCodeDisplayDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assetTagId: string
  status?: string | null
  statusBadge?: React.ReactNode
  purchaseDate?: string | null
}

export function QRCodeDisplayDialog({
  open,
  onOpenChange,
  assetTagId,
  status,
  statusBadge,
  purchaseDate: providedPurchaseDate,
}: QRCodeDisplayDialogProps) {
  const qrCodeRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const [titleTooltipOpen, setTitleTooltipOpen] = useState<boolean>(false)
  const [textTooltipOpen, setTextTooltipOpen] = useState<boolean>(false)

  // Automatically fetch purchase date if not provided
  const { data: assetData, isLoading: isLoadingPurchaseDate } = useQuery({
    queryKey: ['asset-by-tag', assetTagId],
    queryFn: async () => {
      if (!assetTagId) return null
      try {
        const response = await fetch(`/api/assets?search=${encodeURIComponent(assetTagId)}&pageSize=1`)
        if (!response.ok) return null
        const data = await response.json()
        const assets = data.assets || []
        // Find exact match by assetTagId (case-insensitive)
        const asset = assets.find(
          (a: { assetTagId: string }) => a.assetTagId.toLowerCase() === assetTagId.toLowerCase()
        )
        return asset || null
      } catch (error) {
        console.error('Error fetching asset for QR code:', error)
        return null
      }
    },
    enabled: open && !providedPurchaseDate && !!assetTagId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  })

  // Use provided purchase date or fetch from asset data
  const purchaseDate = providedPurchaseDate ?? assetData?.purchaseDate ?? null

  // Helper function to generate the QR code canvas
  const generateQRCanvas = (callback: (canvas: HTMLCanvasElement) => void) => {
    if (!qrCodeRef.current) return

    const svgElement = qrCodeRef.current.querySelector('svg')
    if (!svgElement) return

    // Clone the SVG to avoid modifying the original
    const svgClone = svgElement.cloneNode(true) as SVGElement

    // Set background color (white for QR code area)
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    rect.setAttribute('width', '100%')
    rect.setAttribute('height', '100%')
    rect.setAttribute('fill', 'white')
    svgClone.insertBefore(rect, svgClone.firstChild)

    // Convert SVG to blob
    const svgData = new XMLSerializer().serializeToString(svgClone)
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const svgUrl = URL.createObjectURL(svgBlob)

    // Create image and convert to canvas
    const img = document.createElement('img')
    img.src = svgUrl
    img.onload = () => {
      // Calculate padding (15% of QR code size)
      const padding = Math.round(img.width * 0.15)
      const textHeight = 30 // Space for text at bottom
      const textGap = 15 // Gap between QR code and text
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        URL.revokeObjectURL(svgUrl)
        return
      }

      // Measure text to calculate exact height and width with 36px font
      ctx.font = 'bold 36px Arial'
      const textMetrics = ctx.measureText('SHORE AGENTS')
      const topTextHeight = 50 // Height for text + underline (increased for larger text)

      canvas.width = img.width + (padding * 2)
      canvas.height = img.height + (padding * 2) + textHeight + topTextHeight

      // Create rounded rectangle path for the background
      const borderRadius = 16
      const x = 0
      const y = 0
      const w = canvas.width
      const h = canvas.height

      // Start rounded rectangle path
      ctx.beginPath()
      ctx.moveTo(x + borderRadius, y)
      ctx.lineTo(x + w - borderRadius, y)
      ctx.quadraticCurveTo(x + w, y, x + w, y + borderRadius)
      ctx.lineTo(x + w, y + h - borderRadius)
      ctx.quadraticCurveTo(x + w, y + h, x + w - borderRadius, y + h)
      ctx.lineTo(x + borderRadius, y + h)
      ctx.quadraticCurveTo(x, y + h, x, y + h - borderRadius)
      ctx.lineTo(x, y + borderRadius)
      ctx.quadraticCurveTo(x, y, x + borderRadius, y)
      ctx.closePath()
      ctx.fillStyle = 'white'
      ctx.fill()

      // Draw white background for QR code area (already white, but ensuring it's clean)
      const qrY = topTextHeight + textGap // Small gap between underline and QR code
      ctx.fillStyle = 'white'
      ctx.fillRect(padding, qrY, img.width, img.height)

      // Draw the QR code image with padding offset
      ctx.drawImage(img, padding, qrY)

      // Load and draw the shoreagents.ico logo in the center of the QR code
      const logoImg = document.createElement('img')
      logoImg.crossOrigin = 'anonymous'
      logoImg.src = '/shoreagents.ico'
      logoImg.onload = () => {
        // Calculate logo size to match preview (40px equivalent, scaled to QR code size)
        // Preview shows 40px (w-10 h-10), QR code is 256px, so ratio is 40/256 ≈ 0.156
        const logoSize = Math.round(img.width * 0.156)
        const logoX = padding + (img.width / 2) - (logoSize / 2)
        const logoY = qrY + (img.height / 2) - (logoSize / 2)

        // Draw white square background for logo
        const logoPadding = 2
        ctx.fillStyle = 'white'
        ctx.fillRect(logoX - logoPadding, logoY - logoPadding, logoSize + (logoPadding * 2), logoSize + (logoPadding * 2))

        // Draw logo
        ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize)
        
        // Convert logo to black and white (matching preview: grayscale + contrast + brightness(0))
        const logoImageData = ctx.getImageData(logoX, logoY, logoSize, logoSize)
        const logoData = logoImageData.data
        
        for (let i = 0; i < logoData.length; i += 4) {
          const r = logoData[i]
          const g = logoData[i + 1]
          const b = logoData[i + 2]
          const a = logoData[i + 3]
          
          // Skip transparent pixels
          if (a < 50) {
            continue
          }
          
          // Check if pixel is very white (background) - preserve it as white
          // If all RGB channels are very high (close to white), keep it white
          const isWhite = r > 240 && g > 240 && b > 240
          
          if (isWhite) {
            // Keep white background
            logoData[i] = 255     // R
            logoData[i + 1] = 255 // G
            logoData[i + 2] = 255 // B
          } else {
            // Apply brightness(0) effect - make non-white pixels black
            // Since we've already filtered out white pixels, make everything else black
            // This ensures the logo (which is not white) becomes visible as black
            logoData[i] = 0     // R - black
            logoData[i + 1] = 0 // G - black
            logoData[i + 2] = 0 // B - black
          }
          // Alpha channel stays the same
        }
        ctx.putImageData(logoImageData, logoX, logoY)

        // Draw "SHORE AGENTS" text at the top with underline
        ctx.fillStyle = 'black'
        ctx.font = 'bold 36px Arial'
        ctx.textAlign = 'center'
        const topTextY = 40
        ctx.fillText('SHORE AGENTS', canvas.width / 2, topTextY)

        // Draw underline
        ctx.strokeStyle = 'black'
        ctx.lineWidth = 3
        const underlineY = topTextY + 8
        ctx.beginPath()
        ctx.moveTo(canvas.width / 2 - textMetrics.width / 2, underlineY)
        ctx.lineTo(canvas.width / 2 + textMetrics.width / 2, underlineY)
        ctx.stroke()

        // Draw Asset Tag ID text closer to QR code, centered with black color
        const textY = qrY + img.height + textGap + 20 // Position text closer to QR code
        ctx.font = 'bold 36px Arial'
        ctx.fillText(assetTagId, canvas.width / 2, textY)
        
        // Draw "PD:" with purchase date on the next line
        const pdY = textY + 40 // Position below asset tag ID (increased spacing for larger font)
        ctx.font = 'bold 36px Arial'
        let pdText = 'PD: N/A'
        if (purchaseDate) {
          const date = new Date(purchaseDate)
          const month = date.getMonth() + 1
          const day = date.getDate()
          const year = date.getFullYear()
          pdText = `PD: ${month}/${day}/${year}`
        }
        ctx.fillText(pdText, canvas.width / 2, pdY)

        URL.revokeObjectURL(svgUrl)
        callback(canvas)
      }
      logoImg.onerror = () => {
        // If logo fails to load, continue without it
        // Draw "SHORE AGENTS" text at the top with underline
        ctx.fillStyle = 'black'
        ctx.font = 'bold 36px Arial'
        ctx.textAlign = 'center'
        const topTextY = 40
        ctx.fillText('SHORE AGENTS', canvas.width / 2, topTextY)

        // Draw underline
        ctx.strokeStyle = 'black'
        ctx.lineWidth = 3
        const underlineY = topTextY + 8
        ctx.beginPath()
        ctx.moveTo(canvas.width / 2 - textMetrics.width / 2, underlineY)
        ctx.lineTo(canvas.width / 2 + textMetrics.width / 2, underlineY)
        ctx.stroke()

        // Draw Asset Tag ID text closer to QR code, centered with black color
        const textY = qrY + img.height + textGap + 20 // Position text closer to QR code
        ctx.font = 'bold 36px Arial'
        ctx.fillText(assetTagId, canvas.width / 2, textY)
        
        // Draw "PD:" with purchase date on the next line
        const pdY = textY + 40 // Position below asset tag ID (increased spacing for larger font)
        ctx.font = 'bold 36px Arial'
        let pdText = 'PD: N/A'
        if (purchaseDate) {
          const date = new Date(purchaseDate)
          const month = date.getMonth() + 1
          const day = date.getDate()
          const year = date.getFullYear()
          pdText = `PD: ${month}/${day}/${year}`
        }
        ctx.fillText(pdText, canvas.width / 2, pdY)

        URL.revokeObjectURL(svgUrl)
        callback(canvas)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(svgUrl)
    }
  }

  const handleDownloadQR = () => {
    generateQRCanvas((canvas) => {
      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `QR_${assetTagId}.png`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
        }
      }, 'image/png')
    })
  }

  const handleCopyToClipboard = async (source: 'title' | 'text') => {
    try {
      await navigator.clipboard.writeText(assetTagId)
      setCopied(true)
      if (source === 'title') {
        setTitleTooltipOpen(true)
      } else {
        setTextTooltipOpen(true)
      }
      setTimeout(() => {
        setCopied(false)
        if (source === 'title') {
          setTitleTooltipOpen(false)
        } else {
          setTextTooltipOpen(false)
        }
      }, 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = assetTagId
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        if (source === 'title') {
          setTitleTooltipOpen(true)
        } else {
          setTextTooltipOpen(true)
        }
        setTimeout(() => {
          setCopied(false)
          if (source === 'title') {
            setTitleTooltipOpen(false)
          } else {
            setTextTooltipOpen(false)
          }
        }, 2000)
      } catch {
        // Silent fail
      }
      document.body.removeChild(textArea)
    }
  }

  const handlePrintQR = () => {
    generateQRCanvas((canvas) => {
      // Convert canvas to data URL
      const dataUrl = canvas.toDataURL('image/png')

      // Create a new window with the image for printing
      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        toast.error('Please allow pop-ups to print QR code')
        return
      }

      // Write HTML content formatted for 1x1 inch sticker
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>QR Code - ${assetTagId}</title>
            <style>
              @page {
                size: 1in 1in;
                margin: 0;
              }
              @media print {
                * {
                  margin: 0 !important;
                  padding: 0 !important;
                  box-sizing: border-box;
                }
                @page {
                  size: 1in 1in;
                  margin: 0;
                }
                html, body {
                  width: 1in !important;
                  height: 1in !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  overflow: hidden;
                }
                body {
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  background: white;
                }
                .sticker-container {
                  width: 1in !important;
                  height: 1in !important;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  position: relative;
                  margin: 0;
                  padding: 0;
                }
                img {
                  width: 1in !important;
                  height: 1in !important;
                  max-width: 1in !important;
                  max-height: 1in !important;
                  object-fit: contain;
                  display: block;
                  margin: 0 !important;
                  padding: 0 !important;
                }
                /* Hide headers and footers */
                @media print {
                  @page {
                    margin: 0;
                  }
                  body {
                    margin: 0;
                  }
                }
              }
              body {
                margin: 0;
                padding: 0;
                width: 1in;
                height: 1in;
                display: flex;
                justify-content: center;
                align-items: center;
                background: white;
                overflow: hidden;
              }
              .sticker-container {
                width: 1in;
                height: 1in;
                display: flex;
                justify-content: center;
                align-items: center;
                position: relative;
              }
              img {
                width: 1in;
                height: 1in;
                max-width: 1in;
                max-height: 1in;
                object-fit: contain;
                display: block;
              }
              .instructions {
                position: fixed;
                top: 10px;
                left: 50%;
                transform: translateX(-50%);
                background: #f0f0f0;
                padding: 10px 15px;
                border-radius: 4px;
                font-size: 12px;
                z-index: 1000;
                max-width: 500px;
                text-align: center;
                border: 1px solid #ccc;
              }
              @media print {
                .instructions {
                  display: none !important;
                }
              }
            </style>
          </head>
          <body>
            <div class="instructions">
              <strong>1x1 Inch Sticker Printing Instructions:</strong><br>
              1. Set Paper Size to <strong>Custom: 1" x 1"</strong> (or match your sticker sheet)<br>
              2. Set Margins to <strong>None</strong> or <strong>Minimum</strong><br>
              3. Uncheck <strong>"Headers and footers"</strong><br>
              4. Set Scale to <strong>100%</strong> (no scaling)<br>
              5. Click Print
            </div>
            <div class="sticker-container">
              <img src="${dataUrl}" alt="QR Code for ${assetTagId}" />
            </div>
            <script>
              // Auto-remove instructions after 3 seconds
              setTimeout(function() {
                var instructions = document.querySelector('.instructions');
                if (instructions) {
                  instructions.style.opacity = '0';
                  instructions.style.transition = 'opacity 0.5s';
                  setTimeout(function() {
                    instructions.remove();
                  }, 500);
                }
              }, 5000);
            </script>
          </body>
        </html>
      `)
      printWindow.document.close()

      // Wait for image to load, then trigger print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print()
        }, 250)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <Tooltip open={titleTooltipOpen} onOpenChange={(open) => {
            if (open !== undefined) {
              setTitleTooltipOpen(open)
            }
          }}>
            <TooltipTrigger asChild>
              <DialogTitle 
                className="cursor-pointer hover:text-primary transition-colors"
                onClick={() => handleCopyToClipboard('title')}
              >
                QR Code - {assetTagId}
              </DialogTitle>
            </TooltipTrigger>
            <TooltipContent>
              {copied ? 'Copied' : 'Copy'}
            </TooltipContent>
          </Tooltip>
          <DialogDescription>
            {statusBadge || (status && <Badge variant="outline">{status}</Badge>)}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center py-6">
          <div ref={qrCodeRef} className="bg-white p-4 rounded-lg relative">
            <QRCode
              value={assetTagId}
              size={256}
              level="H"
              style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
              viewBox={`0 0 256 256`}
            />
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
              <div className="bg-white p-1 shadow-lg">
                <img
                  src="/shoreagents.ico"
                  alt="Shore Agents Logo"
                  width={40}
                  height={40}
                  className="w-10 h-10"
                  style={{
                    filter: 'grayscale(100%) contrast(500%) brightness(0)',
                    imageRendering: 'crisp-edges',
                  }}
                />
              </div>
            </div>
          </div>
          <div className="mt-4 text-center">
            <Tooltip open={textTooltipOpen} onOpenChange={(open) => {
              if (open !== undefined) {
                setTextTooltipOpen(open)
              }
            }}>
              <TooltipTrigger asChild>
                <p 
                  className="text-xl font-bold cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleCopyToClipboard('text')}
                >
                  {assetTagId}
                </p>
              </TooltipTrigger>
              <TooltipContent>
                {copied ? 'Copied' : 'Copy'}
              </TooltipContent>
            </Tooltip>
            <p className="text-xl font-bold mt-1 flex items-center justify-center gap-2">
              PD:{' '}
              {isLoadingPurchaseDate ? (
                <Spinner className="h-4 w-4" />
              ) : purchaseDate ? (
                (() => {
                  const date = new Date(purchaseDate)
                  const month = date.getMonth() + 1
                  const day = date.getDate()
                  const year = date.getFullYear()
                  return `${month}/${day}/${year}`
                })()
              ) : (
                'N/A'
              )}
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleDownloadQR}>
            <Download className="mr-2 h-4 w-4" />
            Download QR
          </Button>
          <Button variant="outline" onClick={handlePrintQR}>
            <Printer className="mr-2 h-4 w-4" />
            Print QR
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

