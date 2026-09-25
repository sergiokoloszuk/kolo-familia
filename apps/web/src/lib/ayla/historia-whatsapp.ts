/**
 * Continuidade de histórias no WhatsApp.
 *
 * A oferta de uma história cria um compromisso: quando a família traz o tema,
 * a próxima resposta precisa ser a história — não outra investigação. Este
 * módulo mantém a decisão determinística e deixa a criação do texto com o Core,
 * que continua recebendo Perfil, histórico e Boas Práticas.
 */

export type OrigemEntregaHistoria =
  | "pedido_explicito"
  | "aceite_classificado"
  | "resposta_ao_tema";

export const OBJETIVOS_HISTORIA = [
  {
    chave: "historia_compreender",
    label: "Entender o que sente",
    instrucao:
      "Ajude a criança a compreender e organizar a situação, a lembrança ou o sentimento em linguagem compatível com sua idade e comunicação.",
  },
  {
    chave: "historia_agir",
    label: "Saber o que fazer",
    instrucao:
      "Mostre, dentro do enredo, um próximo passo concreto e possível para a criança usar quando essa situação acontecer.",
  },
  {
    chave: "historia_agencia",
    label: "Coragem para escolher",
    instrucao:
      "Fortaleça agência, segurança e possibilidade de escolha, sem exigir coragem, desempenho ou superação imediata.",
  },
] as const;

export type ObjetivoHistoria = (typeof OBJETIVOS_HISTORIA)[number]["chave"];
export const OBJETIVO_ESCOLHA_AYLA = "historia_escolha_ayla" as const;
export type EscolhaObjetivoHistoria = ObjetivoHistoria | typeof OBJETIVO_ESCOLHA_AYLA;

const OBJETIVOS = new Set<string>(OBJETIVOS_HISTORIA.map((o) => o.chave));
const ID_PREFIXO_OBJETIVO = "ah1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type LinhaRecente = {
  direcao: string;
  texto: string | null;
};

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const HISTORIA = /\b(?:historias?|historinhas?|contos?)\b/;
const PEDIDO =
  /\b(?:cria|crie|criar|faz|faca|fazer|monta|monte|montar|conte|conta|contar|escreva|escrever|manda|mandar|quero|queria|gostaria|pode|podia)\b/;

function pedidoExplicitoDeHistoria(texto: string): boolean {
  const t = normalizar(texto);
  if (!HISTORIA.test(t) || !PEDIDO.test(t)) return false;
  // “Quero te contar uma história” é a família abrindo um relato, não pedindo
  // que a Ayla crie um conteúdo. A escuta não pode virar artefato por regex.
  if (/\b(?:quero|queria|gostaria)(?: de)? (?:te )?contar\b/.test(t)) return false;
  return true;
}

/**
 * Tema não é objetivo. “Uma história sobre o barulho” ainda pode servir para
 * compreender, agir ou fortalecer agência; “para ele aprender a pedir pausa”
 * já diz o que a história precisa construir e não merece outra pergunta.
 */
export function objetivoDaHistoriaExplicito(texto: string): boolean {
  const t = normalizar(texto);
  return (
    /\b(?:objetivo|moral|mensagem) (?:da historia )?(?:e|seria|deve ser)\b/.test(t) ||
    /\b(?:para|pra) (?:ajudar|ensinar|mostrar|preparar|estimular|trabalhar|aprender|entender|compreender|lidar|aceitar|conseguir|perceber)\b/.test(t) ||
    /\bquero que (?:(?:ele|ela|a crianca|meu filho|minha filha) )?(?:aprenda|entenda|compreenda|perceba|consiga|saiba|aceite)\b/.test(t)
  );
}

export function idDoBotaoObjetivoHistoria(
  ofertaId: string,
  objetivo: ObjetivoHistoria,
): string {
  return `${ID_PREFIXO_OBJETIVO}:${ofertaId}:${objetivo}`;
}

export function lerIdDoBotaoObjetivoHistoria(
  id: string | null | undefined,
): { ofertaId: string; objetivo: ObjetivoHistoria } | null {
  const partes = (id ?? "").split(":");
  if (partes.length !== 3 || partes[0] !== ID_PREFIXO_OBJETIVO) return null;
  const ofertaId = partes[1];
  const objetivo = partes[2];
  if (!UUID.test(ofertaId) || !OBJETIVOS.has(objetivo)) return null;
  return { ofertaId, objetivo: objetivo as ObjetivoHistoria };
}

