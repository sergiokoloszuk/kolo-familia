/**
 * Templates determinísticos da Ayla — PRD §12.8 e §12.12.
 *
 * Cada template tem 1-5 variações de redação; o scheduler escolhe
 * round-robin pra evitar repetição. Os textos vivem em
 * public.ayla_message_templates (editáveis pelo admin via /admin/mensagens)
 * com fallback hardcoded aqui pra segurança — se a query ao DB falhar
 * ou o template não existir, usamos o fallback e logamos um warning.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { pronomesVars, type Genero } from "./pronomes";
import { nomeUsavelCrianca, primeiroNome } from "./crianca-especifica";
import { fraseDoTema, listarTemas } from "@/lib/conducao/temas";

type TemplateVars = Record<string, string | number | undefined>;

/**
 * Limpa a cicatriz que um nome AUSENTE deixa no texto.
 *
 * Até 29/07/2026 o padrão pra "não sei o nome" era a string literal **"oi"** —
 * funcionava em "Oi, {nomeMae}" e quebrava em todo o resto: a mãe do Pietro
 * recebeu "Tô com você, oi" e "Isso é uma conquista real, oi". Agora o padrão é
 * vazio, e é aqui que os restos (vírgula solta, espaço duplo) somem.
 *
 * Exportado porque vale pros dois caminhos: templates (fill) e os textos
 * montados à mão no orchestrator, que passam pelo envio.
 */
export function limparNomeAusente(texto: string): string {
  return (
    texto
      // "Tô com você, ." → "Tô com você." | "Oi, !" → "Oi!"
      .replace(/,\s*([,.!?;:])/g, "$1")
      // "Oi,\n" → "Oi\n" e vírgula pendurada no fim
      .replace(/,[ \t]*(?=\n)/g, "")
      .replace(/,[ \t]*$/g, "")
      // sobras de espaçamento (sem tocar nas quebras de linha)
      .replace(/[ \t]{2,}/g, " ")
      .replace(/[ \t]+([,.!?;:])/g, "$1")
      .trim()
  );
}

function fill(template: string, vars: TemplateVars): string {
  return limparNomeAusente(
    template.replace(/\{(\w+)\}/g, (_, k) => {
      const v = vars[k];
      return v == null ? "" : String(v);
    }),
  );
}

/**
 * Escolhe round-robin baseado em um seed (geralmente o id da família +
 * o dia, pra que a mesma família receba a mesma variação no mesmo dia mas
 * varie ao longo da semana).
 */
function pickVariation(variations: string[], seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return variations[Math.abs(hash) % variations.length];
}

// ============================================================
// Fallbacks — sempre coincidem com o seed inicial em 0010_ayla_message_templates.sql.
// Se o DB cair ou retornar vazio, caímos aqui pra Ayla não ficar muda.
// ============================================================

