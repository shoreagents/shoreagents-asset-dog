'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { DashboardStats } from '@/types/dashboard'
import { parseDateOnlyString } from '@/lib/date-utils'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { motion, AnimatePresence } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { ArrowUpRight, CheckCircle2, AlertCircle, MapPin, Calendar, Archive, Trash2 } from 'lucide-react'

interface ActivityFeedProps {
  data: DashboardStats | undefined
  isLoading: boolean
}

type TabType = 'checked-out' | 'checked-in' | 'under-repair' | 'move' | 'reserve' | 'lease' | 'return' | 'dispose'

export function ActivityFeed({ data, isLoading }: ActivityFeedProps) {
  const [activeTab, setActiveTab] = useState<TabType>('checked-out')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0)
    return () => clearTimeout(timer)
  }, [])

  if (isLoading) {
    return (
      <Card className="min-h-[400px]">
        <CardHeader>
          <div className="h-6 w-1/3 bg-muted rounded mb-2" />
          <div className="h-4 w-1/4 bg-muted rounded" />
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner className="h-8 w-8" />
        </CardContent>
      </Card>
    )
  }

  if (!mounted) return null

  const tabs = [
    { id: 'checked-out', label: 'Checked Out', count: data?.activeCheckouts.length || 0, icon: ArrowUpRight },
    { id: 'checked-in', label: 'Checked In', count: data?.recentCheckins.length || 0, icon: CheckCircle2 },
    { id: 'under-repair', label: 'Under Repair', count: data?.assetsUnderRepair.length || 0, icon: AlertCircle },
    { id: 'move', label: 'Move', count: data?.recentMoves.length || 0, icon: MapPin },
    { id: 'reserve', label: 'Reserve', count: data?.recentReserves.length || 0, icon: Calendar },
    { id: 'lease', label: 'Lease', count: data?.recentLeases.length || 0, icon: Archive },
    { id: 'return', label: 'Return', count: data?.recentReturns.length || 0, icon: CheckCircle2 },
    { id: 'dispose', label: 'Dispose', count: data?.recentDisposes.length || 0, icon: Trash2 },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/10 pb-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <CardTitle>Activity Feed</CardTitle>
              <CardDescription>
                Recent asset movements and status updates
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`
                  flex items-center gap-2 pb-4 text-sm font-medium transition-all relative
                  ${activeTab === tab.id 
                    ? 'text-primary' 
                    : 'text-muted-foreground hover:text-foreground'
                  }
                `}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                <Badge variant={activeTab === tab.id ? 'default' : 'secondary'} className="ml-1 h-5 px-1.5 min-w-[20px]">
                  {tab.count}
                </Badge>
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                  />
                )}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="min-h-[400px]">
            <AnimatePresence mode="wait">
              {activeTab === 'checked-out' && (
                <motion.div
                  key="checked-out"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className="p-0"
                >
                  <div className="rounded-md border-0">
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead className="w-[150px]">Asset Tag</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Checkout Date</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Assigned To</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data?.activeCheckouts.length ? (
                            data.activeCheckouts.slice(0, 10).map((checkout) => (
                              <TableRow key={checkout.id} className="hover:bg-muted/30">
                                <TableCell className="font-medium text-primary">
                                  <Link href={`/assets/details/${checkout.asset.id}`} className="hover:underline">
                                    {checkout.asset.assetTagId}
                                  </Link>
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate" title={checkout.asset.description}>
                                  {checkout.asset.description}
                                </TableCell>
                                <TableCell>
                                  {format(new Date(checkout.checkoutDate), 'MMM dd, yyyy')}
                                </TableCell>
                                <TableCell>
                                  {checkout.expectedReturnDate ? (
                                    <span className={new Date(checkout.expectedReturnDate) < new Date() ? "text-destructive font-medium" : ""}>
                                      {format(new Date(checkout.expectedReturnDate), 'MMM dd, yyyy')}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground italic">No due date</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                                      {(checkout.employeeUser?.name || checkout.employeeUser?.email || '?')[0].toUpperCase()}
                                    </div>
                                    <span className="truncate max-w-[150px]">
                                      {checkout.employeeUser?.name || checkout.employeeUser?.email || 'Unknown'}
                                    </span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                No checked out assets found.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                      <ScrollBar orientation="horizontal" className="z-10" />
                    </ScrollArea>
                  </div>
                  {data?.feedCounts && data.feedCounts.totalActiveCheckouts > (data.activeCheckouts.length || 0) && (
                    <div className="p-4 text-center border-t bg-muted/10">
                      <Link href="/assets?status=Checked out">
                        <Button variant="link" className="text-sm">
                          View all {data.feedCounts.totalActiveCheckouts} checked-out assets
                        </Button>
                      </Link>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'checked-in' && (
                <motion.div
                  key="checked-in"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                >
                   <div className="rounded-md border-0">
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead className="w-[150px]">Asset Tag</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Return Date</TableHead>
                            <TableHead>Returned By</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data?.recentCheckins.length ? (
                            data.recentCheckins.slice(0, 10).map((checkin) => (
                              <TableRow key={checkin.id} className="hover:bg-muted/30">
                                <TableCell className="font-medium text-primary">
                                  <Link href={`/assets/details/${checkin.asset.id}`} className="hover:underline">
                                    {checkin.asset.assetTagId}
                                  </Link>
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate" title={checkin.asset.description}>
                                  {checkin.asset.description}
                                </TableCell>
                                <TableCell>
                                  {format(new Date(checkin.checkinDate), 'MMM dd, yyyy')}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-xs font-medium text-green-700 dark:text-green-400">
                                      {(checkin.checkout.employeeUser?.name || checkin.checkout.employeeUser?.email || '?')[0].toUpperCase()}
                                    </div>
                                    <span className="truncate max-w-[150px]">
                                      {checkin.checkout.employeeUser?.name || checkin.checkout.employeeUser?.email || 'Unknown'}
                                    </span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                No recent check-ins found.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                      <ScrollBar orientation="horizontal" className="z-10" />
                    </ScrollArea>
                  </div>
                   {data?.feedCounts && data.feedCounts.totalCheckins > (data.recentCheckins.length || 0) && (
                    <div className="p-4 text-center border-t bg-muted/10">
                      <Link href="/dashboard/activity">
                        <Button variant="link" className="text-sm">
                          View all recent activity
                        </Button>
                      </Link>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'under-repair' && (
                <motion.div
                  key="under-repair"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="rounded-md border-0">
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead className="w-[150px]">Asset Tag</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Scheduled Date</TableHead>
                            <TableHead>Maintained By</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data?.assetsUnderRepair.length ? (
                            data.assetsUnderRepair.slice(0, 10).map((maintenance) => (
                              <TableRow key={maintenance.id} className="hover:bg-muted/30">
                                <TableCell className="font-medium text-primary">
                                  <Link href={`/assets/details/${maintenance.asset.id}`} className="hover:underline">
                                    {maintenance.asset.assetTagId}
                                  </Link>
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate" title={maintenance.asset.description}>
                                  {maintenance.asset.description}
                                </TableCell>
                                <TableCell>
                                  {maintenance.dueDate
                                    ? format(parseDateOnlyString(maintenance.dueDate) || new Date(), 'MMM dd, yyyy')
                                    : 'N/A'}
                                </TableCell>
                                <TableCell>
                                  {maintenance.maintenanceBy || 'N/A'}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={maintenance.status === 'In progress' ? 'default' : 'secondary'}>
                                    {maintenance.status}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                No assets under repair.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                      <ScrollBar orientation="horizontal" className="z-10" />
                    </ScrollArea>
                  </div>
                  {data?.feedCounts && data.feedCounts.totalAssetsUnderRepair > (data.assetsUnderRepair.length || 0) && (
                    <div className="p-4 text-center border-t bg-muted/10">
                      <Link href="/lists/maintenances">
                        <Button variant="link" className="text-sm">
                          View all {data.feedCounts.totalAssetsUnderRepair} assets under repair
                        </Button>
                      </Link>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'move' && (
                <motion.div
                  key="move"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="rounded-md border-0">
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead className="w-[150px]">Asset Tag</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Move Date</TableHead>
                            <TableHead>New Location</TableHead>
                            <TableHead>Moved By</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data?.recentMoves && data.recentMoves.length > 0 ? (
                            data.recentMoves.slice(0, 10).map((move) => (
                              <TableRow key={move.id} className="hover:bg-muted/30">
                                <TableCell className="font-medium text-primary">
                                  <Link href={`/assets/details/${move.asset.id}`} className="hover:underline">
                                    {move.asset.assetTagId}
                                  </Link>
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate" title={move.asset.description}>
                                  {move.asset.description}
                                </TableCell>
                                <TableCell>
                                  {format(new Date(move.moveDate), 'MMM dd, yyyy')}
                                </TableCell>
                                <TableCell>{move.newLocation || 'N/A'}</TableCell>
                                <TableCell>
                                  {move.employeeUser ? (
                                    <div className="flex items-center gap-2">
                                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                                        {(move.employeeUser.name || move.employeeUser.email || '?')[0].toUpperCase()}
                                      </div>
                                      <span className="truncate max-w-[150px]">
                                        {move.employeeUser.name || move.employeeUser.email || 'Unknown'}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">N/A</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                No moves found.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                      <ScrollBar orientation="horizontal" className="z-10" />
                    </ScrollArea>
                  </div>
                  {data?.feedCounts && data.feedCounts.totalMoves > (data.recentMoves?.length || 0) && (
                    <div className="p-4 text-center border-t bg-muted/10">
                      <Link href="/dashboard/activity?type=move">
                        <Button variant="link" className="text-sm">
                          View all {data.feedCounts.totalMoves} moved assets
                        </Button>
                      </Link>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'reserve' && (
                <motion.div
                  key="reserve"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="rounded-md border-0">
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead className="w-[150px]">Asset Tag</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Reservation Date</TableHead>
                            <TableHead>Reservation Type</TableHead>
                            <TableHead>Reserved By</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data?.recentReserves && data.recentReserves.length > 0 ? (
                            data.recentReserves.slice(0, 10).map((reserve) => (
                              <TableRow key={reserve.id} className="hover:bg-muted/30">
                                <TableCell className="font-medium text-primary">
                                  <Link href={`/assets/details/${reserve.asset.id}`} className="hover:underline">
                                    {reserve.asset.assetTagId}
                                  </Link>
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate" title={reserve.asset.description}>
                                  {reserve.asset.description}
                                </TableCell>
                                <TableCell>
                                  {format(new Date(reserve.reservationDate), 'MMM dd, yyyy')}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">{reserve.reservationType}</Badge>
                                </TableCell>
                                <TableCell>
                                  {reserve.employeeUser ? (
                                    <div className="flex items-center gap-2">
                                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                                        {(reserve.employeeUser.name || reserve.employeeUser.email || '?')[0].toUpperCase()}
                                      </div>
                                      <span className="truncate max-w-[150px]">
                                        {reserve.employeeUser.name || reserve.employeeUser.email || 'Unknown'}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">N/A</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                No reservations found.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                      <ScrollBar orientation="horizontal" className="z-10" />
                    </ScrollArea>
                  </div>
                  {data?.feedCounts && data.feedCounts.totalReserves > (data.recentReserves?.length || 0) && (
                    <div className="p-4 text-center border-t bg-muted/10">
                      <Link href="/dashboard/activity?type=reserve">
                        <Button variant="link" className="text-sm">
                          View all {data.feedCounts.totalReserves} reserved assets
                        </Button>
                      </Link>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'lease' && (
                <motion.div
                  key="lease"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="rounded-md border-0">
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead className="w-[150px]">Asset Tag</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Lease Start Date</TableHead>
                            <TableHead>Lease End Date</TableHead>
                            <TableHead>Lessee</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data?.recentLeases && data.recentLeases.length > 0 ? (
                            data.recentLeases.slice(0, 10).map((lease) => (
                              <TableRow key={lease.id} className="hover:bg-muted/30">
                                <TableCell className="font-medium text-primary">
                                  <Link href={`/assets/details/${lease.asset.id}`} className="hover:underline">
                                    {lease.asset.assetTagId}
                                  </Link>
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate" title={lease.asset.description}>
                                  {lease.asset.description}
                                </TableCell>
                                <TableCell>
                                  {format(new Date(lease.leaseStartDate), 'MMM dd, yyyy')}
                                </TableCell>
                                <TableCell>
                                  {lease.leaseEndDate ? (
                                    <span className={new Date(lease.leaseEndDate) < new Date() ? "text-destructive font-medium" : ""}>
                                      {format(new Date(lease.leaseEndDate), 'MMM dd, yyyy')}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground italic">No end date</span>
                                  )}
                                </TableCell>
                                <TableCell>{lease.lessee}</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                No leases found.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                      <ScrollBar orientation="horizontal" className="z-10" />
                    </ScrollArea>
                  </div>
                  {data?.feedCounts && data.feedCounts.totalLeases > (data.recentLeases?.length || 0) && (
                    <div className="p-4 text-center border-t bg-muted/10">
                      <Link href="/dashboard/activity?type=lease">
                        <Button variant="link" className="text-sm">
                          View all {data.feedCounts.totalLeases} leased assets
                        </Button>
                      </Link>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'return' && (
                <motion.div
                  key="return"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="rounded-md border-0">
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead className="w-[150px]">Asset Tag</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Return Date</TableHead>
                            <TableHead>Lessee</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data?.recentReturns && data.recentReturns.length > 0 ? (
                            data.recentReturns.slice(0, 10).map((returnItem) => (
                              <TableRow key={returnItem.id} className="hover:bg-muted/30">
                                <TableCell className="font-medium text-primary">
                                  <Link href={`/assets/details/${returnItem.asset.id}`} className="hover:underline">
                                    {returnItem.asset.assetTagId}
                                  </Link>
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate" title={returnItem.asset.description}>
                                  {returnItem.asset.description}
                                </TableCell>
                                <TableCell>
                                  {format(new Date(returnItem.returnDate), 'MMM dd, yyyy')}
                                </TableCell>
                                <TableCell>{returnItem.lease.lessee}</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                No returns found.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                      <ScrollBar orientation="horizontal" className="z-10" />
                    </ScrollArea>
                  </div>
                  {data?.feedCounts && data.feedCounts.totalReturns > (data.recentReturns?.length || 0) && (
                    <div className="p-4 text-center border-t bg-muted/10">
                      <Link href="/dashboard/activity?type=leaseReturn">
                        <Button variant="link" className="text-sm">
                          View all {data.feedCounts.totalReturns} returned assets
                        </Button>
                      </Link>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'dispose' && (
                <motion.div
                  key="dispose"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="rounded-md border-0">
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead className="w-[150px]">Asset Tag</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Dispose Date</TableHead>
                            <TableHead>Disposal Method</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data?.recentDisposes && data.recentDisposes.length > 0 ? (
                            data.recentDisposes.slice(0, 10).map((dispose) => (
                              <TableRow key={dispose.id} className="hover:bg-muted/30">
                                <TableCell className="font-medium text-primary">
                                  <Link href={`/assets/details/${dispose.asset.id}`} className="hover:underline">
                                    {dispose.asset.assetTagId}
                                  </Link>
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate" title={dispose.asset.description}>
                                  {dispose.asset.description}
                                </TableCell>
                                <TableCell>
                                  {format(new Date(dispose.disposeDate), 'MMM dd, yyyy')}
                                </TableCell>
                                <TableCell>{dispose.disposalMethod || 'N/A'}</TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                No disposals found.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                      <ScrollBar orientation="horizontal" className="z-10" />
                    </ScrollArea>
                  </div>
                  {data?.feedCounts && data.feedCounts.totalDisposes > (data.recentDisposes?.length || 0) && (
                    <div className="p-4 text-center border-t bg-muted/10">
                      <Link href="/dashboard/activity?type=dispose">
                        <Button variant="link" className="text-sm">
                          View all {data.feedCounts.totalDisposes} disposed assets
                        </Button>
                      </Link>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
