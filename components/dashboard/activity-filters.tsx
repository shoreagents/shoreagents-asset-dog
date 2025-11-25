'use client'

import { Button } from "@/components/ui/button"
import { Activity, ArrowRight, ArrowLeft, MapPin, Calendar, FileText, Archive, Trash2, Wrench } from 'lucide-react'
import { motion } from 'framer-motion'

export const activityTypes = [
  { value: 'all', label: 'All Activities', icon: Activity },
  { value: 'checkout', label: 'Check Outs', icon: ArrowRight },
  { value: 'checkin', label: 'Check Ins', icon: ArrowLeft },
  { value: 'move', label: 'Moves', icon: MapPin },
  { value: 'reserve', label: 'Reservations', icon: Calendar },
  { value: 'lease', label: 'Leases', icon: FileText },
  { value: 'leaseReturn', label: 'Lease Returns', icon: Archive },
  { value: 'dispose', label: 'Disposals', icon: Trash2 },
  { value: 'maintenance', label: 'Maintenance', icon: Wrench },
]

interface ActivityFiltersProps {
  selectedType: string
  onTypeChange: (type: string) => void
  disabled?: boolean
}

export function ActivityFilters({ selectedType, onTypeChange, disabled }: ActivityFiltersProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-wrap gap-2"
    >
      {activityTypes.map((type, index) => {
        const Icon = type.icon
        return (
          <motion.div
            key={type.value}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
          >
            <Button
              variant={selectedType === type.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => onTypeChange(type.value)}
              disabled={disabled}
              className="gap-2 transition-all duration-200"
            >
              <Icon className="h-4 w-4" />
              {type.label}
            </Button>
          </motion.div>
        )
      })}
    </motion.div>
  )
}

