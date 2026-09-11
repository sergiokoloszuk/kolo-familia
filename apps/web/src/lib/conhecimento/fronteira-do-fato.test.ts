import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A FRONTEIRA ENTRE CONTEXTO E FATO — PEND-200.
 *
 * ── o defeito que este arquivo prende ─────────────────────────────────────
 *
 * Na bancada de 12 turnos com a criança de QA (11/09/2026, SHA `03b91fe`), a
 * sombra concatenava os 6 turnos anteriores da FAMÍLIA dentro do mesmo bloco
 * que a fala de agora. O resultado, medido:
 *
 *   - 19 dos 31 itens emitidos eram repetição da janela;
 *   - 5 dos 11 fatos novos não saíram;
 *   - um desabafo puro produziu 3 fatos;
 *   - e, no pior caso, DOIS FATOS DA MANU saíram dentro de um turno do Pedro,
 *     carimbados com o `membro_atipico_id` do Pedro.
 *
 * ── por que os testes são assim ───────────────────────────────────────────
 *
 * O modelo é falso e as guardas são de verdade, como no resto deste diretório.
 * O que se prova aqui não é que o modelo se comporta bem — isso se mede em
 * produção, e é o que a bancada faz. O que se prova é que, QUANDO o modelo
 * traz um fato que só existe no histórico, o código o RECUSA. A separação de
 * blocos orienta; a âncora de `modo: "estrito"` é quem impede.
 *
 * ⚠️ Nenhum teste aqui usa lista de frases proibidas, nome de criança ou
 * domínio específico. O que se testa é a PROVENIÊNCIA: a citação está, ou não
 * está, na fala do turno.
 */

const respostaDoModelo = { valor: "" };
vi.mock("@/lib/ia/anthropic", () => ({
  MODELS: { principal: "claude-sonnet-4-6", leve: "claude-haiku-4-5" },
  getAnthropicClient: () => ({
    messages: {
      stream: () => ({
        finalMessage: async () => ({
          content: [{ type: "text", text: respostaDoModelo.valor }],
          usage: { input_tokens: 10, output_tokens: 10 },
        }),
      }),
    },
  }),
}));
vi.mock("@/lib/billing/logar", () => ({ logarUsoApi: async () => {} }));

const { extrairAtualizacoes } = await import("./extrair");

const MEMBRO = { nome: "Pedro", idade: 7, perfil: "TEA" };

/** O histórico real que vazou em produção, palavra por palavra. */
const HISTORICO_DA_IRMA = [
  "Responsável: ela fica isolada e tira cabelo",
  "Kolo: Karina, quando a Manu se isola e puxa o cabelo, fique por perto e fale pouco",
  "Responsável: às vezes ela aponta, mas muitas vezes ela pega na minha mão e me leva até o que quer",
].join("\n\n");

type Item = {
  camada: string;
  campo: string;
  subcampo?: string | null;
  texto: string;
  operacao: string;
  citacao?: string | null;
  inferido?: boolean;
};

/** Roda o extrator com a fronteira montada como a sombra a monta. */
function rodar(entrada: string, itens: Item[], contexto = HISTORICO_DA_IRMA) {
  respostaDoModelo.valor = JSON.stringify({
    kolo_vivo: itens,
    conquista: null,
    desafio: null,
  });
  return extrairAtualizacoes({
    transcript: `Responsável: ${entrada}`,
    contextoRecente: contexto,
    koloVivoResumo: "",
    membro: MEMBRO,
    supabase: {} as never,
    familyId: "fam-1",
    via: "whatsapp_texto",
    entradaNormalizada: entrada,
    modo: "estrito",
    em: "2026-09-11T19:00:00.000Z",
  });
}

const chaves = (r: { koloVivo: Array<{ campo: string; subcampo?: string | null }> }) =>
  r.koloVivo.map((i) => `${i.campo}.${i.subcampo ?? "(sem)"}`);

beforeEach(() => {
  respostaDoModelo.valor = "";
});

