import { EMPLOYEES } from "@/lib/plans";

export type EmployeeRole =
  | "ceo" | "cto" | "pm" | "research"
  | "growth" | "sales" | "finance" | "recruiter";

export type MessageSender = "user" | EmployeeRole | "system";

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
}

export type TaskStatus = "pending" | "running" | "complete" | "failed";

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
  agentChats: Partial<Record<EmployeeRole, AgentChat>>;
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_ROLES: EmployeeRole[] = ["ceo", "pm", "research", "growth"];

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

export function createProject(userId: string, name: string, description: string): Project {
  const project: Project = {
    id: crypto.randomUUID(),
    name,
    description,
    plan: null,
    hiredRoles: DEFAULT_ROLES,
    goals: [],
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

export interface ContextWindow {
  projectName: string;
  projectDescription: string;
  hiredTeam: string;
  recentBoardRooms: string;
  agentChatHistory: string;
  tasks: string;
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
    g.tasks.map((t) => `[${t.assignedRole}] ${t.title}: ${t.status}${t.output ? ` — ${t.output.slice(0, 100)}` : ""}`)
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