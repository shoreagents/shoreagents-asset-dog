import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

/**
 * Verifies if the current request is authenticated
 * @returns {Promise<{user: any, error: null} | {user: null, error: NextResponse}>}
 */
export async function verifyAuth() {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return {
        user: null,
        error: NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    return { user, error: null }
  } catch (error) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Authentication error' },
        { status: 401 }
      )
    }
  }
}

