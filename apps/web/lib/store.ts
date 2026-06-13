import { EMPLOYEES } from "@/lib/plans";

export type EmployeeRole =
  | "ceo" | "cto" | "pm" | "research"
  | "growth" | "sales" | "finance" | "recruiter";

export type MessageSender = "user" | EmployeeRole | "system";

export type TaskSource = "user" | "agent";

export type TaskAction =
  | "email"
  | "slack"
  | "research"
  | "ats"
  | "browser"
  | "calendar"
  | "approval"
  | "report";

export type TaskStatus = "pending" | "running" | "waiting_approval" | "complete" | "failed";

export type TaskApprovalState = "not_needed" | "needed" | "requested" | "approved" | "rejected";

export type TaskLogLevel = "info" | "approval" | "success" | "warning" | "error";

export interface Message {
  id: string;
  sender: MessageSender;
  senderName: string;
  senderIcon: string;
  content: string;
  timestamp: number;
  isMock?: boolean;
  mentions?: EmployeeRole[];
  isUserInput?: boolean;
  kind?: "text" | "artifact" | "approval";
  taskId?: string;
  artifactTitle?: string;
}

export interface Task {
  id: string;
  goalId: string;
  source: TaskSource;
  action: TaskAction;
  deliveryMode?: "draft" | "send";
  assignedRole: EmployeeRole;
  title: string;
  description: string;
  status: TaskStatus;
  approvalState: TaskApprovalState;
  approvalReason?: string;
  output?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  logs: TaskLogEntry[];
  payload?: any;
}

export interface TaskLogEntry {
  id: string;
  taskId: string;
  title: string;
  detail: string;
  level: TaskLogLevel;
  createdAt: number;
  role?: EmployeeRole;
}

export interface Goal {
  id: string;
  projectId: string;
  text: string;
  boardMessages: Message[];
  tasks: Task[];
  createdAt: number;
  lastActiveAt: number;
}

export interface AgentChat {
  role: EmployeeRole;
  messages: Message[];
  lastActiveAt: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  plan: "basic" | "advanced" | null;
  hiredRoles: EmployeeRole[];
  goals: Goal[];
  taskEvents: TaskLogEntry[];
  agentChats: Partial<Record<EmployeeRole, AgentChat>>;
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_ROLES: EmployeeRole[] = ["ceo", "pm", "research", "growth"];

function key(userId: string) {
  return `ghost_v2_${userId}`;
}

function normalizeTask(task: any): Task {
  return {
    ...task,
    source: task.source ?? "user",
    action: task.action ?? "report",
    deliveryMode: task.deliveryMode ?? "send",
    approvalState: task.approvalState ?? "not_needed",
    logs: Array.isArray(task.logs) ? task.logs : [],
  };
}

function normalizeProject(project: any): Project {
  return {
    ...project,
    goals: Array.isArray(project.goals)
      ? project.goals.map((goal: any) => ({
          ...goal,
          boardMessages: Array.isArray(goal.boardMessages) ? goal.boardMessages : [],
          tasks: Array.isArray(goal.tasks) ? goal.tasks.map(normalizeTask) : [],
        }))
      : [],
    taskEvents: Array.isArray(project.taskEvents) ? project.taskEvents : [],
    agentChats: project.agentChats ?? {},
  };
}

export function getProjects(userId: string): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key(userId));
    return raw ? (JSON.parse(raw) as Project[]).map(normalizeProject) : [];
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

