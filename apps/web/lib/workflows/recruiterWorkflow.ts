/**
 * Recruiter Ghost Workflow Engine
 *
 * Autonomous workflow:
 * 1. CEO or user triggers recruiting intent via chat/board room
 * 2. Recruiter Ghost scans Gmail (past 30 days) for job applications
 * 3. Server-side: Extracts emails, attachments/resumes, runs LLM ATS scoring
 * 4. Presents candidate summary table to user in recruiter chat
 * 5. User approves candidate(s) with meeting time → Calendar event + follow-up email
 * 6. User rejects candidate → Logged and discarded
 */

import {
  addAgentChatMessage,
  addTask,
  saveWorkflow,
  createWorkflow,
  getProject,
  WorkflowState,
  EmployeeRole,
} from "@/lib/store";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecruiterWorkflowContext {
  userId: string;
  projectId: string;
  goalId: string;
  goalText: string;
  boardContext: string;
  projectDescription: string;
  daysBack?: number;
}

export interface CandidateResult {
  messageId: string;
  from: string;
  email: string;
  name: string;
  subject: string;
  date: string;
  snippet: string;
  bodyText: string;
  resumeText: string;
  hasResume: boolean;
  atsScore: number;
  matchedSkills: string[];
  recommendation: string;
}

// ─── Main trigger — called after intent detection ────────────────────────────

export async function triggerRecruiterWorkflow(
  ctx: RecruiterWorkflowContext
): Promise<string> {
  const { userId, projectId, goalId, goalText } = ctx;

  // 1. Create task in store
  const task = addTask(userId, projectId, goalId, {
    goalId,
    assignedRole: "recruiter" as EmployeeRole,
    title: "Automated candidate screening",
    description: `Scanning Gmail for job applications. Triggered from: "${goalText}"`,
    status: "pending",
  });

  // 2. Create workflow state
  const workflow = createWorkflow(
    userId,
    projectId,
    goalId,
    task.id,
    "recruiter" as EmployeeRole
  );

  // 3. Post kickoff in recruiter chat
  addAgentChatMessage(userId, projectId, "recruiter" as EmployeeRole, {
    sender: "recruiter" as EmployeeRole,
    senderName: "Recruiter Ghost",
    senderIcon: "👥",
    content: `I've been activated to screen candidates for your project.\n\n**Objective:** ${goalText}\n\n**My workflow:**\n1. 📧 Scan your Gmail (past ${ctx.daysBack || 30} days) for job applications\n2. 📄 Extract resumes and cover letters\n3. 📊 Run ATS scoring against your project requirements\n4. 👀 Present top candidates for your approval\n5. 📅 Schedule interviews & send confirmation emails\n\nStarting email scan now...`,
  });

  // 4. Run workflow
  await runRecruiterWorkflow(ctx, task.id, workflow);

  return task.id;
}

// ─── Workflow execution ───────────────────────────────────────────────────────

