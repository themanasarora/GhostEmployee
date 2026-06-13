import { NextRequest, NextResponse } from "next/server";
import { deleteCalendarEvent } from "@/lib/server/googleCalendar";

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const { userId, eventId } = body ?? {};

  if (!userId || !eventId) {
    return NextResponse.json({ ok: false, error: "Missing userId or eventId." }, { status: 400 });
  }

  try {
    const data = await deleteCalendarEvent(userId, eventId);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to delete calendar event." },
      { status: 500 }
    );
  }
}
