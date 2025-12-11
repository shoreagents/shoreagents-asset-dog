'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardStats } from '@/types/dashboard'
import { Box, DollarSign, ShoppingCart } from 'lucide-react'
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
          <Card 
            key={i} 
            className="animate-pulse relative overflow-hidden !bg-transparent bg-[linear-gradient(135deg,rgba(255,255,255,0.15)_0%,rgba(255,255,255,0.08)_100%)] backdrop-blur-[20px] backdrop-saturate-[180%] rounded-[24px] border-[1px_solid_rgba(255,255,255,0.2)] shadow-[0_8px_32px_0_rgba(0,0,0,0.12),0_2px_8px_0_rgba(0,0,0,0.08),inset_0_1px_0_0_rgba(255,255,255,0.4),inset_0_-1px_0_0_rgba(255,255,255,0.15)]"
          >
            {/* 3D Bubble Highlight - Top */}
            <div 
              className="absolute top-0 left-0 right-0 h-1/2 pointer-events-none z-0 rounded-t-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.25)_0%,rgba(255,255,255,0)_100%)] opacity-60"
            />
            <CardHeader className="relative pb-2 z-10 px-6 pt-6">
              <div className="h-4 w-1/3 bg-muted/50 rounded" />
            </CardHeader>
            <CardContent className="relative z-10 px-6 pb-6">
              <div className="h-8 w-1/2 bg-muted/50 rounded mb-2" />
              <div className="h-3 w-3/4 bg-muted/50 rounded" />
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
      title: 'New Assets This Year',
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
      {cards.map((card, index) => {
        const IconComponent = card.icon
        return (
          <motion.div 
            key={index} 
            variants={item}
            whileHover={{ scale: 1.005, y: -2 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <Card 
              className="relative overflow-hidden transition-all duration-300 group !bg-transparent py-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.15)_0%,rgba(255,255,255,0.08)_100%)] backdrop-blur-[20px] backdrop-saturate-[180%] rounded-[24px] border-[1px_solid_rgba(255,255,255,0.2)] shadow-[0_8px_32px_0_rgba(0,0,0,0.12),0_2px_8px_0_rgba(0,0,0,0.08),inset_0_1px_0_0_rgba(255,255,255,0.4),inset_0_-1px_0_0_rgba(255,255,255,0.15)]"
            >
              {/* 3D Bubble Highlight - Top */}
              <div 
                className="absolute top-0 left-0 right-0 h-1/2 pointer-events-none z-0 rounded-t-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.25)_0%,rgba(255,255,255,0)_100%)] opacity-60"
              />
              
              {/* Large Background Icon - Blurred through glass */}
              <div className="absolute right-0 top-0 pointer-events-none z-0">
                <IconComponent className={`h-32 w-32 ${card.color} -mr-8 -mt-8 opacity-20 dark:opacity-15 blur-md`} />
              </div>
              
              {/* Inner Shadow for Depth */}
              <div 
                className="absolute inset-0 pointer-events-none z-0 rounded-[24px] shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.06)]"
              />
              
              <CardHeader className="relative space-y-0 pb-2 z-10 px-6 pt-6">
                <CardTitle className="text-sm font-medium">
                  {card.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="relative z-10 px-6 pb-6">
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {card.description}
                </p>
              </CardContent>
              
              {/* Hover Glow Effect */}
              <div 
                className="absolute inset-0 pointer-events-none z-0 rounded-[24px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: `radial-gradient(circle at 50% 0%, ${card.borderColor}15 0%, transparent 70%)`,
                }}
              />
            </Card>
          </motion.div>
        )
      })}
    </motion.div>
  )
}

