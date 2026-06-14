import { NextRequest, NextResponse } from "next/server";
import { disconnectSlack } from "@/lib/server/slack";

export async function POST(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Missing userId." }, { status: 400 });
  }

  await disconnectSlack(userId);
  return NextResponse.json({ ok: true });
}
