"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getProject, getEmployeeDetails } from "@/lib/store";
import { EMPLOYEES } from "@/lib/plans";
import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Zap, Square } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface Message {
  role: string;
  icon: string;
  name: string;
  content: string;
  isMock?: boolean;
}

export default function BoardMeetingPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const goal = searchParams.get("goal") || "";

  const [messages, setMessages] = useState<Message[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [hiredRoles, setHiredRoles] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const conversationHistory = useRef<{ role: string; content: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    const project = getProject(user.uid, id);
    if (!project) { router.replace("/dashboard"); return; }
    setProjectName(project.name);
    setHiredRoles(project.hiredRoles);
  }, [user, id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function callAgent(agentRole: string, projectGoal: string) {
    const emp = EMPLOYEES.find((e) => e.role === agentRole);
    if (!emp) return null;

    const systemPrompt = `You are ${emp.name}, an AI ${emp.specialty} specialist in a boardroom meeting.
Your role: ${emp.description}
Project: ${projectName}
Goal: ${projectGoal}

Give a concise, direct response (3-5 sentences) from your role's perspective. Be specific and actionable.
Reference what previous team members said if relevant. End with a clear recommendation or next step.`;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversationHistory.current,
          systemPrompt,
          agentId: agentRole,
          projectName,
          projectGoal: goal,
          userId: user?.uid,
        }),
      });
      const data = await res.json();
      return { content: data.content as string, isMock: data.isMock as boolean };
    } catch {
      return null;
    }
  }

  async function startMeeting() {
    if (!goal || hiredRoles.length === 0) return;
    setRunning(true);
    setDone(false);
    setMessages([]);
    conversationHistory.current = [];

    // Opening message
    const openingMsg: Message = {
      role: "system",
      icon: "⚡",
      name: "GhostEmployee",
      content: `Board meeting started. Goal: "${goal}"`,
    };
    setMessages([openingMsg]);

    // Run each hired employee in sequence
    for (const role of hiredRoles) {
      const emp = getEmployeeDetails(role as any);
      if (!emp) continue;

      // Show typing indicator
      const typingMsg: Message = {
        role,
        icon: emp.icon,
        name: emp.name,
        content: "...",
      };
      setMessages((prev) => [...prev, typingMsg]);

      const result = await callAgent(role, goal);
      const content = result?.content || `As ${emp.name}, I recommend proceeding with a focused approach on this goal.`;

      // Add to conversation history for next agents
      conversationHistory.current.push({
        role: "assistant",
        content: `[${emp.name}]: ${content}`,
      });

      // Replace typing with real message
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role, icon: emp.icon, name: emp.name, content, isMock: result?.isMock },
      ]);

      // Small delay between agents for readability
      await new Promise((r) => setTimeout(r, 600));
    }

    // CEO closing summary
    const ceoEmp = getEmployeeDetails("ceo");
    const closingTyping: Message = { role: "ceo", icon: ceoEmp.icon, name: "CEO Ghost (Summary)", content: "..." };
    setMessages((prev) => [...prev, closingTyping]);

    const summaryResult = await callAgent("ceo", `Synthesize the team's discussion and give a final recommendation for: ${goal}`);
    const summaryContent = summaryResult?.content || "Based on our team's analysis, I recommend proceeding with a focused MVP approach, validating core assumptions before scaling.";

    setMessages((prev) => [
      ...prev.slice(0, -1),
      { role: "ceo", icon: ceoEmp.icon, name: "CEO Ghost (Summary)", content: summaryContent, isMock: summaryResult?.isMock },
    ]);

    setRunning(false);
    setDone(true);
  }

  return (
    <div className="min-h-screen bg-[#0A0A14] flex flex-col">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0A0A14]/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`/project/${id}`)} className="text-slate-500 hover:text-white transition-colors">
            <ArrowLeft className="size-5" />
          </button>
          <div>
            <span className="text-sm font-bold text-white">{projectName}</span>
            <p className="text-xs text-slate-500 truncate max-w-xs">{goal}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {running && (
            <span className="flex items-center gap-1.5 text-xs text-[#E94560]">
              <span className="size-1.5 rounded-full bg-[#E94560] animate-pulse" />
              Live
            </span>
          )}
          {!running && !done && (
            <Button onClick={startMeeting} disabled={!goal}>
              <Zap className="size-4" /> Start meeting
            </Button>
          )}
          {running && (
            <Button variant="outline" size="sm" onClick={() => { setRunning(false); setDone(true); }}>
              <Square className="size-3" /> Stop
            </Button>
          )}
          {done && (
            <Button onClick={startMeeting} variant="outline" size="sm">
              <Zap className="size-4" /> Run again
            </Button>
          )}
        </div>
      </header>

      {/* Meeting area */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-6 py-8 space-y-4">
        {messages.length === 0 && !running && (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center">
            <div className="size-16 rounded-2xl bg-[#E94560]/10 border border-[#E94560]/20 flex items-center justify-center mb-5">
              <Zap className="size-7 text-[#E94560]" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Ready to start</h2>
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed mb-6">
              Your team of {hiredRoles.length} AI employees will discuss and debate this goal in real time.
            </p>
            <p className="text-sm font-medium text-white bg-white/5 border border-white/10 rounded-xl px-5 py-3 mb-6 max-w-sm">
              "{goal}"
            </p>
            <Button size="lg" onClick={startMeeting}>
              <Zap className="size-4" /> Start board meeting
            </Button>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "system" ? "justify-center" : ""}`}>
            {msg.role === "system" ? (
              <div className="text-xs text-slate-500 bg-white/5 border border-white/10 rounded-full px-4 py-1.5">
                {msg.content}
              </div>
            ) : (
              <>
                <div className="size-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-lg">
                  {msg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-white">{msg.name}</span>
                    {msg.isMock && (
                      <span className="text-[10px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">simulator</span>
                    )}
                  </div>
                  <div className={`bg-white/[0.03] border border-white/10 rounded-xl rounded-tl-sm px-4 py-3 text-sm text-slate-300 leading-relaxed ${msg.content === "..." ? "animate-pulse" : ""}`}>
                    {msg.content === "..." ? (
                      <span className="text-slate-500">Thinking...</span>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ))}

        {done && messages.length > 0 && (
          <div className="flex justify-center pt-4">
            <div className="bg-white/[0.03] border border-[#E94560]/20 rounded-2xl px-6 py-4 text-center max-w-sm">
              <p className="text-sm font-semibold text-white mb-1">Meeting complete</p>
              <p className="text-xs text-slate-400 mb-4">Your team has delivered their analysis.</p>
              <Button fullWidth onClick={() => router.push(`/project/${id}`)}>
                Back to project
              </Button>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
