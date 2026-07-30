import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * RECUPERAÇÃO de Boas Práticas — fonte única pros dois canais.
 *
 * Por que existe (auditoria da base de conhecimento, 30/07/2026): são 368 BPs
 * curadas à mão pela Karina, e **o WhatsApp não lia nenhuma**. Só a web
 * carregava, dentro de `buildContext`, e ainda filtrava pela interseção com as
 * skills roteadas — o que descartava tudo o que está pendurado nas 7 skills em
 * rascunho (~55% do acervo). Resultado: o canal onde as mães realmente conversam
 * respondia sem a metodologia curada do produto.
 *
 * A seleção aqui é DETERMINÍSTICA, de propósito: nenhuma chamada de IA a mais no
 * caminho da resposta (o canal já é lento) e nenhum custo por mensagem. Pontua
 * por sobreposição de termos entre o que a família está falando e as tags/título
 * da BP, com o peso da curadoria como desempate. Não é busca semântica — essa é
 * a evolução seguinte, e está anotada no laudo.
 */

export type BoaPratica = {
  titulo: string;
  versao_curta: string;
  versao_conversa: string | null;
};

type Linha = {
  titulo: string | null;
  versao_curta: string | null;
  versao_conversa: string | null;
  tags: string[] | null;
  perfis_aplicaveis: string[] | null;
  faixa_etaria_min: number | null;
  faixa_etaria_max: number | null;
  peso_relevancia: number | null;
};

/** Palavras vazias que casariam com tudo e estragariam a pontuação. */
const STOP = new Set([
  "para","pela","pelo","como","que","com","uma","uns","umas","dos","das","por","nao",
  "sim","mas","ele","ela","eles","elas","meu","minha","seu","sua","isso","esse","essa",
  "aqui","ali","tem","ter","fazer","faz","esta","estao","muito","mais","menos","quando",
  "onde","porque","tudo","nada","todo","toda","ainda","ja","so","da","de","do","em","no",
  "na","os","as","um","e","o","a","eu","se","ao","aos","pra","pro","tá","ta","vai",
]);

function termos(texto: string): Set<string> {
  return new Set(
    (texto ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !STOP.has(t)),
  );
}

/** Radical simples: casa "alimentacao" com "alimentar", "sono" com "sonolencia". */
function radical(t: string): string {
  return t.length > 5 ? t.slice(0, 5) : t;
}

const CANDIDATAS_MAX = 120;

/**
 * Escolhe as BPs mais próximas do que está sendo falado agora.
 *
 * @param assunto  a mensagem da família + o tema em pauta (o que dá o sinal)
 * @param idade    idade da pessoa em foco, pra respeitar faixa_etaria da BP
 * @param perfil   perfil/diagnóstico, pra respeitar perfis_aplicaveis
 * @param limite   quantas devolver
 */
export async function selecionarBoasPraticas(
  supabase: SupabaseClient,
  params: {
    assunto: string;
    idade?: number | null;
    perfil?: string | null;
    limite?: number;
  },
): Promise<BoaPratica[]> {
  const limite = params.limite ?? 5;
  try {
    const { data } = await supabase
      .from("boas_praticas")
      .select(
        "titulo, versao_curta, versao_conversa, tags, perfis_aplicaveis, faixa_etaria_min, faixa_etaria_max, peso_relevancia",
      )
      .eq("status", "ativo")
      .order("peso_relevancia", { ascending: false })
      .limit(CANDIDATAS_MAX);

    const linhas = (data ?? []) as Linha[];
    if (linhas.length === 0) return [];

    const alvo = termos(params.assunto);
    const alvoRad = new Set([...alvo].map(radical));
    const perfilNorm = (params.perfil ?? "").toLowerCase();

    const pontuadas = linhas
      .filter((bp) => {
        // Faixa etária: se a BP declara janela e a idade está fora, não serve.
        if (params.idade != null) {
          if (bp.faixa_etaria_min != null && params.idade < bp.faixa_etaria_min) return false;
          if (bp.faixa_etaria_max != null && params.idade > bp.faixa_etaria_max) return false;
        }
        // Perfil: "todos"/"qualquer perfil" vale sempre; lista específica precisa casar.
        const perfis = (bp.perfis_aplicaveis ?? []).map((p) => String(p).toLowerCase());
        if (perfis.length > 0 && perfilNorm) {
          const geral = perfis.some((p) => p.includes("todos") || p.includes("qualquer"));
          if (!geral && !perfis.some((p) => perfilNorm.includes(p) || p.includes(perfilNorm))) {
            return false;
          }
        }
        return true;
      })
      .map((bp) => {
        const tags = (bp.tags ?? []).map((t) => String(t));
        let score = 0;
        // Tag que casa é o sinal mais forte — é o que a curadoria escolheu como assunto.
        for (const t of termos(tags.join(" "))) {
          if (alvo.has(t)) score += 4;
          else if (alvoRad.has(radical(t))) score += 2;
        }
        // Título e versão curta reforçam.
        for (const t of termos(`${bp.titulo ?? ""} ${bp.versao_curta ?? ""}`)) {
          if (alvo.has(t)) score += 1;
        }
        // Peso da curadoria entra como desempate, nunca como critério principal
        // (era exatamente o problema da web: top-N por peso fixo = quase aleatório).
        score += (bp.peso_relevancia ?? 0) * 0.5;
        return { bp, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limite);

    return pontuadas.map(({ bp }) => ({
      titulo: bp.titulo ?? "",
      versao_curta: bp.versao_curta ?? "",
      versao_conversa: bp.versao_conversa,
    }));
  } catch (e) {
    // Sem boas práticas a Ayla ainda responde (o Core carrega o método). Nunca
    // pode quebrar a resposta por causa de um bônus de contexto.
    console.warn(
      "[boas-praticas] seleção falhou:",
      e instanceof Error ? e.message : e,
    );
    return [];
  }
}

/** Bloco pro prompt. Mesmo formato nos dois canais. */
export function blocoBoasPraticas(bps: BoaPratica[]): string {
  if (bps.length === 0) return "";
  return bps
    .map(
      (bp, i) =>
        `${i + 1}. ${bp.titulo}\n   curta: ${bp.versao_curta}${
          bp.versao_conversa ? `\n   conversa: ${bp.versao_conversa}` : ""
        }`,
    )
    .join("\n");
}
