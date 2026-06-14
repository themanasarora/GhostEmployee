/**
 * GhostEmployee — localStorage store
 * Single source of truth for all client-side state.
 * Phase 2: replace with Postgres via API routes.
 *
 * Context model:
 *   Project
 *     └── Goals[]            (each goal = a board room)
 *           └── BoardMessages[]  (the persistent board conversation)
 *           └── Tasks[]          (agent tasks inside this goal)
 *     └── AgentChats{}       (one chat thread per employee role)
 *           └── ChatMessages[]
 */

import { EMPLOYEES } from "@/lib/plans";

export type EmployeeRole =
  | "ceo" | "cto" | "pm" | "research"
  | "growth" | "sales" | "finance" | "recruiter";

// ─── Message types ────────────────────────────────────────────────────────────

export type MessageSender = "user" | EmployeeRole | "system";

export interface Message {
  id: string;
  sender: MessageSender;       // "user" | role | "system"
  senderName: string;
  senderIcon: string;
  content: string;
  timestamp: number;
  isMock?: boolean;
  mentions?: EmployeeRole[];   // @-tagged agents in board room
  isUserInput?: boolean;       // true when user typed in board room
}

// ─── Task types ───────────────────────────────────────────────────────────────

export type TaskStatus = "pending" | "running" | "complete" | "failed" | "waiting_approval";

export interface Task {
  id: string;
  goalId: string;
  assignedRole: EmployeeRole;
  title: string;
  description: string;
  status: TaskStatus;
  output?: string;
  createdAt: number;
  completedAt?: number;
}

// ─── Goal / Board Room ────────────────────────────────────────────────────────

export interface Goal {
  id: string;
  projectId: string;
  text: string;
  boardMessages: Message[];   // the persistent board room conversation
  tasks: Task[];
  createdAt: number;
  lastActiveAt: number;
}

// ─── Agent chat thread ────────────────────────────────────────────────────────

export interface AgentChat {
  role: EmployeeRole;
  messages: Message[];
  lastActiveAt: number;
}

// ─── Project ──────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  description: string;
  plan: "basic" | "advanced" | null;
  hiredRoles: EmployeeRole[];
  goals: Goal[];
  agentChats: Partial<Record<EmployeeRole, AgentChat>>;
  taskEvents: any[];
  createdAt: number;
  updatedAt: number;
}

// ─── Default roles for Basic plan ────────────────────────────────────────────

export const DEFAULT_ROLES: EmployeeRole[] = ["ceo", "pm", "research", "growth"];

// ─── Storage helpers ──────────────────────────────────────────────────────────

function key(userId: string) {
  return `ghost_v2_${userId}`;
}

