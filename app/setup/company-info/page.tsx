'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { companyInfoSchema, type CompanyInfoFormData } from '@/lib/validations/company-info'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Field, FieldLabel, FieldContent, FieldError } from '@/components/ui/field'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { toast } from 'sonner'
import { usePermissions } from '@/hooks/use-permissions'
import { useSidebar } from '@/components/ui/sidebar'
import { Upload, X, Image as ImageIcon, Building2 } from 'lucide-react'
import Image from 'next/image'
import { CountrySelectField } from '@/components/country-select-field'
import { DeleteConfirmationDialog } from '@/components/delete-confirmation-dialog'

type Country = {
  name: string
  alpha2Code: string
  alpha3Code: string
  capital?: string
  region?: string
  callingCodes: string[]
}

type CompanyInfo = {
  id: string
  companyName: string
  contactEmail: string | null
  contactPhone: string | null
  address: string | null
  zipCode: string | null
  country: string | null
  website: string | null
  primaryLogoUrl: string | null
  secondaryLogoUrl: string | null
  createdAt: string
  updatedAt: string
}

async function fetchCompanyInfo(): Promise<{ companyInfo: CompanyInfo | null }> {
  const response = await fetch('/api/setup/company-info')
  if (!response.ok) {
    throw new Error('Failed to fetch company info')
  }
  return response.json()
}

async function saveCompanyInfo(data: CompanyInfoFormData & { primaryLogoUrl?: string | null; secondaryLogoUrl?: string | null }): Promise<CompanyInfo> {
  const response = await fetch('/api/setup/company-info', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to save company info')
  }
  return response.json().then(res => res.companyInfo)
}

