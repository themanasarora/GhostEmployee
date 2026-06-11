"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Users, ArrowRight, Info } from "lucide-react";
import { EMPLOYEES, EmployeeRole } from "@/lib/plans";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const REQUIRED_ROLES: EmployeeRole[] = ["ceo"];

export function EmployeeChecklist() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<EmployeeRole>>(new Set(REQUIRED_ROLES));

  function toggle(role: EmployeeRole) {
    if (REQUIRED_ROLES.includes(role)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(role) ? next.delete(role) : next.add(role);
      return next;
    });
  }

  function selectAll() { setSelected(new Set(EMPLOYEES.map((e) => e.role))); }
  function selectNone() { setSelected(new Set(REQUIRED_ROLES)); }

  async function handleSave() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    router.push("/dashboard");
  }

  const count = selected.size;

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <div className="size-8 rounded-lg bg-[#E94560]/20 flex items-center justify-center">
            <Users className="size-4 text-[#E94560]" />
          </div>
          <span className="text-xs font-semibold text-[#E94560] uppercase tracking-widest">Advanced Plan</span>
        </div>
        <h2 className="text-2xl font-bold text-white">Build your AI team</h2>
        <p className="text-sm text-slate-400">
          Select which employees are active in your workspace. They will collaborate on every goal you assign.
        </p>
      </div>

      <div className="flex items-start gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
        <Info className="size-4 text-slate-400 mt-0.5 shrink-0" />
        <p className="text-xs text-slate-400">
          <span className="text-white font-medium">CEO Ghost is always active.</span>{" "}
          Every team needs an orchestrator. The CEO breaks down goals, delegates to your selected employees, and synthesizes the final report.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          <span className="text-white font-semibold">{count}</span> of {EMPLOYEES.length} employees selected
        </p>
        <div className="flex gap-2">
          <button onClick={selectAll} className="text-xs text-slate-400 hover:text-white transition-colors underline underline-offset-2">Select all</button>
          <span className="text-slate-600">·</span>
          <button onClick={selectNone} className="text-xs text-slate-400 hover:text-white transition-colors underline underline-offset-2">Clear</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {EMPLOYEES.map((employee) => {
          const isSelected = selected.has(employee.role);
          const isRequired = REQUIRED_ROLES.includes(employee.role);
          return (
            <div
              key={employee.role}
              onClick={() => toggle(employee.role)}
              className={cn(
                "relative flex items-start gap-4 rounded-xl border p-4 transition-all duration-150",
                isRequired ? "border-[#E94560]/40 bg-[#E94560]/5 cursor-default"
                  : isSelected ? "border-[#E94560]/40 bg-[#E94560]/5 cursor-pointer"
                  : "border-white/10 bg-white/[0.03] cursor-pointer hover:border-white/20"
              )}
            >
              <div className="shrink-0 mt-0.5">
                {isSelected ? <CheckCircle2 className="size-5 text-[#E94560]" /> : <Circle className="size-5 text-slate-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{employee.icon}</span>
                  <span className="text-sm font-semibold text-white">{employee.name}</span>
                  {isRequired && (
                    <span className="text-[10px] font-bold text-[#E94560] bg-[#E94560]/10 px-1.5 py-0.5 rounded-full">Required</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{employee.description}</p>
                <span className="inline-block mt-2 text-[10px] font-medium text-slate-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                  {employee.specialty}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-2">
        <p className="text-sm text-slate-500">
          {count === 1 ? "Only CEO selected — add more for richer output" : `${count} employees will collaborate on your goals`}
        </p>
        <Button onClick={handleSave} loading={saving} size="lg">
          Hire team and continue
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}