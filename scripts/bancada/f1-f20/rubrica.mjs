/**
 * A RUBRICA F1–F20 — fonte única, e o que cada critério mede de verdade.
 *
 * ⚠️ POR QUE ESTE ARQUIVO EXISTE. Até 06/09/2026 os critérios F1 a F20 viviam
 * só em documentação: não havia programa capaz de dizer se uma resposta os
 * respeitava. A bancada antiga (`fidelidade/rodar-A.mjs`) GERAVA turnos e
 * parava ali — trocar `v10` por `v11` e rodar não produziria nota nenhuma.
 *
 * ⚠️ DOIS GRUPOS, E A DIVISÃO NÃO É DE CONVENIÊNCIA. Onde existe medida
 * objetiva — tamanho, número de perguntas, presença de lista, emoji, negrito —
 * a régua é determinística, porque um juiz de modelo introduziria variação numa
 * coisa que se conta. Onde a INTENÇÃO importa — "acrescentou algo novo?",
 * "inventou personalização?" — não há regex honesta, e aí entra o juiz.
 *
 * ⚠️ N/A NÃO É APROVAÇÃO. Um critério que não se aplica àquele caso sai como
 * `nao_aplicavel` e é contado à parte. Somar N/A com `pass` produziria uma
 * bancada que melhora de nota quanto menos ela consegue avaliar.
 */

/** Onde a família veria a resposta. Só o WhatsApp importa nesta bancada. */
const RE_LISTA = /^\s*(?:[-*•]\s+|\d{1,2}\s*[.)]\s+|[1-9]️?⃣\s*)/m;
const RE_NEGRITO = /\*[^*\n]{2,}\*/;
const RE_EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{20E3}]/gu;
const RE_PERGUNTA = /\?/g;

/**
 * ⚠️ O CTA É UM CONVITE A AGIR, não qualquer frase com verbo. A lista veio das
 * formas que a Ayla realmente usa para chamar a família a um recurso: abrir um
 * link, pedir o quadro, querer o plano. "Me conta como foi" é continuação de
 * conversa e NÃO conta — se contasse, quase todo turno teria CTA e o critério
 * perderia o sentido.
 */
const RE_CTA =
  /(quer que eu (monte|prepare|faça|crie)|posso (montar|preparar|fazer|criar)|toca aqui|clica aqui|abre (o|esse) link|te mando|quer o (quadro|plano|pdf))/i;

/** Jargão clínico que a família não pediu — F19 mede a superfície, o juiz mede o resto. */
const RE_JARGAO =
  /\b(disfun[çc][ãa]o executiva|integra[çc][ãa]o sensorial|processamento sensorial|comorbidade|etiologia|neurot[íi]pic[oa]|ABA\b|DSM-?5|CID-?1[01]|hiperreatividade|hiporreatividade|autorregula[çc][ãa]o|fun[çc][õo]es executivas|intera[çc][ãa]o social rec[íi]proca)\b/i;

/**
 * OS TETOS DE TAMANHO, por nível de profundidade.
 *
 * ⚠️ MEDIDOS, NÃO ARBITRADOS. Vêm de `lib/conducao/fronteiras-forma.ts`, que
 * já governa a forma em produção: 350 para o turno simples, 500 para
 * continuação, 700 para orientação, 1200 para entrega. Repetir os números aqui
 * com outro valor criaria duas réguas para a mesma coisa.
 */
export const TETOS = { N1: 700, N2: 900, N3: 1400 };

/**
 * As vinte, com tipo e a pergunta que cada uma responde.
 *
 * `tipo`: "det" avalia por medida; "juiz" avalia por rubrica fechada no GPT.
 * `nivel`: quando o critério só se aplica a um nível de profundidade.
 */
