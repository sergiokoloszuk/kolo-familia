import type { SupabaseClient } from "@supabase/supabase-js";
import { idadeAnos } from "@/lib/idade";
import { gerarConversacional, MODELO_CONVERSA } from "@/lib/ia/provider";
import { fronteiraAtravessada } from "@/lib/conducao/fronteiras";
import { logarUsoApi } from "@/lib/billing/logar";
import { resolverDocumento } from "./documentos";
import { montarContextoBase, lerPerfilVivo, pareceInformacao } from "./experimental-contexto";
import { resolverFoco, blocoDeFoco, type Foco } from "./experimental-foco";
import { lerEventos, eventosRelevantes, blocoDeEventos } from "./experimental-memoria";

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

/** Uma fala do histórico, já com o dono resolvido. */
type Fala = { direcao: string; texto: string | null; membro_atipico_id: string | null };

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
    foco: string;
    /** `admin` = documento publicado; `fallback` = Core do código. */
    coreOrigem: "admin" | "fallback";
    coreVersao: number | null;
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
  mensagem: string,
): Promise<{ bloco: string; foco: Foco; diagnosticoRegistrado: string; consultas: number }> {
  // As três leituras de abertura não dependem uma da outra: vão juntas.
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
      .select("direcao, texto, membro_atipico_id")
      .eq("family_account_id", familyId)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const lista = (membros ?? []) as Membro[];
  const foco = await resolverFoco(supabase, familyId, mensagem, lista);
  const emFoco = foco.membros;

  // Perfil Vivo e trajetória das crianças em foco — também em paralelo.
  const [perfis, eventos] = await Promise.all([
    Promise.all(emFoco.map((m) => lerPerfilVivo(supabase, m.id))),
    lerEventos(supabase, familyId, emFoco.map((m) => m.id)),
  ]);

  const nomeResponsavelBruto =
    (perfilFamilia as { como_chamar?: string; nome_mae?: string } | null)?.como_chamar ||
    (perfilFamilia as { nome_mae?: string } | null)?.nome_mae ||
    null;
  const nomeResponsavel = pareceInformacao(nomeResponsavelBruto) ? nomeResponsavelBruto : null;

  // ⚠️ UM RETRATO POR CRIANÇA EM FOCO. No foco compartilhado são dois blocos
  // separados, cada um com o nome na frente — é isso que permite "uma
  // brincadeira para os dois" sem que a característica de um vire fato do outro.
  const retratos: string[] = [];
  const lacunas = new Set<string>();
  emFoco.forEach((m, i) => {
    const membroCompleto = lista.find((x) => x.id === m.id) ?? null;
    const base = montarContextoBase({
      nomeResponsavel: i === 0 ? nomeResponsavel : null,
      membro: membroCompleto,
      perfilVivo: perfis[i] ?? null,
    });
    if (base.bloco) retratos.push(base.bloco);
    for (const l of base.lacunas) lacunas.add(l);
  });

  // ⚠️ O HISTÓRICO É ETIQUETADO, NÃO RECORTADO — mesma decisão de
  // `carregarHistorico` no legacy. Recortar mataria o multi-criança; deixar sem
  // dono foi o que produziu o caso Mario→Manu de 07/08/2026.
  const nomePorId = new Map(lista.map((m) => [m.id, m.nome ?? "?"]));
  const idsEmFoco = new Set(emFoco.map((m) => m.id));
  const historico = ((falas ?? []) as Fala[])
    .slice()
    .reverse()
    .filter((f) => (f.texto ?? "").trim())
    .map((f) => {
      const quem = f.direcao === "inbound" ? "Responsável" : "Ayla";
      const dono = f.membro_atipico_id;
      // Só etiqueta o que é de OUTRA criança: marcar a da vez em toda linha
      // vira ruído e ensina o modelo a repetir o nome.
      const sobre = dono && !idsEmFoco.has(dono) ? nomePorId.get(dono) : null;
      return sobre ? `${quem} (sobre ${sobre}): ${f.texto}` : `${quem}: ${f.texto}`;
    });

  const SEP = "\n\n";
  const NL = "\n";
  const bloco = [
    retratos.length ? `<o_que_ja_sabemos>${NL}${retratos.join(SEP)}${NL}</o_que_ja_sabemos>` : "",
    lacunas.size
      ? `<o_que_ainda_nao_sei>${[...lacunas].join(", ")}</o_que_ainda_nao_sei>`
      : "",
    blocoDeFoco(foco),
    blocoDeEventos(eventosRelevantes(eventos, mensagem)),
    historico.length
      ? `<conversa_recente>${NL}${historico.slice(-10).join(NL)}${NL}</conversa_recente>`
      : "",
  ]
    .filter(Boolean)
    .join(SEP);

  // ⚠️ O DIAGNÓSTICO VAI PARA A REDE DE FRONTEIRAS, não só para o prompt.
  // `fronteiraAtravessada` usa este bloco para saber o que a família JÁ
  // registrou — sem ele o detector proíbe a Ayla de confirmar um diagnóstico
  // que a própria mãe cadastrou. Omitir é o comportamento mais restritivo, e
  // restritivo demais também é defeito.
  const diagnosticoRegistrado = emFoco
    .map((m) => lista.find((x) => x.id === m.id)?.diagnosticos_formais)
    .flatMap((d) => (Array.isArray(d) ? d : d ? [d] : []))
    .map((d) => String(d).trim())
    .filter(Boolean)
    .join(", ");

  return { bloco, foco, diagnosticoRegistrado, consultas: 3 + emFoco.length + 1 };
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
    /** Só o simulador do Admin passa isto. A conversa real, nunca. */
    rascunhoCore?: { conteudo: string; versao: number } | null;
    /**
     * ⚠️ O SIMULADOR SE DECLARA. O gasto de token dele é real e tem de ser
     * registrado, mas somar o teste do Admin ao custo das famílias estragaria
     * a única métrica de custo por família que existe.
     */
    origem?: "conversa" | "simulador";
  },
): Promise<TurnoExperimental | null> {
  const t0 = Date.now();
  try {
    // O Core e o contexto não dependem um do outro: vão juntos, então a
    // leitura do documento não acrescenta espera nenhuma ao turno.
    const [ctxTurno, core] = await Promise.all([
      montarContexto(supabase, params.familyId, params.mensagem),
      resolverDocumento(supabase, "core", params.rascunhoCore ?? null),
    ]);
    const { bloco, foco, diagnosticoRegistrado, consultas } = ctxTurno;
    // A criança que a resposta vai carimbar: no foco compartilhado ou ambíguo
    // NÃO se escolhe uma — carimbar seria transformar palpite em dado.
    const membroDoTurno =
      foco.tipo === "individual" || foco.tipo === "unica" ? (foco.membros[0]?.id ?? null) : null;
    const msContexto = Date.now() - t0;

    // ⚠️ MESMO MODELO DA PRODUÇÃO. Trocar prompt E modelo ao mesmo tempo
    // tornaria impossível dizer qual dos dois mudou a conversa.
    const provider = "openai" as const;
    const model = MODELO_CONVERSA[provider];

    const tModelo = Date.now();
    const r = await gerarConversacional({
      provider,
      model,
      system: bloco ? `${core.conteudo}\n\n${bloco}` : core.conteudo,
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
    const vazamento = fronteiraAtravessada(texto, diagnosticoRegistrado || null);
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
      feature: params.origem === "simulador" ? "ayla_simulador" : "ayla_experimental",
      input_tokens: r.tokensIn,
      output_tokens: r.tokensOut,
    }).catch(() => {});

    return {
      texto,
      membroId: membroDoTurno,
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
        foco: foco.tipo,
        coreOrigem: core.origem,
        coreVersao: core.versao,
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
