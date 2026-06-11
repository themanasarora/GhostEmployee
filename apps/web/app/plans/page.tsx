import { PlanSelector } from "@/components/plans/PlanSelector";

export default function PlansPage() {
  return (
    <div className="min-h-screen bg-[#0A0A14]">
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-[#E94560]/8 rounded-full blur-[140px]" />
      </div>
      <header className="relative z-10 flex items-center px-6 py-5 border-b border-white/5">
        <span className="text-base font-bold tracking-tight">
          <span className="text-white">Ghost</span>
          <span className="text-[#E94560]">Employee</span>
        </span>
      </header>
      <main className="relative z-10 max-w-3xl mx-auto px-6 py-16">
        <PlanSelector />
      </main>
    </div>
  );
}