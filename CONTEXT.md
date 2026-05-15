# Caracol NF — contexto detalhado

> Doc de arquitetura e decisoes. Resumo executivo em `README.md`.

## O que e

Sistema interno de controle de notas fiscais da Caracol.

**Estado: esqueleto inicial.** UI montada, autenticacao funcionando, mas **backend ainda nao existe** — nao tem schema no Supabase, nao tem rotas de API, nao tem persistencia. Telas de listagem mostram EmptyState.

## URLs e infra

| | |
|---|---|
| Repo | https://github.com/epicchiotti2103/caracol-nf (privado) |
| Producao | https://nf.aeobr.com.br |
| Vercel project | caracol-nf |
| DNS | Cloudflare, modo **DNS only (nuvem cinza)**, CNAME `nf` → `cname.vercel-dns.com` |
| HTTPS | Let's Encrypt via Vercel automatico |

## Por que existe

A Caracol precisa controlar as NFs da empresa: acompanhar vencimentos, organizar emitentes, manter historico, eventualmente emitir. Hoje isso vive em planilha. Esse app substitui.

E o **segundo app** da suite Caracol, depois do Tracker. Entra no Hub como tile.

## Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS (mesmo tema laranja escuro do Tracker)
- js-cookie pra sessao
- lucide-react pra icones
- Auth: chama `POST /api/v1/auth/login` do backend do Tracker (Supabase Auth via FastAPI)
- Backend proprio: **ainda nao implementado**

## Telas existentes

| Rota | Status | Descricao |
|---|---|---|
| `/login` | Funcional | Login conectado ao Supabase |
| `/` | Placeholder | Dashboard com 4 KPI cards mostrando "—" |
| `/notas` | Placeholder | Lista de NFs (vazia, EmptyState) |
| `/emitentes` | Placeholder | Lista de emitentes (vazia, EmptyState) |

Sidebar tem link "Voltar ao hub" no topo.

## Estrutura de pastas

```
caracol-nf/
  app/
    globals.css            Variaveis HSL do tema
    layout.tsx             AuthProvider + ToastProvider
    page.tsx               Dashboard placeholder
    login/page.tsx         Login
    notas/page.tsx         Lista de NFs (placeholder)
    emitentes/page.tsx     Lista de emitentes (placeholder)
  components/
    app-shell.tsx          Layout com sidebar + topbar + menu de usuario
    table-controls.tsx     SortHeader, TablePagination (copiados do Tracker)
    ui.tsx                 PageHeader, Panel, EmptyState
  lib/
    api.ts                 fetch helper com Bearer token
    auth-context.tsx       Sessao + SSO
    config.ts              API_BASE_URL, HUB_URL
    toast-context.tsx      Toasts globais
    use-table-state.ts     Hook que sincroniza filtros/sort/paginacao na URL
  middleware.ts            Redireciona pra /login se nao autenticado
  package.json
  ...configs padrao Next
```

## Auth

Mesmo SSO via cookie no dominio raiz `.aeobr.com.br` (igual hub e tracker). Em producao, o login feito em qualquer app vale aqui. Em dev (`localhost`), comportamento normal sem cross-subdomain.

`lib/auth-context.tsx` e identico ao do hub e do tracker — se mudar aqui, replique nos outros dois.

**O backend que processa o login** e o do Tracker (`https://trk.aeobr.com.br/api/v1/auth/login`). Nao foi criado backend proprio do NF ainda. Quando criar, vai compartilhar o mesmo Supabase e validar o token JWT do mesmo jeito.

### Controle de admin

- `useAuth().isAdmin` deriva direto de `user.hub_role === "admin"`, vindo do backend no payload do `/auth/login`. **Nao ha mais lista hardcoded de emails** (`ADMIN_EMAILS`/`isAdminEmail` foram removidos de `lib/mock.ts`). A fonte de verdade e a tabela `users` no Supabase.
- Em client components, usar `const { isAdmin } = useAuth()`.
- Em server components / middleware, ler o cookie `user_data` e checar `hub_role === "admin"` — manter o mesmo criterio.

