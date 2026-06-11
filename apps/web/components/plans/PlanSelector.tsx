"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PLANS, PlanId } from "@/lib/plans";
import { PlanCard } from "@/components/plans/PlanCard";
import { Button } from "@/components/ui/Button";

interface PlanSelectorProps {
  currentPlan?: PlanId;
  onSelect?: (plan: PlanId) => void;
}

export function PlanSelector({ currentPlan, onSelect }: PlanSelectorProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<PlanId | null>(currentPlan || null);

  function handleContinue() {
    if (!selected) return;
    if (onSelect) { onSelect(selected); return; }
    if (selected === "basic") router.push("/automations");
    if (selected === "advanced") router.push("/workspace/setup");
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-white">Choose your plan</h1>
        <p className="text-slate-400 text-sm">
          Both plans are free during our early access. Pick based on what you want to build.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            selected={selected === plan.id}
            onSelect={(id) => setSelected(id as PlanId)}
          />
        ))}
      </div>

      <div className="flex justify-center">
        <Button size="lg" disabled={!selected} onClick={handleContinue} className="min-w-[200px]">
          Continue with {selected ? (selected === "basic" ? "Basic" : "Advanced") : "..."} →
        </Button>
      </div>
    </div>
  );
}