import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripeClient, STRIPE_PRICE, type PlanoTipo } from "@/lib/stripe/client";

/**
 * PLANOS — FONTE ÚNICA DO QUE CUSTA E DE COM QUE FREQUÊNCIA É COBRADO.
 *
 * ── o defeito que este arquivo existe para tornar impossível ───────────────
 *
 * Em 20/08/2026 o plano anual estava configurado no Stripe como
 * `recurring · month × 1` a R$ 603,90. Ou seja: quem clicasse em "Assinar
 * anual" seria cobrado **R$ 603,90 por mês**. A tela mostrava "R$ 603,90 / ano"
 * e estava certa em relação à sua própria fonte; o Stripe cobraria por mês e
 * também estava certo em relação à dele. Os dois "funcionavam".
 *
 * A causa raiz não foi o valor errado — foi **haver três fontes independentes
 * para a mesma informação, sem ninguém compará-las**:
 *
 *   1. o Stripe          → o que de fato seria cobrado;
 *   2. a env na Vercel   → QUAL price o checkout usa;
 *   3. `configuracao_precos` → o que as telas mostram.
 *
 * E quatro telas (`/precos`, `/assinatura`, o layout do app e o mapa do
 * `/ajuda`) faziam cada uma a sua própria consulta na tabela, com o seu próprio
 * formatador. Nada apontava para nada.
 *
 * ── a regra que este arquivo estabelece ───────────────────────────────────
 *
 * **O Stripe é o dono.** Preço e recorrência nascem lá e descem para cá.
 * `configuracao_precos` deixa de ser fonte e vira ESPELHO: escrito só por
 * `sincronizarPlanos`, nunca à mão. Um dono para cada decisão (§15 do
 * protocolo) — duas fontes para a mesma decisão sempre divergem, e foi
 * exatamente o que aconteceu.
 *
 * Por que espelho e não leitura direta do Stripe em cada tela: o layout do app
 * renderiza a cada navegação, e uma chamada de rede ao Stripe ali custaria
 * centenas de milissegundos em toda página. O espelho é lido do banco (barato)
 * e o que impede a divergência de virar cobrança errada é a trava do checkout,
 * abaixo, que confere contra o Stripe **ao vivo** antes de cobrar.
 *
 * ── as três defesas, em ordem de importância ──────────────────────────────
 *
 *   1. `exigirPlanoCobravel` — FAIL-CLOSED. O checkout se recusa a abrir se a
 *      recorrência não for a esperada. Sozinha, esta trava teria impedido o
 *      defeito de existir: mesmo com a env apontando para o price errado,
 *      ninguém é cobrado errado — o botão simplesmente para.
 *   2. `sincronizarPlanos` — o espelho se corrige sozinho, todo dia, e a
 *      divergência vira aviso no WhatsApp do admin (monitor diário).
 *   3. `/api/health` publica id, valor e recorrência de cada plano — "qual
 *      preço está no ar?" deixa de ser investigação e vira uma olhada.
 */

/** O que cada plano PRECISA ser no Stripe. Qualquer outra coisa é defeito. */
export const RECORRENCIA_ESPERADA: Record<PlanoTipo, "month" | "year"> = {
  mensal: "month",
  anual: "year",
};

/** A chave de cada plano na tabela-espelho `configuracao_precos`. */
export const CHAVE_ESPELHO: Record<PlanoTipo, string> = {
  mensal: "plano_mensal",
  anual: "plano_anual",
};

export const PLANOS: PlanoTipo[] = ["mensal", "anual"];

export type PlanoNoStripe = {
  plano: PlanoTipo;
  priceId: string | null;
  centavos: number | null;
  moeda: string | null;
  /** "month" | "year" | null (null = price avulso, não serve para assinatura). */
  intervalo: string | null;
  intervaloCount: number | null;
  ativo: boolean;
  /** A recorrência bate com a esperada E o price está utilizável? */
  ok: boolean;
  /** Em português, o que está errado. `null` quando está tudo certo. */
  problema: string | null;
};

