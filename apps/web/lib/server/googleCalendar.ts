import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "openid",
  "email",
  "profile",
];

type CalendarTokenRecord = {
  userId: string;
  email: string;
  label: string;
  accountHint: string;
  scopes: string[];
  connectedAt: number;
  lastUsedAt: number;
  refreshToken: string;
};

type CalendarTokenStore = Record<string, CalendarTokenRecord>;

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_FILE = path.join(DATA_DIR, "calendar-connections.json");
const SECRET_FILE = path.join(DATA_DIR, "calendar-encryption.key");

function getOAuthClientId() {
  return process.env.GOOGLE_CLIENT_ID || process.env.GMAIL_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
}

function getOAuthClientSecret() {
  return process.env.GOOGLE_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET || "";
}

function getStateSecret() {
  return process.env.GOOGLE_STATE_SECRET || process.env.GMAIL_STATE_SECRET || process.env.GMAIL_TOKEN_ENCRYPTION_KEY || "ghostemployee-calendar-dev-state";
}

export function hasCalendarOAuthConfig() {
  return Boolean(getOAuthClientId() && getOAuthClientSecret());
}

function base64UrlEncode(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, "base64url");
}

export function createCalendarConnectState(userId: string, returnTo: string) {
  const payload = {
    userId,
    returnTo,
    createdAt: Date.now(),
    nonce: crypto.randomBytes(12).toString("hex"),
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", getStateSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyCalendarConnectState(state: string) {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac("sha256", getStateSecret()).update(encoded).digest();
  const actual = Buffer.from(signature, "base64url");
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  const payload = JSON.parse(base64UrlDecode(encoded).toString("utf8")) as { userId: string; returnTo: string; createdAt: number; nonce: string };
  if (Date.now() - payload.createdAt > 15 * 60 * 1000) return null;
  return payload;
}

export function buildCalendarAuthUrl(state: string, redirectUri: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", getOAuthClientId());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("scope", CALENDAR_SCOPES.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function getEncryptionKey() {
  const envKey = process.env.GMAIL_TOKEN_ENCRYPTION_KEY || process.env.APP_ENCRYPTION_KEY;
  if (envKey) return crypto.createHash("sha256").update(envKey).digest();
  await ensureDataDir();
  try {
    const stored = await fs.readFile(SECRET_FILE, "utf8");
    return Buffer.from(stored, "base64url");
  } catch {
    const generated = crypto.randomBytes(32);
    await fs.writeFile(SECRET_FILE, generated.toString("base64url"), "utf8");
    return generated;
  }
}

function encrypt(value: string, key: Buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${encrypted.toString("base64url")}.${authTag.toString("base64url")}`;
}

function decrypt(value: string, key: Buffer) {
  const [ivB64, encryptedB64, tagB64] = value.split(".");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedB64, "base64url")), decipher.final()]).toString("utf8");
}

async function readStore(): Promise<CalendarTokenStore> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(STORE_FILE, "utf8");
    return JSON.parse(raw) as CalendarTokenStore;
  } catch {
    return {};
  }
}

async function writeStore(store: CalendarTokenStore) {
  await ensureDataDir();
  await fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

export async function getCalendarStatus(userId: string) {
  const store = await readStore();
  const record = store[userId];
  if (!record) {
    return { connected: false, providerId: "googleCalendar" as const, label: null, accountHint: null, connectedAt: null, scopes: [] };
  }

  return {
    connected: true,
    providerId: "googleCalendar" as const,
    label: record.label,
    accountHint: record.accountHint,
    connectedAt: record.connectedAt,
    scopes: record.scopes,
    lastUsedAt: record.lastUsedAt,
  };
}

export async function disconnectCalendar(userId: string) {
  const store = await readStore();
  delete store[userId];
  await writeStore(store);
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Google API request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  }
}

async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const body = new URLSearchParams({
    code,
    client_id: getOAuthClientId(),
    client_secret: getOAuthClientSecret(),
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || "Unable to exchange OAuth code for calendar.");
  }

  return data as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    scope?: string;
    token_type: string;
    id_token?: string;
  };
}

async function fetchGoogleProfile(accessToken: string) {
  const response = await fetchWithTimeout("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || "Unable to fetch Google profile.");
  }
  return data as { email?: string; name?: string };
}

export async function completeCalendarOAuth(code: string, redirectUri: string, userId: string) {
  const tokenResult = await exchangeCodeForTokens(code, redirectUri);
  if (!tokenResult.refresh_token) {
    throw new Error("Google did not return a refresh token for calendar. Reconnect calendar and approve offline access.");
  }

  const profile = await fetchGoogleProfile(tokenResult.access_token);
  const encryptionKey = await getEncryptionKey();
  const store = await readStore();
  store[userId] = {
    userId,
    email: profile.email || profile.name || "Google Calendar account",
    label: profile.name || profile.email || "Google Calendar account",
    accountHint: profile.email || profile.name || "Google Calendar account",
    scopes: tokenResult.scope?.split(" ") ?? CALENDAR_SCOPES,
    connectedAt: Date.now(),
    lastUsedAt: Date.now(),
    refreshToken: encrypt(tokenResult.refresh_token, encryptionKey),
  };
  await writeStore(store);

  return store[userId];
}

async function getAccessToken(userId: string) {
  const store = await readStore();
  const record = store[userId];
  if (!record) throw new Error("Google Calendar is not connected.");

  const encryptionKey = await getEncryptionKey();
  const refreshToken = decrypt(record.refreshToken, encryptionKey);
  const body = new URLSearchParams({
    client_id: getOAuthClientId(),
    client_secret: getOAuthClientSecret(),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || "Unable to refresh Google Calendar access token.");
  }

  return data as { access_token: string; expires_in: number; scope?: string; token_type: string };
}

async function calendarApiRequest(userId: string, pathSuffix: string, method: string, payload?: any) {
  const access = await getAccessToken(userId);
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/${pathSuffix}`;
  
  const headers: Record<string, string> = {
    Authorization: `Bearer ${access.access_token}`,
  };
  if (payload) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetchWithTimeout(url, {
    method,
    headers,
    body: payload ? JSON.stringify(payload) : undefined,
  });

  const store = await readStore();
  if (store[userId]) {
    store[userId].lastUsedAt = Date.now();
    await writeStore(store);
  }

  if (response.status === 204) {
    return { ok: true };
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || data.error_description || data.error || "Google Calendar request failed.");
  }

  return data;
}

