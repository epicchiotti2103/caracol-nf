// Papeis intra-NF (vem de GET /api/v1/nf/me/role)
export type NfRole = "admin" | "adm_campanha" | "publisher";

// ── Tags (1 por NF) ─────────────────────────────────────────────────────────
// Catalogo de tags do NF. GET /api/v1/nf/tags?active=true -> { items: NfTag[] }.
// Escrita (POST/PATCH/toggle-active) e admin-only no backend.
export interface NfTag {
  id: string;
  name: string;
  active: boolean;
}

// ── Vinculo NF <-> campanhas (N por NF, cada uma com valor) ──────────────────
// Vem enriquecido no GET de invoice/receivable (campo `campanhas`).
export interface NfCampanhaLink {
  campanha_id: string;
  codigo?: string | null;
  name?: string | null;
  mes_referencia?: string | null;
  valor_alocado: number | string; // backend serializa Decimal como string
}

// Item do seletor de campanha. GET /api/v1/campanhas?q=<texto>.
// Reusa o shape minimo retornado pela busca.
export interface CampanhaSearchItem {
  id: string;
  codigo?: string | null;
  name?: string | null;
  mes_referencia?: string | null;
}

// ── Competencias da NF a pagar (1..N por NF) ────────────────────────────────
// Uma NF pode cobrir varios meses de competencia, cada um com o seu valor
// (soma == valor da NF). Backend: `competencias_json` no POST, `competencias`
// no PATCH, e `competencias` (YYYY-MM-01) nos GETs de lista/detalhe.
// Opcional — backend em deploy paralelo (graceful degradation).
export interface NfCompetencia {
  competencia: string;      // "YYYY-MM-01" no GET; enviamos "YYYY-MM"
  valor: number | string;   // backend serializa Decimal como string
}

// Status do workflow de invoice
// em_analise (precisa 2 aprovacoes: adm_campanha + admin) -> aprovada -> paga
// em_analise -> recusada (com motivo)
export type InvoiceStatus = "em_analise" | "aprovada" | "paga" | "recusada";

// Quem ainda falta aprovar (vem em GET /nf/invoices). Vazio quando ja aprovada.
export type ApprovalSlot = "adm_campanha" | "admin";

// Moeda da NF. Backend ainda em deploy — frontend trata `undefined` como BRL
// (graceful degradation pra NFs antigas).
export type Moeda = "BRL" | "USD";

export interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  moeda?: Moeda | string | null;  // default 'BRL' quando ausente
  due_date: string;        // YYYY-MM-DD
  reference_month: string; // YYYY-MM ou YYYY-MM-01
  // Backend grava como `campaign_name`. Mantemos `campaign` legado pra
  // compat de render historico (algumas telas leem .campaign).
  campaign?: string | null;
  campaign_name?: string | null;
  status: InvoiceStatus;
  pdf_path?: string | null;
  notes_supplier?: string | null;
  notes_internal?: string | null;
  // NF a Pagar SEMPRE aponta pra um fornecedor cadastrado (supplier_id).
  // O conceito de "publisher" virou um atributo do fornecedor (is_publisher).
  supplier_id?: string | null;
  supplier_name?: string | null;
  // Deprecado: publisher_id/name/email saiam do modelo antigo (NF -> publisher).
  // Mantidos opcionais so pra render gracioso de NFs historicas; backend nao
  // popula mais em NFs novas.
  publisher_id?: string | null;
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
  // Caminho no storage do comprovante de pagamento (PNG/JPEG/PDF).
  // Backend ainda em deploy — frontend trata `undefined`/`null` como "sem comprovante".
  paid_proof_path?: string | null;
  // Lote de pagamento (várias NFs quitadas numa transferência, 1 comprovante)
  batch_payment_id?: string | null;
  created_at: string;
  updated_at?: string | null;
  // Derivados pelo backend (novos em GET /nf/invoices*)
  is_vencida?: boolean;
  days_overdue?: number | null;
  approvals_pending?: ApprovalSlot[];
  // Tag (1 por NF) + vinculo de campanhas (N, cada uma com valor alocado).
  // Backend ainda em deploy — opcionais (graceful degradation).
  tag_id?: string | null;
  tag_name?: string | null;
  campanhas?: NfCampanhaLink[];
  // Competencias declaradas (>=1). Quando ausente/vazio, a NF cobre so o
  // `reference_month` (comportamento historico).
  competencias?: NfCompetencia[];
}

