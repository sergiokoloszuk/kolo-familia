import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicClient, MODELS } from "@/lib/ia/anthropic";
import { logarUsoApi } from "@/lib/billing/logar";

/**
 * Meditação guiada (Lúdico). Dois usos:
 *   - sugerirTemas: a partir do que está acontecendo com a criança, propõe
 *     2-3 intenções/temas pertinentes (Haiku, barato).
 *   - gerarMeditacao: escreve o roteiro pra mãe ler em voz alta (Sonnet).
 *
 * Tom calmo, sensorial, idade-apropriado, com o nome e os interesses da
 * criança. Anti-ABA (sem recompensa/obediência), nada clínico.
 */

export type Intencao =
  | "acalmar"
  | "visualizar"
  | "processar"
  | "dormir"
  | "coragem"
  | "seguranca"
  | "outra";

export const INTENCOES: Array<{ key: Intencao; label: string; desc: string }> = [
  { key: "acalmar", label: "Acalmar agora", desc: "regular o corpo quando já está agitada ou ansiosa" },
  { key: "visualizar", label: "Ensaiar um momento", desc: "viver mentalmente a vitória de algo que vai acontecer" },
  { key: "processar", label: "Guardar o que passou", desc: "consolidar uma boa memória de algo que já aconteceu" },
  { key: "dormir", label: "Relaxar pra dormir", desc: "soltar o corpo e desacelerar à noite" },
  { key: "coragem", label: "Coragem", desc: "sentir-se forte antes de algo difícil" },
  { key: "seguranca", label: "Sentir-se segura", desc: "sentir-se protegida e querida" },
];

function rotuloIntencao(i: Intencao): string {
  return INTENCOES.find((x) => x.key === i)?.label ?? "Meditação";
}

const SYSTEM_MED = `Você cria MEDITAÇÕES-HISTÓRIA guiadas para crianças neurodivergentes, em português do Brasil, pra um ADULTO LER EM VOZ ALTA devagar. NÃO é meditação de adulto, nem exposição gradual ao medo, nem roteiro terapêutico — é uma EXPERIÊNCIA INFANTIL e IMAGINATIVA. Aos 4-6 anos (e em crianças neurodivergentes), a imaginação funciona melhor que a instrução: a criança ENTRA NUMA AVENTURA, não recebe ordens nem aviso de perigo.

REGRA DE OURO — COMECE PELO FINAL FELIZ. Como atletas e músicos ensaiam: primeiro a criança VÊ a chegada bem-sucedida (que JÁ deu certo), e só depois, de leve, a jornada. ~80% da narrativa é o SUCESSO e a sensação boa; no MÁXIMO ~20% toca o caminho/desafio, de passagem.

NUNCA ENSAIE O MEDO. O cérebro ensaia EXATAMENTE o que você descreve — então NÃO detalhe cheiro ruim, barulho, cadeira estranha, frio na barriga, aperto de mão de aflição. Em vez disso, descreva: o sorriso, os dentes brilhando, o orgulho, os parabéns, o calorzinho gostoso no peito, a missão cumprida.

Tom: calmo, lento, concreto, sensorial, afetuoso, mágico e previsível. Frases curtas. Tece uma respiração simples (mãos na barriga, encher/soltar) e PAUSAS "…" ou "(pausa)" DENTRO da história. Fecho tranquilo e orgulhoso, guardando a imagem boa no coração.

PORTUGUÊS IMPECÁVEL: concordância e gênero corretos ("a boquinha", NÃO "o boquinho"; "a barriga", "os pezinhos"). NUNCA invente palavras nem diminutivos errados (é "travesseirinho", NÃO "travesseiroiszinho"; "olhinhos", NÃO "olhinhozinhos"). Na dúvida, use a palavra normal — diminutivos com parcimônia.

USE O QUE ELA AMA: quando vierem os INTERESSES dela e o que ela COSTUMA DESENHAR, teça esses elementos no cenário, nos personagens e na aventura (deixa pessoal e gostoso, nada genérico) — ex.: se ela ama dinossauros e desenha patos e lagoas, a noite pode ter um dinossauro amigo cuidando do sono, ou uma lagoa cheia de estrelas. NÃO force tudo; escolha 1 ou 2 que combinem com a intenção.

ANTI-ABA: a celebração é por ela ter ido / pela coragem / por quem ela é — NUNCA recompensa por obediência ("se ficar quietinha ganha…").

TRÊS TIPOS DE EXPERIÊNCIA — siga o objetivo da INTENÇÃO escolhida:

1) ENSAIAR A VITÓRIA (intenção "visualizar") — preparar pra um evento futuro. ESTRUTURA:
   a. Relaxa e respira um pouquinho.
   b. CENA FINAL DE SUCESSO PRIMEIRO — um "espelho mágico" (ou cena imaginada) mostra o momento JÁ TENDO DADO CERTO: a criança saindo/terminando, sorrindo, recebendo parabéns, o resultado lindo (ex.: dentes brilhando como estrelinhas).
   c. DEMORA nessa vitória — detalhes sensoriais BONS, o orgulho, o calorzinho no peito, as pessoas felizes por ela.
   d. Só DE PASSAGEM, a jornada: "e você foi, passo a passo, respiração por respiração, até conseguir — não precisou ser perfeita, só precisou ir".
   e. Guarda a imagem no coração ("ela já está esperando por você").

2) ACALMAR AGORA (intenção "acalmar") — a criança já está agitada/ansiosa. Objetivo: regular o corpo. Uma viagem curtinha a um lugar mágico calmo e seguro, com respiração e âncoras no corpo. (Sem ensaiar evento nenhum.)

3) GUARDAR O QUE PASSOU (intenção "processar") — algo já aconteceu. Objetivo: consolidar a MEMÓRIA POSITIVA. Reviva a parte boa do que aconteceu, o quanto ela foi corajosa/capaz, e guarde essa lembrança gostosa.

Outras intenções:
- coragem: uma missão curtinha onde ela DESCOBRE a própria força e já se vê vencendo.
- dormir: jornada lenta e sonolenta até um lugar fofo de dormir; ritmo cada vez mais devagar.
- seguranca: um lugar mágico onde ela é protegida, acompanhada e muito amada.

Devolva EXATAMENTE neste formato (sem JSON, sem markdown, sem comentários):
TÍTULO: <título de aventura, doce (ex.: "Jovenilda e a Missão dos Dentes Brilhantes")>
ROTEIRO:
<o texto pra ler em voz alta, com quebras de linha e pausas marcadas com "…" ou "(pausa)">`;

