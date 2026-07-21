import type { SupabaseClient } from "@supabase/supabase-js";
import { getAylaAnthropicClient, AYLA_MODEL } from "./anthropic";
import { gerarMagicLink } from "./ponte";
import { idadeAnos } from "@/lib/idade";
import {
  SYSTEM_ROTINA,
  montarUserPromptRotina,
  parseProposta,
  DIAS_LABEL,
  type RotinaProposta,
} from "@/lib/ludico/rotina-ia-core";
import { rotinaParaPdf } from "@/lib/ludico/rotina-pdf";
import { enviarDocumento } from "./whatsappSender";

/**
 * Fluxo GUIADO de ROTINA (reativo): quando a pessoa pede uma rotina/planejamento
 * da semana, a Ayla manda um ESQUEMA simples ("Segunda:/Terça:/…"), a pessoa
 * preenche (mesmo solto), e a Ayla ORGANIZA na tabela da semana (cria as rotinas
 * de cada dia + tarefas) e manda o link. Estado pendente inferido do histórico
 * (tipo="rotina_pergunta"), espelhando o plano guiado e a oferta de fim de semana.
 */

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

/** Convite quando a pessoa pede rotina mas NÃO deu detalhe ainda. */
export function montarPerguntaRotina(): string {
  return `Boa, deixa comigo! 🌿 Me conta como são os dias dela — do jeito que você souber, pode ser tudo solto de uma vez (horário de acordar, escola, atividades da tarde/noite, o que se repete todo dia, hora de dormir). Eu organizo a semana pra você. Se ela muda por época (férias, aula…), me diz qual você quer primeiro.`;
}

/**
 * A mensagem já traz DETALHE suficiente pra montar (horários, dias, ou várias
 * atividades)? Se sim, a Ayla constrói na hora em vez de mandar o esquema.
 */
export function temDetalheRotina(texto: string | null | undefined): boolean {
  const t = (texto ?? "").toLowerCase();
  const temHora = /\b\d{1,2}\s*h\b|\b\d{1,2}\s*:\s*\d{2}\b/.test(t);
  const temDia = /(segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)/.test(t);
  const atividades = (
    t.match(
      /(acorda|escola|aula|almo[çc]|jantar|café|cafe|lanche|terapia|v[ôo]lei|esporte|treino|estudo|tarefa|skincare|celular|dormir|curso|teclado|culto|pomodoro|banho|remédio|remedio)/g,
    ) ?? []
  ).length;
  return temHora || temDia || atividades >= 2;
}

/** Cria/reusa uma rotina (por nome+dia), aplica o tema e grava as tarefas. */
async function aplicarRotina(
  supabase: SupabaseClient,
  familyId: string,
  membroAtipicoId: string,
  r: RotinaProposta,
  tema: string | null,
): Promise<void> {
  const nome = r.nome.trim() || "Rotina";
  let q = supabase
    .from("rotinas")
    .select("id")
    .eq("membro_atipico_id", membroAtipicoId)
    .eq("family_account_id", familyId)
    .eq("nome", nome);
  q = r.dia_semana === null ? q.is("dia_semana", null) : q.eq("dia_semana", r.dia_semana);
  const { data: existe } = await q.maybeSingle();
  let rotinaId = existe?.id as string | undefined;
  if (!rotinaId) {
    const { data: nova } = await supabase
      .from("rotinas")
      .insert({
        family_account_id: familyId,
        membro_atipico_id: membroAtipicoId,
        nome,
        dia_semana: r.dia_semana,
        tema: tema || null,
      })
      .select("id")
      .single();
    rotinaId = nova?.id as string | undefined;
  } else if (tema) {
    // tema mudou → cartões (temáticos) precisam ser regerados
    await supabase.from("rotinas").update({ tema, cards_status: "nenhum" }).eq("id", rotinaId);
  }
  if (!rotinaId) return;
  await supabase.from("rotina_tarefas").delete().eq("rotina_id", rotinaId);
  const rows = r.tarefas.slice(0, 25).map((t, i) => ({
    rotina_id: rotinaId,
    texto: t.texto.slice(0, 120),
    hora: t.hora ? t.hora.slice(0, 10) : null,
    icone: null,
    ordem: i,
  }));
  if (rows.length) await supabase.from("rotina_tarefas").insert(rows);
}

