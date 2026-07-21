import type { SupabaseClient } from "@supabase/supabase-js";
import { getAylaAnthropicClient, AYLA_MODEL } from "./anthropic";
import { gerarMagicLink } from "./ponte";
import { idadeAnos } from "@/lib/idade";
import {
  DIAS_LABEL,
  extrairJsonRotina,
  sanitizarRotinas,
  type RotinaProposta,
  type TarefaProposta,
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

/** Há uma conversa de rotina em andamento? (último outbound tipo=rotina_conversa sem resposta ainda) */
export async function rotinaConversaPendente(
  supabase: SupabaseClient,
  familyId: string,
  agora: Date,
): Promise<{ membroId: string | null } | null> {
  const limite = new Date(agora.getTime() - 48 * 60 * 60 * 1000);
  const { data: perguntas } = await supabase
    .from("ayla_messages")
    .select("created_at, membro_atipico_id")
    .eq("family_account_id", familyId)
    .eq("tipo", "rotina_conversa")
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

/** Interesses conhecidos da criança (pra a Ayla PROPOR um tema). Best-effort. */
async function carregarInteresses(supabase: SupabaseClient, membroId: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("perfil_vivo_membro")
      .select("categorias_extras")
      .eq("membro_atipico_id", membroId)
      .maybeSingle();
    const ce = (data?.categorias_extras ?? {}) as Record<string, unknown>;
    const cand =
      (ce?.como_e as Record<string, unknown> | undefined)?.interesses ??
      (ce?.preferencias as Record<string, unknown> | undefined)?.temas ??
      null;
    const parts: string[] = [];
    if (Array.isArray(cand)) parts.push(...cand.map((x) => String(x)));
    else if (typeof cand === "string") parts.push(cand);
    return parts.length ? parts.slice(0, 8).join(", ") : null;
  } catch {
    return null;
  }
}

type Transicao = { momento: string; estrategia: string | null; funcionou?: boolean | null; atualizado_em?: string };

/** Transições difíceis já aprendidas (do Kolo Vivo) — pra a Ayla já chegar sabendo. */
async function carregarTransicoes(supabase: SupabaseClient, membroId: string): Promise<Transicao[]> {
  try {
    const { data } = await supabase
      .from("perfil_vivo_membro")
      .select("categorias_extras")
      .eq("membro_atipico_id", membroId)
      .maybeSingle();
    const ce = (data?.categorias_extras ?? {}) as Record<string, unknown>;
    const arr = Array.isArray(ce.transicoes) ? (ce.transicoes as unknown[]) : [];
    return arr
      .map((t) => {
        const o = (t ?? {}) as Record<string, unknown>;
        const momento = String(o.momento ?? "").trim();
        if (!momento) return null;
        return {
          momento: momento.slice(0, 60),
          estrategia: o.estrategia ? String(o.estrategia).slice(0, 120) : null,
          funcionou: typeof o.funcionou === "boolean" ? o.funcionou : null,
        } as Transicao;
      })
      .filter((t): t is Transicao => t != null)
      .slice(0, 12);
  } catch {
    return [];
  }
}

/** Mescla novas transições no Kolo Vivo (por momento) — auto-incorporação. */
async function salvarTransicoes(
  supabase: SupabaseClient,
  membroId: string,
  novas: Transicao[],
): Promise<void> {
  try {
    if (!novas.length) return;
    const { data } = await supabase
      .from("perfil_vivo_membro")
      .select("categorias_extras")
      .eq("membro_atipico_id", membroId)
      .maybeSingle();
    const ce = (data?.categorias_extras ?? {}) as Record<string, unknown>;
    const atuais = Array.isArray(ce.transicoes) ? (ce.transicoes as Transicao[]) : [];
    const porMomento = new Map<string, Transicao>();
    for (const t of atuais) if (t?.momento) porMomento.set(t.momento.toLowerCase(), t);
    for (const n of novas) {
      if (!n.momento) continue;
      const key = n.momento.toLowerCase();
      const antigo = porMomento.get(key);
      porMomento.set(key, {
        momento: n.momento.slice(0, 60),
        estrategia: (n.estrategia ?? antigo?.estrategia ?? null)?.slice(0, 120) ?? null,
        funcionou: n.funcionou ?? antigo?.funcionou ?? null,
      });
    }
    const merged = Array.from(porMomento.values()).slice(0, 20);
    // Só atualiza linha existente (evita insert sem family_account_id). Sem linha,
    // o Kolo Vivo é criado por outros fluxos; a transição entra na próxima.
    if (data) {
      await supabase
        .from("perfil_vivo_membro")
        .update({ categorias_extras: { ...ce, transicoes: merged } })
        .eq("membro_atipico_id", membroId);
    }
  } catch (e) {
    console.warn("[ayla:rotina-guiada] salvar transições falhou:", e instanceof Error ? e.message : e);
  }
}

const SYSTEM_CONDUZIR = `Você é a Ayla conduzindo, no WhatsApp, a montagem de uma ROTINA VISUAL com uma mãe/pai. Conduza de forma NATURAL e ESTRATÉGICA — a pessoa deve escrever o MÍNIMO possível.

Devolva SEMPRE APENAS JSON, sem texto fora dele:
{"mensagem":"sua próxima fala (WhatsApp, curta e calorosa)","pronto":false,"tema":null,"transicoes":[],"rotinas":[]}

Conduza nesta ordem, mas com naturalidade — PULE o que já estiver claro na conversa:
1. ESCOPO: se ainda não sabe, pergunte se é pra um DIA ESPECÍFICO (ex.: "dia com a vovó", "dia do dentista") ou a ROTINA DA SEMANA. Lembre que pode responder por ÁUDIO. (pronto:false)
2. SEQUÊNCIA: peça como é o dia, na ordem. Se já mandaram uma lista, use-a. Para um dia específico, dê o NOME que a pessoa usou ("Dia com a vovó") — NUNCA "Segunda", a menos que seja mesmo um dia da semana. Para a semana, vá UM DIA POR VEZ ("bora pela segunda… a terça é parecida?").
3. TRANSIÇÕES (o pulo do gato — o valor Kolo): se vierem TRANSIÇÕES JÁ CONHECIDAS no contexto, USE-AS proativamente ("o banho costuma pesar pro X — coloquei a música depois de novo, ou quer tentar outra coisa?") em vez de re-perguntar. Se não houver, identifique 1-2 passagens que costumam pesar (banho, SAIR de um lugar gostoso tipo zoológico/parque, dormir, ir pra escola) e pergunte se são tranquilas. Se pesam, ofereça encaixar uma atividade que ele GOSTA logo antes/depois. A MÃE é a especialista — pergunte "o que costuma acalmar/motivar ele nessa hora?". No MÁXIMO 1-2 perguntas — não interrogue.
3b. APRENDER: sempre que descobrir (ou reconfirmar) um momento difícil e a estratégia combinada, coloque em "transicoes":[{"momento":"banho","estrategia":"música depois","funcionou":null}]. Se a mãe disser que uma estratégia FUNCIONOU ou NÃO, marque "funcionou":true/false — e, se não funcionou, proponha/pergunte OUTRA e ofereça "quer testar algo diferente?". Isso fica guardado no perfil e você reusa nas próximas.
4. TEMA: proponha um tema PROATIVAMENTE a partir dos INTERESSES conhecidos (ex.: "quer no tema de dinossauros, que ele ama?"). Se não souber, sugira 1-2 opções (carros, princesas…) ou deixar sem. Opcional.
5. ANTES DE MONTAR — CONFIRME (evita erro e frustração): quando já tiver sequência + transições + tema, MOSTRE a rotina final resumida (a ordem, com horário quando houver) e pergunte "ficou assim, posso montar? 🌿". Nesse momento pronto:false ainda — você está só confirmando.
6. SÓ ponha pronto:true DEPOIS que a pessoa CONFIRMAR (sim/pode/isso/perfeito/manda/tá bom). Se ela apontar um erro ou pedir mudança, ajuste e confirme de novo. Quando pronto:true, a "mensagem" é uma confirmação CURTA (ex.: "Prontinho, montei o Dia do Circo! 🎪"). NÃO prometa "vou gerar os cartões", nem diga que vai mandar link/PDF — o sistema completa a mensagem com o PDF e o link automaticamente.

Formato de rotinas: [{"nome":"Dia com a vovó","dia_semana":null,"tarefas":[{"texto":"acordar","hora":null}]}]. dia_semana: 0=Seg..6=Dom, ou null pra dia avulso/nomeado. HORÁRIO SEMPRE OPCIONAL (null se não deram; NUNCA invente).

Tom: quente, curto, humano — NUNCA formulário. UMA pergunta por vez. CONVIRJA: se a pessoa já deu a sequência, faça no máximo 1 pergunta de transição + o tema e então monte (pronto:true). Sempre que pedir algo mais longo, lembre que pode mandar ÁUDIO.`;

/** Cria/reusa uma rotina (por nome+dia), aplica o tema e grava as tarefas. */
async function aplicarRotina(
  supabase: SupabaseClient,
  familyId: string,
  membroAtipicoId: string,
  r: RotinaProposta,
  tema: string | null,
): Promise<string | undefined> {
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
  if (!rotinaId) return undefined;
  await supabase.from("rotina_tarefas").delete().eq("rotina_id", rotinaId);
  const rows = r.tarefas.slice(0, 25).map((t, i) => ({
    rotina_id: rotinaId,
    texto: t.texto.slice(0, 120),
    hora: t.hora ? t.hora.slice(0, 10) : null,
    icone: null,
    ordem: i,
  }));
  if (rows.length) await supabase.from("rotina_tarefas").insert(rows);
  return rotinaId;
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

/** Dispara a geração dos cartões (endpoint interno) — a Ayla não gera direto
 * (mundo separado de /lib/ia). Best-effort; roda em segundo plano no app. */
async function dispararGeracao(rotinaId: string, tema: string): Promise<void> {
  try {
    const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
    const secret = process.env.AYLA_WEBHOOK_SECRET;
    await fetch(`${base}/api/ludico/gerar-rotina`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(secret ? { "x-ayla-secret": secret } : {}) },
      body: JSON.stringify({ rotinaId, tema }),
    });
  } catch (e) {
    console.warn("[ayla:rotina-guiada] disparar geração falhou:", e instanceof Error ? e.message : e);
  }
}

