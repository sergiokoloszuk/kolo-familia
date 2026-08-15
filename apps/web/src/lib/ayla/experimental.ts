import type { SupabaseClient } from "@supabase/supabase-js";
import { idadeAnos } from "@/lib/idade";
import { gerarConversacional, MODELO_CONVERSA } from "@/lib/ia/provider";
import { fronteiraAtravessada } from "@/lib/conducao/fronteiras";
import { logarUsoApi } from "@/lib/billing/logar";
import { AYLA_EXPERIMENTAL_PROMPT } from "./experimental-prompt";

/**
 * A AYLA EXPERIMENTAL — uma porta AO LADO da Ayla atual, 15/08/2026.
 *
 * ⚠️ O QUE ISTO É, E O QUE NÃO É. Não é migração, não é refatoração e não
 * substitui nada. A Ayla atual continua inteira, intocada, e é o CONTROLE. Este
 * módulo existe para responder uma pergunta só:
 *
 *   "Como fica a experiência se a conversa passar direto por um prompt novo,
 *    curto, com o contexto essencial da criança e o histórico recente?"
 *
 * ⚠️ O CAMINHO É CURTO DE PROPÓSITO. Passar pela arquitetura atual e só trocar
 * o prompt no fim não testaria hipótese nenhuma — testaria o prompt dentro da
 * mesma condução. Aqui o turno PULA `classificarIntencao`, `parseInbound`, a
 * cascata de portões conversacionais, o núcleo de `diretrizes.ts`, as lentes e
 * a recuperação de Boas Práticas. O que ele pula está medido no relatório.
 *
 * ⚠️ O QUE **NÃO** É PULADO, e não pode ser: identidade da família, acesso,
 * idempotência do inbound, isolamento entre famílias e a REDE DE FRONTEIRAS na
 * saída. O streaming ingênuo não volta — a inspeção precisa do texto inteiro
 * em memória, e é por isso que ela existe.
 */

/**
 * QUEM ENTRA — allowlist explícita por `family_account_id`.
 *
 * ⚠️ FAIL CLOSED, e o formato é o mesmo de `familiasDeTeste()` em
 * `provider.ts`: variável ausente, vazia, id fora da lista, id não-string ou
 * qualquer erro → **false**, ou seja, Ayla atual. Nenhuma família entra por
 * inferência, por texto da mensagem, por nome ou por regex.
 *
 * A lista vazia significa "ninguém", nunca "todo mundo" — é o mesmo cuidado
 * documentado no seletor de provider: a variável não pode ser o que SEGURA o
 * rollout, senão apagá-la por engano promove todas as famílias.
 */
