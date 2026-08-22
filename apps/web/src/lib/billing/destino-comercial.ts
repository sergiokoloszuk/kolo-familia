/**
 * DESTINO COMERCIAL — para onde mandar quem quer assinar, e para onde mandar
 * quem precisa de gente. Fonte canônica única dos dois canais.
 *
 * ── por que este arquivo existe ───────────────────────────────────────────
 *
 * Auditoria de 22/08/2026, medida em produção sobre 3909 mensagens enviadas:
 *
 *   · `/precos` apareceu **2 vezes**; o magic link `/auth/wa`, **437**;
 *   · o telefone do suporte, **zero vezes** — ele não existia no código,
 *     só num documento;
 *   · a Web não tinha tratamento nenhum de preço, embora o Core mandasse
 *     "aponte a página de preços (o canal te dá o link)";
 *   · das 18 formulações naturais testadas, 7 disparavam o link e 11 não —
 *     "onde assino?", "quais os planos?" e "me manda o link" ficavam de fora.
 *
 * A causa comum é a do §15 do protocolo: **decisão sem dono único**. O link
 * morava em três lugares, o contato de suporte em quatro, e quem decidia se o
 * link saía era um regex de frase dentro do arquivo do WhatsApp.
 *
 * ── por que NÃO foi para o classificador de intenção ──────────────────────
 *
 * `lib/ayla/intent.ts` existe e seria o dono "natural". Foi avaliado e
 * descartado, por três razões:
 *
 *   1. Ele roteia ARTEFATOS (rotina_criar, rotina_ver, plano). Uma pergunta de
 *      preço classificada como `plano` dispararia a geração de um PDF que
 *      ninguém pediu — troca um erro barato por um caro.
 *   2. É um prompt de quatro campos separados por `|`, com incidente
 *      documentado de campo escorregando (04/08). Acrescentar um valor mexe no
 *      parser e no prompt de uma peça que decide coisa mais crítica.
 *   3. É chamada de modelo: falha para `"outro"` e custa latência. O link de
 *      conversão não pode depender de uma chamada que pode não voltar.
 *
 * O classificador da Web (`lib/ia/intencao.ts`) tem outro eixo ainda —
 * crise/desafio/dúvida/desabafo. "Quanto custa" não é nenhum dos quatro.
 *
 * Então a decisão é determinística, fica AQUI, e os dois canais a importam.
 * Não é "um regex maior": é um detector estruturado, com famílias de sentido e
 * exclusões explícitas, coberto por teste positivo E negativo.
 */

/**
 * A ORIGEM da aplicação — um lugar só.
 *
 * ⚠️ Sem `NEXT_PUBLIC_APP_URL` devolve `null`, e quem chama degrada dizendo
 * onde fica em vez de mandar um link quebrado. **PROVADO em 22/08:** a
 * variável está definida em produção como `https://kolo-familia-web.vercel.app`
 * — o `sitemap.ts` cai em `kolofamilia.com.br` quando ela falta, e o sitemap
 * servido mostra o domínio da aplicação.
 */
