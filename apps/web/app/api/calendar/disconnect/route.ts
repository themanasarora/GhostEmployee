import { NextRequest, NextResponse } from "next/server";
import { disconnectCalendar } from "@/lib/server/googleCalendar";

export async function POST(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Missing userId." }, { status: 400 });
  }
  try {
    await disconnectCalendar(userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to disconnect calendar." },
      { status: 500 }
    );
  }
}
