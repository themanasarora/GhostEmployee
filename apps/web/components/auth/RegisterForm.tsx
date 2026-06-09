"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Divider } from "@/components/ui/Divider";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { registerWithEmail } from "@/lib/auth";

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const { error: authError } = await registerWithEmail(email, password, name);

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
        <h1 className="text-2xl font-bold text-white">Build your team</h1>
        <p className="text-sm text-slate-400">
          Create a free account to hire your first AI employees
        </p>
      </div>

      {/* OAuth */}
      <OAuthButtons onSuccess={() => router.replace("/dashboard")} />

      <Divider label="or register with email" />

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Your name"
          type="text"
          placeholder="Rajan"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          label="Password"
          type="password"
          placeholder="At least 6 characters"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="Minimum 6 characters"
          required
        />

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" fullWidth loading={loading} size="lg">
          Create account
        </Button>

        <p className="text-xs text-center text-slate-500">
          By creating an account you agree to our{" "}
          <Link href="/terms" className="hover:text-slate-300 underline underline-offset-2">Terms</Link>
          {" "}and{" "}
          <Link href="/privacy" className="hover:text-slate-300 underline underline-offset-2">Privacy Policy</Link>.
        </p>
      </form>

      <p className="text-sm text-center text-slate-400">
        Already have an account?{" "}
        <Link href="/login" className="text-[#E94560] hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}
