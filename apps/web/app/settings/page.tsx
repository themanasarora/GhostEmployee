"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { clearProviderConnection, getProviderConnections, ProviderConnection, ProviderId, PROVIDERS, setProviderConnection } from "@/lib/providers";
import { Shield, Lock, ArrowRight, CheckCircle2, Sparkles, PlugZap, Unplug, CircleCheckBig } from "lucide-react";

export default function SettingsPage() {
  const { user, loading } = useRequireAuth();
  const { user: authUser } = useAuth();
  const [connections, setConnections] = useState<Record<ProviderId, ProviderConnection | null>>({
    gmail: null,
    googleCalendar: null,
    slack: null,
    microsoft: null,
    ats: null,
    browser: null,
  });
  
  // Slack connection modal state
  const [showSlackModal, setShowSlackModal] = useState(false);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");
  const [slackChannel, setSlackChannel] = useState("#general");
  const [slackConnecting, setSlackConnecting] = useState(false);
  const [slackError, setSlackError] = useState<string | null>(null);

  useEffect(() => {
    if (authUser?.uid) setConnections(getProviderConnections(authUser.uid));
  }, [authUser?.uid]);

  useEffect(() => {
    async function syncProviders() {
      if (!authUser?.uid) return;
      
      try {
        const response = await fetch(`/api/gmail/status?userId=${encodeURIComponent(authUser.uid)}`);
        const data = await response.json();
        if (data.connected) {
          const provider = PROVIDERS.find((item) => item.id === "gmail");
          setProviderConnection(authUser.uid, {
            providerId: "gmail",
            connected: true,
            connectedAt: data.connectedAt ?? Date.now(),
            label: data.label ?? "Gmail",
            accountHint: data.accountHint ?? authUser.email ?? undefined,
            scopes: data.scopes ?? provider?.scopes,
            lastUsedAt: data.lastUsedAt ?? data.connectedAt ?? Date.now(),
          });
        }
      } catch (e) {
        console.error("Failed to sync Gmail status", e);
      }

      try {
        const response = await fetch(`/api/calendar/status?userId=${encodeURIComponent(authUser.uid)}`);
        const data = await response.json();
        if (data.connected) {
          const provider = PROVIDERS.find((item) => item.id === "googleCalendar");
          setProviderConnection(authUser.uid, {
            providerId: "googleCalendar",
            connected: true,
            connectedAt: data.connectedAt ?? Date.now(),
            label: data.label ?? "Google Calendar",
            accountHint: data.accountHint ?? authUser.email ?? undefined,
            scopes: data.scopes ?? provider?.scopes,
            lastUsedAt: data.lastUsedAt ?? data.connectedAt ?? Date.now(),
          });
        }
      } catch (e) {
        console.error("Failed to sync Google Calendar status", e);
      }

      try {
        const response = await fetch(`/api/slack/status?userId=${encodeURIComponent(authUser.uid)}`);
        const data = await response.json();
        if (data.connected) {
          const provider = PROVIDERS.find((item) => item.id === "slack");
          setProviderConnection(authUser.uid, {
            providerId: "slack",
            connected: true,
            connectedAt: data.connectedAt ?? Date.now(),
            label: data.label ?? "Slack Workspace",
            accountHint: data.accountHint ?? undefined,
            scopes: data.scopes ?? provider?.scopes,
            lastUsedAt: data.lastUsedAt ?? data.connectedAt ?? Date.now(),
          });
        }
      } catch (e) {
        console.error("Failed to sync Slack status", e);
      }

      setConnections(getProviderConnections(authUser.uid));
    }

    void syncProviders();
  }, [authUser?.uid]);

  const connectedCount = useMemo(() => Object.values(connections).filter((connection) => connection?.connected).length, [connections]);

  function refreshConnections() {
    if (!authUser?.uid) return;
    setConnections(getProviderConnections(authUser.uid));
  }

  function connectProvider(providerId: ProviderId, label: string) {
    if (!authUser?.uid) return;
    if (providerId === "gmail") {
      window.location.href = `/api/gmail/connect/start?userId=${encodeURIComponent(authUser.uid)}&returnTo=${encodeURIComponent("/settings")}`;
      return;
    }
    if (providerId === "googleCalendar") {
      window.location.href = `/api/calendar/connect/start?userId=${encodeURIComponent(authUser.uid)}&returnTo=${encodeURIComponent("/settings")}`;
      return;
    }
    if (providerId === "slack") {
      setSlackWebhookUrl("");
      setSlackChannel("#general");
      setSlackError(null);
      setShowSlackModal(true);
      return;
    }
    const provider = PROVIDERS.find((item) => item.id === providerId);
    setProviderConnection(authUser.uid, {
      providerId,
      connected: true,
      connectedAt: Date.now(),
      label,
      accountHint: user?.email ?? authUser.email ?? undefined,
      scopes: provider?.scopes,
      lastUsedAt: Date.now(),
    });
    refreshConnections();
  }

  async function handleSlackConnect() {
    if (!authUser?.uid || !slackWebhookUrl.trim()) {
      setSlackError("Webhook URL is required.");
      return;
    }

    setSlackConnecting(true);
    setSlackError(null);

    try {
      const response = await fetch("/api/slack/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: authUser.uid,
          webhookUrl: slackWebhookUrl.trim(),
          channel: slackChannel.trim() || "#general",
          notifyOn: "All events",
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        setSlackError(data.error || "Failed to connect Slack.");
        setSlackConnecting(false);
        return;
      }

      const provider = PROVIDERS.find((item) => item.id === "slack");
      setProviderConnection(authUser.uid, {
        providerId: "slack",
        connected: true,
        connectedAt: Date.now(),
        label: "Slack Workspace",
        accountHint: slackChannel.trim() || "#general",
        scopes: provider?.scopes,
        lastUsedAt: Date.now(),
      });

      setShowSlackModal(false);
      setSlackWebhookUrl("");
      setSlackChannel("#general");
      refreshConnections();
    } catch (error) {
      setSlackError(error instanceof Error ? error.message : "Failed to connect Slack.");
    } finally {
      setSlackConnecting(false);
    }
  }

  function disconnectProvider(providerId: ProviderId) {
    if (!authUser?.uid) return;
    if (providerId === "gmail") {
      void fetch(`/api/gmail/disconnect?userId=${encodeURIComponent(authUser.uid)}`, { method: "POST" });
    }
    if (providerId === "googleCalendar") {
      void fetch(`/api/calendar/disconnect?userId=${encodeURIComponent(authUser.uid)}`, { method: "POST" });
    }
    if (providerId === "slack") {
      void fetch(`/api/slack/disconnect?userId=${encodeURIComponent(authUser.uid)}`, { method: "POST" });
    }
    clearProviderConnection(authUser.uid, providerId);
    refreshConnections();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A14] flex items-center justify-center">
        <div className="size-8 rounded-full border-2 border-[#E94560] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!authUser || !user) return null;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="size-12 rounded-2xl bg-[#E94560]/10 border border-[#E94560]/20 flex items-center justify-center shrink-0">
              <Shield className="size-5 text-[#E94560]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#E94560] uppercase tracking-widest mb-2">Access model</p>
              <h1 className="text-2xl font-bold text-white">Connect providers with OAuth, not passwords</h1>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed max-w-3xl">
                Users will grant access from this settings area. Gmail, calendar, Slack, and other tools should be connected through provider consent screens or approved API tokens.
                We should never ask people to paste their mailbox password into GhostEmployee.
              </p>
              <div className="flex flex-wrap gap-2 mt-4 text-xs text-slate-400">
                <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10">OAuth consent</span>
                <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10">Scoped access</span>
                <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10">Refresh-token storage</span>
                <span className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10">Revocable permissions</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {PROVIDERS.map((provider) => (
            <div key={provider.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-base font-semibold text-white">{provider.name}</h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-slate-300 border border-white/10 uppercase">{provider.kind}</span>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">{provider.description}</p>
                </div>
                <span className={provider.status === "ready" ? "text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400" : "text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300"}>
                  {provider.status}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-300">Connection status</p>
                    <p className="text-[11px] text-slate-500">
                      {connections[provider.id as ProviderId]?.connected ? "Connected and available to agents" : "Not connected yet"}
                    </p>
                  </div>
                  <span className={connections[provider.id as ProviderId]?.connected ? "text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400" : "text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300"}>
                    {connections[provider.id as ProviderId]?.connected ? "connected" : "disconnected"}
                  </span>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2">Scopes we will ask for</p>
                  <div className="flex flex-wrap gap-2">
                    {provider.scopes.map((scope) => (
                      <span key={scope} className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300">
                        {scope}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center gap-2 mb-1 text-slate-300 text-sm font-medium">
                    <Sparkles className="size-4 text-[#E94560]" /> Next step
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{provider.nextStep}</p>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  {connections[provider.id as ProviderId]?.connected ? (
                    <Button variant="ghost" fullWidth onClick={() => disconnectProvider(provider.id as ProviderId)}>
                      <Unplug className="size-4" /> Disconnect
                    </Button>
                  ) : (
                    <Button variant="ghost" fullWidth onClick={() => connectProvider(provider.id as ProviderId, `${provider.name} connection`) }>
                      <PlugZap className="size-4" /> Connect
                    </Button>
                  )}
                  <Button fullWidth disabled>
                    Review permissions
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="size-4 text-green-400" />
            <h2 className="text-sm font-semibold text-white">What this means for users</h2>
          </div>
          <div className="space-y-2 text-sm text-slate-400 leading-relaxed">
            <p>1. The user logs in to GhostEmployee.</p>
            <p>2. They open Settings and connect each provider through a consent screen.</p>
            <p>3. GhostEmployee stores only the minimum required token data, encrypted on the server.</p>
            <p>4. Agents use those scoped credentials for Gmail, Slack, calendar, browser, or ATS actions after approval.</p>
            <p>5. Until a live provider adapter exists, the task engine uses a placeholder execution path but keeps the queue moving.</p>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
            <CircleCheckBig className="size-4 text-green-400" />
            <span>{connectedCount} provider{connectedCount === 1 ? " is" : "s are"} connected right now.</span>
          </div>
        </div>

        {/* Slack Connection Modal */}
        {showSlackModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#0A0A14] border border-white/10 rounded-2xl p-8 max-w-md w-full mx-4">
              <h2 className="text-lg font-bold text-white mb-2">Connect Slack Workspace</h2>
              <p className="text-sm text-slate-400 mb-6">
                Paste your Slack Incoming Webhook URL to allow agents to post updates to your workspace.
              </p>

              {slackError && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                  <p className="text-sm text-red-400">{slackError}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">Webhook URL</label>
                  <input
                    type="password"
                    placeholder="https://hooks.slack.com/services/..."
                    value={slackWebhookUrl}
                    onChange={(e) => setSlackWebhookUrl(e.target.value)}
                    disabled={slackConnecting}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#E94560] transition-colors disabled:opacity-50"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Get this from Slack's Incoming Webhooks app settings
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">Channel</label>
                  <input
                    type="text"
                    placeholder="#general"
                    value={slackChannel}
                    onChange={(e) => setSlackChannel(e.target.value)}
                    disabled={slackConnecting}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#E94560] transition-colors disabled:opacity-50"
                  />
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <Button
                    variant="ghost"
                    fullWidth
                    onClick={() => {
                      setShowSlackModal(false);
                      setSlackError(null);
                    }}
                    disabled={slackConnecting}
                  >
                    Cancel
                  </Button>
                  <Button
                    fullWidth
                    onClick={handleSlackConnect}
                    disabled={slackConnecting || !slackWebhookUrl.trim()}
                  >
                    {slackConnecting ? "Connecting..." : "Connect"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
