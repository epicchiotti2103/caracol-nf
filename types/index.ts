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

export interface DashboardSummary {
  em_analise_count: number;
  a_pagar_amount: number;        // soma de aprovadas
  pagas_30d_amount: number;      // soma de pagas nos ultimos 30 dias
}

export interface NfUser {
  id: string;
  name: string;
  email: string;
  nf_role: NfRole | null;
}
