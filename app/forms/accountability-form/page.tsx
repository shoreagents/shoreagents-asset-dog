"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { XIcon, QrCode, RefreshCw, Download, ChevronDown } from "lucide-react"
import Image from "next/image"
import { usePermissions } from '@/hooks/use-permissions'
import { useSidebar } from '@/components/ui/sidebar'
import { useIsMobile } from '@/hooks/use-mobile'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { QRScannerDialog } from '@/components/dialogs/qr-scanner-dialog'
import { toast } from 'sonner'
import { useQuery } from "@tanstack/react-query"
import { useEmployee } from '@/hooks/use-employees'
import { motion, AnimatePresence } from "framer-motion"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldLabel, FieldContent } from "@/components/ui/field"
import { EmployeeSelectField } from "@/components/fields/employee-select-field"
import { DepartmentSelectField } from "@/components/fields/department-select-field"
import { cn } from "@/lib/utils"
import AccountabilityFormLoading from "./loading"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

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

interface AccountabilityAsset extends Asset {
  remarks?: string
}

// Helper function to get status badge with colors
const getStatusBadge = (status: string | null) => {
  if (!status) return null
  const statusLC = status.toLowerCase()
  let statusVariant: 'default' | 'secondary' | 'destructive' | 'outline' = 'outline'
  let statusColor = ''
  
  if (statusLC === 'active' || statusLC === 'available') {
    statusVariant = 'default'
    statusColor = 'bg-green-500'
  } else if (statusLC === 'checked out' || statusLC === 'in use') {
    statusVariant = 'destructive'
    statusColor = ''
  } else if (statusLC === 'leased') {
    statusVariant = 'secondary'
    statusColor = 'bg-yellow-500'
  } else if (statusLC === 'inactive' || statusLC === 'unavailable') {
    statusVariant = 'secondary'
    statusColor = 'bg-gray-500'
  } else if (statusLC === 'maintenance' || statusLC === 'repair') {
    statusColor = 'bg-red-600 text-white'
  } else if (statusLC === 'lost' || statusLC === 'missing') {
    statusVariant = 'destructive'
    statusColor = 'bg-orange-500'
  } else if (statusLC === 'disposed' || statusLC === 'disposal') {
    statusVariant = 'secondary'
    statusColor = 'bg-purple-500'
  }
  
  return <Badge variant={statusVariant} className={statusColor}>{status}</Badge>
}

interface ReplacementItem {
  id: string
  assetDescription: string
  oldAssetTag: string
  newAssetTag: string
  designatedIT: string
  date: string
}

// Pre-defined asset categories from the form
const ASSET_DESCRIPTIONS = [
  'LAPTOP',
  'CPU/SYSTEM UNIT',
  'MONITOR 1',
  'MONITOR 2',
  'HEADSET',
  'WEBCAM',
  'KEYBOARD',
  'MOUSE',
  'UPS',
  'IP PHONES',
]

const CABLES_AND_EXTENSIONS = [
  'DPORT TO VGA ADAPTER',
  'HDMI TO VGA ADAPTER',
  'DPORT MALE TO HDMI MALE CABLE',
  'HDMI MALE TO DVI CABLE',
]

async function fetchCompanyInfo(): Promise<{ companyInfo: { primaryLogoUrl: string | null; secondaryLogoUrl: string | null } | null }> {
  try {
    const response = await fetch('/api/setup/company-info')
    if (!response.ok) {
      return { companyInfo: null }
    }
    return response.json()
  } catch {
    return { companyInfo: null }
  }
}

