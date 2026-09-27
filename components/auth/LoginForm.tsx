"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/common/Button";
import { Panel } from "@/components/common/Panel";
import { LeafMark } from "@/components/common/LeafMark";
import { FieldError, Label, inputClasses, inputErrorClasses } from "@/components/common/Field";
import { stripDisallowed } from "@/lib/text";
import { MAX_EMAIL_LENGTH, MAX_PASSWORD_LENGTH } from "@/lib/validation";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A bad login can't say which field is wrong (that would reveal who's on the
  // roster), so both fields go red and the message sits under the password.
  const fieldClasses = error ? inputErrorClasses : inputClasses;
  const errorProps = error ? { "aria-invalid": true, "aria-describedby": "login-error" } : {};

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
    <Panel bodyClassName="p-6 sm:p-8">
      <LeafMark className="mb-5 h-10 w-10" />
      <h1 className="text-xl font-extrabold tracking-tight text-foreground">Sign in</h1>
      <p className="mt-1 text-sm text-muted-foreground">Access is limited to invited team members.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            value={email}
            onChange={(e) => {
              setEmail(stripDisallowed(e.target.value));
              setError(null);
            }}
            maxLength={MAX_EMAIL_LENGTH}
            className={fieldClasses}
            {...errorProps}
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            maxLength={MAX_PASSWORD_LENGTH}
            className={fieldClasses}
            {...errorProps}
          />
          {error && <FieldError id="login-error">{error}</FieldError>}
        </div>

        <label className="flex w-fit items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 accent-primary-ink"
          />
          Remember me for 30 days
        </label>

        <Button type="submit" variant="primary" className="w-full" disabled={submitting || !email || !password}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </Panel>
  );
}
