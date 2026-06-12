import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicClient, MODELS } from "@/lib/ia/anthropic";
import { logarUsoApi } from "@/lib/billing/logar";

/**
 * "O que o desenho conta?" — leitura OBSERVACIONAL (nunca diagnóstica) de um
 * desenho infantil. Claude lê a imagem e devolve 4 blocos: o que se observa,
 * possíveis leituras (sempre em hipótese), perguntas pra explorar e o que
 * registrar. As regras de segurança estão travadas no system.
 */

export type MediaTypeImagem = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export type AnaliseDesenho = {
  observamos: string[];
  perguntas: string[];
  /** Interpretação NÃO entra na 1ª passada — vem na re-leitura, depois da
   * resposta da criança. Mantidos opcionais por compatibilidade com desenhos
   * antigos que já tinham esses blocos. */
  leituras?: string[];
  registro?: string;
  /** Etiquetas pra o mapa longitudinal (Nível 3). */
  temas?: string[];
  forma?: string;
};

const SYSTEM = `Você ajuda a MÃE de uma criança neurodivergente a OBSERVAR um desenho e a fazer boas perguntas — NUNCA a diagnosticar. Nesta etapa você AINDA NÃO interpreta: primeiro a mãe observa e CONVERSA com a criança; a leitura vem depois, a partir do que a criança contar. O sentido é da criança.

REGRAS INVIOLÁVEIS:
- NUNCA afirme estados ou condições, nem ofereça interpretação emocional aqui ("pode indicar que está ansiosa" etc.). Nesta etapa, SÓ o que se vê + as perguntas.
- O sentido é da CRIANÇA: o mais importante é a mãe PERGUNTAR a ela o que aquilo significa.
- Um desenho isolado diz pouco — o valor está em observar recorrências ao longo do tempo.

Para crianças que falam pouco / não-verbais: pergunte sobre o PERSONAGEM, não sobre a criança ("esse menino está feliz?", "o dinossauro está bravo ou tranquilo?") e use perguntas de ESCOLHA (apontar uma carinha feliz/triste/brava/com medo; escolher entre dois; mostrar com gesto) — a projeção é mais fácil.

Devolva APENAS um JSON, sem nada antes ou depois:
{
  "observamos": ["4 a 7 fatos VISUAIS e objetivos: cores predominantes; nº de figuras; quem aparece (criança/mãe/pai/amigos/animais); proximidade e tamanho das figuras; expressões; objetos repetidos; cenário (casa/escola/natureza/monstros/veículos); uso do espaço da folha; presença de proteção (casa/muro/abraço/escudo); e o MOVIMENTO/energia da composição (irradia de um centro, cresce pra fora, gira/espiral, explode, conecta ou separa elementos, está parada, é simétrica/radial/concêntrica). SÓ o que dá pra ver."],
  "perguntas": ["5 a 7 perguntas calorosas pra a mãe explorar COM a criança antes de qualquer interpretação. Inclua perguntas sobre o que cada parte é, sobre o personagem, e de escolha (carinhas/duas opções) quando ajudar. Uma delas deve convidar a criança a apontar a emoção (mostrar as carinhas)."],
  "temas": ["1 a 4 TAGS curtas do que o desenho mostra, minúsculas e no singular, pra agrupar ao longo do tempo. Vocabulário simples e CONSISTENTE: flor, árvore, casa, pessoa, família, animal, sol, coração, carro, monstro, comida, arco-íris, natureza, abstrato. Só as que de fato aparecem."],
  "forma": "1 tag curta do movimento/forma dominante: radial | circular | espiral | cena | sequência | espalhado | central | simétrico. Vazio se não se aplica."
}

Tom: caloroso, cuidadoso, humilde. Sem termos clínicos. Em português do Brasil.`;

export async function analisarDesenho(
  params: {
    base64: string;
    mediaType: MediaTypeImagem;
    membro: { nome: string; idade: number | null } | null;
    interesses?: string;
    contextoDia?: string;
  },
  tracking?: { supabase: SupabaseClient; family_account_id: string | null },
): Promise<AnaliseDesenho> {
  const client = getAnthropicClient();

  const linhas: string[] = ["Observe este desenho com cuidado."];
  if (params.membro) {
    linhas.push(
      `Quem desenhou: ${params.membro.nome}${params.membro.idade != null ? `, ${params.membro.idade} anos` : ""}.`,
    );
  }
  if (params.interesses?.trim()) {
    linhas.push(`Interesses que já conhecemos dela: ${params.interesses.trim()}.`);
  }
  if (params.contextoDia?.trim()) {
    linhas.push(`Contexto do dia (segundo a mãe): ${params.contextoDia.trim()}.`);
  }
  linhas.push("Devolva o JSON com os 4 blocos.");

  const msg = await client.messages.create({
    model: MODELS.principal,
    max_tokens: 1500,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: params.mediaType, data: params.base64 },
          },
          { type: "text", text: linhas.join("\n") },
        ],
      },
    ],
  });

  if (tracking) {
    await logarUsoApi(tracking.supabase, {
      family_account_id: tracking.family_account_id,
      provider: "anthropic",
      model: MODELS.principal,
      feature: "desenho_analise",
      input_tokens: msg.usage.input_tokens,
      output_tokens: msg.usage.output_tokens,
    });
  }

  const raw = msg.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");

  const parsed = parseAnalise(raw);
  if (!parsed) throw new Error("Não consegui ler o desenho. Tente uma foto mais nítida.");
  return parsed;
}

