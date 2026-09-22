"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Link2 } from "lucide-react";
import { fetchLinkSuggestions, previousMonth } from "@/lib/link-suggestions";
import { fmtRefMonth } from "@/lib/i18n";

/**
 * Aviso na lista de NF a pagar: "X NFs com sugestao de vinculo" (mes anterior).
 * Silencioso: sem sugestoes, rota inexistente (404) ou erro -> nao renderiza.
 */
export function LinkSuggestionsBanner() {
  const [count, setCount] = useState(0);
  const month = previousMonth();

  useEffect(() => {
    let cancelled = false;
    fetchLinkSuggestions(month)
      .then((res) => {
        if (!cancelled && res.status === "ok") setCount(res.data.suggestions.length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [month]);

  if (count <= 0) return null;

  return (
    <Link
      href={`/sugestoes-vinculo?month=${month}`}
      className="group mb-6 flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-5 py-4 text-left transition-colors hover:bg-primary/15"
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/20">
        <Link2 className="h-5 w-5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">
          <span className="font-semibold text-primary">
            {count} {count === 1 ? "NF" : "NFs"}
          </span>{" "}
          com sugestao de vinculo com campanha ({fmtRefMonth(month, "pt")})
        </p>
        <p className="mt-0.5 text-xs text-muted">Clique pra revisar e vincular</p>
      </div>
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted transition-colors group-hover:text-foreground" />
    </Link>
  );
}
