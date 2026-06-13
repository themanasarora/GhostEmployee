import { NextRequest, NextResponse } from "next/server";
import { buildGmailAuthUrl, createGmailConnectState, hasGmailOAuthConfig } from "@/lib/server/gmail";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  const returnTo = request.nextUrl.searchParams.get("returnTo") || "/settings";

  if (!userId) {
    return NextResponse.json({ ok: false, error: "Missing userId." }, { status: 400 });
  }

  const redirectUri = `${request.nextUrl.origin}/api/gmail/connect/callback`;
  const state = createGmailConnectState(userId, returnTo);

  if (!hasGmailOAuthConfig()) {
    return NextResponse.json(
      { ok: false, error: "Missing Gmail OAuth credentials. Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET." },
      { status: 500 }
    );
  }

  try {
    return NextResponse.redirect(buildGmailAuthUrl(state, redirectUri));
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to start Gmail OAuth." },
      { status: 500 }
    );
  }
}