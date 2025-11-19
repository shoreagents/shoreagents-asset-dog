'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import React from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { PieChart, Pie, Cell } from 'recharts'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'

type DashboardStats = {
  assetValueByCategory: Array<{ name: string; value: number }>
  activeCheckouts: Array<{
    id: string
    checkoutDate: string
    expectedReturnDate: string | null
    asset: {
      id: string
      assetTagId: string
      description: string
    }
    employeeUser: {
      id: string
      name: string
      email: string
    } | null
  }>
  recentCheckins: Array<{
    id: string
    checkinDate: string
    asset: {
      id: string
      assetTagId: string
      description: string
    }
    checkout: {
      employeeUser: {
        id: string
        name: string
        email: string
      }
    }
  }>
  assetsUnderRepair: Array<{
    id: string
    dueDate: string | null
    status: string
    asset: {
      id: string
      assetTagId: string
      description: string
    }
  }>
  feedCounts: {
    totalActiveCheckouts: number
    totalCheckins: number
    totalAssetsUnderRepair: number
  }
  summary: {
    totalActiveAssets: number
    totalValue: number
    purchasesInFiscalYear: number
    checkedOutCount: number
    availableCount: number
    checkedOutAndAvailable: number
  }
  calendar: {
    leasesExpiring: Array<{
      id: string
      leaseEndDate: string | null
      lessee: string
      asset: {
        id: string
        assetTagId: string
        description: string
      }
    }>
    maintenanceDue: Array<{
      id: string
      dueDate: string | null
      title: string
      asset: {
        id: string
        assetTagId: string
        description: string
      }
    }>
  }
}

async function fetchDashboardStats(): Promise<DashboardStats> {
  const response = await fetch('/api/dashboard/stats')
  if (!response.ok) {
    throw new Error('Failed to fetch dashboard statistics')
  }
  return response.json()
}

