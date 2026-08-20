"use server";

import { z } from "zod";
import { getAnthropicClient, MODELS } from "@/lib/ia/anthropic";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/log";
import { notificarFeedback } from "@/lib/admin/notificacoes";
import { TRIAL_DIAS } from "@/lib/billing/fatos-comerciais";
import { formatarBRL, lerPlanosParaExibir } from "@/lib/billing/planos";

/**
 * Guia de uso do app — a pessoa diz o que quer fazer e a IA responde em
 * passos curtos, indicando a tela certa. Ancorado num mapa REAL do app
 * (a IA só pode sugerir rotas desta lista; qualquer outra é descartada).
 */
// NÃO exportar: arquivo "use server" só pode exportar funções async (Next 16).
// Usado só aqui dentro (validação da rota sugerida pela IA).
const ROTAS_AJUDA: { rota: string; label: string }[] = [
  { rota: "/painel", label: "Início" },
  { rota: "/kolo-vivo", label: "Perfil" },
  { rota: "/estrategias", label: "Estratégias" },
  { rota: "/planos", label: "Meus Planos" },
  { rota: "/evolucao", label: "Evolução" },
  { rota: "/ludico", label: "Lúdico" },
  { rota: "/registrar/diario", label: "Registrar o dia" },
  { rota: "/configuracoes", label: "Configurações" },
  { rota: "/configuracoes/conta", label: "Minha conta" },
  { rota: "/configuracoes/familia", label: "Mapa familiar" },
  { rota: "/configuracoes/avatar", label: "Avatar" },
  { rota: "/configuracoes/regras", label: "Alertas e adaptações" },
  { rota: "/assinatura", label: "Assinatura" },
];

const MAPA = `# Mapa do app Kolo Família (telas reais e o que se faz em cada uma)

- /painel (Início / Home): visão da semana — saudação, "tira de sinais" (estado do Perfil, ritmo da semana, última conversa), "foco da semana", pequenas conquistas e o "Registro do dia" inline.
- /kolo-vivo (Perfil): o retrato vivo de cada criança e da família. Editar as seções (o essencial, o jeito, sensorial, comunicação, alimentação, sono, regulação, etc.; e da família: composição, rotina, recursos). Com 2+ crianças, há um seletor no topo pra trocar de filho. Sugestões novas aparecem num aviso pra aprovar/descartar.
- /estrategias (Estratégias): conversar com a Kolo sobre algo que aconteceu (escreve no campo e aperta "Conversar"). Abaixo da resposta há botões de "mais ajuda" (brincadeiras, atividades, frases prontas, etc.) e a opção de montar um PLANO completo. Lista conversas anteriores.
- /planos (Meus Planos): os planos completos que a Kolo montou nas Estratégias ficam guardados aqui (só aparece no menu quando há ao menos um plano).
- /registrar/diario (Registrar o dia / Registro Diário): check-in (como você está e como a criança está) + conquista, desafio, observação e contexto (quem estava, como reagiu). A IA organiza e guarda na Evolução.
- /evolucao (Evolução): como a criança está ao longo do tempo, por tema, e o que ajudou. No fim, dá pra gerar um RELATÓRIO pra escola ou terapeuta (a IA escreve, você edita e baixa em PDF).
- /ludico (Lúdico): engloba Histórias ilustradas, Rotinas visuais (cards), "O que o desenho conta" (leitura de desenho), Meditação guiada, Timer lúdico e o Avatar da criança.
- /configuracoes (Configurações): acompanhamento da Ayla no WhatsApp (ligar/desligar, horário, frequência) e categorias de comunicação. Sub-telas:
  - /configuracoes/conta (Minha conta): mudar o nome e "como prefere ser chamada", trocar senha, EXPORTAR seus dados, e EXCLUIR a conta.
  - /configuracoes/familia (Mapa familiar): quem cuida junto (pai, avós, babá, professora, terapeuta).
  - /configuracoes/avatar (Avatar): criar/editar o avatar ilustrado de cada criança, em vários estilos.
  - /configuracoes/regras (Alertas e adaptações): alertas automáticos e adaptações sugeridas.
- /assinatura (Assinatura): ver o plano e o período de teste, assinar (mensal ou anual), gerenciar pagamento/cartão e CANCELAR.

Para SAIR DA CONTA (logout): use "Sair da conta" no rodapé do menu lateral (à esquerda), que pede confirmação.`;

const SYSTEM_BASE = `Você é o guia de uso do app Kolo Família — ajuda a pessoa a achar onde fazer o que ela quer DENTRO do app (não é conselho sobre a criança; isso é o papel das Estratégias). Você também RECEBE feedback (elogio, sugestão, reclamação) direto por aqui.

Regras:
- Responda em passos curtos e claros, em português simples e acolhedor.
- Use SOMENTE as telas reais do mapa abaixo. Nunca invente telas ou caminhos.
- Indique a tela principal pra ir e, se útil, o caminho (ex.: Configurações > Minha conta).
- PODE informar o valor do plano, o período de teste e como cancelar — use os "Fatos atuais" abaixo e NUNCA invente valores.
- Se a pessoa pedir algo que o app não faz, diga isso com gentileza e sugira o mais próximo.

# Classifique a mensagem (campo "tipo")
- "duvida": pergunta de USO ("como faço X?", "onde fica Y?"). Responda guiando pela tela certa.
- "elogio": a pessoa elogia a Kolo/equipe. AGRADEÇA de verdade e diga que vai passar pra equipe. Ela JÁ está falando com a Kolo aqui.
- "sugestao": a pessoa sugere uma melhoria/ideia. ACOLHA, diga que registrou e vai levar pra equipe avaliar.
- "reclamacao": a pessoa reclama de algo que não gostou/não funcionou. ACOLHA com empatia, diga que registrou e que a equipe vai olhar.
- Para elogio/sugestao/reclamacao, "rota" deve ser null.

# NUNCA (isto está errado hoje)
- NUNCA mande procurar formulário de contato, e-mail de suporte, site externo, "kolo.com.br", App Store ou Google Play. A Kolo é um app web (PWA) e o feedback é registrado AQUI MESMO. A pessoa já está no lugar certo — é só receber.

- Devolva APENAS JSON, sem texto antes/depois:
{"resposta":"resposta em markdown (passos com - quando forem vários; pra feedback, um agradecimento/acolhida curto)","rota":"/uma-das-rotas-do-mapa-ou-null","tipo":"duvida|elogio|sugestao|reclamacao"}`;



