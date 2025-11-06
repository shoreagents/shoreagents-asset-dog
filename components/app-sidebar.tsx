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
} from "lucide-react"
import { useEffect, useState } from "react"

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
} from "@/components/ui/sidebar"
import { ScrollArea } from "@/components/ui/scroll-area"

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
          title: "Analytics",
          url: "/dashboard/analytics",
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
      title: "Advanced Settings",
      url: "/settings",
      icon: Settings,
      items: [
        {
          title: "Users",
          url: "/settings/users",
        },
        {
          title: "Categories",
          url: "/settings/categories",
        },
      ],
    },
  ],
  projects: [],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [user, setUser] = useState<{
    name: string
    email: string
    avatar: string
    role: string | null
  } | null>(null)

  useEffect(() => {
    // Fetch current user
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me')
        if (response.ok) {
          const data = await response.json()
          if (data.user) {
            setUser({
              name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'User',
              email: data.user.email || '',
              avatar: data.user.user_metadata?.avatar_url || '',
              role: data.role || null,
            })
          }
        }
      } catch (error) {
        console.error('Failed to fetch user:', error)
      }
    }

    fetchUser()
  }, [])

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
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <ScrollArea className="h-full">
        <NavMain items={data.navMain} />
        {data.projects.length > 0 && <NavProjects projects={data.projects} />}
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter>
        {user && <NavUser user={user} />}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}