/**
 * CONDUZ a conversa de rotina (natural, estratégica, um passo por vez). A IA
 * decide a próxima fala e, quando tem o suficiente, MONTA — aí a gente cria as
 * rotinas + aplica o tema + manda o PDF, e devolve a mensagem final com o link.
 * Enquanto não está pronto, devolve só a próxima pergunta (pronto=false).
 */
export async function conduzirRotina(
  supabase: SupabaseClient,
  params: { familyId: string; membroAtipicoId: string; contexto: string; phoneE164?: string | null },
): Promise<{ mensagem: string; pronto: boolean } | null> {
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
    const interesses = await carregarInteresses(supabase, params.membroAtipicoId);

    // Conversa desta sessão (ambas as direções, últimos 60 min) — pra a IA saber
    // o que já perguntou e o que a mãe já respondeu.
    const desde = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: msgs } = await supabase
      .from("ayla_messages")
      .select("texto, direcao, created_at")
      .eq("family_account_id", familyId)
      .gte("created_at", desde)
      .order("created_at", { ascending: true })
      .limit(24);
    const historico = (msgs ?? [])
      .map((m) => ({
        de: (m.direcao === "inbound" ? "mae" : "kolo") as "mae" | "kolo",
        texto: ((m.texto as string) ?? "").trim(),
      }))
      .filter((h) => h.texto);
    if (!historico.some((h) => h.de === "mae" && h.texto === params.contexto.trim())) {
      historico.push({ de: "mae", texto: params.contexto.trim() });
    }

    const transicoesConhecidas = await carregarTransicoes(supabase, params.membroAtipicoId);
    const transicoesTxt = transicoesConhecidas.length
      ? transicoesConhecidas
          .map((t) => `${t.momento}${t.estrategia ? ` → ${t.estrategia}` : ""}${t.funcionou === false ? " (não funcionou, tentar outra)" : ""}`)
          .join("; ")
      : "";

    const userPrompt = [
      `CRIANÇA/ADOLESCENTE/ADULTO: ${nome}${idade != null ? ` (${idade} anos)` : ""}.`,
      interesses ? `INTERESSES CONHECIDOS (pra propor tema): ${interesses}` : "",
      transicoesTxt ? `TRANSIÇÕES JÁ CONHECIDAS (use proativamente, não re-pergunte): ${transicoesTxt}` : "",
      "CONVERSA (a última fala da mãe é o pedido atual):\n" +
        historico.map((h) => `${h.de === "mae" ? "Mãe" : "Kolo"}: ${h.texto}`).join("\n"),
    ]
      .filter(Boolean)
      .join("\n\n");

    const client = getAylaAnthropicClient();
    const resp = await client.messages.create({
      model: AYLA_MODEL,
      max_tokens: 1600,
      system: SYSTEM_CONDUZIR,
      messages: [{ role: "user", content: userPrompt }],
    });
    const b = resp.content[0];
    const raw = b?.type === "text" ? b.text : "";
    const parsed = extrairJsonRotina(raw) as
      | { mensagem?: string; pronto?: boolean; tema?: string | null; transicoes?: unknown; rotinas?: unknown }
      | null;

    let mensagem = (typeof parsed?.mensagem === "string" && parsed.mensagem.trim()) || "";
    const pronto = parsed?.pronto === true;
    const tema = typeof parsed?.tema === "string" && parsed.tema.trim() ? parsed.tema.trim().slice(0, 40) : null;
    const rotinas = sanitizarRotinas(parsed?.rotinas);

    // Aprendizado: guarda no Kolo Vivo as transições difíceis + estratégia.
    if (Array.isArray(parsed?.transicoes) && parsed.transicoes.length) {
      const aprendidas: Transicao[] = (parsed.transicoes as unknown[])
        .map((t): Transicao | null => {
          const o = (t ?? {}) as Record<string, unknown>;
          const momento = String(o.momento ?? "").trim();
          if (!momento) return null;
          return {
            momento,
            estrategia: o.estrategia ? String(o.estrategia) : null,
            funcionou: typeof o.funcionou === "boolean" ? o.funcionou : null,
          };
        })
        .filter((t): t is Transicao => t != null);
      await salvarTransicoes(supabase, params.membroAtipicoId, aprendidas);
    }

    if (pronto && rotinas.length) {
      const ids: string[] = [];
      for (const r of rotinas) {
        const id = await aplicarRotina(supabase, familyId, params.membroAtipicoId, r, tema);
        if (id) ids.push(id);
      }
      if (params.phoneE164) {
        await entregarPdfDaRotina(supabase, { familyId, phoneE164: params.phoneE164, nome, tema, rotinas });
      }
      // Destino do link: rotina de DIA DA SEMANA → tabela da semana; UM dia avulso
      // ("Dia do circo") → aquela rotina; vários avulsos → a lista de rotinas.
      const temSemana = rotinas.some((r) => r.dia_semana != null);
      const next = temSemana
        ? "/ludico/rotinas/semana"
        : ids.length === 1
          ? `/ludico/rotinas/${ids[0]}`
          : "/ludico/rotinas";

      // Auto-gerar DIA ÚNICO (tema): a mãe abre e já está gerando/pronto. A
      // semana fica sob demanda (a mãe pede "a rotina de terça" — ver pedirRotinaDoDia).
      let autoGerou = false;
      if (!temSemana && tema && ids.length) {
        for (const id of ids) await dispararGeracao(id, tema);
        autoGerou = true;
      }

      const link = await gerarMagicLink(supabase, { familyId, next });
      const fechamento = mensagem || `Prontinho — montei a rotina do(a) ${nome} 🌿`;
      const orient = autoGerou
        ? ` Já comecei a gerar os cartões no tema *${tema}* — eles levam *1-2 minutinhos* pra ficar prontos, então pode abrir que vão aparecendo sozinhos 🌿 Te mandei também um *PDF pra imprimir*.`
        : ` Te mandei um *PDF pra imprimir* (com quadradinhos pra marcar). No app dá pra ajustar${tema ? ` e gerar os cartões no tema *${tema}*` : " e gerar os cartões ilustrados"}.`;
      const dica = "\n\n💡 Quando quiser, é só me pedir *a rotina de hoje* (ou *a de terça*) que eu te trago.";
      mensagem = link
        ? `${fechamento}${orient}\n\nAbre aqui (já entra direto):\n${link}${dica}`
        : `${fechamento}${orient}${dica}`;
    }

    if (!mensagem) return null;
    return { mensagem, pronto: pronto && rotinas.length > 0 };
  } catch (e) {
    console.warn("[ayla:rotina-guiada] falha:", e instanceof Error ? e.message : e);
    return null;
  }
}

