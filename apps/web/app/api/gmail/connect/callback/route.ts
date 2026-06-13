import { NextRequest, NextResponse } from "next/server";
import { completeGmailOAuth, verifyGmailConnectState } from "@/lib/server/gmail";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");
  const errorDescription = request.nextUrl.searchParams.get("error_description");

  if (error) {
    return NextResponse.redirect(new URL(`/settings?gmail=error&message=${encodeURIComponent(errorDescription || error)}`, request.nextUrl.origin));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/settings?gmail=error&message=Missing%20OAuth%20code%20or%20state", request.nextUrl.origin));
  }

  const verified = verifyGmailConnectState(state);
  if (!verified) {
    return NextResponse.redirect(new URL("/settings?gmail=error&message=Invalid%20or%20expired%20OAuth%20state", request.nextUrl.origin));
  }

  const redirectUri = `${request.nextUrl.origin}/api/gmail/connect/callback`;

  try {
    await completeGmailOAuth(code, redirectUri, verified.userId);
    const url = new URL(verified.returnTo || "/settings", request.nextUrl.origin);
    url.searchParams.set("gmail", "connected");
    return NextResponse.redirect(url);
  } catch (oauthError) {
    return NextResponse.redirect(
      new URL(`/settings?gmail=error&message=${encodeURIComponent(oauthError instanceof Error ? oauthError.message : "Unable to connect Gmail")}`, request.nextUrl.origin)
    );
  }
}