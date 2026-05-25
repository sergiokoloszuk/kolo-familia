import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnthropicClient, MODELS } from "@/lib/ia/anthropic";
import { gerarImagemComReferencia } from "@/lib/imagem/generate";
import { AVATAR_ESTILOS, type AvatarEstilo } from "@/lib/imagem/avatar-prompt";

/**
 * Geração de história ilustrada — o responsável descreve, a IA escreve em
 * páginas (Sonnet) e ilustra cada uma usando o avatar da criança como
 * referência, mantendo o mesmo personagem em todas as cenas.
 */

export type PaginaGerada = {
  ordem: number;
  texto: string;
  fala: string | null;
  imagem_url: string | null;
};

export type HistoriaGerada = {
  titulo: string;
  paginas: PaginaGerada[];
};

type PaginaRoteiro = { texto: string; fala: string | null; cena: string };

const SYSTEM = `Você escreve HISTÓRIAS SOCIAIS curtas e ilustradas para uma criança neurodivergente, em português do Brasil. A criança é a PROTAGONISTA e a heroína da história. O objetivo é ajudá-la a antecipar, ensaiar ou celebrar uma situação real da vida dela.

Tom: calmo, concreto, afetuoso, previsível. A criança sempre lida bem ou é apoiada — nada assustador, nada de vergonha, nada de diagnóstico ou termos clínicos. Linguagem simples, de livro infantil.

Devolva APENAS um JSON, sem texto antes ou depois:
{
  "titulo": "título curto e doce",
  "paginas": [
    {
      "texto": "1 a 2 frases narrativas curtas (livro infantil)",
      "fala": "uma fala curta da criança, ou null",
      "cena": "descrição VISUAL da cena para o ilustrador: o que acontece, o cenário e os objetos. NÃO descreva a aparência da criança (já temos o avatar dela). Uma ação clara por página. Em português."
    }
  ]
}

Regras:
- Exatamente o número de páginas pedido.
- Histórias com começo, meio e um fecho tranquilo/positivo.
- Use os interesses da criança quando fizer sentido (deixa mais envolvente).
- 'cena' precisa ser concreta e ilustrável, coerente de uma página pra outra.`;

export async function gerarHistoria(
  supabase: SupabaseClient,
  params: {
    familyAccountId: string;
    membro: { nome: string; idade: number | null; perfil: string };
    koloVivoResumo: string;
    descricao: string;
    nPaginas: number;
    avatarBytes: Buffer;
    avatarEstilo: AvatarEstilo;
  },
): Promise<HistoriaGerada> {
  const n = Math.min(Math.max(params.nPaginas, 3), 6);

  // 1. Roteiro (texto das páginas) — Sonnet
  const client = getAnthropicClient();
  const userMsg = `Criança: ${params.membro.nome}${params.membro.idade != null ? `, ${params.membro.idade} anos` : ""}, perfil ${params.membro.perfil}.

<o_que_sabemos_da_crianca>
${params.koloVivoResumo || "(pouca informação ainda)"}
</o_que_sabemos_da_crianca>

<pedido_do_responsavel>
${params.descricao}
</pedido_do_responsavel>

Escreva a história em EXATAMENTE ${n} páginas. Devolva o JSON.`;

  const stream = client.messages.stream({
    model: MODELS.principal,
    max_tokens: 1500,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userMsg }],
  });
  const final = await stream.finalMessage();
  const raw = final.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("");

  const roteiro = parseRoteiro(raw);
  if (!roteiro) throw new Error("Não consegui escrever a história. Tente descrever de outro jeito.");

  // 2. Ilustra cada página em paralelo, com o avatar como referência
  const estiloPrompt =
    AVATAR_ESTILOS.find((e) => e.value === params.avatarEstilo)?.prompt ??
    AVATAR_ESTILOS[0].prompt;

  const ilustracoes = await Promise.allSettled(
    roteiro.paginas.map((p) =>
      gerarImagemComReferencia(supabase, {
        prompt: `Mantenha EXATAMENTE o mesmo personagem da imagem de referência: mesmo rosto, mesmo cabelo, mesmo tom de pele, mesmos óculos (se houver) e a MESMA roupa. Mesmo estilo de ilustração (${estiloPrompt}). Cena: ${p.cena}. Livro infantil acolhedor, personagem de corpo inteiro quando fizer sentido na cena. SEM nenhum texto, letra ou número na imagem.`,
        referencia: params.avatarBytes,
        familyAccountId: params.familyAccountId,
        tipo: "historia_social",
      }),
    ),
  );

  const paginas: PaginaGerada[] = roteiro.paginas.map((p, i) => {
    const r = ilustracoes[i];
    return {
      ordem: i + 1,
      texto: p.texto,
      fala: p.fala,
      imagem_url: r.status === "fulfilled" ? r.value.url : null,
    };
  });

  return { titulo: roteiro.titulo, paginas };
}

function parseRoteiro(
  s: string,
): { titulo: string; paginas: PaginaRoteiro[] } | null {
  const trimmed = s.trim();
  let candidate: unknown;
  try {
    candidate = JSON.parse(trimmed);
  } catch {
    const m = trimmed.match(/```json\s*([\s\S]*?)\s*```/i) ?? trimmed.match(/(\{[\s\S]*\})/);
    if (!m) return null;
    try {
      candidate = JSON.parse(m[1]);
    } catch {
      return null;
    }
  }
  if (!candidate || typeof candidate !== "object") return null;
  const obj = candidate as { titulo?: unknown; paginas?: unknown };
  if (typeof obj.titulo !== "string" || !Array.isArray(obj.paginas)) return null;
  const paginas: PaginaRoteiro[] = [];
  for (const p of obj.paginas) {
    if (!p || typeof p !== "object") continue;
    const pp = p as { texto?: unknown; fala?: unknown; cena?: unknown };
    if (typeof pp.texto !== "string" || typeof pp.cena !== "string") continue;
    paginas.push({
      texto: pp.texto,
      fala: typeof pp.fala === "string" && pp.fala.trim() ? pp.fala : null,
      cena: pp.cena,
    });
  }
  if (paginas.length === 0) return null;
  return { titulo: obj.titulo, paginas };
}