export function objetivoHistoriaDoFallback(
  texto: string,
  opcoes: readonly string[],
): EscolhaObjetivoHistoria | null {
  const t = normalizar(texto).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  if (["escolhe voce", "escolha voce", "voce escolhe", "pode escolher"].includes(t)) {
    return OBJETIVO_ESCOLHA_AYLA;
  }
  const porNumero: Record<string, ObjetivoHistoria> = {
    "1": "historia_compreender",
    "2": "historia_agir",
    "3": "historia_agencia",
  };
  const numerico = porNumero[t];
  if (numerico && opcoes.includes(numerico)) return numerico;
  for (const objetivo of OBJETIVOS_HISTORIA) {
    if (!opcoes.includes(objetivo.chave)) continue;
    const label = normalizar(objetivo.label);
    if (t === label || t === normalizar(objetivo.chave)) return objetivo.chave;
  }
  return null;
}

export function instrucaoDoObjetivoHistoria(
  escolha: EscolhaObjetivoHistoria | null | undefined,
): string {
  if (escolha === OBJETIVO_ESCOLHA_AYLA) {
    return "A família pediu que você escolha. Selecione o objetivo que mais ajuda esta criança agora, usando Perfil, histórico e o tema já trazido; não faça outra pergunta.";
  }
  return (
    OBJETIVOS_HISTORIA.find((o) => o.chave === escolha)?.instrucao ??
    "Preserve o objetivo que a família já declarou no pedido e transforme-o no eixo da história."
  );
}

function respostaTrazTema(texto: string): boolean {
  const t = normalizar(texto).replace(/[.!?]+$/g, "").trim();
  if (!t) return false;
  return !/^(?:sim|nao|ok|ta|pode|pode ser|quero|nao quero|nao sei|sei la)$/.test(t);
}

function perguntaPediuTemaDaHistoria(texto: string): boolean {
  const t = normalizar(texto);
  if (!HISTORIA.test(t)) return false;
  return (
    /qual (?:situacao|momento|tema).*historia/.test(t) ||
    /(?:situacao|momento|tema).*transformar em (?:uma )?historia/.test(t) ||
    /(?:me conta|me diga|me diz).*historia/.test(t) ||
    /(?:para|pra) (?:criar|montar|escrever).*historia/.test(t)
  );
}

/**
 * O histórico chega do banco do mais recente para o mais antigo. Mensagens da
 * família podem vir em lote; por isso atravessamos os inbounds do lote e
 * paramos na primeira fala anterior da Ayla — ela é o referente real.
 */
export function falaAnteriorDaAyla(
  historicoMaisRecentePrimeiro: readonly LinhaRecente[],
): string | null {
  for (const linha of historicoMaisRecentePrimeiro) {
    const texto = linha.texto?.trim();
    if (!texto) continue;
    if (linha.direcao !== "inbound") return texto;
  }
  return null;
}

export function detectarEntregaHistoria(params: {
  mensagem: string;
  aceite?: string | null;
  historicoMaisRecentePrimeiro?: readonly LinhaRecente[];
}): { origem: OrigemEntregaHistoria } | null {
  if (pedidoExplicitoDeHistoria(params.mensagem)) {
    return { origem: "pedido_explicito" };
  }

  if (params.aceite && HISTORIA.test(normalizar(params.aceite))) {
    return { origem: "aceite_classificado" };
  }

  const falaAnterior = falaAnteriorDaAyla(params.historicoMaisRecentePrimeiro ?? []);
  if (
    falaAnterior &&
    perguntaPediuTemaDaHistoria(falaAnterior) &&
    respostaTrazTema(params.mensagem)
  ) {
    return { origem: "resposta_ao_tema" };
  }

  return null;
}

/**
 * Instrução de tarefa, não uma fonte nova de conhecimento. O Core, o Perfil,
 * o histórico e as BPs continuam acima dela e fornecem a personalização.
 */
export const BLOCO_ESCOLHA_OBJETIVO_HISTORIA = `<escolha_de_objetivo_da_historia>
A família já pediu a história. O tema pode estar na mensagem ou na conversa recente, mas ela ainda não disse o que quer ajudar a criança a construir com a história. NÃO escreva a história neste turno.

Reconheça o tema em uma frase curta e apresente exatamente três caminhos. Preserve estes títulos, nesta ordem, e personalize somente a descrição de cada um com o Perfil e o histórico — sem inventar:

1️⃣ *Entender o que sente* — uma descrição concreta do que esta criança poderia compreender ou organizar.
2️⃣ *Saber o que fazer* — uma descrição concreta de um recurso ou próximo passo que caberia no enredo.
3️⃣ *Coragem para escolher* — uma descrição concreta de agência, segurança ou escolha, sem cobrar superação.

Termine convidando a tocar em uma opção. Diga também, de forma leve, que pode responder “escolhe você”. Esta é a única escolha: não faça outra pergunta, não abra investigação e não acrescente orientação genérica antes dela.
</escolha_de_objetivo_da_historia>`;

