"use client"

import { usePathname } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

export function AppLayout({ 
  children,
}: { 
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isLoginPage = pathname?.startsWith('/login')
  const isSignupPage = pathname?.startsWith('/signup')

  // Don't show sidebar on login or signup pages
  if (isLoginPage || isSignupPage) {
    return <>{children}</>
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <AppHeader />
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0 md:p-6 min-w-0 overflow-x-auto">
          <div className="min-w-0 w-full max-w-full">
          {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

