import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  FileSpreadsheet,
  FolderTree,
  Landmark,
  Layers,
  Lock,
  Palette,
  Repeat,
  Scale,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Wallet,
} from 'lucide-react'
import { BrandLogo } from '@/components/BrandLogo'
import { useAuth } from '@/lib/auth'
import { Badge, Button, Card } from '@/components/ui'

const HERO_CATEGORIES = [
  { name: 'Moradia', sub: 'Aluguel & Condomínio', color: '#fbbf24', amount: 'R$ 2.450,00', pct: 46 },
  { name: 'Alimentação', sub: 'Mercado & Delivery', color: '#34d399', amount: 'R$ 1.280,00', pct: 24 },
  { name: 'Transporte', sub: 'Combustível & Uber', color: '#38bdf8', amount: 'R$ 690,00', pct: 13 },
  { name: 'Assinaturas', sub: 'Streaming & Cloud', color: '#f43f5e', amount: 'R$ 310,00', pct: 6 },
]

const CALENDAR_DAYS = [
  { day: '05', label: 'Salário +Aporte', delta: '+R$ 8.500', balance: 'R$ 12.840', positive: true },
  { day: '10', label: 'Fatura Black', delta: '−R$ 3.420', balance: 'R$ 9.420', positive: false, card: true },
  { day: '15', label: 'Aluguel Casa', delta: '−R$ 2.100', balance: 'R$ 7.320', positive: false },
  { day: '22', label: 'Rateio Grupo', delta: '+R$ 640', balance: 'R$ 7.960', positive: true },
]

