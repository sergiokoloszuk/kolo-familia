import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ehPerguntaComercial,
  precisaDeHumano,
  notaComercial,
  notaSuporte,
  linkAssinatura,
} from "@/lib/billing/destino-comercial";
import {
  gerarConversacional,
  providerConversacionalParaFamilia,
  MODELO_CONVERSA,
} from "@/lib/ia/provider";
import { logarUsoApi } from "@/lib/billing/logar";
import { logServerError, logEvent } from "@/lib/log";
import { fronteiraAtravessada } from "@/lib/conducao/fronteiras";
import { comRetentativaCurta } from "@/lib/conducao/retentativa";
import { pronomesPara, type Genero, type CuidadorDescrito } from "./pronomes";
// NÚCLEO DE CONDUÇÃO — fonte única compartilhada com as Estratégias (web):
// identidade + norte, princípios, regra de sequência, exemplos, piso e tom.
// Ver lib/conducao/diretrizes.ts. A Ayla adiciona só o que é do WhatsApp
// (formato e idioma). A identidade agora vive no CÓDIGO (não mais no banco
// voz_ayla), o que elimina o drift banco×código.
import { nucleoConducao } from "@/lib/conducao/diretrizes";
// FASE 4A · as MESMAS constantes que `lib/ia/prompt.ts` injeta na web. Uma
// redação só para os dois canais: se a precedência do perfil mudar, muda nos
// dois no mesmo commit.
import {
  ANCORA_PERFIL,
  LACUNA_NAO_E_PERGUNTA,
  LICENCA_GENERATIVA,
} from "@/lib/conducao/composicao";
import type { SecaoBase2 } from "@/lib/conducao/base2";
import {
  linhasDoPerfilConsultavel,
  type PerfilConsultavel,
} from "@/lib/kolo-vivo/consultar";
import { angulosUsados, blocoProgressao } from "@/lib/conducao/angulos";
import {
  formasDeEntrega,
  FORMATO_WHATSAPP,
  pedeEntregaEstruturada,
  INTERESSE_COMO_VEICULO,
  A_CRIANCA_ANTES_DO_ROTULO,
} from "@/lib/conducao/formas";
import { FATOS_COMERCIAIS } from "@/lib/billing/fatos-comerciais";

/**
 * Tracking opcional pra logar a chamada em api_calls. Quando ausente, a
 * função roda normal mas o uso não vai pro dashboard.
 */
export type UsageTracking = {
  supabase: SupabaseClient;
  family_account_id: string | null;
  feature: string;
};

/**
 * A VOZ da Ayla — gera a resposta que a mãe lê no WhatsApp.
 *
 * A CONDUÇÃO (quem a Ayla é, como pensa, princípios, piso de segurança, tom)
 * vem do núcleo compartilhado (lib/conducao). Aqui fica só o FORMATO do canal
 * WhatsApp + o idioma. O parser (Haiku) continua extraindo a estrutura nos
 * bastidores; esta camada usa o Sonnet porque a qualidade da voz importa.
 */

/**
 * ⚠️ `FORMATO_WHATSAPP` MUDOU DE ENDEREÇO (24/08/2026).
 *
 * Vive em `@/lib/conducao/formas` porque o caminho OFICIAL precisava dela e
 * não podia importar deste arquivo sem depender do Legacy que vamos aposentar.
 * MEDIDO: sem esta regra, 65,2% das respostas do Oficial saíam com `**` cru e
 * 9,6% com `##` — sintaxe que o WhatsApp não renderiza.
 *
 * O reexport mantém quem já importava daqui funcionando.
 */
export { FORMATO_WHATSAPP };

/**
 * Espelhamento de idioma. A Ayla responde SEMPRE na língua em que a mãe
 * escreveu — de graça, sem tabela de traduções. O contexto e o perfil da
 * criança podem estar em português; ela lê normalmente e RESPONDE na língua
 * dela. Injetado no fim do system (vale pro prompt do banco e pro fallback),
 * então não depende de editar o prompt em produção.
 */
/**
 * ⚠️ `PERGUNTA_DE_PRECO` SAIU DAQUI em 22/08/2026.
 *
 * Ela era o dono da decisão "isto é conversa de dinheiro?" — dentro do arquivo
 * do WhatsApp, o que deixava a Web sem nada. MEDIDO: das 18 formulações
 * naturais testadas, 11 escapavam ("onde assino?", "quais os planos?", "me
 * manda o link"), e `assinar` solto ainda casava "assinar o caderno".
 *
 * A decisão passou a viver em `lib/billing/destino-comercial.ts`, que os DOIS
 * canais importam. Os 13 casos positivos e 9 negativos que este arquivo
 * garantia foram levados inteiros para o teste de lá, mais os novos.
 */

export const DIRETRIZ_IDIOMA = `# Idioma (REGRA QUE PREVALECE — leia por último)
Esta regra PREVALECE sobre qualquer instrução acima que mande responder "em português do Brasil": aquilo vale SÓ quando a mãe escreve em português. O idioma da resposta é SEMPRE o da mãe.
Responda SEMPRE no MESMO idioma da última mensagem da mãe (o texto em <mensagem_de_agora>).
- REGRA DE OURO: escreva a resposta INTEIRA num único idioma. NUNCA misture português e espanhol (nada de "portunhol") nem português e inglês — TODA palavra, incluindo perguntas curtas, saudações e conectivos ("é", "ou", "o", "a"), na MESMA língua da mãe. Se ela escreveu em espanhol, até o "¿" e o "?" e os artigos ("el/la") vão em espanhol.
- O contexto, o perfil, as notas internas e os nomes vêm em português — isso é só para você ENTENDER. Ao ESCREVER, traduza tudo (menos os nomes próprios) para a língua da mãe. Não deixe vazar nenhuma palavra em português quando ela escreve em espanhol/inglês.
- ESPANHOL natural, SEM lusismos (não escreva "espanhol com gramática de português): com infinitivo/gerúndio/imperativo o pronome vai ENCLÍTICO, colado no verbo — "darte", "ayudarte", "decirte", "contarme" (NUNCA "te dar", "te ayudar", "me contar"). NÃO use artigo antes de nome próprio ("Mario o Manu", não "el Mario o la Manu"). Evite falsos amigos e traduções literais do português; na dúvida, use a forma neutra latino-americana mais simples.
- Se ela escreveu em ESPANHOL, responda em espanhol latino-americano neutro, natural e correto — trate por "tú", evite regionalismos muito marcados e gírias locais.
- Se escreveu em INGLÊS, responda em inglês natural e caloroso.
- Caso contrário (padrão), português do Brasil.
- Todo o material de contexto, perfil e notas internas pode estar em português — leia e entenda normalmente, mas ESCREVA a resposta na língua da mãe.
- Mantenha o MESMO tom e as MESMAS regras (curto, humano, sem jargão clínico, no máximo 2 balões) em qualquer idioma.
- Se a mensagem for curta/ambígua ("ok", "😊"), siga o idioma que vocês já vinham usando na <conversa_recente>.`;