export async function listCalendarEvents(userId: string) {
  // Returns upcoming events from primary calendar
  const now = new Date().toISOString();
  const pathSuffix = `events?maxResults=10&orderBy=startTime&singleEvents=true&timeMin=${encodeURIComponent(now)}`;
  return calendarApiRequest(userId, pathSuffix, "GET");
}

export type CreateEventInput = {
  summary: string;
  description?: string;
  start: string; // ISO String or datetime-local value
  end: string;
  attendees?: string[]; // array of emails
  timeZone?: string;
};

function formatEventDateTime(dateTimeStr: string, timeZone?: string) {
  if (dateTimeStr.endsWith("Z") || /([+-]\d{2}:\d{2})$/.test(dateTimeStr)) {
    return { dateTime: dateTimeStr };
  }
  let formatted = dateTimeStr;
  if (formatted.length === 16) {
    formatted += ":00";
  }
  return {
    dateTime: formatted,
    timeZone: timeZone || undefined,
  };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createCalendarEvent(userId: string, input: CreateEventInput) {
  const formattedAttendees = input.attendees
    ?.map(email => email.trim())
    .filter(email => EMAIL_REGEX.test(email))
    .map(email => ({ email }));

  const payload = {
    summary: input.summary,
    description: input.description,
    start: formatEventDateTime(input.start, input.timeZone),
    end: formatEventDateTime(input.end, input.timeZone),
    attendees: formattedAttendees && formattedAttendees.length > 0 ? formattedAttendees : undefined,
  };

  return calendarApiRequest(userId, "events", "POST", payload);
}

export type UpdateEventInput = {
  eventId: string;
  summary?: string;
  description?: string;
  start?: string;
  end?: string;
  attendees?: string[];
  timeZone?: string;
};

export async function updateCalendarEvent(userId: string, input: UpdateEventInput) {
  const payload: any = {};
  if (input.summary !== undefined) payload.summary = input.summary;
  if (input.description !== undefined) payload.description = input.description;
  
  if (input.start) {
    payload.start = formatEventDateTime(input.start, input.timeZone);
  }
  if (input.end) {
    payload.end = formatEventDateTime(input.end, input.timeZone);
  }
  if (input.attendees !== undefined) {
    const formattedAttendees = input.attendees
      ?.map(email => email.trim())
      .filter(email => EMAIL_REGEX.test(email))
      .map(email => ({ email }));
    payload.attendees = formattedAttendees && formattedAttendees.length > 0 ? formattedAttendees : null;
  }

  return calendarApiRequest(userId, `events/${input.eventId}`, "PATCH", payload);
}

export async function deleteCalendarEvent(userId: string, eventId: string) {
  return calendarApiRequest(userId, `events/${eventId}`, "DELETE");
}
