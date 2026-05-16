import { getAnthropicClient, MODELS } from "@/lib/ia/anthropic";
import { getSystemPrompt } from "@/lib/ai/prompts";
import type { ReportData } from "./data";

/**
 * Gera observações narrativas curtas pra colocar em pontos-chave do
 * relatório. PRD §7.17: a narrativa NUNCA sugere diagnóstico,
 * prognóstico ou conduta clínica. Limita-se a descrever padrões
 * observáveis nos dados.
 *
 * Validador checa se a saída tem termos clínicos prescritivos. Em caso
 * positivo, regenera 1× com instrução mais restritiva. Se persistir,
 * retorna sem narrativa (relatório fica com dados brutos).
 */

const TERMOS_PROIBIDOS = [
  /\bdiagnóstic[oa]\b/i,
  /\bprognóstic[oa]\b/i,
  /\btratamento\b/i,
  /\bcura\b/i,
  /\bmedicaç[ãa]o\b/i,
  /\bdeve(?:ria|m|r) (?:tomar|fazer|iniciar|interromper)\b/i,
  /\bsugiro (?:tratamento|medicamento|terapia)\b/i,
  /\brecomendo (?:tratamento|medicamento)\b/i,
];

const SYSTEM_PROMPT_FALLBACK = `Você é o gerador de observações narrativas para o relatório do Kolo Família.

# Sua tarefa
Escrever 3-6 observações curtas (1-2 frases cada) sobre os PADRÕES OBSERVADOS nos dados que vou te passar. Em PORTUGUÊS BRASILEIRO. Cada observação descreve algo que aparece nos números/fatos — gatilhos frequentes, evolução, estratégias que vêm aparecendo, frequência de eventos.

# Limites duros
- NÃO sugerir diagnóstico, prognóstico ou conduta clínica.
- NÃO usar termos: diagnóstico, prognóstico, tratamento, cura, medicação, "deve tomar", "deve fazer", "recomendo tratamento".
- NÃO usar palavras alarmistas (preocupante, grave, urgente).
- NÃO comparar com outras crianças.
- NÃO citar nomes de outros membros da família — use "outro adulto cuidador", "outro membro da família", "profissional da escola" se necessário.
- LIMITAR-SE a descrever os números: "X aparece em N de M ocorrências", "Y mudou de A para B no período".

# Formato
Devolva APENAS um JSON: { "observacoes": ["...", "..."] }. Nada antes ou depois.`;

export async function gerarNarrativa(data: ReportData): Promise<string[]> {
  let client;
  try {
    client = getAnthropicClient();
  } catch {
    return []; // Sem chave: relatório roda sem narrativa
  }

  const userMsg = montarUserMsg(data);
  const systemPrompt = await getSystemPrompt("relatorio_narrativa", SYSTEM_PROMPT_FALLBACK);

  let texto: string;
  try {
    const stream = client.messages.stream({
      model: MODELS.principal,
      max_tokens: 1500,
      system: [
        { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userMsg }],
    });
    const finalMessage = await stream.finalMessage();
    texto = finalMessage.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("");
  } catch {
    return [];
  }

  const observacoes = parseObservacoes(texto);
  const filtradas = observacoes.filter((obs) => !contemTermoProibido(obs));

  // Se a IA gerou mas o validador rejeitou tudo, retornamos vazio em vez
  // de regenerar — relatório segue sem essa seção.
  return filtradas;
}

function montarUserMsg(d: ReportData): string {
  const partes: string[] = [
    `<membro>nome: ${d.membro.nome}, ${d.membro.idade} anos, perfil ${d.membro.perfil}</membro>`,
    `<janela>${d.janelaMeses} meses</janela>`,
    `<conquistas total="${d.linhaDoTempo.conquistas.length}">
${d.linhaDoTempo.conquistas.slice(0, 10).map((c) => `${c.data}: ${c.texto}`).join("\n")}
</conquistas>`,
    `<desafios total="${d.linhaDoTempo.desafios.length}">
${d.linhaDoTempo.desafios.slice(0, 10).map((c) => `${c.data}: ${c.texto}`).join("\n")}
</desafios>`,
  ];

  if (d.linhaDoTempo.gatilhosFrequentes.length > 0) {
    partes.push(
      `<gatilhos_recorrentes>
${d.linhaDoTempo.gatilhosFrequentes.map((g) => `${g.texto} (${g.ocorrencias}×)`).join("\n")}
</gatilhos_recorrentes>`,
    );
  }

  if (d.linhaDoTempo.estrategiasAplicadas.length > 0) {
    partes.push(
      `<estrategias_aparecendo>
${d.linhaDoTempo.estrategiasAplicadas.join("\n")}
</estrategias_aparecendo>`,
    );
  }

  if (d.camadaB) {
    partes.push(
      `<camada_b_estado_adulto_em_desafios>
${d.camadaB.correlacaoEstadoAdulto.map((c) => `${c.estado}: ${c.ocorrenciasDesafio}×`).join("\n")}
</camada_b_estado_adulto_em_desafios>`,
    );
  }

  partes.push(
    "Gere 3 a 6 observações narrativas curtas baseadas SOMENTE nos números acima. Devolva o JSON.",
  );

  return partes.join("\n\n");
}

function parseObservacoes(texto: string): string[] {
  const trimmed = texto.trim();
  let json: unknown;
  try {
    json = JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return [];
    try {
      json = JSON.parse(match[0]);
    } catch {
      return [];
    }
  }
  if (typeof json !== "object" || json === null) return [];
  const obs = (json as { observacoes?: unknown }).observacoes;
  if (!Array.isArray(obs)) return [];
  return obs
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .slice(0, 6);
}

function contemTermoProibido(texto: string): boolean {
  return TERMOS_PROIBIDOS.some((re) => re.test(texto));
}
