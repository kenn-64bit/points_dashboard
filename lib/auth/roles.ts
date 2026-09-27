import type { AppUserRole } from "@/types";

// Permission checks shared by route handlers, pages and client components —
// no `server-only`, so the UI can hide controls with the same rules. The
// server always enforces them; hiding a control is only a convenience.

// Keep in sync with the app_users.role check in schema.sql.
export const APP_USER_ROLES: readonly AppUserRole[] = ["admin", "editor", "viewer"];

export const ROLE_LABELS: Record<AppUserRole, string> = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<AppUserRole, string> = {
  admin: "Everything, plus managing the team.",
  editor: "Create and change events, weeks and points.",
  viewer: "Read-only. Can still export CSVs.",
};

export function isAppUserRole(value: unknown): value is AppUserRole {
  return typeof value === "string" && (APP_USER_ROLES as readonly string[]).includes(value);
}

// Create, edit and delete events, weeks, participants and points.
export function canEdit(role: AppUserRole): boolean {
  return role === "admin" || role === "editor";
}

// Add and remove roster members, change roles, reset passwords.
export function canManageTeam(role: AppUserRole): boolean {
  return role === "admin";
}