// ---------- "Traga a rotina de hoje / de terça" ----------

const DIAS_MAP: Record<string, number> = {
  segunda: 0,
  terça: 1,
  terca: 1,
  quarta: 2,
  quinta: 3,
  sexta: 4,
  sábado: 5,
  sabado: 5,
  domingo: 6,
};

/** Dia da semana (0=Seg..6=Dom) em um fuso, com offset de dias (hoje=0, amanhã=1). */
function diaSemanaEmTz(tz: string | null | undefined, offsetDias: number): number {
  const base = new Date(Date.now() + offsetDias * 24 * 60 * 60 * 1000);
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: tz || "America/Sao_Paulo",
    weekday: "short",
  }).format(base);
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return map[wd] ?? 0;
}

function resolverDia(texto: string, tz: string | null | undefined): number | null {
  const t = (texto ?? "").toLowerCase();
  if (/\bhoje\b/.test(t)) return diaSemanaEmTz(tz, 0);
  if (/\bamanh[ãa]\b/.test(t)) return diaSemanaEmTz(tz, 1);
  for (const [nome, d] of Object.entries(DIAS_MAP)) if (t.includes(nome)) return d;
  return null;
}

/** Pedido pra VER uma rotina de um dia (traga/manda/mostra a rotina de hoje/terça…). */
export function pedeRotinaDeUmDia(texto: string | null | undefined): boolean {
  const t = (texto ?? "").toLowerCase();
  if (!/\brotina\b/.test(t)) return false;
  const temDia = /\bhoje\b|\bamanh[ãa]\b|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo/.test(t);
  const temVerbo = /\b(traga|traz|tras|manda|mandar|mostra|mostrar|me v[êe]|quero ver|abre|abrir|puxa|puxar|ver a)\b/.test(
    t,
  );
  // NÃO é criar/montar (isso é o condutor).
  const ehCriar = /\b(criar|cria|montar|monta|monte|fazer|faz|fa[çc]a)\b/.test(t);
  return temDia && temVerbo && !ehCriar;
}

