import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Calendar,
  Check,
  Heart,
  MessageCircle,
  Shield,
  Sparkles,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
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

  // Depoimentos curados (vazio é ok)
  const { data: depoimentos } = await supabase
    .from("depoimentos")
    .select("id, nome_publico, texto, perfil_resumo")
    .eq("ativo", true)
    .order("ordem", { ascending: true })
    .limit(3);

  return (
    <>
      {/* HERO */}
      <section className="bg-brand-hero relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-black/10" />
        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-12 px-6 py-20 md:grid-cols-[1.2fr_1fr] md:gap-16 md:px-8 md:py-28">
          <div className="flex flex-col gap-6">
            <span className="w-fit rounded-full border border-white/20 bg-white/10 px-3 py-1 text-base font-medium text-white/90 backdrop-blur">
              Apoio prático para famílias atípicas
            </span>
            <h1 className="font-heading text-4xl font-extrabold leading-[1.05] tracking-tight text-white md:text-6xl">
              Cuidado diário.{" "}
              <span className="text-brand-yellow-light">Onde você já está.</span>
            </h1>
            <p className="max-w-xl text-lg text-white/90 md:text-2xl md:leading-snug">
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
            <p className="text-sm text-white/70">
              {gateBeta
                ? "Beta fechado. Te aviso por e-mail quando abrirmos vagas."
                : "Sem cartão de crédito. Cancela quando quiser."}{" "}
              Não substitui profissionais da saúde.
            </p>
          </div>

          <div className="relative hidden md:block">
            <div className="absolute -inset-4 rounded-3xl bg-white/10 blur-2xl" aria-hidden />
            <div className="relative grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-3 rounded-3xl bg-white/10 p-6 text-white shadow-2xl backdrop-blur-sm">
                <div className="flex size-12 items-center justify-center rounded-full bg-white/20">
                  <Sparkles className="size-6 text-white" aria-hidden />
                </div>
                <p className="font-heading text-lg font-bold">Conteúdo vivo</p>
                <p className="text-sm text-white/80">
                  Brincadeiras, rotinas e roteiros gerados pelo perfil da sua família.
                </p>
              </div>
              <div className="mt-10 flex flex-col gap-3 rounded-3xl bg-white/10 p-6 text-white shadow-2xl backdrop-blur-sm">
                <div className="flex size-12 items-center justify-center rounded-full bg-white/20">
                  <MessageCircle className="size-6 text-white" aria-hidden />
                </div>
                <p className="font-heading text-lg font-bold">Ayla no zap</p>
                <p className="text-sm text-white/80">
                  Acolhe primeiro. Organiza depois. No canal que você já usa.
                </p>
              </div>
              <div className="flex flex-col gap-3 rounded-3xl bg-white/10 p-6 text-white shadow-2xl backdrop-blur-sm">
                <div className="flex size-12 items-center justify-center rounded-full bg-white/20">
                  <Calendar className="size-6 text-white" aria-hidden />
                </div>
                <p className="font-heading text-lg font-bold">Relatórios</p>
                <p className="text-sm text-white/80">
                  Pra terapeuta e escola, em PDF ou link vivo.
                </p>
              </div>
              <div className="mt-10 flex flex-col gap-3 rounded-3xl bg-white/10 p-6 text-white shadow-2xl backdrop-blur-sm">
                <div className="flex size-12 items-center justify-center rounded-full bg-white/20">
                  <Shield className="size-6 text-white" aria-hidden />
                </div>
                <p className="font-heading text-lg font-bold">Privado</p>
                <p className="text-sm text-white/80">
                  Seus dados são da sua família. LGPD por padrão.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PAIN POINTS */}
      <section className="bg-brand-fade">
        <div className="mx-auto w-full max-w-7xl px-6 py-20 md:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-heading text-3xl font-bold tracking-tight text-gray-800 md:text-5xl">
              Você não tá sozinha nessa
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              A gente sabe que o dia a dia da família atípica tem desafios
              específicos. E que conteúdo genérico de internet não dá conta.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                titulo: "Cansaço de pesquisar",
                texto:
                  "Cada criança é única — e cada artigo da internet diz uma coisa. Você não tem tempo pra peneirar.",
              },
              {
                titulo: "Sobrecarga emocional",
                texto:
                  "Você cuida da criança, dos relatórios, da escola, do terapeuta — e ninguém pergunta como VOCÊ está.",
              },
              {
                titulo: "Falta de continuidade",
                texto:
                  "O que funcionou ontem talvez não funcione hoje. E você precisa adaptar sem perder o fio.",
              },
            ].map((item) => (
              <div
                key={item.titulo}
                className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
              >
                <div className="flex size-12 items-center justify-center rounded-full bg-red-100">
                  <Heart className="size-6 text-red-400" aria-hidden />
                </div>
                <h3 className="font-heading text-xl font-bold text-gray-800">
                  {item.titulo}
                </h3>
                <p className="text-gray-600">{item.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES — Como funciona */}
      <section className="bg-brand-soft">
        <div className="mx-auto w-full max-w-7xl px-6 py-20 md:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="font-heading text-3xl font-bold tracking-tight text-gray-800 md:text-5xl">
              Três peças que trabalham juntas
            </h2>
            <p className="mt-4 text-lg text-gray-600">
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
              },
              {
                icon: Shield,
                titulo: "Especialistas + relatórios",
                texto:
                  "Quando você pergunta algo específico, o sistema escolhe quem responde. E gera relatórios sob demanda.",
                bullets: [
                  "Regulação, sono, comunicação",
                  "PDF ou link vivo",
                  "Pra terapeuta e escola",
                ],
              },
            ].map(({ icon: Icon, titulo, texto, bullets }) => (
              <div
                key={titulo}
                className="flex flex-col gap-4 rounded-2xl border border-purple-100/60 bg-white p-6 shadow-sm"
              >
                <div className="flex size-12 items-center justify-center rounded-full bg-purple-100">
                  <Icon className="size-6 text-brand-purple" aria-hidden />
                </div>
                <h3 className="font-heading text-xl font-bold text-gray-800">
                  {titulo}
                </h3>
                <p className="text-gray-600">{texto}</p>
                <ul className="mt-2 flex flex-col gap-2 text-sm text-gray-700">
                  {bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <Check
                        className="mt-0.5 size-4 shrink-0 text-emerald-500"
                        aria-hidden
                      />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING TEASER */}
      <section className="bg-white">
        <div className="mx-auto w-full max-w-7xl px-6 py-20 md:px-8">
          <div className="bg-brand-pricing relative overflow-hidden rounded-3xl p-10 text-white shadow-2xl md:p-16">
            <div className="grid items-center gap-10 md:grid-cols-[1.3fr_1fr]">
              <div>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium">
                  30 dias grátis · sem cartão
                </span>
                <h2 className="mt-4 font-heading text-3xl font-bold leading-tight md:text-5xl">
                  Comece sem risco. Pague só se valer.
                </h2>
                <p className="mt-4 max-w-lg text-lg text-white/90">
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
                        className="mt-0.5 size-5 shrink-0 text-emerald-300"
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
              <div className="rounded-2xl bg-white/10 p-8 backdrop-blur">
                <p className="text-sm uppercase tracking-wider text-white/70">
                  A partir de
                </p>
                <p className="mt-2 font-heading text-6xl font-extrabold">
                  R$ 98
                  <span className="text-xl font-normal text-white/70">/mês</span>
                </p>
                <p className="mt-2 text-sm text-white/70">
                  ou plano anual com ~2 meses grátis
                </p>
                <div className="mt-6 h-px w-full bg-white/20" />
                <ul className="mt-4 flex flex-col gap-2 text-sm">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand-yellow-light" aria-hidden />
                    <span>App + Ayla ilimitados</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand-yellow-light" aria-hidden />
                    <span>Relatórios pra terapeuta e escola</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand-yellow-light" aria-hidden />
                    <span>Suporte humano em PT-BR</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DEPOIMENTOS */}
      {depoimentos && depoimentos.length > 0 && (
        <section className="bg-white">
          <div className="mx-auto w-full max-w-7xl px-6 py-20 md:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-gray-800 md:text-5xl">
                Famílias que usam
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                Pessoas reais, contextos reais. Sem clichê.
              </p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {depoimentos.map((d) => (
                <figure
                  key={d.id}
                  className="flex flex-col gap-4 rounded-3xl bg-white p-8 shadow-md ring-1 ring-gray-100"
                >
                  <blockquote className="text-lg italic text-gray-700">
                    “{d.texto}”
                  </blockquote>
                  <figcaption className="mt-auto">
                    <p className="font-bold text-gray-900">{d.nome_publico}</p>
                    {d.perfil_resumo && (
                      <p className="text-sm text-gray-500">{d.perfil_resumo}</p>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="bg-white">
        <div className="mx-auto w-full max-w-4xl px-6 py-20 md:px-8">
          <h2 className="text-center font-heading text-3xl font-bold tracking-tight text-gray-800 md:text-5xl">
            Perguntas frequentes
          </h2>
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
                className="group rounded-2xl border border-gray-200 bg-white px-6 py-4 transition-colors hover:border-purple-200"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-heading font-semibold text-gray-900">
                  {q}
                  <span className="text-brand-purple transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-gray-600">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="bg-brand-hero relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-black/10" />
        <div className="relative mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-6 py-24 text-center md:px-8">
          <h2 className="font-heading text-3xl font-extrabold leading-tight tracking-tight text-white md:text-5xl">
            {gateBeta
              ? "Entre na lista de espera"
              : "Comece com 30 dias grátis"}
          </h2>
          <p className="max-w-xl text-lg text-white/90 md:text-xl">
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
