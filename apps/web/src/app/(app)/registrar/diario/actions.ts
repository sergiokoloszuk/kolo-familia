"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { idDeEvidencia } from "@/lib/kolo-vivo/fatos/evidencia";
import { hojeLocalISO } from "@/lib/idade";
import { createClient } from "@/lib/supabase/server";
import { requireActiveWrite } from "@/lib/auth/require-active-write";
import { trackFeature } from "@/lib/analytics/track";
import { idadeAnos } from "@/lib/idade";
import { extrairAtualizacoes, type ItemKoloVivo } from "@/lib/ia/atualizar";
import { montarKoloVivoResumo, aplicarItensNoMembro } from "@/lib/kolo-vivo/incorporar";
import { classificarAreasDiario } from "@/lib/ia/classificar-area";
import { resolveFamily } from "@/lib/auth/current-family";

async function requireFamily() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data: family } = await resolveFamily(supabase);
  if (!family) throw new Error("Família não inicializada");
  return { supabase, user, family };
}

const ESCALA_EMOCIONAL = ["muito_bem", "bem", "neutro", "dificil", "muito_dificil"] as const;

const schema = z.object({
  membroAtipicoId: z.string().uuid().nullable(),
  data: z.string().date(),

  // Check-in leve
  escalaEmocionalMae: z.enum(ESCALA_EMOCIONAL),
  escalaEmocionalMembro: z.enum(ESCALA_EMOCIONAL).nullable().optional(),

  // Camada A
  conquista: z.string().trim().max(500).optional(),
  desafio: z.string().trim().max(500).optional(),
  observacaoLivre: z.string().trim().max(1000).optional(),
  possivelGatilho: z.string().trim().max(500).optional(),

  // Camada B
  quemEstava: z
    .enum(["mae", "pai", "avo_a", "avo_o", "irmao_a", "baba", "professor_a", "outro"])
    .nullable()
    .optional(),
  estadoAdulto: z
    .enum(["calmo", "firme", "cansado", "ansioso", "impaciente"])
    .nullable()
    .optional(),
  reacaoAdulto: z
    .enum(["acolhedor", "esperou", "interveio", "impositivo", "chamou_ajuda", "outro"])
    .nullable()
    .optional(),
});

export type RegistrarDiaInput = z.infer<typeof schema>;

