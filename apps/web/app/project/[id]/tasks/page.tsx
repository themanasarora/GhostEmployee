"use client";

import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getProject, getEmployeeDetails, Project } from "@/lib/store";
import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ArrowLeft, Activity, CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TaskLogPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);

  useEffect(() => {
    if (!user) return;
    const p = getProject(user.uid, id);
    if (!p) { router.replace("/dashboard"); return; }
    setProject(p);
  }, [user, id]);

  if (!project) return (
    <div className="min-h-screen bg-[#0A0A14] flex items-center justify-center">
      <div className="size-8 rounded-full border-2 border-[#E94560] border-t-transparent animate-spin" />
    </div>
  );

  const allTasks = project.goals
    .flatMap((g) => g.tasks.map((t) => ({ ...t, goalText: g.text })))
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <AppLayout projectId={id}>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push(`/project/${id}`)} className="text-slate-500 hover:text-white transition-colors">
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Activity className="size-4 text-slate-400" /> Task Log
            </h1>
            <p className="text-xs text-slate-500">{project.name} · {allTasks.length} tasks</p>
          </div>
        </div>

        {allTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Activity className="size-10 text-slate-600 mb-3" />
            <p className="text-sm text-slate-400 mb-1">No tasks yet</p>
            <p className="text-xs text-slate-500">Tasks will appear here as agents complete work in board rooms.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {allTasks.map((task) => {
              const emp = getEmployeeDetails(task.assignedRole);
              return (
                <div key={task.id} className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">
                      {task.status === "complete" && <CheckCircle2 className="size-4 text-green-400" />}
                      {task.status === "pending" && <Clock className="size-4 text-yellow-400" />}
                      {task.status === "running" && <Loader2 className="size-4 text-blue-400 animate-spin" />}
                      {task.status === "failed" && <XCircle className="size-4 text-red-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-white">{task.title}</span>
                        <span className="text-xs text-slate-500">{emp.icon} {emp.name}</span>
                      </div>
                      <p className="text-xs text-slate-500 mb-1">Goal: {task.goalText}</p>
                      {task.output && (
                        <p className="text-xs text-slate-400 bg-white/5 rounded-lg px-3 py-2 mt-2 leading-relaxed">{task.output}</p>
                      )}
                      <p className="text-[10px] text-slate-600 mt-1.5">{new Date(task.createdAt).toLocaleString()}</p>
                    </div>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0",
                      task.status === "complete" ? "bg-green-500/15 text-green-400" :
                      task.status === "running" ? "bg-blue-500/15 text-blue-400" :
                      task.status === "failed" ? "bg-red-500/15 text-red-400" :
                      "bg-yellow-500/15 text-yellow-400"
                    )}>{task.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}