### Gate de acesso ao app

`components/nf/bootstrap-gate.tsx` envolve a arvore dentro do `RootLayout` (depois do `AuthProvider`/`ToastProvider`). Fluxo:

1. Espera o `AuthProvider` carregar.
2. Em `/login` ou quando nao ha `user`, libera direto.
3. Chama `GET /api/v1/hub/me/apps` via `apiFetch`.
4. Se a resposta tem app com `slug === "nf"`, renderiza filhos. Caso contrario, mostra tela "Sem acesso ao NF" e redireciona pra `${HUB_URL}?reason=no_access_nf`.
5. Resultado fica em cache na memoria por `userId`. O cache e limpo automaticamente quando `user` vira `null` (logout via `AuthProvider.logout()`).

Mesma logica do `components/tracker/bootstrap-gate.tsx`, so muda o slug e a copy. Quando a fase 2/3 do roadmap chegar (permissoes intra-app de NF), adicionar um fail-safe interno aqui — hoje so checa o acesso ao app.

## Variaveis de ambiente (Vercel)

```
NEXT_PUBLIC_API_URL=https://trk.aeobr.com.br/api/v1
NEXT_PUBLIC_HUB_URL=https://app.aeobr.com.br
```

## Estado atual

- [x] Repo criado (privado)
- [x] UI montada com sidebar customizada pra NF
- [x] Login funcional via API do Tracker
- [x] SSO entre subdominios
- [x] Deploy na Vercel
- [x] Dominio `nf.aeobr.com.br` configurado com HTTPS
- [x] CORS liberado no backend do Tracker
- [x] Gate de acesso ao app via `GET /api/v1/hub/me/apps` (slug `nf`)
- [x] `ADMIN_EMAILS` hardcoded removido — admin agora vem de `user.hub_role`
- [ ] **Modelo de dados** (quais campos da NF guardar)
- [ ] **Tabelas no Supabase** (`nf_notes`, `nf_issuers`, etc)
- [ ] **Backend FastAPI** com rotas `/api/v1/nf/*`
- [ ] Tela de cadastro manual de nota
- [ ] Tela de cadastro de emitente
- [ ] Upload de XML (parser que preenche campos automaticamente)
- [ ] Dashboard com KPIs reais
- [ ] Integracao com SEFAZ (futuro)

## Decisoes tomadas

1. **App separado** em vez de modulo dentro do Tracker — modelos sao muito diferentes (NF lida com XML/impostos/prazos; tracker com cliques/conversoes). Acoplamento atrapalha.

2. **Helpers reaproveitados do Tracker** (api.ts, auth-context.tsx, toast-context.tsx, use-table-state.ts, componentes de UI) — copiados manualmente. Quando o **terceiro app** aparecer, vale extrair pra um pacote `@caracol/ui`. Por enquanto duplicacao e mais simples que abstracao.

3. **Mesma instancia Supabase do Tracker** — mesma tabela `users`, tabelas novas com prefixo `nf_` (ex: `nf_notes`, `nf_issuers`). Permite SSO trivial e reuso de auth.

4. **Backend ainda nao iniciado** — proxima fase. **Recomendacao**: comecar dentro do mesmo repo backend do Tracker (`tracker-caracol/backend`) adicionando rotas `/api/v1/nf/*` no `main.py`. Reusa auth, db, deploy. Separa pra repo proprio so se crescer muito.

## Roadmap (ordem sugerida)

### Fase 1 — Modelo de dados (proximo passo)

Antes de qualquer codigo, alinhe com o usuario:

