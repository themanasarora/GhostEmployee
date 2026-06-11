import { NextResponse } from "next/server";

function getFallbackNotice(reason: string, status?: number): string {
  return status ? `Offline Simulator Mode: ${reason} (${status}).` : `Offline Simulator Mode: ${reason}.`;
}

function isHuggingFacePermissionError(errorText: string, status: number): boolean {
  const normalizedError = errorText.toLowerCase();

  return (
    status === 401 ||
    status === 403 ||
    normalizedError.includes("sufficient permissions") ||
    normalizedError.includes("permission") ||
    normalizedError.includes("unauthorized") ||
    normalizedError.includes("forbidden")
  );
}

function getLatestUserMessage(messages: any[]): string {
  if (!Array.isArray(messages)) {
    return "";
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message && message.role === "user" && typeof message.content === "string") {
      return message.content.trim();
    }
  }

  return "";
}

function getContextHint(projectName: string, projectGoal: string, latestUserMessage: string): string {
  const parts = [projectName, projectGoal, latestUserMessage].map((value) => value.trim()).filter(Boolean);

  return parts.length ? parts.join(" | ") : "the current project context";
}

function hashString(input: string): number {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function pickVariant(options: string[], seed: string): string {
  if (!options.length) {
    return "";
  }

  return options[hashString(seed) % options.length];
}

function extractFocus(latestUserMessage: string, projectGoal: string, projectName: string): string {
  const source = latestUserMessage || projectGoal || projectName;

  if (!source) {
    return "the current plan";
  }

  const sentence = source.split(/[.!?\n]/)[0].trim();
  return sentence || source.trim();
}

// Helper to generate simulated agent responses if the Hugging Face endpoint is unreachable
function getMockAgentResponse(
  agentId: string,
  projectName: string,
  projectGoal: string,
  messagesCount: number,
  latestUserMessage: string
): string {
  const name = projectName || "the project";
  const goal = projectGoal || "our objectives";
  const contextHint = getContextHint(name, goal, latestUserMessage);
  const userAsk = latestUserMessage
    ? `The latest request I am responding to is: "${latestUserMessage}".`
    : "I am responding to the current project context.";
  const focusSummary = latestUserMessage || goal;
  const focus = extractFocus(latestUserMessage, goal, name);
  const opener = pickVariant(
    [
      `Here is the clearest next step on **${name}**`,
      `I am aligning the next turn around **${focus}**`,
      `The current discussion points to **${focus}**`,
      `A sensible move now is to concentrate on **${focus}**`,
    ],
    `${agentId}:${messagesCount}:${contextHint}`
  );
  const transition = pickVariant(
    [
      "That gives us a concrete direction.",
      "This keeps the team focused on execution.",
      "That narrows the work to something actionable.",
      "This is the most useful thread to pursue next.",
    ],
    `${messagesCount}:${latestUserMessage}`
  );

  switch (agentId) {
    case "ceo":
      return `${opener}. ${transition}

Our goal remains: *${goal}*.
${userAsk}

PM Ghost should turn this into concrete requirements. Sales Ghost should define the market path. Recruiter Ghost should identify the next hiring need.

[ADD_SUBTASK] Define product MVP roadmap
[ADD_SUBTASK] Establish GTM and pricing tiers
[ADD_SUBTASK] Draft talent acquisition plan
[UPDATE_TASK] PM: Draft MVP requirements`;

    case "pm":
      return `${opener}. ${transition}

The current scope for **${name}** should prioritize the work around: ${focus}.

Proposed breakdown:

1. Capture the core user flow.
2. Define the minimum API and data shape.
3. Confirm the delivery order and dependencies.

${pickVariant([
  "That should keep the MVP tight and shippable.",
  "This keeps the scope disciplined.",
  "That gives the team a practical implementation path.",
], `${agentId}:${messagesCount}:${focus}`)} Sales Ghost can now translate this into pricing and demand language.

[COMPLETE_SUBTASK] Define product MVP roadmap
[UPDATE_TASK] Sales: Formulate pricing and GTM strategy`;

    case "sales":
      return `${opener}. ${transition}

For **${name}**, the most commercial angle is tied to ${focus}.

Recommended market framing:

- Starter tier for a small team validating the workflow.
- Growth tier for teams that need higher throughput and visibility.
- Outreach aimed at managers who feel the pain that ${focus} solves.

Recruiter Ghost should now map the hiring needs that support that promise.

[COMPLETE_SUBTASK] Establish GTM and pricing tiers
[UPDATE_TASK] Recruiter: Outline talent sourcing pipeline`;

    case "recruiter":
      return `${opener}. ${transition}

The talent plan for **${name}** should support ${focus} without overbuilding the team.

Suggested hiring sequence:

1. One senior engineer who can own the core implementation.
2. One growth-oriented operator if demand generation becomes a bottleneck.
3. Optional support roles only after the first feedback loop proves value.

This keeps the team lean while the project direction is still forming.

[UPDATE_TASK] CEO: Synthesize boardroom decisions`;

    default:
      return `${opener}. ${transition}

I will keep the next step tied to: ${focusSummary}.`;
  }
}

export async function POST(request: Request) {
  let requestData: any = {};
  try {
    requestData = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { messages, systemPrompt, agentId, projectName, projectGoal } = requestData;
  const token = process.env.HF_TOKEN;
  const endpoint =
    process.env.HF_MODEL_ENDPOINT ||
    "https://router.huggingface.co/hf-inference/models/Qwen/Qwen2.5-7B-Instruct/v1/chat/completions";

  const latestUserMessage = getLatestUserMessage(messages || []);

  if (!token || token === "your_huggingface_token_here") {
    console.warn("Hugging Face API token is missing. Falling back to local simulation.");
    const mockContent = getMockAgentResponse(
      agentId || "ceo",
      projectName || "Active Project",
      projectGoal || "Complete objectives",
      messages ? messages.length : 0,
      latestUserMessage
    );
    return NextResponse.json({
      content: mockContent,
      isMock: true,
      notice: "Offline Simulator Mode: Hugging Face Token is not configured.",
    });
  }

  const formattedMessages = [];
  if (systemPrompt) {
    formattedMessages.push({ role: "system", content: systemPrompt });
  }
  if (messages && Array.isArray(messages)) {
    formattedMessages.push(...messages);
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "Qwen/Qwen2.5-7B-Instruct",
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const permissionError = isHuggingFacePermissionError(errorText, response.status);

      if (!permissionError) {
        console.error("Hugging Face API error response:", errorText);
      }

      const mockContent = getMockAgentResponse(
        agentId || "ceo",
        projectName || "Active Project",
        projectGoal || "Complete objectives",
        messages ? messages.length : 0,
        latestUserMessage
      );

      return NextResponse.json({
        content: mockContent,
        isMock: true,
        notice: permissionError
          ? getFallbackNotice(
              "Hugging Face token does not have permission to call Inference Providers on behalf of this user",
              response.status
            )
          : getFallbackNotice(`API error ${response.status} ${response.statusText}`, response.status),
      });
    }

    const data = await response.json();

    if (data.choices && data.choices[0] && data.choices[0].message) {
      return NextResponse.json({
        content: data.choices[0].message.content,
        isMock: false,
      });
    }

    return NextResponse.json({
      content: typeof data === "string" ? data : JSON.stringify(data),
      isMock: false,
    });
  } catch (error: any) {
    console.warn("Hugging Face fetch failed. Falling back to local simulation. Error cause:", error.message || error);

    const mockContent = getMockAgentResponse(
      agentId || "ceo",
      projectName || "Active Project",
      projectGoal || "Complete objectives",
      messages ? messages.length : 0,
      latestUserMessage
    );

    return NextResponse.json({
      content: mockContent,
      isMock: true,
      notice: `Offline Simulator Mode: Network unreachable (${error.code || "fetch failed"}).`,
    });
  }
}
