---
name: Finance
description: Controle financeiro pessoal e compartilhado com previsibilidade real de caixa
colors:
  bg: "#000000"
  surface: "#070709"
  surface-1: "#0e0e13"
  surface-2: "#16161f"
  surface-3: "#1e1e2b"
  border: "#20202d"
  border-strong: "#323247"
  text: "#ffffff"
  text-muted: "rgba(255, 255, 255, 0.72)"
  text-dim: "rgba(255, 255, 255, 0.64)"
  text-faint: "rgba(255, 255, 255, 0.25)"
  primary: "#7D39EB"
  primary-hover: "#9253f5"
  primary-active: "#6626d0"
  primary-subtle: "rgba(125, 57, 235, 0.15)"
  lime: "#C6FF33"
  lime-hover: "#d5ff5c"
  lime-active: "#b1eb21"
  lime-subtle: "rgba(198, 255, 51, 0.12)"
  income: "#C6FF33"
  income-hover: "#d5ff5c"
  income-subtle: "rgba(198, 255, 51, 0.12)"
  expense: "#FF4D6A"
  expense-hover: "#ff6b83"
  expense-active: "#e63956"
  expense-subtle: "rgba(255, 77, 106, 0.14)"
  danger: "#FF4D6A"
  danger-hover: "#ff6b83"
  danger-active: "#e63956"
  danger-subtle: "rgba(255, 77, 106, 0.14)"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.02em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-lime:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.bg}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  card:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "16px"
---

# Design System: Finance

## Overview

**Creative North Star: "The Precision Vault"**

O **Finance** expressa solidez financeira através de um ambiente escuro imersivo (`#000000`), construído com estratificação tonal profunda de superfícies obsidiana (`#070709` a `#1e1e2b`) e acentos luminescentes de alta precisão: Violeta Elétrico (`#7D39EB`) para identidade e comandos estruturais, Lima Neon (`#C6FF33`) para receitas e previsões positivas, e Rosa Carmim (`#FF4D6A`) para saídas e pendências críticas.

Projetado sob a filosofia *mobile-first*, cada tela se comporta como um cockpit tático no smartphone — botões com alvo de toque seguro (mínimo 44px), navegação inferior ergonômica com botão de lançamento central em destaque, e modais apresentados como folhas inferiores responsivas (*bottom sheets*) que respeitam a margem do sistema (`safe-area-inset-bottom`). No desktop, a interface expande graciosamente para uma barra lateral fixa de 64 colunas de largura, preservando a coerência visual e funcional.

**Key Characteristics:**
- **Contraste tático escuro:** Fundo preto absoluto (`#000000`) com superfícies em 4 camadas de profundidade tonal delimitadas por fios de 1px (`#20202d`).
- **Luz sem exagero:** Acentos saturados (violeta e lima) usados estritamente para sinalizar status, saldos positivos e ações intencionais, sem desbotar em gradientes confusos.
- **Rigor tipográfico e numérico:** Digitação uniforme com Inter e alinhamento obrigatório de colunas contábeis através de `tabular-nums`.
- **Fluidez móvel contínua:** Alvos táteis generosos, foco visível com anel lima de alto contraste e microinterações táteis ágeis (`active:scale-[.98]`).

## Colors

Paleta dark com base em preto puro, estratificação de tons escuros frios e destaques luminescentes em violeta elétrico, lima neon e carmim vibrante.

### Primary
- **Electric Violet** (`#7D39EB`): Cor de identidade primária, ativação do botão principal, indicador de seleção de abas ativas, realce de marca e botão de adição flutuante (+). Variações: hover (`#9253f5`), active (`#6626d0`), sutil com 15% de opacidade (`rgba(125, 57, 235, 0.15)`).

### Secondary
- **Neon Lime** (`#C6FF33`): Sinalizador de receitas (`income`), saldos positivos, anéis de foco (`:focus-visible`), cursor de digitação (`caret-lime`) e botões de destaque alternativo com texto preto. Variações: hover (`#d5ff5c`), active (`#b1eb21`), sutil com 12% de opacidade (`rgba(198, 255, 51, 0.12)`).

