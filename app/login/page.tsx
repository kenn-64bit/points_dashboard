import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { LoginForm } from "@/components/auth/LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in · Discord Points Manager",
};

// Only same-origin paths — rejects `//evil.com` and `/\evil.com`, which
// browsers treat as protocol-relative URLs to another host.
function safeNextPath(next: string | string[] | undefined): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/dashboard";
  }
  if (next === "/login" || next.startsWith("/login?") || next.startsWith("/api/")) return "/dashboard";
  return next;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = safeNextPath((await searchParams).next);
  if (await getCurrentUser()) redirect(next);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4 py-16">
      <LoginForm next={next} />
    </div>
  );
}
