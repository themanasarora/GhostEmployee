/**
 * Sales Ghost Workflow Engine
 *
 * Flow:
 * 1. CEO detects sales intent in board room → creates Task for Sales Ghost
 * 2. Workflow starts in Sales Ghost 1-on-1 chat
 * 3. Step 1: Research target customers (web search)
 * 4. Step 2: Generate outreach sequences
 * 5. Step 3: Present to user, await approval
 * 6. User types approve/reject in chat
 * 7. On approve: save to context, mark task complete
 * 8. On reject: revise and resubmit
 */

import {
  addBoardMessage,
  addAgentChatMessage,
  addTask,
  saveWorkflow,
  createWorkflow,
  buildContextWindow,
  getProject,
  getGoal,
  getEmployeeDetails,
  WorkflowState,
  WorkflowStep,
  EmployeeRole,
  Message,
} from "@/lib/store";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkflowContext {
  userId: string;
  projectId: string;
  goalId: string;
  goalText: string;
  boardContext: string;
}

// ─── Main trigger — called after CEO detects sales intent ────────────────────

export async function triggerSalesWorkflow(ctx: WorkflowContext): Promise<string> {
  const { userId, projectId, goalId, goalText, boardContext } = ctx;

  // 1. Create task in store
  const task = addTask(userId, projectId, goalId, {
    goalId,
    assignedRole: "sales",
    title: "Lead generation + outreach sequences",
    description: `Triggered from board room discussion: "${goalText}"`,
    status: "pending",
  });

  // 2. Create workflow state
  const workflow = createWorkflow(userId, projectId, goalId, task.id, "sales");

  // 3. Post announcement in board room
  addBoardMessage(userId, projectId, goalId, {
    sender: "ceo",
    senderName: "CEO Ghost",
    senderIcon: "👔",
    content: `I've detected a sales opportunity in our discussion. I'm assigning Sales Ghost to run a lead generation workflow. Check your Sales Ghost chat for updates and approval requests.`,
  });

  // 4. Post kickoff message in Sales Ghost chat
  addAgentChatMessage(userId, projectId, "sales", {
    sender: "sales",
    senderName: "Sales Ghost",
    senderIcon: "🤝",
    content: `I've been assigned a lead generation workflow from the board room discussion.\n\n**Goal:** ${goalText}\n\n**My workflow:**\n1. Research target customer profile\n2. Find lead sources and channels\n3. Generate outreach sequences\n4. Present to you for approval\n\nStarting now...`,
  });

  // 5. Run workflow steps
  await runSalesWorkflow(ctx, task.id, workflow);

  return task.id;
}

// ─── Workflow execution ───────────────────────────────────────────────────────

