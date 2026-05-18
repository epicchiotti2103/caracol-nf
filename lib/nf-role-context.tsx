"use client";

import { createContext, useContext } from "react";
import type { NfRole } from "@/types";

interface NfRoleContextType {
  role: NfRole;
}

const NfRoleContext = createContext<NfRoleContextType | undefined>(undefined);

export function NfRoleProvider({ role, children }: { role: NfRole; children: React.ReactNode }) {
  return <NfRoleContext.Provider value={{ role }}>{children}</NfRoleContext.Provider>;
}

export function useNfRole(): NfRole {
  const ctx = useContext(NfRoleContext);
  if (!ctx) throw new Error("useNfRole must be used within NfRoleProvider");
  return ctx.role;
}

/**
 * Helper: lang derivado do papel. Publisher ve UI em ingles, adm/admin em portugues.
 */
export function langForRole(role: NfRole): "pt" | "en" {
  return role === "publisher" ? "en" : "pt";
}
