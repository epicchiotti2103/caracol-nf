// Papeis intra-NF (vem de GET /api/v1/nf/me/role)
export type NfRole = "admin" | "adm_campanha" | "publisher";

// Status do workflow de invoice
// em_analise (precisa 2 aprovacoes: adm_campanha + admin) -> aprovada -> paga
// em_analise -> recusada (com motivo)
export type InvoiceStatus = "em_analise" | "aprovada" | "paga" | "recusada";

// Quem ainda falta aprovar (vem em GET /nf/invoices). Vazio quando ja aprovada.
export type ApprovalSlot = "adm_campanha" | "admin";

export interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  due_date: string;        // YYYY-MM-DD
  reference_month: string; // YYYY-MM ou YYYY-MM-01
  campaign: string;
  status: InvoiceStatus;
  pdf_path?: string | null;
  notes_supplier?: string | null;
  notes_internal?: string | null;
  publisher_id: string;
  publisher_name?: string | null;
  publisher_email?: string | null;
  submitted_by?: string | null;
  submitted_by_name?: string | null;
  assignee_id?: string | null;
  assignee_name?: string | null;
  // Aprovacao dupla (novo fluxo)
  approved_by_adm_campanha_id?: string | null;
  approved_by_adm_campanha_name?: string | null;
  approved_by_adm_campanha_at?: string | null;
  approved_by_admin_id?: string | null;
  approved_by_admin_name?: string | null;
  approved_by_admin_at?: string | null;
  // Campos legados de aprovacao (mantidos pra compat: backend ainda pode popular)
  approved_by?: string | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
  // Pagamento
  paid_by?: string | null;
  paid_by_name?: string | null;
  paid_at?: string | null;
  paid_by_assignee_id?: string | null;
  paid_by_assignee_name?: string | null;
  created_at: string;
  updated_at?: string | null;
  // Derivados pelo backend (novos em GET /nf/invoices*)
  is_vencida?: boolean;
  days_overdue?: number | null;
  approvals_pending?: ApprovalSlot[];
}

// Response do GET /api/v1/nf/me/role
export interface MeRoleResponse {
  role: NfRole | null;
  // Counter antigo: NFs em_analise com assignee_id = me (semantica de "responsavel").
  pending_assigned_count?: number;
  // Counter novo: NFs em_analise que AINDA precisam da MINHA aprovacao (papel).
  // Backend ainda em deploy — quando ausente, frontend faz fallback no antigo.
  pending_my_approval_count?: number;
}

export interface DashboardBucket {
  count: number;
  total_amount: number;
}

export interface DashboardSummary {
  pending_review: DashboardBucket;  // status = em_analise (legado)
  to_pay: DashboardBucket;          // status = aprovada (legado)
  paid_last_30d: DashboardBucket;   // status = paga AND paid_at >= now - 30d (legado)
  // Novos counters do dashboard de chips
  pending_approvals_count?: number;
  to_pay_count?: number;
  overdue_count?: number;
}

// Itens compactos retornados pelas listas do hovercard de chips
export interface DashboardChipItem {
  invoice_id: string;
  invoice_number?: string;
  fornecedor?: string | null;
  valor?: number | null;
  aguarda?: ApprovalSlot[];        // pendentes
  pagador?: string | null;         // a pagar (nome ou null)
  dias_atraso?: number | null;     // vencidas
}

// Eventos de timeline (GET /nf/invoices/{id}/events)
export type InvoiceEventType =
  | "status_change"
  | "assignee_change"
  | "approval_added"
  | "paid_by_designated"
  | "notes_update";

// Payloads do jsonb gravados pelo backend (cada event_type tem shape diferente).
// Mantemos `any` pra fallback robusto, e tipamos os shapes conhecidos.
export type InvoiceEventValue =
  | null
  | {
      status?: InvoiceStatus | string | null;
      reason?: string | null;
      slot?: ApprovalSlot | string | null;
      actor_id?: string | null;
      assignee_id?: string | null;
      paid_by_assignee_id?: string | null;
      [k: string]: any;
    };

export interface InvoiceEvent {
  id?: string;
  event_type: InvoiceEventType;
  from_value?: InvoiceEventValue;
  to_value?: InvoiceEventValue;
  // Backend pode enriquecer com os nomes resolvidos via batch lookup (deploy futuro).
  // Frontend tem fallback gracioso quando esses campos nao vierem.
  from_name?: string | null;
  to_name?: string | null;
  actor?: { id?: string | null; name?: string | null } | null;
  created_at: string;
}

export interface NfUser {
  id: string;
  name: string;
  email: string;
  nf_role: NfRole | null;
}
