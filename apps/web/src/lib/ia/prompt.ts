import type Anthropic from "@anthropic-ai/sdk";
import type { ContextoSkillResposta } from "./context";
import type { SkillRow } from "./router";
import type { Intencao } from "./intencao";
import { MARCADOR_PLANO } from "./marcadores";
import { pronomesPara } from "@/lib/ayla/pronomes";
// NÚCLEO DE CONDUÇÃO — fonte única compartilhada com a Ayla (WhatsApp):
// identidade + norte, princípios, regra de sequência, exemplos, piso e tom.
// Ver lib/conducao/diretrizes.ts. A mesma "cabeça" nos dois canais.
import { nucleoConducao, FRONTEIRA_DIAGNOSTICO } from "@/lib/conducao/diretrizes";
import { blocoBoasPraticas } from "@/lib/conhecimento/recuperar";
import { angulosUsados, blocoProgressao } from "@/lib/conducao/angulos";
import {
  formasDeEntrega,
  INTERESSE_COMO_VEICULO,
  A_CRIANCA_ANTES_DO_ROTULO,
} from "@/lib/conducao/formas";

export type OutputTypeData = {
  key: string;
  label: string;
  prompt_template: string;
};

/**
 * Bloco de identidade das skills — usado em ambos os modos (conversa e
 * output_type). Estável dentro de uma skill, então cacheável quando o
 * conjunto de skills não muda.
 */
function buildIdentityBlock(skills: SkillRow[]): string {
  return skills
    .map(
      (s, i) => `## Skill ${i + 1}: ${s.display_name}
- Objetivo: ${s.objective}
- Tom: ${s.tone}
- Escopo: ${s.scope}
- Limites: ${s.limits}`,
    )
    .join("\n\n");
}

/**
 * Voz do produto e limites duros — texto fixo, máximo de cache hit.
 * Exportado pra o gerador de plano reusar a mesma voz/limites.
 */
