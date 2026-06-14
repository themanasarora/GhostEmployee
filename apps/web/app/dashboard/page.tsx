"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getProjects, createProject, Project, updateProject } from "@/lib/store";
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
  const [step, setStep] = useState(1); // 1 = details, 2 = plan selection
  const [selectedPlan, setSelectedPlan] = useState<"basic" | "advanced">("basic");

  useEffect(() => {
    if (user) setProjects(getProjects(user.uid));
  }, [user]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name.trim() || !description.trim()) return;

    if (step === 1) {
      setStep(2);
      return;
    }

    setCreating(true);
    const project = createProject(user.uid, name.trim(), description.trim());
    if (selectedPlan === "basic") {
      updateProject(user.uid, project.id, {
        plan: "basic",
        hiredRoles: ["ceo"],
      });
      setCreating(false);
      setShowModal(false);
      setName("");
      setDescription("");
      setStep(1);
      router.push(`/project/${project.id}`);
    } else {
      updateProject(user.uid, project.id, {
        plan: "advanced",
        hiredRoles: ["ceo", "pm", "research", "growth"],
      });
      setCreating(false);
      setShowModal(false);
      setName("");
      setDescription("");
      setStep(1);
      router.push(`/project/${project.id}/hire`);
    }
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
              <p className="text-xs text-slate-400 max-w-xs mb-5">Create a project, hire your AI team, and they'll kick off a board meeting automatically.</p>
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
                      {project.plan === "basic" ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-indigo-500/15 text-indigo-400">
                          basic
                        </span>
                      ) : project.plan === "advanced" ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-[#E94560]/15 text-[#E94560]">
                          advanced
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
              <div>
                <h2 className="text-base font-bold text-white">
                  {step === 1 ? "New project" : "Choose your plan"}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {step === 1 
                    ? "Your AI team will read this to understand the project."
                    : "Select a plan tailored for your project's scale."}
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white"><X className="size-4" /></button>
            </div>
            {step === 1 ? (
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
                  <label className="text-sm font-medium text-slate-300">
                    Description <span className="text-[#E94560]">*</span>
                  </label>
                  <textarea
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E94560] focus:border-transparent transition-colors resize-none"
                    placeholder="What are you building? Who is it for? What problem does it solve? The more context, the better your team performs."
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                  <p className="text-xs text-slate-500">Required — agents use this as their primary project context.</p>
                </div>
                <div className="flex gap-3 pt-1">
                  <Button variant="ghost" fullWidth type="button" onClick={() => setShowModal(false)}>Cancel</Button>
                  <Button fullWidth type="submit" disabled={!name.trim() || !description.trim()}>
                    Next: Choose plan →
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  {/* Basic Plan Card */}
                  <div
                    onClick={() => setSelectedPlan("basic")}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedPlan === "basic"
                        ? "border-indigo-500/60 bg-indigo-500/10 text-white"
                        : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-white flex items-center gap-1.5">
                        <Zap className="size-4 text-indigo-400" /> Basic Plan
                      </span>
                      {selectedPlan === "basic" && (
                        <div className="size-4 rounded-full bg-indigo-500 flex items-center justify-center">
                          <div className="size-2 rounded-full bg-white" />
                        </div>
                      )}
                    </div>
                    <ul className="text-xs space-y-1 text-slate-300">
                      <li>• 1 Agent (CEO Ghost) only</li>
                      <li>• 4 Core Integrations (Gmail, Slack, Calendar, ATS)</li>
                      <li>• Single-agent dashboard and CEO Bulletin</li>
                    </ul>
                  </div>

                  {/* Advanced Plan Card */}
                  <div
                    onClick={() => setSelectedPlan("advanced")}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedPlan === "advanced"
                        ? "border-[#E94560]/60 bg-[#E94560]/10 text-white"
                        : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-white flex items-center gap-1.5">
                        <Zap className="size-4 text-[#E94560]" /> Advanced Plan
                      </span>
                      {selectedPlan === "advanced" && (
                        <div className="size-4 rounded-full bg-[#E94560] flex items-center justify-center">
                          <div className="size-2 rounded-full bg-white" />
                        </div>
                      )}
                    </div>
                    <ul className="text-xs space-y-1 text-slate-300">
                      <li>• Full AI Team (CTO, PM, Growth, Recruiter, etc.)</li>
                      <li>• All integrations & tools (Research, Browser, etc.)</li>
                      <li>• Multi-agent boardroom collaboration & meetings</li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="ghost" fullWidth onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button fullWidth onClick={handleCreate} loading={creating}>
                    Confirm & Create
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
