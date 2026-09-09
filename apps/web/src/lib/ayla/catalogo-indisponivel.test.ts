import { beforeEach, describe, expect, it, vi } from "vitest";
import { perfilConsultavelDaLinha } from "@/lib/kolo-vivo/consultar";
import { escolherLacunaDecisiva } from "./lacuna-decisiva";
import { interpretar } from "@/lib/conducao/decisao-do-turno";
import { motivoDoVazio, montarRastro } from "@/lib/conhecimento/rastro";

/**
 * PEND-184 — FALHA DE LEITURA NÃO PODE VIRAR DECISÃO DO MODELO.
 *
 * ⚠️ O DEFEITO, medido no primeiro turno humano do Gate B (09/09/2026).
 * `carregarCatalogoSkills` devolvia `[]` tanto quando o select tinha sucesso
 * com zero linhas quanto quando ele falhava. `decidirTurno` só monta o bloco
 * `<catalogo_de_skills>` se a lista não está vazia, e o contrato manda "SOMENTE
 * nomes do catálogo oferecido. Se nada do catálogo servir, devolva []". Sem o
 * bloco, o modelo obedece e devolve vazio — **com razão**.
 *
 * Bancada com o decisor real, no mesmo dia: com o bloco presente, 0 vazios em
 * 25 execuções; sem o bloco, 5 em 5. O modelo nunca errou. O que havia era um
 * fail-open que apagava, de uma vez, a lacuna do Gate B e o repertório de Boas
 * Práticas — sem erro, sem log persistido, sem rastro nenhum.
 *
 * ⚠️ E O VAZIO LEGÍTIMO CONTINUA EXISTINDO: desativar as 13 skills no Admin é
 * um estado real do produto. Metade destes testes existe para provar que as
 * duas coisas seguem distinguíveis.
 */

const eventos: Array<{ kind: string; severity?: string; payload?: Record<string, unknown> }> = [];
vi.mock("@/lib/log", () => ({
  logEvent: async (e: { kind: string; severity?: string; payload?: Record<string, unknown> }) => {
    eventos.push(e);
  },
  logServerError: async () => {},
}));

const { carregarCatalogoSkills, _limparCacheDeSkills } = await import("./catalogo-skills");

/** Um cliente mínimo: responde o que o cenário mandar, e conta as tentativas. */
function clienteQue(
  resposta: () => { data?: unknown; error?: { message: string } } | Promise<never>,
) {
  const chamadas = { n: 0 };
  const cliente = {
    from: () => ({
      select: () => ({
        eq: async () => {
          chamadas.n++;
          return resposta();
        },
      }),
    }),
  };
  return { cliente: cliente as never, chamadas };
}

const TREZE = Array.from({ length: 13 }, (_, i) => ({
  name: `skill_${i}`,
  routing_keywords: ["a", "b"],
}));

beforeEach(() => {
  eventos.length = 0;
  _limparCacheDeSkills();
});

// ═══════════════════════════════════════════════════════════════════════
// 1 · O CATÁLOGO — falha, vazio legítimo e cache
// ═══════════════════════════════════════════════════════════════════════

