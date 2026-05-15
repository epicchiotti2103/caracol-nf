"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { HUB_URL } from "@/lib/config";
import { FileText, Plus, LogOut, User, ArrowLeft } from "lucide-react";

const links = [
  { href: "/dashboard", label: "Minhas notas", icon: FileText },
  { href: "/nova-nota", label: "Nova nota", icon: Plus }
];

export function SupplierNavbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-black border-b border-orange-500/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-black">
                NF
              </div>
              <span className="hidden text-sm font-semibold tracking-wide text-orange-50 sm:block">
                Notas Fiscais
              </span>
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              {links.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? "text-primary"
                        : "text-orange-100/60 hover:bg-white/5 hover:text-orange-50"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={HUB_URL}
              className="hidden items-center gap-1 rounded-md px-2 py-1.5 text-xs text-orange-100/40 hover:text-orange-50 sm:flex"
              title="Voltar ao hub"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Hub
            </a>

            <Link
              href="/nova-nota"
              className="hidden items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-black sm:flex"
            >
              <Plus className="h-4 w-4" />
              Nova nota
            </Link>

            <div className="flex items-center gap-2 border-l border-white/10 pl-3">
              <div className="hidden text-right sm:block">
                <p className="max-w-[140px] truncate text-xs font-medium leading-tight text-orange-50">
                  {user?.name || "Fornecedor"}
                </p>
                <p className="text-[11px] leading-tight text-orange-100/40">{user?.email}</p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/10">
                <User className="h-4 w-4 text-orange-100/60" />
              </div>
              <button
                onClick={logout}
                title="Sair"
                className="rounded-md p-1.5 text-orange-100/60 transition-colors hover:bg-white/5 hover:text-orange-50"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 pb-2 md:hidden">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  active ? "text-primary" : "text-orange-100/60"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
