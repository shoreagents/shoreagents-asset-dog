import { Spinner } from '@/components/ui/shadcn-io/spinner'

export default function AssetsLoading() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Assets</h1>
        <p className="text-muted-foreground">
          View and manage all assets
        </p>
      </div>
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3 justify-center min-h-[600px]">
          <Spinner className="h-6 w-6" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    </div>
  )
}