/**
 * A mãe pediu "a rotina de hoje/terça". Resolve o dia (pelo fuso), acha a rotina,
 * gera os cartões se faltar (um dia por vez) e devolve o link. Null se não deu.
 */
export async function pedirRotinaDoDia(
  supabase: SupabaseClient,
  params: {
    familyId: string;
    membroAtipicoId: string;
    texto: string;
    timezone?: string | null;
  },
): Promise<string | null> {
  try {
    const dia = resolverDia(params.texto, params.timezone);
    if (dia == null) return null;

    const { data: membro } = await supabase
      .from("membros_atipicos")
      .select("nome")
      .eq("id", params.membroAtipicoId)
      .maybeSingle();
    const nome = (membro?.nome as string) ?? "seu filho";
    const nomeDia = DIAS_LABEL[dia];

    const { data: rot } = await supabase
      .from("rotinas")
      .select("id, tema, cards_status")
      .eq("membro_atipico_id", params.membroAtipicoId)
      .eq("family_account_id", params.familyId)
      .eq("dia_semana", dia)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!rot) {
      return `Ainda não montamos a rotina de ${nomeDia} 🌿 Quer montar agora? É só me contar como é esse dia (pode ser áudio).`;
    }

    const rotinaId = rot.id as string;
    const tema = (rot.tema as string | null) ?? null;
    const status = (rot.cards_status as string | null) ?? "nenhum";

    let gerando = false;
    if (tema && (status === "nenhum" || status === "erro")) {
      await dispararGeracao(rotinaId, tema);
      gerando = true;
    }

    const link = await gerarMagicLink(supabase, { familyId: params.familyId, next: `/ludico/rotinas/${rotinaId}` });
    const extra = gerando ? " Tô gerando os cartões — ao abrir, já vão aparecendo 🌿" : "";
    const base = `Aqui está a rotina de *${nomeDia}* do(a) ${nome} 🗓️${extra}`;
    return link ? `${base}\nAbre aqui:\n${link}` : base;
  } catch (e) {
    console.warn("[ayla:rotina-guiada] pedirRotinaDoDia falhou:", e instanceof Error ? e.message : e);
    return null;
  }
}