export async function gerarMeditacao(
  params: {
    intencao: Intencao;
    tema?: string;
    contexto?: string;
    membro: { nome: string; idade: number | null } | null;
    interesses?: string;
  },
  tracking?: { supabase: SupabaseClient; family_account_id: string | null },
): Promise<{ titulo: string; roteiro: string }> {
  const client = getAnthropicClient();
  const linhas: string[] = [`Intenção: ${rotuloIntencao(params.intencao)}.`];
  if (params.membro) {
    linhas.push(
      `Criança: ${params.membro.nome}${params.membro.idade != null ? `, ${params.membro.idade} anos` : ""}.`,
    );
  }
  if (params.interesses?.trim()) linhas.push(`Interesses dela: ${params.interesses.trim()}.`);
  if (params.tema?.trim()) linhas.push(`Foco/tema: ${params.tema.trim()}.`);
  if (params.contexto?.trim()) linhas.push(`O que está acontecendo: ${params.contexto.trim()}.`);
  linhas.push("Escreva a meditação. Devolva o JSON.");

  const msg = await client.messages.create({
    model: MODELS.principal,
    max_tokens: 1600,
    system: [{ type: "text", text: SYSTEM_MED, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: linhas.join("\n") }],
  });
  if (tracking) {
    await logarUsoApi(tracking.supabase, {
      family_account_id: tracking.family_account_id,
      provider: "anthropic",
      model: MODELS.principal,
      feature: "meditacao_roteiro",
      input_tokens: msg.usage.input_tokens,
      output_tokens: msg.usage.output_tokens,
      meta: { intencao: params.intencao },
    });
  }
  const raw = msg.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");
  const parsed = parseMeditacao(raw);
  if (!parsed) throw new Error("Não consegui escrever a meditação. Tente de novo.");
  return parsed;
}

