"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getProjects, createProject, Project } from "@/lib/store";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Plus, FolderKanban, Zap, ChevronRight, Clock, X, MessageSquare, Target } from "lucide-react";

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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setCreating(true);
    const project = createProject(user.uid, name.trim(), description.trim());
    setCreating(false);
    setShowModal(false);
    setName(""); setDescription("");
    router.push(`/project/${project.id}/plan`);
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0A0A14] flex items-center justify-center">
      <div className="size-8 rounded-full border-2 border-[#E94560] border-t-transparent animate-spin" />
    </div>
  );
  if (!user) return null;

  const displayName = user.displayName || user.email?.split("@")[0] || "Founder";
  const totalGoals = projects.reduce((a, p) => a + p.goals.length, 0);
  const totalMessages = projects.reduce((a, p) => a + p.goals.reduce((b, g) => b + g.boardMessages.length, 0), 0);

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Welcome back, {displayName.split(" ")[0]}.</h1>
          <p className="text-sm text-slate-400 mt-1">Your AI workforce is standing by.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Projects", value: projects.length, icon: FolderKanban },
            { label: "Goals", value: totalGoals, icon: Target },
            { label: "Board messages", value: totalMessages, icon: MessageSquare },
            { label: "Employees active", value: projects.reduce((a, p) => a + p.hiredRoles.length, 0), icon: Zap },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className="size-4 text-slate-500" />
                <span className="text-xs text-slate-500">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white/[0.03] border border-white/10 rounded-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <FolderKanban className="size-4 text-slate-400" /> Projects
            </h2>
            <Button size="sm" onClick={() => setShowModal(true)}>
              <Plus className="size-4" /> New project
            </Button>
          </div>

          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="size-12 rounded-2xl bg-[#E94560]/10 border border-[#E94560]/20 flex items-center justify-center mb-4">
                <Zap className="size-5 text-[#E94560]" />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">No projects yet</h3>
              <p className="text-xs text-slate-400 max-w-xs mb-5">Create a project to hire your AI team, run board meetings, and chat with individual employees.</p>
              <Button size="sm" onClick={() => setShowModal(true)}>
                <Plus className="size-4" /> Create first project
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {projects.map((project) => (
                <div key={project.id} onClick={() => router.push(`/project/${project.id}`)}
                  className="flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] cursor-pointer transition-colors group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white truncate">{project.name}</span>
                      {project.plan ? (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${project.plan === "advanced" ? "bg-[#E94560]/15 text-[#E94560]" : "bg-indigo-500/15 text-indigo-400"}`}>
                          {project.plan}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 shrink-0">setup</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">{project.hiredRoles.length} employees</span>
                      <span className="text-xs text-slate-500">{project.goals.length} goals</span>
                      <span className="text-xs text-slate-600 flex items-center gap-1">
                        <Clock className="size-3" />{new Date(project.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-slate-600 group-hover:text-slate-400 shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative z-10 w-full max-w-md bg-[#0F0F1A] border border-white/15 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-white">New project</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white"><X className="size-4" /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <Input label="Project name" placeholder="e.g. AI Resume Optimizer" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-300">Description (optional)</label>
                <textarea className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E94560] focus:border-transparent transition-colors resize-none"
                  placeholder="What are you building or validating?" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <p className="text-xs text-slate-600">After creating, you'll pick a plan and hire your team.</p>
              <div className="flex gap-3 pt-1">
                <Button variant="ghost" fullWidth type="button" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button fullWidth type="submit" loading={creating} disabled={!name.trim()}>Create project</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}