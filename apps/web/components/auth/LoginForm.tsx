"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Divider } from "@/components/ui/Divider";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { loginWithEmail } from "@/lib/auth";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = await loginWithEmail(email, password);

    if (authError) {
      setError(authError);
      setLoading(false);
      return;
    }

    router.replace("/dashboard");
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-white">Welcome back</h1>
        <p className="text-sm text-slate-400">
          Sign in to your workspace
        </p>
      </div>

      {/* OAuth */}
      <OAuthButtons onSuccess={() => router.replace("/dashboard")} />

      <Divider label="or continue with email" />

      {/* Email form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <div className="space-y-1">
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-xs text-slate-400 hover:text-[#E94560] transition-colors"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" fullWidth loading={loading} size="lg">
          Sign in
        </Button>
      </form>

      <p className="text-sm text-center text-slate-400">
        No account?{" "}
        <Link
          href="/register"
          className="text-[#E94560] hover:underline font-medium"
        >
          Create one free
        </Link>
      </p>
    </div>
  );
}