async function uploadLogo(
  file: File,
  logoType: 'primary' | 'secondary',
  onProgress?: (progress: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('logoType', logoType)

    const xhr = new XMLHttpRequest()

    // Track upload progress
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const progress = Math.round((e.loaded / e.total) * 100)
        onProgress?.(progress)
      }
    })

    // Handle completion
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText)
          resolve(data.logoUrl)
        } catch {
          reject(new Error('Failed to parse response'))
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText)
          reject(new Error(error.error || 'Failed to upload logo'))
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`))
        }
      }
    })

    // Handle errors
    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'))
    })

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload aborted'))
    })

    xhr.open('POST', '/api/setup/company-info/upload-logo')
    xhr.send(formData)
  })
}

export default function CompanyInfoPage() {
  const queryClient = useQueryClient()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canManageSetup = hasPermission('canManageSetup')
  const { state: sidebarState, open: sidebarOpen } = useSidebar()

  const primaryLogoInputRef = useRef<HTMLInputElement>(null)
  const secondaryLogoInputRef = useRef<HTMLInputElement>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['company-info'],
    queryFn: fetchCompanyInfo,
    enabled: canManageSetup,
  })

  const companyInfo = data?.companyInfo

  const form = useForm<CompanyInfoFormData>({
    resolver: zodResolver(companyInfoSchema),
    defaultValues: {
      companyName: '',
      contactEmail: '',
      contactPhone: '',
      address: '',
      zipCode: '',
      country: '',
      website: '',
    },
  })

  // Fetch countries to get calling codes
  const { data: countriesData } = useQuery({
    queryKey: ['countries'],
    queryFn: async () => {
      const response = await fetch('/api/countries')
      if (!response.ok) return { countries: [] }
      return response.json()
    },
    staleTime: 24 * 60 * 60 * 1000,
  })

  const countries = React.useMemo(() => countriesData?.countries || [], [countriesData?.countries])

  // Populate form when company info is loaded
  useEffect(() => {
    if (companyInfo) {
      const country = countries.find((c: Country) => c.name === companyInfo.country)
      setSelectedCountry(country || null)
      
      // Extract phone number (remove calling code if present)
      let phone = companyInfo.contactPhone || ''
      if (country && country.callingCodes.length > 0) {
        const callingCode = `+${country.callingCodes[0]}`
        if (phone.startsWith(callingCode)) {
          phone = phone.substring(callingCode.length).trim()
        }
      }
      setPhoneNumber(phone)

      form.reset({
        companyName: companyInfo.companyName || '',
        contactEmail: companyInfo.contactEmail || '',
        contactPhone: companyInfo.contactPhone || '',
        address: companyInfo.address || '',
        zipCode: companyInfo.zipCode || '',
        country: companyInfo.country || '',
        website: companyInfo.website || '',
      })
    }
  }, [companyInfo, form, countries])

  const [primaryLogoUrl, setPrimaryLogoUrl] = useState<string | null>(null)
  const [secondaryLogoUrl, setSecondaryLogoUrl] = useState<string | null>(null)
  const [primaryLogoFile, setPrimaryLogoFile] = useState<File | null>(null)
  const [secondaryLogoFile, setSecondaryLogoFile] = useState<File | null>(null)
  const [primaryLogoPreview, setPrimaryLogoPreview] = useState<string | null>(null)
  const [secondaryLogoPreview, setSecondaryLogoPreview] = useState<string | null>(null)
  const [removePrimaryLogo, setRemovePrimaryLogo] = useState(false)
  const [removeSecondaryLogo, setRemoveSecondaryLogo] = useState(false)
  const [primaryLogoUrlToDelete, setPrimaryLogoUrlToDelete] = useState<string | null>(null)
  const [secondaryLogoUrlToDelete, setSecondaryLogoUrlToDelete] = useState<string | null>(null)
  const [uploadingPrimaryLogo, setUploadingPrimaryLogo] = useState(false)
  const [uploadingSecondaryLogo, setUploadingSecondaryLogo] = useState(false)
  const [primaryLogoUploadProgress, setPrimaryLogoUploadProgress] = useState(0)
  const [secondaryLogoUploadProgress, setSecondaryLogoUploadProgress] = useState(0)
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null)
  const [phoneNumber, setPhoneNumber] = useState<string>('')
  const [showRemovePrimaryDialog, setShowRemovePrimaryDialog] = useState(false)
  const [showRemoveSecondaryDialog, setShowRemoveSecondaryDialog] = useState(false)

  useEffect(() => {
    if (companyInfo) {
      setPrimaryLogoUrl(companyInfo.primaryLogoUrl)
      setSecondaryLogoUrl(companyInfo.secondaryLogoUrl)
      // Reset remove flags when loading company info
      setRemovePrimaryLogo(false)
      setRemoveSecondaryLogo(false)
      setPrimaryLogoUrlToDelete(null)
      setSecondaryLogoUrlToDelete(null)
      // Clear any selected files/previews when loading
      setPrimaryLogoFile((prev) => {
        if (prev) {
          // File will be cleaned up when preview is cleared
          return null
        }
        return null
      })
      setSecondaryLogoFile((prev) => {
        if (prev) {
          // File will be cleaned up when preview is cleared
          return null
        }
        return null
      })
      setPrimaryLogoPreview((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev)
        }
        return null
      })
      setSecondaryLogoPreview((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev)
        }
        return null
      })
    }
  }, [companyInfo])

  // Clean up preview URLs when component unmounts or files change
  useEffect(() => {
    return () => {
      if (primaryLogoPreview) {
        URL.revokeObjectURL(primaryLogoPreview)
      }
      if (secondaryLogoPreview) {
        URL.revokeObjectURL(secondaryLogoPreview)
      }
    }
  }, [primaryLogoPreview, secondaryLogoPreview])

  const saveMutation = useMutation({
    mutationFn: saveCompanyInfo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-info'] })
      toast.success('Company info saved successfully')
      // Reset form dirty state after successful save
      form.reset(form.getValues(), { keepValues: true })
      // Clear logo file states (previews and files are already cleared in onSubmit)
      setPrimaryLogoFile(null)
      setSecondaryLogoFile(null)
      setRemovePrimaryLogo(false)
      setRemoveSecondaryLogo(false)
      setPrimaryLogoUrlToDelete(null)
      setSecondaryLogoUrlToDelete(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save company info')
    },
  })

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>, logoType: 'primary' | 'secondary') => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Only JPEG, PNG, GIF, WebP, and SVG images are allowed.')
      return
    }

    // Validate file size (max 1MB)
    const maxSize = 1 * 1024 * 1024 // 1MB
    if (file.size > maxSize) {
      toast.error('File size too large. Maximum size is 1MB.')
      return
    }

    // Delete previous logo from storage if it exists
    if (logoType === 'primary') {
      // Delete old logo from storage if it exists
      if (primaryLogoUrl && !primaryLogoPreview) {
        try {
          const response = await fetch(`/api/setup/company-info/delete-logo?logoUrl=${encodeURIComponent(primaryLogoUrl)}`, {
            method: 'DELETE',
          })
          if (!response.ok) {
            console.error('Failed to delete previous primary logo from storage')
            // Continue anyway - new logo will still be uploaded
          }
        } catch (error) {
          console.error('Error deleting previous primary logo from storage:', error)
          // Continue anyway - new logo will still be uploaded
        }
      }
      // Clean up old preview if exists
      if (primaryLogoPreview) {
        URL.revokeObjectURL(primaryLogoPreview)
      }
      setPrimaryLogoFile(file)
      setPrimaryLogoPreview(URL.createObjectURL(file))
      // Clear removal flag and URL to delete if a new logo is selected
      setRemovePrimaryLogo(false)
      setPrimaryLogoUrlToDelete(null)
      // Clear the old URL since we're replacing it
      setPrimaryLogoUrl(null)
    } else {
      // Delete old logo from storage if it exists
      if (secondaryLogoUrl && !secondaryLogoPreview) {
        try {
          const response = await fetch(`/api/setup/company-info/delete-logo?logoUrl=${encodeURIComponent(secondaryLogoUrl)}`, {
            method: 'DELETE',
          })
          if (!response.ok) {
            console.error('Failed to delete previous secondary logo from storage')
            // Continue anyway - new logo will still be uploaded
          }
        } catch (error) {
          console.error('Error deleting previous secondary logo from storage:', error)
          // Continue anyway - new logo will still be uploaded
        }
      }
      // Clean up old preview if exists
      if (secondaryLogoPreview) {
        URL.revokeObjectURL(secondaryLogoPreview)
      }
      setSecondaryLogoFile(file)
      setSecondaryLogoPreview(URL.createObjectURL(file))
      // Clear removal flag and URL to delete if a new logo is selected
      setRemoveSecondaryLogo(false)
      setSecondaryLogoUrlToDelete(null)
      // Clear the old URL since we're replacing it
      setSecondaryLogoUrl(null)
    }
    
    // Reset input
    e.target.value = ''
  }

  const handleRemoveLogo = (logoType: 'primary' | 'secondary') => {
    if (logoType === 'primary') {
      // If it's a newly selected logo (has preview), remove immediately without confirmation
      if (primaryLogoPreview) {
        URL.revokeObjectURL(primaryLogoPreview)
        setPrimaryLogoFile(null)
        setPrimaryLogoPreview(null)
        return
      }
      // If it's an existing uploaded logo (has URL but no preview), show confirmation dialog
      if (primaryLogoUrl && !primaryLogoPreview) {
        setShowRemovePrimaryDialog(true)
      }
    } else {
      // If it's a newly selected logo (has preview), remove immediately without confirmation
      if (secondaryLogoPreview) {
        URL.revokeObjectURL(secondaryLogoPreview)
        setSecondaryLogoFile(null)
        setSecondaryLogoPreview(null)
        return
      }
      // If it's an existing uploaded logo (has URL but no preview), show confirmation dialog
      if (secondaryLogoUrl && !secondaryLogoPreview) {
        setShowRemoveSecondaryDialog(true)
      }
    }
  }

  const confirmRemovePrimaryLogo = () => {
    // Store the URL to delete from storage
    if (primaryLogoUrl) {
      setPrimaryLogoUrlToDelete(primaryLogoUrl)
    }
    setRemovePrimaryLogo(true)
    setPrimaryLogoUrl(null)
    setShowRemovePrimaryDialog(false)
  }

  const confirmRemoveSecondaryLogo = () => {
    // Store the URL to delete from storage
    if (secondaryLogoUrl) {
      setSecondaryLogoUrlToDelete(secondaryLogoUrl)
    }
    setRemoveSecondaryLogo(true)
    setSecondaryLogoUrl(null)
    setShowRemoveSecondaryDialog(false)
  }

  const handleCountryChange = (countryName: string, country?: Country) => {
    setSelectedCountry(country || null)
    form.setValue('country', countryName, { shouldValidate: true })
    
    // Update phone number - remove leading 0 if country is selected
    if (country && phoneNumber.startsWith('0')) {
      const newPhone = phoneNumber.substring(1)
      setPhoneNumber(newPhone)
      updatePhoneInForm(newPhone, country)
    } else {
      updatePhoneInForm(phoneNumber, country)
    }
  }

  const updatePhoneInForm = (phone: string, country?: Country | null) => {
    if (country && country.callingCodes.length > 0 && phone) {
      const callingCode = `+${country.callingCodes[0]}`
      form.setValue('contactPhone', `${callingCode} ${phone}`, { shouldValidate: true })
    } else if (phone) {
      form.setValue('contactPhone', phone, { shouldValidate: true })
    } else {
      form.setValue('contactPhone', '', { shouldValidate: true })
    }
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value
    
    // Remove calling code prefix if user types it
    if (selectedCountry && selectedCountry.callingCodes.length > 0) {
      const callingCode = `+${selectedCountry.callingCodes[0]}`
      if (value.startsWith(callingCode)) {
        value = value.substring(callingCode.length).trim()
      }
    }
    
    // Remove leading 0 if country is selected
    if (selectedCountry && value.startsWith('0')) {
      value = value.substring(1)
    }
    
    // Remove any non-digit characters except spaces and dashes
    value = value.replace(/[^\d\s-]/g, '')
    
    setPhoneNumber(value)
    updatePhoneInForm(value, selectedCountry)
  }

  // Track form changes to show floating buttons
  const isFormDirty = useMemo(() => {
    return !!(
      form.formState.isDirty ||
      primaryLogoPreview ||
      secondaryLogoPreview ||
      removePrimaryLogo ||
      removeSecondaryLogo ||
      primaryLogoFile ||
      secondaryLogoFile
    )
  }, [
    form.formState.isDirty,
    primaryLogoPreview,
    secondaryLogoPreview,
    removePrimaryLogo,
    removeSecondaryLogo,
    primaryLogoFile,
    secondaryLogoFile,
  ])

  // Clear form function
  const clearForm = () => {
    if (companyInfo) {
      form.reset({
        companyName: companyInfo.companyName || '',
        contactEmail: companyInfo.contactEmail || '',
        contactPhone: companyInfo.contactPhone || '',
        address: companyInfo.address || '',
        zipCode: companyInfo.zipCode || '',
        country: companyInfo.country || '',
        website: companyInfo.website || '',
      })
      
      // Reset logo states
      setPrimaryLogoUrl(companyInfo.primaryLogoUrl)
      setSecondaryLogoUrl(companyInfo.secondaryLogoUrl)
      setRemovePrimaryLogo(false)
      setRemoveSecondaryLogo(false)
      setPrimaryLogoUrlToDelete(null)
      setSecondaryLogoUrlToDelete(null)
      
      // Clean up previews
      if (primaryLogoPreview) {
        URL.revokeObjectURL(primaryLogoPreview)
        setPrimaryLogoPreview(null)
      }
      if (secondaryLogoPreview) {
        URL.revokeObjectURL(secondaryLogoPreview)
        setSecondaryLogoPreview(null)
      }
      
      setPrimaryLogoFile(null)
      setSecondaryLogoFile(null)
      
      // Reset country and phone
      const country = countries.find((c: Country) => c.name === companyInfo.country)
      setSelectedCountry(country || null)
      let phone = companyInfo.contactPhone || ''
      if (country && country.callingCodes.length > 0) {
        const callingCode = `+${country.callingCodes[0]}`
        if (phone.startsWith(callingCode)) {
          phone = phone.substring(callingCode.length).trim()
        }
      }
      setPhoneNumber(phone)
    }
  }

  const onSubmit = async (data: CompanyInfoFormData) => {
    if (!canManageSetup) {
      toast.error('You do not have permission to manage company info')
      return
    }

    let finalPrimaryLogoUrl = primaryLogoUrl
    let finalSecondaryLogoUrl = secondaryLogoUrl

    // Upload primary logo if a new file was selected
    if (primaryLogoFile) {
      setUploadingPrimaryLogo(true)
      setPrimaryLogoUploadProgress(0)
      try {
        finalPrimaryLogoUrl = await uploadLogo(
          primaryLogoFile,
          'primary',
          (progress) => setPrimaryLogoUploadProgress(progress)
        )
        setPrimaryLogoUrl(finalPrimaryLogoUrl)
        // Clean up preview and file
        if (primaryLogoPreview) {
          URL.revokeObjectURL(primaryLogoPreview)
        }
        setPrimaryLogoFile(null)
        setPrimaryLogoPreview(null)
        setPrimaryLogoUploadProgress(100)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to upload primary logo')
        setUploadingPrimaryLogo(false)
        setPrimaryLogoUploadProgress(0)
        return
      } finally {
        setUploadingPrimaryLogo(false)
        setTimeout(() => setPrimaryLogoUploadProgress(0), 500) // Clear progress after a brief delay
      }
    }

    // Upload secondary logo if a new file was selected
    if (secondaryLogoFile) {
      setUploadingSecondaryLogo(true)
      setSecondaryLogoUploadProgress(0)
      try {
        finalSecondaryLogoUrl = await uploadLogo(
          secondaryLogoFile,
          'secondary',
          (progress) => setSecondaryLogoUploadProgress(progress)
        )
        setSecondaryLogoUrl(finalSecondaryLogoUrl)
        // Clean up preview and file
        if (secondaryLogoPreview) {
          URL.revokeObjectURL(secondaryLogoPreview)
        }
        setSecondaryLogoFile(null)
        setSecondaryLogoPreview(null)
        setSecondaryLogoUploadProgress(100)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to upload secondary logo')
        setUploadingSecondaryLogo(false)
        setSecondaryLogoUploadProgress(0)
        return
      } finally {
        setUploadingSecondaryLogo(false)
        setTimeout(() => setSecondaryLogoUploadProgress(0), 500) // Clear progress after a brief delay
      }
    }

    // Handle logo removal - delete from storage first
    if (removePrimaryLogo && primaryLogoUrlToDelete) {
      try {
        const response = await fetch(`/api/setup/company-info/delete-logo?logoUrl=${encodeURIComponent(primaryLogoUrlToDelete)}`, {
          method: 'DELETE',
        })
        if (!response.ok) {
          console.error('Failed to delete primary logo from storage')
          // Continue anyway - database update will still happen
        }
      } catch (error) {
        console.error('Error deleting primary logo from storage:', error)
        // Continue anyway - database update will still happen
      }
      finalPrimaryLogoUrl = null
      setRemovePrimaryLogo(false)
      setPrimaryLogoUrlToDelete(null)
    }
    if (removeSecondaryLogo && secondaryLogoUrlToDelete) {
      try {
        const response = await fetch(`/api/setup/company-info/delete-logo?logoUrl=${encodeURIComponent(secondaryLogoUrlToDelete)}`, {
          method: 'DELETE',
        })
        if (!response.ok) {
          console.error('Failed to delete secondary logo from storage')
          // Continue anyway - database update will still happen
        }
      } catch (error) {
        console.error('Error deleting secondary logo from storage:', error)
        // Continue anyway - database update will still happen
      }
      finalSecondaryLogoUrl = null
      setRemoveSecondaryLogo(false)
      setSecondaryLogoUrlToDelete(null)
    }

    await saveMutation.mutateAsync({
      ...data,
      primaryLogoUrl: finalPrimaryLogoUrl,
      secondaryLogoUrl: finalSecondaryLogoUrl,
    })
  }

  if (permissionsLoading || isLoading) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        <div>
          <h1 className="text-3xl font-bold">Company Info</h1>
          <p className="text-muted-foreground">
            Manage your company profile details and logos
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Company Information Card */}
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>
                Basic company details used throughout the application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-center py-8">
                <Spinner className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>

          {/* Company Logos Card */}
          <Card>
            <CardHeader>
              <CardTitle>Company Logos</CardTitle>
              <CardDescription>
                Upload primary and secondary logos for your company
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-center py-8">
                <Spinner className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    )
  }

  if (!canManageSetup) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-4"
      >
        <Card className="border-dashed border-2">
          <CardHeader>
            <CardTitle>Company Info</CardTitle>
            <CardDescription>Manage company information and logos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-muted/50 mb-4">
                <Building2 className="h-12 w-12 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
              <p className="text-sm text-muted-foreground">
                You do not have permission to manage company info. Please contact an administrator.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  if (error) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex items-center justify-center min-h-[400px]"
      >
        <Card className="max-w-md border-dashed border-2">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Building2 className="h-12 w-12 text-destructive mb-4" />
            <p className="text-center text-muted-foreground">
              Failed to load company info
            </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Company Info</h1>
        <p className="text-muted-foreground">
          Manage your company profile details and logos
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className={`space-y-6 ${isFormDirty ? "pb-16" : ""}`}>
        {/* Two Column Layout */}
        <motion.div 
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: {
                staggerChildren: 0.1
              }
            }
          }}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* Company Information Card */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              show: { opacity: 1, y: 0 }
            }}
          >
            <Card 
              className="h-full transition-all duration-200 hover:shadow-md border-muted/60 border-l-4" 
              style={{ borderLeftColor: '#3b82f6' }} // blue-500
            >
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>
                Basic company details used throughout the application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Controller
                name="companyName"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel>
                      <Label htmlFor="companyName">Company Name *</Label>
                    </FieldLabel>
                    <FieldContent>
                      <Input
                        id="companyName"
                        {...field}
                        placeholder="Enter company name"
                        aria-invalid={fieldState.error ? 'true' : 'false'}
                        aria-required="true"
                      />
                      {fieldState.error && (
                        <FieldError>{fieldState.error.message}</FieldError>
                      )}
                    </FieldContent>
                  </Field>
                )}
              />

              <Controller
                name="contactEmail"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel>
                      <Label htmlFor="contactEmail">Contact Email *</Label>
                    </FieldLabel>
                    <FieldContent>
                      <Input
                        id="contactEmail"
                        type="email"
                        {...field}
                        placeholder="contact@company.com"
                        aria-invalid={fieldState.error ? 'true' : 'false'}
                        aria-required="true"
                      />
                      {fieldState.error && (
                        <FieldError>{fieldState.error.message}</FieldError>
                      )}
                    </FieldContent>
                  </Field>
                )}
              />

              <Controller
                name="contactPhone"
                control={form.control}
                render={({ fieldState }) => (
                  <Field>
                    <FieldLabel>
                      <Label htmlFor="contactPhone">Contact Phone *</Label>
                    </FieldLabel>
                    <FieldContent>
                      <div className="flex">
                        {selectedCountry && selectedCountry.callingCodes.length > 0 && (
                          <div className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm">
                            +{selectedCountry.callingCodes[0]}
                          </div>
                        )}
                        <Input
                          id="contactPhone"
                          type="tel"
                          value={phoneNumber}
                          onChange={handlePhoneChange}
                          placeholder={selectedCountry ? "9123123123" : "Enter phone number"}
                          className={selectedCountry ? "rounded-l-none" : ""}
                          aria-invalid={fieldState.error ? 'true' : 'false'}
                          aria-required="true"
                        />
                      </div>
                      {fieldState.error && (
                        <FieldError>{fieldState.error.message}</FieldError>
                      )}
                    </FieldContent>
                  </Field>
                )}
              />

              <Controller
                name="address"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel>
                      <Label htmlFor="address">Address *</Label>
                    </FieldLabel>
                    <FieldContent>
                      <Input
                        id="address"
                        {...field}
                        placeholder="Street address"
                        aria-invalid={fieldState.error ? 'true' : 'false'}
                        aria-required="true"
                      />
                      {fieldState.error && (
                        <FieldError>{fieldState.error.message}</FieldError>
                      )}
                    </FieldContent>
                  </Field>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <Controller
                  name="zipCode"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel>
                        <Label htmlFor="zipCode">Zip Code *</Label>
                      </FieldLabel>
                      <FieldContent>
                        <Input
                          id="zipCode"
                          {...field}
                          placeholder="12345"
                          aria-invalid={fieldState.error ? 'true' : 'false'}
                          aria-required="true"
                        />
                        {fieldState.error && (
                          <FieldError>{fieldState.error.message}</FieldError>
                        )}
                      </FieldContent>
                    </Field>
                  )}
                />

                <Controller
                  name="country"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field>
                      <FieldLabel>
                        <Label htmlFor="country">Country *</Label>
                      </FieldLabel>
                      <FieldContent>
                        <CountrySelectField
                          value={field.value || ''}
                          onValueChange={(value) => {
                            field.onChange(value)
                            handleCountryChange(value, countries.find((c: Country) => c.name === value))
                          }}
                          placeholder="Select country..."
                        />
                        {fieldState.error && (
                          <FieldError>{fieldState.error.message}</FieldError>
                        )}
                      </FieldContent>
                    </Field>
                  )}
                />
              </div>

              <Controller
                name="website"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel>
                      <Label htmlFor="website">Website *</Label>
                    </FieldLabel>
                    <FieldContent>
                      <Input
                        id="website"
                        type="text"
                        {...field}
                        placeholder="https://www.company.com"
                        aria-invalid={fieldState.error ? 'true' : 'false'}
                        aria-required="true"
                      />
                      {fieldState.error && (
                        <FieldError>{fieldState.error.message}</FieldError>
                      )}
                    </FieldContent>
                  </Field>
                )}
              />
            </CardContent>
          </Card>
          </motion.div>

          {/* Company Logos Card */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 20 },
              show: { opacity: 1, y: 0 }
            }}
          >
            <Card 
              className="h-full transition-all duration-200 hover:shadow-md border-muted/60 border-l-4" 
              style={{ borderLeftColor: '#8b5cf6' }} // violet-500
            >
            <CardHeader>
              <CardTitle>Company Logos</CardTitle>
              <CardDescription>
                Upload primary and secondary logos for your company
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Primary Logo */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Primary Logo</Label>
                <div className="space-y-3">
                  {(primaryLogoPreview || primaryLogoUrl) ? (
                    <div className="relative w-full h-40 border rounded-lg overflow-hidden bg-muted">
                      <Image
                        src={primaryLogoPreview || primaryLogoUrl || ''}
                        alt="Primary logo"
                        fill
                        className="object-contain p-4"
                      />
                      {uploadingPrimaryLogo && primaryLogoUploadProgress > 0 && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-10">
                          <Spinner className="h-8 w-8 mb-2 text-white" />
                          <div className="text-white text-lg font-semibold">
                            {primaryLogoUploadProgress}%
                          </div>
                          <div className="text-white/80 text-sm mt-1">Uploading...</div>
                          <div className="w-3/4 mt-3 bg-white/20 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-primary h-full transition-all duration-300 ease-out"
                              style={{ width: `${primaryLogoUploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-7 w-7 z-20"
                        onClick={() => handleRemoveLogo('primary')}
                        disabled={saveMutation.isPending || uploadingPrimaryLogo}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                      {primaryLogoPreview && !uploadingPrimaryLogo && (
                        <div className="absolute bottom-2 left-2 bg-yellow-500/90 text-yellow-950 text-xs px-2 py-1 rounded z-20">
                          New selection - will upload on save
                        </div>
                      )}
                    </div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="w-full h-40 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/50 hover:bg-muted/70 transition-colors"
                    >
                      <div className="text-center">
                        <div className="p-3 rounded-full bg-muted/50 mb-2 inline-block">
                          <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm text-muted-foreground">No logo uploaded</p>
                      </div>
                    </motion.div>
                  )}
                  <input
                    ref={primaryLogoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleLogoChange(e, 'primary')}
                    disabled={saveMutation.isPending}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => primaryLogoInputRef.current?.click()}
                    disabled={saveMutation.isPending}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {(primaryLogoPreview || primaryLogoUrl) ? 'Replace Primary Logo' : 'Upload Primary Logo'}
                  </Button>
                </div>
              </div>

              {/* Secondary Logo */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Secondary Logo</Label>
                <div className="space-y-3">
                  {(secondaryLogoPreview || secondaryLogoUrl) ? (
                    <div className="relative w-full h-40 border rounded-lg overflow-hidden bg-muted">
                      <Image
                        src={secondaryLogoPreview || secondaryLogoUrl || ''}
                        alt="Secondary logo"
                        fill
                        className="object-contain p-4"
                      />
                      {uploadingSecondaryLogo && secondaryLogoUploadProgress > 0 && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-10">
                          <Spinner className="h-8 w-8 mb-2 text-white" />
                          <div className="text-white text-lg font-semibold">
                            {secondaryLogoUploadProgress}%
                          </div>
                          <div className="text-white/80 text-sm mt-1">Uploading...</div>
                          <div className="w-3/4 mt-3 bg-white/20 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-primary h-full transition-all duration-300 ease-out"
                              style={{ width: `${secondaryLogoUploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-7 w-7 z-20"
                        onClick={() => handleRemoveLogo('secondary')}
                        disabled={saveMutation.isPending || uploadingSecondaryLogo}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                      {secondaryLogoPreview && !uploadingSecondaryLogo && (
                        <div className="absolute bottom-2 left-2 bg-yellow-500/90 text-yellow-950 text-xs px-2 py-1 rounded z-20">
                          New selection - will upload on save
                        </div>
                      )}
                    </div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="w-full h-40 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/50 hover:bg-muted/70 transition-colors"
                    >
                      <div className="text-center">
                        <div className="p-3 rounded-full bg-muted/50 mb-2 inline-block">
                          <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm text-muted-foreground">No logo uploaded</p>
                      </div>
                    </motion.div>
                  )}
                  <input
                    ref={secondaryLogoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleLogoChange(e, 'secondary')}
                    disabled={saveMutation.isPending}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => secondaryLogoInputRef.current?.click()}
                    disabled={saveMutation.isPending}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {(secondaryLogoPreview || secondaryLogoUrl) ? 'Replace Secondary Logo' : 'Upload Secondary Logo'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          </motion.div>
        </motion.div>

      </form>

      {/* Floating Action Buttons */}
      <AnimatePresence>
      {isFormDirty && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
          className="fixed bottom-6 z-50 flex items-center justify-center gap-3"
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
            variant="outline"
            size="lg"
            onClick={clearForm}
            className="min-w-[120px] bg-accent!"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="lg"
            onClick={() => {
              const formElement = document.querySelector('form') as HTMLFormElement
              if (formElement) {
                formElement.requestSubmit()
              }
            }}
            disabled={saveMutation.isPending || uploadingPrimaryLogo || uploadingSecondaryLogo}
            className="min-w-[120px]"
          >
            {saveMutation.isPending || uploadingPrimaryLogo || uploadingSecondaryLogo ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
          </motion.div>
      )}
      </AnimatePresence>

      {/* Remove Primary Logo Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={showRemovePrimaryDialog}
        onOpenChange={setShowRemovePrimaryDialog}
        onConfirm={confirmRemovePrimaryLogo}
        title="Remove Primary Logo"
        description="Are you sure you want to remove the primary logo? This action will be saved when you click the Save button."
        confirmLabel="Remove"
      />

      {/* Remove Secondary Logo Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={showRemoveSecondaryDialog}
        onOpenChange={setShowRemoveSecondaryDialog}
        onConfirm={confirmRemoveSecondaryLogo}
        title="Remove Secondary Logo"
        description="Are you sure you want to remove the secondary logo? This action will be saved when you click the Save button."
        confirmLabel="Remove"
      />
    </motion.div>
  )
}
