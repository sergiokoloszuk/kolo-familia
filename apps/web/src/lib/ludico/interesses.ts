import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * OS INTERESSES DA CRIANÇA, pra virar chip de tema.
 *
 * Mesma leitura que o condutor da Ayla já fazia (`carregarInteresses` em
 * rotina-guiada) — trazida pra cá porque agora o app também precisa dela, e
 * duas leituras do mesmo campo divergiriam no primeiro ajuste.
 *
 * ⚠️ SEMPRE filtrado por membro E por família. Um chip de tema que vaza de
 * outra criança é o mesmo erro que pôs a rotina da Manu no Mario, só que mais
 * silencioso: ninguém repara que o dinossauro era do irmão.
 */
export async function interessesDaCrianca(
  supabase: SupabaseClient,
  params: { membroId: string; familyId: string },
): Promise<string[]> {
  try {
    // O vínculo com a família é conferido no MEMBRO — `perfil_vivo_membro` é
    // por membro, e confiar só nele deixaria passar um id de outra conta.
    const { data: membro } = await supabase
      .from("membros_atipicos")
      .select("id")
      .eq("id", params.membroId)
      .eq("family_account_id", params.familyId)
      .maybeSingle();
    if (!membro) return [];

    const { data } = await supabase
      .from("perfil_vivo_membro")
      .select("categorias_extras")
      .eq("membro_atipico_id", params.membroId)
      .maybeSingle();

    const ce = (data?.categorias_extras ?? {}) as Record<string, unknown>;
    const cand =
      (ce?.como_e as Record<string, unknown> | undefined)?.interesses ??
      (ce?.preferencias as Record<string, unknown> | undefined)?.temas ??
      null;

    const bruto: string[] = Array.isArray(cand)
      ? cand.map((x) => String(x))
      : typeof cand === "string"
        ? cand.split(/[,;]/)
        : [];

    const vistos = new Set<string>();
    const limpos: string[] = [];
    for (const item of bruto) {
      const t = item.trim().replace(/^["'\s]+|["'\s.]+$/g, "");
      // Um chip é uma palavra ou duas. Frase inteira não vira botão.
      if (t.length < 3 || t.length > 24) continue;
      const chave = t.toLowerCase();
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      limpos.push(t.charAt(0).toUpperCase() + t.slice(1));
      if (limpos.length === 4) break;
    }
    return limpos;
  } catch {
    return [];
  }
}

/**
 * A criança tem avatar? Devolve a imagem do que está em uso, pra oferecer como
 * PERSONAGEM dos cartões — que é coisa diferente de tema (o tema é o cenário).
 *
 * Filtrado por família pelo mesmo motivo dos interesses.
 */
export async function avatarDaCrianca(
  supabase: SupabaseClient,
  params: { membroId: string; familyId: string },
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("avatares_membros_atipicos")
      .select("imagem_url")
      .eq("membro_atipico_id", params.membroId)
      .eq("family_account_id", params.familyId)
      .order("selecionado", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data?.imagem_url as string | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * O TEXTO QUE A MÃE ESCREVEU VIRA PASSOS.
 *
 * Ela vai colar um bloco — foi o que aconteceu em todos os testes reais:
 * "café, escola, almoço, brincar, banho". Quebra por linha e, quando a linha
 * tem vírgulas, por vírgula. Ponto final não separa: "vou de carro até o
 * dentista." é um passo só.
 */
export function passosDoTexto(texto: string): string[] {
  const passos: string[] = [];
  for (const linha of (texto ?? "").split(/\r?\n/)) {
    const l = linha.trim();
    if (!l) continue;
    // Vírgula só separa quando há mais de uma — "almoço, depois banho" é um
    // passo; "café, escola, almoço" são três.
    const partes = (l.match(/,/g) ?? []).length >= 2 ? l.split(",") : [l];
    for (const p of partes) {
      const t = p
        .trim()
        // numeração que ela pode ter colado junto ("1.", "1)", "- ")
        .replace(/^\s*(\d{1,2}\s*[.)-]|[-•–])\s*/, "")
        .trim();
      if (t) passos.push(t.slice(0, 120));
    }
  }
  return passos;
}

/**
 * UM NOME PRA ROTINA quando a mãe deixou em branco.
 *
 * Sem modelo e sem inventar contexto: usa o primeiro e o último passo, que é o
 * que ela mesma escreveu. "Estou em casa → Volto para casa" vira
 * "Estou em casa até Volto para casa" — literal, e nunca uma história que
 * ninguém contou.
 */
export function nomeAPartirDosPassos(passos: string[]): string {
  const primeiro = passos[0]?.trim();
  const ultimo = passos[passos.length - 1]?.trim();
  if (!primeiro) return "Minha rotina";
  if (!ultimo || ultimo === primeiro) return primeiro.slice(0, 60);
  return `${primeiro} até ${ultimo}`.slice(0, 60);
}
