"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getProjects, Project } from "@/lib/store";
import { logout } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Zap, MessageSquare, Activity,
  Settings, User, ChevronDown, LogOut, Menu, X, Plus, FolderOpen,
} from "lucide-react";

interface SidebarProps {
  projectId?: string;
}

export function Sidebar({ projectId }: SidebarProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (user) setProjects(getProjects(user.uid));
  }, [user, pathname]);

  const displayName = user?.displayName || user?.email?.split("@")[0] || "Founder";
  const initials = displayName.slice(0, 2).toUpperCase();

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  function isActive(path: string) {
    return pathname === path || pathname.startsWith(path + "/");
  }

  const mainNav = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    {
      label: "Board Rooms",
      icon: Zap,
      href: projectId ? `/project/${projectId}` : "/dashboard",
      sub: "Goals & meetings",
    },
    {
      label: "Agent Chats",
      icon: MessageSquare,
      href: projectId ? `/project/${projectId}/chats` : "/dashboard",
      sub: "1-on-1 with employees",
    },
    {
      label: "Task Log",
      icon: Activity,
      href: projectId ? `/project/${projectId}/tasks` : "/dashboard",
      sub: "Automation history",
    },
  ];

  const SidebarInner = () => (
    <div className="flex flex-col h-full select-none">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 pt-5 pb-4">
        <Link href="/dashboard" className="flex items-center gap-2.5" onClick={() => setMobileOpen(false)}>
          <div className="size-7 rounded-lg bg-[#E94560] flex items-center justify-center shrink-0">
            <Zap className="size-3.5 text-white" />
          </div>
          <span className="text-[15px] font-bold tracking-tight">
            <span className="text-white">Ghost</span>
            <span className="text-[#E94560]">Employee</span>
          </span>
        </Link>
        <button onClick={() => setMobileOpen(false)} className="lg:hidden text-slate-500 hover:text-white">
          <X className="size-4" />
        </button>
      </div>

      {/* Main nav */}
      <nav className="px-2 space-y-0.5">
        {mainNav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 group",
                active ? "bg-[#E94560]/10 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon className={cn("size-4 shrink-0", active ? "text-[#E94560]" : "text-slate-500 group-hover:text-slate-300")} />
              <span className="text-[13px] font-medium">{item.label}</span>
              {active && <div className="ml-auto size-1.5 rounded-full bg-[#E94560]" />}
            </Link>
          );
        })}
      </nav>

      <div className="mx-4 my-3 h-px bg-white/[0.06]" />

      {/* Projects */}
      <div className="px-2 flex-1 overflow-y-auto min-h-0">
        <button
          onClick={() => setProjectsExpanded((p) => !p)}
          className="w-full flex items-center justify-between px-3 py-1.5 mb-1 group"
        >
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Projects</span>
          <div className="flex items-center gap-1.5">
            <span
              onClick={(e) => { e.stopPropagation(); router.push("/dashboard"); setMobileOpen(false); }}
              className="text-slate-600 hover:text-[#E94560] transition-colors cursor-pointer"
            >
              <Plus className="size-3" />
            </span>
            <ChevronDown className={cn("size-3 text-slate-600 transition-transform", !projectsExpanded && "-rotate-90")} />
          </div>
        </button>

        {projectsExpanded && (
          <div className="space-y-0.5">
            {projects.length === 0 ? (
              <div className="px-3 py-2 text-center">
                <p className="text-[11px] text-slate-600">No projects yet</p>
                <button onClick={() => { router.push("/dashboard"); setMobileOpen(false); }} className="text-[11px] text-[#E94560] hover:underline">Create one</button>
              </div>
            ) : (
              projects.slice(0, 10).map((project) => {
                const active = pathname.startsWith(`/project/${project.id}`);
                return (
                  <Link
                    key={project.id}
                    href={`/project/${project.id}`}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] transition-all group",
                      active ? "bg-white/[0.06] text-white" : "text-slate-500 hover:text-slate-200 hover:bg-white/[0.03]"
                    )}
                  >
                    <FolderOpen className={cn("size-3.5 shrink-0", active ? "text-[#E94560]" : "text-slate-600")} />
                    <span className="truncate flex-1 font-medium">{project.name}</span>
                    {project.plan && (
                      <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0",
                        project.plan === "advanced" ? "bg-[#E94560]/15 text-[#E94560]" : "bg-indigo-500/15 text-indigo-400"
                      )}>
                        {project.plan === "advanced" ? "ADV" : "BSC"}
                      </span>
                    )}
                  </Link>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Bottom */}
      <div className="mt-auto border-t border-white/[0.06] px-2 py-3 space-y-0.5">
        {[
          { label: "Profile", icon: User, href: "/profile" },
          { label: "Settings", icon: Settings, href: "/settings" },
        ].map((item) => (
          <Link key={item.label} href={item.href} onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-slate-500 hover:text-white hover:bg-white/5 transition-all group">
            <item.icon className="size-4 shrink-0 text-slate-600 group-hover:text-slate-300" />
            <span className="font-medium">{item.label}</span>
          </Link>
        ))}

        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group cursor-default mt-1">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" className="size-7 rounded-full border border-white/10 shrink-0 object-cover" />
          ) : (
            <div className="size-7 rounded-full bg-gradient-to-br from-[#E94560] to-[#c23350] flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-white">{initials}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-slate-300 truncate leading-none">{displayName}</p>
            <p className="text-[10px] text-slate-600 truncate mt-0.5 leading-none">{user?.email}</p>
          </div>
          <button onClick={handleLogout} title="Sign out"
            className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
            <LogOut className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-[#0F0F1A] border border-white/10 text-slate-400 hover:text-white">
        <Menu className="size-4" />
      </button>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={cn(
        "lg:hidden fixed left-0 top-0 bottom-0 z-50 w-56 bg-[#0B0B15] border-r border-white/[0.06] transition-transform duration-200",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <SidebarInner />
      </aside>

      <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 z-30 w-56 bg-[#0B0B15] border-r border-white/[0.06]">
        <SidebarInner />
      </aside>
    </>
  );
}