'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface MobilePaginationProps {
  children: ReactNode
  className?: string
}

export function MobilePagination({ children, className }: MobilePaginationProps) {
  return (
    <div
      className={cn(
        'fixed left-0 right-0 z-40',
        'md:hidden',
        'bg-background',
        'bg-clip-padding',
        'backdrop-filter backdrop-blur-md',
        'border-t border-border',
        'px-4 py-3',
        'bottom-[65px]',
        className
      )}
    >
      <div className="flex items-center justify-between w-full">
        {children}
      </div>
    </div>
  )
}

