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
  /**
   * O ID DO TURNO — `RastroTurno.turno` (`tn_<base36>_<rand>`).
   *
   * ⚠️ POR QUE ELE PRECISOU EXISTIR AQUI. Na microprova de 11/09/2026 o
   * pareamento entre a extração da sombra e a do caminho atual foi feito por
   * PROXIMIDADE DE TIMESTAMP. Funcionou com 3 turnos e não escala: o debounce
   * agrupa mensagens, um turno pode levar 36 s e dois turnos consecutivos
   * distam segundos. Com 60 turnos, pareamento por relógio é adivinhação.
   *
   * É o MESMO id que `turno_externo` publica, então uma consulta cruza os dois
   * eventos sem heurística — e por ele se chega ao inbound, às chamadas de
   * modelo e ao desfecho do turno.
   */
  turnoId: string;
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
    /**
     * ⚠️ A FONTE EXTRAÍVEL É O TURNO, E SÓ O TURNO — PEND-200.
     *
     * Até 11/09/2026 esta linha concatenava `t.historico` aqui dentro. Os 12
     * turnos da bancada do Pedro mostraram o preço: 19 de 31 itens eram
     * repetição da janela, 5 dos 11 fatos novos se perderam, um desabafo puro
     * produziu 3 fatos — e, no pior caso, dois fatos da MANU saíram dentro de
     * um turno do Pedro, com o `membro_atipico_id` do Pedro.
     *
     * `t.entrada` já é a fala INTEIRA do turno: o orquestrador reatribui
     * `inbound.texto` para o texto do lote depois do debounce, então uma mãe
     * que manda três mensagens seguidas continua sendo um turno só, completo.
     */
    const transcript = `Responsável: ${t.entrada}`.slice(0, 8000);

    /**
     * O histórico continua indo — como CONTEXTO, em bloco próprio. Sem ele,
     * resposta curta ("sim", "já está na letra f") perde o sentido, e o
     * caminho atual saberia interpretá-la: `parseInbound` recebe
     * `<conversa_recente>` exatamente para isso. Tirar seria trocar um defeito
     * por outro.
     */
    const contextoRecente = t.historico
      .filter((m) => m.texto?.trim())
      .map((m) => `${m.de === "mae" ? "Responsável" : "Kolo"}: ${m.texto}`)
      .join("\n\n")
      .slice(0, 6000);

    const koloVivoResumo = await montarKoloVivoResumo(t.supabase, t.familyId, t.membroId);

    const proposta = await extrairAtualizacoes({
      transcript,
      contextoRecente,
      koloVivoResumo,
      membro: t.membro,
      supabase: t.supabase,
      familyId: t.familyId,
      via: t.via,
      // ⚠️ É CONTRA ISTO que cada citação é conferida — e é o turno atual.
      entradaNormalizada: t.entrada,
      /**
       * ⚠️ A ÂNCORA LIGADA, E É ELA QUE TORNA O VAZAMENTO IMPOSSÍVEL.
       *
       * Separar os blocos ORIENTA o modelo; `estrito` VERIFICA. Ele exige
       * `citacao` literal em cada item e `avaliarFatos` confere a citação
       * contra `entradaNormalizada` por substring normalizada
       * (`citacaoConfere`). Um fato lido do `<contexto_anterior>` não consegue
       * citar a fala de agora: sai como `citacao_nao_comprovada` ou
       * `citacao_ausente`, e não como fato.
       *
       * Na bancada do Pedro `n_rejeitados` foi ZERO nos 12 turnos — a guarda
       * existia, estava testada, e nunca tinha sido exercida porque o modo
       * `compativel` não pede citação. A sombra é o lugar certo para acender:
       * ela não escreve, e é justamente onde se mede antes de migrar.
       *
       * ⚠️ A WEB CONTINUA EM `compativel`. O modo não é alterado lá.
       */
      modo: "estrito",
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
        // ⚠️ PRIMEIRO CAMPO, de proposito: e a chave de cruzamento.
        turno: t.turnoId,
        via: t.via,
        // ⚠️ PEND-200 — distingue a execução ancorada da anterior sem depender
        // de saber de cabeça qual SHA servia o quê na hora da medição.
        modo: "estrito",
        escopo: "turno",
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
      payload: { turno: t.turnoId, via: t.via, ms: Date.now() - t0 },
    });
  }
}