export function getProjects(userId: string): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key(userId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveProjects(userId: string, projects: Project[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key(userId), JSON.stringify(projects));
}

function mutateProject(
  userId: string,
  projectId: string,
  fn: (p: Project) => Project
): Project | null {
  const projects = getProjects(userId);
  const idx = projects.findIndex((p) => p.id === projectId);
  if (idx === -1) return null;
  projects[idx] = fn({ ...projects[idx] });
  saveProjects(userId, projects);
  return projects[idx];
}

// ─── Project CRUD ─────────────────────────────────────────────────────────────

export function createProject(
  userId: string,
  name: string,
  description: string
): Project {
  const project: Project = {
    id: crypto.randomUUID(),
    name,
    description,
    plan: null,
    hiredRoles: DEFAULT_ROLES,
    goals: [],
    agentChats: {},
    taskEvents: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const projects = getProjects(userId);
  projects.unshift(project);
  saveProjects(userId, projects);
  return project;
}

export function getProject(userId: string, projectId: string): Project | null {
  return getProjects(userId).find((p) => p.id === projectId) ?? null;
}

export function updateProject(
  userId: string,
  projectId: string,
  updates: Partial<Pick<Project, "name" | "description" | "plan" | "hiredRoles">>
): Project | null {
  return mutateProject(userId, projectId, (p) => ({
    ...p,
    ...updates,
    updatedAt: Date.now(),
  }));
}

export function deleteProject(userId: string, projectId: string): void {
  const projects = getProjects(userId);
  const filtered = projects.filter((p) => p.id !== projectId);
  saveProjects(userId, filtered);
}

// ─── Goal / Board Room CRUD ───────────────────────────────────────────────────

export function createGoal(
  userId: string,
  projectId: string,
  text: string
): Goal {
  const goal: Goal = {
    id: crypto.randomUUID(),
    projectId,
    text,
    boardMessages: [],
    tasks: [],
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  };
  mutateProject(userId, projectId, (p) => ({
    ...p,
    goals: [goal, ...p.goals],
  }));
  return goal;
}

export function getGoal(
  userId: string,
  projectId: string,
  goalId: string
): Goal | null {
  const project = getProject(userId, projectId);
  return project?.goals.find((g) => g.id === goalId) ?? null;
}

export function addBoardMessage(
  userId: string,
  projectId: string,
  goalId: string,
  message: Omit<Message, "id" | "timestamp">
): Message {
  const msg: Message = {
    ...message,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  mutateProject(userId, projectId, (p) => ({
    ...p,
    goals: p.goals.map((g) =>
      g.id === goalId
        ? { ...g, boardMessages: [...g.boardMessages, msg], lastActiveAt: Date.now() }
        : g
    ),
  }));
  return msg;
}

export function addTask(
  userId: string,
  projectId: string,
  goalId: string,
  task: Omit<Task, "id" | "createdAt">
): Task {
  const t: Task = { ...task, id: crypto.randomUUID(), createdAt: Date.now() };
  mutateProject(userId, projectId, (p) => ({
    ...p,
    goals: p.goals.map((g) =>
      g.id === goalId ? { ...g, tasks: [...g.tasks, t] } : g
    ),
  }));
  return t;
}

export function updateTask(
  userId: string,
  projectId: string,
  goalId: string,
  taskId: string,
  updates: Partial<Pick<Task, "status" | "output" | "completedAt">>
) {
  mutateProject(userId, projectId, (p) => ({
    ...p,
    goals: p.goals.map((g) =>
      g.id === goalId
        ? {
            ...g,
            tasks: g.tasks.map((t) =>
              t.id === taskId ? { ...t, ...updates } : t
            ),
          }
        : g
    ),
  }));
}

// ─── Agent chat CRUD ──────────────────────────────────────────────────────────

export function getAgentChat(
  userId: string,
  projectId: string,
  role: EmployeeRole
): AgentChat | null {
  const project = getProject(userId, projectId);
  return project?.agentChats[role] ?? null;
}

export function addAgentChatMessage(
  userId: string,
  projectId: string,
  role: EmployeeRole,
  message: Omit<Message, "id" | "timestamp">
): Message {
  const msg: Message = {
    ...message,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  mutateProject(userId, projectId, (p) => {
    const existing = p.agentChats[role];
    return {
      ...p,
      agentChats: {
        ...p.agentChats,
        [role]: {
          role,
          messages: [...(existing?.messages ?? []), msg],
          lastActiveAt: Date.now(),
        },
      },
    };
  });
  return msg;
}

// ─── Context window builder ───────────────────────────────────────────────────
// Builds the full context for an AI call: project info + relevant history

export interface ContextWindow {
  projectName: string;
  projectDescription: string;
  hiredTeam: string;
  recentBoardRooms: string;   // summaries of all goal board rooms
  agentChatHistory: string;   // this agent's chat history
  tasks: string;              // all tasks across all goals
}

export function buildContextWindow(
  project: Project,
  targetRole?: EmployeeRole,
  currentGoalId?: string
): ContextWindow {
  const team = project.hiredRoles
    .map((r) => {
      const emp = EMPLOYEES.find((e) => e.role === r);
      return emp ? `${emp.name} (${emp.specialty})` : r;
    })
    .join(", ");

  // Board rooms: last 20 messages per goal, newest goals first
  const boardRooms = project.goals
    .slice(0, 5) // last 5 goals for context
    .map((g) => {
      const isCurrentGoal = g.id === currentGoalId;
      const msgs = isCurrentGoal
        ? g.boardMessages.slice(-30) // more context for current goal
        : g.boardMessages.slice(-10);
      const transcript = msgs
        .map((m) => `[${m.senderName}]: ${m.content}`)
        .join("\n");
      return `Goal: "${g.text}"\n${transcript || "(no messages yet)"}`;
    })
    .join("\n\n---\n\n");

  // Agent's own chat history
  const agentHistory = targetRole
    ? (project.agentChats[targetRole]?.messages ?? [])
        .slice(-20)
        .map((m) => `[${m.senderName}]: ${m.content}`)
        .join("\n")
    : "";

  // Tasks
  const allTasks = project.goals.flatMap((g) =>
    g.tasks.map(
      (t) => `[${t.assignedRole}] ${t.title}: ${t.status}${t.output ? ` — ${t.output.slice(0, 100)}` : ""}`
    )
  );

  return {
    projectName: project.name,
    projectDescription: project.description,
    hiredTeam: team,
    recentBoardRooms: boardRooms,
    agentChatHistory: agentHistory,
    tasks: allTasks.join("\n") || "No tasks yet.",
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getEmployeeDetails(role: EmployeeRole) {
  return EMPLOYEES.find((e) => e.role === role)!;
}

export function parseMentions(text: string): EmployeeRole[] {
  const allRoles: EmployeeRole[] = [
    "ceo", "cto", "pm", "research", "growth", "sales", "finance", "recruiter",
  ];
  const mentioned: EmployeeRole[] = [];
  const lower = text.toLowerCase();
  for (const role of allRoles) {
    if (lower.includes(`@${role}`) || lower.includes(`@${role} `)) {
      mentioned.push(role);
    }
  }
  return mentioned;
}

// ─── Workflow types ───────────────────────────────────────────────────────────

export type WorkflowStatus =
  | "idle"
  | "researching"
  | "generating"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "complete";

export interface WorkflowState {
  taskId: string;
  goalId: string;
  projectId: string;
  assignedRole: EmployeeRole;
  status: WorkflowStatus;
  steps: WorkflowStep[];
  finalOutput?: string;
  createdAt: number;
  updatedAt: number;
}

export interface WorkflowStep {
  id: string;
  label: string;
  status: "pending" | "running" | "complete" | "failed";
  output?: string;
  createdAt: number;
}

// ─── Workflow CRUD ────────────────────────────────────────────────────────────

export function createWorkflow(
  userId: string,
  projectId: string,
  goalId: string,
  taskId: string,
  role: EmployeeRole
): WorkflowState {
  const workflow: WorkflowState = {
    taskId,
    goalId,
    projectId,
    assignedRole: role,
    status: "idle",
    steps: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  // Store workflow in task output field as JSON
  updateTask(userId, projectId, goalId, taskId, {
    status: "running",
    output: JSON.stringify({ workflow }),
  });
  return workflow;
}

export function getWorkflowFromTask(
  userId: string,
  projectId: string,
  goalId: string,
  taskId: string
): WorkflowState | null {
  const goal = getGoal(userId, projectId, goalId);
  const task = goal?.tasks.find((t) => t.id === taskId);
  if (!task?.output) return null;
  try {
    const parsed = JSON.parse(task.output);
    return parsed.workflow ?? null;
  } catch { return null; }
}

export function saveWorkflow(
  userId: string,
  projectId: string,
  goalId: string,
  taskId: string,
  workflow: WorkflowState
) {
  updateTask(userId, projectId, goalId, taskId, {
    output: JSON.stringify({ workflow }),
    status: workflow.status === "complete" ? "complete"
      : workflow.status === "approved" ? "complete"
      : "running",
  });
}

// ─── CEO task extraction ──────────────────────────────────────────────────────

export function detectSalesIntent(text: string): boolean {
  const salesKeywords = [
    "lead", "leads", "outreach", "prospect", "sales", "customer",
    "acquisition", "pipeline", "email campaign", "cold email",
    "find customers", "get customers", "sell", "revenue", "convert",
  ];
  const lower = text.toLowerCase();
  return salesKeywords.some((kw) => lower.includes(kw));
}

export function detectWorkflowTrigger(messages: Message[]): {
  shouldTrigger: boolean;
  role: EmployeeRole | null;
  reason: string;
} {
  const lastFew = messages.slice(-5);
  const combined = lastFew.map((m) => m.content).join(" ").toLowerCase();

  if (detectSalesIntent(combined)) {
    return { shouldTrigger: true, role: "sales", reason: "Sales/outreach activity detected in board discussion" };
  }
  return { shouldTrigger: false, role: null, reason: "" };
}

// ─── Extended Task types (for PR's task execution engine) ─────────────────────

export type TaskAction = "email" | "slack" | "research" | "ats" | "browser" | "calendar" | "approval" | "report";
export type TaskSource = "user" | "agent";
export type ApprovalState = "not_needed" | "needed" | "approved" | "rejected";

export interface TaskLog {
  id: string;
  title: string;
  detail: string;
  level: "info" | "success" | "warning" | "error" | "approval";
  role?: EmployeeRole;
  createdAt: number;
}

export interface TaskArtifact {
  title: string;
  content: string;
}

export interface TaskEvent {
  id: string;
  title: string;
  detail: string;
  role?: EmployeeRole;
  createdAt: number;
}

// Extended Task — superset of base Task
export interface ExtendedTask extends Task {
  source: TaskSource;
  action: TaskAction;
  logs: TaskLog[];
  approvalState: ApprovalState;
  approvalReason?: string;
  deliveryMode?: "draft" | "send";
  payload?: Record<string, any>;
  goalText?: string;
  startedAt?: number;
  artifact?: TaskArtifact;
}

// ─── Upgrade existing store to support extended tasks + taskEvents ────────────

export function getProjectTasks(project: Project): ExtendedTask[] {
  return project.goals.flatMap((g) =>
    g.tasks.map((t: any) => ({
      source: "user" as TaskSource,
      action: "research" as TaskAction,
      logs: [],
      approvalState: "not_needed" as ApprovalState,
      ...t,
      goalText: g.text,
    })) as ExtendedTask[]
  ).sort((a, b) => b.createdAt - a.createdAt);
}

export function getTaskById(
  userId: string,
  projectId: string,
  taskId: string
): { task: ExtendedTask; goalId: string } | null {
  const project = getProject(userId, projectId);
  if (!project) return null;
  for (const goal of project.goals) {
    const task = goal.tasks.find((t) => t.id === taskId);
    if (task) {
      return {
        task: { source: "user", action: "research", logs: [], approvalState: "not_needed", ...task, goalText: goal.text } as ExtendedTask,
        goalId: goal.id,
      };
    }
  }
  return null;
}

export function deriveTaskAssignee(action: TaskAction): EmployeeRole {
  const map: Record<TaskAction, EmployeeRole> = {
    email: "sales",
    slack: "growth",
    research: "research",
    ats: "recruiter",
    browser: "cto",
    calendar: "pm",
    approval: "ceo",
    report: "pm",
  };
  return map[action] ?? "ceo";
}

export function markTaskRunning(
  userId: string,
  projectId: string,
  goalId: string,
  taskId: string,
  detail: string
) {
  mutateProjectInternal(userId, projectId, (p) => ({
    ...p,
    goals: p.goals.map((g: any) =>
      g.id !== goalId ? g : {
        ...g,
        tasks: g.tasks.map((t: any) =>
          t.id !== taskId ? t : {
            ...t,
            status: "running" as TaskStatus,
            startedAt: Date.now(),
          }
        ),
      }
    ),
    taskEvents: [
      ...(p.taskEvents ?? []),
      { id: crypto.randomUUID(), title: "Task started", detail, createdAt: Date.now() },
    ],
  }));
}

export function completeTask(
  userId: string,
  projectId: string,
  goalId: string,
  taskId: string,
  output: string
) {
  mutateProjectInternal(userId, projectId, (p) => ({
    ...p,
    goals: p.goals.map((g: any) =>
      g.id !== goalId ? g : {
        ...g,
        tasks: g.tasks.map((t: any) =>
          t.id !== taskId ? t : {
            ...t,
            status: "complete" as TaskStatus,
            output,
            completedAt: Date.now(),
          }
        ),
      }
    ),
    taskEvents: [
      ...(p.taskEvents ?? []),
      { id: crypto.randomUUID(), title: "Task completed", detail: output.slice(0, 120), createdAt: Date.now() },
    ],
  }));
}

export function requestTaskApproval(
  userId: string,
  projectId: string,
  goalId: string,
  taskId: string,
  reason: string
) {
  mutateProjectInternal(userId, projectId, (p) => ({
    ...p,
    goals: p.goals.map((g: any) =>
      g.id !== goalId ? g : {
        ...g,
        tasks: g.tasks.map((t: any) =>
          t.id !== taskId ? t : {
            ...t,
            status: "pending" as TaskStatus,
            approvalState: "needed",
            approvalReason: reason,
          }
        ),
      }
    ),
  }));
}

export function resolveTaskApproval(
  userId: string,
  projectId: string,
  goalId: string,
  taskId: string,
  approved: boolean,
  note: string
) {
  mutateProjectInternal(userId, projectId, (p) => ({
    ...p,
    goals: p.goals.map((g: any) =>
      g.id !== goalId ? g : {
        ...g,
        tasks: g.tasks.map((t: any) =>
          t.id !== taskId ? t : {
            ...t,
            status: approved ? "pending" : "failed" as TaskStatus,
            approvalState: approved ? "approved" : "rejected",
          }
        ),
      }
    ),
    taskEvents: [
      ...(p.taskEvents ?? []),
      { id: crypto.randomUUID(), title: approved ? "Task approved" : "Task rejected", detail: note, createdAt: Date.now() },
    ],
  }));
}

export function deliverTaskArtifact(
  userId: string,
  projectId: string,
  goalId: string,
  taskId: string,
  _role: EmployeeRole,
  artifact: TaskArtifact
) {
  mutateProjectInternal(userId, projectId, (p) => ({
    ...p,
    goals: p.goals.map((g: any) =>
      g.id !== goalId ? g : {
        ...g,
        tasks: g.tasks.map((t: any) =>
          t.id !== taskId ? t : { ...t, artifact }
        ),
      }
    ),
  }));
}

export function appendTaskLog(
  userId: string,
  projectId: string,
  goalId: string,
  taskId: string,
  log: Omit<TaskLog, "id" | "createdAt">
) {
  const entry: TaskLog = { ...log, id: crypto.randomUUID(), createdAt: Date.now() };
  mutateProjectInternal(userId, projectId, (p) => ({
    ...p,
    goals: p.goals.map((g: any) =>
      g.id !== goalId ? g : {
        ...g,
        tasks: g.tasks.map((t: any) =>
          t.id !== taskId ? t : {
            ...t,
            logs: [...((t as any).logs ?? []), entry],
          }
        ),
      }
    ),
    taskEvents: [
      ...(p.taskEvents ?? []),
      { id: crypto.randomUUID(), title: log.title, detail: log.detail, role: log.role, createdAt: Date.now() },
    ],
  }));
}

// Internal mutate helper (same as mutateProject but accessible here)
function mutateProjectInternal(
  userId: string,
  projectId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: (p: any) => any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const projects = getProjects(userId);
  const idx = projects.findIndex((p) => p.id === projectId);
  if (idx === -1) return null;
  projects[idx] = fn({ ...projects[idx] });
  saveProjects(userId, projects);
  return projects[idx];
}
