import type { SupabaseClient } from "@supabase/supabase-js";
import { getAylaAnthropicClient, AYLA_MODEL_FALLBACK } from "./anthropic";
import { logarUsoApi } from "@/lib/billing/logar";
import { pronomesPara, type Genero, type CuidadorDescrito } from "./pronomes";
// NÚCLEO DE CONDUÇÃO — fonte única compartilhada com as Estratégias (web):
// identidade + norte, princípios, regra de sequência, exemplos, piso e tom.
// Ver lib/conducao/diretrizes.ts. A Ayla adiciona só o que é do WhatsApp
// (formato e idioma). A identidade agora vive no CÓDIGO (não mais no banco
// voz_ayla), o que elimina o drift banco×código.
import { nucleoConducao } from "@/lib/conducao/diretrizes";

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
 * FORMATO da resposta no WhatsApp — específico do canal (o resto da condução vem
 * do núcleo). Curto por padrão, mas com espaço quando a necessidade pede; e as
 * fronteiras com os fluxos próprios (rotina visual, plano completo).
 */
export const FORMATO_WHATSAPP = `# Formato (WhatsApp)
- Texto puro de WhatsApp: sem markdown (nada de **, ##, listas com - / •), sem aspas, sem rótulo, sem "Ayla:". Pra destacar uma palavra, *um asterisco só* (negrito do WhatsApp), com muita parcimônia.
- Curto por padrão — 2 a 4 balões curtos — mas dê o espaço que a necessidade pedir: uma pergunta prática (comida, estratégia) merece 3-5 opções concretas; um desabafo, poucas linhas. No máximo UMA pergunta por vez.
- Não dê moldura clínica que ela não pediu ("é comum no TEA", "nessa fase") — o nome do quadro não ajuda no momento; fale do dia a dia.
- ROTINA VISUAL e PLANO completo têm fluxo próprio: NÃO monte a rotina nem escreva um plano passo a passo aqui no chat, e não invente horários. Quando a pessoa pedir, um fluxo guiado assume a rotina, e o plano completo vai em PDF/link.`;

/**
 * Espelhamento de idioma. A Ayla responde SEMPRE na língua em que a mãe
 * escreveu — de graça, sem tabela de traduções. O contexto e o perfil da
 * criança podem estar em português; ela lê normalmente e RESPONDE na língua
 * dela. Injetado no fim do system (vale pro prompt do banco e pro fallback),
 * então não depende de editar o prompt em produção.
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
  /** Vínculo + gênero do adulto responsável (mãe, pai, avó, tia...). */
  cuidador?: CuidadorDescrito;
  nomeMembro: string | null;
  idadeMembro?: number | null;
  perfilMembro?: string | null;
  generoMembro?: Genero;
  koloVivoResumo: string;
  /** O que o perfil da criança já tem × o que falta, por domínio — pra a Ayla
   *  perguntar só o pertinente (sem repetir) e saber o que falta pro relatório. */
  koloVivoLacunas?: string;
  /** Títulos das últimas conversas nas Estratégias (in-app), pra continuidade. */
  estrategiasRecentes?: string[];
  historico: Array<{ de: "mae" | "ayla"; texto: string }>;
  mensagem: string;
  /** URL de uma FOTO que a pessoa mandou — a Ayla LÊ a imagem (lição, rótulo, agenda…). */
  imagemUrl?: string | null;
  sinais: SinaisResposta;
  /** A pessoa pediu um plano explicitamente — não escreva o plano, ofereça. */
  querPlano?: boolean;
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
 * Gera a resposta da Ayla. Se `onParagrafo` for passado, faz streaming e
 * dispara cada parágrafo assim que fica pronto (pra mandar no WhatsApp em
 * pedaços — efeito de "digitando", primeira parte chega rápido). Sempre
 * devolve o texto completo no fim (pra persistir uma vez só).
 */
