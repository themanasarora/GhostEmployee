import { NextRequest, NextResponse } from "next/server";
import {
  listGmailMessages,
  getGmailMessageDetails,
  getGmailAttachment,
} from "@/lib/server/gmail";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CandidateResult {
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

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      projectDescription,
      daysBack = 30,
      customKeywords,
    } = body;

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Missing userId" },
        { status: 400 }
      );
    }
    if (!projectDescription) {
      return NextResponse.json(
        { ok: false, error: "Missing projectDescription" },
        { status: 400 }
      );
    }

    // Build Gmail search query
    const since = new Date();
    since.setDate(since.getDate() - daysBack);
    const afterDate = `${since.getFullYear()}/${String(since.getMonth() + 1).padStart(2, "0")}/${String(since.getDate()).padStart(2, "0")}`;

    const defaultKeywords = [
      "application",
      "resume",
      "cv",
      "apply",
      "job",
      "candidate",
      "cover letter",
      "position",
      "hiring",
    ];
    const keywords = customKeywords?.length ? customKeywords : defaultKeywords;
    const keywordQuery = keywords
      .map((kw: string) => `"${kw}"`)
      .join(" OR ");
    const query = `(${keywordQuery}) after:${afterDate}`;

    console.log("[Recruiter] Scanning Gmail with query:", query);

    // 1. List matching messages
    const messageRefs = await listGmailMessages(userId, query, 30);
    console.log("[Recruiter] Found", messageRefs.length, "matching messages");

    if (messageRefs.length === 0) {
      return NextResponse.json({
        ok: true,
        candidates: [],
        scannedCount: 0,
        message: "No matching emails found in the last " + daysBack + " days.",
      });
    }

    // 2. Fetch details for each message (limit to first 15 to avoid rate limits)
    const messagesToProcess = messageRefs.slice(0, 15);
    const candidates: CandidateResult[] = [];

    for (const ref of messagesToProcess) {
      try {
        const details = await getGmailMessageDetails(userId, ref.id);

        // Extract email address from "From" header
        const emailMatch = details.from.match(/<([^>]+)>/);
        const email = emailMatch ? emailMatch[1] : details.from.split(" ").pop() || details.from;
        const name = details.from.replace(/<[^>]+>/, "").replace(/"/g, "").trim() || email;

        // Check for resume attachments
        const resumeAttachments = details.attachments.filter((a) =>
          /\.(pdf|doc|docx|txt|rtf)$/i.test(a.filename) ||
          a.mimeType === "application/pdf" ||
          a.mimeType === "application/msword" ||
          a.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        );

        let resumeText = "";
        if (resumeAttachments.length > 0) {
          try {
            // Get the first resume attachment
            const attachment = resumeAttachments[0];
            const rawData = await getGmailAttachment(userId, ref.id, attachment.attachmentId);

            // Decode base64url to raw text
            // For PDF/DOCX we can't fully parse without native libs, but we extract what we can
            const decoded = Buffer.from(rawData, "base64url").toString("utf8");

            // For text-based files (txt, rtf) this works directly
            // For PDF/DOCX, the decoded text will have some readable content mixed with binary
            // We extract readable ASCII text segments as a best-effort
            if (attachment.mimeType === "text/plain" || /\.(txt|rtf)$/i.test(attachment.filename)) {
              resumeText = decoded.slice(0, 4000);
            } else {
              // Extract readable text from binary formats (best-effort PDF text extraction)
              const readableChunks = decoded.match(/[\x20-\x7E\n\r\t]{10,}/g) ?? [];
              resumeText = readableChunks.join("\n").slice(0, 4000);
            }
          } catch (err) {
            console.log("[Recruiter] Failed to extract resume attachment:", err);
          }
        }

        // 3. Call LLM for ATS scoring
        const atsResult = await performATSScoring(
          projectDescription,
          name,
          email,
          details.subject,
          details.bodyText,
          resumeText,
          resumeAttachments.map((a) => a.filename)
        );

        candidates.push({
          messageId: ref.id,
          from: details.from,
          email,
          name,
          subject: details.subject,
          date: details.date,
          snippet: details.snippet,
          bodyText: details.bodyText.slice(0, 500),
          resumeText: resumeText.slice(0, 500),
          hasResume: resumeAttachments.length > 0,
          atsScore: atsResult.score,
          matchedSkills: atsResult.matchedSkills,
          recommendation: atsResult.recommendation,
        });
      } catch (err) {
        console.log("[Recruiter] Error processing message", ref.id, ":", err);
      }
    }

    // Sort by ATS score descending
    candidates.sort((a, b) => b.atsScore - a.atsScore);

    return NextResponse.json({
      ok: true,
      candidates,
      scannedCount: messagesToProcess.length,
      totalFound: messageRefs.length,
    });
  } catch (error) {
    console.error("[Recruiter] Scan error:", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Recruiter scan failed.",
      },
      { status: 500 }
    );
  }
}