// ============================================================
// Segunda camada — RE-LEITURA a partir do que a CRIANÇA contou.
// O significado é da criança: depois que ela nomeia o que desenhou e/ou aponta
// uma emoção, a IA reconstrói a leitura centrada nela + propõe uma micro-
// história exploratória (muitas crianças contam mais por história do que por
// pergunta direta) + o que acompanhar ao longo do tempo.
// ============================================================

export type ReleituraDesenho = {
  o_que_contou: string;
  expressao: string;
  importante: string[];
  perguntas: string[];
  historia: string;
  registro: string;
};

const SYSTEM_RELEITURA = `A criança JÁ respondeu sobre o PRÓPRIO desenho — disse o que é e/ou apontou uma emoção. Agora você REconstrói a leitura A PARTIR DELA: o significado é da criança, não da observação do adulto. Ancore tudo no que ela nomeou e sentiu.

O dado mais rico NÃO é a cor — é (1) o MOVIMENTO/energia do desenho e (2) a relação entre a imagem e a EMOÇÃO que a criança escolheu. Olhe como a energia se move: irradia de um centro? cresce pra fora? gira/espirala? explode? conecta ou separa elementos? está parada? E compare com a emoção: há COERÊNCIA (imagem organizada/expansiva + "feliz") ou CONTRASTE (cena bonita + "preocupada")? Tanto a coerência quanto o contraste são pistas valiosas pra conversar — nunca pra concluir.

Olhar inspirado em Jung, com humildade: formas circulares, radiais e concêntricas (mandalas) costumam aparecer espontaneamente em momentos de organização, integração e criação. Você PODE notar isso como "vale observar" — NUNCA como verdade sobre a criança, nem como símbolo fechado.

REGRAS INVIOLÁVEIS: NUNCA diagnostique nem afirme estados ("está ansiosa", "tem X"). Fale SEMPRE em hipótese. NUNCA diga "a árvore representa a mãe" — significado simbólico fechado é proibido; o sentido é o que a criança dá. Um desenho isolado diz pouco; o valor é a recorrência ao longo do tempo.

Devolva APENAS um JSON, sem nada antes ou depois:
{
  "o_que_contou": "1 parágrafo curto e caloroso: o que a criança nomeou espontaneamente e a emoção que apontou. Valorize que a leitura PARTE dela.",
  "expressao": "1 parágrafo que CONECTA o movimento/energia do desenho com a emoção escolhida — o achado central. Descreva o movimento (irradia, cresce pra fora, gira, explode, conecta, separa, parado) e a coerência/contraste com a emoção. Ex.: 'O desenho irradia de um centro e cresce pra fora, inteiro e organizado — e {nome} escolheu feliz; há coerência entre a imagem e o que ela sentiu, como algo que ela gostou de criar e contemplar.' Se for forma circular/radial (mandala), pode acrescentar o olhar junguiano com humildade ('vale observar'). Sem símbolo fechado.",
  "importante": ["2 a 4 frases do que parece importante PRA ELA hoje, ancoradas no que ela nomeou + sentiu + o movimento. Sempre hipótese."],
  "perguntas": ["3 a 5 perguntas que ENTRAM na imagem e na história dela — não 'está feliz ou triste?'. Pergunte sobre o símbolo e o movimento: 'o que tem bem no meio?', 'o que acontece se a gente entrar nesse redemoinho?', 'essa flor está crescendo ou já cresceu?', 'ela cuida de alguém?', 'nasceu sozinha ou tem família?'. Adapte à emoção escolhida: se feliz, explore o que ela curtiu criar/contemplar; se difícil (preocupada/brava/medo), investigue de quem/do quê é, com opções de escolha."],
  "historia": "Uma MICRO-HISTÓRIA exploratória (4 a 7 linhas) inspirada no desenho e na emoção. Comece com 'Era uma vez...', use os elementos (e o nome dela se fizer sentido) e TERMINE com 2 ou 3 perguntas abertas pra criança continuar. Sem moral e sem fechar o final.",
  "registro": "1 frase do que acompanhar ao longo do tempo (recorrência do elemento que ela nomeou, de formas circulares/natureza, ou da emoção)."
}

Tom caloroso, humilde, em português do Brasil. Use o nome da criança quando souber.`;