export async function registrarDia(input: RegistrarDiaInput): Promise<void> {
  const data = schema.parse(input);
  const { supabase, family } = await requireFamily();
  await requireActiveWrite(family.id);

  // 1. Check-in diário — buscar e atualizar/inserir.
  //    (O índice único é numa expressão `coalesce(membro_atipico_id, ...)`,
  //    então `upsert(onConflict: colunas)` dava 42P10 e o check-in nunca
  //    salvava — o erro era engolido. Por isso parecia "travar".)
  let buscaCheckin = supabase
    .from("check_ins_diarios")
    .select("id")
    .eq("family_account_id", family.id)
    .eq("data", data.data);
  buscaCheckin = data.membroAtipicoId
    ? buscaCheckin.eq("membro_atipico_id", data.membroAtipicoId)
    : buscaCheckin.is("membro_atipico_id", null);
  const { data: checkinExistente, error: errBusca } = await buscaCheckin.maybeSingle();
  if (errBusca) throw new Error(`Erro ao verificar check-in: ${errBusca.message}`);

  if (checkinExistente) {
    const { error } = await supabase
      .from("check_ins_diarios")
      .update({
        escala_emocional_mae: data.escalaEmocionalMae,
        escala_emocional_membro: data.escalaEmocionalMembro ?? null,
      })
      .eq("id", checkinExistente.id);
    if (error) throw new Error(`Erro ao atualizar check-in: ${error.message}`);
  } else {
    const { error } = await supabase.from("check_ins_diarios").insert({
      family_account_id: family.id,
      membro_atipico_id: data.membroAtipicoId,
      data: data.data,
      escala_emocional_mae: data.escalaEmocionalMae,
      escala_emocional_membro: data.escalaEmocionalMembro ?? null,
      origem: "app",
    });
    if (error) throw new Error(`Erro ao salvar check-in: ${error.message}`);
  }

  // 2. Diário (só insere se houver alguma das 3 colunas A preenchida)
  const temCamadaA = Boolean(
    data.conquista?.trim() || data.desafio?.trim() || data.observacaoLivre?.trim(),
  );

  if (temCamadaA && data.membroAtipicoId) {
    const temCamadaB = Boolean(data.quemEstava || data.estadoAdulto || data.reacaoAdulto);
    const incompleto = Boolean(data.conquista || data.desafio) && !temCamadaB;
    const conquistaRaw = data.conquista?.trim() || null;
    const desafioRaw = data.desafio?.trim() || null;
    const observacao_livre = data.observacaoLivre?.trim() || null;

    // Etiqueta por área + reescreve bonito (1 chamada leve; graceful — se falhar,
    // mantém o texto original e área null). Guarda a versão limpa.
    const area = await classificarAreasDiario(
      { conquista: conquistaRaw, desafio: desafioRaw, polir: true },
      { supabase, family_account_id: family.id },
    );
    const conquista = area.conquistaLimpa ?? conquistaRaw;
    const desafio = area.desafioLimpa ?? desafioRaw;

    // Dedup: se já existe um diário hoje pra esse membro/origem com o MESMO
    // conteúdo, atualiza em vez de inserir (evita duplicação por double-click).
    const { data: dup } = await supabase
      .from("diarios")
      .select("id")
      .eq("family_account_id", family.id)
      .eq("membro_atipico_id", data.membroAtipicoId)
      .eq("data", data.data)
      .eq("origem", "app")
      .match({ conquista, desafio, observacao_livre })
      .maybeSingle();

    const payload = {
      family_account_id: family.id,
      membro_atipico_id: data.membroAtipicoId,
      data: data.data,
      conquista,
      desafio,
      observacao_livre,
      conquista_area: area.conquistaArea,
      desafio_area: area.desafioArea,
      possivel_gatilho: data.possivelGatilho?.trim() || null,
      quem_estava: data.quemEstava ?? null,
      estado_adulto: data.estadoAdulto ?? null,
      reacao_adulto: data.reacaoAdulto ?? null,
      origem: "app",
      incompleto,
    };

    if (dup) {
      const { error } = await supabase
        .from("diarios")
        .update(payload)
        .eq("id", dup.id);
      if (error) throw new Error(`Erro ao atualizar registro do dia: ${error.message}`);
    } else {
      const { error } = await supabase.from("diarios").insert(payload);
      if (error) throw new Error(`Erro ao salvar registro do dia: ${error.message}`);
    }
  }

  after(() =>
    trackFeature({
      familyId: family.id,
      evento: "registro_dia",
      detalhe: { com_diario: temCamadaA, humor_mae: data.escalaEmocionalMae },
    }),
  );

  revalidatePath("/painel");
  revalidatePath("/registrar");
  revalidatePath("/registrar/diario");
}

// ============================================================
// Diário → Kolo Vivo (proposta com pergunta, sem duplicar)
// Depois de registrar o dia, a Kolo lê o que foi escrito e, se houver algo
// NOVO (que ainda não está no Kolo Vivo), oferece guardar — a mãe decide.
// ============================================================

const proporSchema = z.object({
  membroAtipicoId: z.string().uuid(),
  texto: z.string().trim().min(1),
});

