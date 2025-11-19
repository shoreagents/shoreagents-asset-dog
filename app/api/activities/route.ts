import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth-utils'
import { requirePermission } from '@/lib/permission-utils'
import { getActivities } from '@/lib/data/activities'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth()
  if (auth.error) return auth.error

  // Check view permission
  const permissionCheck = await requirePermission('canViewAssets')
  if (!permissionCheck.allowed && permissionCheck.error) {
    return permissionCheck.error
  }

  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10)
    const activityType = searchParams.get('type')
    
    const result = await getActivities({ page, pageSize, activityType })
    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('Error fetching activities:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    )
  }
}
