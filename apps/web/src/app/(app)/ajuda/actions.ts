"use server";

import { z } from "zod";
import { getAnthropicClient, MODELS } from "@/lib/ia/anthropic";

/**
 * Guia de uso do app — a pessoa diz o que quer fazer e a IA responde em
 * passos curtos, indicando a tela certa. Ancorado num mapa REAL do app
 * (a IA só pode sugerir rotas desta lista; qualquer outra é descartada).
 */
export const ROTAS_AJUDA: { rota: string; label: string }[] = [
  { rota: "/painel", label: "Início" },
  { rota: "/kolo-vivo", label: "Kolo Vivo" },
  { rota: "/estrategias", label: "Estratégias" },
  { rota: "/evolucao", label: "Evolução" },
  { rota: "/historias", label: "Histórias" },
  { rota: "/registrar/diario", label: "Registrar o dia" },
  { rota: "/configuracoes", label: "Configurações" },
  { rota: "/configuracoes/conta", label: "Minha conta" },
  { rota: "/configuracoes/familia", label: "Mapa familiar" },
  { rota: "/configuracoes/avatar", label: "Avatar" },
  { rota: "/configuracoes/regras", label: "Alertas e adaptações" },
  { rota: "/assinatura", label: "Assinatura" },
];

const MAPA = `# Mapa do app Kolo Família (telas reais e o que se faz em cada uma)

- /painel (Início): visão da semana, pequenas conquistas, "foco da semana"; atalho "Registrar dia".
- /kolo-vivo (Kolo Vivo): o retrato de cada criança e da família. Editar as seções (o básico, o jeito, o corpo e o dia a dia, o que ajuda/pesa, sensações; e da família: composição, rotina da casa, recursos, dinâmica). Com 2+ crianças, há um seletor (pills) no topo pra trocar de filho. Sugestões novas aparecem num aviso pra aprovar/descartar.
- /estrategias (Estratégias): conversar com a Kolo sobre algo que aconteceu (escreve no campo à vontade e aperta "Conversar"). Abaixo da resposta há botões de "mais ajuda" (brincadeiras, atividades, crenças, o que fazer diferente, histórias sociais, frases prontas, rotinas) e um botão "Atualizar" que guarda no Kolo Vivo/diário. Também lista conversas anteriores (dá pra apagar na lixeira).
- /registrar/diario (Registrar o dia): check-in (como você está e como a criança está) + conquista, desafio, observação e contexto (quem estava, como reagiu).
- /evolucao (Evolução): linha do tempo de conquistas e registros.
- /historias (Histórias): memórias em forma de história; atalho pra criar avatar.
- /configuracoes (Configurações): acompanhamento da Ayla no WhatsApp (ligar/desligar, horário, frequência) e categorias de comunicação. Tem sub-telas:
  - /configuracoes/conta (Minha conta): mudar o nome e "como prefere ser chamada", mudar senha, exportar dados, excluir conta.
  - /configuracoes/familia (Mapa familiar): quem cuida junto (pai, avós, babá, professora, terapeuta).
  - /configuracoes/avatar (Avatar): criar/editar o avatar ilustrado de cada criança, em vários estilos.
  - /configuracoes/regras (Alertas e adaptações): alertas automáticos e adaptações sugeridas.
- /assinatura (Assinatura): ver/gerenciar o plano e o período de teste.`;

const SYSTEM = `Você é o guia de uso do app Kolo Família — ajuda a pessoa a achar onde fazer o que ela quer DENTRO do app (não é conselho sobre a criança; isso é o papel da Estratégias).

Regras:
- Responda em passos curtos e claros, em português simples e acolhedor.
- Use SOMENTE as telas reais do mapa abaixo. Nunca invente telas ou caminhos.
- Indique a tela principal pra ir e, se útil, o caminho (ex.: Configurações > Minha conta).
- Se a pessoa pedir algo que o app não faz, diga isso com gentileza e sugira o mais próximo.
- Devolva APENAS JSON, sem texto antes/depois:
{"resposta":"passos em markdown (use lista com - quando forem vários)","rota":"/uma-das-rotas-do-mapa-ou-null"}

${MAPA}`;

export type AjudaResult =
  | { ok: true; resposta: string; rota: string | null; rotaLabel: string | null }
  | { ok: false; error: string };

export async function perguntarAjuda(perguntaRaw: string): Promise<AjudaResult> {
  try {
    const pergunta = z
      .string()
      .trim()
      .min(2, "Escreva um pouquinho mais.")
      .max(500)
      .parse(perguntaRaw);

    let client;
    try {
      client = getAnthropicClient();
    } catch {
      return { ok: false, error: "A ajuda inteligente não está configurada no servidor." };
    }

    let raw = "";
    for (const model of [MODELS.leve, MODELS.principal]) {
      try {
        const stream = client.messages.stream({
          model,
          max_tokens: 500,
          system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: pergunta }],
        });
        const final = await stream.finalMessage();
        raw = final.content
          .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
          .map((b) => b.text)
          .join("");
        if (raw.trim()) break;
      } catch {
        raw = "";
      }
    }
    if (!raw.trim()) return { ok: false, error: "Não consegui responder agora. Tente de novo." };

    const parsed = parseAjuda(raw);
    if (!parsed) {
      return { ok: true, resposta: raw.trim(), rota: null, rotaLabel: null };
    }
    const valida = ROTAS_AJUDA.find((r) => r.rota === parsed.rota) ?? null;
    return {
      ok: true,
      resposta: parsed.resposta,
      rota: valida?.rota ?? null,
      rotaLabel: valida?.label ?? null,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

function parseAjuda(s: string): { resposta: string; rota: string | null } | null {
  const trimmed = s.trim();
  let candidate: unknown;
  try {
    candidate = JSON.parse(trimmed);
  } catch {
    const match =
      trimmed.match(/```json\s*([\s\S]*?)\s*```/i) ?? trimmed.match(/(\{[\s\S]*\})/);
    if (!match) return null;
    try {
      candidate = JSON.parse(match[1]);
    } catch {
      return null;
    }
  }
  if (candidate && typeof candidate === "object") {
    const o = candidate as { resposta?: unknown; rota?: unknown };
    if (typeof o.resposta === "string") {
      return { resposta: o.resposta, rota: typeof o.rota === "string" ? o.rota : null };
    }
  }
  return null;
}
