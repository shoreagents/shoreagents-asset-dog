"use client"

import { use } from "react"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, FileText } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/shadcn-io/spinner"
import { Card, CardContent } from "@/components/ui/card"
import { usePermissions } from "@/hooks/use-permissions"

interface FormData {
  returnDate?: string
  dateIssued?: string
  position?: string
  returnToOffice?: boolean
  resignedStaff?: boolean
  controlNumber?: string
  clientDepartment?: string
  ticketNo?: string
  accountabilityFormNo?: string
  mobileBrand?: string
  mobileModel?: string
  imeiNo?: string
  simNo?: string
  networkProvider?: string
  planAmount?: string
  selectedAssets?: Array<{
    id: string
    assetTagId: string
    description: string
    quantity?: number
    condition?: boolean
    remarks?: string
    category?: {
      id: string
      name: string
    } | null
    subCategory?: {
      id: string
      name: string
    } | null
  }>
  replacementItems?: Array<{
    id: string
    assetDescription: string
    oldAssetTag: string
    newAssetTag: string
    designatedIT: string
    date: string
  }>
  returnerSignature?: string
  returnerDate?: string
  itSignature?: string
  itDate?: string
  staffSignature?: string
  staffDate?: string
  assetCustodianSignature?: string
  assetCustodianDate?: string
  financeSignature?: string
  financeDate?: string
}

interface EmployeeUser {
  id: string
  name: string
  email: string
  department: string | null
}

interface ReturnForm {
  id: string
  dateReturned: string
  department: string | null
  ctrlNo: string | null
  returnType: string
  formData: FormData | null
  employeeUser: EmployeeUser
}

interface AccountabilityForm {
  id: string
  dateIssued: string
  department: string | null
  accountabilityFormNo: string | null
  formData: FormData | null
  employeeUser: EmployeeUser
}

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

async function fetchForm(id: string, type: string) {
  const response = await fetch(`/api/forms/history/${id}?type=${type}`)
  if (!response.ok) {
    throw new Error("Failed to fetch form")
  }
  return response.json()
}

export default function FormDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const searchParams = useSearchParams()
  const formType = searchParams.get("type") || "accountability"
  const { hasPermission } = usePermissions()
  
  const canViewReturnForms = hasPermission("canViewReturnForms")
  const canViewAccountabilityForms = hasPermission("canViewAccountabilityForms")

  const { data, isLoading, error } = useQuery({
    queryKey: ["form-details", resolvedParams.id, formType],
    queryFn: () => fetchForm(resolvedParams.id, formType),
    enabled: (formType === "return" && canViewReturnForms) || (formType === "accountability" && canViewAccountabilityForms),
  })


  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="h-8 w-8" />
          <p className="text-sm text-muted-foreground">Loading form details...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <FileText className="h-12 w-12 text-muted-foreground opacity-50 mb-4" />
        <p className="text-lg font-medium">Form not found</p>
        <p className="text-sm text-muted-foreground mb-4">The form you&apos;re looking for doesn&apos;t exist.</p>
        <Link href="/forms/history">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to History
          </Button>
        </Link>
      </div>
    )
  }

  const form = formType === "return" ? data.returnForm : data.accountabilityForm
  const formData = form?.formData

  if (!form || !formData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <FileText className="h-12 w-12 text-muted-foreground opacity-50 mb-4" />
        <p className="text-lg font-medium">Form data not available</p>
        <Link href="/forms/history">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to History
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <div className="mb-4 md:mb-6">
        <Link href="/forms/history">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to History
          </Button>
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold">
          {formType === "return" ? "Return Form Details" : "Accountability Form Details"}
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          View form details for {form.employeeUser.name}
        </p>
      </div>

      {formType === "return" ? (
        <ReturnFormDetails form={form as ReturnForm} formData={formData} />
      ) : (
        <AccountabilityFormDetails form={form as AccountabilityForm} formData={formData} />
      )}
    </div>
  )
}

