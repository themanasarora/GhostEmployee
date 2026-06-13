import { NextRequest, NextResponse } from "next/server";
import { getCalendarStatus } from "@/lib/server/googleCalendar";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ connected: false });
  }
  try {
    const status = await getCalendarStatus(userId);
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json({ connected: false, error: error instanceof Error ? error.message : "Unknown error" });
  }
}