// ── Anti-duplicidade da NF a pagar ──────────────────────────────────────────
// GET /nf/invoices/duplicate-check (so leitura, nunca bloqueia) e os payloads
// dos 409 estruturados do POST /nf/invoices e dos endpoints de pagamento.

// Sobreposicao de competencia com uma NF ja cadastrada do mesmo fornecedor.
export interface DuplicateOverlap {
  invoice_id: string;
  invoice_number?: string | null;
  competencia?: string | null;      // YYYY-MM-01
  valor?: number | string | null;   // valor daquela competencia
  amount?: number | string | null;  // valor total da NF existente
  status?: string | null;
  // true = o conflito e ENTRE as NFs do proprio lote de pagamento (mesmo
  // fornecedor + mesmo mes, nenhuma paga ainda). Sem a flag, o conflito e com
  // uma NF JA PAGA. So o 409 de pagamento manda isso.
  no_lote?: boolean;
}

// Conflito de numero de NF / de PDF identico. O contrato do backend nao fecha
// o shape desses dois ("{...}") — lemos defensivo por invoice_number/invoice_id.
export interface DuplicateConflictRef {
  invoice_id?: string | null;
  invoice_number?: string | null;
  status?: string | null;
  amount?: number | string | null;
  competencia?: string | null;
  [k: string]: any;
}

export interface DuplicateCheckResponse {
  number_conflict: DuplicateConflictRef | null;
  pdf_conflict: DuplicateConflictRef | null;
  overlaps: DuplicateOverlap[];
}

// ── RBAC dinâmico (permissões por papel) ───────────────────────────────────
// Keys de permissão do NF (catálogo conhecido). Mantido como union pra
// autocomplete em `can(...)`, mas o backend é a fonte de verdade — o catálogo
// real vem em GET /perms/nf/matrix.
export type NfPermKey =
  | "nf.clientes.view"
  | "nf.clientes.manage"
  | "nf.fornecedores.view"
  | "nf.fornecedores.manage"
  | "nf.usuarios.view"
  | "nf.usuarios.manage"
  | "nf.notas.approve";

// Response do GET /api/v1/perms/nf/me
export interface MePermsResponse {
  app: string;            // "nf"
  role: NfRole | string | null;
  permissions: string[];  // keys liberadas pro papel atual
}

// Item do catálogo de permissões (GET /perms/nf/matrix)
export interface PermCatalogItem {
  key: string;
  label: string;
  group: string;
}

// Response do GET /api/v1/perms/nf/matrix (admin)
export interface PermsMatrixResponse {
  roles: string[];                              // papéis editáveis (sem admin)
  catalog: PermCatalogItem[];
  matrix: Record<string, Record<string, boolean>>; // role -> { key -> bool }
}

// Body do PUT /api/v1/perms/nf/matrix (admin)
export interface PermsMatrixUpdatePayload {
  matrix: Record<string, Record<string, boolean>>;
}

// Response do GET /api/v1/nf/me/role
export interface MeRoleResponse {
  role: NfRole | null;
  // Counter antigo: NFs em_analise com assignee_id = me (semantica de "responsavel").
  pending_assigned_count?: number;
  // Counter novo: NFs em_analise que AINDA precisam da MINHA aprovacao (papel).
  // Backend ainda em deploy — quando ausente, frontend faz fallback no antigo.
  pending_my_approval_count?: number;
  // Permissao de apagar NF (soft delete via DELETE /nf/invoices/{id}).
  // Ausente = false (backend pode nao ter subido ainda) -> acao some da UI.
  can_delete_invoices?: boolean;
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
  // Totais por moeda (backend ainda em deploy — opcionais por enquanto).
  // Campos legados acima (to_pay.total_amount etc) passam a representar so BRL.
  pending_review_brl?: number;
  pending_review_usd?: number;
  to_pay_brl?: number;
  to_pay_usd?: number;
  overdue_brl?: number;
  overdue_usd?: number;
  paid_last_30d_brl?: number;
  paid_last_30d_usd?: number;
}