// ---------- Editar/corrigir uma rotina pela Ayla ----------

/** Pedido de EDIÇÃO ("faltou o lanche na terça", "tira o vôlei", "muda a rotina de hoje"). */
export function pedeEditarRotina(texto: string | null | undefined): boolean {
  const t = (texto ?? "").toLowerCase();
  const editVerbo =
    /\b(faltou|falta|tira|tirar|tire|remove|remover|remova|adiciona|adicionar|acrescenta|acrescentar|p[õo]e|poe|coloca|colocar|muda|mudar|mude|troca|trocar|corrige|corrigir|arruma|arrumar|inverte|inverter|esqueci)\b/.test(
      t,
    );
  if (!editVerbo) return false;
  const refDia = /\bhoje\b|\bamanh[ãa]\b|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo/.test(t);
  const refRotina = /\brotina\b|\bcart[õo]es?\b|nessa rotina|na rotina|dessa rotina|no dia/.test(t);
  return refDia || refRotina;
}

const SYSTEM_EDITAR = `Você edita uma rotina que já existe. Recebe as TAREFAS ATUAIS (JSON) e o PEDIDO da mãe. Devolva APENAS JSON com as tarefas ATUALIZADAS, aplicando o pedido (adicionar / remover / mudar texto / mudar horário / reordenar) e MANTENDO tudo que ela NÃO mencionou. Formato: {"tarefas":[{"texto":"acordar","hora":"6h"}]}. HORÁRIO é opcional (null se não tiver; nunca invente). Encaixe no lugar lógico (ex.: "lanche depois da escola" entra logo após a escola). Texto curto (1-5 palavras). NÃO invente atividades além do que ela pediu.`;

