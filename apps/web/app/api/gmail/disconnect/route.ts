import { NextRequest, NextResponse } from "next/server";
import { disconnectGmail } from "@/lib/server/gmail";

export async function POST(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Missing userId." }, { status: 400 });
  }

  await disconnectGmail(userId);
  return NextResponse.json({ ok: true });
}