import type { SupabaseClient } from "@supabase/supabase-js";
import { getAylaAnthropicClient, AYLA_MODEL_FALLBACK } from "./anthropic";
import { nucleoConducao } from "@/lib/conducao/diretrizes";
import { ORIENTACAO_DE_TRANSICAO } from "@/lib/conducao/formas";
import { gerarMagicLink } from "./ponte";
import { gerarRotina } from "@/lib/ludico/rotina-servico";
import { idadeAnos } from "@/lib/idade";
import { avaliarProntidaoParaRotina } from "./prontidao-rotina";
import { validarRotina, resumirFalhas } from "./validacao-rotina";
import {
  DIAS_LABEL,
  extrairJsonRotina,
  sanitizarRotinas,
  type RotinaProposta,
  type TarefaProposta,
} from "@/lib/ludico/rotina-ia-core";
import { rotinaParaPdf } from "@/lib/ludico/rotina-pdf";
import { enviarDocumento } from "./whatsappSender";

/**
 * Fluxo GUIADO de ROTINA (reativo): quando a pessoa pede uma rotina/planejamento
 * da semana, a Ayla manda um ESQUEMA simples ("Segunda:/Terça:/…"), a pessoa
 * preenche (mesmo solto), e a Ayla ORGANIZA na tabela da semana (cria as rotinas
 * de cada dia + tarefas) e manda o link. Estado pendente inferido do histórico
 * (tipo="rotina_pergunta"), espelhando o plano guiado e a oferta de fim de semana.
 */

/** Pedido explícito de rotina/planejamento da semana? */
export function pedeRotina(texto: string | null | undefined): boolean {
  const t = (texto ?? "").toLowerCase();
  // Gatilhos FORTES — já são pedido de rotina por si só (dispensam verbo).
  if (/rotina visual|quadro (de|da) rotina|planejamento da semana|organizar a semana|cronograma/.test(t)) {
    return true;
  }
  if (!/\brotina\b/.test(t)) return false;
  // "rotina" + intenção de criar/organizar/pedir ajuda. Usa RADICAIS pra pegar
  // conjugações que a versão anterior perdia por exigir a palavra exata:
  // "poderia" (não só "pode"), "ajudar/ajudasse" (não só "ajuda"), "gostaria",
  // "montar/monta/monte", etc. Foi o que fez "Poderia me ajudar com uma rotina"
  // cair no reativo genérico em vez do condutor.
  return (
    /\b(quer|gostar|precis|ajud|pod[ei]|mont|prepar|organiz|planej)/.test(t) ||
    /\bcri(ar|a|e)\b/.test(t) ||
    /\bfaz|\bfa[çc]a/.test(t)
  );
}

/**
 * A FAMÍLIA PEDIU UMA ROTINA COM ESSAS PALAVRAS?
 *
 * Piso determinístico do tamanho. `pedeRotina` é largo de propósito (pega quem
 * chega perdido, "tá tudo bagunçado"); este é estreito: só quem NOMEOU a rotina
 * ou disse que quer organizar um período. Quem pede assim não pode receber três
 * linhas de conselho porque o modelo achou que bastava — ela pediu o quadro.
 *
 * A Ayla ainda pode SUGERIR que uma sequência curta resolveria melhor. Sugerir
 * é conversa; rebaixar por baixo é trocar o pedido dela.
 */
export function pediuRotinaExplicitamente(texto: string | null | undefined): boolean {
  const t = (texto ?? "").toLowerCase();
  if (/rotina visual|quadro (de|da) rotina|planejamento da semana|cronograma/.test(t)) return true;
  // "organizar a tarde/manhã/noite/o dia/a semana" — período nomeado.
  if (
    /\b(organiz|mont|arrum|estrutur)\w*\s+(a|o|as|os|minha|meu|nossa|nosso)?\s*(tarde|manh[ãa]|noite|dia|semana|rotina)\b/.test(
      t,
    )
  ) {
    return true;
  }
  // "quero/preciso de uma rotina", "faz a rotina da tarde"
  return /\brotina\b/.test(t) && /\b(quer|gostar|precis|ajud|pod[ei]|mont|faz|fa[çc]a|cri(ar|a|e))/.test(t);
}

/**
 * A FAMÍLIA QUER IMPRIMIR?
 *
 * Decisão de produto (Sérgio, 03/08/2026): toda Rotina tem entrega concreta,
 * mas nem toda Rotina precisa de PDF. A rotina no app JÁ é o artefato. O PDF
 * era automático só porque o canal era WhatsApp — e isso é gerar arquivo pra
 * provar que gerou.
 */
export function pediuParaImprimir(texto: string | null | undefined): boolean {
  const t = (texto ?? "").toLowerCase();
  return /imprim|impress|pdf|papel|colar|(na|pra|para a) (parede|geladeira)|plastific/.test(
    t,
  );
}

/**
 * A FAMÍLIA PEDIU O APOIO VISUAL COM ESSAS PALAVRAS?
 *
 * Piso do `visual`, irmão do piso do tamanho. Quem diz "rotina visual" ou
 * "cartões" está pedindo o apoio visual, e isso não se discute com o modelo.
 *
 * O caminho contrário NÃO existe: não pedir com essas palavras não zera nada —
 * a evidência no perfil ("ele entende melhor quando vê") continua valendo.
 */
export function pediuApoioVisual(texto: string | null | undefined): boolean {
  const t = (texto ?? "").toLowerCase();
  // `\b` não basta pra "card": "cardápio" tem fronteira antes do á.
  return /visual|cart(ão|ões|ao|oes)|\bcards?(?![a-zà-ú])|figurinha|pictogram|com (figuras|imagens|desenhos)/.test(
    t,
  );
}

/** Há uma conversa de rotina em andamento? (último outbound tipo=rotina_conversa sem resposta ainda) */
export async function rotinaConversaPendente(
  supabase: SupabaseClient,
  familyId: string,
  agora: Date,
): Promise<{ membroId: string | null } | null> {
  const limite = new Date(agora.getTime() - 48 * 60 * 60 * 1000);
  const { data: perguntas } = await supabase
    .from("ayla_messages")
    .select("created_at, membro_atipico_id")
    .eq("family_account_id", familyId)
    .eq("tipo", "rotina_conversa")
    .eq("direcao", "outbound")
    .gte("created_at", limite.toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  const p = perguntas?.[0];
  if (!p) return null;

  const { data: respostas } = await supabase
    .from("ayla_messages")
    .select("id")
    .eq("family_account_id", familyId)
    .eq("direcao", "inbound")
    .gt("created_at", p.created_at as string)
    .limit(1);
  if ((respostas?.length ?? 0) > 0) return null;

  return { membroId: (p.membro_atipico_id as string | null) ?? null };
}

/**
 * O QUE JÁ SABEMOS — perfil, desafios que a própria família marcou no onboarding,
 * e a rotina que já existe. Sem isto o condutor só tinha nome, idade e interesses,
 * e por isso re-perguntava o que a família já tinha contado (caso Maria Iasmin) e
 * ignorava a rotina que ela mesma acabara de descrever (caso Mateus).
 *
 * Tudo best-effort: se uma consulta falhar, o bloco some e a conversa segue.
 */
async function carregarOQueJaSabemos(
  supabase: SupabaseClient,
  membroId: string,
): Promise<{ perfil: string; desafios: string[]; rotinaExistente: string }> {
  const vazio = { perfil: "", desafios: [] as string[], rotinaExistente: "" };
  try {
    const [pv, rots] = await Promise.all([
      supabase
        .from("perfil_vivo_membro")
        .select("categorias_extras")
        .eq("membro_atipico_id", membroId)
        .maybeSingle(),
      supabase
        .from("rotinas")
        .select("id, nome, dia_semana")
        .eq("membro_atipico_id", membroId)
        .order("created_at", { ascending: false })
        .limit(3),
    ]);

    const ce = (pv.data?.categorias_extras ?? {}) as Record<string, unknown>;
    // Os desafios são o que a FAMÍLIA marcou — informação relatada, não
    // diagnóstico e não inferência da Ayla.
    const desafios = Array.isArray(ce.desafios_onboarding)
      ? (ce.desafios_onboarding as unknown[]).map(String).filter(Boolean).slice(0, 6)
      : [];

    // Um resumo curto do perfil: só o que ajuda a montar um dia.
    const interessantes = ["rotina", "sono", "alimentacao", "sensorial", "comunicacao", "emocional"];
    const perfil = interessantes
      .map((k) => {
        const v = ce[k];
        return typeof v === "string" && v.trim() ? `${k}: ${v.trim().slice(0, 180)}` : null;
      })
      .filter(Boolean)
      .join("\n");

    let rotinaExistente = "";
    const linhas = (rots.data ?? []) as Array<{ id: string; nome: string; dia_semana: number | null }>;
    if (linhas.length) {
      const { data: tarefas } = await supabase
        .from("rotina_tarefas")
        .select("rotina_id, texto, hora, ordem")
        .in("rotina_id", linhas.map((r) => r.id))
        .order("ordem", { ascending: true });
      rotinaExistente = linhas
        .map((r) => {
          const t = ((tarefas ?? []) as Array<{ rotina_id: string; texto: string; hora: string | null }>)
            .filter((x) => x.rotina_id === r.id)
            .map((x) => `${x.hora ? `${x.hora} ` : ""}${x.texto}`)
            .join(" → ");
          return t ? `${r.nome}: ${t}` : null;
        })
        .filter(Boolean)
        .join("\n");
    }

    return { perfil, desafios, rotinaExistente };
  } catch {
    return vazio;
  }
}

/**
 * Idade em MESES. `idadeAnos` devolve 0 pra bebê de 18 dias e pra bebê de 11
 * meses igualmente — e a diferença entre os dois é justamente o que decide se
 * uma pergunta de rotina é, no fundo, clínica.
 */
function idadeEmMeses(nascimento: string | null): number | null {
  if (!nascimento) return null;
  const d = new Date(nascimento);
  if (Number.isNaN(d.getTime())) return null;
  const meses = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  return meses < 0 || meses > 1200 ? null : Math.floor(meses);
}

/** Interesses conhecidos da criança (pra a Ayla PROPOR um tema). Best-effort. */
async function carregarInteresses(supabase: SupabaseClient, membroId: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("perfil_vivo_membro")
      .select("categorias_extras")
      .eq("membro_atipico_id", membroId)
      .maybeSingle();
    const ce = (data?.categorias_extras ?? {}) as Record<string, unknown>;
    const cand =
      (ce?.como_e as Record<string, unknown> | undefined)?.interesses ??
      (ce?.preferencias as Record<string, unknown> | undefined)?.temas ??
      null;
    const parts: string[] = [];
    if (Array.isArray(cand)) parts.push(...cand.map((x) => String(x)));
    else if (typeof cand === "string") parts.push(cand);
    return parts.length ? parts.slice(0, 8).join(", ") : null;
  } catch {
    return null;
  }
}

