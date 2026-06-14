"use client";

import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  getProject,
  getEmployeeDetails,
  Project,
  Task,
  getProjectTasks,
  createGoal,
  addTask,
  deriveTaskAssignee,
  markTaskRunning,
  completeTask,
  updateTask,
  requestTaskApproval,
  resolveTaskApproval,
  deliverTaskArtifact,
  appendTaskLog,
  getTaskById,
} from "@/lib/store";
import { getProviderConnections, mapActionToProvider } from "@/lib/providers";
import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { ArrowLeft, Activity, CheckCircle2, Clock, XCircle, Loader2, Plus, Sparkles, MessageSquare, ShieldAlert, ChevronRight, FileText, BellRing, Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn, downloadTextFile } from "@/lib/utils";
import { EMPLOYEES } from "@/lib/plans";

type TaskAction = "email" | "slack" | "research" | "ats" | "browser" | "calendar" | "approval" | "report";

type TaskSource = "user" | "agent";

type EmailDeliveryMode = "draft" | "send";

type EmailDraft = {
  to: string;
  subject: string;
  body: string;
};

type CalendarAction = "list" | "create" | "update" | "delete";

type CalendarEvent = {
  id: string;
  summary: string;
  description: string;
  start: string;
  end: string;
  attendees: string;
};

const ACTIONS: Array<{ value: TaskAction; label: string; detail: string }> = [
  { value: "research", label: "Web research", detail: "Search, compare, and summarize findings." },
  { value: "email", label: "Email", detail: "Draft or send follow-ups and updates." },
  { value: "slack", label: "Slack", detail: "Post team updates or status messages." },
  { value: "ats", label: "ATS / hiring", detail: "Search candidates and hiring pipelines." },
  { value: "browser", label: "Browser automation", detail: "Navigate tools and capture outputs." },
  { value: "calendar", label: "Calendar", detail: "Schedule or adjust meetings." },
  { value: "report", label: "Report", detail: "Create a structured analysis or deliverable." },
  { value: "approval", label: "Approval gate", detail: "Pause and request a human decision." },
];

function buildExecutionNote(taskTitle: string, action: TaskAction, assigneeName: string, providerConnected: boolean) {
  if (action === "report") {
    return {
      summary: `${assigneeName} drafted a structured report for: ${taskTitle}`,
      artifact: `Report draft for ${taskTitle}\n\nThis is a generated placeholder report. Once the report provider is wired, this slot will contain the real file output or external export.\n\nRecommended sections:\n- Objective\n- Key findings\n- Risks\n- Next actions`,
      placeholder: false,
    };
  }

  if (action === "email") {
    return providerConnected
      ? {
          summary: `${assigneeName} prepared a Gmail draft for: ${taskTitle}. Gmail access is connected, but the live send adapter is still pending.`,
          artifact: `Gmail draft placeholder for ${taskTitle}

Action: email
Assigned agent: ${assigneeName}

The user has connected Gmail. The task can now move into a real Gmail send/draft flow once the provider adapter is implemented. For now, this is a draft-ready placeholder with the final content to review before send.`,
          placeholder: true,
        }
      : {
          summary: `${assigneeName} used placeholder execution for email on: ${taskTitle}`,
          artifact: `Email placeholder for ${taskTitle}

Action: email
Assigned agent: ${assigneeName}

Gmail is not connected yet. Connect Gmail in Settings to unlock draft/send execution for email tasks.`,
          placeholder: true,
        };
  }

  if (providerConnected) {
    return {
      summary: `${assigneeName} has provider access ready for ${action} on: ${taskTitle}. The live adapter is still pending, so this task stayed on the placeholder path while preserving the approved connection state.`,
      artifact: `Connected provider state detected for ${taskTitle}

Action: ${action}
Assigned agent: ${assigneeName}

The user has granted provider access, but the live adapter is not wired yet. This placeholder output confirms the task is ready to switch to a real provider call as soon as the integration lands.`,
      placeholder: true,
    };
  }

  return {
    summary: `${assigneeName} used placeholder execution for ${action} on: ${taskTitle}`,
    artifact: `Placeholder execution for ${taskTitle}\n\nAction: ${action}\nAssigned agent: ${assigneeName}\n\nThis provider is not wired yet. The task moved forward using a stub so the queue stays unblocked. When the integration is connected, this same step will execute against the real provider and return a live result.\n\nNext step: connect the relevant provider in Settings.`,
    placeholder: true,
  };
}

