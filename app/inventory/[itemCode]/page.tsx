'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Spinner } from '@/components/ui/shadcn-io/spinner'

export default function InventoryItemPage() {
  const params = useParams()
  const router = useRouter()
  const itemCode = params.itemCode as string

  useEffect(() => {
    if (itemCode) {
      router.replace(`/inventory/${itemCode}/transaction-history`)
    }
  }, [itemCode, router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-3">
        <Spinner className="h-8 w-8" />
        <p className="text-sm text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  )
}