async function runRecruiterWorkflow(
  ctx: RecruiterWorkflowContext,
  taskId: string,
  workflow: WorkflowState
) {
  const { userId, projectId, goalId, projectDescription, daysBack } = ctx;

  // Update status
  workflow.status = "researching";
  saveWorkflow(userId, projectId, goalId, taskId, workflow);

  addAgentChatMessage(userId, projectId, "recruiter" as EmployeeRole, {
    sender: "system",
    senderName: "System",
    senderIcon: "⚙️",
    content: "Step 1/3: Scanning Gmail for job applications...",
  });

  try {
    // Call server-side recruiter scan API
    const scanRes = await fetch("/api/recruiter/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        projectDescription,
        daysBack: daysBack || 30,
      }),
    });

    const scanData = await scanRes.json();

    if (!scanData.ok) {
      addAgentChatMessage(userId, projectId, "recruiter" as EmployeeRole, {
        sender: "recruiter" as EmployeeRole,
        senderName: "Recruiter Ghost",
        senderIcon: "👥",
        content: `⚠️ **Email scan encountered an issue:**\n\n${scanData.error}\n\nPlease make sure your Gmail is connected and has the correct permissions. You can reconnect Gmail from the project settings.`,
      });
      workflow.status = "complete";
      saveWorkflow(userId, projectId, goalId, taskId, workflow);
      return;
    }

    const candidates: CandidateResult[] = scanData.candidates ?? [];

    workflow.steps.push({
      id: crypto.randomUUID(),
      label: "Email scan complete",
      status: "complete",
      output: `Scanned ${scanData.scannedCount} emails, found ${candidates.length} potential candidates`,
      createdAt: Date.now(),
    });
    saveWorkflow(userId, projectId, goalId, taskId, workflow);

    addAgentChatMessage(userId, projectId, "recruiter" as EmployeeRole, {
      sender: "recruiter" as EmployeeRole,
      senderName: "Recruiter Ghost",
      senderIcon: "👥",
      content: `**Email scan complete.**\n\n📬 Scanned: ${scanData.scannedCount} emails (${scanData.totalFound || scanData.scannedCount} total matches)\n👤 Candidates identified: ${candidates.length}`,
    });

    await delay(600);

    // No candidates found
    if (candidates.length === 0) {
      addAgentChatMessage(userId, projectId, "recruiter" as EmployeeRole, {
        sender: "recruiter" as EmployeeRole,
        senderName: "Recruiter Ghost",
        senderIcon: "👥",
        content: `No candidate applications were found in your Gmail from the past ${daysBack || 30} days.\n\n**Suggestions:**\n- Try asking me to scan a longer time period (e.g., "scan my emails from the past 90 days")\n- Check if job applications are going to a different email account\n- Post your job listings and I'll monitor for new applications`,
      });
      workflow.status = "complete";
      saveWorkflow(userId, projectId, goalId, taskId, workflow);
      return;
    }

    // Step 2: Present ATS results
    addAgentChatMessage(userId, projectId, "recruiter" as EmployeeRole, {
      sender: "system",
      senderName: "System",
      senderIcon: "⚙️",
      content: "Step 2/3: ATS scoring complete. Presenting results...",
    });

    await delay(400);

    // Filter candidates with score >= 40 as "worth reviewing"
    const qualifiedCandidates = candidates.filter((c) => c.atsScore >= 40);
    const topCandidates = candidates.filter((c) => c.atsScore >= 70);

    // Build summary table
    const candidateTable = candidates
      .slice(0, 10) // Show top 10
      .map((c, i) => {
        const scoreEmoji = c.atsScore >= 70 ? "🟢" : c.atsScore >= 40 ? "🟡" : "🔴";
        const resumeTag = c.hasResume ? "📄" : "—";
        return `${i + 1}. ${scoreEmoji} **${c.name}** (${c.email})\n   Score: ${c.atsScore}/100 | Resume: ${resumeTag}\n   Skills: ${c.matchedSkills.slice(0, 5).join(", ") || "—"}\n   ${c.recommendation}`;
      })
      .join("\n\n");

    workflow.steps.push({
      id: crypto.randomUUID(),
      label: "ATS scoring complete",
      status: "complete",
      output: `${topCandidates.length} top candidates (≥70), ${qualifiedCandidates.length} qualified (≥40), ${candidates.length} total`,
      createdAt: Date.now(),
    });
    workflow.status = "awaiting_approval";
    saveWorkflow(userId, projectId, goalId, taskId, workflow);

    // Store candidates in workflow metadata for approval handling
    workflow.steps.push({
      id: crypto.randomUUID(),
      label: "__candidates_data__",
      status: "complete",
      output: JSON.stringify(candidates.slice(0, 10)),
      createdAt: Date.now(),
    });
    saveWorkflow(userId, projectId, goalId, taskId, workflow);

    addAgentChatMessage(userId, projectId, "recruiter" as EmployeeRole, {
      sender: "recruiter" as EmployeeRole,
      senderName: "Recruiter Ghost",
      senderIcon: "👥",
      content: `**📊 Candidate Screening Results**\n\n🟢 Top matches (≥70): ${topCandidates.length}\n🟡 Worth reviewing (40-69): ${qualifiedCandidates.length - topCandidates.length}\n🔴 Low match (<40): ${candidates.length - qualifiedCandidates.length}\n\n---\n\n${candidateTable}\n\n---\n\n**Actions:**\n- Type **approve [number] [date/time]** to schedule an interview (e.g., "approve 1 Monday 2:00 PM")\n- Type **approve all** to approve all top candidates\n- Type **reject [number]** to pass on a candidate\n- Type **details [number]** to see full ATS report for a candidate`,
    });
  } catch (error) {
    console.error("[RecruiterWorkflow] Error:", error);
    addAgentChatMessage(userId, projectId, "recruiter" as EmployeeRole, {
      sender: "recruiter" as EmployeeRole,
      senderName: "Recruiter Ghost",
      senderIcon: "👥",
      content: `⚠️ **Error during candidate screening:**\n\n${error instanceof Error ? error.message : "Unknown error"}\n\nThis may be a connectivity issue. Please try again or check your Gmail connection.`,
    });
    workflow.status = "complete";
    saveWorkflow(userId, projectId, goalId, taskId, workflow);
  }
}

// ─── Handle user response in recruiter chat ──────────────────────────────────

