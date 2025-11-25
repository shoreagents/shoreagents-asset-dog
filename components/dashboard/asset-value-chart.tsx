'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardStats } from '@/types/dashboard'
import { PieChart, Pie, Cell, Tooltip } from 'recharts'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { motion } from 'framer-motion'

interface AssetValueChartProps {
  data: DashboardStats['assetValueByCategory'] | undefined
  isLoading: boolean
}

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
]

export function AssetValueChart({ data, isLoading }: AssetValueChartProps) {
  const chartData = data?.map((item, index) => ({
    name: item.name,
    value: item.value,
    fill: chartColors[index % chartColors.length],
  })) || []

  if (isLoading) {
    return (
      <Card className="flex flex-col h-[500px]">
        <CardHeader>
          <div className="h-6 w-1/2 bg-muted rounded mb-2" />
          <div className="h-4 w-1/3 bg-muted rounded" />
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <Spinner className="h-8 w-8" />
        </CardContent>
      </Card>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="flex flex-col h-full min-h-[500px]">
        <CardHeader className="items-center pb-0">
          <CardTitle>Asset Value by Category</CardTitle>
          <CardDescription>
            Total asset value grouped by category
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pb-6">
          {chartData.length > 0 ? (
            <div className="flex flex-col items-center h-full">
              {/* Chart Section - Fixed dimensions to avoid ResponsiveContainer issues */}
              <div className="flex items-center justify-center py-4">
                <PieChart width={300} height={300}>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => `₱${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '6px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ color: '#1f2937' }}
                  />
                </PieChart>
              </div>
              
              {/* Custom Legend below chart */}
              <div className="w-full grid grid-cols-2 gap-x-4 gap-y-2 mt-auto max-h-[150px] overflow-y-auto pr-2 custom-scrollbar border-t pt-4">
                {chartData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2 text-sm">
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: item.fill }}
                    />
                    <span className="text-muted-foreground truncate flex-1" title={item.name}>
                      {item.name}
                    </span>
                    <span className="font-medium tabular-nums text-xs">
                      ₱{item.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No data available
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
