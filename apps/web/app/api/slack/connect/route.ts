import { NextRequest, NextResponse } from "next/server";
import { saveSlackConnection } from "@/lib/server/slack";

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const { userId, webhookUrl, channel, notifyOn } = body ?? {};
  if (!userId || !webhookUrl || !channel || !notifyOn) {
    return NextResponse.json(
      { ok: false, error: "Missing userId, webhookUrl, channel, or notifyOn." },
      { status: 400 }
    );
  }

  try {
    await saveSlackConnection(userId, webhookUrl, channel, notifyOn);
    return NextResponse.json({ ok: true, message: "Slack connected successfully." });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to connect Slack." },
      { status: 500 }
    );
  }
}
