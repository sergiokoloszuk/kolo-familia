/**
 * APRESENTAÇÃO POR CANAL — a camada determinística que faltava.
 *
 * ⚠️ O PROBLEMA QUE ISTO RESOLVE. Entre a resposta do modelo e o `enviarTexto`
 * da Z-API não existia NENHUMA transformação de texto: `dividirEmBolhas` só
 * corta em linha branca. A única defesa contra `**negrito**`, `## título` e
 * `> citação` chegarem crus no WhatsApp era uma linha de prompt — e regra que
 * vive em prompt compete com "seja prestativo", e perde.
 *
 * A doutrina deste repositório é explícita: regra que falha em prompt se
 * corrige ESTRUTURALMENTE. É o que este arquivo faz.
 *
 * ⚠️ ELE NORMALIZA APRESENTAÇÃO, NÃO CONTEÚDO. Nenhuma transformação aqui pode
 * remover uma palavra, mudar um número, quebrar uma URL, estragar um emoji ou
 * reescrever uma frase. O que sai é o MESMO texto com a marcação certa para o
 * canal. Os testes de sabotagem existem para provar isso, não para ilustrar.
 */

/** Linha que é só um divisor: `---`, `***`, `___`. */
const RE_DIVISOR = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;

/**
 * Título markdown. O espaço depois do `#` é OBRIGATÓRIO — sem ele, `#TEAmãe`
 * viraria título, e hashtag é conteúdo da mãe, não marcação.
 */
const RE_TITULO = /^\s*#{1,6}\s+(.+?)\s*$/;

/** Citação: `> algo`. O `>` some, o que ele citava fica. */
const RE_CITACAO = /^\s*>\s?(.*)$/;

/**
 * Bullet com asterisco: `* item`. É o caso PERIGOSO — no WhatsApp o `*` abre
 * negrito, então uma lista com asterisco vira negrito atravessando itens.
 * Vira `•`, que o canal mostra como o caractere que é.
 *
 * `- item` NÃO é tocado: clientes recentes do WhatsApp o renderizam como lista,
 * e trocá-lo seria piorar algo que já funciona.
 */
const RE_BULLET_ASTERISCO = /^(\s*)\*\s+(?=\S)/;

/**
 * Negrito markdown, numa linha só.
 *
 * Por que não atravessa `\n`: um `**` órfão no meio de um texto longo casaria
 * com outro `**` vinte linhas abaixo e emboldaria tudo entre eles. Preso a uma
 * linha, o pior caso é o `**` continuar cru — que é o estado de hoje, não uma
 * regressão. As bordas `(?!\s)` e `(?<!\s)` impedem `** texto **` de virar
 * `* texto *` com espaço colado no asterisco, que o WhatsApp não renderiza.
 */
const RE_NEGRITO_TRIPLO = /\*\*\*(?!\s)([^*\n]+?)(?<!\s)\*\*\*/g;
const RE_NEGRITO = /\*\*(?!\s)([^*\n]+?)(?<!\s)\*\*/g;
const RE_NEGRITO_SUBLINHADO = /__(?!\s)([^_\n]+?)(?<!\s)__/g;

