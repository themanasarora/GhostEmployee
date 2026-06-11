// Lightweight in-memory store using localStorage for persistence
// Phase 2: replace with Firestore

import { EmployeeRole, EMPLOYEES } from "@/lib/plans";

export interface Project {
  id: string;
  name: string;
  description: string;
  plan: "basic" | "advanced" | null;
  hiredRoles: EmployeeRole[];
  goals: Goal[];
  createdAt: number;
}

export interface Goal {
  id: string;
  text: string;
  createdAt: number;
}

// Default 4 agents always available on Basic plan
export const DEFAULT_ROLES: EmployeeRole[] = ["ceo", "pm", "research", "growth"];

function storageKey(userId: string) {
  return `ghost_projects_${userId}`;
}

export function getProjects(userId: string): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveProjects(userId: string, projects: Project[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(userId), JSON.stringify(projects));
}

export function createProject(userId: string, name: string, description: string): Project {
  const project: Project = {
    id: crypto.randomUUID(),
    name,
    description,
    plan: null,
    hiredRoles: DEFAULT_ROLES,
    goals: [],
    createdAt: Date.now(),
  };
  const projects = getProjects(userId);
  projects.unshift(project);
  saveProjects(userId, projects);
  return project;
}

export function getProject(userId: string, projectId: string): Project | null {
  return getProjects(userId).find((p) => p.id === projectId) || null;
}

export function updateProject(userId: string, projectId: string, updates: Partial<Project>) {
  const projects = getProjects(userId);
  const idx = projects.findIndex((p) => p.id === projectId);
  if (idx === -1) return;
  projects[idx] = { ...projects[idx], ...updates };
  saveProjects(userId, projects);
  return projects[idx];
}

export function addGoal(userId: string, projectId: string, text: string): Goal {
  const goal: Goal = { id: crypto.randomUUID(), text, createdAt: Date.now() };
  const projects = getProjects(userId);
  const idx = projects.findIndex((p) => p.id === projectId);
  if (idx !== -1) {
    projects[idx].goals.unshift(goal);
    saveProjects(userId, projects);
  }
  return goal;
}

export function getEmployeeDetails(role: EmployeeRole) {
  return EMPLOYEES.find((e) => e.role === role)!;
}
