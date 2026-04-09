/**
 * Studio Layout
 */

"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { StudioHeader, StudioNav } from "@/components/workspace/studio";

export default function StudioLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex h-full w-full">
      <Sidebar variant="sidebar" collapsible="icon">
        <SidebarHeader className="py-0">
          <StudioHeader />
        </SidebarHeader>
        <SidebarContent>
          <StudioNav />
        </SidebarContent>
        <SidebarRail />
      </Sidebar>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