export async function handleRecruiterApproval(
  ctx: RecruiterWorkflowContext,
  taskId: string,
  workflow: WorkflowState,
  userMessage: string
): Promise<{ handled: boolean; response: string }> {
  const { userId, projectId, goalId, goalText } = ctx;
  const lower = userMessage.toLowerCase().trim();

  // Extract stored candidates from workflow
  const candidatesStep = workflow.steps.find(
    (s) => s.label === "__candidates_data__"
  );
  let candidates: CandidateResult[] = [];
  if (candidatesStep?.output) {
    try {
      candidates = JSON.parse(candidatesStep.output);
    } catch {}
  }

  // ─── APPROVE with number and time ─────────────────────────────────────
  const approveMatch = lower.match(
    /^approve\s+(?:candidate\s+)?(\d+|all)\s*(.*)$/
  );
  if (approveMatch || lower === "approve" || lower === "yes" || lower === "looks good") {
    const candidateNum = approveMatch?.[1] ?? "1";
    const timeStr = approveMatch?.[2]?.trim() ?? "";

    if (candidateNum === "all") {
      // Approve all top candidates
      const topCandidates = candidates.filter((c) => c.atsScore >= 70);
      if (topCandidates.length === 0) {
        return {
          handled: true,
          response:
            "No top candidates (score ≥70) to approve. You can approve individual candidates by number.",
        };
      }

      const names = topCandidates
        .map((c) => `• ${c.name} (${c.email}) — Score: ${c.atsScore}`)
        .join("\n");
      workflow.status = "approved";
      saveWorkflow(userId, projectId, goalId, taskId, {
        ...workflow,
        status: "complete",
        finalOutput: `Approved ${topCandidates.length} top candidates`,
      });

      return {
        handled: true,
        response: `✅ **${topCandidates.length} top candidates approved:**\n\n${names}\n\nTo schedule interviews, message me with a specific candidate number and time (e.g., "schedule 1 Monday 2:00 PM").`,
      };
    }

    const idx = parseInt(candidateNum, 10) - 1;
    if (idx < 0 || idx >= candidates.length) {
      return {
        handled: true,
        response: `Invalid candidate number. Please choose 1-${candidates.length}.`,
      };
    }

    const candidate = candidates[idx];

    if (timeStr) {
      // Schedule calendar event and send email
      try {
        // Parse the time string into a rough datetime
        const eventStart = parseRelativeTime(timeStr);
        const eventEnd = new Date(eventStart.getTime() + 30 * 60000); // 30 min interview

        // Create calendar event
        await fetch("/api/calendar/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            summary: `Interview: ${candidate.name}`,
            description: `Candidate interview for ${goalText}\n\nCandidate: ${candidate.name} (${candidate.email})\nATS Score: ${candidate.atsScore}/100\nMatched Skills: ${candidate.matchedSkills.join(", ")}`,
            start: eventStart.toISOString(),
            end: eventEnd.toISOString(),
            attendees: [candidate.email],
          }),
        });

        // Send interview confirmation email
        const emailBody = `Dear ${candidate.name},\n\nThank you for your application. We've reviewed your profile and are impressed with your qualifications.\n\nWe'd like to invite you to an interview to discuss the opportunity further.\n\n📅 Date: ${eventStart.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}\n⏰ Time: ${eventStart.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}\n\nA calendar invite has been sent to ${candidate.email}. If this time doesn't work for you, please let us know and we'll find an alternative.\n\nIf you're no longer pursuing this opportunity, please reply to let us know.\n\nLooking forward to meeting you!\n\nBest regards`;

        await fetch("/api/gmail/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            to: candidate.email,
            subject: `Interview Invitation — ${goalText}`,
            body: emailBody,
          }),
        });

        workflow.status = "approved";
        saveWorkflow(userId, projectId, goalId, taskId, {
          ...workflow,
          status: "complete",
          finalOutput: `Approved ${candidate.name}, scheduled interview for ${eventStart.toLocaleString()}`,
        });

        return {
          handled: true,
          response: `✅ **Candidate approved and interview scheduled!**\n\n👤 **${candidate.name}** (${candidate.email})\n📊 ATS Score: ${candidate.atsScore}/100\n📅 Interview: ${eventStart.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} at ${eventStart.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}\n✉️ Confirmation email sent to candidate\n📅 Calendar invite created with attendee\n\nThe candidate has been informed. If they're no longer interested, they've been asked to reply.`,
        };
      } catch (err) {
        return {
          handled: true,
          response: `I approved **${candidate.name}** but encountered an error scheduling: ${err instanceof Error ? err.message : "Unknown error"}\n\nYou can manually schedule a meeting and email them at ${candidate.email}.`,
        };
      }
    } else {
      // Approve without time — ask for meeting time
      return {
        handled: true,
        response: `✅ **${candidate.name}** approved!\n\nTo schedule an interview, provide a date and time:\n> e.g., "approve ${candidateNum} Monday 2:00 PM"\n> or "approve ${candidateNum} tomorrow 10:00 AM"\n\nOr type **skip** to approve without scheduling.`,
      };
    }
  }

  // ─── REJECT ───────────────────────────────────────────────────────────
  const rejectMatch = lower.match(
    /^reject\s+(?:candidate\s+)?(\d+)\s*(.*)$/
  );
  if (
    rejectMatch ||
    lower.startsWith("reject") ||
    lower.startsWith("pass") ||
    lower.startsWith("no")
  ) {
    const num = rejectMatch?.[1];
    const reason = rejectMatch?.[2]?.trim() || "Not a good fit";

    if (num) {
      const idx = parseInt(num, 10) - 1;
      if (idx >= 0 && idx < candidates.length) {
        const candidate = candidates[idx];
        return {
          handled: true,
          response: `❌ **${candidate.name}** rejected. Reason: ${reason}\n\nCandidate has been logged. You can still approve other candidates.`,
        };
      }
    }

    return {
      handled: true,
      response:
        "Please specify which candidate to reject (e.g., \"reject 2\").",
    };
  }

  // ─── DETAILS ──────────────────────────────────────────────────────────
  const detailsMatch = lower.match(/^details?\s+(\d+)$/);
  if (detailsMatch) {
    const idx = parseInt(detailsMatch[1], 10) - 1;
    if (idx >= 0 && idx < candidates.length) {
      const c = candidates[idx];
      return {
        handled: true,
        response: `**📋 Full ATS Report: ${c.name}**\n\n**Contact:** ${c.email}\n**Applied:** ${c.date}\n**Subject:** ${c.subject}\n**Resume attached:** ${c.hasResume ? "Yes 📄" : "No"}\n\n**ATS Score:** ${c.atsScore}/100\n**Matched Skills:** ${c.matchedSkills.join(", ") || "None detected"}\n**Recommendation:** ${c.recommendation}\n\n**Email Preview:**\n> ${c.snippet}\n\n${c.resumeText ? `**Resume Extract:**\n> ${c.resumeText.slice(0, 300)}...` : ""}\n\n---\nType **approve ${idx + 1} [date/time]** to schedule an interview.`,
      };
    }
    return { handled: true, response: `Invalid candidate number. Choose 1-${candidates.length}.` };
  }

  // ─── SKIP (approve without scheduling) ────────────────────────────────
  if (lower === "skip") {
    workflow.status = "complete";
    saveWorkflow(userId, projectId, goalId, taskId, {
      ...workflow,
      status: "complete",
      finalOutput: "Screening complete. No interviews scheduled.",
    });
    return {
      handled: true,
      response:
        "Screening task completed. No interviews scheduled. You can reactivate candidate screening at any time by mentioning hiring or recruiting.",
    };
  }

  // Not handled — let regular chat flow handle it
  return { handled: false, response: "" };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Parse a relative time expression like "Monday 2:00 PM" or "tomorrow 10:00 AM"
 * into a Date object. Falls back to next Monday if parsing fails.
 */
