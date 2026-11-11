# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Usuários individuais, casais, famílias e grupos de amigos no Brasil que gerenciam seu fluxo financeiro pessoal e compartilham despesas, contas bancárias e cartões de crédito no dia a dia, priorizando o uso em dispositivos móveis (mobile-first / PWA).

## Product Purpose

O **Finance** centraliza o controle financeiro pessoal e compartilhado para dar previsibilidade real de caixa. O sucesso do produto significa o usuário saber exatamente quanto tem hoje, quanto terá em qualquer dia do mês (passado, presente ou futuro), quais faturas e contas estão pendentes ou pagas, e quanto cada membro de um grupo deve ou tem a receber sem planilhas manuais.

## Positioning

Combina **previsibilidade diária de saldo bancário** (calendário financeiro encadeado, alerta de saldo mínimo e simulação de cenários hipotéticos) com **finanças compartilhadas nativas** (divisão real de cartões de crédito e contas bancárias em grupos, apuração automática de dívidas líquidas par-a-par por mês e liquidação direta entre contas).

## Operating Context

- Uso cotidiano rápido pelo celular (PWA standalone, navegação inferior com atalho central para nova transação) e análise detalhada no desktop (sidebar).
- Operação 100% em Real brasileiro (`BRL`, `pt-BR`), com valores armazenados e calculados em centavos no frontend/backend.
- Rotina contábil estrita: apenas transações com status `COMPLETED` alteram o saldo bancário confirmado (`account.balance`); transações `PENDING` representam previsões futuras ou pendências não pagas; compras em cartão de crédito impactam a fatura do ciclo (fechamento/vencimento) e não descontam da conta bancária até o pagamento da fatura.

## Capabilities and Constraints

- **Preservação integral de funcionalidades:** Nenhuma funcionalidade existente no sistema deve ser removida em evoluções ou refatorações futuras.
- **Mobile-first obrigatório:** Toda tela, componente, tabela, gráfico ou modal deve ser projetado prioritariamente para uso fluido em telas móveis (`viewport-fit=cover`, `safe-area-inset-bottom`), escalando para desktop.
- **Moeda única:** Todos os valores monetários são sempre expressos em Real (`R$`).
- **Escopo funcional confirmado (inegociável):**
  - Autenticação e recuperação de senha (`/login`, `/cadastro`, `/esqueci-senha`, `/redefinir-senha`).
  - Dashboard consolidado (`/`).
  - Contas bancárias (`/contas`, `/contas/:id`) dos tipos `CHECKING`, `WALLET`, `SAVINGS` e `INVESTMENTS`, com flag `includeInTotal` e rendimento/taxa.
  - Transações (`/transacoes`) dos tipos `EXPENSE`, `INCOME` e `TRANSFER`, com status `PENDING`/`COMPLETED`, recorrência (`DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`, fixa/infinita ou parcelada), vínculo com cartão/fatura e rateio (`splits`) entre contas.
  - Cartões de crédito e faturas (`/cartoes`, `/cartoes/:id`) com controle de limite, dias de fechamento e vencimento, status de fatura (`OPEN`, `CLOSED`, `PAID`, `PARTIALLY_PAID`), pagamento parcial com rolagem e juros rotativos, e divisão por usuário responsável.
  - Categorias personalizadas e de grupo (`/categorias`, `/categorias/:id`) com cor e ícone.
  - Rede de amigos (`/amigos`) e Grupos financeiros (`/grupos`, `/grupos/:id`, `/grupos/:id/relatorios`) com papéis (`OWNER`, `ADMIN`, `MEMBER`), convites, solicitações de vínculo de contas/cartões, apuração mensal de dívidas (`GroupDebtsResponse`) e liquidação (`DebtSettlement`).
  - Relatórios e Previsibilidade (`/relatorios` individual e por grupo): KPIs, planejamento financeiro (reserva/investimentos vs. custo fixo/variável), calendário de fluxo de caixa diário com projeção encadeada, simulações hipotéticas (`SimulatedTransaction`), evolução de categorias, compromissos futuros, hábitos de consumo por dia da semana e balanço compartilhado.
  - Perfil do usuário (`/perfil`) e Painel Administrativo (`/admin`) restrito ao papel `ADMIN`.

## Brand Commitments

- **Nome definitivo:** Finance.
- **Idioma e localização:** Português do Brasil (`pt-BR`), moeda Real (`R$`).

## Evidence on Hand

- Frontend web/PWA ativo em `/home/arthurmnz/code/front_finance` (React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Query, Recharts).
- Backend API REST ativo em `/home/arthurmnz/code/finance` (Kotlin, Spring Boot 4, PostgreSQL, JWT).
- Ícone e manifesto PWA existentes em `/home/arthurmnz/code/front_finance/public/icon.svg` e `/home/arthurmnz/code/front_finance/public/manifest.webmanifest`.
- Não há depoimentos de clientes externos, benchmarks públicos ou páginas de preços/planos; trabalhos futuros não devem fabricar essas provas.

## Product Principles

1. **Integridade contábil acima de tudo:** Saldos históricos, atuais e projetados devem refletir fielmente a diferença entre o que já saiu/entrou na conta (`COMPLETED`), o que está pendente (`PENDING`), o que pertence à fatura do cartão e o que é simulação hipotética.
2. **Mobile-first sem perda de poder analítico:** A experiência no celular deve permitir tanto lançar uma despesa em segundos quanto inspecionar projeções, faturas e acertos de grupo sem esconder funcionalidades essenciais.
3. **Preservação e continuidade funcional:** Evoluções visuais ou de UX devem preservar 100% das capacidades, fluxos e regras de negócio já presentes no sistema.
4. **Clareza imediata em finanças compartilhadas:** Sempre deixar explícito quem é o responsável pelo gasto, a qual conta ou cartão pertence e qual é o saldo líquido entre membros do grupo.
