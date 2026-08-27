import { createClient } from "@/lib/supabase/server";
import {
  trialValido,
  trialVencido,
  type AcessoAssinatura,
} from "@/lib/auth/assinatura";

/**
 * O CTA DE `/precos` DEPENDE DE QUEM ESTÁ OLHANDO — 26/08/2026.
 *
 * ⚠️ O DEFEITO QUE ISTO CORRIGE, medido em produção. A Ayla manda o convite de
 * fim de teste com o link de `/precos` — que é a rota comercial correta. Só que
 * a página é pública e sempre mostrou o mesmo botão: **"Começar 7 dias grátis"
 * → `/signup`**. Uma família que já está no sétimo dia do teste clicava no
 * convite para assinar e chegava num convite para começar o teste que ela já
 * está fazendo. É o último passo do funil comercial oferecendo o primeiro.
 *
 * ⚠️ NÃO DUPLICA BILLING, E ISSO É O PONTO. O estado vem de
 * `subscription_accesses` pelas MESMAS funções que o resto do app usa
 * (`trialValido`, `trialVencido` em `lib/auth/assinatura`), e o destino de quem
 * já tem conta é `/assinatura` — que **já possui o checkout canônico**, com os
 * botões "Assinar mensal — R$ x/mês" e "Assinar anual", preço conferido antes
 * de abrir o Stripe. Reescrever o checkout aqui criaria uma segunda porta para
 * a mesma cobrança.
 *
 * ⚠️ PREÇO NÃO PASSA POR AQUI. Os valores continuam vindo de
 * `lerPlanosParaExibir`, na própria página. Este módulo decide **para onde
 * levar**, nunca **quanto custa**.
 *
 * ⚠️ FALHA É "VISITANTE". Sem sessão, com erro de leitura, ou com qualquer
 * dúvida, o resultado é o CTA público de sempre — que é o comportamento de
 * hoje, byte a byte. A página nunca deixa de renderizar por causa disto.
 */
export type EstadoComercial =
  /** Sem sessão — ou sessão que não resolve família. O público de sempre. */
  | "visitante"
  /** Autenticada, teste em curso. Veio para assinar, não para começar. */
  | "em_trial"
  /** Autenticada, teste acabou e não assinou. Também veio para assinar. */
  | "trial_vencido"
  /** Já paga. Não se oferece teste nem nova compra. */
  | "assinante";

export type CtaPrecos = {
  estado: EstadoComercial;
  /** O texto do botão. */
  rotulo: string;
  /** Para onde ele leva. */
  destino: string;
  /** Uma linha de contexto acima dos planos, quando há o que dizer. */
  nota: string | null;
  /**
   * A MANCHETE. ⚠️ Acrescentada em 27/08/2026, e a falta dela era metade do
   * defeito. A versão anterior tornou o **botão** e a **nota** conscientes de
   * estado e deixou o `<h1>` fixo em *"7 dias grátis pra sentir se vale"* —
   * então a família logada no sétimo dia via o botão certo debaixo de uma
   * manchete que vendia o teste que ela estava terminando.
   *
   * `titulo` é o texto em preto; `destaque` é a parte em roxo; `sub` é a linha
   * abaixo. Um teste MORDE a presença de "7 dias grátis" nos estados que já
   * têm conta.
   */
  hero: { titulo: string; destaque: string; sub: string };
};

/** A manchete de quem ainda não é cliente — a página pública de sempre. */
const HERO_VISITANTE = {
  titulo: "7 dias grátis",
  destaque: "pra sentir se vale",
  sub: "Sem cartão pra começar. Depois você decide.",
} as const;

/** O CTA de cada estado — puro, para poder ser testado sem banco nem sessão. */
export function ctaDoEstado(estado: EstadoComercial): CtaPrecos {
  switch (estado) {
    case "em_trial":
      return {
        estado,
        rotulo: "Continuar com a Kolo",
        // `/assinatura` é a tela que JÁ tem o checkout, com o preço conferido.
        destino: "/assinatura",
        nota: "Você já está no seu período de teste — aqui você escolhe como continuar.",
        hero: {
          titulo: "Escolha como",
          destaque: "continuar com a Kolo",
          sub: "Seu teste está em curso. Tudo que você registrou continua com você.",
        },
      };
    case "trial_vencido":
      return {
        estado,
        rotulo: "Continuar com a Kolo",
        destino: "/assinatura",
        nota: "Seu período de teste terminou. Tudo que você registrou continua salvo.",
        hero: {
          titulo: "Seu teste terminou.",
          destaque: "Continue de onde parou",
          sub: "Nada do que você registrou se perdeu.",
        },
      };
    case "assinante":
      return {
        estado,
        rotulo: "Ver minha assinatura",
        destino: "/assinatura",
        // ⚠️ NADA de "assine" para quem já assina. Quem paga chega aqui para
        // conferir o que tem, não para comprar de novo.
        nota: "Você já tem uma assinatura ativa.",
        hero: {
          titulo: "Sua assinatura",
          destaque: "está ativa",
          sub: "Aqui você confere seu plano quando quiser.",
        },
      };
    case "visitante":
    default:
      return {
        estado: "visitante",
        rotulo: "Começar 7 dias grátis",
        destino: "/signup",
        nota: null,
        hero: HERO_VISITANTE,
      };
  }
}

/**
 * Lê o estado comercial de quem está olhando a página.
 *
 * Uma consulta, e só quando há sessão. Visitante — que é a maioria do tráfego
 * de uma página pública — não paga nada.
 */
export async function estadoComercialDoVisitante(): Promise<EstadoComercial> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "visitante";

    const { data: family } = await supabase
      .from("family_accounts")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!family) return "visitante";

    const { data: sub } = await supabase
      .from("subscription_accesses")
      .select("status, trial_ends_at, cortesia, cortesia_ate")
      .eq("family_account_id", family.id as string)
      .maybeSingle();

    const acesso = (sub ?? null) as AcessoAssinatura | null;
    if (acesso?.status === "active") return "assinante";
    if (trialValido(acesso)) return "em_trial";
    if (trialVencido(acesso)) return "trial_vencido";
    // `past_due`, `paused`, `canceled` e o resto continuam vendo a página
    // pública. Eles têm tratamento próprio dentro do app, e inventar copy nova
    // para eles aqui seria mexer no que não foi medido.
    return "visitante";
  } catch {
    return "visitante";
  }
}
