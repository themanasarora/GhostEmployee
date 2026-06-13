import { NextRequest, NextResponse } from "next/server";
import { getGmailStatus } from "@/lib/server/gmail";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Missing userId." }, { status: 400 });
  }

  const status = await getGmailStatus(userId);
  return NextResponse.json({ ok: true, ...status });
}