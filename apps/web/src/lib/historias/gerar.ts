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
  cena: string;
  imagem_url: string | null;
  erro?: string;
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

export async function gerarRoteiro(params: {
  membro: { nome: string; idade: number | null; perfil: string };
  koloVivoResumo: string;
  gostos?: string;
  descricao: string;
  nPaginas: number;
}): Promise<{ titulo: string; paginas: PaginaRoteiro[] }> {
  const n = Math.min(Math.max(params.nPaginas, 3), 6);
  const client = getAnthropicClient();
  const userMsg = `Criança: ${params.membro.nome}${params.membro.idade != null ? `, ${params.membro.idade} anos` : ""}, perfil ${params.membro.perfil}.

<o_que_sabemos_da_crianca>
${params.koloVivoResumo || "(pouca informação ainda)"}
</o_que_sabemos_da_crianca>
${
  params.gostos?.trim()
    ? `\n<gostos_favoritos>\n${params.gostos}\n</gostos_favoritos>\nUse os personagens, temas e materiais favoritos dela na história (e nas cenas) sempre que fizer sentido — é o que deixa pessoal e envolvente.\n`
    : ""
}
<pedido_do_responsavel>
${params.descricao}
</pedido_do_responsavel>

Escreva a história em EXATAMENTE ${n} páginas. Devolva o JSON.`;

  // 2500 cabe 6 páginas em PT com texto+fala+cena sem truncar.
  const stream = client.messages.stream({
    model: MODELS.principal,
    max_tokens: 2500,
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
  return roteiro;
}

/**
 * Ilustra páginas com concorrência limitada (2 paralelas) e 1 retry por página.
 * Loga falhas — Promise.allSettled escondia o motivo silenciosamente.
 */
export async function ilustrarPaginas(
  supabase: SupabaseClient,
  paginas: PaginaRoteiro[],
  params: {
    familyAccountId: string;
    avatarBytes: Buffer;
    avatarEstilo: AvatarEstilo;
  },
): Promise<PaginaGerada[]> {
  const estiloPrompt =
    AVATAR_ESTILOS.find((e) => e.value === params.avatarEstilo)?.prompt ??
    AVATAR_ESTILOS[0].prompt;

  const PARALELAS = 2;
  const resultados: PaginaGerada[] = new Array(paginas.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= paginas.length) return;
      const p = paginas[i];
      const prompt = montarPromptIlustracao(estiloPrompt, p.cena);
      const r = await ilustrarComRetry(supabase, prompt, params.avatarBytes, params.familyAccountId);
      resultados[i] = {
        ordem: i + 1,
        texto: p.texto,
        fala: p.fala,
        cena: p.cena,
        imagem_url: r.url,
        ...(r.erro ? { erro: r.erro } : {}),
      };
    }
  }

  await Promise.all(Array.from({ length: PARALELAS }, () => worker()));
  return resultados;
}

function montarPromptIlustracao(estiloPrompt: string, cena: string): string {
  return `Mantenha EXATAMENTE o mesmo personagem da imagem de referência: mesmo rosto, mesmo cabelo, mesmo tom de pele, mesmos óculos (se houver) e a MESMA roupa. Mesmo estilo de ilustração (${estiloPrompt}). Cena: ${cena}. Livro infantil acolhedor, personagem de corpo inteiro quando fizer sentido na cena. SEM nenhum texto, letra ou número na imagem.`;
}

async function ilustrarComRetry(
  supabase: SupabaseClient,
  prompt: string,
  referencia: Buffer,
  familyAccountId: string,
): Promise<{ url: string | null; erro?: string }> {
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      const r = await gerarImagemComReferencia(supabase, {
        prompt,
        referencia,
        familyAccountId,
        tipo: "historia_social",
      });
      return { url: r.url };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[historia.ilustrar] tentativa ${tentativa} falhou:`, msg);
      if (tentativa === 2) return { url: null, erro: msg };
      // backoff curto antes de tentar de novo
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return { url: null, erro: "falha desconhecida" };
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

export { montarPromptIlustracao };

/**
 * Regerar UMA página específica — usado pelo botão "regerar ilustração"
 * no leitor quando alguma página saiu vazia.
 */
export async function ilustrarComRetryPublico(
  supabase: SupabaseClient,
  params: {
    cena: string;
    estiloPrompt: string;
    avatarBytes: Buffer;
    familyAccountId: string;
  },
): Promise<{ url: string | null; erro?: string }> {
  const prompt = montarPromptIlustracao(params.estiloPrompt, params.cena);
  return ilustrarComRetry(supabase, prompt, params.avatarBytes, params.familyAccountId);
}
