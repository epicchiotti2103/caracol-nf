# Caracol NF — contexto detalhado

> Doc de arquitetura e decisoes. Resumo executivo em `README.md`.

## O que e

Sistema interno de controle de notas fiscais da Caracol. **Estado: funcional fase 1** — CRUD de invoices (envio com PDF, listagem, detalhe), papeis intra-NF, dashboard de admin, workflow de status com auditoria.

## URLs e infra

| | |
|---|---|
| Repo | https://github.com/epicchiotti2103/caracol-nf (privado) |
| Producao | https://nf.aeobr.com.br |
| Vercel project | caracol-nf |
| DNS | Cloudflare, modo **DNS only (nuvem cinza)**, CNAME `nf` → `cname.vercel-dns.com` |
| HTTPS | Let's Encrypt via Vercel automatico |

## Por que existe

Substitui a planilha que controla as NFs que publishers/parceiros emitem pra Caracol: acompanhar valor, vencimento, mes de referencia, campanha vinculada, status (em analise → aprovada → paga, ou recusada). Quem aprova/paga fica auditado.

E o **segundo app** da suite Caracol, depois do Tracker. Entra no Hub como tile.

## Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS (mesmo tema laranja escuro do Tracker)
- js-cookie pra sessao
- lucide-react pra icones
- Auth: chama `POST /api/v1/auth/login` do backend do Tracker (Supabase Auth via FastAPI)
- Backend NF: vive em `tracker-caracol/backend/app/routes/nf.py` sob `/api/v1/nf/*` (decisao: backend unico)

## Estrutura de pastas

```
caracol-nf/
  app/
    globals.css                  Variaveis HSL do tema
    layout.tsx                   AuthProvider + ToastProvider + BootstrapGate
    page.tsx                     Lista de invoices (renderiza conforme papel)
    login/page.tsx               Login
    invoice/
      new/page.tsx               Form de cadastro (bilingual + upload PDF)
      [id]/page.tsx              Detalhe + acoes (aprovar/recusar/pagar)
    admin/
      clientes/page.tsx          Cadastro de clientes (gate nf.clientes.*)
      fornecedores/page.tsx      Cadastro de fornecedores (gate nf.fornecedores.*)
      usuarios-nf/page.tsx       Atribuicao de papel por usuario (gate nf.usuarios.*) + botao "Papeis"
      papeis/page.tsx            Matriz papel x permissao (GET/PUT /perms/nf/matrix)
      tags/page.tsx              Catalogo de tags de NF (admin-only; CRUD /nf/tags)
  components/
    app-shell.tsx                Layout com navbar
    nf-navbar.tsx                Navbar unificado, adapta conforme papel
    nf/nf-tag-campanha-fields.tsx  Bloco reusado nos 3 forms: seletor de tag + vinculo de campanhas
    nf/bootstrap-gate.tsx        Valida acesso e expoe papel via context
    nf/approval-badge.tsx        Badges 'N/2 aprovacoes' e 'Vencida ha N dias'
    nf/dashboard-chips.tsx       Chips do topo do dashboard (pendentes/a pagar/vencidas) + hovercard
    nf/hover-popover.tsx         Primitivo de hover/click popover (substitui Radix HoverCard)
    nf/invoice-events.tsx        Timeline de eventos do detalhe
    status-badge.tsx             Badge bilingual de status
  lib/
    api.ts                       fetch helper com Bearer token
    auth-context.tsx             Sessao + SSO (replicado nos 3 apps)
    config.ts                    API_BASE_URL, HUB_URL
    toast-context.tsx            Toasts globais
    nf-role-context.tsx          Papel intra-NF + permissoes (useCan) + langForRole
    nf-role-cache.ts             Cache em memoria (papel + contador + permissoes)
    i18n.ts                      Strings bilingual + formatadores
  types/index.ts                 Invoice (com assignee), InvoiceStatus, NfRole, NfUser, DashboardSummary, MeRoleResponse, MePermsResponse, PermsMatrixResponse, NfPermKey
  middleware.ts                  Redireciona pra /login se nao autenticado
```

## Endpoints consumidos

Todos sob `NEXT_PUBLIC_API_URL` (`https://trk.aeobr.com.br/api/v1`):