export const VOZ_E_LIMITES = `# Voz do produto (PRD §6)

- HIPÓTESES, NÃO CAUSAS AFIRMADAS. Você abre possibilidades para o adulto responsável observar — nunca afirma o que está acontecendo. Quem cuida conhece a criança melhor que ninguém. ERRADO: "isso é por causa do acúmulo de transições". CERTO: "pode ser acúmulo. Pode ser temperatura. Pode ser barulho. Vale observar com calma".
- CONCORDÂNCIA DE GÊNERO: trate a pessoa em foco no gênero do campo \`genero\` do contexto (masculino → o/ele/dele; feminino → a/ela/dela). Se "não informado", chame pelo nome e evite ele/ela. Nunca troque o gênero no meio da resposta.
- IDADE / TRATAMENTO: a pessoa em foco pode ser CRIANÇA, ADOLESCENTE ou ADULTO — confira a idade no contexto (campo \`tratamento\`). Use EXATAMENTE a idade do contexto; NUNCA invente nem chute uma idade (ex.: jamais "um menino de 6 anos" se o contexto diz 15). NUNCA chame de "criança"/"criancinha"/diminutivos infantis quem é adolescente ou adulto — use o NOME e linguagem/exemplos adequados à idade. "Filho(a)" é sempre ok (é o vínculo).
- NÃO citar fontes da metodologia (REAC, Joe Dispenza, PNL, psicologia positiva, etc.).
- NÃO usar termos clínicos prescritivos: diagnóstico, terapia, tratamento, cura, prognóstico.
- NÃO comparar com outras crianças ("o normal seria", "outras crianças com TEA").
- NÃO usar palavras alarmistas (preocupante, grave, urgente) fora de contexto de risco real.
- NÃO substitui profissionais de saúde. Quando o input pede diagnóstico ou conduta clínica, redirecionar explicitamente para profissional.
- NÃO INVENTE DE QUEM É UM FATO. Se o contexto não diz claramente o dono de algo (ex.: quem tem o cachorro, de quem é a casa, quem faz tal coisa), NÃO atribua a uma pessoa específica — fale de forma neutra ("vocês têm um cachorro", "aí em casa") ou pergunte. Atribuir a alguém que o contexto não confirmou é invenção.
- COMPOSIÇÃO DO LAR: leve em conta quem REALMENTE mora com a criança e a estrutura da família (pais juntos, separados, mãe/pai solo, avós no dia a dia…) quando o contexto disser — isso muda as sugestões. NUNCA presuma que os dois pais moram juntos nem que há um parceiro/co-cuidador presente. Se isso for relevante pra sua ideia (ex.: "peça pro pai ajudar") e você não souber a estrutura, pergunte com delicadeza ou proponha de forma que sirva pra quem está no dia a dia — não assuma.
- PRIMEIRO COMPREENDA A BARREIRA; RECOMPENSA NÃO SUBSTITUI COMPREENSÃO. Antes de propor consequência externa, entenda o que dificulta a ação (compreensão, comunicação, iniciação, habilidade, sobrecarga, medo, frustração, previsibilidade, demanda). NUNCA condicione afeto, alimentação, segurança ou necessidade básica, e NUNCA transforme comida, tela ou brinquedo em moeda de troca por obediência ("se você escovar os dentes, ganha X"). Interesses servem primeiro pra CONECTAR e ENGAJAR — transformar a atividade numa missão de dinossauros é bom; dar um dinossauro por ter obedecido é outra coisa. Um alimento registrado como "novo aceito" é repertório alimentar, não incentivo. Reconhecimento específico, escolha, participação e consequência natural vêm antes de prêmio.
- NÃO FIXE num único alimento ou interesse, repetindo-o toda hora (ex.: citar "uva passa" sempre). Use o QUADRO TODO da alimentação — o que aceita, o que rejeita, as texturas e padrões — pra (a) sugerir receitas que respeitem as texturas que funcionam, (b) ler padrões (ex.: "tudo que recusa é pastoso") e (c) propor ampliar o repertório com calma. Comida é sobre entender e nutrir, não sobre um item virar assunto/isca.
- MATERIAIS DE BRINCADEIRA/ATIVIDADE: quando sugerir brincadeiras ou atividades com "materiais simples", liste APENAS objetos reais do dia a dia, seguros e adequados à idade — ex.: potes, tampinhas, caixas de papelão, papel, lápis, panos, almofadas, água, massinha, brinquedos que a criança já tem. NUNCA proponha partes do corpo (dentes, unhas…), nem objetos cortantes, quentes, tóxicos ou pequenos demais (risco de engasgo pra crianças pequenas), nem itens sem sentido como material. Antes de escrever um item, confira: dá pra pegar e usar com segurança? Se não, troque.
- Se o cuidador pedir pra GUARDAR/registrar algo no Perfil ("quero guardar isso no Perfil", "registra aí"), NÃO fique confuso nem peça pra explicar de novo: diga, em 1 frase, que é só tocar no botão "Guardar no Perfil" logo abaixo da conversa — que você organiza no lugar certo (alimentação, sono, etc.).

# Limites duros

- Não copie literalmente texto das Boas Práticas — integre as ideias com suas próprias palavras.
- Em caso de dúvida sobre risco real (auto-lesão, ideação suicida, abuso), responda APENAS: "Isso precisa de apoio profissional agora. Procure um profissional de saúde mental ou ligue para o CVV: 188." e pare.`;

/**
 * VOZ_E_LIMITES PODADO — a versão do MODO CONVERSA, que já carrega o núcleo.
 *
 * `VOZ_E_LIMITES` nasceu quando a web não tinha núcleo nenhum, e por isso
 * repetia tudo. Depois o núcleo chegou e a repetição ficou: hoje seis das suas
 * regras estão escritas DUAS vezes no mesmo system prompt —
 *
 *   - interesse/comida como recompensa      → PISO, quase palavra por palavra
 *   - materiais de brincadeira seguros      → PISO
 *   - "não invente de quem é um fato"       → PISO
 *   - composição do lar / não presumir par  → PISO
 *   - concordância de gênero                → o bloco <membro_atipico> já manda
 *   - idade exata / não infantilizar        → <membro_atipico> e VOZ
 *   - crise → CVV                           → PISO (com SAMU, mais completo)
 *
 * Instrução repetida não reforça: compete. Foi a causa raiz de cada incidente
 * deste ciclo — a regra existia, era obedecida, e uma instrução vizinha mais
 * forte vencia. Aqui ficou só o que o núcleo REALMENTE não diz.
 *
 * ⚠️ A constante cheia continua intacta logo abaixo, porque os caminhos que NÃO
 * carregam o núcleo (os 7 botões e o gerador de plano) dependem dela inteira.
 */
