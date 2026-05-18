// Papeis intra-NF (vem de GET /api/v1/nf/me/role)
export type NfRole = "admin" | "adm_campanha" | "publisher";

// Status do workflow de invoice
// em_analise -> aprovada -> paga
// em_analise/aprovada -> recusada
export type InvoiceStatus = "em_analise" | "aprovada" | "paga" | "recusada";

export interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  due_date: string;        // YYYY-MM-DD
  reference_month: string; // YYYY-MM ou YYYY-MM-01
  campaign: string;
  status: InvoiceStatus;
  pdf_path?: string | null;
  notes?: string | null;
  publisher_id: string;
  publisher_name?: string | null;
  publisher_email?: string | null;
  approved_by?: string | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
  paid_by?: string | null;
  paid_by_name?: string | null;
  paid_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface DashboardBucket {
  count: number;
  total_amount: number;
}

export interface DashboardSummary {
  pending_review: DashboardBucket;  // status = em_analise
  to_pay: DashboardBucket;          // status = aprovada
  paid_last_30d: DashboardBucket;   // status = paga AND paid_at >= now - 30d
}

export interface NfUser {
  id: string;
  name: string;
  email: string;
  nf_role: NfRole | null;
}