- `POST /auth/login` — login
- `POST /auth/refresh` — refresh do token (transparente via `lib/api.ts`)
- `GET /hub/me/apps` — apps do user (gate de acesso)
- `GET /nf/me/role` — `{role, pending_assigned_count}` — papel intra-NF + qtde de NFs `em_analise` atribuidas ao user (usado pelo banner "aguardando voce")
- `GET /nf/invoices` — lista (filtrada por papel no backend). Cada item carrega campos derivados: `is_vencida`, `days_overdue`, `approvals_pending` (array de slots faltantes — `['adm_campanha']`, `['admin']`, `['adm_campanha','admin']` ou `[]`)
- `GET /nf/invoices/{id}` — detalhe (inclui campos derivados acima + auditoria de aprovacoes duplas)
- `GET /nf/invoices/{id}/pdf` — `{url}` assinada (5min)
- `GET /nf/invoices/{id}/events` — timeline de auditoria. Itens `{event_type, from_value, to_value, actor: {id, name}, created_at}`. Tipos: `status_change`, `assignee_change`, `approval_added`, `paid_by_designated`, `notes_update`
- `POST /nf/invoices` — cria (multipart, campo `pdf` opcional). NF a pagar **sempre** aponta pra um fornecedor cadastrado. Admin/adm_campanha enviam `supplier_id` (fornecedor escolhido no `<select>`). Usuario comum/linkado **nao** envia `supplier_id` — o backend amarra automaticamente no fornecedor associado ao usuario logado. `publisher_id` esta **deprecado** (frontend nao envia mais). Form envia `moeda` (`BRL` ou `USD`, default `BRL`) — backend trata `undefined` como `BRL` pra graceful degradation.
- `POST /nf/invoices/{id}/approve` — body opcional `{paid_by_assignee_id}`. Backend detecta papel do caller (adm_campanha ou admin) e popula a coluna certa. Quando ambas aprovacoes existem, status vai pra `aprovada`. Se for admin completando a dupla, ele pode designar pagador via `paid_by_assignee_id`.
- `POST /nf/invoices/{id}/reject` — body `{reason, notes_internal?}`. So funciona em `em_analise`. `reason` vai pra `notes_supplier`.
- `POST /nf/invoices/{id}/pay` — admin only. **Multipart/form-data** com campo `proof` obrigatorio (PNG, JPEG ou PDF, max 10MB). Marca como `paga` e grava `paid_proof_path` no storage.
- `GET /nf/invoices/{id}/proof` — `{url}` assinada (5min) pra baixar o comprovante de pagamento.
- `PATCH /nf/invoices/{id}/notes` — `{notes_supplier?, notes_internal?}` (admin OU adm_campanha) — edita notas sem mudar status
- `PATCH /nf/invoices/{id}/assignee` — `{assignee_id: string | null}` (admin OU adm_campanha) — grava evento na timeline
- `GET /nf/dashboard/summary` — agregacoes. Alem dos baldes legados (`pending_review`, `to_pay`, `paid_last_30d` em **BRL**), traz `pending_approvals_count`, `to_pay_count`, `overdue_count` pros chips do topo + os totais por moeda `to_pay_brl`/`to_pay_usd`, `overdue_brl`/`overdue_usd`, `paid_last_30d_brl`/`paid_last_30d_usd` (frontend trata `undefined` -> 0 enquanto backend nao deploya)
- `GET /nf/dashboard/pending-approvals` | `/to-pay` | `/overdue` — listas curtas (ate 10 itens) com `{invoice_id, invoice_number, fornecedor, valor, moeda?, aguarda?, pagador?, dias_atraso?}` pra preview do hovercard dos chips
- `GET /nf/users` — lista users com `nf_role` (admin)
- `PUT /nf/users/{user_id}/role` — `{role: NfRole | null}` (admin)
- `GET /nf/tags` — catalogo de tags. `?active=true` filtra so ativas. Retorna `{items: [{id, name, active}]}`. Leitura: admin/adm_campanha. Escrita admin-only: `POST /nf/tags {name}` (retorna a tag), `PATCH /nf/tags/{id} {name?, active?}`, `PATCH /nf/tags/{id}/toggle-active`. Consumido por `/admin/tags` (CRUD) e pelo seletor de tag dos forms (`?active=true`).
- `GET /campanhas?q=<texto>&month=<YYYY-MM>` — busca de campanhas pro seletor de vinculo (codigo `CMP-NNN` ou nome). `q` e `month` sao combinaveis; `month` filtra por mes de referencia pra encurtar a lista. Item: `{id, codigo, name, mes_referencia}`. Rota do app **Campanhas** (mesmo backend). Consumido pelo `CampanhaPicker` em `nf-tag-campanha-fields.tsx`.
- `GET /campanhas?months_available=1` — retorna `{months: ["YYYY-MM", ...]}` (desc) com os meses de referencia que tem campanha. Popula o seletor de mes de cada linha do `CampanhaPicker`; lista cacheada no nivel do bloco (`NfTagCampanhaFields`), nao rebusca por linha.
- **Campo legado removido do front**: o `campaign_name` (texto livre "Campanha") nao e mais lido nem enviado pelo frontend (forms criar/editar, detalhe da NF, listas, batch-pay). Substituido pelo bloco estruturado de campanhas vinculadas. A coluna segue no backend como **deprecated** so pra NFs historicas (o evento de historico `campaign_name` em `invoice-events.tsx` ainda e renderizado pra edicoes antigas).
- `POST /nf/conciliacao` — conciliacao da NF **a pagar** contra o fechamento de campanha. Body `{supplier_id, moeda, campanhas: [{campanha_id, valor}]}`. Retorna `{publisher_name, total_informado, total_esperado, diff_total, status_geral: "ok"|"divergente"|"incompleto", por_campanha: [{campanha_id, codigo, name, mes_referencia, valor_informado, valor_esperado, moeda_fechamento, status: "ok"|"divergente"|"sem_fechamento"|"publisher_nao_encontrado", diff}]}`. Consumido pelo `ConciliacaoPanel` (`components/nf/conciliacao-panel.tsx`) nos forms de criar (`/invoice/new`) e editar NF a pagar (`invoice-edit-modal.tsx`) — so admin/adm_campanha, debounce 500ms, dispara quando ha fornecedor + ao menos 1 campanha com valor > 0. Painel **informativo** (nunca bloqueia submit); degrada silenciosamente (some) se o endpoint falhar/404.
- **Tag + campanhas em invoice/receivable**: o `GET` de invoice e receivable agora carrega `tag_id`, `tag_name` e `campanhas: [{campanha_id, codigo, name, mes_referencia, valor_alocado}]`. O `POST` (multipart) aceita `tag_id` (Form) e `campanhas_json` (Form, string JSON `[{campanha_id, valor}]`). O `PATCH` (JSON) aceita `tag_id` e `campanhas: [{campanha_id, valor}]` (REPLACE total dos vinculos — frontend so envia quando o conjunto muda). Vinculos vivem em `nf_invoice_campanhas` / `nf_receivable_campanhas` no backend.
- `GET /perms/nf/me` — `{app:"nf", role, permissions:[keys]}` — permissoes do papel do user logado. Consumido pelo `BootstrapGate` no bootstrap; alimenta `useCan()`. Se falhar, gate usa fallback derivado do role (graceful degradation).
- `GET /perms/nf/matrix` — (admin) `{roles:[...], catalog:[{key,label,group}], matrix:{role:{key:bool}}}`. Consumido por `/admin/papeis`.
- `PUT /perms/nf/matrix` — (admin) body `{matrix:{role:{key:bool}}}`. Salva a matriz; admin nao vai no body (god-mode). Retorna a matriz canonica.
- `GET /clients` — lista clientes (entidades que recebem NF a receber). Filtros `active` (default `true`), `entity`, `q`. Retorna `{items:[...]}`. `GET /clients/{id}`, `POST /clients`, `PATCH /clients/{id}`, `PATCH /clients/{id}/toggle-active`. Consumido por `/admin/clientes`.
- `GET /suppliers` — espelha `/clients` pra fornecedores (entidades que emitem NF a pagar). Mesmos filtros e shape `{items:[...]}`. `GET /suppliers/{id}`, `POST /suppliers`, `PATCH /suppliers/{id}`, `PATCH /suppliers/{id}/toggle-active`. Consumido por `/admin/fornecedores` e pelos selects de fornecedor em `/invoice/new` e no modal de edicao. **Modelo de fornecedor central**: o supplier carrega `is_publisher` (bool — marca fornecedor publisher) e `user_id` (string|null — usuario do sistema linkado a esse fornecedor; quando o usuario logado bate, o `POST /nf/invoices` amarra a NF nesse supplier automaticamente). O modal `supplier-edit-modal.tsx` envia `is_publisher` (checkbox) e `user_id` (dropdown de `GET /nf/users`, opcao "— nenhum —") no POST/PATCH. O supplier separa **nome fantasia** (`name`, obrigatorio — exibido na lista e como `supplier_name` na lista de NFs) de **razao social** (`legal_name`, opcional — nome real usado pra pagamento; frontend faz fallback `legal_name ?? name` no bloco de pagamento do detalhe da NF). Alem das colunas cadastrais, o supplier carrega **dados bancarios opcionais (HelmBank)** com prefixo `pay_*`: `pay_wire_type` (`'domestic'|'international'`), `pay_account_number` (conta ou IBAN), `pay_beneficiary_bank_name`, `pay_beneficiary_bank_code` (Creditor Agent = SWIFT se intl, Routing/ABA se domestic), `pay_correspondent_bank_name`, `pay_correspondent_bank_swift` (banco intermediario, so intl), `pay_creditor_country/city/address/phone`, e `pay_instructions` (texto livre). Todos opcionais — frontend trata ausencia como graceful (backend pode nao ter as colunas ainda). O modal `supplier-edit-modal.tsx` envia esses campos no POST/PATCH; o detalhe da NF (`/invoice/[id]`) busca o supplier via `GET /suppliers/{id}` (so admin/adm_campanha, so se `supplier_id` presente) pra exibir bloco read-only de pagamento.

