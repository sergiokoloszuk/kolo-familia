import type { SupabaseClient } from "@supabase/supabase-js";
import { getAylaAnthropicClient, AYLA_MODEL } from "./anthropic";
import { logarUsoApi } from "@/lib/billing/logar";
import {
  pronomesPara,
  comPreposicaoCom,
  comPreposicaoDe,
  type Genero,
  type Pronomes,
} from "./pronomes";
import { idadeAnos } from "@/lib/idade";
import { primeiroNome } from "@/lib/nome";
import { gerarMagicLink } from "./ponte";
import { carregarCadenciaMap } from "@/lib/crm/ayla-cadencia";

const MS_DIA = 86_400_000;

/** Domínios do Perfil (categorias_extras) → rótulo humano pras perguntas. */
const DOMINIO_LABEL: Record<string, string> = {
  comunicacao: "comunicação",
  socializacao: "socialização",
  foco: "foco e atenção",
  escola: "escola",
  sono: "sono",
  autonomia: "autonomia",
  emocional: "emoções e regulação",
  nutricional: "alimentação",
  sensorial: "sensorial",
  rotina: "rotina",
};
/** Áreas que valem explorar numa CRIANÇA (as que ela pediu + as clássicas). */
const DOMINIOS_CRIANCA = ["comunicacao", "socializacao", "foco", "escola", "sono", "autonomia", "emocional"];

/**
 * Gerador de mensagens espontâneas da Ayla via IA — substitui os templates
 * estáticos da rotina diária por texto gerado por Haiku, escolhendo entre 3
 * intenções (acolhimento, voce_sabia, completar_perfil).
 *
 * Sorteio determinístico por familyId+dia: a família recebe o mesmo tipo de
 * mensagem se o cron disparar 2× no mesmo dia, mas varia ao longo da semana.
 *
 * Falha (rede, modelo, texto vazio) lança erro. O orchestrator captura e cai
 * no templateRotinaDiaria estático como rede de segurança.
 */

export type Intent =
  | "acolhimento"
  | "voce_sabia"
  | "completar_perfil"
  | "convite_plano"
  | "ensinar_valor"
  | "feedback_plano"
  | "menu_do_dia"
  | "aprofundar_tema"
  | "explorar_temas";

export type MensagemEspontaneaResult = {
  texto: string;
  intent: Intent;
};

const FEATURES: Array<{ slug: string; descricao: string }> = [
  {
    slug: "kolo_vivo",
    descricao:
      "Perfil: cada filho tem um retrato que vai crescendo conforme você me conta — gostos, gatilhos, rotina, jeito de ser. Você abre no app e vê tudo organizado.",
  },
  {
    slug: "historias",
    descricao:
      "Histórias ilustradas: você descreve uma situação (ir ao dentista, dormir na casa nova, dia de festa) e a Kolo escreve uma história com {nomeMembro} como personagem, ilustrada.",
  },
  {
    slug: "sugestoes",
    descricao:
      "Sugestões: quando vejo um padrão repetindo no que você me conta, eu proponho uma prática pra você experimentar. Fica como sugestão no Perfil, você aceita ou ignora.",
  },
  {
    slug: "audio",
    descricao:
      "Áudio no WhatsApp: pode mandar voz em vez de texto sempre que for mais fácil. Eu transcrevo e entendo igual.",
  },
  {
    slug: "comandos",
    descricao:
      "Comandos rápidos: PAUSAR pausa minhas mensagens por uns dias, MUDAR HORARIO 20:00 muda o horário em que te procuro.",
  },
  {
    slug: "memoria",
    descricao:
      "Memória da conversa: tudo que você me conta fica guardado. Cada mensagem nova eu já leio sabendo o histórico — vou conhecendo {nomeMembro} cada vez mais.",
  },
];

type GapKV = {
  campo: string;
  perguntaGuia: (nomeMembro: string, deNomeMembro: string) => string;
};

const GAPS_KV: GapKV[] = [
  {
    campo: "essencial",
    perguntaGuia: (n) => `o que é essencial pra você sobre ${n} hoje em dia`,
  },
  {
    campo: "como_e",
    perguntaGuia: (_n, dn) => `uma coisa do jeito de ser ${dn} que você ama`,
  },
  {
    campo: "corpo_rotina",
    perguntaGuia: (_n, dn) =>
      `como é o corpo ${dn} num dia comum — energia, fome, sono`,
  },
  {
    campo: "desafios_regulacao",
    perguntaGuia: (n) => `uma coisa que costuma desregular ${n}`,
  },
  {
    campo: "sensorial",
    perguntaGuia: (n) =>
      `alguma textura, som, luz ou cheiro que ${n} foge ou procura`,
  },
];

const SYSTEM_PROMPT = `Você é a Ayla — uma presença calma, experiente e afetuosa que apoia famílias de pessoas neurodivergentes (crianças, adolescentes ou adultos) pelo WhatsApp. NÃO é robô nem aplicativo: fala como pessoa que entende de neurodivergência e do cansaço de cuidar.

# Voz
- Português do Brasil natural. WhatsApp, não e-mail.
- 2 ou 3 parágrafos curtos separados por linha em branco.
- No máximo 60 palavras no total.
- No máximo 1 emoji em toda a mensagem (opcional 🌿).
- Sem listas numeradas, sem markdown, sem títulos.
- Sem "Olá", "Tudo bem?", "Espero que estejam todos bem", "Estamos aqui pra apoiar você". Esses formulários morrem.
- Nunca assuma gênero da pessoa que recebe. Use o nome direto, não "mãe".
- A pessoa em foco pode ter QUALQUER idade — confira a idade no contexto. Adulto é tratado como adulto: sem chamar de "criança", sem diminutivos infantis; use o nome.
- Varie. Nunca soe formulário.

# Regras
- Use SOMENTE o que está no CONTEXTO que vou te passar. Não invente funcionalidades, não invente fatos da família.
- Devolva SÓ o texto da mensagem. Sem aspas, sem "Aqui está:", sem comentário, sem "Ayla:".`;

type Context = {
  nomeMae: string;
  nomeMembro: string;
  generoMembro: Genero;
  idadeMembro: number | null;
  pronomesMembro: Pronomes;
  comNomeMembro: string;
  deNomeMembro: string;
  membrosDescritos: string;
  gapsAbertos: GapKV[];
  /** Já recebeu ao menos um PLANO? O plano é o que encanta — se não, a Ayla puxa pra lá. */
  temPlano: boolean;
  /** Dia do teste (1-7), pra cadência dia-a-dia. null se não estiver em trial. */
  diaTrial: number | null;
  /** A pessoa já respondeu alguma vez? (se não, o "menu do dia" desbloqueia.) */
  interagiu: boolean;
  /** O Perfil está completo (sem campos-chave em branco)? */
  perfilCompleto: boolean;
  /** O foco é CRIANÇA (≤12)? Só aí o Lúdico entra no menu. */
  ehCrianca: boolean;
  /** Temas que ela JÁ indicou como desafiadores (com o que contou) — pra aprofundar. */
  temasComInfo: { dominio: string; label: string; texto: string }[];
  /** Áreas (criança) que AINDA não conhecemos — pra explorar sem repetir. */
  temasSemInfo: string[];
  /** Interesses da criança (pra cruzar com os desafios nos planos/histórias). */
  interesses: string[];
};

