"use client";

import { CheckCircle2 } from "lucide-react";
import { Plan } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

interface PlanCardProps {
  plan: Plan;
  onSelect: (planId: string) => void;
  selected?: boolean;
}

export function PlanCard({ plan, onSelect, selected }: PlanCardProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border p-6 transition-all duration-200 cursor-pointer group",
        selected
          ? "border-[#E94560] bg-[#E94560]/5"
          : "border-white/10 bg-white/[0.03] hover:border-white/20"
      )}
      onClick={() => onSelect(plan.id)}
    >
      <div className="flex items-center justify-between mb-5">
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ backgroundColor: `${plan.color}20`, color: plan.color }}
        >
          {plan.badge}
        </span>
        {selected && <CheckCircle2 className="size-5 text-[#E94560]" />}
      </div>

      <h3 className="text-xl font-bold text-white mb-1">{plan.name} Plan</h3>
      <p className="text-sm text-slate-400 mb-6 leading-relaxed">{plan.tagline}</p>

      <ul className="space-y-2.5 mb-8 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <CheckCircle2 className="size-4 mt-0.5 shrink-0" style={{ color: plan.color }} />
            <span className="text-sm text-slate-300">{f}</span>
          </li>
        ))}
      </ul>

      <Button
        variant={selected ? "primary" : "outline"}
        fullWidth
        onClick={(e) => { e.stopPropagation(); onSelect(plan.id); }}
      >
        {selected ? "Selected" : `Choose ${plan.name}`}
      </Button>
    </div>
  );
}