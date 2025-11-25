'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Wrench, Clock } from 'lucide-react'
import { DashboardStats } from '@/types/dashboard'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { Spinner } from '@/components/ui/shadcn-io/spinner'

interface CalendarWidgetProps {
  data: DashboardStats['calendar'] | undefined
  isLoading: boolean
}

export function CalendarWidget({ data, isLoading }: CalendarWidgetProps) {
  const { resolvedTheme } = useTheme()
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

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

  const leaseDates = new Set<string>()
  const maintenanceDates = new Set<string>()
  const eventsByDate = new Map<string, Array<{ type: 'lease' | 'maintenance'; assetId: string; assetTagId: string }>>()

  data?.leasesExpiring.forEach((lease) => {
    if (lease.leaseEndDate) {
      const dateStr = lease.leaseEndDate
      leaseDates.add(dateStr)
      if (!eventsByDate.has(dateStr)) eventsByDate.set(dateStr, [])
      eventsByDate.get(dateStr)!.push({
        type: 'lease',
        assetId: lease.asset.id,
        assetTagId: lease.asset.assetTagId,
      })
    }
  })

  data?.maintenanceDue.forEach((maintenance) => {
    if (maintenance.dueDate) {
      const dateStr = maintenance.dueDate
      maintenanceDates.add(dateStr)
      if (!eventsByDate.has(dateStr)) eventsByDate.set(dateStr, [])
      eventsByDate.get(dateStr)!.push({
        type: 'maintenance',
        assetId: maintenance.asset.id,
        assetTagId: maintenance.asset.assetTagId,
      })
    }
  })

  const today = new Date()

  // Render Day View
  if (selectedDate) {
    const year = selectedDate.getFullYear()
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
    const day = String(selectedDate.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    const dayEvents = eventsByDate.get(dateStr) || []

    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="h-full"
      >
        <Card className="flex flex-col h-full min-h-[500px]">
          <CardHeader className="pb-4 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedDate(null)}
                  className="h-8 w-8 rounded-full hover:bg-background"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div>
                  <CardTitle className="text-lg">
                    {format(selectedDate, 'MMMM d, yyyy')}
                  </CardTitle>
                  <CardDescription>
                    {format(selectedDate, 'EEEE')}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
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
                  className="h-8"
                  onClick={() => setSelectedDate(today)}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
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
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-4">
            {dayEvents.length > 0 ? (
              <div className="space-y-3">
                {dayEvents.map((event, idx) => (
                  <Link
                    key={idx}
                    href={`/assets?search=${encodeURIComponent(event.assetTagId)}`}
                    className="block"
                  >
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-all hover:shadow-sm hover:border-primary/50 group"
                    >
                      <div className={`p-2 rounded-full ${
                        event.type === 'maintenance'
                          ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                          : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {event.type === 'maintenance' ? <Wrench className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium flex items-center gap-2">
                          {event.assetTagId}
                          <Badge variant="outline" className="text-[10px] h-5">
                             {event.type === 'maintenance' ? 'Maintenance' : 'Lease Expiring'}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {event.type === 'maintenance' ? 'Scheduled maintenance due' : 'Lease contract expires'}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                    </motion.div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-12 text-muted-foreground">
                <CalendarIcon className="h-12 w-12 mb-4 opacity-20" />
                <p className="font-medium">No events scheduled</p>
                <p className="text-sm opacity-70 mt-1">
                  No maintenance or lease events for this date
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // Render Month View
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startDayOfWeek = firstDay.getDay()
  
  const prevMonthLastDay = new Date(year, month, 0).getDate()
  const trailingDays = []
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    trailingDays.push(new Date(year, month - 1, prevMonthLastDay - i))
  }
  
  const currentMonthDays = []
  for (let i = 1; i <= daysInMonth; i++) {
    currentMonthDays.push(new Date(year, month, i))
  }
  
  const nextMonthDays = []
  const totalCells = trailingDays.length + currentMonthDays.length
  const remainingCells = 42 - totalCells
  for (let i = 1; i <= remainingCells; i++) {
    nextMonthDays.push(new Date(year, month + 1, i))
  }
  
  const allDays = [...trailingDays, ...currentMonthDays, ...nextMonthDays]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="h-full"
    >
      <Card className="flex flex-col h-full min-h-[500px]">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-primary" />
                Calendar
              </CardTitle>
              <CardDescription>
                Lease expiries and maintenance
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-lg">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[100px] text-center">
                {format(currentMonth, 'MMMM yyyy')}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
              <div key={day} className="text-xs font-medium text-muted-foreground text-center py-2">
                {day}
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-7 gap-1 flex-1 auto-rows-fr">
            {allDays.map((date, idx) => {
              const year = date.getFullYear()
              const month = String(date.getMonth() + 1).padStart(2, '0')
              const day = String(date.getDate()).padStart(2, '0')
              const dateStr = `${year}-${month}-${day}`
              const events = eventsByDate.get(dateStr) || []
              const isToday = format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')
              const isCurrentMonth = date.getMonth() === currentMonth.getMonth()
              
              return (
                <motion.div
                  key={`${dateStr}-${idx}-${resolvedTheme}`}
                  whileHover={{ scale: 0.98, backgroundColor: "var(--accent)" }}
                  onClick={() => setSelectedDate(date)}
                  className={`
                    relative border rounded-md p-1 flex flex-col cursor-pointer transition-colors min-h-[80px]
                    ${isCurrentMonth ? 'bg-card hover:bg-accent/50' : 'bg-muted/20 opacity-50'}
                    ${isToday ? 'ring-2 ring-primary ring-inset' : ''}
                  `}
                >
                  <span className={`text-[10px] font-medium mb-1 w-fit px-1 rounded ${
                    isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                  }`}>
                    {date.getDate()}
                  </span>
                  
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    {events.slice(0, 2).map((event, eventIdx) => (
                      <div
                        key={eventIdx}
                        onClick={(e) => {
                          e.stopPropagation()
                          // Navigate to search results for this asset
                        }}
                      >
                        <div
                          className={`text-[10px] h-4 px-1 py-0.5 w-full flex items-center rounded-sm ${
                            event.type === 'maintenance'
                              ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/80 dark:text-orange-100'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/80 dark:text-blue-100'
                          }`}
                        >
                          <span className="truncate font-medium">{event.assetTagId}</span>
                        </div>
                      </div>
                    ))}
                    {events.length > 2 && (
                      <div className="text-[9px] text-muted-foreground px-1">
                        +{events.length - 2} more
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>

          <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
             <div className="flex items-center gap-2">
                <div className="h-3 w-3 shrink-0 rounded-full bg-orange-400" />
                Maintenance
             </div>
             <div className="flex items-center gap-2">
                <div className="h-3 w-3 shrink-0 rounded-full bg-blue-400" />
                Lease Expiring
             </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