**Deprecado**: `PATCH /nf/invoices/{id}/status` foi substituido pelos endpoints `/approve`, `/reject`, `/pay`. Frontend nao chama mais.

## Papeis intra-NF

| Papel | Pode ver | Pode aprovar | Pode pagar | UI |
|---|---|---|---|---|
| `publisher` | Suas proprias NFs | — | — | Ingles |
| `adm_campanha` | Todas as NFs | Sim (`em_analise`) e recusar | — | Portugues |
| `admin` | Todas as NFs + dashboard | Sim | Sim (`aprovada` → `paga`) | Portugues |

Admin tambem pode gerir papeis em `/admin/usuarios-nf` via `PUT /nf/users/{id}/role` (passar `role: null` remove o papel).

### RBAC dinamico (permissoes por papel)

O gating de UI **nao e mais hardcoded por papel** — vem de permissoes resolvidas no bootstrap. O `BootstrapGate` chama `GET /perms/nf/me` junto com o role e injeta `permissions:[keys]` no `NfRoleProvider`. O context expoe `useCan()` -> `can(key)`; **admin = god-mode (sempre true)**.

Keys: `nf.clientes.view`, `nf.clientes.manage`, `nf.fornecedores.view`, `nf.fornecedores.manage`, `nf.usuarios.view`, `nf.usuarios.manage`, `nf.notas.approve`.

