/**
 * Templates determinísticos da Ayla — PRD §12.8 e §12.12.
 *
 * Cada template tem 3-5 variações de redação; o scheduler escolhe
 * round-robin pra evitar repetição. Mesmo com Z-API (que não exige
 * aprovação prévia da Meta), tratamos como templates fixos pra:
 *   - garantir consistência de tom
 *   - facilitar A/B testing
 *   - migração futura pra WhatsApp Cloud API ser apenas plug-and-play
 */

type TemplateVars = Record<string, string | number | undefined>;

function fill(template: string, vars: TemplateVars): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return v == null ? "" : String(v);
  });
}

/**
 * Escolhe round-robin baseado em um seed (geralmente o id da família +
 * o dia, pra que a mesma família receba a mesma variação no mesmo dia mas
 * varie ao longo da semana).
 */
function pickVariation(variations: string[], seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return variations[Math.abs(hash) % variations.length];
}

// ============================================================
// Pergunta diária de rotina — PRD §12.4
// ============================================================

const ROTINA: string[] = [
  "Oi, {nomeMae}.\nComo foi o dia do/da {nomeMembro}?\n\nMe conta só 2 coisas:\n1. uma conquista, mesmo pequena\n2. um desafio que apareceu hoje",
  "{nomeMae}, oi.\nE aí, como foi o dia hoje com {nomeMembro}?\n\nUma conquista + um desafio é suficiente.",
  "Oi! Como foi o dia do/da {nomeMembro} hoje?\n\nQuando puder responder: uma coisa boa e uma difícil.",
  "Oi, {nomeMae} 🌿\nComo está o dia? Conta uma coisa que deu certo e uma que foi difícil com {nomeMembro}.",
  "{nomeMae}, fim de dia. Como foi com {nomeMembro}?\n\nUma conquista + um desafio bastam — pode ser frase curta.",
];

export function templateRotinaDiaria(params: {
  nomeMae: string;
  nomeMembro: string;
  seed: string;
}): string {
  const v = pickVariation(ROTINA, params.seed);
  return fill(v, params);
}

// ============================================================
// Engajamento por inatividade — PRD §12.4
// ============================================================

const ENGAJAMENTO_2DIAS: string[] = [
  "Oi, {nomeMae}. Sumida há uns dias — está tudo bem aí?\n\nSe quiser me contar uma coisa do dia hoje, qualquer frase serve.",
  "{nomeMae}, faltou seu registro nesses dias. Tudo bem?\n\nUma frase curta sobre como vocês estão já ajuda.",
  "Oi! Não te ouvi nos últimos dias 🌿. Está tudo bem com {nomeMembro}?",
];

const ENGAJAMENTO_5DIAS: string[] = [
  "{nomeMae}, faz alguns dias que não nos falamos. Sem cobrança — quero só saber se estão bem.\n\nSe puder responder, mesmo que com 'tudo bem', já me conforta.",
  "Oi, {nomeMae}. Caí da rotina aqui sem você 😅. Me conta uma coisa do dia quando puder.",
];

export function templateEngajamento(params: {
  diasInativos: number;
  nomeMae: string;
  nomeMembro: string;
  seed: string;
}): string {
  const variations = params.diasInativos >= 5 ? ENGAJAMENTO_5DIAS : ENGAJAMENTO_2DIAS;
  const v = pickVariation(variations, params.seed);
  return fill(v, params);
}

// ============================================================
// Clarificação — quando parser tem confiança baixa (PRD §12.5, §12.7)
// ============================================================

export function templateClarificacaoMembro(params: {
  membros: Array<{ nome: string }>;
}): string {
  const opcoes = params.membros.map((m) => m.nome).join(" ou ");
  return `Sobre quem você está falando? ${opcoes}?`;
}

export function templateClarificacaoConteudo(): string {
  return "Não consegui entender direito o que aconteceu. Pode me contar de outro jeito? Uma frase curta serve.";
}

// ============================================================
// Resposta a registro — combina template + IA pra parte central
// PRD §12.5: "acolher → organizar → ação". Limite 60 palavras nas 3 frases.
// ============================================================

export function templateRespostaRegistro(params: {
  acolhimento: string;
  organizacao: string;
  acao?: string;
}): string {
  const partes = [params.acolhimento, params.organizacao];
  if (params.acao) partes.push(params.acao);
  return partes.join("\n\n");
}

// ============================================================
// Comandos
// ============================================================

export function templateComandoAjuda(): string {
  return [
    "Comandos disponíveis:",
    "• PAUSAR ou PAUSAR 7 — pausa minhas mensagens",
    "• MUDAR HORARIO 20:00 — atualiza o horário das perguntas diárias",
    "• SAIR — desativa as mensagens (mantém seus dados)",
    "• AJUDA — mostra esta lista",
  ].join("\n");
}

export function templateComandoPausada(dias: number): string {
  return `Pausada por ${dias} dia${dias === 1 ? "" : "s"}. Volto depois — pode escrever a qualquer hora se quiser falar antes.`;
}

export function templateComandoHorarioMudado(hora: string): string {
  return `Anotado, vou perguntar às ${hora}.`;
}

export function templateComandoSair(): string {
  return "Desativada. Seus dados continuam aqui, e quando quiser voltar é só me responder qualquer coisa.";
}