async function runSalesWorkflow(
  ctx: WorkflowContext,
  taskId: string,
  workflow: WorkflowState
) {
  const { userId, projectId, goalId, goalText, boardContext } = ctx;

  // Update status
  workflow.status = "researching";
  saveWorkflow(userId, projectId, goalId, taskId, workflow);

  // ─ Step 1: Research ──────────────────────────────────────────────────────

  addAgentChatMessage(userId, projectId, "sales", {
    sender: "system",
    senderName: "System",
    senderIcon: "⚙️",
    content: "Step 1/3: Researching target customer profile...",
  });

  const researchResult = await callSalesAI({
    step: "research",
    goalText,
    boardContext,
    previousOutput: "",
  });

  workflow.steps.push({
    id: crypto.randomUUID(),
    label: "Target customer research",
    status: "complete",
    output: researchResult,
    createdAt: Date.now(),
  });
  workflow.status = "generating";
  saveWorkflow(userId, projectId, goalId, taskId, workflow);

  addAgentChatMessage(userId, projectId, "sales", {
    sender: "sales",
    senderName: "Sales Ghost",
    senderIcon: "🤝",
    content: `**Research complete.**\n\n${researchResult}`,
  });

  await delay(600);

  // ─ Step 2: Generate outreach sequences ───────────────────────────────────

  addAgentChatMessage(userId, projectId, "sales", {
    sender: "system",
    senderName: "System",
    senderIcon: "⚙️",
    content: "Step 2/3: Generating outreach sequences...",
  });

  const outreachResult = await callSalesAI({
    step: "outreach",
    goalText,
    boardContext,
    previousOutput: researchResult,
  });

  workflow.steps.push({
    id: crypto.randomUUID(),
    label: "Outreach sequence generation",
    status: "complete",
    output: outreachResult,
    createdAt: Date.now(),
  });
  saveWorkflow(userId, projectId, goalId, taskId, workflow);

  addAgentChatMessage(userId, projectId, "sales", {
    sender: "sales",
    senderName: "Sales Ghost",
    senderIcon: "🤝",
    content: `**Outreach sequences ready.**\n\n${outreachResult}`,
  });

  await delay(600);

  // ─ Step 3: Present for approval ──────────────────────────────────────────

  workflow.status = "awaiting_approval";
  saveWorkflow(userId, projectId, goalId, taskId, workflow);

  const summary = `${researchResult}\n\n---\n\n${outreachResult}`;

  addAgentChatMessage(userId, projectId, "sales", {
    sender: "sales",
    senderName: "Sales Ghost",
    senderIcon: "🤝",
    content: `**Workflow complete. Ready for your approval.**\n\n---\n\n**FULL SALES PLAN**\n\n${summary}\n\n---\n\nType **approve** to save this to project memory and close the task.\nType **reject** with feedback to revise (e.g. "reject — focus on enterprise customers only").`,
  });
}

// ─── Handle user response in chat ────────────────────────────────────────────

export async function handleSalesApproval(
  ctx: WorkflowContext,
  taskId: string,
  workflow: WorkflowState,
  userMessage: string
): Promise<{ handled: boolean; response: string }> {
  const { userId, projectId, goalId, goalText, boardContext } = ctx;
  const lower = userMessage.toLowerCase().trim();

  // Detect approve
  if (lower.startsWith("approve") || lower === "yes" || lower === "looks good") {
    workflow.status = "approved";
    const finalOutput = workflow.steps.map((s) => s.output).join("\n\n");
    workflow.finalOutput = finalOutput;
    saveWorkflow(userId, projectId, goalId, taskId, { ...workflow, status: "complete" });

    // Post completion to board room
    addBoardMessage(userId, projectId, goalId, {
      sender: "sales",
      senderName: "Sales Ghost",
      senderIcon: "🤝",
      content: `Sales workflow approved and complete. I've generated a target customer profile and outreach sequences for "${goalText}". Full details are in your Sales Ghost chat and saved to project memory.`,
    });

    return {
      handled: true,
      response: `Sales plan approved and saved to project memory.\n\nThis will now be referenced in all future board room discussions and agent chats. You can ask me to refine any part of the outreach at any time.\n\nThe task has been marked complete in your Task Log.`,
    };
  }

  // Detect reject
  if (lower.startsWith("reject") || lower.startsWith("no") || lower.startsWith("revise")) {
    const feedback = userMessage.replace(/^reject\s*[-—]?\s*/i, "").trim() || "Please revise and improve.";
    workflow.status = "generating";
    saveWorkflow(userId, projectId, goalId, taskId, workflow);

    // Regenerate with feedback
    const revised = await callSalesAI({
      step: "revise",
      goalText,
      boardContext,
      previousOutput: workflow.steps.map((s) => s.output).join("\n\n"),
      feedback,
    });

    workflow.steps.push({
      id: crypto.randomUUID(),
      label: `Revision: ${feedback.slice(0, 50)}`,
      status: "complete",
      output: revised,
      createdAt: Date.now(),
    });
    workflow.status = "awaiting_approval";
    saveWorkflow(userId, projectId, goalId, taskId, workflow);

    return {
      handled: true,
      response: `Understood. Here's the revised plan based on your feedback: "${feedback}"\n\n---\n\n${revised}\n\n---\n\nType **approve** to save this or **reject** with more feedback.`,
    };
  }

  return { handled: false, response: "" };
}