Pontos de consumo: `nf-navbar.tsx` (links Clientes/Fornecedores/Usuarios gated por `*.view`), `app/admin/clientes` e `fornecedores` (`canSee = *.view`, `canManage = *.manage`), `app/admin/usuarios-nf` (`*.view`/`*.manage`).

**Graceful degradation**: se `/perms/nf/me` falhar, `fallbackPermsForRole` (em `bootstrap-gate.tsx`) deriva permissoes do papel — admin = tudo, adm_campanha = clientes+fornecedores (view/manage) + approve, publisher = nenhuma. Evita travar a UI antes do backend de perms deployar.

A matriz papel x permissao e editada em `/admin/papeis` (`GET`/`PUT /perms/nf/matrix`). Coluna Admin e read-only.

## Workflow de status (aprovacao dupla)

```
   em_analise --(approve x2: adm_campanha + admin)--> aprovada --(pay, admin)--> paga
        |
        +--(reject + reason)-> recusada
```

Toda NF em `em_analise` precisa de DUAS aprovacoes pra virar `aprovada`: uma de `adm_campanha` e outra de `admin`. A ordem nao importa. Cada papel ve o botao "Aprovar (adm campanha)" / "Aprovar (admin)" enquanto o slot dele estiver vazio. Apos sua aprovacao, vira chip "Voce aprovou — aguardando ...". Quando admin completa a dupla, ele ve um modal de confirmacao com a opcao **"Designar pagador (opcional)"** — dropdown que lista admins. Se preenchido, NF fica designada pra aquele admin pagar (mas nao bloqueia: qualquer admin ainda pode pagar; e so um sinal de fluxo).

