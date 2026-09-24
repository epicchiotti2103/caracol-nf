import { redirect } from "next/navigation";

/**
 * `/receber` redireciona para `/?view=receber` (mesma pagina com tab toggle).
 *
 * Decisao: evita duplicacao de conteudo entre dashboard e tela dedicada;
 * todo o estado de view (chips/lista/filtros) vive em um unico lugar.
 * Mantemos esta rota pra:
 *  - link direto / bookmark
 *  - eventual atalho no header
 */
export default function ReceberPage({
  searchParams
}: {
  searchParams?: { id?: string | string[] };
}) {
  // `?id=<uuid>` e repassado: a lista rola ate a NF e destaca a linha.
  const raw = searchParams?.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  redirect(id ? `/?view=receber&id=${encodeURIComponent(id)}` : "/?view=receber");
}
