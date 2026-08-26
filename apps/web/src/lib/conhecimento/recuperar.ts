import type { SupabaseClient } from "@supabase/supabase-js";
import { ordenarPorAderencia } from "./aderencia";

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
 * vivem dentro das BPs — não há Camada 3.
 *
 * ⚠️ CORREÇÃO DE 22/08/2026, e ela desmente uma frase que estava aqui. O
 * comentário dizia que atividades viviam em `passos_praticos`. Não vivem:
 * vivem em `atividades_praticas`, coluna própria, preenchida em **367 das 370**
 * BPs ativas — e que **nenhum caminho do produto lia**. `crencas_adulto`, mesma
 * história. E `erros_comuns`, embora selecionado desde 06/08, era descartado
 * uma linha adiante por ser texto onde o código esperava array (ver `lista`).
 *
 * Ou seja: dos campos que o cabeçalho acima celebra ter recuperado, dois nunca
 * chegaram e um chegava vazio. Medido, não suposto.
 */

export type BoaPraticaRecuperada = {
  /** Id estável da BP. É o que o rastro registra — nunca o texto. */
  id: string;
  titulo: string;
  versao_conversa: string | null;
  quando_usar: string | null;
  erros_comuns: string[];
  passos_praticos: string[];
  /**
   * As brincadeiras e atividades concretas. Preenchido em 367 das 370 BPs
   * ativas — e, até 22/08/2026, nunca lido por caminho nenhum: o campo não
   * estava no `select` nem no bloco. A Ayla inventava a atividade a partir dos
   * `passos_praticos`, que estão em 248.
   */
  atividades_praticas: string[];
  /**
   * A crença do adulto que precisa mudar para a prática funcionar ("birra é
   * manipulação" → "é sobrecarga"). Também em 367, também nunca lida.
   * Não é para ser dita à família: é para a Ayla saber contra o que fala.
   */
  crenca_adulto: string | null;
};

type Linha = {
  id: string;
  titulo: string | null;
  versao_curta: string | null;
  versao_conversa: string | null;
  quando_usar: string | null;
  erros_comuns: unknown;
  passos_praticos: unknown;
  atividades_praticas: unknown;
  crencas_adulto: unknown;
  skills_relacionadas: unknown;
  tags: unknown;
  peso_relevancia: number | null;
  faixa_etaria_min: number | null;
  faixa_etaria_max: number | null;
};

/**
 * NORMALIZA UMA LISTA QUE NEM SEMPRE É LISTA.
 *
 * ⚠️ O DEFEITO QUE ISTO CORRIGE (medido em 22/08/2026). `erros_comuns` está
 * preenchido em **367 das 370** boas práticas ativas — e chegava ao modelo em
 * ZERO delas. No banco ele é **texto** ("Prescrição sem investigação;
 * moralização"), e a versão anterior desta função devolvia `[]` para tudo que
 * não fosse array. O bloco do prompt só emite a linha `EVITE:` quando o array
 * tem itens, então ela nunca saía.
 *
 * O cabeçalho deste arquivo já dizia que a web "jogava fora justamente os
 * campos que decidem a conduta — `quando_usar`, `erros_comuns` e
 * `passos_praticos`". A correção de 06/08 passou a SELECIONAR a coluna, e o
 * descarte continuou uma linha adiante, por incompatibilidade de tipo. É o
 * mesmo padrão do dedup que não deduplicava: o conserto parecia feito.
 *
 * Separador `;` porque é o que o acervo usa — 233 das 367 trazem mais de um
 * item na mesma string.
 */
