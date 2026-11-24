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
  | { tipo: "ambiguo"; membros: Membro[] }
  /**
   * A criança da conversa NÃO está cadastrada (terceiro filho, sobrinho,
   * criança conhecida). Nenhum perfil entra; `cadastrados` só serve para dizer
   * ao modelo de quem a informação NÃO pode vir.
   */
  | { tipo: "externa"; membros: Membro[]; cadastrados: Membro[] };

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
 * A CRIANÇA DA CONVERSA NÃO ESTÁ CADASTRADA? — 23/11/2026.
 *
 * ⚠️ CASO REAL, simulador da Karina (família com Manu e Mario). Ela falou de
 * uma terceira filha. "Minha filha" e "ela" apontavam, pela regra de gênero,
 * para a Manu — a única menina cadastrada —, e a Ayla passou a chamar a
 * terceira criança de Manu e a usar o perfil dela. Sem sinal de gênero, o foco
 * caía em `ambiguo` a cada mensagem e a Ayla perguntava de novo "é a terceira
 * ou um dos seus filhos?", mesmo depois da resposta.
 *
 * Dois tipos de sinal, ambos explícitos:
 *   · NEGAÇÃO — "nenhum dos dois", "não é a Manu", "outra criança", "minha
 *     terceira": vence até nome citado (o nome aparece justamente para negar);
 *   · PARENTESCO DE FORA — sobrinho, neta, aluno, filho da amiga: só vale
 *     quando nenhum nome cadastrado foi citado ("a Manu e a prima" é da Manu).
 */
//
// ⚠️ CONSERVADOR DE PROPÓSITO. "A Manu não brinca com outra criança" e
// "nenhum dos dois quer comer" falam DAS crianças cadastradas — por isso
// "outra criança" só conta como afirmação de identidade ("é outra criança") e
// "nenhum dos dois" só como RESPOSTA curta, no começo da mensagem.
const CRIANCA_NAO_CADASTRADA =
  /(\b(é|e|eh|sobre|falando d[eao]) (uma |a |o )?outr[ao] (crian[çc]a|menin[oa])\b|\bterceir[oa] (filh[oa]|crian[çc]a)\b|\bminha terceira\b|\bmeu terceiro\b|\bn[aã]o (est[aá]|t[aá]|é|e) cadastrad[oa]\b)/i;
const RESPOSTA_NENHUM =
  /^\W*(n[aã]o[\s,.!]+)?nenhum[ae]?\s+d(?:os\s+dois|as\s+duas|eles|elas)\s*(?:[,.;:!—-]|$|é\b|eh\b)/i;
const PARENTESCO_DE_FORA =
  /\b(sobrinh[oa]s?|afilhad[oa]s?|net[oa]s?|enteado|enteada|alun[oa]s?|filh[oa] d[aeo] (minha|meu|uma|um|nossa|nosso) )(?![a-zà-ÿ])/i;

