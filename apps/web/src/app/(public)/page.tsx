import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock,
  Compass,
  FileText,
  HelpCircle,
  Heart,
  MessageCircle,
  Shield,
  Sparkles,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Eyebrow } from "@/components/brand/eyebrow";
import { IconCard } from "@/components/brand/icon-card";
import { Manifesto } from "@/components/brand/manifesto";
import { SectionTransition } from "@/components/brand/section-transition";
import { createClient } from "@/lib/supabase/server";
import { isBetaGateAtivo } from "@/lib/beta/codigos";
import { cn } from "@/lib/utils";

export default async function Home() {
  const gateBeta = isBetaGateAtivo();
  const ctaPrincipalHref = gateBeta ? "/lista-espera" : "/signup";
  const ctaPrincipalLabel = gateBeta
    ? "Entrar na lista de espera"
    : "Começar 30 dias grátis";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: family } = await supabase
      .from("family_accounts")
      .select("onboarding_completed")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!family || !family.onboarding_completed) redirect("/onboarding");
    redirect("/painel");
  }

  const { data: depoimentos } = await supabase
    .from("depoimentos")
    .select("id, nome_publico, texto, perfil_resumo")
    .eq("ativo", true)
    .order("ordem", { ascending: true })
    .limit(3);

  return (
    <>
      {/* ============================================================
       * HERO — roxo deep com pontilhado amarelo sutil (Manual §11).
       * ============================================================ */}
      <section className="relative overflow-hidden bg-brand-purple-deep text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,186,0,0.14) 1.2px, transparent 1.2px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-12 px-6 py-20 md:grid-cols-[1.2fr_1fr] md:gap-16 md:px-8 md:py-28">
          <div className="flex flex-col gap-6">
            <Eyebrow tone="dark">Para famílias atípicas</Eyebrow>
            <h1 className="font-heading text-4xl text-white md:text-6xl">
              Cuidado diário.{" "}
              <em className="not-italic text-brand-yellow">
                Onde você já está.
              </em>
            </h1>
            <p className="max-w-xl text-lg text-white/75 md:text-xl">
              O Kolo Família organiza a rotina das famílias atípicas — TEA,
              TDAH, dislexia, AH/SD. Acolhimento no WhatsApp, app personalizado
              e relatórios prontos pra terapeutas e escola.
            </p>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Link
                href={ctaPrincipalHref}
                className={cn(
                  buttonVariants({ variant: "cta", size: "xl" }),
                )}
              >
                {ctaPrincipalLabel}
                <ArrowRight className="size-5" aria-hidden />
              </Link>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "outline-light", size: "xl" }),
                )}
              >
                Já tenho conta
              </Link>
            </div>
            <p className="text-sm text-white/65">
              {gateBeta
                ? "Beta fechado. Te aviso por e-mail quando abrirmos vagas."
                : "Sem cartão de crédito. Cancela quando quiser."}{" "}
              Não substitui profissionais da saúde.
            </p>
          </div>

          <div className="relative hidden md:block">
            <div className="grid grid-cols-2 gap-4">
              {[
                {
                  icon: Sparkles,
                  titulo: "Conteúdo vivo",
                  texto:
                    "Brincadeiras, rotinas e roteiros gerados pelo perfil da sua família.",
                  offset: "",
                },
                {
                  icon: MessageCircle,
                  titulo: "Ayla no zap",
                  texto:
                    "Acolhe primeiro. Organiza depois. No canal que você já usa.",
                  offset: "mt-10",
                },
                {
                  icon: FileText,
                  titulo: "Relatórios",
                  texto: "Pra terapeuta e escola, em PDF ou link vivo.",
                  offset: "",
                },
                {
                  icon: Shield,
                  titulo: "Privado",
                  texto: "Seus dados são da sua família. LGPD por padrão.",
                  offset: "mt-10",
                },
              ].map(({ icon: Icon, titulo, texto, offset }) => (
                <div
                  key={titulo}
                  className={cn(
                    "flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur",
                    offset,
                  )}
                >
                  <IconCard tone="dark">
                    <Icon aria-hidden />
                  </IconCard>
                  <p className="font-heading text-lg font-semibold text-white">
                    {titulo}
                  </p>
                  <p className="text-sm text-white/75">{texto}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Transição curva pro fundo branco da próxima seção (Manual §11). */}
      <SectionTransition fill="#ffffff" />

      {/* ============================================================
       * PROBLEMAS — fundo branco, ícones únicos por problema (Manual §15).
       * ============================================================ */}
      <section className="bg-white">
        <div className="mx-auto w-full max-w-7xl px-6 py-20 md:px-8 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow className="justify-center">Você não tá sozinha</Eyebrow>
            <h2 className="mt-4 font-heading text-3xl text-foreground md:text-5xl">
              O dia a dia da família atípica{" "}
              <em className="not-italic text-brand-purple">tem desafios reais</em>.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              E conteúdo genérico de internet não dá conta. A Kolo entende isso
              — e organiza o que você precisa, do seu jeito.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Compass,
                titulo: "Cansaço de pesquisar",
                texto:
                  "Cada criança é única — e cada artigo da internet diz uma coisa. Você não tem tempo pra peneirar.",
              },
              {
                icon: Heart,
                titulo: "Sobrecarga emocional",
                texto:
                  "Você cuida da criança, dos relatórios, da escola, do terapeuta — e ninguém pergunta como VOCÊ está.",
              },
              {
                icon: Clock,
                titulo: "Falta de continuidade",
                texto:
                  "O que funcionou ontem talvez não funcione hoje. E você precisa adaptar sem perder o fio.",
              },
            ].map(({ icon: Icon, titulo, texto }) => (
              <div
                key={titulo}
                className="flex flex-col gap-4 rounded-3xl bg-kolo-lilas-bg-2 p-8 transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <IconCard tone="light">
                  <Icon aria-hidden />
                </IconCard>
                <h3 className="font-heading text-xl text-foreground">
                  {titulo}
                </h3>
                <p className="text-muted-foreground">{texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
       * FEATURES — fundo lilás, 3 cards (Manual §15).
       * ============================================================ */}
      <section className="bg-kolo-lilas">
        <div className="mx-auto w-full max-w-7xl px-6 py-20 md:px-8 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow className="justify-center">Como a Kolo te ajuda</Eyebrow>
            <h2 className="mt-4 font-heading text-3xl text-foreground md:text-5xl">
              Três peças que{" "}
              <em className="not-italic text-brand-purple">
                trabalham juntas
              </em>
              .
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Você não precisa escolher por qual canal vai falar com a IA.
              Conteúdo, conversa e relatórios — tudo conectado.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Sparkles,
                titulo: "App",
                texto:
                  "Painel diário, perfil progressivo da família, aulas curtas, galeria de imagens das brincadeiras.",
                bullets: [
                  "Conteúdo personalizado",
                  "Histórias sociais prontas",
                  "DASS-21 in-app",
                ],
                destacado: false,
              },
              {
                icon: MessageCircle,
                titulo: "Ayla no WhatsApp",
                texto:
                  "A Ayla pergunta como foi o dia, organiza o registro e percebe padrões. Acolhe primeiro, organiza depois.",
                bullets: [
                  "Máx. 2 msgs/dia",
                  "Você pausa quando quiser",
                  "Não insiste sem resposta",
                ],
                destacado: true,
              },
              {
                icon: FileText,
                titulo: "Especialistas + relatórios",
                texto:
                  "Quando você pergunta algo específico, o sistema escolhe quem responde. E gera relatórios sob demanda.",
                bullets: [
                  "Regulação, sono, comunicação",
                  "PDF ou link vivo",
                  "Pra terapeuta e escola",
                ],
                destacado: false,
              },
            ].map(({ icon: Icon, titulo, texto, bullets, destacado }) => (
              <div
                key={titulo}
                className={cn(
                  "flex flex-col gap-4 rounded-3xl p-8 transition-all hover:-translate-y-1 hover:shadow-xl",
                  destacado
                    ? "bg-gradient-to-br from-brand-purple to-brand-purple-light text-white"
                    : "bg-white text-foreground shadow-sm",
                )}
              >
                <IconCard tone={destacado ? "dark" : "light"}>
                  <Icon aria-hidden />
                </IconCard>
                <h3
                  className={cn(
                    "font-heading text-xl",
                    destacado ? "text-white" : "text-foreground",
                  )}
                >
                  {titulo}
                </h3>
                <p
                  className={cn(
                    destacado ? "text-white/85" : "text-muted-foreground",
                  )}
                >
                  {texto}
                </p>
                <ul className="mt-2 flex flex-col gap-2 text-sm">
                  {bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <Check
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          destacado ? "text-brand-yellow" : "text-brand-purple",
                        )}
                        aria-hidden
                      />
                      <span
                        className={
                          destacado ? "text-white/90" : "text-foreground/80"
                        }
                      >
                        {b}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
       * MANIFESTO — Manual §15, 1× por página.
       * ============================================================ */}
      <section className="bg-white">
        <div className="mx-auto w-full max-w-7xl px-6 py-20 md:px-8 md:py-24">
          <Manifesto>Inclusão não é amor. É método</Manifesto>
        </div>
      </section>

      {/* ============================================================
       * DEPOIMENTOS — branco, aspa amarela, SEM estrelas (Manual §15).
       * ============================================================ */}
      {depoimentos && depoimentos.length > 0 && (
        <section className="bg-white">
          <div className="mx-auto w-full max-w-7xl px-6 py-20 md:px-8 md:py-24">
            <div className="mx-auto max-w-3xl text-center">
              <Eyebrow className="justify-center">Famílias que usam</Eyebrow>
              <h2 className="mt-4 font-heading text-3xl text-foreground md:text-5xl">
                Pessoas reais,{" "}
                <em className="not-italic text-brand-purple">
                  contextos reais
                </em>
                .
              </h2>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {depoimentos.map((d) => (
                <figure
                  key={d.id}
                  className="relative flex flex-col gap-4 rounded-3xl bg-kolo-lilas-bg-2 p-8 transition-all hover:-translate-y-1 hover:shadow-lg"
                >
                  <span
                    aria-hidden
                    className="absolute -top-2 left-6 font-heading text-7xl leading-none text-brand-yellow"
                    style={{ fontWeight: 500 }}
                  >
                    “
                  </span>
                  <blockquote className="relative mt-6 text-lg text-foreground/85">
                    {d.texto}
                  </blockquote>
                  <div
                    aria-hidden
                    className="my-2 border-t-2 border-dashed border-brand-yellow/40"
                  />
                  <figcaption className="mt-auto">
                    <p className="font-semibold text-brand-purple-dark">
                      {d.nome_publico}
                    </p>
                    {d.perfil_resumo && (
                      <p className="text-sm text-muted-foreground">
                        {d.perfil_resumo}
                      </p>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============================================================
       * PRICING — gradient roxo Kolo (Manual §15).
       * ============================================================ */}
      <section className="bg-white">
        <div className="mx-auto w-full max-w-7xl px-6 py-20 md:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-purple to-brand-purple-dark p-10 text-white shadow-2xl md:p-16">
            <div className="grid items-center gap-10 md:grid-cols-[1.3fr_1fr]">
              <div>
                <Eyebrow tone="dark">30 dias grátis · sem cartão</Eyebrow>
                <h2 className="mt-4 font-heading text-3xl leading-tight text-white md:text-5xl">
                  Comece sem risco.{" "}
                  <em className="not-italic text-brand-yellow">
                    Pague só se valer.
                  </em>
                </h2>
                <p className="mt-4 max-w-lg text-lg text-white/85">
                  Trial completo: app + Ayla + relatórios. Você decide se vale
                  antes de qualquer cobrança. Sem pegadinha de cartão esquecido.
                </p>
                <ul className="mt-6 flex flex-col gap-2 text-sm">
                  {[
                    "Acesso completo durante o trial",
                    "Cancela em um clique, mantém histórico",
                    "Sem cobrança automática surpresa",
                  ].map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <Check
                        className="mt-0.5 size-5 shrink-0 text-brand-yellow"
                        aria-hidden
                      />
                      <span className="text-white/90">{b}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href={ctaPrincipalHref}
                    className={cn(
                      buttonVariants({ variant: "cta", size: "xl" }),
                    )}
                  >
                    {ctaPrincipalLabel}
                  </Link>
                  <Link
                    href="/precos"
                    className={cn(
                      buttonVariants({ variant: "outline-light", size: "xl" }),
                    )}
                  >
                    Ver preços
                  </Link>
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.18em] text-white/70">
                  A partir de
                </p>
                <p className="mt-2 font-heading text-6xl text-white">
                  <span style={{ fontWeight: 500 }}>R$ 98</span>
                  <span className="text-xl text-white/70">/mês</span>
                </p>
                <p className="mt-2 text-sm text-white/70">
                  ou plano anual com ~2 meses grátis
                </p>
                <div className="mt-6 h-px w-full bg-white/15" />
                <ul className="mt-4 flex flex-col gap-2 text-sm">
                  {[
                    "App + Ayla ilimitados",
                    "Relatórios pra terapeuta e escola",
                    "Suporte humano em PT-BR",
                  ].map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <Check
                        className="mt-0.5 size-4 shrink-0 text-brand-yellow"
                        aria-hidden
                      />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
       * FAQ — branco, cards lilás, ícone ? amarelo, chevron (Manual §15).
       * ============================================================ */}
      <section className="bg-white">
        <div className="mx-auto w-full max-w-4xl px-6 py-20 md:px-8 md:py-24">
          <div className="text-center">
            <Eyebrow className="justify-center">Perguntas frequentes</Eyebrow>
            <h2 className="mt-4 font-heading text-3xl text-foreground md:text-5xl">
              Dúvidas <em className="not-italic text-brand-purple">comuns</em>.
            </h2>
          </div>
          <div className="mt-12 flex flex-col gap-3">
            {[
              [
                "É um diagnóstico?",
                "Não. O Kolo Família é apoio educacional e organizacional. Quem diagnostica é profissional de saúde — médico, psicólogo, terapeuta. O que entregamos são hipóteses e organização do dia, sempre revisadas por você.",
              ],
              [
                "Como funciona a Ayla no WhatsApp?",
                "Você autoriza a Ayla na primeira conversa. Ela manda no máximo 2 mensagens proativas por dia, respeita pausas e silêncio, e não insiste depois de 10 dias sem resposta. Você pode pausar, mudar horário ou sair quando quiser.",
              ],
              [
                "Os dados da minha família ficam seguros?",
                "Os dados são só da sua família — nem nossa equipe consulta o conteúdo do seu diário. Os relatórios pra terapeuta e escola só vão se você gerar o link e compartilhar. Tudo conforme a LGPD.",
              ],
              [
                "Quanto custa?",
                "Trial de 30 dias grátis sem cartão. Depois do trial, mensalidade única. Detalhes em /precos.",
              ],
              [
                "Posso cancelar?",
                "A qualquer momento. Você mantém acesso ao seu histórico e aos dados gerados.",
              ],
            ].map(([q, a]) => (
              <details
                key={q}
                className="group rounded-2xl bg-kolo-lilas-bg-2 p-6 transition-colors open:bg-kolo-lilas"
              >
                <summary className="flex cursor-pointer items-center gap-4 text-left">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-yellow text-brand-purple-dark">
                    <HelpCircle className="size-5 stroke-[2.2]" aria-hidden />
                  </span>
                  <span className="flex-1 font-heading text-base font-semibold text-foreground md:text-lg">
                    {q}
                  </span>
                  <ChevronDown
                    className="size-5 shrink-0 text-brand-purple transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <p className="mt-3 pl-13 text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
       * CTA FINAL — gradient roxo deep (Manual §11).
       * ============================================================ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-purple-deep to-brand-purple-dark">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,186,0,0.16) 1.2px, transparent 1.2px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-6 py-24 text-center md:px-8">
          <Eyebrow tone="dark">Sua vez</Eyebrow>
          <h2 className="font-heading text-3xl leading-tight text-white md:text-5xl">
            {gateBeta ? (
              <>
                Entre na{" "}
                <em className="not-italic text-brand-yellow">
                  lista de espera
                </em>
              </>
            ) : (
              <>
                Comece com{" "}
                <em className="not-italic text-brand-yellow">
                  30 dias grátis
                </em>
              </>
            )}
          </h2>
          <p className="max-w-xl text-lg text-white/80 md:text-xl">
            {gateBeta
              ? "Beta fechado. Te aviso por e-mail quando abrirmos vagas."
              : "Sem cartão. Você decide se vale antes de pagar."}
          </p>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Link
              href={ctaPrincipalHref}
              className={cn(buttonVariants({ variant: "cta", size: "xl" }))}
            >
              {ctaPrincipalLabel}
              <ArrowRight className="size-5" aria-hidden />
            </Link>
            <Link
              href="/contato"
              className={cn(
                buttonVariants({ variant: "outline-light", size: "xl" }),
              )}
            >
              Falar com a gente
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
