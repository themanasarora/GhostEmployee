import { NextRequest, NextResponse } from "next/server";
import { listCalendarEvents, createCalendarEvent } from "@/lib/server/googleCalendar";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Missing userId." }, { status: 400 });
  }

  try {
    const data = await listCalendarEvents(userId);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to list calendar events." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const { userId, summary, description, start, end, attendees, timeZone } = body ?? {};

  if (!userId || !summary || !start || !end) {
    return NextResponse.json({ ok: false, error: "Missing userId, summary, start, or end date." }, { status: 400 });
  }

  try {
    const data = await createCalendarEvent(userId, {
      summary,
      description,
      start,
      end,
      attendees,
      timeZone,
    });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to schedule calendar event." },
      { status: 500 }
    );
  }
}
