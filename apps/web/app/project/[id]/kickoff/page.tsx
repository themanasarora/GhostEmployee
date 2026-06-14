"use client";

import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  getProject, addBoardMessage, buildContextWindow,
  getEmployeeDetails, saveProjects, getProjects,
  Project, Message, EmployeeRole
} from "@/lib/store";
import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Send, Zap, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export default function KickoffPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [kickoffDone, setKickoffDone] = useState(false);
  const [goalId] = useState(() => crypto.randomUUID());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const kickoffStarted = useRef(false);

  function refresh() {
    if (!user) return;
    const p = getProject(user.uid, id);
    if (!p) { router.replace("/dashboard"); return; }
    setProject(p);
  }

  useEffect(() => { refresh(); }, [user, id]);

  // Auto-start kickoff once project loads
  useEffect(() => {
    if (!project || kickoffStarted.current) return;
    kickoffStarted.current = true;
    runKickoff(project);
  }, [project]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function addMessage(msg: Omit<Message, "id" | "timestamp">) {
    const full: Message = { ...msg, id: crypto.randomUUID(), timestamp: Date.now() };
    setMessages((prev) => [...prev, full]);
    return full;
  }

  function replaceLastMessage(content: string, isMock?: boolean) {
    setMessages((prev) => {
      const next = [...prev];
      next[next.length - 1] = { ...next[next.length - 1], content, isMock };
      return next;
    });
  }

  async function callAgent(role: EmployeeRole, prompt: string, p: Project): Promise<{ content: string; isMock: boolean }> {
    const emp = getEmployeeDetails(role);
    const ctx = buildContextWindow(p, role);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [],
          systemPrompt: prompt,
          agentId: role,
          projectName: p.name,
          projectGoal: "Kickoff board meeting — understand the project",
          contextWindow: ctx,
          mode: "board",
        }),
      });
      const data = await res.json();
      return { content: data.content, isMock: data.isMock };
    } catch {
      return { content: `As ${emp.name}, I'm ready to contribute my expertise to ${p.name}.`, isMock: true };
    }
  }

  async function runKickoff(p: Project) {
    setRunning(true);
    const team = p.hiredRoles.map((r) => getEmployeeDetails(r));

    // System: meeting started
    addMessage({
      sender: "system",
      senderName: "System",
      senderIcon: "⚡",
      content: `Kickoff board meeting started for "${p.name}"`,
    });

    await delay(600);

    // CEO opens
    const ceoEmp = getEmployeeDetails("ceo");
    addMessage({ sender: "ceo", senderName: ceoEmp.name, senderIcon: ceoEmp.icon, content: "..." });

    const ceoIntroPrompt = `You are CEO Ghost opening a kickoff board meeting for a new project.
Project name: "${p.name}"
Project description: "${p.description}"
Team hired: ${team.map((e) => e.name).join(", ")}

In 4-6 sentences:
1. Welcome the team and state the project name
2. Summarize your understanding of the project from the description
3. Introduce each team member briefly by name and their specialty
4. Ask the user: "Is this understanding correct? Is there anything you'd like to add or clarify before we begin?"

Be warm, professional, and show you've read the project description carefully.`;

    const { content: ceoIntro, isMock } = await callAgent("ceo", ceoIntroPrompt, p);
    replaceLastMessage(ceoIntro, isMock);

    await delay(800);

    // Each non-CEO team member introduces themselves briefly
    const nonCeo = p.hiredRoles.filter((r) => r !== "ceo");
    for (const role of nonCeo) {
      const emp = getEmployeeDetails(role);
      addMessage({ sender: role, senderName: emp.name, senderIcon: emp.icon, content: "..." });

      const introPrompt = `You are ${emp.name}, an AI ${emp.specialty} specialist.
You're in a kickoff board meeting for: "${p.name}"
Description: "${p.description}"

In exactly 2 sentences: introduce yourself, state what you'll contribute to this specific project.
Be specific to the project description — don't be generic.`;

      const { content, isMock: mock } = await callAgent(role, introPrompt, p);
      replaceLastMessage(content, mock);
      await delay(500);
    }

    setRunning(false);
    setKickoffDone(true);
    inputRef.current?.focus();
  }

  async function handleSend() {
    if (!input.trim() || !project || running) return;
    setRunning(true);
    const text = input.trim();
    setInput("");

    // Add user message
    addMessage({
      sender: "user",
      senderName: user?.displayName || "You",
      senderIcon: "👤",
      content: text,
      isUserInput: true,
    });

    await delay(400);

    // CEO responds to user's clarification/confirmation
    const ceoEmp = getEmployeeDetails("ceo");
    addMessage({ sender: "ceo", senderName: ceoEmp.name, senderIcon: ceoEmp.icon, content: "..." });

    const lower = text.toLowerCase();
    const isConfirming = ["yes", "correct", "right", "good", "perfect", "looks good", "that's right", "exactly"].some(w => lower.includes(w));

    const ceoResponsePrompt = `You are CEO Ghost in a kickoff board meeting.
Project: "${project.name}"
Description: "${project.description}"
The user just said: "${text}"

${isConfirming
  ? `The user confirmed the understanding. Respond in 3-4 sentences:
     1. Acknowledge the confirmation enthusiastically
     2. Briefly state the team is ready to begin
     3. Invite them to assign the first goal by going to the project dashboard
     End with: "Head to your project dashboard to assign your first goal and we'll get to work."`
  : `The user has provided clarification or corrections. Respond in 3-4 sentences:
     1. Acknowledge and incorporate their feedback
     2. Restate the corrected understanding
     3. Confirm the team is aligned and ready to begin
     End with: "Head to your project dashboard to assign your first goal and we'll get to work."`}`;

    const { content: ceoResp, isMock } = await callAgent("ceo", ceoResponsePrompt, project);
    replaceLastMessage(ceoResp, isMock);

    if (isConfirming || lower.includes("goal") || lower.includes("start") || lower.includes("begin")) {
      await delay(1200);
      // Save kickoff messages to project store
      saveKickoffToProject();
    }

    setRunning(false);
  }

  function saveKickoffToProject() {
    if (!user || !project) return;
    // Save all kickoff messages as board messages on the project
    // We create a special "kickoff" goal to store these
    const allProjects = getProjects(user.uid);
    const pIdx = allProjects.findIndex((p) => p.id === id);
    if (pIdx === -1) return;

    const kickoffGoal = {
      id: goalId,
      projectId: id,
      text: "Project kickoff — team introduction & context alignment",
      boardMessages: messages.map((m) => ({ ...m, id: m.id || crypto.randomUUID(), timestamp: m.timestamp || Date.now() })),
      tasks: [],
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    };

    allProjects[pIdx].goals = [kickoffGoal, ...allProjects[pIdx].goals];
    allProjects[pIdx].updatedAt = Date.now();
    saveProjects(user!.uid, allProjects);
  }

  function handleProceed() {
    saveKickoffToProject();
    router.push(`/project/${id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!project) return (
    <div className="min-h-screen bg-[#0A0A14] flex items-center justify-center">
      <div className="size-8 rounded-full border-2 border-[#E94560] border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0A14] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5 bg-[#0A0A14]/90 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-[#E94560]/15 border border-[#E94560]/20 flex items-center justify-center">
            <Zap className="size-4 text-[#E94560]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Kickoff Board Meeting</p>
            <p className="text-xs text-slate-500">{project.name} · {project.hiredRoles.length} employees</p>
          </div>
        </div>
        {kickoffDone && (
          <button
            onClick={handleProceed}
            className="text-xs font-medium text-[#E94560] hover:text-white transition-colors border border-[#E94560]/30 hover:border-white/20 px-3 py-1.5 rounded-lg"
          >
            Go to project →
          </button>
        )}
      </div>

      {/* Team bar */}
      <div className="flex items-center gap-2 px-5 py-2.5 border-b border-white/5 bg-white/[0.02] overflow-x-auto">
        <Users className="size-3.5 text-slate-500 shrink-0" />
        <span className="text-xs text-slate-500 shrink-0">Team:</span>
        {project.hiredRoles.map((r) => {
          const e = getEmployeeDetails(r);
          return (
            <span key={r} className="text-xs bg-white/5 border border-white/10 text-slate-300 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
              {e.icon} {e.name.replace(" Ghost", "")}
            </span>
          );
        })}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="max-w-3xl mx-auto w-full space-y-4">
          {messages.map((msg, i) => (
            <KickoffMessage key={msg.id || i} message={msg} />
          ))}

          {kickoffDone && (
            <div className="flex justify-center pt-4">
              <div className="bg-white/[0.03] border border-[#E94560]/20 rounded-2xl px-6 py-4 text-center max-w-sm">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Team is ready</p>
                <p className="text-sm text-slate-300 mb-4">
                  Confirm the understanding above or clarify anything — then head to your project to assign the first goal.
                </p>
                <button
                  onClick={handleProceed}
                  className="text-sm font-semibold text-white bg-[#E94560] hover:bg-[#d63652] px-6 py-2.5 rounded-xl transition-colors w-full"
                >
                  Go to project dashboard →
                </button>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input — only show after kickoff is done */}
      {kickoffDone && (
        <div className="border-t border-white/5 bg-[#0A0A14]/90 backdrop-blur-sm px-4 py-3">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-2 bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 focus-within:border-[#E94560]/40 transition-colors">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Confirm the understanding or clarify anything..."
                rows={1}
                className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none resize-none max-h-24 leading-relaxed"
                style={{ minHeight: "24px" }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || running}
                className="shrink-0 size-7 rounded-lg bg-[#E94560] flex items-center justify-center hover:bg-[#d63652] transition-colors disabled:opacity-40"
              >
                {running
                  ? <div className="size-3 rounded-full border border-white border-t-transparent animate-spin" />
                  : <Send className="size-3.5 text-white" />}
              </button>
            </div>
            <p className="text-[10px] text-slate-600 mt-1.5 px-1">Enter to send · Shift+Enter for new line</p>
          </div>
        </div>
      )}
    </div>
  );
}

function KickoffMessage({ message }: { message: Message }) {
  const isUser = message.sender === "user";
  const isSystem = message.sender === "system";
  const isTyping = message.content === "...";

  if (isSystem) return (
    <div className="flex justify-center">
      <span className="text-xs text-slate-500 bg-white/5 border border-white/10 rounded-full px-3 py-1 flex items-center gap-2">
        <Zap className="size-3 text-[#E94560]" />
        {message.content}
      </span>
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
    <div className="flex gap-3 max-w-[88%]">
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
        <div className={cn(
          "bg-white/[0.03] border border-white/10 rounded-2xl rounded-tl-sm px-4 py-2.5",
          isTyping && "animate-pulse"
        )}>
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

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }
