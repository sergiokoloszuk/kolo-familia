/**
 * A DECISÃO SEMÂNTICA DO TURNO — e quem a toma.
 *
 * ⚠️ O QUE ESTE ARQUIVO INVERTE. Até 06/09/2026 a decisão material de todo turno
 * de WhatsApp era do `classificar_intencao`, rodando em **claude-haiku-4-5**.
 * A auditoria mediu: 252 chamadas em 14 dias contra 221 do GPT — o decisor mais
 * chamado da Kolo era o modelo menor, e ele decidia, ANTES do GPT ler qualquer
 * coisa:
 *
 *   · qual era a intenção;
 *   · qual era o tema;
 *   · quais skills — e portanto **que conhecimento o GPT poderia ver**;
 *   · se uma feature sequestrava o turno.
 *
 * O GPT recebia o resto. Este módulo devolve a decisão a ele.
 *
 * ⚠️ A DISTINÇÃO QUE FALTAVA, e ela é o coração da correção: **falar sobre um
 * assunto não é pedir a ação**. "Nós 2, lição e rotina" é uma mãe contando o
 * dia; o classificador lia `rotina` e a feature tomava o turno inteiro. Agora a
 * decisão traz `pedidoExplicito`, e nenhuma feature age sem ele.
 *
 * ⚠️ O QUE ESTE MÓDULO NÃO FAZ. Não escreve a fala — quem escreve é o caminho
 * conversacional, sob o Core v11. Não executa feature. Não consulta
 * conhecimento. Decide, e devolve a decisão para o código executar.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { gerarConversacional, MODELO_CONVERSA } from "@/lib/ia/provider";
import { logarUsoApi } from "@/lib/billing/logar";
import { logEvent } from "@/lib/log";
import type { IntencaoAyla, SkillDoCatalogo, TurnoClassificado } from "@/lib/ayla/intent";

/**
 * Que conhecimento este turno pede.
 *
 * ⚠️ NESTA FASE, `base2`, `pos_neurodesenvolvimento` e `combinacao` apenas
 * SINALIZAM necessidade. Nada é consultado por eles ainda — BASE2 segue ligada
 * só ao Legacy e a Pós é arquivo em `docs/`, sem runtime. Registrar a
 * necessidade sem atendê-la é honesto e mensurável; fingir que consultamos
 * seria a mentira que a auditoria existiu para não deixar acontecer.
 */
export type NecessidadeConhecimento =
  | "nenhum"
  | "boas_praticas"
  | "base2"
  | "pos_neurodesenvolvimento"
  | "combinacao";

export type DecisaoDoTurno = TurnoClassificado & {
  /**
   * ⚠️ O CAMPO QUE IMPEDE O SEQUESTRO. `true` só quando a família PEDIU a ação
   * — "muda a rotina", "cria uma rotina visual", "tira o banho da rotina". Uma
   * mãe que menciona a palavra enquanto conta o dia devolve `false`, e o turno
   * segue como conversa.
   */
  pedidoExplicito: boolean;
  /** É continuação do que estava aberto, e não assunto novo? */
  continuacao: boolean;
  necessidadeConhecimento: NecessidadeConhecimento;
  /** Sobre o quê buscar, quando houver necessidade. `null` quando não há. */
  temaConhecimento: string | null;
  /** Como a decisão foi tomada — para telemetria, nunca para a família. */
  /**
   * ⚠️ TRÊS DESFECHOS, NÃO DOIS — PEND-186, 10/09/2026.
   *
   * `"gpt"` é decisão do modelo. `"fallback_neutro"` é exceção na chamada.
   * `"sem_resposta"` é o que faltava: a chamada teve SUCESSO e voltou sem
   * conteúdo aproveitável — orçamento consumido pelo raciocínio, ou JSON
   * ilegível. Antes isso virava `"gpt"`, e o rastro afirmava que a Ayla decidira
   * não fazer nada quando na verdade ninguém decidiu coisa alguma.
   */
  origem: "gpt" | "fallback_neutro" | "sem_resposta";
  /**
   * ⚠️ `skills` FOI AVALIADO CONTRA UM CATÁLOGO VÁLIDO? — PEND-184, 09/09/2026.
   *
   * `false` significa que o catálogo não carregou: o bloco
   * `<catalogo_de_skills>` não foi ao prompt e, pelo contrato, o modelo devolve
   * `[]` com razão. Nesse estado `skills: []` NÃO é "nada do catálogo servia";
   * é "não houve catálogo". Quem consome tem que poder distinguir as duas
   * coisas, senão uma falha de leitura vira, silenciosamente, uma decisão
   * negativa do modelo — que foi o defeito da PEND-184.
   *
   * O resto da decisão (intenção, pedido explícito, continuidade, aceite,
   * necessidade de conhecimento) NÃO depende do catálogo e continua valendo:
   * abortar o turno inteiro por causa de um select seria trocar um defeito
   * silencioso por um apagão.
   */
  skillsAvaliadas: boolean;
};

/**
 * ⚠️ A DECISÃO NEUTRA — o que vale quando a chamada falha.
 *
 * Ela é deliberadamente a mais CONSERVADORA possível: intenção `outro` (nenhuma
 * feature age), `pedidoExplicito: false` (ninguém sequestra o turno) e
 * `skills: []` (nenhum repertório). É o comportamento que ~91% dos turnos já
 * tinham antes desta mudança, então o pior caso da falha é o produto de ontem —
 * e nunca uma feature disparando por engano numa família real.
 *
 * ⚠️ E NÃO HÁ FALLBACK PARA O HAIKU. Devolver a decisão ao modelo menor quando
 * o maior falha reintroduziria, pela porta dos fundos, exatamente a autoridade
 * que esta fase retira. Falhar para o neutro é mais honesto que falhar para o
 * comportamento antigo.
 */
const DECISAO_NEUTRA: Omit<DecisaoDoTurno, "origem" | "skillsAvaliadas"> = {
  intencao: "outro",
  tema: null,
  aceite: null,
  skills: [],
  pedidoExplicito: false,
  continuacao: false,
  necessidadeConhecimento: "nenhum",
  temaConhecimento: null,
};

const INTENCOES: readonly IntencaoAyla[] = [
  "rotina_criar", "rotina_ver", "rotina_editar", "organizacao", "plano", "outro",
];

const NECESSIDADES: readonly NecessidadeConhecimento[] = [
  "nenhum", "boas_praticas", "base2", "pos_neurodesenvolvimento", "combinacao",
];

/**
 * As instruções da decisão.
 *
 * ⚠️ ELE NÃO CONVERSA, E ISSO É PROPOSITAL. Este prompt não descreve a Ayla,
 * não tem voz e não escreve para a família — o Core v11 governa a FALA, e
 * misturar as duas coisas faria a decisão herdar a instrução de ser prestativa,
 * que é justamente o que faz uma regra perder dentro de um prompt.
 */
/**
 * O CONTRATO DE SAÍDA, imposto na origem — PEND-186.
 *
 * ⚠️ Não substitui `interpretar`: o schema garante a FORMA, e `interpretar`
 * continua responsável pelo DOMÍNIO (intenção inventada, skill fora do
 * catálogo, `true` que não é booleano). Uma camada impede o JSON quebrado; a
 * outra impede o valor errado.
 */
const ESQUEMA_DA_DECISAO: Record<string, unknown> = {
  type: "json_schema",
  json_schema: {
    name: "decisao_do_turno",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: [
        "intencao",
        "pedido_explicito",
        "tema",
        "aceite",
        "continuacao",
        "skills",
        "necessidade_conhecimento",
        "tema_conhecimento",
      ],
      properties: {
        intencao: {
          type: "string",
          enum: ["rotina_criar", "rotina_ver", "rotina_editar", "organizacao", "plano", "outro"],
        },
        pedido_explicito: { type: "boolean" },
        tema: { type: ["string", "null"] },
        aceite: { type: ["string", "null"] },
        continuacao: { type: "boolean" },
        skills: { type: "array", items: { type: "string" } },
        necessidade_conhecimento: {
          type: "string",
          enum: ["nenhum", "boas_praticas", "base2", "pos_neurodesenvolvimento", "combinacao"],
        },
        tema_conhecimento: { type: ["string", "null"] },
      },
    },
  },
};

