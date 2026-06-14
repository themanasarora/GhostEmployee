"use client";

import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  getProject,
  createGoal,
  Project,
  getEmployeeDetails,
  deleteProject,
  getProjectTasks,
  addTask,
  updateTask,
  deriveTaskAssignee,
  EmployeeRole,
  TaskAction,
} from "@/lib/store";
import { getProviderConnections, setProviderConnection, mapActionToProvider } from "@/lib/providers";
import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Plus,
  Zap,
  MessageSquare,
  Target,
  ChevronRight,
  X,
  Settings,
  Clock,
  Trash2,
  Mail,
  Calendar,
  Briefcase,
  AlertTriangle,
  Check,
  CheckCircle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalText, setGoalText] = useState("");
  const [adding, setAdding] = useState(false);

  // New States
  const [isDescExpanded, setIsDescExpanded] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [connections, setConnections] = useState<Record<string, any>>({});

  // Inline Task Creation States
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskAction, setTaskAction] = useState<TaskAction>("email");
  const [taskGoalId, setTaskGoalId] = useState("");
  const [taskCreating, setTaskCreating] = useState(false);

  function refresh() {
    if (!user) return;
    const p = getProject(user.uid, id);
    if (!p) { router.replace("/dashboard"); return; }
    if (!p.plan) { router.replace(`/project/${id}/plan`); return; }
    setProject(p);
    if (p.goals[0] && !taskGoalId) {
      setTaskGoalId(p.goals[0].id);
    }
  }

  useEffect(() => { refresh(); }, [user, id]);

  useEffect(() => {
    if (!user) return;
    setConnections(getProviderConnections(user.uid));

    async function syncProviders() {
      if (!user) return;
      try {
        const response = await fetch(`/api/gmail/status?userId=${encodeURIComponent(user.uid)}`);
        const data = await response.json();
        if (data.connected) {
          setProviderConnection(user.uid, {
            providerId: "gmail",
            connected: true,
            connectedAt: data.connectedAt ?? Date.now(),
            label: data.label ?? "Gmail",
            accountHint: data.accountHint ?? user.email ?? undefined,
            lastUsedAt: Date.now(),
          });
        }
      } catch (e) {}

      try {
        const response = await fetch(`/api/calendar/status?userId=${encodeURIComponent(user.uid)}`);
        const data = await response.json();
        if (data.connected) {
          setProviderConnection(user.uid, {
            providerId: "googleCalendar",
            connected: true,
            connectedAt: data.connectedAt ?? Date.now(),
            label: data.label ?? "Google Calendar",
            accountHint: data.accountHint ?? user.email ?? undefined,
            lastUsedAt: Date.now(),
          });
        }
      } catch (e) {}

      try {
        const response = await fetch(`/api/slack/status?userId=${encodeURIComponent(user.uid)}`);
        const data = await response.json();
        if (data.connected) {
          setProviderConnection(user.uid, {
            providerId: "slack",
            connected: true,
            connectedAt: data.connectedAt ?? Date.now(),
            label: data.label ?? "Slack Workspace",
            lastUsedAt: Date.now(),
          });
        }
      } catch (e) {}

      setConnections(getProviderConnections(user.uid));
    }

    void syncProviders();
  }, [user]);

  async function handleAddGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !goalText.trim() || !project) return;
    setAdding(true);
    const goal = createGoal(user.uid, id, goalText.trim());
    setGoalText("");
    setAdding(false);
    setShowGoalModal(false);
    router.push(`/project/${id}/goal/${goal.id}`);
  }

  async function handleDeleteProject() {
    if (!user || deleting) return;
    setDeleting(true);
    deleteProject(user.uid, id);
    router.push("/dashboard");
  }

  async function handleCreateInlineTask(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !project || !taskTitle.trim() || taskCreating) return;
    taskCreating;

    let targetGoalId = taskGoalId;
    if (!targetGoalId) {
      if (project.goals[0]) {
        targetGoalId = project.goals[0].id;
      } else {
        const defaultGoal = createGoal(user.uid, id, "Main Goal");
        targetGoalId = defaultGoal.id;
      }
    }

    setTaskCreating(true);
    addTask(user.uid, id, targetGoalId, {
      goalId: targetGoalId,
      assignedRole: deriveTaskAssignee(taskAction),
      title: taskTitle.trim(),
      description: taskDescription.trim(),
      status: "pending",
    } as any);

    setTaskTitle("");
    setTaskDescription("");
    setTaskCreating(false);
    refresh();
  }

  async function handleResolveTaskApproval(goalId: string, taskId: string, approved: boolean) {
    if (!user) return;
    updateTask(user.uid, id, goalId, taskId, {
      status: approved ? "complete" : "failed",
      completedAt: Date.now(),
    });
    refresh();
  }

  if (!project) return (
    <div className="min-h-screen bg-[#0A0A14] flex items-center justify-center">
      <div className="size-8 rounded-full border-2 border-[#E94560] border-t-transparent animate-spin" />
    </div>
  );

  const isBasic = project.plan === "basic";
  const hiredRoles = isBasic ? ["ceo" as EmployeeRole] : project.hiredRoles;
  const employeeDetails = hiredRoles.map(getEmployeeDetails);
  const totalBoardMessages = project.goals.reduce((a, g) => a + g.boardMessages.length, 0);

  const unconnectedServices = [
    { id: "gmail", name: "Gmail", icon: Mail, desc: "Connect Gmail to draft and send messages.", href: `/api/gmail/connect/start?userId=${user?.uid}&returnTo=/project/${id}`, connected: !!connections.gmail?.connected },
    { id: "googleCalendar", name: "Google Calendar", icon: Calendar, desc: "Connect Google Calendar to schedule meetings.", href: `/api/calendar/connect/start?userId=${user?.uid}&returnTo=/project/${id}`, connected: !!connections.googleCalendar?.connected },
    { id: "slack", name: "Slack", icon: MessageSquare, desc: "Connect Slack to post workspace alerts.", href: "/settings", connected: !!connections.slack?.connected },
    { id: "ats", name: "ATS / hiring", icon: Briefcase, desc: "Connect ATS system to check pipelines.", isAts: true, connected: !!connections.ats?.connected }
  ];

  const unconnectedCount = unconnectedServices.filter(s => !s.connected).length;
  const allConnected = unconnectedCount === 0;

  return (
    <AppLayout projectId={id}>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-white">{project.name}</h1>
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                project.plan === "advanced" ? "bg-[#E94560]/15 text-[#E94560]" : "bg-indigo-500/15 text-indigo-400"
              )}>{project.plan}</span>
            </div>
            
            {/* Collapsible Context Box */}
            {project.description && (
              <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 mt-3 max-w-xl transition-all">
                <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => setIsDescExpanded(!isDescExpanded)}>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Project Context</span>
                  <span className="text-xs text-[#E94560] hover:underline flex items-center gap-0.5">
                    {isDescExpanded ? <><ChevronUp className="size-3" /> Hide Preview</> : <><ChevronDown className="size-3" /> Show Preview</>}
                  </span>
                </div>
                {isDescExpanded && (
                  <p className="text-xs text-slate-400 mt-2 whitespace-pre-line leading-relaxed">
                    {project.description}
                  </p>
                )}
              </div>
            )}
          </div>
          
          <div className="flex gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => router.push(`/project/${id}/plan`)}>
              <Settings className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-slate-500 hover:text-[#E94560] hover:bg-[#E94560]/10" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            {isBasic ? (
              /* CEO Bulletin for Basic Plan */
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">👔</span>
                  <div>
                    <h2 className="text-base font-bold text-white">CEO Bulletin</h2>
                    <p className="text-xs text-slate-500">Project status & strategic overview</p>
                  </div>
                </div>
                <div className="space-y-3 bg-white/[0.02] border border-white/5 rounded-xl p-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Strategic Rundown</p>
                  <div className="grid grid-cols-2 gap-4 text-xs text-slate-300">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Workforce Status</span>
                      <span className="font-semibold text-white">1 Active Agent (CEO)</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Total Goals</span>
                      <span className="font-semibold text-white">{project.goals.length} Strategic Goals</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Task Status</span>
                      <span className="font-semibold text-white">
                        {project.goals.reduce((acc, g) => acc + g.tasks.filter(t => t.status === "complete").length, 0)} / {project.goals.reduce((acc, g) => acc + g.tasks.length, 0)} Completed
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Latest Updates</span>
                      <span className="font-semibold text-white">
                        {getProjectTasks(project).length} Actions Logged
                      </span>
                    </div>
                  </div>
                </div>
                <div className="pt-2">
                  <Button fullWidth onClick={() => router.push(`/project/${id}/chat/ceo`)}>
                    Chat with CEO &rarr;
                  </Button>
                </div>
              </div>
            ) : (
              /* Board Rooms for Advanced Plan */
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Zap className="size-4 text-[#E94560]" /> Board Rooms
                    <span className="text-xs text-slate-500 font-normal">({project.goals.length})</span>
                  </h2>
                  <Button size="sm" onClick={() => setShowGoalModal(true)}>
                    <Plus className="size-4" /> New goal
                  </Button>
                </div>
                {project.goals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                    <Zap className="size-8 text-slate-600 mb-3" />
                    <p className="text-sm text-slate-400 mb-4">No goals yet. Each goal gets its own persistent board room.</p>
                    <Button size="sm" onClick={() => setShowGoalModal(true)}><Plus className="size-4" /> Create first goal</Button>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {project.goals.map((goal) => (
                      <div key={goal.id} onClick={() => router.push(`/project/${id}/goal/${goal.id}`)}
                        className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] cursor-pointer transition-colors group">
                        <div className="size-8 rounded-lg bg-[#E94560]/10 border border-[#E94560]/20 flex items-center justify-center shrink-0">
                          <Zap className="size-3.5 text-[#E94560]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{goal.text}</p>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-slate-500">{goal.boardMessages.length} messages</span>
                            <span className="text-xs text-slate-500">{goal.tasks.length} tasks</span>
                            <span className="text-xs text-slate-600 flex items-center gap-1">
                              <Clock className="size-3" />{new Date(goal.lastActiveAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="size-4 text-slate-600 group-hover:text-slate-400 shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Agent Chats */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <MessageSquare className="size-4 text-slate-400" /> Agent Chats
                </h2>
                <span className="text-xs text-slate-500">1-on-1 with {isBasic ? "CEO" : "any employee"}</span>
              </div>
              <div className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {employeeDetails.map((emp) => {
                  const chatCount = project.agentChats[emp.role]?.messages.length ?? 0;
                  return (
                    <button key={emp.role} onClick={() => router.push(`/project/${id}/chat/${emp.role}`)}
                      className="flex flex-col items-center text-center p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-[#E94560]/30 hover:bg-[#E94560]/5 transition-all">
                      <span className="text-xl mb-1">{emp.icon}</span>
                      <span className="text-xs font-medium text-white leading-tight">{emp.name.replace(" Ghost", "")}</span>
                      <span className={cn("text-[10px] mt-0.5", chatCount > 0 ? "text-[#E94560]" : "text-slate-600")}>
                        {chatCount > 0 ? `${chatCount} msgs` : "Start chat"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Panel: Tool Connectivity Hub OR Task Center */}
        {allConnected ? (
          /* Task & Approval Center */
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 space-y-6 mt-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <CheckCircle className="size-4 text-emerald-400" /> Tool Integrations & Task Center
                </h3>
                <p className="text-xs text-slate-500">All 4 external integrations connected. You can now compose tasks and manage approvals.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Task Composer Form */}
              <form onSubmit={handleCreateInlineTask} className="space-y-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Create Action Task</h4>
                
                <Input
                  label="Task Title"
                  placeholder="e.g. Email weekly sync invite"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  required
                />

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-300">Action Type</label>
                  <select
                    value={taskAction}
                    onChange={(e) => setTaskAction(e.target.value as TaskAction)}
                    className="w-full rounded-lg bg-[#0F0F1A] border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#E94560]"
                  >
                    {isBasic ? (
                      <>
                        <option value="email">Email (Gmail)</option>
                        <option value="slack">Slack</option>
                        <option value="calendar">Calendar (Google Calendar)</option>
                        <option value="ats">ATS / Hiring</option>
                      </>
                    ) : (
                      <>
                        <option value="research">Web Research</option>
                        <option value="email">Email (Gmail)</option>
                        <option value="slack">Slack</option>
                        <option value="ats">ATS / Hiring</option>
                        <option value="browser">Browser Automation</option>
                        <option value="calendar">Calendar (Google Calendar)</option>
                        <option value="report">Report</option>
                        <option value="approval">Approval Gate</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-300">Description / Body</label>
                  <textarea
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    placeholder="Explain what the agent should write or do in detail..."
                    rows={3}
                    className="w-full rounded-lg bg-[#0F0F1A] border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E94560] resize-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-300">Attach to Goal / Queue</label>
                  <select
                    value={taskGoalId}
                    onChange={(e) => setTaskGoalId(e.target.value)}
                    className="w-full rounded-lg bg-[#0F0F1A] border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#E94560]"
                  >
                    {project.goals.map((g) => (
                      <option key={g.id} value={g.id}>{g.text}</option>
                    ))}
                    {project.goals.length === 0 && (
                      <option value="">Create a new goal automatically</option>
                    )}
                  </select>
                </div>

                <Button type="submit" fullWidth loading={taskCreating}>Create & Route Task</Button>
              </form>

              {/* Approvals & Recent list */}
              <div className="space-y-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Pending Approvals & Log</h4>
                
                {(() => {
                  const tasks = getProjectTasks(project).filter(t => t.status === "waiting_approval");
                  if (tasks.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center p-6 bg-white/[0.01] border border-white/5 rounded-xl text-center">
                        <Check className="size-6 text-slate-500 mb-2" />
                        <p className="text-xs text-slate-400 font-medium">All tasks approved</p>
                        <p className="text-[10px] text-slate-600">Tasks waiting for human approval will show up here.</p>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2">
                      {tasks.map(task => (
                        <div key={task.id} className="p-4 bg-white/[0.02] border border-[#E94560]/20 rounded-xl space-y-3">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-[#E94560] bg-[#E94560]/10 px-2 py-0.5 rounded-full">{task.action}</span>
                            <h5 className="text-sm font-semibold text-white mt-1.5">{task.title}</h5>
                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{task.description}</p>
                          </div>
                          <div className="flex gap-2 pt-1">
                            <Button size="sm" onClick={() => handleResolveTaskApproval(task.goalId, task.id, true)}>Approve</Button>
                            <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white" onClick={() => handleResolveTaskApproval(task.goalId, task.id, false)}>Reject</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                <div className="pt-2">
                  <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Recent Task Events</h5>
                  <div className="space-y-2 max-h-[180px] overflow-y-auto pr-2">
                    {getProjectTasks(project).slice(0, 3).map(task => (
                      <div key={task.id} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.01] border border-white/5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={cn(
                            "size-2 rounded-full shrink-0",
                            task.status === "complete" ? "bg-emerald-500" :
                            task.status === "running" ? "bg-blue-500 animate-pulse" :
                            task.status === "waiting_approval" ? "bg-amber-500" : "bg-slate-600"
                          )} />
                          <span className="text-xs text-slate-300 font-medium truncate">{task.title}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 shrink-0 capitalize">{task.status.replace("_", " ")}</span>
                      </div>
                    ))}
                    {project.goals.reduce((acc, g) => acc + g.tasks.length, 0) === 0 && (
                      <p className="text-xs text-slate-500">No recent tasks or actions.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Connectivity Hub */
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 mt-6">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
              <AlertTriangle className="size-4 text-indigo-400 animate-pulse" /> Connect your tools ({unconnectedCount} remaining)
            </h3>
            <p className="text-xs text-slate-500 mb-4">Connect all 4 tools to unlock automated task runs, executive previews, and approving queues directly here.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {unconnectedServices.filter(s => !s.connected).map((serv) => {
                const Icon = serv.icon;
                return (
                  <div key={serv.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-col justify-between hover:border-white/10 transition-colors">
                    <div>
                      <div className="size-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-3">
                        <Icon className="size-4 text-indigo-400" />
                      </div>
                      <h4 className="text-sm font-semibold text-white">{serv.name}</h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{serv.desc}</p>
                    </div>
                    
                    <div className="mt-4">
                      {serv.isAts ? (
                        <Button
                          size="sm"
                          fullWidth
                          onClick={() => {
                            setProviderConnection(user!.uid, {
                              providerId: "ats",
                              connected: true,
                              connectedAt: Date.now(),
                              label: "ATS System",
                            });
                            setConnections(getProviderConnections(user!.uid));
                          }}
                        >
                          Connect ATS
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          fullWidth
                          onClick={() => serv.href && router.push(serv.href)}
                        >
                          Connect
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showGoalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowGoalModal(false)} />
          <div className="relative z-10 w-full max-w-md bg-[#0F0F1A] border border-white/15 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white">New goal</h2>
              <button onClick={() => setShowGoalModal(false)} className="text-slate-500 hover:text-white"><X className="size-4" /></button>
            </div>
            <form onSubmit={handleAddGoal} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-300">What should your team work on?</label>
                <textarea className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E94560] focus:border-transparent transition-colors resize-none"
                  placeholder='"Validate my AI resume optimizer startup idea"' rows={3}
                  value={goalText} onChange={(e) => setGoalText(e.target.value)} autoFocus required />
              </div>
              <p className="text-xs text-slate-500">Creates a persistent board room your team lives in.</p>
              <div className="flex gap-3">
                <Button variant="ghost" fullWidth type="button" onClick={() => setShowGoalModal(false)}>Cancel</Button>
                <Button fullWidth type="submit" loading={adding} disabled={!goalText.trim()}>Open board room</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative z-10 w-full max-w-md bg-[#0F0F1A] border border-white/15 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Trash2 className="size-5 text-[#E94560]" /> Delete project
            </h2>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              Are you sure you want to delete <span className="text-white font-semibold">{project.name}</span>? This will permanently delete this project, all associated tasks, goals, boardroom messages, and agent logs.
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Warning: This action is permanent and cannot be undone.
            </p>
            <div className="flex gap-3 mt-6">
              <Button variant="ghost" fullWidth onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
              <Button fullWidth className="bg-[#E94560] hover:bg-[#E94560]/80 text-white" onClick={handleDeleteProject} loading={deleting}>
                Delete Permanently
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}