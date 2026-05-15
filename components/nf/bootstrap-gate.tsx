"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { HUB_URL } from "@/lib/config";

type HubApp = {
  id: string;
  slug: string;
  name: string;
  active?: boolean;
  url?: string | null;
  icon?: string | null;
};

type GateState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ok" }
  | { status: "no-app" }
  | { status: "invalid-role" }
  | { status: "error"; message: string };

const VALID_ROLES = new Set(["admin", "user", "viewer", "client"]);

let appsCache: { userId: string; apps: HubApp[] } | null = null;

export function clearBootstrapGateCache() {
  appsCache = null;
}

export function BootstrapGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const [state, setState] = useState<GateState>({ status: "idle" });

  const skipGate = pathname === "/login";

  useEffect(() => {
    if (skipGate) {
      setState({ status: "ok" });
      return;
    }
    if (loading) {
      setState({ status: "checking" });
      return;
    }
    if (!user) {
      appsCache = null;
      setState({ status: "ok" });
      return;
    }

    if (!user.role || !VALID_ROLES.has(user.role)) {
      setState({ status: "invalid-role" });
      return;
    }

    if (appsCache && appsCache.userId === user.id) {
      const has = appsCache.apps.some((a) => a.slug === "nf");
      setState({ status: has ? "ok" : "no-app" });
      return;
    }

    let cancelled = false;
    setState({ status: "checking" });
    (async () => {
      try {
        const res: HubApp[] = await apiFetch("/hub/me/apps");
        if (cancelled) return;
        const apps = Array.isArray(res) ? res : [];
        appsCache = { userId: user.id, apps };
        const has = apps.some((a) => a.slug === "nf");
        setState({ status: has ? "ok" : "no-app" });
      } catch (err: any) {
        if (cancelled) return;
        setState({ status: "error", message: err?.message || "Falha ao validar acesso" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading, skipGate]);

  useEffect(() => {
    if (state.status === "no-app" && typeof window !== "undefined") {
      const target = `${HUB_URL}?reason=no_access_nf`;
      const t = setTimeout(() => {
        window.location.href = target;
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [state.status]);

  if (skipGate) return <>{children}</>;

  if (state.status === "checking" || state.status === "idle") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (state.status === "no-app") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-foreground">
        <div className="max-w-md space-y-3">
          <h1 className="text-lg font-semibold">Sem acesso ao NF</h1>
          <p className="text-sm text-muted">
            Voce nao tem acesso ao Caracol NF. Voltando pro Hub.
          </p>
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (state.status === "invalid-role") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-foreground">
        <div className="max-w-md space-y-3">
          <h1 className="text-lg font-semibold">Perfil nao configurado</h1>
          <p className="text-sm text-muted">
            Seu perfil ainda nao foi configurado. Fale com um admin.
          </p>
          <button
            onClick={() => logout()}
            className="mt-2 inline-flex h-9 items-center rounded border border-border bg-surface px-3 text-[13px] hover:bg-background"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-foreground">
        <div className="max-w-md space-y-3">
          <h1 className="text-lg font-semibold">Erro ao validar acesso</h1>
          <p className="text-sm text-muted">{state.message}</p>
          <button
            onClick={() => {
              appsCache = null;
              setState({ status: "idle" });
            }}
            className="mt-2 inline-flex h-9 items-center rounded border border-border bg-surface px-3 text-[13px] hover:bg-background"
          >
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
