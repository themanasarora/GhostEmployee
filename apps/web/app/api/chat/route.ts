import { NextRequest, NextResponse } from "next/server";


export async function POST(req: NextRequest) {
  console.log("=== AI CALL START ===");

  const body = await req.json();
  const { messages = [], systemPrompt, agentId, projectName, projectGoal, contextWindow, mode = "board" } = body;

  const hfToken = process.env.HF_TOKEN;
  const hfEndpoint = process.env.HF_MODEL_ENDPOINT;

  console.log("HF_TOKEN present:", !!hfToken);
  console.log("HF_ENDPOINT present:", !!hfEndpoint);
  console.log("AgentId:", agentId);

  const fullSystem = buildSystem(systemPrompt, contextWindow, agentId, projectName, projectGoal, mode);

  if (!hfToken || !hfEndpoint) {
    console.log("No token/endpoint configured");
    return NextResponse.json({ error: "No API token or endpoint configured." }, { status: 500 });
  }

  try {
    console.log("Calling HF API...");
    const res = await fetch(hfEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${hfToken}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "system", content: fullSystem }, ...messages.slice(-12)],
        max_tokens: 400,
        temperature: 0.7,
        stream: false,
      }),
    });

    console.log("HF response status:", res.status);

    if (!res.ok) {
      const errText = await res.text();
      console.log("HF API error:", res.status, errText);
      return NextResponse.json({ error: "HF API error", details: errText }, { status: 500 });
    }

    const data = await res.json();
    console.log("HF success, content length:", data.choices?.[0]?.message?.content?.length);
    return NextResponse.json({
      content: data.choices?.[0]?.message?.content || "",
      isMock: false,
    });
  } catch (err) {
    console.log("HF fetch threw error:", err);
    return NextResponse.json({ error: "HF fetch failed", details: String(err) }, { status: 500 });
  }
}

function buildSystem(base: string, ctx: any, role: string, project: string, goal: string, mode: string): string {
  const context = ctx ? `
=== PROJECT CONTEXT ===
Project: ${ctx.projectName}
Description: ${ctx.projectDescription}
Team: ${ctx.hiredTeam}

=== BOARD ROOM HISTORY ===
${ctx.recentBoardRooms || "No previous board meetings."}

=== YOUR CHAT HISTORY ===
${ctx.agentChatHistory || "No previous chats."}

=== TASKS ===
${ctx.tasks || "No tasks yet."}
=== END CONTEXT ===` : "";

  const modeNote = mode === "chat"
    ? "You are in a 1-on-1 chat. Be conversational, helpful, draw on full context."
    : "You are in a board meeting. Be concise (3-5 sentences). Reference what teammates said. End with a clear recommendation.";

  return `${base}\n${context}\n${modeNote}\nCurrent goal: "${goal}"\nAlways respond in character. Keep responses focused and actionable.`;
}