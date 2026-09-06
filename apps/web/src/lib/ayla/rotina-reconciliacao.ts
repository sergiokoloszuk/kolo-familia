/**
 * O RESGATE DE UM ARTEFATO ÓRFÃO — ancorado na rotina, nunca na família.
 *
 * ⚠️ A DIFERENÇA QUE DEFINE ESTE ARQUIVO. A pergunta errada é "qual tema esta
 * família falou nos últimos N dias?" — ela pesca de qualquer conversa, inclusive
 * de outra rotina, de outro filho, de outro assunto. A pergunta certa é:
 *
 *     esta rotina nasceu NESTE momento; houve DEPOIS dela uma manifestação
 *     inequívoca de tema, antes do limite, sem nada que torne isso ambíguo?
 *
 * É essa âncora que resolve a Maria Julia (rotina de 03/09, tema dito dois
 * minutos depois) sem abrir a porta para pegar tema de outra conversa.
 *
 * ⚠️ O RECONCILIADOR NÃO ADIVINHA INTENÇÃO. Ele recupera informação JÁ DITA.
 * Onde houver dúvida ele devolve `perguntar` — e uma pergunta curta é sempre
 * mais barata que um quadro com o tema errado colado na parede da criança.
 *
 * ⚠️ UMA SÓ LÓGICA, DOIS CHAMADORES. Esta função é chamada tanto pelo turno
 * reativo (a família voltou e há artefato pendente) quanto pelo background (a
 * família sumiu e o varredor achou o órfão). O cron NÃO pode ter uma segunda
 * inteligência de recuperação: se houver duas, elas divergem, e a divergência
 * aparece na tela de uma mãe.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { temaEnunciado } from "./rotina-guiada";

/**
 * ⚠️ TETO DE 7 DIAS APÓS A CRIAÇÃO DA ROTINA — e o número tem motivo de
 * produto, não de conveniência: é a duração do nosso Trial, então uma rotina
 * pedida no começo e resgatada no fim ainda pertence à mesma experiência. Cobre
 * a Maria Julia com folga (87h).
 *
 * ⚠️ E O TEMPO SOZINHO NÃO AUTORIZA NADA. Este teto é uma das cinco condições,
 * a mais fraca delas. Passar dentro da janela não é evidência; é só não estar
 * velho demais para ser considerado.
 */
export const TETO_RECONCILIACAO_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * O SILÊNCIO QUE SEPARA UMA CONVERSA DA OUTRA — 60 minutos.
 *
 * ⚠️ POR QUE A ÂNCORA NÃO PODE SER SÓ "DEPOIS DA CRIAÇÃO". A rotina é gravada
 * no FIM da condução, depois de a mãe confirmar a sequência. O tema costuma vir
 * ANTES disso, na mensagem que abre o pedido. Caso real, Karina, 06/09/2026:
 *
 *   14:42:37  "Quero uma rotina visual / Escola adventista / Tios / Peruano /
 *              Casa / Tema princesa"
 *   15:01:07  rotina "Dia com os tios" é criada, tema=null
 *
 * Dezenove minutos, a mesma conversa, o mesmo pedido. Uma âncora que só olha
 * para frente joga fora a evidência mais forte que existe — a mãe dizendo o
 * tema no ato de pedir o quadro.
 *
 * ⚠️ E POR QUE ISTO NÃO REABRE A PORTA. A janela para trás não é "N dias": é a
 * SESSÃO. Caminha-se do nascimento da rotina para trás enquanto as mensagens se
 * seguem sem um silêncio de uma hora. Uma conversa de anteontem sobre outra
 * rotina está do outro lado de horas de silêncio, e fica de fora — que é
 * exatamente o "não buscar tema da família nos últimos N dias".
 */
export const GAP_DE_SESSAO_MS = 60 * 60 * 1000;

export type Reconciliacao =
  | { decisao: "recuperar"; tema: string; evidencia: string; em: string }
  | { decisao: "perguntar"; motivo: string };

