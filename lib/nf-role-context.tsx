"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { apiFetch } from "@/lib/api";
import { setRoleCachePendingCount } from "@/lib/nf-role-cache";
import type { MeRoleResponse, NfRole } from "@/types";

interface NfRoleContextType {
  role: NfRole;
  pendingAssignedCount: number;
  /** Refaz o fetch de /nf/me/role e revalida o contador do banner. */
  refreshRole: () => Promise<void>;
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
  // O contador vem seedado da prop (bootstrap-gate), mas vira state
  // revalidavel pra que o botao "Atualizar" da home possa renova-lo
  // sem reload completo.
  const [count, setCount] = useState<number>(pendingAssignedCount);

  const refreshRole = useCallback(async () => {
    try {
      const res: MeRoleResponse = await apiFetch("/nf/me/role");
      const pendingMy =
        res?.pending_my_approval_count != null
          ? Number(res.pending_my_approval_count)
          : Number(res?.pending_assigned_count) || 0;
      const next = Math.max(0, pendingMy || 0);
      setCount(next);
      // Mantem o cache do gate em sincronia pra navegacoes futuras.
      setRoleCachePendingCount(next);
    } catch {
      // silencioso — mantem o valor atual se a revalidacao falhar
    }
  }, []);

  return (
    <NfRoleContext.Provider
      value={{ role, pendingAssignedCount: count, refreshRole }}
    >
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

export function useRefreshRole(): () => Promise<void> {
  const ctx = useContext(NfRoleContext);
  return ctx?.refreshRole ?? (async () => {});
}

/**
 * Helper: lang derivado do papel. Publisher ve UI em ingles (publishers
 * sao globais), adm/admin em portugues (Caracol e brasileira).
 */
export function langForRole(role: NfRole): "pt" | "en" {
  return role === "publisher" ? "en" : "pt";
}
