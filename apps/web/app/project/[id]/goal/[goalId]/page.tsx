"use client";

import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  getProject, getGoal, addBoardMessage, buildContextWindow,
  getEmployeeDetails, parseMentions, saveProjects, getProjects,
  Project, Goal, Message, EmployeeRole
} from "@/lib/store";
import { EMPLOYEES } from "@/lib/plans";
import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ArrowLeft, Send, Zap, AtSign, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export default function GoalBoardRoomPage() {
  const { id, goalId } = useParams<{ id: string; goalId: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function refresh() {
    if (!user) return;
    const p = getProject(user.uid, id);
    if (!p) { router.replace("/dashboard"); return; }
    const g = getGoal(user.uid, id, goalId);
    if (!g) { router.replace(`/project/${id}`); return; }
    setProject(p);
    setGoal(g);
  }

  useEffect(() => { refresh(); }, [user, id, goalId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [goal?.boardMessages.length]);

  function handleInputChange(val: string) {
    setInput(val);
    const lastAt = val.lastIndexOf("@");
    if (lastAt !== -1) {
      const after = val.slice(lastAt + 1);
      if (!after.includes(" ")) {
        setShowMentions(true);
        setMentionFilter(after.toLowerCase());
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  }

  function insertMention(role: EmployeeRole) {
    const lastAt = input.lastIndexOf("@");
    setInput(input.slice(0, lastAt) + `@${role} `);
    setShowMentions(false);
    inputRef.current?.focus();
  }

  async function callAgent(role: EmployeeRole, p: Project, g: Goal): Promise<{ content: string; isMock: boolean }> {
    const emp = getEmployeeDetails(role);
    const ctx = buildContextWindow(p, role, goalId);
    const systemPrompt = `You are ${emp.name}, an AI ${emp.specialty} specialist.
Role: ${emp.description}
Respond in 3-5 sentences from your role's perspective. Be specific and actionable.`;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: g.boardMessages.slice(-12).map((m) => ({
            role: m.sender === "user" ? "user" : "assistant",
            content: `[${m.senderName}]: ${m.content}`,
          })),
          systemPrompt,
          agentId: role,
          projectName: p.name,
          projectGoal: g.text,
          contextWindow: ctx,
          mode: "board",
        }),
      });
      const data = await res.json();
      return { content: data.content, isMock: data.isMock };
    } catch {
      return { content: `As ${emp.name}, I recommend proceeding carefully and validating assumptions first.`, isMock: true };
    }
  }

  async function handleSend() {
    if (!input.trim() || !project || !goal || running) return;
    setRunning(true);
    const text = input.trim();
    setInput("");
    setShowMentions(false);

    // Add user message
    addBoardMessage(user!.uid, id, goalId, {
      sender: "user",
      senderName: user?.displayName || "You",
      senderIcon: "👤",
      content: text,
      isUserInput: true,
    });
    refresh();

    // Determine responding agents
    const mentions = parseMentions(text);
    const respondingRoles: EmployeeRole[] =
      mentions.length > 0
        ? mentions.filter((r) => project.hiredRoles.includes(r))
        : goal.boardMessages.filter(m => m.sender !== "user" && m.sender !== "system").length === 0
        ? project.hiredRoles
        : [project.hiredRoles[0]];

    for (const role of respondingRoles) {
      const emp = getEmployeeDetails(role);

      // Add typing placeholder
      const typingId = crypto.randomUUID();
      const allProjects = getProjects(user!.uid);
      const pIdx = allProjects.findIndex((p) => p.id === id);
      if (pIdx !== -1) {
        const gIdx = allProjects[pIdx].goals.findIndex((g) => g.id === goalId);
        if (gIdx !== -1) {
          allProjects[pIdx].goals[gIdx].boardMessages.push({
            id: typingId, sender: role, senderName: emp.name, senderIcon: emp.icon,
            content: "...", timestamp: Date.now(),
          });
          saveProjects(user!.uid, allProjects);
          refresh();
        }
      }

      const freshP = getProject(user!.uid, id)!;
      const freshG = getGoal(user!.uid, id, goalId)!;
      const { content, isMock } = await callAgent(role, freshP, freshG);

      // Replace typing with real response
      const allP2 = getProjects(user!.uid);
      const pi = allP2.findIndex((p) => p.id === id);
      if (pi !== -1) {
        const gi = allP2[pi].goals.findIndex((g) => g.id === goalId);
        if (gi !== -1) {
          const mi = allP2[pi].goals[gi].boardMessages.findIndex((m) => m.id === typingId);
          if (mi !== -1) {
            allP2[pi].goals[gi].boardMessages[mi] = {
              ...allP2[pi].goals[gi].boardMessages[mi], content, isMock,
            };
            allP2[pi].goals[gi].lastActiveAt = Date.now();
            saveProjects(user!.uid, allP2);
            refresh();
          }
        }
      }

      await new Promise((r) => setTimeout(r, 400));
    }

    setRunning(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !showMentions) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape") setShowMentions(false);
  }

  const filteredEmployees = (project?.hiredRoles ?? [])
    .map(getEmployeeDetails)
    .filter((e) => !mentionFilter || e.role.includes(mentionFilter) || e.name.toLowerCase().includes(mentionFilter));

  if (!project || !goal) return (
    <div className="min-h-screen bg-[#0A0A14] flex items-center justify-center">
      <div className="size-8 rounded-full border-2 border-[#E94560] border-t-transparent animate-spin" />
    </div>
  );

  return (
    <AppLayout projectId={id}>
      <div className="flex flex-col" style={{ height: "100vh" }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/5 bg-[#0A0A14]/90 backdrop-blur-sm sticky top-0 z-20">
          <button onClick={() => router.push(`/project/${id}`)} className="text-slate-500 hover:text-white transition-colors">
            <ArrowLeft className="size-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Zap className="size-3.5 text-[#E94560] shrink-0" />
              <p className="text-sm font-semibold text-white truncate">{goal.text}</p>
            </div>
            <p className="text-xs text-slate-500">{goal.boardMessages.length} messages · {project.hiredRoles.length} agents active</p>
          </div>
          <button onClick={() => router.push(`/project/${id}/chats`)}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors shrink-0">
            <MessageSquare className="size-3.5" /> Chats
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
          <div className="max-w-3xl mx-auto w-full space-y-4">
            {goal.boardMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="size-12 rounded-2xl bg-[#E94560]/10 border border-[#E94560]/20 flex items-center justify-center mb-4">
                  <Zap className="size-5 text-[#E94560]" />
                </div>
                <h3 className="text-sm font-semibold text-white mb-2">Board room ready</h3>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed mb-4">
                  Type a message. All agents respond to your first message.
                  Use <span className="text-[#E94560] font-mono">@role</span> to mention specific agents.
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {project.hiredRoles.map((r) => {
                    const e = getEmployeeDetails(r);
                    return (
                      <span key={r} className="text-xs bg-white/5 border border-white/10 text-slate-400 px-2 py-1 rounded-full">
                        {e.icon} @{r}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {goal.boardMessages.map((msg, i) => (
              <MessageBubble key={msg.id || i} message={msg} />
            ))}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-white/5 bg-[#0A0A14]/90 backdrop-blur-sm px-4 py-3">
          <div className="max-w-3xl mx-auto relative">
            {showMentions && filteredEmployees.length > 0 && (
              <div className="absolute bottom-full mb-2 left-0 bg-[#0F0F1A] border border-white/15 rounded-xl shadow-2xl overflow-hidden z-30 min-w-[200px]">
                {filteredEmployees.map((emp) => (
                  <button key={emp.role} onClick={() => insertMention(emp.role)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left">
                    <span className="text-base">{emp.icon}</span>
                    <div>
                      <p className="text-xs font-medium text-white">{emp.name}</p>
                      <p className="text-[10px] text-slate-500">{emp.specialty}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 focus-within:border-[#E94560]/40 transition-colors">
              <button onClick={() => { setInput(input + "@"); setShowMentions(true); inputRef.current?.focus(); }}
                className="text-slate-500 hover:text-[#E94560] transition-colors mb-0.5 shrink-0" title="Mention agent">
                <AtSign className="size-4" />
              </button>
              <textarea ref={inputRef} value={input} onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message the board... use @ceo @pm @cto to mention agents"
                rows={1} className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none resize-none max-h-32 leading-relaxed"
                style={{ minHeight: "24px" }} />
              <button onClick={handleSend} disabled={!input.trim() || running}
                className="shrink-0 size-7 rounded-lg bg-[#E94560] flex items-center justify-center hover:bg-[#d63652] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {running
                  ? <div className="size-3 rounded-full border border-white border-t-transparent animate-spin" />
                  : <Send className="size-3.5 text-white" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-600 mt-1.5 px-1">Enter to send · Shift+Enter for new line · @role to mention specific agents</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.sender === "user";
  const isSystem = message.sender === "system";
  const isTyping = message.content === "...";

  if (isSystem) return (
    <div className="flex justify-center">
      <span className="text-xs text-slate-500 bg-white/5 border border-white/10 rounded-full px-3 py-1">{message.content}</span>
    </div>
  );

  if (isUser) return (
    <div className="flex justify-end">
      <div className="max-w-[75%]">
        <div className="bg-[#E94560]/15 border border-[#E94560]/20 rounded-2xl rounded-br-sm px-4 py-2.5">
          <p className="text-sm text-white leading-relaxed">{message.content}</p>
        </div>
        <p className="text-[10px] text-slate-600 mt-1 text-right">
          {message.senderName} · {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex gap-3 max-w-[85%]">
      <div className="size-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-base mt-0.5">
        {message.senderIcon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-white">{message.senderName}</span>
          {message.isMock && <span className="text-[9px] text-slate-600 bg-white/5 px-1.5 py-0.5 rounded">sim</span>}
          <span className="text-[10px] text-slate-600">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <div className={cn("bg-white/[0.03] border border-white/10 rounded-2xl rounded-tl-sm px-4 py-2.5", isTyping && "animate-pulse")}>
          {isTyping ? (
            <div className="flex gap-1 items-center h-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="size-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
      </div>
    </div>
  );
}