async function loadContext(
  supabase: SupabaseClient,
  familyId: string,
  membroFocoId: string,
): Promise<Context | null> {
  const [
    { data: profile },
    { data: membros },
    { data: kv },
    { data: planos },
    { data: conta },
    { data: sub },
    { data: inbound },
  ] = await Promise.all([
    supabase
      .from("family_profiles")
      .select("nome_mae, como_chamar")
      .eq("family_account_id", familyId)
      .maybeSingle(),
    supabase
      .from("membros_atipicos")
      .select("id, nome, data_nascimento, genero")
      .eq("family_account_id", familyId)
      .eq("ativo", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("perfil_vivo_membro")
      .select("essencial, como_e, corpo_rotina, desafios_regulacao, sensorial, categorias_extras")
      .eq("membro_atipico_id", membroFocoId)
      .maybeSingle(),
    supabase.from("planos").select("id").eq("family_account_id", familyId).limit(1),
    supabase.from("family_accounts").select("created_at").eq("id", familyId).maybeSingle(),
    supabase.from("subscription_accesses").select("status").eq("family_account_id", familyId).maybeSingle(),
    supabase.from("ayla_messages").select("id").eq("family_account_id", familyId).eq("direcao", "inbound").limit(1),
  ]);

  if (!membros || membros.length === 0) return null;
  const foco = membros.find((m) => m.id === membroFocoId);
  if (!foco) return null;

  const nomeMae =
    profile?.como_chamar?.trim() || profile?.nome_mae?.trim() || "";
  const p = pronomesPara(foco.genero as Genero);
  const gapsAbertos = GAPS_KV.filter((g) => {
    const sec = (kv as Record<string, { texto?: string } | null> | null)?.[g.campo];
    return !sec?.texto?.trim();
  });

  const status = (sub?.status as string | null) ?? null;
  const criado = conta?.created_at ? new Date(conta.created_at as string).getTime() : null;
  const diaTrial =
    status === "trialing" && criado
      ? Math.min(7, Math.max(1, Math.floor((Date.now() - criado) / MS_DIA) + 1))
      : null;
  const idadeFoco = idadeAnos((foco.data_nascimento as string | null) ?? null);

  // Temas (desafios) e interesses do Perfil — pra personalizar e não repetir.
  const extras = ((kv as { categorias_extras?: Record<string, unknown> } | null)?.categorias_extras ??
    {}) as Record<string, unknown>;
  const textoDe = (k: string) => (extras[k] as { texto?: string } | undefined)?.texto?.trim() ?? "";
  const temasComInfo = Object.keys(DOMINIO_LABEL)
    .filter((k) => textoDe(k))
    .map((k) => ({ dominio: k, label: DOMINIO_LABEL[k], texto: textoDe(k) }));
  const temasSemInfo = DOMINIOS_CRIANCA.filter((k) => !textoDe(k)).map((k) => DOMINIO_LABEL[k]);
  const interesses = (
    ((extras.preferencias as { temas?: unknown } | undefined)?.temas as string[] | undefined) ??
    ((kv as { como_e?: { interesses?: unknown } } | null)?.como_e?.interesses as string[] | undefined) ??
    []
  ).filter((x): x is string => typeof x === "string" && !!x.trim());

  // PRIMEIRO nome, sempre. Com o nome cru, a Ayla escrevia "Ryan Lucas de
  // Oliveira Feitosa" três vezes na MESMA mensagem (caso real, 27-29/07) —
  // ninguém chama o filho assim, e soa cadastro, não conversa.
  const nomeFoco = primeiroNome(foco.nome as string) || (foco.nome as string);

  return {
    nomeMae,
    nomeMembro: nomeFoco,
    generoMembro: foco.genero as Genero,
    idadeMembro: idadeAnos((foco.data_nascimento as string | null) ?? null),
    pronomesMembro: p,
    comNomeMembro: comPreposicaoCom(p, nomeFoco),
    deNomeMembro: comPreposicaoDe(p, nomeFoco),
    membrosDescritos: (membros as Array<{ nome: string; data_nascimento: string | null }>)
      .map((m) => {
        const idade = idadeAnos(m.data_nascimento);
        return `${m.nome}${idade != null ? ` (${idade} anos)` : ""}`;
      })
      .join(", "),
    gapsAbertos,
    temPlano: (planos?.length ?? 0) > 0,
    diaTrial,
    interagiu: (inbound?.length ?? 0) > 0,
    perfilCompleto: gapsAbertos.length === 0,
    ehCrianca: idadeFoco != null && idadeFoco <= 12,
    temasComInfo,
    temasSemInfo,
    interesses,
  };
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h * 31 + s.charCodeAt(i)) | 0) >>> 0;
  return h;
}

