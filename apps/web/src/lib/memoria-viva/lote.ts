import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * LOTE DE EXTRAÇÃO — o insumo real que o extrator leu.
 *
 * No WhatsApp a mãe manda três mensagens seguidas e `lote-inbound.ts` entrega
 * as três ao extrator como um texto só. O fato, porém, guardava o ponteiro de
 * UMA delas. Quem fosse reconstruir o caso depois recuperaria um terço da
 * entrada e concluiria que o extrator errou — quando ele tinha lido outra
 * coisa.
 *
 * Este módulo é a unidade que faltava: mensagens → lote → fatos.
 *
 * REFERÊNCIA, NÃO CÓPIA. O texto não é copiado para `extracao_lotes`. Guardamos
 * o hash e as referências ordenadas; `reconstruirTextoDoLote` refaz o texto com
 * a MESMA função que produziu o original, e o hash prova que bate. Se a
 * consolidação mudar um dia, o hash denuncia — em vez de a reconstrução mentir
 * em silêncio, que é o modo de falha que este módulo existe para impedir.
 *
 * ⚠️ Servidor apenas (`node:crypto`). Não importar de componente de cliente.
 */

export type MensagemDoLote = {
  /** Id interno de `ayla_messages`. Sempre existe e é estável. */
  mensagemId: string;
  /** Id do provedor (Z-API). NULO quando o payload não trouxe — nunca inventado. */
  provedorMessageId: string | null;
  recebidaEm: string;
  texto: string | null;
};

export type CanalDoLote = "whatsapp" | "web" | "diario" | "sistema";

export type LoteRegistrado = {
  id: string;
  /** O texto exatamente como foi entregue ao extrator. */
  texto: string;
  quantidade: number;
  /** `true` quando o lote já existia — reprocessamento, não fala nova. */
  jaExistia: boolean;
};

/**
 * A CONSOLIDAÇÃO, em um lugar só.
 *
 * Fonte única de verdade: `lote-inbound.ts` usa esta função para montar o que
 * vai ao extrator, e `reconstruirTextoDoLote` usa a mesma para desfazer o
 * caminho. Duas implementações "equivalentes" divergiriam na primeira mudança,
 * e a divergência apareceria como fato inexplicável meses depois.
 */
export function consolidarTextos(textos: (string | null | undefined)[]): string {
  return textos
    .map((t) => (t ?? "").trim())
    .filter(Boolean)
    .join("\n");
}

const sha = (v: string) => createHash("sha256").update(v).digest("hex");

/** Hash do texto entregue ao extrator. Prova de fidelidade da reconstrução. */
export function hashDoTexto(texto: string): string {
  return sha(texto);
}

/**
 * Chave de reprocessamento: o CONJUNTO ordenado de mensagens.
 *
 * Reprocessar as mesmas mensagens reencontra o mesmo lote. A mãe repetir a
 * mesma frase amanhã cria linhas novas em `ayla_messages`, logo chave nova,
 * logo lote novo — repetição legítima não vira duplicata técnica.
 */
export function chaveDeMensagens(mensagemIds: string[]): string {
  return sha([...mensagemIds].sort().join("|"));
}

/** Ordena pela chegada. A ordem em que a mãe escreveu é parte do insumo. */
function emOrdem(mensagens: MensagemDoLote[]): MensagemDoLote[] {
  return [...mensagens].sort((a, b) => a.recebidaEm.localeCompare(b.recebidaEm));
}

/**
 * Registra o lote. **Idempotente**: reprocessar as mesmas mensagens devolve o
 * lote existente com `jaExistia: true`, sem criar linha nova.
 *
 * NUNCA lança. Falha aqui não pode derrubar o turno da Ayla — degrada para
 * `null`, e o chamador segue com o comportamento antigo (evidência apontando
 * para a mensagem). Perder proveniência é ruim; perder a resposta para a mãe
 * porque a proveniência falhou seria pior.
 */
export async function registrarLote(
  supabase: SupabaseClient,
  params: { familyId: string; canal: CanalDoLote; mensagens: MensagemDoLote[] },
): Promise<LoteRegistrado | null> {
  const mensagens = emOrdem(params.mensagens);
  if (mensagens.length === 0) return null;

  const texto = consolidarTextos(mensagens.map((m) => m.texto));
  if (!texto) return null;

  const chave = chaveDeMensagens(mensagens.map((m) => m.mensagemId));
  const linha = {
    family_account_id: params.familyId,
    canal: params.canal,
    mensagens: mensagens.map((m, i) => ({
      ordem: i,
      mensagem_id: m.mensagemId,
      provedor_message_id: m.provedorMessageId,
      recebida_em: m.recebidaEm,
    })),
    quantidade: mensagens.length,
    texto_hash: hashDoTexto(texto),
    mensagens_chave: chave,
  };

  try {
    // `ignoreDuplicates` devolve [] no conflito — é assim que sabemos que o
    // lote já existia, sem uma consulta a mais no caminho feliz.
    const { data, error } = await supabase
      .from("extracao_lotes")
      .upsert(linha, { onConflict: "family_account_id,mensagens_chave", ignoreDuplicates: true })
      .select("id");

    if (error) return null;
    if (data && data.length > 0) {
      return { id: data[0].id as string, texto, quantidade: mensagens.length, jaExistia: false };
    }

    // Conflito: o lote existe. Busca o id para que os fatos apontem para ele.
    const { data: existente } = await supabase
      .from("extracao_lotes")
      .select("id")
      .eq("family_account_id", params.familyId)
      .eq("mensagens_chave", chave)
      .maybeSingle();

    if (!existente) return null;
    return { id: existente.id as string, texto, quantidade: mensagens.length, jaExistia: true };
  } catch {
    return null;
  }
}

export type TextoReconstruido = {
  texto: string;
  quantidade: number;
  /** `false` = a reconstrução NÃO bate com o que o extrator leu. Ver abaixo. */
  confere: boolean;
  /** Mensagens do lote que não existem mais. Reconstrução parcial é mentira. */
  ausentes: string[];
};

/**
 * Refaz o texto que o extrator leu, a partir das mensagens do lote.
 *
 * `confere: false` significa que o hash não bate — mensagem alterada, ausente,
 * ou regra de consolidação mudada desde a captura. Nesse caso o texto devolvido
 * NÃO deve virar caso de teste: seria um insumo que nunca existiu, exatamente o
 * defeito que a 0074 corrige.
 */
export async function reconstruirTextoDoLote(
  supabase: SupabaseClient,
  loteId: string,
): Promise<TextoReconstruido | null> {
  const { data: lote } = await supabase
    .from("extracao_lotes")
    .select("id, mensagens, quantidade, texto_hash")
    .eq("id", loteId)
    .maybeSingle();
  if (!lote) return null;

  const refs = (lote.mensagens as { ordem: number; mensagem_id: string }[]) ?? [];
  const ids = [...refs].sort((a, b) => a.ordem - b.ordem).map((r) => r.mensagem_id);

  const { data: linhas } = await supabase
    .from("ayla_messages")
    .select("id, texto")
    .in("id", ids);

  const porId = new Map((linhas ?? []).map((l) => [l.id as string, (l.texto as string) ?? null]));
  const ausentes = ids.filter((id) => !porId.has(id));
  const texto = consolidarTextos(ids.map((id) => porId.get(id) ?? null));

  return {
    texto,
    quantidade: (lote.quantidade as number) ?? ids.length,
    confere: ausentes.length === 0 && hashDoTexto(texto) === lote.texto_hash,
    ausentes,
  };
}