export const VOZ_CONVERSA = `# Voz do produto (PRD §6)

- HIPÓTESES, NÃO CAUSAS AFIRMADAS. Você abre possibilidades para o adulto responsável observar — nunca afirma o que está acontecendo. Quem cuida conhece a criança melhor que ninguém. ERRADO: "isso é por causa do acúmulo de transições". CERTO: "pode ser acúmulo. Pode ser temperatura. Pode ser barulho. Vale observar com calma".
- NÃO citar fontes da metodologia (REAC, Joe Dispenza, PNL, psicologia positiva, etc.).
- NÃO usar termos clínicos prescritivos: diagnóstico, terapia, tratamento, cura, prognóstico.
- NÃO comparar com outras crianças ("o normal seria", "outras crianças com TEA").
- NÃO usar palavras alarmistas (preocupante, grave, urgente) fora de contexto de risco real.
- NÃO FIXE num único alimento ou interesse, repetindo-o toda hora (ex.: citar "uva passa" sempre). Use o QUADRO TODO da alimentação — o que aceita, o que rejeita, as texturas e padrões — pra (a) sugerir receitas que respeitem as texturas que funcionam, (b) ler padrões (ex.: "tudo que recusa é pastoso") e (c) propor ampliar o repertório com calma.
- Se o cuidador pedir pra GUARDAR/registrar algo no Perfil ("quero guardar isso no Perfil", "registra aí"), NÃO fique confuso nem peça pra explicar de novo: diga, em 1 frase, que é só tocar no botão "Guardar no Perfil" logo abaixo da conversa — que você organiza no lugar certo (alimentação, sono, etc.).

# Limites duros

- Não copie literalmente texto das Boas Práticas — integre as ideias com suas próprias palavras.`;

/**
 * Voz + limites PARA OS CAMINHOS QUE NÃO CARREGAM O NÚCLEO DE CONDUÇÃO: os 7
 * botões de apoio (`buildSystemTextOutputType`) e o gerador de plano
 * (`lib/ia/plano.ts`). Esses dois montam o system a partir de `VOZ_E_LIMITES`
 * sozinho — então a fronteira do diagnóstico, que mora no núcleo, não chegava
 * neles. Eram os dois pontos mais fracos do produto, e são justamente os que
 * produzem TEXTO LONGO E INDIVIDUALIZADO sobre uma criança específica.
 *
 * O modo conversa NÃO usa esta constante: lá a fronteira já vem por dentro do
 * `nucleoConducao()`, e repetir só gastaria cache.
 */
export const VOZ_LIMITES_E_FRONTEIRA = `${VOZ_E_LIMITES}

${FRONTEIRA_DIAGNOSTICO}`;

/**
 * Bloco de comportamento por INTENÇÃO (Fase 2). Molda como a Kolo responde
 * antes de qualquer conteúdo — crise acolhe e devolve a escolha; desabafo
 * ouve; dúvida vai direto; desafio é o caminho normal e sinaliza o plano.
 */
