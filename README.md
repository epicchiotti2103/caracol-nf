# Caracol NF

Sistema interno de controle de notas fiscais da Caracol.

Faz parte da suite Caracol — entrada pelo [Hub](https://github.com/epicchiotti2103/caracol-hub).

## Status: funcional (fase 1)

CRUD de invoices funcionando, com upload de PDF, papeis intra-NF (publisher / adm_campanha / admin), **workflow de aprovacao dupla** (adm_campanha + admin → aprovada → paga, com `recusada` apenas em `em_analise`), dashboard com chips no topo (pendentes / a pagar / vencidas, com hovercard de preview) e timeline de eventos no detalhe da NF. Backend vive no Tracker em `tracker-caracol/backend/app/routes/nf.py` (rotas `/api/v1/nf/*`).

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- js-cookie para sessao
- Mesma API de autenticacao do Tracker (`/api/v1/auth/login`)

## Telas

- `/login` — login conectado ao Supabase Auth (via API do Tracker)
- `/` — lista de notas fiscais (renderizacao diferente por papel; titulo, colunas e botoes adaptam)
- `/invoice/new` — formulario de cadastro de NF com upload de PDF (form bilingual: ingles pra publisher, portugues pros outros). **NF a pagar sempre aponta pra um fornecedor cadastrado.** Admin/adm_campanha veem um `<select>` de **Fornecedor** (alimentado por `GET /suppliers?active=true`) — obrigatorio; o form envia `supplier_id` no FormData do `POST /nf/invoices`. Usuario comum/linkado (nao admin) **nao ve dropdown** — o backend amarra a NF automaticamente no fornecedor associado ao usuario logado; o form so mostra um texto read-only "A NF sera vinculada automaticamente ao seu cadastro". Nao existe mais toggle publisher/fornecedor nem envio de `publisher_id`. Campo **Moeda** (BRL/USD, default BRL) ao lado do Valor; prefix `R$` ou `US$` alterna conforme selecao.
- `/invoice/[id]` — detalhe com auditoria das 2 aprovacoes + pagamento, badges `2/2 aprovacoes` e `Vencida ha N dias`, acoes condicionais por papel (incluindo modal de "designar pagador" quando admin completa a dupla), painel de notas e **timeline de eventos** (`GET /nf/invoices/{id}/events`)
- `/admin/clientes` — cadastro de clientes (entidades que recebem NF a receber). Apenas admin cria/edita; admin e adm_campanha visualizam. CRUD via `/clients`.
- `/admin/fornecedores` — cadastro de fornecedores (entidades que emitem NF a pagar). Mesma UI/permissoes dos clientes; CRUD via `/suppliers`. **Toda NF a pagar aponta pra um fornecedor cadastrado** — "publisher" e "usuario" viraram atributos do fornecedor: checkbox **"E publisher?"** (`is_publisher`) e dropdown **"Usuario linkado"** (`user_id`, opcional, lista `GET /nf/users` com nome + email e opcao "— nenhum —", pra fornecedores que tem login no sistema). O cadastro separa **nome fantasia** (`name`, obrigatorio — exibido na lista de fornecedores e como `supplier_name` na lista de NFs) de **razao social / nome real** (`legal_name`, opcional — usado na hora de pagar). O modal de cadastro/edicao tem uma secao colapsavel **"Dados de pagamento (HelmBank)"** com os campos bancarios `pay_*` (todos opcionais): tipo de transferencia (Internacional/SWIFT ou Domestica/Routing-ABA), conta/IBAN, banco beneficiario + codigo (label dinamico SWIFT vs Routing/ABA), banco correspondente + SWIFT (so internacional), pais/cidade/endereco/telefone do beneficiario, e instrucoes de pagamento (texto livre pra colar a remessa do email). No detalhe da NF a Pagar (`/invoice/[id]`), quando a NF tem `supplier_id`, admin/adm_campanha veem um bloco read-only "Dados de pagamento" com esses campos preenchidos (texto `select-all` pra facilitar copiar na hora de pagar). A primeira linha do bloco mostra a **Razao social / Beneficiario** com fallback `legal_name ?? name`.
- `/admin/usuarios-nf` — gestao de papeis intra-NF (apenas admin)

No dashboard `/`, admins e adm_campanha veem **3 chips no topo** (pendentes / a pagar / vencidas). Cada chip abre um hovercard (com fallback de clique no mobile) listando ate 5 NFs do balde + link "ver todas" que aplica o filtro. Admin tambem ve 3 stat cards abaixo dos chips — os de **A pagar** e **Pagas (30d)** mostram total em **R$** e **US$** em duas linhas (`to_pay_brl`/`to_pay_usd`, `paid_last_30d_brl`/`paid_last_30d_usd`).

A logo Caracol no header e clicavel e volta pro Hub.

## Papeis intra-NF

Sao definidos numa tabela do backend e expostos por `GET /api/v1/nf/me/role`. O `BootstrapGate` resolve o papel apos confirmar o acesso ao app `nf` e cacheia em memoria pra sessao.

| Papel | Pode | Idioma da UI |
|---|---|---|
| `publisher` | Criar e ver as proprias NFs | Ingles |
| `adm_campanha` | Ver todas NFs, aprovar/recusar `em_analise` | Portugues |
| `admin` | Tudo do adm_campanha + marcar `aprovada` como `paga` + recusa pos-aprovacao + gerir papeis | Portugues |

Sem papel definido, o gate mostra "Seu perfil no NF nao foi configurado".

## Workflow de status (aprovacao dupla)

```
em_analise --(approve x2: adm_campanha + admin)--> aprovada --(pay, admin)--> paga
     |
     +--(reject + reason)--> recusada
```

Toda NF em `em_analise` precisa de DUAS aprovacoes: uma do `adm_campanha` e outra do `admin` (ordem nao importa). Os endpoints novos sao:

- `POST /nf/invoices/{id}/approve` — body opcional `{paid_by_assignee_id}`. Backend detecta o papel do caller e popula a coluna correta.
- `POST /nf/invoices/{id}/reject` — body `{reason, notes_internal?}`. So funciona em `em_analise`.
- `POST /nf/invoices/{id}/pay` — admin only. **Multipart/form-data** com campo `proof` obrigatorio (PNG, JPEG ou PDF, max 10MB). UI abre modal com upload antes de confirmar; backend grava `paid_proof_path` no storage.

Quando o admin completa a dupla, a UI abre um modal "Aprovar NF #X" com a opcao opcional **Designar pagador** (dropdown de admins). Se preenchido, a NF fica com `paid_by_assignee_id`/`paid_by_assignee_name` setados e o detalhe exibe "Pagador designado: Nome". Qualquer admin ainda pode pagar; e so um sinal de fluxo.

Ao marcar como paga, o admin abre um modal de upload e anexa o **comprovante de pagamento** (PNG/JPEG/PDF, max 10MB). O backend grava `paid_proof_path` e o detalhe ganha um botao "Baixar comprovante" que abre uma URL assinada (`GET /nf/invoices/{id}/proof`).

Campos de auditoria: `approval_adm_campanha_by/at`, `approval_admin_by/at`, `paid_by/at`, `paid_by_assignee_id`. Notas em 2 campos (`notes_supplier`, `notes_internal`) seguem como antes, editaveis via `PATCH /nf/invoices/{id}/notes`.

Campos derivados retornados em `GET /nf/invoices*`: `is_vencida` (bool), `days_overdue` (number), `approvals_pending` (array com slots faltantes).

## Responsavel pela NF

Cada NF tem um campo opcional `assignee_id` (preenchido automaticamente no `POST /invoices` por um adm_campanha aleatorio, com fallback pra admin). Quem esta listado como responsavel ve, no topo da lista, um banner laranja "Voce tem N NFs aguardando voce" enquanto houver NFs `em_analise` atribuidas a ele. Clicar no banner ativa um filtro local ("mine") que mostra so essas. So admin/adm_campanha veem o banner — publisher recebe `pending_assigned_count = 0` do backend.

No detalhe da NF, admin/adm_campanha veem o nome do responsavel e podem reatribuir via `PATCH /nf/invoices/{id}/assignee` (modal com `<select>` listando admins + adms de campanha; opcao "sem responsavel" zera). Publisher so ve o nome em modo read-only, traduzido como "Reviewer".

## Fornecedor central (toda NF aponta pra um fornecedor)

NF a pagar **sempre** aponta pra um **fornecedor cadastrado** (`supplier_id`). O conceito de "publisher" e o vinculo com um "usuario do sistema" viraram **atributos do fornecedor**: `is_publisher` (checkbox no cadastro) e `user_id` (usuario linkado, opcional). O campo `publisher_id` da NF esta deprecado.

No form `/invoice/new`, admin/adm_campanha escolhem o fornecedor num `<select>` (`GET /suppliers?active=true`) e o form envia `supplier_id`. Usuario comum/linkado nao ve dropdown — o backend amarra a NF automaticamente no fornecedor associado ao usuario logado (form mostra so um aviso read-only). Sem registros de fornecedor, o form mostra warning com link pra `/admin/fornecedores` e desabilita o submit.

Na listagem e no detalhe da NF, a coluna/linha de origem mostra `supplier_name` (com fallback gracioso pra `publisher_name` so em NFs historicas). O detalhe distingue o **fornecedor** (origem da NF) de **submitted_by** (quem cadastrou), exibindo "Cadastrado por: X" abaixo. O modal de edicao (`/invoice/[id]`, NFs em `em_analise`) permite trocar o fornecedor via `<select>`.

## Controle de acesso

- **Admin do Hub** (`useAuth().isAdmin`) vem de `user.hub_role === "admin"`. Nao tem mais `ADMIN_EMAILS` hardcoded.
- **Acesso ao app NF** e validado pelo `BootstrapGate` (`components/nf/bootstrap-gate.tsx`):
  1. Apos auth, chama `GET /api/v1/hub/me/apps`. Se nao tem slug `nf` -> redireciona pra `app.aeobr.com.br?reason=no_access_nf`.
  2. Se tem app, chama `GET /api/v1/nf/me/role`. Se a resposta for `role: null` -> tela "Sem perfil no NF, fale com admin".
  3. Caso ok, expoe o papel via `useNfRole()` pra arvore inteira.
- Cache em memoria por sessao, limpo no logout.

## Como rodar (local)

```bash
cp .env.example .env.local
# preencha as variaveis
npm install
npm run dev
```

App em http://localhost:3000.

## Deploy

Vercel detecta o repo e builda. Dominio `nf.aeobr.com.br` ja configurado.

Env vars na Vercel:
- `NEXT_PUBLIC_API_URL` — `https://trk.aeobr.com.br/api/v1`
- `NEXT_PUBLIC_HUB_URL` — `https://app.aeobr.com.br`

## Helpers reaproveitados do Tracker

- `lib/api.ts`, `lib/auth-context.tsx`, `lib/config.ts`, `lib/toast-context.tsx`
- `components/status-badge.tsx`

Quando o terceiro app evoluir, vale extrair pra um pacote `@caracol/ui` compartilhado.
