"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { HUB_URL } from "@/lib/config";
import { NfRoleProvider } from "@/lib/nf-role-context";
import type { MeRoleResponse, NfRole } from "@/types";

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
  | { status: "ok"; role: NfRole; pendingAssignedCount: number }
  | { status: "no-app" }
  | { status: "no-role" }
  | { status: "invalid-role" }
  | { status: "error"; message: string };

const VALID_HUB_ROLES = new Set(["admin", "user", "viewer", "client"]);

// Cache em memoria por sessao. Limpo no logout (quando user vira null).
let appsCache: { userId: string; apps: HubApp[] } | null = null;
let roleCache: {
  userId: string;
  role: NfRole | null;
  pendingAssignedCount: number;
} | null = null;

export function clearBootstrapGateCache() {
  appsCache = null;
  roleCache = null;
}

export function BootstrapGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const [state, setState] = useState<GateState>({ status: "idle" });

  const skipGate = pathname === "/login";

  useEffect(() => {
    if (skipGate) {
      setState({ status: "idle" }); // sera tratado no render
      return;
    }
    if (loading) {
      setState({ status: "checking" });
      return;
    }
    if (!user) {
      appsCache = null;
      roleCache = null;
      setState({ status: "idle" });
      return;
    }

    if (!user.role || !VALID_HUB_ROLES.has(user.role)) {
      setState({ status: "invalid-role" });
      return;
    }

    // Hit no cache: tem app + tem role -> ok direto
    if (
      appsCache &&
      appsCache.userId === user.id &&
      roleCache &&
      roleCache.userId === user.id
    ) {
      const has = appsCache.apps.some((a) => a.slug === "nf");
      if (!has) {
        setState({ status: "no-app" });
        return;
      }
      if (!roleCache.role) {
        setState({ status: "no-role" });
        return;
      }
      setState({
        status: "ok",
        role: roleCache.role,
        pendingAssignedCount: roleCache.pendingAssignedCount
      });
      return;
    }

    let cancelled = false;
    setState({ status: "checking" });
    (async () => {
      try {
        // Step 1: apps do hub
        let apps: HubApp[];
        if (appsCache && appsCache.userId === user.id) {
          apps = appsCache.apps;
        } else {
          const res: HubApp[] = await apiFetch("/hub/me/apps");
          apps = Array.isArray(res) ? res : [];
          appsCache = { userId: user.id, apps };
        }
        if (cancelled) return;

        const hasApp = apps.some((a) => a.slug === "nf");
        if (!hasApp) {
          setState({ status: "no-app" });
          return;
        }

        // Step 2: papel intra-NF + contagem de NFs aguardando MINHA aprovacao
        // Bug 3: trocamos a fonte do banner pra `pending_my_approval_count`
        // (semantica "NFs em_analise onde meu papel ainda precisa aprovar").
        // Fallback no antigo `pending_assigned_count` enquanto o backend nao
        // deployar o novo campo.
        let role: NfRole | null;
        let pendingAssignedCount = 0;
        if (roleCache && roleCache.userId === user.id) {
          role = roleCache.role;
          pendingAssignedCount = roleCache.pendingAssignedCount;
        } else {
          const res: MeRoleResponse = await apiFetch("/nf/me/role");
          role = res?.role ?? null;
          const pendingMy =
            res?.pending_my_approval_count != null
              ? Number(res.pending_my_approval_count)
              : Number(res?.pending_assigned_count) || 0;
          pendingAssignedCount = Math.max(0, pendingMy || 0);
          roleCache = { userId: user.id, role, pendingAssignedCount };
        }
        if (cancelled) return;

        if (!role) {
          setState({ status: "no-role" });
          return;
        }
        setState({ status: "ok", role, pendingAssignedCount });
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

  if (state.status === "no-role") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-foreground">
        <div className="max-w-md space-y-3">
          <h1 className="text-lg font-semibold">Perfil do NF nao configurado</h1>
          <p className="text-sm text-muted">
            Seu perfil no NF nao foi configurado. Fale com um admin do NF.
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
              roleCache = null;
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

  return (
    <NfRoleProvider role={state.role} pendingAssignedCount={state.pendingAssignedCount}>
      {children}
    </NfRoleProvider>
  );
}
