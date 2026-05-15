import { Plus } from "lucide-react";
import Link from "next/link";

export function PageHeader({
  title,
  description,
  actionHref,
  actionLabel
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
        <p className="mt-1 text-[13px] text-muted">{description}</p>
      </div>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="flex h-8 items-center gap-2 rounded bg-primary px-3 text-[13px] font-medium text-black"
        >
          <Plus className="h-4 w-4" />
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function Panel({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded border border-border bg-surface shadow-subtle">
      <div className="border-b border-border p-4">
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? <p className="text-[12px] text-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded border border-dashed border-border bg-surface py-12 text-center">
      <p className="text-[15px] font-medium">{title}</p>
      <p className="mt-1 max-w-md text-[13px] text-muted">{description}</p>
    </div>
  );
}
