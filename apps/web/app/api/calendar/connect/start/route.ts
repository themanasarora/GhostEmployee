import { NextRequest, NextResponse } from "next/server";
import { buildCalendarAuthUrl, createCalendarConnectState, hasCalendarOAuthConfig } from "@/lib/server/googleCalendar";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  const returnTo = request.nextUrl.searchParams.get("returnTo") || "/settings";

  if (!userId) {
    return NextResponse.json({ ok: false, error: "Missing userId." }, { status: 400 });
  }

  const redirectUri = `${request.nextUrl.origin}/api/calendar/connect/callback`;
  const state = createCalendarConnectState(userId, returnTo);

  if (!hasCalendarOAuthConfig()) {
    return NextResponse.json(
      { ok: false, error: "Missing Google Client credentials. Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET or GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." },
      { status: 500 }
    );
  }

  try {
    return NextResponse.redirect(buildCalendarAuthUrl(state, redirectUri));
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to start Calendar OAuth." },
      { status: 500 }
    );
  }
}
