"use client"

import * as React from "react"
import {
  Boxes,
  Dog,
  LayoutDashboard,
  Users,
  List,
  Settings,
  Wrench,
  FileText,
  ClipboardList,
  Cog,
} from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import Image from "next/image"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useSidebar } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronsUpDown } from "lucide-react"

// Asset Dog sidebar navigation data
const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
      isActive: true,
      items: [
        {
          title: "Overview",
          url: "/dashboard",
        },
        {
          title: "Recent Activity",
          url: "/dashboard/activity",
        },
      ],
    },
    {
      title: "Assets",
      url: "/assets",
      icon: Boxes,
      items: [
        {
          title: "All Assets",
          url: "/assets",
        },
        {
          title: "Add Asset",
          url: "/assets/add",
        },
        {
          title: "Check Out",
          url: "/assets/checkout",
        },
        {
          title: "Check In",
          url: "/assets/checkin",
        },
        {
          title: "Move Asset",
          url: "/assets/move",
        },
        {
          title: "Reserve Asset",
          url: "/assets/reserve",
        },
        {
          title: "Lease Asset",
          url: "/assets/lease",
        },
        {
          title: "Lease Return",
          url: "/assets/lease-return",
        },
        {
          title: "Dispose Asset",
          url: "/assets/dispose",
        },
        {
          title: "Maintenance",
          url: "/assets/maintenance",
        },
      ],
    },
    {
      title: "Employee's",
      url: "/employees",
      icon: Users,
      items: [
        {
          title: "Users",
          url: "/employees",
        },
      ],
    },
    {
      title: "Lists",
      url: "/lists",
      icon: List,
      items: [
        {
          title: "Assets",
          url: "/lists/assets",
        },
        {
          title: "Maintenances",
          url: "/lists/maintenances",
        },
        {
          title: "Warranties",
          url: "/lists/warranties",
        },
      ],
    },
    {
      title: "Tools",
      url: "/tools",
      icon: Wrench,
      items: [
        {
          title: "Media",
          url: "/tools/media",
        },
        {
          title: "Audit",
          url: "/tools/audit",
        },
        {
          title: "Import",
          url: "/tools/import",
        },
        {
          title: "Export",
          url: "/tools/export",
        },
        {
          title: "Trash",
          url: "/tools/trash",
        },
      ],
    },
    {
      title: "Forms",
      url: "/forms",
      icon: ClipboardList,
      items: [
        {
          title: "Return Forms",
          url: "/forms/return-form",
        },
        {
          title: "Accountability Form",
          url: "/forms/accountability-form",
        },
        {
          title: "History",
          url: "/forms/history",
        },
      ],
    },
    {
      title: "Reports",
      url: "/reports",
      icon: FileText,
      items: [
        {
          title: "Asset Reports",
          url: "/reports/assets",
        },
      ],
    },
    {
      title: "Setup",
      url: "/setup",
      icon: Cog,
      items: [
        {
          title: "Categories",
          url: "/setup/categories",
        },
        {
          title: "Locations",
          url: "/setup/locations",
        },
        {
          title: "Sites",
          url: "/setup/sites",
        },
        {
          title: "Departments",
          url: "/setup/departments",
        },
        {
          title: "Company Info",
          url: "/setup/company-info",
        },
      ],
    },
    {
      title: "Advanced Settings",
      url: "/settings",
      icon: Settings,
      items: [
        {
          title: "Account Details",
          url: "/account",
        },
        {
          title: "Users",
          url: "/settings/users",
        },
      ],
    },
  ],
  projects: [],
}

async function fetchCompanyInfo(): Promise<{ companyInfo: { primaryLogoUrl: string | null } | null }> {
  try {
    const response = await fetch('/api/setup/company-info')
    if (!response.ok) {
      return { companyInfo: null }
    }
    return response.json()
  } catch {
    return { companyInfo: null }
  }
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [mounted, setMounted] = React.useState(false)

  // Use React Query to fetch user data so it updates when cache is invalidated
  const { data: userData, isPending, fetchStatus } = useQuery({
    queryKey: ['sidebar-user'],
    queryFn: async () => {
        const response = await fetch('/api/auth/me')
      if (!response.ok) {
        throw new Error('Failed to fetch user')
      }
          const data = await response.json()
      return {
        name: data.user?.name || data.user?.user_metadata?.name || '',
        email: data.user?.email || '',
        avatar: data.user?.user_metadata?.avatar_url || '',
              role: data.role || null,
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: false,
    refetchOnMount: true, // Always refetch to show loading state
  })

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch company info for logo
  const { data: companyData } = useQuery({
    queryKey: ['company-info'],
    queryFn: fetchCompanyInfo,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  })

  const user = userData || null
  const primaryLogoUrl = companyData?.companyInfo?.primaryLogoUrl || null
  const { state, isMobile } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
              <Dog className="size-4" />
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">Asset Dog</span>
              <span className="truncate text-xs">
                {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Premium'}
              </span>
            </div>
          </SidebarMenuButton>
          {primaryLogoUrl && !isCollapsed && !isMobile && (
            <div className="mt-2 w-full">
              <div className="relative w-full h-16 overflow-hidden">
                <Image
                  src={primaryLogoUrl}
                  alt="Company Logo"
                  fill
                  className="object-contain p-2"
                  unoptimized
                  priority
                />
              </div>
            </div>
          )}
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <ScrollArea className="h-full">
        <NavMain items={data.navMain} />
        {data.projects.length > 0 && <NavProjects projects={data.projects} />}
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter>
        {!mounted ? null : (!userData || fetchStatus === 'fetching' || isPending) ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" disabled>
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="grid flex-1 text-left text-sm leading-tight gap-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <ChevronsUpDown className="ml-auto size-4 opacity-50" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : user ? (
          <NavUser user={user} />
        ) : null}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}


