'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/ui/shadcn-io/spinner'

export default function ToolsPage() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace('/tools/media')
  }, [router])
  
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Spinner />
    </div>
  )
}

