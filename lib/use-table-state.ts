"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export type TableState = {
  q: string;
  page: number;
  pageSize: number;
  sortBy: string;
  sortDir: "asc" | "desc";
  filters: Record<string, string>;
};

export type UseTableStateOptions = {
  defaultSortBy?: string;
  defaultSortDir?: "asc" | "desc";
  defaultPageSize?: number;
  filterKeys?: string[];
};

export function useTableState(opts: UseTableStateOptions = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filterKeys = opts.filterKeys || [];

  const state: TableState = React.useMemo(() => {
    const filters: Record<string, string> = {};
    for (const k of filterKeys) {
      const v = searchParams.get(k);
      if (v) filters[k] = v;
    }
    return {
      q: searchParams.get("q") || "",
      page: Math.max(1, parseInt(searchParams.get("page") || "1", 10)),
      pageSize: parseInt(searchParams.get("page_size") || String(opts.defaultPageSize || 50), 10),
      sortBy: searchParams.get("sort_by") || opts.defaultSortBy || "created_at",
      sortDir: ((searchParams.get("sort_dir") as "asc" | "desc") || opts.defaultSortDir || "desc") as
        | "asc"
        | "desc",
      filters
    };
  }, [searchParams, filterKeys.join("|"), opts.defaultSortBy, opts.defaultSortDir, opts.defaultPageSize]);

  const update = React.useCallback(
    (patch: Partial<{ q: string; page: number; pageSize: number; sortBy: string; sortDir: "asc" | "desc"; filters: Record<string, string> }>) => {
      const next = new URLSearchParams(searchParams.toString());

      const setOrDelete = (key: string, value: string | undefined | null) => {
        if (value === undefined || value === null || value === "") next.delete(key);
        else next.set(key, String(value));
      };

      if (patch.q !== undefined) {
        setOrDelete("q", patch.q);
        next.delete("page");
      }
      if (patch.page !== undefined)
        setOrDelete("page", patch.page > 1 ? String(patch.page) : undefined);
      if (patch.pageSize !== undefined) {
        setOrDelete("page_size", String(patch.pageSize));
        next.delete("page");
      }
      if (patch.sortBy !== undefined) setOrDelete("sort_by", patch.sortBy);
      if (patch.sortDir !== undefined) setOrDelete("sort_dir", patch.sortDir);
      if (patch.filters) {
        for (const [k, v] of Object.entries(patch.filters)) {
          setOrDelete(k, v);
        }
        next.delete("page");
      }

      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const toggleSort = React.useCallback(
    (column: string) => {
      if (state.sortBy === column) {
        update({ sortBy: column, sortDir: state.sortDir === "asc" ? "desc" : "asc" });
      } else {
        update({ sortBy: column, sortDir: "desc" });
      }
    },
    [state.sortBy, state.sortDir, update]
  );

  return { state, update, toggleSort };
}
