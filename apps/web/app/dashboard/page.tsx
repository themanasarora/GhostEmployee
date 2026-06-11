"use client";

import { useRequireAuth } from "@/hooks/useRequireAuth";
import { logout } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { LogOut, Plus, Briefcase, Zap, X, ArrowRight, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface Subtask {
  id: string;
  description: string;
  completed: boolean;
}

interface Project {
  id: string;
  name: string;
  goal: string;
  hiredAgents: string[];
  createdAt: string;
  currentTask: string;
  subtasks: Subtask[];
  messages: any[];
  report: string;
}

export default function DashboardPage() {
  const { user, loading } = useRequireAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectGoal, setProjectGoal] = useState("");
  const [formError, setFormError] = useState("");

  // Load projects from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("ghostemployee:projects");
      if (stored) {
        try {
          setProjects(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to parse projects from localStorage", e);
        }
      }
    }
  }, []);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    if (!projectName.trim() || !projectGoal.trim()) {
      setFormError("Project Name and Goal are required.");
      return;
    }

    const newProject: Project = {
      id: Math.random().toString(36).substring(2, 11),
      name: projectName.trim(),
      goal: projectGoal.trim(),
      hiredAgents: ["ceo", "pm", "sales", "recruiter"],
      createdAt: new Date().toISOString(),
      currentTask: "CEO initiating kickoff meeting",
      subtasks: [
        { id: "1", description: "Establish company roadmap & product requirements", completed: false },
        { id: "2", description: "Define Go-to-Market (GTM) and customer acquisition channels", completed: false },
        { id: "3", description: "Draft key talent hiring plan and sourcing roadmap", completed: false },
      ],
      messages: [],
      report: `# Project Workspace: ${projectName.trim()}\n\nGoal: ${projectGoal.trim()}\n\n*This report will be populated dynamically by your AI employees.*`,
    };

    const updatedProjects = [newProject, ...projects];
    setProjects(updatedProjects);
    localStorage.setItem("ghostemployee:projects", JSON.stringify(updatedProjects));

    // Reset form
    setProjectName("");
    setProjectGoal("");
    setFormError("");
    setShowCreateModal(false);

    // Redirect to project boardroom
    router.push(`/dashboard/project/${newProject.id}`);
  }

  function handleDeleteProject(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this project?")) {
      const updated = projects.filter((p) => p.id !== id);
      setProjects(updated);
      localStorage.setItem("ghostemployee:projects", JSON.stringify(updated));
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A14] flex items-center justify-center">
        <div className="size-8 rounded-full border-2 border-[#E94560] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const displayName = user.displayName || user.email?.split("@")[0] || "Founder";

  // Calculate statistics
  const totalProjects = projects.length;
  const employeesHired = projects.reduce((acc, p) => acc + p.hiredAgents.length, 0);
  const reportsGenerated = projects.filter((p) => p.report && p.report.length > 150).length;

  return (
    <div className="min-h-screen bg-[#0A0A14] text-white">
      {/* Ambient backgrounds */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-[#E94560]/5 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 right-10 w-[500px] h-[300px] bg-indigo-900/10 rounded-full blur-[120px]" />
      </div>

      {/* Top nav */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0A0A14]/80 backdrop-blur-sm sticky top-0">
        <span className="text-base font-bold tracking-tight">
          <span className="text-white">Ghost</span>
          <span className="text-[#E94560]">Employee</span>
        </span>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={displayName}
                className="size-8 rounded-full object-cover border border-white/10"
              />
            ) : (
              <div className="size-8 rounded-full bg-[#E94560]/20 border border-[#E94560]/30 flex items-center justify-center">
                <span className="text-xs font-bold text-[#E94560]">
                  {displayName[0].toUpperCase()}
                </span>
              </div>
            )}
            <span className="text-sm text-slate-300 hidden sm:block">{displayName}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 max-w-5xl mx-auto px-6 py-12">
        {/* Welcome */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Good to have you, {displayName.split(" ")[0]}.
          </h1>
          <p className="mt-2 text-slate-400">
            Your AI employees are ready to work. Launch a project and delegate goals.
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          {[
            { label: "Active Projects", value: totalProjects.toString(), limit: "Standard Account" },
            { label: "AI Employees Active", value: employeesHired.toString(), limit: "CEO, Sales, Recruiter, PM" },
            { label: "Workspace Reports", value: reportsGenerated.toString(), limit: "Finalized deliverables" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white/[0.02] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors"
            >
              <p className="text-3xl font-bold text-white tracking-tight">{stat.value}</p>
              <p className="text-sm text-slate-400 mt-1">{stat.label}</p>
              <p className="text-xs text-slate-600 mt-0.5">{stat.limit}</p>
            </div>
          ))}
        </div>

        {/* Projects section */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
          {/* Section header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-white/[0.01]">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Briefcase className="size-4 text-slate-400" />
              Projects
            </h2>
            <Button size="sm" onClick={() => setShowCreateModal(true)}>
              <Plus className="size-4" />
              New project
            </Button>
          </div>

          {/* Project List / Grid */}
          {projects.length > 0 ? (
            <div className="divide-y divide-white/5">
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => router.push(`/dashboard/project/${project.id}`)}
                  className="p-6 hover:bg-white/[0.02] transition-colors cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-base font-semibold text-white group-hover:text-[#E94560] transition-colors">
                        {project.name}
                      </h3>
                      <span className="text-[10px] text-slate-500 bg-white/5 border border-white/10 rounded px-1.5 py-0.5">
                        {project.hiredAgents.length} Agents
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mt-1 line-clamp-1">
                      {project.goal}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <FolderOpen className="size-3.5" />
                        Created: {new Date(project.createdAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-[#E94560] animate-pulse" />
                        Focus: {project.currentTask}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 self-end md:self-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDeleteProject(project.id, e)}
                      className="hover:text-red-400"
                    >
                      Delete
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="group-hover:bg-[#E94560] group-hover:border-transparent group-hover:text-white transition-all"
                    >
                      Enter Boardroom
                      <ArrowRight className="size-4 ml-1" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
              <div className="size-14 rounded-2xl bg-[#E94560]/10 border border-[#E94560]/20 flex items-center justify-center mb-5">
                <Zap className="size-6 text-[#E94560]" />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">
                No active projects
              </h3>
              <p className="text-sm text-slate-400 max-w-xs leading-relaxed">
                Create a project to assign goals to your AI employees (CEO, PM, Sales, Recruiter) and initiate boardroom brainstorming.
              </p>
              <Button className="mt-6" onClick={() => setShowCreateModal(true)}>
                <Plus className="size-4" />
                Hire first team & start
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            className="w-full max-w-lg bg-[#0F0F1E] border border-white/10 rounded-2xl shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Briefcase className="size-4 text-[#E94560]" />
                Create New Project
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Modal content */}
            <form onSubmit={handleCreateProject}>
              <div className="p-6 space-y-4">
                <Input
                  label="Project Name"
                  placeholder="e.g. Acme DevTool Launch"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  required
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-300">
                    Project Goal / Master Task
                  </label>
                  <textarea
                    placeholder="Describe the overall objective you want your AI workforce to achieve. Be specific about target details, outputs, and challenges."
                    className="w-full min-h-[100px] rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E94560] focus:border-transparent transition-colors resize-none"
                    value={projectGoal}
                    onChange={(e) => setProjectGoal(e.target.value)}
                    required
                  />
                  <p className="text-[11px] text-slate-500">
                    Your hired employees will collaborate to detail a timeline, GTM plan, hiring needs, and product specifications.
                  </p>
                </div>

                {/* Pre-hired agents preview */}
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
                    Hired AI Workspace Team (4 Agents)
                  </h4>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { name: "CEO Ghost", icon: "👔", role: "Strategy" },
                      { name: "PM Ghost", icon: "🗺️", role: "Requirements" },
                      { name: "Sales Ghost", icon: "🤝", role: "GTM / Pricing" },
                      { name: "Recruiter Ghost", icon: "👥", role: "Hiring Plan" },
                    ].map((agent) => (
                      <div
                        key={agent.name}
                        className="flex items-center gap-2 bg-white/5 border border-white/5 rounded-lg p-2"
                      >
                        <span className="text-lg">{agent.icon}</span>
                        <div>
                          <div className="text-xs font-medium text-white">{agent.name}</div>
                          <div className="text-[10px] text-slate-400">{agent.role}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {formError && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
                    {formError}
                  </p>
                )}
              </div>

              {/* Modal footer */}
              <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/5 bg-white/[0.01]">
                <Button variant="ghost" type="button" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Hire Team & Launch</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