type Mensagem = { texto: string | null; created_at: string };

/**
 * O que decidir sobre UMA rotina órfã.
 *
 * Recebe as mensagens já filtradas pelo chamador para permitir teste sem banco;
 * `reconciliarRotina` abaixo é quem fala com o Supabase.
 */
/**
 * Onde começou a conversa que produziu esta rotina.
 *
 * Caminha do nascimento para trás enquanto as mensagens se encostam. O primeiro
 * silêncio maior que `GAP_DE_SESSAO_MS` é a fronteira: dali para trás é outra
 * conversa, e outra conversa não empresta tema.
 */
export function comecoDaConversaDeOrigem(mensagens: Mensagem[], nascimento: number): number {
  const anteriores = mensagens
    .map((m) => new Date(m.created_at).getTime())
    .filter((t) => Number.isFinite(t) && t <= nascimento)
    .sort((a, b) => b - a);
  let inicio = nascimento;
  for (const t of anteriores) {
    if (inicio - t > GAP_DE_SESSAO_MS) break;
    inicio = t;
  }
  return inicio;
}

export function decidirReconciliacao(params: {
  rotinaCriadaEm: string;
  /** Inbounds da família, QUALQUER janela — o filtro acontece aqui dentro. */
  mensagens: Mensagem[];
  /** Criação de outras rotinas da família, para detectar ambiguidade. */
  outrasRotinasCriadasEm?: string[];
  agora?: number;
}): Reconciliacao {
  const nascimento = new Date(params.rotinaCriadaEm).getTime();
  if (!Number.isFinite(nascimento)) {
    return { decisao: "perguntar", motivo: "rotina sem data de criação legível" };
  }
  const limite = nascimento + TETO_RECONCILIACAO_MS;
  const inicioDaSessao = comecoDaConversaDeOrigem(params.mensagens, nascimento);

  // ── CONDIÇÃO 1: POSTERIOR À CRIAÇÃO ────────────────────────────────────
  // ⚠️ O TEMA DITO ANTES DA ROTINA NASCER NÃO VALE. Ele pertence a outra
  // conversa — possivelmente a outra rotina, já entregue. Usá-lo seria
  // exatamente a "busca por família nos últimos N dias" que este arquivo
  // existe para não fazer.
  // ── CONDIÇÃO 2: DENTRO DO TETO ─────────────────────────────────────────
  const candidatas = params.mensagens
    .map((m) => ({ ...m, t: new Date(m.created_at).getTime() }))
    // A janela vai do começo da conversa que ORIGINOU a rotina até o teto.
    .filter((m) => Number.isFinite(m.t) && m.t >= inicioDaSessao && m.t <= limite)
    // Do mais NOVO para o mais antigo: com duas evidências explícitas
    // posteriores, vale a última confirmação — a família mudou de ideia.
    .sort((a, b) => b.t - a.t);

  // ── CONDIÇÃO 3: OUTRA ROTINA NO MEIO TORNA AMBÍGUO ─────────────────────
  // ⚠️ DUAS ROTINAS PRÓXIMAS NÃO CRUZAM TEMAS. Se a família criou outra rotina
  // depois desta, um tema dito DEPOIS daquela criação pertence, muito
  // provavelmente, à mais nova. Não dá para saber, e não saber = perguntar.
  const rotinaPosterior = (params.outrasRotinasCriadasEm ?? [])
    .map((d) => new Date(d).getTime())
    .filter((t) => Number.isFinite(t) && t > nascimento)
    .sort((a, b) => a - b)[0];

  // ── CONDIÇÃO 4: EVIDÊNCIA EXPLÍCITA ────────────────────────────────────
  for (const m of candidatas) {
    const tema = temaEnunciado(m.texto);
    if (!tema) continue;
    if (rotinaPosterior !== undefined && m.t > rotinaPosterior) {
      return {
        decisao: "perguntar",
        motivo: "tema dito depois de outra rotina ter nascido — associação ambígua",
      };
    }
    return { decisao: "recuperar", tema, evidencia: (m.texto ?? "").slice(0, 120), em: m.created_at };
  }

  return { decisao: "perguntar", motivo: "nenhuma manifestação explícita de tema após a criação" };
}