Recusa: apenas em `em_analise` (nao tem mais recusa pos-aprovacao). Modal exige `reason` (vira `notes_supplier`) e aceita `notes_internal` opcional. Cancela o processo — a NF nao pode mais ser aprovada.

Pagamento: apenas admin, apenas em `aprovada`. Botao "Marcar como paga" → confirma → backend marca `paid_at`, `paid_by`.

Campos de auditoria persistidos pelo backend:
- `approval_adm_campanha_by` + `approval_adm_campanha_at` — aprovacao do adm. campanha
- `approval_admin_by` + `approval_admin_at` — aprovacao do admin
- `paid_by_assignee_id` (+ `paid_by_assignee_name`) — admin designado pra pagar (opcional, definido pelo admin que completa a dupla)
- `paid_by` + `paid_at` — quem efetivamente marcou como paga
- `notes_supplier` — visivel a todos (carrega motivo da recusa)
- `notes_internal` — so admin/adm_campanha (backend mascara pra publisher)
- Campos legados `approved_by`/`approved_at` ainda existem pra compat, mas a UI consome os campos `approval_*` dupla.

Campos derivados retornados em `GET /nf/invoices*`:
- `is_vencida: bool` — `due_date < hoje` e status != paga
- `days_overdue: number` — dias decorridos do vencimento (so se vencida)
- `approvals_pending: ApprovalSlot[]` — quais aprovacoes faltam. `[]` = aprovada

Ambos os campos de notas podem ser editados a qualquer hora (independente do status) via `PATCH /nf/invoices/{id}/notes` por admin/adm_campanha. O detalhe da NF mostra paineis editaveis pra esses papeis; publisher so ve `notes_supplier` em modo read-only (e so se ela tiver conteudo).

Cada NF tambem tem `assignee_id` / `assignee_name` (responsavel pela revisao). `POST /invoices` faz auto-assign sorteando um adm_campanha; se nao houver, cai pra admin; se nenhum existir, fica null. Admin/adm_campanha podem reatribuir a qualquer momento via `PATCH /nf/invoices/{id}/assignee` no detalhe.

O frontend exibe `supplier_name`, `approved_by_name`, `paid_by_name` e `assignee_name` populados pelo backend. UUIDs nao aparecem mais na UI — fallback e "—".

**Fornecedor central**: toda NF aponta pra um fornecedor cadastrado (`supplier_id`/`supplier_name`); "publisher" e "usuario" sao atributos do fornecedor (`is_publisher`, `user_id`). O campo `publisher_id`/`publisher_name`/`publisher_email` da NF esta **deprecado** (mantido opcional no tipo so pra render gracioso de NFs historicas). Backend separa a **origem da NF** (fornecedor) de **submitted_by** (quem cadastrou de fato — `submitted_by`/`submitted_by_name`). No form `/invoice/new`, admin/adm_campanha escolhem o fornecedor num `<select>` e enviam `supplier_id`; usuario comum/linkado nao envia (backend amarra no fornecedor do usuario logado via `user_id`). No frontend, a listagem/detalhe leem `supplier_name` (com fallback `supplier_name ?? publisher_name` so pra NFs antigas). No detalhe, abaixo da linha do fornecedor, aparece "Cadastrado por: X" / "Submitted by: X". O modal de edicao (`/invoice/[id]`) permite trocar o fornecedor via `<select>` enquanto a NF esta `em_analise`.

