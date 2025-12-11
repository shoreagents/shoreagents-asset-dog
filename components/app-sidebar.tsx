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
  UserCircle,
  History,
  Tags,
  MapPin,
  Building2,
  Briefcase,
  Building,
  ArrowLeftRight,
  FileCheck,
  TrendingDown,
  Map,
  ShieldCheck,
  Calendar,
  Receipt,
  Zap,
  ScrollText,
  Film,
  Download,
  Upload,
  Trash2,
  Plus,
  ArrowRight,
  ArrowLeft,
  Move,
  Bookmark,
  Undo,
  Package,
} from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import Image from "next/image"
import { useUserProfile } from "@/hooks/use-user-profile"

import { NavMain } from "@/components/navigation/nav-main"
import { NavProjects } from "@/components/navigation/nav-projects"
import { NavUser } from "@/components/navigation/nav-user"
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
    },
    {
      title: "Assets",
      url: "/assets",
      icon: Boxes,
      items: [
        {
          title: "All Assets",
          url: "/assets",
          icon: Boxes,
        },
        {
          title: "Add Asset",
          url: "/assets/add",
          icon: Plus,
        },
        {
          title: "Check Out",
          url: "/assets/checkout",
          icon: ArrowRight,
        },
        {
          title: "Check In",
          url: "/assets/checkin",
          icon: ArrowLeft,
        },
        {
          title: "Move Asset",
          url: "/assets/move",
          icon: Move,
        },
        {
          title: "Reserve Asset",
          url: "/assets/reserve",
          icon: Bookmark,
        },
        {
          title: "Lease Asset",
          url: "/assets/lease",
          icon: ScrollText,
        },
        {
          title: "Lease Return",
          url: "/assets/lease-return",
          icon: Undo,
        },
        {
          title: "Dispose Asset",
          url: "/assets/dispose",
          icon: Trash2,
        },
        {
          title: "Maintenance",
          url: "/assets/maintenance",
          icon: Wrench,
        },
      ],
    },
    {
      title: "Inventory",
      url: "/inventory",
      icon: Package,
      isActive: true,
    },
    {
      title: "Employee's",
      url: "/employees",
      icon: Users,
      items: [
        {
          title: "Users",
          url: "/employees",
          icon: Users,
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
          icon: Boxes,
        },
        {
          title: "Maintenances",
          url: "/lists/maintenances",
          icon: Wrench,
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
          icon: Film,
        },
        {
          title: "Audit",
          url: "/tools/audit",
          icon: ShieldCheck,
        },
        {
          title: "Import",
          url: "/tools/import",
          icon: Download,
        },
        {
          title: "Export",
          url: "/tools/export",
          icon: Upload,
        },
        {
          title: "Trash",
          url: "/tools/trash",
          icon: Trash2,
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
          icon: ArrowLeftRight,
        },
        {
          title: "Accountability Form",
          url: "/forms/accountability-form",
          icon: FileCheck,
        },
        {
          title: "History",
          url: "/forms/history",
          icon: History,
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
          icon: Boxes,
        },
        {
          title: "Checkout Reports",
          url: "/reports/checkout",
          icon: ArrowLeftRight,
        },
        {
          title: "Location Reports",
          url: "/reports/location",
          icon: Map,
        },
        {
          title: "Maintenance Reports",
          url: "/reports/maintenance",
          icon: Wrench,
        },
        {
          title: "Audit Reports",
          url: "/reports/audit",
          icon: ShieldCheck,
        },
        {
          title: "Depreciation Reports",
          url: "/reports/depreciation",
          icon: TrendingDown,
        },
        {
          title: "Leased Asset Reports",
          url: "/reports/lease",
          icon: ScrollText,
        },
        {
          title: "Reservation Reports",
          url: "/reports/reservation",
          icon: Calendar,
        },
        {
          title: "Transaction Reports",
          url: "/reports/transaction",
          icon: Receipt,
        },
        {
          title: "Automated Reports",
          url: "/reports/automated-reports",
          icon: Zap,
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
          icon: Tags,
        },
        {
          title: "Locations",
          url: "/setup/locations",
          icon: MapPin,
        },
        {
          title: "Sites",
          url: "/setup/sites",
          icon: Building2,
        },
        {
          title: "Departments",
          url: "/setup/departments",
          icon: Briefcase,
        },
        {
          title: "Company Info",
          url: "/setup/company-info",
          icon: Building,
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
          icon: UserCircle,
        },
        {
          title: "Asset Events",
          url: "/settings/asset-events",
          icon: History,
        },
        {
          title: "Users",
          url: "/settings/users",
          icon: Users,
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

  // Use unified layout-level user profile hook (shared cache across all components)
  const { profile, isLoading: isPending } = useUserProfile()

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

  const user = profile ? {
    name: profile?.name || '',
    email: profile?.email || '',
    avatar: profile?.avatar || '',
    role: profile?.role || 'user',
  } : null
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
            <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-full">
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
        {!mounted ? null : (!profile || isPending) ? (
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