type Transicao = {
  momento: string;
  estrategia: string | null;
  funcionou?: boolean | null;
  /** Momento que a rotina sozinha NÃO resolve (ex.: ansiedade de separação) →
   *  semente pra a Ayla voltar depois e oferecer um PLANO de ação. */
  merece_plano?: boolean | null;
  atualizado_em?: string;
};

/** Transições difíceis já aprendidas (do Kolo Vivo) — pra a Ayla já chegar sabendo. */
async function carregarTransicoes(supabase: SupabaseClient, membroId: string): Promise<Transicao[]> {
  try {
    const { data } = await supabase
      .from("perfil_vivo_membro")
      .select("categorias_extras")
      .eq("membro_atipico_id", membroId)
      .maybeSingle();
    const ce = (data?.categorias_extras ?? {}) as Record<string, unknown>;
    const arr = Array.isArray(ce.transicoes) ? (ce.transicoes as unknown[]) : [];
    return arr
      .map((t) => {
        const o = (t ?? {}) as Record<string, unknown>;
        const momento = String(o.momento ?? "").trim();
        if (!momento) return null;
        return {
          momento: momento.slice(0, 60),
          estrategia: o.estrategia ? String(o.estrategia).slice(0, 120) : null,
          funcionou: typeof o.funcionou === "boolean" ? o.funcionou : null,
          merece_plano: typeof o.merece_plano === "boolean" ? o.merece_plano : null,
        } as Transicao;
      })
      .filter((t): t is Transicao => t != null)
      .slice(0, 12);
  } catch {
    return [];
  }
}

/** Mescla novas transições no Kolo Vivo (por momento) — auto-incorporação. */
async function salvarTransicoes(
  supabase: SupabaseClient,
  membroId: string,
  novas: Transicao[],
): Promise<void> {
  try {
    if (!novas.length) return;
    const { data } = await supabase
      .from("perfil_vivo_membro")
      .select("categorias_extras")
      .eq("membro_atipico_id", membroId)
      .maybeSingle();
    const ce = (data?.categorias_extras ?? {}) as Record<string, unknown>;
    const atuais = Array.isArray(ce.transicoes) ? (ce.transicoes as Transicao[]) : [];
    const porMomento = new Map<string, Transicao>();
    for (const t of atuais) if (t?.momento) porMomento.set(t.momento.toLowerCase(), t);
    for (const n of novas) {
      if (!n.momento) continue;
      const key = n.momento.toLowerCase();
      const antigo = porMomento.get(key);
      porMomento.set(key, {
        momento: n.momento.slice(0, 60),
        estrategia: (n.estrategia ?? antigo?.estrategia ?? null)?.slice(0, 120) ?? null,
        funcionou: n.funcionou ?? antigo?.funcionou ?? null,
        merece_plano: n.merece_plano ?? antigo?.merece_plano ?? null,
      });
    }
    const merged = Array.from(porMomento.values()).slice(0, 20);
    // Só atualiza linha existente (evita insert sem family_account_id). Sem linha,
    // o Kolo Vivo é criado por outros fluxos; a transição entra na próxima.
    if (data) {
      await supabase
        .from("perfil_vivo_membro")
        .update({ categorias_extras: { ...ce, transicoes: merged } })
        .eq("membro_atipico_id", membroId);
    }
  } catch (e) {
    console.warn("[ayla:rotina-guiada] salvar transições falhou:", e instanceof Error ? e.message : e);
  }
}

/**
 * O CONTRATO da ferramenta de rotina — e SÓ ele.
 *
 * Até 02/08/2026 este arquivo tinha um prompt próprio e completo, que não
 * carregava `nucleoConducao()`. Era uma segunda Ayla: perguntava demais, falava
 * diferente do resto da conversa e não herdava "direção antes de investigação".
 * Metade do texto duplicava o núcleo — "não re-pergunte o que ela já respondeu",
 * "não invente preferências", "tom quente, curto, NUNCA formulário", "UMA
 * pergunta por vez", "CONVIRJA" — tudo isso já é princípio 6 e VOZ 2/3/5.
 *
 * O que sobrou aqui é o que o núcleo não tem como saber: o formato do JSON, o
 * shape de `rotinas`/`transicoes`, e o fato de que o sistema anexa PDF e link
 * quando a ação é "montar".
 */
