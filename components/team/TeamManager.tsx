"use client";

import { useState } from "react";
import type { AppUserRole, TeamMember } from "@/types";
import { APP_USER_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/roles";
import { MIN_PASSWORD_LENGTH, MAX_EMAIL_LENGTH, MAX_PASSWORD_LENGTH } from "@/lib/validation";
import { useToast } from "@/components/common/Toast";
import { Panel } from "@/components/common/Panel";
import { Badge } from "@/components/common/Badge";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { IconButton } from "@/components/common/IconButton";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FieldError, Label, inputClasses, inputErrorClasses } from "@/components/common/Field";
import { KeyIcon, TrashIcon } from "@/components/common/icons";

function memberUrl(email: string): string {
  return `/api/team/${encodeURIComponent(email)}`;
}

async function sendJson(url: string, method: string, payload?: unknown) {
  const res = await fetch(url, {
    method,
    headers: payload === undefined ? undefined : { "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Something went wrong");
  return body;
}

function formatJoined(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `Added ${date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

// Three roles, one click: a segmented control rather than a dropdown.
function RolePicker({
  value,
  onChange,
  disabled,
  label,
}: {
  value: AppUserRole;
  onChange: (role: AppUserRole) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`inline-flex shrink-0 rounded-full border border-border bg-surface-muted p-0.5 ${disabled ? "opacity-60" : ""}`}
    >
      {APP_USER_ROLES.map((role) => {
        const checked = role === value;
        return (
          <button
            key={role}
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={disabled}
            title={ROLE_DESCRIPTIONS[role]}
            onClick={() => !checked && onChange(role)}
            className={`rounded-full px-3 py-1 text-xs font-bold transition-colors disabled:cursor-not-allowed ${
              checked ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground enabled:hover:text-foreground"
            }`}
          >
            {ROLE_LABELS[role]}
          </button>
        );
      })}
    </div>
  );
}

// Password + confirmation, with inline errors (see passwordsValid).
function PasswordFields({
  password,
  confirm,
  onPassword,
  onConfirm,
  disabled,
}: {
  password: string;
  confirm: string;
  onPassword: (v: string) => void;
  onConfirm: (v: string) => void;
  disabled: boolean;
}) {
  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const mismatch = confirm.length > 0 && confirm !== password;
  return (
    <>
      <div>
        <Label htmlFor="team-password">Password</Label>
        <input
          id="team-password"
          type="password"
          autoComplete="new-password"
          value={password}
          maxLength={MAX_PASSWORD_LENGTH}
          onChange={(e) => onPassword(e.target.value)}
          disabled={disabled}
          aria-invalid={tooShort}
          aria-describedby={tooShort ? "team-password-error" : undefined}
          className={tooShort ? inputErrorClasses : inputClasses}
        />
        {tooShort && <FieldError id="team-password-error">At least {MIN_PASSWORD_LENGTH} characters.</FieldError>}
      </div>
      <div>
        <Label htmlFor="team-password-confirm">Confirm password</Label>
        <input
          id="team-password-confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          maxLength={MAX_PASSWORD_LENGTH}
          onChange={(e) => onConfirm(e.target.value)}
          disabled={disabled}
          aria-invalid={mismatch}
          aria-describedby={mismatch ? "team-password-confirm-error" : undefined}
          className={mismatch ? inputErrorClasses : inputClasses}
        />
        {mismatch && <FieldError id="team-password-confirm-error">Passwords don&apos;t match.</FieldError>}
      </div>
    </>
  );
}

function passwordsValid(password: string, confirm: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH && password === confirm;
}

function AddMemberModal({ onCancel, onAdded }: { onCancel: () => void; onAdded: (member: TeamMember) => void }) {
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<AppUserRole>("viewer");
  const [submitting, setSubmitting] = useState(false);
  const valid = email.trim().includes("@") && passwordsValid(password, confirm);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    try {
      const body = await sendJson("/api/team", "POST", { email, password, role });
      showToast(`${body.member.email} added as ${ROLE_LABELS[role].toLowerCase()}`);
      onAdded(body.member);
    } catch (err) {
      showToast((err as Error).message, "error");
      setSubmitting(false);
    }
  }

  return (
    <Modal maxWidth="max-w-md">
      <h3 className="mb-4 text-lg font-extrabold text-foreground">Add member</h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="team-email">Email</Label>
          <input
            id="team-email"
            type="email"
            autoComplete="off"
            autoFocus
            value={email}
            maxLength={MAX_EMAIL_LENGTH}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            className={inputClasses}
          />
        </div>
        <PasswordFields
          password={password}
          confirm={confirm}
          onPassword={setPassword}
          onConfirm={setConfirm}
          disabled={submitting}
        />
        <div>
          <Label>Role</Label>
          <RolePicker value={role} onChange={setRole} disabled={submitting} label="Role" />
          <p className="mt-1.5 text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting || !valid}>
            {submitting ? "Adding…" : "Add member"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ email, onDone }: { email: string; onDone: () => void }) {
  const { showToast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const valid = passwordsValid(password, confirm);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    try {
      await sendJson(memberUrl(email), "PATCH", { password });
      showToast(`Password reset for ${email}`);
      onDone();
    } catch (err) {
      showToast((err as Error).message, "error");
      setSubmitting(false);
    }
  }

  return (
    <Modal maxWidth="max-w-md">
      <h3 className="text-lg font-extrabold text-foreground">Reset password</h3>
      <p className="mb-4 mt-1 break-all text-sm text-muted-foreground">{email}</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <PasswordFields
          password={password}
          confirm={confirm}
          onPassword={setPassword}
          onConfirm={setConfirm}
          disabled={submitting}
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onDone} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={submitting || !valid}>
            {submitting ? "Saving…" : "Reset password"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function TeamManager({ initialMembers, currentEmail }: { initialMembers: TeamMember[]; currentEmail: string }) {
  const { showToast } = useToast();
  const [members, setMembers] = useState(initialMembers);
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [removePending, setRemovePending] = useState(false);
  const [savingRole, setSavingRole] = useState<string | null>(null);
  // A role picked in the list, waiting for confirmation.
  const [pendingRole, setPendingRole] = useState<{ email: string; from: AppUserRole; to: AppUserRole } | null>(null);

  async function changeRole(email: string, role: AppUserRole) {
    setSavingRole(email);
    setPendingRole(null);
    try {
      const body = await sendJson(memberUrl(email), "PATCH", { role });
      setMembers((prev) => prev.map((m) => (m.email === email ? body.member : m)));
      showToast(`${email} is now ${ROLE_LABELS[role].toLowerCase()}`);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setSavingRole(null);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    setRemovePending(true);
    try {
      await sendJson(memberUrl(removing), "DELETE");
      setMembers((prev) => prev.filter((m) => m.email !== removing));
      showToast(`${removing} removed`);
      setRemoving(null);
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setRemovePending(false);
    }
  }

  return (
    <>
      <Panel
        label={`${members.length} ${members.length === 1 ? "member" : "members"}`}
        // Not clipped, so the top row's tooltips can rise above the panel.
        bodyClassName="divide-y divide-dashed divide-line overflow-visible!"
      >
        {members.map((member) => {
          const isSelf = member.email === currentEmail;
          return (
            <div key={member.email} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-bold text-foreground">{member.email}</span>
                  {isSelf && <Badge tone="primary" className="py-0.5">You</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{formatJoined(member.created_at)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <RolePicker
                  value={member.role}
                  onChange={(role) => setPendingRole({ email: member.email, from: member.role, to: role })}
                  disabled={isSelf || savingRole === member.email}
                  label={`Role for ${member.email}`}
                />
                <IconButton label="Reset password" tone="primary" onClick={() => setResetting(member.email)} className="h-9 w-9">
                  <KeyIcon className="h-4 w-4" />
                </IconButton>
                <IconButton
                  label={isSelf ? "You can't remove yourself" : "Remove from team"}
                  tone="danger"
                  tooltipAlign="end"
                  onClick={() => setRemoving(member.email)}
                  disabled={isSelf}
                  className="h-9 w-9"
                >
                  <TrashIcon className="h-4 w-4" />
                </IconButton>
              </div>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-full items-center gap-2 rounded-b-panel px-5 py-3 text-left text-sm font-extrabold text-primary-ink transition-colors hover:bg-accent-soft"
        >
          <span aria-hidden className="text-base leading-none">
            +
          </span>
          Add member
        </button>
      </Panel>

      {adding && (
        <AddMemberModal
          onCancel={() => setAdding(false)}
          onAdded={(member) => {
            setMembers((prev) => [...prev, member]);
            setAdding(false);
          }}
        />
      )}

      {pendingRole && (
        <Modal maxWidth="max-w-md" onClose={() => setPendingRole(null)} labelledBy="confirm-role-title">
          <h3 id="confirm-role-title" className="text-lg font-extrabold text-foreground">
            Change role?
          </h3>
          <p className="mt-1 break-all text-sm text-muted-foreground">{pendingRole.email}</p>
          <div className="mt-4 flex items-center gap-2 text-sm font-bold">
            <Badge className="py-0.5">{ROLE_LABELS[pendingRole.from]}</Badge>
            <span aria-hidden className="text-muted-foreground">→</span>
            <Badge tone="primary" className="py-0.5">{ROLE_LABELS[pendingRole.to]}</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {ROLE_DESCRIPTIONS[pendingRole.to]} Takes effect on their next click.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPendingRole(null)}>
              Cancel
            </Button>
            <Button variant="primary" autoFocus onClick={() => changeRole(pendingRole.email, pendingRole.to)}>
              Make {ROLE_LABELS[pendingRole.to].toLowerCase()}
            </Button>
          </div>
        </Modal>
      )}

      {resetting && <ResetPasswordModal email={resetting} onDone={() => setResetting(null)} />}

      {removing && (
        <ConfirmDialog
          title="Remove from team?"
          confirmLabel="Remove"
          pendingLabel="Removing…"
          pending={removePending}
          onConfirm={confirmRemove}
          onCancel={() => setRemoving(null)}
        >
          {removing} will be signed out and can&apos;t sign in again unless re-added.
        </ConfirmDialog>
      )}
    </>
  );
}
