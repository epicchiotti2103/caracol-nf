export type InvoiceStatus = "pendente" | "em_analise" | "aprovada" | "paga" | "rejeitada";

export interface Supplier {
  id: string;
  razao_social: string;
  cnpj: string;
  email: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  supplier_id: string;
  numero_nota: string;
  valor_bruto: number;
  valor_liquido: number;
  data_vencimento: string;
  descricao: string;
  status: InvoiceStatus;
  arquivo_url?: string;
  observacao?: string;
  created_at: string;
  // Quando admin lista, vem junto com dados do fornecedor (join)
  supplier?: Supplier;
}

export interface InvoiceFormData {
  numero_nota: string;
  valor_bruto: string;
  valor_liquido: string;
  data_vencimento: string;
  descricao: string;
  arquivo?: FileList;
}

export interface SupplierFormData {
  razao_social: string;
  cnpj: string;
  email: string;
  password: string;
}
