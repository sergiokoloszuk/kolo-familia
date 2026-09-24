import type { SupabaseClient } from "@supabase/supabase-js";
import { montarContextoDeSecoes, respondAsOutputType } from "@/lib/ia/engine";
import {
  RAMOS_APROFUNDAMENTO,
  type RamoAprofundamento,
} from "./aprofundamento-tipos";

export {
  RAMOS_APROFUNDAMENTO,
  type RamoAprofundamento,
} from "./aprofundamento-tipos";
export { aprofundamentoGlobalLigado } from "./aprofundamento-tipos";

const RAMOS = new Set<string>(RAMOS_APROFUNDAMENTO);

export const APROFUNDAMENTOS: Record<
  RamoAprofundamento,
  { label: string; outputType: string; receita: string }
> = {
  aprofundar_lidar: {
    label: "Como lidar agora",
    outputType: "o_que_fazer_diferente",
    receita: `Este ramo é MANEJO daquela situação concreta: o que fazer nela,
não uma brincadeira para desenvolver a habilidade nem uma leitura de crenças.
Aprofunde SOMENTE o caso que originou esta escolha. Toda afirmação
deve estar ancorada no relato, no Perfil ou no histórico; não contradiga fatos
do caso e não complete lacunas por imaginação. A família já
leu a primeira resposta: não repita hipótese, ação ou frase que ela já recebeu.

Entregue uma orientação prática e personalizada, não uma aula. Quando couber:
- uma hipótese útil em linguagem simples, sempre como possibilidade;
- o que o adulto pode fazer agora e o que vale evitar;
- uma frase literal, curta e natural para usar na situação;
- um sinal observável de que o ajuste está ajudando;
- uma alternativa pequena se a primeira tentativa não funcionar.

Não reabra a investigação antes de ajudar. Selecione o próximo passo de maior
valor para esta criança. Prefira 120–180 palavras; ultrapasse apenas se uma
informação indispensável não couber. Evite palavras de alarme em casos comuns.`,
  },
  aprofundar_brincar: {
    label: "Brincar / passear",
    outputType: "brincadeiras",
    receita: `Este ramo é uma EXPERIÊNCIA COMPARTILHADA para viver ou desenvolver
a habilidade com vínculo e prazer; não reembale o manejo da situação.
Crie UMA ideia principal muito boa para o caso que originou esta
escolha. Toda decisão deve estar ancorada no relato, no Perfil ou no histórico;
não contradiga fatos do caso nem invente uma dificuldade. A família já leu a
primeira resposta: a ideia precisa avançar o caso,
não reembalar a mesma ação numa atividade mais longa. O interesse da
criança deve mudar a mecânica, os papéis, as escolhas ou a forma de interação —
nunca apenas decorar o nome da brincadeira.

Inclua de forma compacta e reconhecível: título; materiais simples, quando houver;
tempo aproximado; como começar; turno do adulto; turno da criança; frases
úteis; objetivo de hoje; e como facilitar se ficar difícil. Não precisa exibir
todos esses rótulos, mas uma mãe cansada deve conseguir imaginar e executar a
brincadeira sem inventar o restante. Só então, se couber, diga como aumentar o desafio
e quando parar. Não acrescente segunda ideia. Se uma
experiência de vida real for melhor, proponha um passeio cotidiano com vínculo,
prazer e participação conjunta — sem transformar o passeio em terapia.

Respeite comunicação, sensibilidades, habilidades, dificuldades, rotina,
pré-requisitos e o que já funcionou. Não faça pergunta antes de entregar.
Nunca ignore, atrase ou teste um sinal de “não”, “para”, recuo ou desconforto;
aumentar o desafio significa manter segurança e previsibilidade, não provocar.
Prefira 150–220 palavras e elimine introduções, separadores e repetições.`,
  },
  aprofundar_crencas: {
    label: "Crenças + falas",
    outputType: "crencas",
    receita: `Este ramo é sobre POSSÍVEIS INTERPRETAÇÕES da criança e do adulto
e novas formas de pensar, falar e agir; não repita o manejo com outra embalagem.
Aprofunde o caso em duas lentes curtas e responsáveis. Toda
possibilidade deve estar ancorada em um fato explícito do relato, Perfil ou
histórico; não contradiga o caso, não invente o que aconteceu antes/depois e
não preencha lacunas. A família já leu a primeira resposta: não repita a
hipótese ou a fala que ela já recebeu.
Ignore qualquer formato genérico que peça uma lista de várias crenças.

CRIANÇA: descreva somente como possibilidade o que ela pode estar interpretando,
o que queremos ajudá-la a construir e 2–3 frases concretas para o adulto usar.

ADULTO: descreva somente como possibilidade um pensamento que pode aumentar a
pressão, ofereça uma perspectiva mais útil, uma frase-âncora para o adulto e
como essa perspectiva muda a forma de falar E agir. Quando pertinente, oriente
menos palavras, voz mais
estável, menor velocidade e regulação antes de ensinar.

Não diagnostique, não atribua intenção e não afirme que a mãe pensa algo sem
evidência. Não faça pergunta. Entregue somente CRIANÇA, ADULTO e uma ação curta
para testar; frases à criança também devem ser afirmativas, sem interrogação.
Prefira 130–190 palavras. A escolha precisa gerar valor novo.`,
  },
};