// ─────────────────────────────────────────────────────────────────────────────
describe("T1 · o fato do irmão não sai", () => {
  it("os DOIS fatos da Manu que vazaram em produção são recusados", async () => {
    // Exatamente o que a sombra emitiu no turno 1 da bancada, com as citações
    // honestas: elas existem — só que no histórico, não na fala de agora.
    const r = await rodar("Pedro tem 7 anos troca letras ao falar", [
      {
        camada: "camada1",
        campo: "emocional",
        subcampo: "manifesta",
        texto: "Isola-se e arranca o cabelo",
        operacao: "adicionar",
        citacao: "ela fica isolada e tira cabelo",
      },
      {
        camada: "camada1",
        campo: "comunicacao",
        subcampo: "mostra",
        texto: "Leva pela mão até o que quer",
        operacao: "adicionar",
        citacao: "pega na minha mão e me leva até o que quer",
      },
    ]);
    expect(r.koloVivo).toHaveLength(0);
    expect(r.rejeitados.map((x) => x.motivo)).toEqual([
      "citacao_nao_comprovada",
      "citacao_nao_comprovada",
    ]);
  });

  it("e o fato do turno sai no MESMO lote — recusar o alheio não pode calar o próprio", async () => {
    // Caso I do §12: quase toda correção que suprime, suprime demais.
    const r = await rodar("Pedro tem 7 anos troca letras ao falar", [
      {
        camada: "camada1",
        campo: "emocional",
        subcampo: "manifesta",
        texto: "Isola-se e arranca o cabelo",
        operacao: "adicionar",
        citacao: "ela fica isolada e tira cabelo",
      },
      {
        camada: "camada1",
        campo: "comunicacao",
        subcampo: "vocabulario",
        texto: "Troca letras ao falar",
        operacao: "adicionar",
        citacao: "troca letras ao falar",
      },
    ]);
    expect(chaves(r)).toEqual(["comunicacao.vocabulario"]);
    expect(r.rejeitados).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("T2 · o fato simples do turno sai", () => {
  it("acorda duas vezes por noite vira sono, ancorado na fala", async () => {
    const r = await rodar("Pedro acorda duas vezes por noite e demora para voltar a dormir", [
      {
        camada: "camada1",
        campo: "sono",
        subcampo: "despertares",
        texto: "Acorda duas vezes por noite",
        operacao: "adicionar",
        citacao: "acorda duas vezes por noite",
      },
    ]);
    expect(chaves(r)).toEqual(["sono.despertares"]);
    expect(r.rejeitados).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("T3 e T4 · multi-fato e multi-domínio sobrevivem à correção", () => {
  /**
   * ⚠️ ESTA É A VANTAGEM QUE A PEND-194 QUER. Na bancada, este foi o único
   * turno em que a sombra ganhou do caminho atual: ela separou alimentação e
   * imitação em dois domínios, onde o atual gravou `nutricional` com a
   * imitação diluída na prosa. Se a correção da fronteira matasse isto, ela
   * teria trocado um defeito por outro.
   */
  const FALA = "Pedro só come arroz, macarrão e pão. Não aceita molho. E imita bastante o que eu faço";

  it("quatro fatos, dois domínios, todos ancorados — nenhum é perdido", async () => {
    const r = await rodar(FALA, [
      { camada: "camada1", campo: "nutricional", subcampo: "aceita", texto: "arroz, macarrão e pão", operacao: "adicionar", citacao: "só come arroz, macarrão e pão" },
      { camada: "camada1", campo: "nutricional", subcampo: "rejeita", texto: "molho", operacao: "adicionar", citacao: "não aceita molho" },
      { camada: "camada1", campo: "imitacao", subcampo: "padrao", texto: "Imita bastante", operacao: "adicionar", citacao: "imita bastante o que eu faço" },
      { camada: "camada1", campo: "imitacao", subcampo: "o_que", texto: "o que a mãe faz", operacao: "adicionar", citacao: "o que eu faço" },
    ]);
    expect(chaves(r)).toEqual([
      "nutricional.aceita",
      "nutricional.rejeita",
      "imitacao.padrao",
      "imitacao.o_que",
    ]);
    expect(r.rejeitados).toHaveLength(0);
  });

  it("`imitacao.padrao` não é engolido pelo domínio vizinho", async () => {
    const r = await rodar(FALA, [
      { camada: "camada1", campo: "imitacao", subcampo: "padrao", texto: "Imita bastante", operacao: "adicionar", citacao: "imita bastante" },
    ]);
    expect(chaves(r)).toEqual(["imitacao.padrao"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("T5 · desabafo puro devolve zero", () => {
  it("com histórico RICO atrás, a fala sem fato não produz fato nenhum", async () => {
    // O turno 7 da bancada. O histórico tinha alimentação e imitação; a sombra
    // emitiu três fatos que não estavam na fala. Aqui eles são recusados um a
    // um, por proveniência.
    const r = await rodar(
      "Hoje eu estou exausta, mas não aconteceu nada diferente",
      [
        { camada: "camada1", campo: "imitacao", subcampo: "padrao", texto: "Imita bastante", operacao: "adicionar", citacao: "imita bastante o que eu faço" },
        { camada: "camada1", campo: "nutricional", subcampo: "aceita", texto: "arroz e macarrão", operacao: "adicionar", citacao: "só come arroz, macarrão e pão" },
      ],
      "Responsável: Pedro só come arroz, macarrão e pão\n\nResponsável: Pedro imita bastante o que eu faço",
    );
    expect(r.koloVivo).toHaveLength(0);
    expect(r.rejeitados).toHaveLength(2);
  });

  it("o cansaço da mãe não vira fato da criança por falta de âncora", async () => {
    const r = await rodar("Hoje eu estou exausta, mas não aconteceu nada diferente", [
      { camada: "camada1", campo: "emocional", subcampo: "manifesta", texto: "Criança desregulada", operacao: "adicionar", citacao: null },
    ]);
    expect(r.koloVivo).toHaveLength(0);
    expect(r.rejeitados[0].motivo).toBe("citacao_ausente");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("T6 · fato antigo não reaparece só por estar na janela", () => {
  it("o `sono.despertares` do turno 2 é recusado no turno 4", async () => {
    // Aconteceu duas vezes seguidas na bancada (turnos 4 e 5).
    const r = await rodar(
      "No banho o Pedro grita com o barulho do chuveiro e tapa os ouvidos",
      [
        { camada: "camada1", campo: "sono", subcampo: "despertares", texto: "Acorda duas vezes por noite", operacao: "adicionar", citacao: "acorda duas vezes por noite" },
      ],
      "Responsável: Pedro acorda duas vezes por noite e demora para voltar a dormir",
    );
    expect(r.koloVivo).toHaveLength(0);
    expect(r.rejeitados[0].motivo).toBe("citacao_nao_comprovada");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("T7 · atualização passa, sem ressuscitar o fato antigo junto", () => {
  it("a melhora do banho entra como `reescrever` e o fato velho NÃO volta como novo", async () => {
    const r = await rodar(
      "O banho do Pedro melhorou. Agora ele entra sem chorar quando eu aviso antes",
      [
        { camada: "camada1", campo: "rotina", subcampo: "ancoras", texto: "Aviso prévio antes do banho; entra sem chorar", operacao: "reescrever", citacao: "entra sem chorar quando eu aviso antes" },
        // o antigo, tentando entrar de carona como fato independente
        { camada: "camada1", campo: "sensorial", subcampo: "som", texto: "Grita com o barulho do chuveiro", operacao: "adicionar", citacao: "grita com o barulho do chuveiro" },
      ],
      "Responsável: No banho ele grita com o barulho do chuveiro e tapa os ouvidos",
    );
    expect(chaves(r)).toEqual(["rotina.ancoras"]);
    expect(r.koloVivo[0].operacao).toBe("reescrever");
    expect(r.rejeitados).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("T8 · a classe do Mario", () => {
  it("conversa bem + trava na frustração é capturada no turno em que é dita", async () => {
    // Foi o fato que a sombra perdeu no turno 5 da bancada, e é a classe que
    // originou a PEND-192: perfil que diz "conversa bem" e decisor pedindo
    // contato visual.
    const r = await rodar(
      "O Pedro conversa bem quando está calmo, mas quando fica nervoso trava e não consegue explicar o que quer",
      [
        { camada: "camada1", campo: "comunicacao", subcampo: "conversa", texto: "Conversa bem quando calmo", operacao: "adicionar", citacao: "conversa bem quando está calmo" },
        { camada: "camada1", campo: "emocional", subcampo: "manifesta", texto: "Trava e não explica quando nervoso", operacao: "adicionar", citacao: "quando fica nervoso trava" },
      ],
    );
    expect(chaves(r)).toEqual(["comunicacao.conversa", "emocional.manifesta"]);
    expect(r.rejeitados).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("T9 · o seletor de forma", () => {
  it("`comunicacao.forma` sobrevive com o valor do seletor fechado", async () => {
    // O caso que a bancada anterior NÃO chegou a exercer: a mensagem enviada
    // omitiu "fala frases". Aqui ele está explícito.
    const r = await rodar("O Pedro fala frases, mas troca algumas letras", [
      { camada: "camada1", campo: "comunicacao", subcampo: "forma", texto: "Fala frases", operacao: "adicionar", citacao: "fala frases" },
      { camada: "camada1", campo: "comunicacao", subcampo: "vocabulario", texto: "Troca algumas letras", operacao: "adicionar", citacao: "troca algumas letras" },
    ]);
    expect(chaves(r)).toEqual(["comunicacao.forma", "comunicacao.vocabulario"]);
    expect(r.koloVivo[0].texto).toBe("Fala frases");
    expect(r.rejeitados).toHaveLength(0);
  });

  /**
   * ⚠️ ESTE TESTE NASCEU DE UM ERRO MEU, e o que ele prende vale mais do que o
   * erro. `comunicacao.forma` é SELETOR FECHADO — `["Fala frases", "Fala
   * palavras soltas", "Não-verbal"]`. Escrevi "Frases" na primeira versão e a
   * guarda recusou, corretamente. Para a bancada isso significa que "estruturou
   * certo" em `forma` não é acertar o sub-campo: é devolver o VALOR do seletor.
   */
  it("valor fora do vocabulário fechado é recusado, mesmo bem ancorado", async () => {
    const r = await rodar("O Pedro fala frases, mas troca algumas letras", [
      { camada: "camada1", campo: "comunicacao", subcampo: "forma", texto: "Frases", operacao: "adicionar", citacao: "fala frases" },
    ]);
    expect(r.koloVivo).toHaveLength(0);
    expect(r.rejeitados).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("T10 · foco não é sono nem autonomia", () => {
  it("o fato do turno sai em foco e o histórico de sono/autonomia é recusado", async () => {
    // Turno 12 da bancada: a sombra devolveu `autonomia.sozinha` e
    // `sono.outras`, e perdeu o fato que estava na frente dela.
    const r = await rodar(
      "O Pedro levanta toda hora na lição, mesmo quando está tudo silencioso",
      [
        { camada: "camada1", campo: "autonomia", subcampo: "sozinha", texto: "Faz xixi no vaso sozinho", operacao: "adicionar", citacao: "faz xixi no vaso sozinho" },
        { camada: "camada1", campo: "foco", subcampo: "sustenta", texto: "Levanta toda hora na lição", operacao: "adicionar", citacao: "levanta toda hora na lição" },
      ],
      "Responsável: Pedro fez xixi no vaso sozinho pela primeira vez",
    );
    expect(chaves(r)).toEqual(["foco.sustenta"]);
    expect(r.rejeitados[0].motivo).toBe("citacao_nao_comprovada");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("T11 · sabotagem — devolver o histórico à fonte extraível", () => {
  /**
   * ⚠️ DUAS CAMADAS, E O TESTE COBRE AS DUAS. Se alguém voltar a concatenar o
   * histórico dentro de `transcript`, a âncora AINDA recusa o fato alheio — é
   * defesa em profundidade, e é de propósito. Por isso este teste não se
   * contenta com o resultado: ele lê a fonte e prende a fronteira.
   */
  it("mesmo com o histórico na fonte, o fato do irmão continua recusado", async () => {
    respostaDoModelo.valor = JSON.stringify({
      kolo_vivo: [
        { camada: "camada1", campo: "emocional", subcampo: "manifesta", texto: "Isola-se e arranca o cabelo", operacao: "adicionar", citacao: "ela fica isolada e tira cabelo" },
      ],
      conquista: null,
      desafio: null,
    });
    const r = await extrairAtualizacoes({
      // a sabotagem: histórico de volta dentro do transcript
      transcript: `${HISTORICO_DA_IRMA}\n\nResponsável: Pedro tem 7 anos`,
      koloVivoResumo: "",
      membro: MEMBRO,
      supabase: {} as never,
      familyId: "fam-1",
      via: "whatsapp_texto",
      entradaNormalizada: "Pedro tem 7 anos",
      modo: "estrito",
    });
    expect(r.koloVivo).toHaveLength(0);
  });

  it("a sombra NÃO concatena histórico na fonte extraível", () => {
    const src = readFileSync(resolve(__dirname, "../ayla/extrator-sombra.ts"), "utf8");
    // A INSTRUÇÃO do transcript, isolada — do `const` até o `;` da linha.
    const i = src.indexOf("const transcript");
    const instrucao = src.slice(i, src.indexOf("\n", i));
    expect(instrucao).toMatch(/const transcript = `Responsável: \$\{t\.entrada\}`/);
    // ⚠️ O HISTÓRICO NÃO PODE ENTRAR AQUI. Foi exatamente a concatenação nesta
    // linha que produziu o vazamento Manu → Pedro.
    expect(instrucao).not.toMatch(/historico/);
    // E ele continua indo — em variável própria, como contexto.
    const bloco = src.slice(i, src.indexOf("return extrairAtualizacoes({"));
    expect(bloco).toMatch(/const contextoRecente = t\.historico/);
  });

  it("a âncora estrita está LIGADA na sombra — sem ela a fronteira é só um pedido", () => {
    const src = readFileSync(resolve(__dirname, "../ayla/extrator-sombra.ts"), "utf8");
    const chamada = src.slice(src.indexOf("extrairAtualizacoes({", src.indexOf("export async function extrairDoTurno(")));
    expect(chamada).toMatch(/modo: "estrito"/);
    expect(chamada).toMatch(/entradaNormalizada: t\.entrada/);
  });

  it("a WEB continua em `compativel` — a mudança não atravessou para a família", () => {
    for (const rel of ["../../app/(app)/conversar/actions.ts", "../../app/(app)/registrar/diario/actions.ts"]) {
      const src = readFileSync(resolve(__dirname, rel), "utf8");
      const chamada = src.slice(src.indexOf("extrairAtualizacoes({"));
      expect(chamada).not.toMatch(/modo: "estrito"/);
      expect(chamada).not.toMatch(/contextoRecente/);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("o bloco de contexto só existe para quem o pede", () => {
  it("sem `contextoRecente`, o prompt não ganha bloco nenhum", async () => {
    // Prova de que os dois caminhos da web não mudaram de prompt. Sem o
    // parâmetro, nenhum `<contexto_anterior>` é renderizado — e o teste morde
    // se alguém passar a renderizá-lo sempre.
    const src = readFileSync(resolve(__dirname, "./extrair.ts"), "utf8");
    expect(src).toMatch(/const blocoContexto = \(contextoRecente \?\? ""\)\.trim\(\)/);
    expect(src).toMatch(/: "";/);
    expect(src).toMatch(/\$\{blocoContexto\}<conversa>/);
  });
});