/**
 * A versão que fala com o banco. É ela que os DOIS chamadores usam.
 *
 * ⚠️ NÃO ESCREVE NADA. Decide e devolve. Quem aplica o tema e dispara a geração
 * é o chamador, porque só ele sabe se está num turno reativo (e vai responder à
 * família agora) ou no background (e precisa abrir a conversa).
 */
export async function reconciliarRotina(
  supabase: SupabaseClient,
  rotinaId: string,
): Promise<Reconciliacao> {
  const { data: rotina, error } = await supabase
    .from("rotinas")
    .select("id, family_account_id, created_at, cards_status, tema")
    .eq("id", rotinaId)
    .maybeSingle();
  if (error || !rotina) {
    return { decisao: "perguntar", motivo: "rotina não encontrada" };
  }
  // ── CONDIÇÃO 5: AINDA AGUARDANDO ───────────────────────────────────────
  // ⚠️ ESTADO CONFERIDO NO MOMENTO DA DECISÃO, não confiado do varredor. Entre
  // a varredura e aqui a família pode ter respondido, e sobrescrever um tema
  // que ela acabou de escolher seria o reconciliador estragando o que ele
  // deveria proteger.
  if (rotina.cards_status !== "aguardando") {
    return { decisao: "perguntar", motivo: `rotina não está mais aguardando (${rotina.cards_status})` };
  }
  if (rotina.tema) {
    return { decisao: "perguntar", motivo: "rotina já tem tema" };
  }

  const criadaEm = rotina.created_at as string;
  const teto = new Date(new Date(criadaEm).getTime() + TETO_RECONCILIACAO_MS).toISOString();
  const piso = new Date(new Date(criadaEm).getTime() - 6 * 60 * 60 * 1000).toISOString();

  const { data: msgs } = await supabase
    .from("ayla_messages")
    .select("texto, created_at")
    .eq("family_account_id", rotina.family_account_id)
    .eq("direcao", "inbound")
    // ⚠️ ALCANÇA ANTES DA CRIAÇÃO DE PROPÓSITO. O piso aqui é generoso (6h) só
    // para que `comecoDaConversaDeOrigem` tenha material para achar a fronteira
    // de sessão. Quem decide o que é da conversa é ela, não este SELECT — o
    // banco entrega o bruto, a regra recorta.
    .gte("created_at", piso)
    .lte("created_at", teto)
    .order("created_at", { ascending: false })
    .limit(120);

  const { data: outras } = await supabase
    .from("rotinas")
    .select("created_at")
    .eq("family_account_id", rotina.family_account_id)
    .neq("id", rotinaId)
    .gt("created_at", criadaEm);

  return decidirReconciliacao({
    rotinaCriadaEm: criadaEm,
    mensagens: (msgs ?? []) as Mensagem[],
    outrasRotinasCriadasEm: (outras ?? []).map((o) => o.created_at as string),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// O ATO — a única função que RESOLVE um órfão. Os dois chamadores usam esta.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A rotina órfã mais recente desta família, ou null.
 *
 * ⚠️ `aguardando` APENAS. `gerando` está em curso e resolver por cima criaria
 * duas gerações para o mesmo quadro; `erro` precisa de retry, que é outra
 * decisão, com outro limite. Este caminho trata o único estado em que falta um
 * DADO — e dado é o que o reconciliador sabe recuperar.
 */
export async function rotinaOrfaDaFamilia(
  supabase: SupabaseClient,
  familyId: string,
): Promise<{ id: string; nome: string | null; membro_atipico_id: string | null } | null> {
  const { data } = await supabase
    .from("rotinas")
    .select("id, nome, membro_atipico_id, created_at")
    .eq("family_account_id", familyId)
    .eq("cards_status", "aguardando")
    .is("tema", null)
    .order("created_at", { ascending: false })
    .limit(1);
  const r = (data ?? [])[0];
  return r ? { id: r.id as string, nome: (r.nome as string) ?? null, membro_atipico_id: (r.membro_atipico_id as string) ?? null } : null;
}

export type ResolucaoDeOrfa =
  | { tipo: "resolvida"; rotinaId: string; tema: string; evidencia: string }
  | { tipo: "perguntar"; rotinaId: string; motivo: string; nome: string | null }
  | { tipo: "falhou"; rotinaId: string; erro: string };

/**
 * RECUPERA E DISPARA — ou diz que precisa perguntar.
 *
 * ⚠️ ESTA É A "FUNÇÃO COMPARTILHADA" da missão, e é literal: o turno reativo e
 * o cron chamam ESTA, não uma cópia adaptada. Duas inteligências de recuperação
 * divergiriam — e a divergência apareceria na tela de uma mãe, que é o único
 * lugar onde ela custa alguma coisa.
 *
 * ⚠️ A ESCRITA É CONFERIDA. `.update()` do Supabase DEVOLVE o erro em vez de
 * lançar: um `await` sem checar `error` engoliria a falha e o fluxo seguiria
 * como sucesso — exatamente o modo de falha que custou o acesso da Rochelle.
 * Aqui a falha vira `falhou`, e quem chama informa em vez de prometer.
 */
export async function resolverRotinaOrfa(
  supabase: SupabaseClient,
  rotinaId: string,
  disparar: (rotinaId: string, tema: string) => Promise<boolean>,
): Promise<ResolucaoDeOrfa> {
  const decisao = await reconciliarRotina(supabase, rotinaId);
  if (decisao.decisao === "perguntar") {
    const { data } = await supabase.from("rotinas").select("nome").eq("id", rotinaId).maybeSingle();
    return { tipo: "perguntar", rotinaId, motivo: decisao.motivo, nome: (data?.nome as string) ?? null };
  }

  const { data: afetadas, error } = await supabase
    .from("rotinas")
    .update({ tema: decisao.tema, cards_status: "gerando" })
    .eq("id", rotinaId)
    // ⚠️ A GUARDA CONTRA CORRIDA. Se o cron e o turno reativo caírem juntos no
    // mesmo órfão, só um encontra a linha ainda em `aguardando`; para o outro a
    // condição não casa e a escrita não afeta linha nenhuma.
    .eq("cards_status", "aguardando")
    // ⚠️ O `.select()` NÃO É ENFEITE — é ELE que faz o UPDATE devolver as linhas
    // afetadas. Sem ele não há como distinguir "eu escrevi" de "outro escreveu
    // o mesmo valor um instante antes", e os dois donos disparariam a geração
    // para o mesmo quadro. A mãe receberia a rotina duas vezes. Descoberto pelo
    // teste de corrida, não em produção — que é onde se quer descobrir isso.
    .select("id");
  if (error) {
    return { tipo: "falhou", rotinaId, erro: error.message };
  }
  if (!afetadas || afetadas.length === 0) {
    // Não é falha a informar: é o outro dono seguindo com o trabalho. Quem
    // perde a corrida sai calado, senão a família ouve a mesma coisa duas vezes.
    return { tipo: "falhou", rotinaId, erro: "outro dono assumiu a rotina antes desta escrita" };
  }

  const ok = await disparar(rotinaId, decisao.tema);
  if (!ok) {
    await supabase.from("rotinas").update({ cards_status: "erro" }).eq("id", rotinaId);
    return { tipo: "falhou", rotinaId, erro: "disparo da geração não confirmou" };
  }
  return { tipo: "resolvida", rotinaId, tema: decisao.tema, evidencia: decisao.evidencia };
}