export const BLOCO_ENTREGA_HISTORIA_WHATSAPP = `<entrega_de_historia_no_whatsapp>
Este turno conclui uma história que a Ayla ofereceu ou que a família pediu.

ENTREGUE A HISTÓRIA AGORA. Não volte a investigar o tema, não peça para a família repetir o pedido e não responda apenas com orientações sobre como criar uma história. Não faça nenhuma pergunta nesta resposta.

Escreva uma história curta, completa e pronta para ser lida para a criança no WhatsApp. Use o nome, a idade, a forma de comunicação, os interesses, as sensibilidades e o histórico que estiverem disponíveis — sem inventar o que não sabemos.

Formato leve: comece com um título curto em negrito, em uma linha própria, e escreva de 4 a 7 parágrafos breves, com respiro. A história precisa ter começo, pequeno desafio, apoio possível e fechamento acolhedor. Linguagem concreta e compatível com a idade e a comunicação da criança; não infantilize adolescentes ou adultos.

Quando houver luto ou pessoas que morreram, trate o encontro como lembrança, sonho ou imaginação. Saudade e vínculo afetivo só entram se estiverem expressos pela família ou pelo Perfil e não houver informação de trauma ou violência que os contradiga. Nunca afirme que a pessoa falecida está fisicamente presente. Isso não impede a entrega da história.

Se o Perfil ou o histórico registrar trauma, violência, medo ou vínculo difícil com uma pessoa falecida, ESTA REGRA PREVALECE: NÃO invente carinho, proteção, amor, saudade, boas lembranças, perdão ou reconciliação com essa pessoa. Se a história reunir mais de uma pessoa falecida, não misture nem atribua o mesmo sentimento a todas. Use lembranças ou sentimentos misturados em linguagem neutra. Não reconte o trauma sem necessidade. Preserve a segurança pela agência da criança, pelo presente e por pessoas de confiança que sejam realmente seguras no contexto.

A história deve soar como história, não como orientação clínica disfarçada. Incorpore limites de realidade e recursos de regulação dentro do enredo, sem parar a narrativa para dar uma explicação técnica ao leitor.

Quando a família citar personagens protegidos como inspiração, preserve o interesse sem copiar o personagem: crie um herói original com energia, velocidade, coragem ou outra qualidade semelhante.

Não inclua link nem tutorial da plataforma nesta resposta. O sistema enviará esses passos separadamente depois da história.
</entrega_de_historia_no_whatsapp>`;

export function blocoEntregaHistoriaWhatsApp(
  escolha?: EscolhaObjetivoHistoria | null,
): string {
  return [
    BLOCO_ENTREGA_HISTORIA_WHATSAPP,
    `<objetivo_da_historia>${instrucaoDoObjetivoHistoria(escolha)}</objetivo_da_historia>`,
  ].join("\n\n");
}

export function guiaHistoriaNoLudico(params: {
  link: string;
  nomeCrianca?: string | null;
}): string {
  const nome = params.nomeCrianca?.trim();
  return [
    `✨ *Quer transformar essa ideia em uma história ilustrada${nome ? ` com o avatar de ${nome}` : " com o avatar da criança"}?*`,
    "",
    `Abra direto em *Criar uma história*: ${params.link}`,
    "",
    `🎨 Se ${nome ?? "a criança"} ainda não tiver avatar, toque em *“Criar avatar${nome ? ` de ${nome}` : ""}”*. A tela pode mostrar *“Falta o avatar”* ou *“Criar avatar de outra pessoa”*. Escolha o estilo, conte como ${nome ?? "a criança"} é e toque em *“Criar avatar”*.`,
    "",
    `📖 Depois, volte para *Criar uma história*. Em *“O que você quer contar?”*, escreva ou cole a situação que quer transformar em história.`,
    "",
    `🪄 Escolha de 3 a 6 páginas e toque em *“Criar história”*. Ela pode levar cerca de um minuto para ficar pronta.`,
  ].join("\n");
}