function ReturnFormDetails({ form, formData }: { form: ReturnForm; formData: FormData }) {
  const selectedAssets = formData.selectedAssets || []
  
  // Group assets by category - use subCategory name if available, otherwise fall back to description
  const itEquipment = selectedAssets.filter((asset) => {
    const subCategoryName = asset.subCategory?.name?.trim() || asset.description.toLowerCase()
    return IT_EQUIPMENT.some((item) => 
      subCategoryName.toLowerCase() === item.toLowerCase() ||
      subCategoryName.toLowerCase().includes(item.toLowerCase()) ||
      item.toLowerCase().includes(subCategoryName.toLowerCase())
    )
  })

  const otherItems = selectedAssets.filter((asset) => {
    const subCategoryName = asset.subCategory?.name?.trim() || asset.description.toLowerCase()
    return OTHER_ITEMS.some((item) => 
      subCategoryName.toLowerCase() === item.toLowerCase() ||
      subCategoryName.toLowerCase().includes(item.toLowerCase()) ||
      item.toLowerCase().includes(subCategoryName.toLowerCase())
    )
  })

  const resignedStaffItems = formData.resignedStaff
    ? selectedAssets.filter((asset) => {
        const subCategoryName = asset.subCategory?.name?.trim() || asset.description.toLowerCase()
        return RESIGNED_STAFF_ITEMS.some((item) => 
          subCategoryName.toLowerCase() === item.toLowerCase() ||
          subCategoryName.toLowerCase().includes(item.toLowerCase()) ||
          item.toLowerCase().includes(subCategoryName.toLowerCase())
        )
      })
    : []

  return (
    <Card className="mb-6 print:shadow-none print:border-0">
      <CardContent className="pt-6 print:p-0">
        <div className="bg-card text-card-foreground p-4 sm:p-6 md:p-8 print:p-8 print:bg-white print:text-black relative">
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
                  {formData.controlNumber || form.ctrlNo || ''}
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
                  <div className="border-b border-border dark:border-gray-600 print:border-black pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                    {form.employeeUser.name}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium mb-0.5 text-foreground print:text-black">CLIENT / DEPARTMENT:</p>
                  <div className="border-b border-border dark:border-gray-600 print:border-black pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                    {form.department || form.employeeUser.department || ''}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium mb-0.5 text-foreground print:text-black">DATE RETURNED:</p>
                  <div className="border-b border-border dark:border-gray-600 print:border-black pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                    {formData.returnDate ? new Date(formData.returnDate).toLocaleDateString() : new Date(form.dateReturned).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <p className="text-xs font-medium mb-0.5 text-foreground print:text-black">POSITION:</p>
                    <div className="border-b border-border dark:border-gray-600 print:border-black pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                      {formData.position || ''}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={formData.returnToOffice || false}
                        readOnly
                        className="w-3 h-3 accent-primary print:w-3 print:h-3"
                      />
                      <span className="text-xs text-foreground print:text-black">RETURN TO OFFICE</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={formData.resignedStaff || false}
                        readOnly
                        className="w-3 h-3 accent-primary print:w-3 print:h-3"
                      />
                      <span className="text-xs text-foreground print:text-black">RESIGNED STAFF</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Assets Tables */}
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
                    {IT_EQUIPMENT.map((item, idx) => {
                      const asset = itEquipment.find((a) => {
                        const subCategoryName = a.subCategory?.name?.trim() || a.description.toLowerCase()
                        return subCategoryName.toLowerCase() === item.toLowerCase() ||
                          subCategoryName.toLowerCase().includes(item.toLowerCase()) ||
                          item.toLowerCase().includes(subCategoryName.toLowerCase())
                      })
                      return (
                        <tr key={`it-${idx}`} className="border-b border-border dark:border-gray-600 print:border-black">
                          <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">
                            {item}
                          </td>
                          <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-center text-[10px] sm:text-xs text-foreground print:text-black">
                            {asset ? asset.quantity || 1 : ''}
                          </td>
                          <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">
                            {asset ? asset.assetTagId : ''}
                          </td>
                          <td className="py-0.5 px-1 sm:px-2 text-center">
                            <input
                              type="checkbox"
                              checked={asset ? asset.condition || false : false}
                              readOnly
                              className="w-3 h-3 accent-primary print:w-3 print:h-3"
                            />
                          </td>
                        </tr>
                      )
                    })}
                    {itEquipment.filter((a) => {
                      const subCategoryName = a.subCategory?.name?.trim() || a.description.toLowerCase()
                      return !IT_EQUIPMENT.some((item) => 
                        subCategoryName.toLowerCase() === item.toLowerCase() ||
                        subCategoryName.toLowerCase().includes(item.toLowerCase()) ||
                        item.toLowerCase().includes(subCategoryName.toLowerCase())
                      )
                    }).map((asset) => (
                      <tr key={asset.id} className="border-b border-border dark:border-gray-600 print:border-black">
                        <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-xs text-foreground print:text-black">{asset.subCategory?.name || asset.description}</td>
                        <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-center text-xs text-foreground print:text-black">{asset.quantity || 1}</td>
                        <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-xs text-foreground print:text-black">{asset.assetTagId}</td>
                        <td className="py-0.5 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={asset.condition || false}
                            readOnly
                            className="w-3 h-3 accent-primary print:w-3 print:h-3"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Right Table - Others & Resigned Staff */}
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
                    {otherItems.length > 0 && (
                      <>
                        <tr>
                          <td colSpan={4} className="p-2 text-sm font-bold text-foreground print:text-black">Others:</td>
                        </tr>
                        {OTHER_ITEMS.map((item, idx) => {
                          const asset = otherItems.find((a) => {
                            const subCategoryName = a.subCategory?.name?.trim() || a.description.toLowerCase()
                            return subCategoryName.toLowerCase() === item.toLowerCase() ||
                              subCategoryName.toLowerCase().includes(item.toLowerCase()) ||
                              item.toLowerCase().includes(subCategoryName.toLowerCase())
                          })
                          return (
                            <tr key={`other-${idx}`} className="border-b border-border dark:border-gray-600 print:border-black">
                              <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">
                                {item}
                              </td>
                              <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-center text-[10px] sm:text-xs text-foreground print:text-black">
                                {asset ? asset.quantity || 1 : ''}
                              </td>
                              <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">
                                {asset ? asset.assetTagId : ''}
                              </td>
                              <td className="py-0.5 px-1 sm:px-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={asset ? asset.condition || false : false}
                                  readOnly
                                  className="w-3 h-3 accent-primary print:w-3 print:h-3"
                                />
                              </td>
                            </tr>
                          )
                        })}
                        {otherItems.filter((a) => {
                          const subCategoryName = a.subCategory?.name?.trim() || a.description.toLowerCase()
                          return !OTHER_ITEMS.some((item) => 
                            subCategoryName.toLowerCase() === item.toLowerCase() ||
                            subCategoryName.toLowerCase().includes(item.toLowerCase()) ||
                            item.toLowerCase().includes(subCategoryName.toLowerCase())
                          )
                        }).map((asset) => (
                          <tr key={asset.id} className="border-b border-border dark:border-gray-600 print:border-black">
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-xs text-foreground print:text-black">{asset.subCategory?.name || asset.description}</td>
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-center text-xs text-foreground print:text-black">{asset.quantity || 1}</td>
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-xs text-foreground print:text-black">{asset.assetTagId}</td>
                            <td className="py-0.5 px-2 text-center">
                              <input
                                type="checkbox"
                                checked={asset.condition || false}
                                readOnly
                                className="w-3 h-3 accent-primary print:w-3 print:h-3"
                              />
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                    {formData.resignedStaff && resignedStaffItems.length > 0 && (
                      <>
                        <tr>
                          <td colSpan={4} className="p-2 text-sm font-bold text-foreground print:text-black">Resigned Staff:</td>
                        </tr>
                        {RESIGNED_STAFF_ITEMS.map((item, idx) => {
                          const asset = resignedStaffItems.find((a) => {
                            const subCategoryName = a.subCategory?.name?.trim() || a.description.toLowerCase()
                            return subCategoryName.toLowerCase() === item.toLowerCase() ||
                              subCategoryName.toLowerCase().includes(item.toLowerCase()) ||
                              item.toLowerCase().includes(subCategoryName.toLowerCase())
                          })
                          return (
                            <tr key={`resigned-${idx}`} className="border-b border-border dark:border-gray-600 print:border-black">
                              <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">
                                {item}
                              </td>
                              <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-center text-[10px] sm:text-xs text-foreground print:text-black">
                                {asset ? asset.quantity || 1 : ''}
                              </td>
                              <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">
                                {asset ? asset.assetTagId : ''}
                              </td>
                              <td className="py-0.5 px-1 sm:px-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={asset ? asset.condition || false : false}
                                  readOnly
                                  className="w-3 h-3 accent-primary print:w-3 print:h-3"
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <p className="text-xs font-medium mb-1 text-foreground print:text-black">Returner Signature:</p>
                <div className="border-b border-border dark:border-gray-600 print:border-black pb-1 text-xs text-foreground print:text-black min-h-[20px]">
                  {formData.returnerSignature || ''}
                </div>
                <p className="text-xs text-muted-foreground print:text-gray-600 mt-1">Date: {formData.returnerDate || ''}</p>
              </div>
              <div>
                <p className="text-xs font-medium mb-1 text-foreground print:text-black">IT Signature:</p>
                <div className="border-b border-border dark:border-gray-600 print:border-black pb-1 text-xs text-foreground print:text-black min-h-[20px]">
                  {formData.itSignature || ''}
                </div>
                <p className="text-xs text-muted-foreground print:text-gray-600 mt-1">Date: {formData.itDate || ''}</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function AccountabilityFormDetails({ form, formData }: { form: AccountabilityForm; formData: FormData }) {
  const selectedAssets = formData.selectedAssets || []
  
  // Group assets - use subCategory name if available, otherwise fall back to description
  const mainAssets = selectedAssets.filter((asset) => {
    const subCategoryName = asset.subCategory?.name?.trim() || asset.description.toUpperCase()
    return ASSET_DESCRIPTIONS.some((item) => 
      subCategoryName.toUpperCase() === item.toUpperCase() ||
      subCategoryName.toUpperCase().includes(item.toUpperCase()) ||
      item.toUpperCase().includes(subCategoryName.toUpperCase())
    )
  })

  const cables = selectedAssets.filter((asset) => {
    const subCategoryName = asset.subCategory?.name?.trim() || asset.description.toUpperCase()
    return CABLES_AND_EXTENSIONS.some((item) => 
      subCategoryName.toUpperCase() === item.toUpperCase() ||
      subCategoryName.toUpperCase().includes(item.toUpperCase()) ||
      item.toUpperCase().includes(subCategoryName.toUpperCase())
    )
  })

  return (
    <>
      <Card className="mb-6 print:shadow-none print:border-0">
        <CardContent className="pt-6 print:p-0">
          <div className="bg-card text-card-foreground p-4 sm:p-6 md:p-8 print:p-8 print:bg-white print:text-black relative">
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
                  <p className="text-xs font-medium text-foreground print:text-black">AF NO.:</p>
                  <div className="border-b-2 border-border dark:border-gray-600 print:border-black w-full sm:w-32 mt-1 min-h-[20px] text-[10px] sm:text-xs print:text-[10px]">
                    {formData.accountabilityFormNo || form.accountabilityFormNo || ''}
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
                      {form.employeeUser.name}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-0.5 text-foreground print:text-black">CLIENT/DEPARTMENT:</p>
                    <div className="border-b border-border dark:border-gray-600 print:border-black pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                      {formData.clientDepartment || form.department || form.employeeUser.department || ''}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-0.5 text-foreground print:text-black">POSITION:</p>
                    <div className="border-b border-border dark:border-gray-600 print:border-black pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                      {formData.position || ''}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-0.5 text-foreground print:text-black">TICKET NO.:</p>
                    <div className="border-b border-border dark:border-gray-600 print:border-black pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                      {formData.ticketNo || ''}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-0.5 text-foreground print:text-black">DATE ISSUED:</p>
                    <div className="border-b border-border dark:border-gray-600 print:border-black pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                      {formData.dateIssued ? new Date(formData.dateIssued).toLocaleDateString() : new Date(form.dateIssued).toLocaleDateString()}
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
                    {ASSET_DESCRIPTIONS.map((item, idx) => {
                      const asset = mainAssets.find((a) => {
                        const subCategoryName = a.subCategory?.name?.trim() || a.description.toUpperCase()
                        return subCategoryName.toUpperCase() === item.toUpperCase() ||
                          subCategoryName.toUpperCase().includes(item.toUpperCase()) ||
                          item.toUpperCase().includes(subCategoryName.toUpperCase())
                      })
                      return (
                        <tr key={`asset-${idx}`} className="border-b border-border dark:border-gray-600 print:border-black">
                          <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">
                            {item}
                          </td>
                          <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">
                            {asset ? asset.assetTagId : ''}
                          </td>
                          <td className="py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">
                            {asset ? asset.remarks || '' : ''}
                          </td>
                        </tr>
                      )
                    })}
                    {mainAssets.filter((a) => {
                      const subCategoryName = a.subCategory?.name?.trim() || a.description.toUpperCase()
                      return !ASSET_DESCRIPTIONS.some((item) => 
                        subCategoryName.toUpperCase() === item.toUpperCase() ||
                        subCategoryName.toUpperCase().includes(item.toUpperCase()) ||
                        item.toUpperCase().includes(subCategoryName.toUpperCase())
                      )
                    }).map((asset) => (
                      <tr key={asset.id} className="border-b border-border dark:border-gray-600 print:border-black">
                        <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-xs text-foreground print:text-black">{asset.subCategory?.name || asset.description}</td>
                        <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-2 text-xs text-foreground print:text-black">{asset.assetTagId}</td>
                        <td className="py-0.5 px-2 text-xs text-foreground print:text-black">{asset.remarks || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cables & Extension Section */}
              {cables.length > 0 && (
                <div className="border-2 border-border dark:border-gray-600 print:border-black mb-4">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b-2 border-border dark:border-gray-600 print:border-black">
                        <th className="border-r-2 border-border dark:border-gray-600 print:border-black py-1 px-1 sm:px-2 text-[10px] sm:text-xs font-bold text-foreground print:text-black">ASSET DESCRIPTION</th>
                        <th className="py-1 px-1 sm:px-2 text-center text-[10px] sm:text-xs font-bold text-foreground print:text-black">QTY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CABLES_AND_EXTENSIONS.map((item, idx) => {
                        const asset = cables.find((a) => {
                          const subCategoryName = a.subCategory?.name?.trim() || a.description.toUpperCase()
                          return subCategoryName.toUpperCase() === item.toUpperCase() ||
                            subCategoryName.toUpperCase().includes(item.toUpperCase()) ||
                            item.toUpperCase().includes(subCategoryName.toUpperCase())
                        })
                        return (
                          <tr key={`cable-${idx}`} className="border-b border-border dark:border-gray-600 print:border-black">
                            <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">
                              {item}
                            </td>
                            <td className="py-0.5 px-1 sm:px-2 text-center text-[10px] sm:text-xs text-foreground print:text-black">
                              {asset ? 1 : ''}
                            </td>
                          </tr>
                        )
                      })}
                      {cables.filter((a) => {
                        const subCategoryName = a.subCategory?.name?.trim() || a.description.toUpperCase()
                        return !CABLES_AND_EXTENSIONS.some((item) => 
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
                    </tbody>
                  </table>
                </div>
              )}

              {/* Mobile Phone Section */}
              {(formData.mobileBrand || formData.mobileModel || formData.imeiNo || formData.simNo || formData.networkProvider || formData.planAmount) && (
                <div className="border-2 border-border dark:border-gray-600 print:border-black mb-4">
                  <p className="p-2 text-sm font-bold text-foreground print:text-black border-b-2 border-border dark:border-gray-600 print:border-black">Mobile Phone:</p>
                  <div className="grid grid-cols-2 gap-2 p-2">
                    <div>
                      <p className="text-xs font-medium mb-0.5 text-foreground print:text-black">BRAND:</p>
                      <div className="border-b border-border dark:border-gray-600 print:border-black pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                        {formData.mobileBrand || ''}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-0.5 text-foreground print:text-black">MODEL:</p>
                      <div className="border-b border-border dark:border-gray-600 print:border-black pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                        {formData.mobileModel || ''}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-0.5 text-foreground print:text-black">IMEI NO.:</p>
                      <div className="border-b border-border dark:border-gray-600 print:border-black pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                        {formData.imeiNo || ''}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-0.5 text-foreground print:text-black">SIM NO.:</p>
                      <div className="border-b border-border dark:border-gray-600 print:border-black pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                        {formData.simNo || ''}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-0.5 text-foreground print:text-black">NETWORK PROVIDER:</p>
                      <div className="border-b border-border dark:border-gray-600 print:border-black pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                        {formData.networkProvider || ''}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium mb-0.5 text-foreground print:text-black">PLAN AMOUNT:</p>
                      <div className="border-b border-border dark:border-gray-600 print:border-black pb-0.5 text-xs text-foreground print:text-black min-h-[16px]">
                        {formData.planAmount || ''}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Replacement Section */}
              {formData.replacementItems && formData.replacementItems.length > 0 && (
                <div className="border-2 border-border dark:border-gray-600 print:border-black mb-4">
                  <p className="p-2 text-sm font-bold text-foreground print:text-black border-b-2 border-border dark:border-gray-600 print:border-black">REPLACEMENT:</p>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b-2 border-border dark:border-gray-600 print:border-black">
                        <th className="border-r-2 border-border dark:border-gray-600 print:border-black py-1 px-1 sm:px-2 text-[10px] sm:text-xs font-bold text-foreground print:text-black">ASSET DESCRIPTION</th>
                        <th className="border-r-2 border-border dark:border-gray-600 print:border-black py-1 px-1 sm:px-2 text-[10px] sm:text-xs font-bold text-foreground print:text-black">OLD ASSET TAG</th>
                        <th className="border-r-2 border-border dark:border-gray-600 print:border-black py-1 px-1 sm:px-2 text-[10px] sm:text-xs font-bold text-foreground print:text-black">NEW ASSET TAG</th>
                        <th className="border-r-2 border-border dark:border-gray-600 print:border-black py-1 px-1 sm:px-2 text-[10px] sm:text-xs font-bold text-foreground print:text-black">DESIGNATED IT</th>
                        <th className="py-1 px-1 sm:px-2 text-[10px] sm:text-xs font-bold text-foreground print:text-black">DATE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.replacementItems.map((item) => (
                        <tr key={item.id} className="border-b border-border dark:border-gray-600 print:border-black">
                          <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">
                            {item.assetDescription}
                          </td>
                          <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">
                            {item.oldAssetTag}
                          </td>
                          <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">
                            {item.newAssetTag}
                          </td>
                          <td className="border-r-2 border-border dark:border-gray-600 print:border-black py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">
                            {item.designatedIT}
                          </td>
                          <td className="py-0.5 px-1 sm:px-2 text-[10px] sm:text-xs text-foreground print:text-black">
                            {item.date}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Signatures */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div>
                  <p className="text-xs font-medium mb-1 text-foreground print:text-black">Staff&apos;s Conforme Signature:</p>
                  <div className="border-b border-border dark:border-gray-600 print:border-black pb-1 text-xs text-foreground print:text-black min-h-[20px]">
                    {formData.staffSignature || ''}
                  </div>
                  <p className="text-xs text-muted-foreground print:text-gray-600 mt-1">Date: {formData.staffDate || ''}</p>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1 text-foreground print:text-black">IT Signature:</p>
                  <div className="border-b border-border dark:border-gray-600 print:border-black pb-1 text-xs text-foreground print:text-black min-h-[20px]">
                    {formData.itSignature || ''}
                  </div>
                  <p className="text-xs text-muted-foreground print:text-gray-600 mt-1">Date: {formData.itDate || ''}</p>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1 text-foreground print:text-black">Asset Custodian Signature:</p>
                  <div className="border-b border-border dark:border-gray-600 print:border-black pb-1 text-xs text-foreground print:text-black min-h-[20px]">
                    {formData.assetCustodianSignature || ''}
                  </div>
                  <p className="text-xs text-muted-foreground print:text-gray-600 mt-1">Date: {formData.assetCustodianDate || ''}</p>
                </div>
                {formData.financeSignature && (
                  <div>
                    <p className="text-xs font-medium mb-1 text-foreground print:text-black">Finance Department Signature:</p>
                    <div className="border-b border-border dark:border-gray-600 print:border-black pb-1 text-xs text-foreground print:text-black min-h-[20px]">
                      {formData.financeSignature}
                    </div>
                    <p className="text-xs text-muted-foreground print:text-gray-600 mt-1">Date: {formData.financeDate || ''}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