export type EntradaDecisaoAprofundamento = {
  ligado: boolean;
  candidatos: readonly string[];
  segurancaAberta: boolean;
  naturezaEmocional: "neutra" | "desabafo" | null;
  naturezaDoTurno: string | null;
  fezPergunta: boolean;
  miniInvestigacao: boolean;
  conviteConcorrente: boolean;
  ofertaRecente: boolean;
};

export type DecisaoAprofundamento =
  | { acao: "OFERECER"; opcoes: RamoAprofundamento[]; motivo: string }
  | { acao: "NAO_OFERECER"; opcoes: []; motivo: string };

/**
 * O ponto de interrogação pode pertencer a uma frase que o adulto deve usar
 * ("Posso brincar?"). Só tratamos como pergunta à família quando a fala
 * termina pedindo resposta; os campos estruturados continuam sendo a fonte
 * principal para perguntas declaradas.
 */
export function respostaPedeRetornoDaFamilia(texto: string): boolean {
  return texto.trimEnd().endsWith("?");
}

/** Portão conservador. O modelo sugere; o código decide se pode aparecer. */
export function decidirAprofundamento(
  e: EntradaDecisaoAprofundamento,
): DecisaoAprofundamento {
  const nao = (motivo: string): DecisaoAprofundamento => ({
    acao: "NAO_OFERECER",
    opcoes: [],
    motivo,
  });
  if (!e.ligado) return nao("flag global desligada");
  if (e.segurancaAberta) return nao("segurança/crise aberta");
  if (e.naturezaEmocional === "desabafo") return nao("desabafo pede acolhimento");
  if (e.naturezaEmocional !== "neutra") return nao("natureza emocional desconhecida");
  if (e.naturezaDoTurno !== "orientacao") return nao("turno não pede bifurcação");
  if (e.fezPergunta) return nao("a Ayla já abriu uma pergunta");
  if (e.miniInvestigacao) return nao("mini-investigação e menu não se acumulam");
  if (e.conviteConcorrente) return nao("já existe outro convite no turno");
  if (e.ofertaRecente) return nao("oferta recente — evita menu mecânico");

  const opcoes = [...new Set(e.candidatos)]
    .filter((v): v is RamoAprofundamento => RAMOS.has(v))
    .slice(0, 3);
  if (opcoes.length < 2) return nao("menos de dois caminhos realmente úteis");
  return { acao: "OFERECER", opcoes, motivo: "dois ou mais caminhos úteis" };
}

const ID_PREFIXO = "ak1";

export function idDoBotao(ofertaId: string, ramo: RamoAprofundamento): string {
  return `${ID_PREFIXO}:${ofertaId}:${ramo}`;
}

export function lerIdDoBotao(
  id: string | null | undefined,
): { ofertaId: string; ramo: RamoAprofundamento } | null {
  const partes = (id ?? "").split(":");
  if (partes.length !== 3 || partes[0] !== ID_PREFIXO) return null;
  const ofertaId = partes[1];
  const ramo = partes[2];
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ofertaId)) {
    return null;
  }
  return RAMOS.has(ramo) ? { ofertaId, ramo: ramo as RamoAprofundamento } : null;
}

