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
import { alvoDoPedido, RESPOSTA_PDF } from "./rotina-pdf-rota";
import { enviarDocumento } from "./whatsappSender";
import {
  classificarFeedbackRotina,
  falaDoQuadro,
  instrucaoDeAjuste,
  type FeedbackRotina,
} from "./rotina-feedback";

/**
 * ── MUDANÇA DELIBERADA DE PRODUTO, 08/08/2026 (D-R1 da SPEC) ────────────────
 *
 * O contrato dizia, desde 03/08: "Se já dá pra montar uma primeira versão,
 * MONTE — não peça confirmação antes." A regra NÃO era erro: ela resolvia um
 * problema real, o de gastar mais um turno perguntando à mãe algo que ela já
 * tinha respondido, e o argumento continua valendo — corrigir algo pronto é
 * mais rápido que responder mais uma pergunta.
 *
 * O que mudou é o ESCOPO dela. Ela passa a valer para a sequência que a
 * FAMÍLIA deu. Quando a Ayla infere, acrescenta ou reorganiza etapas, o quadro
 * deixa de ser o que a mãe descreveu e vira uma proposta — e proposta se
 * mostra antes de virar artefato, porque ela imprime e cola na parede.
 *
 * O critério é "de quem é a sequência?", nunca o tamanho nem a quantidade de
 * turnos. Confirmar sempre seria burocracia; nunca confirmar é montar em cima
 * de suposição. Ver `CONFIRMAR OU MONTAR?` no contrato abaixo.
 *
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
  return /visua(l|is)|cart(ão|ões|ao|oes)|\bcards?(?![a-zà-ú])|figurinha|pictogram|com (figuras|imagens|desenhos)/.test(
    t,
  );
}

/**
 * A criança já tem avatar? Só pra decidir se vale CONVIDAR a criar um — a
 * geração em si é oportunista do outro lado (se existe, usa).
 */
