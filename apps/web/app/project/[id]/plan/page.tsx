"use client";

import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getProject, updateProject } from "@/lib/store";
import { PLANS, PlanId } from "@/lib/plans";
import { useState, useEffect } from "react";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export default function ProjectPlanPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [selected, setSelected] = useState<PlanId | null>(null);
  const [saving, setSaving] = useState(false);
  const [projectName, setProjectName] = useState("");

  useEffect(() => {
    if (!user) return;
    const project = getProject(user.uid, id);
    if (!project) { router.replace("/dashboard"); return; }
    setProjectName(project.name);
    if (project.plan) setSelected(project.plan);
  }, [user, id, router]);

  async function handleContinue() {
    if (!selected || !user) return;
    setSaving(true);
    updateProject(user.uid, id, { plan: selected });
    setSaving(false);

    if (selected === "basic") {
      // Basic: keep default 4 employees, go straight to project
      router.push(`/project/${id}`);
    } else {
      // Advanced: go to employee hiring checklist
      router.push(`/project/${id}/hire`);
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A14]">
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[#E94560]/8 rounded-full blur-[140px]" />
      </div>

      <header className="relative z-10 flex items-center gap-4 px-6 py-5 border-b border-white/5">
        <button onClick={() => router.push("/dashboard")} className="text-slate-500 hover:text-white transition-colors">
          <ArrowLeft className="size-5" />
        </button>
        <span className="text-base font-bold tracking-tight">
          <span className="text-white">Ghost</span>
          <span className="text-[#E94560]">Employee</span>
        </span>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-6 py-16 space-y-10">
        <div className="text-center space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            {projectName}
          </p>
          <h1 className="text-3xl font-bold text-white">Choose a plan for this project</h1>
          <p className="text-slate-400 text-sm">
            Both are free. Basic gives you 4 default agents + automations. Advanced lets you pick your full team.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              onClick={() => setSelected(plan.id)}
              className={cn(
                "relative flex flex-col rounded-2xl border p-6 cursor-pointer transition-all duration-200",
                selected === plan.id
                  ? "border-[#E94560] bg-[#E94560]/5"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20"
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: `${plan.color}20`, color: plan.color }}
                >
                  {plan.badge}
                </span>
                {selected === plan.id && <CheckCircle2 className="size-5 text-[#E94560]" />}
              </div>

              <h3 className="text-xl font-bold text-white mb-1">{plan.name} Plan</h3>

              {plan.id === "basic" && (
                <p className="text-xs text-indigo-400 font-medium mb-2">
                  CEO · PM · Research · Growth — pre-hired
                </p>
              )}
              {plan.id === "advanced" && (
                <p className="text-xs text-[#E94560] font-medium mb-2">
                  You choose from all 8 employees
                </p>
              )}

              <p className="text-sm text-slate-400 mb-5 leading-relaxed flex-1">{plan.tagline}</p>

              <ul className="space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle2 className="size-3.5 mt-0.5 shrink-0" style={{ color: plan.color }} />
                    <span className="text-xs text-slate-300">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex justify-center">
          <Button size="lg" disabled={!selected} loading={saving} onClick={handleContinue} className="min-w-[240px]">
            {selected === "advanced" ? "Continue to hire team →" : "Start with Basic →"}
          </Button>
        </div>
      </main>
    </div>
  );
}