function normalizarEscolha(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function ramoDoFallback(
  texto: string,
  opcoes: readonly string[],
): RamoAprofundamento | null {
  const t = normalizarEscolha(texto);
  const aliases: Record<RamoAprofundamento, string[]> = {
    aprofundar_lidar: ["como lidar agora", "como lidar", "lidar"],
    aprofundar_brincar: ["brincar passear", "brincar", "passear"],
    aprofundar_crencas: ["crencas falas", "crencas", "falas"],
  };
  for (const ramo of RAMOS_APROFUNDAMENTO) {
    if (!opcoes.includes(ramo)) continue;
    if (aliases[ramo].includes(t)) return ramo;
  }
  return null;
}

export function textoDaOferta(opcoes: readonly RamoAprofundamento[]): string {
  const temLidar = opcoes.includes("aprofundar_lidar");
  const temBrincar = opcoes.includes("aprofundar_brincar");
  const temCrencas = opcoes.includes("aprofundar_crencas");
  if (temLidar && temBrincar && !temCrencas) {
    return "Se quiser, posso seguir pelo que fazer na hora ou por uma brincadeira para trabalhar isso sem virar tarefa.";
  }
  if (temLidar && temCrencas && !temBrincar) {
    return "Se quiser, posso aprofundar o que fazer na hora ou pensar nas interpretações e falas que podem ajudar.";
  }
  if (temBrincar && temCrencas && !temLidar) {
    return "Se quiser, posso transformar isso numa experiência leve ou pensar nas interpretações e falas envolvidas.";
  }
  return "Se quiser, posso continuar por três caminhos diferentes.";
}

export function textoDoFallback(opcoes: readonly RamoAprofundamento[]): string {
  const labels = opcoes.map((o) => `“${APROFUNDAMENTOS[o].label}”`);
  const final = labels.length === 2
    ? `${labels[0]} ou ${labels[1]}`
    : `${labels.slice(0, -1).join(", ")} ou ${labels.at(-1)}`;
  return `${textoDaOferta(opcoes)} Se os botões não aparecerem, pode me responder ${final}.`;
}

export async function existeOfertaRecente(
  supabase: SupabaseClient,
  familyId: string,
  agora = new Date(),
): Promise<boolean> {
  const desde = new Date(agora.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("ayla_aprofundamento_ofertas")
    .select("id")
    .eq("family_account_id", familyId)
    .neq("status", "falhou")
    .gte("created_at", desde)
    .limit(1);
  // Falha fechada: indisponibilidade do estado não pode virar menu repetido.
  if (error) return true;
  return Boolean(data?.length);
}

export async function criarOferta(
  supabase: SupabaseClient,
  params: {
    familyId: string;
    membroId: string | null;
    sourceInboundId: string;
    sourceOutboundId: string;
    opcoes: RamoAprofundamento[];
  },
): Promise<string> {
  const { data, error } = await supabase
    .from("ayla_aprofundamento_ofertas")
    .insert({
      family_account_id: params.familyId,
      membro_atipico_id: params.membroId,
      source_inbound_message_id: params.sourceInboundId,
      source_outbound_message_id: params.sourceOutboundId,
      opcoes: params.opcoes,
      status: "preparada",
    })
    .select("id")
    .single();
  if (error || !data?.id) {
    throw new Error(`Não foi possível reservar a oferta: ${error?.message ?? "sem id"}`);
  }
  return data.id as string;
}

export async function atualizarOferta(
  supabase: SupabaseClient,
  ofertaId: string,
  patch: Record<string, unknown>,
  statusEsperado?: string,
): Promise<boolean> {
  let q = supabase
    .from("ayla_aprofundamento_ofertas")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", ofertaId);
  if (statusEsperado) q = q.eq("status", statusEsperado);
  const { data, error } = await q.select("id");
  if (error) throw new Error(`Falha ao atualizar oferta: ${error.message}`);
  return Boolean(data?.length);
}

type OfertaReivindicada = {
  oferta_id: string;
  membro_atipico_id: string | null;
  source_inbound_message_id: string;
  source_outbound_message_id: string;
  opcoes: string[];
  criada_em: string;
};

export async function reivindicarOferta(
  supabase: SupabaseClient,
  params: {
    ofertaId: string;
    familyId: string;
    ramo: RamoAprofundamento;
    inboundEscolhaId: string;
    referenceMessageId?: string;
  },
): Promise<OfertaReivindicada | null> {
  const { data, error } = await supabase.rpc("reivindicar_aprofundamento_ayla", {
    p_oferta_id: params.ofertaId,
    p_family_account_id: params.familyId,
    p_ramo: params.ramo,
    p_inbound_escolha_id: params.inboundEscolhaId,
    p_reference_message_id: params.referenceMessageId ?? null,
  });
  if (error) throw new Error(`Falha ao reivindicar oferta: ${error.message}`);
  return ((data ?? [])[0] as OfertaReivindicada | undefined) ?? null;
}

export async function buscarFallbackPendente(
  supabase: SupabaseClient,
  familyId: string,
): Promise<{ id: string; opcoes: string[] } | null> {
  const { data, error } = await supabase
    .from("ayla_aprofundamento_ofertas")
    .select("id, opcoes")
    .eq("family_account_id", familyId)
    .eq("canal", "texto")
    .eq("status", "oferecida")
    .gt("expira_em", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar fallback: ${error.message}`);
  return data ? { id: data.id as string, opcoes: (data.opcoes ?? []) as string[] } : null;
}

/** Marca somente a primeira fala posterior ao aprofundamento. */
export async function registrarSeguimentoAprofundamento(
  supabase: SupabaseClient,
  params: { familyId: string; recebidaEm: Date },
): Promise<string | null> {
  const { data: pendente, error: leituraErro } = await supabase
    .from("ayla_aprofundamento_ofertas")
    .select("id")
    .eq("family_account_id", params.familyId)
    .eq("status", "respondida")
    .is("seguimento_em", null)
    .lt("respondida_em", params.recebidaEm.toISOString())
    .order("respondida_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (leituraErro) throw new Error(`Falha ao buscar seguimento: ${leituraErro.message}`);
  if (!pendente?.id) return null;
  const { data, error } = await supabase
    .from("ayla_aprofundamento_ofertas")
    .update({ seguimento_em: params.recebidaEm.toISOString(), updated_at: new Date().toISOString() })
    .eq("id", pendente.id)
    .is("seguimento_em", null)
    .select("id");
  if (error) throw new Error(`Falha ao marcar seguimento: ${error.message}`);
  return data?.length ? (pendente.id as string) : null;
}

export async function gerarRespostaAprofundada(
  supabase: SupabaseClient,
  params: {
    familyId: string;
    membroId: string | null;
    sourceInboundId: string;
    sourceOutboundId: string;
    ramo: RamoAprofundamento;
  },
): Promise<{
  texto: string;
  outputType: string;
  repertorio: { skills: string[]; boasPraticasIds: string[] };
}> {
  const ids = [params.sourceInboundId, params.sourceOutboundId];
  const { data: mensagens, error: mensagensErro } = await supabase
    .from("ayla_messages")
    .select("id, direcao, texto, membro_atipico_id")
    .eq("family_account_id", params.familyId)
    .in("id", ids);
  if (mensagensErro) throw new Error(`Falha ao carregar o turno: ${mensagensErro.message}`);
  const inbound = mensagens?.find((m) => m.id === params.sourceInboundId && m.direcao === "inbound");
  const outbound = mensagens?.find((m) => m.id === params.sourceOutboundId && m.direcao === "outbound");
  if (!inbound?.texto || !outbound?.texto) throw new Error("Turno de origem incompleto.");

  const config = APROFUNDAMENTOS[params.ramo];
  const { data: tipo, error: tipoErro } = await supabase
    .from("output_types")
    .select("key, label, prompt_template")
    .eq("key", config.outputType)
    .eq("ativo", true)
    .maybeSingle();
  if (tipoErro || !tipo) {
    throw new Error(`Tipo de aprofundamento indisponível: ${tipoErro?.message ?? config.outputType}`);
  }

  const pedido = [
    "CONTINUAÇÃO DA MESMA CONVERSA — não recomece e não trate como tema genérico.",
    `A família contou: ${(inbound.texto as string).slice(0, 2200)}`,
    `A Ayla já respondeu: ${(outbound.texto as string).slice(0, 2200)}`,
    `Agora a família escolheu: ${config.label}.`,
    "Entregue valor novo para este mesmo caso, usando Perfil Vivo, histórico e repertório.",
  ].join("\n\n");
  const contextoPronto = await montarContextoDeSecoes(supabase, {
    familyId: params.familyId,
    membroAtipicoId: params.membroId,
    pedido,
  });

  let ultimoErro = "resposta inválida";
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const resposta = await respondAsOutputType({
      supabase,
      familyId: params.familyId,
      membroAtipicoId: params.membroId,
      outputType: {
        key: tipo.key as string,
        label: tipo.label as string,
        // A chave continua selecionando o tipo e sua disponibilidade, mas o
        // clique é uma continuação contextual, não um dos atalhos independentes
        // do app. Reusar o template genérico fazia o modelo enumerar tudo e
        // repetir a primeira resposta. A receita desta experiência é o formato.
        prompt_template: config.receita,
      },
      pedido,
      contextoPronto,
    });
    if (resposta.validacao.ok && resposta.texto.trim()) {
      return {
        texto: resposta.texto.trim(),
        outputType: config.outputType,
        repertorio: {
          skills: contextoPronto.roteadas.map((r) => r.skill.name),
          boasPraticasIds: contextoPronto.ctx.boasPraticas.map((bp) => bp.id),
        },
      };
    }
    ultimoErro = resposta.validacao.ok ? "resposta vazia" : resposta.validacao.motivo;
  }
  throw new Error(`Aprofundamento bloqueado pela validação: ${ultimoErro}`);
}
