"use client";

import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getProject, createGoal, Project, getEmployeeDetails } from "@/lib/store";
import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { Plus, Zap, MessageSquare, Target, ChevronRight, X, Settings, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalText, setGoalText] = useState("");
  const [adding, setAdding] = useState(false);

  function refresh() {
    if (!user) return;
    const p = getProject(user.uid, id);
    if (!p) { router.replace("/dashboard"); return; }
    if (!p.plan) { router.replace(`/project/${id}/plan`); return; }
    setProject(p);
  }

  useEffect(() => { refresh(); }, [user, id]);

  async function handleAddGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !goalText.trim() || !project) return;
    setAdding(true);
    const goal = createGoal(user.uid, id, goalText.trim());
    setGoalText("");
    setAdding(false);
    setShowGoalModal(false);
    router.push(`/project/${id}/goal/${goal.id}`);
  }

  if (!project) return (
    <div className="min-h-screen bg-[#0A0A14] flex items-center justify-center">
      <div className="size-8 rounded-full border-2 border-[#E94560] border-t-transparent animate-spin" />
    </div>
  );

  const employeeDetails = project.hiredRoles.map(getEmployeeDetails);
  const totalBoardMessages = project.goals.reduce((a, g) => a + g.boardMessages.length, 0);

  return (
    <AppLayout projectId={id}>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-white">{project.name}</h1>
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
                project.plan === "advanced" ? "bg-[#E94560]/15 text-[#E94560]" : "bg-indigo-500/15 text-indigo-400"
              )}>{project.plan}</span>
            </div>
            {project.description && <p className="text-sm text-slate-400">{project.description}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={() => router.push(`/project/${id}/plan`)}>
            <Settings className="size-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            {/* Board Rooms */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Zap className="size-4 text-[#E94560]" /> Board Rooms
                  <span className="text-xs text-slate-500 font-normal">({project.goals.length})</span>
                </h2>
                <Button size="sm" onClick={() => setShowGoalModal(true)}>
                  <Plus className="size-4" /> New goal
                </Button>
              </div>
              {project.goals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                  <Zap className="size-8 text-slate-600 mb-3" />
                  <p className="text-sm text-slate-400 mb-4">No goals yet. Each goal gets its own persistent board room.</p>
                  <Button size="sm" onClick={() => setShowGoalModal(true)}><Plus className="size-4" /> Create first goal</Button>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {project.goals.map((goal) => (
                    <div key={goal.id} onClick={() => router.push(`/project/${id}/goal/${goal.id}`)}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] cursor-pointer transition-colors group">
                      <div className="size-8 rounded-lg bg-[#E94560]/10 border border-[#E94560]/20 flex items-center justify-center shrink-0">
                        <Zap className="size-3.5 text-[#E94560]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{goal.text}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-slate-500">{goal.boardMessages.length} messages</span>
                          <span className="text-xs text-slate-500">{goal.tasks.length} tasks</span>
                          <span className="text-xs text-slate-600 flex items-center gap-1">
                            <Clock className="size-3" />{new Date(goal.lastActiveAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="size-4 text-slate-600 group-hover:text-slate-400 shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Agent Chats */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <MessageSquare className="size-4 text-slate-400" /> Agent Chats
                </h2>
                <span className="text-xs text-slate-500">1-on-1 with any employee</span>
              </div>
              <div className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {employeeDetails.map((emp) => {
                  const chatCount = project.agentChats[emp.role]?.messages.length ?? 0;
                  return (
                    <button key={emp.role} onClick={() => router.push(`/project/${id}/chat/${emp.role}`)}
                      className="flex flex-col items-center text-center p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-[#E94560]/30 hover:bg-[#E94560]/5 transition-all">
                      <span className="text-xl mb-1">{emp.icon}</span>
                      <span className="text-xs font-medium text-white leading-tight">{emp.name.replace(" Ghost", "")}</span>
                      <span className={cn("text-[10px] mt-0.5", chatCount > 0 ? "text-[#E94560]" : "text-slate-600")}>
                        {chatCount > 0 ? `${chatCount} msgs` : "Start chat"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right col */}
          <div className="space-y-4">
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Activity</p>
              {[
                { label: "Board messages", value: totalBoardMessages },
                { label: "Goals active", value: project.goals.length },
                { label: "Tasks created", value: project.goals.reduce((a, g) => a + g.tasks.length, 0) },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">{s.label}</span>
                  <span className="text-xs font-semibold text-white">{s.value}</span>
                </div>
              ))}
            </div>

            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Team</p>
                {project.plan === "advanced" && (
                  <button onClick={() => router.push(`/project/${id}/hire`)} className="text-xs text-[#E94560] hover:underline">Edit</button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {employeeDetails.map((emp) => (
                  <button key={emp.role} onClick={() => router.push(`/project/${id}/chat/${emp.role}`)}
                    title={emp.name} className="text-xl hover:scale-110 transition-transform">
                    {emp.icon}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showGoalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowGoalModal(false)} />
          <div className="relative z-10 w-full max-w-md bg-[#0F0F1A] border border-white/15 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white">New goal</h2>
              <button onClick={() => setShowGoalModal(false)} className="text-slate-500 hover:text-white"><X className="size-4" /></button>
            </div>
            <form onSubmit={handleAddGoal} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-300">What should your team work on?</label>
                <textarea className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E94560] focus:border-transparent transition-colors resize-none"
                  placeholder='"Validate my AI resume optimizer startup idea"' rows={3}
                  value={goalText} onChange={(e) => setGoalText(e.target.value)} autoFocus required />
              </div>
              <p className="text-xs text-slate-500">Creates a persistent board room your team lives in.</p>
              <div className="flex gap-3">
                <Button variant="ghost" fullWidth type="button" onClick={() => setShowGoalModal(false)}>Cancel</Button>
                <Button fullWidth type="submit" loading={adding} disabled={!goalText.trim()}>Open board room</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}