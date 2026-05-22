"use client";

import { createContext, useContext } from "react";
import type { NfRole } from "@/types";

interface NfRoleContextType {
  role: NfRole;
  pendingAssignedCount: number;
}

const NfRoleContext = createContext<NfRoleContextType | undefined>(undefined);

export function NfRoleProvider({
  role,
  pendingAssignedCount = 0,
  children
}: {
  role: NfRole;
  pendingAssignedCount?: number;
  children: React.ReactNode;
}) {
  return (
    <NfRoleContext.Provider value={{ role, pendingAssignedCount }}>
      {children}
    </NfRoleContext.Provider>
  );
}

export function useNfRole(): NfRole {
  const ctx = useContext(NfRoleContext);
  if (!ctx) throw new Error("useNfRole must be used within NfRoleProvider");
  return ctx.role;
}

export function useNfRoleContext(): NfRoleContextType {
  const ctx = useContext(NfRoleContext);
  if (!ctx) throw new Error("useNfRoleContext must be used within NfRoleProvider");
  return ctx;
}

export function usePendingAssignedCount(): number {
  const ctx = useContext(NfRoleContext);
  return ctx?.pendingAssignedCount ?? 0;
}

/**
 * Helper: lang derivado do papel. Publisher ve UI em ingles (publishers
 * sao globais), adm/admin em portugues (Caracol e brasileira).
 */
export function langForRole(role: NfRole): "pt" | "en" {
  return role === "publisher" ? "en" : "pt";
}
