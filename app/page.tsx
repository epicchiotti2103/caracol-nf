import { AppShell } from "@/components/app-shell";
import { PageHeader, Panel, EmptyState } from "@/components/ui";

export default function NfDashboard() {
  return (
    <AppShell>
      <PageHeader
        title="Dashboard"
        description="Visao geral das notas fiscais da empresa."
      />

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "NFs emitidas (mes)", value: "—" },
          { label: "A vencer", value: "—" },
          { label: "Atrasadas", value: "—" },
          { label: "Total em aberto", value: "R$ —" }
        ].map((card) => (
          <div key={card.label} className="rounded border border-border bg-surface p-4">
            <div className="text-[12px] text-muted">{card.label}</div>
            <div className="mt-2 text-xl font-semibold">{card.value}</div>
          </div>
        ))}
      </div>

      <Panel title="Atividade recente" description="Ultimas NFs e movimentacoes">
        <div className="p-4">
          <EmptyState
            title="Sem dados ainda"
            description="O backend de NF ainda nao foi conectado. Quando estiver pronto, aqui aparece a lista das ultimas notas."
          />
        </div>
      </Panel>
    </AppShell>
  );
}