const CONTRATO_ROTINA = `# Você está conduzindo uma ROTINA

Tudo acima continua valendo — identidade, princípios, fronteiras e VOZ. Isto aqui
é só o CONTRATO da ferramenta de rotina, não uma segunda Ayla.

## Escolha UM desfecho por turno e devolva APENAS JSON, sem texto fora dele:
{"acao":"responder"|"perguntar"|"montar"|"sair","mensagem":"sua fala (WhatsApp)","tema":null,"transicoes":[],"rotinas":[]}

- "responder" — ela fez uma PERGUNTA sobre a rotina ("qual horário encaixo o iPad?", "como você faria a tarde?"). RESPONDA com o que você já sabe: a sequência que ela contou, os horários, a dificuldade que ela relatou. Proponha, explique em uma frase por que, e diga que dá pra ajustar. NÃO devolva a próxima pergunta do roteiro — isso é ignorar o que ela perguntou.
- "perguntar" — falta UMA informação que muda a rotina de verdade. Uma só.
- "montar" — você tem sequência suficiente pra uma primeira versão. Preencha "rotinas".
- "sair" — a mensagem NÃO é mais sobre a rotina (ela mudou de assunto: pediu atividades, contou outra coisa, trouxe outro problema). Devolva "sair" e deixe "mensagem" vazia — outra parte da Ayla responde. NUNCA diga "antes precisamos terminar a rotina": quem manda no assunto é ela.

## A FAMÍLIA NÃO SABE O QUE PEDIR — quem guia é você
Ninguém chega dizendo "quero uma rotina visual semanal". Chega dizendo "preciso de uma rotina", "tá tudo bagunçado aqui", "ele não tem rotina nenhuma", "não sei nem por onde começar". Ela não conhece o produto, e não deveria precisar conhecer.

PEDIDO GENÉRICO → ofereça caminhos concretos, em linguagem de gente, e espere ela escolher. Nada de menu numerado rígido nem jargão: são possibilidades numa frase cada — organizar um período do dia (manhã, depois da escola, noite), o dia inteiro, um momento difícil específico (sair do celular, começar a lição, ir dormir), ou um dia especial (passeio, festa, médico). Escolha as que fazem sentido pra ESTA família; não recite as quatro sempre.

PEDIDO JÁ CLARO → NÃO mostre caminho nenhum. "quero organizar a tarde depois da escola" já disse tudo: vá direto.

DEPOIS QUE ELA ESCOLHE, ensine o mínimo — sem virar formulário. Diga o que você precisa saber, em uma frase, e tire dela o peso de organizar: "me conta como é hoje, mesmo bagunçado — pode mandar áudio, que eu organizo". Pra um dia inteiro, o que importa é a sequência do que acontece, os horários que realmente mandam (escola, terapia, atividade fixa) e onde costuma travar. Diga isso do jeito que uma pessoa diria, não como três campos.

E ANTES DE PERGUNTAR QUALQUER COISA, olhe o que você já tem. A frase que a família precisa ouvir é "eu já sei X e Y, só me falta Z" — nunca "me conta a rotina toda de novo". Se o perfil já traz o horário da escola e o ponto difícil, isso não se pergunta.

## ROTINA VISUAL É UMA COISA. PLANO É OUTRA. Nunca confunda as duas.
ROTINA VISUAL = o que acontece, em que ordem, com os horários que a família deu, e um apoio curto no momento difícil. Serve pra deixar claro o que vem AGORA e o que vem DEPOIS.
PLANO ESTRATÉGICO = compreensão do desafio, estratégias amplas, atividades, frases, o que observar.

Quem pediu rotina recebe ROTINA. Aconteceu o contrário em produção (03/08/2026): a mãe pediu a rotina da tarde, a Ayla falou em "plano estratégico", disse que a rotina estava pronta, e o que chegou foi um PDF de PLANO. Ela pediu uma coisa e recebeu outra.

- NUNCA chame a rotina de "plano estratégico", nem ofereça "um plano com essa rotina visual".
- NUNCA diga que os cartões foram enviados: eles ficam DENTRO da rotina, no app.
- NUNCA diga "está pronta" antes de existir, nem prometa que "vai chegar".

ANTES DE MONTAR (só quando já dá pra montar), diga em duas ou três linhas o que você vai fazer — é assim que a família aprende o que é a Rotina Visual:
"Já dá pra montar a rotina da tarde do Mario. Vou organizar cada dia com a sequência das atividades e usar os horários que você me passou; onde não houver horário fixo, deixo só a ordem, pra não inventar precisão. A Rotina Visual serve justamente pra ficar claro o que vem agora e o que vem depois."

DEPOIS QUE EXISTE, mostre o que foi personalizado — os dias, a sequência, os horários que ELA deu, e a transição difícil quando houver. Não invente sumário: só cite o que está mesmo lá.

## AYLA SEMPRE ENTREGA — ajuda útil, não necessariamente artefato
"Sempre entrega" quer dizer que a família NUNCA fica sem nada de concreto. NÃO quer dizer gerar um quadro em toda conversa. A melhor ajuda é a MENOR que resolve: às vezes é conduzir uma passagem (antes/durante/depois), às vezes é uma sequência curta de 2 a 4 etapas, às vezes é o período inteiro organizado. Quem decide o tamanho é o porteiro, e ele já decidiu quando você chega aqui.
Se já dá pra montar uma primeira versão, MONTE — não peça confirmação antes. Ela vê a rotina no texto e ajusta o que quiser depois; é mais rápido corrigir algo pronto do que responder mais perguntas. Horário que ela não deu, você PROPÕE a partir do que sabe (chegada, escola, atividade fixa) e deixa claro que é sugestão. Só não invente horário quando não há nada em que se apoiar.
Ponha uma dica curta NO PONTO DIFÍCIL — o momento que ela relatou, ou a transição que você já conhece do perfil. Uma ou duas, não uma aula. Quando fizer sentido, uma brincadeira ou atividade simples ancorada nos interesses dele.
TEMA dos cartões é OPCIONAL e NUNCA atrasa a entrega: se você conhece um interesse, proponha junto; se não, monte sem tema e ofereça depois. E tema NÃO é motivo pra existir cartão — o cartão existe quando VER a sequência ajuda a criança; o tema só personaliza o que já ia existir. A atividade tem que continuar reconhecível: primeiro se entende que é BANHO, depois é que ele é um dinossauro.

## Formato dos dados
rotinas: [{"nome":"Dia com a vovó","dia_semana":null,"tarefas":[{"texto":"acordar","hora":null}]}]
dia_semana: 0=Seg..6=Dom, ou null pra dia avulso/nomeado. "hora" é opcional (null quando não houver base).
transicoes: [{"momento":"banho","estrategia":"música depois","funcionou":null,"merece_plano":false}] — o que você descobriu sobre momentos difíceis fica no perfil e você reusa. Marque "funcionou" quando ela disser que deu certo ou não. Se o momento for algo que a rotina sozinha NÃO resolve (ansiedade de separação, crise intensa, recusa alimentar séria), diga isso em uma frase e marque "merece_plano":true.

## Quando "montar": o sistema anexa o link, e cuida sozinho de cartões e PDF
Sua "mensagem" mostra a rotina no texto (a sequência, com os horários) e confirma o que foi feito — no passado, não no futuro. NUNCA escreva "vou montar", "vou gerar", "vou te mandar" ou "vai aparecer": quando você devolve "montar", já está feito.
NÃO diga que mandou PDF, nem que os cartões estão sendo gerados: isso depende da necessidade e do que ela pediu, e o sistema acrescenta a frase certa depois da sua. Se você anunciar um arquivo que não saiu, ela vai procurar no celular e não vai achar. A entrega concreta é a ROTINA — o PDF é opção de impressão pra quem quer colar na parede.`;

/** Cria/reusa uma rotina (por nome+dia), aplica o tema e grava as tarefas. */
async function aplicarRotina(
  supabase: SupabaseClient,
  familyId: string,
  membroAtipicoId: string,
  r: RotinaProposta,
  tema: string | null,
  /**
   * A rotina abre em cartões ou em lista? Até 03/08/2026 a Ayla não escrevia
   * este campo, e a tela caía no default "cartoes" — então TODA rotina abria
   * numa grade de cartões vazios, com o cabeçalho dizendo "Rotina Visual",
   * mesmo quando ninguém tinha decidido que ali cabia apoio visual.
   */
  visual = false,
): Promise<string | undefined> {
  const nome = r.nome.trim() || "Rotina";
  let q = supabase
    .from("rotinas")
    .select("id")
    .eq("membro_atipico_id", membroAtipicoId)
    .eq("family_account_id", familyId)
    .eq("nome", nome);
  q = r.dia_semana === null ? q.is("dia_semana", null) : q.eq("dia_semana", r.dia_semana);
  const { data: existe } = await q.maybeSingle();
  let rotinaId = existe?.id as string | undefined;
  if (!rotinaId) {
    const { data: nova } = await supabase
      .from("rotinas")
      .insert({
        family_account_id: familyId,
        membro_atipico_id: membroAtipicoId,
        nome,
        dia_semana: r.dia_semana,
        tema: tema || null,
        modo_exibicao: visual ? "cartoes" : "lista",
      })
      .select("id")
      .single();
    rotinaId = nova?.id as string | undefined;
  } else if (tema) {
    // tema mudou → cartões (temáticos) precisam ser regerados
    await supabase
      .from("rotinas")
      .update({ tema, cards_status: "nenhum", modo_exibicao: visual ? "cartoes" : "lista" })
      .eq("id", rotinaId);
  } else if (visual) {
    // Virou visual numa rodada seguinte: a tela acompanha. O caminho contrário
    // não existe — se a mãe já escolheu ver em cartões, não desfazemos.
    await supabase.from("rotinas").update({ modo_exibicao: "cartoes" }).eq("id", rotinaId);
  }
  if (!rotinaId) return undefined;
  await supabase.from("rotina_tarefas").delete().eq("rotina_id", rotinaId);
  const rows = r.tarefas.slice(0, 25).map((t, i) => ({
    rotina_id: rotinaId,
    texto: t.texto.slice(0, 120),
    hora: t.hora ? t.hora.slice(0, 10) : null,
    icone: null,
    ordem: i,
  }));
  if (rows.length) await supabase.from("rotina_tarefas").insert(rows);
  return rotinaId;
}

