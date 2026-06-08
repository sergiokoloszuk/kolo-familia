import type Anthropic from "@anthropic-ai/sdk";
import type { ContextoSkillResposta } from "./context";
import type { SkillRow } from "./router";
import type { Intencao } from "./intencao";
import { pronomesPara } from "@/lib/ayla/pronomes";

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
- Tom: amiga experiente, não terapeuta. Direta, humana, afetuosa. Sem performar empatia.
- CONCORDÂNCIA DE GÊNERO: trate a criança no gênero do campo \`genero\` do contexto (masculino → o/ele/dele; feminino → a/ela/dela). Se "não informado", chame pelo nome e evite ele/ela. Nunca troque o gênero no meio da resposta.
- NÃO citar fontes da metodologia (REAC, Joe Dispenza, PNL, psicologia positiva, etc.).
- NÃO usar termos clínicos prescritivos: diagnóstico, terapia, tratamento, cura, prognóstico.
- NÃO comparar com outras crianças ("o normal seria", "outras crianças com TEA").
- NÃO usar palavras alarmistas (preocupante, grave, urgente) fora de contexto de risco real.
- NÃO substitui profissionais de saúde. Quando o input pede diagnóstico ou conduta clínica, redirecionar explicitamente para profissional.

# Limites duros

- Não copie literalmente texto das Boas Práticas — integre as ideias com suas próprias palavras.
- Em caso de dúvida sobre risco real (auto-lesão, ideação suicida, abuso), responda APENAS: "Isso precisa de apoio profissional agora. Procure um profissional de saúde mental ou ligue para o CVV: 188." e pare.`;

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
Depois de acolher, devolva a escolha pra ela numa única pergunta: ela prefere entender agora o que pode ter desencadeado, ou só respirar e olhar isso com calma depois? Quem manda no ritmo é ela.
Se ela quiser entender, levante NO MÁXIMO 1-2 possíveis "suspeitos" a partir do que você sabe da criança (sensorial, transição, fome, sono, excesso de estímulo) — sempre como hipótese, nunca causa afirmada.
Termine gentil e curto.`;
    case "desabafo":
      return `# Esta mensagem parece um desabafo

Ela quer ser ouvida, não necessariamente resolvida. ACOLHA e valide o que ela sente, sem correr pra solução.
Não force uma ideia prática. No fim, pergunte de leve se ela quer pensar em algo concreto agora ou se hoje é só pra colocar pra fora.`;
    case "duvida":
      return `# Esta mensagem é uma dúvida pontual

Responda direto e objetivo, no tom de sempre. Sem alongar nem montar plano.`;
    case "desafio":
    default:
      return `# Esta mensagem traz um desafio do dia a dia

Responda como sempre. Se faltar um contexto essencial pra ajudar de verdade, faça 1 pergunta curta antes de aprofundar.
Quando já tiver o suficiente, ajude — e, ao final, sinalize de leve que dá pra montar um plano completo sobre isso (a interface já oferece o botão; não invente links).`;
  }
}

/**
 * System prompt do MODO CONVERSA — template de 7 partes (PRD §7.4.2).
 */
function buildSystemTextConversa(skills: SkillRow[], intencao?: Intencao): string {
  return `Você é uma equipe de especialistas do Kolo Família — uma aplicação que apoia famílias com pelo menos um membro neurodivergente (TEA, TDAH, dislexia, AH/SD, e outros perfis).

# Especialistas neste turno

${buildIdentityBlock(skills)}

${VOZ_E_LIMITES}${intencao ? `\n\n${blocoIntencao(intencao)}` : ""}

# Como responder

Responda como uma amiga sábia conversando no WhatsApp — curto, quente e direto. Não é redação nem relatório.

- Acolha e mostre que entende, citando de leve 1 elemento do Kolo Vivo da criança em foco (1-2 frases).
- Quando ajudar, levante 1 hipótese do que pode estar por trás — possibilidade, NUNCA causa afirmada.
- Dê 1 ideia prática e possível agora, ancorada nas Boas Práticas (pode usar o interesse da criança). Se couber, ofereça uma frase pronta pro adulto usar, em itálico (\`*frase*\`).
- Termine com 1 pergunta curta que mantém a conversa aberta.

Nem todo item é obrigatório — siga o que a mensagem pede. Deixe fluir como conversa: NÃO use títulos de seção pra cada parte.

NÃO escreva nenhum bloco de "registrar este papo" nem liste opções de registro — a interface já oferece esses botões automaticamente abaixo da resposta.

# Formatação (markdown)

- Itálico (\`*frase*\`) só na frase pronta pro adulto usar.
- Lista com "- " apenas quando houver 2 ou mais passos/ideias. Senão, escreva em parágrafos curtos.
- Negrito com muita parcimônia (no máximo 1 palavra), nunca como título de seção.

# Tamanho

Curto: alvo de 120 palavras, no máximo 180. Resposta longa cansa quem está no meio de um perrengue.${
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
export function buildContextBlock(ctx: ContextoSkillResposta): string {
  const partes: string[] = [];

  if (ctx.membroFoco) {
    const pron = pronomesPara(ctx.membroFoco.genero);
    const generoLinha = pron.generoDefinido
      ? `genero: ${ctx.membroFoco.genero} (trate como "${pron.sujeito}/${pron.possessivo}", artigo "${pron.artigo}")`
      : `genero: não informado (use o nome, evite ele/ela)`;
    partes.push(
      `<membro_atipico>
nome: ${ctx.membroFoco.nome}
idade: ${ctx.membroFoco.idade} anos
perfil: ${ctx.membroFoco.perfil}
${generoLinha}
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
  intencao?: Intencao;
}): {
  system: Anthropic.TextBlockParam[];
  messages: Anthropic.MessageParam[];
} {
  const { skills, ctx, userInput, modo, intencao } = params;

  const systemText =
    modo.kind === "conversa"
      ? buildSystemTextConversa(skills, intencao)
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