// A CONDUÇÃO (identidade, princípios, sequência, exemplos — que incluem o
// "convergir" e o "ter substância", agora subordinados — piso e tom) vem toda
// de lib/conducao/diretrizes.ts (nucleoConducao), compartilhada com a web. A
// Ayla mantém aqui só o FORMATO do WhatsApp e o IDIOMA.

export type SinaisResposta = {
  conquista: string | null;
  desafio: string | null;
  emocao_mae: string | null;
  experimentou?: string | null;
  temSugestaoKoloVivo: boolean;
};

export type RespostaParams = {
  nomeMae: string;
  /**
   * Tema do turno (`lib/conducao/temas.ts`), vindo do classificador. Serve pra
   * priorizar o que do perfil entra na resposta — não pra travar o assunto.
   */
  temaAtivo?: string | null;
  /**
   * O turno é uma ENTREGA (desafio/pedido de ajuda) ou uma conversa (desabafo,
   * crise, pergunta pontual, saudação)? Decide se as formas de entrega entram.
   */
  intencao?: "plano" | "outro" | "rotina_criar" | "rotina_ver" | "rotina_editar" | "organizacao";
  /**
   * Preenchido quando há SITUAÇÃO DE SEGURANÇA ABERTA. Vai pras notas internas
   * e prevalece: a prioridade continua sendo o risco, mesmo que esta mensagem
   * fale de outra coisa. Ver `estado-seguranca.ts`.
   */
  notaDeSeguranca?: string | null;
  /** Vínculo + gênero do adulto responsável (mãe, pai, avó, tia...). */
  cuidador?: CuidadorDescrito;
  nomeMembro: string | null;
  idadeMembro?: number | null;
  perfilMembro?: string | null;
  /**
   * O que a família REGISTROU: diagnóstico confirmado × hipótese em investigação
   * (bloco pronto de `lib/onboarding/diagnostico.ts`). Sem isto a Ayla só via o
   * enum `perfil` e não distinguia "tem laudo de TEA" de "estão investigando
   * TEA" — o que a levou a responder como se não houvesse nada registrado e a
   * concluir por conta própria (01/08/2026).
   */
  diagnosticoRegistrado?: string | null;
  generoMembro?: Genero;
  koloVivoResumo: string;
  /** O que o perfil da criança já tem × o que falta, por domínio — pra a Ayla
   *  perguntar só o pertinente (sem repetir) e saber o que falta pro relatório. */
  koloVivoLacunas?: string;
  /**
   * Bloco `<repertorio_kolo>` já montado por `lib/conhecimento/recuperar`. É a
   * MESMA função que serve as Estratégias — o canal muda a apresentação, nunca
   * o repertório.
   */
  repertorio?: string;
  /**
   * FASE 4A · o perfil campo a campo, com ESTADO (preenchido / negativo /
   * vazio). `null` fora do piloto.
   *
   * Não substitui `koloVivoResumo`, que continua mandando o CONTEÚDO. Este
   * manda a outra metade: o que está vazio e sobretudo o que é NEGATIVO — "não
   * tem sensibilidade a som" é informação, e sem essa distinção o modelo trata
   * vazio e negativo igual, e volta a perguntar o que a família já respondeu.
   */
  perfilConsultavel?: PerfilConsultavel | null;
  /**
   * FASE 4A · esta família está no piloto? Decidido por `pilotoQuatroA` no
   * orquestrador — aqui só se OBEDECE, nunca se recalcula: duas fontes para a
   * mesma decisão sempre divergem.
   *
   * Existe como campo próprio porque a licença generativa não pode ser inferida
   * da presença de material neste canal (ver o comentário na injeção).
   */
  piloto4A?: boolean;
  /**
   * FASE 4A · as seções de investigação da BASE 2 (`docs/skills`) do tema deste
   * turno. Vazio fora do piloto.
   */
  base2?: readonly SecaoBase2[];
  /** Títulos das últimas conversas nas Estratégias (in-app), pra continuidade. */
  estrategiasRecentes?: string[];
  /** `sobre` = nome de OUTRA criança da família, quando o turno não é do membro em foco. */
  historico: Array<{ de: "mae" | "ayla"; texto: string; sobre?: string }>;
  mensagem: string;
  /** URL de uma FOTO que a pessoa mandou — a Ayla LÊ a imagem (lição, rótulo, agenda…). */
  imagemUrl?: string | null;
  sinais: SinaisResposta;
  /** A pessoa pediu um plano explicitamente — não escreva o plano, ofereça. */
  querPlano?: boolean;
  /** O que a mãe acabou de ACEITAR, quando o turno é um aceite de oferta. */
  aceite?: string | null;
  /**
   * Preenchido SÓ na segunda passada, quando a primeira atravessou a fronteira
   * do diagnóstico. Entra como nota interna — o mesmo mecanismo que o resto do
   * turno usa, sem prompt paralelo.
   */
  regenerarPorDiagnostico?: string;
  precisaEscolherMembro?: { nomes: string[] } | null;
  /**
   * Magic links DIRETOS do Lúdico (só criança) — cada recurso abre já logado
   * na tela certa, pra Ayla nunca mandar o hub genérico e a pessoa se perder.
   */
  linksLudico?: {
    historia: string | null;
    rotina: string | null;
    desenho: string | null;
    avatar: string | null;
    /** Relatório da criança pra escola/professora/terapeuta (gera na web). */
    relatorio?: string | null;
  } | null;
};

type ConteudoUsuario =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: {
        type: "base64";
        media_type: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
        data: string;
      };
    };

