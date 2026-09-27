"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { canManageTeam, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/roles";
import { useToast } from "@/components/common/Toast";
import { Badge } from "@/components/common/Badge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ChevronDownIcon, MenuPanel } from "@/components/common/Select";
import { SignOutIcon, UsersIcon } from "@/components/common/icons";
import type { AppUserRole } from "@/types";

function Avatar({ email, className }: { email: string; className: string }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-accent font-extrabold text-accent-foreground ${className}`}
    >
      {email.charAt(0).toUpperCase()}
    </span>
  );
}

function RoleBadge({ role }: { role: AppUserRole }) {
  return (
    <Badge tone={role === "viewer" ? "neutral" : "primary"} className="py-0.5">
      {ROLE_LABELS[role]}
    </Badge>
  );
}

const ROW_CLASSES = "flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-bold text-muted-foreground transition-colors";

// The signed-in account in the header: an avatar chip that opens who you are,
// what your role allows, and Sign out. Below `sm` the header hides its nav,
// so the menu carries the Team link there instead.
export function AccountMenu({ email, role }: { email: string; role: AppUserRole }) {
  const router = useRouter();
  const { showToast } = useToast();
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

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
    <div ref={containerRef} className="relative min-w-0">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Account: ${email}`}
        onClick={() => setOpen((o) => !o)}
        className={`flex min-w-0 items-center gap-2 rounded-full border border-control-border py-1 pl-1 pr-2.5 text-sm font-bold text-foreground transition-colors hover:bg-accent-soft ${
          open ? "bg-accent-soft" : "bg-control"
        }`}
      >
        <Avatar email={email} className="h-8 w-8 text-sm" />
        <span className="hidden max-w-48 truncate sm:inline">{email}</span>
        <span className="hidden sm:inline-flex">
          <RoleBadge role={role} />
        </span>
        <ChevronDownIcon open={open} />
      </button>

      {open && (
        <MenuPanel id={menuId} align="end" className="w-72 max-w-[calc(100vw-2rem)]">
          <div className="divide-y divide-dashed divide-line">
            <div className="flex items-start gap-3 px-4 py-3.5">
              <Avatar email={email} className="h-10 w-10 text-base" />
              <div className="min-w-0 flex-1">
                <p className="break-all text-sm font-bold text-foreground">{email}</p>
                <div className="mt-1.5">
                  <RoleBadge role={role} />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
              </div>
            </div>

            {canManageTeam(role) && (
              <Link
                href="/dashboard/team"
                onClick={() => setOpen(false)}
                className={`${ROW_CLASSES} hover:bg-accent-soft hover:text-foreground sm:hidden`}
              >
                <UsersIcon className="h-4 w-4" />
                Team
              </Link>
            )}

            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => {
                setOpen(false);
                setConfirming(true);
              }}
              className={`${ROW_CLASSES} hover:bg-danger-soft hover:text-danger-ink`}
            >
              <SignOutIcon className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </MenuPanel>
      )}

      {/* Portalled out of the sticky header, whose stacking context would
          otherwise cap the dialog's z-index at the header's. */}
      {confirming &&
        createPortal(
          <ConfirmDialog
            title="Sign out?"
            confirmLabel="Sign out"
            pendingLabel="Signing out…"
            pending={signingOut}
            onConfirm={handleSignOut}
            onCancel={() => setConfirming(false)}
          >
            You&apos;ll need to sign in again to manage events.
          </ConfirmDialog>,
          document.body
        )}
    </div>
  );
}
