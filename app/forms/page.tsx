'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/ui/shadcn-io/spinner'

export default function FormsPage() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace('/forms/history')
  }, [router])
  
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Spinner />
    </div>
  )
}

