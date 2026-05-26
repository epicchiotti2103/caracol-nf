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
export default function ReceberPage() {
  redirect("/?view=receber");
}
