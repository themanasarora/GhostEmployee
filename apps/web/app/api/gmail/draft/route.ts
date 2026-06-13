import { NextRequest, NextResponse } from "next/server";
import { createGmailDraft } from "@/lib/server/gmail";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { userId, to, subject, body: messageBody } = body ?? {};

  if (!userId || !to || !subject || !messageBody) {
    return NextResponse.json({ ok: false, error: "Missing userId, to, subject, or body." }, { status: 400 });
  }

  try {
    const draft = await createGmailDraft(userId, to, subject, messageBody);
    return NextResponse.json({ ok: true, mode: "draft", draft });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to create Gmail draft." },
      { status: 500 }
    );
  }
}