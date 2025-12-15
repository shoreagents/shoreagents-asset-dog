'use client'

import { useState, useCallback, useTransition, useMemo, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import { User, Lock, Shield, PanelLeft, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import PersonalDetails from '@/components/settings/personal-details'
import PasswordAndSecurity from '@/components/settings/password-security'
import Permissions from '@/components/settings/permissions'
import Preferences from '@/components/settings/preferences'

function AccountPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const isMobile = useIsMobile()
  const [manualCollapsed, setManualCollapsed] = useState<boolean | null>(null)
  
  // Derive collapsed state: use manual override if set, otherwise use mobile state
  const isCollapsed = useMemo(() => {
    if (manualCollapsed !== null) {
      return manualCollapsed
    }
    return isMobile
  }, [manualCollapsed, isMobile])
  
  // Tab state from URL
  const activeTab = (searchParams.get('tab') as 'personal' | 'password' | 'permissions' | 'preferences') || 'personal'

  // Update URL parameters
  const updateURL = useCallback(
    (updates: { tab?: 'personal' | 'password' | 'permissions' | 'preferences' }) => {
      const params = new URLSearchParams(searchParams.toString())

      if (updates.tab !== undefined) {
        if (updates.tab === 'personal') {
          params.delete('tab')
        } else {
          params.set('tab', updates.tab)
        }
      }

      startTransition(() => {
        router.replace(`/account?${params.toString()}`, { scroll: false })
      })
    },
    [searchParams, router, startTransition]
  )

  const handleTabChange = (tab: 'personal' | 'password' | 'permissions' | 'preferences') => {
    updateURL({ tab })
  }

  const toggleSidebar = () => {
    setManualCollapsed(!isCollapsed)
  }

  const tabs = [
    {
      id: 'personal' as const,
      label: 'Personal Details',
      icon: User,
    },
    {
      id: 'password' as const,
      label: 'Password and Security',
      icon: Lock,
    },
    {
      id: 'permissions' as const,
      label: 'Permissions',
      icon: Shield,
    },
    {
      id: 'preferences' as const,
      label: 'Preferences',
      icon: Settings,
    },
  ]

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </motion.div>

      <div className="flex flex-row gap-6">
        {/* Sidebar Navigation */}
        <div className={cn(
          'shrink-0 transition-all duration-200',
          isCollapsed ? 'w-12' : 'w-64'
        )}>
          <div className={cn(
            'flex items-center mb-4',
            isCollapsed ? 'justify-center' : 'justify-between'
          )}>
            <h2 className={cn(
              'text-sm font-semibold transition-opacity',
              isMobile && 'hidden',
              isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
            )}>
              Navigation
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className={cn("h-7 w-7 rounded-full", isMobile && "hidden")}
            >
              <PanelLeft className={cn(
                'h-4 w-4 transition-transform',
                isCollapsed && 'rotate-180'
              )} />
              <span className="sr-only">Toggle sidebar</span>
            </Button>
          </div>
          <TooltipProvider delayDuration={0}>
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                const button = (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleTabChange(tab.id)}
                    className={cn(
                      'w-full flex items-center text-sm font-medium rounded-md transition-colors cursor-pointer',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      isCollapsed 
                        ? 'justify-center px-2 h-10' 
                        : 'gap-3 px-3 py-2'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className={cn(
                      'transition-all',
                      isCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
                    )}>
                      {tab.label}
                    </span>
                  </button>
                )

                if (isCollapsed) {
                  return (
                    <Tooltip key={tab.id}>
                      <TooltipTrigger asChild>
                        {button}
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p>{tab.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  )
                }

                return button
              })}
            </nav>
          </TooltipProvider>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {activeTab === 'personal' && (
              <motion.div
                key="personal"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <PersonalDetails />
              </motion.div>
            )}
            {activeTab === 'password' && (
              <motion.div
                key="password"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <PasswordAndSecurity />
              </motion.div>
            )}
            {activeTab === 'permissions' && (
              <motion.div
                key="permissions"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <Permissions />
              </motion.div>
            )}
            {activeTab === 'preferences' && (
              <motion.div
                key="preferences"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <Preferences />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

export default function AccountPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <AccountPageContent />
    </Suspense>
  )
}