const FALLBACK: Record<string, string[]> = {
  boas_vindas: [
    "Oi, {nomeMae}. Aqui é a Ayla 🌿\n\nObrigada por me deixar entrar na história de vocês. Vou aparecer aqui de vez em quando — sem cobrança, sem checklist.\n\nVocê pode me escrever a qualquer hora. Conta o que está pesando, o que ajudou, o que está na cabeça. Eu escuto.",
    "Oi, {nomeMae}. Sou a Ayla.\n\nA partir de hoje fico do lado de vocês — {deNomeMembro} e seu. Sem pressa. Quando puder me contar como foi um dia, mesmo numa frase, já é o suficiente.\n\nSe precisar de uma pausa, é só me dizer.",
    "{nomeMae}, oi 🌿\n\nSou a Ayla. Daqui em diante vou estar por perto — não pra cobrar, pra escutar. Você manda quando der, do jeito que quiser: um áudio, uma frase, uma reclamação.",
  ],
  rotina: [
    "Oi, {nomeMae}.\n\nMe conta uma coisa boa e uma difícil — do que vier à cabeça, só pra eu acompanhar do meu canto.",
    "{nomeMae}, oi.\n\nComo vocês estão {comNomeMembro}? Pode ser frase curta — ou áudio, se for mais fácil.",
    "Oi 🌿\n\nO que tá pegando mais por aí? E o que tá ajudando? Me conta quando der.",
    "{nomeMae}, passando aqui rapidinho. Como vocês estão?\n\nQualquer coisa serve — uma frase, um áudio, um emoji.",
    "{nomeMae}, passando aqui.\n\nMe conta uma coisa {deNomeMembro} quando der — sem pressa.",
  ],
  engajamento_2dias: [
    "Oi, {nomeMae}. Faz uns dias sem você por aqui — está tudo bem aí?\n\nSe quiser me contar uma coisa, qualquer frase serve.",
    "{nomeMae}, faltou seu registro nesses dias. Tudo bem?\n\nUma frase curta sobre como vocês estão já ajuda.",
    "Oi 🌿\n\nNão te ouvi nos últimos dias. Está tudo bem com {nomeMembro}?",
  ],
  engajamento_5dias: [
    "{nomeMae}, faz alguns dias que não nos falamos. Sem cobrança — quero só saber se vocês estão bem.\n\nSe puder responder, mesmo que com \"tudo bem\", já me conforta.",
    "Oi, {nomeMae}. Caí da rotina aqui sem você.\n\nMe conta uma coisa do dia quando puder — sem pressa.",
  ],
  trial_d3: [
    "Oi, {nomeMae}. Te lembrando que seu período grátis termina em 3 dias.\n\nSe quiser continuar com a gente, é só assinar em /assinatura. Sem pressa.",
    "{nomeMae}, faltam 3 dias pro fim do seu período grátis.\n\nQuis te avisar com antecedência, pra você decidir com calma.",
  ],
  trial_d0: [
    "Oi, {nomeMae}. Hoje é o último dia do seu período grátis 🌿\n\nTudo que você me contou continua salvo. Se quiser seguir, é só assinar em /assinatura — cancela quando quiser.",
    "{nomeMae}, hoje termina seu período grátis.\n\nSe você quiser continuar com a gente, é em /assinatura. Se não quiser, sem problema — seus registros ficam aqui, caso queira voltar depois.",
  ],
  emocional_streak: [
    "{nomeMae}, você me respondeu 7 dias seguidos 🌿\n\nIsso é cuidado de verdade. {nomeMembro} está tendo um cuidado bem presente — e isso vem de você.",
    "Sete dias de papo seguidos, {nomeMae}.\n\nTô vendo o trabalho enorme que você está fazendo {comNomeMembro}. Não é pouco.",
  ],
  clarificacao_membro: [
    "Sobre quem você está falando? {opcoes}?",
  ],
  clarificacao_conteudo: [
    "Não peguei direito o que aconteceu. Pode me contar de outro jeito? Uma frase curta serve, ou um áudio.",
  ],
  comando_ajuda: [
    "Coisas que você pode me pedir:\n\n• PAUSAR — pausa minhas mensagens por 7 dias\n• PAUSAR 3 — pausa por X dias (você escolhe)\n• MUDAR HORARIO 20:00 — muda o horário das minhas perguntas\n• SAIR — desativa minhas mensagens (seus registros ficam)\n• AJUDA — mostra esta lista\n\nVocê também pode me responder com áudio quando preferir.",
  ],
  comando_pausada: [
    "Pausada por {dias_label}. Volto depois — mas se quiser falar antes, é só me escrever.",
  ],
  comando_horario_mudado: [
    "Anotado. Vou te procurar às {hora}.",
  ],
  comando_sair: [
    "Desativada. Seus registros continuam aqui — quando quiser voltar, é só me responder qualquer coisa.",
  ],
};

async function getVariations(
  supabase: SupabaseClient,
  key: string,
): Promise<string[]> {
  try {
    const { data } = await supabase
      .from("ayla_message_templates")
      .select("variations")
      .eq("key", key)
      .eq("ativo", true)
      .maybeSingle();
    const variations = (data?.variations as string[] | undefined) ?? [];
    if (variations.length > 0) return variations;
  } catch (e) {
    console.warn(`[ayla templates] DB error for '${key}', usando fallback:`, e);
  }
  const fb = FALLBACK[key];
  if (!fb || fb.length === 0) {
    throw new Error(`Template '${key}' não tem variações no DB nem fallback.`);
  }
  return fb;
}

// ============================================================
// Boas-vindas — primeira mensagem após onboarding concluído
// ============================================================

export async function templateBoasVindas(
  supabase: SupabaseClient,
  params: { nomeMae: string; nomeMembro: string; genero: Genero; seed: string },
): Promise<string> {
  const variations = await getVariations(supabase, "boas_vindas");
  const vars = { nomeMae: params.nomeMae, ...pronomesVars(params.genero, params.nomeMembro) };
  return fill(pickVariation(variations, params.seed), vars);
}