/** Código inline. A crase é marcação; o que ela envolve é conteúdo. */
const RE_CODIGO = /`([^`\n]+)`/g;

/**
 * ESCRITAS QUE A KOLO NÃO ATENDE — e por que a lista é por BLOCO, não por
 * exclusão do que é permitido.
 *
 * ⚠️ O CASO REAL (05/09/2026). Uma resposta terminou assim:
 *
 *   "…como: **“Primeiro olhar, depois pausa e acabou.”**大小规律"
 *
 * Ideogramas colados DEPOIS do fecho do negrito, no fim da mensagem — cauda de
 * geração, não conteúdo. A família receberia isso na tela.
 *
 * ⚠️ POR QUE ENUMERAR O SUSPEITO EM VEZ DE PERMITIR SÓ O CONHECIDO. Uma
 * allowlist quebraria o produto no primeiro nome próprio incomum, no primeiro
 * símbolo de unidade, no primeiro emoji novo do Unicode. Aqui só entram os
 * blocos de escrita que a Kolo não atende — a conversa é pt/es/en, todas em
 * alfabeto latino. Acentos, ç, emojis, números, URLs e a marcação do WhatsApp
 * ficam fora desta expressão inteiramente, e é isso que a torna segura.
 */
const RE_ESCRITA_ESTRANHA =
  /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯Ѐ-ӿ؀-ۿ֐-׿฀-๿ऀ-ॿ]/g;

/**
 * ⚠️ SÓ LIMPA QUANDO É RESÍDUO, NUNCA QUANDO É A RESPOSTA.
 *
 * Se a mensagem inteira estiver em cirílico, ela provavelmente É a resposta —
 * alguém escreveu em russo e a Ayla respondeu em russo. Apagar seria destruir a
 * conversa para consertar um artefato. Se for uma fração mínima, é cauda.
 *
 * O corte de 10% separa os dois casos com folga: o resíduo observado eram 4
 * caracteres em 394 (1%); uma resposta de verdade em outra escrita passa de 60%.
 */
const FRACAO_MAXIMA_RESIDUO = 0.1;

/** Quantos caracteres de escrita não atendida sobraram — para telemetria. */
export function residuoDeEscrita(texto: string): number {
  return (texto.match(RE_ESCRITA_ESTRANHA) ?? []).length;
}

/**
 * Tira o resíduo e devolve quantos caracteres saíram. Zero mudanças quando não
 * há resíduo — e o chamador usa a contagem para decidir se registra o evento.
 */
export function semEscritaEstranha(texto: string): { texto: string; removidos: number } {
  const achados = residuoDeEscrita(texto);
  if (achados === 0) return { texto, removidos: 0 };
  if (achados / Math.max(1, texto.length) > FRACAO_MAXIMA_RESIDUO) {
    // Não é resíduo: é o idioma da resposta. Sai intacta, e quem chama registra.
    return { texto, removidos: 0 };
  }
  const limpo = texto.replace(RE_ESCRITA_ESTRANHA, "").replace(/[ \t]{2,}/g, " ");
  return { texto: limpo, removidos: achados };
}

/**
 * Converte a resposta do modelo para o que o WhatsApp de fato renderiza.
 *
 * Roda IMEDIATAMENTE antes de `dividirEmBolhas` — depois de toda decisão de
 * conteúdo, antes de qualquer decisão de entrega. É o último ponto em que o
 * texto ainda é um texto só.
 *
 * O que ela NÃO toca, de propósito: `*negrito*` já correto, `_itálico_`,
 * `~tachado~`, URLs, números, emojis, `- listas`, e qualquer palavra.
 */
export function paraWhatsApp(texto: string): string {
  // ⚠️ O RESÍDUO SAI AQUI DENTRO, e não no chamador, porque este é o único
  // ponto por onde TODO texto de WhatsApp passa — o caminho de bolhas do
  // orquestrador e o `enviarTexto` do sender. Protegendo aqui, não há como um
  // terceiro caminho nascer sem a proteção. Quem tem contexto de família
  // registra o evento; quem só formata, limpa.
  const semResiduo = semEscritaEstranha(texto).texto;
  const linhas = semResiduo.replace(/\r\n/g, "\n").split("\n");
  const saida: string[] = [];

  for (const linha of linhas) {
    // Divisor não tem equivalente no canal e não carrega conteúdo: some.
    if (RE_DIVISOR.test(linha)) continue;

    let l = linha;

    // Título vira o negrito de um asterisco só — o título do WhatsApp.
    const t = l.match(RE_TITULO);
    if (t) {
      saida.push(`*${limparInline(t[1])}*`);
      continue;
    }

    // Citação perde a seta e mantém o que era citado.
    const c = l.match(RE_CITACAO);
    if (c) l = c[1];

    // `* item` vira `• item` ANTES do negrito, senão o asterisco do bullet
    // entra na conta do negrito e a lista inteira vira uma ênfase só.
    l = l.replace(RE_BULLET_ASTERISCO, "$1• ");

    saida.push(limparInline(l));
  }

  // Divisor removido pode deixar três linhas brancas seguidas, e cada linha
  // branca é uma bolha a mais. Normaliza para no máximo uma linha em branco.
  return saida.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** As trocas que valem dentro de uma linha, na ordem em que se sobrepõem. */
function limparInline(l: string): string {
  return l
    .replace(RE_NEGRITO_TRIPLO, "*$1*")
    .replace(RE_NEGRITO, "*$1*")
    .replace(RE_NEGRITO_SUBLINHADO, "*$1*")
    .replace(RE_CODIGO, "$1");
}

// ─────────────────────────────────────────────────────────────────────────────
// DETECTOR — o que apareceria CRU, por canal. Só lê; nunca altera.
// ─────────────────────────────────────────────────────────────────────────────

export type SintaxeCrua = { sintaxe: string; exemplo: string };

/** O `**` órfão que sobrou é o exemplo, não a linha inteira. */
function achar(texto: string, re: RegExp, sintaxe: string): SintaxeCrua | null {
  const m = texto.match(re);
  return m ? { sintaxe, exemplo: m[0].slice(0, 60) } : null;
}

/**
 * O que o WhatsApp NÃO renderiza e a família veria como caractere.
 *
 * Rodar isto sobre a saída de `paraWhatsApp` deve dar lista vazia na esmagadora
 * maioria dos casos — é assim que o simulador prova que a conversão pegou.
 */
export function sintaxeCruaWhatsApp(texto: string): SintaxeCrua[] {
  return [
    achar(texto, /\*\*/, "** (negrito markdown)"),
    achar(texto, /^\s*#{1,6}\s+.+$/m, "## (título markdown)"),
    achar(texto, /^\s*>\s?.*$/m, "> (citação)"),
    achar(texto, RE_DIVISOR, "--- (divisor)"),
    achar(texto, /__/, "__ (negrito sublinhado)"),
    achar(texto, /`/, "` (código)"),
    achar(texto, /^\s*\|.*\|\s*$/m, "| (tabela)"),
  ].filter((x): x is SintaxeCrua => x !== null);
}

/**
 * O que `RespostaMarkdown` NÃO cobre e apareceria cru na Web.
 *
 * ⚠️ Esta lista é o COMPLEMENTO do renderizador — cada item foi lido lá dentro.
 * Se `resposta-markdown.tsx` ganhar cobertura nova, o item correspondente sai
 * daqui. Nada aqui é palpite sobre o que a tela faz.
 */
export function sintaxeCruaWeb(texto: string): SintaxeCrua[] {
  return [
    achar(texto, /(?<![\p{L}\p{N}_])_(?!\s)[^_\n]+?(?<!\s)_(?![\p{L}\p{N}_])/u, "_ (itálico sublinhado)"),
    achar(texto, /__/, "__ (negrito sublinhado)"),
    achar(texto, /~~/, "~~ (tachado)"),
    achar(texto, /^\s*\|.*\|\s*$/m, "| (tabela)"),
    achar(texto, /^\s*[-*]\s+\[[ x]\]/m, "- [ ] (checkbox)"),
    achar(texto, /\*\*[^*]*\n[^*]*\*\*/, "** atravessando quebra de linha"),
  ].filter((x): x is SintaxeCrua => x !== null);
}