export const RUBRICA = [
  { id: "F1", tipo: "det", nome: "N1 curto", nivel: "N1",
    pergunta: "A primeira resposta é curta e direta?" },
  { id: "F2", tipo: "juiz", nome: "N2 só após interesse",
    pergunta: "A Ayla só aprofundou DEPOIS de a família demonstrar interesse (perguntar 'como?', pedir mais)? Se ela despejou profundidade sem ser convidada, é fail." },
  { id: "F3", tipo: "juiz", nome: "N2 acrescenta algo novo",
    pergunta: "Ao aprofundar, ela acrescentou informação NOVA — e não reformulou o que já tinha dito com outras palavras?" },
  { id: "F4", tipo: "det", nome: "N3/lista só quando explícito",
    pergunta: "Só apresentou lista/passo a passo quando a família pediu explicitamente?" },
  { id: "F5", tipo: "juiz", nome: "sem suspense artificial",
    pergunta: "Ela evitou anunciar valor sem entregar ('tenho uma ideia', 'existe um jeito', 'vou te explicar')? Prometer e não entregar no mesmo turno é fail." },
  { id: "F6", tipo: "juiz", nome: "ajuda antes de investigar",
    pergunta: "Ela ofereceu algo útil ANTES de pedir mais informação? Responder só com perguntas, sem nenhuma ajuda, é fail." },
  { id: "F7", tipo: "juiz", nome: "pergunta só se muda orientação",
    pergunta: "A pergunta que ela fez realmente mudaria a orientação conforme a resposta? Pergunta cuja resposta não mudaria nada é fail." },
  { id: "F8", tipo: "det", nome: "uma pergunta por vez",
    pergunta: "No máximo uma pergunta importante no turno." },
  { id: "F9", tipo: "juiz", nome: "sem interrogatório",
    pergunta: "O turno evitou parecer formulário — sem encadear perguntas nem repetir o que a família já respondeu?" },
  { id: "F10", tipo: "juiz", nome: "personalização natural",
    pergunta: "Quando usou algo que sabe da criança (nome, interesse, rotina), usou de forma natural e pertinente — não como etiqueta colada?" },
  { id: "F11", tipo: "juiz", nome: "sem personalização inventada",
    pergunta: "Ela NÃO afirmou nada sobre a criança que não estivesse no contexto fornecido? Qualquer fato inventado — diagnóstico, idade, gosto, evento — é fail." },
  { id: "F12", tipo: "juiz", nome: "continuidade",
    pergunta: "Ela tratou a mensagem como continuação do que estava aberto, e não como conversa nova?" },
  { id: "F13", tipo: "juiz", nome: "correção prevalece",
    pergunta: "Quando a família corrigiu algo, ela acatou a correção e seguiu a partir dela — sem insistir na versão anterior?" },
  { id: "F14", tipo: "det", nome: "CTA específico",
    pergunta: "Se houve chamada à ação, ela é específica — e não genérica." },
  { id: "F15", tipo: "juiz", nome: "CTA depois de valor",
    pergunta: "Se houve chamada à ação, ela veio DEPOIS de a Ayla ter entregue algo útil no mesmo turno?" },
  { id: "F16", tipo: "det", nome: "tamanho adequado",
    pergunta: "O tamanho cabe no nível de profundidade do turno." },
  { id: "F17", tipo: "det", nome: "negrito funcional",
    pergunta: "Negrito destaca o que importa, sem virar decoração." },
  { id: "F18", tipo: "det", nome: "emoji adequado à gravidade",
    pergunta: "Emoji ausente ou contido; nenhum emoji em turno de risco." },
  { id: "F19", tipo: "juiz", nome: "conhecimento por trás",
    pergunta: "O conhecimento apareceu como orientação prática, sem jargão clínico e sem exibir a fonte?" },
  { id: "F20", tipo: "juiz", nome: "venting / stop",
    pergunta: "Em desabafo sem risco, ela acolheu sem despejar solução nem investigar? Em risco real, priorizou segurança acima de estilo?" },
];

export const CRITERIOS_JUIZ = RUBRICA.filter((c) => c.tipo === "juiz");
export const CRITERIOS_DET = RUBRICA.filter((c) => c.tipo === "det");

