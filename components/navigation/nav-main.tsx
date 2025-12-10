"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, type LucideIcon } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
    isActive?: boolean
    items?: {
      title: string
      url: string
      icon?: LucideIcon
    }[]
  }[]
}) {
  const pathname = usePathname()

  // Check if current path matches any sub-item or the parent item URL
  const isItemActive = (item: {
    url: string
    items?: { url: string }[]
  }) => {
    if (!pathname) return false
    // Check if current path matches the parent URL
    if (pathname === item.url) return true
    // Check if current path matches any sub-item URL
    if (item.items) {
      return item.items.some(subItem => pathname === subItem.url || pathname.startsWith(subItem.url + '/'))
    }
    return false
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          // If no sub-items, render as simple link
          if (!item.items || item.items.length === 0) {
            return (
              <SidebarMenuItem key={item.title} suppressHydrationWarning>
                <SidebarMenuButton tooltip={item.title} asChild isActive={pathname === item.url} suppressHydrationWarning>
                  <Link href={item.url}>
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          }

          // If has sub-items, render as collapsible
          return (
          <Collapsible
            key={item.title}
            asChild
            defaultOpen={item.isActive || isItemActive(item)}
            className="group/collapsible"
          >
            <SidebarMenuItem suppressHydrationWarning>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip={item.title} suppressHydrationWarning>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                  <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent suppressHydrationWarning>
                <SidebarMenuSub>
                    {item.items.map((subItem) => {
                      // Check if this submenu item is active
                      // First check exact match
                      if (pathname === subItem.url) {
                        return (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton asChild isActive={true}>
                              <Link href={subItem.url}>
                                {subItem.icon && <subItem.icon />}
                                <span>{subItem.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )
                      }
                      
                      // Check if pathname starts with this subItem.url + '/'
                      // But only if there's no more specific submenu item that matches
                      const pathStartsWithSubItem = pathname.startsWith(subItem.url + '/')
                      if (pathStartsWithSubItem) {
                        // Check if there's a more specific submenu item that also matches
                        // item.items is guaranteed to exist here since we're inside the map
                        const hasMoreSpecificMatch = item.items!.some(otherSubItem => 
                          otherSubItem.url !== subItem.url && 
                          otherSubItem.url.startsWith(subItem.url + '/') &&
                          pathname.startsWith(otherSubItem.url)
                        )
                        
                        // Only highlight if there's no more specific match
                        const isSubItemActive = !hasMoreSpecificMatch
                        
                        return (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton asChild isActive={isSubItemActive}>
                              <Link href={subItem.url}>
                                {subItem.icon && <subItem.icon />}
                                <span>{subItem.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )
                      }
                      
                      // Not active
                      return (
                    <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton asChild isActive={false}>
                        <Link href={subItem.url}>
                              {subItem.icon && <subItem.icon />}
                          <span>{subItem.title}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                      )
                    })}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