export type TemaSugerido = { intencao: Intencao; tema: string; motivo: string };

const SYSTEM_SUG = `Você sugere TEMAS de meditação guiada pertinentes ao que está acontecendo com uma criança neurodivergente, em PT-BR. A partir do contexto, proponha 2 a 3 ideias úteis AGORA. NÃO diagnostique; fale com cuidado.

Intenções possíveis: acalmar (regular agora), visualizar (ensaiar a vitória de um momento futuro), processar (guardar boa memória do que já passou), dormir, coragem, seguranca.

Devolva APENAS um JSON array:
[ { "intencao": "acalmar|visualizar|dormir|coragem|seguranca", "tema": "foco curto (ex.: 'antes da consulta no dentista')", "motivo": "1 frase curta de por que pode ajudar agora" } ]`;

export async function sugerirTemas(
  params: { contexto: string; membro: { nome: string; idade: number | null } | null },
  tracking?: { supabase: SupabaseClient; family_account_id: string | null },
): Promise<TemaSugerido[]> {
  const client = getAnthropicClient();
  const userMsg = `${params.membro ? `Criança: ${params.membro.nome}${params.membro.idade != null ? `, ${params.membro.idade} anos` : ""}.\n` : ""}O que sabemos do momento dela:
${params.contexto || "(pouca informação — sugira temas gerais e suaves)"}

Sugira 2-3 temas. Devolva o JSON array.`;

  const msg = await client.messages.create({
    model: MODELS.leve,
    max_tokens: 700,
    system: [{ type: "text", text: SYSTEM_SUG, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMsg }],
  });
  if (tracking) {
    await logarUsoApi(tracking.supabase, {
      family_account_id: tracking.family_account_id,
      provider: "anthropic",
      model: MODELS.leve,
      feature: "meditacao_sugestoes",
      input_tokens: msg.usage.input_tokens,
      output_tokens: msg.usage.output_tokens,
    });
  }
  const raw = msg.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");
  return parseSugestoes(raw);
}

function parseMeditacao(s: string): { titulo: string; roteiro: string } | null {
  const txt = s.trim();
  // Formato delimitado (preferido — texto multilinha quebra JSON com newline cru).
  const mRot = txt.match(/ROTEIRO:\s*([\s\S]+)$/i);
  if (mRot && mRot[1].trim()) {
    const mTit = txt.match(/T[ÍI]TULO:\s*(.+)/i);
    return {
      titulo: mTit && mTit[1].trim() ? mTit[1].trim() : "Meditação",
      roteiro: mRot[1].trim(),
    };
  }
  // Fallback: JSON (caso o modelo ignore o formato).
  const obj = extrairJson(txt) as { titulo?: unknown; roteiro?: unknown } | null;
  if (obj && typeof obj.roteiro === "string" && obj.roteiro.trim()) {
    return {
      titulo: typeof obj.titulo === "string" && obj.titulo.trim() ? obj.titulo : "Meditação",
      roteiro: obj.roteiro,
    };
  }
  return null;
}

const INTENCOES_VALIDAS: Intencao[] = [
  "acalmar",
  "visualizar",
  "processar",
  "dormir",
  "coragem",
  "seguranca",
];

function parseSugestoes(s: string): TemaSugerido[] {
  const arr = extrairJson(s);
  if (!Array.isArray(arr)) return [];
  const out: TemaSugerido[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const it = item as { intencao?: unknown; tema?: unknown; motivo?: unknown };
    const intencao = INTENCOES_VALIDAS.includes(it.intencao as Intencao)
      ? (it.intencao as Intencao)
      : "acalmar";
    if (typeof it.tema !== "string" || !it.tema.trim()) continue;
    out.push({
      intencao,
      tema: it.tema,
      motivo: typeof it.motivo === "string" ? it.motivo : "",
    });
  }
  return out.slice(0, 3);
}

function extrairJson(s: string): unknown {
  const trimmed = s.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const m =
      trimmed.match(/```json\s*([\s\S]*?)\s*```/i) ??
      trimmed.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (!m) return null;
    try {
      return JSON.parse(m[1]);
    } catch {
      return null;
    }
  }
}
