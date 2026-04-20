/**
 * Studio Header Component
 */

"use client";

import { PenTool } from "lucide-react";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function StudioHeader({ className }: { className?: string }) {
  const { state } = useSidebar();

  return (
    <>
      <div
        className={cn(
          "group/studio-header flex h-12 flex-col justify-center",
          className,
        )}
      >
        {state === "collapsed" ? (
          <div className="group-has-data-[collapsible=icon]/sidebar-wrapper:-translate-y flex w-full cursor-pointer items-center justify-center">
            <div className="text-primary block pt-1 font-serif group-hover/studio-header:hidden">
              AS
            </div>
            <SidebarTrigger className="hidden pl-2 group-hover/studio-header:block" />
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <PenTool className="text-primary h-4 w-4" />
              <span className="text-primary font-serif">Article Studio</span>
            </div>
            <SidebarTrigger />
          </div>
        )}
      </div>      
    </>
  );
}