/**
 * A PRIMEIRA MENSAGEM — e é ela que ensina a família a usar a Ayla.
 *
 * Até 02/08/2026 esta template citava UM desafio (o `[0]` da lista) e fazia uma
 * pergunta. Funcionava como isca, mas não ensinava nada: a mãe não ficava
 * sabendo em que a Ayla ajuda, e chegava perguntando de remédio, de amamentação
 * e de assunto aleatório — porque "uma IA no WhatsApp" não tem território
 * visível.
 *
 * Agora a abertura faz cinco coisas, nesta ordem, e nada além disso:
 *   1. reconhece que já conheceu um pouco da criança (continuidade);
 *   2. devolve os desafios que A PRÓPRIA FAMÍLIA marcou — até três, com as
 *      palavras dela. NÃO é inferência da Ayla, e o texto diz isso;
 *   3. explica em uma frase o TIPO de ajuda (não o catálogo inteiro);
 *   4. pergunta por qual começar — e a resposta vira o tema ativo;
 *   5. convida a contar, por áudio ou texto, prometendo uma primeira ideia
 *      prática — não um questionário.
 *
 * O que ela NÃO faz: listar recursos ("tenho planos, rotinas, relatórios,
 * histórias"), prometer artefato, nem pedir dado nenhum.
 */
export function templateBoasVindasComDesafio(params: {
  nomeMae: string;
  nomeMembro: string;
  genero: Genero;
  /** A lista INTEIRA que a família marcou. Até 3 entram na mensagem. */
  desafios: string[];
}): string {
  const lista = listarTemas(params.desafios, 3);
  const frase = lista || fraseDoTema(params.desafios[0] ?? "");
  const varios = params.desafios.filter((d) => fraseDoTema(d) !== fraseDoTema("")).length > 1;

  // Só cita a criança quando o nome É nome (o campo aceita recado) e com o
  // primeiro nome. Sem isso a frase sai "a comunicação da Cuido de Várias
  // Crianças. Sou Terapeuta! tem pesado" — foi o que aconteceu em 25/07.
  const nomeCurto = nomeUsavelCrianca(params.nomeMembro) ? primeiroNome(params.nomeMembro) : "";
  const artigo = params.genero === "feminino" ? "da" : "do";
  const generoDefinido = params.genero === "feminino" || params.genero === "masculino";
  const comCrianca = nomeCurto && generoDefinido ? ` com ${artigo === "da" ? "a" : "o"} ${nomeCurto}` : "";
  const dele = nomeCurto ? ` pro ${nomeCurto}` : "";

  // O NOME DE QUEM FALA passa pelo mesmo detector do nome da criança. Em
  // 02/08/2026 uma mãe escreveu a apresentação inteira no campo do nome e a
  // primeira mensagem saiu "Oi, Meu Nome e Gisela Meu Filgo e Davi Ele e
  // Autista 💛". Sem nome confiável a saudação funciona sem nome — nunca com
  // o nome da criança no lugar.
  const nomeQuemFala = nomeUsavelCrianca(params.nomeMae) ? primeiroNome(params.nomeMae) : "";
  const saudacao = nomeQuemFala ? `Oi, ${nomeQuemFala}!` : "Oi!";

  return [
    `${saudacao} Eu sou a Ayla 💛 Estou aqui pra te ajudar nos desafios do dia a dia${comCrianca}.`,
    "",
    `Pelo que você contou quando entrou, o que mais tem pesado ${varios ? "são" : "é"} ${frase}.`,
    "",
    `Posso te ajudar com estratégias práticas, o que fazer e o que falar nas horas difíceis, e também com brincadeiras e atividades pra trabalhar essas habilidades de um jeito mais leve${dele}.`,
    "",
    // "Você não precisa saber o que pedir" é a frase que destrava quem chega
    // sem conhecer o produto: a família não sabe que existe Plano, Rotina ou
    // História — e não deveria precisar saber. Quem conduz é a Ayla.
    `Você não precisa saber o que pedir: me conta o que está acontecendo, do seu jeito. Por qual você quer começar? Pode mandar um *áudio*, se for mais fácil — com o que você me contar eu já te trago uma primeira ideia prática. 🌿`,
  ].join("\n");
}

// ============================================================
// Pergunta diária de rotina — PRD §12.4
// ============================================================