function pickIntent(
  seed: string,
  s: {
    temPlano: boolean;
    diaTrial: number | null;
    interagiu: boolean;
    temTemaComInfo: boolean;
    temGapExplorar: boolean;
  },
): Intent {
  const r = hashSeed(seed) % 100;
  // Não engajou ainda (D2+): o "menu do dia" é o desbloqueio.
  if (!s.interagiu && (s.diaTrial ?? 1) >= 2) {
    if (r < 50) return "menu_do_dia";
    if (r < 78) return "convite_plano";
    return "ensinar_valor";
  }
  // Personalização ancorada nos temas dela — a mudança que mais move o lead.
  if (s.temTemaComInfo && r < 26) return "aprofundar_tema";
  if (s.temGapExplorar && r < 48) return "explorar_temas";
  // Ainda sem plano: puxa pro plano/valor.
  if (!s.temPlano) {
    if (r < 70) return "convite_plano";
    if (r < 86) return "ensinar_valor";
    return "acolhimento";
  }
  // Já tem plano: pergunta o que achou; recurso e acolhimento.
  if (r < 62) return "feedback_plano";
  if (r < 80) return "voce_sabia";
  return "acolhimento";
}

function pickFeature(seed: string, nomeMembro: string): string {
  const f = FEATURES[hashSeed(`${seed}-feature`) % FEATURES.length];
  return f.descricao.replaceAll("{nomeMembro}", nomeMembro);
}

function pickGap(seed: string, gaps: GapKV[]): GapKV | null {
  if (gaps.length === 0) return null;
  return gaps[hashSeed(`${seed}-gap`) % gaps.length];
}

function promptAcolhimento(ctx: Context): string {
  return `INTENÇÃO: acolhimento

CONTEXTO:
- Quem recebe: ${ctx.nomeMae}
- Pessoa(s) atípica(s) da família: ${ctx.membrosDescritos}
- Em foco: ${ctx.nomeMembro}${ctx.idadeMembro != null ? `, ${ctx.idadeMembro} anos` : " (idade não informada — trate pelo nome, não presuma criança)"}

TAREFA:
Escreve uma abertura de conversa, neutra e calorosa. Convida ${ctx.nomeMae} a contar uma coisa boa e uma difícil — do que vier à cabeça. NÃO ancora em "hoje", "agora", "esta manhã", "fim de dia" (a mensagem pode chegar em qualquer horário da janela, precisa funcionar manhã, tarde ou noite). NÃO cobra.

EXEMPLOS DO TOM (não copie literal, só inspira):
- "${ctx.nomeMae}, oi. Como vocês estão ${ctx.comNomeMembro}? Pode ser frase curta — ou áudio, se for mais fácil."
- "Oi 🌿 O que tá pegando mais por aí? E o que tá ajudando? Me conta quando der."

Gere UMA nova mensagem.`;
}

