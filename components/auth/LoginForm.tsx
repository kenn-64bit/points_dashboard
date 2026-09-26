"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/common/Button";

const INPUT_CLASSES =
  "w-full rounded-2xl border border-border bg-surface-muted px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-accent";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Sign in failed");
      }
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-8">
      <span className="mb-5 block h-9 w-9 rounded-full bg-gradient-to-br from-accent-from to-accent-to" aria-hidden />
      <h1 className="text-xl font-semibold tracking-tight text-foreground">Sign in</h1>
      <p className="mt-1 text-sm text-muted-foreground">Access is limited to invited team members.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-xs text-muted-foreground">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT_CLASSES}
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-xs text-muted-foreground">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={INPUT_CLASSES}
          />
        </div>

        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          Remember me for 30 days
        </label>

        {error && (
          <p role="alert" className="rounded-2xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" className="w-full" disabled={submitting || !email || !password}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