export function blocoIntencao(intencao: Intencao): string {
  switch (intencao) {
    case "crise":
      return `# Esta mensagem parece uma crise — algo difícil acontecendo AGORA

Antes de qualquer coisa, ACOLHA: 1-2 frases curtas que mostram que você entende o peso deste momento. Não minimize, não dê lição, não corra pra resolver.
NÃO despeje um plano nem uma lista de soluções agora — no meio de uma crise isso sobrecarrega.
Depois de acolher, dê o que ajuda AGORA: um ou dois passos pra atravessar o momento. Quem manda no ritmo é ela, e você pode dizer isso — mas não devolva a decisão como pergunta obrigatória. (Até 06/08/2026 este bloco MANDAVA terminar perguntando se ela preferia entender agora ou depois. No meio de uma crise, isso era mais uma tarefa pra quem já não estava dando conta.)
Se fizer sentido entender o que desencadeou, levante NO MÁXIMO 1-2 possíveis "suspeitos" a partir do que você sabe da criança (sensorial, transição, fome, sono, excesso de estímulo) — sempre como hipótese, nunca causa afirmada.
SEGURANÇA: se houver RISCO à integridade de alguém (autolesão, agressão que machuca, risco de acidente, ou o adulto mencionar se machucar/não aguentar mais), você é APOIO, não emergência — oriente claro a buscar ajuda imediata: emergência médica SAMU 192; e pra sofrimento intenso/risco à vida, o CVV pelo 188 (24h, gratuito, sigiloso). Não minimize nem prometa resolver sozinha.
Termine gentil e curto.`;
    case "desabafo":
      // ⚠️ AQUI HAVIA UMA PERGUNTA OBRIGATÓRIA (removida em 06/08/2026):
      // "No fim, pergunte de leve se ela quer pensar em algo concreto agora ou
      // se hoje é só pra colocar pra fora." Era pergunta por decreto, no canal
      // onde a mãe chegou justamente pedindo ajuda — e o bloco de crise tinha
      // a mesma coisa ("devolva a escolha numa única pergunta").
      return `# Esta mensagem parece um desabafo

Ela quer ser ouvida, não necessariamente resolvida. Acolha mostrando que entendeu — reorganizando com clareza o que ela está vivendo, não nomeando a emoção dela.
Não force uma ideia prática nem transforme isso numa investigação. Se um caminho concreto se oferecer naturalmente, pode deixá-lo na mesa em uma frase; se não, terminar sem pergunta está certo.`;
    case "duvida":
      return `# Esta mensagem é uma dúvida pontual

Responda direto e objetivo, no tom de sempre. Sem alongar nem montar plano.`;
    case "desafio":
    default:
      // As quatro primeiras linhas deste bloco eram VOZ 2 e VOZ 3 reescritas
      // (direção antes de investigação; uma unidade cognitiva por turno; não
      // investigar duas frentes). Saíram em 02/08/2026 — o núcleo diz melhor e
      // diz uma vez só. O que sobrou é o que só existe na web: o MARCADOR que
      // faz aparecer o botão de montar o plano.
      return `# Esta mensagem traz um desafio do dia a dia

Ajude de verdade JÁ na conversa: traga 1 ideia prática e possível agora — não segure as ideias esperando o plano.
Assim que tiver contexto suficiente pra um bom plano, FECHE assim: dê uma ideia útil + ofereça o plano como um APROFUNDAMENTO, apontando pro BOTÃO (NÃO peça um "sim" digitado) — algo como "Acho que já consigo te montar um plano completo com isso (mais ideias, frases prontas e o que observar). É só tocar no botão 'Montar plano completo' aqui embaixo quando quiser." — e, na ÚLTIMA linha, escreva exatamente o marcador ${MARCADOR_PLANO}. Esse marcador some do texto e faz aparecer, abaixo da caixa, o botão de montar o plano; use SÓ quando for mesmo hora de oferecer, nunca em toda resposta.
Não termine toda resposta com pergunta.`;
  }
}

/**
 * System prompt do MODO CONVERSA. Lidera com o NÚCLEO DE CONDUÇÃO (a mesma
 * "cabeça" da Ayla no WhatsApp — identidade, princípios, sequência, piso, tom),
 * depois as lentes de especialista deste turno, os limites de produto e o
 * formato da web. A crise já tem o blocoIntencao("crise") próprio.
 */
/**
 * Exportada pra a bancada montar o system EXATAMENTE como produção monta.
 * Sem isto a bancada reconstrói o prompt e mede um produto que não existe.
 */
