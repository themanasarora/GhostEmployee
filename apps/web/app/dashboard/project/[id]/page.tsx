"use client";

import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Play, Pause, ChevronRight, CheckCircle2, Circle, AlertCircle, Award, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AGENTS, Agent } from "@/lib/agents";

interface Subtask {
  id: string;
  description: string;
  completed: boolean;
}

interface Message {
  sender: string;
  content: string;
  timestamp: string;
}

interface Project {
  id: string;
  name: string;
  goal: string;
  hiredAgents: string[];
  createdAt: string;
  currentTask: string;
  subtasks: Subtask[];
  messages: Message[];
  report: string;
}

export default function ProjectBoardroomPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [currentTurnAgentId, setCurrentTurnAgentId] = useState<string>("ceo");
  const [loadingTurn, setLoadingTurn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"discussion" | "report">("discussion");
  const [userFeedback, setUserFeedback] = useState("");
  const [simulatorNotice, setSimulatorNotice] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load project from localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && projectId) {
      const stored = localStorage.getItem("ghostemployee:projects");
      if (stored) {
        try {
          const list: Project[] = JSON.parse(stored);
          const found = list.find((p) => p.id === projectId);
          if (found) {
            setProject(found);
            // Determine whose turn it is based on message history length
            // ceo -> pm -> sales -> recruiter
            const turns = ["ceo", "pm", "sales", "recruiter"];
            const nextTurnIdx = found.messages.length % turns.length;
            setCurrentTurnAgentId(turns[nextTurnIdx]);
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [projectId]);

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [project?.messages, loadingTurn]);

  // Auto-play agent simulation loop
  useEffect(() => {
    if (isSimulating && !loadingTurn && project) {
      autoPlayTimerRef.current = setTimeout(() => {
        runNextTurn();
      }, 3500); // delay between agent statements
    }

    return () => {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
      }
    };
  }, [isSimulating, loadingTurn, currentTurnAgentId, project]);

  // Triggered when user enters manual message to steer debate
  async function handleSendFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (!userFeedback.trim() || !project) return;

    const updatedMessages = [
      ...project.messages,
      {
        sender: "User (Founder)",
        content: userFeedback.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];

    const updatedProject = {
      ...project,
      messages: updatedMessages,
      currentTask: `Founder steering debate: "${userFeedback.trim()}"`,
    };

    saveProject(updatedProject);
    setUserFeedback("");

    // CEO reacts first to user feedback
    setCurrentTurnAgentId("ceo");
  }

  function saveProject(updated: Project) {
    setProject(updated);
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("ghostemployee:projects");
      if (stored) {
        try {
          const list: Project[] = JSON.parse(stored);
          const idx = list.findIndex((p) => p.id === updated.id);
          if (idx !== -1) {
            list[idx] = updated;
            localStorage.setItem("ghostemployee:projects", JSON.stringify(list));
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
  }

  async function runNextTurn() {
    if (!project || loadingTurn) return;
    setLoadingTurn(true);
    setError(null);

    const activeAgent = AGENTS[currentTurnAgentId];
    if (!activeAgent) return;

    try {
      // Build context for the AI prompt
      const contextMessages = project.messages.map((m) => {
        let senderRole = "User";
        if (m.sender.includes("CEO")) senderRole = "CEO Ghost";
        else if (m.sender.includes("PM")) senderRole = "PM Ghost";
        else if (m.sender.includes("Sales")) senderRole = "Sales Ghost";
        else if (m.sender.includes("Recruiter")) senderRole = "Recruiter Ghost";
        return {
          role: m.sender.includes("User") ? "user" : "assistant",
          content: `[${senderRole}]: ${m.content}`,
        };
      });

      // Insert kickoff context if no messages yet
      if (contextMessages.length === 0) {
        contextMessages.push({
          role: "user",
          content: `Project Launch Kickoff! 
Project Name: ${project.name}
Overall Company Goal: ${project.goal}

CEO: Please kick off the meeting, set subtasks, outline the mission, and ask the team for feedback.`,
        });
      } else {
        contextMessages.push({
          role: "user",
          content: `Continue the boardroom conversation.
Project goal: "${project.goal}".
Current active focus: "${project.currentTask}".
Checklist milestones: ${project.subtasks.map((s, i) => `${i + 1}. [${s.completed ? "x" : " "}] ${s.description}`).join(", ")}.
Current speaker: ${activeAgent.name} (${activeAgent.role}).`,
        });
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: contextMessages,
          systemPrompt: activeAgent.systemPrompt,
          agentId: currentTurnAgentId,
          projectName: project.name,
          projectGoal: project.goal,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to contact Hugging Face endpoint.");
      }

      const data = await res.json();
      
      // Update warning banner state
      if (data.isMock) {
        setSimulatorNotice(data.notice || "Offline Simulator Mode: Running local simulations.");
      } else {
        setSimulatorNotice(null);
      }

      let responseText = data.content || "";

      // Parse commands from response text
      let updatedTask = project.currentTask;
      let updatedSubtasks = [...project.subtasks];
      let updatedReport = project.report;

      // 1. UPDATE_TASK command
      const taskMatch = responseText.match(/\[UPDATE_TASK\]\s*(.+)/i);
      if (taskMatch) {
        updatedTask = taskMatch[1].trim();
      }

      // 2. ADD_SUBTASK command
      const addMatches = responseText.matchAll(/\[ADD_SUBTASK\]\s*(.+)/gi);
      for (const match of addMatches) {
        const desc = match[1].trim();
        if (!updatedSubtasks.some(s => s.description.toLowerCase() === desc.toLowerCase())) {
          updatedSubtasks.push({
            id: Math.random().toString(36).substring(2, 7),
            description: desc,
            completed: false,
          });
        }
      }

      // 3. COMPLETE_SUBTASK command
      const completeMatches = responseText.matchAll(/\[COMPLETE_SUBTASK\]\s*(.+)/gi);
      for (const match of completeMatches) {
        const val = match[1].trim();
        const idx = parseInt(val) - 1;
        if (!isNaN(idx) && updatedSubtasks[idx]) {
          updatedSubtasks[idx] = { ...updatedSubtasks[idx], completed: true };
        } else {
          const foundIdx = updatedSubtasks.findIndex(
            (s) => s.description.toLowerCase().includes(val.toLowerCase())
          );
          if (foundIdx !== -1) {
            updatedSubtasks[foundIdx] = { ...updatedSubtasks[foundIdx], completed: true };
          }
        }
      }

      // Clean command strings and echoed instruction text from the message display content
      const displayContent = responseText
        .replace(/\[UPDATE_TASK\]\s*(.+)/gi, "")
        .replace(/\[ADD_SUBTASK\]\s*(.+)/gi, "")
        .replace(/\[COMPLETE_SUBTASK\]\s*(.+)/gi, "")
        .split("\n")
        .map((line: string) => line.trim())
        .filter((line: string) => {
          if (!line) {
            return false;
          }

          const lowered = line.toLowerCase();
          return !(
            lowered.startsWith("you are ") ||
            lowered.startsWith("remember your specific mandate") ||
            lowered.startsWith("please provide your analysis") ||
            lowered.startsWith("continue the boardroom conversation") ||
            lowered.startsWith("good morning") ||
            lowered.startsWith("good afternoon") ||
            lowered.startsWith("good evening")
          );
        })
        .join("\n")
        .trim();

      // Update Report based on active role contribution
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const reportContribution = `\n\n### Contribution by ${activeAgent.name} (${activeAgent.role})\n*Added on Boardroom Turn ${project.messages.length + 1} at ${timestamp}*\n\n${displayContent}`;
      updatedReport += reportContribution;

      // Assemble new state
      const newMsg: Message = {
        sender: `${activeAgent.name} (${activeAgent.role})`,
        content: displayContent,
        timestamp,
      };

      const updatedProject: Project = {
        ...project,
        currentTask: updatedTask,
        subtasks: updatedSubtasks,
        report: updatedReport,
        messages: [...project.messages, newMsg],
      };

      saveProject(updatedProject);

      // Cycle turns: ceo -> pm -> sales -> recruiter
      const agentCycle = ["ceo", "pm", "sales", "recruiter"];
      const currentIdx = agentCycle.indexOf(currentTurnAgentId);
      const nextIdx = (currentIdx + 1) % agentCycle.length;
      setCurrentTurnAgentId(agentCycle[nextIdx]);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during turn generation.");
      setIsSimulating(false);
    } finally {
      setLoadingTurn(false);
    }
  }

  // Simple Markdown to HTML formatter for messages
  function renderMarkdown(content: string) {
    if (!content) return "";
    return content.split("\n").map((line, i) => {
      let trimmed = line.trim();
      if (trimmed.startsWith("###")) {
        return <h4 key={i} className="text-sm font-bold text-white mt-3 mb-1.5">{trimmed.replace("###", "")}</h4>;
      }
      if (trimmed.startsWith("##")) {
        return <h3 key={i} className="text-base font-bold text-white mt-4 mb-2">{trimmed.replace("##", "")}</h3>;
      }
      if (trimmed.startsWith("#")) {
        return <h2 key={i} className="text-lg font-bold text-white mt-5 mb-2.5">{trimmed.replace("#", "")}</h2>;
      }
      if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
        return <li key={i} className="text-xs text-slate-300 ml-4 list-disc mb-1">{trimmed.substring(1).trim()}</li>;
      }
      // Bold formatter
      let parts = line.split("**");
      if (parts.length > 1) {
        return (
          <p key={i} className="text-xs text-slate-300 leading-relaxed mb-2">
            {parts.map((part, index) => (index % 2 === 1 ? <strong key={index} className="text-white font-semibold">{part}</strong> : part))}
          </p>
        );
      }
      return <p key={i} className="text-xs text-slate-300 leading-relaxed mb-2">{line}</p>;
    });
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A14] flex items-center justify-center">
        <div className="size-8 rounded-full border-2 border-[#E94560] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return null;
  if (!project) {
    return (
      <div className="min-h-screen bg-[#0A0A14] text-white flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="size-12 text-[#E94560] mb-4" />
        <h1 className="text-xl font-bold">Project Not Found</h1>
        <p className="text-sm text-slate-400 mt-2 max-w-sm">The project you are looking for does not exist or has been deleted.</p>
        <Button className="mt-6" onClick={() => router.push("/dashboard")}>Back to Dashboard</Button>
      </div>
    );
  }

  // Calculate task checklist completion percentage
  const completedCount = project.subtasks.filter((s) => s.completed).length;
  const progressPercent = project.subtasks.length > 0 ? Math.round((completedCount / project.subtasks.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#0A0A14] text-white flex flex-col">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-0 right-0 w-[500px] h-[300px] bg-indigo-900/5 rounded-full blur-[140px]" />
      </div>

      {/* Boardroom Header */}
      <header className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0A0A14]/90 backdrop-blur-md sticky top-0 gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setIsSimulating(false);
              router.push("/dashboard");
            }}
            className="p-2 bg-white/5 border border-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all"
            title="Back to Dashboard"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white leading-tight">{project.name}</h1>
              <span className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                <span className="size-1 rounded-full bg-green-400 animate-ping" />
                Active Session
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1 max-w-xl">
              Goal: {project.goal}
            </p>
          </div>
        </div>

        {/* Boardroom controls */}
        <div className="flex items-center gap-2.5">
          <Button
            variant={isSimulating ? "ghost" : "primary"}
            size="sm"
            onClick={() => setIsSimulating(!isSimulating)}
            className="flex items-center gap-1.5 h-9"
          >
            {isSimulating ? (
              <>
                <Pause className="size-3.5 fill-current" />
                Pause Auto
              </>
            ) : (
              <>
                <Play className="size-3.5 fill-current" />
                Auto Debate
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={runNextTurn}
            disabled={loadingTurn || isSimulating}
            className="flex items-center gap-1 h-9"
          >
            Run Next Turn
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </header>

      {/* Screen layout tabs (for smaller screens) */}
      <div className="flex border-b border-white/5 bg-[#0F0F1E] sm:hidden">
        <button
          onClick={() => setActiveTab("discussion")}
          className={`flex-1 py-3 text-xs font-semibold text-center border-b-2 transition-all ${
            activeTab === "discussion"
              ? "border-[#E94560] text-white"
              : "border-transparent text-slate-400"
          }`}
        >
          Discussion Board
        </button>
        <button
          onClick={() => setActiveTab("report")}
          className={`flex-1 py-3 text-xs font-semibold text-center border-b-2 transition-all ${
            activeTab === "report"
              ? "border-[#E94560] text-white"
              : "border-transparent text-slate-400"
          }`}
        >
          Report Workspace
        </button>
      </div>

      {/* Desktop Workspace Grid */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Column - Workspace State checklist (Hidden on mobile) */}
        <aside className="w-1/4 border-r border-white/5 bg-[#0A0A14]/40 p-5 hidden md:flex flex-col gap-6 overflow-y-auto select-none">
          
          {/* Active Task */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Active Task</h3>
            <div className="bg-white/5 border border-white/5 rounded-xl p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-white">
                <span className="size-2 rounded-full bg-[#E94560] animate-pulse shrink-0" />
                {project.currentTask}
              </div>
            </div>
          </div>

          {/* Subtask milestones */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Milestones</h3>
              <span className="text-[10px] font-semibold text-slate-400 bg-white/5 px-2 py-0.5 rounded">
                {progressPercent}%
              </span>
            </div>
            
            {/* Progress bar */}
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-gradient-to-r from-[#E94560] to-indigo-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="space-y-2.5 overflow-y-auto flex-1 pr-1.5 scrollbar-thin">
              {project.subtasks.map((task) => (
                <div
                  key={task.id}
                  className={`flex items-start gap-2.5 p-3 rounded-lg border transition-all ${
                    task.completed
                      ? "bg-green-500/[0.02] border-green-500/10 text-slate-400"
                      : "bg-white/[0.01] border-white/5 text-slate-300"
                  }`}
                >
                  {task.completed ? (
                    <CheckCircle2 className="size-4 text-green-500 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="size-4 text-slate-600 shrink-0 mt-0.5" />
                  )}
                  <span className="text-xs leading-relaxed">{task.description}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Hired workspace status */}
          <div className="border-t border-white/5 pt-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Users className="size-3.5" />
              Workspace Team
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(AGENTS).map((agent) => {
                const isActive = currentTurnAgentId === agent.id;
                return (
                  <div
                    key={agent.id}
                    className={`flex flex-col p-2.5 rounded-lg border transition-all ${
                      isActive
                        ? "bg-[#E94560]/5 border-[#E94560]/30 shadow-[0_0_12px_rgba(233,69,96,0.06)]"
                        : "bg-white/[0.01] border-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base">{agent.icon}</span>
                      <span className={`size-1.5 rounded-full ${isActive ? "bg-green-400 animate-pulse" : "bg-slate-600"}`} />
                    </div>
                    <div className="text-[10px] font-semibold text-white mt-1.5">{agent.name}</div>
                    <div className="text-[8px] text-slate-500 mt-0.5 line-clamp-1">{agent.role}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Center Column - Boardroom Discussion Feed */}
        <section
          className={`flex-1 flex flex-col bg-[#080810]/30 ${
            activeTab === "discussion" ? "flex" : "hidden sm:flex"
          }`}
        >
          {/* Simulator Warning Notice */}
          {simulatorNotice && (
            <div className="bg-amber-500/10 border-b border-amber-500/10 px-6 py-2.5 flex items-center gap-2 text-[10px] text-amber-400 select-none">
              <span className="size-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
              {simulatorNotice}
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
            {project.messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-20">
                <div className="size-16 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-center mb-6">
                  <span className="text-3xl animate-bounce">💬</span>
                </div>
                <h3 className="text-base font-bold text-white">Boardroom Kickoff</h3>
                <p className="text-xs text-slate-400 mt-2 max-w-sm leading-relaxed">
                  Run the next turn to let CEO Ghost call the meeting to order and map out requirements with the team.
                </p>
                <Button className="mt-6" size="sm" onClick={runNextTurn} loading={loadingTurn}>
                  Initiate Kickoff Meeting
                </Button>
              </div>
            ) : (
              project.messages.map((m, idx) => {
                // Find agent metadata
                const isUser = m.sender.includes("User");
                const agentKey = Object.keys(AGENTS).find((k) => m.sender.includes(AGENTS[k].name));
                const agent = agentKey ? AGENTS[agentKey] : null;

                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-4 max-w-3xl ${isUser ? "ml-auto flex-row-reverse" : ""}`}
                  >
                    {/* Avatar */}
                    {isUser ? (
                      <div className="size-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-400 shrink-0 select-none">
                        F
                      </div>
                    ) : (
                      <div
                        className="size-9 rounded-lg flex items-center justify-center text-lg shrink-0 select-none"
                        style={{
                          backgroundColor: `${agent?.color || "#E94560"}15`,
                          border: `1px solid ${agent?.color || "#E94560"}30`,
                        }}
                      >
                        {agent?.icon || "🤖"}
                      </div>
                    )}

                    {/* Bubble */}
                    <div className="flex-1">
                      <div className={`flex items-baseline gap-2 mb-1 ${isUser ? "justify-end" : ""}`}>
                        <span className="text-xs font-semibold text-white">
                          {isUser ? "Founder (You)" : m.sender}
                        </span>
                        <span className="text-[9px] text-slate-500">{m.timestamp}</span>
                      </div>
                      <div
                        className={`rounded-2xl border p-4 text-xs ${
                          isUser
                            ? "bg-indigo-500/5 border-indigo-500/10 rounded-tr-none text-slate-300"
                            : "bg-white/[0.02] border-white/5 rounded-tl-none text-slate-300"
                        }`}
                      >
                        {renderMarkdown(m.content)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Turn typing indicator */}
            {loadingTurn && (
              <div className="flex items-start gap-4 max-w-3xl">
                <div
                  className="size-9 rounded-lg flex items-center justify-center text-lg shrink-0 animate-pulse"
                  style={{
                    backgroundColor: `${AGENTS[currentTurnAgentId]?.color || "#E94560"}15`,
                    border: `1px solid ${AGENTS[currentTurnAgentId]?.color || "#E94560"}30`,
                  }}
                >
                  {AGENTS[currentTurnAgentId]?.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-xs font-semibold text-slate-400">
                      {AGENTS[currentTurnAgentId]?.name} is analyzing...
                    </span>
                  </div>
                  <div className="inline-flex gap-1.5 p-3.5 bg-white/[0.01] border border-white/5 rounded-2xl rounded-tl-none">
                    <span className="size-1.5 bg-[#E94560] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="size-1.5 bg-[#E94560] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="size-1.5 bg-[#E94560] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3 text-xs text-red-400">
                <AlertCircle className="size-4 shrink-0" />
                <div>
                  <p className="font-semibold">Turn generation failed</p>
                  <p className="mt-0.5 text-slate-400">{error}</p>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* User Feedback Steering Box */}
          <div className="p-4 border-t border-white/5 bg-[#0A0A14]/60">
            <form onSubmit={handleSendFeedback} className="flex gap-2">
              <input
                type="text"
                placeholder="Give feedback or direct the debate (e.g. 'CEO, focus on B2B SaaS first')"
                className="flex-1 h-10 rounded-lg bg-white/5 border border-white/10 px-4 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#E94560] focus:border-transparent transition-all"
                value={userFeedback}
                onChange={(e) => setUserFeedback(e.target.value)}
                disabled={loadingTurn}
              />
              <button
                type="submit"
                disabled={loadingTurn || !userFeedback.trim()}
                className="h-10 px-4 bg-white/5 border border-white/5 hover:bg-white/10 text-white rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                title="Steer Debate"
              >
                <Send className="size-3.5" />
              </button>
            </form>
          </div>
        </section>

        {/* Right Column - Workspace Report Deliverable */}
        <section
          className={`w-1/4 border-l border-white/5 bg-[#0F0F1E]/20 flex flex-col ${
            activeTab === "report" ? "flex" : "hidden sm:flex"
          }`}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Award className="size-4 text-[#E94560]" />
              Workspace Report
            </h3>
          </div>

          {/* Markdown Preview Area */}
          <div className="flex-1 overflow-y-auto p-6 prose prose-invert max-w-none text-xs text-slate-300 leading-relaxed scrollbar-thin select-text">
            {project.report ? (
              project.report.split("\n").map((line, i) => {
                let trimmed = line.trim();
                if (trimmed.startsWith("###")) {
                  return <h4 key={i} className="text-sm font-bold text-white mt-6 mb-2 border-b border-white/5 pb-1">{trimmed.replace("###", "")}</h4>;
                }
                if (trimmed.startsWith("##")) {
                  return <h3 key={i} className="text-base font-bold text-[#E94560] mt-8 mb-3 border-b border-white/5 pb-1">{trimmed.replace("##", "")}</h3>;
                }
                if (trimmed.startsWith("#")) {
                  return <h2 key={i} className="text-lg font-extrabold text-white mt-10 mb-4 pb-2 border-b border-white/10">{trimmed.replace("#", "")}</h2>;
                }
                if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
                  return <li key={i} className="text-xs text-slate-300 ml-4 list-disc mb-1">{trimmed.substring(1).trim()}</li>;
                }
                if (trimmed.startsWith(">")) {
                  return <blockquote key={i} className="border-l-2 border-[#E94560] pl-3 italic text-slate-400 my-3">{trimmed.substring(1).trim()}</blockquote>;
                }
                // Bold formatting
                let parts = line.split("**");
                if (parts.length > 1) {
                  return (
                    <p key={i} className="mb-3">
                      {parts.map((part, idx) => (idx % 2 === 1 ? <strong key={idx} className="text-white font-semibold">{part}</strong> : part))}
                    </p>
                  );
                }
                return <p key={i} className="mb-3">{line}</p>;
              })
            ) : (
              <p className="text-slate-500 italic">No reports compiled yet.</p>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
