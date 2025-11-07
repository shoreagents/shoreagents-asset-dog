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

    const supabase = await createClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    // Check if user account is active
    if (data.user) {
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
    }

    return NextResponse.json(
      { 
        user: data.user,
        session: data.session 
      },
      { status: 200 }
    )
  } catch {
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

