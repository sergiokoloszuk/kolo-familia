"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { esquecerCacheDeDocumentos } from "@/lib/ayla/documentos";
import { responderExperimental } from "@/lib/ayla/experimental";

/**
 * PUBLICAR A INTELIGÊNCIA DA AYLA SEM DEPLOY — Passo 1, 15/08/2026.
 *
 * ⚠️ POR QUE CADA ESCRITA CONFERE O PRÓPRIO RESULTADO. No cliente Supabase o
 * `.update()` DEVOLVE o erro em vez de lançar. Um `await` sem checar aqui
 * significaria a tela dizer "publicado" com o Core velho ainda no ar — e o
 * jeito de descobrir seria uma conversa estranha com uma família.
 */

export type Resultado = { ok: true; msg?: string } | { ok: false; error: string };

const CHAVE = "core";

type LinhaDoc = {
  id: string;
  versao: number;
  status: string;
  conteudo: string;
  nota: string | null;
  publicado_em: string | null;
  created_at: string;
};

export async function listarVersoes(): Promise<LinhaDoc[]> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("ayla_documentos")
    .select("id, versao, status, conteudo, nota, publicado_em, created_at")
    .eq("chave", CHAVE)
    .order("versao", { ascending: false });
  if (error) return [];
  return (data ?? []) as LinhaDoc[];
}

/** O maior número já usado — inclusive por versões arquivadas. */
async function proximaVersao(supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"]) {
  const { data, error } = await supabase
    .from("ayla_documentos")
    .select("versao")
    .eq("chave", CHAVE)
    .order("versao", { ascending: false })
    .limit(1);
  if (error) throw new Error(`não consegui ler as versões: ${error.message}`);
  return ((data?.[0]?.versao as number | undefined) ?? 0) + 1;
}

const conteudoSchema = z
  .string()
  .trim()
  .min(500, "Core curto demais para ser o Core — confira se colou o texto inteiro");