/**
 * Lê UM plano direto do Stripe e julga se ele serve.
 *
 * Nunca lança: devolve `ok: false` com o motivo. Quem precisa de garantia usa
 * `exigirPlanoCobravel`, que lança de propósito.
 */
export async function lerPlanoNoStripe(plano: PlanoTipo): Promise<PlanoNoStripe> {
  const priceId = STRIPE_PRICE[plano] || null;
  const base: PlanoNoStripe = {
    plano,
    priceId,
    centavos: null,
    moeda: null,
    intervalo: null,
    intervaloCount: null,
    ativo: false,
    ok: false,
    problema: null,
  };

  if (!priceId) {
    return { ...base, problema: `STRIPE_PRICE_ID_${plano.toUpperCase()} não está configurada.` };
  }

  try {
    const price = await getStripeClient().prices.retrieve(priceId);
    const rec = price.recurring;
    const info: PlanoNoStripe = {
      ...base,
      centavos: price.unit_amount ?? null,
      moeda: price.currency ?? null,
      intervalo: rec?.interval ?? null,
      intervaloCount: rec?.interval_count ?? null,
      ativo: price.active === true,
      ok: false,
      problema: null,
    };

    const esperado = RECORRENCIA_ESPERADA[plano];
    if (!rec) {
      // Foi o segundo erro real, em 20/08: o price novo nasceu `one_time`. O
      // checkout abre em `mode: "subscription"` e o Stripe recusa — o botão
      // daria erro na cara da mãe em vez de cobrar errado.
      return { ...info, problema: `O price ${priceId} é avulso (one_time) e não serve para assinatura.` };
    }
    if (rec.interval !== esperado || (rec.interval_count ?? 1) !== 1) {
      // Foi o primeiro erro real: "anual" cobrando `month × 1`.
      return {
        ...info,
        problema: `O plano ${plano} deveria cobrar 1× por ${esperado === "year" ? "ano" : "mês"}, mas o price ${priceId} cobra ${rec.interval_count ?? 1}× por ${rec.interval}.`,
      };
    }
    if (!price.active) {
      return { ...info, problema: `O price ${priceId} está arquivado no Stripe.` };
    }
    if (price.unit_amount == null) {
      return { ...info, problema: `O price ${priceId} não tem valor fixo.` };
    }
    return { ...info, ok: true };
  } catch (e) {
    return {
      ...base,
      problema: `Não consegui ler o price ${priceId} no Stripe: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

/** Lê os dois planos no Stripe, em paralelo. */
export async function lerPlanosNoStripe(): Promise<Record<PlanoTipo, PlanoNoStripe>> {
  const [mensal, anual] = await Promise.all([
    lerPlanoNoStripe("mensal"),
    lerPlanoNoStripe("anual"),
  ]);
  return { mensal, anual };
}

/**
 * ⛔ A TRAVA. Chamada ANTES de abrir o checkout.
 *
 * Endpoint que move dinheiro é fail-closed (§16 do protocolo): na dúvida,
 * recusa. Recusar custa uma venda adiada; cobrar errado custa a confiança de
 * uma família e um estorno.
 */
export async function exigirPlanoCobravel(plano: PlanoTipo): Promise<PlanoNoStripe> {
  const info = await lerPlanoNoStripe(plano);
  if (!info.ok) {
    throw new Error(info.problema ?? `O plano ${plano} não está configurado corretamente.`);
  }
  return info;
}

export type PlanoParaExibir = {
  centavos: number | null;
  intervalo: string | null;
  priceId: string | null;
  sincronizadoEm: string | null;
};

export type PlanosParaExibir = Record<PlanoTipo, PlanoParaExibir>;

const VAZIO: PlanoParaExibir = {
  centavos: null,
  intervalo: null,
  priceId: null,
  sincronizadoEm: null,
};

/** Quanto tempo o espelho pode ficar sem sincronizar antes de eu desconfiar. */
const ESPELHO_VALIDO_HORAS = 24;

/**
 * ⚠️ Guarda de instância, não de concorrência.
 *
 * Se o cron diário parar, a primeira renderização de cada instância serverless
 * tenta ressincronizar sozinha. Sem esta trava, uma rajada de páginas abriria
 * uma chamada ao Stripe cada. Ela NÃO coordena entre instâncias (§8: cada
 * invocação é um processo novo) — e não precisa: o pior caso é uma chamada por
 * instância por vida, e a escrita é idempotente.
 */
let jaTenteiRessincronizar = false;

type AdminClient = SupabaseClient;

/**
 * O QUE AS TELAS MOSTRAM. Único leitor — as quatro telas passam por aqui.
 *
 * Lê o espelho. Se o espelho estiver velho ou incompleto, tenta ressincronizar
 * uma vez (best-effort: falhar aqui nunca pode derrubar a página).
 */
export async function lerPlanosParaExibir(admin: AdminClient): Promise<PlanosParaExibir> {
  let linhas = await lerEspelho(admin);

  const desatualizado = PLANOS.some((p) => {
    const l = linhas[p];
    if (!l.sincronizadoEm) return true;
    const idadeH = (Date.now() - new Date(l.sincronizadoEm).getTime()) / 3_600_000;
    return idadeH > ESPELHO_VALIDO_HORAS;
  });

  if (desatualizado && !jaTenteiRessincronizar) {
    jaTenteiRessincronizar = true;
    try {
      await sincronizarPlanos(admin);
      linhas = await lerEspelho(admin);
    } catch {
      /* best-effort: a página mostra o último valor conhecido */
    }
  }

  return linhas;
}

async function lerEspelho(admin: AdminClient): Promise<PlanosParaExibir> {
  const chaves = Object.values(CHAVE_ESPELHO);

  // ⚠️ SOBREVIVER ÀS DUAS ORDENS DE DEPLOY (§17 do protocolo).
  //
  // As colunas de procedência nascem na migração 0079. Se o código subir
  // ANTES dela — e neste repositório migração já ficou semanas pendente —, um
  // `select` com colunas inexistentes devolve erro, `data` vem null e o preço
  // some de TODAS as telas de uma vez. O valor em si (`valor_centavos`) é
  // antigo e sempre existe, então o degrau é: tenta completo, cai no mínimo.
  type LinhaEspelho = {
    chave?: unknown;
    valor_centavos?: unknown;
    intervalo?: unknown;
    stripe_price_id?: unknown;
    sincronizado_em?: unknown;
  };

  const completo = await admin
    .from("configuracao_precos")
    .select("chave, valor_centavos, intervalo, stripe_price_id, sincronizado_em")
    .in("chave", chaves);

  let data = completo.data as LinhaEspelho[] | null;
  if (completo.error) {
    const minimo = await admin
      .from("configuracao_precos")
      .select("chave, valor_centavos")
      .in("chave", chaves);
    data = minimo.data as LinhaEspelho[] | null;
  }

  const porChave = new Map((data ?? []).map((r) => [r.chave as string, r]));
  const saida = {} as PlanosParaExibir;
  for (const p of PLANOS) {
    const r = porChave.get(CHAVE_ESPELHO[p]);
    saida[p] = r
      ? {
          centavos: (r.valor_centavos as number | null) ?? null,
          intervalo: (r.intervalo as string | null) ?? null,
          priceId: (r.stripe_price_id as string | null) ?? null,
          sincronizadoEm: (r.sincronizado_em as string | null) ?? null,
        }
      : { ...VAZIO };
  }
  return saida;
}

export type ResultadoSincronizacao = {
  /** Planos cujo espelho mudou nesta rodada. */
  atualizados: PlanoTipo[];
  /** Problemas em português, prontos para ir ao WhatsApp do admin. */
  problemas: string[];
};

/**
 * O ESPELHO SE CORRIGE. Lê o Stripe e grava em `configuracao_precos`.
 *
 * Roda no monitor diário (`?tipo=healthcheck`) — que já existe, já roda todo
 * dia e já avisa um humano por WhatsApp quando algo está errado. Reusar o
 * mecanismo em vez de criar um cron novo é a ordem do §4 do protocolo.
 *
 * Plano com problema NÃO sobrescreve o espelho: um price quebrado não pode
 * apagar o último valor bom que as telas ainda estão mostrando. Ele vira aviso.
 */
export async function sincronizarPlanos(admin: AdminClient): Promise<ResultadoSincronizacao> {
  const doStripe = await lerPlanosNoStripe();
  const atualizados: PlanoTipo[] = [];
  const problemas: string[] = [];

  for (const p of PLANOS) {
    const info = doStripe[p];
    if (!info.ok) {
      problemas.push(info.problema ?? `Plano ${p} inválido.`);
      continue;
    }
    // ⚠️ Escrita conferida (§7): `.update()` do Supabase DEVOLVE o erro, não
    // lança. Um `await` sem checar engoliria a falha e o monitor diria "tudo
    // certo" sobre um espelho que não foi gravado.
    const { data, error } = await admin
      .from("configuracao_precos")
      .update({
        valor_centavos: info.centavos,
        moeda: (info.moeda ?? "brl").toUpperCase(),
        intervalo: info.intervalo,
        stripe_price_id: info.priceId,
        sincronizado_em: new Date().toISOString(),
      })
      .eq("chave", CHAVE_ESPELHO[p])
      .select("chave");

    if (error) {
      problemas.push(`Não consegui gravar o preço ${p} no espelho: ${error.message}`);
      continue;
    }
    if (!data || data.length === 0) {
      problemas.push(`A linha "${CHAVE_ESPELHO[p]}" não existe em configuracao_precos.`);
      continue;
    }
    atualizados.push(p);
  }

  return { atualizados, problemas };
}

const FORMATADOR_BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/**
 * Um formatador só. Antes eram quatro cópias, uma por tela — e cópia de
 * formatador é onde "R$ 54,90" vira "R$ 54,9" numa tela e não na outra.
 */
export function formatarBRL(centavos: number | null | undefined): string | null {
  if (centavos == null || !Number.isFinite(centavos)) return null;
  return FORMATADOR_BRL.format(centavos / 100);
}

export type EconomiaAnual = {
  /** Quanto se economiza no ano, em centavos. */
  centavos: number;
  /** Quantos meses de mensalidade isso representa. */
  meses: number;
  /** Percentual de desconto sobre 12 mensalidades. */
  pct: number;
};

/**
 * O DESCONTO É CALCULADO, NUNCA ESCRITO.
 *
 * `/precos` dizia "Economia ~20%" e "~2 meses grátis". Nenhum dos dois era
 * verdade: R$ 603,90 são exatamente 11 × R$ 54,90 — **1 mês grátis, 8,33%**.
 * Os números vieram de uma época em que o preço era outro e ninguém voltou no
 * texto, exatamente como o prazo defasado do template `trial_d3` (ver
 * `trial-texto.test.ts`). Número repetido em texto é número que defasa.
 *
 * Devolve `null` quando não há economia — assim a tela some com o selo em vez
 * de anunciar desconto negativo.
 */
export function economiaAnual(
  mensalCentavos: number | null | undefined,
  anualCentavos: number | null | undefined,
): EconomiaAnual | null {
  if (mensalCentavos == null || anualCentavos == null) return null;
  if (mensalCentavos <= 0 || anualCentavos <= 0) return null;
  const dozeMeses = mensalCentavos * 12;
  const economia = dozeMeses - anualCentavos;
  if (economia <= 0) return null;
  return {
    centavos: economia,
    meses: economia / mensalCentavos,
    pct: (economia / dozeMeses) * 100,
  };
}

/**
 * O selo do plano anual, em texto, derivado do preço real.
 *
 * Prefere falar em MESES quando dá um número redondo ("1 mês grátis"), porque
 * é o que a mãe entende sem fazer conta. Cai para percentual quando não dá.
 */
export function seloEconomiaAnual(
  mensalCentavos: number | null | undefined,
  anualCentavos: number | null | undefined,
): string | null {
  const e = economiaAnual(mensalCentavos, anualCentavos);
  if (!e) return null;
  const meses = Math.round(e.meses);
  if (meses >= 1 && Math.abs(e.meses - meses) < 0.05) {
    return meses === 1 ? "1 mês grátis" : `${meses} meses grátis`;
  }
  return `Economia de ${Math.round(e.pct)}%`;
}