/** Gera o PDF da rotina, sobe no Storage e manda como documento. Silencioso. */
async function entregarPdfDaRotina(
  supabase: SupabaseClient,
  params: {
    familyId: string;
    phoneE164: string;
    nome: string;
    tema: string | null;
    rotinas: RotinaProposta[];
    /** O momento que a família relatou como difícil. Vem da conversa. */
    pontoDificil?: string | null;
    /** A estratégia que a Ayla já definiu pra esse momento — NÃO é um texto
     *  novo: é a mesma `transicoes[].estrategia` que ela guarda no Kolo Vivo.
     *  Reaproveitar evita uma segunda fonte de verdade. */
    fraseDeApoio?: string | null;
  },
): Promise<void> {
  try {
    const comDia = params.rotinas.filter((r) => r.dia_semana != null);
    const semDia = params.rotinas.filter((r) => r.dia_semana == null);
    const ordenadas = [
      ...comDia.sort((a, b) => (a.dia_semana ?? 0) - (b.dia_semana ?? 0)),
      ...semDia,
    ];
    const dias = ordenadas.map((r) => ({
      nome: r.nome || (r.dia_semana != null ? DIAS_LABEL[r.dia_semana] : "Rotina"),
      tarefas: r.tarefas,
    }));
    const semana = comDia.length > 0;
    const titulo = semana ? "Rotina da semana" : ordenadas[0]?.nome || "Rotina";
    const bytes = await rotinaParaPdf({
      titulo,
      nome: params.nome,
      tema: params.tema,
      // A PERSONALIZAÇÃO CHEGA AO ARTEFATO. Até aqui o ponto difícil era
      // coletado, ia pro gerador, e parava — o bloco "UMA AJUDA NESTA
      // TRANSIÇÃO" existia no layout e nunca era preenchido em produção. A mãe
      // percebia a personalização na conversa e não a via no PDF.
      pontoDificil: params.pontoDificil ?? null,
      fraseDeApoio: params.fraseDeApoio ?? null,
      dias,
    });

    const path = `${params.familyId}/rotina/${crypto.randomUUID()}.pdf`;
    const { error: upErr } = await supabase.storage
      .from("imagens")
      .upload(path, Buffer.from(bytes), { contentType: "application/pdf", upsert: false });
    if (upErr) throw upErr;
    const { data: signed } = await supabase.storage.from("imagens").createSignedUrl(path, 3600);
    if (!signed?.signedUrl) throw new Error("sem signed url");
    const fileName = `rotina-${params.nome}`.replace(/[^\w\sÀ-ÿ-]/g, "").slice(0, 40).trim() + ".pdf";
    await enviarDocumento({ phoneE164: params.phoneE164, url: signed.signedUrl, fileName });
  } catch (e) {
    console.warn("[ayla:rotina-guiada] falha no PDF:", e instanceof Error ? e.message : e);
  }
}

/** Dispara a geração dos cartões (endpoint interno) — a Ayla não gera direto
 * (mundo separado de /lib/ia). Best-effort; roda em segundo plano no app. */
async function dispararGeracao(
  rotinaId: string,
  tema: string,
  opts?: { preservarArte?: boolean },
): Promise<void> {
  try {
    const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
    const secret = process.env.AYLA_WEBHOOK_SECRET;
    await fetch(`${base}/api/ludico/gerar-rotina`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(secret ? { "x-ayla-secret": secret } : {}) },
      body: JSON.stringify({ rotinaId, tema, preservarArte: opts?.preservarArte === true }),
    });
  } catch (e) {
    console.warn("[ayla:rotina-guiada] disparar geração falhou:", e instanceof Error ? e.message : e);
  }
}

/**
 * CONDUZ a conversa de rotina (natural, estratégica, um passo por vez). A IA
 * decide a próxima fala e, quando tem o suficiente, MONTA — aí a gente cria as
 * rotinas + aplica o tema + manda o PDF, e devolve a mensagem final com o link.
 * Enquanto não está pronto, devolve só a próxima pergunta (pronto=false).
 */
