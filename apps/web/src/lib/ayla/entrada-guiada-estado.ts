import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ehEntradaVaga,
  interpretarEscolha,
  lerMenuDoTexto,
  montarMenuTemas,
  textoDoMenu,
  type EscolhaMenu,
} from "@/lib/conducao/entrada-guiada";

/**
 * O ESTADO DA ENTRADA GUIADA — sem coluna, sem migração.
 *
 * Espelha o padrão que a Rotina já usa (`rotinaConversaPendente`): o estado é
 * INFERIDO do histórico de `ayla_messages` por `tipo`, e não guardado num campo
 * novo. Aqui isso é mais do que economia — é correção: o menu que vale é o que
 * a mãe VIU, e ele já está persistido como texto da mensagem enviada.
 *
 * Recalcular o menu na hora da resposta pareceria equivalente e não é: basta o
 * cadastro dela mudar entre uma mensagem e outra para a numeração andar, e o
 * "2" dela virar outro tema sem ninguém perceber.
 */

export const TIPO_ENTRADA_GUIADA = "entrada_guiada";

/** Quanto tempo um menu continua valendo. Depois disso, "2" é só um "2". */
const JANELA_MENU_MS = 24 * 60 * 60 * 1000;

/**
 * A última vez que o menu foi mandado — e se a mãe já respondeu depois dele.
 * Devolve o TEXTO, porque é dele que sai a numeração verdadeira.
 */
async function menuPendente(
  supabase: SupabaseClient,
  familyId: string,
  agora: Date,
): Promise<{ texto: string } | null> {
  try {
    const limite = new Date(agora.getTime() - JANELA_MENU_MS).toISOString();
    const { data } = await supabase
      .from("ayla_messages")
      .select("texto, created_at")
      .eq("family_account_id", familyId)
      .eq("tipo", TIPO_ENTRADA_GUIADA)
      .eq("direcao", "outbound")
      .gte("created_at", limite)
      .order("created_at", { ascending: false })
      .limit(1);
    const m = data?.[0];
    if (!m) return null;

    // Se ela já respondeu alguma coisa depois do menu, o menu não está mais
    // pendente: a conversa andou, e um número agora significa outra coisa.
    const { data: depois } = await supabase
      .from("ayla_messages")
      .select("id")
      .eq("family_account_id", familyId)
      .eq("direcao", "inbound")
      .gt("created_at", m.created_at as string)
      .limit(1);
    if ((depois?.length ?? 0) > 0) return null;

    return { texto: (m.texto as string) ?? "" };
  } catch {
    // Estado inferido é best-effort: sem ele a conversa segue como sempre
    // seguiu, e a mãe é atendida pelo caminho normal.
    return null;
  }
}

/**
 * A MENSAGEM DE AGORA É A ESCOLHA DE UM MENU QUE ESTÁ NO AR?
 *
 * `null` quando não há menu pendente ou quando a resposta não é uma escolha —
 * e aí nada muda no fluxo.
 */
export async function escolhaDoMenu(
  supabase: SupabaseClient,
  familyId: string,
  texto: string,
  agora: Date = new Date(),
): Promise<EscolhaMenu | null> {
  const pendente = await menuPendente(supabase, familyId, agora);
  if (!pendente) return null;
  return interpretarEscolha(texto, lerMenuDoTexto(pendente.texto));
}

/**
 * DEVE MOSTRAR O MENU AGORA?
 *
 * Três condições, e a primeira é a que protege a família: **situação concreta
 * nunca vira menu**. Mostrar a lista para quem já disse o que está acontecendo
 * é responder um formulário a quem pediu ajuda — o erro caro desta frente.
 *
 * As outras duas evitam laço: só quando a criança já está resolvida (senão o
 * fluxo de identificação vem antes, e com razão), e nunca duas vezes seguidas.
 */
export async function deveMostrarMenu(
  supabase: SupabaseClient,
  p: { familyId: string; texto: string; membroId: string | null; agora?: Date },
): Promise<boolean> {
  if (!ehEntradaVaga(p.texto)) return false;
  if (!p.membroId) return false;
  const agora = p.agora ?? new Date();
  try {
    const limite = new Date(agora.getTime() - JANELA_MENU_MS).toISOString();
    const { data } = await supabase
      .from("ayla_messages")
      .select("id")
      .eq("family_account_id", p.familyId)
      .eq("tipo", TIPO_ENTRADA_GUIADA)
      .eq("direcao", "outbound")
      .gte("created_at", limite)
      .limit(1);
    // Já ofereceu hoje: repetir o mesmo menu para quem respondeu "oi" de novo
    // é insistir num caminho que ela já não quis.
    return (data?.length ?? 0) === 0;
  } catch {
    return false;
  }
}

/** O texto do menu para esta família, com os desafios reais dela. */
export function montarTextoDoMenu(p: {
  desafiosOnboarding: readonly string[];
  nomeMae?: string | null;
  nomeCrianca?: string | null;
}): string {
  return textoDoMenu({
    menu: montarMenuTemas(p.desafiosOnboarding),
    nomeMae: p.nomeMae,
    nomeCrianca: p.nomeCrianca,
  });
}
