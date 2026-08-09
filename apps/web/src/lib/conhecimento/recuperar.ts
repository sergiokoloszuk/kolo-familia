import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * RECUPERAÇÃO DE REPERTÓRIO — a Camada 2, uma fonte só para os dois canais.
 *
 * O problema que isto resolve (auditado em 06/08/2026): o acervo existe e não
 * chega. O WhatsApp não recebia boa prática NENHUMA; a web recebia até 3 e
 * jogava fora justamente os campos que decidem a conduta —`quando_usar`,
 * `erros_comuns` e `passos_praticos`. `faixa_etaria` está preenchida em 368 de
 * 371 BPs e era ignorada pelo filtro.
 *
 * ⚠️ MÓDULO NEUTRO DE CANAL, como `lib/conducao`. Ele não sabe se está servindo
 * o WhatsApp ou as Estratégias — se soubesse, voltaríamos a ter duas
 * inteligências, que é exatamente o que esta frente existe pra desfazer.
 *
 * O que ele NÃO faz: não decide QUAL skill (isso é do classificador), não
 * escreve resposta, e não é um segundo acervo. Atividades e brincadeiras já
 * vivem dentro das BPs, em `passos_praticos` — não há Camada 3.
 */

export type BoaPraticaRecuperada = {
  /** Id estável da BP. É o que o rastro registra — nunca o texto. */
  id: string;
  titulo: string;
  versao_conversa: string | null;
  quando_usar: string | null;
  erros_comuns: string[];
  passos_praticos: string[];
};

type Linha = {
  id: string;
  titulo: string | null;
  versao_curta: string | null;
  versao_conversa: string | null;
  quando_usar: string | null;
  erros_comuns: unknown;
  passos_praticos: unknown;
  skills_relacionadas: unknown;
  tags: unknown;
  peso_relevancia: number | null;
  faixa_etaria_min: number | null;
  faixa_etaria_max: number | null;
};

const lista = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];

/**
 * A REGRA DE IDADE — tolerante de propósito.
 *
 * Elegível quando a BP não tem restrição OU quando a idade cabe na faixa. Idade
 * ausente NÃO elimina ninguém: um recuperador que exige idade devolveria zero
 * pra toda família que ainda não preencheu a data de nascimento, e um bloco
 * vazio é pior que um bloco levemente fora de faixa.
 *
 * Faixa aberta de um lado só (só min, ou só max) é respeitada como aberta.
 */
export function idadeElegivel(
  idade: number | null | undefined,
  min: number | null,
  max: number | null,
): boolean {
  if (min == null && max == null) return true;
  if (idade == null) return true;
  if (min != null && idade < min) return false;
  if (max != null && idade > max) return false;
  return true;
}

export type ParamsRecuperar = {
  supabase: SupabaseClient;
  /** Skill principal + complementar, na ordem. Vazio = sem repertório. */
  skills: readonly string[];
  /** Tags de conhecimento das skills roteadas (a web já as tem). */
  tags?: readonly string[];
  /** Idade da criança em foco, quando conhecida. */
  idade?: number | null;
  /** Quantas BPs no bloco. 3 é o padrão medido; 4 só com ganho demonstrado. */
  limite?: number;
  /**
   * Quais status entram. O padrão — e o de produção — é só `ativo`.
   *
   * Existe pra que a BANCADA possa medir o fluxo completo com o acervo em
   * rascunho ANTES de publicar. Publicar pra poder testar seria expor famílias
   * reais a conteúdo ainda não revisado; testar sem publicar exige este
   * parâmetro. Nenhum caminho de produto o passa.
   */
  statusAceitos?: readonly string[];
  /**
   * Avisa que a consulta FALHOU — sem mudar o comportamento (a função continua
   * devolvendo `[]` e a conversa continua). Existe só para o rastro poder
   * distinguir "o acervo não tinha nada" de "a consulta quebrou": hoje os dois
   * produzem exatamente o mesmo bloco vazio, e essa confusão é o que impede
   * descobrir uma recuperação quebrada em produção.
   */
  aoFalhar?: (motivo: string) => void;
};

/**
 * As BPs relevantes, já ordenadas. Falha silenciosa: sem repertório a conversa
 * segue como sempre seguiu — nunca quebra o turno.
 */
