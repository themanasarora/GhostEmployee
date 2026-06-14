import { promises as fs } from "node:fs";
import path from "node:path";

type SlackConnectionRecord = {
  userId: string;
  webhookUrl: string;
  channel: string;
  notifyOn: string;
  connectedAt: number;
  lastUsedAt: number;
};

type SlackConnectionStore = Record<string, SlackConnectionRecord>;

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_FILE = path.join(DATA_DIR, "slack-connections.json");

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readStore(): Promise<SlackConnectionStore> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(STORE_FILE, "utf8");
    return JSON.parse(raw) as SlackConnectionStore;
  } catch {
    return {};
  }
}

async function writeStore(store: SlackConnectionStore) {
  await ensureDataDir();
  await fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

export async function getSlackStatus(userId: string) {
  const store = await readStore();
  const record = store[userId];

  if (!record) {
    return {
      connected: false,
      providerId: "slack" as const,
      label: null,
      accountHint: null,
      connectedAt: null,
      scopes: [],
      lastUsedAt: null,
    };
  }

  return {
    connected: true,
    providerId: "slack" as const,
    label: "Slack Workspace",
    accountHint: record.channel,
    connectedAt: record.connectedAt,
    scopes: ["chat:write", "channels:read"],
    lastUsedAt: record.lastUsedAt,
  };
}

export async function saveSlackConnection(
  userId: string,
  webhookUrl: string,
  channel: string,
  notifyOn: string
) {
  const store = await readStore();
  store[userId] = {
    userId,
    webhookUrl,
    channel,
    notifyOn,
    connectedAt: Date.now(),
    lastUsedAt: Date.now(),
  };
  await writeStore(store);
}

export async function disconnectSlack(userId: string) {
  const store = await readStore();
  delete store[userId];
  await writeStore(store);
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timer);
    return response;
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Slack webhook request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  }
}

export async function sendSlackMessage(
  userId: string,
  message: string,
  title?: string
) {
  const store = await readStore();
  const record = store[userId];

  if (!record) {
    throw new Error("Slack is not connected for this user.");
  }

  const payload = {
    channel: record.channel,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: title ? `*${title}*\n${message}` : message,
        },
      },
    ],
  };

  const response = await fetchWithTimeout(record.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Slack webhook failed: ${response.status} ${text}`);
  }

  // Update last used timestamp
  record.lastUsedAt = Date.now();
  await writeStore(store);

  return { ok: true, message: "Slack message sent." };
}