### Tertiary
- **Vivid Carmine Expense** (`#FF4D6A`): Indicador de despesas (`expense`), saldos negativos, faturas fechadas pendentes de pagamento e alertas de erro. Variações: hover (`#ff6b83`), active (`#e63956`), sutil com 14% de opacidade (`rgba(255, 77, 106, 0.14)`).

### Neutral
- **Pitch Black** (`#000000`): Fundo global da aplicação e base do viewport.
- **Obsidian Surface** (`#070709`): Barra lateral desktop e superfícies de nível 0.
- **Dark Slate 1** (`#0e0e13`): Fundo padrão de cartões (`Card`), formulários e modais.
- **Deep Charcoal 2** (`#16161f`): Fundo de campos de entrada secundários, chips e estados de hover de itens.
- **Night Ash 3** (`#1e1e2b`): Superfície de nível 3 para trilhos, thumbs de scrollbar e divisores elevados.
- **Muted Border** (`#20202d`): Linha divisória padrão de 1px entre blocos e cartões.
- **Strong Border** (`#323247`): Borda de contraste para estados com foco, separadores marcados ou itens destacados.
- **Pure White** (`#ffffff`): Texto de primeiro plano, títulos e ícones com ênfase total.
- **Muted Text** (`rgba(255, 255, 255, 0.72)`): Legendas, rótulos e texto secundário com contraste superior a 4.5:1.
- **Dim Text** (`rgba(255, 255, 255, 0.64)`): Informações complementares, placeholders e metadados auxiliares.
- **Faint Text** (`rgba(255, 255, 255, 0.25)`): Elementos desativados e divisores quase imperceptíveis.

### Named Rules
**The Luminescent Intent Rule.** Cores saturadas (Violeta `#7D39EB`, Lima `#C6FF33` e Carmim `#FF4D6A`) nunca preenchem superfícies completas de cartões de conteúdo. Seu uso é cirúrgico: botões de ação, chips de status, gráficos e métricas de impacto.
**The Strict Accounting Palette Rule.** Valores positivos e entradas de dinheiro utilizam sem exceção Lima (`#C6FF33`); valores negativos e saídas utilizam Carmim (`#FF4D6A`). Não inverta nem altere o significado de cor para transações.

## Typography

**Display Font:** Inter, ui-sans-serif, system-ui, -apple-system, sans-serif
**Body Font:** Inter, ui-sans-serif, system-ui, -apple-system, sans-serif
**Numerical/Tabular Font:** Inter com recurso `font-variant-numeric: tabular-nums`

**Character:** Tipografia geométrica sóbria, altamente legível em densidades compactas e em fundos totalmente pretos, com espaçamento entre letras reduzido nos títulos e números com largura monospaçada para evitar instabilidade de alinhamento em tabelas e extratos.

### Hierarchy
- **Display** (700 Bold, 2rem / 32px, line-height 1.2, letter-spacing -0.025em): Métricas totais de patrimônio, saldos consolidados principais e cabeçalhos hero.
- **Headline** (700 Bold, 1.5rem / 24px, line-height 1.3, letter-spacing -0.02em): Títulos de seções de página (Dashboard, Relatórios, Contas, Cartões).
- **Title** (600 SemiBold, 1.125rem / 18px, line-height 1.4, letter-spacing -0.01em): Títulos de cards, nomes de categorias, modais e resumos parciais.
- **Body** (400 Regular / 500 Medium, 0.875rem / 14px, line-height 1.5, letter-spacing 0em): Descrições de transações, listas de membros, mensagens de confirmação e inputs.
- **Label** (500 Medium / 600 SemiBold, 0.75rem / 12px ou 0.6875rem / 11px, letter-spacing 0.02em): Rótulos de campos, badges, abas de navegação inferior e tags de categoria.

### Named Rules
**The Tabular Digits Rule.** Todo valor em moeda (`R$ 0,00`), saldo contábil, data numérica ou quantidade percentual deve conter a classe `.tabular-nums` para que cada caractere numérico ocupe exatamente a mesma largura visual.
**The No-Eyebrow Rule.** Títulos de seções não utilizam subtítulos menores ("eyebrows") decorativos empilhados acima. O título comunica seu contexto por peso e espaçamento.

## Layout

