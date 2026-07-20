import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicClient, MODELS } from "@/lib/ia/anthropic";
import { logarUsoApi } from "@/lib/billing/logar";

/**
 * CÉREBRO da rotina assistida por IA (compartilhado web + Ayla).
 *
 * A mãe conta como são os dias do jeito dela (solto, em vários balões). O modelo
 * ENTENDE e MONTA a semana — nomes livres, várias versões do mesmo dia, "quinta
 * é igual à segunda" replica, horário SEMPRE opcional (nunca inventa hora).
 * Devolve dados estruturados + uma fala curta e calorosa; a camada de cima
 * (chat na web ou Ayla no WhatsApp) decide como mostrar.
 */

export type TarefaProposta = { texto: string; hora: string | null };
export type RotinaProposta = { nome: string; dia_semana: number | null; tarefas: TarefaProposta[] };
export type PropostaRotina = {
  /** Fala curta da Kolo pra mostrar no chat. */
  resposta: string;
  /** Uma única pergunta, só se algo essencial faltar (senão null). */
  pergunta: string | null;
  /** A semana proposta (a mãe aprova/ajusta antes de virar rotina de verdade). */
  rotinas: RotinaProposta[];
};

export const DIAS_LABEL = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

function extrairJson(s: string): unknown {
  try {
    return JSON.parse(s.trim());
  } catch {
    const m = s.match(/```json\s*([\s\S]*?)\s*```/i) ?? s.match(/(\{[\s\S]*\})/);
    if (!m) return null;
    try {
      return JSON.parse(m[1]);
    } catch {
      return null;
    }
  }
}

function sanitizarRotinas(bruto: unknown): RotinaProposta[] {
  if (!Array.isArray(bruto)) return [];
  const out: RotinaProposta[] = [];
  for (const r of bruto) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const tarefasBrutas = Array.isArray(o.tarefas) ? o.tarefas : [];
    const tarefas: TarefaProposta[] = [];
    for (const t of tarefasBrutas.slice(0, 20)) {
      const to = (t ?? {}) as Record<string, unknown>;
      const texto = String(to.texto ?? "").trim().slice(0, 120);
      if (!texto) continue;
      const horaRaw = to.hora == null ? null : String(to.hora).trim().slice(0, 10);
      tarefas.push({ texto, hora: horaRaw || null });
    }
    if (!tarefas.length) continue;
    const diaRaw = o.dia_semana;
    const dia =
      typeof diaRaw === "number" && diaRaw >= 0 && diaRaw <= 6 ? diaRaw : null;
    const nome =
      (typeof o.nome === "string" && o.nome.trim().slice(0, 80)) ||
      (dia != null ? DIAS_LABEL[dia] : "Rotina");
    out.push({ nome, dia_semana: dia, tarefas });
  }
  return out.slice(0, 21);
}

const SYSTEM = `Você é a Kolo ajudando uma mãe/pai a montar a rotina do filho(a). A pessoa conta como são os dias do jeito dela — solto, às vezes em vários balões, às vezes sem horário. Seu trabalho é ENTENDER e MONTAR, não interrogar.

Devolva APENAS JSON, sem texto fora dele:
{"resposta":"fala curta e calorosa (1-2 frases) mostrando que entendeu e resumindo o que montou","pergunta":null,"rotinas":[{"nome":"Segunda","dia_semana":0,"tarefas":[{"texto":"acordar","hora":"6h"}]}]}

Regras:
- dia_semana: 0=Segunda,1=Terça,2=Quarta,3=Quinta,4=Sexta,5=Sábado,6=Domingo, ou null (rotina avulsa/sem dia fixo).
- NOME LIVRE: use um nome que faça sentido ("Segunda", "Segunda de aula", "Manhã", "Dia de terapia"). Se a pessoa distingue cenários (aula/férias), reflita no nome.
- VÁRIAS VERSÕES DO MESMO DIA são permitidas (ex.: "Segunda de aula" e "Segunda de férias" — duas rotinas com dia_semana=0).
- "X é igual a Y": copie as tarefas de Y para X.
- HORÁRIO É OPCIONAL: se a pessoa não deu hora, deixe "hora":null. NUNCA invente horário.
- Monte um dia COERENTE: encaixe âncoras fixas (escola, terapia, esporte, curso) no horário certo; blocos que se repetem todo dia (estudo, tarefas, autocuidado) entram nos dias aplicáveis; inclua manhã (acordar/higiene/refeição) e noite (jantar/autocuidado/dormir) quando fizer sentido. Ordene por horário quando houver.
- Tarefa curta e clara (1-5 palavras). Para adolescente, sem infantilizar.
- NÃO invente atividades que a pessoa não mencionou além do esqueleto natural do dia (acordar/refeições/dormir).
- Só use "pergunta" (uma, curtinha) se faltar algo REALMENTE essencial pra montar; caso contrário, monte com o que tem e deixe "pergunta":null.
- Se a pessoa PEDIR AJUSTE numa proposta anterior, devolva a semana inteira já ajustada (não só a mudança).`;

export async function interpretarRotina(
  supabase: SupabaseClient,
  params: {
    familyId: string | null;
    nome: string;
    idade: number | null;
    historico: Array<{ de: "mae" | "kolo"; texto: string }>;
    propostaAtual?: RotinaProposta[] | null;
  },
): Promise<PropostaRotina> {
  const client = getAnthropicClient();
  const idadeTxt = params.idade != null ? `${params.idade} anos` : "idade não informada";

  const blocos: string[] = [`CRIANÇA/ADOLESCENTE: ${params.nome} (${idadeTxt}).`];
  if (params.propostaAtual?.length) {
    blocos.push(
      `PROPOSTA ATUAL (ajuste conforme o novo pedido da mãe, devolvendo a semana inteira):\n${JSON.stringify({ rotinas: params.propostaAtual })}`,
    );
  }
  blocos.push(
    "CONVERSA (a última fala da mãe é o pedido atual):\n" +
      params.historico.map((h) => `${h.de === "mae" ? "Mãe" : "Kolo"}: ${h.texto}`).join("\n"),
  );

  const msg = await client.messages.create({
    model: MODELS.principal,
    max_tokens: 2200,
    system: SYSTEM,
    messages: [{ role: "user", content: blocos.join("\n\n") }],
  });

  try {
    await logarUsoApi(supabase, {
      family_account_id: params.familyId,
      feature: "ludico_rotina_ia",
      provider: "anthropic",
      model: MODELS.principal,
      input_tokens: msg.usage?.input_tokens ?? 0,
      output_tokens: msg.usage?.output_tokens ?? 0,
    });
  } catch {
    /* logging é best-effort */
  }

  const bloco = msg.content[0];
  const raw = bloco?.type === "text" ? bloco.text : "";
  const parsed = extrairJson(raw) as Record<string, unknown> | null;
  const rotinas = sanitizarRotinas(parsed?.rotinas);
  const resposta =
    (typeof parsed?.resposta === "string" && parsed.resposta.trim()) ||
    (rotinas.length ? "Montei uma primeira versão — dá uma olhada e me diz se ajusto algo." : "Me conta um pouco mais como são os dias que eu monto pra você.");
  const pergunta =
    typeof parsed?.pergunta === "string" && parsed.pergunta.trim() ? parsed.pergunta.trim() : null;

  return { resposta, pergunta, rotinas };
}
