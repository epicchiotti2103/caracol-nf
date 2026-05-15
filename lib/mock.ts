import type { Invoice, Supplier } from "@/types";

export const MOCK_SUPPLIERS: Supplier[] = [
  {
    id: "sup-1",
    razao_social: "Tech Solutions LTDA",
    cnpj: "12.345.678/0001-90",
    email: "financeiro@techsolutions.com.br",
    created_at: "2026-01-15T10:00:00Z"
  },
  {
    id: "sup-2",
    razao_social: "Marketing Digital BR ME",
    cnpj: "98.765.432/0001-12",
    email: "contato@mkdigital.com.br",
    created_at: "2026-02-20T14:30:00Z"
  },
  {
    id: "sup-3",
    razao_social: "Servicos Contabeis Silva",
    cnpj: "11.222.333/0001-44",
    email: "silva@servicoscontabeis.com.br",
    created_at: "2026-03-10T09:15:00Z"
  },
  {
    id: "sup-4",
    razao_social: "Estudio Criativo Caracol",
    cnpj: "55.666.777/0001-88",
    email: "estudio@criativocaracol.com.br",
    created_at: "2026-04-05T16:45:00Z"
  }
];

// Quando fornecedor esta logado, ele "vira" sup-1 nas telas (mock)
export const MOCK_CURRENT_SUPPLIER_ID = "sup-1";

export const MOCK_INVOICES: Invoice[] = [
  {
    id: "inv-1",
    supplier_id: "sup-1",
    numero_nota: "NF-000142",
    valor_bruto: 12500.0,
    valor_liquido: 11250.0,
    data_vencimento: "2026-06-15",
    descricao: "Consultoria em desenvolvimento de software — Abril/2026",
    status: "paga",
    arquivo_url: "https://example.com/nf-142.pdf",
    created_at: "2026-04-30T18:00:00Z"
  },
  {
    id: "inv-2",
    supplier_id: "sup-1",
    numero_nota: "NF-000145",
    valor_bruto: 8400.0,
    valor_liquido: 7560.0,
    data_vencimento: "2026-06-30",
    descricao: "Manutencao de infraestrutura cloud — Maio/2026",
    status: "aprovada",
    created_at: "2026-05-10T11:20:00Z"
  },
  {
    id: "inv-3",
    supplier_id: "sup-1",
    numero_nota: "NF-000150",
    valor_bruto: 15200.0,
    valor_liquido: 13680.0,
    data_vencimento: "2026-07-15",
    descricao: "Desenvolvimento do modulo de relatorios",
    status: "em_analise",
    created_at: "2026-05-12T09:00:00Z"
  },
  {
    id: "inv-4",
    supplier_id: "sup-1",
    numero_nota: "NF-000151",
    valor_bruto: 3200.0,
    valor_liquido: 2880.0,
    data_vencimento: "2026-07-20",
    descricao: "Reuniao tecnica e levantamento de requisitos",
    status: "pendente",
    created_at: "2026-05-14T15:30:00Z"
  },
  {
    id: "inv-5",
    supplier_id: "sup-2",
    numero_nota: "MK-2026-031",
    valor_bruto: 4800.0,
    valor_liquido: 4320.0,
    data_vencimento: "2026-06-10",
    descricao: "Campanha de midia paga — Maio/2026",
    status: "paga",
    created_at: "2026-04-28T10:45:00Z"
  },
  {
    id: "inv-6",
    supplier_id: "sup-2",
    numero_nota: "MK-2026-035",
    valor_bruto: 5200.0,
    valor_liquido: 4680.0,
    data_vencimento: "2026-06-25",
    descricao: "Producao de conteudo para redes sociais",
    status: "rejeitada",
    observacao: "CNPJ informado nao confere com o do contrato. Por favor, reenvie a nota corrigida.",
    created_at: "2026-05-08T13:10:00Z"
  },
  {
    id: "inv-7",
    supplier_id: "sup-3",
    numero_nota: "SC-001-2026",
    valor_bruto: 1800.0,
    valor_liquido: 1620.0,
    data_vencimento: "2026-06-05",
    descricao: "Honorarios contabeis — competencia Abril/2026",
    status: "paga",
    created_at: "2026-05-01T08:30:00Z"
  },
  {
    id: "inv-8",
    supplier_id: "sup-3",
    numero_nota: "SC-002-2026",
    valor_bruto: 1800.0,
    valor_liquido: 1620.0,
    data_vencimento: "2026-07-05",
    descricao: "Honorarios contabeis — competencia Maio/2026",
    status: "aprovada",
    created_at: "2026-05-15T08:00:00Z"
  },
  {
    id: "inv-9",
    supplier_id: "sup-4",
    numero_nota: "EC-2026-007",
    valor_bruto: 9500.0,
    valor_liquido: 8550.0,
    data_vencimento: "2026-06-30",
    descricao: "Identidade visual e materiais graficos — projeto rebranding",
    status: "pendente",
    created_at: "2026-05-14T16:50:00Z"
  }
];

export function findSupplier(id: string): Supplier | undefined {
  return MOCK_SUPPLIERS.find((s) => s.id === id);
}

export function getInvoicesForSupplier(supplierId: string): Invoice[] {
  return MOCK_INVOICES.filter((i) => i.supplier_id === supplierId);
}

export function getAllInvoicesWithSupplier(): Invoice[] {
  return MOCK_INVOICES.map((i) => ({ ...i, supplier: findSupplier(i.supplier_id) }));
}
