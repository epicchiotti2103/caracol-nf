"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Popover ancorada simples (hover no desktop, clique no mobile).
 *
 * Substitui Radix HoverCard pra evitar adicionar dep nova ao bundle.
 * Comportamento:
 *  - Hover (mouseenter/leave) com pequeno delay pra evitar flicker
 *  - Em touch / click tambem alterna (mobile fallback)
 *  - Fecha quando clica fora ou pressiona Esc
 */
export function HoverPopover({
  trigger,
  children,
  align = "start",
  width = 360,
  className = ""
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "center" | "end";
  width?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = (delay = 120) => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), delay);
  };

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => () => cancelClose(), []);

  const alignClass =
    align === "end"
      ? "right-0"
      : align === "center"
      ? "left-1/2 -translate-x-1/2"
      : "left-0";

  return (
    <div
      ref={rootRef}
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={() => scheduleClose()}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center"
      >
        {trigger}
      </button>
      {open && (
        <div
          role="dialog"
          style={{ width }}
          className={`absolute top-full z-50 mt-2 max-h-[360px] overflow-y-auto rounded-xl border border-border bg-surface p-2 shadow-2xl ${alignClass}`}
          onMouseEnter={cancelClose}
          onMouseLeave={() => scheduleClose()}
        >
          {children}
        </div>
      )}
    </div>
  );
}
