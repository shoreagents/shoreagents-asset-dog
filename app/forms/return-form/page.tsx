"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { XIcon, QrCode, RefreshCw, Download } from "lucide-react"
import Image from "next/image"
import { usePermissions } from '@/hooks/use-permissions'
import { useSidebar } from '@/components/ui/sidebar'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { QRScannerDialog } from '@/components/qr-scanner-dialog'
import { toast } from 'sonner'
import { useQuery } from "@tanstack/react-query"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldLabel, FieldContent } from "@/components/ui/field"
import { EmployeeSelectField } from "@/components/employee-select-field"
import { cn } from "@/lib/utils"

interface Asset {
  id: string
  assetTagId: string
  description: string
  status?: string
  category?: {
    id: string
    name: string
  } | null
  subCategory?: {
    id: string
    name: string
  } | null
}

interface EmployeeUser {
  id: string
  name: string
  email: string
  department: string | null
  checkouts?: Array<{
    id: string
    asset: {
      id: string
      assetTagId: string
      description: string
      status?: string
      category?: {
        id: string
        name: string
      } | null
      subCategory?: {
        id: string
        name: string
      } | null
    }
    checkins: Array<{ id: string }>
  }>
}

interface ReturnAsset extends Asset {
  quantity: number
  condition: boolean // checkbox for "in good condition"
}

// Pre-defined asset categories from the form
const IT_EQUIPMENT = [
  'Monitor',
  'UPS',
  'CPU',
  'Headset',
  'Video Camera',
  'Mouse',
  'Keyboard',
  'Dport to VGA adapter',
  'HDMI to VGA adapter',
  'Dport Male to HDMI Male Cable',
  'HDMI Male to DVI cable',
]

const OTHER_ITEMS = [
  'Laptop',
  'Speaker',
  'Chair',
  'Wacom',
  'IP Phone',
  'Wrist Rest',
  'Router',
  'Printer',
]

const RESIGNED_STAFF_ITEMS = [
  'Company ID',
  'RFID',
]

