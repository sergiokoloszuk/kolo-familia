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

export type Intent = "acolhimento" | "voce_sabia" | "completar_perfil";

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
};

async function loadContext(
  supabase: SupabaseClient,
  familyId: string,
  membroFocoId: string,
): Promise<Context | null> {
  const [{ data: profile }, { data: membros }, { data: kv }] = await Promise.all([
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
      .select("essencial, como_e, corpo_rotina, desafios_regulacao, sensorial")
      .eq("membro_atipico_id", membroFocoId)
      .maybeSingle(),
  ]);

  if (!membros || membros.length === 0) return null;
  const foco = membros.find((m) => m.id === membroFocoId);
  if (!foco) return null;

  const nomeMae =
    profile?.como_chamar?.trim() || profile?.nome_mae?.trim() || "oi";
  const p = pronomesPara(foco.genero as Genero);
  const gapsAbertos = GAPS_KV.filter((g) => {
    const sec = (kv as Record<string, { texto?: string } | null> | null)?.[g.campo];
    return !sec?.texto?.trim();
  });

  return {
    nomeMae,
    nomeMembro: foco.nome as string,
    generoMembro: foco.genero as Genero,
    idadeMembro: idadeAnos((foco.data_nascimento as string | null) ?? null),
    pronomesMembro: p,
    comNomeMembro: comPreposicaoCom(p, foco.nome as string),
    deNomeMembro: comPreposicaoDe(p, foco.nome as string),
    membrosDescritos: (membros as Array<{ nome: string; data_nascimento: string | null }>)
      .map((m) => {
        const idade = idadeAnos(m.data_nascimento);
        return `${m.nome}${idade != null ? ` (${idade} anos)` : ""}`;
      })
      .join(", "),
    gapsAbertos,
  };
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h * 31 + s.charCodeAt(i)) | 0) >>> 0;
  return h;
}

function pickIntent(seed: string): Intent {
  const r = hashSeed(seed) % 100;
  if (r < 40) return "acolhimento";
  if (r < 70) return "voce_sabia";
  return "completar_perfil";
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

  const seed = `${params.familyId}-${params.agora.toDateString()}`;
  let intent = pickIntent(seed);

  // Sub-sort por intenção; completar_perfil sem gaps vira acolhimento.
  let userPrompt: string;
  if (intent === "completar_perfil") {
    const gap = pickGap(seed, ctx.gapsAbertos);
    if (!gap) {
      intent = "acolhimento";
      userPrompt = promptAcolhimento(ctx);
    } else {
      userPrompt = promptCompletarPerfil(ctx, gap);
    }
  } else if (intent === "voce_sabia") {
    const featureDescricao = pickFeature(seed, ctx.nomeMembro);
    userPrompt = promptVoceSabia(ctx, featureDescricao);
  } else {
    userPrompt = promptAcolhimento(ctx);
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