export async function aprofundarComResposta(
  params: {
    analise: AnaliseDesenho;
    resposta: string;
    membro: { nome: string; idade: number | null } | null;
    contextoDia?: string | null;
  },
  tracking?: { supabase: SupabaseClient; family_account_id: string | null },
): Promise<ReleituraDesenho> {
  const client = getAnthropicClient();
  const nome = params.membro?.nome ?? "a criança";

  const linhas: string[] = [
    `Criança: ${nome}${params.membro?.idade != null ? `, ${params.membro.idade} anos` : ""}.`,
  ];
  if (params.contextoDia?.trim()) {
    linhas.push(`Contexto do dia (segundo a mãe): ${params.contextoDia.trim()}.`);
  }
  linhas.push(
    `Primeira leitura (observação do adulto) — o que observamos: ${params.analise.observamos.join("; ")}`,
  );
  if (params.analise.leituras?.length) {
    linhas.push(`Possíveis leituras iniciais: ${params.analise.leituras.join("; ")}`);
  }
  if (params.resposta.trim()) {
    linhas.push(
      `\nO QUE A CRIANÇA RESPONDEU (o mais importante — reconstrua a partir disto): "${params.resposta.trim()}"`,
    );
  } else {
    linhas.push(
      `\nA criança AINDA NÃO respondeu. Gere a leitura como HIPÓTESE do adulto: em "o_que_contou", deixe claro com gentileza que a voz da criança ainda falta e que o ideal é perguntar a ela; NUNCA invente a fala dela; foque na observação e no movimento. As perguntas devem ajudar a mãe a buscar a resposta da criança.`,
    );
  }
  linhas.push("\nDevolva o JSON com os 5 blocos.");

  const msg = await client.messages.create({
    model: MODELS.principal,
    max_tokens: 1800,
    system: [{ type: "text", text: SYSTEM_RELEITURA, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: linhas.join("\n") }],
  });

  if (tracking) {
    await logarUsoApi(tracking.supabase, {
      family_account_id: tracking.family_account_id,
      provider: "anthropic",
      model: MODELS.principal,
      feature: "desenho_releitura",
      input_tokens: msg.usage.input_tokens,
      output_tokens: msg.usage.output_tokens,
    });
  }

  const raw = msg.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");

  const parsed = parseReleitura(raw);
  if (!parsed) throw new Error("Não consegui aprofundar a leitura. Tente de novo.");
  return parsed;
}

function parseReleitura(s: string): ReleituraDesenho | null {
  const trimmed = s.trim();
  let candidate: unknown;
  try {
    candidate = JSON.parse(trimmed);
  } catch {
    const m =
      trimmed.match(/```json\s*([\s\S]*?)\s*```/i) ?? trimmed.match(/(\{[\s\S]*\})/);
    if (!m) return null;
    try {
      candidate = JSON.parse(m[1]);
    } catch {
      return null;
    }
  }
  if (!candidate || typeof candidate !== "object") return null;
  const obj = candidate as Record<string, unknown>;
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const o_que_contou = str(obj.o_que_contou);
  const historia = str(obj.historia);
  if (!o_que_contou && !historia) return null;
  return {
    o_que_contou,
    expressao: str(obj.expressao),
    importante: arr(obj.importante),
    perguntas: arr(obj.perguntas),
    historia,
    registro: str(obj.registro),
  };
}

function parseAnalise(s: string): AnaliseDesenho | null {
  const trimmed = s.trim();
  let candidate: unknown;
  try {
    candidate = JSON.parse(trimmed);
  } catch {
    const m =
      trimmed.match(/```json\s*([\s\S]*?)\s*```/i) ?? trimmed.match(/(\{[\s\S]*\})/);
    if (!m) return null;
    try {
      candidate = JSON.parse(m[1]);
    } catch {
      return null;
    }
  }
  if (!candidate || typeof candidate !== "object") return null;
  const obj = candidate as Record<string, unknown>;
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const observamos = arr(obj.observamos);
  const perguntas = arr(obj.perguntas);
  if (observamos.length === 0 && perguntas.length === 0) return null;
  const temas = arr(obj.temas)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 4);
  const forma = typeof obj.forma === "string" ? obj.forma.trim().toLowerCase() : "";
  return { observamos, perguntas, temas, forma };
}
