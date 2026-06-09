import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#0A0A14] flex flex-col">
      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#E94560]/8 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-indigo-900/15 rounded-full blur-[150px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/5">
        <span className="text-xl font-bold tracking-tight">
          <span className="text-white">Ghost</span>
          <span className="text-[#E94560]">Employee</span>
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-slate-400 hover:text-white transition-colors px-4 py-2"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="text-sm font-medium bg-[#E94560] hover:bg-[#d63652] text-white px-4 py-2 rounded-lg transition-colors"
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-8">
          <span className="size-2 rounded-full bg-[#E94560] animate-pulse" />
          <span className="text-xs text-slate-400 font-medium">Now in early access</span>
        </div>

        <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold text-white leading-[1.1] tracking-tight max-w-4xl">
          Hire AI Employees,
          <br />
          <span className="text-[#E94560]">Not AI Tools.</span>
        </h1>

        <p className="mt-6 text-lg text-slate-400 max-w-xl leading-relaxed">
          Assign a goal. Your team of AI employees — CEO, CTO, PM, Research,
          Growth, Finance — collaborate, debate, and deliver a full report.
          No prompting. No coordinating.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/register"
            className="text-base font-semibold bg-[#E94560] hover:bg-[#d63652] text-white px-8 py-3.5 rounded-xl transition-colors w-full sm:w-auto text-center"
          >
            Hire your first employee →
          </Link>
          <Link
            href="/login"
            className="text-base text-slate-400 hover:text-white transition-colors"
          >
            Already have an account
          </Link>
        </div>

        {/* Social proof */}
        <p className="mt-8 text-sm text-slate-500">
          Free to start · No credit card required
        </p>
      </section>

      {/* Roles preview */}
      <section className="relative z-10 pb-24 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-xs font-medium text-slate-500 uppercase tracking-widest mb-8">
            Your AI workforce
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { role: "CEO Ghost", icon: "👔", desc: "Strategy & coordination" },
              { role: "CTO Ghost", icon: "⚙️", desc: "Architecture & tech" },
              { role: "PM Ghost", icon: "🗺️", desc: "Roadmap & requirements" },
              { role: "Research Ghost", icon: "🔬", desc: "Market intelligence" },
              { role: "Growth Ghost", icon: "📈", desc: "Acquisition & GTM" },
              { role: "Finance Ghost", icon: "💰", desc: "Pricing & projections" },
              { role: "Sales Ghost", icon: "🤝", desc: "Outreach & pipeline" },
              { role: "Recruiter Ghost", icon: "👥", desc: "Hiring strategy" },
            ].map((e) => (
              <div
                key={e.role}
                className="bg-white/[0.03] border border-white/10 rounded-xl p-4 hover:border-[#E94560]/30 transition-colors"
              >
                <div className="text-2xl mb-2">{e.icon}</div>
                <div className="text-sm font-semibold text-white">{e.role}</div>
                <div className="text-xs text-slate-500 mt-0.5">{e.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
