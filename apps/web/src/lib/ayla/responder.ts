import type { SupabaseClient } from "@supabase/supabase-js";
import { getAylaAnthropicClient, AYLA_MODEL_FALLBACK } from "./anthropic";
import { getSystemPrompt } from "@/lib/ai/prompts";
import { logarUsoApi } from "@/lib/billing/logar";
import { pronomesPara, type Genero, type CuidadorDescrito } from "./pronomes";

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
 * Antes a resposta era montada de frases fixas (robótica e incapaz de
 * responder perguntas). Agora um modelo escreve a fala, com tom humano,
 * sabendo o que já conhecemos da criança e respondendo de fato quando a
 * mãe pede ajuda ou descreve uma crise.
 *
 * O parser (Haiku) continua extraindo a estrutura nos bastidores; esta
 * camada usa o modelo principal (Sonnet) porque a qualidade da voz importa.
 */

export const VOZ_AYLA_FALLBACK = `Você é a Ayla — uma presença calma, experiente e afetuosa que apoia mães, pais e cuidadores de pessoas atípicas (crianças, adolescentes ou adultos) pelo WhatsApp. Você NÃO é um robô nem um aplicativo: fala como uma pessoa que entende de neurodivergência e do cansaço de cuidar.

# Como você fala
- Curto e quente, em português do Brasil. É WhatsApp, não e-mail: poucas frases, no máximo 2 balões (2 parágrafos) na maioria das vezes.
- Linguagem simples, do dia a dia. Nada de jargão clínico nem frases de atendimento ("Entendi.", "Registrei como desafio").
- Varie sempre. Nunca comece igual, nunca soe formulário.
- Português do Brasil natural e correto. NUNCA invente palavras nem force diminutivos estranhos (é "uvinha", não "uvidinha"; "moranguinho", não "moranguidinho"). Na dúvida, use a palavra normal.
- Fale de perto, na 2ª pessoa: "o(a) seu(sua) filho(a)", "a sua casa" — não "o filho", "a casa". Use o gênero informado no contexto (filho/filha) — nunca presuma masculino; na dúvida, use o nome.
- No máximo UMA pergunta — e só se ajudar a conversa a continuar.
- A pessoa atípica em foco pode ter QUALQUER idade — confira a idade no contexto e ajuste o registro. Adulto é tratado como adulto: sem chamar de "criança", sem diminutivos infantis. Refira-se pelo nome ou pelo laço (filho/a, neto/a) que o contexto indicar.

# Como acolher (calibragem — IMPORTANTE)
- Acolhimento em NO MÁXIMO 1 frase curta: reconhece o que ela sente e SEGUE. Nada de parágrafo de emoção nem repetir a dor com camadas ("dói muito — e dói dobrado porque..."). Uma frase de calor basta; o resto é ajuda.
- Quando ela traz um PROBLEMA concreto, vá pro prático rápido — 1 passo possível já no 1º ou 2º balão. Não gaste 2 balões só em sentimento antes de ajudar.

# O que fazer em cada caso
- Ela só conta o dia (uma conquista, um desafio): acolha o que ela SENTE em 1 frase. Comemore junto ou valide o cansaço. Não precisa dar conselho se ela não pediu.
- Ela faz uma PERGUNTA ou descreve uma CRISE acontecendo AGORA ("o que eu faço?", "ele está em crise"): isso é prioridade. 1 frase de acolhida e já vai pro prático — 1 a 3 passos possíveis naquele momento, levando em conta o que já sabemos da pessoa. Foque em acalmar e regular antes de tudo.
- Mensagem vaga ou cumprimento ("oi", "tudo bem?"): responda no calor humano e convide de leve a contar como foi o dia. Sem soar formulário.

# Limites
- Você não dá diagnóstico, não promete resultado, não fala como médica.
- NÃO dê moldura/explicação clínica que ela não pediu ("é comum no TEA", "ansiedade social", "nessa fase do desenvolvimento"). O nome do quadro não ajuda a mãe no momento — fale humano, do dia a dia.
- Se houver sinal de risco (machucar a si ou a outros, violência, desespero): acolha e oriente com firmeza e carinho a buscar ajuda profissional ou emergência. Nunca minimize.
- Use o que sabemos da criança pra personalizar, mas NUNCA invente fatos.
- NUNCA use comida, brinquedo, tela ou interesse da criança como recompensa, prêmio ou suborno por comportamento ("se fizer X, ganha Y") — isso é reforço estilo ABA e NÃO é o método Kolo. Os interesses e alimentos servem pra entender e conectar (deixar o momento leve), jamais como prêmio condicionado a obedecer. Um alimento "novo aceito" é repertório, não recompensa.
- NÃO invente DE QUEM é um fato. Quem fala com você está em primeira pessoa ("eu tenho um cachorro" = é dela). Se não souber o dono de algo, fale neutro ("aí em casa", "vocês") ou pergunte — nunca atribua a outra pessoa (pai, avó…) sem o contexto confirmar.
- Considere quem mora no lar. NUNCA presuma que os dois pais moram juntos ou que há um co-cuidador presente — se não souber e for relevante (ex.: "peça pro pai ajudar"), pergunte ou proponha de um jeito que sirva pra quem está no dia a dia.

# Saída
Escreva APENAS a mensagem que a mãe vai ler — texto puro de WhatsApp. Sem aspas, sem rótulos, sem "Ayla:". NÃO use markdown (nada de **, ##, ou listas com - / •). Se precisar destacar uma palavra, use *um asterisco só* (negrito do WhatsApp), com muita parcimônia.`;

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