export default function ReturnFormPage() {
  const { hasPermission } = usePermissions()
  const { state: sidebarState, open: sidebarOpen } = useSidebar()
  const canViewReturnForms = hasPermission('canViewReturnForms')
  const canManageReturnForms = hasPermission('canManageReturnForms')
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionRef = useRef<HTMLDivElement>(null)
  const [assetIdInput, setAssetIdInput] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const [selectedAssets, setSelectedAssets] = useState<ReturnAsset[]>([])
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [qrDialogContext, setQrDialogContext] = useState<'general' | 'table-row'>('general')
  const [targetRowItem, setTargetRowItem] = useState<string | null>(null)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("")
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0])
  const [position, setPosition] = useState("")
  const [returnToOffice, setReturnToOffice] = useState(false)
  const [resignedStaff, setResignedStaff] = useState(false)
  const [controlNumber, setControlNumber] = useState("")
  const [returnerSignature, setReturnerSignature] = useState("")
  const [returnerDate, setReturnerDate] = useState("")
  const [itSignature, setItSignature] = useState("")
  const [itDate, setItDate] = useState("")

  // Fetch selected employee details
  const { data: selectedEmployee, isLoading: isLoadingEmployee } = useQuery<EmployeeUser | null>({
    queryKey: ["employee", selectedEmployeeId],
    queryFn: async () => {
      if (!selectedEmployeeId) return null
      const response = await fetch(`/api/employees/${selectedEmployeeId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch employee')
      }
      const data = await response.json()
      return data.employee as EmployeeUser
    },
    enabled: !!selectedEmployeeId,
  })

  // Auto-fill checked out assets when employee is selected
  useEffect(() => {
    if (selectedEmployee && selectedEmployee.checkouts) {
      // Filter active checkouts (those without checkins)
      const activeCheckouts = selectedEmployee.checkouts.filter(
        checkout => checkout.checkins.length === 0 && checkout.asset.status === "Checked out"
      )
      
      if (activeCheckouts.length > 0) {
        // Convert checkouts to ReturnAsset format
        const assetsToAdd: ReturnAsset[] = activeCheckouts.map(checkout => ({
          id: checkout.asset.id,
          assetTagId: checkout.asset.assetTagId,
          description: checkout.asset.description,
          status: checkout.asset.status,
          category: checkout.asset.category || null,
          subCategory: checkout.asset.subCategory || null,
          quantity: 1,
          condition: false,
        }))
        
        // Only update if the assets are different (avoid infinite loops)
        setSelectedAssets(prevAssets => {
          const currentAssetIds = prevAssets.map(a => a.id).sort().join(',')
          const newAssetIds = assetsToAdd.map(a => a.id).sort().join(',')
          
          if (currentAssetIds !== newAssetIds) {
            toast.success(`Loaded ${assetsToAdd.length} checked out asset(s) for ${selectedEmployee.name}`)
            return assetsToAdd
          }
          return prevAssets
        })
      } else {
        // Clear assets if employee has no active checkouts
        setSelectedAssets(prevAssets => {
          if (prevAssets.length > 0) {
            return []
          }
          return prevAssets
        })
      }
    } else if (!selectedEmployee) {
      // Clear assets when employee is deselected
      setSelectedAssets([])
    }
  }, [selectedEmployee, selectedEmployeeId]) // Only trigger when employee changes

  // Fetch asset suggestions
  const { data: assetSuggestions = [], isLoading: isLoadingSuggestions } = useQuery<Asset[]>({
    queryKey: ["asset-return-suggestions", assetIdInput, selectedAssets.length, showSuggestions],
    queryFn: async () => {
      const searchTerm = assetIdInput.trim() || ''
      const response = await fetch(`/api/assets?search=${encodeURIComponent(searchTerm)}&pageSize=10000`)
      if (!response.ok) {
        throw new Error('Failed to fetch assets')
      }
      const data = await response.json()
      const assets = data.assets as Asset[]
      
      const selectedIds = selectedAssets.map(a => a.id.toLowerCase())
      const filtered = assets.filter(a => 
        !selectedIds.includes(a.id.toLowerCase())
      )
      
      return filtered.slice(0, 10)
    },
    enabled: showSuggestions && canViewReturnForms,
    staleTime: 300,
  })

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        suggestionRef.current &&
        !suggestionRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  // Asset lookup by ID
  const lookupAsset = async (assetTagId: string): Promise<Asset | null> => {
    try {
      const response = await fetch(`/api/assets?search=${encodeURIComponent(assetTagId)}&pageSize=10000`)
      const data = await response.json()
      const assets = data.assets as Asset[]
      
      const asset = assets.find(
        (a) => a.assetTagId.toLowerCase() === assetTagId.toLowerCase()
      )
      
      return asset || null
    } catch (error) {
      console.error('Error looking up asset:', error)
      return null
    }
  }

  // Add asset to return list
  const handleAddAsset = async (asset?: Asset) => {
    const assetToAdd = asset || await lookupAsset(assetIdInput.trim())
    
    if (!assetToAdd) {
      if (!asset) {
        toast.error(`Asset with ID "${assetIdInput}" not found`)
      }
      return
    }

    // Check if asset is already in the list
    if (selectedAssets.some(a => a.id === assetToAdd.id)) {
      toast.error('Asset is already in the return list')
      setAssetIdInput("")
      setShowSuggestions(false)
      return
    }

    const newAsset: ReturnAsset = {
      ...assetToAdd,
      quantity: 1,
      condition: false,
    }
    setSelectedAssets((prev) => [...prev, newAsset])
    setAssetIdInput("")
    setShowSuggestions(false)
    setSelectedSuggestionIndex(-1)
    toast.success('Asset added to return list')
  }

  // Handle suggestion selection
  const handleSelectSuggestion = (asset: Asset) => {
    handleAddAsset(asset)
  }

  // Handle keyboard navigation
  const handleSuggestionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || assetSuggestions.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault()
        if (assetIdInput.trim()) {
          handleAddAsset()
        }
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedSuggestionIndex((prev) =>
          prev < assetSuggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < assetSuggestions.length) {
          handleSelectSuggestion(assetSuggestions[selectedSuggestionIndex])
        } else if (assetIdInput.trim()) {
          handleAddAsset()
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowSuggestions(false)
        setSelectedSuggestionIndex(-1)
        break
    }
  }

  // Remove asset from return list
  const handleRemoveAsset = (assetId: string) => {
    setSelectedAssets((prev) => prev.filter((a) => a.id !== assetId))
    toast.success('Asset removed from return list')
  }

  // Update asset quantity or condition
  const handleUpdateAsset = (assetId: string, field: 'quantity' | 'condition', value: number | boolean) => {
    setSelectedAssets((prev) =>
      prev.map((asset) =>
        asset.id === assetId ? { ...asset, [field]: value } : asset
      )
    )
  }

  // Handle QR code scan
  const handleQRScan = async (decodedText: string) => {
    const asset = await lookupAsset(decodedText)
    if (!asset) {
      toast.error(`Asset with ID "${decodedText}" not found`)
      return
    }

    // If scanning for a specific table row item
    if (qrDialogContext === 'table-row' && targetRowItem) {
      const subCategoryName = asset.subCategory?.name?.trim() || ''
      const targetItemLower = targetRowItem.toLowerCase()
      
      // Check if the scanned asset matches the target item by subcategory
      if (subCategoryName.toLowerCase() === targetItemLower || 
          subCategoryName.toLowerCase().includes(targetItemLower)) {
        // Check if asset is already in the list
        if (selectedAssets.some(a => a.id === asset.id)) {
          toast.error('Asset is already in the return list')
          setQrDialogContext('general')
          setTargetRowItem(null)
          return
        }

        const newAsset: ReturnAsset = {
          ...asset,
          quantity: 1,
          condition: false,
        }
        setSelectedAssets((prev) => [...prev, newAsset])
        toast.success(`Asset "${asset.assetTagId}" added to ${targetRowItem}`)
        setQrDialogContext('general')
        setTargetRowItem(null)
      } else {
        toast.error(`Asset subcategory "${subCategoryName}" does not match "${targetRowItem}". Please scan a ${targetRowItem} asset.`)
      }
    } else {
      // General scan - add to list normally
      await handleAddAsset(asset)
    }
  }

  // Handle clicking on table row item to scan
  const handleRowItemClick = (itemName: string) => {
    setTargetRowItem(itemName)
    setQrDialogContext('table-row')
    setQrDialogOpen(true)
  }

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAssetIdInput(e.target.value)
    if (!showSuggestions) {
      setShowSuggestions(true)
    }
    setSelectedSuggestionIndex(-1)
  }

  // Generate control number
  // Handle PDF download using Puppeteer
  const handleDownloadPDF = async () => {
    if (!canManageReturnForms) {
      toast.error('You do not have permission to download return forms')
      return
    }

    if (!selectedEmployee) {
      toast.error('Please select an employee first')
      return
    }

    const formElementIT = document.getElementById('return-form-it')
    
    if (!formElementIT) {
      toast.error('Form not found')
      return
    }

    try {
      toast.loading('Generating PDF...', { id: 'pdf-generation' })

      // Ensure checkboxes have explicit checked attribute before getting HTML
      const checkboxes = formElementIT.querySelectorAll('input[type="checkbox"]')
      checkboxes.forEach((checkbox) => {
        const htmlCheckbox = checkbox as HTMLInputElement
        if (htmlCheckbox.checked) {
          htmlCheckbox.setAttribute('checked', 'checked')
        } else {
          htmlCheckbox.removeAttribute('checked')
        }
      })
      
      // Get the HTML content with computed styles
      let htmlContent = formElementIT.outerHTML
      
      // Convert relative image paths to absolute URLs
      const origin = window.location.origin
      htmlContent = htmlContent.replace(
        /src="(\/[^"]+)"/g,
        (match, path) => `src="${origin}${path}"`
      )
      htmlContent = htmlContent.replace(
        /url\((\/[^)]+)\)/g,
        (match, path) => `url(${origin}${path})`
      )
      
      // Convert images to base64 for better reliability
      const images = formElementIT.querySelectorAll('img')
      const imageReplacements: Array<{ original: string, replacement: string }> = []
      
      await Promise.all(Array.from(images).map(async (img) => {
        const htmlImg = img as HTMLImageElement
        const originalSrc = htmlImg.src || htmlImg.getAttribute('src') || ''
        
        if (originalSrc && (originalSrc.startsWith('http') || originalSrc.startsWith('/'))) {
          try {
            // Convert to absolute URL if relative
            const imageUrl = originalSrc.startsWith('/') 
              ? `${origin}${originalSrc}`
              : originalSrc
            
            const response = await fetch(imageUrl)
            const blob = await response.blob()
            
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onloadend = () => resolve(reader.result as string)
              reader.onerror = reject
              reader.readAsDataURL(blob)
            })
            
            imageReplacements.push({
              original: originalSrc,
              replacement: base64
            })
          } catch (error) {
            console.error('Failed to convert image to base64:', error)
            // Keep absolute URL as fallback
            if (originalSrc.startsWith('/')) {
              imageReplacements.push({
                original: originalSrc,
                replacement: `${origin}${originalSrc}`
              })
            }
          }
        }
      }))
      
      // Apply image replacements
      imageReplacements.forEach(({ original, replacement }) => {
        htmlContent = htmlContent.replace(
          new RegExp(`src=["']${original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'g'),
          `src="${replacement}"`
        )
      })
      
      // Also handle background images in inline styles
      const backgroundImageRegex = /backgroundImage:\s*['"]url\(([^)]+)\)['"]/g
      htmlContent = htmlContent.replace(backgroundImageRegex, (match, url) => {
        const replacement = imageReplacements.find(r => r.original === url || url.includes(r.original))
        if (replacement) {
          return `backgroundImage: url(${replacement.replacement})`
        }
        // Convert relative URLs to absolute
        if (url.startsWith('/')) {
          return `backgroundImage: url(${origin}${url})`
        }
        return match
      })
      
      // Get all stylesheets
      const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map(style => style.outerHTML)
        .join('\n')
      
      // Get computed styles for the form element and inline them
      const computedStyles = window.getComputedStyle(formElementIT)
      const formStyles = Array.from(computedStyles).map(prop => {
        const value = computedStyles.getPropertyValue(prop)
        return `${prop}: ${value}`
      }).join('; ')

      // Create complete HTML document
      const fullHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <base href="${origin}">
            ${styles}
            <style>
              * {
                box-sizing: border-box;
              }
              @page {
                size: A4;
                margin: 10mm;
              }
              body {
                margin: 0;
                padding: 0;
                background: white;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              #return-form-it {
                ${formStyles}
                width: 100%;
                margin: 0;
                padding: 16px !important;
                box-sizing: border-box;
                background: white !important;
                color: black !important;
              }
              /* Ensure all Tailwind utilities work */
              .grid { display: grid !important; }
              .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
              .flex { display: flex !important; }
              .items-end { align-items: flex-end !important; }
              .items-center { align-items: center !important; }
              .flex-1 { flex: 1 1 0% !important; }
              .gap-4 { gap: 1rem !important; }
              .gap-8 { gap: 2rem !important; }
              .border-2 { border-width: 1px !important; border-style: solid !important; border-color: #000000 !important; }
              .border-b { border-bottom-width: 0.5px !important; border-bottom-style: solid !important; border-bottom-color: #000000 !important; }
              .border-r-2 { border-right-width: 1px !important; border-right-style: solid !important; border-right-color: #000000 !important; }
              .border-b-2 { border-bottom-width: 1px !important; border-bottom-style: solid !important; border-bottom-color: #000000 !important; }
              table { border-collapse: collapse !important; width: 100% !important; }
              th, td { border: 0.5px solid #000000 !important; }
              /* Reduced font size for table content */
              th[class*="text-xs"], td[class*="text-xs"] { font-size: 0.75rem !important; line-height: 1rem !important; }
              /* Reduced padding for content rows - using attribute selector for py-0.5 */
              td[class*="py-0.5"], th[class*="py-0.5"] { padding-top: 2px !important; padding-bottom: 2px !important; padding-left: 8px !important; padding-right: 8px !important; }
              /* Header row padding */
              th[class*="py-1"] { padding-top: 4px !important; padding-bottom: 4px !important; padding-left: 8px !important; padding-right: 8px !important; }
              /* Empty row padding - only apply if doesn't have py-0.5 */
              td[class*="p-2"]:not([class*="py-0.5"]) { padding: 8px !important; }
              img { display: block !important; max-width: 100% !important; height: auto !important; }
              /* Force opacity for background logo div in PDF */
              div[style*="ShoreAgents-Logo-only.png"] {
                opacity: 0.3 !important;
              }
              /* Ensure checkboxes are visible in PDF */
              input[type="checkbox"] {
                width: 12px !important;
                height: 12px !important;
                border: 1.5px solid #000000 !important;
                border-radius: 2px !important;
                appearance: none !important;
                -webkit-appearance: none !important;
                -moz-appearance: none !important;
                cursor: default !important;
                position: relative !important;
                display: inline-block !important;
                vertical-align: middle !important;
                background-color: #ffffff !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              input[type="checkbox"]:checked,
              input[type="checkbox"][checked],
              input[type="checkbox"][checked="checked"] {
                background-color: #000000 !important;
                border-color: #000000 !important;
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath fill='white' stroke='white' stroke-width='1.2' d='M1.5 4 L3.5 6 L6.5 1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") !important;
                background-size: 8px 8px !important;
                background-repeat: no-repeat !important;
                background-position: center !important;
              }
              /* Reduce title size in PDF - target all h2 elements */
              #return-form-it h2,
              #return-form-admin h2,
              h2[class*="text-sm"],
              h2 {
                font-size: 0.875rem !important;
                line-height: 1.25rem !important;
                font-weight: bold !important;
              }
              /* Reduce subtitle size in PDF - target p elements with text-xs class */
              #return-form-it p.text-xs,
              #return-form-admin p.text-xs,
              p[class*="text-xs"] {
                font-size: 0.75rem !important;
                line-height: 1rem !important;
                font-weight: 600 !important;
              }
              /* Reduce employee details font sizes */
              #return-form-it p.text-xs,
              #return-form-admin p.text-xs,
              #return-form-it div.text-xs,
              #return-form-admin div.text-xs {
                font-size: 0.75rem !important;
                line-height: 1rem !important;
              }
              /* Reduce signature section font sizes */
              #return-form-it .grid.grid-cols-2 p,
              #return-form-admin .grid.grid-cols-2 p {
                font-size: 0.75rem !important;
                line-height: 1rem !important;
              }
              /* Make certification text smaller and muted */
              p[class*="text-[10px]"],
              p.italic[class*="text-muted"] {
                font-size: 10px !important;
                line-height: 1.2 !important;
                color: #6b7280 !important;
              }
            </style>
          </head>
          <body>
            ${htmlContent}
          </body>
        </html>
      `

      // Get Admin copy HTML
      const formElementAdmin = document.getElementById('return-form-admin')
      let htmlContentAdmin = ''
      
      if (formElementAdmin) {
        // Ensure checkboxes have explicit checked attribute for admin copy
        const checkboxesAdmin = formElementAdmin.querySelectorAll('input[type="checkbox"]')
        checkboxesAdmin.forEach((checkbox) => {
          const htmlCheckbox = checkbox as HTMLInputElement
          if (htmlCheckbox.checked) {
            htmlCheckbox.setAttribute('checked', 'checked')
          } else {
            htmlCheckbox.removeAttribute('checked')
          }
        })
        
        htmlContentAdmin = formElementAdmin.outerHTML
        
        // Convert relative image paths to absolute URLs for admin copy
        htmlContentAdmin = htmlContentAdmin.replace(
          /src="(\/[^"]+)"/g,
          (match, path) => `src="${origin}${path}"`
        )
        htmlContentAdmin = htmlContentAdmin.replace(
          /url\((\/[^)]+)\)/g,
          (match, path) => `url(${origin}${path})`
        )
      }
      
      // Combine both HTML contents for the body
      const bodyContent = htmlContentAdmin 
        ? `${htmlContent}\n${htmlContentAdmin}`
        : htmlContent
      
      // Update fullHTML to include both forms in body
      const fullHTMLWithBoth = fullHTML.replace(
        /<body>\s*[\s\S]*?\s*<\/body>/,
        `<body>\n${bodyContent}\n</body>`
      )
      
      const response = await fetch('/api/assets/return-form/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          html: fullHTMLWithBoth,
          elementIds: ['#return-form-it', '#return-form-admin'],
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate PDF')
      }

      // Get PDF blob
      const blob = await response.blob()
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Return-of-Assets-${selectedEmployee?.name?.replace(/\s+/g, '-') || 'Employee'}-${returnDate || new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success('PDF downloaded successfully', { id: 'pdf-generation' })

      // Save form data to database
      try {
        const returnType = resignedStaff ? 'Resigned Staff' : 'Return to Office'
        const formData = {
          returnDate,
          position,
          returnToOffice,
          resignedStaff,
          controlNumber,
          returnerSignature,
          returnerDate,
          itSignature,
          itDate,
          selectedAssets: selectedAssets.map(asset => ({
            id: asset.id,
            assetTagId: asset.assetTagId,
            description: asset.description,
            quantity: asset.quantity,
            condition: asset.condition,
          })),
        }

        const saveResponse = await fetch('/api/forms/return-form', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            employeeUserId: selectedEmployeeId,
            dateReturned: returnDate,
            department: selectedEmployee?.department || null,
            ctrlNo: controlNumber || null,
            returnType,
            formData,
          }),
        })

        if (!saveResponse.ok) {
          const error = await saveResponse.json()
          console.error('Failed to save return form:', error)
          // Don't show error to user since PDF was already downloaded successfully
        }
      } catch (saveError) {
        console.error('Error saving return form:', saveError)
        // Don't show error to user since PDF was already downloaded successfully
      }
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: 'pdf-generation' })
    }
  }

  const handleGenerateControlNumber = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    
    // Format: CTRL-YYYYMMDD-XXXX
    const generatedCtrlNo = `CTRL-${year}${month}${day}-${randomNum}`
    setControlNumber(generatedCtrlNo)
    toast.success('Control number generated')
  }

  // Group assets by subcategory name for display
  const groupedAssets = useMemo(() => {
    const groups: {
      itEquipment: ReturnAsset[]
      otherItems: ReturnAsset[]
      resignedItems: ReturnAsset[]
      custom: ReturnAsset[]
    } = {
      itEquipment: [],
      otherItems: [],
      resignedItems: [],
      custom: [],
    }

    selectedAssets.forEach(asset => {
      const subCategoryName = asset.subCategory?.name?.trim() || ''
      
      // Priority: Match by exact subcategory name first (case-insensitive)
      // Check if subcategory matches IT equipment
      const isITEquipment = IT_EQUIPMENT.some(item => 
        subCategoryName.toLowerCase() === item.toLowerCase() ||
        subCategoryName.toLowerCase().includes(item.toLowerCase())
      )
      
      // Check if subcategory matches other items
      const isOtherItem = OTHER_ITEMS.some(item => 
        subCategoryName.toLowerCase() === item.toLowerCase() ||
        subCategoryName.toLowerCase().includes(item.toLowerCase())
      )
      
      // Check if subcategory matches resigned staff items
      const isResignedItem = RESIGNED_STAFF_ITEMS.some(item => 
        subCategoryName.toLowerCase() === item.toLowerCase() ||
        subCategoryName.toLowerCase().includes(item.toLowerCase())
      )

      if (isITEquipment) {
        groups.itEquipment.push(asset)
      } else if (isOtherItem) {
        groups.otherItems.push(asset)
      } else if (isResignedItem && resignedStaff) {
        groups.resignedItems.push(asset)
      } else {
        groups.custom.push(asset)
      }
    })

    return groups
  }, [selectedAssets, resignedStaff])

  // Show toast notification if user doesn't have view permission
  useEffect(() => {
    if (!canViewReturnForms) {
      toast.error('You do not have permission to view return forms')
    }
  }, [canViewReturnForms])

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="mb-4 md:mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">Return of Assets Form</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Generate a printable return of assets form for employees
        </p>
      </div>

      {/* Employee Selection Card */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Employee Selection</CardTitle>
          <CardDescription className="text-xs">
            Select an employee to generate the return form
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2 pb-4">
          <EmployeeSelectField
            value={selectedEmployeeId}
            onValueChange={setSelectedEmployeeId}
            label="Employee"
            required
            disabled={!canViewReturnForms}
            placeholder="Select an employee"
          />
        </CardContent>
      </Card>

      {/* Form Details - Show when employee is selected or loading */}
      {(selectedEmployeeId && (selectedEmployee || isLoadingEmployee)) && (
        <>
          {/* Form Details Card */}
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Form Details</CardTitle>
              <CardDescription className="text-xs">
                Fill in the form details
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-4 space-y-4">
              {isLoadingEmployee ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex flex-col items-center gap-3">
                    <Spinner className="h-8 w-8" />
                    <p className="text-sm text-muted-foreground">Loading employee details...</p>
                  </div>
                </div>
              ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="employeeName">NAME OF THE EMPLOYEE:</FieldLabel>
                  <FieldContent>
                    <Input
                      id="employeeName"
                      value={selectedEmployee?.name || ''}
                      disabled
                      className="bg-muted"
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="controlNumber">CTRL NO.:</FieldLabel>
                  <FieldContent>
                    <div className="flex gap-2">
                      <Input
                        id="controlNumber"
                        placeholder="Control Number"
                        value={controlNumber}
                        onChange={(e) => setControlNumber(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleGenerateControlNumber}
                        title="Generate Control Number"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="department">CLIENT / DEPARTMENT:</FieldLabel>
                  <FieldContent>
                    <Input
                      id="department"
                      value={selectedEmployee?.department || ''}
                      disabled
                      className="bg-muted"
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="returnDate">
                    DATE RETURNED: <span className="text-destructive">*</span>
                  </FieldLabel>
                  <FieldContent>
                    <Input
                      id="returnDate"
                      type="date"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      required
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="position">POSITION:</FieldLabel>
                  <FieldContent>
                    <Input
                      id="position"
                      placeholder="Employee position"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                    />
                  </FieldContent>
                </Field>

                <div className="flex items-center gap-6 pt-6">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="returnToOffice"
                      checked={returnToOffice}
                      onCheckedChange={(checked) => setReturnToOffice(checked === true)}
                    />
                    <label htmlFor="returnToOffice" className="text-sm font-medium cursor-pointer">
                      Return to Office
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="resignedStaff"
                      checked={resignedStaff}
                      onCheckedChange={(checked) => setResignedStaff(checked === true)}
                    />
                    <label htmlFor="resignedStaff" className="text-sm font-medium cursor-pointer">
                      Resigned Staff
                    </label>
                  </div>
                </div>
              </div>
              )}
            </CardContent>
          </Card>

          {/* Asset Selection Card */}
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Asset Selection</CardTitle>
              <CardDescription className="text-xs">
                Add assets to the return form using asset ID or QR scanner
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-4 space-y-4">
              {isLoadingEmployee ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex flex-col items-center gap-3">
                    <Spinner className="h-8 w-8" />
                    <p className="text-sm text-muted-foreground">Loading employee details...</p>
                  </div>
                </div>
              ) : (
                <>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    ref={inputRef}
                    placeholder="Enter asset ID (e.g., AT-001) or select from suggestions"
                    value={assetIdInput}
                    onChange={handleInputChange}
                    onKeyDown={handleSuggestionKeyDown}
                    onFocus={() => setShowSuggestions(true)}
                    className="w-full"
                    autoComplete="off"
                    disabled={!canViewReturnForms}
                  />
                  
                  {/* Suggestions dropdown */}
                  {showSuggestions && (
                    <div
                      ref={suggestionRef}
                      className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-auto"
                    >
                      {isLoadingSuggestions ? (
                        <div className="flex items-center justify-center py-4">
                          <div className="flex flex-col items-center gap-2">
                            <Spinner variant="default" size={20} className="text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">Loading assets...</p>
                          </div>
                        </div>
                      ) : assetSuggestions.length > 0 ? (
                        assetSuggestions.map((asset, index) => (
                          <div
                            key={asset.id}
                            onClick={() => handleSelectSuggestion(asset)}
                            onMouseEnter={() => setSelectedSuggestionIndex(index)}
                            className={cn(
                              "px-4 py-3 cursor-pointer transition-colors",
                              "hover:bg-accent",
                              selectedSuggestionIndex === index && "bg-accent"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">{asset.assetTagId}</div>
                                <div className="text-sm text-muted-foreground">
                                  {asset.category?.name || 'No Category'}
                                  {asset.subCategory?.name && ` - ${asset.subCategory.name}`}
                                </div>
                              </div>
                              <Badge variant="outline">{asset.status || 'Available'}</Badge>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No assets found. Start typing to search...
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {canViewReturnForms && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setQrDialogOpen(true)}
                    title="QR Code"
                  >
                    <QrCode className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {selectedAssets.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Selected Assets ({selectedAssets.length})
                  </p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedAssets.map((asset) => (
                      <div
                        key={asset.id}
                        className="flex items-center justify-between gap-2 p-3 border rounded-md bg-muted/50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{asset.assetTagId}</Badge>
                            <span className="text-sm font-medium truncate">
                              {asset.description}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Input
                            type="number"
                            min="1"
                            value={asset.quantity}
                            onChange={(e) => handleUpdateAsset(asset.id, 'quantity', parseInt(e.target.value) || 1)}
                            className="w-20"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveAsset(asset.id)}
                            className="h-8 w-8"
                          >
                            <XIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Printable Forms - IT Department Copy and Admin Copy */}
          <Card className="mb-6 print:shadow-none print:border-0">
            <CardHeader className="pb-3 print:hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-base">Return of Assets Form</CardTitle>
                  <CardDescription className="text-xs">
                    Review the forms (IT Department Copy & Admin Copy)
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2 pb-4 print:p-0 space-y-8 print:space-y-0">
              {/* IT Department Copy */}
              <div className="bg-card text-card-foreground p-4 sm:p-6 md:p-8 print:p-8 print:bg-white print:text-black relative print:break-after-page" id="return-form-it">
                {/* Background Logo */}
                <div 
                  className="absolute inset-0 opacity-5 print:opacity-[0.02] pointer-events-none z-0"
                  style={{
                    backgroundImage: 'url(/ShoreAgents-Logo-only.png)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                  }}
                />
                
                {/* Content */}
                <div className="relative z-10">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4 md:mb-6">
                    <div>
                      <Image 
                        src="/ShoreAgents-Logo.png" 
                        alt="ShoreAgents Logo" 
                        width={200}
                        height={80}
                        className="h-12 sm:h-16 print:h-20 object-contain"
                        priority
                      />
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-xs font-medium text-foreground print:text-black">CTRL NO.:</p>
                      <div className="border-b-2 border-border dark:border-gray-600 print:border-black w-full sm:w-32 mt-1 min-h-[20px] text-[10px] sm:text-xs print:text-[10px]">
                        {controlNumber || ''}
                      </div>
                    </div>
                  </div>

                {/* Title */}
                <h2 className="text-sm font-bold text-center mb-1 text-foreground print:text-black">RETURN OF ASSETS FORM</h2>
                <p className="text-xs font-semibold text-center mb-2 text-green-600 dark:text-green-500 print:text-green-600">IT DEPARTMENT COPY</p>

                {/* Employee Details Box */}
                <div className="border-2 border-border dark:border-gray-600 print:border-black p-1.5 mb-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-0.5">
                    <div>
                      <p className="text-xs font-medium mb-0.5 text-foreground print:text-black">NAME OF THE EMPLOYEE:</p>
                      <div className="border-b border-border dark:border-gray-600 print:border-black pb-0.5 text-xs text-foreground print:text-black min-h-[16px]" data-employee-name>
                        {selectedEmployee?.name || ''}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-0.5 text-foreground print:text-black">CLIENT / DEPARTMENT:</p>
                      <div className="border-b border-border dark:border-gray-600 print:border-black pb-0.5 text-xs text-foreground print:text-black min-h-[16px]" data-employee-department>
                        {selectedEmployee?.department || ''}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-0.5 text-foreground print:text-black">DATE RETURNED:</p>
                      <div className="border-b border-border dark:border-gray-600 print:border-black pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                        {returnDate ? new Date(returnDate).toLocaleDateString() : ''}
                      </div>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <p className="text-xs font-medium mb-0.5 text-foreground print:text-black">POSITION:</p>
                        <div className="border-b border-border dark:border-gray-600 print:border-black pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                          {position || ''}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={returnToOffice}
                            readOnly
                            className="w-3 h-3 accent-primary print:w-3 print:h-3"
                          />
                          <span className="text-xs text-foreground print:text-black">RETURN TO OFFICE</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={resignedStaff}
                            readOnly
                            className="w-3 h-3 accent-primary print:w-3 print:h-3"
                          />
                          <span className="text-xs text-foreground print:text-black">RESIGNED STAFF</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Assets Tables - Two side-by-side tables */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                  {/* Left Table - IT Equipment */}
                  <div className="border-2 border-border dark:border-gray-600 print:border-black">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b-2 border-border dark:border-gray-600 print:border-black">
                          <th className="border-r-2 border-border dark:border-gray-600 print:border-black py-1 px-1 sm:px-2 text-[10px] sm:text-xs font-bold text-foreground print:text-black">Assets Returned</th>
                          <th className="border-r-2 border-border dark:border-gray-600 print:border-black py-1 px-1 sm:px-2 text-center text-[10px] sm:text-xs font-bold w-10 sm:w-12 text-foreground print:text-black">QTY</th>
                          <th className="border-r-2 border-border dark:border-gray-600 print:border-black py-1 px-1 sm:px-2 text-left text-[10px] sm:text-xs font-bold text-foreground print:text-black">Asset Tag / QR code</th>
                          <th className="py-1 px-1 sm:px-2 text-center text-[10px] sm:text-xs font-bold text-foreground print:text-black">Tick the box if counted and in good condition</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Pre-defined IT Equipment items */}
                        {IT_EQUIPMENT.map((item, idx) => {
                          const asset = groupedAssets.itEquipment.find(a => {
                            const subCategoryName = a.subCategory?.name?.trim() || ''
                            return subCategoryName.toLowerCase() === item.toLowerCase() ||
                                   subCategoryName.toLowerCase().includes(item.toLowerCase())
                          })
                          return (
                            <tr key={`it-${idx}`} className="border-b border-border dark:border-gray-600 print:border-black">
                              <td 
                                className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black cursor-pointer hover:bg-muted/50 print:hover:bg-transparent transition-colors"
                                onClick={() => handleRowItemClick(item)}
                                title="Click to scan asset"
                              >
                                {item}
                              </td>
                              <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-center text-[10px] sm:text-xs text-foreground print:text-black">
                                {asset ? asset.quantity : ''}
                              </td>
                              <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">
                                {asset ? asset.assetTagId : ''}
                              </td>
                              <td className="py-0.5 px-1 sm:px-2 text-center">
                                {asset ? (
                                  <input
                                    type="checkbox"
                                    checked={asset.condition}
                                    onChange={(e) => handleUpdateAsset(asset.id, 'condition', e.target.checked)}
                                    className="w-3 h-3 accent-primary print:w-3 print:h-3"
                                  />
                                ) : (
                                  <input type="checkbox" checked={false} className="w-3 h-3 accent-primary print:w-3 print:h-3" disabled readOnly />
                                )}
                              </td>
                            </tr>
                          )
                        })}
                        
                        {/* Additional IT equipment from selected assets */}
                        {groupedAssets.itEquipment.filter(a => {
                          const subCategoryName = a.subCategory?.name?.trim() || ''
                          return !IT_EQUIPMENT.some(item => 
                            subCategoryName.toLowerCase() === item.toLowerCase() ||
                            subCategoryName.toLowerCase().includes(item.toLowerCase())
                          )
                        }).map((asset) => (
                          <tr key={asset.id} className="border-b border-border dark:border-gray-600 print:border-black">
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-xs text-foreground print:text-black">{asset.subCategory?.name || asset.description}</td>
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-center text-xs text-foreground print:text-black">{asset.quantity}</td>
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-xs text-foreground print:text-black">{asset.assetTagId}</td>
                            <td className="py-0.5 px-2 text-center">
                              <input
                                type="checkbox"
                                checked={asset.condition}
                                onChange={(e) => handleUpdateAsset(asset.id, 'condition', e.target.checked)}
                                className="w-3 h-3 accent-primary print:w-3 print:h-3"
                              />
                            </td>
                          </tr>
                        ))}

                        {/* Empty rows for manual entry */}
                        {[...Array(Math.max(0, 5 - groupedAssets.itEquipment.length))].map((_, idx) => (
                          <tr key={`empty-left-${idx}`} className="border-b border-border dark:border-gray-600 print:border-black">
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black p-2 text-xs"></td>
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black p-2 text-center text-xs"></td>
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black p-2 text-xs"></td>
                            <td className="p-2 text-center"></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Right Table - Others & Resigned Staff */}
                  <div className="border-2 border-border dark:border-gray-600 print:border-black overflow-x-auto">
                    <table className="w-full border-collapse min-w-[600px] print:min-w-0">
                      <thead>
                        <tr className="border-b-2 border-border dark:border-gray-600 print:border-black">
                          <th className="border-r-2 border-border dark:border-gray-600 print:border-black py-1 px-1 sm:px-2 text-[10px] sm:text-xs font-bold text-foreground print:text-black">Assets Returned</th>
                          <th className="border-r-2 border-border dark:border-gray-600 print:border-black py-1 px-1 sm:px-2 text-center text-[10px] sm:text-xs font-bold w-10 sm:w-12 text-foreground print:text-black">QTY</th>
                          <th className="border-r-2 border-border dark:border-gray-600 print:border-black py-1 px-1 sm:px-2 text-left text-[10px] sm:text-xs font-bold text-foreground print:text-black">Asset Tag / QR code</th>
                          <th className="py-1 px-1 sm:px-2 text-center text-[10px] sm:text-xs font-bold text-foreground print:text-black">Tick the box if counted and in good condition</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Others section header */}
                        <tr className="border-b-2 border-border dark:border-gray-600 print:border-black bg-muted print:bg-gray-50">
                          <td colSpan={4} className="p-2 text-sm font-bold text-foreground print:text-black">Others:</td>
                        </tr>
                        
                        {/* Pre-defined Other items */}
                        {OTHER_ITEMS.map((item, idx) => {
                          const asset = groupedAssets.otherItems.find(a => {
                            const subCategoryName = a.subCategory?.name?.trim() || ''
                            return subCategoryName.toLowerCase() === item.toLowerCase() ||
                                   subCategoryName.toLowerCase().includes(item.toLowerCase())
                          })
                          return (
                            <tr key={`other-${idx}`} className="border-b border-border dark:border-gray-600 print:border-black">
                              <td 
                                className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black cursor-pointer hover:bg-muted/50 print:hover:bg-transparent transition-colors"
                                onClick={() => handleRowItemClick(item)}
                                title="Click to scan asset"
                              >
                                {item}
                              </td>
                              <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-center text-[10px] sm:text-xs text-foreground print:text-black">
                                {asset ? asset.quantity : ''}
                              </td>
                              <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">
                                {asset ? asset.assetTagId : ''}
                              </td>
                              <td className="py-0.5 px-1 sm:px-2 text-center">
                                {asset ? (
                                  <input
                                    type="checkbox"
                                    checked={asset.condition}
                                    onChange={(e) => handleUpdateAsset(asset.id, 'condition', e.target.checked)}
                                    className="w-3 h-3 accent-primary print:w-3 print:h-3"
                                  />
                                ) : (
                                  <input type="checkbox" checked={false} className="w-3 h-3 accent-primary print:w-3 print:h-3" disabled readOnly />
                                )}
                              </td>
                            </tr>
                          )
                        })}

                        {/* Additional other items from selected assets */}
                        {groupedAssets.otherItems.filter(a => {
                          const subCategoryName = a.subCategory?.name?.trim() || ''
                          return !OTHER_ITEMS.some(item => 
                            subCategoryName.toLowerCase() === item.toLowerCase() ||
                            subCategoryName.toLowerCase().includes(item.toLowerCase())
                          )
                        }).map((asset) => (
                          <tr key={asset.id} className="border-b border-border dark:border-gray-600 print:border-black">
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-xs text-foreground print:text-black">{asset.subCategory?.name || asset.description}</td>
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-center text-xs text-foreground print:text-black">{asset.quantity}</td>
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-xs text-foreground print:text-black">{asset.assetTagId}</td>
                            <td className="py-0.5 px-2 text-center">
                              <input
                                type="checkbox"
                                checked={asset.condition}
                                onChange={(e) => handleUpdateAsset(asset.id, 'condition', e.target.checked)}
                                className="w-3 h-3 accent-primary print:w-3 print:h-3"
                              />
                            </td>
                          </tr>
                        ))}

                        {/* IF Resigned Staff section */}
                        {resignedStaff && (
                          <>
                            <tr className="border-b-2 border-border dark:border-gray-600 print:border-black bg-muted print:bg-gray-50">
                              <td colSpan={4} className="py-1 px-2 text-xs font-bold text-foreground print:text-black">IF Resigned Staff:</td>
                            </tr>
                            {RESIGNED_STAFF_ITEMS.map((item, idx) => {
                              const asset = groupedAssets.resignedItems.find(a => {
                                const subCategoryName = a.subCategory?.name?.trim() || ''
                                return subCategoryName.toLowerCase() === item.toLowerCase() ||
                                       subCategoryName.toLowerCase().includes(item.toLowerCase())
                              })
                              return (
                                <tr key={`resigned-${idx}`} className="border-b border-border dark:border-gray-600 print:border-black">
                                  <td 
                                    className="border-r-2 border-border dark:border-gray-600 print:border-black p-2 text-sm text-foreground print:text-black cursor-pointer hover:bg-muted/50 print:hover:bg-transparent transition-colors"
                                    onClick={() => handleRowItemClick(item)}
                                    title="Click to scan asset"
                                  >
                                    {item}
                                  </td>
                                  <td className="border-r-2 border-border dark:border-gray-600 print:border-black p-2 text-center text-sm text-foreground print:text-black">
                                    {asset ? asset.quantity : ''}
                                  </td>
                                  <td className="border-r-2 border-border dark:border-gray-600 print:border-black p-2 text-sm text-foreground print:text-black">
                                    {asset ? asset.assetTagId : ''}
                                  </td>
                                  <td className="p-2 text-center">
                                    {asset ? (
                                      <input
                                        type="checkbox"
                                        checked={asset.condition}
                                        onChange={(e) => handleUpdateAsset(asset.id, 'condition', e.target.checked)}
                                        className="w-3 h-3 accent-primary print:w-3 print:h-3"
                                      />
                                    ) : (
                                      <input type="checkbox" className="w-4 h-4 accent-primary" disabled />
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                            {groupedAssets.resignedItems.filter(a => {
                              const subCategoryName = a.subCategory?.name?.trim() || ''
                              return !RESIGNED_STAFF_ITEMS.some(item => 
                                subCategoryName.toLowerCase() === item.toLowerCase() ||
                                subCategoryName.toLowerCase().includes(item.toLowerCase())
                              )
                            }).map((asset) => (
                              <tr key={asset.id} className="border-b border-border dark:border-gray-600 print:border-black">
                                <td className="border-r-2 border-border dark:border-gray-600 print:border-black p-2 text-sm text-foreground print:text-black">{asset.subCategory?.name || asset.description}</td>
                                <td className="border-r-2 border-border dark:border-gray-600 print:border-black p-2 text-center text-sm text-foreground print:text-black">{asset.quantity}</td>
                                <td className="border-r-2 border-border dark:border-gray-600 print:border-black p-2 text-sm text-foreground print:text-black">{asset.assetTagId}</td>
                                <td className="p-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={asset.condition}
                                    onChange={(e) => handleUpdateAsset(asset.id, 'condition', e.target.checked)}
                                    className="w-3 h-3 accent-primary print:w-3 print:h-3"
                                  />
                                </td>
                              </tr>
                            ))}
                          </>
                        )}

                        {/* Custom items that don't match any category */}
                        {groupedAssets.custom.map((asset) => (
                          <tr key={asset.id} className="border-b border-border dark:border-gray-600 print:border-black">
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-xs text-foreground print:text-black">{asset.subCategory?.name || asset.description}</td>
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-center text-xs text-foreground print:text-black">{asset.quantity}</td>
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-xs text-foreground print:text-black">{asset.assetTagId}</td>
                            <td className="py-0.5 px-2 text-center">
                              <input
                                type="checkbox"
                                checked={asset.condition}
                                onChange={(e) => handleUpdateAsset(asset.id, 'condition', e.target.checked)}
                                className="w-3 h-3 accent-primary print:w-3 print:h-3"
                              />
                            </td>
                          </tr>
                        ))}

                        {/* Empty rows for manual entry */}
                        {[...Array(Math.max(0, 5 - groupedAssets.otherItems.length - groupedAssets.custom.length - (resignedStaff ? groupedAssets.resignedItems.length + RESIGNED_STAFF_ITEMS.length : 0)))].map((_, idx) => (
                          <tr key={`empty-right-${idx}`} className="border-b border-border dark:border-gray-600 print:border-black">
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black p-2 text-xs"></td>
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black p-2 text-center text-xs"></td>
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black p-2 text-xs"></td>
                            <td className="p-2 text-center"></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Signature Section */}
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <p className="text-xs font-medium mb-1 text-foreground print:text-black">Returned by:</p>
                    <div className="border-b border-border dark:border-gray-600 print:border-black mb-1 pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                      {returnerSignature || ''}
                    </div>
                    <p className="text-xs text-muted-foreground print:text-gray-600 mb-0.5">Signature over Printed Name</p>
                    <div className="border-b border-border dark:border-gray-600 print:border-black mb-1 pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                      {returnerDate || ''}
                    </div>
                    <p className="text-xs text-muted-foreground print:text-gray-600">Date</p>
                  </div>
                  <div>
                    <div>
                        <p className="text-xs font-bold print:text-black mt-1">IT DEPARTMENT</p>
                        <p className="italic text-[10px] text-muted-foreground print:text-gray-500">
                            This certify that assets brought back to the office above staff are complete and in good condition.
                        </p>
                    </div>
                    <div className="border-b border-border dark:border-gray-600 print:border-black mb-1 pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                      {itSignature || ''}
                    </div>
                    <p className="text-xs text-muted-foreground print:text-gray-600 mb-0.5">Signature over Printed Name</p>
                    <div className="border-b border-border dark:border-gray-600 print:border-black mb-1 pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                      {itDate || ''}
                    </div>
                    <p className="text-xs text-muted-foreground print:text-gray-600">Date</p>
                  </div>
                </div>
                </div>
              </div>

              {/* Separator between IT Copy and Admin Copy */}
              <div className="border-t-2 border-border dark:border-gray-600 print:border-black my-8 print:my-4"></div>

              {/* Admin Copy */}
              <div className="bg-card text-card-foreground p-4 sm:p-6 md:p-8 print:p-8 print:bg-white print:text-black relative print:break-after-page" id="return-form-admin">
                {/* Background Logo */}
                <div 
                  className="absolute inset-0 opacity-[0.01] print:opacity-[0.02] pointer-events-none z-0"
                  style={{
                    backgroundImage: 'url(/ShoreAgents-Logo-only.png)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                  }}
                />
                
                {/* Content */}
                <div className="relative z-10">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4 md:mb-6">
                    <div>
                      <Image 
                        src="/ShoreAgents-Logo.png" 
                        alt="ShoreAgents Logo" 
                        width={200}
                        height={80}
                        className="h-12 sm:h-16 print:h-20 object-contain"
                        priority
                      />
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-xs font-medium text-foreground print:text-black">CTRL NO.:</p>
                      <div className="border-b-2 border-border dark:border-gray-600 print:border-black w-full sm:w-32 mt-1 min-h-[20px] text-[10px] sm:text-xs print:text-[10px]">
                        {controlNumber || ''}
                      </div>
                    </div>
                  </div>

                {/* Title */}
                <h2 className="text-lg font-bold text-center mb-2 text-foreground print:text-black">RETURN OF ASSETS FORM</h2>
                <p className="text-sm font-semibold text-center mb-6 text-green-600 dark:text-green-500 print:text-green-600">ADMIN COPY</p>

                {/* Employee Details Box */}
                <div className="border-2 border-border dark:border-gray-600 print:border-black p-1.5 mb-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-0.5">
                    <div>
                      <p className="text-xs font-medium mb-0.5 text-foreground print:text-black">NAME OF THE EMPLOYEE:</p>
                      <div className="border-b border-border dark:border-gray-600 print:border-black pb-0.5 text-xs text-foreground print:text-black min-h-[16px]" data-employee-name>
                        {selectedEmployee?.name || ''}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-0.5 text-foreground print:text-black">CLIENT / DEPARTMENT:</p>
                      <div className="border-b border-border dark:border-gray-600 print:border-black pb-0.5 text-xs text-foreground print:text-black min-h-[16px]" data-employee-department>
                        {selectedEmployee?.department || ''}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-0.5 text-foreground print:text-black">DATE RETURNED:</p>
                      <div className="border-b border-border dark:border-gray-600 print:border-black pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                        {returnDate ? new Date(returnDate).toLocaleDateString() : ''}
                      </div>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <p className="text-xs font-medium mb-0.5 text-foreground print:text-black">POSITION:</p>
                        <div className="border-b border-border dark:border-gray-600 print:border-black pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                          {position || ''}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={returnToOffice}
                            readOnly
                            className="w-3 h-3 accent-primary print:w-3 print:h-3"
                          />
                          <span className="text-xs text-foreground print:text-black">RETURN TO OFFICE</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={resignedStaff}
                            readOnly
                            className="w-3 h-3 accent-primary print:w-3 print:h-3"
                          />
                          <span className="text-xs text-foreground print:text-black">RESIGNED STAFF</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Assets Tables - Two side-by-side tables */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                  {/* Left Table - IT Equipment */}
                  <div className="border-2 border-border dark:border-gray-600 print:border-black">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b-2 border-border dark:border-gray-600 print:border-black">
                          <th className="border-r-2 border-border dark:border-gray-600 print:border-black py-1 px-1 sm:px-2 text-[10px] sm:text-xs font-bold text-foreground print:text-black">Assets Returned</th>
                          <th className="border-r-2 border-border dark:border-gray-600 print:border-black py-1 px-1 sm:px-2 text-center text-[10px] sm:text-xs font-bold w-10 sm:w-12 text-foreground print:text-black">QTY</th>
                          <th className="border-r-2 border-border dark:border-gray-600 print:border-black py-1 px-1 sm:px-2 text-left text-[10px] sm:text-xs font-bold text-foreground print:text-black">Asset Tag / QR code</th>
                          <th className="py-1 px-1 sm:px-2 text-center text-[10px] sm:text-xs font-bold text-foreground print:text-black">Tick the box if counted and in good condition</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Pre-defined IT Equipment items */}
                        {IT_EQUIPMENT.map((item, idx) => {
                          const asset = groupedAssets.itEquipment.find(a => {
                            const subCategoryName = a.subCategory?.name?.trim() || ''
                            return subCategoryName.toLowerCase() === item.toLowerCase() ||
                                   subCategoryName.toLowerCase().includes(item.toLowerCase())
                          })
                          return (
                            <tr key={`it-admin-${idx}`} className="border-b border-border dark:border-gray-600 print:border-black">
                              <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-xs text-foreground print:text-black">{item}</td>
                              <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-center text-xs text-foreground print:text-black">
                                {asset ? asset.quantity : ''}
                              </td>
                              <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-xs text-foreground print:text-black">
                                {asset ? asset.assetTagId : ''}
                              </td>
                              <td className="py-0.5 px-2 text-center">
                                {asset ? (
                                  <input
                                    type="checkbox"
                                    checked={asset.condition}
                                    readOnly
                                    className="w-3 h-3 accent-primary print:w-3 print:h-3"
                                  />
                                ) : (
                                  <input type="checkbox" checked={false} className="w-3 h-3 accent-primary print:w-3 print:h-3" disabled readOnly />
                                )}
                              </td>
                            </tr>
                          )
                        })}
                        
                        {/* Additional IT equipment from selected assets */}
                        {groupedAssets.itEquipment.filter(a => {
                          const subCategoryName = a.subCategory?.name?.trim() || ''
                          return !IT_EQUIPMENT.some(item => 
                            subCategoryName.toLowerCase() === item.toLowerCase() ||
                            subCategoryName.toLowerCase().includes(item.toLowerCase())
                          )
                        }).map((asset) => (
                          <tr key={`it-admin-extra-${asset.id}`} className="border-b border-border dark:border-gray-600 print:border-black">
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-xs text-foreground print:text-black">{asset.subCategory?.name || asset.description}</td>
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-center text-xs text-foreground print:text-black">{asset.quantity}</td>
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-xs text-foreground print:text-black">{asset.assetTagId}</td>
                            <td className="py-0.5 px-2 text-center">
                              <input
                                type="checkbox"
                                checked={asset.condition}
                                readOnly
                                className="w-3 h-3 accent-primary print:w-3 print:h-3"
                              />
                            </td>
                          </tr>
                        ))}

                        {/* Empty rows for manual entry */}
                        {[...Array(Math.max(0, 5 - groupedAssets.itEquipment.length))].map((_, idx) => (
                          <tr key={`empty-left-admin-${idx}`} className="border-b border-border dark:border-gray-600 print:border-black">
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black p-2 text-xs"></td>
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black p-2 text-center text-xs"></td>
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black p-2 text-xs"></td>
                            <td className="p-2 text-center"></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Right Table - Others */}
                  <div className="border-2 border-border dark:border-gray-600 print:border-black overflow-x-auto">
                    <table className="w-full border-collapse min-w-[600px] print:min-w-0">
                      <thead>
                        <tr className="border-b-2 border-border dark:border-gray-600 print:border-black">
                          <th className="border-r-2 border-border dark:border-gray-600 print:border-black py-1 px-1 sm:px-2 text-[10px] sm:text-xs font-bold text-foreground print:text-black">Assets Returned</th>
                          <th className="border-r-2 border-border dark:border-gray-600 print:border-black py-1 px-1 sm:px-2 text-center text-[10px] sm:text-xs font-bold w-10 sm:w-12 text-foreground print:text-black">QTY</th>
                          <th className="border-r-2 border-border dark:border-gray-600 print:border-black py-1 px-1 sm:px-2 text-left text-[10px] sm:text-xs font-bold text-foreground print:text-black">Asset Tag / QR code</th>
                          <th className="py-1 px-1 sm:px-2 text-center text-[10px] sm:text-xs font-bold text-foreground print:text-black">Tick the box if counted and in good condition</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Others section header */}
                        <tr className="border-b-2 border-border dark:border-gray-600 print:border-black bg-muted print:bg-gray-50">
                          <td colSpan={4} className="p-2 text-sm font-bold text-foreground print:text-black">Others:</td>
                        </tr>
                        
                        {/* Pre-defined Other items */}
                        {OTHER_ITEMS.map((item, idx) => {
                          const asset = groupedAssets.otherItems.find(a => {
                            const subCategoryName = a.subCategory?.name?.trim() || ''
                            return subCategoryName.toLowerCase() === item.toLowerCase() ||
                                   subCategoryName.toLowerCase().includes(item.toLowerCase())
                          })
                          return (
                            <tr key={`other-admin-${idx}`} className="border-b border-border dark:border-gray-600 print:border-black">
                              <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-xs text-foreground print:text-black">{item}</td>
                              <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-center text-xs text-foreground print:text-black">
                                {asset ? asset.quantity : ''}
                              </td>
                              <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-xs text-foreground print:text-black">
                                {asset ? asset.assetTagId : ''}
                              </td>
                              <td className="py-0.5 px-2 text-center">
                                {asset ? (
                                  <input
                                    type="checkbox"
                                    checked={asset.condition}
                                    readOnly
                                    className="w-3 h-3 accent-primary print:w-3 print:h-3"
                                  />
                                ) : (
                                  <input type="checkbox" checked={false} className="w-3 h-3 accent-primary print:w-3 print:h-3" disabled readOnly />
                                )}
                              </td>
                            </tr>
                          )
                        })}

                        {/* Additional other items from selected assets */}
                        {groupedAssets.otherItems.filter(a => {
                          const subCategoryName = a.subCategory?.name?.trim() || ''
                          return !OTHER_ITEMS.some(item => 
                            subCategoryName.toLowerCase() === item.toLowerCase() ||
                            subCategoryName.toLowerCase().includes(item.toLowerCase())
                          )
                        }).map((asset) => (
                          <tr key={`other-admin-extra-${asset.id}`} className="border-b border-border dark:border-gray-600 print:border-black">
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-xs text-foreground print:text-black">{asset.subCategory?.name || asset.description}</td>
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-center text-xs text-foreground print:text-black">{asset.quantity}</td>
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-xs text-foreground print:text-black">{asset.assetTagId}</td>
                            <td className="py-0.5 px-2 text-center">
                              <input
                                type="checkbox"
                                checked={asset.condition}
                                readOnly
                                className="w-3 h-3 accent-primary print:w-3 print:h-3"
                              />
                            </td>
                          </tr>
                        ))}

                        {/* IF Resigned Staff section */}
                        {resignedStaff && (
                          <>
                            <tr className="border-b-2 border-border dark:border-gray-600 print:border-black bg-muted print:bg-gray-50">
                              <td colSpan={4} className="py-1 px-2 text-xs font-bold text-foreground print:text-black">IF Resigned Staff:</td>
                            </tr>
                            {RESIGNED_STAFF_ITEMS.map((item, idx) => {
                              const asset = groupedAssets.resignedItems.find(a => {
                                const subCategoryName = a.subCategory?.name?.trim() || ''
                                return subCategoryName.toLowerCase() === item.toLowerCase() ||
                                       subCategoryName.toLowerCase().includes(item.toLowerCase())
                              })
                              return (
                                <tr key={`resigned-admin-${idx}`} className="border-b border-border dark:border-gray-600 print:border-black">
                                  <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-xs text-foreground print:text-black">{item}</td>
                                  <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-center text-xs text-foreground print:text-black">
                                    {asset ? asset.quantity : ''}
                                  </td>
                                  <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-xs text-foreground print:text-black">
                                    {asset ? asset.assetTagId : ''}
                                  </td>
                                  <td className="py-0.5 px-2 text-center">
                                    {asset ? (
                                      <input
                                        type="checkbox"
                                        checked={asset.condition}
                                        readOnly
                                        className="w-3 h-3 accent-primary print:w-3 print:h-3"
                                      />
                                    ) : (
                                      <input type="checkbox" checked={false} className="w-3 h-3 accent-primary print:w-3 print:h-3" disabled readOnly />
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                            {groupedAssets.resignedItems.filter(a => {
                              const subCategoryName = a.subCategory?.name?.trim() || ''
                              return !RESIGNED_STAFF_ITEMS.some(item => 
                                subCategoryName.toLowerCase() === item.toLowerCase() ||
                                subCategoryName.toLowerCase().includes(item.toLowerCase())
                              )
                            }).map((asset) => (
                              <tr key={`resigned-admin-extra-${asset.id}`} className="border-b border-border dark:border-gray-600 print:border-black">
                                <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-xs text-foreground print:text-black">{asset.subCategory?.name || asset.description}</td>
                                <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-center text-xs text-foreground print:text-black">{asset.quantity}</td>
                                <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-xs text-foreground print:text-black">{asset.assetTagId}</td>
                                <td className="py-0.5 px-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={asset.condition}
                                    readOnly
                                    className="w-3 h-3 accent-primary print:w-3 print:h-3"
                                  />
                                </td>
                              </tr>
                            ))}
                          </>
                        )}

                        {/* Custom items that don't match any category */}
                        {groupedAssets.custom.map((asset) => (
                          <tr key={`custom-admin-${asset.id}`} className="border-b border-border dark:border-gray-600 print:border-black">
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-xs text-foreground print:text-black">{asset.subCategory?.name || asset.description}</td>
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-center text-xs text-foreground print:text-black">{asset.quantity}</td>
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-xs text-foreground print:text-black">{asset.assetTagId}</td>
                            <td className="py-0.5 px-2 text-center">
                              <input
                                type="checkbox"
                                checked={asset.condition}
                                readOnly
                                className="w-3 h-3 accent-primary print:w-3 print:h-3"
                              />
                            </td>
                          </tr>
                        ))}

                        {/* Empty rows for manual entry */}
                        {[...Array(Math.max(0, 5 - groupedAssets.otherItems.length - groupedAssets.custom.length - (resignedStaff ? groupedAssets.resignedItems.length + RESIGNED_STAFF_ITEMS.length : 0)))].map((_, idx) => (
                          <tr key={`empty-right-admin-${idx}`} className="border-b border-border dark:border-gray-600 print:border-black">
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black p-2 text-xs"></td>
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black p-2 text-center text-xs"></td>
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black p-2 text-xs"></td>
                            <td className="p-2 text-center"></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Signature Section */}
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-sm font-medium mb-2 text-foreground print:text-black">Returned by:</p>
                    <div className="border-b border-border dark:border-gray-600 print:border-black mb-2 pb-1 text-foreground print:text-black min-h-[24px]">
                      {returnerSignature || ''}
                    </div>
                    <p className="text-xs text-muted-foreground print:text-gray-600 mb-1">Signature over Printed Name</p>
                    <div className="border-b border-border dark:border-gray-600 print:border-black mb-2 pb-1 text-foreground print:text-black min-h-[24px]">
                      {returnerDate || ''}
                    </div>
                    <p className="text-xs text-muted-foreground print:text-gray-600">Date</p>
                  </div>
                  <div>
                    <div>
                        <p className="text-sm font-bold print:text-black mt-2">IT DEPARTMENT</p>
                        <p className="italic text-sm text-muted-foreground print:text-muted-foreground">
                            This certify that assets brought back to the office above staff are complete and in good condition.
                        </p>
                    </div>
                    <div className="border-b border-border dark:border-gray-600 print:border-black mb-2 pb-1 text-foreground print:text-black min-h-[24px]">
                      {itSignature || ''}
                    </div>
                    <p className="text-xs text-muted-foreground print:text-gray-600 mb-1">Signature over Printed Name</p>
                    <div className="border-b border-border dark:border-gray-600 print:border-black mb-2 pb-1 text-foreground print:text-black min-h-[24px]">
                      {itDate || ''}
                    </div>
                    <p className="text-xs text-muted-foreground print:text-gray-600">Date</p>
                    
                  </div>
                  
                </div>
                </div>
              </div>
            </CardContent>
          </Card>
          </>
        )}

          {/* Signature Inputs - Only visible when not printing */}
          {selectedEmployeeId && (
          <Card className="print:hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Signatures</CardTitle>
              <CardDescription className="text-xs">
                Fill in signature details
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <Field>
                    <FieldLabel htmlFor="returnerSignature">Returner Signature</FieldLabel>
                    <FieldContent>
                      <Input
                        id="returnerSignature"
                        placeholder="Signature over Printed Name"
                        value={returnerSignature}
                        onChange={(e) => setReturnerSignature(e.target.value)}
                      />
                    </FieldContent>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="returnerDate">Returner Date</FieldLabel>
                    <FieldContent>
                      <Input
                        id="returnerDate"
                        type="date"
                        value={returnerDate}
                        onChange={(e) => setReturnerDate(e.target.value)}
                      />
                    </FieldContent>
                  </Field>
                </div>
                <div className="space-y-4">
                  <Field>
                    <FieldLabel htmlFor="itSignature">IT Department Signature</FieldLabel>
                    <FieldContent>
                      <Input
                        id="itSignature"
                        placeholder="Signature over Printed Name"
                        value={itSignature}
                        onChange={(e) => setItSignature(e.target.value)}
                      />
                    </FieldContent>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="itDate">IT Department Date</FieldLabel>
                    <FieldContent>
                      <Input
                        id="itDate"
                        type="date"
                        value={itDate}
                        onChange={(e) => setItDate(e.target.value)}
                      />
                    </FieldContent>
                  </Field>
                </div>
              </div>
            </CardContent>
          </Card>
      )}

      {/* QR Code Scanner Dialog */}
      <QRScannerDialog
        open={qrDialogOpen}
        onOpenChange={(open) => {
          setQrDialogOpen(open)
          if (!open) {
            // Reset context when dialog closes
            setQrDialogContext('general')
            setTargetRowItem(null)
          }
        }}
        onScan={handleQRScan}
        description={qrDialogContext === 'table-row' && targetRowItem 
          ? `Scan a ${targetRowItem} asset to add to this row`
          : "Scan or upload a QR code to add an asset"}
      />

      {/* Floating Download PDF Button */}
      {selectedEmployee && !isLoadingEmployee && (
        <div 
          className="fixed bottom-6 z-50 flex items-center justify-center"
          style={{
            left: !sidebarOpen 
              ? '50%'
              : sidebarState === 'collapsed' 
                ? 'calc(var(--sidebar-width-icon, 3rem) + ((100vw - var(--sidebar-width-icon, 3rem)) / 2))'
                : 'calc(var(--sidebar-width, 16rem) + ((100vw - var(--sidebar-width, 16rem)) / 2))',
            transform: 'translateX(-50%)'
          }}
        >
          <Button
            type="button"
            size="lg"
            onClick={handleDownloadPDF}
            className="min-w-[140px] shadow-lg"
          >
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        </div>
      )}
    </div>
  )
}

