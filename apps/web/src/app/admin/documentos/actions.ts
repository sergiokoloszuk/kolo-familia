"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { sha256 } from "./sha";
import { esquecerCacheDeDocumentos, CHAVES_DOCUMENTO, type ChaveDocumento } from "@/lib/ayla/documentos";

/**
 * DOCUMENTOS DA AYLA — cadastro, versionamento e ativação.
 *
 * ⚠️ TRÊS ESTADOS DIFERENTES, e confundi-los é como se perde um documento:
 *   SALVAR .... cria uma versão NOVA, que não vai para ninguém.
 *   ATIVAR .... torna aquela versão a vigente (a anterior vira histórico).
 *   INJETAR ... decidir que ela entra no prompt — NÃO acontece aqui.
 * Só o Core é injetado hoje; os outros quatro são administrados e revisados.
 *
 * ⚠️ POR QUE CANDIDATO É `arquivado` COM `publicado_em` NULO, e não `rascunho`.
 * A migração 0077 tem índice parcial de UM rascunho por chave — desenhado para
 * "o rascunho", singular. Aqui cada save precisa criar uma versão nova sem
 * destruir a anterior, então usar `rascunho` faria o segundo save falhar com
 * 23505. `arquivado` já significa "não é a vigente", e `publicado_em IS NULL`
 * distingue "nunca foi publicada" de "já esteve no ar". Zero migração.
 *
 * ⚠️ TODA ESCRITA CONFERE O PRÓPRIO RESULTADO. No cliente Supabase o erro
 * VOLTA em `{ error }` — um `await` sem checar faria a tela dizer "salvo" com
 * o texto perdido, e o texto aqui é colado à mão, longo, e pode não ter cópia.
 */

export type Resultado = { ok: true; msg: string; versao?: number } | { ok: false; error: string };

export type LinhaVersao = {
  id: string;
  chave: string;
  versao: number;
  status: string;
  conteudo: string;
  nota: string | null;
  publicado_em: string | null;
  created_at: string;
};

function chaveValida(c: string): c is ChaveDocumento {
  return (CHAVES_DOCUMENTO as readonly string[]).includes(c);
}

/** Todas as versões de uma chave, mais nova primeiro. */
export async function listarVersoes(chave: string): Promise<LinhaVersao[]> {
  if (!chaveValida(chave)) return [];
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("ayla_documentos")
    .select("id, chave, versao, status, conteudo, nota, publicado_em, created_at")
    .eq("chave", chave)
    .order("versao", { ascending: false });
  if (error) return [];
  return (data ?? []) as LinhaVersao[];
}

/** Resumo de todas as chaves, para a lista. */
export async function resumoDocumentos() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("ayla_documentos")
    .select("chave, versao, status, conteudo, publicado_em, updated_at")
    .order("versao", { ascending: false });
  if (error) return [];
  return (data ?? []).map((d) => ({
    chave: d.chave as string,
    versao: d.versao as number,
    status: d.status as string,
    chars: String(d.conteudo ?? "").length,
    sha: sha256(String(d.conteudo ?? "")),
    publicado_em: d.publicado_em as string | null,
    updated_at: d.updated_at as string | null,
  }));
}

/**
 * SALVAR — sempre cria versão NOVA. Nunca sobrescreve, nunca ativa.
 *
 * `idem` é uma marca do cliente: dois cliques rápidos mandam a mesma, e o
 * segundo encontra a versão já criada com aquele conteúdo e devolve sucesso
 * sem duplicar. Sem isso, um duplo clique num documento de 16 mil caracteres
 * cria duas versões idênticas e polui o histórico.
 */
