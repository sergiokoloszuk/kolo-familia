import type { SupabaseClient } from "@supabase/supabase-js";
import { extrairAtualizacoes } from "@/lib/conhecimento/extrair";
import type { Via } from "@/lib/conhecimento/fato";
import { montarKoloVivoResumo } from "@/lib/kolo-vivo/incorporar";
import { subcamposDe } from "@/lib/kolo-vivo/subcampos";
import { logEvent } from "@/lib/log";

/**
 * O EXTRATOR UNIFICADO EM SOMBRA — PEND-194, 10/09/2026.
 *
 * ── por que isto existe ───────────────────────────────────────────────────
 *
 * O WhatsApp aprende com DOIS modelos em sequência: `parseInbound` extrai UM
 * fato por turno, sem ver o perfil e sem dizer em que sub-campo ele mora, e
 * `rotearFatoSubcampo` gasta uma segunda chamada só para descobrir o lugar.
 * Quando o fato não encaixa, o roteador tem fallback declarado: **cai em
 * "Outras observações"**.
 *
 * MEDIDO EM PRODUÇÃO (30 dias até 10/09/2026, 143 incorporações com par
 * anterior para comparar): **16,1% dos fatos caem em `outras`**. E 274 de 274
 * incorporações do período vieram deste caminho — o extrator bom, o da web,
 * rodou 4 vezes.
 *
 * A consequência não é estética. O Gate B lê CAMPO ESTRUTURADO; o que mora em
 * `outras` ele não enxerga. Foi assim que, para uma criança cujo perfil diz
 * "Conversa bem" — dito pela mãe, guardado em `comunicacao.outras` —, o
 * decisor escolheu **contato visual** como a pergunta decisiva, e o Core teve
 * de ignorá-lo (PEND-192, turno real de 10/09 12:27).
 *
 * ── o que esta fase faz, e o que ela NÃO faz ──────────────────────────────
 *
 * ⚠️ ELA NÃO ESCREVE NADA NO PERFIL. Nem em `perfil_vivo_membro`, nem em
 * `sugestao_perfil_vivos`. Roda o extrator unificado sobre o MESMO turno que o
 * caminho atual acabou de processar e publica um evento com o que ele TERIA
 * feito. O caminho de produção continua sendo o de sempre, byte a byte.
 *
 * A razão é o §6 e o tamanho do alvo: este é o único canal por onde 99% do
 * Perfil Vivo cresce. Trocar o cérebro que aprende sobre as crianças sem antes
 * medir a troca no tráfego real seria apostar, não migrar.
 *
 * ⚠️ NENHUMA PALAVRA DA FAMÍLIA VAI PARA O EVENTO. Só chaves de campo,
 * contagens e motivos de recusa. O que a mãe escreveu já está em
 * `ayla_messages`, com o controle de acesso de lá; um evento de telemetria não
 * é lugar para repetir isso.
 *
 * ⚠️ FORA DO CAMINHO CRÍTICO. É chamado do mesmo bloco `void` que já roda
 * DEPOIS da bolha ter sido enviada. A família não espera um milissegundo, e a
 * falha aqui não pode derrubar turno nenhum.
 */

/**
 * A flag. Ausente = desligada, que é o estado em que isto entra no ar.
 *
 * ⚠️ A MESMA LEITURA DE `AYLA_EXPERIMENTAL_TODAS` E `AYLA_POS_TRIAL`, e isso
 * não é estilo: `1` **e** `true`, sem caixa, com `trim`, dentro de `try`. A
 * primeira versão daqui aceitava só `"1"` — inventei uma convenção própria num
 * repositório que já tinha uma, e o custo apareceu na hora: a variável foi
 * configurada em produção, o deploy subiu e o health respondeu `false`, sem
 * ninguém conseguir dizer se o erro era do painel, do nome ou do valor.
 */
export function extratorSombraLigado(): boolean {
  try {
    const v = (process.env.KOLO_EXTRATOR_SOMBRA ?? "").trim().toLowerCase();
    return v === "1" || v === "true";
  } catch {
    return false;
  }
}

