"use client";

import { AgentChat } from "@/components/agent-chat";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
} from "@/components/ui/sidebar";

export function AgentSidebar() {
  return (
    <Sidebar side="right" collapsible="offcanvas">
      <SidebarHeader>
        <div className="px-2 py-1.5 text-sm font-semibold">
          Ship It Shop Agent
        </div>
      </SidebarHeader>
      <SidebarContent className="overflow-hidden p-0">
        <AgentChat />
      </SidebarContent>
    </Sidebar>
  );
}
