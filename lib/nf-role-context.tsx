"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { setRoleCacheCanDelete, setRoleCachePendingCount } from "@/lib/nf-role-cache";
import type { MeRoleResponse, NfPermKey, NfRole } from "@/types";

interface NfRoleContextType {
  role: NfRole;
  pendingAssignedCount: number;
  /** Permissões resolvidas pro papel atual (keys liberadas). */
  permissions: string[];
  /** Gating dinâmico: admin é god-mode (sempre true). */
  can: (key: NfPermKey | string) => boolean;
  /**
   * `can_delete_invoices` do GET /nf/me/role. É flag booleana própria (não
   * entra na matriz de permissões), então fica fora do `can`. Ausente no
   * payload = false — com o backend antigo a ação de apagar simplesmente
   * não aparece.
   */
  canDeleteInvoices: boolean;
  /** Refaz o fetch de /nf/me/role e revalida o contador do banner. */
  refreshRole: () => Promise<void>;
}

const NfRoleContext = createContext<NfRoleContextType | undefined>(undefined);

export function NfRoleProvider({
  role,
  pendingAssignedCount = 0,
  permissions = [],
  canDeleteInvoices = false,
  children
}: {
  role: NfRole;
  pendingAssignedCount?: number;
  permissions?: string[];
  canDeleteInvoices?: boolean;
  children: React.ReactNode;
}) {
  // O contador vem seedado da prop (bootstrap-gate), mas vira state
  // revalidavel pra que o botao "Atualizar" da home possa renova-lo
  // sem reload completo.
  const [count, setCount] = useState<number>(pendingAssignedCount);
  // Idem pra flag de apagar: seedada do gate, revalidada no refreshRole (assim
  // se o backend subir a flag no meio da sessao a acao aparece sem reload).
  const [canDelete, setCanDelete] = useState<boolean>(canDeleteInvoices);

  const permSet = useMemo(() => new Set(permissions), [permissions]);
  const can = useCallback(
    (key: NfPermKey | string) => role === "admin" || permSet.has(key),
    [role, permSet]
  );

  const refreshRole = useCallback(async () => {
    try {
      const res: MeRoleResponse = await apiFetch("/nf/me/role");
      const pendingMy =
        res?.pending_my_approval_count != null
          ? Number(res.pending_my_approval_count)
          : Number(res?.pending_assigned_count) || 0;
      const next = Math.max(0, pendingMy || 0);
      setCount(next);
      const nextCanDelete = res?.can_delete_invoices === true;
      setCanDelete(nextCanDelete);
      // Mantem o cache do gate em sincronia pra navegacoes futuras.
      setRoleCachePendingCount(next);
      setRoleCacheCanDelete(nextCanDelete);
    } catch {
      // silencioso — mantem o valor atual se a revalidacao falhar
    }
  }, []);

  return (
    <NfRoleContext.Provider
      value={{
        role,
        pendingAssignedCount: count,
        permissions,
        can,
        canDeleteInvoices: canDelete,
        refreshRole
      }}
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

/**
 * Hook de gating dinâmico. Retorna `can(key)` — true se a permissão está
 * liberada pro papel atual (admin sempre true). Fora do provider, nega tudo.
 */
export function useCan(): (key: NfPermKey | string) => boolean {
  const ctx = useContext(NfRoleContext);
  return ctx?.can ?? (() => false);
}

/**
 * Flag booleana do backend (`can_delete_invoices` no GET /nf/me/role) que
 * libera a acao "Apagar NF". Fora do provider (ou backend antigo) = false.
 */
export function useCanDeleteInvoices(): boolean {
  const ctx = useContext(NfRoleContext);
  return ctx?.canDeleteInvoices ?? false;
}

export function usePermissions(): string[] {
  const ctx = useContext(NfRoleContext);
  return ctx?.permissions ?? [];
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