export async function templateRotinaDiaria(
  supabase: SupabaseClient,
  params: { nomeMae: string; nomeMembro: string; genero: Genero; seed: string },
): Promise<string> {
  const variations = await getVariations(supabase, "rotina");
  const vars = { nomeMae: params.nomeMae, ...pronomesVars(params.genero, params.nomeMembro) };
  return fill(pickVariation(variations, params.seed), vars);
}

// ============================================================
// Engajamento por inatividade — PRD §12.4
// ============================================================

export async function templateEngajamento(
  supabase: SupabaseClient,
  params: {
    diasInativos: number;
    nomeMae: string;
    nomeMembro: string;
    genero: Genero;
    seed: string;
  },
): Promise<string> {
  const key = params.diasInativos >= 5 ? "engajamento_5dias" : "engajamento_2dias";
  const variations = await getVariations(supabase, key);
  const vars = { nomeMae: params.nomeMae, ...pronomesVars(params.genero, params.nomeMembro) };
  return fill(pickVariation(variations, params.seed), vars);
}

// ============================================================
// Clarificação — quando parser tem confiança baixa (PRD §12.5, §12.7)
// ============================================================

export async function templateClarificacaoMembro(
  supabase: SupabaseClient,
  params: { membros: Array<{ nome: string }> },
): Promise<string> {
  const opcoes = params.membros.map((m) => m.nome).join(" ou ");
  const variations = await getVariations(supabase, "clarificacao_membro");
  return fill(pickVariation(variations, `clarificacao-${opcoes}`), { opcoes });
}

export async function templateClarificacaoConteudo(
  supabase: SupabaseClient,
): Promise<string> {
  const variations = await getVariations(supabase, "clarificacao_conteudo");
  return pickVariation(variations, "clarif-conteudo");
}

// ============================================================
// Resposta a registro — combina template + IA pra parte central
// PRD §12.5: "acolher → organizar → ação". Limite 60 palavras nas 3 frases.
// Mantida como composição pura (sem DB) — não há variações.
// ============================================================

export function templateRespostaRegistro(params: {
  acolhimento: string;
  organizacao: string;
  acao?: string;
}): string {
  const partes = [params.acolhimento, params.organizacao];
  if (params.acao) partes.push(params.acao);
  return partes.join("\n\n");
}

// ============================================================
// Comerciais — trial D-3, D-0 (PRD §12.5)
// ============================================================

export async function templateTrial(
  supabase: SupabaseClient,
  params: { diasRestantes: 3 | 0; nomeMae: string; seed: string },
): Promise<string> {
  const key = params.diasRestantes === 0 ? "trial_d0" : "trial_d3";
  const variations = await getVariations(supabase, key);
  return fill(pickVariation(variations, params.seed), params);
}

// ============================================================
// Emocional — streak 7 dias seguidos (PRD §12.5)
// ============================================================

export async function templateEmocionalStreak(
  supabase: SupabaseClient,
  params: { nomeMae: string; nomeMembro: string; genero: Genero; seed: string },
): Promise<string> {
  const variations = await getVariations(supabase, "emocional_streak");
  const vars = { nomeMae: params.nomeMae, ...pronomesVars(params.genero, params.nomeMembro) };
  return fill(pickVariation(variations, params.seed), vars);
}

// ============================================================
// Insight — usa mensagem_proposta gerada pelo insightEngine.
// Não há variações: passamos a proposta como está.
// ============================================================

export function templateInsight(mensagemProposta: string): string {
  return mensagemProposta;
}

// ============================================================
// Comandos
// ============================================================

export async function templateComandoAjuda(supabase: SupabaseClient): Promise<string> {
  const variations = await getVariations(supabase, "comando_ajuda");
  return pickVariation(variations, "ajuda");
}

export async function templateComandoPausada(
  supabase: SupabaseClient,
  dias: number,
): Promise<string> {
  const variations = await getVariations(supabase, "comando_pausada");
  const dias_label = `${dias} dia${dias === 1 ? "" : "s"}`;
  return fill(pickVariation(variations, `pausada-${dias}`), { dias_label });
}

export async function templateComandoHorarioMudado(
  supabase: SupabaseClient,
  hora: string,
): Promise<string> {
  const variations = await getVariations(supabase, "comando_horario_mudado");
  return fill(pickVariation(variations, `horario-${hora}`), { hora });
}

export async function templateComandoSair(supabase: SupabaseClient): Promise<string> {
  const variations = await getVariations(supabase, "comando_sair");
  return pickVariation(variations, "sair");
}