export async function gerarRespostaAyla(
  params: RespostaParams,
  onParagrafo?: (texto: string) => Promise<void>,
  tracking?: UsageTracking,
): Promise<string> {
  const client = getAylaAnthropicClient();
  const system =
    nucleoConducao() + "\n\n" + FORMATO_WHATSAPP + "\n\n" + DIRETRIZ_IDIOMA;

  const linhas: string[] = [];
  const relacao = params.cuidador?.relacao;
  const refMembro = params.nomeMembro ?? "quem está em foco";
  linhas.push(
    `Você está falando com ${params.nomeMae}${relacao ? `, ${relacao} de ${refMembro}` : ""}.`,
  );
  if (params.cuidador) {
    const pc = pronomesPara(params.cuidador.genero);
    if (pc.generoDefinido) {
      linhas.push(
        `Trate ${params.nomeMae} no ${
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
  if (params.estrategiasRecentes && params.estrategiasRecentes.length > 0) {
    linhas.push(
      `\n<perguntas_recentes_nas_estrategias>\n${params.estrategiasRecentes
        .map((q) => `- ${q}`)
        .join("\n")}\n</perguntas_recentes_nas_estrategias>`,
    );
  }
  if (params.historico.length > 0) {
    const hist = params.historico
      .map((h) => `${h.de === "mae" ? params.nomeMae : "Ayla"}: ${h.texto}`)
      .join("\n");
    linhas.push(`\n<conversa_recente>\n${hist}\n</conversa_recente>`);
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
  if (params.querPlano) {
    notas.push(
      `A pessoa está PEDINDO um plano (um roteiro / passo a passo). MUITO IMPORTANTE: NÃO escreva o plano aqui no WhatsApp — nada de passos numerados, listas longas, seções ou plano completo no chat. Responda em 1 ou 2 frases curtas, com carinho, dizendo que você já está montando um plano completo sobre isso e vai mandar pra ela agora — em PDF e com um link pra abrir no app (com ideias práticas, frases pra usar e o que observar). No máximo UMA dica curtinha; o plano de verdade vai no PDF/link, não no chat.`,
    );
  } else {
    notas.push(
      `Se a conversa está construindo material prático pra desenvolver uma HABILIDADE ou lidar com um desafio recorrente (ex.: vocabulário, foco, alimentação, uma rotina) e você já deu ideias concretas, pode OFERECER juntar tudo num plano — UMA vez, de leve, no fim da mensagem: "quer que eu monte um plano completo sobre isso — com as brincadeiras, atividades e até uma historinha — pra você ter salvo e organizado?". Não ofereça o mesmo plano a cada mensagem, nem se você acabou de mandar um. Se ela disser "sim", o sistema entrega o plano — você só confirma que está montando.`,
    );
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
        `RELATÓRIO da criança (pra escola/professora/terapeuta) → quando a mãe precisar apresentar a criança, preparar reunião ou trocar de escola, ofereça montar um relatório. A web já GERA o relatório a partir do que a gente sabe da criança (Perfil + registros), editável e em PDF. Mande ESTE link quando tiver o essencial preenchido: ${l.relatorio} — no app: *Evolução* → *Relatório*.`,
      );
    partes.push(
      `Regras dos links: mande SEMPRE o link DIRETO do recurso (nunca um genérico) — a pessoa já cai na tela certa. O link JÁ loga ela; mas SE pedir e-mail/senha (às vezes acontece), depois de entrar ela chega no mesmo lugar.`,
    );
    partes.push(
      `SEMPRE mande TAMBÉM o CAMINHO pelo app em palavras, curtinho, além do link — assim ela acha mesmo se o link falhar. Use o menu: "no app: *Lúdico* → *Histórias* → *Criar história*" (rotina: "*Lúdico* → *Rotinas visuais* → *Montar a rotina da semana*"; desenho: "*Lúdico* → *O que o desenho conta?*"). O menu Lúdico aparece como "Lúdico (Histórias, Rotina…)".`,
    );
    if (l.avatar)
      partes.push(
        `AVATAR (explique bem quando oferecer história): pra ${nome} virar o personagem das histórias e dos cards, dá pra criar o avatar dele ANTES, uma vez só — fica salvo e vale pra tudo. É opcional, mas deixa a história com a cara dele. Diga o passo a passo curtinho: "1) se quiser, cria antes o avatar do ${nome} (Configurações → Avatar) — ${l.avatar}  2) depois é só criar a história (Lúdico → Histórias) — ${l.historia ?? ""}". Deixe claro que sem avatar também funciona.`,
      );
    notas.push(
      `RECURSOS DO LÚDICO: se ${params.nomeMae} pedir OU claramente se beneficiar — MESMO sem usar essas palavras — convide de leve. Não force nem ofereça se não vier a propósito.\n${partes.join("\n")}`,
    );
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

  let enviouAlgo = false;
  try {
    const stream = client.messages.stream({
      model: AYLA_MODEL_FALLBACK,
      max_tokens: 900,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userContent }],
    });

    if (!onParagrafo) {
      const final = await stream.finalMessage();
      if (tracking) {
        await logarUsoApi(tracking.supabase, {
          family_account_id: tracking.family_account_id,
          provider: "anthropic",
          model: AYLA_MODEL_FALLBACK,
          feature: tracking.feature,
          input_tokens: final.usage.input_tokens,
          output_tokens: final.usage.output_tokens,
        });
      }
      const txt = textoDe(final.content);
      return txt || fallbackSimples(params);
    }

    // Streaming: manda cada parágrafo (separado por linha em branco) assim
    // que ele fecha. A primeira parte chega bem mais rápido.
    let buffer = "";
    let full = "";
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        buffer += event.delta.text;
        full += event.delta.text;
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const par = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 2);
          if (par) {
            await onParagrafo(par);
            enviouAlgo = true;
          }
        }
      }
    }
    const resto = buffer.trim();
    if (resto) {
      await onParagrafo(resto);
      enviouAlgo = true;
    }
    const fullTrim = full.trim();
    if (tracking) {
      const final = await stream.finalMessage();
      await logarUsoApi(tracking.supabase, {
        family_account_id: tracking.family_account_id,
        provider: "anthropic",
        model: AYLA_MODEL_FALLBACK,
        feature: tracking.feature,
        input_tokens: final.usage.input_tokens,
        output_tokens: final.usage.output_tokens,
      });
    }
    if (!enviouAlgo) {
      const fb = fallbackSimples(params);
      await onParagrafo(fb);
      return fb;
    }
    return fullTrim;
  } catch (e) {
    console.warn("[ayla:responder] falha do modelo:", e instanceof Error ? e.message : e);
    const fb = fallbackSimples(params);
    // Só manda o fallback se ainda não enviou nada (evita resposta partida).
    if (onParagrafo && !enviouAlgo) {
      try {
        await onParagrafo(fb);
      } catch {
        /* não trava o fluxo */
      }
    }
    return fb;
  }
}

function textoDe(content: Array<{ type: string }>): string {
  return (content as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();
}

/** Última linha de defesa: nunca deixar a Ayla muda. */
function fallbackSimples(p: RespostaParams): string {
  const nome = p.nomeMembro ?? pronomesPara(p.generoMembro).sujeito;
  if (p.precisaEscolherMembro) {
    return `Tô aqui. Sobre qual deles você quer falar — ${p.precisaEscolherMembro.nomes.join(" ou ")}?`;
  }
  if (p.sinais.desafio) {
    return `Tô com você, ${p.nomeMae}. Respira fundo — um passo de cada vez. Me conta um pouco mais do que tá acontecendo com ${nome} agora?`;
  }
  if (p.sinais.conquista) {
    return `Que coisa boa de ouvir 🌿 Fico feliz por vocês.`;
  }
  return `Tô por aqui, ${p.nomeMae}. Como foi o dia de vocês hoje?`;
}