function promptConvitePlano(ctx: Context): string {
  return `INTENÇÃO: convite_plano

CONTEXTO:
- Quem recebe: ${ctx.nomeMae}
- Em foco: ${ctx.nomeMembro}${ctx.idadeMembro != null ? `, ${ctx.idadeMembro} anos` : " (idade não informada — trate pelo nome, não presuma criança)"}

TAREFA:
Convide ${ctx.nomeMae} a te contar UM desafio concreto que esteja pegando AGORA (sono, birra, escola, comida, transição, crise…) — pra você montar um PLANO prático pra vocês tentarem. Deixe claro, sem prometer milagre, o ganho: você organiza passos possíveis, frases pra usar e o que observar, do jeito ${ctx.deNomeMembro}. É o que mais ajuda no dia a dia.

- Uma pergunta só: qual desafio ela quer atacar primeiro.
- Curto, humano, do jeito de uma amiga que entende. NÃO use as palavras "funcionalidade", "plataforma", "recurso".

EXEMPLOS DE TOM (não copie literal, só inspira):
- "${ctx.nomeMae}, me conta um desafio que tá pegando agora ${ctx.comNomeMembro} — sono, escola, birra? Eu monto um plano prático pra vocês tentarem."
- "Se tem uma situação que te deixa sem saber o que fazer, me fala. A partir dela eu armo um passo a passo pensado pra ${ctx.nomeMembro}."

Gere UMA nova mensagem.`;
}

function promptEnsinarValor(ctx: Context): string {
  return `INTENÇÃO: ensinar_valor

CONTEXTO:
- Quem recebe: ${ctx.nomeMae}
- Em foco: ${ctx.nomeMembro}${ctx.idadeMembro != null ? `, ${ctx.idadeMembro} anos` : " (idade não informada — trate pelo nome, não presuma criança)"}

TAREFA:
Muita gente no começo não sabe PRA QUÊ contar o dia a dia. Explique, do jeito de uma amiga (não tutorial, não lista fria), que quanto mais ${ctx.nomeMae} te conta do dia a dia, mais você consegue ajudar de verdade:
- montar um panorama da EVOLUÇÃO ${ctx.deNomeMembro} ao longo do tempo — que dá pra mostrar pra escola ou terapeuta;
- personalizar as ideias pra ${ctx.nomeMembro};
- e montar PLANOS pra um desafio específico.

Termine convidando de leve a começar por UMA coisa de hoje (uma conquista ou um desafio). NÃO soe manual; é conversa. NÃO use "funcionalidade", "plataforma", "recurso", "banco de dados".

Gere UMA nova mensagem.`;
}

function promptFeedbackPlano(ctx: Context): string {
  return `INTENÇÃO: feedback_plano

CONTEXTO:
- Quem recebe: ${ctx.nomeMae}
- Em foco: ${ctx.nomeMembro}${ctx.idadeMembro != null ? `, ${ctx.idadeMembro} anos` : " (idade não informada — trate pelo nome, não presuma criança)"}
- ${ctx.nomeMae} JÁ recebeu ao menos um plano.

TAREFA:
Pergunte, com leveza e curiosidade de verdade, o que ${ctx.nomeMae} achou do plano: se chegou a testar na rotina, o que funcionou e o que não. É pra você acompanhar e melhorar — e pra ela sentir que tem alguém junto. Uma pergunta só. NÃO soe pesquisa/formulário nem "avalie de 1 a 5".

EXEMPLOS DE TOM (não copie literal, só inspira):
- "${ctx.nomeMae}, você chegou a testar o plano que montei? Fico curiosa pra saber o que funcionou aí ${ctx.comNomeMembro} — e o que não."
- "Como foi com o plano? Me conta o que pegou e o que não colou, que eu ajusto pro próximo."

Gere UMA nova mensagem.`;
}

