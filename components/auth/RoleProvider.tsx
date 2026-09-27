"use client";

import { createContext, useContext } from "react";
import { canEdit, canManageTeam } from "@/lib/auth/roles";
import type { AppUserRole } from "@/types";

// The signed-in user's role, set once by the dashboard layout, so any
// component can hide controls the user can't use. The API enforces the same
// rules — this is only for the UI.
const RoleContext = createContext<AppUserRole>("viewer");

export function RoleProvider({ role, children }: { role: AppUserRole; children: React.ReactNode }) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useRole(): AppUserRole {
  return useContext(RoleContext);
}

export function useCanEdit(): boolean {
  return canEdit(useRole());
}

export function useCanManageTeam(): boolean {
  return canManageTeam(useRole());
}