async function membroTemAvatar(supabase: SupabaseClient, membroId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("avatares_membros_atipicos")
      .select("id")
      .eq("membro_atipico_id", membroId)
      .limit(1);
    return (data?.length ?? 0) > 0;
  } catch {
    // Sem saber, NÃO convida: sugerir criar um avatar que já existe é pior.
    return true;
  }
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
export const CONTRATO_ROTINA = `# Você está conduzindo uma ROTINA

Tudo acima continua valendo — identidade, princípios, fronteiras e VOZ. Isto aqui
é só o CONTRATO da ferramenta de rotina, não uma segunda Ayla.

## Escolha UM desfecho por turno e devolva pela ferramenta \`conduzir_rotina\`:
acao = "responder"|"perguntar"|"montar"|"sair" · mensagem = sua fala (WhatsApp) · recorrente · transicoes

recorrente: este pedido é sobre a GRADE DA SEMANA (dias que se repetem), ou é UM acontecimento? "Domingo é dia dos pais" é um acontecimento — false —, mesmo dizendo "domingo". "Quero organizar as segundas" é grade — true.

Escreva a "mensagem" como você falaria: aspas, travessões, quebras de linha e emoji
são bem-vindos. A ferramenta serializa o texto por você — não existe caractere
que você precise evitar, e você NUNCA deve escapar nada à mão.

- "responder" — ela fez uma PERGUNTA sobre a rotina ("qual horário encaixo o iPad?", "como você faria a tarde?"). RESPONDA com o que você já sabe: a sequência que ela contou, os horários, a dificuldade que ela relatou. Proponha, explique em uma frase por que, e diga que dá pra ajustar. NÃO devolva a próxima pergunta do roteiro — isso é ignorar o que ela perguntou.
- "perguntar" — falta UMA informação que muda a rotina de verdade. Uma só.
- "montar" — você tem sequência suficiente pra uma primeira versão. Quem MONTA o quadro é o sistema; você decide que é hora.
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

DEPOIS QUE EXISTE, comente o que foi personalizado — a transição difícil, o horário que ELA deu, o que você encaixou por causa do que ela contou. Sem listar as etapas: elas aparecem logo abaixo, do jeito que ficaram.

## COMBINADO VISUAL — quando o que trava é um acordo, não uma sequência do dia
Tem hora que o problema não é "ela não sabe o que vem depois", é "a gente combina e não se sustenta": a ida à loja, o tempo de tela, a visita na casa de alguém. Aí a sequência serve pra tirar o acordo da fala e deixá-lo concreto — e é uma sequência curta como qualquer outra (mesma rotina, mesmas tarefas, mesmos cartões). Não anuncie como produto diferente: chame do que é ("um combinado pra loja", "o combinado do tempo de tela").
ESCREVA O QUE FAZER, NÃO O QUE NÃO FAZER. "Não corra", "não mexa", "não grite" não dizem à pessoa o que ela deve fazer no lugar — e a criança fica com a proibição sem a alternativa. Troque por comportamento observável: "ficar perto", "mãos no carrinho", "escolher o item", "depois vamos embora".
O COMBINADO PRECISA TER UM DEPOIS. Onde termina e o que vem em seguida — senão vira lista de exigências. E não transforme em barganha: o que vem depois é o que vem depois, não prêmio por obedecer.
COM ADOLESCENTE OU ADULTO, construa COM a pessoa quando der: um acordo que ela ajudou a escrever é outro acordo. Diga isso à família em uma linha.

## VISÃO DA SEMANA ≠ ROTINA DO DIA
São perguntas diferentes e a resposta certa muda. "Em quais dias tem terapia?", "quero organizar os compromissos da semana", "ele pergunta o tempo todo o que vai ter" → é VISÃO DA SEMANA: cada dia com os poucos compromissos daquele dia (escola, fono, natação), não uma lista de tarefas. "Como ele se arruma de manhã", "a hora de dormir" → é ROTINA/SEQUÊNCIA daquele período.
Na visão da semana, cada dia leva POUCAS entradas — o que acontece, não como se faz. Segunda: escola → fono. Terça: escola. Não encha os dias de tarefas: o que ajuda ali é enxergar a semana, e um painel cheio faz o contrário.
DEPOIS DA SEMANA, e só se ela contar que um dia é o pior, ofereça detalhar SÓ AQUELE DIA — ou só a passagem difícil dele. Não reconstrua a semana inteira por causa de um dia.
Oriente a usar: deixar visível em casa e olhar com a pessoa o dia seguinte na noite anterior. Uma frase, quando couber.

## AYLA SEMPRE ENTREGA — ajuda útil, não necessariamente artefato
"Sempre entrega" quer dizer que a família NUNCA fica sem nada de concreto. NÃO quer dizer gerar um quadro em toda conversa. A melhor ajuda é a MENOR que resolve: às vezes é conduzir uma passagem (antes/durante/depois), às vezes é uma sequência curta de 2 a 4 etapas, às vezes é o período inteiro organizado. Quem decide o tamanho é o porteiro, e ele já decidiu quando você chega aqui.
## CONFIRMAR OU MONTAR? Depende de QUEM escreveu a sequência
A pergunta é uma só: as etapas que vão pro quadro são as que ELA deu, ou você é que completou?

- ELA DITOU A SEQUÊNCIA ("Mario chega, jantar, Mario vai embora, dormir"; "acorda 6h, escola 7h30, almoço, fono, jantar, dormir") → MONTE, sem pedir confirmação. Confirmar aqui é devolver a ela a mesma lista que ela acabou de escrever, e isso cansa e atrasa. Ela vê a rotina pronta e ajusta o que quiser; corrigir algo pronto é mais rápido que responder mais uma pergunta. Só pare se houver INCONSISTÊNCIA REAL no que ela deu (duas etapas na mesma hora, uma que não pode vir antes da outra) — e aí pergunte sobre a inconsistência, não sobre a lista inteira.
- VOCÊ INFERIU, ACRESCENTOU OU REORGANIZOU — encaixou uma etapa que ela não citou, mudou a ordem, quebrou uma etapa em duas, completou o começo ou o fim → devolva "perguntar" com a proposta ESCRITA, curta, numerada, e uma pergunta só no fim. Exemplo do formato (não copie o conteúdo): "Eu faria assim: 1. Mario chega · 2. brincar um pouco · 3. jantar · 4. despedida · 5. dormir. Faz sentido ou quer mudar alguma etapa?" Um "sim", "pode ser", "isso mesmo" libera a montagem; uma correção entra e você monta com ela.
⚠️ O que se confirma é O QUE É SEU. Não é confirmar sempre, nem nunca: é não montar em cima de suposição sua sem ela ver. Horário que ela não deu, você PROPÕE a partir do que sabe (chegada, escola, atividade fixa) e deixa claro que é sugestão; só não invente horário quando não há nada em que se apoiar. Propor horário dentro da sequência dela NÃO é inferir a sequência.
⚠️ NÃO transforme a confirmação em mais uma rodada de perguntas. É UMA mensagem, com a proposta inteira à vista, e uma pergunta só.
Ponha uma dica curta NO PONTO DIFÍCIL — o momento que ela relatou, ou a transição que você já conhece do perfil. Uma ou duas, não uma aula. Quando fizer sentido, uma brincadeira ou atividade simples ancorada nos interesses dele.
TEMA dos cartões NÃO é assunto seu: o sistema pergunta, no lugar certo, com os interesses que já conhece. Você não oferece tema, não pergunta tema, não escreve "quer no tema de...". E tema NUNCA é motivo pra existir cartão — o cartão existe quando VER a sequência ajuda a criança; o tema só personaliza o que já ia existir. A atividade tem que continuar reconhecível: primeiro se entende que é BANHO, depois é que ele é um dinossauro.

## Formato dos dados
transicoes: [{"momento":"banho","estrategia":"música depois","funcionou":null,"merece_plano":false}] — o que você descobriu sobre momentos difíceis fica no perfil e você reusa. Marque "funcionou" quando ela disser que deu certo ou não. Se o momento for algo que a rotina sozinha NÃO resolve (ansiedade de separação, crise intensa, recusa alimentar séria), diga isso em uma frase e marque "merece_plano":true.

## Quando "montar": o sistema anexa o link, e cuida sozinho de cartões e PDF
NÃO escreva a sequência na sua "mensagem": o sistema mostra as etapas exatamente como ficaram no quadro, logo abaixo da sua fala. Sua parte é o que só você sabe fazer — dizer o que entendeu, a dica no ponto difícil, a frase de antecipação. Confirme no passado, não no futuro. NUNCA escreva "vou montar", "vou gerar", "vou te mandar" ou "vai aparecer": quando você devolve "montar", já está feito.
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

/**
 * Gera o PDF da rotina, sobe no Storage e manda como documento.
 *
 * ⚠️ DEVOLVE SE ENVIOU. Era `void` e engolia a falha em silêncio — bastava
 * enquanto o PDF era um brinde no fim da montagem. Deixou de bastar quando a
 * mãe passou a PEDIR o PDF: sem retorno, quem responde não sabe se pode dizer
 * "enviei", e foi assim que a Ayla afirmou um envio que não aconteceu
 * (Rosângela, 07/08/2026). Os chamadores antigos ignoram o retorno e seguem
 * iguais.
 */
export async function entregarPdfDaRotina(
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
): Promise<boolean> {
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
    const envio = await enviarDocumento({
      phoneE164: params.phoneE164,
      url: signed.signedUrl,
      fileName,
    });
    // `messageId` é o mais forte que existe aqui: prova que a Z-API ACEITOU o
    // arquivo. Não prova entrega nem leitura — e a copy não diz isso.
    return Boolean(envio?.messageId);
  } catch (e) {
    console.warn("[ayla:rotina-guiada] falha no PDF:", e instanceof Error ? e.message : e);
    return false;
  }
}

/** Dispara a geração dos cartões (endpoint interno) — a Ayla não gera direto
 * (mundo separado de /lib/ia). Best-effort; roda em segundo plano no app. */
async function dispararGeracao(
  rotinaId: string,
  tema: string,
  opts?: { preservarArte?: boolean },
): Promise<boolean> {
  try {
    const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
    // Segredo PRÓPRIO da geração — ver a nota no route.ts: o
    // `AYLA_WEBHOOK_SECRET` serve o inbound da Z-API e o cookie de ativação, e
    // reaproveitá-lo acoplaria a rotina à porta de entrada da Ayla.
    const secret = process.env.KOLO_GERACAO_SECRET;
    // O endpoint é fail-closed desde 08/08/2026. Sem o segredo aqui, TODO
    // cartão para de sair — e antes isso seria um 401 engolido pelo catch.
    if (!secret) {
      console.error(
        "[ayla:rotina] KOLO_GERACAO_SECRET ausente — nenhum cartão será gerado. Configure o ambiente.",
      );
      return false;
    }
    const r = await fetch(`${base}/api/ludico/gerar-rotina`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-ayla-secret": secret },
      body: JSON.stringify({ rotinaId, tema, preservarArte: opts?.preservarArte === true }),
    });
    // DEVOLVE SE COMEÇOU. O endpoint grava `cards_status='gerando'` antes de
    // responder, então um 200 aqui significa que a geração está mesmo em curso
    // — e é só com isso na mão que a Ayla pode dizer "já comecei". Best-effort
    // continua, mas deixa de ser MUDO: o disparo que falha era a diferença
    // entre "gerando" e a mãe olhando ícone pra sempre.
    if (!r.ok) {
      console.error(`[ayla:rotina] disparo recusado pelo gerador — HTTP ${r.status} (rotina ${rotinaId})`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[ayla:rotina] disparar geração falhou:", e instanceof Error ? e.message : e);
    return false;
  }
}

/**
 * A SEQUÊNCIA NA FALA É UMA VIEW DO QUE FOI GRAVADO.
 *
 * Até 08/08/2026 o condutor escrevia a lista de etapas na própria mensagem —
 * de cabeça, ANTES de `gerarRotina` existir o quadro. Eram duas composições
 * independentes do mesmo pedido, e elas divergiam: em 07/08 a mãe leu 12
 * etapas e a criança recebeu 9, com a visita à pessoa nova (o motivo do
 * pedido) colapsada num cartão genérico.
 *
 * Lendo do banco, divergir deixa de ser possível. Não é uma regra a mais no
 * prompt pedindo coerência: é a mesma lista, uma vez só.
 */
async function sequenciaDoQuadro(
  supabase: SupabaseClient,
  ids: string[],
): Promise<string> {
  if (!ids.length) return "";
  try {
    const { data: rots } = await supabase
      .from("rotinas")
      .select("id, nome, dia_semana")
      .in("id", ids);
    const { data: tarefas } = await supabase
      .from("rotina_tarefas")
      .select("rotina_id, texto, hora, ordem")
      .in("rotina_id", ids)
      .order("ordem", { ascending: true });
    if (!tarefas?.length) return "";

    const ordemDosIds = ids;
    const blocos: string[] = [];
    for (const id of ordemDosIds) {
      const r = (rots ?? []).find((x) => x.id === id);
      const minhas = (tarefas ?? []).filter((t) => t.rotina_id === id);
      if (!minhas.length) continue;
      const linhas = minhas
        .map((t, i) => `${i + 1}. ${t.texto}${t.hora ? ` — ${t.hora}` : ""}`)
        .join("\n");
      // Com uma rotina só, o nome já está na fala da Ayla; com várias (semana),
      // cada bloco precisa dizer de que dia é.
      blocos.push(ordemDosIds.length > 1 && r?.nome ? `*${r.nome}*\n${linhas}` : linhas);
    }
    return blocos.join("\n\n");
  } catch (e) {
    // Best-effort: sem a view, a fala sai sem a lista — nunca com uma inventada.
    console.error("[ayla:rotina] falha ao ler a sequência do quadro:", e instanceof Error ? e.message : e);
    return "";
  }
}

/** Rotinas criadas com cartões pedidos, esperando só a escolha do tema. */
async function marcarAguardandoTema(supabase: SupabaseClient, ids: string[]): Promise<void> {
  if (!ids.length) return;
  try {
    await supabase.from("rotinas").update({ cards_status: "aguardando" }).in("id", ids);
  } catch (e) {
    console.error("[ayla:rotina] falha ao marcar 'aguardando':", e instanceof Error ? e.message : e);
  }
}

/** A rotina mais recente deste membro que está esperando um tema. */
async function rotinaAguardandoTema(
  supabase: SupabaseClient,
  familyId: string,
  membroId: string,
): Promise<{ id: string; nome: string } | null> {
  try {
    const { data } = await supabase
      .from("rotinas")
      .select("id, nome")
      .eq("family_account_id", familyId)
      .eq("membro_atipico_id", membroId)
      .eq("cards_status", "aguardando")
      // RECENTE. Uma rotina esquecida em `aguardando` semanas atrás não pode
      // capturar a próxima palavra solta que a mãe mandar — apareceu no teste
      // de 08/08, quando um "Carrinho" foi parar numa rotina de outra conversa.
      .gte("updated_at", new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ? { id: data.id as string, nome: (data.nome as string) ?? "" } : null;
  } catch {
    return null;
  }
}

/** A família desistiu dos cartões desta rotina? */
function recusouTema(t: string): boolean {
  return /\b(n[ãa]o quero|sem cart|sem tema|deixa (pra l[áa]|assim)|depois eu|agora n[ãa]o|nenhum)\b/i.test(t);
}

/**
 * A MENSAGEM É A ESCOLHA DO TEMA?
 *
 * Determinístico de propósito. A resposta "princesas" é o gatilho do turno
 * inteiro — se ela precisasse sobreviver a uma ida ao modelo e a um parser,
 * estaríamos reconstruindo exatamente a falha de 07/08/2026.
 *
 * Conservador: só reconhece resposta CURTA e sem verbo de edição. Qualquer
 * outra coisa devolve null e segue o fluxo normal, onde o condutor decide.
 */
export function lerTemaEscolhido(texto: string | null | undefined): string | null {
  const bruto = (texto ?? "").trim();
  if (!bruto || bruto.length > 60) return null;
  if (recusouTema(bruto)) return null;
  // Pedido de mudança na rotina não é escolha de tema.
  if (/\b(muda|troca|tira|apaga|acrescenta|inclui|adiciona|edita|imprim|pdf)\w*\b/i.test(bruto)) return null;
  if (/\?$/.test(bruto)) return null;

  const limpo = bruto
    .replace(/^(pode ser|podia ser|prefiro|quero|queria|vamos de|faz(er)? (de|em|no|na)?|escolho|acho que|talvez|ah,?|sim,?)\s+/i, "")
    .replace(/^(no |na |em |de |do |da |o |a )?tema (de |do |da |em )?/i, "")
    .replace(/^(de|do|da|em|no|na)\s+/i, "")
    .replace(/[.!]+$/, "")
    .trim();
  if (limpo.length < 2 || limpo.length > 40) return null;
  // Uma ou duas palavras é tema; uma frase é outra coisa.
  if (limpo.split(/\s+/).length > 4) return null;
  return limpo;
}

/**
 * O CONTRATO DO CONDUTOR, COMO FERRAMENTA — não como JSON em texto.
 *
 * Em 07/08/2026 a Ayla devolveu o turno certo (`acao:"montar"`, tema
 * "princesas") e o sistema perdeu tudo: a fala dela citava a frase que a mãe
 * deveria usar — "agora vamos ao mercado" — e as aspas não escapadas quebraram
 * o `JSON.parse`. O extrator devolvia `null` em silêncio, `acao` virava "",
 * `tema` sumia, e os cartões nunca eram disparados. Três de três execuções.
 *
 * A causa não era ESTE JSON: era pedir a um modelo que escreve português
 * natural que também fosse serializador. Com tool use quem serializa é a API,
 * e a fala pode ter aspas, quebra de linha e emoji à vontade.
 */
const FERRAMENTA_CONDUTOR = {
  name: "conduzir_rotina",
  description:
    "Devolve o desfecho deste turno da conversa de rotina: o que fazer, a fala pra família e, quando for montar, a rotina em si.",
  input_schema: {
    type: "object" as const,
    properties: {
      acao: {
        type: "string",
        enum: ["responder", "perguntar", "montar", "sair"],
        description: "O desfecho deste turno.",
      },
      mensagem: {
        type: "string",
        description:
          "Sua fala pra família, como no WhatsApp. Escreva natural: aspas, travessões, quebras de linha e emoji são bem-vindos e NÃO precisam ser escapados.",
      },
      recorrente: {
        type: "boolean",
        description:
          "true SÓ quando o pedido é sobre a GRADE DA SEMANA — dias que se repetem toda semana ('as segundas', 'a semana inteira', 'organizar os dias da semana'). Um acontecimento ÚNICO é false, mesmo citando o nome do dia: 'domingo dia dos pais', 'sábado na casa da vó', 'segunda tenho dentista', 'dia 9', 'amanhã'. Na dúvida, false.",
      },
      // NÃO existe campo `tema` aqui, pelo mesmo motivo que não existe
      // `rotinas`: o tema é escolha da FAMÍLIA, capturada pelo código quando
      // ela responde. Deixar o campo era deixar a porta aberta — em 08/08/2026
      // o condutor pescou "boneca de pano" da conversa do dia anterior e
      // gerou 11 cartões de uma ida ao CINEMA nesse tema, sem perguntar nada.
      transicoes: {
        type: "array",
        description: "Momentos difíceis aprendidos nesta conversa.",
        items: {
          type: "object",
          properties: {
            momento: { type: "string" },
            estrategia: { type: "string" },
            funcionou: { type: "boolean" },
            merece_plano: { type: "boolean" },
          },
          required: ["momento"],
        },
      },
      // NÃO existe campo `rotinas` aqui. O condutor NÃO compõe o artefato —
      // quem compõe é `gerarRotina`, gerador único desde a consolidação de
      // 03/08/2026 (`rotina-servico.ts`), pelos dois canais.
      //
      // O campo existia como fóssil dessa época: o modelo gastava tokens
      // preenchendo uma sequência que `conduzirRotina` descartava sem nunca
      // ler (`parsed.rotinas`: zero ocorrências). Era a segunda composição —
      // a que prometeu 12 etapas enquanto o quadro recebia 9.
    },
    required: ["acao", "mensagem"],
  },
};

/** Bloco de resposta da API que interessa aqui — evita casar o tipo inteiro. */
type BlocoResposta = { type: string; text?: string; name?: string; input?: unknown };

/**
 * Lê o desfecho do condutor. Caminho normal: o bloco `tool_use`, já validado
 * pela API. Degradação: o modelo respondeu em prosa — aí ainda tentamos o
 * parser antigo, mas GRITANDO no log. A falha silenciosa foi o que fez este
 * defeito sobreviver semanas em produção; ela não volta.
 */
function lerDesfechoDoCondutor(resp: { content: BlocoResposta[] }): unknown {
  const ferramenta = resp.content.find(
    (b) => b.type === "tool_use" && b.name === FERRAMENTA_CONDUTOR.name,
  );
  if (ferramenta?.input && typeof ferramenta.input === "object") return ferramenta.input;

  const raw = resp.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
  const recuperado = extrairJsonRotina(raw);
  console.error(
    `[ayla:rotina] condutor não usou a ferramenta — ${
      recuperado ? "recuperado pelo parser de texto" : "DESFECHO PERDIDO"
    } (${raw.length} chars)`,
  );
  return recuperado;
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
    // NO MÁXIMO DUAS. O interesse conhecido vira SUGESTÃO, nunca escolha — o
    // tema é da rotina, não atributo fixo da criança. Despejar a lista inteira
    // vira formulário; oferecer uma só vira decisão disfarçada de pergunta.
    const sugestoesDeTema = (interesses ?? "")
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join("* ou *");

    // ── GATILHO DETERMINÍSTICO DO TEMA ─────────────────────────────────────
    // A rotina existe e espera só uma palavra. Essa palavra NÃO passa por
    // modelo nem por parser: em 07/08/2026 foi exatamente assim que a escolha
    // certa ("princesas") se perdeu no caminho e os cartões nunca saíram.
    // Aqui ela vira UPDATE + disparo, direto.
    const pendente = await rotinaAguardandoTema(supabase, familyId, params.membroAtipicoId);
    if (pendente) {
      if (recusouTema(params.contexto)) {
        // Desistir também é um desfecho — e precisa apagar o estado, senão a
        // rotina fica "aguardando" pra sempre e a tela mente.
        await supabase
          .from("rotinas")
          .update({ cards_status: "nenhum", modo_exibicao: "lista" })
          .eq("id", pendente.id);
        console.log(`[ayla:rotina] tema recusado — rotina ${pendente.id} volta a lista`);
        return {
          mensagem: `Tranquilo — deixei *${pendente.nome}* como lista mesmo, sem os cartões. Se mudar de ideia, é só me dizer um tema que eu desenho.`,
          pronto: true,
        };
      }
      const escolhido = lerTemaEscolhido(params.contexto);
      if (escolhido) {
        await supabase.from("rotinas").update({ tema: escolhido }).eq("id", pendente.id);
        const comecou = await dispararGeracao(pendente.id, escolhido);
        const link = await gerarMagicLink(supabase, {
          familyId,
          next: `/ludico/rotinas/${pendente.id}`,
        });
        console.log(
          `[ayla:rotina] tema "${escolhido}" aplicado em ${pendente.id} — geração ${comecou ? "iniciada" : "NÃO iniciada"}`,
        );
        // A fala reflete o estado real. Sem 200 do gerador, ninguém promete arte.
        const corpo = comecou
          ? `Perfeito — vou usar *${escolhido}* nesta rotina 🌿 Já comecei a preparar os cartões; eles vão aparecendo aí conforme ficarem prontos.`
          : `Anotei o tema *${escolhido}* nesta rotina. Os cartões ainda não começaram a ser desenhados — me chama daqui a pouco que eu tento de novo.`;
        const comoUsar = comecou
          ? // Sem exemplo fixo: "agora vamos ao mercado" saía até em rotina de
            // viagem pra casa da avó. Se é frase de modelo, tem que servir.
            `\n\nQuando estiverem prontos, mostre um de cada vez e vá dizendo o que é agora e o que vem depois.`
          : "";
        return {
          mensagem: link
            ? `${corpo}\n\nAbre aqui (já entra direto):\n${link}${comoUsar}`
            : `${corpo}${comoUsar}`,
          pronto: true,
        };
      }
    }

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
        // ROTULADA, como a conversa anterior — e pelo mesmo motivo. Entrando
        // crua, uma rotina de ontem ("Tarde da Manu: Almoço → Tarefa → Brincar
        // → Banho…") era lida como a sequência de AGORA: em 04/08/2026 a mãe
        // disse só "quero organizar a rotina do dia da Manu" e o porteiro
        // devolveu "suficiente". O gerador inventou o dia, o validador barrou,
        // e ela recebeu "montei aqui, mas prefiro confirmar".
        jaSabemos.rotinaExistente
          ? `ROTINA QUE JÁ EXISTE (de outro pedido — serve pra conhecer a criança; NÃO é a sequência de agora e NÃO conta como sequência informada):\n${jaSabemos.rotinaExistente}`
          : "",
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

    // O que falta é a ORDEM (não o escopo, não a criança). Quem decide entre
    // propor e perguntar é o TAMANHO, logo abaixo: uma passagem curta a gente
    // consegue imaginar pela dificuldade relatada; a manhã inteira de uma casa
    // que a gente não conhece, não.
    const faltaSequencia =
      prontidao.desfecho === "falta" &&
      /sequ[êe]ncia|ordem|o que acontece|como (é|e) (a|o)/i.test(prontidao.pergunta ?? "");

    const userPrompt = [
      prontidao.desfecho === "falta_escopo"
        ? `ELA AINDA NÃO DISSE O QUE QUER ORGANIZAR. NÃO pergunte dado nenhum — nem idade, nem horário, nem qual criança. Faça UMA pergunta DISCRIMINATIVA, com opções curtas e numeradas, pra ela responder com um número: o dia inteiro, a manhã, depois da escola, a noite — ou uma passagem específica que está mais difícil. Pergunta aberta ("como é a rotina dele?") custa um turno e devolve texto que você ainda vai ter que interpretar. acao="perguntar".`
        : "",
      prontidao.desfecho === "falta" && prontidao.pergunta && !(faltaSequencia && tamanho === "mini")
        ? `AINDA FALTA UMA COISA pra montar: ${prontidao.pergunta}\nFaça ESSA pergunta, do seu jeito — UMA só —, e NÃO monte a rotina neste turno (acao="perguntar").`
        : "",
      // ── ESTADO 2: PROPOR O RECORTE, não perguntar a sequência ───────────
      // Quando o que falta é a ordem E o recorte é curto (uma passagem), a
      // mãe já disse o suficiente pra você PENSAR POR ELA. "Todo dia é guerra
      // pra sair do videogame e ir pro banho" não pede "como é a rotina
      // dele?" — pede uma proposta que ela confirma com uma palavra.
      // Só vale no tamanho "mini": um período inteiro não se inventa.
      faltaSequencia && tamanho === "mini"
        ? `A MÃE JÁ DISSE QUAL É O MOMENTO DIFÍCIL, SÓ NÃO DISSE A ORDEM. NÃO pergunte "como é a rotina dele" — PROPONHA. Diga em uma linha que você não faria o dia inteiro, e sim só essa passagem; escreva a sequência que você montaria (3 a 5 etapas, com seta), e feche perguntando se a ordem bate com a casa dela. Ela responde "sim" ou corrige uma etapa — e aí você monta. NÃO monte neste turno: acao="perguntar".