// Chart colors for categories - using direct color values
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

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'checked-out' | 'checked-in' | 'under-repair'>('checked-out')
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const { data, isLoading, error } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes (reduced from 30 seconds)
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
  })

  // Prepare chart data and config dynamically based on categories
  const chartData = data?.assetValueByCategory.map((item, index) => {
    const categoryKey = item.name.toLowerCase().replace(/\s+/g, '-')
    const color = chartColors[index % chartColors.length]
    return {
      category: item.name,
      value: item.value,
      fill: color,
      [categoryKey]: item.value,
    }
  }) || []

  // Build dynamic chart config
  const chartConfig: ChartConfig = {
    value: {
      label: 'Value',
    },
    ...chartData.reduce((acc, item, index) => {
      const categoryKey = item.category.toLowerCase().replace(/\s+/g, '-')
      acc[categoryKey] = {
        label: item.category,
        color: chartColors[index % chartColors.length],
      }
      return acc
    }, {} as Record<string, { label: string; color: string }>),
  } satisfies ChartConfig

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your asset management system
        </p>
      </div>

      {error && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-destructive">
              Failed to load dashboard data. Please try again later.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Total Active Assets</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Spinner className="h-6 w-6 mb-2" />
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold">
                  {data?.summary.checkedOutAndAvailable.toLocaleString() || '0'}/{data?.summary.totalActiveAssets.toLocaleString() || '0'}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Number of Active Assets / Total Active Assets
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Total Value of Assets</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Spinner className="h-6 w-6 mb-2" />
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold">
                  ₱{data?.summary.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Total asset value
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Purchases in Fiscal Year</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Spinner className="h-6 w-6 mb-2" />
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold">
                  {data?.summary.purchasesInFiscalYear.toLocaleString() || '0'}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Assets purchased this year
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Asset Value by Category Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="flex flex-col">
          <CardHeader className="items-center pb-0">
            <CardTitle>Asset Value by Category</CardTitle>
            <CardDescription>
              Total asset value grouped by category
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-[400px]">
                <Spinner className="h-8 w-8 mb-2" />
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : chartData.length > 0 ? (
              <>
                <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[400px]">
                  <PieChart>
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent 
                          hideLabel 
                          formatter={(value: unknown) => {
                            const numValue = typeof value === 'number' ? value : Number(value) || 0
                            return `₱${numValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          }}
                        />
                      }
                    />
                    <Pie 
                      data={chartData} 
                      dataKey="value" 
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      label={false}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                {/* Category Legend */}
                <div className="mt-6 space-y-2">
                  <h3 className="text-sm font-medium mb-3">Categories</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {chartData.map((item, index) => (
                      <div
                        key={item.category}
                        className="flex items-center gap-2 text-sm"
                      >
                        <div
                          className="h-4 w-4 shrink-0 rounded-sm"
                          style={{
                            backgroundColor: chartColors[index % chartColors.length],
                          }}
                        />
                        <span className="text-muted-foreground flex-1 truncate">
                          {item.category}
                        </span>
                        <span className="font-medium tabular-nums">
                          ₱{item.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Calendar Section */}
        <Card className="flex flex-col h-full">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Calendar
            </CardTitle>
            <CardDescription>
              Lease expiring and maintenance due dates
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full">
                <Spinner className="h-8 w-8 mb-2" />
                <p className="text-sm text-muted-foreground">Loading...</p>
              </div>
            ) : (() => {
              // Get dates with events
              const leaseDates = new Set<string>()
              const maintenanceDates = new Set<string>()
              
              data?.calendar.leasesExpiring.forEach((lease) => {
                if (lease.leaseEndDate) {
                  const date = new Date(lease.leaseEndDate)
                  leaseDates.add(date.toISOString().split('T')[0])
                }
              })
              
              data?.calendar.maintenanceDue.forEach((maintenance) => {
                if (maintenance.dueDate) {
                  const date = new Date(maintenance.dueDate)
                  maintenanceDates.add(date.toISOString().split('T')[0])
                }
              })

              // Group events by date
              const eventsByDate = new Map<string, Array<{ type: 'lease' | 'maintenance'; assetId: string; assetTagId: string }>>()
              
              data?.calendar.leasesExpiring.forEach((lease) => {
                if (lease.leaseEndDate) {
                  const dateStr = lease.leaseEndDate.split('T')[0]
                  if (!eventsByDate.has(dateStr)) {
                    eventsByDate.set(dateStr, [])
                  }
                  eventsByDate.get(dateStr)!.push({
                    type: 'lease',
                    assetId: lease.asset.id,
                    assetTagId: lease.asset.assetTagId,
                  })
                }
              })
              
              data?.calendar.maintenanceDue.forEach((maintenance) => {
                if (maintenance.dueDate) {
                  const dateStr = maintenance.dueDate.split('T')[0]
                  if (!eventsByDate.has(dateStr)) {
                    eventsByDate.set(dateStr, [])
                  }
                  eventsByDate.get(dateStr)!.push({
                    type: 'maintenance',
                    assetId: maintenance.asset.id,
                    assetTagId: maintenance.asset.assetTagId,
                  })
                }
              })

              const today = new Date()

              // If a date is selected, show day view
              if (selectedDate) {
                const dateStr = selectedDate.toISOString().split('T')[0]
                const dayEvents = eventsByDate.get(dateStr) || []
                
                return (
                  <div className="flex flex-col h-full">
                    {/* Day View Header */}
                    <div className="flex items-center justify-between mb-6 pb-4 border-b">
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedDate(null)}
                          className="mr-2"
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Back
                        </Button>
                        <div className="flex flex-col">
                          <span className="text-lg font-semibold">
                            {format(selectedDate, 'MMMM d, yyyy').toUpperCase()}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {format(selectedDate, 'EEEE')}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const prevDay = new Date(selectedDate)
                            prevDay.setDate(prevDay.getDate() - 1)
                            setSelectedDate(prevDay)
                          }}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedDate(today)}
                        >
                          Today
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const nextDay = new Date(selectedDate)
                            nextDay.setDate(nextDay.getDate() + 1)
                            setSelectedDate(nextDay)
                          }}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Day Events List */}
                    <div className="flex-1 overflow-auto">
                      {dayEvents.length > 0 ? (
                        <div className="space-y-2">
                          {dayEvents.map((event, idx) => (
                            <Link
                              key={idx}
                              href={`/assets?search=${encodeURIComponent(event.assetTagId)}`}
                              className="block"
                            >
                              <div className="flex items-center gap-3 p-3 border border-border rounded-md hover:bg-accent/50 transition-colors cursor-pointer">
                                <Badge
                                  className={`px-3 py-1 font-medium ${
                                    event.type === 'maintenance'
                                      ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-300 dark:border-orange-700'
                                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-700'
                                  }`}
                                >
                                  {event.type === 'maintenance' ? 'Maintenance Due' : 'Lease Expiring'}
                                </Badge>
                                <div className="flex-1">
                                  <div className="font-medium">{event.assetTagId}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {event.type === 'maintenance' ? 'Maintenance scheduled for this date' : 'Lease expires on this date'}
                                  </div>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center py-12">
                          <CalendarIcon className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                          <p className="text-muted-foreground font-medium">No events scheduled</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            There are no maintenance or lease events on this date
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              }

              return (
                <div className="flex flex-col h-full">
                  {/* Top Bar */}
                  <div className="flex items-center justify-between mb-4 pb-4 border-b">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-primary text-primary-foreground px-3 py-1">
                        {format(today, 'MMM d').toUpperCase()}
                      </Badge>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {format(currentMonth, 'MMMM yyyy')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1), 'MMM d, yyyy')} - {format(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentMonth(today)}
                      >
                        Today
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Calendar */}
                  <div className="flex-1 overflow-auto">
                    <div>
                      {/* Days of week header */}
                      <div className="grid grid-cols-7 gap-1 mb-2">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                          <div key={day} className="text-xs font-medium text-muted-foreground text-center py-2">
                            {day}
                          </div>
                        ))}
                      </div>
                      
                      {/* Calendar Grid */}
                      <div className="grid grid-cols-7 gap-1">
                        {(() => {
                          const year = currentMonth.getFullYear()
                          const month = currentMonth.getMonth()
                          const firstDay = new Date(year, month, 1)
                          const lastDay = new Date(year, month + 1, 0)
                          const daysInMonth = lastDay.getDate()
                          const startDayOfWeek = firstDay.getDay()
                          
                          // Get previous month's trailing days
                          const prevMonthLastDay = new Date(year, month, 0).getDate()
                          const trailingDays: Date[] = []
                          for (let i = startDayOfWeek - 1; i >= 0; i--) {
                            trailingDays.push(new Date(year, month - 1, prevMonthLastDay - i))
                          }
                          
                          // Get current month's days
                          const currentMonthDays: Date[] = []
                          for (let i = 1; i <= daysInMonth; i++) {
                            currentMonthDays.push(new Date(year, month, i))
                          }
                          
                          // Get next month's leading days to fill 6 weeks (42 days)
                          const nextMonthDays: Date[] = []
                          const totalCells = trailingDays.length + currentMonthDays.length
                          const remainingCells = 42 - totalCells
                          for (let i = 1; i <= remainingCells; i++) {
                            nextMonthDays.push(new Date(year, month + 1, i))
                          }
                          
                          const allDays = [...trailingDays, ...currentMonthDays, ...nextMonthDays]
                          
                          return allDays.map((date, idx) => {
                            const dateStr = date.toISOString().split('T')[0]
                            const events = eventsByDate.get(dateStr) || []
                            const isToday = format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
                            const isCurrentMonth = date.getMonth() === currentMonth.getMonth()
                            
                            return (
                              <div
                                key={idx}
                                className="min-h-[80px] border border-border rounded-md p-1.5 hover:bg-accent/50 transition-colors flex flex-col cursor-pointer"
                                onClick={() => setSelectedDate(date)}
                              >
                                <div className={`text-sm font-medium mb-1 ${
                                  isCurrentMonth ? 'text-foreground' : 'text-muted-foreground opacity-50'
                                } ${isToday ? 'bg-primary text-primary-foreground rounded px-1.5 py-0.5 w-fit' : ''}`}>
                                  {date.getDate()}
                                </div>
                                <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
                                  {events.slice(0, 2).map((event, eventIdx) => (
                                    <div
                                      key={eventIdx}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        window.location.href = `/assets?search=${encodeURIComponent(event.assetTagId)}`
                                      }}
                                    >
                                      <Badge
                                        className={`text-[10px] px-1.5 py-0.5 font-medium w-full truncate cursor-pointer hover:opacity-80 transition-opacity ${
                                          event.type === 'maintenance'
                                            ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-300 dark:border-orange-700'
                                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-700'
                                        }`}
                                        title={`${event.type === 'maintenance' ? 'Maintenance Due' : 'Lease Expiring'} - ${event.assetTagId}`}
                                      >
                                        {event.assetTagId}
                                      </Badge>
                                    </div>
                                  ))}
                                  {events.length > 2 && (
                                    <div className="text-[10px] text-muted-foreground px-1">
                                      +{events.length - 2} more
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })
                        })()}
                      </div>
                    </div>
                  </div>
                  
                  {/* Legend */}
                  <div className="mt-4 pt-4 border-t">
                    <h3 className="text-sm font-medium mb-3">Legend</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="h-3 w-3 rounded bg-orange-100 dark:bg-orange-900 border border-orange-300 dark:border-orange-700 shrink-0" />
                        <span className="text-muted-foreground">Maintenance Due</span>
                        <Badge variant="outline" className="ml-auto">
                          {data?.calendar.maintenanceDue.length || 0}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <div className="h-3 w-3 rounded bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700 shrink-0" />
                        <span className="text-muted-foreground">Lease Expiring</span>
                        <Badge variant="outline" className="ml-auto">
                          {data?.calendar.leasesExpiring.length || 0}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Feeds Section */}
      <Card>
        <CardHeader>
          <CardTitle>Feeds</CardTitle>
          <CardDescription>
            Latest 10 recent asset activity and status updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Spinner className="h-8 w-8 mb-2" />
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : (
            <>
          {/* Tabs */}
          <ScrollArea className="max-w-sm sm:max-w-full border-b">
          <div className="flex items-center gap-2  mb-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setActiveTab('checked-out')}
              className={`px-4 py-2 h-auto text-sm font-medium transition-colors border-b-2 rounded-none ${
                activeTab === 'checked-out'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Checked Out ({data?.activeCheckouts.length || 0})
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setActiveTab('checked-in')}
              className={`px-4 py-2 h-auto text-sm font-medium transition-colors border-b-2 rounded-none ${
                activeTab === 'checked-in'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Checked In ({data?.recentCheckins.length || 0})
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setActiveTab('under-repair')}
              className={`px-4 py-2 h-auto text-sm font-medium transition-colors border-b-2 rounded-none ${
                activeTab === 'under-repair'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Under Repair ({data?.assetsUnderRepair.length || 0})
            </Button>
          </div>
          <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {/* Tab Content */}
          <div className="mt-4">
            {activeTab === 'checked-out' && (
              <div className="space-y-4">
                {data?.activeCheckouts && data.activeCheckouts.length > 0 ? (
                  <>
                    <div className="min-w-full">
                      <ScrollArea className="h-[450px] relative">
                        <div className="sticky top-0 z-30 h-px bg-border w-full"></div>
                        <div className="pr-2.5 relative after:content-[''] after:absolute after:right-[10px] after:top-0 after:bottom-0 after:w-px after:bg-border after:z-50 after:h-full">
                          <Table className="border-b">
                            <TableHeader className="sticky -top-1 z-20 bg-card [&_tr]:border-b-0 -mr-1.5">
                              <TableRow className="group hover:bg-muted/50 relative border-b-0 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-[1.5px] after:h-px after:bg-border after:z-30">
                                <TableHead>Asset Tag ID</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Checkout Date</TableHead>
                                <TableHead>Due Date</TableHead>
                                <TableHead>Assign To</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {data.activeCheckouts.map((checkout) => (
                                <TableRow key={checkout.id}>
                                  <TableCell className="font-medium">
                                    {checkout.asset.assetTagId}
                                  </TableCell>
                                  <TableCell>{checkout.asset.description}</TableCell>
                                  <TableCell>
                                    {format(new Date(checkout.checkoutDate), 'MMM dd, yyyy')}
                                  </TableCell>
                                  <TableCell>
                                    {checkout.expectedReturnDate
                                      ? format(new Date(checkout.expectedReturnDate), 'MMM dd, yyyy')
                                      : 'N/A'}
                                  </TableCell>
                                  <TableCell>
                                    {checkout.employeeUser?.name || checkout.employeeUser?.email || 'N/A'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        <ScrollBar orientation="horizontal" className="z-10" />
                        <ScrollBar orientation="vertical" className="z-20" />
                      </ScrollArea>
                    </div>
                    {data?.feedCounts && data.feedCounts.totalActiveCheckouts > data.activeCheckouts.length && (
                      <div className="text-center pt-2 border-t">
                        <Link href="/assets?status=Checked out">
                          <Button variant="link" className="text-sm">
                            + {data.feedCounts.totalActiveCheckouts - data.activeCheckouts.length} more assets checked-out. View All
                          </Button>
                        </Link>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No checked out assets
                  </div>
                )}
              </div>
            )}

            {activeTab === 'checked-in' && (
              <div className="space-y-4">
                {data?.recentCheckins && data.recentCheckins.length > 0 ? (
                  <>
                    <div className="min-w-full">
                      <ScrollArea className="h-[450px] relative">
                        <div className="sticky top-0 z-30 h-px bg-border w-full"></div>
                        <div className="pr-2.5 relative after:content-[''] after:absolute after:right-[10px] after:top-0 after:bottom-0 after:w-px after:bg-border after:z-50 after:h-full">
                          <Table className="border-b">
                            <TableHeader className="sticky -top-1 z-20 bg-card [&_tr]:border-b-0 -mr-1.5">
                              <TableRow className="group hover:bg-muted/50 relative border-b-0 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-[1.5px] after:h-px after:bg-border after:z-30">
                                <TableHead>Asset Tag ID</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Return Date</TableHead>
                                <TableHead>Check In From</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {data.recentCheckins.map((checkin) => (
                                <TableRow key={checkin.id}>
                                  <TableCell className="font-medium">
                                    {checkin.asset.assetTagId}
                                  </TableCell>
                                  <TableCell>{checkin.asset.description}</TableCell>
                                  <TableCell>
                                    {format(new Date(checkin.checkinDate), 'MMM dd, yyyy')}
                                  </TableCell>
                                  <TableCell>
                                    {checkin.checkout.employeeUser?.name || checkin.checkout.employeeUser?.email || 'N/A'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        <ScrollBar orientation="horizontal" className="z-10" />
                        <ScrollBar orientation="vertical" className="z-20" />
                      </ScrollArea>
                    </div>
                    {data?.feedCounts && data.feedCounts.totalCheckins > data.recentCheckins.length && (
                      <div className="text-center pt-2 border-t">
                        <Link href="/dashboard/activity">
                          <Button variant="link" className="text-sm">
                            + {data.feedCounts.totalCheckins - data.recentCheckins.length} more assets checked-in. View All
                          </Button>
                        </Link>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No recent check-ins
                  </div>
                )}
              </div>
            )}

            {activeTab === 'under-repair' && (
              <div className="space-y-4">
                {data?.assetsUnderRepair && data.assetsUnderRepair.length > 0 ? (
                  <>
                    <div className="min-w-full">
                      <ScrollArea className="h-[450px] relative">
                        <div className="sticky top-0 z-30 h-px bg-border w-full"></div>
                        <div className="pr-2.5 relative after:content-[''] after:absolute after:right-[10px] after:top-0 after:bottom-0 after:w-px after:bg-border after:z-50 after:h-full">
                          <Table className="border-b">
                            <TableHeader className="sticky -top-1 z-20 bg-card [&_tr]:border-b-0 -mr-1.5">
                              <TableRow className="group hover:bg-muted/50 relative border-b-0 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-[1.5px] after:h-px after:bg-border after:z-30">
                                <TableHead>Asset Tag ID</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Scheduled Date</TableHead>
                                <TableHead>Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {data.assetsUnderRepair.map((maintenance) => (
                                <TableRow key={maintenance.id}>
                                  <TableCell className="font-medium">
                                    {maintenance.asset.assetTagId}
                                  </TableCell>
                                  <TableCell>{maintenance.asset.description}</TableCell>
                                  <TableCell>
                                    {maintenance.dueDate
                                      ? format(new Date(maintenance.dueDate), 'MMM dd, yyyy')
                                      : 'N/A'}
                                  </TableCell>
                                  <TableCell>
                                    <span
                                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                        maintenance.status === 'In progress'
                                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                      }`}
                                    >
                                      {maintenance.status}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        <ScrollBar orientation="horizontal" className="z-10" />
                        <ScrollBar orientation="vertical" className="z-20" />
                      </ScrollArea>
                    </div>
                    {data?.feedCounts && data.feedCounts.totalAssetsUnderRepair > data.assetsUnderRepair.length && (
                      <div className="text-center pt-2 border-t">
                        <Link href="/lists/maintenances">
                          <Button variant="link" className="text-sm">
                            + {data.feedCounts.totalAssetsUnderRepair - data.assetsUnderRepair.length} more assets under Repair. View All
                          </Button>
                        </Link>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No assets under repair
                  </div>
                )}
              </div>
            )}
          </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