1. **Quais campos guardar de cada NF**? Sugestao minima:
   - `numero` (string)
   - `serie` (string)
   - `chave_acesso` (44 digitos, opcional)
   - `emitente_id` (FK)
   - `destinatario_nome` (string ou FK)
   - `valor_total` (decimal)
   - `data_emissao` (timestamp)
   - `data_vencimento` (timestamp)
   - `status` (enum: `pendente` / `paga` / `cancelada`)
   - `xml_url` (string, opcional)
   - `pdf_url` (string, opcional)
   - `observacoes` (text)
   - `created_at`, `updated_at`

2. **NFs recebidas (compras) ou tambem emitidas (vendas)?** Muda o escopo:
   - So recebidas → cadastro manual + upload de XML
   - Emitidas tambem → integracao SEFAZ + certificado digital (escopo bem maior)

3. **Onde guardar XML/PDF?** Supabase Storage (simples, ja temos a infra) ou URL externa.

4. **Existe sistema contabil em uso?** Se sim, talvez precise exportar pra ele (CSV, OFX, API).

Depois de alinhado, criar a migration SQL e aplicar no Supabase.

### Fase 2 — Backend

- [ ] Adicionar rotas em `tracker-caracol/backend/app/routes/nf.py` (criar arquivo novo)
- [ ] Modelos Pydantic em `app/models/nf.py`
- [ ] CRUD basico: `GET/POST/PATCH/DELETE /api/v1/nf/notes` e `/api/v1/nf/issuers`
- [ ] Endpoint de upload de XML que parseia e cria a NF
- [ ] Registrar o router no `main.py`

### Fase 3 — Frontend funcional

- [ ] Tela de listagem `/notas` real, com filtros (status, periodo, emitente), busca, paginacao, ordenacao — reusar `useTableState`
- [ ] Tela de criacao `/notas/new` (form manual)
- [ ] Tela de upload `/notas/upload` (drag-and-drop de XML)
- [ ] Tela de detalhe `/notas/[id]` com timeline de status
- [ ] CRUD de emitentes em `/emitentes`
- [ ] Dashboard com KPIs de verdade (NFs do mes, a vencer em 7 dias, atrasadas, total em aberto)

### Fase 4 — Integracoes

- [ ] Consulta SEFAZ por chave de acesso (validar autenticidade da NF)
- [ ] Emissao de NFe (se for o caso — exige certificado digital A1 ou A3)
- [ ] Notificacoes por email/WhatsApp pra NFs prestes a vencer
- [ ] Export CSV/XLSX pra contador

## Como editar

- **Codespaces** (recomendado): no repo, "Code → Codespaces → Create on main". Roda `npm install && npm run dev`.
- **github.dev**: aperta `.` no repo.
- Local: `git clone`, `npm install`, `npm run dev`.

Cada push em `main` re-deploya na Vercel automaticamente.

## Para retomar o trabalho

Se voce e uma IA chegando aqui sem contexto:

1. **Leia este doc inteiro** antes de propor mudancas.
2. **Estado: esqueleto.** A proxima decisao grande e o **modelo de dados** das NFs (Fase 1). Sem alinhar isso com o usuario, qualquer codigo nas telas `/notas` e `/emitentes` vai precisar ser jogado fora.
3. **Auth e cookie compartilhado**: qualquer mudanca em `lib/auth-context.tsx` precisa ser replicada em `caracol-hub` e `tracker-caracol`. Se desalinhar, SSO quebra.
4. **Recomenda-se reusar o backend do Tracker** (`/Users/elio/Projects/tracker-caracol/backend`) em vez de criar um novo — adicionar rotas `/api/v1/nf/*` la. So separar se o NF crescer muito.
5. Cuidado com Cloudflare: subdominio `nf.aeobr.com.br` esta em **DNS only (cinza)**. Nao ligar proxy.
6. Estes helpers ja existem e foram copiados do Tracker — **nao reinvente**:
   - `useTableState` pra estado de tabela na URL
   - `apiFetch` pra fetch com Bearer
   - `useToast` pra notificacoes
   - `AppShell`, `PageHeader`, `Panel`, `EmptyState`, `SortHeader`, `TablePagination`