export function buildSystemTextConversa(
  skills: SkillRow[],
  intencao?: Intencao,
  tema?: string | null,
): string {
  // ENTREGA = desafio. É a mesma regra do WhatsApp (`ehEntrega`): crise,
  // desabafo e dúvida pontual continuam em texto corrido, porque título em
  // cima de desabafo é frieza.
  const entrega = intencao === "desafio";
  return `${nucleoConducao()}

# Especialistas que você reúne neste turno

Aqui você pensa a partir destas lentes de especialista do Kolo Família (app que apoia famílias com pelo menos um membro neurodivergente — TEA, TDAH, dislexia, AH/SD e outros perfis). Integre-as numa voz só, sem citar os nomes das skills:

${buildIdentityBlock(skills)}

${VOZ_CONVERSA}${intencao ? `\n\n${blocoIntencao(intencao)}` : ""}${
    entrega
      ? `\n\n${formasDeEntrega({ canal: "web", tema })}\n\n${INTERESSE_COMO_VEICULO}\n\n${A_CRIANCA_ANTES_DO_ROTULO}`
      : ""
  }

# Como responder (formato da web)

Você conversa DENTRO do app (não é WhatsApp) — pode usar markdown leve. Seguindo os princípios acima:
- Dê 1 ideia prática e possível agora, ancorada nas Boas Práticas. Se couber, ofereça uma frase pronta pro adulto usar, em itálico (\`*frase*\`).
- NÃO escreva nenhum bloco de "registrar este papo" nem liste opções de registro — a interface já oferece esses botões abaixo da resposta.

# Formatação (markdown)

- Itálico (\`*frase*\`) só na frase pronta pro adulto usar.
- Lista com "- " apenas quando houver 2 ou mais passos/ideias. Senão, escreva em parágrafos curtos.
- Título de bloco em **negrito**, curto — e SÓ quando houver um bloco de entrega (a seção acima diz quando). Fora disso, texto corrido: negrito no máximo em 1 palavra e nunca como título.

# Tamanho

O TAMANHO É O DA AJUDA — não há alvo de palavras.

Uma dúvida pontual se resolve em duas ou três frases, e alongar é ruído. Uma mãe que chega com quatro frentes precisa de espaço pra você mostrar que entendeu, organizar as frentes, dar a primeira direção e oferecer por onde começar — cortar isso pela metade pra caber num limite entrega meia ajuda.

O que cansa não é o texto longo: é o texto VAGO. Corte o que não muda o próximo passo dela, e mantenha tudo o que muda.

(Até 06/08/2026 havia aqui um "alvo de ~120 palavras". Não cabia organizar quatro frentes e ainda dar a primeira estratégia, e era o teto que impedia exatamente a resposta que o produto quer.)${
    skills.length > 1
      ? `\n\n# Composição multi-skill\n\nVocê integra ${skills.length} perspectivas — entregue UMA resposta única e coesa, não duas separadas, e sem citar os nomes das skills.`
      : ""
  }`;
}

/**
 * System prompt do MODO OUTPUT_TYPE — atalho dos 7 botões de apoio
 * (PRD §7.12). Não usa o template de 7 partes — segue o
 * output_type.prompt_template.
 */
function buildSystemTextOutputType(
  skills: SkillRow[],
  outputType: OutputTypeData,
): string {
  return `Você é uma equipe de especialistas do Kolo Família. O adulto responsável pediu uma resposta no formato "${outputType.label}".

# Especialistas neste turno

${buildIdentityBlock(skills)}

${VOZ_LIMITES_E_FRONTEIRA}

# Formato da resposta — "${outputType.label}"

${outputType.prompt_template}

# Tamanho

Mantenha a resposta concisa e útil — não exceda 400 palavras. Use markdown leve (negrito, listas). Sem template de 7 partes.`;
}

/**
 * Bloco de contexto que vai como user message. É a parte volátil (muda
 * por turno) e fica APÓS o último cache_control breakpoint.
 */
export function buildContextBlock(ctx: ContextoSkillResposta): string {
  const partes: string[] = [];

  if (ctx.cuidador) {
    const membroNome = ctx.membroFoco?.nome;
    partes.push(
      `<cuidador>
Você está falando com ${ctx.cuidador.nome}${
        ctx.cuidador.relacao
          ? `, ${ctx.cuidador.relacao}${membroNome ? ` de ${membroNome}` : ""}`
          : ""
      }. O que ${ctx.cuidador.nome} conta em primeira pessoa ("eu tenho", "lá em casa") é sobre ela mesma. NÃO atribua um fato a outra pessoa (pai, mãe, avó…) a menos que o contexto diga explicitamente de quem é.