// Itens compactos retornados pelas listas do hovercard de chips
export interface DashboardChipItem {
  invoice_id: string;
  invoice_number?: string;
  fornecedor?: string | null;
  valor?: number | null;
  moeda?: Moeda | string | null;   // BRL default quando ausente
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
  | "notes_update"
  | "invoice_edited";

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
  // Backend retorna actor_name no top-level (string). Frontend prefere isso;
  // o shape aninhado `actor.name` fica como fallback (legado).
  actor_id?: string | null;
  actor_name?: string | null;
  created_at: string;
}

export interface NfUser {
  id: string;
  name: string;
  email: string;
  nf_role: NfRole | null;
}

// Cliente (entidade cadastral pura — sem login). Backend: /api/v1/clients.
// Shape espelha `app/models/clients.py` (snake_case).
export type ClientEntity = "BR" | "LLC";

export interface Client {
  id: string;
  name: string;
  tax_id: string | null;
  default_entity: ClientEntity;
  default_moeda: Moeda;
  contact_name: string | null;
  contact_email: string | null;
  notes: string | null;
  active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | null;
}

export interface ClientCreatePayload {
  name: string;
  tax_id?: string | null;
  default_entity?: ClientEntity;
  default_moeda?: Moeda;
  contact_name?: string | null;
  contact_email?: string | null;
  notes?: string | null;
}

export interface ClientUpdatePayload {
  name?: string;
  tax_id?: string | null;
  default_entity?: ClientEntity;
  default_moeda?: Moeda;
  contact_name?: string | null;
  contact_email?: string | null;
  notes?: string | null;
  active?: boolean;
}

// Tipo de transferencia HelmBank. Backend ainda em deploy — frontend trata
// `undefined`/`null` como "sem dados de pagamento".
export type PayWireType = "domestic" | "international";

// Dados de pagamento (HelmBank) — todos opcionais. Espelha as colunas `pay_*`
// que o backend adiciona a tabela `suppliers`. Reusado em Supplier + payloads.
export interface SupplierPayFields {
  pay_wire_type?: PayWireType | null;
  pay_account_number?: string | null;        // conta ou IBAN
  pay_creditor_country?: string | null;
  pay_creditor_city?: string | null;
  pay_creditor_address?: string | null;
  pay_creditor_phone?: string | null;
  pay_beneficiary_bank_name?: string | null;
  pay_beneficiary_bank_code?: string | null; // Creditor Agent: SWIFT (intl) ou Routing/ABA (domestic)
  pay_correspondent_bank_name?: string | null;
  pay_correspondent_bank_swift?: string | null;
  pay_instructions?: string | null;          // texto livre (email de remessa)
}

// Fornecedor (entidade cadastral pura — sem login). Backend: /api/v1/suppliers.
// Espelha o shape de `Client` (mesmas colunas) + os campos `pay_*` (HelmBank),
// usado pra vincular NF a Pagar a uma entidade fornecedora sem usuario/publisher.
export interface Supplier extends SupplierPayFields {
  id: string;
  name: string;             // nome fantasia (exibicao na lista/NF)
  legal_name?: string | null; // razao social / nome real (usado pra pagar)
  tax_id: string | null;
  default_entity: ClientEntity;
  default_moeda: Moeda;
  contact_name: string | null;
  contact_email: string | null;
  notes: string | null;
  active: boolean;
  // Modelo de fornecedor central: "publisher" e "usuario linkado" viraram
  // atributos do fornecedor. Backend ainda em deploy — opcionais por enquanto.
  is_publisher?: boolean;          // marca fornecedor que e publisher
  user_id?: string | null;         // usuario do sistema linkado a esse fornecedor
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | null;
}