Exemplo do formato (não copie o conteúdo): "Eu não faria uma rotina do dia inteiro pra isso — focaria nessa passagem. Montaria assim: aviso de que está terminando → salvar → guardar o controle → banho → jantar. Faz sentido essa ordem aí na sua casa?"`
        : "",
      faltaSequencia && tamanho !== "mini"
        ? `O QUE FALTA É A SEQUÊNCIA — e o jeito de pedir ENSINA a mãe a usar você. Peça as atividades na ordem em que acontecem e MOSTRE como é simples, com um exemplo curto ("café → escola → almoço → brincar → banho → jantar → dormir"). Diga que horário é OPCIONAL e ofereça o áudio. Uma frase, do seu jeito, sem virar formulário — e NÃO peça mais nada além da sequência (nem horário, nem ponto difícil, nem idade).`
        : "",
      soOrientacao ? ORIENTACAO_DE_TRANSICAO : "",
      // VAI HAVER CARTÃO. O TEMA É PERGUNTADO — decisão de 22/07/2026,
      // validada em role-play com a Karina, e reconfirmada pelo Sérgio em
      // 08/08. O interesse da criança serve pra a Ayla SUGERIR, não pra tirar
      // a escolha da família: o tema é da ROTINA, não atributo fixo da criança
      // (a mesma Manu tem rotina de dinossauros e rotina de princesas).
      //
      // Perguntar tinha sido removido em 03/08 porque SEGURAVA a entrega — mas
      // o que segurava não era a pergunta: era `tema=null` significar abandono
      // silencioso, sem estado e sem segunda chance. Com `cards_status
      // 'aguardando'` a pergunta deixou de ser um beco sem saída.
      // TEMA NÃO É DECISÃO DO MODELO. "Falta tema?" é estado do artefato, e
      // quem sabe disso é o código — que também conhece os interesses e faz a
      // pergunta depois da sequência, no lugar certo. Deixar os dois donos
      // perguntando foi o que produziu a pergunta ANTES da lista, em 08/08.
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
      tools: [FERRAMENTA_CONDUTOR],
      // Força a ferramenta: o turno SEMPRE volta estruturado, nunca como prosa
      // que alguém precise reinterpretar.
      tool_choice: { type: "tool", name: FERRAMENTA_CONDUTOR.name },
      messages: [{ role: "user", content: userPrompt }],
    });
    const parsed = lerDesfechoDoCondutor(resp) as
      | {
          acao?: string;
          mensagem?: string;
          pronto?: boolean;
          recorrente?: boolean;
          transicoes?: unknown;
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
    // O tema NÃO vem do modelo. Nesta função ele é sempre null: quando a
    // família escolhe, quem grava é o gatilho determinístico, direto no banco.
    const tema: string | null = null;

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
        // ── RECORRÊNCIA É PROPRIEDADE DO PEDIDO, NÃO DA PALAVRA ──────────
        // O gerador lia "domingo" no texto e escrevia dia_semana=6 — e um
        // acontecimento único virava grade semanal. Só em 3 semanas foram 18
        // de 22 pedidos: cada um perdeu o link (ia pra grade em vez da
        // rotina), perdeu a pergunta do tema e terminou com ZERO cartões.
        //
        // Agora quem decide é o pedido, declarado num campo. E duas ou mais
        // rotinas num pedido só podem ser grade — ninguém pede dois
        // acontecimentos únicos de uma vez —, então isso confirma sozinho.
        const recorrente = parsed?.recorrente === true || rotinas.length > 1;
        if (!recorrente) {
          const tinhaDia = rotinas.filter((x) => x.dia_semana != null).length;
          if (tinhaDia) {
            console.log(`[ayla:rotina] acontecimento único — ${tinhaDia} dia(s) de semana descartado(s)`);
          }
          rotinas = rotinas.map((x) => ({ ...x, dia_semana: null }));
        }
        // TEMA TEM UM DONO SÓ: A FAMÍLIA. O gerador também extraía um — e em
        // 08/08/2026 devolveu "Dia dos Pais" como TEMA VISUAL de uma rotina
        // do Dia dos Pais. Não é interesse da criança, é o nome do evento; e
        // bastava existir pra pular a pergunta e queimar 13 ilustrações num
        // tema que ninguém escolheu.
      } else {
        // Barrada, ou o gerador não devolveu nada: NÃO publica. A Ayla continua
        // conversando — o comportamento seguro em falha é texto, nunca um
        // artefato degradado.
        console.warn(`[ayla:rotina] serviço não gerou — ${r.desfecho}: ${r.motivo}`);
        const clinico = r.desfecho === "barrada" && r.falhas.some((f) => f.codigo === "manejo_clinico");
        return {
          mensagem: clinico
            ? `Consigo organizar bastante coisa do dia — a sequência, o banho, as trocas, o descanso, e o que vale anotar. Só a parte de horários e quantidades de mamada/alimentação eu não decido: isso segue com quem acompanha ${nome}. Me conta o que a pediatra já orientou sobre isso? Aí eu encaixo do jeito que ela falou e monto o resto em volta.`
            : `Pra montar esse quadro eu preciso da sequência do jeito que ela acontece aí — eu organizo, mas quem sabe o dia de vocês é você. Me manda na ordem, simples assim: café → escola → almoço → brincar → banho → jantar → dormir. Horário é opcional, e pode mandar áudio que eu transcrevo.`,
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
            : `Pra montar esse quadro eu preciso da sequência do jeito que ela acontece aí — eu organizo, mas quem sabe o dia de vocês é você. Me manda na ordem, simples assim: café → escola → almoço → brincar → banho → jantar → dormir. Horário é opcional, e pode mandar áudio que eu transcrevo.`,
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
      // ── ESTADO DERIVADO DO ARTEFATO, NÃO DO RAMO ──────────────────────
      // `faltaTema` tinha um `!temSemana` na frente. Era o buraco: numa rotina
      // marcada como semanal a fala PERGUNTAVA o tema e o estado não guardava
      // pendência nenhuma — a mensagem saía como `rotina_pronta`, a conversa
      // fechava, e a resposta da mãe ("Carrinho") caía no reativo genérico e
      // virava carrinho de supermercado. Karina, 07/08/2026.
      //
      // A condição agora é só o que descreve o artefato: quer cartão, existe
      // rotina, não tem tema. Se perguntamos, esperamos — e se esperamos,
      // geramos quando ela responder. As duas pontas usam a MESMA condição.
      let autoGerou = false;
      const faltaTema = visual && ids.length > 0 && !tema;
      faltaTemaFinal = faltaTema;
      if (visual && tema && ids.length) {
        for (const id of ids) await dispararGeracao(id, tema);
        autoGerou = true;
      }
      if (faltaTema) {
        // ESTADO OPERACIONAL VERDADEIRO. Antes ficava `cards_status="nenhum"`,
        // indistinguível de "ninguém pediu cartão" — e a tela abria em modo
        // cartões mostrando ícone, calada, pra sempre. `aguardando` diz o que
        // realmente acontece: os cartões existem no plano, falta ela escolher
        // o tema. É o que permite perguntar sem abandonar.
        await marcarAguardandoTema(supabase, ids);
        console.warn(
          `[ayla:rotina] cartões pedidos sem tema — rotina(s) em 'aguardando', tema perguntado na mensagem`,
        );
      }

      // ── UM OBJETIVO POR TURNO ──────────────────────────────────────────
      // Enquanto falta o tema, a Ayla quer UMA palavra e mais nada. Em
      // 07/08/2026 o turno saiu com três chamadas à ação coladas — escolha um
      // tema, abra o link, peça o PDF — e o link levava a uma rotina em
      // `aguardando`, ou seja, a cartões que ainda nem tinham sido
      // encomendados. Abrir ali não acrescentava nada e competia com a única
      // resposta que destrava a geração.
      //
      // Nem geramos o token: um magic link não usado é mais uma URL válida
      // solta no histórico da conversa — e o modelo já foi visto repescando
      // link antigo de turnos anteriores.
      const link = faltaTema ? null : await gerarMagicLink(supabase, { familyId, next });
      const fechamento = mensagem || `Prontinho — montei a rotina do(a) ${nome} 🌿`;
      // As etapas, lidas do quadro. A fala do condutor vem antes (o que ele
      // entendeu, a dica, a frase de antecipação); a lista vem daqui.
      const sequencia = await sequenciaDoQuadro(supabase, ids);
      // A ENTREGA CONCRETA é a rotina no app. O PDF é opção de impressão, e a
      // frase tem que dizer a verdade sobre o que existe agora.
      // ROTINA COMPLETA PEDIDA → OS CARTÕES SÃO O PRODUTO. Uma coisa é a mãe
      // trazer uma transição difícil (aí a menor ajuda resolve, e empurrar
      // cartão é vender ferramenta). Outra é ela pedir "quero organizar a
      // rotina do dia" e mandar a sequência inteira: aí a Kolo agrega ao
      // transformar aquilo em algo que a criança usa. Decisão do Sérgio,
      // 04/08/2026 — e a oferta vem DEPOIS de organizar, nunca na primeira
      // fala: perguntar tema antes de entender o dia é formulário.
      const ofereceCartoes =
        !autoGerou && !faltaTema && pedidoExplicito && tamanho === "rotina" && !temSemana;
      // A conversa segue ABERTA enquanto a resposta dela ainda pode virar
      // imagem — vale pro tema que falta e pra oferta que acabou de sair.
      if (ofereceCartoes) faltaTemaFinal = true;
      // AVATAR: a oferta vem DEPOIS, com os cartões já na mão. Pôr a criação do
      // avatar ANTES da rotina seria uma etapa de setup antes da primeira
      // entrega — e quem não terminasse ficaria sem rotina nenhuma. Com o
      // cartão na tela, o valor é óbvio: "ele podia ser o personagem".
      const temAvatar = await membroTemAvatar(supabase, params.membroAtipicoId);
      const convidaAvatar =
        autoGerou && !temAvatar
          ? `

Ah — se quiser, o próprio ${nome} pode ser o personagem dos cartões em vez de um desenho genérico. É só criar o avatar dele uma vez (Configurações → Avatar): fica salvo e vale pras histórias também. Aí eu refaço os cartões com a cara dele.`
          : "";
      // E NÃO PROMETE PRAZO. "1-2 minutinhos" era uma promessa que a gente
      // quebrava: as gerações medidas em 08/08/2026 levaram 2min18, 2min38 e
      // 3min08. Dizer que aparecem "conforme ficarem prontos" é verdade em
      // qualquer duração — e a mãe não fica olhando o relógio.
      //
      // A FRASE SEGUE O ESTADO OPERACIONAL, não a intenção. "Já comecei a
      // gerar" só é verdade quando o disparo aconteceu; enquanto falta o tema,
      // o que existe é uma pergunta em aberto — e dizer outra coisa é prometer
      // arte que ninguém pediu pra desenhar ainda.
      // DONO ÚNICO. Antes o código só perguntava SE o modelo não tivesse
      // perguntado (`!/tema|cartões/.test(mensagem)`) — dois donos, e a ordem
      // saía torta: a pergunta vinha na fala do modelo, ANTES da sequência.
      // Agora o modelo está proibido de tocar no assunto e a pergunta é daqui,
      // depois do quadro, sempre no mesmo lugar.
      //
      // A personalização não se perdeu: `sugestoesDeTema` sai dos interesses
      // reais da criança (`carregarInteresses`), a mesma fonte que alimenta os
      // chips de tema na web. Onde o interesse existe como dado, a sugestão é
      // dela; onde só existe como prosa no perfil, cai no convite aberto.
      const cartoes = autoGerou
        ? `\n\nJá comecei a preparar os cartões no tema *${tema}* — eles vão aparecendo nesta rotina conforme ficarem prontos 🌿`
        : faltaTema || ofereceCartoes
          ? `\n\nFalta só escolher o tema dos cartões${
              sugestoesDeTema
                ? `: posso fazer em *${sugestoesDeTema}* — ou qualquer outro que ${nome} esteja gostando agora.`
                : `. Me fala um tema que ${nome} ama — animais, dinossauros, fundo do mar, um personagem — que eu desenho em cima disso.`
            }`
          : "";
      const impresso = querImprimir
        ? "\n\nTe mandei também um *PDF pra imprimir* (com quadradinhos pra marcar)."
        : "";
      const orient = `${cartoes}${impresso}`;
      // A dica OFERECE duas coisas (editar e imprimir). Enquanto falta o tema
      // ela some junto com o link, pelo mesmo motivo: neste turno a Ayla tem um
      // objetivo só. Editar e imprimir continuam existindo — entram no turno
      // seguinte, quando os cartões já estão a caminho e há o que abrir.
      // `impresso` fica: é fato consumado (o PDF já foi enviado), não oferta.
      const dica = faltaTema
        ? ""
        : querImprimir
          ? "\n\nSe quiser mudar uma etapa ou um horário, é só me falar aqui que eu ajusto."
          : "\n\nSe quiser mudar uma etapa ou um horário, é só me falar. E se quiser imprimir pra colar na parede, eu te mando em PDF.";
      // A sequência entra ENTRE a fala e o resto: a mãe lê o que a Ayla
      // entendeu, vê o quadro exatamente como ficou, e só então os cartões, o
      // link e as opções.
      const quadro = sequencia ? `\n\n${sequencia}` : "";
      mensagem = link
        ? `${fechamento}${quadro}${orient}\n\nAbre aqui (já entra direto):\n${link}${dica}`
        : `${fechamento}${quadro}${orient}${dica}`;
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

Se for pedido de verdade, devolva pela ferramenta \`reescrever_tarefas\` as tarefas ATUALIZADAS, aplicando o pedido (adicionar / remover / mudar texto / mudar horário / reordenar) e MANTENDO tudo que ela NÃO mencionou. HORÁRIO é opcional (null se não tiver; nunca invente). Encaixe no lugar lógico (ex.: "lanche depois da escola" entra logo após a escola). Texto curto (1-5 palavras). NÃO invente atividades além do que ela pediu. Se NÃO for pedido de mudança, devolva a lista vazia.`;

/**
 * Mesmo contrato-como-ferramenta do condutor, pelo mesmo motivo — e aqui não é
 * hipótese: existe rotina em produção com a etapa `Aviso: "logo vamos embora
 * do circo"`. Uma aspa dentro do texto de um passo derrubava a edição inteira,
 * e `sanitizarTarefasSimples(null)` devolvia lista vazia, que este fluxo lê
 * como "não era pedido de mudança". A mãe pedia, e nada acontecia.
 */
const FERRAMENTA_EDITAR = {
  name: "reescrever_tarefas",
  description: "Devolve a lista completa de tarefas da rotina depois de aplicar o pedido da família.",
  input_schema: {
    type: "object" as const,
    properties: {
      tarefas: {
        type: "array",
        items: {
          type: "object",
          properties: {
            texto: { type: "string", description: "Curto. Pode conter aspas — não escape nada." },
            hora: { type: ["string", "null"] },
          },
          required: ["texto"],
        },
      },
    },
    required: ["tarefas"],
  },
};

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
/**
 * A mensagem é FEEDBACK sobre uma rotina que já existe?
 *
 * ⚠️ A ÂNCORA É O PONTO. "Não funcionou" é das frases mais ambíguas do
 * produto: pode ser sobre a rotina, um plano, um remédio, a escola. Tirar
 * cartão por palavra-chave solta custa à família o quadro que ela montou.
 *
 * Então exige DUAS coisas, não uma: uma leitura confiável do que ela disse E
 * que a fala toque no quadro daquele membro — pelo nome (rotina, cartões,
 * sequência) ou por uma etapa que está lá dentro. Sem as duas, devolve null e
 * a mensagem segue como conversa normal.
 */
/**
 * ENTREGA O ARTEFATO IMPRIMÍVEL — e devolve SÓ o que aconteceu de verdade.
 *
 * Devolve `null` quando não há nada determinístico a fazer (nenhuma rotina pra
 * apontar já é tratado com texto próprio; `null` fica pro caso de erro de
 * leitura). Nunca devolve uma frase de sucesso sem o envio ter sido aceito.
 */
export async function entregarArtefatoImprimivel(
  supabase: SupabaseClient,
  params: {
    familyId: string;
    membroAtipicoId: string;
    texto: string;
    phoneE164: string;
    nome: string;
  },
): Promise<string | null> {
  try {
    const { data: rots } = await supabase
      .from("rotinas")
      .select("id, nome, tema, cards_status, dia_semana, created_at")
      .eq("family_account_id", params.familyId)
      .eq("membro_atipico_id", params.membroAtipicoId)
      .order("created_at", { ascending: false })
      .limit(5);
    const lista = (rots ?? []) as Array<{
      id: string;
      nome: string;
      tema: string | null;
      cards_status: string | null;
      dia_semana: number | null;
      created_at: string;
    }>;
    if (lista.length === 0) return RESPOSTA_PDF.semRotina;

    // DUAS PLAUSÍVEIS: uma pergunta curta, e só. Nada de pedir a sequência de
    // novo — ela já deu, e repetir foi metade do estrago do caso real.
    const recentes = lista.filter((r) => r.dia_semana == null);
    const candidatas = recentes.length > 0 ? recentes : lista;
    // ACABOU DE SAIR = É ESSA. Quando a rotina mais nova nasceu há minutos, ela
    // é o referente do "PDF" que veio logo depois — perguntar "qual delas?"
    // seria fazer a família repetir o que acabou de acontecer na tela dela.
    // Só há dúvida de verdade quando nenhuma é claramente a da conversa.
    const idadeMin =
      (Date.now() - new Date(candidatas[0].created_at).getTime()) / 60_000;
    const acabouDeSair = idadeMin <= 30;
    if (!acabouDeSair && candidatas.length > 1 && candidatas[0].nome !== candidatas[1].nome) {
      return RESPOSTA_PDF.qualDelas([candidatas[0].nome, candidatas[1].nome]);
    }
    const rot = candidatas[0];

    if (alvoDoPedido(params.texto) === "cartoes") {
      const status = rot.cards_status ?? "nenhum";
      const link =
        (await gerarMagicLink(supabase, {
          familyId: params.familyId,
          next: `/ludico/rotinas/${rot.id}`,
        })) ?? "";
      if (status === "pronto") {
        // Os cartões existem: o PDF deles existe, e vive na rota do app.
        return link
          ? `Os cartões dessa rotina estão prontos 💛 O PDF pra recortar tá aqui:
${link}`
          : RESPOSTA_PDF.falhou;
      }
      if (status === "gerando") return RESPOSTA_PDF.cartoesJaGerando(link);
      if (!rot.tema) {
        // Sem tema não há cartão — e inventar um seria decidir pela família.
        return `Pra fazer os cartões eu preciso de um tema pra ilustrar 🌿 Do que ${params.nome} gosta mais?`;
      }
      await dispararGeracao(rot.id, rot.tema);
      return RESPOSTA_PDF.cartoesGerando(link);
    }

    // PDF SIMPLES: imediato, e NÃO depende de cards_status.
    const { data: tarefas } = await supabase
      .from("rotina_tarefas")
      .select("texto, hora, ordem")
      .eq("rotina_id", rot.id)
      .order("ordem", { ascending: true });
    const linhas = ((tarefas ?? []) as Array<{ texto: string; hora: string | null }>).map((t) => ({
      texto: t.texto,
      hora: t.hora ?? null,
    }));
    if (linhas.length === 0) return RESPOSTA_PDF.semRotina;

    const enviou = await entregarPdfDaRotina(supabase, {
      familyId: params.familyId,
      phoneE164: params.phoneE164,
      nome: params.nome,
      tema: rot.tema,
      rotinas: [{ nome: rot.nome, dia_semana: rot.dia_semana, tarefas: linhas }],
    });
    // A ÚNICA linha que autoriza dizer "enviei".
    return enviou ? RESPOSTA_PDF.enviado : RESPOSTA_PDF.falhou;
  } catch (e) {
    console.warn("[ayla:pdf-rota]", e instanceof Error ? e.message : e);
    return RESPOSTA_PDF.falhou;
  }
}

export async function lerFeedbackDaRotina(
  supabase: SupabaseClient,
  params: { familyId: string; membroAtipicoId: string; texto: string },
): Promise<FeedbackRotina | null> {
  const feedback = classificarFeedbackRotina(params.texto);
  if (!feedback) return null;
  try {
    const { data: rot } = await supabase
      .from("rotinas")
      .select("id")
      .eq("family_account_id", params.familyId)
      .eq("membro_atipico_id", params.membroAtipicoId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!rot) return null;
    const { data: tarefas } = await supabase
      .from("rotina_tarefas")
      .select("texto")
      .eq("rotina_id", (rot as { id: string }).id);
    const etapas = ((tarefas ?? []) as Array<{ texto: string }>).map((t) => t.texto);
    return falaDoQuadro(params.texto, etapas) ? feedback : null;
  } catch {
    return null;
  }
}

export async function editarRotina(
  supabase: SupabaseClient,
  params: {
    familyId: string;
    membroAtipicoId: string;
    texto: string;
    timezone?: string | null;
    phoneE164?: string | null;
    /**
     * Quando a mensagem foi FEEDBACK ("já faz sozinho", "não funcionou até o
     * jantar") e não pedido de edição. Muda a instrução do editor e registra o
     * resultado na rotina — ver `rotina-feedback.ts`.
     */
    feedback?: FeedbackRotina | null;
  },
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

    // FEEDBACK É RESULTADO, mesmo que a edição não saia. Grava antes: é isto
    // que tira a rotina da fila do follow-up e evita a mãe receber "você
    // chegou a testar?" no dia seguinte a ter contado que funcionou.
    if (params.feedback) {
      await supabase
        .from("rotinas")
        .update({
          resultado: params.feedback.resultado,
          resultado_nota: params.texto.slice(0, 500),
          resultado_em: new Date().toISOString(),
        })
        .eq("id", rotinaId)
        .then(undefined, () => {});
      // "Não funcionou, mas não sei onde" não edita nada — pergunta.
      if (params.feedback.acao === "investigar" || params.feedback.acao === "nenhum") return null;
    }

    const client = getAylaAnthropicClient();
    const resp = await client.messages.create({
      model: AYLA_MODEL_FALLBACK,
      max_tokens: 1200,
      system: params.feedback
        ? `${SYSTEM_EDITAR}

${instrucaoDeAjuste(params.feedback)}`
        : SYSTEM_EDITAR,
      tools: [FERRAMENTA_EDITAR],
      tool_choice: { type: "tool", name: FERRAMENTA_EDITAR.name },
      messages: [
        {
          role: "user",
          content: `TAREFAS ATUAIS:\n${JSON.stringify({ tarefas: atuais })}\n\nPEDIDO DA MÃE: ${params.texto}`,
        },
      ],
    });
    const usou = resp.content.find(
      (b) => b.type === "tool_use" && b.name === FERRAMENTA_EDITAR.name,
    ) as { input?: unknown } | undefined;
    let parsed = (usou?.input ?? null) as { tarefas?: unknown } | null;
    if (!parsed) {
      const raw = resp.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("");
      parsed = extrairJsonRotina(raw) as { tarefas?: unknown } | null;
      console.error(
        `[ayla:rotina] editor não usou a ferramenta — ${parsed ? "recuperado" : "PEDIDO PERDIDO"}`,
      );
    }
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
