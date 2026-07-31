import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { logEvent } from "@/lib/log";
import { hojeLocalISO } from "@/lib/idade";
import { extrairTempoOriginal, normalizarDataCivil } from "./data-civil";
import { marcarDominiosSensiveis } from "./dominio-sensivel";
import {
  afirmacaoTemConteudo,
  classificarSujeito,
  sujeitoElegivel,
} from "./sujeito";
import {
  EXTRACTOR_VERSION,
  type CandidatoFato,
  type ResultadoRegistro,
} from "./tipos";

/**
 * SERVIÇO ÚNICO DE GRAVAÇÃO DO FACT STORE. Migração 0073.
 *
 * Existem hoje TRÊS implementações de escrita no perfil — `aplicar.ts`
 * (web manual e web automático), `orchestrator.ts` (WhatsApp) e
 * `incorporar.ts` (diário). Elas continuam como estão nesta rodada; o que
 * NÃO pode acontecer é a lógica nova nascer duplicada também. Por isso os três
 * caminhos chamam este arquivo, e só ele fala com `perfil_fatos`.
 *
 * O QUE ESTE SERVIÇO FAZ: valida, normaliza, calcula a chave de idempotência e
 * grava. Só isso.
 *
 * O QUE ELE NÃO FAZ, e é deliberado: não decide maturidade, não promove
 * observação a traço, não atualiza retrato, não toca em prompt, não muda
 * leitura. Generalizar exige recorrência, e recorrência é trabalho da
 * maturação — que não existe ainda e não deve ser improvisada aqui.
 */

export const FLAG_ENV = "PERFIL_FATOS_SHADOW_WRITE";

/**
 * Desligada por padrão. Com a flag off o serviço sai ANTES de qualquer I/O —
 * o sistema se comporta exatamente como antes, e o rollback é desligar a
 * variável.
 */
export function escritaSombraHabilitada(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const v = (env[FLAG_ENV] ?? "").trim().toLowerCase();
  return v === "1" || v === "true";
}

/** Normaliza a afirmação para comparação: sem acento, sem pontuação, caixa única. */
export function normalizarAfirmacao(texto: string): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A chave de idempotência.
 *
 * A composição é o que separa **reprocessamento técnico** de **repetição
 * legítima**, e essa distinção é o ponto mais delicado do serviço:
 *
 *  - COM mensagem de origem: a chave inclui o `messageId`. Reprocessar a mesma
 *    mensagem não duplica. Mas a mãe contando a mesma coisa noutro dia vem de
 *    OUTRA mensagem, gera outra chave, e entra — porque é evidência nova, e é
 *    dela que sai a recorrência que um dia promove um padrão.
 *  - SEM mensagem (edição de tela, diário): cai na DATA da observação. Duas
 *    edições iguais no mesmo dia colapsam; a mesma frase amanhã é nova.
 *
 * Se a chave usasse só (membro + conceito + afirmação), a repetição legítima
 * seria descartada como duplicata e a memória nunca acumularia recorrência —
 * o erro que mataria a maturação antes de ela existir.
 */
export function chaveIdempotencia(c: CandidatoFato, observadoEm: string): string {
  const base = [
    c.membroId ?? c.familyId,
    c.conceito,
    normalizarAfirmacao(c.afirmacao),
    EXTRACTOR_VERSION,
    c.proveniencia.messageId ? `msg:${c.proveniencia.messageId}` : `dia:${observadoEm}`,
  ].join("|");
  return createHash("sha256").update(base).digest("hex");
}

/** Afirmação curta demais não é fato — é ruído do extrator. */
const MIN_AFIRMACAO = 3;

/**
 * Grava um candidato. NUNCA lança: falha da escrita sombra não pode quebrar o
 * turno nem virar mensagem da Ayla. Mas também não some em silêncio — toda
 * falha é registrada como evento operacional, sem o texto do fato.
 */
