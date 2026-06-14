"use client";

import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  getProject, getAgentChat, addAgentChatMessage, buildContextWindow,
  getEmployeeDetails, getGoal, getWorkflowFromTask,
  Project, Message, EmployeeRole
} from "@/lib/store";
import { EMPLOYEES } from "@/lib/plans";
import { handleSalesApproval } from "@/lib/workflows/salesWorkflow";
import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ArrowLeft, Send, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AgentChatPage() {
  const { id, role } = useParams<{ id: string; role: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [activeWorkflow, setActiveWorkflow] = useState<{ taskId: string; goalId: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const emp = EMPLOYEES.find((e) => e.role === role);

  function refresh() {
    if (!user) return;
    const p = getProject(user.uid, id);
    if (!p) { router.replace("/dashboard"); return; }
    if (!p.hiredRoles.includes(role as EmployeeRole)) { router.replace(`/project/${id}`); return; }
    setProject(p);
    const chat = getAgentChat(user.uid, id, role as EmployeeRole);
    setMessages(chat?.messages ?? []);

    // Check for active workflow awaiting approval
    for (const goal of p.goals) {
      for (const task of goal.tasks) {
        if (task.assignedRole === role && task.status === "running") {
          const wf = getWorkflowFromTask(user.uid, id, goal.id, task.id);
          if (wf?.status === "awaiting_approval") {
            setActiveWorkflow({ taskId: task.id, goalId: goal.id });
            return;
          }
        }
      }
    }
    setActiveWorkflow(null);
  }

  useEffect(() => { refresh(); }, [user, id, role]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  async function handleSend() {
    if (!input.trim() || !project || !emp || sending) return;
    setSending(true);
    const text = input.trim();
    setInput("");

    // Add user message
    addAgentChatMessage(user!.uid, id, role as EmployeeRole, {
      sender: "user",
      senderName: user?.displayName || "You",
      senderIcon: "👤",
      content: text,
      isUserInput: true,
    });
    refresh();

    // Check if this is an approval/rejection for an active workflow
    if (activeWorkflow && role === "sales") {
      const wf = getWorkflowFromTask(user!.uid, id, activeWorkflow.goalId, activeWorkflow.taskId);
      if (wf) {
        const goal = getGoal(user!.uid, id, activeWorkflow.goalId);
        const boardContext = goal?.boardMessages.slice(-5).map((m) => `[${m.senderName}]: ${m.content}`).join("\n") ?? "";

        const { handled, response } = await handleSalesApproval(
          {
            userId: user!.uid,
            projectId: id,
            goalId: activeWorkflow.goalId,
            goalText: goal?.text ?? "",
            boardContext,
          },
          activeWorkflow.taskId,
          wf,
          text
        );

        if (handled) {
          addAgentChatMessage(user!.uid, id, role as EmployeeRole, {
            sender: role as EmployeeRole,
            senderName: emp.name,
            senderIcon: emp.icon,
            content: response,
          });
          refresh();
          setSending(false);
          return;
        }
      }
    }

    // Regular chat response
    const ctx = buildContextWindow(project, role as EmployeeRole);
    const systemPrompt = `You are ${emp.name}, an AI ${emp.specialty} specialist in a private 1-on-1 conversation.
Role: ${emp.description}
You have full context of all board meetings and tasks. Be conversational, helpful, and specific.`;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.slice(-15).map((m) => ({ role: m.sender === "user" ? "user" : "assistant", content: m.content })),
          systemPrompt, agentId: role, projectName: project.name,
          projectGoal: project.goals[0]?.text ?? "General project discussion",
          contextWindow: ctx, mode: "chat",
        }),
      });
      const data = await res.json();
      addAgentChatMessage(user!.uid, id, role as EmployeeRole, {
        sender: role as EmployeeRole, senderName: emp.name, senderIcon: emp.icon,
        content: data.content, isMock: data.isMock,
      });
    } catch {
      addAgentChatMessage(user!.uid, id, role as EmployeeRole, {
        sender: role as EmployeeRole, senderName: emp.name, senderIcon: emp.icon,
        content: "Having trouble connecting. Try again in a moment.",
      });
    }

    refresh();
    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function quickApprove() { setInput("approve"); inputRef.current?.focus(); }
  function quickReject() { setInput("reject — "); inputRef.current?.focus(); }

  if (!project || !emp) return (
    <div className="min-h-screen bg-[#0A0A14] flex items-center justify-center">
      <div className="size-8 rounded-full border-2 border-[#E94560] border-t-transparent animate-spin" />
    </div>
  );

  const suggestedQuestions: Record<string, string[]> = {
    ceo: ["What's the biggest risk for this project?", "What should we prioritize this week?", "Give me an executive summary."],
    cto: ["What tech stack would you recommend?", "What's the fastest way to build the MVP?", "What are the main technical risks?"],
    pm: ["Write a one-page PRD.", "What features should we cut from the MVP?", "Define our success metrics."],
    research: ["Who are our top 3 competitors?", "What's the market size?", "What do customers actually want?"],
    growth: ["How do we get our first 100 users?", "What's the best acquisition channel?", "Write a launch strategy."],
    finance: ["What should we charge?", "When do we break even?", "Model our revenue for year one."],
    sales: ["Find leads for us.", "Write an outreach email.", "What's our sales strategy?"],
    recruiter: ["Who should we hire first?", "Write a job description.", "How do we attract top talent?"],
  };

  return (
    <AppLayout projectId={id}>
      <div className="flex flex-col" style={{ height: "100vh" }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/5 bg-[#0A0A14]/90 backdrop-blur-sm sticky top-0 z-20">
          <button onClick={() => router.push(`/project/${id}`)} className="text-slate-500 hover:text-white transition-colors">
            <ArrowLeft className="size-4" />
          </button>
          <div className="size-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg shrink-0">{emp.icon}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">{emp.name}</p>
            <p className="text-xs text-slate-500">{emp.specialty} · {project.name}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={cn("size-1.5 rounded-full", activeWorkflow ? "bg-[#E94560] animate-pulse" : "bg-green-500")} />
            <span className="text-xs text-slate-500">{activeWorkflow ? "Awaiting approval" : "Online"}</span>
          </div>
        </div>

        {/* Workflow approval banner */}
        {activeWorkflow && (
          <div className="px-5 py-3 bg-[#E94560]/10 border-b border-[#E94560]/20">
            <p className="text-xs font-semibold text-[#E94560] mb-1">Sales workflow awaiting your approval</p>
            <p className="text-xs text-slate-400 mb-2">Review the plan above and type your response, or use quick actions:</p>
            <div className="flex gap-2">
              <button onClick={quickApprove}
                className="flex items-center gap-1.5 text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/20 px-3 py-1.5 rounded-lg hover:bg-green-500/25 transition-colors">
                <CheckCircle2 className="size-3.5" /> Approve
              </button>
              <button onClick={quickReject}
                className="flex items-center gap-1.5 text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg hover:bg-red-500/25 transition-colors">
                <XCircle className="size-3.5" /> Reject with feedback
              </button>
            </div>
          </div>
        )}

        {project.goals.length > 0 && !activeWorkflow && (
          <div className="px-5 py-2 bg-white/[0.02] border-b border-white/5">
            <p className="text-xs text-slate-500">
              {emp.name} has full context of your {project.goals.length} board {project.goals.length === 1 ? "room" : "rooms"} and all project history.
            </p>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <div className="max-w-2xl mx-auto w-full space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="size-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-3xl">{emp.icon}</div>
                <h3 className="text-sm font-semibold text-white mb-1">{emp.name}</h3>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed mb-5">
                  Your {emp.specialty} specialist. Full context of all board meetings and tasks available.
                </p>
                <div className="flex flex-col gap-2 w-full max-w-xs">
                  {(suggestedQuestions[role] ?? []).map((q) => (
                    <button key={q} onClick={() => setInput(q)}
                      className="text-xs text-slate-400 hover:text-white bg-white/5 border border-white/10 hover:border-white/20 rounded-xl px-4 py-2.5 text-left transition-all">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => {
              const isUser = msg.sender === "user";
              const isSystem = msg.sender === "system";
              if (isSystem) return (
                <div key={msg.id || i} className="flex justify-center">
                  <span className="text-xs text-slate-500 bg-white/5 border border-white/10 rounded-full px-3 py-1">{msg.content}</span>
                </div>
              );
              return (
                <div key={msg.id || i} className={cn("flex gap-3", isUser && "justify-end")}>
                  {!isUser && (
                    <div className="size-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-base shrink-0 mt-0.5">{emp.icon}</div>
                  )}
                  <div className={cn("max-w-[80%]", isUser && "items-end flex flex-col")}>
                    <div className={cn("rounded-2xl px-4 py-2.5",
                      isUser ? "bg-[#E94560]/15 border border-[#E94560]/20 rounded-br-sm" : "bg-white/[0.03] border border-white/10 rounded-tl-sm")}>
                      <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      {msg.isMock && <span className="text-[9px] text-slate-600 bg-white/5 px-1.5 py-0.5 rounded">sim</span>}
                      <span className="text-[10px] text-slate-600">{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {sending && (
              <div className="flex gap-3">
                <div className="size-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-base shrink-0">{emp.icon}</div>
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1 items-center h-4">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="size-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-white/5 bg-[#0A0A14]/90 backdrop-blur-sm px-4 py-3">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-end gap-2 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 focus-within:border-[#E94560]/40 transition-colors">
              <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
                placeholder={activeWorkflow ? 'Type "approve" or "reject — your feedback"...' : `Ask ${emp.name.replace(" Ghost", "")} anything...`}
                rows={1} className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none resize-none max-h-32 leading-relaxed"
                style={{ minHeight: "24px" }} />
              <button onClick={handleSend} disabled={!input.trim() || sending}
                className="shrink-0 size-7 rounded-lg bg-[#E94560] flex items-center justify-center hover:bg-[#d63652] transition-colors disabled:opacity-40">
                <Send className="size-3.5 text-white" />
              </button>
            </div>
            <p className="text-[10px] text-slate-600 mt-1.5 px-1">Enter to send · Shift+Enter for new line</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