/** System prompt com fatos AO VIVO (preço vem da tabela; não fica velho). */
function montarSystem(precos: { mensal: string | null; anual: string | null }): string {
  const fatos = `# Fatos atuais (use estes valores; NÃO invente)
- Plano mensal: ${precos.mensal ?? "ver na tela de Assinatura"}.
- Plano anual: ${precos.anual ?? "ver na tela de Assinatura"}.
- Teste grátis: ${TRIAL_DIAS} dias, sem precisar de cartão.
- Cancelar: na tela de Assinatura há "Cancelar assinatura". IMPORTANTE — cancelar APAGA a conta e TODOS os registros (diários, Perfil, histórias, evolução), pra sempre e sem volta. Quem só quer dar uma pausa ou trocar o cartão deve usar "Gerenciar assinatura", não cancelar.`;
  return `${SYSTEM_BASE}\n\n${fatos}\n\n${MAPA}`;
}

/** Lê os preços vigentes pelo leitor único (lib/billing/planos.ts). Graceful. */
async function lerPrecos(): Promise<{ mensal: string | null; anual: string | null }> {
  try {
    const planos = await lerPlanosParaExibir(createServiceRoleClient());
    return {
      mensal: formatarBRL(planos.mensal.centavos),
      anual: formatarBRL(planos.anual.centavos),
    };
  } catch {
    return { mensal: null, anual: null };
  }
}

export type AjudaResult =
  | { ok: true; resposta: string; rota: string | null; rotaLabel: string | null }
  | { ok: false; error: string };

const chatSchema = z
  .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().max(2000) }))
  .min(1)
  .max(24);

export async function perguntarAjuda(
  mensagensRaw: z.infer<typeof chatSchema>,
): Promise<AjudaResult> {
  try {
    const mensagens = chatSchema.parse(mensagensRaw);
    const ultima = mensagens[mensagens.length - 1];
    if (ultima.role !== "user" || ultima.content.trim().length < 2) {
      return { ok: false, error: "Escreva um pouquinho mais." };
    }

    let client;
    try {
      client = getAnthropicClient();
    } catch {
      return { ok: false, error: "A ajuda inteligente não está configurada no servidor." };
    }

    const system = montarSystem(await lerPrecos());

    let raw = "";
    for (const model of [MODELS.leve, MODELS.principal]) {
      try {
        const stream = client.messages.stream({
          model,
          max_tokens: 500,
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
          messages: mensagens.map((m) => ({ role: m.role, content: m.content })),
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

    // Feedback (elogio/sugestão/reclamação): registra e avisa a Karina. Não é
    // "dúvida de uso" — aqui a pessoa está falando COM a Kolo.
    if (parsed.tipo === "elogio" || parsed.tipo === "sugestao" || parsed.tipo === "reclamacao") {
      await registrarFeedback(ultima.content, parsed.tipo).catch((e) =>
        logServerError("ajuda_feedback", e, {}).catch(() => {}),
      );
      return { ok: true, resposta: parsed.resposta, rota: null, rotaLabel: null };
    }

    const valida = ROTAS_AJUDA.find((r) => r.rota === parsed.rota) ?? null;
    return {
      ok: true,
      resposta: parsed.resposta,
      rota: valida?.rota ?? null,
      rotaLabel: valida?.label ?? null,
    };
  } catch (e) {
    await logServerError("ajuda_perguntar", e, {}).catch(() => {});
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

function parseAjuda(
  s: string,
): { resposta: string; rota: string | null; tipo: string | null } | null {
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
    const o = candidate as { resposta?: unknown; rota?: unknown; tipo?: unknown };
    if (typeof o.resposta === "string") {
      return {
        resposta: o.resposta,
        rota: typeof o.rota === "string" ? o.rota : null,
        tipo: typeof o.tipo === "string" ? o.tipo : null,
      };
    }
  }
  return null;
}

/** Registra o feedback (via /ajuda) e avisa a Karina no celular. Best-effort. */
async function registrarFeedback(
  texto: string,
  tipo: "elogio" | "sugestao" | "reclamacao",
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createServiceRoleClient();
  let familyId: string | null = null;
  let nome = user?.email ?? "alguém";
  if (user) {
    const { data: fam } = await admin
      .from("family_accounts")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    familyId = (fam?.id as string | undefined) ?? null;
    if (familyId) {
      const { data: prof } = await admin
        .from("family_profiles")
        .select("nome_mae, como_chamar")
        .eq("family_account_id", familyId)
        .maybeSingle();
      nome =
        (prof?.como_chamar as string | null)?.trim() ||
        (prof?.nome_mae as string | null)?.trim() ||
        user.email ||
        "alguém";
    }
  }

  await admin.from("feedbacks").insert({
    family_account_id: familyId,
    user_id: user?.id ?? null,
    origem: "ajuda",
    tipo,
    texto: texto.slice(0, 2000),
  });

  await notificarFeedback(tipo, texto, nome, "ajuda");
}
