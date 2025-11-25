/**
 * Loading UI for Dashboard Page
 * Shows instantly when navigating to /dashboard
 * Prevents blocking navigation while data loads
 */

import { Spinner } from '@/components/ui/shadcn-io/spinner'

export default function DashboardLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[600px]">
      <Spinner className="h-6 w-6 mb-4" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  )
}