// ─── AI calls ─────────────────────────────────────────────────────────────────

interface SalesAIParams {
  step: "research" | "outreach" | "revise";
  goalText: string;
  boardContext: string;
  previousOutput: string;
  feedback?: string;
}

async function callSalesAI(params: SalesAIParams): Promise<string> {
  const { step, goalText, boardContext, previousOutput, feedback } = params;

  const prompts: Record<string, string> = {
    research: `You are Sales Ghost, an expert sales strategist.
Based on this project goal: "${goalText}"
And this board room context: "${boardContext.slice(0, 500)}"

Define the ideal customer profile (ICP):
1. Who are the top 3 target customer segments?
2. What are their pain points?
3. Where can we find them (channels, platforms, communities)?
4. What is the best approach to reach them?

Be specific and actionable. Format with clear sections.`,

    outreach: `You are Sales Ghost, an expert sales strategist.
Project goal: "${goalText}"
Target customer research: "${previousOutput.slice(0, 400)}"

Generate a complete outreach sequence:
1. Cold email subject lines (3 options)
2. Cold email template (personalized, under 150 words)
3. LinkedIn connection message (under 300 characters)
4. Follow-up email (Day 3)
5. Final follow-up (Day 7)

Make each message specific to the target customer profile above.`,

    revise: `You are Sales Ghost revising your sales plan based on feedback.
Original goal: "${goalText}"
Previous plan: "${previousOutput.slice(0, 600)}"
User feedback: "${feedback}"

Revise the complete sales plan addressing the feedback specifically.
Keep what worked, fix what was criticized. Be specific and actionable.`,
  };

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [],
        systemPrompt: prompts[step],
        agentId: "sales",
        projectName: "Sales Workflow",
        projectGoal: goalText,
        mode: "chat",
      }),
    });
    const data = await res.json();
    return data.content as string;
  } catch {
    return getMockSalesOutput(step, goalText);
  }
}

function getMockSalesOutput(step: string, goalText: string): string {
  if (step === "research") {
    return `**Target Customer Profile (ICP)**

**Segment 1: Early-stage startup founders (seed to Series A)**
Pain points: No time for manual outreach, need fast validation
Where to find: IndieHackers, Twitter/X, ProductHunt, YC alumni network
Approach: Problem-first cold email, reference their recent posts

**Segment 2: Agency operators (10-50 person teams)**
Pain points: High delivery costs, slow research turnaround
Where to find: LinkedIn, agency directories, Slack communities
Approach: ROI-focused pitch with time-savings calculator

**Segment 3: Freelance consultants**
Pain points: Client acquisition is their biggest challenge
Where to find: Upwork, Toptal, LinkedIn
Approach: Show how AI workforce replaces expensive subcontractors`;
  }

  if (step === "outreach") {
    return `**Outreach Sequences**

**Subject Lines:**
1. "Your team of AI employees is ready, [Name]"
2. "What if you could validate [their startup] in 15 minutes?"
3. "Skip the prompting, hire the team"

**Cold Email Template:**
Hi [Name],

Saw you're building [their product]. The hardest part at your stage is usually validation without burning runway on consultants.

GhostEmployee gives you a CEO, PM, and Research analyst that collaborate on your goals in real time. No prompting. One goal in, full report out.

Worth a 10-minute look? [link]

[Your name]

**LinkedIn Message:**
"Hi [Name] — love what you're building with [product]. Built something that might save you weeks of validation work. Happy to show you in 5 min?"

**Day 3 Follow-up:**
"Quick follow-up — did you get a chance to look? Happy to run a live demo with your actual startup idea."

**Day 7 Final:**
"Last note — if timing isn't right, no worries. I'll leave the demo link here: [link]. Would love your feedback when you're ready."`;
  }

  return `Revised sales plan incorporating your feedback. The outreach now focuses specifically on the criteria you mentioned with updated messaging and targeting approach.`;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
