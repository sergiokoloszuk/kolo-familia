import { describe, expect, it } from "vitest";
import { parsearSubcampos, serializarSubcampos, subcamposDe } from "./subcampos";
import { perfilConsultavelDaLinha } from "./consultar";

/**
 * PEND-189 — RÓTULO NO MEIO DA LINHA, e a divergência que ele causou.
 *
 * ⚠️ O CASO REAL (produção, 09/09/2026). O bloco `sensorial` de uma criança
 * tinha seis rótulos numa única linha, separados por ". ". `parsearSubcampos`
 * só reconhecia rótulo no INÍCIO da linha: lia `Reação a sons` e engolia o
 * resto dentro do valor dele. `sensorial.toques` = "não gosta de abraço" estava
 * no banco e era invisível.
 *
 * ⚠️ E ISSO PRODUZIU DOIS LEITORES DISCORDANDO NO MESMO TURNO. O Core recebe o
 * TEXTO BRUTO do domínio e enxergava; o Gate B recebe os CAMPOS PARSEADOS e não.
 * A Ayla orientou "mantenha-se por perto sem tocar nela" — coerente com o que a
 * família contou — enquanto o Gate B elegia `sensorial.toques` como "a lacuna
 * decisiva". Não era um dado mal gravado: era uma representação só, lida de
 * duas formas.
 *
 * ⚠️ E A CORRUPÇÃO SE REESCREVIA: `aplicarTextoCampo` faz parse → serializa.
 * Com o parse perdendo rótulos, cada incorporação regravava o bloco colado.
 * Por isso a correção é de LEITURA — ela faz a próxima escrita normalizar o
 * dado sozinha, sem ninguém editar o perfil de uma família na mão.
 */

const SENS = subcamposDe("sensorial")!;
const EMO = subcamposDe("emocional")!;

/** O texto REAL de produção, verbatim — é ele que precisa voltar a ser legível. */
const LINHA_REAL =
  "Reação a sons: cobre os ouvidos com barulhos altos — tem sensibilidade significativa a sons e reluta em sair de casa; investigar quais sons específicos causam maior desconforto. Reação a toques: não gosta de abraço. Texturas (roupas, objetos): adora roupa macia. Luz: luz forte e direta incomoda. Cheiros: cheiro de cigarro. Outras observações sensoriais: Detesta baratas — grita ao ver e tem dificuldade para se acalmar depois.";

describe("PEND-189 · o caso real volta a ser legível", () => {
  const v = parsearSubcampos(SENS, LINHA_REAL);

  it("sensorial.toques deixa de ser invisível", () => {
    expect(v.toques).toBe("não gosta de abraço.");
  });

  it("os outros rótulos colados também voltam", () => {
    expect(v.luz).toBe("luz forte e direta incomoda.");
    expect(v.cheiros).toBe("cheiro de cigarro.");
    expect(v.texturas).toBe("adora roupa macia.");
  });

  it("o PRIMEIRO campo para de engolir os outros", () => {
    // Antes, `sons` continha o parágrafo inteiro.
    expect(v.sons).not.toContain("não gosta de abraço");
    expect(v.sons).not.toContain("cheiro de cigarro");
    expect(v.sons).toContain("cobre os ouvidos");
  });

  it("nada foi inventado: o que não está no texto continua vazio", () => {
    // "Perfil sensorial:" não aparece no texto real. Não pode aparecer aqui.
    expect(v.perfil ?? "").toBe("");
  });

  it("e o Gate B deixa de pedir o que a família já contou", () => {
    const p = perfilConsultavelDaLinha({ sensorial: { texto: LINHA_REAL } }, "m1");
    const lacunas = p.lacunasDe("sensorial").map((c) => c.key);
    expect(lacunas, "toques ainda aparece como lacuna").not.toContain("toques");
    expect(lacunas).not.toContain("luz");
    expect(p.sabemos("sensorial", "toques")).toBe(true);
    expect(p.valorDe("sensorial", "toques")).toContain("não gosta de abraço");
  });
});