/**
 * As réguas objetivas.
 *
 * ⚠️ ELAS RECEBEM O CASO INTEIRO, não só o texto — porque quase todo critério
 * depende do que a família pediu. "Lista" é falha quando ninguém pediu e é o
 * comportamento certo quando alguém pediu passo a passo. Avaliar o texto solto
 * produziria as duas notas erradas.
 */
export function avaliarDeterministicos(turno) {
  const t = turno.texto ?? "";
  const r = {};
  const na = (id, motivo) => (r[id] = { veredito: "nao_aplicavel", evidencia: motivo });
  const ok = (id, ev) => (r[id] = { veredito: "pass", evidencia: ev ?? "" });
  const mal = (id, ev) => (r[id] = { veredito: "fail", evidencia: ev });

  // ── F1 · N1 CURTO ────────────────────────────────────────────────────────
  if (turno.nivelEsperado !== "N1") na("F1", "turno não é N1");
  else if (t.length <= TETOS.N1) ok("F1", `${t.length} chars`);
  else mal("F1", `${t.length} chars > ${TETOS.N1}`);

  // ── F4 · LISTA SÓ QUANDO PEDIDA ──────────────────────────────────────────
  const temLista = RE_LISTA.test(t);
  if (turno.pediuPassoAPasso) {
    // Pediu passo a passo: a lista é o certo, e a ausência dela não é falha
    // deste critério (F4 mede excesso, não omissão).
    ok("F4", temLista ? "lista pedida e entregue" : "sem lista, mas foi pedida");
  } else if (temLista) {
    mal("F4", `lista sem pedido: ${JSON.stringify(t.match(RE_LISTA)?.[0] ?? "")}`);
  } else ok("F4", "sem lista");

  // ── F8 · UMA PERGUNTA POR VEZ ────────────────────────────────────────────
  const nPerguntas = (t.match(RE_PERGUNTA) ?? []).length;
  if (nPerguntas <= 1) ok("F8", `${nPerguntas} pergunta(s)`);
  else mal("F8", `${nPerguntas} interrogações`);

  // ── F14 · CTA ESPECÍFICO ─────────────────────────────────────────────────
  const temCta = RE_CTA.test(t);
  if (!temCta) na("F14", "sem CTA no turno");
  else if (/\b(quadro|rotina|plano|pdf|link|hist[óo]ria|cart(ão|ões))\b/i.test(t))
    ok("F14", "CTA nomeia o recurso");
  else mal("F14", "CTA genérico, sem objeto");

  // ── F16 · TAMANHO ────────────────────────────────────────────────────────
  const teto = TETOS[turno.nivelEsperado ?? "N2"] ?? TETOS.N2;
  if (t.length <= teto) ok("F16", `${t.length} <= ${teto}`);
  else mal("F16", `${t.length} > ${teto} (${turno.nivelEsperado})`);

  // ── F17 · NEGRITO FUNCIONAL ──────────────────────────────────────────────
  const negritos = (t.match(/\*[^*\n]{2,}\*/g) ?? []).length;
  if (negritos === 0) na("F17", "sem negrito");
  else if (negritos <= 3) ok("F17", `${negritos} destaque(s)`);
  else mal("F17", `${negritos} destaques — vira decoração`);
  // Marcação crua do markdown nunca é aceitável no WhatsApp.
  if (/\*\*|^#{1,6}\s|__/m.test(t)) mal("F17", "markdown cru chegaria à família");

  // ── F18 · EMOJI E GRAVIDADE ──────────────────────────────────────────────
  const emojis = (t.match(RE_EMOJI) ?? []).length;
  if (turno.risco) {
    if (emojis === 0) ok("F18", "risco sem emoji");
    else mal("F18", `${emojis} emoji(s) em turno de risco`);
  } else if (emojis <= 2) ok("F18", `${emojis} emoji(s)`);
  else mal("F18", `${emojis} emojis`);

  return r;
}

/** Só para o relatório: jargão encontrado, como pista para o F19 do juiz. */
export function jargaoEncontrado(texto) {
  const m = (texto ?? "").match(RE_JARGAO);
  return m ? m[0] : null;
}
