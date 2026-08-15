"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { responderExperimental } from "@/lib/ayla/experimental";

/**
 * O SIMULADOR — testa, e SÓ testa.
 *
 * ⚠️ ESTE ARQUIVO NÃO ESCREVE NADA. Nem em `ayla_documentos`, nem na conversa
 * da família. Ele existe para a aprovação humana de um Core antes da ativação,
 * e a separação é o que impede o acidente óbvio: editar num lugar achando que
 * está testando, ou ativar achando que está salvando.
 *
 *   /admin/documentos ....... conteúdo (salvar, versionar, ativar)
 *   /admin/inteligencia ..... teste (ler versão, conversar, medir)
 *
 * Até 15/08/2026 esta tela também salvava e publicava. Duas telas gravando na
 * mesma tabela com convenções diferentes (`rascunho` aqui, `arquivado` lá)
 * produziram um `core v3` corrompido que ninguém sabia de onde tinha vindo.
 * Um teste prende a ausência de escrita aqui.
 *
 * ⚠️ LÊ DE VERDADE, NÃO ESCREVE NADA. O caminho experimental só grava o custo
 * de token, marcado como `ayla_simulador`. Nada é enviado por WhatsApp, nada
 * entra no histórico da conversa e nenhum aprendizado é extraído — isso mora
 * no orquestrador, que o simulador não chama.
 */

export type VersaoParaTeste = {
  id: string;
  versao: number;
  status: string;
  chars: number;
  publicado_em: string | null;
  created_at: string;
};

/** Todas as versões do Core, para escolher qual testar. SOMENTE LEITURA. */
export async function versoesDoCore(): Promise<VersaoParaTeste[]> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("ayla_documentos")
    .select("id, versao, status, conteudo, publicado_em, created_at")
    .eq("chave", "core")
    .order("versao", { ascending: false });
  if (error) return [];
  return (data ?? []).map((d) => ({
    id: d.id as string,
    versao: d.versao as number,
    status: d.status as string,
    chars: String(d.conteudo ?? "").length,
    publicado_em: d.publicado_em as string | null,
    created_at: d.created_at as string,
  }));
}

export type ResultadoSimulacao =
  | {
      ok: true;
      texto: string;
      coreTestado: string;
      coreOrigem: string;
      coreVersao: number | null;
      foco: string;
      consultas: number;
      llms: number;
      tokensEntrada: number;
      tokensSaida: number;
      msContexto: number;
      msModelo: number;
      msTotal: number;
    }
  | { ok: false; error: string };

/**
 * Roda um turno com a versão de Core escolhida.
 *
 * `versaoId` nulo = testa o que está NO AR. Qualquer outro id testa aquela
 * versão específica, ativa ou não — é o que permite aprovar um candidato antes
 * de ele existir para alguma família.
 */
export async function simular(
  familyId: string,
  mensagem: string,
  versaoId: string | null,
): Promise<ResultadoSimulacao> {
  try {
    await requireAdmin();
    if (!mensagem.trim()) return { ok: false, error: "Escreva uma mensagem." };
    if (!familyId) return { ok: false, error: "Escolha uma família." };

    // ⚠️ Service-role: o simulador precisa enxergar a família como a Ayla
    // enxerga. A porta continua fechada — `requireAdmin` acima é o gate.
    const supabase = createServiceRoleClient();

    let escolhida: { conteudo: string; versao: number } | null = null;
    let rotulo = "versão no ar";
    if (versaoId) {
      const { data } = await supabase
        .from("ayla_documentos")
        .select("conteudo, versao, status")
        .eq("id", versaoId)
        .maybeSingle();
      if (!data?.conteudo) return { ok: false, error: "Versão não encontrada ou vazia." };
      escolhida = { conteudo: data.conteudo as string, versao: data.versao as number };
      rotulo = `v${data.versao} (${data.status})`;
    }

    const t0 = Date.now();
    const r = await responderExperimental(supabase, {
      familyId,
      mensagem,
      // O mesmo parâmetro que o simulador sempre usou: injeta o texto escolhido
      // sem tocar em nada. A conversa real nunca o passa.
      rascunhoCore: escolhida,
      origem: "simulador",
    });
    const msPontaAPonta = Date.now() - t0;

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
      coreTestado: rotulo,
      coreOrigem: r.metrica.coreOrigem,
      coreVersao: r.metrica.coreVersao,
      foco: r.metrica.foco,
      consultas: r.metrica.consultasBanco,
      llms: r.metrica.chamadasLLM,
      tokensEntrada: r.metrica.tokensEntrada,
      tokensSaida: r.metrica.tokensSaida,
      msContexto: r.metrica.msContexto,
      msModelo: r.metrica.msModelo,
      msTotal: msPontaAPonta,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}