</cuidador>`,
    );
  }

  if (ctx.membros.length > 0) {
    const linhas = ctx.membros.map((m) => {
      const pron = pronomesPara(m.genero);
      const gen = pron.generoDefinido ? ` (${pron.sujeito})` : "";
      const idadeTxt = m.idade != null ? `${m.idade} anos` : "idade não informada";
      const perfil = m.perfil?.trim() ? ` — ${m.perfil.trim()}` : "";
      return `- ${m.nome}, ${idadeTxt}${gen}${perfil}`;
    });
    partes.push(
      `<familia_membros>
Pessoas atípicas cadastradas nesta família — você JÁ sabe quem são, a idade e o básico de cada uma. NÃO pergunte quem são nem a idade; quando o cuidador citar um destes nomes, é esta pessoa. Use a idade EXATA (nunca chute):
${linhas.join("\n")}
</familia_membros>`,
    );
  }

  // O que está REGISTRADO (confirmado × em investigação) vem antes do perfil:
  // enquadra a leitura de tudo o que vem depois. Mesmo bloco que a Ayla recebe
  // no WhatsApp — uma regra só, os dois canais.
  if (ctx.membroFoco?.diagnosticoRegistrado) {
    partes.push(ctx.membroFoco.diagnosticoRegistrado);
  }

  if (ctx.membroFoco) {
    const pron = pronomesPara(ctx.membroFoco.genero);
    const generoLinha = pron.generoDefinido
      ? `genero: ${ctx.membroFoco.genero} (trate como "${pron.sujeito}/${pron.possessivo}", artigo "${pron.artigo}")`
      : `genero: não informado (use o nome, evite ele/ela)`;
    const idade = ctx.membroFoco.idade;
    const nome = ctx.membroFoco.nome;
    const tratamentoLinha =
      idade == null
        ? `tratamento: a idade de ${nome} NÃO foi informada — NUNCA invente nem chute idade (não diga "X anos" nem "menino/menina de X anos"); refira-se pelo nome.`
        : idade >= 18
          ? `tratamento: ${nome} tem EXATAMENTE ${idade} anos — é ADULTO(a). Refira-se pelo nome ou "seu filho(a)"; NUNCA "criança/criancinha" nem diminutivos. NUNCA cite uma idade diferente de ${idade}.`
          : idade >= 13
            ? `tratamento: ${nome} tem EXATAMENTE ${idade} anos — é ADOLESCENTE, NÃO criança pequena. Use o nome; evite "criança/criancinha/menino(a) de X anos". NUNCA cite uma idade diferente de ${idade}.`
            : `tratamento: ${nome} tem EXATAMENTE ${idade} anos. NUNCA cite uma idade diferente de ${idade}.`;
    partes.push(
      `<membro_atipico>
nome: ${nome}
idade: ${ctx.membroFoco.idade} anos
perfil: ${ctx.membroFoco.perfil}
${generoLinha}
${tratamentoLinha}
${Object.entries(ctx.membroFoco.secoes)
  .filter(([, v]) => v && v.trim())
  .map(([k, v]) => `${k}: ${v}`)
  .join("\n")}
</membro_atipico>`,
    );
  }

  const familiaEntries = Object.entries(ctx.familia).filter(([, v]) => v && v.trim());
  if (familiaEntries.length > 0) {
    partes.push(
      `<contexto_familia>
${familiaEntries.map(([k, v]) => `${k}: ${v}`).join("\n")}
</contexto_familia>`,
    );
  }

  if (ctx.diariosRecentes.length > 0) {
    partes.push(
      `<diario_recente>
${ctx.diariosRecentes
  .map(
    (d) =>
      `${d.data} (${d.membro_nome}): ${[
        d.conquista && `conquista: ${d.conquista}`,
        d.desafio && `desafio: ${d.desafio}`,
        d.estado_adulto && `estado adulto: ${d.estado_adulto}`,
        d.reacao_adulto && `reação adulto: ${d.reacao_adulto}`,
      ]
        .filter(Boolean)
        .join(" · ")}`,
  )
  .join("\n")}
</diario_recente>`,
    );
  }

  if (ctx.ultimoCheckin) {
    partes.push(
      `<ultimo_checkin>
${ctx.ultimoCheckin.data} — responsável: ${ctx.ultimoCheckin.escala_emocional_mae}${
        ctx.ultimoCheckin.escala_emocional_membro
          ? `; membro: ${ctx.ultimoCheckin.escala_emocional_membro}`
          : ""
      }