/**
 * O ORÇAMENTO — 900, e o número é medido, não escolhido por conforto.
 *
 * ⚠️ ERA 300, e 21,5% das decisões batiam nele. A causa não era JSON longo: o
 * conteúdo cabe em 179–270 caracteres. Era o RACIOCÍNIO, que conta como saída e
 * variou de 65 a 300 tokens nas medições de 10/09/2026. Com `reasoning_effort:
 * "low"` o total caiu para média 101 (era 225) e a latência mediana para 1389ms
 * (era 3174ms) — mais confiável, mais barato e mais rápido ao mesmo tempo.
 *
 * 900 é folga, não custo: cobra-se o que se usa, e o máximo observado com
 * esforço baixo foi 232.
 */
const ORCAMENTO_DA_DECISAO = 900;

const INSTRUCOES = `Você lê a mensagem de uma mãe/responsável para a Ayla e decide o que ela QUER — nada além disso. Você não responde à família e não escreve texto para ela.

Devolva SOMENTE um JSON, sem cercas de código, com estas chaves:

{
  "intencao": "rotina_criar" | "rotina_ver" | "rotina_editar" | "organizacao" | "plano" | "outro",
  "pedido_explicito": true | false,
  "tema": string | null,
  "aceite": string | null,
  "continuacao": true | false,
  "skills": [string],
  "necessidade_conhecimento": "nenhum" | "boas_praticas" | "base2" | "pos_neurodesenvolvimento" | "combinacao",
  "tema_conhecimento": string | null
}

REGRA MAIS IMPORTANTE — falar sobre um assunto NÃO é pedir a ação.
"pedido_explicito" é true SOMENTE quando a família pede que algo seja feito agora:
  "cria uma rotina visual", "muda a rotina", "tira o banho da rotina",
  "me monta um plano", "quero o quadro da segunda".
É FALSE quando ela apenas menciona ou conversa sobre o assunto:
  "Nós 2, lição e rotina" — está contando o dia.
  "a rotina dele é bagunçada" — está descrevendo um problema.
  "ele tem dificuldade com a lição" — está trazendo uma queixa.
Na dúvida, false. Uma feature disparando sem pedido interrompe a conversa da mãe;
uma feature que não dispara custa, no máximo, ela pedir de novo com todas as letras.

CONTINUIDADE — use o <estado>. Respostas curtas ("sim", "3", "isso", "ok", "e agora?",
"consegue trazer?", "me mostra") quase nunca são assunto novo: elas respondem à
pergunta pendente, aceitam a oferta pendente, ou cobram o artefato pendente que
está no estado. Resolva a referência pelo estado, não pela string isolada.
Se o estado mostra artefato pendente e a mensagem é uma cobrança, "continuacao"
é true e "intencao" é "outro" — quem trata o artefato é o código, não a feature.

"aceite" — quando ela aceita algo que a Ayla ofereceu, descreva em UMA frase o que
foi aceito. "sim" sozinho não carrega conteúdo.

"necessidade_conhecimento" — o que ESTE turno pediria de material de apoio:
  "nenhum" para desabafo, cumprimento, conversa social, resposta operacional;
  "boas_praticas" para pedido de estratégia concreta do dia a dia;
  "base2" para compreender um tema em profundidade antes de orientar;
  "pos_neurodesenvolvimento" para fundamento clínico/de desenvolvimento;
  "combinacao" quando mais de uma fonte ajudaria.
"tema_conhecimento" é sobre o quê buscar, em poucas palavras.

"skills" — no máximo duas, e SOMENTE nomes do catálogo oferecido. Se nada do
catálogo servir, devolva [].`;

/**
 * Decide o turno com o GPT, tendo o estado à vista.
 *
 * ⚠️ RECEBE O `<estado>` PRONTO. Quem apura é `estado-do-turno.ts`, e este
 * módulo não reconsulta nada: duas fontes para o mesmo fato divergem, e a
 * divergência apareceria como a Ayla decidindo por um estado e falando por
 * outro.
 */