## Bilinguismo

`publisher` → ingles. `adm_campanha` e `admin` → portugues. Resolvido por `langForRole(role)` em `lib/nf-role-context.tsx`. Strings em `lib/i18n.ts`. Status badge tambem aceita prop `lang`.

## Auth

Mesmo SSO via cookie no dominio raiz `.aeobr.com.br` (igual hub e tracker). Em producao, login feito em qualquer app vale aqui. Em dev (`localhost`), sem cross-subdomain.

`lib/auth-context.tsx` e identico ao do hub e do tracker — qualquer mudanca tem que ser replicada nos outros dois ou SSO quebra.

### Controle de admin

- `useAuth().isAdmin` deriva direto de `user.hub_role === "admin"`, vindo do backend no payload do `/auth/login`. **Sem mais lista hardcoded de emails.**
- Em client components, usar `const { isAdmin } = useAuth()`.
- Em server components / middleware, ler o cookie `user_data` e checar `hub_role === "admin"`.

### Gate de acesso ao app + papel intra-NF

`components/nf/bootstrap-gate.tsx` envolve a arvore dentro do `RootLayout`. Fluxo:

1. Espera o `AuthProvider` carregar.
2. Em `/login` ou quando nao ha `user`, libera direto.
3. Chama `GET /api/v1/hub/me/apps`. Se nao tem slug `nf` -> tela "sem acesso" + redirect pra `${HUB_URL}?reason=no_access_nf`.
4. Chama `GET /api/v1/nf/me/role`. Se `role: null` -> tela "perfil do NF nao configurado" com botao Sair.
5. Chama `GET /api/v1/perms/nf/me` pra resolver as permissoes do papel. Se falhar, usa `fallbackPermsForRole(role)` (graceful degradation — ver "RBAC dinamico").
6. Se role !== null -> envolve a arvore com `NfRoleProvider` expondo papel + permissoes (`useCan()`).
7. Cache em memoria por `userId` (apps + role + permissoes). Limpo automaticamente quando `user` vira `null` (logout).

## Variaveis de ambiente (Vercel)

```
NEXT_PUBLIC_API_URL=https://trk.aeobr.com.br/api/v1
NEXT_PUBLIC_HUB_URL=https://app.aeobr.com.br
```

## Estado atual

- [x] Repo criado (privado)
- [x] UI montada
- [x] Login funcional via API do Tracker
- [x] SSO entre subdominios
- [x] Deploy na Vercel
- [x] Dominio `nf.aeobr.com.br` com HTTPS
- [x] CORS liberado no backend do Tracker
- [x] Gate de acesso ao app via `GET /hub/me/apps` (slug `nf`)
- [x] Gate intra-NF via `GET /nf/me/role`
- [x] `ADMIN_EMAILS` hardcoded removido (admin vem de `hub_role`)
- [x] Backend NF em prod (`tracker-caracol/backend/app/routes/nf.py`)
- [x] Lista de invoices (filtros + status)
- [x] Form de cadastro com upload PDF
- [x] Detalhe com acoes condicionais por papel
- [x] Workflow de status com **aprovacao dupla** (adm_campanha + admin) → aprovada → paga, recusada via `POST /reject` (em_analise only)
- [x] Auditoria dupla (`approval_adm_campanha_by/at`, `approval_admin_by/at`, `paid_by/at`)
- [x] Dashboard com **chips no topo** (pendentes / a pagar / vencidas) + hovercard com ate 5 itens
- [x] Timeline de eventos no detalhe da NF (`GET /nf/invoices/{id}/events`)
- [x] Badges `2/2 aprovacoes`, `Vencida ha N dias`, "Pagador designado" no detalhe
- [x] Filtro "Vencidas" e deep-link `?status=&vencida=1` na lista
- [x] Notas separadas: `notes_supplier` (visivel ao publisher) + `notes_internal` (so admin/adm_campanha) com endpoint `PATCH /nf/invoices/{id}/notes`
- [x] Campo `assignee_id` (responsavel) + auto-assign no POST + reatribuicao via `PATCH /nf/invoices/{id}/assignee` + banner "N NFs aguardando voce" no topo da lista (consumindo `pending_assigned_count` do `GET /nf/me/role`)
- [x] Fornecedor central: toda NF aponta pra um fornecedor cadastrado (`supplier_id`); `is_publisher`/`user_id` viraram atributos do fornecedor; admin/adm_campanha tem `<select>` obrigatorio de fornecedor no `/invoice/new`, usuario comum/linkado nao escolhe (backend amarra). `publisher_id` deprecado. Detalhe mostra "Cadastrado por: X" (submitted_by)
- [x] Dashboard admin (em_analise_count, a_pagar_amount, pagas_30d_amount) — agora com 2 linhas R$/US$ nos stat cards "A pagar" e "Pagas (30d)"
- [x] Moeda por NF (BRL/USD): dropdown obrigatorio no form, prefix dinamico no campo Valor, totais separados no rodape da lista e nos stat cards do dashboard
- [x] Marcar NF como paga exige **comprovante** (modal de upload PNG/JPEG/PDF max 10MB → multipart pra `POST /pay`); detalhe exibe botao "Baixar comprovante" quando `paid_proof_path` esta setado (consome `GET /nf/invoices/{id}/proof`)
- [x] Gestao de papeis intra-NF (`/admin/usuarios-nf`)
- [x] Logo Caracol clicavel volta pro Hub
- [x] Campanhas como entidade propria: NF vincula campanhas via bloco estruturado (busca por mes + texto, valor por campanha). Campo texto livre `campaign_name` removido do front (deprecated no backend)
- [ ] Integracao com SEFAZ (futuro)
- [ ] Notificacoes (futuro)

