"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, ArrowRight } from "lucide-react";
import { AUTOMATIONS, AutomationId, AutomationConfig } from "@/lib/plans";
import { AutomationCard } from "@/components/automations/AutomationCard";
import { Button } from "@/components/ui/Button";

type AutomationState = {
  enabled: boolean;
  config: AutomationConfig;
};

export function AutomationSetup() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [automations, setAutomations] = useState<Record<AutomationId, AutomationState>>({
    email: { enabled: false, config: {} },
    github: { enabled: false, config: {} },
    slack: { enabled: false, config: {} },
  });

  function toggleAutomation(id: AutomationId) {
    setAutomations((prev) => ({ ...prev, [id]: { ...prev[id], enabled: !prev[id].enabled } }));
  }

  function updateConfig(id: AutomationId, key: string, value: string) {
    setAutomations((prev) => ({
      ...prev,
      [id]: { ...prev[id], config: { ...prev[id].config, [key]: value } },
    }));
  }

  const enabledCount = Object.values(automations).filter((a) => a.enabled).length;

  function validateEnabled(): boolean {
    for (const automation of AUTOMATIONS) {
      const state = automations[automation.id];
      if (!state.enabled) continue;
      for (const field of automation.configFields) {
        if (field.required && !state.config[field.key]?.trim()) return false;
      }
    }
    return true;
  }

  async function handleSave() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    router.push("/dashboard");
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <div className="size-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
            <Zap className="size-4 text-indigo-400" />
          </div>
          <span className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">Basic Plan</span>
        </div>
        <h2 className="text-2xl font-bold text-white">Set up your automations</h2>
        <p className="text-sm text-slate-400">
          Enable the automations you want. Configure each one by expanding it.
          You can change these anytime from your workspace.
        </p>
      </div>

      <div className="space-y-3">
        {AUTOMATIONS.map((automation) => (
          <AutomationCard
            key={automation.id}
            automation={automation}
            enabled={automations[automation.id].enabled}
            config={automations[automation.id].config}
            onToggle={() => toggleAutomation(automation.id)}
            onConfigChange={(key, value) => updateConfig(automation.id, key, value)}
          />
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <p className="text-sm text-slate-500">
          {enabledCount === 0 ? "No automations enabled — you can skip for now" : `${enabledCount} automation${enabledCount > 1 ? "s" : ""} enabled`}
        </p>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => router.push("/dashboard")}>Skip for now</Button>
          <Button onClick={handleSave} loading={saving} disabled={enabledCount > 0 && !validateEnabled()}>
            Save and continue
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>

      {enabledCount > 0 && !validateEnabled() && (
        <p className="text-xs text-red-400 text-right">Fill in all required fields for enabled automations.</p>
      )}
    </div>
  );
}