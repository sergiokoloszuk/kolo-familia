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

export type Membro = {
  id: string;
  nome: string | null;
  /**
   * "masculino" | "feminino" | outro | null. Já existe em `membros_atipicos`
   * desde sempre; o que faltava era alguém usar na hora de saber de quem a
   * mãe está falando.
   */
  genero?: string | null;
};

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

/**
 * PARENTESCO EXPLÍCITO — sinal FORTE de gênero.
 *
 * "minha filha", "meu filho", "a menina", "o menino". Quem escreve isso está
 * falando da própria criança, e o gênero é afirmação, não pista.
 */
const FILHA = /\b(filha|menina|garota|princesa)\b/i;
const FILHO = /\b(filho|menino|garoto)\b/i;

/**
 * PRONOME SOLTO — sinal FRACO, de propósito.
 *
 * "ela não come" pode ser a filha, mas também a professora, a avó, a fono. Só
 * vale quando NENHUMA outra pessoa aparece na frase; qualquer terceiro citado
 * derruba o sinal. Trocar uma pergunta a mais por um fato gravado na criança
 * errada seria um péssimo negócio — é o que o comentário de `resolverFoco` já
 * teme.
 */
const PRONOME_ELA = /\b(ela|dela)\b/i;
const PRONOME_ELE = /\b(ele|dele)\b/i;
// ⚠️ O FECHO É `(?![a-zà-ÿ])`, NÃO `\b`. O `\b` do JavaScript é ASCII: depois
// de um acento ele não enxerga limite de palavra, e `\bav[óô]\b` simplesmente
// não casava com "avó" — o teste da avó reprovou por isso. O lookahead cobre
// letras acentuadas e continua impedindo que "tia" case dentro de "Tiago".
const OUTRA_PESSOA =
  /\b(professora?|prof|escola|coordenadora?|diretora?|fono(audi[óo]loga)?|terapeuta|psic[óo]loga?|m[ée]dica?|pediatra|av[óô]|vov[óô]|tia|tio|bab[áa]|cuidadora?|vizinha?|amiga?|colega|irm[ãa]|madrinha|monitora?)(?![a-zà-ÿ])/i;

/** As crianças cujo gênero casa com o termo. */
function doGenero(membros: Membro[], alvo: "feminino" | "masculino"): Membro[] {
  return membros.filter((m) => (m.genero ?? "").trim().toLowerCase() === alvo);
}

/**
 * QUEM O TEXTO INDICA PELO GÊNERO — ou `null` quando não dá para afirmar.
 *
 * ⚠️ Só resolve quando existe **exatamente uma** criança daquele gênero. Dois
 * filhos homens e "meu filho" continua ambíguo, como tem de ser. E nunca
 * resolve por eliminação: "meu filho" não escolhe a criança sem gênero
 * cadastrado só porque ela é a que sobrou.
 */
export function porGenero(texto: string, membros: Membro[]): Membro | null {
  const temFilha = FILHA.test(texto);
  const temFilho = FILHO.test(texto);
  // Os dois na mesma frase ("minha filha e meu filho") não desambigua nada.
  if (temFilha && temFilho) return null;

  if (temFilha || temFilho) {
    const c = doGenero(membros, temFilha ? "feminino" : "masculino");
    return c.length === 1 ? c[0] : null;
  }

  // Pronome solto: só quando não há mais ninguém em cena.
  if (OUTRA_PESSOA.test(texto)) return null;
  const ela = PRONOME_ELA.test(texto);
  const ele = PRONOME_ELE.test(texto);
  if (ela === ele) return null; // nenhum dos dois, ou os dois
  const c = doGenero(membros, ela ? "feminino" : "masculino");
  return c.length === 1 ? c[0] : null;
}

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

  // ⚠️ GÊNERO, DEPOIS DO NOME E ANTES DO HISTÓRICO — 17/08/2026.
  //
  // Caso real: a Karina escreveu "minha FILHA não come, ELA não aceita nada" e
  // a Ayla perguntou "Manu ou Mario?". Mario é masculino, Manu é feminina, e o
  // campo `genero` existe em `membros_atipicos` desde sempre — a escada é que
  // não tinha esse degrau e caía direto em `ambiguo`.
  //
  // Vem DEPOIS do nome porque nome citado é mais forte ("a Manu" vence "meu
  // filho" numa frase confusa). Vem ANTES do histórico porque o que a mãe
  // escreve AGORA vale mais que a última criança de 24h atrás.
  const porSexo = porGenero(texto, ativos);
  if (porSexo) return { tipo: "individual", membros: [porSexo] };

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
