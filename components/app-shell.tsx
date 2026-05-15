"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { HUB_URL } from "@/lib/config";
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings
} from "lucide-react";
import { useState } from "react";

const navGroups = [
  [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Notas fiscais", href: "/notas", icon: FileText },
    { label: "Emitentes", href: "/emitentes", icon: Building2 }
  ],
  [{ label: "Configuracoes", href: "/settings", icon: Settings }]
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const userInitials = user?.name
    ? user.name.slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() || "??";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen grid-cols-[240px_minmax(0,1fr)]">
        <aside className="border-r border-border bg-black">
          <div className="flex h-12 items-center gap-2 border-b border-orange-500/25 px-4">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-primary text-xs font-semibold text-black">
              NF
            </div>
            <div>
              <div className="text-sm font-semibold leading-4 text-orange-50">Notas Fiscais</div>
              <div className="text-[11px] text-orange-200/70">controle interno</div>
            </div>
          </div>

          <div className="px-3 pt-3">
            <a
              href={HUB_URL}
              className="flex h-8 items-center gap-2 rounded px-2 text-[12px] text-orange-100/60 hover:bg-orange-500/10 hover:text-orange-50 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Voltar ao hub</span>
            </a>
          </div>

          <nav className="space-y-5 px-3 py-4">
            {navGroups.map((group, groupIndex) => (
              <div key={groupIndex} className="space-y-1">
                {group.map(({ label, href, icon: Icon }) => {
                  const active = href === "/" ? pathname === href : pathname.startsWith(href);
                  return (
                    <Link
                      href={href}
                      key={href}
                      className={`flex h-8 items-center gap-2 rounded px-2 text-[13px] transition ${
                        active
                          ? "bg-primary text-black"
                          : "text-orange-100/70 hover:bg-orange-500/10 hover:text-orange-50"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        <section className="min-w-0">
          <header className="flex h-12 items-center justify-end border-b border-border bg-background px-4">
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex h-8 items-center gap-2 rounded border border-border bg-surface px-2 text-[13px]"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                  {userInitials}
                </span>
                <span className="max-w-[80px] truncate">{user?.name || "Usuario"}</span>
                <ChevronDown className={`h-3.5 w-3.5 text-muted transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 z-20 w-48 rounded-lg border border-border bg-surface p-1 shadow-xl">
                    <div className="border-b border-border px-3 py-2 mb-1">
                      <p className="text-[12px] font-medium text-foreground truncate">{user?.name}</p>
                      <p className="text-[11px] text-muted truncate">{user?.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        logout();
                      }}
                      className="flex w-full items-center gap-2 rounded px-3 py-2 text-[12px] text-danger hover:bg-danger/10 transition"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sair
                    </button>
                  </div>
                </>
              )}
            </div>
          </header>

          <div className="mx-auto max-w-[1500px] space-y-6 px-6 py-5">{children}</div>
        </section>
      </div>
    </main>
  );
}