export function origemCanonica(): string | null {
  const bruta = (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");
  return bruta || null;
}

/** A página de Planos. **Conversão.** Pública, e lê os valores ao vivo. */
export function linkPlanos(): string | null {
  const origem = origemCanonica();
  return origem ? `${origem}/precos` : null;
}

/**
 * ⚠️ MAGIC LINK NÃO É LINK COMERCIAL. `/auth/wa` é **acesso** — serve para
 * entrar sem senha. `/precos` é **conversão**. Trocar um pelo outro foi o que
 * a auditoria encontrou 437 vezes contra 2.
 */

/** O contato humano. Um número, um lugar. */
export const WHATSAPP_SUPORTE = "(11) 94037-7337";

// ============================================================
// É pergunta comercial?
// ============================================================

/** Termos que só existem em conversa de dinheiro. */
const DINHEIRO =
  /\b(pre[çc]o|mensalidade|assinatura|cobran[çc]a|cupom|desconto|gr[áa]tis|pagamento)\b/i;

/**
 * "quanto custa / é / fica / sai / vou pagar".
 *
 * ⚠️ A fronteira final é `(?=$|[\s?!.,])`, e NÃO `\b`. Em JavaScript sem a
 * flag `u`, `\b` é ASCII: entre "é" e "?" não existe fronteira de palavra, e
 * `\bé\b` nunca casa. "quanto é?" — das formas mais comuns — passava batido
 * por causa disso, e o teste pegou.
 */
const QUANTO_CUSTA =
  /\bquanto\s+(custa|custam|[ée]|fica|sai|vai\s+ser|vou\s+pagar|tenho\s+que\s+pagar|se\s+paga)(?=$|[\s?!.,])/i;

/**
 * "valor" só quando é PERGUNTADO, ou quando é valor DE PLANO. Sozinho ele é
 * quase sempre outra coisa na Kolo — "o valor dela como mãe".
 */
const QUAL_VALOR =
  /\b(qual|quais|quanto|que)\s+(é\s+|s[ãa]o\s+)?(o\s+|os\s+)?valor(es)?\b|\bvalor(es)?\s+(do|da|de)\s+(plano|assinatura|app|aplicativo|kolo|mensalidade)\b/i;

/** Pagar, em qualquer forma. */
const PAGAR = /\b(pagar|paguei|pagando|pago|cobra|cobram|cobrar|cobrado)\b/i;

/** Contratar o serviço: assinar, assino, assinante, contratar. */
const CONTRATAR = /\b(assinar|assino|assina|assinante|contratar|contrato)\b/i;

/**
 * ⚠️ O QUE SEQUESTRA O VERBO "ASSINAR". "Meu filho não quer assinar o caderno"
 * não é intenção comercial — e o regex anterior casava, porque tinha
 * `\bassinar\b` solto. Quando o objeto é papel, o verbo é outro.
 */
const OBJETO_DE_PAPEL =
  /\b(caderno|papel|folha|documento|autoriza[çc][ãa]o|ficha|agenda|bilhete|termo|declara[çc][ãa]o|receita|laudo|desenho|prova|atividade|di[áa]rio|contrato\s+(escolar|de\s+aluguel))\b/i;

/** "quais são os planos", "que planos vocês têm" — plural e perguntado. */
const PLANOS_COMERCIAIS =
  /\b(quais|que|quantos)\s+(s[ãa]o\s+)?(os\s+)?planos\b|\bplanos\s+(de\s+)?(assinatura|voc[êe]s|da\s+kolo)\b|\bplano\s+(mensal|anual)\b/i;

/** Pedido de link. */
const PEDE_LINK = /\b(manda|mande|envia|envie|passa|passe|qual|onde\s+est[áa]|cad[êe])\b[^.?!]{0,20}\blink\b|\blink\b[^.?!]{0,12}\b(pra|para)\s+(assinar|pagar)\b/i;

/** Link de OUTRA coisa — a Ayla manda vários links que não são de venda. */
const LINK_DE_OUTRA_COISA =
  /\blink\s+(d[oa]|de|para\s+o|pra\s+o|pra|para)\s+(v[íi]deo|rotina|plano|relat[óo]rio|hist[óo]ria|desenho|medita[çc][ãa]o|app|aplicativo|acesso|entrar|login|cadastro)\b/i;

/** "quero continuar" — no fim do teste, é intenção de continuar PAGANDO. */
const QUERO_CONTINUAR =
  /\b(quero|queria|gostaria\s+de|pretendo|vou)\s+continuar\b/i;

/** …mas não quando o objeto é a criança ou um artefato. */
const CONTINUAR_OUTRA_COISA =
  /\bcontinuar\s+(a\s+|o\s+|com\s+a\s+|com\s+o\s+)?(rotina|terapia|fono|escola|tentando|insistindo|assim|em\s+casa|treinando|conversando|falando)\b/i;

/**
 * ESTA MENSAGEM É SOBRE CONTRATAR / QUANTO CUSTA?
 *
 * Positiva por FAMÍLIA DE SENTIDO, não por frase decorada. As exclusões são
 * explícitas porque cada uma nasceu de um falso positivo real ou previsto.
 */
export function ehPerguntaComercial(texto: string | null | undefined): boolean {
  const t = (texto ?? "").trim();
  if (!t) return false;

  if (DINHEIRO.test(t)) return true;
  if (QUANTO_CUSTA.test(t)) return true;
  if (QUAL_VALOR.test(t)) return true;
  if (PAGAR.test(t)) return true;
  if (PLANOS_COMERCIAIS.test(t)) return true;

  // "assinar" só vale quando não está assinando um papel.
  if (CONTRATAR.test(t) && !OBJETO_DE_PAPEL.test(t)) return true;

  // "me manda o link" vale, a menos que o link seja de outra coisa.
  if (PEDE_LINK.test(t) && !LINK_DE_OUTRA_COISA.test(t)) return true;

  // "quero continuar" vale, a menos que seja continuar a terapia/rotina.
  if (QUERO_CONTINUAR.test(t) && !CONTINUAR_OUTRA_COISA.test(t)) return true;

  return false;
}

// ============================================================
// É pedido de gente?
// ============================================================

/** Pedido explícito de humano. */
const PEDE_HUMANO_EXPLICITO =
  /\b(falar|conversar|contato)\s+(com\s+)?(uma\s+|um\s+|alguma\s+)?(pessoa|gente|humano|algu[ée]m|atendente|respons[áa]vel|time|equipe|suporte)\b|\b(quero|queria|preciso|posso)\s+falar\s+com\b|\btem\s+algu[ée]m\b/i;

/** Problema que a Ayla não resolve sozinha: erro, falha, travou, não consigo. */
const PROBLEMA_OPERACIONAL =
  /\b(erro|falhou|falha|travou|travando|bugou|n[ãa]o\s+funciona|n[ãa]o\s+carrega|n[ãa]o\s+abre|n[ãa]o\s+consigo\s+(entrar|acessar|pagar|assinar|cancelar)|recusado|recusou|negado\s+o\s+pagamento|cobrado\s+(duas|2)\s+vezes|cobran[çc]a\s+(errada|duplicada)|reembolso|estornar|estorno)\b/i;

/**
 * ESTA MENSAGEM PRECISA DE GENTE?
 *
 * ⚠️ A ORDEM IMPORTA, e é a regra de produto desta frente: perguntar preço,
 * planos, como/onde assinar ou pedir o link **não** é caso de suporte — a Ayla
 * responde. Só vira humano quando há pedido explícito por uma pessoa, ou um
 * problema operacional que ela não consegue resolver.
 *
 * Medido em 22/08: dos 5 encaminhamentos reais encontrados, um era pergunta de
 * preço ("vale falar com o time pelo suporte") e nenhum dos cinco informava
 * qualquer contato.
 */
export function precisaDeHumano(texto: string | null | undefined): boolean {
  const t = (texto ?? "").trim();
  if (!t) return false;
  if (PEDE_HUMANO_EXPLICITO.test(t)) return true;
  // Problema operacional manda para gente mesmo quando fala de pagamento —
  // "não consigo pagar, dá erro" é suporte, não conversão.
  if (PROBLEMA_OPERACIONAL.test(t)) return true;
  return false;
}

// ============================================================
// As notas de prompt — o MESMO texto nos dois canais
// ============================================================

/** O que dizer quando a pessoa toca em preço/assinatura. */
export function notaComercial(): string {
  const link = linkPlanos();
  return [
    `Ela tocou em PREÇO / PLANOS / ASSINAR. Não negocie, não invente valor nem desconto — mas RESPONDA você mesma; isto NÃO é assunto de suporte.`,
    `Antes de qualquer coisa, cheque se você acabou de oferecer um plano estratégico: se sim, ela provavelmente achou que o MATERIAL é pago. Desfaça isso primeiro — o plano estratégico é o material sobre a criança, já incluído, sem custo. E ofereça montar assim mesmo.`,
    `Durante o teste não se cobra nada, e nenhum material que você entrega é cobrado à parte.`,
    link
      ? `Se a dúvida for mesmo sobre a assinatura (quanto custa, quais planos, como assinar), mande ESTE link, que mostra os valores atualizados: ${link}`
      : `Se a dúvida for sobre a assinatura, diga que os valores ficam na página de Planos, dentro do app.`,
    `NÃO mande procurar suporte por causa de preço, plano ou "como assino" — isso é seu.`,
  ].join(" ");
}

/** O que dizer quando o caso é mesmo de gente. */
export function notaSuporte(): string {
  return [
    `Este caso é de GENTE, não seu: ela pediu falar com uma pessoa, ou há um problema operacional (erro de pagamento, cobrança errada, acesso travado) que você não resolve daí.`,
    `Diga isso com naturalidade e PASSE O CONTATO — nunca mande "procurar o suporte" sem dizer onde: o WhatsApp do time é ${WHATSAPP_SUPORTE}.`,
    `Não prometa que vai chamar alguém, não diga que "o time assume daqui" e não invente fila de atendimento — isso não existe e a pessoa fica esperando.`,
    `Depois de passar o contato, siga ajudando no que é seu.`,
  ].join(" ");
}
