import { EmployeeChecklist } from "@/components/workspace/EmployeeChecklist";

export default function WorkspaceSetupPage() {
  return (
    <div className="min-h-screen bg-[#0A0A14]">
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-[#E94560]/8 rounded-full blur-[130px]" />
      </div>
      <header className="relative z-10 flex items-center px-6 py-5 border-b border-white/5">
        <span className="text-base font-bold tracking-tight">
          <span className="text-white">Ghost</span>
          <span className="text-[#E94560]">Employee</span>
        </span>
      </header>
      <main className="relative z-10 px-6 py-16">
        <EmployeeChecklist />
      </main>
    </div>
  );
}