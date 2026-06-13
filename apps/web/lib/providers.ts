export type ProviderKind = "oauth" | "api_token" | "manual";

export interface ProviderDefinition {
  id: string;
  name: string;
  kind: ProviderKind;
  description: string;
  status: "planned" | "placeholder" | "ready";
  scopes: string[];
  nextStep: string;
}

export type ProviderId = "gmail" | "googleCalendar" | "slack" | "microsoft" | "ats" | "browser";

export interface ProviderConnection {
  providerId: ProviderId;
  connected: boolean;
  connectedAt?: number;
  label?: string;
  accountHint?: string;
  scopes?: string[];
  lastUsedAt?: number;
}

function connectionKey(userId: string) {
  return `ghost_provider_connections_${userId}`;
}

export function mapActionToProvider(action: "email" | "slack" | "research" | "ats" | "browser" | "calendar" | "approval" | "report"): ProviderId | null {
  if (action === "email") return "gmail";
  if (action === "calendar") return "googleCalendar";
  if (action === "slack") return "slack";
  if (action === "ats") return "ats";
  if (action === "browser") return "browser";
  return null;
}

export function getProviderConnections(userId: string): Record<ProviderId, ProviderConnection | null> {
  if (typeof window === "undefined") {
    return { gmail: null, googleCalendar: null, slack: null, microsoft: null, ats: null, browser: null };
  }

  try {
    const raw = localStorage.getItem(connectionKey(userId));
    const parsed = raw ? (JSON.parse(raw) as Partial<Record<ProviderId, ProviderConnection>>) : {};
    return {
      gmail: parsed.gmail ?? null,
      googleCalendar: parsed.googleCalendar ?? null,
      slack: parsed.slack ?? null,
      microsoft: parsed.microsoft ?? null,
      ats: parsed.ats ?? null,
      browser: parsed.browser ?? null,
    };
  } catch {
    return { gmail: null, googleCalendar: null, slack: null, microsoft: null, ats: null, browser: null };
  }
}

export function setProviderConnection(userId: string, connection: ProviderConnection) {
  if (typeof window === "undefined") return;
  const current = getProviderConnections(userId);
  current[connection.providerId] = connection;
  localStorage.setItem(connectionKey(userId), JSON.stringify(current));
}

export function clearProviderConnection(userId: string, providerId: ProviderId) {
  if (typeof window === "undefined") return;
  const current = getProviderConnections(userId);
  current[providerId] = null;
  localStorage.setItem(connectionKey(userId), JSON.stringify(current));
}

export const PROVIDERS: ProviderDefinition[] = [
  {
    id: "gmail",
    name: "Gmail",
    kind: "oauth",
    description: "Use Google OAuth for Gmail send and draft actions.",
    status: "placeholder",
    scopes: ["gmail.send", "gmail.readonly", "gmail.compose"],
    nextStep: "Add Google OAuth consent, encrypt the refresh token, and map Gmail scopes per workspace.",
  },
  {
    id: "googleCalendar",
    name: "Google Calendar",
    kind: "oauth",
    description: "Use Google OAuth for calendar scheduling and meeting actions.",
    status: "planned",
    scopes: ["calendar.events", "calendar.readonly"],
    nextStep: "Wire Google Calendar OAuth after Gmail and map scheduling actions.",
  },
  {
    id: "slack",
    name: "Slack",
    kind: "oauth",
    description: "Let agents post updates, read channel context, and request approvals in Slack.",
    status: "placeholder",
    scopes: ["chat:write", "channels:read", "channels:history", "users:read"],
    nextStep: "Add Slack OAuth and store a bot token plus workspace team ID.",
  },
  {
    id: "microsoft",
    name: "Microsoft 365",
    kind: "oauth",
    description: "Use Microsoft Graph for Outlook mail and calendar actions.",
    status: "planned",
    scopes: ["Mail.Send", "Calendars.ReadWrite", "User.Read"],
    nextStep: "Wire Microsoft OAuth and Graph-backed send/schedule actions.",
  },
  {
    id: "ats",
    name: "ATS / Hiring tools",
    kind: "api_token",
    description: "Connect approved recruiting systems or import candidate data feeds.",
    status: "planned",
    scopes: ["candidate.search", "profile.read", "job.posting.write"],
    nextStep: "Add API-token or partner integration adapters for the supported ATS vendors.",
  },
  {
    id: "browser",
    name: "Browser automation",
    kind: "manual",
    description: "Run governed browser tasks with explicit approvals and session-based credentials.",
    status: "placeholder",
    scopes: ["session.cookies", "user-initiated actions"],
    nextStep: "Add Playwright/remote-browser execution with guarded approval checkpoints.",
  },
];
