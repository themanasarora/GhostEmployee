import { NextRequest, NextResponse } from "next/server";
import { getSlackStatus } from "@/lib/server/slack";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Missing userId." }, { status: 400 });
  }

  try {
    const status = await getSlackStatus(userId);
    return NextResponse.json({ ok: true, ...status });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to fetch Slack status." },
      { status: 500 }
    );
  }
}