function promptAprofundarTema(
  ctx: Context,
  tema: { dominio: string; label: string; texto: string },
): string {
  const usaInteresses = ctx.interesses.length
    ? ` A ${ctx.nomeMembro} gosta de: ${ctx.interesses.join(", ")} — dá pra usar isso pra deixar mais leve.`
    : "";
  return `INTENÇÃO: aprofundar_tema

CONTEXTO:
- Quem recebe: ${ctx.nomeMae}
- Em foco: ${ctx.nomeMembro}${ctx.idadeMembro != null ? `, ${ctx.idadeMembro} anos` : ""}
- Tema que ${ctx.nomeMae} JÁ indicou como desafiador: "${tema.label}"${tema.texto ? ` — ela contou: "${tema.texto.slice(0, 200)}"` : ""}.${usaInteresses}

TAREFA:
Retome esse tema com carinho: pergunte como TEM SIDO ultimamente (de forma atemporal). Convide a contar um pouco mais — o que costuma acontecer, o que já tentaram — e ofereça montar um PLANO prático pra isso${ctx.interesses.length ? ", usando o que a criança ama" : ""}. Deixe a opção de ÁUDIO.

Regras:
- Diga "desafiador" / "difícil" — NUNCA "pega bastante aí".
- NÃO cite acontecimentos pontuais/datados (viagem, prova, festa) — só o tema em si, atemporal.
- Uma pergunta, curto, WhatsApp, sem "funcionalidade/plataforma/recurso".

Gere UMA nova mensagem.`;
}

function promptExplorarTema(ctx: Context, dominioLabel: string): string {
  const usaInteresses = ctx.interesses.length
    ? ` Você já sabe que a ${ctx.nomeMembro} ama: ${ctx.interesses.join(", ")}.`
    : "";
  return `INTENÇÃO: explorar_temas

CONTEXTO:
- Quem recebe: ${ctx.nomeMae}
- Em foco: ${ctx.nomeMembro}${ctx.idadeMembro != null ? `, ${ctx.idadeMembro} anos` : ""} (criança).${usaInteresses}
- Área que você AINDA NÃO conhece e quer explorar HOJE: ${dominioLabel}.

TAREFA:
Faça UMA pergunta calorosa e curiosa sobre "${dominioLabel}", pra conhecer melhor a ${ctx.nomeMembro} e personalizar as ideias. Espírito (não copie): comunicação → como ela se comunica no dia a dia; socialização → como é com outras crianças, se brinca junto; foco → em que engata e quando dispersa; escola → o que funciona e o que é desafiador. Se ajudar, conecte de leve com um interesse que você já conhece.

Regras:
- O objetivo é conhecer/atualizar o Perfil — cada resposta deixa as ideias mais certeiras.
- Atemporal: nada de eventos datados. Diga "desafiador", não "pega aí".
- Uma pergunta, curto, WhatsApp, com opção de ÁUDIO, sem jargão.

Gere UMA nova mensagem.`;
}

function promptMenuDia(ctx: Context, links: { rotina: string | null; historia: string | null }): string {
  const opcoes = ctx.ehCrianca
    ? `1. Ajuda pra uma SITUAÇÃO específica (um desafio de agora)
2. Montar uma ROTINA VISUAL — dá previsibilidade e segurança nas transições do dia${links.rotina ? ` (abre direto: ${links.rotina})` : ""}
3. Uma HISTÓRIA com ${ctx.nomeMembro} de protagonista, pra ajudar num desafio${links.historia ? ` (abre direto na criação: ${links.historia})` : ""}
Ou só CONTAR como foi o dia — pode ser ÁUDIO`
    : `1. Ajuda pra uma SITUAÇÃO específica (um desafio de agora)
2. Montar um PLANO pra um desafio atual
Ou só CONTAR como foi o dia — pode ser ÁUDIO`;

  return `INTENÇÃO: menu_do_dia

CONTEXTO:
- Quem recebe: ${ctx.nomeMae}
- Em foco: ${ctx.nomeMembro}${ctx.idadeMembro != null ? `, ${ctx.idadeMembro} anos` : ""}${ctx.ehCrianca ? " (criança)" : " (NÃO é criança — nada de Lúdico/rotina visual/história infantil)"}

TAREFA:
Ofereça um MENU curto do dia, deixando ${ctx.nomeMae} escolher como quer ser ajudada HOJE. Abra com 1 frase lembrando que registrar o dia é o que permite ver a EVOLUÇÃO ${ctx.deNomeMembro} por tema mais pra frente. Depois as opções (numeradas, curtas):
${opcoes}

Regras:
- Convide a responder com o número, ou do jeito dela.
- Se houver link, use EXATAMENTE o link que te passei (não invente URL).
- Deixe claro que CONTAR o dia pode ser por ÁUDIO — e que isso já vira a evolução.
- Curto, humano, WhatsApp. Sem "funcionalidade", "plataforma", "recurso".

Gere UMA nova mensagem com esse menu.`;
}