O layout segue arquitetura híbrida e orientada à prioridade móvel:
- **Mobile (< 768px):** O conteúdo ocupa 100% da largura com padding horizontal de 16px (`px-4`), padding superior de 24px (`pt-6`) e espaçamento inferior estendido (`pb-28`) para evitar sobreposição com a barra de navegação inferior fixa.
- **Desktop (≥ 768px):** A tela é estruturada com barra lateral fixa à esquerda de 256px (`w-64`) conectada ao topo (`h-dvh sticky top-0`) e área de conteúdo com largura máxima de 896px (`max-w-4xl mx-auto`), com padding horizontal de 32px (`px-8`) e inferior de 40px (`pb-10`).
- **Rhythm & Grid:** Espaçamento baseado em múltiplos de 4px / 8px (espaçamento padrão entre cards: 16px a 24px; entre itens de lista: 8px a 12px; padding interno de card: 16px a 20px).

## Elevation & Depth

O sistema de profundidade é construído através de **estratificação tonal (tonal layering)** em vez de sombras pesadas ou bordas falsas. Em um fundo `#000000`, a elevação visual decorre da claridade sutil da superfície (`#070709` -> `#0e0e13` -> `#16161f` -> `#1e1e2b`) unida a bordas finas de 1px (`border border-border`).

### Shadow Vocabulary
- **Subtle Violet Glow** (`box-shadow: 0 1px 2px 0 rgba(125, 57, 235, 0.20)`): Utilizado em botões de ação primária para elevar a saliência interativa.
- **Subtle Lime Glow** (`box-shadow: 0 1px 2px 0 rgba(198, 255, 51, 0.20)`): Utilizado no botão Lima secundário e no badge com tom `lime`.
- **Fab Floating Shadow** (`box-shadow: 0 20px 25px -5px rgba(125, 57, 235, 0.40)`): Utilizado exclusivamente no botão flutuante central da navegação móvel (+).
- **Modal Deep Backdrop** (`box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.95)`): Utilizado em caixas de diálogo e modais bottom sheet para separar o conteúdo interativo da cortina escura (`bg-black/80`).

### Named Rules
**The Border-Separated Depth Rule.** Superfícies elevadas nunca contam apenas com sombra para separação. Cada camada elevada carrega uma borda perimetral de 1px (`border border-border` ou `border-border-strong`), garantindo legibilidade perfeita mesmo em telas OLED ou com baixo brilho.

## Shapes

- **Controle e Campos:** Cantos arredondados de 12px (`rounded-xl` / `0.75rem`) em botões, campos de texto, seletores de data e inputs monetários.
- **Cards e Painéis:** Cantos arredondados de 16px (`rounded-2xl` / `1rem`) para cartões de saldo, resumos e blocos de agrupamento.
- **Modais e Diálogos:** Cantos superiores de 24px (`rounded-t-3xl` / `1.5rem`) em mobile quando exibidos como folha inferior, e cantos simétricos de 24px (`rounded-3xl`) em desktops e tablets.
- **Pills e Indicadores:** Cantos em pílula (`rounded-full` / `9999px`) para badges, avatares e o botão central móvel.

## Components

### Buttons
- **Shape:** Cantos de 12px (`rounded-xl`), altura de 44px (`h-11`) para o tamanho médio (`md`) e 36px (`h-9`) para o compacto (`sm`).
- **Primary:** Fundo violeta (`bg-violet` `#7D39EB`), texto branco, brilho sutil violeta. Ao passar o mouse: `bg-violet-hover` (`#9253f5`). Ao pressionar: `active:scale-[.98]` e `bg-violet-active` (`#6626d0`).
- **Lime:** Fundo lima (`bg-lime` `#C6FF33`), texto preto (`text-black`), peso `font-semibold`.
- **Outline:** Borda sutil de 1px (`border-border`), fundo `bg-surface-1`, texto branco. Ao passar o mouse: `bg-surface-2`, `border-border-strong`.
- **Ghost:** Fundo transparente, texto `text-muted`. Ao passar o mouse: `bg-surface-2`, texto branco.
- **Danger:** Fundo neutro com opacidade de 5% (`bg-white/5`), borda `border-white/10`, texto branco.