export async function decidirTurno(params: {
  texto: string;
  /** O bloco `<estado>` já renderizado pelo chamador. */
  blocoEstado: string;
  /** Últimas falas, como o chamador já as tem. Curto de propósito. */
  ultimaAyla?: string | null;
  ultimaMae?: string | null;
  temaAnterior?: string | null;
  temasOnboarding?: string[];
  catalogoSkills?: SkillDoCatalogo[];
  /**
   * O catálogo estava DISPONÍVEL? — PEND-184.
   *
   * ⚠️ Não dá para deduzir isto de `catalogoSkills.length === 0`: zero skills
   * ativas é um estado real do produto (basta desativarem todas no Admin) e uma
   * falha de leitura é outra coisa. O default é `true` porque, para todo
   * chamador que não sabe distinguir, o comportamento continua o de antes.
   */
  catalogoDisponivel?: boolean;
  supabase?: SupabaseClient | null;
  familyId?: string | null;
}): Promise<DecisaoDoTurno> {
  const catalogo = (params.catalogoSkills ?? []).slice(0, 40);
  const permitidas = new Set(catalogo.map((s) => s.name));
  const catalogoDisponivel = params.catalogoDisponivel !== false;

  const contexto = [
    params.blocoEstado,
    params.ultimaAyla ? `<ultima_fala_da_ayla>${params.ultimaAyla.slice(0, 900)}</ultima_fala_da_ayla>` : "",
    params.ultimaMae ? `<fala_anterior_da_familia>${params.ultimaMae.slice(0, 400)}</fala_anterior_da_familia>` : "",
    params.temaAnterior ? `<tema_do_turno_anterior>${params.temaAnterior}</tema_do_turno_anterior>` : "",
    params.temasOnboarding?.length
      ? `<temas_do_cadastro>${params.temasOnboarding.slice(0, 8).join(", ")}</temas_do_cadastro>`
      : "",
    catalogo.length
      ? `<catalogo_de_skills>\n${catalogo.map((s) => `- ${s.name}: ${(s.routing_keywords ?? []).slice(0, 8).join(", ")}`).join("\n")}\n</catalogo_de_skills>`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    // ⚠️ UM PEDIDO, DUAS TENTATIVAS. Montado uma vez para a retry não poder
    // divergir do original — duas cópias do mesmo prompt divergem na primeira
    // vez que alguém edita só uma.
    const pedido = {
      // ⚠️ MESMO PROVIDER DA CONVERSA, de propósito. Decisão e fala tomadas por
      // modelos diferentes divergem — e a divergência aparece como uma Ayla que
      // decidiu uma coisa e falou outra.
      provider: "openai" as const,
      model: MODELO_CONVERSA.openai,
      system: `${INSTRUCOES}\n\n${contexto}`,
      messages: [{ role: "user" as const, content: params.texto.slice(0, 4000) }],
      maxTokens: ORCAMENTO_DA_DECISAO,
      cacheSystem: true,
      // Ver `ORCAMENTO_DA_DECISAO`: ataca a causa, não paga a conta dela.
      esforcoRaciocinio: "low" as const,
      formatoJson: ESQUEMA_DA_DECISAO,
    };
    const saida = await gerarConversacional(pedido);

    if (params.supabase && params.familyId) {
      // Falha de registro nunca derruba o turno.
      void logarUsoApi(params.supabase, {
        family_account_id: params.familyId,
        provider: "openai",
        model: saida.model,
        feature: "decisao_turno",
        input_tokens: saida.tokensIn,
        output_tokens: saida.tokensOut,
        // ⚠️ GATE 9 — A DURAÇÃO PASSA A EXISTIR. `SaidaConversacional` já media
        // `ms` e ninguém guardava. Sem coluna nova: vai em `meta`, que é jsonb,
        // e é o que permitirá calcular mediana e p95 daqui a alguns dias.
        meta: { ms: saida.ms, cache_read: saida.cacheRead },
      }).catch(() => {});
    }

    /**
     * ⚠️ SUCESSO DE REDE NÃO É DECISÃO. Se voltou sem conteúdo aproveitável, o
     * modelo não decidiu nada — e chamar isso de `"gpt"` foi o que escondeu a
     * PEND-186 por semanas. Uma tentativa a mais é barata perto de perder a
     * intenção, o pedido explícito e a continuidade do turno.
     */
    const util = (t: string) => t.includes("{") && t.lastIndexOf("}") > t.indexOf("{");
    let texto = saida.texto;
    let motivo = saida.motivoDeParada;
    let tentativas = 1;
    if (!util(texto)) {
      const retry = await gerarConversacional(pedido);
      tentativas = 2;
      texto = retry.texto;
      motivo = retry.motivoDeParada;
    }

    if (!util(texto)) {
      // ⚠️ O ALARME QUE NÃO EXISTIA. Sem ele, um em cada cinco turnos perdia a
      // decisão inteira e o único rastro dizia "o GPT decidiu `outro`".
      void logEvent({
        kind: "decisao_turno_sem_resposta",
        severity: "error",
        family_account_id: params.familyId ?? null,
        message: `decisor sem conteúdo aproveitável (${motivo ?? "sem motivo"}) após ${tentativas} tentativa(s)`,
        payload: {
          sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
          motivo_de_parada: motivo,
          tentativas,
          orcamento: ORCAMENTO_DA_DECISAO,
          caracteres: texto.length,
          // ⚠️ O QUE O TURNO PERDE — para quem ler não ter que saber o mapa.
          campos_perdidos: [
            "intencao",
            "pedido_explicito",
            "tema",
            "aceite",
            "continuacao",
            "skills",
            "necessidade_conhecimento",
          ],
        },
        persistir: true,
      });
      return { ...DECISAO_NEUTRA, origem: "sem_resposta", skillsAvaliadas: false };
    }

    return {
      ...interpretar(texto, permitidas, catalogoDisponivel),
      origem: "gpt",
    };
  } catch (e) {
    console.error(
      "[conducao:decisao] decisão do turno falhou — caindo no neutro:",
      e instanceof Error ? e.message : e,
    );
    // ⚠️ O NEUTRO TAMBÉM NÃO AVALIOU SKILLS. A chamada falhou inteira: dizer
    // `skillsAvaliadas: true` aqui afirmaria que o modelo olhou o catálogo e
    // não escolheu nada — exatamente a mentira que a PEND-184 desfez.
    return { ...DECISAO_NEUTRA, origem: "fallback_neutro", skillsAvaliadas: false };
  }
}

