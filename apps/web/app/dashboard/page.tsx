"use client";

import { useRequireAuth } from "@/hooks/useRequireAuth";
import { logout } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { LogOut, Plus, Briefcase, Zap, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function DashboardPage() {
  const { user, loading } = useRequireAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A14] flex items-center justify-center">
        <div className="size-8 rounded-full border-2 border-[#E94560] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const displayName = user.displayName || user.email?.split("@")[0] || "Founder";

  return (
    <div className="min-h-screen bg-[#0A0A14]">
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#E94560]/6 rounded-full blur-[120px]" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0A0A14]/80 backdrop-blur-sm sticky top-0">
        <span className="text-base font-bold tracking-tight">
          <span className="text-white">Ghost</span>
          <span className="text-[#E94560]">Employee</span>
        </span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {user.photoURL ? (
              <img src={user.photoURL} alt={displayName} className="size-8 rounded-full object-cover border border-white/10" />
            ) : (
              <div className="size-8 rounded-full bg-[#E94560]/20 border border-[#E94560]/30 flex items-center justify-center">
                <span className="text-xs font-bold text-[#E94560]">{displayName[0].toUpperCase()}</span>
              </div>
            )}
            <span className="text-sm text-slate-300 hidden sm:block">{displayName}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Good to have you, {displayName.split(" ")[0]}.</h1>
          <p className="mt-2 text-slate-400">Your AI workforce is ready. Create a project to get started.</p>
        </div>

        {/* Plan banner */}
        <div className="mb-8 flex items-center justify-between bg-gradient-to-r from-[#E94560]/10 to-indigo-900/20 border border-white/10 rounded-2xl px-6 py-4">
          <div>
            <p className="text-sm font-semibold text-white">Choose your plan to get started</p>
            <p className="text-xs text-slate-400 mt-0.5">Basic (automations) or Advanced (full AI team) — both free during early access.</p>
          </div>
          <a href="/plans" className="shrink-0 flex items-center gap-1.5 text-sm font-medium text-[#E94560] hover:text-white transition-colors">
            Select plan <ChevronRight className="size-4" />
          </a>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          {[
            { label: "Projects", value: "0", limit: "3 free" },
            { label: "Employees hired", value: "0", limit: "3 free" },
            { label: "Reports generated", value: "0", limit: "—" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
              <p className="text-3xl font-bold text-white">{stat.value}</p>
              <p className="text-sm text-slate-400 mt-1">{stat.label}</p>
              <p className="text-xs text-slate-600 mt-0.5">{stat.limit}</p>
            </div>
          ))}
        </div>

        {/* Projects */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Briefcase className="size-4 text-slate-400" /> Projects
            </h2>
            <Button size="sm" disabled>
              <Plus className="size-4" /> New project
            </Button>
          </div>
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="size-14 rounded-2xl bg-[#E94560]/10 border border-[#E94560]/20 flex items-center justify-center mb-5">
              <Zap className="size-6 text-[#E94560]" />
            </div>
            <h3 className="text-base font-semibold text-white mb-2">No projects yet</h3>
            <p className="text-sm text-slate-400 max-w-xs leading-relaxed">
              A project is where you assign goals to your AI employees and run board meetings.
            </p>
            <p className="mt-6 text-xs text-slate-500 bg-white/5 border border-white/10 rounded-lg px-4 py-2">
              Project creation coming in Phase 1 — auth is live ✓
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}