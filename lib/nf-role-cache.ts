import type { NfRole } from "@/types";

/**
 * Cache em memoria do papel intra-NF + contador de NFs aguardando minha
 * aprovacao. Vive fora do React pra sobreviver a navegacoes na mesma sessao.
 * Limpo no logout (quando user vira null no bootstrap-gate).
 *
 * Mora num modulo neutro (nao-client) pra que tanto o bootstrap-gate quanto
 * o nf-role-context possam ler/escrever sem criar import circular.
 */
export type RoleCache = {
  userId: string;
  role: NfRole | null;
  pendingAssignedCount: number;
  // Permissões resolvidas pro papel atual (GET /perms/nf/me). Quando o backend
  // de perms não estiver no ar, vem de um fallback derivado do role (ver gate).
  permissions: string[];
  // Flag `can_delete_invoices` do GET /nf/me/role. Ausente no backend = false.
  canDeleteInvoices: boolean;
};

let roleCache: RoleCache | null = null;

export function getRoleCache(): RoleCache | null {
  return roleCache;
}

export function setRoleCache(next: RoleCache | null) {
  roleCache = next;
}

/**
 * Mantem o contador do cache em sincronia quando algo revalida /nf/me/role
 * fora do gate (ex: botao "Atualizar" da home). Evita que uma navegacao
 * posterior recarregue um valor stale do cache.
 */
export function setRoleCachePendingCount(count: number) {
  if (roleCache) {
    roleCache = { ...roleCache, pendingAssignedCount: count };
  }
}

/** Mesma ideia do contador: mantem a flag de apagar NF fresca no cache. */
export function setRoleCacheCanDelete(canDelete: boolean) {
  if (roleCache) {
    roleCache = { ...roleCache, canDeleteInvoices: canDelete };
  }
}