/** Gera o PDF da rotina, sobe no Storage e manda como documento. Silencioso. */
async function entregarPdfDaRotina(
  supabase: SupabaseClient,
  params: { familyId: string; phoneE164: string; nome: string; tema: string | null; rotinas: RotinaProposta[] },
): Promise<void> {
  try {
    const comDia = params.rotinas.filter((r) => r.dia_semana != null);
    const semDia = params.rotinas.filter((r) => r.dia_semana == null);
    const ordenadas = [
      ...comDia.sort((a, b) => (a.dia_semana ?? 0) - (b.dia_semana ?? 0)),
      ...semDia,
    ];
    const dias = ordenadas.map((r) => ({
      nome: r.nome || (r.dia_semana != null ? DIAS_LABEL[r.dia_semana] : "Rotina"),
      tarefas: r.tarefas,
    }));
    const semana = comDia.length > 0;
    const titulo = semana ? "Rotina da semana" : ordenadas[0]?.nome || "Rotina";
    const bytes = await rotinaParaPdf({ titulo, nome: params.nome, tema: params.tema, dias });

    const path = `${params.familyId}/rotina/${crypto.randomUUID()}.pdf`;
    const { error: upErr } = await supabase.storage
      .from("imagens")
      .upload(path, Buffer.from(bytes), { contentType: "application/pdf", upsert: false });
    if (upErr) throw upErr;
    const { data: signed } = await supabase.storage.from("imagens").createSignedUrl(path, 3600);
    if (!signed?.signedUrl) throw new Error("sem signed url");
    const fileName = `rotina-${params.nome}`.replace(/[^\w\sÀ-ÿ-]/g, "").slice(0, 40).trim() + ".pdf";
    await enviarDocumento({ phoneE164: params.phoneE164, url: signed.signedUrl, fileName });
  } catch (e) {
    console.warn("[ayla:rotina-guiada] falha no PDF:", e instanceof Error ? e.message : e);
  }
}

/**
 * Lê o relato da rotina (juntando os últimos balões da mãe), MONTA a semana com o
 * MESMO cérebro do app (rotina-ia-core) e cria as rotinas + tarefas. Devolve a
 * mensagem com o link da tabela da semana. Null se não deu.
 */
export async function processarRelatoRotina(
  supabase: SupabaseClient,
  params: { familyId: string; membroAtipicoId: string; contexto: string; phoneE164?: string | null },
): Promise<string | null> {
  try {
    if (!params.contexto.trim()) return null;

    const { data: membro } = await supabase
      .from("membros_atipicos")
      .select("family_account_id, nome, data_nascimento")
      .eq("id", params.membroAtipicoId)
      .maybeSingle();
    if (!membro) return null;
    const familyId = (membro.family_account_id as string) ?? params.familyId;
    const nome = (membro.nome as string) ?? "seu filho";
    const idade = idadeAnos((membro.data_nascimento as string | null) ?? null);

    // O brief costuma vir em vários balões — junta os inbounds recentes (20 min).
    const desde = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const { data: recentes } = await supabase
      .from("ayla_messages")
      .select("texto, created_at")
      .eq("family_account_id", familyId)
      .eq("direcao", "inbound")
      .gte("created_at", desde)
      .order("created_at", { ascending: true })
      .limit(10);
    const historico: Array<{ de: "mae"; texto: string }> = [];
    const vistos = new Set<string>();
    for (const m of recentes ?? []) {
      const t = ((m.texto as string) ?? "").trim();
      if (t && !vistos.has(t)) {
        vistos.add(t);
        historico.push({ de: "mae", texto: t });
      }
    }
    if (!vistos.has(params.contexto.trim())) historico.push({ de: "mae", texto: params.contexto.trim() });

    const client = getAylaAnthropicClient();
    const resp = await client.messages.create({
      model: AYLA_MODEL,
      max_tokens: 2200,
      system: SYSTEM_ROTINA,
      messages: [{ role: "user", content: montarUserPromptRotina({ nome, idade, historico }) }],
    });
    const b = resp.content[0];
    const raw = b?.type === "text" ? b.text : "";
    const { rotinas, tema } = parseProposta(raw);
    if (!rotinas.length) return null;

    for (const r of rotinas) await aplicarRotina(supabase, familyId, params.membroAtipicoId, r, tema);

    // PDF pra imprimir (barato, sem imagem) — vem pronto no WhatsApp.
    if (params.phoneE164) {
      await entregarPdfDaRotina(supabase, {
        familyId,
        phoneE164: params.phoneE164,
        nome,
        tema,
        rotinas,
      });
    }

    const link = await gerarMagicLink(supabase, { familyId, next: "/ludico/rotinas/semana" });
    const temaFrase = tema
      ? ` Já deixei no tema *${tema}* — quando abrir, é só tocar em "Gerar cartões".`
      : " Se quiser um tema pros cartões (ex.: futebol, princesas…), me fala que eu aplico.";
    const base = `Prontinho — organizei a rotina do(a) ${nome} pra você 🌿${temaFrase} Te mandei também um *PDF pra imprimir* e colar na parede (com quadradinhos pra marcar).`;
    if (!link) return base;
    return `${base}\n\nPra ver e ajustar no app (já entra direto):\n${link}`;
  } catch (e) {
    console.warn("[ayla:rotina-guiada] falha:", e instanceof Error ? e.message : e);
    return null;
  }
}
