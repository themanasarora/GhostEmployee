import { NextRequest, NextResponse } from "next/server";

const MOCK: Record<string, string[]> = {
  ceo: ["As CEO, I see a clear strategic opportunity here. We should prioritize the core value proposition, validate with 10 target customers before building, and set a 6-week MVP timeline. My recommendation: proceed with a focused niche approach.", "Looking at the full picture, I recommend we move forward. The market timing is right, technical complexity is manageable, and our angle is differentiated. Let's assign tasks and execute."],
  cto: ["From a technical standpoint, this is buildable in 3-4 weeks with Next.js, FastAPI, and PostgreSQL. I'd recommend starting with a monorepo and keeping the AI layer behind an abstraction. Main risk is pipeline latency.", "The architecture I'd propose: serverless functions for the API, a queue for agent tasks, Redis for session state. Launch on Vercel + Railway with zero DevOps overhead initially."],
  pm: ["For the product requirements, I'd define three core user stories: validate an idea, plan a product, and get a growth strategy. The MVP needs goal input, agent execution, and a downloadable report. Everything else is Phase 2.", "The biggest friction point is time-to-first-value. We need the user to see agent output within 60 seconds. That should be our north star metric for the MVP."],
  research: ["Market analysis shows this space is growing 40% YoY. Main competitors are AutoGPT (developer-only), CrewAI (no UX), and ChatGPT (no organizational structure). There's a clear gap for the 'hire employees' mental model targeting non-technical founders.", "The total addressable market for AI productivity tools is $47B by 2030. Our serviceable segment is approximately 50M people globally with demonstrated willingness to pay $49-149/month."],
  growth: ["The highest-leverage acquisition channels: Product Hunt launch, Twitter/X content showing board meeting transcripts, and agency partnerships. The viral loop is the shareable report.", "For the first 100 users: direct outreach to founder communities, a Twitter thread with real output, and a free tier that delivers enough value for word-of-mouth."],
  finance: ["Revenue model: Free tier, Pro at $49/month, Team at $149/month. At 1000 Pro users that's $49K MRR. LLM costs should stay under 15% with caching and model tiering.", "Unit economics: CAC via content marketing roughly $15, LTV at 12-month retention roughly $588. A 39x ratio is exceptional. Biggest cost risk is free-tier LLM spend — hard cap it."],
  sales: ["For outreach: identify founders who've posted about AI tools recently on Twitter. Personal DM with a board meeting demo tailored to their startup. Conversion target 15% to free trial.", "The sales motion for agencies: offer a 3-month free Pro trial for a case study. Agencies have high willingness to pay if the product saves their team time on strategy work."],
  recruiter: ["First two hires should be a full-stack engineer who knows Python and TypeScript, and a growth-focused PM. Both can be found in the Anthropic/OpenAI alumni networks.", "Job descriptions should emphasize mission over comp at this stage. Candidates excited about autonomous AI will be more effective than those optimizing for salary."],
};

function getMock(role: string): string {
  const options = MOCK[role] ?? ["I've reviewed the context and recommend proceeding methodically, validating each assumption before committing resources."];
  return options[Math.floor(Math.random() * options.length)];
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { messages = [], systemPrompt, agentId, projectName, projectGoal, contextWindow, mode = "board" } = body;

  const hfToken = process.env.HF_TOKEN;
  const hfEndpoint = process.env.HF_MODEL_ENDPOINT;

  const fullSystem = buildSystem(systemPrompt, contextWindow, agentId, projectName, projectGoal, mode);

  if (!hfToken || !hfEndpoint) {
    await new Promise((r) => setTimeout(r, 700 + Math.random() * 500));
    return NextResponse.json({ content: getMock(agentId), isMock: true });
  }

  try {
    const res = await fetch(hfEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${hfToken}` },
      body: JSON.stringify({
        model: "Qwen/Qwen2.5-7B-Instruct",
        messages: [{ role: "system", content: fullSystem }, ...messages.slice(-12)],
        max_tokens: 400,
        temperature: 0.7,
        stream: false,
      }),
    });

    if (!res.ok) return NextResponse.json({ content: getMock(agentId), isMock: true });
    const data = await res.json();
    return NextResponse.json({ content: data.choices?.[0]?.message?.content ?? getMock(agentId), isMock: false });
  } catch {
    return NextResponse.json({ content: getMock(agentId), isMock: true });
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