export function createProject(userId: string, name: string, description: string): Project {
  const project: Project = {
    id: crypto.randomUUID(),
    name,
    description,
    plan: null,
    hiredRoles: DEFAULT_ROLES,
    goals: [],
    taskEvents: [],
    agentChats: {},
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

export function createGoal(userId: string, projectId: string, text: string): Goal {
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

export function deriveTaskAssignee(action: TaskAction): EmployeeRole {
  if (action === "email" || action === "slack") return "sales";
  if (action === "research" || action === "browser") return "research";
  if (action === "ats") return "recruiter";
  if (action === "calendar") return "pm";
  if (action === "approval") return "ceo";
  return "pm";
}

export function getProjectTasks(project: Project) {
  return project.goals
    .flatMap((g) => g.tasks.map((t) => ({ ...t, goalText: g.text, goalId: g.id })))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getTaskById(userId: string, projectId: string, taskId: string) {
  const project = getProject(userId, projectId);
  if (!project) return null;
  for (const goal of project.goals) {
    const task = goal.tasks.find((t) => t.id === taskId);
    if (task) return { task, goal };
  }
  return null;
}

export function getGoal(userId: string, projectId: string, goalId: string): Goal | null {
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
  task: Omit<Task, "id" | "createdAt" | "logs">
): Task {
  const now = Date.now();
  const t: Task = {
    ...task,
    id: crypto.randomUUID(),
    createdAt: now,
    logs: [],
  };
  const createdLog: TaskLogEntry = {
    id: crypto.randomUUID(),
    taskId: t.id,
    title: "Task created",
    detail: `${task.source === "agent" ? "Agent" : "User"} task assigned to ${task.assignedRole}.`,
    level: "info",
    createdAt: now,
    role: task.assignedRole,
  };
  t.logs = [createdLog];
  mutateProject(userId, projectId, (p) => ({
    ...p,
    taskEvents: [createdLog, ...p.taskEvents],
    goals: p.goals.map((g) =>
      g.id === goalId ? { ...g, tasks: [...g.tasks, t], lastActiveAt: Date.now() } : g
    ),
    updatedAt: Date.now(),
  }));
  return t;
}

export function updateTask(
  userId: string,
  projectId: string,
  goalId: string,
  taskId: string,
  updates: Partial<Pick<Task, "status" | "output" | "completedAt" | "approvalState" | "approvalReason" | "startedAt">>
) {
  mutateProject(userId, projectId, (p) => ({
    ...p,
    goals: p.goals.map((g) =>
      g.id === goalId
        ? { ...g, tasks: g.tasks.map((t) => t.id === taskId ? { ...t, ...updates } : t) }
        : g
    ),
  }));
}

export function getAgentChat(userId: string, projectId: string, role: EmployeeRole): AgentChat | null {
  const project = getProject(userId, projectId);
  return project?.agentChats[role] ?? null;
}

export function addAgentChatMessage(
  userId: string,
  projectId: string,
  role: EmployeeRole,
  message: Omit<Message, "id" | "timestamp">
): Message {
  const msg: Message = { ...message, id: crypto.randomUUID(), timestamp: Date.now() };
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

export function addTaskEvent(
  userId: string,
  projectId: string,
  event: Omit<TaskLogEntry, "id" | "createdAt">
): TaskLogEntry {
  const entry: TaskLogEntry = {
    ...event,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  mutateProject(userId, projectId, (p) => ({
    ...p,
    taskEvents: [entry, ...p.taskEvents],
    updatedAt: Date.now(),
  }));
  return entry;
}

export function appendTaskLog(
  userId: string,
  projectId: string,
  goalId: string,
  taskId: string,
  log: Omit<TaskLogEntry, "id" | "createdAt" | "taskId">
) {
  const entry: TaskLogEntry = {
    ...log,
    id: crypto.randomUUID(),
    taskId,
    createdAt: Date.now(),
  };
  mutateProject(userId, projectId, (p) => ({
    ...p,
    taskEvents: [entry, ...p.taskEvents],
    goals: p.goals.map((g) =>
      g.id === goalId
        ? {
            ...g,
            tasks: g.tasks.map((task) =>
              task.id === taskId
                ? { ...task, logs: [...task.logs, entry] }
                : task
            ),
            lastActiveAt: Date.now(),
          }
        : g
    ),
    updatedAt: Date.now(),
  }));
  return entry;
}

export function requestTaskApproval(
  userId: string,
  projectId: string,
  goalId: string,
  taskId: string,
  reason: string
) {
  updateTask(userId, projectId, goalId, taskId, {
    status: "waiting_approval",
    approvalState: "requested",
    approvalReason: reason,
  });
  appendTaskLog(userId, projectId, goalId, taskId, {
    title: "Approval needed",
    detail: reason,
    level: "approval",
  });
}

export function resolveTaskApproval(
  userId: string,
  projectId: string,
  goalId: string,
  taskId: string,
  approved: boolean,
  reason: string
) {
  updateTask(userId, projectId, goalId, taskId, {
    approvalState: approved ? "approved" : "rejected",
    status: approved ? "running" : "failed",
  });
  appendTaskLog(userId, projectId, goalId, taskId, {
    title: approved ? "Approval granted" : "Approval rejected",
    detail: reason,
    level: approved ? "success" : "warning",
  });
}

export function markTaskRunning(
  userId: string,
  projectId: string,
  goalId: string,
  taskId: string,
  detail: string
) {
  updateTask(userId, projectId, goalId, taskId, {
    status: "running",
    startedAt: Date.now(),
  });
  appendTaskLog(userId, projectId, goalId, taskId, {
    title: "Task started",
    detail,
    level: "info",
  });
}

export function completeTask(
  userId: string,
  projectId: string,
  goalId: string,
  taskId: string,
  output: string
) {
  updateTask(userId, projectId, goalId, taskId, {
    status: "complete",
    output,
    completedAt: Date.now(),
  });
  appendTaskLog(userId, projectId, goalId, taskId, {
    title: "Task complete",
    detail: output,
    level: "success",
  });
}

export function deliverTaskArtifact(
  userId: string,
  projectId: string,
  goalId: string,
  taskId: string,
  role: EmployeeRole,
  payload: { title: string; content: string }
) {
  const emp = getEmployeeDetails(role);
  addAgentChatMessage(userId, projectId, role, {
    sender: role,
    senderName: emp.name,
    senderIcon: emp.icon,
    content: payload.content,
    kind: "artifact",
    taskId,
    artifactTitle: payload.title,
  });
  appendTaskLog(userId, projectId, goalId, taskId, {
    title: `Artifact delivered to ${emp.name}`,
    detail: payload.title,
    level: "success",
    role,
  });
}

export interface ContextWindow {
  projectName: string;
  projectDescription: string;
  hiredTeam: string;
  recentBoardRooms: string;
  agentChatHistory: string;
  tasks: string;
  taskEvents: string;
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

  const boardRooms = project.goals
    .slice(0, 5)
    .map((g) => {
      const msgs = g.id === currentGoalId ? g.boardMessages.slice(-30) : g.boardMessages.slice(-10);
      const transcript = msgs.map((m) => `[${m.senderName}]: ${m.content}`).join("\n");
      return `Goal: "${g.text}"\n${transcript || "(no messages yet)"}`;
    })
    .join("\n\n---\n\n");

  const agentHistory = targetRole
    ? (project.agentChats[targetRole]?.messages ?? [])
        .slice(-20)
        .map((m) => `[${m.senderName}]: ${m.content}`)
        .join("\n")
    : "";

  const allTasks = project.goals.flatMap((g) =>
    g.tasks.map((t) => `[${t.assignedRole}] ${t.title}: ${t.status} (${t.action}${t.approvalState !== "not_needed" ? `, approval:${t.approvalState}` : ""})${t.output ? ` — ${t.output.slice(0, 100)}` : ""}`)
  );
  const taskEvents = project.taskEvents
    .slice(0, 25)
    .map((event) => `${new Date(event.createdAt).toLocaleString()} [${event.role ?? "system"}] ${event.title}: ${event.detail}`);

  return {
    projectName: project.name,
    projectDescription: project.description,
    hiredTeam: team,
    recentBoardRooms: boardRooms,
    agentChatHistory: agentHistory,
    tasks: allTasks.join("\n") || "No tasks yet.",
    taskEvents: taskEvents.join("\n") || "No task events yet.",
  };
}

export function getEmployeeDetails(role: EmployeeRole) {
  return EMPLOYEES.find((e) => e.role === role)!;
}

export function parseMentions(text: string): EmployeeRole[] {
  const allRoles: EmployeeRole[] = ["ceo", "cto", "pm", "research", "growth", "sales", "finance", "recruiter"];
  const mentioned: EmployeeRole[] = [];
  const lower = text.toLowerCase();
  for (const role of allRoles) {
    if (lower.includes(`@${role}`)) mentioned.push(role);
  }
  return mentioned;
}