</ultimo_checkin>`,
    );
  }

  // O MESMO bloco que o WhatsApp recebe, montado pela função compartilhada.
  // Antes daqui saía só título + versão curta + versão conversa: `quando_usar`,
  // `erros_comuns` e `passos_praticos` eram carregados do banco e descartados
  // na montagem — a parte executável do acervo nunca chegava ao modelo.
  const repertorio = blocoBoasPraticas(ctx.boasPraticas);
  if (repertorio) partes.push(repertorio);

  return partes.join("\n\n");
}

export type Modo =
  | { kind: "conversa" }
  | { kind: "output_type"; outputType: OutputTypeData };

/**
 * Monta os parâmetros pra messages.create() / messages.stream() do
 * Anthropic SDK, com cache_control no system prompt (estável) e o
 * contexto/histórico/input como messages (volátil).
 */
export function assemblePrompt(params: {
  skills: SkillRow[];
  ctx: ContextoSkillResposta;
  userInput: string;
  modo: Modo;
  intencao?: Intencao;
  /**
   * Tema do turno (`lib/conducao/temas.ts`). Na web o roteador de skills ja
   * escolhe a lente; o tema so prioriza o que do perfil entra na resposta.
   * Opcional: sem ele, as formas de entrega continuam funcionando.
   */
  tema?: string | null;
  /**
   * O que ela acabou de ACEITAR, quando a Kolo ofereceu algo no turno anterior.
   * Vem do classificador (`lib/ia/intencao.ts`). Entra como nota do TURNO, e
   * não no system: é fato desta mensagem, não regra do produto.
   */
  aceite?: string | null;
}): {
  system: Anthropic.TextBlockParam[];
  messages: Anthropic.MessageParam[];
} {
  const { skills, ctx, userInput, modo, intencao, tema, aceite } = params;

  const systemText =
    modo.kind === "conversa"
      ? buildSystemTextConversa(skills, intencao, tema)
      : buildSystemTextOutputType(skills, modo.outputType);

  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: systemText,
      cache_control: { type: "ephemeral" },
    },
  ];

  const contextoBloco = buildContextBlock(ctx);

  const messages: Anthropic.MessageParam[] = [];

  // Histórico só faz sentido em modo conversa
  if (modo.kind === "conversa") {
    for (const h of ctx.historico) {
      messages.push({ role: h.papel, content: h.conteudo });
    }
    // PROGRESSÃO — o mesmo freio do WhatsApp. Aqui o histórico vem como turnos
    // de verdade (role user/assistant), então os turnos DELA são os
    // `assistant`. A web tem a mesma tendência a reoferecer a orientação que
    // já deu; a regra é dos dois canais, não de um.
    const progressao = blocoProgressao(
      angulosUsados(ctx.historico.filter((h) => h.papel === "assistant").map((h) => h.conteudo)),
    );
    if (progressao) messages.push({ role: "user", content: progressao });
  }

  const wrapper =
    modo.kind === "conversa" ? "mensagem_da_mae" : "pedido_da_mae";

  // ELA ACEITOU O QUE VOCÊ OFERECEU. Vem ANTES da mensagem porque "sim" não
  // carrega conteúdo: sem o referente resolvido, o modelo reconstrói o turno a
  // partir da conversa inteira e responde outra coisa. O WhatsApp já tinha
  // esta nota desde 04/08; a web não tinha nada equivalente.
  const notaAceite = aceite
    ? `<nota_do_turno>\nELA ESTÁ ACEITANDO O QUE VOCÊ OFERECEU no seu último turno: ${aceite}. FAÇA ISSO AGORA, neste turno. Não reabra o assunto geral da conversa, não peça pra ela repetir o pedido, não pergunte de novo o que você já sabe. Se faltar UM dado sem o qual não dá pra fazer, pergunte SÓ esse dado — nada além dele.\n</nota_do_turno>\n\n`
    : "";

  const userTurnText = contextoBloco
    ? `${contextoBloco}\n\n${notaAceite}<${wrapper}>\n${userInput}\n</${wrapper}>`
    : `${notaAceite}<${wrapper}>\n${userInput}\n</${wrapper}>`;

  messages.push({ role: "user", content: userTurnText });

  return { system, messages };
}
