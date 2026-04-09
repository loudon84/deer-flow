/**
 * Studio Navigation Component
 */

"use client";

import { FileText, Layers, ListTodo, PenTool } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function StudioNav() {
  const pathname = usePathname();

  const navItems = [
    {
      icon: Layers,
      label: "Templates",
      href: "/workspace/studio/templates",
      isActive: pathname.startsWith("/workspace/studio/templates"),
    },
    {
      icon: PenTool,
      label: "Create",
      href: "/workspace/studio/create",
      isActive: pathname === "/workspace/studio/create",
    },
    {
      icon: ListTodo,
      label: "Jobs",
      href: "/workspace/studio/jobs",
      isActive: pathname.startsWith("/workspace/studio/jobs"),
    },
    {
      icon: FileText,
      label: "Documents",
      href: "/workspace/studio/documents",
      isActive: pathname.startsWith("/workspace/studio/documents"),
    },
  ];

  return (
    <SidebarGroup className="pt-1">
      <SidebarMenu>
        {navItems.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton isActive={item.isActive} asChild>
              <Link className="text-muted-foreground" href={item.href}>
                <item.icon />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
