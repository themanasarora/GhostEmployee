"use client";

import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getProject, updateProject } from "@/lib/store";
import { EMPLOYEES, EmployeeRole } from "@/lib/plans";
import { useState, useEffect } from "react";
import { CheckCircle2, Circle, Info, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const REQUIRED: EmployeeRole[] = ["ceo"];

export default function HireTeamPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [selected, setSelected] = useState<Set<EmployeeRole>>(new Set(REQUIRED));
  const [saving, setSaving] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectPlan, setProjectPlan] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const project = getProject(user.uid, id);
    if (!project) { router.replace("/dashboard"); return; }
    setProjectName(project.name);
    setProjectPlan(project.plan);
    // Pre-select already hired roles
    if (project.hiredRoles.length > 0) {
      setSelected(new Set(project.hiredRoles));
    }
  }, [user, id, router]);

  function toggle(role: EmployeeRole) {
    if (REQUIRED.includes(role)) return;
    if (projectPlan === "basic" && !["ceo", "pm", "research", "growth"].includes(role)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(role) ? next.delete(role) : next.add(role);
      return next;
    });
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    updateProject(user.uid, id, { hiredRoles: Array.from(selected) });
    setSaving(false);
    router.push(`/project/${id}`);
  }

  const count = selected.size;

  return (
    <div className="min-h-screen bg-[#0A0A14]">
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-[#E94560]/8 rounded-full blur-[130px]" />
      </div>

      <header className="relative z-10 flex items-center gap-4 px-6 py-5 border-b border-white/5">
        <button onClick={() => router.push(`/project/${id}/plan`)} className="text-slate-500 hover:text-white transition-colors">
          <ArrowLeft className="size-5" />
        </button>
        <span className="text-base font-bold tracking-tight">
          <span className="text-white">Ghost</span>
          <span className="text-[#E94560]">Employee</span>
        </span>
      </header>

      <main className="relative z-10 max-w-2xl mx-auto px-6 py-16 space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{projectName}</p>
          <h2 className="text-2xl font-bold text-white">Hire your AI team</h2>
          <p className="text-sm text-slate-400">
            Select the employees for this project. They'll collaborate on every goal you assign.
            {projectPlan === "basic" && " Upgrade to Advanced to unlock the full 8-person roster."}
          </p>
        </div>

        {/* CEO notice */}
        <div className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
          <Info className="size-4 text-slate-400 mt-0.5 shrink-0" />
          <p className="text-xs text-slate-400">
            <span className="text-white font-medium">CEO Ghost is always active</span> — orchestrates the team, breaks down goals, and synthesizes the final report.
          </p>
        </div>

        {/* Select all / none */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">
            <span className="text-white font-semibold">{count}</span> of {EMPLOYEES.length} selected
          </p>
          <div className="flex gap-3">
            <button onClick={() => setSelected(new Set(EMPLOYEES.map((e) => e.role)))} className="text-xs text-slate-400 hover:text-white transition-colors underline underline-offset-2">
              Select all
            </button>
            <span className="text-slate-600">·</span>
            <button onClick={() => setSelected(new Set(REQUIRED))} className="text-xs text-slate-400 hover:text-white transition-colors underline underline-offset-2">
              Clear
            </button>
          </div>
        </div>

        {/* Employee grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {EMPLOYEES.map((emp) => {
            const isSelected = selected.has(emp.role);
            const isRequired = REQUIRED.includes(emp.role);
            return (
              <div
                key={emp.role}
                onClick={() => toggle(emp.role)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-4 transition-all duration-150",
                  projectPlan === "basic" && !["ceo", "pm", "research", "growth"].includes(emp.role) 
                    ? "border-white/5 bg-white/[0.01] opacity-50 cursor-not-allowed"
                    : isRequired 
                      ? "border-[#E94560]/40 bg-[#E94560]/5 cursor-default"
                      : isSelected 
                        ? "border-[#E94560]/40 bg-[#E94560]/5 cursor-pointer"
                        : "border-white/10 bg-white/[0.03] cursor-pointer hover:border-white/20"
                )}
              >
                <div className="shrink-0 mt-0.5">
                  {isSelected
                    ? <CheckCircle2 className="size-5 text-[#E94560]" />
                    : <Circle className="size-5 text-slate-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base">{emp.icon}</span>
                    <span className="text-sm font-semibold text-white">{emp.name}</span>
                    {isRequired && (
                      <span className="text-[10px] font-bold text-[#E94560] bg-[#E94560]/10 px-1.5 py-0.5 rounded-full">Required</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{emp.description}</p>
                  <span className="inline-block mt-1.5 text-[10px] text-slate-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                    {emp.specialty}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-slate-500">
            {count <= 1 ? "Add more employees for richer output" : `${count} employees ready to collaborate`}
          </p>
          <Button onClick={handleSave} loading={saving} size="lg">
            Hire team
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </main>
    </div>
  );
}
