import { cn } from "@/lib/utils";

interface DividerProps {
  label?: string;
  className?: string;
}

export function Divider({ label, className }: DividerProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex-1 h-px bg-white/10" />
      {label && (
        <span className="text-xs text-slate-500 shrink-0">{label}</span>
      )}
      <div className="flex-1 h-px bg-white/10" />
    </div>
  );
}
