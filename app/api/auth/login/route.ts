import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Validate environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error('[LOGIN API] Missing Supabase environment variables')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    let supabase
    try {
      supabase = await createClient()
    } catch (clientError) {
      console.error('[LOGIN API] Failed to create Supabase client:', clientError)
      return NextResponse.json(
        { error: 'Authentication service unavailable' },
        { status: 500 }
      )
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error('[LOGIN API] Supabase auth error:', error.message)
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    // Check if user account is active
    if (data.user) {
      try {
        // Simple query - no retry needed if connection is configured correctly
        // If this fails, it's likely a configuration issue, not a transient error
        const assetUser = await prisma.assetUser.findUnique({
          where: { userId: data.user.id },
          select: { isActive: true },
        })

        if (assetUser && !assetUser.isActive) {
          // Sign out the user from Supabase session to prevent any access
          await supabase.auth.signOut()
          return NextResponse.json(
            { 
              error: 'Your account has been deactivated. Please contact your administrator.',
              requiresApproval: true,
              isActive: false,
            },
            { status: 403 }
          )
        }
      } catch (dbError) {
        console.error('[LOGIN API] Database error (non-blocking):', dbError)
        // If database query fails, log but don't block login
        // User exists in Supabase, so allow login
        // This prevents database issues from blocking authentication
        // NOTE: If you're seeing persistent errors here, check your DATABASE_URL configuration
      }
    }

    return NextResponse.json(
      { 
        user: data.user,
        session: data.session 
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[LOGIN API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

