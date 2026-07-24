import type { SupabaseClient } from "@supabase/supabase-js";
import { getAylaAnthropicClient, AYLA_MODEL } from "./anthropic";

/**
 * Linha do tempo (Livro Vivo): a Ayla detecta EVENTOS importantes na conversa
 * (troca de professora, mudança de escola, medicação, início de terapia, perda…)
 * e registra em `eventos_membro`. Roda em `after()` (não trava a resposta) e só
 * quando o texto tem um gatilho — pra não gastar IA em toda mensagem.
 */

const TIPOS = [
  "troca_professora",
  "mudanca_escola",
  "mudanca_turma",
  "medicacao",
  "inicio_terapia",
  "ferias",
  "perda_familiar",
  "separacao",
  "mudanca_rotina",
  "marco",
  "regressao",
  "outro",
] as const;

// Pré-filtro barato: só chama a IA se a mensagem PARECE ter um evento.
const GATILHOS =
  /professora? nov|troc\w+ de professor|mud\w+ de (escola|turma|casa|cidade)|nova escola|come[çc]\w+ (a fazer |na )?(terapia|fono|psic|acompanhamento)|novo rem[eé]dio|come[çc]\w+ (a tomar|com|o) (rem[eé]dio|medica)|mudan[çc]a de (rem[eé]dio|medica|dose)|f[eé]rias|faleceu|perdemos|luto|separ|div[oó]rcio|mudan[çc]a de rotina|passou a andar|come[çc]ou a falar|voltou a|deixou de|parou de/i;

// MARCOS de desenvolvimento (progresso de habilidade) — respostas curtas tipo
// "letra f" só viram marco com o contexto da conversa, por isso passamos ela.
const GATILHOS_MARCO =
  /\bletra [a-zç]\b|vocabul|palavra(s)? nov|aprendeu|conseguiu|progred|evolui|avan[çc]|passou a |come[çc]ou a |j[aá] (consegue|faz|fala|anda|l[eê]|est[aá] na letra)/i;

const SYSTEM = `Você extrai EVENTOS IMPORTANTES da vida de uma criança/pessoa a partir da conversa da família, pra uma linha do tempo. Devolva SÓ um array JSON (sem texto fora), no máximo 2 itens, cada um:
{"tipo":"<um de: ${TIPOS.join(" | ")}>","descricao":"o evento em 1 frase curta, factual","data":"YYYY-MM-DD ou null se não disse"}
- Só eventos REAIS e datáveis (uma mudança/marco/perda/início). NÃO extraia sentimentos, dúvidas, rotina do dia, nem hipóteses.
- Inclua MARCOS de desenvolvimento (tipo "marco"): quando a criança AVANÇA numa habilidade — fala/vocabulário/letras, leitura, autonomia, motor, social. Ex.: "progrediu da letra B pra F", "passou a formar frases", "começou a aceitar fruta". Use a <conversa_recente> pra entender respostas curtas ("letra f" depois de falar de vocabulário = marco de comunicação). Factual, sem elogio.
- Se não houver nenhum evento assim, devolva [].
- descricao factual, sem interpretar causa.`;

type EventoExtraido = { tipo: string; descricao: string; data: string | null };

function parse(raw: string): EventoExtraido[] {
  try {
    const m = raw.match(/\[[\s\S]*\]/);
    if (!m) return [];
    const arr = JSON.parse(m[0]) as unknown[];
    return arr
      .map((x) => {
        const o = (x ?? {}) as Record<string, unknown>;
        const tipo = String(o.tipo ?? "").trim();
        const descricao = String(o.descricao ?? "").trim();
        if (!descricao) return null;
        return {
          tipo: (TIPOS as readonly string[]).includes(tipo) ? tipo : "outro",
          descricao: descricao.slice(0, 200),
          data: typeof o.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.data) ? o.data : null,
        } as EventoExtraido;
      })
      .filter((e): e is EventoExtraido => e != null)
      .slice(0, 2);
  } catch {
    return [];
  }
}

export async function extrairESalvarEventos(
  supabase: SupabaseClient,
  familyId: string,
  membroId: string | null,
  texto: string,
  historico?: Array<{ de: "mae" | "ayla"; texto: string }>,
): Promise<void> {
  if (!membroId || !texto?.trim() || !(GATILHOS.test(texto) || GATILHOS_MARCO.test(texto))) return;
  try {
    const client = getAylaAnthropicClient();
    const contexto = (historico ?? [])
      .filter((h) => h.texto?.trim())
      .map((h) => `${h.de === "mae" ? "Mãe" : "Ayla"}: ${h.texto.slice(0, 300)}`)
      .join("\n");
    const userContent = `${
      contexto ? `<conversa_recente>\n${contexto}\n</conversa_recente>\n\n` : ""
    }<mensagem_de_agora>\n${texto.slice(0, 1000)}\n</mensagem_de_agora>`;
    const resp = await client.messages.create({
      model: AYLA_MODEL,
      max_tokens: 300,
      system: SYSTEM,
      messages: [{ role: "user", content: userContent }],
    });
    const b = resp.content[0];
    const eventos = parse(b?.type === "text" ? b.text : "");
    if (!eventos.length) return;

    const hoje = new Date().toISOString().slice(0, 10);
    const desde = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    for (const ev of eventos) {
      // Dedup: mesmo tipo registrado nos últimos 14 dias → não repete.
      const { data: dup } = await supabase
        .from("eventos_membro")
        .select("id")
        .eq("membro_atipico_id", membroId)
        .eq("tipo", ev.tipo)
        .gte("created_at", desde)
        .limit(1);
      if (dup?.length) continue;
      await supabase.from("eventos_membro").insert({
        family_account_id: familyId,
        membro_atipico_id: membroId,
        data: ev.data ?? hoje,
        tipo: ev.tipo,
        descricao: ev.descricao,
        fonte: "ayla",
      });
    }
  } catch (e) {
    console.warn("[ayla:eventos] extração falhou:", e instanceof Error ? e.message : e);
  }
}
