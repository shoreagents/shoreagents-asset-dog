'use client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { History, ArrowLeft, ArrowRight, ArrowUpFromLine, ArrowDownToLine, Settings, Package } from 'lucide-react'

export interface InventoryItem {
  id: string
  name: string
  currentStock: number
  unit: string | null
}

export interface RelatedTransaction {
  id: string
  inventoryItemId: string
  transactionType: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER'
  quantity: number
  transactionDate: string
  inventoryItem: {
    id: string
    itemCode: string
    name: string
  }
}

export interface InventoryTransaction {
  id: string
  inventoryItemId: string
  transactionType: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER'
  quantity: number
  unitCost: number | null
  totalCost: number | null
  transactionDate: string
  reference: string | null
  notes: string | null
  actionBy: string | null
  createdAt: string
  relatedTransaction?: RelatedTransaction | null
}

interface InventoryTransactionHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: InventoryItem | null
  transactions: InventoryTransaction[] | undefined
  pagination: {
    page: number
    totalPages: number
    total: number
  } | undefined
  isLoading?: boolean
  onPageChange: (page: number) => void
}

export function InventoryTransactionHistoryDialog({
  open,
  onOpenChange,
  item,
  transactions,
  pagination,
  isLoading = false,
  onPageChange,
}: InventoryTransactionHistoryDialogProps) {
  const handlePageChange = (newPage: number) => {
    onPageChange(newPage)
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'IN':
        return <Badge variant="default" className="bg-green-600"><ArrowUpFromLine className="h-3 w-3 mr-1" />IN</Badge>
      case 'OUT':
        return <Badge variant="destructive"><ArrowDownToLine className="h-3 w-3 mr-1" />OUT</Badge>
      case 'ADJUSTMENT':
        return <Badge variant="secondary"><Settings className="h-3 w-3 mr-1" />ADJUST</Badge>
      case 'TRANSFER':
        return <Badge variant="outline"><Package className="h-3 w-3 mr-1" />TRANSFER</Badge>
      default:
        return <Badge>{type}</Badge>
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl! max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Transaction History</DialogTitle>
          <DialogDescription>
            {item && (
              <>
                History for <strong>{item.name}</strong>
                <br />
                Current stock: <strong>{Math.floor(parseFloat(item.currentStock.toString()))} {item.unit || 'pcs'}</strong>
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="h-8 w-8" />
            </div>
          ) : !transactions || transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No transactions found</p>
              <p className="text-sm">Transactions will appear here once created</p>
            </div>
          ) : (
            <>
              <ScrollArea className="h-96 w-full max-w-[850px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Unit Cost</TableHead>
                      <TableHead>Total Cost</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Action By</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          {new Date(transaction.transactionDate).toLocaleDateString()}
                          <br />
                          <span className="text-xs text-muted-foreground">
                            {new Date(transaction.transactionDate).toLocaleTimeString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          {getTypeBadge(transaction.transactionType)}
                          {transaction.transactionType === 'TRANSFER' && transaction.relatedTransaction && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              → {transaction.relatedTransaction.inventoryItem.itemCode} - {transaction.relatedTransaction.inventoryItem.name}
                            </div>
                          )}
                          {transaction.transactionType === 'IN' && transaction.relatedTransaction && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              ← Transfer from {transaction.relatedTransaction.inventoryItem.itemCode}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {(transaction.transactionType === 'OUT' || transaction.transactionType === 'TRANSFER') ? '-' : '+'}
                          {Math.floor(parseFloat(transaction.quantity.toString()))}
                        </TableCell>
                        <TableCell>
                          {transaction.unitCost
                            ? `₱${parseFloat(transaction.unitCost.toString()).toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`
                            : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {transaction.unitCost
                            ? `₱${(parseFloat(transaction.unitCost.toString()) * parseFloat(transaction.quantity.toString())).toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`
                            : 'N/A'}
                        </TableCell>
                        <TableCell>{transaction.reference || 'N/A'}</TableCell>
                        <TableCell>{transaction.actionBy || 'N/A'}</TableCell>
                        <TableCell className="max-w-xs truncate">{transaction.notes || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  </Table>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages}
                    {' • '}
                    {pagination.total} total transactions
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(Math.max(1, pagination.page - 1))}
                      disabled={pagination.page === 1}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

