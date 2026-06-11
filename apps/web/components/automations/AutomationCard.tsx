"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, Circle } from "lucide-react";
import { Automation, AutomationConfig } from "@/lib/plans";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

interface AutomationCardProps {
  automation: Automation;
  enabled: boolean;
  config: AutomationConfig;
  onToggle: () => void;
  onConfigChange: (key: string, value: string) => void;
}

export function AutomationCard({ automation, enabled, config, onToggle, onConfigChange }: AutomationCardProps) {
  const [expanded, setExpanded] = useState(false);

  function handleToggle() {
    onToggle();
    if (!enabled) setExpanded(true);
  }

  return (
    <div className={cn(
      "rounded-2xl border transition-all duration-200",
      enabled ? "border-[#E94560]/40 bg-[#E94560]/5" : "border-white/10 bg-white/[0.03]"
    )}>
      <div className="flex items-center gap-4 p-5">
        <button onClick={handleToggle} className="shrink-0 transition-transform hover:scale-110" aria-label={enabled ? "Disable" : "Enable"}>
          {enabled ? <CheckCircle2 className="size-6 text-[#E94560]" /> : <Circle className="size-6 text-slate-600" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">{automation.icon}</span>
            <span className="text-sm font-semibold text-white">{automation.name}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{automation.description}</p>
        </div>

        {enabled && (
          <button onClick={() => setExpanded((p) => !p)} className="shrink-0 text-slate-500 hover:text-white transition-colors">
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        )}
      </div>

      {enabled && expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">
          {automation.configFields.map((field) => {
            if (field.type === "select") {
              return (
                <div key={field.key} className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-300">
                    {field.label}{field.required && <span className="text-[#E94560] ml-1">*</span>}
                  </label>
                  <select
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#E94560] focus:border-transparent transition-colors"
                    value={config[field.key] || ""}
                    onChange={(e) => onConfigChange(field.key, e.target.value)}
                  >
                    <option value="" disabled className="bg-[#0A0A14]">Select an option</option>
                    {field.options?.map((opt) => (
                      <option key={opt} value={opt} className="bg-[#0A0A14]">{opt}</option>
                    ))}
                  </select>
                </div>
              );
            }
            return (
              <Input
                key={field.key}
                label={field.required ? `${field.label} *` : field.label}
                type={field.type}
                placeholder={field.placeholder}
                value={config[field.key] || ""}
                onChange={(e) => onConfigChange(field.key, e.target.value)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}