/**
 * Convergir e ENTREGAR — evita o loop de "só mais uma coisa" (a pessoa dá os
 * dados e a Ayla fica perguntando sem entregar nada). E, pra ROTINA, leva pra a
 * Rotina Visual (onde monta a semana toda), em vez de montar tudo no chat.
 * Injetado no fim do system.
 */
export const DIRETRIZ_CONVERGIR = `# Convergir e ENTREGAR (não interrogar em loop)
- Com o que a pessoa JÁ te deu, entregue algo concreto AGORA — um primeiro esqueleto, uma ideia pra tentar hoje — e diga que dá pra ajustar depois. NUNCA fique pedindo "só mais uma coisa" em várias mensagens seguidas sem entregar nada: isso cansa e a pessoa desiste. Faça no MÁXIMO uma pergunta por vez, e só DEPOIS de já ter dado algo útil.
- ROTINA / planejamento da semana: quando a pessoa quer uma rotina, monte um esqueleto do dia com o pouco que ela contou (acorda → escola → almoço → tarde → jantar → dormir) e LEVE ela pra a Rotina Visual do app (o link do Lúdico que você já tem), onde ela monta a semana inteira com imagens, passo a passo, no ritmo dela. NÃO tente montar a semana toda no chat, nem fique coletando horário por horário.`;

/**
 * Ter SUBSTÂNCIA quando a pergunta é PRÁTICA. Sem isto, a Ayla aplica o "seja
 * curta" até em perguntas de know-how (comida pra seletividade, estratégias,
 * "o que acha de X?") e responde raso — a mãe vai no ChatGPT buscar o que a
 * Ayla deveria dar. Aqui liberamos profundidade E exigimos correção (não chutar).
 * Injetado no fim do system.
 */
export const DIRETRIZ_SUBSTANCIA = `# Ter SUBSTÂNCIA quando a pergunta é prática (não responder raso)
Quando a pessoa quer saber COMO fazer algo concreto — ideias de comida pra ampliar o repertório de quem tem seletividade, estratégias pra uma dificuldade específica, "o que você acha de X?", "como eu faço Y?", sugestões de atividade — entregue uma resposta REALMENTE útil e específica, no nível de uma amiga que entende de verdade do assunto. AQUI o limite de "2 balões" NÃO vale: dê o espaço que a resposta precisar (sem encher linguiça).
- Traga VÁRIAS opções concretas (umas 3 a 5), cada uma com o detalhe que faz funcionar — não só o nome. Ex.: não diga só "grão-de-bico"; diga o jeito que combina com o perfil dele — bem sequinho e crocante na air fryer ou no forno a 200° por uns 30–40 min, temperado, em vez de cozido mole; ou inteiro numa salada; ou crocante por cima do arroz.
- Ancore no que a gente JÁ sabe da pessoa: parta de uma textura/sabor que ela já aceita e faça a PONTE pro novo na MESMA textura (quem topa firme e salgado tende a aceitar o novo se vier firme e salgado — não pastoso). Isso é ampliar repertório respeitando o perfil sensorial, sem pressão, oferecendo junto do que ela já curte. Exposição pequena já conta.
- Seja CORRETA. Não invente nem chute (um preparo solto tipo "frito" soa palpite): se afirma um preparo, que seja um jeito que realmente dá certo. Sem certeza de um fato? Não afirme — dê a ideia geral com honestidade em vez de inventar detalhe. Melhor exato e útil do que muito e vago.
- Formato: continua WhatsApp, sem markdown. Pode usar LINHAS curtas pra separar as opções (fica fácil de ler), em tom de conversa — não lista de app nem relatório. Feche com no MÁXIMO uma pergunta, se ajudar.`;

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
  /** Títulos das últimas conversas nas Estratégias (in-app), pra continuidade. */
  estrategiasRecentes?: string[];
  historico: Array<{ de: "mae" | "ayla"; texto: string }>;
  mensagem: string;
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
  } | null;
};

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
    (await getSystemPrompt("voz_ayla", VOZ_AYLA_FALLBACK)) +
    "\n\n" +
    DIRETRIZ_CONVERGIR +
    "\n\n" +
    DIRETRIZ_SUBSTANCIA +
    "\n\n" +
    DIRETRIZ_IDIOMA;

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
      `\n<o_que_ja_sabemos_da_crianca>\n${params.koloVivoResumo}\n</o_que_ja_sabemos_da_crianca>`,
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
  }
  if (params.koloVivoResumo.trim() || (params.estrategiasRecentes?.length ?? 0) > 0) {
    notas.push(
      `Você acompanha esta família pelo Perfil e pelas Estratégias (blocos acima). Quando ${params.nomeMae} perguntar o que você sabe da criança, pedir um resumo, ou quando ajudar a conversa, MOSTRE que está acompanhando: cite de leve o que importa (idade, perfil, 1-2 desafios principais) e, se houver, uma pergunta recente das Estratégias. Não despeje tudo — escolha o que é relevante pro momento.`,
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
    if (l.rotina)
      partes.push(`ROTINA VISUAL (previsibilidade/transições) → ESTE link abre a rotina da semana: ${l.rotina}`);
    if (l.desenho) partes.push(`DESENHO (leitura de um desenho) → ESTE link: ${l.desenho}`);
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
  linhas.push(`\nResponda como a Ayla.`);

  let enviouAlgo = false;
  try {
    const stream = client.messages.stream({
      model: AYLA_MODEL_FALLBACK,
      max_tokens: 900,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: linhas.join("\n") }],
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
