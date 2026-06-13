"use client";

import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getProject, getEmployeeDetails, Project } from "@/lib/store";
import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ArrowLeft, MessageSquare, ChevronRight } from "lucide-react";

export default function ChatsOverviewPage() {
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

  return (
    <AppLayout projectId={id}>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push(`/project/${id}`)} className="text-slate-500 hover:text-white transition-colors">
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <MessageSquare className="size-4 text-slate-400" /> Agent Chats
            </h1>
            <p className="text-xs text-slate-500">{project.name} · 1-on-1 with any employee</p>
          </div>
        </div>

        <div className="bg-white/[0.03] border border-white/10 rounded-2xl divide-y divide-white/5">
          {project.hiredRoles.map((role) => {
            const emp = getEmployeeDetails(role);
            const chat = project.agentChats[role];
            const msgCount = chat?.messages.length ?? 0;
            const lastMsg = chat?.messages[chat.messages.length - 1];
            return (
              <div key={role} onClick={() => router.push(`/project/${id}/chat/${role}`)}
                className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] cursor-pointer transition-colors group">
                <div className="size-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xl shrink-0">{emp.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{emp.name}</p>
                  {lastMsg
                    ? <p className="text-xs text-slate-500 truncate mt-0.5">{lastMsg.content.slice(0, 60)}{lastMsg.content.length > 60 ? "..." : ""}</p>
                    : <p className="text-xs text-slate-600 mt-0.5">{emp.specialty} · No messages yet</p>}
                </div>
                {msgCount > 0 && (
                  <span className="text-[10px] font-bold bg-[#E94560]/15 text-[#E94560] px-2 py-0.5 rounded-full shrink-0">{msgCount}</span>
                )}
                <ChevronRight className="size-4 text-slate-600 group-hover:text-slate-400 shrink-0" />
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
