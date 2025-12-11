'use client'

import { useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from 'recharts'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { DashboardStats } from '@/types/dashboard'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'

interface AssetValueChartProps {
  data: DashboardStats['assetValueByCategory'] | undefined
  isLoading: boolean
}

type GroupByOption = 'category' | 'status' | 'location' | 'department' | 'site'

const GROUP_BY_OPTIONS: Array<{ value: GroupByOption; label: string }> = [
  { value: 'category', label: 'Category' },
  { value: 'status', label: 'Status' },
  { value: 'location', label: 'Location' },
  { value: 'department', label: 'Department' },
  { value: 'site', label: 'Site' },
]

const chartColors = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#84cc16', // Lime
  '#f97316', // Orange
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#a855f7', // Violet
  '#f43f5e', // Rose
  '#22c55e', // Emerald
  '#eab308', // Yellow
]

export function AssetValueChart({ data, isLoading }: AssetValueChartProps) {
  const [groupBy, setGroupBy] = useState<GroupByOption>('category')

  // Fetch grouped data based on selected option
  const { data: groupedData, isLoading: isGroupedLoading } = useQuery<{ data: Array<{ name: string; value: number }> }>({
    queryKey: ['asset-value-grouped', groupBy],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/asset-value-grouped?groupBy=${groupBy}`)
      if (!response.ok) throw new Error('Failed to fetch grouped data')
      return response.json()
    },
    enabled: groupBy !== 'category', // Use initial data for category
    staleTime: 5 * 60 * 1000,
  })

  // Use grouped data if available, otherwise fall back to initial category data
  const chartDataRaw = groupBy === 'category' ? (data || []) : (groupedData?.data || [])
  const isChartLoading = isLoading || (groupBy !== 'category' && isGroupedLoading)
  
  const chartData = chartDataRaw.map((item, index) => ({
    category: item.name.length > 12 ? `${item.name.substring(0, 12)}...` : item.name,
    value: item.value,
    fullName: item.name,
    color: chartColors[index % chartColors.length],
  }))

  const chartConfig = {
    value: {
      label: 'Asset Value',
      color: 'var(--chart-1)',
    },
  } satisfies ChartConfig

  const totalValue = chartDataRaw.reduce((sum, item) => sum + item.value, 0)

  const groupByLabel = GROUP_BY_OPTIONS.find(opt => opt.value === groupBy)?.label || 'Category'
  
  // Proper pluralization for footer
  const getPluralLabel = (label: string) => {
    if (label.toLowerCase() === 'status') return 'statuses'
    return `${label.toLowerCase()}s`
  }

  if (isChartLoading) {
    return (
      <Card className="flex flex-col h-full min-h-[500px] animate-pulse relative overflow-hidden !bg-transparent bg-[linear-gradient(135deg,rgba(255,255,255,0.15)_0%,rgba(255,255,255,0.08)_100%)] backdrop-blur-[20px] backdrop-saturate-[180%] rounded-[24px] border-[1px_solid_rgba(255,255,255,0.2)] shadow-[0_8px_32px_0_rgba(0,0,0,0.12),0_2px_8px_0_rgba(0,0,0,0.08),inset_0_1px_0_0_rgba(255,255,255,0.4),inset_0_-1px_0_0_rgba(255,255,255,0.15)]">
        {/* 3D Bubble Highlight - Top */}
        <div className="absolute top-0 left-0 right-0 h-1/2 pointer-events-none z-0 rounded-t-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.25)_0%,rgba(255,255,255,0)_100%)] opacity-60" />
        
        {/* Inner Shadow for Depth */}
        <div className="absolute inset-0 pointer-events-none z-0 rounded-[24px] shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.06)]" />
        
        <CardHeader className="items-center pb-4 relative z-10">
          <div className="flex items-center justify-between w-full">
            <div className="flex-1">
              <div className="h-6 w-48 bg-muted rounded mb-2" />
              <div className="h-4 w-64 bg-muted rounded" />
            </div>
            <div className="h-10 w-[140px] bg-muted rounded" />
          </div>
        </CardHeader>
        <CardContent className="pb-0 flex-1 flex flex-col relative z-10">
          <div className="flex-1 flex items-center justify-center min-h-[250px]">
            <div className="w-[250px] h-[250px] bg-muted rounded-full" />
          </div>
          <div className="w-full grid grid-cols-2 gap-x-4 gap-y-2 mt-4 border-t pt-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-muted shrink-0" />
                <div className="h-4 w-24 bg-muted rounded flex-1" />
                <div className="h-4 w-16 bg-muted rounded" />
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-2 text-sm relative z-10">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="h-4 w-40 bg-muted rounded" />
        </CardFooter>
      </Card>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="flex flex-col h-full min-h-[500px] relative overflow-hidden transition-all duration-300 group !bg-transparent bg-[linear-gradient(135deg,rgba(255,255,255,0.15)_0%,rgba(255,255,255,0.08)_100%)] backdrop-blur-[20px] backdrop-saturate-[180%] rounded-[24px] border-[1px_solid_rgba(255,255,255,0.2)] shadow-[0_8px_32px_0_rgba(0,0,0,0.12),0_2px_8px_0_rgba(0,0,0,0.08),inset_0_1px_0_0_rgba(255,255,255,0.4),inset_0_-1px_0_0_rgba(255,255,255,0.15)]">
        {/* 3D Bubble Highlight - Top */}
        <div className="absolute top-0 left-0 right-0 h-1/2 pointer-events-none z-0 rounded-t-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.25)_0%,rgba(255,255,255,0)_100%)] opacity-60" />
        
        {/* Inner Shadow for Depth */}
        <div className="absolute inset-0 pointer-events-none z-0 rounded-[24px] shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.06)]" />
        
        <CardHeader className="items-center pb-4 relative z-10">
          <div className="flex items-center justify-between w-full">
            <div>
              <CardTitle>Asset Value by {groupByLabel}</CardTitle>
          <CardDescription>
                Total asset value grouped by {groupByLabel.toLowerCase()}
          </CardDescription>
            </div>
            <Select value={groupBy} onValueChange={(value) => setGroupBy(value as GroupByOption)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROUP_BY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="pb-0 flex-1 flex flex-col relative z-10">
          {chartData.length > 0 ? (
            <>
              <div className="flex-1 flex items-center justify-center min-h-[250px]">
                <ChartContainer
                  config={chartConfig}
                  className="w-full aspect-square max-h-[250px]"
                >
                  <RadarChart data={chartData}>
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent hideLabel />}
                    formatter={(value: number) => `₱${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    />
                    <PolarGrid gridType="circle" />
                    <PolarAngleAxis dataKey="category" />
                    <Radar
                      dataKey="value"
                      fill="var(--color-value)"
                      fillOpacity={0.6}
                      dot={{
                        r: 4,
                        fillOpacity: 1,
                      }}
                  />
                  </RadarChart>
                </ChartContainer>
              </div>
              
              {/* Custom Legend below chart */}
              <div className="w-full grid grid-cols-2 gap-x-4 gap-y-2 mt-4 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar border-t pt-4">
                {chartData.map((item) => (
                  <div key={item.fullName} className="flex items-center gap-2 text-sm">
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-muted-foreground truncate flex-1" title={item.fullName}>
                      {item.fullName}
                    </span>
                    <span className="font-medium tabular-nums text-xs">
                      ₱{item.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-muted-foreground">
              No data available
            </div>
          )}
        </CardContent>
        {chartData.length > 0 && (
          <CardFooter className="flex-col gap-2 text-sm relative z-10">
            <div className="flex items-center gap-2 leading-none font-medium">
              {chartData.length} {getPluralLabel(groupByLabel)} by value <TrendingUp className="h-4 w-4" />
            </div>
            <div className="text-muted-foreground flex items-center gap-2 leading-none">
              Total: ₱{totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardFooter>
        )}
      </Card>
    </motion.div>
  )
}
