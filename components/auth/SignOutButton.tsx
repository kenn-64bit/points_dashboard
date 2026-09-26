"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/common/Toast";
import { Button } from "@/components/common/Button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

export function SignOutButton() {
  const router = useRouter();
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState(false);
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
      setConfirming(false);
    }
  }

  return (
    <>
      {/* Red on hover/press, and it stays red while the confirmation is open. */}
      <Button
        variant="ghost"
        onClick={() => setConfirming(true)}
        disabled={signingOut}
        aria-haspopup="dialog"
        // `!` so these beat the ghost variant's own hover/text colors.
        className={`px-3 py-1 text-xs hover:bg-danger-soft! hover:text-danger! active:bg-danger-soft! active:text-danger! ${
          confirming ? "bg-danger-soft! text-danger!" : ""
        }`}
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </Button>

      {confirming && (
        <ConfirmDialog
          title="Sign out?"
          confirmLabel="Sign out"
          pendingLabel="Signing out…"
          pending={signingOut}
          onConfirm={handleSignOut}
          onCancel={() => setConfirming(false)}
        >
          You&apos;ll need to sign in again to manage events.
        </ConfirmDialog>
      )}
    </>
  );
}