function promptVoceSabia(ctx: Context, featureDescricao: string): string {
  return `INTENÇÃO: voce_sabia

CONTEXTO:
- Quem recebe: ${ctx.nomeMae}
- Em foco: ${ctx.nomeMembro}${ctx.idadeMembro != null ? `, ${ctx.idadeMembro} anos` : " (idade não informada — trate pelo nome, não presuma criança)"}
- A funcionalidade que você vai mencionar nesta mensagem (use SÓ essa, não mistura):
  ${featureDescricao}

TAREFA:
Mensagem no estilo "Você sabia que…?" sobre essa funcionalidade. Estrutura sugerida:
- Linha 1: "${ctx.nomeMae}, você sabia que…" + a descrição na sua voz
- Linha 2: convite leve pra usar OU pra te contar uma frase do dia

NÃO mencione as palavras "plataforma", "funcionalidade", "feature", "aplicativo". Fala como amiga, não como produto.`;
}

function promptCompletarPerfil(ctx: Context, gap: GapKV): string {
  const perguntaGuia = gap.perguntaGuia(ctx.nomeMembro, ctx.deNomeMembro);
  return `INTENÇÃO: completar_perfil

CONTEXTO:
- Quem recebe: ${ctx.nomeMae}
- Em foco: ${ctx.nomeMembro}${ctx.idadeMembro != null ? `, ${ctx.idadeMembro} anos` : " (idade não informada — trate pelo nome, não presuma criança)"}
- Pronome: ${ctx.pronomesMembro.sujeito} / ${ctx.pronomesMembro.possessivo}
- O que você está tentando descobrir sobre ${ctx.nomeMembro}: ${perguntaGuia}

TAREFA:
Pergunta sobre ${ctx.nomeMembro} pra você conhecer ${ctx.pronomesMembro.sujeito} melhor (e poder acertar mais no futuro). Use a pergunta-guia como espírito, mas reescreve com sua voz — NÃO copie literal.

Estrutura sugerida:
- Frase 1: contextualiza por que tá perguntando ("Tô tentando conhecer ${ctx.nomeMembro} um pouco melhor")
- Frase 2: a pergunta em si, do jeito ${ctx.nomeMae} contaria
- Frase 3 (curta): "qualquer coisa serve — uma palavra, um áudio"

NÃO use as palavras "neurodivergente", "perfil", "banco de dados", "registro". Fala como amiga curiosa.`;
}