export async function registrarFatoPerfil(
  supabase: SupabaseClient,
  candidato: CandidatoFato,
): Promise<ResultadoRegistro> {
  if (!escritaSombraHabilitada()) return { status: "ignorado", motivo: "flag_desligada" };

  // Fato sobre a pessoa acompanhada precisa saber de QUEM é. Sem membro, o
  // risco é associar ao perfil errado — que é uma das falhas de segurança que
  // esta rodada tem de impedir.
  if (!candidato.membroId) {
    await registrar("perfil_fato_ignorado", "info", candidato, { motivo: "sem_membro" });
    return { status: "ignorado", motivo: "sem_membro" };
  }

  const afirmacao = (candidato.afirmacao ?? "").trim();
  if (afirmacao.length < MIN_AFIRMACAO) {
    await registrar("perfil_fato_rejeitado", "info", candidato, { motivo: "afirmacao_curta" });
    return { status: "rejeitado", motivo: "afirmacao_curta" };
  }

  // BARREIRA DE CONTEUDO: elogio puro nao afirma nada verificavel e polui a
  // projecao para sempre. Piso deterministico - ver sujeito.ts.
  const conteudo = afirmacaoTemConteudo(afirmacao);
  if (!conteudo.ok) {
    await registrar("perfil_fato_rejeitado", "info", candidato, { motivo: conteudo.motivo });
    return { status: "rejeitado", motivo: conteudo.motivo };
  }

  // BARREIRA DE SUJEITO: perder um candidato incerto e preferivel a gravar um
  // fato na pessoa errada. Um fato perdido volta na proxima conversa; um fato
  // no perfil errado fica e e lido como verdade.
  // Quando o chamador resolveu o foco (`foco-membro.ts`), a decisão dele manda:
  // ela sabe da fonte do membro e do conflito de nomes, que este serviço não vê.
  // Sem resolução, cai na classificação de sujeito pelo texto.
  const sujeito =
    candidato.foco?.sujeito ??
    classificarSujeito({ texto: afirmacao, membroSelecionado: Boolean(candidato.membroId) });
  const decisao = candidato.foco?.decisao ?? (sujeitoElegivel(sujeito) ? "persistir" : "rejeitar");

  if (decisao === "rejeitar") {
    await registrar("perfil_fato_rejeitado", "info", candidato, {
      motivo: candidato.foco?.motivo ?? "sujeito_nao_elegivel",
      sujeito,
    });
    return { status: "rejeitado", motivo: `sujeito:${sujeito}` };
  }
  const emQuarentena = decisao === "quarentena";
  if (!candidato.conceito?.trim() || !candidato.dominio?.trim()) {
    await registrar("perfil_fato_rejeitado", "info", candidato, { motivo: "sem_conceito" });
    return { status: "rejeitado", motivo: "sem_conceito" };
  }

  // DATA CIVIL, normalizada aqui e nao pelo Postgres. Um ISO com hora seria
  // truncado em silencio pelo banco; aqui o truncamento e consciente e fica no
  // log. Data invalida cai para hoje em vez de derrubar o fato.
  const norm = normalizarDataCivil(candidato.observadoEm ?? hojeLocalISO());
  const observadoEm = norm.ok ? norm.data : hojeLocalISO();
  const truncouData = norm.ok && norm.truncou;
  const chave = chaveIdempotencia(candidato, observadoEm);

  // Inferência da IA nunca entra como relato. Se a proveniência diz
  // `ai_inference`, o status epistemológico é `inferred` — não há combinação
  // válida de "a IA deduziu" com "a família afirmou".
  const verification =
    candidato.proveniencia.sourceType === "ai_inference"
      ? "inferred"
      : (candidato.verificationStatus ?? "reported");

  const linha = {
    family_account_id: candidato.familyId,
    membro_atipico_id: candidato.membroId,
    conceito: candidato.conceito.trim(),
    dominio: candidato.dominio.trim(),
    afirmacao,
    contexto: candidato.contexto ?? null,
    fact_kind: candidato.factKind ?? "statement",
    observado_em: observadoEm,
    observado_em_preciso: candidato.observadoEmPreciso ?? false,
    // A expressao como a familia disse. Perdida na captura, nao volta.
    tempo_original: candidato.tempoOriginal ?? extrairTempoOriginal(afirmacao),
    // Marcador minimo de governanca. Nao decide nada hoje - so preserva a
    // possibilidade de identificar estes fatos depois.
    dominios_sensiveis: marcarDominiosSensiveis(afirmacao, candidato.dominio),
    escopo_tipo: candidato.escopo?.tipo ?? "sempre",
    escopo_id: candidato.escopo?.id ?? null,
    source_type: candidato.proveniencia.sourceType,
    source_actor_label: candidato.proveniencia.actorLabel ?? null,
    source_actor_id: candidato.proveniencia.actorId ?? null,
    source_channel: candidato.proveniencia.channel ?? null,
    source_message_id: candidato.proveniencia.messageId ?? null,
    source_conversation_id: candidato.proveniencia.conversationId ?? null,
    source_content_id: candidato.linhagem?.sourceContentId ?? null,
    extraction_run_id: candidato.linhagem?.extractionRunId ?? null,
    extractor_version: EXTRACTOR_VERSION,
    extraction_confidence: candidato.extractionConfidence ?? null,
    verification_status: verification,
    temporal_status: candidato.temporalStatus ?? "current",
    idempotency_key: chave,
    // QUARENTENA: gravado, auditável, e fora de toda leitura — os índices de
    // projeção filtram por `status = 'ativo'`.
    status: emQuarentena ? "quarentena" : "ativo",
    quarentena_motivo: emQuarentena ? (candidato.foco?.motivo ?? "sujeito_incerto") : null,
    sujeito_classificado: sujeito,
  };

  try {
    const { data, error } = await supabase
      .from("perfil_fatos")
      .upsert(linha, { onConflict: "idempotency_key", ignoreDuplicates: true })
      .select("id");

    if (error) {
      await registrar("perfil_fato_falhou", "warn", candidato, { erro: error.message.slice(0, 200) });
      return { status: "falhou", erro: error.message };
    }
    if (!data || data.length === 0) {
      await registrar("perfil_fato_duplicado", "info", candidato, {});
      return { status: "duplicado" };
    }

    if (emQuarentena) {
      await registrar("perfil_fato_quarentena", "info", candidato, {
        id: data[0].id,
        motivo: linha.quarentena_motivo,
        sujeito,
      });
      return {
        status: "quarentena",
        id: data[0].id as string,
        motivo: String(linha.quarentena_motivo),
      };
    }

    await registrar("perfil_fato_gravado", "info", candidato, {
      id: data[0].id,
      fact_kind: linha.fact_kind,
      verification_status: linha.verification_status,
      escopo_tipo: linha.escopo_tipo,
      // Sinal de qualidade da proveniência: quanto disso está entrando cego.
      sem_proveniencia: !linha.source_message_id && !linha.source_actor_label,
      // Correlacao para auditoria, sem conteudo.
      source_content_id: linha.source_content_id,
      extraction_run_id: linha.extraction_run_id,
      data_truncada: truncouData,
      sensiveis: linha.dominios_sensiveis,
    });
    return { status: "gravado", id: data[0].id as string };
  } catch (e) {
    await registrar("perfil_fato_falhou", "warn", candidato, {
      erro: e instanceof Error ? e.message.slice(0, 200) : "erro",
    });
    return { status: "falhou", erro: e instanceof Error ? e.message : "erro" };
  }
}

/**
 * Observabilidade sem conteúdo sensível: identificadores, conceito, tipos e
 * códigos. **Nunca a afirmação** — ela é conteúdo clínico sobre uma criança.
 */
async function registrar(
  kind: string,
  severity: "info" | "warn",
  c: CandidatoFato,
  payload: Record<string, unknown>,
): Promise<void> {
  await logEvent({
    kind,
    severity,
    family_account_id: c.familyId,
    payload: {
      membro_id: c.membroId,
      conceito: c.conceito,
      dominio: c.dominio,
      canal: c.proveniencia.channel,
      source_type: c.proveniencia.sourceType,
      ...payload,
    },
  }).catch(() => {});
}

/**
 * Registra vários candidatos. Falha de um não interrompe os outros — perder um
 * fato é melhor que perder o lote.
 */
export async function registrarFatosPerfil(
  supabase: SupabaseClient,
  candidatos: CandidatoFato[],
): Promise<ResultadoRegistro[]> {
  const out: ResultadoRegistro[] = [];
  for (const c of candidatos) {
    out.push(await registrarFatoPerfil(supabase, c));
  }
  return out;
}
