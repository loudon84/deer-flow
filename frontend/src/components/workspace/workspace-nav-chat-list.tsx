"use client";

import {
  BotIcon,
  ChevronRight,
  FileText,
  Layers,
  ListTodo,
  MessagesSquare,
  PenTool,
  Send,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { useI18n } from "@/core/i18n/hooks";
import { cn } from "@/lib/utils";

export function WorkspaceNavChatList() {
  const { t } = useI18n();
  const pathname = usePathname();
  const [studioExpanded, setStudioExpanded] = useState(
    pathname.startsWith("/workspace/studio")
  );

  const studioNavItems = [
    {
      icon: Layers,
      label: "Templates",
      href: "/workspace/studio/templates",
      isActive: pathname.startsWith("/workspace/studio/templates"),
    },
    {
      icon: FileText,
      label: "Documents",
      href: "/workspace/studio/documents",
      isActive: pathname.startsWith("/workspace/studio/documents"),
    },
    {
      icon: ListTodo,
      label: "Jobs",
      href: "/workspace/studio/jobs",
      isActive: pathname.startsWith("/workspace/studio/jobs"),
    },
    {
      icon: Send,
      label: "Publishing",
      href: "/workspace/studio/publishing",
      isActive: pathname.startsWith("/workspace/studio/publishing"),
    },
  ];

  return (
    <SidebarGroup className="pt-1">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton isActive={pathname === "/workspace/chats"} asChild>
            <Link className="text-muted-foreground" href="/workspace/chats">
              <MessagesSquare />
              <span>{t.sidebar.chats}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            isActive={pathname.startsWith("/workspace/agents")}
            asChild
          >
            <Link className="text-muted-foreground" href="/workspace/agents">
              <BotIcon />
              <span>{t.sidebar.agents}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            isActive={pathname.startsWith("/workspace/studio")}
            onClick={() => setStudioExpanded(!studioExpanded)}
            className="text-muted-foreground"
          >
            <PenTool />
            <span>Studio</span>
            <ChevronRight
              className={cn(
                "ml-auto h-4 w-4 transition-transform",
                studioExpanded && "rotate-90"
              )}
            />
          </SidebarMenuButton>
          {studioExpanded && (
            <SidebarMenuSub>
              {studioNavItems.map((item) => (
                <SidebarMenuSubItem key={item.href}>
                  <SidebarMenuSubButton isActive={item.isActive} asChild>
                    <Link className="text-muted-foreground" href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          )}
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}
