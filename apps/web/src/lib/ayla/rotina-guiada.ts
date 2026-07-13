import type { SupabaseClient } from "@supabase/supabase-js";
import { getAylaAnthropicClient, AYLA_MODEL } from "./anthropic";
import { gerarMagicLink } from "./ponte";

/**
 * Fluxo GUIADO de ROTINA (reativo): quando a pessoa pede uma rotina/planejamento
 * da semana, a Ayla manda um ESQUEMA simples ("Segunda:/Terça:/…"), a pessoa
 * preenche (mesmo solto), e a Ayla ORGANIZA na tabela da semana (cria as rotinas
 * de cada dia + tarefas) e manda o link. Estado pendente inferido do histórico
 * (tipo="rotina_pergunta"), espelhando o plano guiado e a oferta de fim de semana.
 */

const DIAS_LABEL = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

/** Pedido explícito de rotina/planejamento da semana? */
export function pedeRotina(texto: string | null | undefined): boolean {
  const t = (texto ?? "").toLowerCase();
  if (!/\brotina\b|planejamento da semana|quadro (de|da) rotina|cronograma|rotina visual|organizar a semana/.test(t))
    return false;
  return /\b(quero|queria|preciso|gostaria|pode|monta|montar|monte|faz|fazer|cria|criar|ajuda|planejar|organiza|organizar|preparar|prepara)\b/.test(
    t,
  );
}

export async function rotinaGuiadaPendente(
  supabase: SupabaseClient,
  familyId: string,
  agora: Date,
): Promise<{ membroId: string | null } | null> {
  const limite = new Date(agora.getTime() - 48 * 60 * 60 * 1000);
  const { data: perguntas } = await supabase
    .from("ayla_messages")
    .select("created_at, membro_atipico_id")
    .eq("family_account_id", familyId)
    .eq("tipo", "rotina_pergunta")
    .eq("direcao", "outbound")
    .gte("created_at", limite.toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  const p = perguntas?.[0];
  if (!p) return null;

  const { data: respostas } = await supabase
    .from("ayla_messages")
    .select("id")
    .eq("family_account_id", familyId)
    .eq("direcao", "inbound")
    .gt("created_at", p.created_at as string)
    .limit(1);
  if ((respostas?.length ?? 0) > 0) return null;

  return { membroId: (p.membro_atipico_id as string | null) ?? null };
}

/** O esquema que a Ayla manda pra a pessoa preencher. */
export function montarPerguntaRotina(): string {
  return `Boa! Vou montar a rotina visual da semana com você 🌿 Me conta a rotina de cada dia — pode ser solto, só a ordem das coisas. Se tiver horário, ótimo; se não, tudo bem. Preencha os dias que fizerem sentido:

Segunda:
Terça:
Quarta:
Quinta:
Sexta:
Sábado:
Domingo:`;
}

type DiaParse = { dia: number; tarefas: { texto: string; hora: string | null }[] };

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

/**
 * Lê o relato da rotina, ORGANIZA em dias (IA) e cria as rotinas de dia + tarefas.
 * Devolve a mensagem com o link da tabela da semana. Null se não deu.
 */
export async function processarRelatoRotina(
  supabase: SupabaseClient,
  params: { familyId: string; membroAtipicoId: string; contexto: string },
): Promise<string | null> {
  try {
    const relato = params.contexto.trim();
    if (!relato) return null;

    const client = getAylaAnthropicClient();
    const resp = await client.messages.create({
      model: AYLA_MODEL,
      max_tokens: 700,
      system: `Você organiza a rotina que a mãe descreveu em JSON por dia da semana. Devolva APENAS JSON, sem texto antes/depois: {"dias":[{"dia":0,"tarefas":[{"texto":"acordar","hora":"7h"}]}]}. dia: 0=Segunda,1=Terça,2=Quarta,3=Quinta,4=Sexta,5=Sábado,6=Domingo. Só inclua os dias que ela mencionou. "hora" é opcional (null se ela não disse). Mantenha a ORDEM das tarefas. Texto curto (1-4 palavras por tarefa). Se ela disse "igual à segunda" etc., repita as tarefas do dia citado.`,
      messages: [{ role: "user", content: relato }],
    });
    const b = resp.content[0];
    const raw = b?.type === "text" ? b.text : "";
    const parsed = extrairJson(raw) as { dias?: DiaParse[] } | null;
    const dias = (parsed?.dias ?? []).filter(
      (d) => typeof d.dia === "number" && d.dia >= 0 && d.dia <= 6 && Array.isArray(d.tarefas) && d.tarefas.length > 0,
    );
    if (!dias.length) return null;

    // family_account_id da rotina (pra gravar consistente)
    const { data: membro } = await supabase
      .from("membros_atipicos")
      .select("family_account_id")
      .eq("id", params.membroAtipicoId)
      .maybeSingle();
    const familyId = (membro?.family_account_id as string) ?? params.familyId;

    for (const d of dias) {
      // rotina do dia (cria ou reusa)
      const { data: existe } = await supabase
        .from("rotinas")
        .select("id")
        .eq("membro_atipico_id", params.membroAtipicoId)
        .eq("dia_semana", d.dia)
        .maybeSingle();
      let rotinaId = existe?.id as string | undefined;
      if (!rotinaId) {
        const { data: nova } = await supabase
          .from("rotinas")
          .insert({
            family_account_id: familyId,
            membro_atipico_id: params.membroAtipicoId,
            nome: DIAS_LABEL[d.dia],
            dia_semana: d.dia,
          })
          .select("id")
          .single();
        rotinaId = nova?.id as string | undefined;
      }
      if (!rotinaId) continue;

      // substitui as tarefas do dia
      await supabase.from("rotina_tarefas").delete().eq("rotina_id", rotinaId);
      const rows = d.tarefas.slice(0, 20).map((t, i) => ({
        rotina_id: rotinaId,
        texto: String(t.texto ?? "").slice(0, 120),
        hora: t.hora ? String(t.hora).slice(0, 10) : null,
        icone: null,
        ordem: i,
      }));
      if (rows.length) await supabase.from("rotina_tarefas").insert(rows);
    }

    const link = await gerarMagicLink(supabase, { familyId, next: "/ludico/rotinas/semana" });
    const base = `Prontinho — organizei a semana na tabela pra você 🌿 Dá pra ajustar a ordem, os horários e escolher o tema; depois é só gerar os cartões de cada dia.`;
    if (!link) return base;
    return `${base}\nAbre aqui (já entra direto):\n${link}`;
  } catch (e) {
    console.warn("[ayla:rotina-guiada] falha:", e instanceof Error ? e.message : e);
    return null;
  }
}