/**
 * Lê o JSON do modelo sem confiar nele.
 *
 * ⚠️ NADA AQUI PODE LANÇAR, e nada pode devolver valor fora do domínio. Uma
 * intenção inventada rotearia para uma feature inexistente; uma skill fora do
 * catálogo buscaria repertório que não existe. Toda entrada estranha vira o
 * neutro correspondente — que é sempre o valor mais conservador.
 */
export function interpretar(
  bruto: string,
  permitidas: Set<string>,
  /**
   * O catálogo estava disponível? Quando `false`, `skills` sai vazio e
   * `skillsAvaliadas` sai `false` — ver o comentário do campo. O filtro por
   * `permitidas` já produziria o vazio sozinho (o Set está vazio); o que muda
   * aqui é o turno passar a DIZER isso, em vez de deixar o vazio se passar por
   * decisão do modelo.
   */
  catalogoDisponivel = true,
): Omit<DecisaoDoTurno, "origem"> {
  try {
    const limpo = bruto.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const i = limpo.indexOf("{");
    const j = limpo.lastIndexOf("}");
    if (i < 0 || j <= i) return { ...DECISAO_NEUTRA, skillsAvaliadas: catalogoDisponivel };
    const o = JSON.parse(limpo.slice(i, j + 1)) as Record<string, unknown>;

    const intencao = INTENCOES.includes(o.intencao as IntencaoAyla)
      ? (o.intencao as IntencaoAyla)
      : "outro";
    const necessidade = NECESSIDADES.includes(o.necessidade_conhecimento as NecessidadeConhecimento)
      ? (o.necessidade_conhecimento as NecessidadeConhecimento)
      : "nenhum";
    const texto = (v: unknown, max: number) => {
      const s = typeof v === "string" ? v.trim() : "";
      return s && s.toLowerCase() !== "null" ? s.slice(0, max) : null;
    };
    const skills = Array.isArray(o.skills)
      ? [...new Set(o.skills.filter((s): s is string => typeof s === "string" && permitidas.has(s)))].slice(0, 2)
      : [];

    return {
      intencao,
      tema: texto(o.tema, 80),
      aceite: texto(o.aceite, 200),
      skills: catalogoDisponivel ? skills : [],
      skillsAvaliadas: catalogoDisponivel,
      // ⚠️ SÓ `true` LITERAL LIBERA A AÇÃO. Uma string "true", um 1, um objeto —
      // qualquer coisa que não seja o booleano vira `false`. O viés é sempre
      // para não disparar feature.
      pedidoExplicito: o.pedido_explicito === true,
      continuacao: o.continuacao === true,
      necessidadeConhecimento: necessidade,
      temaConhecimento: texto(o.tema_conhecimento, 80),
    };
  } catch {
    return { ...DECISAO_NEUTRA, skillsAvaliadas: catalogoDisponivel };
  }
}