export default function Landing() {
  const { user } = useAuth()

  return (
    <div className="min-h-dvh bg-canvas text-ink-primary selection:bg-accent selection:text-canvas">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-border-subtle bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 transition hover:opacity-90">
            <BrandLogo className="size-9 drop-shadow-[0_0_12px_rgba(251,191,36,0.35)]" />
            <span className="font-display text-sm tracking-wider text-ink-primary sm:text-base">
              Finance
            </span>
          </Link>

          <nav aria-label="Navegação da página" className="hidden items-center gap-7 text-xs font-medium text-ink-secondary md:flex">
            <a href="#recursos" className="transition hover:text-ink-primary">
              Recursos
            </a>
            <a href="#cartoes-grupos" className="transition hover:text-ink-primary">
              Cartões &amp; Grupos
            </a>
            <a href="#previsibilidade" className="transition hover:text-ink-primary">
              Calendário &amp; Simulador
            </a>
            <a href="#seguranca" className="transition hover:text-ink-primary">
              Segurança
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            {user ? (
              <Link to="/dashboard">
                <Button size="sm">
                  Ir para o Dashboard <ArrowRight className="size-3.5" />
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button size="sm" variant="ghost">
                    Entrar
                  </Button>
                </Link>
                <Link to="/cadastro">
                  <Button size="sm">
                    Criar conta <ArrowRight className="size-3.5" />
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-border-subtle pt-12 pb-16 sm:pt-20 sm:pb-24">
          {/* Ambient radial glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-36 left-1/2 -z-10 h-[28rem] w-[52rem] -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]"
          />

          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
              {/* Left Copy */}
              <div className="space-y-6 lg:col-span-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-accent/35 bg-accent/10 px-3 py-1 text-[11px] font-mono font-medium text-accent">
                  <span className="size-1.5 rounded-full bg-accent" />
                  <span>PREVISIBILIDADE DE CAIXA · CONTAS · CARTÕES · GRUPOS</span>
                </div>

                <h1 className="text-3xl font-bold tracking-tight text-ink-primary sm:text-5xl sm:leading-[1.08]">
                  Controle cada centavo hoje e projete seu saldo nos próximos meses.
                </h1>

                <p className="max-w-xl text-sm leading-relaxed text-ink-secondary sm:text-base">
                  Unifique contas bancárias individuais e conjuntas, faturas de cartão de crédito com parcelamento exato, categorias hierárquicas com seletor livre de cores e divisão automática de despesas em grupos.
                </p>

                <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
                  {user ? (
                    <Link to="/dashboard" className="w-full sm:w-auto">
                      <Button className="w-full sm:px-6">
                        Acessar Dashboard <ArrowRight className="size-4" />
                      </Button>
                    </Link>
                  ) : (
                    <>
                      <Link to="/cadastro" className="w-full sm:w-auto">
                        <Button className="w-full sm:px-6">
                          Começar agora <ArrowRight className="size-4" />
                        </Button>
                      </Link>
                      <Link to="/login" className="w-full sm:w-auto">
                        <Button variant="outline" className="w-full sm:px-6">
                          Entrar na conta
                        </Button>
                      </Link>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4 border-t border-border-subtle pt-6">
                  <div>
                    <p className="font-mono text-lg font-bold text-accent sm:text-xl">100%</p>
                    <p className="text-xs text-ink-secondary">Precisão em centavos nas parcelas</p>
                  </div>
                  <div>
                    <p className="font-mono text-lg font-bold text-ink-primary sm:text-xl">2 Níveis</p>
                    <p className="text-xs text-ink-secondary">Categorias gerais e específicas</p>
                  </div>
                  <div>
                    <p className="font-mono text-lg font-bold text-ink-primary sm:text-xl">CSV &amp; PDF</p>
                    <p className="text-xs text-ink-secondary">Exportação nativa de faturas</p>
                  </div>
                </div>
              </div>

              {/* Right Interactive-Look Financial Interface Mockup */}
              <div className="lg:col-span-6">
                <div className="relative rounded-3xl border border-border-strong bg-surface p-4 shadow-[0_24px_64px_rgba(0,0,0,0.75)] card-highlight sm:p-5">
                  {/* Mockup Top Bar */}
                  <div className="mb-4 flex items-center justify-between border-b border-border-subtle pb-3">
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full bg-accent" />
                      <span className="font-mono text-xs font-semibold text-ink-primary">
                        VISÃO CONSOLIDADA · NOV/2026
                      </span>
                    </div>
                    <Badge tone="income">+18,4% poupança</Badge>
                  </div>

                  {/* Balances Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-border-subtle bg-surface-elevated p-3.5 card-highlight">
                      <p className="text-xs text-ink-secondary">Saldo total em contas</p>
                      <p className="mt-1 font-mono text-xl font-bold text-income sm:text-2xl">
                        R$ 14.820,50
                      </p>
                      <div className="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-ink-secondary">
                        <Landmark className="size-3.5 text-accent" />
                        <span>3 contas ativas + 1 conjunta</span>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-income/35 bg-income/10 p-3.5 card-highlight">
                      <p className="text-xs text-income">Saldo projetado (fim do mês)</p>
                      <p className="mt-1 font-mono text-xl font-bold text-income sm:text-2xl">
                        R$ 11.490,00
                      </p>
                      <div className="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-ink-primary/85">
                        <CheckCircle2 className="size-3.5 text-income" />
                        <span>Faturas e fixos cobertos</span>
                      </div>
                    </div>
                  </div>

                  {/* Credit Card Invoice & Group Split Preview */}
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border-subtle bg-surface-elevated/70 p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-primary">
                          <CreditCard className="size-3.5 text-accent" />
                          Cartão Black
                        </span>
                        <span className="rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-accent">
                          Fecha dia 10
                        </span>
                      </div>
                      <div className="mt-2.5 flex items-baseline justify-between">
                        <span className="text-xs text-ink-secondary">Fatura atual</span>
                        <span className="font-mono text-sm font-bold text-expense">−R$ 3.420,00</span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-canvas">
                        <div className="h-full w-[38%] rounded-full bg-income" />
                      </div>
                      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-ink-secondary">
                        <span>38% utilizado</span>
                        <span className="text-income">Disp: R$ 8.580,00</span>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border-subtle bg-surface-elevated/70 p-3.5">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-primary">
                          <UsersRound className="size-3.5 text-accent" />
                          Grupo Casa &amp; Família
                        </span>
                        <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] text-ink-primary">
                          Rateio ativo
                        </span>
                      </div>
                      <div className="mt-2.5 space-y-1.5 font-mono text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-ink-secondary">A receber no mês</span>
                          <span className="font-semibold text-income">+R$ 640,00</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-ink-secondary">Conta Conjunta</span>
                          <span className="font-semibold text-income">R$ 4.200,00</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Categories with Custom Colors Preview */}
                  <div className="mt-3 rounded-2xl border border-border-subtle bg-surface-elevated/50 p-3.5">
                    <div className="mb-2.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-primary">
                        <Palette className="size-3.5 text-accent" />
                        Categorias Gerais &amp; Específicas
                      </span>
                      <span className="font-mono text-[10px] text-ink-secondary">SELETOR LIVRE #HEX</span>
                    </div>
                    <div className="space-y-2">
                      {HERO_CATEGORIES.map((cat) => (
                        <div key={cat.name} className="flex items-center gap-2.5 text-xs">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                          <div className="min-w-0 flex-1">
                            <span className="font-medium text-ink-primary">{cat.name}</span>
                            <span className="ml-1.5 text-[11px] text-ink-secondary">› {cat.sub}</span>
                          </div>
                          <span className="font-mono text-xs font-semibold text-ink-primary">
                            {cat.amount}
                          </span>
                          <span className="w-9 text-right font-mono text-[11px] text-ink-secondary">
                            {cat.pct}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bento Grid: Recursos Principais */}
        <section id="recursos" className="border-b border-border-subtle py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-ink-primary sm:text-3xl">
                Arquitetura financeira completa para uso individual e compartilhado
              </h2>
              <p className="text-sm text-ink-secondary">
                Cada módulo do sistema conversa em tempo real com o seu saldo bancário e o calendário de fluxo de caixa.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-12">
              {/* Feature 1: Contas e Transações */}
              <Card className="flex flex-col justify-between p-6 md:col-span-7">
                <div className="space-y-3">
                  <div className="inline-flex size-10 items-center justify-center rounded-xl border border-accent/30 bg-accent/15 text-accent">
                    <Wallet className="size-5" />
                  </div>
                  <h3 className="text-lg font-bold text-ink-primary">
                    Contas Individuais, Reservas, Investimentos e Contas Conjuntas
                  </h3>
                  <p className="text-xs leading-relaxed text-ink-secondary sm:text-sm">
                    Separe contas operacionais do dia a dia (Conta Corrente e Carteira) do seu patrimônio guardado (Reserva de Emergência e Investimentos). Divida uma única transação entre até 10 contas por valor ou porcentagem.
                  </p>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  <div className="rounded-xl border border-border-subtle bg-surface-elevated p-3">
                    <span className="text-[11px] text-ink-secondary">Conta Corrente</span>
                    <p className="mt-1 font-mono text-sm font-bold text-income">R$ 6.420,00</p>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-surface-elevated p-3">
                    <span className="text-[11px] text-ink-secondary">Reserva (6,5 meses)</span>
                    <p className="mt-1 font-mono text-sm font-bold text-income">R$ 28.000,00</p>
                  </div>
                  <div className="col-span-2 rounded-xl border border-border-subtle bg-surface-elevated p-3 sm:col-span-1">
                    <span className="text-[11px] text-ink-secondary">Conta Conjunta</span>
                    <p className="mt-1 font-mono text-sm font-bold text-income">R$ 4.200,00</p>
                  </div>
                </div>
              </Card>

              {/* Feature 2: Categorias Hierárquicas com Seletor Livre de Cores */}
              <Card className="flex flex-col justify-between p-6 md:col-span-5">
                <div className="space-y-3">
                  <div className="inline-flex size-10 items-center justify-center rounded-xl border border-accent/30 bg-accent/15 text-accent">
                    <FolderTree className="size-5" />
                  </div>
                  <h3 className="text-lg font-bold text-ink-primary">
                    Categorias Hierárquicas &amp; Cor Livre
                  </h3>
                  <p className="text-xs leading-relaxed text-ink-secondary sm:text-sm">
                    Organize lançamentos em Categorias Gerais (ex.: Moradia) e Específicas (ex.: Aluguel, Energia). Escolha qualquer cor no seletor RGB/Hexadecimal para personalizar seus gráficos e badges.
                  </p>
                </div>

                <div className="mt-6 space-y-2 rounded-2xl border border-border-subtle bg-surface-elevated p-3.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-ink-primary">🏠 Moradia (Geral)</span>
                    <span className="font-mono text-xs text-accent">#FBBF24</span>
                  </div>
                  <div className="space-y-1.5 border-l-2 border-border-strong pl-3 text-xs">
                    <div className="flex items-center justify-between text-ink-secondary">
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-[#fbbf24]" /> 🔑 Aluguel
                      </span>
                      <span className="font-mono text-ink-primary">R$ 1.800,00</span>
                    </div>
                    <div className="flex items-center justify-between text-ink-secondary">
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-[#38bdf8]" /> ⚡ Energia Elétrica
                      </span>
                      <span className="font-mono text-ink-primary">R$ 245,00</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Feature 3: Cartões de Crédito & Faturas */}
              <Card id="cartoes-grupos" className="flex flex-col justify-between p-6 md:col-span-6">
                <div className="space-y-3">
                  <div className="inline-flex size-10 items-center justify-center rounded-xl border border-accent/30 bg-accent/15 text-accent">
                    <CreditCard className="size-5" />
                  </div>
                  <h3 className="text-lg font-bold text-ink-primary">
                    Gestão Inteligente de Cartões e Faturas
                  </h3>
                  <p className="text-xs leading-relaxed text-ink-secondary sm:text-sm">
                    Cálculo automático de fechamento e vencimento, distribuição de centavos de parcelas na 1ª ou última fatura, edição individual de parcelas, controle de saldo rolado/rotativo e exportação para CSV e PDF A4.
                  </p>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-4">
                  <Badge tone="primary">
                    <Layers className="mr-1 size-3" /> Parcelas 1/12 personalizáveis
                  </Badge>
                  <Badge tone="default">
                    <Repeat className="mr-1 size-3" /> Assinaturas recorrentes
                  </Badge>
                  <Badge tone="income">
                    <FileSpreadsheet className="mr-1 size-3" /> Exportação CSV &amp; PDF
                  </Badge>
                </div>
              </Card>

              {/* Feature 4: Grupos, Amigos e Acertos de Dívidas */}
              <Card className="flex flex-col justify-between p-6 md:col-span-6">
                <div className="space-y-3">
                  <div className="inline-flex size-10 items-center justify-center rounded-xl border border-accent/30 bg-accent/15 text-accent">
                    <Scale className="size-5" />
                  </div>
                  <h3 className="text-lg font-bold text-ink-primary">
                    Finanças Compartilhadas em Grupos &amp; Acertos
                  </h3>
                  <p className="text-xs leading-relaxed text-ink-secondary sm:text-sm">
                    Compartilhe cartões de crédito ou contas conjuntas com membros do grupo. O Finance calcula automaticamente quem deve para quem no mês, permitindo quitar com transferência direta ou perdoar saldo devedor.
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between rounded-2xl border border-border-subtle bg-surface-elevated px-4 py-3 text-xs">
                  <div>
                    <p className="font-semibold text-ink-primary">Compensação automática entre membros</p>
                    <p className="text-ink-secondary">Compras em cartão compartilhado + aportes na conta conjunta</p>
                  </div>
                  <ArrowUpRight className="size-4 shrink-0 text-accent" />
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Calendário Financeiro & Simulador Section */}
        <section id="previsibilidade" className="border-b border-border-subtle py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid items-center gap-8 lg:grid-cols-12">
              <div className="space-y-4 lg:col-span-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 font-mono text-[11px] text-accent">
                  <CalendarClock className="size-3.5" />
                  <span>PREVISIBILIDADE DIÁRIA</span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-ink-primary sm:text-3xl">
                  Saiba exatamente seu saldo em qualquer dia do futuro.
                </h2>
                <p className="text-sm leading-relaxed text-ink-secondary">
                  O Calendário Financeiro encadeia seu saldo dia a dia somando receitas previstas, contas agendadas e o vencimento das faturas de todos os seus cartões.
                </p>
                <ul className="space-y-2.5 text-xs text-ink-secondary sm:text-sm">
                  <li className="flex items-center gap-2">
                    <Sparkles className="size-4 shrink-0 text-accent" />
                    <span>Simule compras parceladas ou assinaturas antes de gastar</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <BarChart3 className="size-4 shrink-0 text-accent" />
                    <span>Comparativo Month-over-Month (MoM) e ritmo acumulado de gastos</span>
                  </li>
                </ul>
              </div>

              <div className="lg:col-span-7">
                <Card className="p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle pb-3">
                    <div>
                      <p className="text-sm font-semibold text-ink-primary">
                        Projeção Encadeada do Calendário Financeiro
                      </p>
                      <p className="text-xs text-ink-secondary">
                        Alertas preventivos de liquidez e impacto de faturas no vencimento
                      </p>
                    </div>
                    <Badge tone="primary">Simulador Ativo</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {CALENDAR_DAYS.map((d) => (
                      <div
                        key={d.day}
                        className="flex flex-col justify-between rounded-2xl border border-border-subtle bg-surface-elevated p-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-ink-secondary">
                            DIA {d.day}
                          </span>
                          {d.card && <CreditCard className="size-3.5 text-accent" />}
                        </div>
                        <p className="mt-2 truncate text-xs font-medium text-ink-primary">{d.label}</p>
                        <p
                          className={`mt-1 font-mono text-xs font-semibold ${
                            d.positive ? 'text-income' : 'text-expense'
                          }`}
                        >
                          {d.delta}
                        </p>
                        <div className="mt-2 border-t border-border-subtle pt-1.5 font-mono text-[11px] text-ink-secondary">
                          Saldo: <strong className="text-income">{d.balance}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Segurança & Privacidade */}
        <section id="seguranca" className="border-b border-border-subtle py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="p-5">
                <ShieldCheck className="size-6 text-accent" />
                <h3 className="mt-3 text-base font-bold text-ink-primary">Isolamento &amp; Permissões</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
                  Contas conjuntas e grupos possuem controle granular de acesso por membro e aprovação de vínculos por administradores.
                </p>
              </Card>
              <Card className="p-5">
                <Lock className="size-6 text-accent" />
                <h3 className="mt-3 text-base font-bold text-ink-primary">Sessão Protegida</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
                  Autenticação com renovação automática de sessão, recuperação segura de senha e proteção contra CSV Formula Injection nas exportações.
                </p>
              </Card>
              <Card className="p-5">
                <Sparkles className="size-6 text-accent" />
                <h3 className="mt-3 text-base font-bold text-ink-primary">PWA Instalável</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
                  Interface responsiva otimizada para desktop e dispositivos móveis, instalável diretamente na tela inicial do Android e iOS.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Final */}
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
            <Card className="relative overflow-hidden border-accent/35 bg-surface p-8 sm:p-12">
              <div className="mx-auto max-w-xl space-y-4">
                <BrandLogo className="mx-auto size-14 drop-shadow-[0_0_24px_rgba(251,191,36,0.35)]" />
                <h2 className="text-2xl font-bold tracking-tight text-ink-primary sm:text-4xl">
                  Assuma o comando da sua vida financeira hoje.
                </h2>
                <p className="text-sm text-ink-secondary">
                  Crie sua conta gratuitamente em segundos ou acesse seu painel para acompanhar suas contas, faturas e grupos.
                </p>
                <div className="flex flex-col justify-center gap-3 pt-2 sm:flex-row">
                  {user ? (
                    <Link to="/dashboard">
                      <Button className="w-full sm:w-auto sm:px-8">
                        Ir para o Dashboard <ArrowRight className="size-4" />
                      </Button>
                    </Link>
                  ) : (
                    <>
                      <Link to="/cadastro">
                        <Button className="w-full sm:w-auto sm:px-8">
                          Criar conta grátis <ArrowRight className="size-4" />
                        </Button>
                      </Link>
                      <Link to="/login">
                        <Button variant="outline" className="w-full sm:w-auto sm:px-8">
                          Já tenho conta
                        </Button>
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border-subtle bg-surface py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2.5">
            <BrandLogo className="size-7" />
            <span className="font-display text-xs tracking-wider text-ink-primary">Finance</span>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs text-ink-secondary">
            <a href="#recursos" className="transition hover:text-ink-primary">
              Recursos
            </a>
            <a href="#cartoes-grupos" className="transition hover:text-ink-primary">
              Cartões &amp; Grupos
            </a>
            <Link to="/login" className="transition hover:text-accent">
              Entrar
            </Link>
            <Link to="/cadastro" className="transition hover:text-accent">
              Criar conta
            </Link>
          </div>

          <p className="font-mono text-[11px] text-ink-secondary">
            © {new Date().getFullYear()} Finance · Controle &amp; Previsibilidade
          </p>
        </div>
      </footer>
    </div>
  )
}