export interface SupplierCreatePayload extends SupplierPayFields {
  name: string;
  legal_name?: string | null;
  tax_id?: string | null;
  default_entity?: ClientEntity;
  default_moeda?: Moeda;
  contact_name?: string | null;
  contact_email?: string | null;
  notes?: string | null;
  is_publisher?: boolean;
  user_id?: string | null;
}

export interface SupplierUpdatePayload extends SupplierPayFields {
  name?: string;
  legal_name?: string | null;
  tax_id?: string | null;
  default_entity?: ClientEntity;
  default_moeda?: Moeda;
  contact_name?: string | null;
  contact_email?: string | null;
  notes?: string | null;
  active?: boolean;
  is_publisher?: boolean;
  user_id?: string | null;
}

// NF a Receber (Receivables). Espelha `backend/app/models/nf_receivables.py`.
// Cuidado: a moeda/entidade aqui sao independentes de `Invoice` (NF a Pagar);
// reusam os mesmos tipos `Moeda` e `ClientEntity` por simplicidade.
export type NfReceivableStatus = "pendente" | "recebida" | "cancelada";

export interface NfReceivable {
  id: string;
  client_id: string;
  invoice_number: string | null;
  amount: number | string;        // backend serializa Decimal como string
  moeda: Moeda;
  caracol_entity: ClientEntity;
  issue_date: string | null;      // YYYY-MM-DD
  due_date: string;               // YYYY-MM-DD
  reference_month: string;        // YYYY-MM-01 (DATE no banco)
  has_invoice: boolean;
  pdf_path: string | null;
  status: NfReceivableStatus;
  received_at: string | null;     // ISO datetime
  received_proof_path: string | null;
  description: string | null;
  notes_internal: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | null;
  // derivados / join
  client_name?: string | null;
  is_vencida?: boolean;
  // Tag (1 por NF) + vinculo de campanhas (N, cada uma com valor alocado).
  // Backend ainda em deploy — opcionais (graceful degradation).
  tag_id?: string | null;
  tag_name?: string | null;
  campanhas?: NfCampanhaLink[];
}

export interface NfReceivableSummary {
  pending_count: number;
  pending_brl: number;
  pending_usd: number;
  overdue_count: number;
  overdue_brl: number;
  overdue_usd: number;
  received_last_30d_count: number;
  received_last_30d_brl: number;
  received_last_30d_usd: number;
  cancelled_count: number;
}

// --- Conciliacao NF a pagar vs fechamento de campanha ---

export type ConciliacaoStatusGeral = "ok" | "divergente" | "incompleto";

export type ConciliacaoCampanhaStatus =
  | "ok"
  | "divergente"
  | "sem_fechamento"
  | "publisher_nao_encontrado";

export interface ConciliacaoCampanha {
  campanha_id: string;
  codigo: string | null;
  name: string | null;
  mes_referencia: string | null;
  valor_informado: number;
  // null quando nao ha fechamento/publisher pra comparar.
  valor_esperado: number | null;
  moeda_fechamento: string | null;
  status: ConciliacaoCampanhaStatus;
  // null quando nao ha valor esperado.
  diff: number | null;
}

export interface ConciliacaoResponse {
  publisher_name: string | null;
  total_informado: number;
  total_esperado: number;
  // null quando nenhuma campanha tem fechamento (tem_esperado=false no backend).
  diff_total: number | null;
  status_geral: ConciliacaoStatusGeral;
  por_campanha: ConciliacaoCampanha[];
}

// Sugestao de vinculo vinda do fechamento de campanha.
// GET /nf/fechamento-sugestoes?supplier_id=<uuid> -> { items: [...] }.
// Lista as campanhas onde o fornecedor tem pagamento a RECEBER do fechamento
// e que ainda NAO tem NF a pagar vinculada. `valor_sugerido` e o bruto do
// fechamento. `codigo` pode nao vir (backend em paralelo) -> ler defensivo.
export interface FechamentoSugestaoItem {
  mes_referencia: string | null;
  campanha_id: string;
  campanha_name: string | null;
  codigo?: string | null;
  valor_sugerido: number;
  moeda: "BRL" | "USD";
}
