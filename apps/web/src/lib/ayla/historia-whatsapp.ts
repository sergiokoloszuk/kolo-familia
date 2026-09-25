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
export const BLOCO_ENTREGA_HISTORIA_WHATSAPP = `<entrega_de_historia_no_whatsapp>
Este turno conclui uma história que a Ayla ofereceu ou que a família pediu.

ENTREGUE A HISTÓRIA AGORA. Não volte a investigar o tema, não peça para a família repetir o pedido e não responda apenas com orientações sobre como criar uma história. Não faça nenhuma pergunta nesta resposta.

Escreva uma história curta, completa e pronta para ser lida para a criança no WhatsApp. Use o nome, a idade, a forma de comunicação, os interesses, as sensibilidades e o histórico que estiverem disponíveis — sem inventar o que não sabemos.

Formato leve: um título curto e 4 a 7 parágrafos breves, com respiro. A história precisa ter começo, pequeno desafio, apoio possível e fechamento acolhedor. Linguagem concreta e compatível com a idade e a comunicação da criança.

Quando houver luto ou pessoas que morreram, trate o encontro como lembrança, sonho, imaginação, saudade ou vínculo afetivo. Nunca afirme que a pessoa falecida está fisicamente presente. Isso não impede a entrega da história.

Quando a família citar personagens protegidos como inspiração, preserve o interesse sem copiar o personagem: crie um herói original com energia, velocidade, coragem ou outra qualidade semelhante.

Não inclua link nem tutorial da plataforma nesta resposta. O sistema enviará esses passos separadamente depois da história.
</entrega_de_historia_no_whatsapp>`;

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