export async function salvarNovaVersao(
  chave: string,
  conteudo: string,
  nota?: string,
): Promise<Resultado> {
  try {
    if (!chaveValida(chave)) return { ok: false, error: `Chave desconhecida: ${chave}` };
    const texto = conteudo ?? "";
    if (!texto.trim()) return { ok: false, error: "O documento está vazio — nada foi salvo." };

    const { supabase, user } = await requireAdmin();

    const { data: existentes, error: erroLer } = await supabase
      .from("ayla_documentos")
      .select("versao, conteudo")
      .eq("chave", chave)
      .order("versao", { ascending: false });
    if (erroLer) return { ok: false, error: `Falha ao ler versões: ${erroLer.message}` };

    // Duplo clique / reenvio: mesmo conteúdo da versão mais nova → não duplica.
    const maisNova = existentes?.[0];
    if (maisNova && String(maisNova.conteudo) === texto) {
      return {
        ok: true,
        msg: `Nada mudou — este texto já é a versão ${maisNova.versao}.`,
        versao: maisNova.versao as number,
      };
    }

    const versao = ((maisNova?.versao as number | undefined) ?? 0) + 1;
    const { data: nova, error } = await supabase
      .from("ayla_documentos")
      .insert({
        chave,
        versao,
        // ⚠️ NASCE FORA DO AR. Ativar é ação separada.
        status: "arquivado",
        publicado_em: null,
        publicado_por: user.id,
        conteudo: texto,
        nota: nota?.trim() || null,
      })
      .select("versao")
      .maybeSingle();
    if (error || !nova) {
      return { ok: false, error: `Falha ao salvar: ${error?.message ?? "nenhuma linha criada"}` };
    }

    revalidatePath("/admin/documentos");
    return {
      ok: true,
      versao: nova.versao as number,
      msg: `Versão ${nova.versao} salva como candidata (${texto.length.toLocaleString("pt-BR")} caracteres). Ela ainda NÃO está no ar.`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

/**
 * ATIVAR — arquiva a vigente, depois promove a escolhida.
 *
 * ⚠️ A ORDEM ESCOLHE QUAL FALHA ACONTECE. Promover primeiro esbarraria no
 * índice `um ativo por chave` e não sairia do lugar. Arquivar primeiro abre uma
 * janela de milissegundos sem ativo — e nessa janela o Core cai no fallback do
 * código, que é o mesmo conteúdo aprovado. A falha possível cai do lado seguro.
 * Se a promoção ainda assim falhar, a anterior é devolvida ao ar.
 */
export async function ativarVersao(id: string): Promise<Resultado> {
  try {
    const { supabase, user } = await requireAdmin();

    const { data: alvo, error: erroAlvo } = await supabase
      .from("ayla_documentos")
      .select("id, chave, versao, conteudo, status")
      .eq("id", id)
      .maybeSingle();
    if (erroAlvo) return { ok: false, error: `Falha ao ler a versão: ${erroAlvo.message}` };
    if (!alvo) return { ok: false, error: "Versão não encontrada." };
    if (!String(alvo.conteudo ?? "").trim()) {
      return { ok: false, error: "Versão vazia — ativar isso apagaria o documento." };
    }
    if (alvo.status === "ativo") return { ok: true, msg: `A versão ${alvo.versao} já está no ar.` };

    const { data: atual, error: erroAtual } = await supabase
      .from("ayla_documentos")
      .select("id, versao")
      .eq("chave", alvo.chave as string)
      .eq("status", "ativo")
      .maybeSingle();
    if (erroAtual) return { ok: false, error: `Falha ao ler a vigente: ${erroAtual.message}` };

    if (atual) {
      const { error } = await supabase
        .from("ayla_documentos")
        .update({ status: "arquivado" })
        .eq("id", atual.id);
      if (error) return { ok: false, error: `Falha ao arquivar v${atual.versao}: ${error.message}` };
    }

    const { data: ativada, error: erroAtivar } = await supabase
      .from("ayla_documentos")
      .update({ status: "ativo", publicado_por: user.id, publicado_em: new Date().toISOString() })
      .eq("id", id)
      .select("versao")
      .maybeSingle();

    if (erroAtivar || !ativada) {
      if (atual) {
        await supabase.from("ayla_documentos").update({ status: "ativo" }).eq("id", atual.id);
      }
      return {
        ok: false,
        error: `Falha ao ativar: ${erroAtivar?.message ?? "nenhuma linha alterada"}. ${
          atual ? `A v${atual.versao} foi devolvida ao ar.` : "Nenhuma versão ativa no momento."
        }`,
      };
    }

    esquecerCacheDeDocumentos();
    revalidatePath("/admin/documentos");
    return {
      ok: true,
      versao: ativada.versao as number,
      msg: `Versão ${ativada.versao} no ar. Instâncias já quentes assumem em até 60s.`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

/** O texto exatamente como está persistido — para conferir depois de salvar. */
export async function lerVersao(id: string): Promise<{ conteudo: string; sha: string } | null> {
  try {
    const { supabase } = await requireAdmin();
    const { data } = await supabase
      .from("ayla_documentos")
      .select("conteudo")
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;
    const c = String(data.conteudo ?? "");
    return { conteudo: c, sha: sha256(c) };
  } catch {
    return null;
  }
}