function sanitizarTarefasSimples(bruto: unknown): TarefaProposta[] {
  if (!Array.isArray(bruto)) return [];
  const out: TarefaProposta[] = [];
  for (const t of bruto.slice(0, 30)) {
    const o = (t ?? {}) as Record<string, unknown>;
    const texto = String(o.texto ?? "").trim().slice(0, 120);
    if (!texto) continue;
    const hora = o.hora == null ? null : String(o.hora).trim().slice(0, 10);
    out.push({ texto, hora: hora || null });
  }
  return out;
}

/**
 * Edita a rotina que a mãe pediu (dia mencionado, senão a mais recente): carrega
 * as tarefas atuais, aplica a mudança (IA) e regrava. Se tinha cartões no tema,
 * regenera. Devolve confirmação + link.
 */
export async function editarRotina(
  supabase: SupabaseClient,
  params: { familyId: string; membroAtipicoId: string; texto: string; timezone?: string | null; phoneE164?: string | null },
): Promise<string | null> {
  try {
    const dia = resolverDia(params.texto, params.timezone);
    type RotSel = { id: string; nome: string; tema: string | null; cards_status: string | null };
    let rot: RotSel | null = null;

    if (dia != null) {
      const { data } = await supabase
        .from("rotinas")
        .select("id, nome, tema, cards_status")
        .eq("membro_atipico_id", params.membroAtipicoId)
        .eq("family_account_id", params.familyId)
        .eq("dia_semana", dia)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data) rot = data as unknown as RotSel;
    }
    if (!rot) {
      const { data } = await supabase
        .from("rotinas")
        .select("id, nome, tema, cards_status")
        .eq("membro_atipico_id", params.membroAtipicoId)
        .eq("family_account_id", params.familyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) rot = data as unknown as RotSel;
    }
    if (!rot) return "Não achei uma rotina pra ajustar 🌿 Me diz qual dia, ou a gente monta uma nova.";

    const rotinaId = rot.id;
    const { data: tarefas } = await supabase
      .from("rotina_tarefas")
      .select("texto, hora, ordem")
      .eq("rotina_id", rotinaId)
      .order("ordem", { ascending: true });
    const atuais = (tarefas ?? []).map((t) => ({ texto: t.texto as string, hora: (t.hora as string | null) ?? null }));

    const client = getAylaAnthropicClient();
    const resp = await client.messages.create({
      model: AYLA_MODEL,
      max_tokens: 1200,
      system: SYSTEM_EDITAR,
      messages: [
        {
          role: "user",
          content: `TAREFAS ATUAIS:\n${JSON.stringify({ tarefas: atuais })}\n\nPEDIDO DA MÃE: ${params.texto}`,
        },
      ],
    });
    const b = resp.content[0];
    const raw = b?.type === "text" ? b.text : "";
    const parsed = extrairJsonRotina(raw) as { tarefas?: unknown } | null;
    const novas = sanitizarTarefasSimples(parsed?.tarefas);
    if (!novas.length) return null;

    await supabase.from("rotina_tarefas").delete().eq("rotina_id", rotinaId);
    const rows = novas.slice(0, 25).map((t, i) => ({
      rotina_id: rotinaId,
      texto: t.texto.slice(0, 120),
      hora: t.hora ? t.hora.slice(0, 10) : null,
      icone: null,
      ordem: i,
    }));
    if (rows.length) await supabase.from("rotina_tarefas").insert(rows);

    // Tinha cartões no tema? A mudança pede regeneração.
    const tinhaCartoes = rot.tema && (rot.cards_status === "pronto" || rot.cards_status === "gerando");
    if (tinhaCartoes && rot.tema) {
      await supabase.from("rotinas").update({ cards_status: "nenhum" }).eq("id", rotinaId);
      await dispararGeracao(rotinaId, rot.tema);
    }

    const link = await gerarMagicLink(supabase, { familyId: params.familyId, next: `/ludico/rotinas/${rotinaId}` });
    const regen = tinhaCartoes ? " Tô refazendo os cartões com a mudança (uns minutinhos)." : "";
    const base = `Pronto, ajustei a rotina *${rot.nome}* 🌿${regen}`;
    return link ? `${base}\nAbre aqui:\n${link}` : base;
  } catch (e) {
    console.warn("[ayla:rotina-guiada] editarRotina falhou:", e instanceof Error ? e.message : e);
    return null;
  }
}