### Cards / Containers
- **Corner Style:** 16px (`rounded-2xl`).
- **Background:** Superfície Slate 1 (`bg-surface-1` `#0e0e13`).
- **Border:** Fio de 1px (`border border-border` `#20202d`).
- **Internal Padding:** 16px (`p-4`) ou 20px (`p-5`).

### Inputs / Fields
- **Style:** Fundo `bg-surface-1` (`#0e0e13`), borda de 1px `border-border` (`#20202d`), altura 44px (`h-11`), texto branco, placeholder `text-text-dim` (`rgba(255,255,255,0.64)`), cantos de 12px (`rounded-xl`).
- **Focus:** Borda lima (`focus:border-lime`), anel sutil lima (`focus:ring-1 focus:ring-lime`), cursor lima (`caret-lime`).
- **Disabled:** Opacidade 40% (`disabled:opacity-40`), cursor não permitido.

### Badges / Chips
- **Style:** Formato em pílula (`rounded-full`), padding horizontal de 10px (`px-2.5`), vertical de 2px (`py-0.5`), tipografia de 11px (`text-[11px] font-medium`).
- **Tones:**
  - `income`: Fundo sutil de lima (`bg-lime-subtle`), texto lima (`text-lime`), borda `border-lime/25`.
  - `expense` / `danger`: Fundo sutil de despesa (`bg-expense-subtle`), texto carmim (`text-expense`), borda `border-expense/30`.
  - `primary`: Fundo sutil de violeta (`bg-violet-subtle`), texto violeta claro (`text-violet-hover`), borda `border-violet/30`.
  - `default`: Fundo `bg-surface-2`, texto `text-text-muted`, borda `border-border`.

### Navigation
- **Desktop Sidebar:** Fixa à esquerda, largura de 256px (`w-64`), fundo `bg-surface` (`#070709`), borda direita `border-border`. Links com ícone e texto, cantos `rounded-xl`, estado ativo com fundo `bg-violet/15` e texto branco.
- **Mobile Bottom Bar:** Fixa na parte inferior, fundo `bg-black/95` com desfoque de fundo (`backdrop-blur-md`), borda superior `border-border`, respeitando `safe-bottom`. Atalho central flutuante de 56px (`size-14`) em formato circular violeta com anel de 4px preto para inserção imediata de transações.

### Modals & Bottom Sheets
- **Backdrop:** Fundo preto com 80% de opacidade e desfoque de fundo suave (`bg-black/80 backdrop-blur-md`).
- **Sheet:** No mobile encaixa na base (`rounded-t-3xl`), no desktop centralizado (`rounded-3xl sm:max-w-lg`). Contém trap de foco automático e padding inferior estendido para áreas seguras (`safe-area-inset-bottom`).

## Do's and Don'ts

### Do:
- **Do** formatar todo e qualquer valor monetário com `pt-BR` em Real (`R$ 0,00`) e aplicar sempre a classe `.tabular-nums`.
- **Do** respeitar as safe areas móveis (`safe-bottom`, `env(safe-area-inset-bottom)`) em qualquer elemento fixado na base da viewport.
- **Do** manter a altura mínima de 44px (`h-11`) em botões e inputs interativos para garantir ergonomia de toque em smartphones.
- **Do** utilizar a estratificação de superfícies (`#000000`, `#070709`, `#0e0e13`, `#16161f`, `#1e1e2b`) acompanhada de borda de 1px (`#20202d`) para diferenciar hierarquias de conteúdo.
- **Do** preservar 100% das funcionalidades existentes em qualquer refinamento visual.

### Don't:
- **Don't** aplicar gradientes multicoloridos ou efeitos de vidro translúcido difuso que prejudiquem a legibilidade das informações contábeis.
- **Don't** utilizar fontes genéricas sem largura tabular em colunas ou tabelas com números e saldos.
- **Don't** ocultar botões ou funcionalidades de desktop no celular; reestruture em gavetas, abas ou carrosséis mantendo todo o poder da ferramenta acessível.
- **Don't** criar sombras duras sem difusão ("neobrutalistas") ou bordas grossas superiores a 1px em cartões e alertas.
- **Don't** utilizar cinzas claros ou fundos esbranquiçados em superfícies; o ecossistema é estritamente dark mode tático.
