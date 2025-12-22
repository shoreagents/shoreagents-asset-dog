'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { createClient } from '@/lib/supabase-client'

// Get API base URL - use FastAPI if enabled
const getApiBaseUrl = () => {
  const useFastAPI = process.env.NEXT_PUBLIC_USE_FASTAPI === 'true'
  const fastApiUrl = process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://localhost:8000'
  return useFastAPI ? fastApiUrl : ''
}

// Helper function to get auth token from Supabase session
async function getAuthToken(): Promise<string | null> {
  try {
    const supabase = createClient()
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error || !session?.access_token) {
      return null
    }
    return session.access_token
  } catch {
    return null
  }
}

function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Check if there's a code parameter (from password reset email)
    const code = searchParams.get('code')
    if (code) {
      // Redirect to reset password page with the code
      router.replace(`/reset-password?code=${code}`)
      return
    }

    // If no code, check if user is authenticated
    // If authenticated, redirect to dashboard
    // If not, redirect to login (handled by middleware)
    const checkAuth = async () => {
      try {
        const baseUrl = getApiBaseUrl()
        const token = await getAuthToken()
        const headers: HeadersInit = {}
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }
        
        const response = await fetch(`${baseUrl}/api/auth/me`, {
          headers,
          credentials: 'include',
        })
        if (response.ok) {
          router.replace('/dashboard')
        } else {
          router.replace('/login')
        }
      } catch {
        router.replace('/login')
      }
    }
    checkAuth()
  }, [searchParams, router])

  // Show loading state while redirecting
  return (
    <div className="flex min-h-svh items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <Spinner className="h-6 w-6" />
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex min-h-svh items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <Spinner className="h-6 w-6" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  )
}
