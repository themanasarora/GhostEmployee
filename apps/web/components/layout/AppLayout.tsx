"use client";

import { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
  projectId?: string;
  className?: string;
}

export function AppLayout({ children, projectId, className }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-[#0A0A14]">
      <Sidebar projectId={projectId} />
      <main className={cn("lg:pl-56 min-h-screen", className)}>
        <div className="relative z-10">{children}</div>
      </main>
    </div>
  );
}