export async function salvarRascunho(conteudo: string, nota?: string): Promise<Resultado> {
  try {
    const texto = conteudoSchema.parse(conteudo);
    const { supabase } = await requireAdmin();

    const { data: rascunho, error: erroLeitura } = await supabase
      .from("ayla_documentos")
      .select("id, versao")
      .eq("chave", CHAVE)
      .eq("status", "rascunho")
      .maybeSingle();
    if (erroLeitura) return { ok: false, error: `Falha ao ler rascunho: ${erroLeitura.message}` };

    if (rascunho) {
      // Um rascunho por chave (o banco garante). Salvar de novo reescreve o
      // mesmo, sem inflar o histórico com cada Ctrl+S.
      const { error } = await supabase
        .from("ayla_documentos")
        .update({ conteudo: texto, nota: nota?.trim() || null })
        .eq("id", rascunho.id);
      if (error) return { ok: false, error: `Falha ao salvar: ${error.message}` };
      revalidatePath("/admin/inteligencia");
      return { ok: true, msg: `Rascunho v${rascunho.versao} salvo.` };
    }

    const versao = await proximaVersao(supabase);
    const { error } = await supabase.from("ayla_documentos").insert({
      chave: CHAVE,
      versao,
      status: "rascunho",
      conteudo: texto,
      nota: nota?.trim() || null,
    });
    if (error) return { ok: false, error: `Falha ao criar rascunho: ${error.message}` };
    revalidatePath("/admin/inteligencia");
    return { ok: true, msg: `Rascunho v${versao} criado.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function descartarRascunho(): Promise<Resultado> {
  try {
    const { supabase } = await requireAdmin();
    const { error } = await supabase
      .from("ayla_documentos")
      .delete()
      .eq("chave", CHAVE)
      .eq("status", "rascunho");
    if (error) return { ok: false, error: `Falha ao descartar: ${error.message}` };
    revalidatePath("/admin/inteligencia");
    return { ok: true, msg: "Rascunho descartado." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

/**
 * ARQUIVA O ATIVO, DEPOIS ATIVA O NOVO — nesta ordem, e não a inversa.
 *
 * ⚠️ NÃO É ATÔMICO, e a ordem escolhe qual falha acontece. Ativar primeiro
 * esbarraria no índice `um ativo por chave` e não sairia do lugar. Arquivar
 * primeiro abre uma janela de milissegundos com NENHUM ativo — e nessa janela
 * a Ayla responde com o Core do código, que é o mesmo conteúdo aprovado. Ou
 * seja: a falha possível cai do lado seguro.
 *
 * Se ainda assim o segundo passo falhar, o ativo anterior é devolvido ao ar.
 */
async function trocarAtivo(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  novoId: string,
  userId: string,
): Promise<Resultado> {
  const { data: atual, error: erroAtual } = await supabase
    .from("ayla_documentos")
    .select("id, versao")
    .eq("chave", CHAVE)
    .eq("status", "ativo")
    .maybeSingle();
  if (erroAtual) return { ok: false, error: `Falha ao ler o ativo: ${erroAtual.message}` };

  if (atual) {
    const { error } = await supabase
      .from("ayla_documentos")
      .update({ status: "arquivado" })
      .eq("id", atual.id);
    if (error) return { ok: false, error: `Falha ao arquivar v${atual.versao}: ${error.message}` };
  }

  const { data: ativado, error: erroAtivar } = await supabase
    .from("ayla_documentos")
    .update({ status: "ativo", publicado_por: userId, publicado_em: new Date().toISOString() })
    .eq("id", novoId)
    .select("versao")
    .maybeSingle();

  if (erroAtivar || !ativado) {
    // Compensação: devolve o anterior ao ar. Sem isso o Core ficaria no
    // fallback do código até alguém perceber.
    if (atual) {
      await supabase.from("ayla_documentos").update({ status: "ativo" }).eq("id", atual.id);
    }
    return {
      ok: false,
      error: `Falha ao ativar: ${erroAtivar?.message ?? "nenhuma linha alterada"}. ${
        atual ? `A v${atual.versao} foi devolvida ao ar.` : "Nenhuma versão ativa — a Ayla está no Core do código."
      }`,
    };
  }

  esquecerCacheDeDocumentos();
  revalidatePath("/admin/inteligencia");
  return { ok: true, msg: `Core v${ativado.versao} no ar. Instâncias já quentes assumem em até 60s.` };
}

export async function publicarRascunho(): Promise<Resultado> {
  try {
    const { supabase, user } = await requireAdmin();
    const { data: rascunho, error } = await supabase
      .from("ayla_documentos")
      .select("id, conteudo")
      .eq("chave", CHAVE)
      .eq("status", "rascunho")
      .maybeSingle();
    if (error) return { ok: false, error: `Falha ao ler rascunho: ${error.message}` };
    if (!rascunho) return { ok: false, error: "Não há rascunho para publicar." };
    if (!String(rascunho.conteudo ?? "").trim()) {
      return { ok: false, error: "O rascunho está vazio — publicar isso apagaria o Core." };
    }
    return await trocarAtivo(supabase, rascunho.id as string, user.id);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

/**
 * VOLTAR PARA UMA VERSÃO ANTERIOR — criando uma versão NOVA com o conteúdo
 * velho, em vez de reativar a linha arquivada.
 *
 * ⚠️ O histórico é só append. Ressuscitar a linha antiga apagaria o registro
 * de que ela chegou a ser arquivada, e a pergunta "o que estava no ar às 14h?"
 * deixaria de ter resposta.
 */
export async function restaurarVersao(id: string): Promise<Resultado> {
  try {
    const { supabase, user } = await requireAdmin();
    const { data: velha, error } = await supabase
      .from("ayla_documentos")
      .select("versao, conteudo")
      .eq("id", id)
      .maybeSingle();
    if (error) return { ok: false, error: `Falha ao ler a versão: ${error.message}` };
    if (!velha || !String(velha.conteudo ?? "").trim()) {
      return { ok: false, error: "Versão não encontrada ou vazia." };
    }

    const versao = await proximaVersao(supabase);
    const { data: nova, error: erroInsert } = await supabase
      .from("ayla_documentos")
      .insert({
        chave: CHAVE,
        versao,
        status: "arquivado", // nasce fora do ar; `trocarAtivo` a promove
        conteudo: velha.conteudo,
        nota: `Restauração da v${velha.versao}.`,
      })
      .select("id")
      .maybeSingle();
    if (erroInsert || !nova) {
      return { ok: false, error: `Falha ao criar a restauração: ${erroInsert?.message ?? "sem linha"}` };
    }
    return await trocarAtivo(supabase, nova.id as string, user.id);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

/**
 * TESTAR A AYLA — com o rascunho, contra uma família real, sem tocar nela.
 *
 * ⚠️ LÊ DE VERDADE, NÃO ESCREVE NADA. O caminho experimental só grava o custo
 * de token (que é real e fica marcado como `ayla_simulador`). Nada é enviado
 * por WhatsApp, nada entra no histórico da conversa e nenhum evento é
 * extraído — isso tudo mora no orquestrador, que o simulador não chama.
 */
export async function simular(
  familyId: string,
  mensagem: string,
  usarRascunho: boolean,
): Promise<
  | { ok: true; texto: string; coreOrigem: string; coreVersao: number | null; foco: string; ms: number }
  | { ok: false; error: string }
> {
  try {
    await requireAdmin();
    if (!mensagem.trim()) return { ok: false, error: "Escreva uma mensagem." };
    if (!familyId) return { ok: false, error: "Escolha uma família." };

    // ⚠️ Service-role: o simulador precisa enxergar a família como a Ayla
    // enxerga. A porta continua fechada — `requireAdmin` acima é o gate.
    const supabase = createServiceRoleClient();

    let rascunho: { conteudo: string; versao: number } | null = null;
    if (usarRascunho) {
      const { data } = await supabase
        .from("ayla_documentos")
        .select("conteudo, versao")
        .eq("chave", CHAVE)
        .eq("status", "rascunho")
        .maybeSingle();
      if (!data?.conteudo) return { ok: false, error: "Não há rascunho salvo para testar." };
      rascunho = { conteudo: data.conteudo as string, versao: data.versao as number };
    }

    const r = await responderExperimental(supabase, {
      familyId,
      mensagem,
      rascunhoCore: rascunho,
      origem: "simulador",
    });
    if (!r) {
      return {
        ok: false,
        error:
          "A Ayla não respondeu — resposta vazia, fronteira barrou, ou a família não tem contexto. Na conversa real isso cairia no fluxo atual.",
      };
    }
    return {
      ok: true,
      texto: r.texto,
      coreOrigem: r.metrica.coreOrigem,
      coreVersao: r.metrica.coreVersao,
      foco: r.metrica.foco,
      ms: r.metrica.msTotal,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}