export async function proporKoloVivoDoDiario(
  input: z.infer<typeof proporSchema>,
): Promise<{ ok: true; koloVivo: ItemKoloVivo[]; nome: string } | { ok: false; error: string }> {
  try {
    const { membroAtipicoId, texto } = proporSchema.parse(input);
    const { supabase, family } = await requireFamily();

    const { data: m } = await supabase
      .from("membros_atipicos")
      .select("nome, data_nascimento, perfil")
      .eq("id", membroAtipicoId)
      .eq("family_account_id", family.id)
      .maybeSingle();
    if (!m) return { ok: false, error: "Membro não encontrado." };

    const koloVivoResumo = await montarKoloVivoResumo(supabase, family.id, membroAtipicoId);
    const proposta = await extrairAtualizacoes({
      transcript: texto,
      koloVivoResumo,
      membro: {
        nome: m.nome as string,
        idade: idadeAnos((m.data_nascimento as string | null) ?? null),
        perfil: (m.perfil as string) ?? "",
      },
    });
    // Só camada1 (a criança) faz sentido a partir do diário.
    const koloVivo = proposta.koloVivo.filter((it) => it.camada === "camada1");
    return { ok: true, koloVivo, nome: m.nome as string };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}

const salvarKvSchema = z.object({
  membroAtipicoId: z.string().uuid(),
  /** A entrada do diario que originou a proposta. Opcional: quando ausente,
   *  a acao localiza a entrada do dia (ver `evidenciaDoDiario`). */
  diarioId: z.string().uuid().optional(),
  /** Data do registro, para localizar a entrada certa quando nao for hoje. */
  data: z.string().date().optional(),
  koloVivo: z
    .array(
      z.object({
        camada: z.enum(["camada1", "camada2"]),
        campo: z.string().min(1),
        subcampo: z.string().trim().nullable().optional(),
        texto: z.string().trim().min(1),
        operacao: z.enum(["adicionar", "reescrever"]).default("adicionar"),
      }),
    )
    .min(1),
});

/**
 * Encontra a entrada do diario que originou estes fatos.
 *
 * O caminho ideal seria a UI passar o id, mas `registrarDia` devolve `void` e
 * mudar isso arrastaria dois componentes. Esta consulta e EXATAMENTE a mesma
 * que `registrarDia` usa para deduplicar - entao ela identifica a mesma linha,
 * nao uma aproximacao. Se um dia a UI passar `diarioId`, ele tem precedencia.
 *
 * Sem entrada localizada, devolve null: o fato fica sem evidencia e isso
 * aparece na auditoria, em vez de virar um id inventado.
 */
async function evidenciaDoDiario(
  supabase: Awaited<ReturnType<typeof requireFamily>>["supabase"],
  familyId: string,
  membroAtipicoId: string,
  diarioId: string | undefined,
  data: string | undefined,
): Promise<string | null> {
  if (diarioId) return idDeEvidencia("diario_entry", diarioId);
  try {
    const { data: linha } = await supabase
      .from("diarios")
      .select("id")
      .eq("family_account_id", familyId)
      .eq("membro_atipico_id", membroAtipicoId)
      .eq("data", data ?? hojeLocalISO())
      .eq("origem", "app")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return linha?.id ? idDeEvidencia("diario_entry", linha.id as string) : null;
  } catch {
    return null;
  }
}

export async function salvarKoloVivoDoDiario(
  input: z.infer<typeof salvarKvSchema>,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  try {
    const { membroAtipicoId, koloVivo, diarioId, data } = salvarKvSchema.parse(input);
    const { supabase, user, family } = await requireFamily();
    await requireActiveWrite(family.id);

    // TODOS os fatos desta proposta compartilham a mesma evidencia (a entrada
    // do diario) e a mesma execucao - vieram da mesma leitura.
    const sourceContentId = await evidenciaDoDiario(
      supabase,
      family.id,
      membroAtipicoId,
      diarioId,
      data,
    );
    const extractionRunId = crypto.randomUUID();
    const count = await aplicarItensNoMembro(
      supabase,
      family.id,
      membroAtipicoId,
      koloVivo as ItemKoloVivo[],
      // Entrada manual, autor autenticado. Digitar prova que a pessoa
      // RELATOU, nao que a informacao foi validada - por isso `reported`, e
      // nao `confirmed` (ver conversar/actions.ts). Sem messageId: o diario
      // nao tem mensagem, e inventar um ID quebraria a auditoria.
      {
        proveniencia: {
          sourceType: "manual_entry",
          channel: "diario",
          actorId: user.id,
        },
        verificationStatus: "reported",
        linhagem: { sourceContentId, extractionRunId },
      },
    );
    revalidatePath("/kolo-vivo");
    revalidatePath("/painel");
    return { ok: true, count };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro inesperado" };
  }
}
