import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function ActivityLoading() {
  return (
    <div className="space-y-6 pb-8">
      <div>
        <Skeleton className="h-10 w-[200px] mb-2" />
        <Skeleton className="h-5 w-[300px]" />
      </div>

      {/* Filter Buttons Skeleton */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-md" />
        ))}
      </div>

      {/* Activity List Skeleton */}
      <Card className="h-[600px] border-t-4 border-t-primary/20">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-6 w-[120px]" />
            </div>
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
          <Skeleton className="h-4 w-[250px] mt-1.5" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-0">
            {/* Table Header */}
            <div className="flex items-center px-4 py-3 border-b bg-muted/5">
              <Skeleton className="h-4 w-[50px] mr-4" />
              <Skeleton className="h-4 w-[100px] mr-4" />
              <Skeleton className="h-4 w-[80px] mr-4" />
              <Skeleton className="h-4 w-[150px] mr-4" />
              <Skeleton className="h-4 w-[200px] flex-1" />
              <Skeleton className="h-4 w-[80px]" />
            </div>
            {/* Table Rows */}
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center px-4 py-4 border-b">
                <Skeleton className="h-9 w-9 rounded-full mr-4" />
                <Skeleton className="h-5 w-[100px] mr-4" />
                <Skeleton className="h-5 w-[80px] mr-4" />
                <Skeleton className="h-4 w-[150px] mr-4" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-[80%]" />
                  <Skeleton className="h-3 w-[40%]" />
                </div>
                <Skeleton className="h-3 w-[60px]" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