export async function recuperarBoasPraticas(
  p: ParamsRecuperar,
): Promise<BoaPraticaRecuperada[]> {
  const skills = p.skills.filter(Boolean);
  const tags = new Set((p.tags ?? []).filter(Boolean));
  if (skills.length === 0 && tags.size === 0) return [];

  try {
    // ⚠️ O FILTRO DE SKILL VAI NO BANCO, e isso não é otimização — é correção.
    //
    // A versão anterior (herdada da web) buscava o topo por `peso_relevancia` e
    // filtrava por skill DEPOIS. Medido em 06/08/2026, no acervo real: entre as
    // 120 BPs de maior peso havia ZERO de `imitacao` (de 34), ZERO de
    // `nutricional` (de 27), UMA de `motor` (de 41) e UMA de `sono` (de 31).
    // Skills inteiras eram eliminadas antes de o filtro rodar — a web vinha
    // servindo repertório vazio pra metade dos temas sem nunca acusar erro.
    // Nomes viram parte de uma query string — só o vocabulário conhecido passa.
    // Um valor com aspas ou vírgula quebraria o `or` inteiro (e o filtro junto).
    const seguro = (v: string) => /^[a-z0-9_]{2,40}$/.test(v);
    const clausulas = [
      ...skills.filter(seguro).map((s) => `skills_relacionadas.cs.["${s}"]`),
      // Teto nas tags: a web roteia até 3 skills e cada uma traz ~6
      // `knowledge_tags`. Sem corte, o `or` cresceria sem limite útil — as
      // primeiras já vêm das skills mais relevantes.
      ...[...tags].filter(seguro).slice(0, 12).map((t) => `tags.cs.["${t}"]`),
    ];
    if (clausulas.length === 0) return [];
    const { data, error } = await p.supabase
      .from("boas_praticas")
      .select(
        "id, titulo, versao_curta, versao_conversa, quando_usar, erros_comuns, passos_praticos, skills_relacionadas, tags, peso_relevancia, faixa_etaria_min, faixa_etaria_max",
      )
      .in("status", p.statusAceitos ?? ["ativo"])
      .or(clausulas.join(","))
      .order("peso_relevancia", { ascending: false })
      // TETO DE SEGURANÇA, não critério de seleção.
      //
      // Era 40, e 40 descartava conteúdo elegível ANTES de qualquer
      // ranqueamento: medido em 09/08/2026, 51 boas práticas elegíveis para
      // uma criança de 5 anos morriam aqui — 24 só em `emocional` e 19 em
      // `comunicacao`. Como o peso está empatado em 367 de 370, quem ficava
      // de fora era decidido pela ordem física da tabela.
      //
      // Buscar a skill inteira custa o mesmo: medido, 40 linhas em 91 ms e 75
      // em 90 ms. O teto sobe para 200 apenas para que um acervo dez vezes
      // maior não traga uma resposta ilimitada — não para escolher nada.
      .limit(200);
    if (error) throw new Error(error.message);

    // A idade continua sendo filtrada aqui: a regra é tolerante (BP sem faixa
    // entra, idade ausente não elimina) e expressá-la em SQL custaria mais do
    // que vale sobre 40 linhas.
    const candidatas = ((data ?? []) as Linha[]).filter((bp) =>
      idadeElegivel(p.idade, bp.faixa_etaria_min, bp.faixa_etaria_max),
    );

    // A skill PRINCIPAL manda. Sem isto, a complementar competiria de igual pra
    // igual e o bloco deixaria de ser sobre o problema que a família trouxe.
    const principal = skills[0];
    const ordenadas = principal
      ? [
          ...candidatas.filter((b) => lista(b.skills_relacionadas).includes(principal)),
          ...candidatas.filter((b) => !lista(b.skills_relacionadas).includes(principal)),
        ]
      : candidatas;

    return ordenadas.slice(0, p.limite ?? 3).map((bp) => ({
      id: String(bp.id),
      titulo: String(bp.titulo ?? "").trim(),
      // `versao_curta` só entra quando não há `versao_conversa` — mandar as duas
      // seria repetir a mesma orientação com outras palavras dentro do prompt.
      versao_conversa: (bp.versao_conversa ?? bp.versao_curta ?? null)?.trim() || null,
      quando_usar: (bp.quando_usar ?? "").trim() || null,
      erros_comuns: lista(bp.erros_comuns),
      passos_praticos: lista(bp.passos_praticos),
    }));
  } catch (e) {
    const motivo = e instanceof Error ? e.message : String(e);
    console.warn("[conhecimento] recuperação falhou:", motivo);
    // O aviso não pode ser o caminho da falha: um callback que lança levaria
    // embora a conversa por causa de um log.
    try {
      p.aoFalhar?.(motivo);
    } catch {
      /* ignorado de propósito */
    }
    return [];
  }
}

/**
 * O BLOCO PRO PROMPT — repertório para raciocinar, não texto para recitar.
 *
 * As quatro linhas têm papéis diferentes, e o cabeçalho diz isso ao modelo:
 * `quando_usar` é o filtro (isto serve mesmo pra esta situação?), `erros_comuns`
 * é o que evitar ao orientar, e `passos_praticos` é o que dá pra fazer hoje.
 * Sem essa distinção o modelo despeja os quatro campos como seções, que é o
 * oposto de conversa.
 *
 * Campo vazio não vira linha: bloco com "quando usar: —" ensina o modelo a
 * preencher formulário.
 */
export function blocoBoasPraticas(bps: readonly BoaPraticaRecuperada[]): string {
  if (bps.length === 0) return "";
  const itens = bps
    .map((b, i) => {
      const linhas = [`${i + 1}. ${b.titulo}`];
      if (b.versao_conversa) linhas.push(`   ${b.versao_conversa}`);
      if (b.quando_usar) linhas.push(`   QUANDO SERVE: ${b.quando_usar}`);
      if (b.erros_comuns.length) linhas.push(`   EVITE: ${b.erros_comuns.join(" · ")}`);
      if (b.passos_praticos.length)
        linhas.push(`   DÁ PRA FAZER: ${b.passos_praticos.join(" · ")}`);
      return linhas.join("\n");
    })
    .join("\n\n");

  return `<repertorio_kolo>
Isto é REPERTÓRIO da Kolo pra você raciocinar — não é roteiro e não se cita.

- Use "QUANDO SERVE" pra decidir se aquilo cabe MESMO nesta situação. Se não couber, ignore aquela entrada; trazer conteúdo que não serve é pior do que não trazer.
- "EVITE" é o que NÃO recomendar. Não vire isso em aula sobre erros.
- "DÁ PRA FAZER" é o que a família consegue executar hoje — adapte à idade e aos interesses da criança que você já conhece, em vez de repetir o passo literal.
- NUNCA escreva "quando usar", "erros comuns" ou "passos" como seções da resposta, e nunca despeje as ${bps.length} entradas. Escolha o que ajuda AGORA e transforme em conversa.

${itens}
</repertorio_kolo>`;
}