## Decisoes tomadas

1. **App separado** em vez de modulo dentro do Tracker — modelos sao muito diferentes. Mantido.

2. **Helpers reaproveitados do Tracker** (api.ts, auth-context.tsx, toast-context.tsx) — copiados manualmente. Para o terceiro app, considerar extrair pra `@caracol/ui`.

3. **Mesma instancia Supabase do Tracker** — tabelas novas com prefixo `nf_`. Permite SSO trivial e reuso de auth.

4. **Backend unico no Tracker** — rotas `/api/v1/nf/*` em `tracker-caracol/backend/app/routes/nf.py`. Decisao tomada e em prod.

5. **Route groups removidos** — antes existiam `app/(supplier)/` e `app/(admin)/` pensados pra emails hardcoded. Agora tudo unificado em `/`, `/invoice/*`, `/admin/*`, com renderizacao condicional baseada em `useNfRole()`. Mais simples.

6. **Bilinguismo derivado do papel, nao da preferencia do user** — publisher e usuario externo, ve ingles. Adm/admin sao internos, veem portugues. Simples e suficiente pro escopo atual.

## Como editar

- **Codespaces** (recomendado): "Code → Codespaces → Create on main".
- **github.dev**: aperta `.` no repo.
- Local: `git clone`, `npm install`, `npm run dev`.

Cada push em `main` re-deploya na Vercel automaticamente.

## Para retomar o trabalho

Se voce e uma IA chegando aqui sem contexto:

1. **Leia este doc inteiro** antes de propor mudancas.
2. **Estado: funcional fase 1.** Telas em prod.
3. **Auth e cookie compartilhado**: qualquer mudanca em `lib/auth-context.tsx` precisa ser replicada em `caracol-hub` e `tracker-caracol`. Se desalinhar, SSO quebra.
4. **Backend nao vive aqui** — esta em `tracker-caracol/backend/app/routes/nf.py`. Pedir trabalho de backend = tarefa pro subagente `tracker`.
5. Cuidado com Cloudflare: subdominio `nf.aeobr.com.br` esta em **DNS only (cinza)**. Nao ligar proxy.
6. Helpers que ja existem — **nao reinvente**:
   - `apiFetch` pra fetch com Bearer (refresh automatico em 401)
   - `useToast` pra notificacoes
   - `useNfRole()` + `langForRole(role)` pra resolver idioma
   - `fmtCurrency / fmtDate / fmtRefMonth / fmtDateTime` em `lib/i18n.ts`
   - `StatusBadge` com prop `lang`