function parseRelativeTime(timeStr: string): Date {
  const now = new Date();
  const lower = timeStr.toLowerCase().trim();

  // Try parsing as absolute date
  const directParse = new Date(timeStr);
  if (!isNaN(directParse.getTime()) && directParse > now) {
    return directParse;
  }

  // Day names
  const dayNames = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  let targetDate = new Date(now);

  if (lower.includes("tomorrow")) {
    targetDate.setDate(targetDate.getDate() + 1);
  } else if (lower.includes("today")) {
    // Keep today
  } else {
    // Try to find a day name
    for (let i = 0; i < dayNames.length; i++) {
      if (lower.includes(dayNames[i])) {
        const currentDay = now.getDay();
        let daysAhead = i - currentDay;
        if (daysAhead <= 0) daysAhead += 7;
        targetDate.setDate(targetDate.getDate() + daysAhead);
        break;
      }
    }
  }

  // Extract time (HH:MM AM/PM or HH:MM)
  const timeMatch = lower.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2] || "0", 10);
    const ampm = timeMatch[3];

    if (ampm === "pm" && hours < 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;

    targetDate.setHours(hours, minutes, 0, 0);
  } else {
    // Default to 10 AM
    targetDate.setHours(10, 0, 0, 0);
  }

  // If the date is in the past, push to next week
  if (targetDate <= now) {
    targetDate.setDate(targetDate.getDate() + 7);
  }

  return targetDate;
}
