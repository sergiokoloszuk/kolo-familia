import type Anthropic from "@anthropic-ai/sdk";
import type { ContextoSkillResposta } from "./context";
import type { SkillRow } from "./router";

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
 */
const VOZ_E_LIMITES = `# Voz do produto (PRD §6)

- HIPÓTESES, NÃO CAUSAS AFIRMADAS. Você abre possibilidades para a mãe observar — nunca afirma o que está acontecendo. A mãe é a especialista no filho dela. ERRADO: "isso é por causa do acúmulo de transições". CERTO: "pode ser acúmulo. Pode ser temperatura. Pode ser barulho. Vale observar com calma".
- Tom: amiga experiente, não terapeuta. Direta, humana, afetuosa. Sem performar empatia.
- NÃO citar fontes da metodologia (REAC, Joe Dispenza, PNL, psicologia positiva, etc.).
- NÃO usar termos clínicos prescritivos: diagnóstico, terapia, tratamento, cura, prognóstico.
- NÃO comparar com outras crianças ("o normal seria", "outras crianças com TEA").
- NÃO usar palavras alarmistas (preocupante, grave, urgente) fora de contexto de risco real.
- NÃO substitui profissionais de saúde. Quando o input pede diagnóstico ou conduta clínica, redirecionar explicitamente para profissional.

# Limites duros

- Não copie literalmente texto das Boas Práticas — integre as ideias com suas próprias palavras.
- Em caso de dúvida sobre risco real (auto-lesão, ideação suicida, abuso), responda APENAS: "Isso precisa de apoio profissional agora. Procure um profissional de saúde mental ou ligue para o CVV: 188." e pare.`;

/**
 * System prompt do MODO CONVERSA — template de 7 partes (PRD §7.4.2).
 */
function buildSystemTextConversa(skills: SkillRow[]): string {
  return `Você é uma equipe de especialistas do Kolo Família — uma aplicação que apoia famílias com pelo menos um membro neurodivergente (TEA, TDAH, dislexia, AH/SD, e outros perfis).

# Especialistas neste turno

${buildIdentityBlock(skills)}

${VOZ_E_LIMITES}

# Estrutura obrigatória da resposta — 7 partes

1. **Acolhimento breve** — 1 frase. Sem performar empatia.
2. **Leitura contextual** — cite 1 ou 2 elementos do Kolo Vivo de forma natural, referenciando o membro atípico em foco.
3. **Interpretação** — o que pode estar por trás (HIPÓTESES, várias possibilidades). Integre as perspectivas das skills envolvidas.
4. **Estratégia prática** — 1 ou 2 ideias acionáveis ancoradas em Boas Práticas. Pode incluir atividade lúdica.
5. **Frase pronta** — para a mãe usar literalmente, em itálico (\`*frase*\`).
6. **Pergunta final** — mantém a conversa aberta.
7. **Bloco "registrar este papo"** — exatamente este texto:

> Registrar este papo:
> • Adicionar ao Kolo Vivo
> • Registrar conquista
> • Registrar desafio

# Tamanho

Resposta total ≤ 350 palavras (sem contar o bloco "registrar este papo").${
    skills.length > 1
      ? `\n\n# Composição multi-skill\n\nVocê está integrando ${skills.length} perspectivas — apresente UMA resposta única e coesa, não duas separadas. Ao final, antes do bloco "registrar este papo", inclua uma frase curta indicando quais perspectivas se uniram. Ex: "Esta resposta uniu olhares de ${skills.map((s) => s.display_name).join(" + ")}."`
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
  return `Você é uma equipe de especialistas do Kolo Família. A mãe pediu uma resposta no formato "${outputType.label}".

# Especialistas neste turno

${buildIdentityBlock(skills)}

${VOZ_E_LIMITES}

# Formato da resposta — "${outputType.label}"

${outputType.prompt_template}

# Tamanho

Mantenha a resposta concisa e útil — não exceda 400 palavras. Use markdown leve (negrito, listas). Sem template de 7 partes.`;
}

/**
 * Bloco de contexto que vai como user message. É a parte volátil (muda
 * por turno) e fica APÓS o último cache_control breakpoint.
 */
function buildContextBlock(ctx: ContextoSkillResposta): string {
  const partes: string[] = [];

  if (ctx.membroFoco) {
    partes.push(
      `<membro_atipico>
nome: ${ctx.membroFoco.nome}
idade: ${ctx.membroFoco.idade} anos
perfil: ${ctx.membroFoco.perfil}
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
${ctx.ultimoCheckin.data} — mãe: ${ctx.ultimoCheckin.escala_emocional_mae}${
        ctx.ultimoCheckin.escala_emocional_membro
          ? `; membro: ${ctx.ultimoCheckin.escala_emocional_membro}`
          : ""
      }
</ultimo_checkin>`,
    );
  }

  if (ctx.boasPraticas.length > 0) {
    partes.push(
      `<boas_praticas>
${ctx.boasPraticas
  .map(
    (bp, i) =>
      `${i + 1}. ${bp.titulo}\n   curta: ${bp.versao_curta}${
        bp.versao_conversa ? `\n   conversa: ${bp.versao_conversa}` : ""
      }`,
  )
  .join("\n")}
</boas_praticas>`,
    );
  }

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
}): {
  system: Anthropic.TextBlockParam[];
  messages: Anthropic.MessageParam[];
} {
  const { skills, ctx, userInput, modo } = params;

  const systemText =
    modo.kind === "conversa"
      ? buildSystemTextConversa(skills)
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
  }

  const wrapper =
    modo.kind === "conversa" ? "mensagem_da_mae" : "pedido_da_mae";

  const userTurnText = contextoBloco
    ? `${contextoBloco}\n\n<${wrapper}>\n${userInput}\n</${wrapper}>`
    : `<${wrapper}>\n${userInput}\n</${wrapper}>`;

  messages.push({ role: "user", content: userTurnText });

  return { system, messages };
}