describe("PEND-189 · os formatos que precisam continuar funcionando", () => {
  it("um por linha — o formato canônico, intocado", () => {
    const texto = serializarSubcampos(SENS, {
      sons: "incomoda com barulho",
      toques: "aceita abraço apertado",
      luz: "sem queixa",
    });
    const v = parsearSubcampos(SENS, texto);
    expect(v.sons).toBe("incomoda com barulho");
    expect(v.toques).toBe("aceita abraço apertado");
    expect(v.luz).toBe("sem queixa");
  });

  it("ida e volta é estável — serializar(parsear(x)) não perde nada", () => {
    const v1 = parsearSubcampos(SENS, LINHA_REAL);
    const v2 = parsearSubcampos(SENS, serializarSubcampos(SENS, v1));
    expect(v2).toEqual(v1);
  });

  it("campos vazios continuam vazios, sem virar string", () => {
    const v = parsearSubcampos(SENS, "Reação a sons: barulho alto");
    expect(v.toques).toBeUndefined();
    expect(v.sons).toBe("barulho alto");
  });

  it("valor com pontuação normal não é partido", () => {
    // Pontos que NÃO precedem um rótulo canônico são só pontuação.
    const texto =
      "Reação a sons: incomoda. Muito. Principalmente à noite. Depois melhora.";
    const v = parsearSubcampos(SENS, texto);
    expect(v.sons).toBe("incomoda. Muito. Principalmente à noite. Depois melhora.");
  });

  it("ponto e vírgula também é limite estrutural válido", () => {
    const v = parsearSubcampos(SENS, "Reação a sons: barulho; Luz: incomoda");
    expect(v.sons).toBe("barulho;");
    expect(v.luz).toBe("incomoda");
  });

  it("texto legado sem rótulo nenhum continua caindo no último campo", () => {
    const v = parsearSubcampos(SENS, "ela é bem sensível a tudo");
    const ultimo = SENS[SENS.length - 1].key;
    expect(v[ultimo]).toBe("ela é bem sensível a tudo");
  });
});

describe("PEND-189 · o que NÃO pode virar rótulo", () => {
  /**
   * ⚠️ O RISCO DA CORREÇÃO É O OPOSTO DO DEFEITO: ler desabafo como campo.
   * Por isso só entram os rótulos CANÔNICOS daquele domínio, e só depois de um
   * limite estrutural. Uma regex ampla (`/(.+?):/`) transformaria "Ontem: ela
   * chorou" em campo — e conhecimento inventado é o pior desfecho possível.
   */
  it("palavra qualquer seguida de dois-pontos NÃO vira campo", () => {
    const texto = "Reação a sons: barulho alto. Ontem: ela chorou muito.";
    const v = parsearSubcampos(SENS, texto);
    expect(v.sons).toBe("barulho alto. Ontem: ela chorou muito.");
    expect(Object.keys(v)).toEqual(["sons"]);
  });

  it("rótulo de OUTRO domínio não é reconhecido aqui", () => {
    // "Gatilhos" é do emocional. Dentro do sensorial, é texto.
    const v = parsearSubcampos(SENS, "Reação a sons: barulho. Gatilhos: insistência.");
    expect(v.sons).toContain("Gatilhos: insistência.");
    expect(Object.keys(v)).toEqual(["sons"]);
  });

  it("rótulo no MEIO de uma oração continua sendo texto", () => {
    // Sem limite estrutural antes dele, não há quebra.
    const v = parsearSubcampos(EMO, "Gatilhos: quando falo de Sinais de que vem vindo: ela ri");
    expect(Object.keys(v)).toEqual(["gatilhos"]);
    expect(v.gatilhos).toContain("Sinais de que vem vindo: ela ri");
  });

  it("o rótulo MAIS LONGO vence o mais curto — o parcial não parte o inteiro", () => {
    // "Luz" é sufixo de nada aqui, mas a ordenação por tamanho é o que impede
    // um rótulo curto de casar dentro de um longo em outros domínios.
    const rotulos = SENS.map((c) => c.label);
    const maisLongoPrimeiro = [...rotulos].sort((a, b) => b.length - a.length);
    expect(maisLongoPrimeiro[0].length).toBeGreaterThanOrEqual(
      maisLongoPrimeiro[maisLongoPrimeiro.length - 1].length,
    );
    const v = parsearSubcampos(SENS, LINHA_REAL);
    // "Reação a sons" e "Reação a toques" compartilham prefixo: nenhum pode
    // engolir o outro nem sobrar um pedaço de rótulo dentro do valor.
    expect(v.sons).not.toContain("Reação a");
    expect(v.toques).not.toContain("Reação a");
  });

  it("domínio sem subcampos não quebra nada", () => {
    expect(parsearSubcampos([], "qualquer texto. Luz: nada")).toEqual({});
  });
});
