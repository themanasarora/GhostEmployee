"use client";

import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getProject, updateProject, addGoal, Project, getEmployeeDetails } from "@/lib/store";
import { useState, useEffect } from "react";
import { ArrowLeft, Users, Target, Zap, Plus, X, ChevronRight, Settings } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalText, setGoalText] = useState("");
  const [addingGoal, setAddingGoal] = useState(false);

  function refresh() {
    if (!user) return;
    const p = getProject(user.uid, id);
    if (!p) { router.replace("/dashboard"); return; }
    // If no plan selected yet, redirect to plan selection
    if (!p.plan) { router.replace(`/project/${id}/plan`); return; }
    setProject(p);
  }

  useEffect(() => { refresh(); }, [user, id]);

  async function handleAddGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !goalText.trim() || !project) return;
    setAddingGoal(true);
    addGoal(user.uid, id, goalText.trim());
    setGoalText("");
    setAddingGoal(false);
    setShowGoalModal(false);
    refresh();
    // Go to board meeting with this goal
    router.push(`/project/${id}/board-meeting?goal=${encodeURIComponent(goalText.trim())}`);
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[#0A0A14] flex items-center justify-center">
        <div className="size-8 rounded-full border-2 border-[#E94560] border-t-transparent animate-spin" />
      </div>
    );
  }

  const employeeDetails = project.hiredRoles.map(getEmployeeDetails);

  return (
    <div className="min-h-screen bg-[#0A0A14]">
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#E94560]/6 rounded-full blur-[120px]" />
      </div>

      {/* Nav */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0A0A14]/80 backdrop-blur-sm sticky top-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/dashboard")} className="text-slate-500 hover:text-white transition-colors">
            <ArrowLeft className="size-5" />
          </button>
          <span className="text-base font-bold tracking-tight">
            <span className="text-white">Ghost</span>
            <span className="text-[#E94560]">Employee</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            project.plan === "advanced"
              ? "bg-[#E94560]/15 text-[#E94560]"
              : "bg-indigo-500/15 text-indigo-400"
          }`}>
            {project.plan} plan
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/project/${id}/plan`)}
            title="Change plan or rehire team"
          >
            <Settings className="size-4" />
          </Button>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-10 space-y-8">
        {/* Project header */}
        <div>
          <h1 className="text-2xl font-bold text-white">{project.name}</h1>
          {project.description && (
            <p className="text-sm text-slate-400 mt-1">{project.description}</p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Team + Goals */}
          <div className="lg:col-span-2 space-y-6">

            {/* Your team */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Users className="size-4 text-slate-400" />
                  Your team ({project.hiredRoles.length})
                </h2>
                {project.plan === "advanced" && (
                  <Button variant="ghost" size="sm" onClick={() => router.push(`/project/${id}/hire`)}>
                    <Plus className="size-3" /> Manage
                  </Button>
                )}
              </div>
              <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {employeeDetails.map((emp) => (
                  <div key={emp.role} className="flex flex-col items-center text-center p-3 rounded-xl bg-white/[0.03] border border-white/10">
                    <span className="text-2xl mb-1">{emp.icon}</span>
                    <span className="text-xs font-semibold text-white leading-tight">{emp.name}</span>
                    <span className="text-[10px] text-slate-500 mt-0.5">{emp.specialty}</span>
                  </div>
                ))}
              </div>
              {project.plan === "basic" && (
                <div className="px-5 pb-4">
                  <p className="text-xs text-slate-500">
                    On Basic plan — 4 default employees.{" "}
                    <button
                      onClick={() => router.push(`/project/${id}/plan`)}
                      className="text-[#E94560] hover:underline"
                    >
                      Upgrade to Advanced
                    </button>{" "}
                    to pick your full team.
                  </p>
                </div>
              )}
            </div>

            {/* Goals */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Target className="size-4 text-slate-400" />
                  Goals ({project.goals.length})
                </h2>
                <Button size="sm" onClick={() => setShowGoalModal(true)}>
                  <Plus className="size-4" /> Assign goal
                </Button>
              </div>

              {project.goals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <Target className="size-8 text-slate-600 mb-3" />
                  <p className="text-sm text-slate-400 mb-4">No goals yet. Assign one to launch your team.</p>
                  <Button size="sm" onClick={() => setShowGoalModal(true)}>
                    <Plus className="size-4" /> Assign first goal
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {project.goals.map((goal) => (
                    <div
                      key={goal.id}
                      onClick={() => router.push(`/project/${id}/board-meeting?goal=${encodeURIComponent(goal.text)}`)}
                      className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] cursor-pointer transition-colors group"
                    >
                      <p className="text-sm text-slate-300 truncate flex-1">{goal.text}</p>
                      <ChevronRight className="size-4 text-slate-600 group-hover:text-slate-400 shrink-0 ml-3" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column: Launch board meeting */}
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-[#E94560]/10 to-indigo-900/20 border border-[#E94560]/20 rounded-2xl p-5">
              <div className="size-10 rounded-xl bg-[#E94560]/20 flex items-center justify-center mb-4">
                <Zap className="size-5 text-[#E94560]" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Board Meeting</h3>
              <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                Launch a live collaborative session. Your team debates the goal and produces a report.
              </p>
              <Button
                fullWidth
                onClick={() => setShowGoalModal(true)}
              >
                Start board meeting
              </Button>
            </div>

            {/* Team summary */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Team summary</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {employeeDetails.map((emp) => (
                  <span key={emp.role} className="text-xs bg-white/5 border border-white/10 text-slate-300 px-2 py-0.5 rounded-full">
                    {emp.icon} {emp.name.replace(" Ghost", "")}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Assign goal modal */}
      {showGoalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowGoalModal(false)} />
          <div className="relative z-10 w-full max-w-md bg-[#0F0F1A] border border-white/15 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Assign a goal</h2>
              <button onClick={() => setShowGoalModal(false)} className="text-slate-500 hover:text-white">
                <X className="size-5" />
              </button>
            </div>
            <form onSubmit={handleAddGoal} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-300">What should your team work on?</label>
                <textarea
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E94560] focus:border-transparent transition-colors resize-none"
                  placeholder="e.g. Validate my AI resume optimizer startup idea"
                  rows={3}
                  value={goalText}
                  onChange={(e) => setGoalText(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <p className="text-xs text-slate-500">
                Your team of {project.hiredRoles.length} AI employees will collaborate on this in a board meeting.
              </p>
              <div className="flex gap-3">
                <Button variant="ghost" fullWidth type="button" onClick={() => setShowGoalModal(false)}>
                  Cancel
                </Button>
                <Button fullWidth type="submit" loading={addingGoal} disabled={!goalText.trim()}>
                  Launch board meeting
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
