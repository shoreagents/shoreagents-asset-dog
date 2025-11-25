'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardStats } from '@/types/dashboard'
import { Box, DollarSign, ShoppingCart, TrendingUp } from 'lucide-react'
import { motion } from 'framer-motion'

interface SummaryCardsProps {
  data: DashboardStats['summary'] | undefined
  isLoading: boolean
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
}

export function SummaryCards({ data, isLoading }: SummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 w-1/3 bg-muted rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-1/2 bg-muted rounded mb-2" />
              <div className="h-3 w-3/4 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const cards = [
    {
      title: 'Total Active Assets',
      value: `${data?.checkedOutAndAvailable.toLocaleString() || '0'}/${data?.totalActiveAssets.toLocaleString() || '0'}`,
      description: 'Number of Active Assets / Total Active Assets',
      icon: Box,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      borderColor: '#3b82f6', // blue-500
    },
    {
      title: 'Total Value of Assets',
      value: `₱${data?.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`,
      description: 'Total asset value',
      icon: DollarSign,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      borderColor: '#22c55e', // green-500
    },
    {
      title: 'Purchases in Fiscal Year',
      value: data?.purchasesInFiscalYear.toLocaleString() || '0',
      description: 'Assets purchased this year',
      icon: ShoppingCart,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      borderColor: '#f59e0b', // amber-500
    },
  ]

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 md:grid-cols-3 gap-6"
    >
      {cards.map((card, index) => (
        <motion.div key={index} variants={item}>
          <Card 
            className="border-l-4 transition-all hover:shadow-md" 
            style={{ borderLeftColor: card.borderColor }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-full ${card.bgColor}`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {card.description}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  )
}

