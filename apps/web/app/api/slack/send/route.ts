import { NextRequest, NextResponse } from "next/server";
import { sendSlackMessage } from "@/lib/server/slack";

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const { userId, message, title } = body ?? {};
  if (!userId || !message) {
    return NextResponse.json(
      { ok: false, error: "Missing userId or message." },
      { status: 400 }
    );
  }

  try {
    const result = await sendSlackMessage(userId, message, title);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to send Slack message." },
      { status: 500 }
    );
  }
}
