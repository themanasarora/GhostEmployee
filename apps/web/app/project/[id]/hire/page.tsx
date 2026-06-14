"use client";

import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getProject, updateProject, DEFAULT_ROLES } from "@/lib/store";
import { EMPLOYEES, EmployeeRole } from "@/lib/plans";
import { useState, useEffect } from "react";
import { CheckCircle2, Circle, Info, ArrowLeft, ArrowRight, Lock } from "lucide-react";
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
  const [projectDescription, setProjectDescription] = useState("");
  const [isFirstSetup, setIsFirstSetup] = useState(false);

  useEffect(() => {
    if (!user) return;
    const project = getProject(user.uid, id);
    if (!project) { router.replace("/dashboard"); return; }
    setProjectName(project.name);
    setProjectDescription(project.description);
    // First setup = plan not set yet
    setIsFirstSetup(!project.plan);
    if (project.hiredRoles.length > 0) {
      setSelected(new Set(project.hiredRoles as EmployeeRole[]));
    }
  }, [user, id]);

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
    const roles = Array.from(selected) as EmployeeRole[];
    updateProject(user.uid, id, {
      plan: "advanced",
      hiredRoles: roles,
    });
    setSaving(false);

    if (isFirstSetup) {
      // First time — go straight to the kickoff board meeting
      router.push(`/project/${id}/kickoff`);
    } else {
      // Updating team later — go back to project hub
      router.push(`/project/${id}`);
    }
  }

  const count = selected.size;

  return (
    <div className="min-h-screen bg-[#0A0A14]">
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-[#E94560]/8 rounded-full blur-[130px]" />
      </div>

      <header className="relative z-10 flex items-center gap-4 px-6 py-5 border-b border-white/5">
        <button
          onClick={() => router.push(isFirstSetup ? "/dashboard" : `/project/${id}`)}
          className="text-slate-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="size-5" />
        </button>
        <span className="text-base font-bold tracking-tight">
          <span className="text-white">Ghost</span><span className="text-[#E94560]">Employee</span>
        </span>
        {!isFirstSetup && (
          <span className="ml-auto text-xs text-slate-500 flex items-center gap-1.5">
            <Lock className="size-3" /> Advanced plan · plan cannot be changed
          </span>
        )}
      </header>

      <main className="relative z-10 max-w-2xl mx-auto px-6 py-12 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{projectName}</p>
          <h2 className="text-2xl font-bold text-white">
            {isFirstSetup ? "Hire your AI team" : "Manage your team"}
          </h2>
          <p className="text-sm text-slate-400">
            {isFirstSetup
              ? "Select who works on this project. After hiring, your team will kick off a board meeting automatically."
              : "Add or remove employees from this project. CEO Ghost is always required."}
          </p>
        </div>

        {/* Project context preview */}
        {projectDescription && (
          <div className="bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Project context your team will read</p>
            <p className="text-sm text-slate-300 leading-relaxed">{projectDescription}</p>
          </div>
        )}

        {/* CEO notice */}
        <div className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
          <Info className="size-4 text-slate-400 mt-0.5 shrink-0" />
          <p className="text-xs text-slate-400">
            <span className="text-white font-medium">CEO Ghost is always active</span> — orchestrates the team, leads the kickoff board meeting, and synthesizes all outputs.
          </p>
        </div>

        {/* Select all / none */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">
            <span className="text-white font-semibold">{count}</span> of {EMPLOYEES.length} selected
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setSelected(new Set(EMPLOYEES.map((e) => e.role as EmployeeRole)))}
              className="text-xs text-slate-400 hover:text-white transition-colors underline underline-offset-2"
            >
              Select all
            </button>
            <span className="text-slate-600">·</span>
            <button
              onClick={() => setSelected(new Set(REQUIRED))}
              className="text-xs text-slate-400 hover:text-white transition-colors underline underline-offset-2"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Employee grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {EMPLOYEES.map((emp) => {
            const isSelected = selected.has(emp.role as EmployeeRole);
            const isRequired = REQUIRED.includes(emp.role as EmployeeRole);
            return (
              <div
                key={emp.role}
                onClick={() => toggle(emp.role as EmployeeRole)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-4 transition-all duration-150",
                  isRequired
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
                      <span className="text-[10px] font-bold text-[#E94560] bg-[#E94560]/10 px-1.5 py-0.5 rounded-full">
                        Required
                      </span>
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
            {count <= 1
              ? "Add more employees for richer output"
              : isFirstSetup
              ? `${count} employees will kick off a board meeting`
              : `${count} employees active on this project`}
          </p>
          <Button onClick={handleSave} loading={saving} size="lg" disabled={count === 0}>
            {isFirstSetup ? "Hire & start board meeting" : "Save team"}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </main>
    </div>
  );
}