export async function gerarMensagemEspontanea(
  supabase: SupabaseClient,
  params: {
    familyId: string;
    agora: Date;
    membroFocoId: string;
  },
): Promise<MensagemEspontaneaResult> {
  const ctx = await loadContext(supabase, params.familyId, params.membroFocoId);
  if (!ctx) {
    throw new Error("Sem contexto da família/membro pra gerar mensagem espontânea.");
  }

  const cadenciaMap = await carregarCadenciaMap(supabase);
  const seed = `${params.familyId}-${params.agora.toDateString()}`;
  let intent = pickIntent(seed, {
    temPlano: ctx.temPlano,
    diaTrial: ctx.diaTrial,
    interagiu: ctx.interagiu,
    temTemaComInfo: ctx.temasComInfo.length > 0,
    temGapExplorar: ctx.ehCrianca && ctx.temasSemInfo.length > 0,
  });
  // Situação desligada por você na Configuração → cai no acolhimento (sempre on).
  if (cadenciaMap.get(intent)?.ativo === false) intent = "acolhimento";

  // Sub-sort por intenção; completar_perfil sem gaps vira convite ao plano
  // (melhor puxar pro que ativa do que só pedir mais dado).
  let userPrompt: string;
  if (intent === "completar_perfil") {
    const gap = pickGap(seed, ctx.gapsAbertos);
    if (!gap) {
      intent = "convite_plano";
      userPrompt = promptConvitePlano(ctx);
    } else {
      userPrompt = promptCompletarPerfil(ctx, gap);
    }
  } else if (intent === "voce_sabia") {
    const featureDescricao = pickFeature(seed, ctx.nomeMembro);
    userPrompt = promptVoceSabia(ctx, featureDescricao);
  } else if (intent === "convite_plano") {
    userPrompt = promptConvitePlano(ctx);
  } else if (intent === "ensinar_valor") {
    userPrompt = promptEnsinarValor(ctx);
  } else if (intent === "feedback_plano") {
    userPrompt = promptFeedbackPlano(ctx);
  } else if (intent === "menu_do_dia") {
    const [rotina, historia] = ctx.ehCrianca
      ? await Promise.all([
          gerarMagicLink(supabase, { familyId: params.familyId, next: "/ludico/rotinas/semana" }),
          gerarMagicLink(supabase, { familyId: params.familyId, next: "/historias/criar" }),
        ])
      : [null, null];
    userPrompt = promptMenuDia(ctx, { rotina, historia });
  } else if (intent === "aprofundar_tema") {
    const tema = ctx.temasComInfo.length
      ? ctx.temasComInfo[hashSeed(`${seed}-tema`) % ctx.temasComInfo.length]
      : null;
    userPrompt = tema ? promptAprofundarTema(ctx, tema) : promptConvitePlano(ctx);
  } else if (intent === "explorar_temas") {
    const dom = ctx.temasSemInfo.length
      ? ctx.temasSemInfo[hashSeed(`${seed}-explorar`) % ctx.temasSemInfo.length]
      : null;
    userPrompt = dom ? promptExplorarTema(ctx, dom) : promptAcolhimento(ctx);
  } else {
    userPrompt = promptAcolhimento(ctx);
  }

  // Concordância de GÊNERO obrigatória (todos os intents) — antes vazava
  // "a Heitor/ela" pra um menino. Usa o gênero que já está no contexto.
  const pg = ctx.pronomesMembro;
  const concordancia =
    ctx.generoMembro === "feminino" || ctx.generoMembro === "masculino"
      ? `CONCORDÂNCIA OBRIGATÓRIA: ${ctx.nomeMembro} é ${ctx.generoMembro} — use SEMPRE "${pg.sujeito}/${pg.possessivo}" e "${pg.artigo} ${ctx.nomeMembro}". NUNCA troque o gênero (erro grave que quebra a confiança).`
      : `CONCORDÂNCIA: o gênero de ${ctx.nomeMembro} não foi informado — refira-se pelo nome e evite "ele/ela", "dele/dela".`;
  userPrompt = `${concordancia}\n\n${userPrompt}`;

  // Diretriz editável da Karina pra esta situação (Configuração) tem prioridade.
  const diretriz = cadenciaMap.get(intent)?.diretriz?.trim();
  if (diretriz) {
    userPrompt += `\n\nORIENTAÇÃO DA KARINA (prioridade — ajuste a mensagem a isto): ${diretriz}`;
  }

  const client = getAylaAnthropicClient();
  const resp = await client.messages.create({
    model: AYLA_MODEL,
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  await logarUsoApi(supabase, {
    family_account_id: params.familyId,
    provider: "anthropic",
    model: AYLA_MODEL,
    feature: "ayla_espontanea",
    input_tokens: resp.usage.input_tokens,
    output_tokens: resp.usage.output_tokens,
    meta: { intent },
  });

  const block = resp.content[0];
  const texto = block?.type === "text" ? block.text.trim() : "";
  if (!texto) throw new Error("Modelo devolveu texto vazio.");

  return { texto, intent };
}