// ─── ATS Scoring via LLM ─────────────────────────────────────────────────────

async function performATSScoring(
  projectDescription: string,
  candidateName: string,
  candidateEmail: string,
  emailSubject: string,
  emailBody: string,
  resumeText: string,
  resumeFilenames: string[]
): Promise<{
  score: number;
  matchedSkills: string[];
  recommendation: string;
}> {
  const hfToken = process.env.HF_TOKEN;
  const hfEndpoint = process.env.HF_MODEL_ENDPOINT;

  if (!hfToken || !hfEndpoint) {
    // Fallback: simple keyword matching
    return fallbackATSScoring(projectDescription, emailBody, resumeText);
  }

  const prompt = `You are an ATS (Applicant Tracking System) evaluator. Analyze this job application against the hiring requirements.

=== HIRING REQUIREMENTS (from project description) ===
${projectDescription.slice(0, 1000)}

=== CANDIDATE INFO ===
Name: ${candidateName}
Email: ${candidateEmail}
Subject: ${emailSubject}

=== EMAIL BODY ===
${emailBody.slice(0, 1500)}

=== RESUME CONTENT ===
${resumeText ? resumeText.slice(0, 2000) : "No resume attachment found."}
${resumeFilenames.length > 0 ? `Attached files: ${resumeFilenames.join(", ")}` : ""}

=== TASK ===
Evaluate this candidate. Respond in EXACTLY this JSON format (nothing else):
{
  "score": <number 0-100>,
  "matchedSkills": ["skill1", "skill2", "skill3"],
  "recommendation": "<one sentence recommendation>"
}`;

  try {
    const res = await fetch(hfEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${hfToken}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 250,
        temperature: 0.3,
        stream: false,
      }),
    });

    if (!res.ok) {
      console.log("[Recruiter] LLM ATS call failed:", res.status);
      return fallbackATSScoring(projectDescription, emailBody, resumeText);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    // Parse JSON from LLM response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        score: Math.min(100, Math.max(0, Number(parsed.score) || 0)),
        matchedSkills: Array.isArray(parsed.matchedSkills) ? parsed.matchedSkills.slice(0, 8) : [],
        recommendation: String(parsed.recommendation || "No recommendation provided."),
      };
    }
  } catch (err) {
    console.log("[Recruiter] LLM ATS error:", err);
  }

  return fallbackATSScoring(projectDescription, emailBody, resumeText);
}

function fallbackATSScoring(
  projectDescription: string,
  emailBody: string,
  resumeText: string
): { score: number; matchedSkills: string[]; recommendation: string } {
  // Simple keyword overlap scoring
  const descWords = new Set(
    projectDescription
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3)
  );
  const candidateText = `${emailBody} ${resumeText}`.toLowerCase();
  const candidateWords = new Set(
    candidateText.split(/\W+/).filter((w) => w.length > 3)
  );

  const matched: string[] = [];
  for (const word of descWords) {
    if (candidateWords.has(word)) matched.push(word);
  }

  const score = Math.min(100, Math.round((matched.length / Math.max(descWords.size, 1)) * 100));
  return {
    score,
    matchedSkills: matched.slice(0, 8),
    recommendation:
      score >= 70
        ? "Strong keyword match. Recommended for review."
        : score >= 40
        ? "Partial match. May be worth reviewing."
        : "Low match against requirements.",
  };
}
