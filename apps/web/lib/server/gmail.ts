import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.readonly",
  "openid",
  "email",
  "profile",
];

type GmailTokenRecord = {
  userId: string;
  email: string;
  label: string;
  accountHint: string;
  scopes: string[];
  connectedAt: number;
  lastUsedAt: number;
  refreshToken: string;
};

type GmailTokenStore = Record<string, GmailTokenRecord>;

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_FILE = path.join(DATA_DIR, "gmail-connections.json");
const SECRET_FILE = path.join(DATA_DIR, "gmail-encryption.key");

function getOAuthClientId() {
  return process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
}

function getOAuthClientSecret() {
  return process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || "";
}

function getStateSecret() {
  return process.env.GMAIL_STATE_SECRET || process.env.GMAIL_TOKEN_ENCRYPTION_KEY || process.env.APP_ENCRYPTION_KEY || "ghostemployee-gmail-dev-state";
}

export function hasGmailOAuthConfig() {
  return Boolean(getOAuthClientId() && getOAuthClientSecret());
}

function base64UrlEncode(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, "base64url");
}

export function createGmailConnectState(userId: string, returnTo: string) {
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

export function verifyGmailConnectState(state: string) {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac("sha256", getStateSecret()).update(encoded).digest();
  const actual = Buffer.from(signature, "base64url");
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  const payload = JSON.parse(base64UrlDecode(encoded).toString("utf8")) as { userId: string; returnTo: string; createdAt: number; nonce: string };
  if (Date.now() - payload.createdAt > 15 * 60 * 1000) return null;
  return payload;
}

export function buildGmailAuthUrl(state: string, redirectUri: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", getOAuthClientId());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("scope", GMAIL_SCOPES.join(" "));
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

async function readStore(): Promise<GmailTokenStore> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(STORE_FILE, "utf8");
    return JSON.parse(raw) as GmailTokenStore;
  } catch {
    return {};
  }
}

async function writeStore(store: GmailTokenStore) {
  await ensureDataDir();
  await fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

export async function getGmailStatus(userId: string) {
  const store = await readStore();
  const record = store[userId];
  if (!record) {
    return { connected: false, providerId: "gmail" as const, label: null, accountHint: null, connectedAt: null, scopes: [] };
  }

  return {
    connected: true,
    providerId: "gmail" as const,
    label: record.label,
    accountHint: record.accountHint,
    connectedAt: record.connectedAt,
    scopes: record.scopes,
    lastUsedAt: record.lastUsedAt,
  };
}

export async function disconnectGmail(userId: string) {
  const store = await readStore();
  delete store[userId];
  await writeStore(store);
}

async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const body = new URLSearchParams({
    code,
    client_id: getOAuthClientId(),
    client_secret: getOAuthClientSecret(),
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || "Unable to exchange OAuth code.");
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

async function fetchGmailProfile(accessToken: string) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || "Unable to fetch Google profile.");
  }
  return data as { email?: string; name?: string };
}

export async function completeGmailOAuth(code: string, redirectUri: string, userId: string) {
  const tokenResult = await exchangeCodeForTokens(code, redirectUri);
  if (!tokenResult.refresh_token) {
    throw new Error("Google did not return a refresh token. Reconnect Gmail and approve offline access.");
  }

  const profile = await fetchGmailProfile(tokenResult.access_token);
  const encryptionKey = await getEncryptionKey();
  const store = await readStore();
  store[userId] = {
    userId,
    email: profile.email || profile.name || "Gmail account",
    label: profile.name || profile.email || "Gmail account",
    accountHint: profile.email || profile.name || "Gmail account",
    scopes: tokenResult.scope?.split(" ") ?? GMAIL_SCOPES,
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
  if (!record) throw new Error("Gmail is not connected.");

  const encryptionKey = await getEncryptionKey();
  const refreshToken = decrypt(record.refreshToken, encryptionKey);
  const body = new URLSearchParams({
    client_id: getOAuthClientId(),
    client_secret: getOAuthClientSecret(),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || "Unable to refresh Gmail access token.");
  }

  return data as { access_token: string; expires_in: number; scope?: string; token_type: string };
}

function buildMimeMessage(to: string, subject: string, body: string) {
  const message = [
    `To: ${to}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    `Subject: ${subject}`,
    "",
    body,
  ].join("\r\n");
  return Buffer.from(message).toString("base64url");
}

async function gmailApiRequest(userId: string, pathSuffix: string, method: string, payload: any) {
  const access = await getAccessToken(userId);
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${pathSuffix}`, {
    method,
    headers: {
      Authorization: `Bearer ${access.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || data.error_description || data.error || "Gmail request failed.");
  }
  const store = await readStore();
  if (store[userId]) {
    store[userId].lastUsedAt = Date.now();
    await writeStore(store);
  }
  return data;
}

export async function createGmailDraft(userId: string, to: string, subject: string, body: string) {
  const raw = buildMimeMessage(to, subject, body);
  return gmailApiRequest(userId, "drafts", "POST", { message: { raw } });
}

export async function sendGmailMessage(userId: string, to: string, subject: string, body: string) {
  const raw = buildMimeMessage(to, subject, body);
  return gmailApiRequest(userId, "messages/send", "POST", { raw });
}