export async function conduzirRotina(
  supabase: SupabaseClient,
  params: { familyId: string; membroAtipicoId: string; contexto: string; phoneE164?: string | null },
): Promise<{ mensagem: string; pronto: boolean; aguardandoTema?: boolean } | null> {
  try {
    if (!params.contexto.trim()) return null;

    const { data: membro } = await supabase
      .from("membros_atipicos")
      .select("family_account_id, nome, data_nascimento")
      .eq("id", params.membroAtipicoId)
      .maybeSingle();
    if (!membro) return null;
    const familyId = (membro.family_account_id as string) ?? params.familyId;
    const nome = (membro.nome as string) ?? "seu filho";
    const idade = idadeAnos((membro.data_nascimento as string | null) ?? null);
    const interesses = await carregarInteresses(supabase, params.membroAtipicoId);

    // Conversa desta sessão (ambas as direções, últimos 60 min) — pra a IA saber
    // o que já perguntou e o que a mãe já respondeu.
    // 12h, não 60min. A janela curta era a causa nº 1 da repetição: numa conversa
    // de WhatsApp que se estende, tudo que a mãe respondeu antes disso sumia e o
    // condutor voltava a perguntar "que horas ela acorda?".
    const desde = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const { data: msgs } = await supabase
      .from("ayla_messages")
      .select("texto, direcao, tipo, created_at")
      .eq("family_account_id", familyId)
      .gte("created_at", desde)
      .order("created_at", { ascending: true })
      .limit(40);
    const historico = (msgs ?? [])
      .map((m) => ({
        de: (m.direcao === "inbound" ? "mae" : "kolo") as "mae" | "kolo",
        texto: ((m.texto as string) ?? "").trim(),
        tipo: (m.tipo as string | null) ?? null,
      }))
      .filter((h) => h.texto);
    if (!historico.some((h) => h.de === "mae" && h.texto === params.contexto.trim())) {
      historico.push({ de: "mae", texto: params.contexto.trim(), tipo: null });
    }

    // ── O QUE PERTENCE A ESTA ROTINA ───────────────────────────────────────
    // As 12h existem pra a Ayla não re-perguntar o que a mãe já respondeu NESTA
    // conversa. Só que tudo dentro delas virava matéria-prima da rotina — e foi
    // assim que "quero organizar a tarde da Manu" saiu com passeio de barco e
    // protetor solar, herdados de uma conversa de horas antes.
    //
    // A fronteira: a conversa de rotina em curso começa depois da última fala
    // da Ayla que NÃO era de rotina. O que veio antes disso é outro assunto —
    // conhece a criança, não compõe o dia.
    let inicio = 0;
    for (let i = historico.length - 1; i >= 0; i--) {
      const h = historico[i]!;
      if (h.de === "kolo" && h.tipo && h.tipo !== "rotina_conversa") {
        inicio = i + 1;
        break;
      }
    }
    const historicoDaRotina = historico.slice(inicio);

    const transicoesConhecidas = await carregarTransicoes(supabase, params.membroAtipicoId);
    const transicoesTxt = transicoesConhecidas.length
      ? transicoesConhecidas
          .map((t) => `${t.momento}${t.estrategia ? ` → ${t.estrategia}` : ""}${t.funcionou === false ? " (não funcionou, tentar outra)" : ""}`)
          .join("; ")
      : "";

    const jaSabemos = await carregarOQueJaSabemos(supabase, params.membroAtipicoId);

    // Todos os membros da família — só pra guarda de identidade comparar nomes.
    const { data: irmaosRaw } = await supabase
      .from("membros_atipicos")
      .select("id, nome")
      .eq("family_account_id", familyId)
      .eq("ativo", true);
    const irmaos = (irmaosRaw ?? []) as Array<{ id: string; nome: string | null }>;

    // ── PORTÃO 1: ISTO DEVE VIRAR ROTINA AGORA? ────────────────────────────
    // Roda ANTES de qualquer montagem. Até 03/08/2026 quem decidia era o
    // próprio modelo, no meio da geração — e foi assim que uma bebê de 18 dias
    // ganhou uma rotina com intervalo entre mamadas, em PDF.
    const linhas = (hs: typeof historico) =>
      hs.map((h) => `${h.de === "mae" ? "Mãe" : "Ayla"}: ${h.texto}`).join("\n");
    const conversaTxt = linhas(historicoDaRotina);
    // O que veio ANTES desta conversa entra rotulado como o que é: contexto.
    // Assim a prontidão consegue julgar "ela apontou pro que já contou?" sem
    // confundir aquilo com a sequência de agora.
    const anteriorTxt = inicio > 0 ? linhas(historico.slice(0, inicio)) : "";
    const prontidao = await avaliarProntidaoParaRotina({
      mensagem: params.contexto,
      conversa: conversaTxt,
      contexto: [
        jaSabemos.perfil,
        jaSabemos.rotinaExistente,
        transicoesTxt,
        anteriorTxt
          ? `CONVERSA ANTERIOR (outro assunto — contexto, NÃO é a sequência de agora):\n${anteriorTxt}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
      idadeMeses: idadeEmMeses((membro.data_nascimento as string | null) ?? null),
    });
    // ── PISO DO TAMANHO ────────────────────────────────────────────────────
    // Quem pediu a rotina com todas as letras recebe rotina. O modelo pode
    // achar que uma sequência curta bastaria — e pode DIZER isso na conversa —,
    // mas não troca o pedido dela por baixo.
    const pedidoExplicito = pediuRotinaExplicitamente(params.contexto);
    // Em qualquer momento da conversa: o "manda com os cartões" costuma vir um
    // turno depois do pedido da rotina.
    // SÓ O PEDIDO EM CURSO. Varria as 12h — e "cartões" dito três horas antes,
    // em outro assunto, ligava o visual de uma rotina que ninguém pediu visual.
    const historicoPediuVisual = historicoDaRotina.some(
      (h) => h.de === "mae" && pediuApoioVisual(h.texto),
    );
    const tamanho = pedidoExplicito ? "rotina" : prontidao.tamanho;
    // O apoio visual segue a NECESSIDADE, com um piso: quem pediu "rotina
    // visual" ou "cartões" recebe. Pedir rotina, sozinho, não pede cartão —
    // a rotina no app já é a entrega, e imagem que não serve custa e polui.
    const visual = prontidao.visual || historicoPediuVisual;
    console.log(
      `[ayla:rotina] prontidão=${prontidao.desfecho} tamanho=${tamanho}${
        pedidoExplicito && prontidao.tamanho !== "rotina" ? ` (piso: modelo disse ${prontidao.tamanho})` : ""
      } visual=${prontidao.visual} motivo="${prontidao.motivo}"`,
    );

    // Não é rotina: sai e deixa o reativo responder. Mesmo caminho do "sair".
    if (prontidao.desfecho === "nao_e_rotina") return null;

    // ── ORIENTAÇÃO: A MENOR AJUDA ──────────────────────────────────────────
    // A passagem se resolve com o adulto conduzindo. Nada é montado, nada é
    // persistido, nada é impresso — e a família não fica sem resposta, que era
    // o que acontecia quando isto caía em `nao_e_rotina`.
    const soOrientacao = tamanho === "orientacao" && prontidao.desfecho === "suficiente";

    // ── UMA DECISÃO SÓ ─────────────────────────────────────────────────────
    // Havia duas: a prontidão dizia "suficiente" e o condutor ainda escolhia
    // entre perguntar e montar. Foi assim que o Caso 1 gastou um turno a mais
    // pedindo o horário do banho depois de a mãe já ter dado a sequência — e é
    // a porta pela qual o interrogatório de 35 turnos volta.
    const deveMontar = prontidao.desfecho === "suficiente" && !soOrientacao;

    const userPrompt = [
      prontidao.desfecho === "falta_escopo"
        ? `ELA AINDA NÃO DISSE O QUE QUER ORGANIZAR. NÃO pergunte dado nenhum — nem idade, nem horário, nem qual criança. OFEREÇA CAMINHOS, do jeito descrito acima, e espere ela escolher. acao="perguntar".`
        : "",
      prontidao.desfecho === "falta" && prontidao.pergunta
        ? `AINDA FALTA UMA COISA pra montar: ${prontidao.pergunta}\nFaça ESSA pergunta, do seu jeito — UMA só —, e NÃO monte a rotina neste turno (acao="perguntar").`
        : "",
      soOrientacao ? ORIENTACAO_DE_TRANSICAO : "",
      // VAI HAVER CARTÃO. Então o tema volta a ser proposto — de verdade, com
      // o interesse na mão. A frente ROTINA tirou o passo "SEMPRE pergunte o
      // tema antes de montar" porque ele SEGURAVA a entrega; junto foi embora
      // o "proponha proativamente", e o resultado em produção foi cartão sem
      // tema — ou, pior, cartão nenhum, já que o disparo dependia dele.
      visual
        ? `OS CARTÕES ILUSTRADOS VÃO SAIR nesta rotina. PROPONHA O TEMA na mesma mensagem em que entrega, sem segurar nada e sem pedir confirmação: puxe do que ele ama${interesses ? ` (você já sabe: ${interesses})` : ""} e escreva no campo "tema". Se você não conhece nenhum interesse, ofereça uma ou duas ideias na fala ("quer no tema de dinossauros ou de carrinhos?") e deixe "tema" null — a mãe responde e o sistema aplica. O tema é o que faz os cartões terem a cara dele; entregar sem propor é entregar menos.`
        : "",
      deveMontar
        ? `JÁ DÁ PRA MONTAR — a criança, o pedaço do dia e a sequência já estão na mesa. acao="montar", obrigatoriamente. NÃO faça mais nenhuma pergunta neste turno: horário, ponto difícil, tema e transição enriquecem, mas NÃO seguram a entrega. O que faltar, ela ajusta depois em cima do que já existe.`
        : "",
      tamanho === "mini" && prontidao.desfecho === "suficiente"
        ? `TAMANHO: SEQUÊNCIA CURTA. O que ajuda aqui é a criança VER a passagem, não o dia inteiro organizado. Monte de 2 a 4 etapas, só o trecho que trava (ex.: videogame → guardar → banho → pijama). Não estenda pro resto do dia, mesmo que você saiba como ele é. acao="montar".`
        : "",
      prontidao.desfecho === "limite_atuacao"
        ? `LIMITE DE ATUAÇÃO — esta parte é de quem acompanha a criança, não sua: ${prontidao.parteClinica ?? "decisão clínica"}.\nOrganize TUDO o que é organização (sequência, banho, trocas, descanso, registros, logística) e NÃO decida a parte clínica. Pergunte o que o profissional já orientou e use como a família contar, sem reinterpretar. Não desista da rotina por causa disso — o que dá pra organizar já ajuda.`
        : "",
      `CRIANÇA/ADOLESCENTE/ADULTO: ${nome}${idade != null ? ` (${idade} anos)` : ""}.`,
      interesses ? `INTERESSES CONHECIDOS (pra propor tema): ${interesses}` : "",
      jaSabemos.desafios.length
        ? `DESAFIOS QUE A FAMÍLIA MARCOU NO CADASTRO (relato dela, não diagnóstico): ${jaSabemos.desafios.join(", ")}`
        : "",
      jaSabemos.perfil ? `PERFIL (o que já sabemos — NÃO re-pergunte):
${jaSabemos.perfil}` : "",
      jaSabemos.rotinaExistente
        ? `ROTINA QUE JÁ EXISTE (use como base; se ela perguntar sobre a rotina, é ESTA):
${jaSabemos.rotinaExistente}`
        : "",
      transicoesTxt ? `TRANSIÇÕES JÁ CONHECIDAS (use proativamente, não re-pergunte): ${transicoesTxt}` : "",
      "CONVERSA (a última fala da mãe é o pedido atual):\n" +
        historico.map((h) => `${h.de === "mae" ? "Mãe" : "Kolo"}: ${h.texto}`).join("\n"),
    ]
      .filter(Boolean)
      .join("\n\n");

    const client = getAylaAnthropicClient();
    const resp = await client.messages.create({
      model: AYLA_MODEL_FALLBACK,
      max_tokens: 1600,
      system: `${nucleoConducao()}\n\n${CONTRATO_ROTINA}`,
      messages: [{ role: "user", content: userPrompt }],
    });
    const b = resp.content[0];
    const raw = b?.type === "text" ? b.text : "";
    const parsed = extrairJsonRotina(raw) as
      | {
          acao?: string;
          mensagem?: string;
          pronto?: boolean;
          tema?: string | null;
          transicoes?: unknown;
          rotinas?: unknown;
        }
      | null;

    // "sair" é o que destrava a mudança de assunto: quem sabe se a mensagem
    // ainda é sobre a rotina é quem está lendo a conversa. Antes, uma rotina
    // pendente capturava TODA mensagem por 48h — a mãe perguntava de atividades
    // e a Ayla respondia sobre a rotina.
    const acao = String(parsed?.acao ?? "").trim().toLowerCase();
    if (acao === "sair") return null;

    let mensagem = (typeof parsed?.mensagem === "string" && parsed.mensagem.trim()) || "";
    // `pronto` continua aceito por compatibilidade — se o modelo devolver o
    // formato antigo, nada quebra.
    // Em ORIENTAÇÃO nada é montado, aconteça o que acontecer com o "acao": o
    // tamanho foi decidido pelo porteiro, não pelo modelo que está escrevendo.
    const pronto = !soOrientacao && (deveMontar || acao === "montar" || parsed?.pronto === true);
    if (deveMontar && acao !== "montar") {
      // O modelo perguntou mesmo assim. Montamos, e a pergunta dele não vai
      // junto: sairia uma mensagem que pergunta e entrega ao mesmo tempo.
      console.warn(`[ayla:rotina] condutor pediu "${acao}" com prontidão suficiente — montando assim mesmo`);
      mensagem = "";
    }
    let tema = typeof parsed?.tema === "string" && parsed.tema.trim() ? parsed.tema.trim().slice(0, 40) : null;

    // ── A AYLA NÃO É MAIS O GERADOR ────────────────────────────────────────
    // Quando decide que dá pra montar, ela DELEGA ao serviço oficial — o mesmo
    // que o app usa. Antes ela montava aqui, com as próprias regras, e as duas
    // implementações se contradiziam (a dela propunha horário; a do app
    // proibia). O que sobra pra ela é o que sempre foi seu: conduzir a
    // conversa, perceber quando é hora, e explicar o que foi montado.
    // UMA fonte só pro ponto difícil e pra estratégia: o que a conversa acabou
    // de revelar, ou o que já estava no perfil. Serve ao gerador E ao PDF.
    const trAgora = Array.isArray(parsed?.transicoes) ? (parsed.transicoes as unknown[]) : [];
    const t0 = (trAgora[0] ?? null) as { momento?: unknown; estrategia?: unknown } | null;
    const pontoDificilDoTurno =
      (t0?.momento ? String(t0.momento) : "") || transicoesConhecidas[0]?.momento || null;
    const estrategiaDoTurno =
      (t0?.estrategia ? String(t0.estrategia) : "") || transicoesConhecidas[0]?.estrategia || null;

    let rotinas: ReturnType<typeof sanitizarRotinas> = [];
    let faltaTemaFinal = false;
    if (pronto) {
      const r = await gerarRotina(supabase, {
        familyId,
        membroAtipicoId: params.membroAtipicoId,
        nome,
        idade,
        idadeMeses: idadeEmMeses((membro.data_nascimento as string | null) ?? null),
        // O gerador compõe a sequência SÓ com o pedido em curso. A janela
        // inteira volta apenas quando a mãe mandou usar o que já contou.
        historico: prontidao.reusaHistorico ? historico : historicoDaRotina,
        mensagem: params.contexto,
        contexto: [jaSabemos.perfil, jaSabemos.rotinaExistente, transicoesTxt].filter(Boolean).join("\n"),
        pontoDificil: pontoDificilDoTurno,
        tamanho,
        // A prontidão já rodou lá em cima, antes do turno de conversa.
        pularProntidao: true,
        // A guarda de identidade precisa da família inteira pra comparar o
        // texto gerado com o membro escolhido.
        membrosDaFamilia: irmaos,
      });

      if (r.desfecho === "gerou") {
        rotinas = sanitizarRotinas(r.rotinas);
        tema = tema ?? r.tema;
      } else {
        // Barrada, ou o gerador não devolveu nada: NÃO publica. A Ayla continua
        // conversando — o comportamento seguro em falha é texto, nunca um
        // artefato degradado.
        console.warn(`[ayla:rotina] serviço não gerou — ${r.desfecho}: ${r.motivo}`);
        const clinico = r.desfecho === "barrada" && r.falhas.some((f) => f.codigo === "manejo_clinico");
        return {
          mensagem: clinico
            ? `Consigo organizar bastante coisa do dia — a sequência, o banho, as trocas, o descanso, e o que vale anotar. Só a parte de horários e quantidades de mamada/alimentação eu não decido: isso segue com quem acompanha ${nome}. Me conta o que a pediatra já orientou sobre isso? Aí eu encaixo do jeito que ela falou e monto o resto em volta.`
            : `Montei aqui, mas ficou uma coisa que eu prefiro confirmar com você antes de mandar o quadro. Me conta como é essa parte do dia de vocês, na ordem que acontece — aí eu monto em cima do real, e não do que eu imaginei.`,
          pronto: false,
        };
      }
    }

    // Aprendizado: guarda no Kolo Vivo as transições difíceis + estratégia.
    if (Array.isArray(parsed?.transicoes) && parsed.transicoes.length) {
      const aprendidas: Transicao[] = (parsed.transicoes as unknown[])
        .map((t): Transicao | null => {
          const o = (t ?? {}) as Record<string, unknown>;
          const momento = String(o.momento ?? "").trim();
          if (!momento) return null;
          return {
            momento,
            estrategia: o.estrategia ? String(o.estrategia) : null,
            funcionou: typeof o.funcionou === "boolean" ? o.funcionou : null,
            merece_plano: typeof o.merece_plano === "boolean" ? o.merece_plano : null,
          };
        })
        .filter((t): t is Transicao => t != null);
      await salvarTransicoes(supabase, params.membroAtipicoId, aprendidas);
    }

    // ── PORTÃO 2: ISTO PODE SER PUBLICADO? ─────────────────────────────────
    // Depois da montagem, antes de gravar/PDF/link. Não existe "piso" de
    // rotina: ou ela está boa, ou não se publica. Em falha a Ayla CONVERSA —
    // organiza o que dá e devolve a parte clínica a quem acompanha a criança.
    if (pronto && rotinas.length) {
      const tarefas = rotinas.flatMap((r) =>
        (r.tarefas ?? []).map((t) => ({ texto: t.texto, hora: t.hora })),
      );
      const veredito = validarRotina({ tarefas, baseDeHorarios: `${conversaTxt}\n${jaSabemos.rotinaExistente}` });
      if (!veredito.ok) {
        console.warn(
          `[ayla:rotina] PUBLICAÇÃO BARRADA — ${resumirFalhas(veredito.falhas)}`,
        );
        const clinico = veredito.falhas.some((f) => f.codigo === "manejo_clinico");
        // Nada é gravado, nenhum PDF sai, nenhum link é mandado como se
        // estivesse pronto. A Ayla continua útil pelo texto.
        return {
          mensagem: clinico
            ? `Consigo te ajudar a organizar bastante coisa do dia ${nome ? `${nome === "seu filho" ? "" : "d"}${nome === "seu filho" ? "" : "a "}` : ""}— a sequência, o banho, as trocas, o descanso, e o que vale anotar. Só que a parte de horários e quantidades de mamada/alimentação eu não decido: isso segue com quem acompanha ${nome}. Me conta o que a pediatra já orientou sobre isso? Aí eu encaixo do jeito que ela falou e monto o resto em volta.`
            : `Montei aqui, mas ficou uma coisa que eu prefiro confirmar com você antes de mandar o quadro. Me conta como é essa parte do dia de vocês, na ordem que acontece — aí eu monto em cima do real e não do que eu imaginei.`,
          pronto: false,
        };
      }

      const ids: string[] = [];
      for (const r of rotinas) {
        const id = await aplicarRotina(supabase, familyId, params.membroAtipicoId, r, tema, visual);
        if (id) ids.push(id);
      }
      // PDF só quando imprimir serve: ela pediu, ou já pediu em algum momento
      // desta conversa (o "manda em PDF" costuma vir um turno depois).
      // Mesma fronteira do visual: "imprimir" de outro assunto não manda PDF.
      const querImprimir = historicoDaRotina.some(
        (h) => h.de === "mae" && pediuParaImprimir(h.texto),
      );
      if (params.phoneE164 && querImprimir) {
        await entregarPdfDaRotina(supabase, {
          familyId,
          phoneE164: params.phoneE164,
          nome,
          tema,
          rotinas,
          pontoDificil: pontoDificilDoTurno,
          fraseDeApoio: estrategiaDoTurno,
        });
      }
      // Destino do link: rotina de DIA DA SEMANA → tabela da semana; UM dia avulso
      // ("Dia do circo") → aquela rotina; vários avulsos → a lista de rotinas.
      const temSemana = rotinas.some((r) => r.dia_semana != null);
      const next = temSemana
        ? "/ludico/rotinas/semana"
        : ids.length === 1
          ? `/ludico/rotinas/${ids[0]}`
          : "/ludico/rotinas";

      // Auto-gerar DIA ÚNICO (tema): a mãe abre e já está gerando/pronto. A
      // semana fica sob demanda (a mãe pede "a rotina de terça" — ver pedirRotinaDoDia).
      // CARTÕES POR NECESSIDADE, NÃO POR TEMA. Antes bastava existir um tema
      // pra a geração disparar — o interesse virava gatilho de artefato. A
      // ordem certa é a inversa: o visual entra quando VER ajuda, e o tema
      // personaliza depois, se houver.
      // O gerador de cartões EXIGE tema (>= 2 caracteres) — sem ele a chamada
      // volta 400 e nenhuma imagem sai, em silêncio. Então aqui o disparo é
      // condicionado de verdade, e o caso "precisa de cartão mas não temos
      // tema" vira uma pergunta na mensagem, nunca um silêncio.
      let autoGerou = false;
      const faltaTema = !temSemana && visual && ids.length > 0 && !tema;
      faltaTemaFinal = faltaTema;
      if (!temSemana && visual && tema && ids.length) {
        for (const id of ids) await dispararGeracao(id, tema);
        autoGerou = true;
      }
      if (faltaTema) {
        console.warn(
          `[ayla:rotina] visual=true sem tema — cartões NÃO disparados, pedindo o tema na mensagem`,
        );
      }

      const link = await gerarMagicLink(supabase, { familyId, next });
      const fechamento = mensagem || `Prontinho — montei a rotina do(a) ${nome} 🌿`;
      // A ENTREGA CONCRETA é a rotina no app. O PDF é opção de impressão, e a
      // frase tem que dizer a verdade sobre o que existe agora.
      const cartoes = autoGerou
        ? ` Já comecei a gerar os cartões no tema *${tema}* — eles levam *1-2 minutinhos*, então pode abrir que vão aparecendo sozinhos 🌿`
        : faltaTema
          ? ` Os cartões ilustrados eu gero assim que você escolher o tema${interesses ? ` — quer no tema de *${interesses.split(/[,;]/)[0]?.trim()}*?` : " — me diz o que ele ama que eu faço com a cara dele."}`
          : "";
      const impresso = querImprimir
        ? " Te mandei também um *PDF pra imprimir* (com quadradinhos pra marcar)."
        : "";
      const orient = `${cartoes}${impresso}`;
      const dica = querImprimir
        ? "\n\nSe quiser mudar uma etapa ou um horário, é só me falar aqui que eu ajusto."
        : "\n\nSe quiser mudar uma etapa ou um horário, é só me falar. E se quiser imprimir pra colar na parede, eu te mando em PDF.";
      mensagem = link
        ? `${fechamento}${orient}\n\nAbre aqui (já entra direto):\n${link}${dica}`
        : `${fechamento}${orient}${dica}`;
    }

    if (!mensagem) return null;
    // AGUARDANDO O TEMA: a rotina existe, mas os cartões dependem de uma
    // palavra que ainda não veio. A conversa fica ABERTA (tipo rotina_conversa)
    // pra que a próxima mensagem dela — "pode ser dinossauros" — volte pra cá
    // e o tema seja aplicado. Se fechássemos com "rotina_pronta", a resposta
    // dela cairia na conversa comum e o tema morreria ali, sem cartão nenhum.
    return { mensagem, pronto: pronto && rotinas.length > 0, aguardandoTema: faltaTemaFinal };
  } catch (e) {
    console.warn("[ayla:rotina-guiada] falha:", e instanceof Error ? e.message : e);
    return null;
  }
}

// ---------- "Traga a rotina de hoje / de terça" ----------

const DIAS_MAP: Record<string, number> = {
  segunda: 0,
  terça: 1,
  terca: 1,
  quarta: 2,
  quinta: 3,
  sexta: 4,
  sábado: 5,
  sabado: 5,
  domingo: 6,
};

/** Dia da semana (0=Seg..6=Dom) em um fuso, com offset de dias (hoje=0, amanhã=1). */
function diaSemanaEmTz(tz: string | null | undefined, offsetDias: number): number {
  const base = new Date(Date.now() + offsetDias * 24 * 60 * 60 * 1000);
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: tz || "America/Sao_Paulo",
    weekday: "short",
  }).format(base);
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return map[wd] ?? 0;
}

function resolverDia(texto: string, tz: string | null | undefined): number | null {
  const t = (texto ?? "").toLowerCase();
  if (/\bhoje\b/.test(t)) return diaSemanaEmTz(tz, 0);
  if (/\bamanh[ãa]\b/.test(t)) return diaSemanaEmTz(tz, 1);
  for (const [nome, d] of Object.entries(DIAS_MAP)) if (t.includes(nome)) return d;
  return null;
}

/** Pedido pra VER uma rotina de um dia (traga/manda/mostra a rotina de hoje/terça…). */
export function pedeRotinaDeUmDia(texto: string | null | undefined): boolean {
  const t = (texto ?? "").toLowerCase();
  if (!/\brotina\b/.test(t)) return false;
  const temDia = /\bhoje\b|\bamanh[ãa]\b|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo/.test(t);
  const temVerbo = /\b(traga|traz|tras|manda|mandar|mostra|mostrar|me v[êe]|quero ver|abre|abrir|puxa|puxar|ver a)\b/.test(
    t,
  );
  // NÃO é criar/montar (isso é o condutor).
  const ehCriar = /\b(criar|cria|montar|monta|monte|fazer|faz|fa[çc]a)\b/.test(t);
  return temDia && temVerbo && !ehCriar;
}

/**
 * A mãe pediu "a rotina de hoje/terça". Resolve o dia (pelo fuso), acha a rotina,
 * gera os cartões se faltar (um dia por vez) e devolve o link. Null se não deu.
 */
export async function pedirRotinaDoDia(
  supabase: SupabaseClient,
  params: {
    familyId: string;
    membroAtipicoId: string;
    texto: string;
    timezone?: string | null;
  },
): Promise<string | null> {
  try {
    const dia = resolverDia(params.texto, params.timezone);
    if (dia == null) return null;

    const { data: membro } = await supabase
      .from("membros_atipicos")
      .select("nome")
      .eq("id", params.membroAtipicoId)
      .maybeSingle();
    const nome = (membro?.nome as string) ?? "seu filho";
    const nomeDia = DIAS_LABEL[dia];

    const { data: rot } = await supabase
      .from("rotinas")
      .select("id, tema, cards_status")
      .eq("membro_atipico_id", params.membroAtipicoId)
      .eq("family_account_id", params.familyId)
      .eq("dia_semana", dia)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!rot) {
      return `Ainda não montamos a rotina de ${nomeDia} 🌿 Quer montar agora? É só me contar como é esse dia (pode ser áudio).`;
    }

    const rotinaId = rot.id as string;
    const tema = (rot.tema as string | null) ?? null;
    const status = (rot.cards_status as string | null) ?? "nenhum";

    let gerando = false;
    if (tema && (status === "nenhum" || status === "erro")) {
      await dispararGeracao(rotinaId, tema);
      gerando = true;
    }

    const link = await gerarMagicLink(supabase, { familyId: params.familyId, next: `/ludico/rotinas/${rotinaId}` });
    const extra = gerando ? " Tô gerando os cartões — ao abrir, já vão aparecendo 🌿" : "";
    const base = `Aqui está a rotina de *${nomeDia}* do(a) ${nome} 🗓️${extra}`;
    return link ? `${base}\nAbre aqui:\n${link}` : base;
  } catch (e) {
    console.warn("[ayla:rotina-guiada] pedirRotinaDoDia falhou:", e instanceof Error ? e.message : e);
    return null;
  }
}

// ---------- Editar/corrigir uma rotina pela Ayla ----------

/**
 * Reforço de regex pro gate de EDIÇÃO ("tira o vôlei da rotina", "muda a rotina
 * de hoje"). A IA de intenção (`intent.ts`) é o sinal primário; aqui a régua é
 * DELIBERADAMENTE estreita, porque falso positivo neste gate reescreve a rotina
 * da família sem ela ter pedido nada.
 *
 * Incidente 25/07 (rotina do André): um desabafo — "tive que contratar um
 * prestador pra ARRUMAR um vazamento... HOJE já está melhor" — casava verbo de
 * edição + dia da semana e a Ayla foi lá e refez o dia. Então:
 * - dia/"hoje" NÃO basta: a vida da mãe também acontece "hoje";
 * - precisa citar a rotina (ou cartões/quadro/passos) com essas palavras;
 * - desabafo é longo e narrativo, pedido de ajuste é curto — texto comprido sai.
 * Pedido legítimo mas indireto ("faltou o lanche na terça") segue coberto pela
 * IA de intenção, que é quem deve entender isso.
 */
export function pedeEditarRotina(texto: string | null | undefined): boolean {
  const t = (texto ?? "").trim().toLowerCase();
  if (!t || t.length > 220) return false;
  const editVerbo =
    /\b(faltou|falta|tira|tirar|tire|remove|remover|remova|adiciona|adicionar|acrescenta|acrescentar|p[õo]e|poe|coloca|colocar|muda|mudar|mude|troca|trocar|corrige|corrigir|arruma|arrumar|inverte|inverter|esqueci)\b/.test(
      t,
    );
  if (!editVerbo) return false;
  return /\brotina\b|\bcart[õo]es?\b|\bquadro\b|\bpassos?\b|\betapas?\b/.test(t);
}

const SYSTEM_EDITAR = `Você edita uma rotina que já existe. Recebe as TAREFAS ATUAIS (JSON) e o PEDIDO da mãe.

ANTES DE TUDO: confira se a mensagem é MESMO um pedido pra mudar o quadro de rotina. Se ela só está CONTANDO como foi o dia, desabafando, ou falando de algo da vida dela que não é o quadro (uma obra em casa, uma crise, o trabalho), devolva {"tarefas":[]} e nada mais — não invente etapa nenhuma a partir da história dela. Melhor não mexer do que mexer sem ela pedir.

Se for pedido de verdade, devolva APENAS JSON com as tarefas ATUALIZADAS, aplicando o pedido (adicionar / remover / mudar texto / mudar horário / reordenar) e MANTENDO tudo que ela NÃO mencionou. Formato: {"tarefas":[{"texto":"acordar","hora":"6h"}]}. HORÁRIO é opcional (null se não tiver; nunca invente). Encaixe no lugar lógico (ex.: "lanche depois da escola" entra logo após a escola). Texto curto (1-5 palavras). NÃO invente atividades além do que ela pediu.`;

const ACENTOS = new RegExp("[\\u0300-\\u036f]", "g"); // marcas de combinação (pós-NFD)

const normalizarTexto = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(ACENTOS, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Backstop determinístico: uma edição de verdade PRESERVA a rotina. Se a lista
 * nova joga fora mais da metade das etapas que existiam, não foi edição — foi a
 * IA reescrevendo o quadro a partir de uma mensagem que não era pedido (caso
 * André, 25/07). Aí é melhor não gravar nada e responder conversando.
 */
function edicaoPreservaRotina(atuais: TarefaProposta[], novas: TarefaProposta[]): boolean {
  if (atuais.length < 3) return true; // rotina curta: qualquer mudança é grande
  const novos = new Set(novas.map((t) => normalizarTexto(t.texto)));
  const mantidas = atuais.filter((t) => novos.has(normalizarTexto(t.texto))).length;
  return mantidas >= Math.ceil(atuais.length / 2);
}

/** Linha de tarefa como ela está no banco — com a arte que já custou imagem. */
type TarefaLinha = {
  id: string;
  texto: string;
  hora: string | null;
  ordem: number;
  imagem_url: string | null;
};

/**
 * Casa a lista nova com as linhas que já existem, pelo texto (sem acento/caixa).
 * Quem casa é ATUALIZADO no lugar — mantém id, `concluida` e, principalmente, a
 * ILUSTRAÇÃO já gerada. Quem não casa é insert (passo novo) ou delete (passo que
 * ela pediu pra tirar).
 *
 * Antes isso era um delete-tudo + insert-tudo: mudar um horário torrava a arte
 * dos 8 cards e obrigava a regenerar tudo (caso André, 25/07).
 */
function casarTarefas(
  atuais: TarefaLinha[],
  novas: TarefaProposta[],
): {
  manter: Array<{ id: string; hora: string | null; ordem: number; temArte: boolean }>;
  inserir: Array<{ texto: string; hora: string | null; ordem: number }>;
  remover: string[];
} {
  const disponiveis = new Map<string, TarefaLinha[]>();
  for (const t of atuais) {
    const k = normalizarTexto(t.texto);
    const lista = disponiveis.get(k);
    if (lista) lista.push(t);
    else disponiveis.set(k, [t]);
  }

  const manter: Array<{ id: string; hora: string | null; ordem: number; temArte: boolean }> = [];
  const inserir: Array<{ texto: string; hora: string | null; ordem: number }> = [];
  const usados = new Set<string>();

  novas.forEach((nova, ordem) => {
    const candidatos = disponiveis.get(normalizarTexto(nova.texto));
    const casada = candidatos?.shift();
    if (casada) {
      usados.add(casada.id);
      manter.push({ id: casada.id, hora: nova.hora, ordem, temArte: !!casada.imagem_url });
    } else {
      inserir.push({ texto: nova.texto, hora: nova.hora, ordem });
    }
  });

  return { manter, inserir, remover: atuais.filter((t) => !usados.has(t.id)).map((t) => t.id) };
}

function sanitizarTarefasSimples(bruto: unknown): TarefaProposta[] {
  if (!Array.isArray(bruto)) return [];
  const out: TarefaProposta[] = [];
  for (const t of bruto.slice(0, 30)) {
    const o = (t ?? {}) as Record<string, unknown>;
    const texto = String(o.texto ?? "").trim().slice(0, 120);
    if (!texto) continue;
    const hora = o.hora == null ? null : String(o.hora).trim().slice(0, 10);
    out.push({ texto, hora: hora || null });
  }
  return out;
}

/**
 * Edita a rotina que a mãe pediu (dia mencionado, senão a mais recente): carrega
 * as tarefas atuais, aplica a mudança (IA) e regrava. Se tinha cartões no tema,
 * regenera. Devolve confirmação + link.
 */
export async function editarRotina(
  supabase: SupabaseClient,
  params: { familyId: string; membroAtipicoId: string; texto: string; timezone?: string | null; phoneE164?: string | null },
): Promise<string | null> {
  try {
    const dia = resolverDia(params.texto, params.timezone);
    type RotSel = { id: string; nome: string; tema: string | null; cards_status: string | null };
    let rot: RotSel | null = null;

    if (dia != null) {
      const { data } = await supabase
        .from("rotinas")
        .select("id, nome, tema, cards_status")
        .eq("membro_atipico_id", params.membroAtipicoId)
        .eq("family_account_id", params.familyId)
        .eq("dia_semana", dia)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (data) rot = data as unknown as RotSel;
    }
    if (!rot) {
      const { data } = await supabase
        .from("rotinas")
        .select("id, nome, tema, cards_status")
        .eq("membro_atipico_id", params.membroAtipicoId)
        .eq("family_account_id", params.familyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) rot = data as unknown as RotSel;
    }
    if (!rot) return "Não achei uma rotina pra ajustar 🌿 Me diz qual dia, ou a gente monta uma nova.";

    const rotinaId = rot.id;
    const { data: tarefas } = await supabase
      .from("rotina_tarefas")
      .select("id, texto, hora, ordem, imagem_url")
      .eq("rotina_id", rotinaId)
      .order("ordem", { ascending: true });
    const linhas = (tarefas ?? []) as unknown as TarefaLinha[];
    const atuais = linhas.map((t) => ({ texto: t.texto, hora: t.hora ?? null }));

    const client = getAylaAnthropicClient();
    const resp = await client.messages.create({
      model: AYLA_MODEL_FALLBACK,
      max_tokens: 1200,
      system: SYSTEM_EDITAR,
      messages: [
        {
          role: "user",
          content: `TAREFAS ATUAIS:\n${JSON.stringify({ tarefas: atuais })}\n\nPEDIDO DA MÃE: ${params.texto}`,
        },
      ],
    });
    const b = resp.content[0];
    const raw = b?.type === "text" ? b.text : "";
    const parsed = extrairJsonRotina(raw) as { tarefas?: unknown } | null;
    const novas = sanitizarTarefasSimples(parsed?.tarefas);
    // Vazio = a IA reconheceu que a mensagem não era pedido de mudança.
    if (!novas.length) return null;
    // E, mesmo dizendo que era, não gravamos uma reescrita que joga a rotina
    // fora — null aqui devolve a conversa pro fluxo normal (a Ayla responde
    // o que ela contou, em vez de mexer no quadro).
    if (!edicaoPreservaRotina(atuais, novas)) {
      console.warn(
        `[ayla:rotina-guiada] edição descartada (reescreveria a rotina ${rotinaId}): ${atuais.length} etapas → ${novas.length}`,
      );
      return null;
    }

    // DIFF, não delete-tudo: passo que continua igual fica onde está, com a
    // ilustração dele. Só o que ela mexeu vira insert/delete.
    const { manter, inserir, remover } = casarTarefas(linhas, novas.slice(0, 25));

    for (const m of manter) {
      await supabase
        .from("rotina_tarefas")
        .update({ hora: m.hora ? m.hora.slice(0, 10) : null, ordem: m.ordem })
        .eq("id", m.id)
        .eq("rotina_id", rotinaId);
    }
    if (remover.length) {
      await supabase.from("rotina_tarefas").delete().in("id", remover).eq("rotina_id", rotinaId);
    }
    if (inserir.length) {
      await supabase.from("rotina_tarefas").insert(
        inserir.map((t) => ({
          rotina_id: rotinaId,
          texto: t.texto.slice(0, 120),
          hora: t.hora ? t.hora.slice(0, 10) : null,
          icone: null,
          ordem: t.ordem,
        })),
      );
    }

    // Cartões: só chama o gerador se a mudança REALMENTE pede desenho novo —
    // passo que entrou (não tem card) ou saiu (a história cita a sequência).
    // Trocar horário ou reordenar não redesenha nada: a arte vive na linha da
    // tarefa e acompanha a nova ordem. E a geração PRESERVA o que já existe,
    // ilustrando só os cards faltantes, com o mesmo mascote.
    const tinhaCartoes = !!rot.tema && (rot.cards_status === "pronto" || rot.cards_status === "gerando");
    const precisaDesenho = inserir.length > 0 || remover.length > 0;
    const vaiRegerar = tinhaCartoes && precisaDesenho;
    if (vaiRegerar && rot.tema) {
      await supabase.from("rotinas").update({ cards_status: "nenhum" }).eq("id", rotinaId);
      await dispararGeracao(rotinaId, rot.tema, { preservarArte: true });
    }

    const link = await gerarMagicLink(supabase, { familyId: params.familyId, next: `/ludico/rotinas/${rotinaId}` });
    const regen = !vaiRegerar
      ? ""
      : inserir.length === 0
        ? " Tô refazendo a historinha com a mudança (uns minutinhos)."
        : inserir.length === 1
          ? " Tô desenhando o cartão novo (uns minutinhos)."
          : " Tô desenhando os cartões novos (uns minutinhos).";
    const base = `Pronto, ajustei a rotina *${rot.nome}* 🌿${regen}`;
    return link ? `${base}\nAbre aqui:\n${link}` : base;
  } catch (e) {
    console.warn("[ayla:rotina-guiada] editarRotina falhou:", e instanceof Error ? e.message : e);
    return null;
  }
}
