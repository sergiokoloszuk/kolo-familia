/**
 * A RETOMADA DE UM ARTEFATO PENDENTE, pelo próprio turno da conversa.
 *
 * ⚠️ O CASO REAL, e ele é exato. Karina, 06/09/2026:
 *
 *   15:01:09  Ayla: "Pronto! A rotina da Manu está montada"
 *             (rotina em `aguardando`, tema=null, nenhum cartão)
 *   17:14:17  Karina: "E agora?"
 *   17:14:23  Karina: "Consegue trazer?"
 *   17:14:38  Ayla: "Sobre quem você está falando? Mario ou Manu?"
 *
 * Ela cobrou duas vezes o que tinha sido prometido, e a conversa geral
 * respondeu por cima — perguntando de qual filho se tratava, com a rotina órfã
 * na mesa e o nome da Manu escrito na promessa duas horas antes.
 *
 * ⚠️ QUEM DECIDE AQUI É O ESTADO, NÃO A FRASE. Esta é a diferença entre a
 * solução certa e uma lista de cinco expressões que quebra na sexta. O peso da
 * decisão está em existir uma rotina `aguardando` desta família: sem ela, nada
 * disto roda. O texto só precisa confirmar uma coisa muito mais simples — que a
 * mãe NÃO está abrindo assunto novo. "E agora?" só significa "cadê o quadro"
 * porque há um quadro devendo; sozinha, a frase não significa nada.
 */

/**
 * Traz informação nova? Se traz, não é cobrança — é a conversa seguindo.
 *
 * ⚠️ O CORTE É POR TAMANHO E POR FORMA, não por vocabulário. Uma mãe que
 * escreve trinta palavras está contando algo, mesmo que comece com "e agora".
 * Uma que escreve três e pergunta está olhando para o vazio que ficou.
 */
const CURTA_O_BASTANTE = 64;

/**
 * As formas de apontar para algo que devia estar ali e não está.
 *
 * ⚠️ POR FAMÍLIA SEMÂNTICA, e cada uma tem uma razão de existir separada:
 *
 * - ONDE ESTÁ: "cadê", "onde está", "e as figuras", "e a rotina" — a mãe
 *   procura o objeto.
 * - NÃO CHEGOU: "não apareceu", "não veio", "não recebi", "não abriu" — ela
 *   constata a ausência.
 * - TRAZ PRA MIM: "consegue trazer", "manda", "me manda", "traz" — ela pede a
 *   entrega de novo.
 * - E ENTÃO: "e agora", "e aí", "e então", "?" sozinho — ela espera o próximo
 *   passo que foi prometido.
 *
 * Nenhuma delas, isolada, autoriza qualquer coisa. Todas dependem de haver uma
 * rotina em `aguardando` para significarem o que parecem significar.
 */
/**
 * ⚠️ FRONTEIRAS UNICODE, NÃO `\b`. Em JavaScript `\b` e `\w` são ASCII: depois
 * de "cadê" o `ê` não é caractere de palavra, então `\bcadê\b` simplesmente não
 * casa — e "Cadê?", a cobrança mais óbvia que existe em português, passava
 * batida. Mesmo problema em "onde está?" e "E os cartões?". Daí a flag `u` e
 * `(?![\p{L}])` no lugar de `\b` final.
 */
const P = String.raw`(?![\p{L}])`;
const APONTA_PARA_O_AUSENTE = new RegExp(
  String.raw`(` +
    // ONDE ESTÁ — a mãe procura o objeto.
    String.raw`\bcad[êe]${P}` +
    String.raw`|\bonde\s+(?:est[áa]|ficou|foi|t[áa])${P}` +
    String.raw`|^e\s+(?:as?|os?)\s+[\p{L}]{2,}\s*\??$` +
    // NÃO CHEGOU — ela constata a ausência.
    String.raw`|\bn[ãa]o\s+(?:apareceu|veio|chegou|recebi|abriu|carregou|t[áa]\s+aparecendo|consigo\s+ver|tem\s+nada)${P}` +
    // TRAZ PRA MIM — ela pede a entrega de novo.
    String.raw`|\bconsegue\s+(?:trazer|mandar|enviar|gerar|fazer)${P}` +
    String.raw`|\b(?:me\s+)?(?:manda|mande|traz|traga|envia|reenvia)${P}` +
    // E ENTÃO — ela espera o próximo passo prometido.
    String.raw`|^e\s+(?:agora|a[íi]|ent[ãa]o)\s*\??$` +
    String.raw`|^\?+$` +
  String.raw`)`,
  "iu",
);

/**
 * A mensagem é uma cobrança do que ficou pendente?
 *
 * Só o LADO TEXTUAL da decisão — o chamador junta isto com a existência real do
 * artefato pendente. Separado assim para poder ser testado sem banco, e para
 * deixar explícito que sozinho ele não decide nada.
 */
export function apontaParaPendente(texto: string | null | undefined): boolean {
  const t = (texto ?? "").trim();
  if (!t) return false;
  if (t.length > CURTA_O_BASTANTE) return false;
  return APONTA_PARA_O_AUSENTE.test(t);
}
