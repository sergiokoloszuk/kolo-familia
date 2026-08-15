import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * DE QUEM É ESTA CONVERSA — 15/08/2026, Fase 1.
 *
 * ⚠️ O PROBLEMA REAL, e ele já custou caro. Em 07/08/2026 a mãe contou que o
 * MARIO presta atenção com algo nas mãos; depois falou da MANU; e a Ayla
 * respondeu sobre a Manu dizendo "como ela já mostrou que se concentra melhor
 * quando as mãos estão ocupadas". Quem tinha mostrado isso era o irmão.
 *
 * ⚠️ E A SOLUÇÃO NÃO É ISOLAR TUDO. "Quero uma brincadeira para os dois
 * fazerem juntos" é um pedido legítimo e rico, e recortar por criança o
 * mataria. O que não pode existir é MISTURA POR ACIDENTE.
 *
 * Por isso o foco é um ESTADO EXPLÍCITO do turno, derivado de sinais baratos e
 * determinísticos — sem chamada de modelo, sem tabela nova, sem estado
 * persistido. Quando os sinais não bastam, o foco é `ambiguo` e a Ayla
 * pergunta, em vez de escolher no chute.
 */

export type Membro = { id: string; nome: string | null };

export type Foco =
  /** Uma criança, com confiança. */
  | { tipo: "individual"; membros: Membro[] }
  /** A conversa é sobre mais de uma — "os dois", dois nomes citados. */
  | { tipo: "compartilhado"; membros: Membro[] }
  /** Família com uma criança só: não há o que desambiguar. */
  | { tipo: "unica"; membros: Membro[] }
  /** Dois ou mais filhos e nenhum sinal confiável. A Ayla PERGUNTA. */
  | { tipo: "ambiguo"; membros: Membro[] };

/** "os dois", "as duas", "ambos", "eles", "juntos" — plural explícito. */
const PLURAL_IRMAOS =
  /\b(os dois|as duas|ambos|ambas|os tr[êe]s|juntos|juntas|um com o outro|uma com a outra|entre eles|entre elas|irm[ãa]os?)\b/i;

/** Troca explícita: "agora quero falar do Mario". */
const TROCA_EXPLICITA = /\b(agora|mudando|sobre|falar d[eoa]|quero falar|voltando a)\b/i;

function citados(texto: string, membros: Membro[]): Membro[] {
  const t = texto.toLowerCase();
  return membros.filter((m) => {
    const n = (m.nome ?? "").trim().toLowerCase();
    if (n.length < 3) return false;
    // Palavra inteira: "Ana" não casa dentro de "Joana".
    return new RegExp(`(^|[^\\p{L}])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "iu").test(t);
  });
}

/**
 * A ÚLTIMA CRIANÇA COM DONO NA CONVERSA — o sinal mais fraco da lista.
 *
 * ⚠️ Substitui a janela fixa de 2h de `criancaDaConversa`. Tempo é SINAL DE
 * CONFIANÇA, não fonte de verdade: se a mãe falou da Manu ontem e hoje escreve
 * "ela fez de novo", a janela de 2h joga fora um contexto que ainda vale. Aqui
 * a janela é larga (24h) porque este sinal só é usado quando NENHUM outro
 * existe — e mesmo assim ele nunca cria foco compartilhado sozinho.
 */
async function ultimaCriancaDaConversa(
  supabase: SupabaseClient,
  familyId: string,
): Promise<string | null> {
  try {
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("ayla_messages")
      .select("membro_atipico_id")
      .eq("family_account_id", familyId)
      .not("membro_atipico_id", "is", null)
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(1);
    return (data?.[0]?.membro_atipico_id as string | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * A DECISÃO, por ordem de confiança:
 *   1. dois ou mais NOMES citados        → compartilhado
 *   2. plural de irmãos ("os dois")      → compartilhado (todos)
 *   3. um NOME citado                    → individual (troca o foco)
 *   4. uma criança cadastrada só         → unica
 *   5. última criança da conversa (24h)  → individual
 *   6. nada disso                        → ambiguo
 */
export async function resolverFoco(
  supabase: SupabaseClient,
  familyId: string,
  texto: string,
  membros: Membro[],
): Promise<Foco> {
  const ativos = membros.filter((m) => (m.nome ?? "").trim());
  if (ativos.length === 0) return { tipo: "ambiguo", membros: [] };
  if (ativos.length === 1) return { tipo: "unica", membros: ativos };

  const nomes = citados(texto, ativos);
  if (nomes.length >= 2) return { tipo: "compartilhado", membros: nomes };
  if (PLURAL_IRMAOS.test(texto)) return { tipo: "compartilhado", membros: ativos };
  if (nomes.length === 1) return { tipo: "individual", membros: nomes };

  const ultimo = await ultimaCriancaDaConversa(supabase, familyId);
  const achado = ultimo ? ativos.find((m) => m.id === ultimo) : null;
  if (achado) return { tipo: "individual", membros: [achado] };

  // ⚠️ NÃO ESCOLHER é a resposta certa aqui. Escolher no chute é exatamente
  // como uma informação do Mario vira fato sobre a Manu.
  return { tipo: "ambiguo", membros: ativos };
}

void TROCA_EXPLICITA;

/**
 * O BLOCO QUE DIZ AO MODELO DE QUEM É A CONVERSA.
 *
 * Explícito de propósito: o modelo não precisa adivinhar, e no caso ambíguo
 * recebe a instrução de perguntar em vez de escolher.
 */
export function blocoDeFoco(foco: Foco): string {
  const nomes = foco.membros.map((m) => m.nome).filter(Boolean).join(" e ");
  switch (foco.tipo) {
    case "unica":
    case "individual":
      return `<sobre_quem>A conversa é sobre ${nomes}.</sobre_quem>`;
    case "compartilhado":
      return `<sobre_quem>A conversa é sobre ${nomes} — as duas crianças. Considere as características de cada uma; o que vale para uma pode não valer para a outra.</sobre_quem>`;
    case "ambiguo":
      return `<sobre_quem>Ainda NÃO se sabe de qual criança a pessoa está falando: ${nomes}. NÃO escolha por conta própria e NÃO use informação de uma como se fosse da outra — pergunte de qual delas se trata, de forma natural.</sobre_quem>`;
  }
}