export default function TaskLogPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [action, setAction] = useState<TaskAction>("research");
  const [source, setSource] = useState<TaskSource>("user");
  const [emailDraft, setEmailDraft] = useState<EmailDraft>({ to: "", subject: "", body: "" });
  const [emailDeliveryMode, setEmailDeliveryMode] = useState<EmailDeliveryMode>("draft");
  const [calendarAction, setCalendarAction] = useState<CalendarAction>("list");
  const [calendarEvent, setCalendarEvent] = useState<CalendarEvent>({
    id: "",
    summary: "",
    description: "",
    start: "",
    end: "",
    attendees: "",
  });
  const [needsApproval, setNeedsApproval] = useState(false);
  const [approvalReason, setApprovalReason] = useState("");
  const [activeApprovalTaskId, setActiveApprovalTaskId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const providerConnections = user ? getProviderConnections(user.uid) : getProviderConnections("anonymous");

  useEffect(() => {
    if (!user) return;
    const p = getProject(user.uid, id);
    if (!p) { router.replace("/dashboard"); return; }
    setProject(p);
    if (!selectedGoalId && p.goals[0]) setSelectedGoalId(p.goals[0].id);
  }, [user, id]);

  useEffect(() => {
    if (!project) return;
    const pendingApprovalTask = getProjectTasks(project).find((task) => task.status === "waiting_approval");
    if (pendingApprovalTask) {
      setActiveApprovalTaskId(pendingApprovalTask.id);
      setShowApproval(true);
    }
  }, [project?.updatedAt]);

  function refresh() {
    if (!user) return;
    const p = getProject(user.uid, id);
    if (!p) { router.replace("/dashboard"); return; }
    setProject(p);
    if (!selectedGoalId && p.goals[0]) setSelectedGoalId(p.goals[0].id);
  }

  function getActionDetail(currentAction: TaskAction) {
    return ACTIONS.find((entry) => entry.value === currentAction)?.detail ?? "Execute the requested workflow.";
  }

  async function handleCreateTask() {
    if (!user || !project || !title.trim() || creating) return;
    setCreating(true);

    let goalId = selectedGoalId;
    if (!goalId) {
      const goal = createGoal(user.uid, id, "Execution queue");
      goalId = goal.id;
    }

    const assignedRole = deriveTaskAssignee(action);
    const task = addTask(user.uid, id, goalId, {
      goalId,
      source,
      action,
      assignedRole,
      title: title.trim(),
      description: action === "email"
        ? `${description.trim() || getActionDetail(action)}\n\nEmail draft\nTo: ${emailDraft.to || "(recipient needed)"}\nSubject: ${emailDraft.subject || title.trim()}\nBody: ${emailDraft.body || description.trim() || getActionDetail(action)}`
        : action === "calendar"
        ? `${description.trim() || getActionDetail(action)}\n\nCalendar Action: ${calendarAction}\n${
            calendarAction === "create"
              ? `Title: ${calendarEvent.summary}\nStart: ${calendarEvent.start}\nEnd: ${calendarEvent.end}\nAttendees: ${calendarEvent.attendees}\nDetails: ${calendarEvent.description}`
              : calendarAction === "update"
              ? `Event ID: ${calendarEvent.id}\nNew Title: ${calendarEvent.summary || "(no change)"}\nNew Start: ${calendarEvent.start || "(no change)"}\nNew End: ${calendarEvent.end || "(no change)"}`
              : calendarAction === "delete"
              ? `Cancel Event ID: ${calendarEvent.id}`
              : "List upcoming events"
          }`
        : description.trim() || getActionDetail(action),
      deliveryMode: action === "email" ? emailDeliveryMode : undefined,
      status: needsApproval ? "waiting_approval" : "pending",
      approvalState: needsApproval ? "needed" : "not_needed",
      approvalReason: needsApproval ? approvalReason.trim() || "This task changes an external system or sends a message outside the workspace." : undefined,
      output: undefined,
      startedAt: undefined,
      completedAt: undefined,
      payload: action === "email" ? { emailDraft, emailDeliveryMode } : action === "calendar" ? { calendarAction, calendarEvent } : undefined,
    });

    if (needsApproval) {
      requestTaskApproval(
        user.uid,
        id,
        goalId,
        task.id,
        approvalReason.trim() || "Approval is required before the task can execute."
      );
      setActiveApprovalTaskId(task.id);
      setShowApproval(true);
      appendTaskLog(user.uid, id, goalId, task.id, {
        title: "Queued for approval",
        detail: "The assigned agent is waiting for your decision.",
        level: "approval",
      });
    } else {
      executeTaskNow(user.uid, id, goalId, task.id, assignedRole, title.trim(), action, description.trim() || getActionDetail(action), refresh);
    }

    setTitle("");
    setDescription("");
    setAction("research");
    setSource("user");
    setEmailDraft({ to: "", subject: "", body: "" });
    setEmailDeliveryMode("draft");
    setCalendarAction("list");
    setCalendarEvent({ id: "", summary: "", description: "", start: "", end: "", attendees: "" });
    setNeedsApproval(false);
    setApprovalReason("");
    setShowComposer(false);
    setCreating(false);
    refresh();
  }

  function handleApprovalDecision(approved: boolean) {
    if (!user || !project || !activeApprovalTaskId) return;
    const located = project.goals
      .flatMap((goal) => goal.tasks.map((task) => ({ goal, task })))
      .find(({ task }) => task.id === activeApprovalTaskId);
    if (!located) return;

    resolveTaskApproval(user.uid, id, located.goal.id, located.task.id, approved, approved ? "User approved execution." : "User rejected execution.");

    if (approved) {
      executeTaskNow(
        user.uid,
        id,
        located.goal.id,
        located.task.id,
        located.task.assignedRole,
        located.task.title,
        located.task.action,
        located.task.description,
        refresh
      );
    }

    setShowApproval(false);
    setActiveApprovalTaskId(null);
    refresh();
  }

  if (!project) return (
    <div className="min-h-screen bg-[#0A0A14] flex items-center justify-center">
      <div className="size-8 rounded-full border-2 border-[#E94560] border-t-transparent animate-spin" />
    </div>
  );

  const allTasks = getProjectTasks(project);
  const recentEvents = project.taskEvents.slice(0, 8);
  const actionConfig = ACTIONS.find((entry) => entry.value === action);

  function providerConnectionFor(actionType: TaskAction) {
    const providerId = mapActionToProvider(actionType);
    return providerId ? providerConnections[providerId] : null;
  }

  function executeTaskNow(
    userId: string,
    projectId: string,
    goalId: string,
    taskId: string,
    assigneeRole: Task["assignedRole"],
    taskTitle: string,
    actionType: TaskAction,
    taskDescription: string,
    done: () => void
  ) {
    const assigneeName = getEmployeeDetails(assigneeRole).name;
    const providerConnected = actionType === "report" ? true : Boolean(providerConnectionFor(actionType)?.connected);
    
    // Retrieve stored task details or fall back to current form states
    const taskObj = getTaskById(userId, projectId, taskId)?.task;
    const taskPayload = taskObj?.payload;
    const activeEmailDraft = taskPayload?.emailDraft || { ...emailDraft };
    const activeEmailDeliveryMode = taskPayload?.emailDeliveryMode || emailDeliveryMode;
    const activeCalendarAction = taskPayload?.calendarAction || calendarAction;
    const activeCalendarEvent = taskPayload?.calendarEvent || { ...calendarEvent };

    markTaskRunning(userId, projectId, goalId, taskId, `Assigned to ${assigneeName}.`);
    appendTaskLog(userId, projectId, goalId, taskId, {
      title: "Agent picked up task",
      detail: `${assigneeName} is preparing ${actionType}.`,
      level: "info",
      role: assigneeRole,
    });

    window.setTimeout(() => {
      if (actionType === "email") {
        const route = activeEmailDeliveryMode === "draft" ? "/api/gmail/draft" : "/api/gmail/send";
        void (async () => {
          try {
            const response = await fetch(route, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId,
                to: activeEmailDraft.to,
                subject: activeEmailDraft.subject || taskTitle,
                body: activeEmailDraft.body || taskDescription,
              }),
            });
            const data = await response.json();

            if (!response.ok || !data.ok) {
              const errorMessage = data.error || "Gmail request failed.";
              appendTaskLog(userId, projectId, goalId, taskId, {
                title: "Gmail error",
                detail: errorMessage,
                level: "error",
                role: assigneeRole,
              });
              updateTaskFailure(userId, projectId, goalId, taskId, errorMessage);
              deliverTaskArtifact(userId, projectId, goalId, taskId, assigneeRole, {
                title: `${taskTitle} failed`,
                content: `Gmail ${route.includes("draft") ? "draft" : "send"} failed.\n\nError: ${errorMessage}\n\nRecipient: ${activeEmailDraft.to || "(not set)"}\nSubject: ${activeEmailDraft.subject || taskTitle}`,
              });
              done();
              return;
            }

            const resultText = route.includes("draft")
              ? `Draft created in Gmail for ${activeEmailDraft.to || "recipient not set"}`
              : `Email sent to ${activeEmailDraft.to || "recipient not set"}`;

            appendTaskLog(userId, projectId, goalId, taskId, {
              title: route.includes("draft") ? "Gmail draft created" : "Gmail message sent",
              detail: route.includes("draft") ? `Draft id: ${data.draft?.id || "n/a"}` : `Message id: ${data.result?.id || "n/a"}`,
              level: "success",
              role: assigneeRole,
            });
            completeTask(userId, projectId, goalId, taskId, resultText);
            deliverTaskArtifact(userId, projectId, goalId, taskId, assigneeRole, {
              title: `${taskTitle} artifact`,
              content: `${route.includes("draft") ? "Gmail draft" : "Gmail message"} ${route.includes("draft") ? "created" : "sent"} successfully.\n\nRecipient: ${activeEmailDraft.to || "(not set)"}\nSubject: ${activeEmailDraft.subject || taskTitle}\nMode: ${activeEmailDeliveryMode}\n\nResponse:\n${JSON.stringify(data, null, 2)}`,
            });
            done();
          } catch (gmailError) {
            const errorMessage = gmailError instanceof Error ? gmailError.message : "Unknown Gmail error.";
            appendTaskLog(userId, projectId, goalId, taskId, {
              title: "Gmail error",
              detail: errorMessage,
              level: "error",
              role: assigneeRole,
            });
            updateTaskFailure(userId, projectId, goalId, taskId, errorMessage);
            deliverTaskArtifact(userId, projectId, goalId, taskId, assigneeRole, {
              title: `${taskTitle} failed`,
              content: `Gmail execution failed.\n\nError: ${errorMessage}\n\nRecipient: ${activeEmailDraft.to || "(not set)"}\nSubject: ${activeEmailDraft.subject || taskTitle}\nMode: ${activeEmailDeliveryMode}`,
            });
            done();
          }
        })();
        return;
      }

      if (actionType === "calendar") {
        void (async () => {
          let route = "/api/calendar/events";
          let payload: any = { userId };
          const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
          
          if (activeCalendarAction === "create") {
            payload = {
              userId,
              summary: activeCalendarEvent.summary || taskTitle,
              description: activeCalendarEvent.description || taskDescription,
              start: activeCalendarEvent.start,
              end: activeCalendarEvent.end,
              attendees: activeCalendarEvent.attendees ? activeCalendarEvent.attendees.split(",").map((e: string) => e.trim()) : [],
              timeZone,
            };
          } else if (activeCalendarAction === "update") {
            route = "/api/calendar/events/update";
            payload = {
              userId,
              eventId: activeCalendarEvent.id,
              summary: activeCalendarEvent.summary || undefined,
              start: activeCalendarEvent.start || undefined,
              end: activeCalendarEvent.end || undefined,
              timeZone,
            };
          } else if (activeCalendarAction === "delete") {
            route = "/api/calendar/events/delete";
            payload = {
              userId,
              eventId: activeCalendarEvent.id,
            };
          }

          try {
            let method = "POST";
            let url = route;
            if (activeCalendarAction === "list") {
              method = "GET";
              url = `/api/calendar/events?userId=${encodeURIComponent(userId)}`;
            }

            const response = await fetch(url, {
              method,
              headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
              body: method === "POST" ? JSON.stringify(payload) : undefined,
            });
            const data = await response.json();

            if (!response.ok || !data.ok) {
              const errorMessage = data.error || "Google Calendar request failed.";
              appendTaskLog(userId, projectId, goalId, taskId, {
                title: "Calendar error",
                detail: errorMessage,
                level: "error",
                role: assigneeRole,
              });
              updateTaskFailure(userId, projectId, goalId, taskId, errorMessage);
              deliverTaskArtifact(userId, projectId, goalId, taskId, assigneeRole, {
                title: `${taskTitle} failed`,
                content: `Google Calendar action "${activeCalendarAction}" failed.\n\nError: ${errorMessage}`,
              });
              done();
              return;
            }

            let resultText = `Google Calendar action "${activeCalendarAction}" executed successfully.`;
            let artifactContent = `Calendar action "${activeCalendarAction}" completed.\n\nResponse:\n${JSON.stringify(data, null, 2)}`;

            if (activeCalendarAction === "list") {
              const items = data.data?.items || [];
              resultText = `Retrieved ${items.length} upcoming events from Google Calendar.`;
              artifactContent = `Google Calendar Upcoming Events:\n\n` + 
                items.map((item: any) => {
                  const start = item.start?.dateTime || item.start?.date || "N/A";
                  const end = item.end?.dateTime || item.end?.date || "N/A";
                  const sum = item.summary || "(No Title)";
                  return `- [${start} to ${end}] ${sum} (ID: ${item.id})`;
                }).join("\n");
            } else if (activeCalendarAction === "create") {
              resultText = `Scheduled new event "${data.data?.summary || activeCalendarEvent.summary}" (ID: ${data.data?.id})`;
              artifactContent = `Event Scheduled Successfully:\n\nEvent: ${data.data?.summary}\nStart: ${data.data?.start?.dateTime}\nEnd: ${data.data?.end?.dateTime}\nLink: ${data.data?.htmlLink || "N/A"}\nEvent ID: ${data.data?.id}`;
            } else if (activeCalendarAction === "update") {
              resultText = `Updated event details for Event ID: ${activeCalendarEvent.id}`;
            } else if (activeCalendarAction === "delete") {
              resultText = `Deleted/canceled event with Event ID: ${activeCalendarEvent.id}`;
            }

            appendTaskLog(userId, projectId, goalId, taskId, {
              title: `Google Calendar ${activeCalendarAction} success`,
              detail: resultText,
              level: "success",
              role: assigneeRole,
            });
            completeTask(userId, projectId, goalId, taskId, resultText);
            deliverTaskArtifact(userId, projectId, goalId, taskId, assigneeRole, {
              title: `${taskTitle} artifact`,
              content: artifactContent,
            });
            done();
          } catch (calError) {
            const errorMessage = calError instanceof Error ? calError.message : "Unknown Calendar error.";
            appendTaskLog(userId, projectId, goalId, taskId, {
              title: "Calendar error",
              detail: errorMessage,
              level: "error",
              role: assigneeRole,
            });
            updateTaskFailure(userId, projectId, goalId, taskId, errorMessage);
            deliverTaskArtifact(userId, projectId, goalId, taskId, assigneeRole, {
              title: `${taskTitle} failed`,
              content: `Google Calendar execution failed.\n\nError: ${errorMessage}`,
            });
            done();
          }
        })();
        return;
      }

      if (actionType === "slack") {
        void (async () => {
          try {
            const response = await fetch("/api/slack/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId,
                message: taskDescription,
                title: taskTitle,
              }),
            });
            const data = await response.json();

            if (!response.ok || !data.ok) {
              const errorMessage = data.error || "Slack request failed.";
              appendTaskLog(userId, projectId, goalId, taskId, {
                title: "Slack error",
                detail: errorMessage,
                level: "error",
                role: assigneeRole,
              });
              updateTaskFailure(userId, projectId, goalId, taskId, errorMessage);
              deliverTaskArtifact(userId, projectId, goalId, taskId, assigneeRole, {
                title: `${taskTitle} failed`,
                content: `Slack message delivery failed.\n\nError: ${errorMessage}\n\nMessage: ${taskDescription}`,
              });
              done();
              return;
            }

            const resultText = `Slack message posted: "${taskTitle}"`;

            appendTaskLog(userId, projectId, goalId, taskId, {
              title: "Slack message posted",
              detail: resultText,
              level: "success",
              role: assigneeRole,
            });
            completeTask(userId, projectId, goalId, taskId, resultText);
            deliverTaskArtifact(userId, projectId, goalId, taskId, assigneeRole, {
              title: `${taskTitle} artifact`,
              content: `Slack message posted successfully.\n\nTitle: ${taskTitle}\nMessage: ${taskDescription}\n\nResponse:\n${JSON.stringify(data, null, 2)}`,
            });
            done();
          } catch (slackError) {
            const errorMessage = slackError instanceof Error ? slackError.message : "Unknown Slack error.";
            appendTaskLog(userId, projectId, goalId, taskId, {
              title: "Slack error",
              detail: errorMessage,
              level: "error",
              role: assigneeRole,
            });
            updateTaskFailure(userId, projectId, goalId, taskId, errorMessage);
            deliverTaskArtifact(userId, projectId, goalId, taskId, assigneeRole, {
              title: `${taskTitle} failed`,
              content: `Slack execution failed.\n\nError: ${errorMessage}\n\nMessage: ${taskDescription}`,
            });
            done();
          }
        })();
        return;
      }

      const execution = buildExecutionNote(taskTitle, actionType, assigneeName, providerConnected);
      const draftBlock = actionType === "email"
        ? `\n\nDraft details:\nTo: ${emailDraft.to || "(recipient not set)"}\nSubject: ${emailDraft.subject || taskTitle}\nBody: ${emailDraft.body || taskDescription}`
        : actionType === "calendar"
        ? `\n\nCalendar Action details:\nAction: ${calendarAction}\nTitle: ${calendarEvent.summary || "(not set)"}\nStart: ${calendarEvent.start || "(not set)"}\nEnd: ${calendarEvent.end || "(not set)"}`
        : "";
      appendTaskLog(userId, projectId, goalId, taskId, {
        title: execution.placeholder ? (providerConnected ? "Provider connected, adapter pending" : "Placeholder execution used") : "Provider execution used",
        detail: providerConnected
          ? `Provider access exists for ${actionType}, but the adapter is still pending.`
          : `No live ${actionType} provider is connected yet.`,
        level: execution.placeholder ? "warning" : "success",
        role: assigneeRole,
      });
      completeTask(userId, projectId, goalId, taskId, execution.summary);
      deliverTaskArtifact(userId, projectId, goalId, taskId, assigneeRole, {
        title: `${taskTitle} artifact`,
        content: `${execution.artifact}${draftBlock}\n\nTask description:\n${taskDescription}`,
      });
      done();
    }, 650);
  }

  function updateTaskFailure(userId: string, projectId: string, goalId: string, taskId: string, errorMessage: string) {
    updateTask(userId, projectId, goalId, taskId, {
      status: "failed",
      output: `Failed: ${errorMessage}`,
      completedAt: Date.now(),
    });
  }

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
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowComposer(true)}>
              <Plus className="size-4" /> New task
            </Button>
            <Button size="sm" onClick={() => setShowApproval(true)}>
              <BellRing className="size-4" /> Approvals
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 md:col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="size-4 text-[#E94560]" />
              <h2 className="text-sm font-semibold text-white">Execution queue</h2>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-3">
              User-defined tasks and agent-generated tasks both enter this queue, get assigned immediately, and move through approval before external actions.
            </p>
            <div className="flex flex-wrap gap-2">
              {project.goals.map((goal) => (
                <button key={goal.id} onClick={() => router.push(`/project/${id}/goal/${goal.id}`)}
                  className="text-xs px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:border-white/20 transition-colors">
                  {goal.text}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="size-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-white">Agent routing</h2>
            </div>
            <div className="space-y-2 text-xs text-slate-400">
              {EMPLOYEES.slice(0, 4).map((emp) => (
                <div key={emp.role} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 border border-white/5">
                  <span>{emp.icon} {emp.name}</span>
                  <span className="text-slate-500">ready</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {allTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Activity className="size-10 text-slate-600 mb-3" />
            <p className="text-sm text-slate-400 mb-1">No tasks yet</p>
            <p className="text-xs text-slate-500">Create a task to assign an agent and start the approval flow.</p>
            <Button className="mt-4" size="sm" onClick={() => setShowComposer(true)}>
              <Plus className="size-4" /> Create task
            </Button>
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
                        <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">{task.source}</span>
                        <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">{task.action}</span>
                      </div>
                      <p className="text-xs text-slate-500 mb-1">Goal: {task.goalText}</p>
                      <p className="text-xs text-slate-400 leading-relaxed">{task.description}</p>
                      {task.approvalState !== "not_needed" && (
                        <div className="mt-2 flex items-center gap-2 text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                          <ShieldAlert className="size-3.5 shrink-0" />
                          <span>{task.approvalReason || "Approval required"}</span>
                        </div>
                      )}
                      {task.output && (
                        <div className="mt-2 rounded-lg bg-white/5 px-3 py-2">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[10px] uppercase tracking-widest text-slate-500">Artifact preview</span>
                            <button
                              onClick={() => downloadTextFile(`${task.title.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase()}-artifact.txt`, `${task.title}\n\nAction: ${task.action}\nAssigned agent: ${emp.name}\n\n${task.output}\n\nTask description:\n${task.description}`)}
                              className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-white/10 text-white hover:bg-white/15 transition-colors"
                            >
                              <Download className="size-3" /> Download
                            </button>
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">{task.output}</p>
                        </div>
                      )}
                      <p className="text-[10px] text-slate-600 mt-1.5">{new Date(task.createdAt).toLocaleString()}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button onClick={() => router.push(`/project/${id}/chat/${task.assignedRole}`)}
                          className="text-[10px] px-2.5 py-1 rounded-full bg-[#E94560]/10 text-[#E94560] border border-[#E94560]/20 hover:bg-[#E94560]/15 transition-colors">
                          Open agent chat
                        </button>
                        <button onClick={() => { setActiveApprovalTaskId(task.id); setShowApproval(true); }}
                          className="text-[10px] px-2.5 py-1 rounded-full bg-white/5 text-slate-300 border border-white/10 hover:text-white hover:border-white/20 transition-colors">
                          Review approval
                        </button>
                      </div>
                    </div>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0",
                      task.status === "complete" ? "bg-green-500/15 text-green-400" :
                      task.status === "waiting_approval" ? "bg-amber-500/15 text-amber-300" :
                      task.status === "running" ? "bg-blue-500/15 text-blue-400" :
                      task.status === "failed" ? "bg-red-500/15 text-red-400" :
                      "bg-yellow-500/15 text-yellow-400"
                    )}>{task.status}</span>
                  </div>
                  {task.logs.length > 0 && (
                    <div className="mt-4 border-t border-white/5 pt-3 space-y-2">
                      {task.logs.slice(-3).map((log) => (
                        <div key={log.id} className="flex items-start gap-2 text-[11px] text-slate-500">
                          <ChevronRight className="size-3.5 shrink-0 mt-0.5 text-slate-600" />
                          <div>
                            <p className="text-slate-300">{log.title}</p>
                            <p>{log.detail}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 bg-white/[0.03] border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="size-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-white">Common logs</h2>
          </div>
          {recentEvents.length === 0 ? (
            <p className="text-xs text-slate-500">Agent actions will show up here with timestamps.</p>
          ) : (
            <div className="space-y-2">
              {recentEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-3 rounded-lg bg-white/[0.03] border border-white/5 px-3 py-2">
                  <Clock className="size-3.5 text-slate-600 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-slate-200">{event.title}</span>
                      <span className="text-slate-600">{event.role ? getEmployeeDetails(event.role).name : "System"}</span>
                    </div>
                    <p className="text-[11px] text-slate-500">{event.detail}</p>
                  </div>
                  <span className="text-[10px] text-slate-600 shrink-0">{new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showComposer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={() => setShowComposer(false)} />
          <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/15 bg-[#0F0F1A] shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-white">Create executable task</h2>
                <p className="text-xs text-slate-500">The task is assigned immediately and routed to the right agent.</p>
              </div>
              <button onClick={() => setShowComposer(false)} className="text-slate-500 hover:text-white"><XCircle className="size-4" /></button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Task title" placeholder="Draft outreach sequence for launch leads" value={title} onChange={(e) => setTitle(e.target.value)} required />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-300">Attach to goal</label>
                <select value={selectedGoalId} onChange={(e) => setSelectedGoalId(e.target.value)} className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#E94560]">
                  {project.goals.length === 0 && <option value="" className="bg-[#0F0F1A]">Create a new queue automatically</option>}
                  {project.goals.map((goal) => <option key={goal.id} value={goal.id} className="bg-[#0F0F1A]">{goal.text}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-300">Action</label>
                <select value={action} onChange={(e) => setAction(e.target.value as TaskAction)} className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#E94560]">
                  {ACTIONS.map((item) => {
                    const isAdvanced = ["ats", "browser", "calendar"].includes(item.value);
                    const disabled = project.plan === "basic" && isAdvanced;
                    return (
                      <option key={item.value} value={item.value} disabled={disabled} className="bg-[#0F0F1A]">
                        {item.label} {disabled ? "(Advanced plan only)" : ""}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[11px] text-slate-500">{actionConfig?.detail}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-300">Source</label>
                <select value={source} onChange={(e) => setSource(e.target.value as TaskSource)} className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#E94560]">
                  <option value="user" className="bg-[#0F0F1A]">User defined</option>
                  <option value="agent" className="bg-[#0F0F1A]">Agent generated</option>
                </select>
              </div>
              {action === "email" && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-slate-300">Delivery mode</label>
                    <select value={emailDeliveryMode} onChange={(e) => setEmailDeliveryMode(e.target.value as EmailDeliveryMode)} className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#E94560]">
                      <option value="draft" className="bg-[#0F0F1A]">Create draft</option>
                      <option value="send" className="bg-[#0F0F1A]">Send email</option>
                    </select>
                  </div>
                  <Input label="Recipient email" placeholder="person@company.com" value={emailDraft.to} onChange={(e) => setEmailDraft((prev) => ({ ...prev, to: e.target.value }))} />
                  <Input label="Subject" placeholder="Follow-up on the launch plan" value={emailDraft.subject} onChange={(e) => setEmailDraft((prev) => ({ ...prev, subject: e.target.value }))} />
                  <div className="md:col-span-2 flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-slate-300">Body</label>
                    <textarea value={emailDraft.body} onChange={(e) => setEmailDraft((prev) => ({ ...prev, body: e.target.value }))} rows={4} placeholder="Write the email body the agent should draft or send." className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E94560] resize-none" />
                  </div>
                </>
              )}
              {action === "calendar" && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-slate-300">Calendar Action</label>
                    <select value={calendarAction} onChange={(e) => setCalendarAction(e.target.value as CalendarAction)} className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#E94560]">
                      <option value="list" className="bg-[#0F0F1A]">List upcoming events</option>
                      <option value="create" className="bg-[#0F0F1A]">Schedule new event</option>
                      <option value="update" className="bg-[#0F0F1A]">Update existing event</option>
                      <option value="delete" className="bg-[#0F0F1A]">Cancel/delete event</option>
                    </select>
                  </div>
                  {calendarAction === "create" && (
                    <>
                      <Input label="Event Title" placeholder="Sync Meeting" value={calendarEvent.summary} onChange={(e) => setCalendarEvent((prev) => ({ ...prev, summary: e.target.value }))} />
                      <Input label="Attendees (comma separated emails)" placeholder="pm@company.com, ceo@company.com" value={calendarEvent.attendees} onChange={(e) => setCalendarEvent((prev) => ({ ...prev, attendees: e.target.value }))} />
                      <Input label="Start Date/Time" type="datetime-local" value={calendarEvent.start} onChange={(e) => setCalendarEvent((prev) => ({ ...prev, start: e.target.value }))} />
                      <Input label="End Date/Time" type="datetime-local" value={calendarEvent.end} onChange={(e) => setCalendarEvent((prev) => ({ ...prev, end: e.target.value }))} />
                      <div className="md:col-span-2 flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-slate-300">Event Description</label>
                        <textarea value={calendarEvent.description} onChange={(e) => setCalendarEvent((prev) => ({ ...prev, description: e.target.value }))} rows={3} placeholder="Discuss MVP release roadmap." className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E94560] resize-none" />
                      </div>
                    </>
                  )}
                  {calendarAction === "update" && (
                    <>
                      <Input label="Event ID" placeholder="Google Calendar Event ID" value={calendarEvent.id} onChange={(e) => setCalendarEvent((prev) => ({ ...prev, id: e.target.value }))} />
                      <Input label="New Title (optional)" placeholder="New Sync Meeting" value={calendarEvent.summary} onChange={(e) => setCalendarEvent((prev) => ({ ...prev, summary: e.target.value }))} />
                      <Input label="New Start Date/Time (optional)" type="datetime-local" value={calendarEvent.start} onChange={(e) => setCalendarEvent((prev) => ({ ...prev, start: e.target.value }))} />
                      <Input label="New End Date/Time (optional)" type="datetime-local" value={calendarEvent.end} onChange={(e) => setCalendarEvent((prev) => ({ ...prev, end: e.target.value }))} />
                    </>
                  )}
                  {calendarAction === "delete" && (
                    <Input label="Event ID to Cancel" placeholder="Google Calendar Event ID" value={calendarEvent.id} onChange={(e) => setCalendarEvent((prev) => ({ ...prev, id: e.target.value }))} />
                  )}
                </>
              )}
              <div className="md:col-span-2 flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-300">Task description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Explain the expected result, constraints, or sub tasks." className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E94560] resize-none" />
              </div>
              <div className="md:col-span-2 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <input id="needsApproval" type="checkbox" checked={needsApproval} onChange={(e) => setNeedsApproval(e.target.checked)} className="size-4 accent-[#E94560]" />
                <label htmlFor="needsApproval" className="text-sm text-slate-300 flex-1">
                  Require approval before execution
                </label>
              </div>
              {needsApproval && (
                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-300">Approval note</label>
                  <textarea value={approvalReason} onChange={(e) => setApprovalReason(e.target.value)} rows={2} placeholder="Explain why the agent must wait for approval." className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#E94560] resize-none" />
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <Button variant="ghost" fullWidth type="button" onClick={() => setShowComposer(false)}>Cancel</Button>
              <Button fullWidth type="button" onClick={handleCreateTask} loading={creating} disabled={!title.trim()}>Create and assign</Button>
            </div>
          </div>
        </div>
      )}

      {showApproval && activeApprovalTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={() => setShowApproval(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-white/15 bg-[#0F0F1A] shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="size-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                <ShieldAlert className="size-5 text-amber-300" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Approval needed</h2>
                <p className="text-xs text-slate-500">The assigned agent is waiting for your confirmation.</p>
              </div>
            </div>
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {project.goals.flatMap((goal) => goal.tasks.map((task) => ({ goal, task }))).filter(({ task }) => task.id === activeApprovalTaskId).map(({ goal, task }) => (
                <div key={task.id} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-sm font-medium text-white">{task.title}</p>
                  <p className="text-xs text-slate-500 mt-1">{task.description}</p>
                  <p className="text-[11px] text-slate-600 mt-2">Goal: {goal.text}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <Button variant="ghost" fullWidth type="button" onClick={() => handleApprovalDecision(false)}>Reject</Button>
              <Button fullWidth type="button" onClick={() => handleApprovalDecision(true)}>Approve</Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}