/** Nomes cadastrados citados só para NEGAR ("não é a Manu"). */
function negados(texto: string, membros: Membro[]): Membro[] {
  return membros.filter((m) => {
    const n = (m.nome ?? "").trim().toLowerCase();
    if (n.length < 3) return false;
    const nome = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(n[aã]o (é|e|eh|seria) (nem )?|(^|[^\\p{L}])nem )(a |o )?${nome}([^\\p{L}]|$)`, "iu").test(texto);
  });
}

/**
 * O QUE UM TEXTO DA MÃE DIZ SOBRE O FOCO — ou `null` quando não diz nada.
 * Mesma escada para a mensagem atual e para as anteriores da conversa.
 */
function focoDoTexto(texto: string, ativos: Membro[], comGenero: boolean): Foco | null {
  const negadosAqui = negados(texto, ativos);
  // "Não é a Manu, é o Mario": o nome que sobra depois da negação decide.
  const nomes = citados(texto, ativos).filter((m) => !negadosAqui.includes(m));
  const externa = { tipo: "externa" as const, membros: [], cadastrados: ativos };
  if (nomes.length === 0 &&
      (negadosAqui.length > 0 || CRIANCA_NAO_CADASTRADA.test(texto) || RESPOSTA_NENHUM.test(texto))) {
    return externa;
  }
  if (nomes.length >= 2) return { tipo: "compartilhado", membros: nomes };
  if (PLURAL_IRMAOS.test(texto)) return { tipo: "compartilhado", membros: ativos };
  if (nomes.length === 1) return { tipo: "individual", membros: nomes };
  if (PARENTESCO_DE_FORA.test(texto)) return externa;
  if (comGenero) {
    const porSexo = porGenero(texto, ativos);
    if (porSexo) return { tipo: "individual", membros: [porSexo] };
  }
  return null;
}

/**
 * A DECISÃO, por ordem de confiança:
 *   1. a mensagem atual nega os cadastrados / cita parente de fora → externa
 *   2. dois ou mais NOMES citados        → compartilhado
 *   3. plural de irmãos ("os dois")      → compartilhado (todos)
 *   4. um NOME citado                    → individual (troca o foco)
 *   5. uma criança cadastrada só         → unica (salvo externa explícita)
 *   6. a conversa já estabeleceu criança de fora → externa (antes do gênero)
 *   7. gênero na mensagem atual          → individual
 *   8. o que a conversa recente já decidiu (nome, plural, gênero) → mantém
 *   9. última criança da conversa (24h)  → individual
 *  10. nada disso                        → ambiguo
 *
 * ⚠️ `falasRecentesDaMae` — 23/11/2026. São as mensagens anteriores da mãe NA
 * MESMA conversa, da mais recente para a mais antiga, já lidas pelo chamador
 * (nenhuma consulta nova). Antes o foco olhava só a mensagem atual: a resposta
 * "é a Bia" valia um turno e o "ela" seguinte voltava a ser ambíguo — e o bloco
 * `<sobre_quem>` mandava perguntar de novo, contradizendo a conversa que o
 * próprio modelo estava lendo.
 */
export async function resolverFoco(
  supabase: SupabaseClient,
  familyId: string,
  texto: string,
  membros: Membro[],
  falasRecentesDaMae: readonly string[] = [],
): Promise<Foco> {
  const ativos = membros.filter((m) => (m.nome ?? "").trim());
  if (ativos.length === 0) return { tipo: "ambiguo", membros: [] };

  const agora = focoDoTexto(texto, ativos, false);
  if (agora) return agora;
  if (ativos.length === 1) return { tipo: "unica", membros: ativos };

  // A conversa recente, do mais novo para o mais velho: o primeiro texto que
  // decide alguma coisa vale. Limite curto — é a conversa em curso, não o
  // histórico da família.
  //
  // ⚠️ NO HISTÓRICO SÓ VALEM SINAIS FORTES (nome, plural, criança de fora).
  // Medido na bancada de 23/11: com o gênero valendo aqui, "ela acorda de
  // madrugada" (turno 2) apontava a Nina ANTES de a varredura chegar a "minha
  // terceira filha" (turno 1), e o turno 3 carregava o perfil errado. Pronome é
  // sinal fraco; numa fala antiga ele não pode passar na frente da afirmação.
  let daConversa: Foco | null = null;
  for (const anterior of falasRecentesDaMae.slice(0, 6)) {
    if (!anterior?.trim() || anterior.trim() === texto.trim()) continue;
    daConversa = focoDoTexto(anterior, ativos, false);
    if (daConversa) break;
  }
  // Criança de fora já estabelecida vence o gênero: "ela" depois de "é minha
  // terceira filha" não é a Manu.
  if (daConversa?.tipo === "externa") return daConversa;

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

  if (daConversa) return daConversa;

  const ultimo = await ultimaCriancaDaConversa(supabase, familyId);
  const achado = ultimo ? ativos.find((m) => m.id === ultimo) : null;
  if (achado) return { tipo: "individual", membros: [achado] };

  // ⚠️ NÃO ESCOLHER é a resposta certa aqui. Escolher no chute é exatamente
  // como uma informação do Mario vira fato sobre a Manu.
  return { tipo: "ambiguo", membros: ativos };
}

void TROCA_EXPLICITA;

/**
 * A CONVERSA JÁ DISSE QUE A CRIANÇA É DE FORA? — para o orquestrador.
 *
 * ⚠️ DOIS DONOS DA MESMA DECISÃO. No WhatsApp, `resolverMembroAlvo` decide
 * antes e entrega um `membroPreferidoId` que passa por cima de `resolverFoco`.
 * "Ela" depois de "é minha terceira filha" virava a Manu ali, pelo gênero.
 * Esta função usa a MESMA escada de `resolverFoco`, para que o orquestrador
 * deixe de impor uma criança cadastrada quando a conversa já a excluiu.
 */
export function criancaDeForaNaConversa(
  texto: string,
  falasRecentesDaMae: readonly string[],
  membros: Membro[],
): boolean {
  const ativos = membros.filter((m) => (m.nome ?? "").trim());
  if (ativos.length === 0) return false;
  const agora = focoDoTexto(texto, ativos, false);
  if (agora) return agora.tipo === "externa";
  for (const anterior of falasRecentesDaMae.slice(0, 6)) {
    if (!anterior?.trim() || anterior.trim() === texto.trim()) continue;
    const f = focoDoTexto(anterior, ativos, false);
    if (f) return f.tipo === "externa";
  }
  return false;
}

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
    // ⚠️ SEM OS NOMES DOS CADASTRADOS — medido em 23/11: citá-los aqui fazia o
    // modelo repeti-los ("vou considerar o Davi, e não a Nina nem o Caio").
    case "externa":
      return `<sobre_quem>A conversa é sobre uma criança que NÃO está cadastrada na família (por exemplo, outro filho, sobrinho ou criança conhecida). Nenhum perfil cadastrado vale para ela: chame-a pelo nome que a pessoa usou, use só o que a pessoa contou na conversa e NÃO pergunte de novo de quem se trata.</sobre_quem>`;
  }
}