export function familiasExperimentais(): string[] {
  try {
    return (process.env.AYLA_EXPERIMENTAL_FAMILY_IDS ?? "")
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Esta família conversa com a Ayla experimental? */
export function ehFamiliaExperimental(familyAccountId?: string | null): boolean {
  try {
    const id = typeof familyAccountId === "string" ? familyAccountId.trim() : "";
    if (!id) return false;
    return familiasExperimentais().includes(id);
  } catch {
    // Erro ao ler configuração NUNCA manda família real para o experimento.
    return false;
  }
}

type Membro = {
  id: string;
  nome: string | null;
  data_nascimento: string | null;
  perfil: string | null;
  diagnosticos_formais: string | null;
};

export type TurnoExperimental = {
  texto: string;
  membroId: string | null;
  /** Medição do turno — ver `ayla_path` no relatório da PEND-064. */
  metrica: {
    consultasBanco: number;
    chamadasLLM: number;
    tokensEntrada: number;
    tokensSaida: number;
    msContexto: number;
    msModelo: number;
    msInspecao: number;
    msTotal: number;
    modelo: string;
    provider: string;
    fronteiraBarrou: boolean;
  };
};

/**
 * O CONTEXTO ESSENCIAL — pequeno de propósito.
 *
 * ⚠️ NÃO é o Kolo Vivo inteiro. A instrução foi começar pequeno: nome de quem
 * cuida, nome e idade da criança, o que o perfil já diz dela, diagnóstico
 * registrado (que a rede de fronteiras também lê) e o histórico recente. Se
 * faltar alguma coisa que importe, isso vira ACHADO do experimento — não
 * motivo para carregar tudo "por precaução".
 */
async function montarContexto(
  supabase: SupabaseClient,
  familyId: string,
  membroPreferido: string | null,
): Promise<{ bloco: string; membro: Membro | null; consultas: number }> {
  // As três leituras não dependem uma da outra: vão juntas.
  const [{ data: perfilFamilia }, { data: membros }, { data: falas }] = await Promise.all([
    supabase
      .from("family_profiles")
      .select("nome_mae, como_chamar")
      .eq("family_account_id", familyId)
      .maybeSingle(),
    supabase
      .from("membros_atipicos")
      .select("id, nome, data_nascimento, perfil, diagnosticos_formais")
      .eq("family_account_id", familyId)
      .eq("ativo", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("ayla_messages")
      .select("direcao, texto, created_at")
      .eq("family_account_id", familyId)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const lista = (membros ?? []) as Membro[];
  // Preferido (quando o turno já sabe de quem se fala) → único → nenhum.
  const membro =
    (membroPreferido ? lista.find((m) => m.id === membroPreferido) : null) ??
    (lista.length === 1 ? lista[0] : null);

  const nomeResponsavel =
    (perfilFamilia as { como_chamar?: string; nome_mae?: string } | null)?.como_chamar ||
    (perfilFamilia as { nome_mae?: string } | null)?.nome_mae ||
    null;

  const partes: string[] = [];
  if (nomeResponsavel) partes.push(`Responsável: ${nomeResponsavel}`);
  if (membro) {
    const idade = idadeAnos(membro.data_nascimento);
    partes.push(
      `Criança: ${membro.nome ?? "(sem nome)"}${idade != null ? `, ${idade} anos` : ""}`,
    );
    if (membro.diagnosticos_formais) {
      partes.push(`Diagnóstico informado pela família: ${membro.diagnosticos_formais}`);
    }
    if (membro.perfil) partes.push(`O que já sabemos: ${membro.perfil}`);
  } else if (lista.length > 1) {
    // Multi-criança sem foco resolvido: dizer a verdade ao modelo é melhor que
    // escolher um filho por conta própria.
    partes.push(
      `Crianças cadastradas: ${lista.map((m) => m.nome ?? "?").join(", ")} (ainda não sei de qual a pessoa está falando neste turno)`,
    );
  }

  // Histórico recente, do mais antigo para o mais novo, sem a fala atual.
  const historico = ((falas ?? []) as Array<{ direcao: string; texto: string | null }>)
    .slice()
    .reverse()
    .filter((f) => (f.texto ?? "").trim())
    .map((f) => `${f.direcao === "inbound" ? "Responsável" : "Ayla"}: ${f.texto}`);

  const bloco = [
    partes.length ? `<o_que_ja_sabemos>\n${partes.join("\n")}\n</o_que_ja_sabemos>` : "",
    historico.length
      ? `<conversa_recente>\n${historico.slice(-10).join("\n")}\n</conversa_recente>`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { bloco, membro, consultas: 3 };
}

/**
 * O TURNO EXPERIMENTAL — contexto → prompt novo → modelo → fronteira.
 *
 * Devolve `null` quando não conseguiu responder; o chamador decide o que fazer
 * (hoje: cair para a Ayla atual, que é o comportamento seguro).
 */
export async function responderExperimental(
  supabase: SupabaseClient,
  params: {
    familyId: string;
    mensagem: string;
    membroPreferido?: string | null;
  },
): Promise<TurnoExperimental | null> {
  const t0 = Date.now();
  try {
    const { bloco, membro, consultas } = await montarContexto(
      supabase,
      params.familyId,
      params.membroPreferido ?? null,
    );
    const msContexto = Date.now() - t0;

    // ⚠️ MESMO MODELO DA PRODUÇÃO. Trocar prompt E modelo ao mesmo tempo
    // tornaria impossível dizer qual dos dois mudou a conversa.
    const provider = "openai" as const;
    const model = MODELO_CONVERSA[provider];

    const tModelo = Date.now();
    const r = await gerarConversacional({
      provider,
      model,
      system: bloco ? `${AYLA_EXPERIMENTAL_PROMPT}\n\n${bloco}` : AYLA_EXPERIMENTAL_PROMPT,
      messages: [{ role: "user", content: params.mensagem }],
      maxTokens: 1200,
      cacheSystem: true,
    });
    const msModelo = Date.now() - tModelo;

    const texto = (r.texto ?? "").trim();
    if (!texto) return null;

    // ⚠️ A REDE DE FRONTEIRAS CONTINUA. Ela é a razão de o streaming ter saído:
    // sem o instante em que a resposta inteira está em memória, não há onde
    // inspecionar o que vai sair. Foi por aí que uma mãe recebeu um diagnóstico
    // informal em produção — e o experimento não reabre esse buraco.
    const tInspecao = Date.now();
    const vazamento = fronteiraAtravessada(texto, membro?.diagnosticos_formais ?? null);
    const msInspecao = Date.now() - tInspecao;
    if (vazamento) {
      console.warn(
        `[ayla:experimental] fronteira barrou a resposta (${vazamento.fronteira.nome}) — caindo pro fluxo atual`,
      );
      return null;
    }

    await logarUsoApi(supabase, {
      family_account_id: params.familyId,
      provider,
      model,
      feature: "ayla_experimental",
      input_tokens: r.tokensIn,
      output_tokens: r.tokensOut,
    }).catch(() => {});

    return {
      texto,
      membroId: membro?.id ?? null,
      metrica: {
        consultasBanco: consultas,
        chamadasLLM: 1,
        tokensEntrada: r.tokensIn,
        tokensSaida: r.tokensOut,
        msContexto,
        msModelo,
        msInspecao,
        msTotal: Date.now() - t0,
        modelo: model,
        provider,
        fronteiraBarrou: false,
      },
    };
  } catch (e) {
    // Qualquer erro no experimento devolve a conversa para a Ayla atual.
    console.warn(
      "[ayla:experimental] falhou, caindo pro fluxo atual:",
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}