const lista = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string") {
    return v
      .split(/[;·\n]/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
};

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
   * O RELATO DA FAMÍLIA, quando quem chama quiser o ranking por aderência.
   *
   * **Omitir mantém o comportamento anterior byte a byte** — é assim que o
   * WhatsApp continua intocado enquanto a web experimenta. Passar liga
   * `ordenarPorAderencia` ANTES do corte, para que a escolha das 3 leve em
   * conta o que a família escreveu, e não só o peso e a skill.
   *
   * Sem isto, o corte é sempre o mesmo trio para qualquer relato dentro da
   * mesma skill e faixa etária: a ordenação é por `peso_relevancia`, que não
   * conhece o caso.
   */
  relato?: string | null;
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
    // ── DUAS FASES: RANQUEAR LEVE, DETALHAR SÓ O QUE VAI SER USADO ──────────
    //
    // ⚠️ O QUE ISTO CORRIGE, MEDIDO EM 26/08/2026. A consulta trazia 200 linhas
    // com as 14 colunas — **212 KB** — para que o produto usasse **2** delas
    // (`bpInjetadas` p75 = 2, MEDI em 270 turnos). Os 198 restantes eram
    // transferidos e descartados.
    //
    // A fase 1 traz só o que o RANQUEAMENTO precisa: `ordenarPorAderencia` lê
    // `titulo`, `versao_conversa`/`versao_curta`, `quando_usar`, `passos_praticos`
    // e `tags`; o filtro de idade lê as faixas; a ordem por skill lê
    // `skills_relacionadas`. Ficam de fora as três colunas mais gordas —
    // `erros_comuns`, `atividades_praticas` e `crencas_adulto` —, que só entram
    // no bloco final e por isso só precisam existir para as escolhidas.
    //
    // ⚠️ SIM, É UM ROUND-TRIP A MAIS, e eu duvidei que compensasse: o banco está
    // com piso de ~700 ms por consulta (PEND-117). MEDI antes de escrever:
    //   1 query pesada ............................ p50 1.701 ms
    //   leve + detalhe das 2, em série ............ p50   993 ms
    // O payload domina o round-trip. Se PEND-117 for resolvida e o piso cair, a
    // conta muda de sinal — vale remedir antes de tratar isto como definitivo.
    //
    // ⚠️ NENHUM CONHECIMENTO SAI. As mesmas boas práticas são consideradas, na
    // mesma ordem, com os mesmos campos no bloco final. O que muda é quando cada
    // coluna viaja pela rede.
    const COLUNAS_RANKING =
      "id, titulo, versao_curta, versao_conversa, quando_usar, passos_praticos, skills_relacionadas, tags, peso_relevancia, faixa_etaria_min, faixa_etaria_max";
    const { data, error } = await p.supabase
      .from("boas_praticas")
      .select(COLUNAS_RANKING)
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

    // ADERÊNCIA AO RELATO — só quando quem chama pede.
    //
    // Entra AQUI, e não depois: `recuperarBoasPraticas` devolve 3, e ranquear
    // 3 itens já escolhidos não escolheria nada. O ganho está em ordenar as
    // dezenas de candidatas elegíveis antes do corte.
    //
    // `ordenarPorAderencia` é conservador por desenho: abaixo do piso ele
    // devolve a ordem que recebeu. Então, num relato sem aderência nenhuma, o
    // resultado é idêntico ao de antes — passar `relato` nunca piora a ordem
    // por acidente, só deixa de ajudar.
    const finais = p.relato?.trim()
      ? ordenarPorAderencia(
          ordenadas.map((bp) => ({
            id: String(bp.id),
            titulo: String(bp.titulo ?? ""),
            versao_conversa: bp.versao_conversa ?? bp.versao_curta ?? null,
            quando_usar: bp.quando_usar ?? null,
            passos_praticos: bp.passos_praticos,
            tags: bp.tags,
            _original: bp,
          })),
          p.relato,
        ).itens.map((x) => x._original)
      : ordenadas;

    const escolhidas = finais.slice(0, p.limite ?? 3);
    if (escolhidas.length === 0) return [];

    // ── FASE 2: o detalhe, só das escolhidas ────────────────────────────────
    //
    // ⚠️ FALHA AQUI NÃO PODE APAGAR O REPERTÓRIO. Se a segunda consulta não
    // voltar, as boas práticas escolhidas seguem para o bloco com os campos que
    // a fase 1 já trouxe — `versao_conversa`, `quando_usar` e `passos_praticos`,
    // que são o miolo da orientação. Perder `erros_comuns` e `atividades` é pior
    // que antes; perder a boa prática inteira seria MUITO pior.
    const detalhePorId = new Map<string, Record<string, unknown>>();
    const { data: detalhe } = await p.supabase
      .from("boas_praticas")
      .select("id, erros_comuns, atividades_praticas, crencas_adulto")
      .in(
        "id",
        escolhidas.map((bp) => String(bp.id)),
      );
    for (const d of (detalhe ?? []) as Array<Record<string, unknown>>) {
      detalhePorId.set(String(d.id), d);
    }

    return escolhidas.map((bp) => {
      const d = detalhePorId.get(String(bp.id)) ?? {};
      return {
        id: String(bp.id),
        titulo: String(bp.titulo ?? "").trim(),
        // `versao_curta` só entra quando não há `versao_conversa` — mandar as duas
        // seria repetir a mesma orientação com outras palavras dentro do prompt.
        versao_conversa: (bp.versao_conversa ?? bp.versao_curta ?? null)?.trim() || null,
        quando_usar: (bp.quando_usar ?? "").trim() || null,
        erros_comuns: lista(d.erros_comuns),
        passos_praticos: lista(bp.passos_praticos),
        atividades_praticas: lista(d.atividades_praticas),
        crenca_adulto:
          (typeof d.crencas_adulto === "string" ? d.crencas_adulto : "").trim() || null,
      };
    });
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
      // As brincadeiras concretas. Vêm DEPOIS dos passos porque são o material
      // da oferta ("quer que eu monte…"), não o raciocínio que a antecede.
      if (b.atividades_praticas.length)
        linhas.push(`   ATIVIDADES: ${b.atividades_praticas.join(" · ")}`);
      // A crença do adulto NÃO é para ser dita à família — é contra o que a
      // Ayla está falando. Por isso o rótulo diz "desfazer", não "explicar".
      if (b.crenca_adulto) linhas.push(`   CRENÇA A DESFAZER: ${b.crenca_adulto}`);
      return linhas.join("\n");
    })
    .join("\n\n");

  return `<repertorio_kolo>
Isto é REPERTÓRIO da Kolo pra você raciocinar — não é roteiro e não se cita.

- Use "QUANDO SERVE" pra decidir se aquilo cabe MESMO nesta situação. Se não couber, ignore aquela entrada; trazer conteúdo que não serve é pior do que não trazer.
- "EVITE" é o que NÃO recomendar. Não vire isso em aula sobre erros.
- "DÁ PRA FAZER" é o que a família consegue executar hoje — adapte à idade e aos interesses da criança que você já conhece, em vez de repetir o passo literal.
- "ATIVIDADES" são brincadeiras e atividades concretas já validadas. Prefira ADAPTAR uma delas ao interesse da criança a inventar uma do zero — mas nunca cite a lista, e nunca proponha uma que não caiba na idade ou no momento.
- "CRENÇA A DESFAZER" é o que o adulto provavelmente pensa e que atrapalha. NÃO diga isso a ela, não a corrija e não a acuse de pensar assim: use só para escolher como falar, e para não reforçar a crença sem querer.
- NUNCA escreva "quando usar", "erros comuns", "passos", "atividades" ou "crença" como seções da resposta, e nunca despeje as ${bps.length} entradas. Escolha o que ajuda AGORA e transforme em conversa.

${itens}
</repertorio_kolo>`;
}
