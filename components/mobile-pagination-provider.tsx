'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { MobilePagination } from '@/components/ui/mobile-pagination'
import { useIsMobile } from '@/hooks/use-mobile'

interface MobilePaginationContextType {
  setPaginationContent: (content: ReactNode | null) => void
  isPaginationVisible: boolean
}

const MobilePaginationContext = createContext<MobilePaginationContextType | null>(null)

export function useMobilePagination() {
  const context = useContext(MobilePaginationContext)
  if (!context) {
    throw new Error('useMobilePagination must be used within MobilePaginationProvider')
  }
  return context
}

export function MobilePaginationProvider({ children }: { children: ReactNode }) {
  const [paginationContent, setPaginationContent] = useState<ReactNode | null>(null)
  const isMobile = useIsMobile()
  const isPaginationVisible = isMobile && paginationContent !== null

  return (
    <MobilePaginationContext.Provider value={{ setPaginationContent, isPaginationVisible }}>
      {children}
      {isPaginationVisible && (
        <MobilePagination>
          {paginationContent}
        </MobilePagination>
      )}
    </MobilePaginationContext.Provider>
  )
}