describe("PEND-184 · o catálogo distingue falha de vazio", () => {
  it("sucesso com 13 linhas → estado ok", async () => {
    const { cliente } = clienteQue(() => ({ data: TREZE }));
    const r = await carregarCatalogoSkills(cliente);
    expect(r.estado).toBe("ok");
    expect(r.estado === "ok" && r.skills.length).toBe(13);
    expect(eventos.length, "sucesso não pode gerar alarme").toBe(0);
  });

  it("VAZIO LEGÍTIMO: select ok com zero linhas → ok, não indisponível", async () => {
    // ⚠️ Desativar todas as skills no Admin é um estado REAL. Ele não pode
    // ligar o fallback do Gate B nem soar alarme: nada falhou.
    const { cliente } = clienteQue(() => ({ data: [] }));
    const r = await carregarCatalogoSkills(cliente);
    expect(r.estado).toBe("ok");
    expect(r.estado === "ok" && r.skills.length).toBe(0);
    expect(eventos.length).toBe(0);
  });

  it("erro do banco → indisponível E evento persistido", async () => {
    const { cliente } = clienteQue(() => ({ error: { message: "timeout ao ler" } }));
    const r = await carregarCatalogoSkills(cliente, "fam-1");
    expect(r.estado).toBe("indisponivel");
    const alarme = eventos.find((e) => e.kind === "catalogo_skills_indisponivel");
    expect(alarme, "a falha não deixou rastro — foi o defeito inteiro").toBeTruthy();
    expect(alarme?.severity).toBe("error");
    // O evento precisa dizer O QUE fica sem entrada, senão quem lê não sabe.
    expect(alarme?.payload?.consumidores_afetados).toContain("lacuna_decisiva");
    expect(alarme?.payload?.consumidores_afetados).toContain("boas_praticas");
    // E não pode carregar conteúdo da família: só o id de correlação.
    expect(JSON.stringify(alarme?.payload ?? {})).not.toContain("fam-1");
  });

  it("exceção lançada também vira indisponível, não vazio", async () => {
    const { cliente } = clienteQue(() => Promise.reject(new Error("fetch failed")));
    const r = await carregarCatalogoSkills(cliente);
    expect(r.estado).toBe("indisponivel");
    expect(eventos.some((e) => e.kind === "catalogo_skills_indisponivel")).toBe(true);
  });

  it("a falha NÃO envenena o cache — o turno seguinte tenta de novo", async () => {
    // ⚠️ O RISCO REAL: cachear `[]` por 5 minutos multiplicaria por sessenta o
    // estrago de uma indisponibilidade de um segundo.
    let falhar = true;
    const chamadas = { n: 0 };
    const cliente = {
      from: () => ({
        select: () => ({
          eq: async () => {
            chamadas.n++;
            return falhar ? { error: { message: "queda" } } : { data: TREZE };
          },
        }),
      }),
    } as never;

    expect((await carregarCatalogoSkills(cliente)).estado).toBe("indisponivel");
    expect(chamadas.n).toBe(1);

    falhar = false;
    const segunda = await carregarCatalogoSkills(cliente);
    expect(chamadas.n, "não tentou de novo — a falha foi cacheada").toBe(2);
    expect(segunda.estado).toBe("ok");
    expect(segunda.estado === "ok" && segunda.skills.length).toBe(13);
  });

  it("o SUCESSO é cacheado — o caminho quente não paga um select por turno", async () => {
    const { cliente, chamadas } = clienteQue(() => ({ data: TREZE }));
    await carregarCatalogoSkills(cliente);
    await carregarCatalogoSkills(cliente);
    await carregarCatalogoSkills(cliente);
    expect(chamadas.n).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2 · O DECISOR — não afirmar que avaliou o que não avaliou
// ═══════════════════════════════════════════════════════════════════════

describe("PEND-184 · o decisor não mente sobre skills", () => {
  /** A saída REAL do decisor para a frase da Manu, medida na bancada de 09/09. */
  const SAIDA_DA_MANU = JSON.stringify({
    intencao: "outro",
    pedido_explicito: false,
    tema: "gritos ao desligar o tablet",
    aceite: null,
    continuacao: false,
    skills: ["emocional", "rotina"],
    necessidade_conhecimento: "boas_praticas",
    tema_conhecimento: "birra ao encerrar tela",
  });
  const PERMITIDAS = new Set(["emocional", "rotina", "sono", "comunicacao"]);

  it("com catálogo: a frase real da Manu preserva [emocional, rotina]", () => {
    const d = interpretar(SAIDA_DA_MANU, PERMITIDAS, true);
    expect(d.skills).toEqual(["emocional", "rotina"]);
    expect(d.skillsAvaliadas).toBe(true);
  });

  it("sem catálogo: skills vazio E declarado como NÃO avaliado", () => {
    // ⚠️ O resto da decisão continua valendo. Abortar o turno inteiro por causa
    // de um select seria trocar um defeito silencioso por um apagão.
    const d = interpretar(SAIDA_DA_MANU, new Set(), false);
    expect(d.skills).toEqual([]);
    expect(d.skillsAvaliadas).toBe(false);
    expect(d.intencao).toBe("outro");
    expect(d.tema).toBe("gritos ao desligar o tablet");
    expect(d.necessidadeConhecimento).toBe("boas_praticas");
    expect(d.pedidoExplicito).toBe(false);
  });

  it("catálogo OK e nenhuma skill aplicável ≠ catálogo indisponível", () => {
    // A distinção inteira desta frente, num par de asserções.
    const nadaServiu = JSON.stringify({ intencao: "outro", skills: [] });
    const a = interpretar(nadaServiu, PERMITIDAS, true);
    const b = interpretar(nadaServiu, new Set(), false);
    expect(a.skills).toEqual([]);
    expect(b.skills).toEqual([]);
    expect(a.skillsAvaliadas).toBe(true);
    expect(b.skillsAvaliadas).toBe(false);
  });

  it("resposta ilegível sem catálogo não vira 'avaliei e nada servia'", () => {
    expect(interpretar("isto não é json", new Set(), false).skillsAvaliadas).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3 · O GATE B — degradação conservadora
// ═══════════════════════════════════════════════════════════════════════

describe("PEND-184 · o Gate B degrada em vez de emudecer", () => {
  const L = (p: string[]) => p.join("\n");
  const M = "manu";
  const perfil = (linha: object) =>
    perfilConsultavelDaLinha(linha as Record<string, unknown>, M);

  /** A Manu real: a família já contou o emocional, e faltam campos dele. */
  const PERFIL_COM_DOMINIO_VIVO = {
    categorias_extras: {
      emocional: { texto: L(["Como costuma ser: Desregula com facilidade"]) },
    },
  };

  const PERFIL_RICO = {
    sensorial: {
      texto: L([
        "Perfil sensorial: Hipersensível",
        "Reação a sons: incomoda muito com barulho alto",
        "Reação a toques: aceita abraço apertado",
        "Movimento: busca balanço",
        "Luz: pouca sensibilidade",
      ]),
    },
    categorias_extras: {
      emocional: {
        // ⚠️ OS RÓTULOS SÃO OS DE `subcampos.ts`, LITERAIS. A primeira versão
        // desta fixture escreveu "Sinais antes:" em vez de "Sinais de que vem
        // vindo:", e o campo continuou vazio: o perfil "rico" tinha buracos e o
        // teste acusou o produto de interrogar. Campo homônimo não prova fonte —
        // é o mesmo engano que o arnês documenta desde 11/08/2026.
        texto: L([
          "Como costuma ser: Desregula com facilidade",
          "Gatilhos: insistência; mudanças abruptas de planos",
          "Sinais de que vem vindo: fica em silêncio e bate o pé",
          "Como se manifesta: grita e joga o que está na mão",
          "O que ajuda a passar: aviso com antecedência e voz baixa",
          "O que NÃO ajuda / piora: insistir e explicar demais",
        ]),
      },
    },
  };

  const decidir = (linha: object, temas: string[], catalogoDisponivel: boolean) =>
    escolherLacunaDecisiva({
      perfil: perfil(linha),
      temas,
      relato: "Ela grita quando eu desligo o tablet",
      catalogoDisponivel,
    });

  it("REGRESSÃO DA PEND-184: sem catálogo e com domínio vivo, produz candidata", () => {
    const d = decidir(PERFIL_COM_DOMINIO_VIVO, [], false);
    expect(d.decisao, "o Gate B continuou mudo — o defeito voltou").toBe("ASK");
    expect(d.origemDosDominios).toBe("fallback_sem_catalogo");
    expect(d.escolhida?.dominio).toBe("emocional");
  });

  it("ZERO OU UMA: o fallback nunca escolhe duas", () => {
    const d = decidir(PERFIL_COM_DOMINIO_VIVO, [], false);
    expect(d.escolhida).toBeTruthy();
    expect(`${d.escolhida?.dominio}.${d.escolhida?.campo}`.split(".").length).toBe(2);
    expect(d.descartadas.some((x) => x.motivo === "uma pergunta por turno")).toBe(true);
  });

  it("PERFIL RICO: o fallback NÃO vira pergunta — NO_ASK é o resultado certo", () => {
    const d = decidir(PERFIL_RICO, [], false);
    expect(d.decisao, "degradar virou interrogar").toBe("NO_ASK");
  });

  it("CADASTRO NÃO É INVESTIGAÇÃO: perfil sem nenhum domínio vivo → NO_ASK", () => {
    // ⚠️ O risco de degradar mal: abrir todos os domínios transformaria uma
    // falha de leitura em varredura de cadastro. Um domínio só entra se a
    // família já contou alguma coisa dele.
    const d = decidir({}, [], false);
    expect(d.decisao).toBe("NO_ASK");
    expect(d.origemDosDominios).toBe("nenhum");
    expect(d.descartadas[0].motivo).toContain("catálogo indisponível");
  });

  it("CATÁLOGO OK e sem tema → continua NO_ASK, sem fallback", () => {
    // Aqui o vazio É decisão: a conversa não era de nenhum domínio do acervo.
    const d = decidir(PERFIL_COM_DOMINIO_VIVO, [], true);
    expect(d.decisao).toBe("NO_ASK");
    expect(d.origemDosDominios).toBe("nenhum");
    expect(d.descartadas[0].motivo).toBe("tema não identificado");
  });

  it("com tema, o caminho normal não muda — e o rastro diz que foi por tema", () => {
    const d = decidir(PERFIL_COM_DOMINIO_VIVO, ["emocional"], true);
    expect(d.decisao).toBe("ASK");
    expect(d.origemDosDominios).toBe("tema");
  });

  it("o fallback respeita o que a família já respondeu, e a correção vence", () => {
    const resolvidas = {
      fechadas: new Set(["emocional.gatilhos"]),
      corrigidas: new Set(["emocional.gatilhos"]),
      detalhe: [],
    };
    const d = escolherLacunaDecisiva({
      perfil: perfil(PERFIL_COM_DOMINIO_VIVO),
      temas: [],
      relato: "e agora?",
      resolvidas,
      catalogoDisponivel: false,
    });
    expect(d.escolhida?.campo, "reperguntou o que a família corrigiu").not.toBe("gatilhos");
    expect(d.corrigidas).toContain("emocional.gatilhos");
  });

  it("ISOLAMENTO: o fallback lê o perfil da criança em foco, não da família", () => {
    // O perfil chega já recortado por membro (`perfilConsultavelDaLinha`), e o
    // fallback não amplia esse recorte — só olha domínios daquela linha.
    const doMario = escolherLacunaDecisiva({
      perfil: perfilConsultavelDaLinha(null, "mario"),
      temas: [],
      catalogoDisponivel: false,
    });
    expect(doMario.decisao, "o Mario herdou domínio de perfil que não é dele").toBe("NO_ASK");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4 · O REPERTÓRIO — ausência observável, sem inventar conhecimento
// ═══════════════════════════════════════════════════════════════════════

describe("PEND-184 · o repertório declara indisponibilidade, não desnecessidade", () => {
  it("catálogo indisponível ≠ sem_skill", () => {
    expect(motivoDoVazio({ skills: [], tags: 0, catalogoIndisponivel: true })).toBe(
      "catalogo_indisponivel",
    );
    expect(motivoDoVazio({ skills: [], tags: 0 })).toBe("sem_skill");
  });

  it("a causa mais a montante vence o erro da consulta", () => {
    // Sem catálogo não houve roteamento: dizer "erro na consulta" apontaria
    // para o acervo quando o problema é anterior a ele.
    expect(
      motivoDoVazio({ skills: [], tags: 0, erroNaConsulta: true, catalogoIndisponivel: true }),
    ).toBe("catalogo_indisponivel");
  });

  it("o rastro carrega o motivo até quem for ler depois", () => {
    const r = montarRastro({
      canal: "whatsapp",
      familyId: "f1",
      membroId: "m1",
      skills: [],
      recuperadas: [],
      enviadas: [],
      catalogoIndisponivel: true,
    });
    expect(r.motivoVazio).toBe("catalogo_indisponivel");
  });

  it("NÃO inventa repertório: com catálogo fora, nada é recuperado", () => {
    // A garantia é estrutural e está no consumidor: a recuperação só acontece
    // quando há skill. O que muda nesta frente é o estado ser DECLARADO.
    const r = montarRastro({
      canal: "whatsapp",
      familyId: "f1",
      membroId: "m1",
      skills: [],
      recuperadas: [],
      enviadas: [],
      catalogoIndisponivel: true,
    });
    expect(r.recuperados).toEqual([]);
    expect(r.enviados).toEqual([]);
  });
});