export type TurnoParaSombra = {
  supabase: SupabaseClient;
  familyId: string;
  /** Sem criança resolvida não há fato de camada 1 — e não se adivinha dono. */
  membroId: string | null;
  membro: { nome: string; idade: number | null; perfil: string } | null;
  historico: ReadonlyArray<{ de: "mae" | "ayla"; texto: string }>;
  entrada: string;
  via: Via;
};

/**
 * O sub-campo é o "balde de sobra" do domínio?
 *
 * ⚠️ NÃO É `key === "outras"`. O que faz um campo ser o destino do fallback é
 * ser o ÚLTIMO da lista — é assim que `rotearFatoSubcampo` e `aplicarTextoCampo`
 * decidem. Em `sensorial` esse último se chama `outras`; em outro domínio pode
 * se chamar outra coisa amanhã, e a medição tem de continuar verdadeira.
 */
function ehBaldeDeSobra(campo: string, subcampo: string | null): boolean {
  const subs = subcamposDe(campo);
  if (!subs || subs.length === 0) return false;
  if (!subcampo) return true; // sem sub-campo declarado, cai no último
  return subs[subs.length - 1].key === subcampo;
}

export async function medirExtratorEmSombra(t: TurnoParaSombra): Promise<void> {
  if (!extratorSombraLigado()) return;
  // Sem criança o extrator só produziria camada 2, que não é o que esta
  // medição investiga — e o turno sem membro não alimenta o Gate B.
  if (!t.membroId || !t.membro) return;

  const t0 = Date.now();
  try {
    const transcript = [...t.historico, { de: "mae" as const, texto: t.entrada }]
      .map((m) => `${m.de === "mae" ? "Responsável" : "Kolo"}: ${m.texto}`)
      .join("\n\n")
      .slice(0, 8000);

    const koloVivoResumo = await montarKoloVivoResumo(t.supabase, t.familyId, t.membroId);

    const proposta = await extrairAtualizacoes({
      transcript,
      koloVivoResumo,
      membro: t.membro,
      supabase: t.supabase,
      familyId: t.familyId,
      via: t.via,
      entradaNormalizada: t.entrada,
      meta: { sombra: true },
    });

    const camada1 = proposta.koloVivo.filter((i) => i.camada === "camada1");
    const emBalde = camada1.filter((i) => ehBaldeDeSobra(i.campo, i.subcampo ?? null));
    const motivos: Record<string, number> = {};
    for (const r of proposta.rejeitados) motivos[r.motivo] = (motivos[r.motivo] ?? 0) + 1;

    await logEvent({
      kind: "extrator_sombra",
      family_account_id: t.familyId,
      persistir: true,
      message: `sombra: ${camada1.length} fato(s), ${emBalde.length} no balde de sobra`,
      payload: {
        via: t.via,
        membro_atipico_id: t.membroId,
        n_itens: proposta.koloVivo.length,
        n_camada1: camada1.length,
        // ⚠️ CHAVES, NUNCA VALORES. `campo.subcampo` diz onde o fato moraria;
        // o que ele diz sobre a criança fica fora daqui.
        chaves: camada1.map((i) => `${i.campo}.${i.subcampo ?? "(sem_subcampo)"}`),
        n_balde_de_sobra: emBalde.length,
        n_sem_subcampo: camada1.filter((i) => !i.subcampo).length,
        n_rejeitados: proposta.rejeitados.length,
        motivos_rejeicao: motivos,
        ms: Date.now() - t0,
      },
    });
  } catch (e) {
    // ⚠️ MEDIÇÃO NÃO DERRUBA TURNO. E a falha fica visível: uma sombra que
    // falha em silêncio produziria uma amostra enviesada sem ninguém saber.
    await logEvent({
      kind: "extrator_sombra_falhou",
      family_account_id: t.familyId,
      severity: "warn",
      persistir: true,
      message: e instanceof Error ? e.message : "erro desconhecido",
      payload: { via: t.via, ms: Date.now() - t0 },
    });
  }
}
