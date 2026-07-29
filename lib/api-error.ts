import Cookies from "js-cookie";
import { API_BASE_URL } from "@/lib/config";
import { apiFetch } from "@/lib/api";

/**
 * Fetch com erro ESTRUTURADO preservado.
 *
 * O `apiFetch` de `lib/api.ts` (arquivo replicado nos 5 apps da suite — NAO
 * mexer aqui) faz `new Error(errorData.detail)`. Quando o backend devolve
 * `detail` como OBJETO (os 409 de duplicidade do NF), a mensagem vira
 * "[object Object]" e o payload se perde.
 *
 * Este helper e local do caracol-nf e existe so pros fluxos que precisam ler o
 * `detail` estruturado (cadastro de NF e pagamento). Tudo mais continua usando
 * o `apiFetch` normal.
 *
 * 401: delega pro `apiFetch` (que faz refresh + redirect pro /login). Nesse
 * caminho o erro volta a perder estrutura — por isso todo consumidor tem que
 * manter o fallback de mensagem legivel.
 */
export class ApiHttpError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown, message: string) {
    super(message);
    this.name = "ApiHttpError";
    this.status = status;
    this.detail = detail;
  }
}

export async function apiFetchStrict(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const token = Cookies.get("auth_token");

  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });

  // Sessao expirada: delega pro apiFetch, que sabe dar refresh no token e
  // redirecionar pro login. (O body FormData e reutilizavel — o proprio
  // apiFetch ja reenvia o mesmo `options.body` no retry pos-refresh.)
  if (response.status === 401) {
    return apiFetch(endpoint, options);
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({} as any));
    const detail = (data as any)?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : typeof (data as any)?.message === "string"
          ? (data as any).message
          : "Request failed";
    throw new ApiHttpError(response.status, detail, message);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// ── Detalhes estruturados conhecidos (contrato fechado com o backend) ───────

export type DuplicateCode =
  | "duplicate_number"
  | "duplicate_warning"
  | "duplicate_payment_warning";

const KNOWN_CODES: DuplicateCode[] = [
  "duplicate_number",
  "duplicate_warning",
  "duplicate_payment_warning"
];

export interface DuplicateDetail {
  code: DuplicateCode;
  invoice_id?: string | null;
  invoice_number?: string | null;
  pdf_conflict?: any | null;
  overlaps?: any[] | null;
  [k: string]: any;
}

/**
 * Extrai o `detail` estruturado de duplicidade de um erro.
 *
 * So devolve nao-null quando o detail e um OBJETO simples com `code` dentre os
 * tres codigos do contrato. `detail` string (backend antigo), array (422 do
 * FastAPI) ou com codigo desconhecido caem fora — assim um 409 que a gente nao
 * conhece nunca ganha botao de "fazer mesmo assim".
 */
export function duplicateDetail(err: unknown): DuplicateDetail | null {
  const detail = (err as ApiHttpError | undefined)?.detail;
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return null;
  const code = (detail as any).code;
  if (typeof code !== "string") return null;
  if (!KNOWN_CODES.includes(code as DuplicateCode)) return null;
  return detail as DuplicateDetail;
}

/**
 * Mensagem legivel a partir de um erro qualquer — nunca devolve
 * "[object Object]". Usa `fallback` quando nao ha nada aproveitavel.
 */
export function readableError(err: unknown, fallback: string): string {
  const raw = typeof (err as any)?.message === "string" ? (err as any).message : "";
  if (raw && !raw.includes("[object Object]") && raw !== "Request failed") return raw;
  const detail = (err as ApiHttpError | undefined)?.detail;
  if (typeof detail === "string" && detail) return detail;
  if (Array.isArray(detail)) {
    const first = detail.find((d: any) => typeof d?.msg === "string");
    if (first) return String(first.msg);
  }
  return fallback;
}