export default function AccountabilityFormPage() {
  const { hasPermission, isLoading: isLoadingPermissions } = usePermissions()
  const { state: sidebarState, open: sidebarOpen } = useSidebar()
  const isMobile = useIsMobile()
  const canViewAccountabilityForms = hasPermission('canViewAccountabilityForms')
  const canManageAccountabilityForms = hasPermission('canManageAccountabilityForms')
  const canManageSetup = hasPermission('canManageSetup')

  // Fetch company info for logos
  const { data: companyData } = useQuery({
    queryKey: ['company-info'],
    queryFn: fetchCompanyInfo,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  })

  const primaryLogoUrl = companyData?.companyInfo?.primaryLogoUrl || '/ShoreAgents-Logo.png'
  const secondaryLogoUrl = companyData?.companyInfo?.secondaryLogoUrl || '/ShoreAgents-Logo-only.png'
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionRef = useRef<HTMLDivElement>(null)
  const [assetIdInput, setAssetIdInput] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const [selectedAssets, setSelectedAssets] = useState<AccountabilityAsset[]>([])
  const [loadingAssets, setLoadingAssets] = useState<Set<string>>(new Set())
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [qrDialogContext, setQrDialogContext] = useState<'general' | 'table-row'>('general')
  const [targetRowItem, setTargetRowItem] = useState<string | null>(null)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("")
  const [dateIssued, setDateIssued] = useState(new Date().toISOString().split('T')[0])
  const [position, setPosition] = useState("")
  const [clientDepartment, setClientDepartment] = useState("")
  const [ticketNo, setTicketNo] = useState("")
  const [accountabilityFormNo, setAccountabilityFormNo] = useState("")
  
  // Mobile phone fields
  const [mobileBrand, setMobileBrand] = useState("")
  const [mobileModel, setMobileModel] = useState("")
  const [imeiNo, setImeiNo] = useState("")
  const [simNo, setSimNo] = useState("")
  const [networkProvider, setNetworkProvider] = useState("")
  const [planAmount, setPlanAmount] = useState("")
  
  // Replacement items
  const [replacementItems, setReplacementItems] = useState<ReplacementItem[]>([])
  
  // Signature fields for Rules and Regulations
  const [staffSignature, setStaffSignature] = useState("")
  const [staffDate, setStaffDate] = useState("")
  const [itSignature, setItSignature] = useState("")
  const [itDate, setItDate] = useState("")
  const [assetCustodianSignature, setAssetCustodianSignature] = useState("")
  const [assetCustodianDate, setAssetCustodianDate] = useState("")
  const [financeSignature, setFinanceSignature] = useState("")
  const [financeDate, setFinanceDate] = useState("")
  const [isFormOpen, setIsFormOpen] = useState(false)

  // Fetch selected employee details
  const { data: selectedEmployee, isLoading: isLoadingEmployee } = useEmployee(selectedEmployeeId || null, !!selectedEmployeeId)

  // Auto-fill employee department when employee is selected
  useEffect(() => {
    if (selectedEmployee?.department) {
      setClientDepartment(selectedEmployee.department)
    }
  }, [selectedEmployee])

  // Auto-fill checked out assets when employee is selected
  useEffect(() => {
    if (selectedEmployee && selectedEmployee.checkouts) {
      // Filter active checkouts (those without checkins)
      const activeCheckouts = selectedEmployee.checkouts.filter(
        checkout => checkout.checkins.length === 0 && checkout.asset.status === "Checked out"
      )
      
      if (activeCheckouts.length > 0) {
        // Convert checkouts to AccountabilityAsset format
        const assetsToAdd: AccountabilityAsset[] = activeCheckouts.map(checkout => ({
          id: checkout.asset.id,
          assetTagId: checkout.asset.assetTagId,
          description: checkout.asset.description,
          status: checkout.asset.status,
          category: checkout.asset.category || null,
          subCategory: checkout.asset.subCategory || null,
          remarks: '',
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
    queryKey: ["asset-accountability-suggestions", assetIdInput, selectedAssets.length, showSuggestions],
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
    enabled: showSuggestions && canViewAccountabilityForms,
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

  // Add asset to accountability list
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
      toast.error('Asset is already in the accountability list')
      setAssetIdInput("")
      setShowSuggestions(false)
      return
    }

    const newAsset: AccountabilityAsset = {
      ...assetToAdd,
      remarks: '',
    }
    setSelectedAssets((prev) => [...prev, newAsset])
    setAssetIdInput("")
    setShowSuggestions(false)
    setSelectedSuggestionIndex(-1)
    toast.success('Asset added to accountability list')
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

  // Remove asset from accountability list
  const handleRemoveAsset = (assetId: string) => {
    setSelectedAssets((prev) => prev.filter((a) => a.id !== assetId))
    toast.success('Asset removed from accountability list')
  }

  // Update asset remarks
  const handleUpdateAsset = (assetId: string, field: 'remarks', value: string) => {
    setSelectedAssets((prev) =>
      prev.map((asset) =>
        asset.id === assetId ? { ...asset, [field]: value } : asset
      )
    )
  }

  // Handle QR code scan
  const handleQRScan = async (decodedText: string) => {
    // Check if already selected or loading
    const alreadySelected = selectedAssets.find(
      (a) => a.assetTagId.toLowerCase() === decodedText.toLowerCase()
    )
    if (alreadySelected) {
      toast.info(`Asset "${decodedText}" already selected`)
      return
    }

    if (loadingAssets.has(decodedText)) {
      return // Already loading this asset
    }

    // Add to loading state
    setLoadingAssets(prev => new Set(prev).add(decodedText))

    try {
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
          toast.error('Asset is already in the accountability list')
          // Keep context active in multi-scan mode
          return
        }

        const newAsset: AccountabilityAsset = {
          ...asset,
          remarks: '',
        }
        setSelectedAssets((prev) => [...prev, newAsset])
        toast.success(`Asset "${asset.assetTagId}" added to ${targetRowItem}`)
        // Keep context active for multi-scan - user can continue scanning same item type
        // Context will be reset when dialog closes
      } else {
        toast.error(`Asset subcategory "${subCategoryName}" does not match "${targetRowItem}". Please scan a ${targetRowItem} asset.`)
      }
    } else {
      // General scan - add to list normally
      await handleAddAsset(asset)
      }
    } finally {
      // Remove from loading state
      setLoadingAssets(prev => {
        const newSet = new Set(prev)
        newSet.delete(decodedText)
        return newSet
      })
    }
  }

  // Handle removing an asset from QR scanner
  const handleQRRemove = async (assetTagId: string) => {
    // Remove from loading state if present
    setLoadingAssets(prev => {
      const newSet = new Set(prev)
      newSet.delete(assetTagId)
      return newSet
    })
    // Find and remove the asset from selectedAssets
    const assetToRemove = selectedAssets.find(a => a.assetTagId === assetTagId)
    if (assetToRemove) {
      setSelectedAssets((prev) => prev.filter(a => a.id !== assetToRemove.id))
      toast.success(`Asset "${assetTagId}" removed from accountability list`)
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

  // Handle replacement items
  const handleAddReplacement = () => {
    const newReplacement: ReplacementItem = {
      id: `replacement-${Date.now()}`,
      assetDescription: '',
      oldAssetTag: '',
      newAssetTag: '',
      designatedIT: '',
      date: new Date().toISOString().split('T')[0],
    }
    setReplacementItems((prev) => [...prev, newReplacement])
  }

  const handleRemoveReplacement = (id: string) => {
    setReplacementItems((prev) => prev.filter((item) => item.id !== id))
  }

  const handleUpdateReplacement = (id: string, field: keyof ReplacementItem, value: string) => {
    setReplacementItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    )
  }

  // Generate accountability form number
  const handleGenerateAccountabilityFormNo = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    
    // Format: AF-YYYYMMDD-XXXX
    const generatedAFNo = `AF-${year}${month}${day}-${randomNum}`
    setAccountabilityFormNo(generatedAFNo)
    toast.success('Accountability Form number generated')
  }

  // Group assets by description for display
  const groupedAssets = useMemo(() => {
    const groups: {
      mainAssets: AccountabilityAsset[]
      cables: AccountabilityAsset[]
      others: AccountabilityAsset[]
    } = {
      mainAssets: [],
      cables: [],
      others: [],
    }

    selectedAssets.forEach(asset => {
      const subCategoryName = asset.subCategory?.name?.trim() || asset.description.toUpperCase()
      
      // Check if subcategory matches main asset descriptions
      const isMainAsset = ASSET_DESCRIPTIONS.some(item => 
        subCategoryName.toUpperCase() === item.toUpperCase() ||
        subCategoryName.toUpperCase().includes(item.toUpperCase()) ||
        item.toUpperCase().includes(subCategoryName.toUpperCase())
      )
      
      // Check if subcategory matches cables
      const isCable = CABLES_AND_EXTENSIONS.some(item => 
        subCategoryName.toUpperCase() === item.toUpperCase() ||
        subCategoryName.toUpperCase().includes(item.toUpperCase()) ||
        item.toUpperCase().includes(subCategoryName.toUpperCase())
      )

      if (isMainAsset) {
        groups.mainAssets.push(asset)
      } else if (isCable) {
        groups.cables.push(asset)
      } else {
        groups.others.push(asset)
      }
    })

    return groups
  }, [selectedAssets])

  // Handle PDF download
  const handleDownloadPDF = async () => {
    if (!canManageAccountabilityForms) {
      toast.error('You do not have permission to download accountability forms')
      return
    }

    if (!selectedEmployee) {
      toast.error('Please select an employee first')
      return
    }

    // Ensure the form is open before generating PDF
    setIsFormOpen(true)
    
    // Wait a bit for the collapsible to open and render
    await new Promise(resolve => setTimeout(resolve, 100))

    const formElement = document.getElementById('accountability-form')
    const rulesElement = document.getElementById('accountability-form-rules')
    
    if (!formElement) {
      toast.error('Form not found')
      return
    }

    try {
      toast.loading('Generating PDF... 0%', { id: 'pdf-generation' })
      
      // Update progress: Preparing HTML (0-10%)
      toast.loading('Generating PDF... 5%', { id: 'pdf-generation' })
      
      // Get the HTML content with computed styles for first page
      let htmlContent = formElement.outerHTML
      
      // Get the HTML content for second page (Rules and Regulations)
      let htmlContentRules = ''
      if (rulesElement) {
        htmlContentRules = rulesElement.outerHTML
      }
      
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
      if (htmlContentRules) {
        htmlContentRules = htmlContentRules.replace(
          /src="(\/[^"]+)"/g,
          (match, path) => `src="${origin}${path}"`
        )
        htmlContentRules = htmlContentRules.replace(
          /url\((\/[^)]+)\)/g,
          (match, path) => `url(${origin}${path})`
        )
      }
      
      // Update progress: Converting images (10-30%)
      toast.loading('Generating PDF... 10%', { id: 'pdf-generation' })
      
      // Convert images to base64 for better reliability
      const allImages = [
        ...Array.from(formElement.querySelectorAll('img')),
        ...(rulesElement ? Array.from(rulesElement.querySelectorAll('img')) : [])
      ]
      const imageReplacements: Array<{ original: string, replacement: string }> = []
      
      let imageProgress = 0
      const totalImages = allImages.length
      
      await Promise.all(Array.from(allImages).map(async (img) => {
        const htmlImg = img as HTMLImageElement
        const originalSrc = htmlImg.src || htmlImg.getAttribute('src') || ''
        
        if (originalSrc && (originalSrc.startsWith('http') || originalSrc.startsWith('/'))) {
          try {
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
            
            // Update progress for each image converted (10-30%)
            imageProgress++
            const imagePercent = 10 + Math.round((imageProgress / totalImages) * 20)
            toast.loading(`Generating PDF... ${imagePercent}%`, { id: 'pdf-generation' })
          } catch (error) {
            console.error('Failed to convert image to base64:', error)
            if (originalSrc.startsWith('/')) {
              imageReplacements.push({
                original: originalSrc,
                replacement: `${origin}${originalSrc}`
              })
            }
            
            // Update progress even on error
            imageProgress++
            const imagePercent = 10 + Math.round((imageProgress / totalImages) * 20)
            toast.loading(`Generating PDF... ${imagePercent}%`, { id: 'pdf-generation' })
          }
        }
      }))
      
      // Update progress: Preparing HTML document (30-35%)
      toast.loading('Generating PDF... 30%', { id: 'pdf-generation' })
      
      // Apply image replacements to both pages
      imageReplacements.forEach(({ original, replacement }) => {
        htmlContent = htmlContent.replace(
          new RegExp(`src=["']${original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'g'),
          `src="${replacement}"`
        )
        if (htmlContentRules) {
          htmlContentRules = htmlContentRules.replace(
            new RegExp(`src=["']${original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'g'),
            `src="${replacement}"`
          )
        }
      })
      
      // Get all stylesheets
      const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map(style => style.outerHTML)
        .join('\n')
      
      // Get computed styles for the form element
      const computedStyles = window.getComputedStyle(formElement)
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
              #accountability-form {
                ${formStyles}
                width: 100%;
                margin: 0;
                padding: 16px !important;
                box-sizing: border-box;
                background: white !important;
                color: black !important;
              }
              #accountability-form-rules {
                width: 100%;
                margin: 0;
                padding: 16px !important;
                box-sizing: border-box;
                background: white !important;
                color: black !important;
              }
            </style>
          </head>
          <body>
            ${htmlContent}
            ${htmlContentRules}
          </body>
        </html>
      `

      // Use XMLHttpRequest to track download progress
      const xhr = new XMLHttpRequest()
      let simulatedProgress = 35
      let progressInterval: NodeJS.Timeout | null = null
      let hasStartedDownload = false
      
      return new Promise<void>((resolve, reject) => {
        try {
          // Update progress: Sending request (35-40%)
          toast.loading('Generating PDF... 35%', { id: 'pdf-generation' })
          
          // Simulate progress during generation phase (35-70%)
          progressInterval = setInterval(() => {
            if (!hasStartedDownload && simulatedProgress < 70) {
              simulatedProgress += 2
              if (simulatedProgress > 70) simulatedProgress = 70
              toast.loading(`Generating PDF... ${simulatedProgress}%`, { id: 'pdf-generation' })
            }
          }, 200) // Update every 200ms

          xhr.open('POST', '/api/assets/accountability-form/pdf', true)
          xhr.setRequestHeader('Content-Type', 'application/json')
          xhr.responseType = 'blob'

          // Track real download progress (70-100%)
          xhr.addEventListener('progress', (event) => {
            hasStartedDownload = true
            if (progressInterval) {
              clearInterval(progressInterval)
              progressInterval = null
            }
            
            if (event.lengthComputable && event.total > 0) {
              // Map download progress to 70-100% range
              const downloadPercent = Math.round((event.loaded / event.total) * 100)
              const totalPercent = 70 + Math.round(downloadPercent * 0.3) // 70% + (download% * 30%)
              toast.loading(`Generating PDF... ${totalPercent}%`, { id: 'pdf-generation' })
            } else if (event.loaded > 0) {
              // If content length is unknown but we have loaded bytes, show progress
              toast.loading('Generating PDF... 75%', { id: 'pdf-generation' })
            }
          })

          xhr.addEventListener('load', async () => {
            // Clear progress interval if still running
            if (progressInterval) {
              clearInterval(progressInterval)
              progressInterval = null
            }
            
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const blob = xhr.response
      
                // Create download link
                const url = window.URL.createObjectURL(blob)
                const link = document.createElement('a')
                link.href = url
                link.download = `Accountability-Form-${selectedEmployee?.name?.replace(/\s+/g, '-') || 'Employee'}-${dateIssued || new Date().toISOString().split('T')[0]}.pdf`
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
                window.URL.revokeObjectURL(url)

                toast.success('PDF downloaded successfully', { id: 'pdf-generation' })

                // Save form data to database after PDF is successfully downloaded
                try {
                  const formData = {
                    dateIssued,
                    position,
                    clientDepartment,
                    ticketNo,
                    accountabilityFormNo,
                    mobileBrand,
                    mobileModel,
                    imeiNo,
                    simNo,
                    networkProvider,
                    planAmount,
                    selectedAssets: selectedAssets.map(asset => ({
                      id: asset.id,
                      assetTagId: asset.assetTagId,
                      description: asset.description,
                      remarks: asset.remarks,
                    })),
                    replacementItems,
                    staffSignature,
                    staffDate,
                    itSignature,
                    itDate,
                    assetCustodianSignature,
                    assetCustodianDate,
                    financeSignature,
                    financeDate,
                  }

                  const saveResponse = await fetch('/api/forms/accountability-form', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      employeeUserId: selectedEmployeeId,
                      dateIssued,
                      department: clientDepartment || selectedEmployee?.department || null,
                      accountabilityFormNo: accountabilityFormNo || null,
                      formData,
                    }),
                  })

                  if (!saveResponse.ok) {
                    const error = await saveResponse.json()
                    console.error('Failed to save accountability form:', error)
                    toast.error('PDF downloaded but failed to save form history', { id: 'form-save' })
                  } else {
                    toast.success('Form saved successfully', { id: 'form-save' })
                  }
                } catch (saveError) {
                  console.error('Error saving accountability form:', saveError)
                  toast.error('PDF downloaded but failed to save form history', { id: 'form-save' })
                }

                resolve()
              } catch (error) {
                console.error('Error processing PDF:', error)
                toast.error('Failed to process PDF', { id: 'pdf-generation' })
                reject(error)
              }
            } else {
              // Try to parse error response
              if (progressInterval) {
                clearInterval(progressInterval)
                progressInterval = null
              }
              
              const reader = new FileReader()
              reader.onload = () => {
                try {
                  const errorData = JSON.parse(reader.result as string)
                  const errorMessage = errorData.error || 'Failed to generate PDF'
                  toast.error(errorMessage, { id: 'pdf-generation' })
                  reject(new Error(errorMessage))
                } catch {
                  toast.error('Failed to generate PDF', { id: 'pdf-generation' })
                  reject(new Error('Failed to generate PDF'))
                }
              }
              reader.onerror = () => {
                toast.error('Failed to generate PDF', { id: 'pdf-generation' })
                reject(new Error('Failed to generate PDF'))
              }
              if (xhr.response) {
                reader.readAsText(xhr.response)
              } else {
                toast.error('Failed to generate PDF', { id: 'pdf-generation' })
                reject(new Error('Failed to generate PDF'))
              }
            }
          })

          xhr.addEventListener('error', () => {
            if (progressInterval) {
              clearInterval(progressInterval)
              progressInterval = null
            }
            toast.error('Network error while generating PDF', { id: 'pdf-generation' })
            reject(new Error('Network error'))
          })

          xhr.addEventListener('abort', () => {
            if (progressInterval) {
              clearInterval(progressInterval)
              progressInterval = null
            }
            toast.error('PDF generation cancelled', { id: 'pdf-generation' })
            reject(new Error('Cancelled'))
          })

          xhr.send(JSON.stringify({
            html: fullHTML,
            elementIds: ['#accountability-form', '#accountability-form-rules'],
          }))
        } catch (error) {
          if (progressInterval) {
            clearInterval(progressInterval)
            progressInterval = null
          }
          console.error('Error generating PDF:', error)
          toast.error(error instanceof Error ? error.message : 'Failed to generate PDF', { id: 'pdf-generation' })
          reject(error)
        }
      })
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: 'pdf-generation' })
    }
  }

  // Show toast notification if user doesn't have view permission
  // Only show after permissions are loaded to avoid showing during initial load
  useEffect(() => {
    if (!isLoadingPermissions && !canViewAccountabilityForms) {
      toast.error('You do not have permission to view accountability forms')
    }
  }, [canViewAccountabilityForms, isLoadingPermissions])

  // Show loading state while permissions are loading
  if (isLoadingPermissions) {
    return <AccountabilityFormLoading />
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-full overflow-x-hidden"
    >
      <div className="mb-4 md:mb-6">
        <h1 className="text-2xl md:text-3xl font-bold">Accountability Form</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Generate a printable accountability form for employees
        </p>
      </div>

      {/* Employee Selection Card */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Employee Selection</CardTitle>
          <CardDescription className="text-xs">
            Select an employee to generate the accountability form
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2 pb-4">
          <EmployeeSelectField
            value={selectedEmployeeId}
            onValueChange={setSelectedEmployeeId}
            label="Employee"
            required
            disabled={!canViewAccountabilityForms}
            placeholder="Select an employee"
          />
        </CardContent>
      </Card>

      {/* Form Details - Show when employee is selected or loading */}
      <AnimatePresence>
      {(selectedEmployeeId && (selectedEmployee || isLoadingEmployee)) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
          >
          {/* Form Details Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
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
                  <FieldLabel htmlFor="accountabilityFormNo">AF NO.:</FieldLabel>
                  <FieldContent>
                    <div className="flex gap-2">
                      <Input
                        id="accountabilityFormNo"
                        placeholder="Accountability Form Number"
                        value={accountabilityFormNo}
                        onChange={(e) => setAccountabilityFormNo(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleGenerateAccountabilityFormNo}
                        title="Generate AF Number"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
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

                {selectedEmployee ? (
                  <Field>
                    <FieldLabel htmlFor="clientDepartment">CLIENT/DEPARTMENT:</FieldLabel>
                    <FieldContent>
                      <Input
                        id="clientDepartment"
                        value={clientDepartment}
                        disabled
                        className="bg-muted cursor-not-allowed"
                      />
                    </FieldContent>
                  </Field>
                ) : (
                  <DepartmentSelectField
                    value={clientDepartment}
                    onValueChange={(value) => setClientDepartment(value)}
                    label="CLIENT/DEPARTMENT:"
                    placeholder="Select or search department"
                    canCreate={canManageSetup}
                  />
                )}

                <Field>
                  <FieldLabel htmlFor="dateIssued">
                    DATE ISSUED: <span className="text-destructive">*</span>
                  </FieldLabel>
                  <FieldContent>
                    <Input
                      id="dateIssued"
                      type="date"
                      value={dateIssued}
                      onChange={(e) => setDateIssued(e.target.value)}
                      required
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="ticketNo">TICKET NO.:</FieldLabel>
                  <FieldContent>
                    <Input
                      id="ticketNo"
                      placeholder="Ticket Number"
                      value={ticketNo}
                      onChange={(e) => setTicketNo(e.target.value)}
                    />
                  </FieldContent>
                </Field>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mobile Phone Details Card */}
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Mobile Phone Details</CardTitle>
              <CardDescription className="text-xs">
                Fill in mobile phone information if applicable
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2 pb-4">
              {isLoadingEmployee ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex flex-col items-center gap-3">
                    <Spinner className="h-8 w-8" />
                    <p className="text-sm text-muted-foreground">Loading employee details...</p>
                  </div>
                </div>
              ) : (
                <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="mobileBrand">BRAND:</FieldLabel>
                  <FieldContent>
                    <Input
                      id="mobileBrand"
                      placeholder="Mobile phone brand"
                      value={mobileBrand}
                      onChange={(e) => setMobileBrand(e.target.value)}
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="mobileModel">MODEL:</FieldLabel>
                  <FieldContent>
                    <Input
                      id="mobileModel"
                      placeholder="Mobile phone model"
                      value={mobileModel}
                      onChange={(e) => setMobileModel(e.target.value)}
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="imeiNo">IMEI NO.:</FieldLabel>
                  <FieldContent>
                    <Input
                      id="imeiNo"
                      placeholder="IMEI Number"
                      value={imeiNo}
                      onChange={(e) => setImeiNo(e.target.value)}
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="simNo">SIM NO.:</FieldLabel>
                  <FieldContent>
                    <Input
                      id="simNo"
                      placeholder="SIM Number"
                      value={simNo}
                      onChange={(e) => setSimNo(e.target.value)}
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="networkProvider">NETWORK PROVIDER:</FieldLabel>
                  <FieldContent>
                    <Input
                      id="networkProvider"
                      placeholder="Network Provider"
                      value={networkProvider}
                      onChange={(e) => setNetworkProvider(e.target.value)}
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="planAmount">PLAN AMOUNT:</FieldLabel>
                  <FieldContent>
                    <Input
                      id="planAmount"
                      placeholder="Plan Amount"
                      value={planAmount}
                      onChange={(e) => setPlanAmount(e.target.value)}
                    />
                  </FieldContent>
                </Field>
                </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Replacement Items Card */}
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Replacement Items</CardTitle>
                  <CardDescription className="text-xs">
                    Add replacement items to track asset replacements
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddReplacement}
                  disabled={isLoadingEmployee}
                >
                  Add Replacement
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-2 pb-4">
              {isLoadingEmployee ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex flex-col items-center gap-3">
                    <Spinner className="h-8 w-8" />
                    <p className="text-sm text-muted-foreground">Loading employee details...</p>
                  </div>
                </div>
              ) : replacementItems.length > 0 ? (
                <div className="space-y-3">
                  <AnimatePresence>
                    {replacementItems.map((item, index) => (
                      <motion.div
                      key={item.id}
                        initial={{ opacity: 0, x: -20, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 20, scale: 0.95 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                      className="grid grid-cols-1 md:grid-cols-5 gap-2 p-3 border rounded-md bg-muted/50"
                    >
                      <Input
                        placeholder="Asset Description"
                        value={item.assetDescription}
                        onChange={(e) => handleUpdateReplacement(item.id, 'assetDescription', e.target.value)}
                        className="text-sm"
                      />
                      <Input
                        placeholder="Old Asset Tag"
                        value={item.oldAssetTag}
                        onChange={(e) => handleUpdateReplacement(item.id, 'oldAssetTag', e.target.value)}
                        className="text-sm"
                      />
                      <Input
                        placeholder="New Asset Tag"
                        value={item.newAssetTag}
                        onChange={(e) => handleUpdateReplacement(item.id, 'newAssetTag', e.target.value)}
                        className="text-sm"
                      />
                      <Input
                        placeholder="Designated IT"
                        value={item.designatedIT}
                        onChange={(e) => handleUpdateReplacement(item.id, 'designatedIT', e.target.value)}
                        className="text-sm"
                      />
                      <div className="flex gap-2">
                        <Input
                          type="date"
                          value={item.date}
                          onChange={(e) => handleUpdateReplacement(item.id, 'date', e.target.value)}
                          className="text-sm flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveReplacement(item.id)}
                          className="h-8 w-8 shrink-0 rounded-full"
                        >
                          <XIcon className="h-4 w-4" />
                        </Button>
                      </div>
                      </motion.div>
                  ))}
                  </AnimatePresence>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No replacement items added. Click &quot;Add Replacement&quot; to add one.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Asset Selection Card */}
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Asset Selection</CardTitle>
              <CardDescription className="text-xs">
                Add assets to the accountability form using asset ID or QR scanner
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
                    disabled={!canViewAccountabilityForms}
                  />
                  
                  {/* Suggestions dropdown */}
                  {showSuggestions && (
                    <div
                      ref={suggestionRef}
                      className="absolute z-50 w-full mt-1 bg-clip-padding backdrop-filter backdrop-blur-md bg-opacity-10 border shadow-2xl rounded-md max-h-60 overflow-auto"
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
                          <motion.div
                            key={asset.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.2, delay: index * 0.05 }}
                            onClick={() => handleSelectSuggestion(asset)}
                            onMouseEnter={() => setSelectedSuggestionIndex(index)}
                            className={cn(
                              "px-4 py-3 cursor-pointer transition-colors",
                              "hover:bg-gray-400/20 hover:bg-clip-padding hover:backdrop-filter hover:backdrop-blur-sm",
                              selectedSuggestionIndex === index && "bg-gray-400/20 bg-clip-padding backdrop-filter backdrop-blur-sm"
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
                              {getStatusBadge(asset.status || null)}
                            </div>
                          </motion.div>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No assets found. Start typing to search...
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {canViewAccountabilityForms && (
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

              {(selectedAssets.length > 0 || loadingAssets.size > 0) && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Selected Assets ({selectedAssets.length + loadingAssets.size})
                  </p>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {/* Loading placeholders */}
                    <AnimatePresence>
                    {Array.from(loadingAssets).map((code) => (
                        <motion.div
                        key={`loading-${code}`}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.2 }}
                        className="flex items-center justify-between gap-2 p-3 border rounded-md bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                              <Spinner className="h-3 w-3" />
                              {code}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground italic mt-1">
                            Looking up asset details...
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setLoadingAssets(prev => {
                              const newSet = new Set(prev)
                              newSet.delete(code)
                              return newSet
                            })
                          }}
                          className="h-8 w-8 rounded-full"
                        >
                          <XIcon className="h-4 w-4" />
                        </Button>
                        </motion.div>
                    ))}
                    </AnimatePresence>
                    {/* Actual selected assets */}
                    <AnimatePresence>
                      {selectedAssets.map((asset, index) => (
                        <motion.div
                        key={asset.id}
                          initial={{ opacity: 0, x: -20, scale: 0.95 }}
                          animate={{ opacity: 1, x: 0, scale: 1 }}
                          exit={{ opacity: 0, x: 20, scale: 0.95 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
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
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveAsset(asset.id)}
                          className="h-8 w-8 shrink-0 rounded-full"
                        >
                          <XIcon className="h-4 w-4" />
                        </Button>
                      </motion.div>
                    ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
                </>
              )}
            </CardContent>
          </Card>
          </motion.div>

          {/* Printable Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            <Collapsible open={isFormOpen} onOpenChange={setIsFormOpen} className="mb-6">
              <Card className="print:shadow-none print:border-0">
                <CollapsibleTrigger asChild>
                  <CardHeader className="pb-3 print:hidden cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                  <CardTitle className="text-base">Accountability Form</CardTitle>
                  <CardDescription className="text-xs">
                    Review the accountability form
                  </CardDescription>
                </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </div>
            </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
            <CardContent className="pt-2 pb-4 print:p-0">
              <div className="bg-card text-card-foreground p-4 sm:p-6 md:p-8 print:p-8 print:bg-white print:text-black relative" id="accountability-form">
                {/* Background Logo */}
                <div 
                  className="absolute inset-0 opacity-[0.03] pointer-events-none z-0"
                  style={{
                    backgroundImage: `url(${secondaryLogoUrl})`,
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
                        src={primaryLogoUrl} 
                        alt="ShoreAgents Logo" 
                        width={200}
                        height={80}
                        className="h-12 sm:h-16 print:h-20 object-contain"
                        priority
                      />
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-xs font-medium text-foreground print:text-black">AF NO.:</p>
                      <div className="border-b-2 border-border dark:border-gray-600 print:border-black w-full sm:w-32 mt-1 min-h-[20px] text-[10px] sm:text-xs print:text-[10px]">
                        {accountabilityFormNo || ''}
                      </div>
                    </div>
                  </div>

                  {/* Title */}
                  <h2 className="text-sm font-bold text-center mb-4 text-foreground print:text-black">ACCOUNTABILITY FORM</h2>

                  {/* Employee Details Box */}
                  <div className="border-2 border-border dark:border-gray-600 print:border-black p-1.5 mb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-0.5">
                      <div>
                        <p className="text-xs font-medium mb-0.5 text-foreground print:text-black">NAME OF THE EMPLOYEE:</p>
                        <div className="border-b border-border dark:border-gray-600 print:border-black pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                          {selectedEmployee?.name || ''}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium mb-0.5 text-foreground print:text-black">CLIENT/DEPARTMENT:</p>
                        <div className="border-b border-border dark:border-gray-600 print:border-black pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                          {clientDepartment || ''}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium mb-0.5 text-foreground print:text-black">POSITION:</p>
                        <div className="border-b border-border dark:border-gray-600 print:border-black pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                          {position || ''}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium mb-0.5 text-foreground print:text-black">TICKET NO.:</p>
                        <div className="border-b border-border dark:border-gray-600 print:border-black pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                          {ticketNo || ''}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium mb-0.5 text-foreground print:text-black">DATE ISSUED:</p>
                        <div className="border-b border-border dark:border-gray-600 print:border-black pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                          {dateIssued ? new Date(dateIssued).toLocaleDateString() : ''}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Asset Description Table */}
                  <div className="border-2 border-border dark:border-gray-600 print:border-black mb-4">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b-2 border-border dark:border-gray-600 print:border-black">
                          <th className="border-r-2 border-border dark:border-gray-600 print:border-black py-1 px-1 sm:px-2 text-[10px] sm:text-xs font-bold text-foreground print:text-black">ASSET DESCRIPTION</th>
                          <th className="border-r-2 border-border dark:border-gray-600 print:border-black py-1 px-1 sm:px-2 text-left text-[10px] sm:text-xs font-bold text-foreground print:text-black">ASSET TAG</th>
                          <th className="py-1 px-1 sm:px-2 text-left text-[10px] sm:text-xs font-bold text-foreground print:text-black">REMARKS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Pre-defined asset descriptions */}
                        {ASSET_DESCRIPTIONS.map((item, idx) => {
                          const asset = groupedAssets.mainAssets.find(a => {
                            const subCategoryName = a.subCategory?.name?.trim() || a.description.toUpperCase()
                            return subCategoryName.toUpperCase() === item.toUpperCase() ||
                                   subCategoryName.toUpperCase().includes(item.toUpperCase()) ||
                                   item.toUpperCase().includes(subCategoryName.toUpperCase())
                          })
                          return (
                            <tr key={`asset-${idx}`} className="border-b border-border dark:border-gray-600 print:border-black">
                              <td 
                                className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black cursor-pointer hover:bg-muted/50 print:hover:bg-transparent transition-colors"
                                onClick={() => handleRowItemClick(item)}
                                title="Click to scan asset"
                              >
                                {item}
                              </td>
                              <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">
                                {asset ? asset.assetTagId : ''}
                              </td>
                              <td className="py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">
                                {asset ? (
                                  <>
                                    <span className="print:hidden">
                                      <Input
                                        type="text"
                                        value={asset.remarks || ''}
                                        onChange={(e) => handleUpdateAsset(asset.id, 'remarks', e.target.value)}
                                        className="h-6 text-xs border-0 p-0 focus-visible:ring-0 bg-transparent"
                                        placeholder="Remarks"
                                      />
                                    </span>
                                    <span className="hidden print:inline">{asset.remarks || ''}</span>
                                  </>
                                ) : ''}
                              </td>
                            </tr>
                          )
                        })}
                        
                        {/* Additional assets from selected assets */}
                        {groupedAssets.mainAssets.filter(a => {
                          const subCategoryName = a.subCategory?.name?.trim() || a.description.toUpperCase()
                          return !ASSET_DESCRIPTIONS.some(item => 
                            subCategoryName.toUpperCase() === item.toUpperCase() ||
                            subCategoryName.toUpperCase().includes(item.toUpperCase()) ||
                            item.toUpperCase().includes(subCategoryName.toUpperCase())
                          )
                        }).map((asset) => (
                          <tr key={asset.id} className="border-b border-border dark:border-gray-600 print:border-black">
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-xs text-foreground print:text-black">{asset.subCategory?.name || asset.description}</td>
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-xs text-foreground print:text-black">{asset.assetTagId}</td>
                            <td className="py-0.5 px-2 text-xs text-foreground print:text-black">
                              <Input
                                type="text"
                                value={asset.remarks || ''}
                                onChange={(e) => handleUpdateAsset(asset.id, 'remarks', e.target.value)}
                                className="h-6 text-xs border-0 p-0 focus-visible:ring-0"
                                placeholder="Remarks"
                              />
                            </td>
                          </tr>
                        ))}

                        {/* Empty rows for manual entry */}
                        {[...Array(Math.max(0, 3 - groupedAssets.mainAssets.length))].map((_, idx) => (
                          <tr key={`empty-main-${idx}`} className="border-b border-border dark:border-gray-600 print:border-black">
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black p-2 text-xs"></td>
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black p-2 text-xs"></td>
                            <td className="p-2 text-xs"></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Cables & Extension Section */}
                  <div className="border-2 border-border dark:border-gray-600 print:border-black mb-4">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b-2 border-border dark:border-gray-600 print:border-black">
                          <th className="border-r-2 border-border dark:border-gray-600 print:border-black py-1 px-1 sm:px-2 text-[10px] sm:text-xs font-bold text-foreground print:text-black">ASSET DESCRIPTION</th>
                          <th className="py-1 px-1 sm:px-2 text-center text-[10px] sm:text-xs font-bold text-foreground print:text-black">QTY</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Pre-defined cables */}
                        {CABLES_AND_EXTENSIONS.map((item, idx) => {
                          const asset = groupedAssets.cables.find(a => {
                            const subCategoryName = a.subCategory?.name?.trim() || a.description.toUpperCase()
                            return subCategoryName.toUpperCase() === item.toUpperCase() ||
                                   subCategoryName.toUpperCase().includes(item.toUpperCase()) ||
                                   item.toUpperCase().includes(subCategoryName.toUpperCase())
                          })
                          return (
                            <tr key={`cable-${idx}`} className="border-b border-border dark:border-gray-600 print:border-black">
                              <td 
                                className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black cursor-pointer hover:bg-muted/50 print:hover:bg-transparent transition-colors"
                                onClick={() => handleRowItemClick(item)}
                                title="Click to scan asset"
                              >
                                {item}
                              </td>
                              <td className="py-0.5 px-1 sm:px-2 text-center text-[10px] sm:text-xs text-foreground print:text-black">
                                {asset ? '1' : ''}
                              </td>
                            </tr>
                          )
                        })}
                        
                        {/* Additional cables from selected assets */}
                        {groupedAssets.cables.filter(a => {
                          const subCategoryName = a.subCategory?.name?.trim() || a.description.toUpperCase()
                          return !CABLES_AND_EXTENSIONS.some(item => 
                            subCategoryName.toUpperCase() === item.toUpperCase() ||
                            subCategoryName.toUpperCase().includes(item.toUpperCase()) ||
                            item.toUpperCase().includes(subCategoryName.toUpperCase())
                          )
                        }).map((asset) => (
                          <tr key={asset.id} className="border-b border-border dark:border-gray-600 print:border-black">
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-xs text-foreground print:text-black">{asset.subCategory?.name || asset.description}</td>
                            <td className="py-0.5 px-2 text-center text-xs text-foreground print:text-black">1</td>
                          </tr>
                        ))}

                        {/* Empty rows for manual entry */}
                        {[...Array(Math.max(0, 2 - groupedAssets.cables.length))].map((_, idx) => (
                          <tr key={`empty-cable-${idx}`} className="border-b border-border dark:border-gray-600 print:border-black">
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black p-2 text-xs"></td>
                            <td className="p-2 text-center text-xs"></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Phone Section */}
                  {(mobileBrand || mobileModel || imeiNo || simNo || networkProvider || planAmount) && (
                    <div className="border-2 border-border dark:border-gray-600 print:border-black mb-4">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b-2 border-border dark:border-gray-600 print:border-black">
                            <th colSpan={2} className="py-1 px-1 sm:px-2 text-[10px] sm:text-xs font-bold text-foreground print:text-black">MOBILE PHONE</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-border dark:border-gray-600 print:border-black">
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">BRAND</td>
                            <td className="py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">{mobileBrand || ''}</td>
                          </tr>
                          <tr className="border-b border-border dark:border-gray-600 print:border-black">
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">MODEL</td>
                            <td className="py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">{mobileModel || ''}</td>
                          </tr>
                          <tr className="border-b border-border dark:border-gray-600 print:border-black">
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">IMEI NO.</td>
                            <td className="py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">{imeiNo || ''}</td>
                          </tr>
                          <tr className="border-b border-border dark:border-gray-600 print:border-black">
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">SIM NO.</td>
                            <td className="py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">{simNo || ''}</td>
                          </tr>
                          <tr className="border-b border-border dark:border-gray-600 print:border-black">
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">NETWORK PROVIDER:</td>
                            <td className="py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">{networkProvider || ''}</td>
                          </tr>
                          <tr>
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">PLAN AMOUNT:</td>
                            <td className="py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">{planAmount || ''}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Others Section */}
                  <div className="border-2 border-border dark:border-gray-600 print:border-black mb-4">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b-2 border-border dark:border-gray-600 print:border-black">
                          <th colSpan={2} className="py-1 px-1 sm:px-2 text-[10px] sm:text-xs font-bold text-foreground print:text-black">OTHERS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Custom items that don't match any category */}
                        {groupedAssets.others.map((asset) => (
                          <tr key={asset.id} className="border-b border-border dark:border-gray-600 print:border-black">
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-xs text-foreground print:text-black">{asset.subCategory?.name || asset.description}</td>
                            <td className="py-0.5 px-2 text-xs text-foreground print:text-black">{asset.assetTagId || ''}</td>
                          </tr>
                        ))}

                        {/* Empty rows for manual entry */}
                        {[...Array(Math.max(0, 5 - groupedAssets.others.length))].map((_, idx) => (
                          <tr key={`empty-other-${idx}`} className="border-b border-border dark:border-gray-600 print:border-black">
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black p-2 text-xs"></td>
                            <td className="p-2 text-xs"></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Replacement Section */}
                  <div className="border-2 border-border dark:border-gray-600 print:border-black">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b-2 border-border dark:border-gray-600 print:border-black bg-muted print:bg-gray-50">
                          <th colSpan={5} className="py-1 px-1 sm:px-2 text-[10px] sm:text-xs font-bold text-foreground print:text-black">REPLACEMENT</th>
                        </tr>
                        <tr className="border-b-2 border-border dark:border-gray-600 print:border-black">
                          <th className="border-r-2 border-border dark:border-gray-600 print:border-black py-1 px-1 sm:px-2 text-[10px] sm:text-xs font-bold text-foreground print:text-black">ASSET DESCRIPTION</th>
                          <th className="border-r-2 border-border dark:border-gray-600 print:border-black py-1 px-1 sm:px-2 text-[10px] sm:text-xs font-bold text-foreground print:text-black">OLD ASSET (Tag Number)</th>
                          <th className="border-r-2 border-border dark:border-gray-600 print:border-black py-1 px-1 sm:px-2 text-[10px] sm:text-xs font-bold text-foreground print:text-black">NEW ASSET (Tag Number)</th>
                          <th className="border-r-2 border-border dark:border-gray-600 print:border-black py-1 px-1 sm:px-2 text-[10px] sm:text-xs font-bold text-foreground print:text-black">DESIGNATED IT</th>
                          <th className="py-1 px-1 sm:px-2 text-[10px] sm:text-xs font-bold text-foreground print:text-black">DATE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Replacement items */}
                        {replacementItems.map((item) => (
                          <tr key={item.id} className="border-b border-border dark:border-gray-600 print:border-black">
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">
                              <span className="print:hidden">
                                <Input
                                  type="text"
                                  value={item.assetDescription}
                                  onChange={(e) => handleUpdateReplacement(item.id, 'assetDescription', e.target.value)}
                                  className="h-6 text-xs border-0 p-0 focus-visible:ring-0 bg-transparent"
                                  placeholder="Asset Description"
                                />
                              </span>
                              <span className="hidden print:inline">{item.assetDescription || ''}</span>
                            </td>
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">
                              <span className="print:hidden">
                                <Input
                                  type="text"
                                  value={item.oldAssetTag}
                                  onChange={(e) => handleUpdateReplacement(item.id, 'oldAssetTag', e.target.value)}
                                  className="h-6 text-xs border-0 p-0 focus-visible:ring-0 bg-transparent"
                                  placeholder="Old Asset Tag"
                                />
                              </span>
                              <span className="hidden print:inline">{item.oldAssetTag || ''}</span>
                            </td>
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">
                              <span className="print:hidden">
                                <Input
                                  type="text"
                                  value={item.newAssetTag}
                                  onChange={(e) => handleUpdateReplacement(item.id, 'newAssetTag', e.target.value)}
                                  className="h-6 text-xs border-0 p-0 focus-visible:ring-0 bg-transparent"
                                  placeholder="New Asset Tag"
                                />
                              </span>
                              <span className="hidden print:inline">{item.newAssetTag || ''}</span>
                            </td>
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">
                              <span className="print:hidden">
                                <Input
                                  type="text"
                                  value={item.designatedIT}
                                  onChange={(e) => handleUpdateReplacement(item.id, 'designatedIT', e.target.value)}
                                  className="h-6 text-xs border-0 p-0 focus-visible:ring-0 bg-transparent"
                                  placeholder="Designated IT"
                                />
                              </span>
                              <span className="hidden print:inline">{item.designatedIT || ''}</span>
                            </td>
                            <td className="py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">
                              <span className="print:hidden">
                                <Input
                                  type="date"
                                  value={item.date}
                                  onChange={(e) => handleUpdateReplacement(item.id, 'date', e.target.value)}
                                  className="h-6 text-xs border-0 p-0 focus-visible:ring-0 bg-transparent"
                                />
                              </span>
                              <span className="hidden print:inline">{item.date ? new Date(item.date).toLocaleDateString() : ''}</span>
                            </td>
                          </tr>
                        ))}

                        {/* Empty rows for manual entry */}
                        {[...Array(Math.max(0, 7 - replacementItems.length))].map((_, idx) => (
                          <tr key={`empty-replacement-${idx}`} className="border-b border-border dark:border-gray-600 print:border-black">
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black p-2 text-xs"></td>
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black p-2 text-xs"></td>
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black p-2 text-xs"></td>
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black p-2 text-xs"></td>
                            <td className="p-2 text-xs"></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Rules and Regulations Page - Second Page */}
              <div className="bg-card text-card-foreground p-4 sm:p-6 md:p-8 print:p-8 print:bg-white print:text-black relative print:break-after-page print:break-before-page" id="accountability-form-rules">
                {/* Background Logo */}
                <div 
                  className="absolute inset-0 opacity-[0.03] pointer-events-none z-0"
                  style={{
                    backgroundImage: `url(${secondaryLogoUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                  }}
                />
                
                {/* Content */}
                <div className="relative z-10">
                  {/* Title */}
                  <h2 className="text-sm font-bold mb-2 text-foreground print:text-black">RULES AND REGULATIONS:</h2>
                  
                  {/* Introduction */}
                  <p className="text-xs mb-4 text-foreground print:text-black">
                    All users of the Company&apos;s Computer Equipment and Mobile Phone units and services shall be subject to the following rules and regulations:
                  </p>
                  
                  {/* Rules List */}
                  <ol className="list-decimal list-outside space-y-2 mb-4 text-xs text-foreground print:text-black ml-4 pl-2">
                    <li className="pl-2">All computers and mobile phones shall be used solely for official business.</li>
                    <li className="pl-2">If the user opted to pay the extra cost for whatever reason (i.e., upgrade of phones), this will not entitle the staff ownership of the property. Staff must surrender all accountabilities prior to or upon exit.</li>
                    <li className="pl-2">Users shall not use the computers and mobile phones in operating personal business nor lend it to anyone.</li>
                    <li className="pl-2">Users shall comply with all software licenses and copyrights. Installation of pirated software is strictly prohibited.</li>
                    <li className="pl-2">All files, messages, and other information created, sent, or received over the company&apos;s equipment, email, internet systems are the company&apos;s property and should not be considered personal information. The company reserves the right to access, review, copy, or delete files.</li>
                    <li className="pl-2">Company information should never be transmitted or forwarded to outside individuals or companies not authorized to receive the information, and should not even be sent or forwarded to other employees who do not clearly need to know the information.</li>
                    <li className="pl-2">Users shall not create or design, install, or store any malicious programs (virus, worm, Trojan horse) nor intentionally release such programs to infect others.</li>
                    <li className="pl-2">Users shall not engage in any fraudulent, harassing, embarrassing, sexually implicit, obscene, or other unlawful or improper material or actions.</li>
                    <li className="pl-2">Users shall ensure that any material that is authorized and brought onto the company&apos;s computers or which is authorized and downloaded from the internet or provided from any other source shall be scanned for viruses or other destructive elements.</li>
                    <li className="pl-2">Users shall not install games or play games in the company&apos;s computers.</li>
                    <li className="pl-2">Users are expected to demonstrate proper care, respect for intellectual property, data ownership, system security, and rights to access information.</li>
                    <li className="pl-2">Computer resources and Mobile Phones are to be used in an effective, efficient, ethical, and lawful manner.</li>
                    <li className="pl-2">Damage units shall be reported immediately. Units that are damaged due to the negligence of an employee shall be charged to the employee.</li>
                    <li className="pl-2">Lost or stolen units should be reported immediately. Cost incurred for the replacement of the unit shall be charged to the employee who is responsible for the loss. The lost or stolen unit may be the responsibility of the employee with the same unit or any unit with the same function and value, or pay the market value of the lost unit.</li>
                  </ol>
                  
                  {/* Acknowledgement */}
                  <p className="text-xs mb-6 text-foreground print:text-black">
                    The undersigned user executes these rules and regulations as a condition of their continuing employment or other relationship with the company. The user acknowledges that the employee has read and understood these policies and agrees to abide by all of the requirements of these rules and understands that failure to abide may result in sanctions, including but not limited to adverse employment actions, suspension, termination, and potential civil and criminal liabilities.
                  </p>
                  
                  {/* First Signature Section */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div>
                      <p className="text-xs font-semibold mb-1 text-green-600 dark:text-green-500 print:text-green-600">STAFF&apos;S CONFORME</p>
                      <div className="border-b border-border dark:border-gray-600 print:border-black mb-1 pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                        {staffSignature || ''}
                      </div>
                      <p className="text-xs text-muted-foreground print:text-gray-600 mb-0.5">Signature Over Printed Name</p>
                      <div className="border-b border-border dark:border-gray-600 print:border-black mb-1 pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                        {staffDate || ''}
                      </div>
                      <p className="text-xs text-muted-foreground print:text-gray-600">Date:</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-1 text-green-600 dark:text-green-500 print:text-green-600">IT DEPARTMENT</p>
                      <div className="border-b border-border dark:border-gray-600 print:border-black mb-1 pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                        {itSignature || ''}
                      </div>
                      <p className="text-xs text-muted-foreground print:text-gray-600 mb-0.5">Signature Over Printed Name</p>
                      <div className="border-b border-border dark:border-gray-600 print:border-black mb-1 pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                        {itDate || ''}
                      </div>
                      <p className="text-xs text-muted-foreground print:text-gray-600">Date:</p>
                    </div>
                  </div>
                  
                  {/* Separator */}
                  <div className="border-t-2 border-border dark:border-gray-600 print:border-black my-4"></div>
                  
                  {/* Second Signature Section */}
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-center mb-4 text-foreground print:text-black">TO BE COMPLETED BY ASSET CUSTODIAN / FINANCE DEPARTMENT</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-semibold mb-1 text-green-600 dark:text-green-500 print:text-green-600">ASSET CUSTODIAN</p>
                        <div className="border-b border-border dark:border-gray-600 print:border-black mb-1 pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                          {assetCustodianSignature || ''}
                        </div>
                        <p className="text-xs text-muted-foreground print:text-gray-600 mb-0.5">Signature Over Printed Name</p>
                        <div className="border-b border-border dark:border-gray-600 print:border-black mb-1 pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                          {assetCustodianDate || ''}
                        </div>
                        <p className="text-xs text-muted-foreground print:text-gray-600">Date:</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold mb-1 text-green-600 dark:text-green-500 print:text-green-600">FINANCE DEPARTMENT (If related to Mobile Phones)</p>
                        <div className="border-b border-border dark:border-gray-600 print:border-black mb-1 pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                          {financeSignature || ''}
                        </div>
                        <p className="text-xs text-muted-foreground print:text-gray-600 mb-0.5">Signature Over Printed Name</p>
                        <div className="border-b border-border dark:border-gray-600 print:border-black mb-1 pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                          {financeDate || ''}
                        </div>
                        <p className="text-xs text-muted-foreground print:text-gray-600">Date:</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
                </CollapsibleContent>
          </Card>
            </Collapsible>
          </motion.div>

          {/* Signature Inputs Card - Only visible when not printing */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
          >
            <Card className="print:hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Rules and Regulations Signatures</CardTitle>
                <CardDescription className="text-xs">
                  Fill in signature details for Rules and Regulations page
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2 pb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <Field>
                      <FieldLabel htmlFor="staffSignature">Staff&apos;s Conforme Signature</FieldLabel>
                      <FieldContent>
                        <Input
                          id="staffSignature"
                          placeholder="Signature over Printed Name"
                          value={staffSignature}
                          onChange={(e) => setStaffSignature(e.target.value)}
                        />
                      </FieldContent>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="staffDate">Staff Date</FieldLabel>
                      <FieldContent>
                        <Input
                          id="staffDate"
                          type="date"
                          value={staffDate}
                          onChange={(e) => setStaffDate(e.target.value)}
                        />
                      </FieldContent>
                    </Field>
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
                  <div className="space-y-4">
                    <Field>
                      <FieldLabel htmlFor="assetCustodianSignature">Asset Custodian Signature</FieldLabel>
                      <FieldContent>
                        <Input
                          id="assetCustodianSignature"
                          placeholder="Signature over Printed Name"
                          value={assetCustodianSignature}
                          onChange={(e) => setAssetCustodianSignature(e.target.value)}
                        />
                      </FieldContent>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="assetCustodianDate">Asset Custodian Date</FieldLabel>
                      <FieldContent>
                        <Input
                          id="assetCustodianDate"
                          type="date"
                          value={assetCustodianDate}
                          onChange={(e) => setAssetCustodianDate(e.target.value)}
                        />
                      </FieldContent>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="financeSignature">Finance Department Signature</FieldLabel>
                      <FieldContent>
                        <Input
                          id="financeSignature"
                          placeholder="Signature over Printed Name"
                          value={financeSignature}
                          onChange={(e) => setFinanceSignature(e.target.value)}
                        />
                      </FieldContent>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="financeDate">Finance Department Date</FieldLabel>
                      <FieldContent>
                        <Input
                          id="financeDate"
                          type="date"
                          value={financeDate}
                          onChange={(e) => setFinanceDate(e.target.value)}
                        />
                      </FieldContent>
                    </Field>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          </motion.div>
          )}
      </AnimatePresence>

      {/* QR Code Scanner Dialog */}
      <QRScannerDialog
        open={qrDialogOpen}
        onOpenChange={(open) => {
          setQrDialogOpen(open)
          if (!open) {
            setQrDialogContext('general')
            setTargetRowItem(null)
          }
        }}
        onScan={handleQRScan}
        onRemove={handleQRRemove}
        multiScan={true}
        existingCodes={selectedAssets.map(asset => asset.assetTagId)}
        loadingCodes={Array.from(loadingAssets)}
        description={qrDialogContext === 'table-row' && targetRowItem 
          ? `Scan a ${targetRowItem} asset to add to this row. Continue scanning to add more assets.`
          : "Scan or upload QR codes to add assets. Continue scanning to add multiple assets."}
      />

      {/* Floating Download PDF Button */}
      <AnimatePresence>
        {selectedEmployee && !isLoadingEmployee && (
          <motion.div 
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed bottom-6 z-50 flex items-center justify-center"
            style={{
              left: isMobile 
                ? '50%'
                : !sidebarOpen 
                ? '50%'
                : sidebarState === 'collapsed' 
                  ? 'calc(var(--sidebar-width-icon, 3rem) + ((100vw - var(--sidebar-width-icon, 3rem)) / 2))'
                  : 'calc(var(--sidebar-width, 16rem) + ((100vw - var(--sidebar-width, 16rem)) / 2))'
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
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

