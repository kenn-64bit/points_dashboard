"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/common/Toast";
import { Button } from "@/components/common/Button";

export function SignOutButton() {
  const router = useRouter();
  const { showToast } = useToast();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) throw new Error("Sign out failed");
      router.replace("/login");
      router.refresh();
    } catch (err) {
      showToast((err as Error).message, "error");
      setSigningOut(false);
    }
  }

  return (
    <Button variant="ghost" onClick={handleSignOut} disabled={signingOut} className="px-3 py-1 text-xs">
      {signingOut ? "Signing out…" : "Sign out"}
    </Button>
  );
}
