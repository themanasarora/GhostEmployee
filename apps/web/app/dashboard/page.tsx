"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { logout } from "@/lib/auth";
import { getProjects, createProject, Project } from "@/lib/store";
import { LogOut, Plus, Briefcase, Zap, X, ChevronRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function DashboardPage() {
  const { user, loading } = useRequireAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (user) setProjects(getProjects(user.uid));
  }, [user]);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setCreating(true);
    const project = createProject(user.uid, name.trim(), description.trim());
    setCreating(false);
    setShowModal(false);
    setName("");
    setDescription("");
    // After creating, go to plan selection for this project
    router.push(`/project/${project.id}/plan`);
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

      {/* Nav */}
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
        {/* Welcome */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white">
            Welcome, {displayName.split(" ")[0]}.
          </h1>
          <p className="mt-2 text-slate-400">
            Create a project and hire your AI team to get started.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          {[
            { label: "Projects", value: projects.length },
            { label: "Employees hired", value: projects.reduce((a, p) => a + p.hiredRoles.length, 0) },
            { label: "Goals set", value: projects.reduce((a, p) => a + p.goals.length, 0) },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/[0.03] border border-white/10 rounded-xl p-5">
              <p className="text-3xl font-bold text-white">{stat.value}</p>
              <p className="text-sm text-slate-400 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Projects list */}
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Briefcase className="size-4 text-slate-400" /> Projects
            </h2>
            <Button size="sm" onClick={() => setShowModal(true)}>
              <Plus className="size-4" /> New project
            </Button>
          </div>

          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <div className="size-14 rounded-2xl bg-[#E94560]/10 border border-[#E94560]/20 flex items-center justify-center mb-5">
                <Zap className="size-6 text-[#E94560]" />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">No projects yet</h3>
              <p className="text-sm text-slate-400 max-w-xs leading-relaxed mb-6">
                Create a project to hire your AI team and start assigning goals.
              </p>
              <Button onClick={() => setShowModal(true)}>
                <Plus className="size-4" /> Create first project
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => router.push(`/project/${project.id}`)}
                  className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] cursor-pointer transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-semibold text-white truncate">{project.name}</p>
                      {project.plan ? (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          project.plan === "advanced"
                            ? "bg-[#E94560]/15 text-[#E94560]"
                            : "bg-indigo-500/15 text-indigo-400"
                        }`}>
                          {project.plan}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400">
                          setup needed
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-xs text-slate-500">{project.hiredRoles.length} employees</span>
                      <span className="text-xs text-slate-500">{project.goals.length} goals</span>
                      <span className="text-xs text-slate-600 flex items-center gap-1">
                        <Clock className="size-3" />
                        {new Date(project.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* New project modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative z-10 w-full max-w-md bg-[#0F0F1A] border border-white/15 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">New project</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white transition-colors">
                <X className="size-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <Input
                label="Project name"
                placeholder="e.g. AI Resume Optimizer"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-300">Description (optional)</label>
                <textarea
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E94560] focus:border-transparent transition-colors resize-none"
                  placeholder="What are you building or validating?"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <p className="text-xs text-slate-500">
                After creating, you'll choose a plan and hire your team.
              </p>
              <div className="flex gap-3 pt-2">
                <Button variant="ghost" fullWidth type="button" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button fullWidth type="submit" loading={creating} disabled={!name.trim()}>
                  Create & set up team
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
