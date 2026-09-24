import { apiFetchStrict, ApiHttpError } from "@/lib/api-error";
import type { Invoice } from "@/types";

// Pede paginas grandes; se o backend ainda tiver teto menor (le=200 -> 422),
// cai pro teto conhecido. A paginacao por `page` garante o conjunto completo
// com qualquer teto.
const PAGE_SIZES = [1000, 200];
const MAX_PAGES = 100; // trava de seguranca contra loop

type Page = { items: Invoice[]; total?: number } | Invoice[];

/**
 * Carrega TODAS as NFs de GET /nf/invoices para a query dada, paginando por
 * `page` ate `items.length >= total` (ou pagina vazia).
 * `query` e a querystring de filtros SEM `page`/`limit`.
 */
export async function fetchAllInvoices(query = ""): Promise<Invoice[]> {
  const base = query ? `/nf/invoices?${query}&` : "/nf/invoices?";

  let limit = PAGE_SIZES[0];
  let first: Page | null = null;
  for (const size of PAGE_SIZES) {
    try {
      first = await apiFetchStrict(`${base}page=1&limit=${size}`);
      limit = size;
      break;
    } catch (err) {
      const isLimit422 = err instanceof ApiHttpError && err.status === 422;
      if (!isLimit422 || size === PAGE_SIZES[PAGE_SIZES.length - 1]) throw err;
    }
  }

  if (!first) return [];
  if (Array.isArray(first)) return first;

  const all: Invoice[] = [...(first.items || [])];
  const total = typeof first.total === "number" ? first.total : all.length;

  for (let page = 2; all.length < total && page <= MAX_PAGES; page++) {
    const res: Page = await apiFetchStrict(`${base}page=${page}&limit=${limit}`);
    const items = Array.isArray(res) ? res : res?.items || [];
    if (items.length === 0) break;
    all.push(...items);
  }

  // Dedup por id (defesa contra insercao concorrente deslocando paginas)
  const seen = new Set<string>();
  return all.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
}