/** Baixa a imagem (URL da Z-API) e devolve base64 + media_type pro modelo ver. */
async function baixarImagemBase64(
  url: string,
): Promise<{ base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const mediaType = ct.includes("png")
      ? "image/png"
      : ct.includes("webp")
        ? "image/webp"
        : ct.includes("gif")
          ? "image/gif"
          : "image/jpeg";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 5 * 1024 * 1024) return null; // Anthropic ~5MB; WhatsApp manda menor
    return { base64: buf.toString("base64"), mediaType };
  } catch (e) {
    console.warn("[ayla:responder] baixar imagem falhou:", e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Gera a resposta da Ayla e devolve o TEXTO COMPLETO — nada é publicado aqui.
 *
 * ⚠️ Até 01/08/2026 esta função recebia um `onParagrafo` e mandava cada
 * parágrafo ao WhatsApp assim que fechava. Nunca existia um instante em que a
 * resposta inteira estivesse em memória — e sem esse instante NÃO HÁ ONDE
 * inspecionar o que vai sair. Foi por aí que uma mãe recebeu um diagnóstico
 * informal da filha, em produção.
 *
 * O streaming continua, mas só INTERNO: monta o buffer. Quem publica é o
 * orquestrador, DEPOIS da rede abaixo.
 *
 * O ritmo da conversa não muda: o efeito "digitando" nunca veio do streaming —
 * vem do `delaySegundos` por bolha, que a publicação preserva.
 */
export async function gerarRespostaAyla(
  params: RespostaParams,
  tracking?: UsageTracking,
): Promise<string> {
  const texto = await gerarUmaVez(params, tracking);

  // ── REDE DA FRONTEIRA DO DIAGNÓSTICO ────────────────────────────────────
  // Custo zero no caminho normal: o detector é regex sobre o texto que já está
  // em memória. Só há segunda chamada quando vaza. UMA tentativa, e é um `if` —
  // não um laço com contador, que é como loops de regeneração nascem.
  // O MESMO bloco que o modelo recebeu (ver `params.diagnosticoRegistrado`, que
  // entra no prompt logo abaixo). Sem ele, o detector proibia justamente o que
  // o núcleo manda fazer: falar com naturalidade do diagnóstico que a família
  // cadastrou.
  const cruzou = fronteiraAtravessada(texto, params.diagnosticoRegistrado);
  if (!cruzou) return texto;

  await logEvent({
    kind: "ayla_fronteira_regenerou",
    severity: "warn",
    family_account_id: tracking?.family_account_id ?? null,
    payload: {
      fronteira: cruzou.fronteira.nome,
      codigos: cruzou.achados.map((a) => a.codigo),
      trecho: cruzou.achados[0]?.trecho,
    },
  }).catch(() => {});

  // Falha na regeneração NÃO pode deixar a original escapar: se a segunda
  // chamada quebrar, cai no piso, nunca no texto que já foi reprovado.
  let segunda: string;
  try {
    segunda = await gerarUmaVez(
      { ...params, regenerarPorDiagnostico: cruzou.fronteira.instrucao(cruzou.achados) },
      tracking,
    );
  } catch {
    segunda = "";
  }

  const aindaVaza = segunda
    ? fronteiraAtravessada(segunda, params.diagnosticoRegistrado)
    : null;
  if (segunda && !aindaVaza) return segunda;

  // Falhou duas vezes. Aqui NÃO se publica a segunda "porque já tentamos" —
  // seria publicar sabendo. Entra o piso: texto do repositório, que reconhece a
  // pergunta, é honesto sobre o porquê e conduz pro próximo passo.
  await logEvent({
    kind: "ayla_fronteira_piso",
    severity: "error",
    family_account_id: tracking?.family_account_id ?? null,
    payload: {
      fronteira: (aindaVaza ?? cruzou).fronteira.nome,
      codigos_1a: cruzou.achados.map((a) => a.codigo),
    },
  }).catch(() => {});

  return (aindaVaza ?? cruzou).fronteira.piso({
    nomeCuidador: params.nomeMae,
    nomeMembro: params.nomeMembro,
  });
}

/**
 * ESTE TURNO PEDE BLOCOS?
 *
 * A regra é conservadora de propósito: na dúvida, texto corrido. Uma resposta
 * boa em prosa nunca incomodou ninguém; um título em cima de um desabafo, sim.
 *
 * Fica FORA (texto corrido):
 *   - desabafo e crise — o sinal `emocao_mae` sem desafio, ou o piso de crise;
 *   - pergunta pontual — sem desafio detectado e sem pedido de plano;
 *   - o pedido explícito de plano — ali a resposta é curta e o plano vai no PDF;
 *   - a segunda passada da rede de fronteiras — regenerar já tem instrução
 *     própria, e somar formato por cima é competir com ela.
 *
 * Fica DENTRO: desafio do dia a dia, que é onde a entrega organizada ajuda.
 */
export function ehEntrega(params: RespostaParams): boolean {
  // ⚠️ A REGRA SAIU DAQUI (24/08/2026) e virou `pedeEntregaEstruturada`, em
  // `lib/conducao/formas`. Motivo: o caminho OFICIAL precisava da MESMA decisão
  // e não podia importar deste arquivo. Esta função continua existindo porque
  // traduz o formato de parâmetros do Legacy — `sinais.desafio` — para o
  // vocabulário compartilhado de intenção. O julgamento é um só.
  return pedeEntregaEstruturada({
    intencao: params.sinais?.desafio ? "desafio" : "outro",
    // ⚠️ `Boolean(...)` porque no Legacy estes dois NÃO são booleanos —
    // `regenerarPorDiagnostico` é `string | undefined` e `precisaEscolherMembro`
    // é `{ nomes } | null`. O código antigo os usava em `if (...)`, ou seja, por
    // veracidade. Coagir aqui preserva exatamente esse comportamento; deixar o
    // tipo frouxo é que teria mudado a decisão em silêncio.
    regenerando: Boolean(params.regenerarPorDiagnostico),
    querPlano: Boolean(params.querPlano),
    precisaEscolherMembro: Boolean(params.precisaEscolherMembro),
  });
}

/** Uma passada pelo modelo. A rede acima decide se precisa de outra. */
async function gerarUmaVez(
  params: RespostaParams,
  tracking?: UsageTracking,
): Promise<string> {
  // QUEM RESPONDE. Só a camada conversacional muda de provider — o parser, o
  // classificador de intenção, a prontidão, o roteador e os artefatos seguem no
  // Claude, cada um com o seu cliente. Aqui a variável é o MODELO, e só ele: o
  // `system` montado abaixo é o mesmo nos dois braços, por construção.
  //
  // A DECISÃO NÃO MORA AQUI — mora em `providerConversacionalParaFamilia`, que
  // é a mesma função que a rota da web chama. Sem isso, uma família poderia
  // receber GPT no WhatsApp e Claude nas Estratégias na mesma conversa.
  //
  // O id vem do `tracking`, que é o único lugar desta função que conhece a
  // família. Quando ele não vem (chamada sem tracking), o id é null e a regra
  // devolve Claude — fail closed, sem exceção: o rollout de teste não pode ser
  // decidido por um id que a gente não tem.
  const provider = providerConversacionalParaFamilia(tracking?.family_account_id);
  const model = MODELO_CONVERSA[provider];
  // FORMAS DE ENTREGA — condicional, nunca sempre. Um desabafo com títulos em
  // negrito é frieza, e uma pergunta pontual com quatro blocos é ruído. Só
  // entra quando o turno é de fato uma entrega (ver `ehEntrega`).
  const entrega = ehEntrega(params);
  const system = [
    nucleoConducao(),
    // FATO COMERCIAL — fora do núcleo de propósito. O núcleo guarda voz e
    // segurança universais; prazo de teste é regra de produto, e é injetada
    // por quem fala com a família. Sem isto, perguntada quanto dura o teste,
    // ela chutava — e chutou 30 dias, que é o palpite de mercado.
    FATOS_COMERCIAIS,
    FORMATO_WHATSAPP,
    ...(entrega
      ? [
          formasDeEntrega({ canal: "whatsapp", tema: params.temaAtivo }),
          INTERESSE_COMO_VEICULO,
          A_CRIANCA_ANTES_DO_ROTULO,
        ]
      : []),
    DIRETRIZ_IDIOMA,
  ].join("\n\n");

  const linhas: string[] = [];
  const relacao = params.cuidador?.relacao;
  const refMembro = params.nomeMembro ?? "quem está em foco";
  // NOME DE QUEM FALA. Quando `family_profiles.como_chamar` e `nome_mae` estão
  // vazios, `nomeMae` cai pra "" — e esta linha saía truncada, com vírgula solta
  // e sem nome: "Você está falando com , mãe de Iasmin." O modelo preenchia o
  // buraco com o único nome disponível no contexto, o da CRIANÇA, e a mãe recebia
  // "Oi, Maria Yasmin!" seguido de "sua filha Iasmin" (caso real, 02/08/2026).
  //
  // A correção é não emitir a frase com buraco: dizer que o nome é desconhecido
  // é informação, "" é convite a inventar. `limparNomeAusente` já existia pra
  // esta classe de cicatriz, mas só roda nas proativas — o reativo não passa
  // por ele, e de todo jeito ele limparia a vírgula, não o nome inventado.
  const nomeDeQuemFala = params.nomeMae?.trim() ?? "";
  linhas.push(
    nomeDeQuemFala
      ? `Você está falando com ${nomeDeQuemFala}${relacao ? `, ${relacao} de ${refMembro}` : ""}.`
      : `Você NÃO sabe o nome de quem está falando com você${relacao ? ` — só que é ${relacao} de ${refMembro}` : ""}. NÃO invente um nome, NÃO deduza pelo áudio ou pelo texto, e NUNCA use o nome da criança pra se dirigir a quem cuida. Fale sem vocativo ("oi", "tudo bem?") até que ela se apresente.`,
  );
  if (params.cuidador) {
    const pc = pronomesPara(params.cuidador.genero);
    if (pc.generoDefinido) {
      linhas.push(
        `Trate ${nomeDeQuemFala || "quem fala com você"} no ${
          params.cuidador.genero === "feminino" ? "feminino" : "masculino"
        } (ex.: "${
          params.cuidador.genero === "feminino" ? "bem-vinda" : "bem-vindo"
        }"). NÃO presuma que é a mãe — é ${relacao ?? "o(a) responsável"}.`,
      );
    } else if (relacao && relacao !== "responsável") {
      linhas.push(`Lembre: quem fala com você é ${relacao} de ${refMembro}, não necessariamente a mãe.`);
    }
  }
  if (params.nomeMembro) {
    linhas.push(
      `Em foco: ${params.nomeMembro}${params.idadeMembro != null ? `, ${params.idadeMembro} anos` : ""}${params.perfilMembro ? `, perfil ${params.perfilMembro}` : ""}.`,
    );
    if (params.idadeMembro != null && params.idadeMembro >= 18) {
      linhas.push(
        `IMPORTANTE: ${params.nomeMembro} é ADULTO(a) (${params.idadeMembro} anos). NUNCA chame de "criança" nem use diminutivos infantis — use o nome ou "seu filho(a)", com linguagem adequada a um adulto.`,
      );
    } else if (params.idadeMembro != null && params.idadeMembro >= 13) {
      linhas.push(
        `${params.nomeMembro} é ADOLESCENTE (${params.idadeMembro} anos) — evite "criança/criancinha"; use o nome.`,
      );
    } else if (params.idadeMembro == null) {
      linhas.push(
        `A idade de ${params.nomeMembro} NÃO foi informada — não presuma que é criança. Trate pelo nome, sem diminutivos infantis.`,
      );
    }
    const p = pronomesPara(params.generoMembro);
    if (p.generoDefinido) {
      linhas.push(
        `Concordância: ${params.nomeMembro} é tratada no ${
          params.generoMembro === "feminino" ? "feminino" : "masculino"
        } — use "${p.sujeito}/${p.possessivo}" e "${p.artigo} ${params.nomeMembro}". Nunca troque o gênero.`,
      );
    } else {
      linhas.push(
        `Concordância: o gênero de ${params.nomeMembro} não foi informado — refira-se pelo nome e evite "ele/ela" e "dele/dela". Se inevitável, use formas neutras.`,
      );
    }
  }
  // ANTES do perfil acumulado, de propósito: o que está oficialmente registrado
  // enquadra a leitura de tudo o que vem depois.
  if (params.diagnosticoRegistrado?.trim()) {
    linhas.push(`
${params.diagnosticoRegistrado.trim()}`);
  }
  if (params.koloVivoResumo.trim()) {
    linhas.push(
      `\n<o_que_ja_sabemos_da_crianca>\n${params.koloVivoResumo}\n</o_que_ja_sabemos_da_crianca>\n(Isto é FUNDO acumulado ao longo do tempo e pode estar DESATUALIZADO: um interesse ou um passeio/evento listado aqui pode já ter passado. NÃO trate como o que está acontecendo agora, e NÃO puxe um interesse/evento daqui por conta própria — use só quando ajudar DE VERDADE o que está sendo falado agora.)`,
    );
  }
  if (params.koloVivoLacunas?.trim()) {
    linhas.push(
      `\n<lacunas_do_perfil>\n${params.koloVivoLacunas}\nUse isto pra perguntar só o PERTINENTE (não re-pergunte o que já tem) e pra saber o que ainda falta antes de montar um relatório.\n</lacunas_do_perfil>`,
    );
  }
  // ── FASE 4A (10/08/2026) ────────────────────────────────────────────────
  // A âncora vem COLADA no perfil, e não no fim — medido na web em 09/08: sem
  // instrução de precedência, o repertório genérico apagava o que o perfil
  // registrava, e a âncora colocada depois do repertório chegava tarde demais.
  const blocoPerfil4A = linhasDoPerfilConsultavel(params.perfilConsultavel);
  if (blocoPerfil4A) {
    linhas.push(
      `\n<o_que_ja_sabemos>\n${ANCORA_PERFIL}\nNÃO pergunte o que está em "sabemos" nem o que está em "NÃO se aplica" — a família já respondeu, e repetir a pergunta desfaz a confiança de ter contado.\n${blocoPerfil4A}\n</o_que_ja_sabemos>`,
    );
  }
  if (params.base2?.length) {
    linhas.push(
      `\n<como_compreender_este_tema>\nMaterial INTERNO de raciocínio — não repita nada disto para a família e não transforme as bifurcações em questionário. Use para decidir O QUE ainda muda a conduta, e faça no máximo UMA pergunta: a que separa os caminhos.\n${params.base2
        .map((s) => `### ${s.titulo}\n${s.conteudo}`)
        .join("\n\n")}\n</como_compreender_este_tema>`,
    );
  }
  // REPERTÓRIO DA KOLO — a Camada 2, que até 06/08/2026 não chegava ao WhatsApp
  // em nenhum turno. Vem do MESMO recuperador que a web usa, escolhido pela
  // skill que a classificação de intenção já devolveu — sem chamada extra.
  if (params.repertorio?.trim()) {
    linhas.push(`\n${params.repertorio}`);
  }
  // FASE 4A · a licença generativa fecha o contexto, e vem por último de
  // propósito: ela fala SOBRE o material acima. Sem material acima, só
  // aumentaria o risco de invenção — a bancada de 09/08 pegou exatamente isso
  // num caso sem repertório aderente. Daí a guarda dupla:
  //
  //   1. `piloto4A` — SEM ISTO A LICENÇA VAZA. O WhatsApp entrega repertório a
  //      TODA família desde 06/08, então uma guarda só por "há material" ligaria
  //      a licença para as 55 famílias de fora. Este canal não tem o equivalente
  //      da web, onde a licença já vale para todos desde a 4A.2.
  //   2. presença de material — a mesma regra da web, pelo mesmo motivo.
  if (params.piloto4A && (blocoPerfil4A || params.base2?.length || params.repertorio?.trim())) {
    linhas.push(`\n${LICENCA_GENERATIVA}`);
  }
  if (params.estrategiasRecentes && params.estrategiasRecentes.length > 0) {
    linhas.push(
      `\n<perguntas_recentes_nas_estrategias>\n${params.estrategiasRecentes
        .map((q) => `- ${q}`)
        .join("\n")}\n</perguntas_recentes_nas_estrategias>`,
    );
  }
  if (params.historico.length > 0) {
    // `sobre` só vem quando o turno é de OUTRA criança da mesma família.
    const temOutroMembro = params.historico.some((h) => h.sobre);
    const hist = params.historico
      .map((h) => {
        const quem = h.de === "mae" ? params.nomeMae : "Ayla";
        return h.sobre ? `${quem} (sobre ${h.sobre}): ${h.texto}` : `${quem}: ${h.texto}`;
      })
      .join("\n");
    // PROGRESSÃO. A regra da VOZ ("avance a conversa") não segurou: em dois
    // turnos seguidos a Ayla repetiu sair da loja / falar pouco / pressão, com
    // a própria resposta anterior no histórico e tudo. Aqui ela recebe a lista
    // do que já orientou — concreto é mais difícil de atropelar que exortação.
    // Só os turnos DELA, e nunca os que são sobre outro irmão.
    const progressao = blocoProgressao(
      angulosUsados(
        params.historico.filter((h) => h.de === "ayla" && !h.sobre).map((h) => h.texto),
      ),
    );
    linhas.push(
      `\n<conversa_recente>\n${hist}\n</conversa_recente>` +
        (progressao ? `\n${progressao}` : "") +
        // ⚠️ A REGRA QUE FALTAVA. Sem ela, a Ayla disse a uma mãe que a Manu
        // "já mostrou que se concentra melhor com as mãos ocupadas" — o que
        // quem tinha mostrado era o irmão, o Mario.
        (temOutroMembro
          ? `\n(⚠️ As linhas marcadas "(sobre NOME)" são de OUTRA criança desta família. O que foi observado nela NÃO é fato sobre ${params.nomeMembro ?? "a criança de agora"} — não transfira característica, preferência nem estratégia de um irmão para o outro. Se precisar, pergunte.)`
          : ""),
    );
  }
  linhas.push(`\n<mensagem_de_agora>\n${params.mensagem}\n</mensagem_de_agora>`);

  const notas: string[] = [];
  notas.push(
    `ANCORE no que está sendo falado AGORA (a <mensagem_de_agora> + a <conversa_recente>), como alguém atenta à conversa — um bom ouvinte. NÃO puxe por conta própria um assunto guardado no perfil que ninguém trouxe agora (um interesse antigo como futebol/Copa, um passeio/viagem que já foi mencionado antes) — o perfil é fundo e pode estar desatualizado. Se a mensagem citar algo que você NÃO conhece, PERGUNTE o que é (com naturalidade) — nunca troque por um fato antigo do perfil nem invente um contexto.`,
  );
  if (
    /\b(obede|desobed|n[ãa]o\s+(me\s+)?(escuta|ouve|obedece)|birra|malcriad|mal[-\s]criad|teimos|fazer\s+o\s+que\s+(eu\s+)?mando)/i.test(
      params.mensagem,
    )
  ) {
    notas.push(
      `A mãe descreveu o comportamento como DESOBEDIÊNCIA/birra. NÃO valide esse enquadre (não diga "a desobediência", "ela não obedece"). No método Kolo, a criança não está "desobedecendo" — quase sempre está sobrecarregada, desregulada, com medo ou sem conseguir naquele momento. Reenquadre com gentileza e sem julgar a mãe: o que parece desobediência costuma ser o corpo pedindo socorro. O foco é entender o gatilho e co-regular JUNTO — nunca obediência, controle ou "fazer obedecer".`,
    );
  }
  // REGRA DO TURNO — vale nos TRÊS ramos abaixo, e por isso vem antes deles.
  //
  // Até 01/08/2026 o limite duro de perguntas existia SÓ no ramo "perguntar".
  // O ramo padrão — o que roda numa mensagem comum — não tinha limite nenhum:
  // sobrava a cláusula "no máximo UMA pergunta por vez" perdida dentro do
  // FORMATO_WHATSAPP, um bloco de FORMATAÇÃO, competindo com um princípio que
  // manda mapear o cenário inteiro. Foi assim que uma mãe trouxe TRÊS
  // dificuldades (impulsividade, atenção, insegurança) e recebeu DUAS
  // investigações simultâneas e nenhuma direção.
  //
  // A regra canônica mora no núcleo (TEMPO ATÉ A DIREÇÃO, em REGRA_SEQUENCIA).
  // Esta nota é só o lembrete no turno — não uma segunda versão da regra.
  notas.push(
    `REGRA DESTE TURNO: a mãe tem que sair daqui com algo concreto. Se já existe uma primeira orientação SEGURA — algo que ajuda e não depende do que ela responder —, ENTREGUE agora; a pergunta vem junto ou depois. No máximo UMA pergunta, e só se a resposta MUDAR o seu próximo passo. Isto vale com UM problema só, não apenas quando ela traz vários. Se ela trouxe MAIS DE UMA dificuldade, não investigue duas ao mesmo tempo: organize o que ela trouxe, escolha UMA pra começar (dizendo por que aquela), dê a direção JÁ nesta resposta e deixe as outras explicitamente pra depois.`,
  );

  // ELA ACEITOU O QUE VOCÊ OFERECEU. Vem antes de tudo porque "sim" não carrega
  // conteúdo: sem o referente resolvido, o modelo reconstrói o turno a partir da
  // conversa inteira e responde outra coisa — foi assim que "Sim. Vamos montar
  // uma história." recebeu uma resposta sobre diagnóstico (04/08/2026).
  if (params.aceite) {
    notas.push(
      `ELA ESTÁ ACEITANDO O QUE VOCÊ OFERECEU no seu último turno: ${params.aceite}. FAÇA ISSO AGORA, neste turno. Não reabra o assunto geral da conversa, não volte a "por onde a gente começa?", não peça pra ela repetir o pedido, não pergunte de novo o que você já sabe. Se for algo que ela faz no app, mande o link direto e diga o que ela vai encontrar lá; se for algo seu, entregue. Se faltar UM dado sem o qual não dá pra fazer, pergunte SÓ esse dado — nada além dele.
HISTÓRIA é um destes casos: quem monta é ela, no app, e é rápido — você manda o link de Histórias, diz que o tema já vai do jeito que vocês combinaram aqui, e conta que dá pra criar o avatar pra criança virar o personagem. Não descreva a história inteira no WhatsApp nem prometa gerar você mesma.`,
    );
  }

  if (params.querPlano) {
    notas.push(
      `A pessoa está PEDINDO um plano (um roteiro / passo a passo). MUITO IMPORTANTE: NÃO escreva o plano aqui no WhatsApp — nada de passos numerados, listas longas, seções ou plano completo no chat. Responda em 1 ou 2 frases curtas, com carinho, mostrando que entendeu o que ela quer trabalhar. No máximo UMA dica curtinha.
QUEM ENTREGA O PLANO NÃO É VOCÊ, É O SISTEMA — logo depois desta sua fala, e numa mensagem própria, com o PDF e o link certo. Então nesta mensagem: NÃO mande link nenhum, NÃO diga que o PDF está vindo, NÃO diga que já montou, NÃO dê caminho de menu no app. Caso real (03/08/2026): você anunciou o PDF e colou um link que abria o Relatório pra professora — a mãe recebeu duas entregas, e a primeira era de outro recurso. Se você anunciar, ela vai procurar algo que ainda não existe.`,
    );
  } else {
    notas.push(
      `QUANDO OFERECER UM PLANO — e quando NÃO. Primeiro tenha uma CONVERSA RICA (entenda, acolha, agregue, explique como o cérebro/o desenvolvimento funciona, dê direção com ideias concretas) — e é assim, também, que a Kolo vai CONHECENDO a criança: faça as perguntas que ajudam E que revelam o perfil. O plano só vale quando faz sentido TRABALHAR algo com estrutura: ajustar o mindset / uma crença ("não é capaz" → é habilidade em construção), propor atividades pra desenvolver uma habilidade, superar um desafio ou treinar algo — e só depois de já ter ENTENDIDO o suficiente (pra o plano ser bom, não genérico — importante com quem chegou agora). Se o momento é de conversa que já vale por si (acolher, informar, tirar uma dúvida, dar direção), NÃO force um plano — sustente a conversa. ADEQUE SEMPRE À IDADE: criança pequena → brincadeiras/atividades/historinha; adolescente ou adulto → atividades e estratégias, NUNCA infantilize (nada de "brincadeiras"/"historinha" pra eles). Quando fizer sentido, ofereça UMA vez, de leve, no fim — e NUNCA como "um plano" seco (soa plano de ASSINATURA e a mãe pergunta o preço em vez de aceitar). Diga o que É: "quer que eu monte um plano estratégico com atividades pra isso? Vem em PDF aqui e fica salvo no app". NÃO fale em custo/preço na oferta — puxar dinheiro sem ela ter perguntado planta a dúvida que você queria evitar; se ela se confundir e perguntar, aí sim você esclarece. Não ofereça a cada mensagem nem se acabou de mandar um. Se ela disser "sim", o sistema entrega — você só confirma que está montando.`,
    );
  }
  // COMERCIAL e SUPORTE — as duas decisões que a auditoria de 22/08 encontrou
  // sem dono. Agora vêm da fonte canônica, e são as MESMAS da Web.
  if (ehPerguntaComercial(params.mensagem)) {
    // ⚠️ O LEGACY MANDA `/assinatura` SEM MAGIC LINK, e é uma escolha.
    // `RespostaParams` não carrega `supabase` nem `familyId`, e threadá-los por
    // este caminho mexeria numa peça que MEDI atender **2,59%** dos turnos e
    // está em retirada. O que não se negocia é o DESTINO: `/assinatura`, nunca
    // `/precos`. Ela cai no `/login` e entra — atrito, não porta errada.
    notas.push(notaComercial(linkAssinatura("pos_trial")));
  }
  if (precisaDeHumano(params.mensagem)) {
    notas.push(notaSuporte());
  }
  if (params.koloVivoResumo.trim() || (params.estrategiasRecentes?.length ?? 0) > 0) {
    notas.push(
      `Você acompanha esta família pelo Perfil (blocos acima). SÓ cite o que sabe quando ${params.nomeMae} perguntar o que você sabe, pedir um resumo, OU quando for de fato relevante ao que está sendo falado agora — aí cite de leve (idade, perfil, 1-2 desafios principais). Nunca traga um interesse ou passeio guardado que não veio ao caso agora, e nunca despeje tudo.`,
    );
  }
  if (params.precisaEscolherMembro) {
    notas.push(
      `Não ficou claro de qual filho ela fala (${params.precisaEscolherMembro.nomes.join(", ")}). Antes de tudo, pergunte com gentileza de quem é.`,
    );
  }
  if (params.sinais.desafio) {
    notas.push(
      `Nos bastidores já anotei o desafio do dia ("${params.sinais.desafio}") — não repita isso como um robô; no máximo reconheça com naturalidade.`,
    );
  }
  if (params.sinais.conquista) {
    notas.push(`Nos bastidores anotei a conquista ("${params.sinais.conquista}").`);
  }
  if (params.sinais.experimentou) {
    notas.push(
      `A criança experimentou algo novo ("${params.sinais.experimentou}"). Celebre a TENTATIVA em si — tentar já é uma vitória, mesmo que ela não tenha curtido. Não pressione a repetir nem force o que ela recusou.`,
    );
  }
  if (params.sinais.temSugestaoKoloVivo) {
    notas.push(
      `Apareceu algo que pode valer guardar no perfil da criança. Se — e só se — fizer sentido no fluxo, pergunte de leve se ela quer que eu guarde. Sem insistir.`,
    );
  }
  if (params.linksLudico) {
    const l = params.linksLudico;
    const nome = params.nomeMembro ?? "a criança";
    const partes: string[] = [];
    if (l.historia)
      partes.push(
        `HISTÓRIA (pra preparar/antecipar uma situação, ${nome} de protagonista) → mande ESTE link, que abre DIRETO na tela de criar história: ${l.historia}`,
      );
    // Rotina NÃO entra aqui: o link de rotina (dia/semana) é responsabilidade
    // exclusiva do fluxo conduzido (conduzirRotina), que pergunta o escopo antes.
    // Mandar o link da semana pelo reativo assumia a semana e contradizia o condutor.
    if (l.desenho) partes.push(`DESENHO (leitura de um desenho) → ESTE link: ${l.desenho}`);
    if (l.relatorio)
      partes.push(
        `RELATÓRIO da criança (pra escola/professora/terapeuta/médico) → quando a mãe precisar apresentar a criança, preparar reunião, consulta ou trocar de escola, ofereça. ATENÇÃO AO QUE VOCÊ PROMETE: o relatório é gerado POR ELA, NO APP — você NÃO gera aqui e NÃO manda o PDF pelo WhatsApp. Se ela pedir "gera e manda aqui", diga a verdade com naturalidade: você já organiza aqui os pontos principais, e o relatório em si ela gera no app, onde dá pra revisar e editar antes de baixar. Este link abre DIRETO na tela de Relatório: ${l.relatorio} — no app: *Evolução* → *Relatório*. NUNCA diga ou insinue que já gerou, que está gerando, ou que o arquivo vem depois.`,
      );
    partes.push(
      `Regras dos links: mande SEMPRE o link DIRETO do recurso (nunca um genérico) — a pessoa já cai na tela certa. O link JÁ loga ela; mas SE pedir e-mail/senha (às vezes acontece), depois de entrar ela chega no mesmo lugar.`,
    );
    partes.push(
      `Mande TAMBÉM o CAMINHO pelo app em palavras, curtinho, além do link — assim ela acha mesmo se o link falhar. Use SÓ estes caminhos, que são os que existem de verdade: "no app: *Lúdico* → *Histórias* → *Criar história*" (rotina: "*Lúdico* → *Rotinas visuais* → *Montar a rotina da semana*"; desenho: "*Lúdico* → *O que o desenho conta?*"; relatório: "*Evolução* → *Relatório*"). O menu Lúdico aparece como "Lúdico (Histórias, Rotina…)". NUNCA invente um caminho seguindo o padrão destes — se o recurso não está nesta lista, mande só o link.
E o caminho é pra CRIAR algo que ainda não existe. Se o artefato JÁ foi criado, o link específico é a navegação: não mande a mãe pra uma tela de criação depois que a coisa já está pronta.`,
    );
    if (l.avatar)
      partes.push(
        `AVATAR (explique bem quando oferecer história): pra ${nome} virar o personagem das histórias e dos cards, dá pra criar o avatar dele ANTES, uma vez só — fica salvo e vale pra tudo. É opcional, mas deixa a história com a cara dele. Diga o passo a passo curtinho: "1) se quiser, cria antes o avatar do ${nome} (Configurações → Avatar) — ${l.avatar}  2) depois é só criar a história (Lúdico → Histórias) — ${l.historia ?? ""}". Deixe claro que sem avatar também funciona.`,
      );
    notas.push(
      `RECURSOS DO LÚDICO: se ${params.nomeMae} pedir OU claramente se beneficiar — MESMO sem usar essas palavras — convide de leve. Não force nem ofereça se não vier a propósito.\n${partes.join("\n")}`,
    );
  }
  // SEGURANÇA ABERTA — vem depois das outras notas de propósito: quando existe,
  // ela manda em tudo que veio antes (recursos do Lúdico, oferta de plano...).
  if (params.notaDeSeguranca) {
    notas.push(params.notaDeSeguranca);
  }

  // POR ÚLTIMO, de propósito: quando existe, esta nota manda em todas as
  // outras. É o retorno de uma resposta que já foi barrada.
  if (params.regenerarPorDiagnostico) {
    notas.push(params.regenerarPorDiagnostico);
  }
  if (notas.length > 0) {
    linhas.push(`\n<notas_internas>\n${notas.join("\n")}\n</notas_internas>`);
  }
  if (params.imagemUrl) {
    linhas.push(
      `\n<foto>
A pessoa mandou uma FOTO — OLHE a imagem anexada e responda a ELA de verdade.
Se for uma TAREFA da escola/terapia:
- Ajude a mãe a ENTENDER o que a atividade exige (atenção sustentada, memória de trabalho, discriminação visual, controle motor…) à luz do perfil da criança — por que pesa.
- Ajude a FAZER, quebrando em micro-passos: uma unidade por vez. Ex.: "olha a 1ª linha, cadê a letra A? ela aponta → você vê a cor do A na legenda → pinta → COMEMORA"; depois procura o A na 2ª linha; faz uma PAUSA; depois a letra E… Um pouquinho de cada vez.
- Oriente o CLIMA: ambiente tranquilo e gostoso, sem pressa nem cobrança, pra a criança ASSOCIAR lição com prazer, não com sofrimento. Peça PACIÊNCIA — cada dia fica mais fácil.
- Ofereça ADAPTAÇÕES concretas (menos itens, uma linha por vez, virar jogo com tampinhas antes de pintar, um marcador pra não perder a linha, terminar em 2 momentos).
- Pode sugerir UMA pergunta construtiva pra escola ("qual habilidade querem desenvolver? há adaptação prevista pro perfil dela?").
- NÃO ataque o profissional nem valide xingamento — o ponto é a falta de PERSONALIZAÇÃO, não a atividade em si. Foque em ajudar a criança no dia a dia, ensinando a mãe.
</foto>`,
    );
  }
  linhas.push(`\nResponda como a Ayla.`);

  // Conteúdo do usuário: texto sempre; se veio FOTO, anexa o bloco de imagem
  // (a Ayla enxerga — Sonnet tem visão). Baixa e manda em base64 (URL da Z-API
  // pode expirar/exigir token). Se falhar o download, segue só com o texto.
  const textoUser = linhas.join("\n");
  let userContent: string | ConteudoUsuario[] = textoUser;
  if (params.imagemUrl) {
    const img = await baixarImagemBase64(params.imagemUrl);
    if (img) {
      userContent = [
        { type: "text", text: textoUser },
        { type: "image", source: { type: "base64", media_type: img.mediaType, data: img.base64 } },
      ];
    }
  }

  try {
    // Uma retentativa curta antes de desistir. A falha aqui não é rara nem
    // inofensiva: quando o modelo falha, a mãe recebe o texto fixo do
    // fallbackSimples ("Que coisa boa de ouvir 🌿") — que apareceu em conversa
    // real, respondendo a um desabafo. Sobrecarga/rate-limit passa em segundos.
    // O streaming saiu daqui. Ele já era INTERNO — os deltas só enchiam um
    // buffer, porque nada pode sair pro WhatsApp antes da rede de fronteiras
    // (quem publica é o orquestrador). Sem ninguém consumindo os deltas ao
    // vivo, uma chamada única entrega exatamente o mesmo texto e é o que
    // permite os dois providers pelo mesmo caminho.
    const r = await comRetentativaCurta(() =>
      gerarConversacional({
        provider,
        model,
        system,
        messages: [{ role: "user", content: userContent }],
        maxTokens: 900,
        // Só a Anthropic marca cache explicitamente; na OpenAI é automático e o
        // provider ignora o campo. Mantém o desconto que esta chamada já tinha.
        cacheSystem: true,
      }),
    );

    if (tracking) {
      await logarUsoApi(tracking.supabase, {
        family_account_id: tracking.family_account_id,
        // Do RETORNO, nunca de uma constante: com o provider vindo de env, um
        // literal aqui faria o /admin/uso-api cobrar o custo do modelo errado
        // no dia seguinte a um rollback.
        provider: r.provider,
        model: r.model,
        feature: tracking.feature,
        input_tokens: r.tokensIn,
        output_tokens: r.tokensOut,
      });
    }

    return r.texto.trim() || fallbackSimples(params);
  } catch (e) {
    console.warn("[ayla:responder] falha do modelo:", e instanceof Error ? e.message : e);
    // PERSISTE. Antes isto era só console.warn — e por isso ninguém sabia que
    // mães estavam recebendo o texto fixo do fallback no lugar da Ayla.
    if (tracking) {
      await logServerError("ayla_responder_falhou", e, {
        family_account_id: tracking.family_account_id,
        payload: { usouFallback: true },
      }).catch(() => {});
    }
    // Sem publicação aqui: nada foi enviado ainda, então não há resposta
    // partida a evitar. Quem decide o que fazer com o fallback é quem publica.
    return fallbackSimples(params);
  }
}

/**
 * Uma retentativa curta pra falha transitória (sobrecarga/rate-limit do
 * modelo). Só vale antes de qualquer coisa ter sido enviada — depois de a
 * primeira bolha sair, repetir viraria resposta partida.
 *
 * ⚠️ `return await`, e não `return`. Sem o await, a promessa rejeitada saía da
 * função ANTES do catch e a retentativa nunca rodava — só pegava erro lançado
 * de forma síncrona, que é justamente o que uma falha de rede não é. O
 * `fallbackSimples` ("Que coisa boa de ouvir 🌿" em cima de um desabafo) saía na
 * primeira falha, sempre.
 */


/**
 * Última linha de defesa: nunca deixar a Ayla muda. Só sai quando o modelo
 * falhou (ver o logServerError acima) — então tem que ser um texto que não
 * atrapalhe, em qualquer contexto. Sem vocativo quebrado ("Tô com você, oi") e
 * sem comemorar nada, porque aqui a Ayla não leu a mensagem de verdade.
 */
function fallbackSimples(p: RespostaParams): string {
  const nome = p.nomeMembro ?? pronomesPara(p.generoMembro).sujeito;
  const voc = p.nomeMae?.trim() ? `, ${p.nomeMae.trim()}` : "";
  if (p.precisaEscolherMembro) {
    return `Tô aqui. Sobre qual deles você quer falar — ${p.precisaEscolherMembro.nomes.join(" ou ")}?`;
  }
  if (p.sinais.desafio) {
    return `Tô com você${voc}. Me conta um pouco mais do que tá acontecendo com ${nome}?`;
  }
  // Antes isto era "Que coisa boa de ouvir 🌿 Fico feliz por vocês" — e saiu
  // respondendo a um desabafo, porque a Ayla nem tinha lido a mensagem.
  return `Tô por aqui${voc} — me conta um pouco mais?`;
}
