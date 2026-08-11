import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * UM CONTEXTO POR PLANO — Fatia 3a de PEND-027 (11/08/2026).
 *
 * ⚠️ O QUE ERA. Cada uma das OITO chamadas do Plano (7 seções práticas +
 * `entender/observar`) refazia por conta própria `loadActiveSkills` +
 * `routeSkillsAI` + `buildContext`. Contado no código: **~80 consultas ao banco
 * e 8 chamadas do roteador por plano**, com o roteador decidindo oito vezes
 * sobre exatamente o mesmo texto.
 *
 * E o custo era o MENOR dos problemas: nada garantia que as oito seções tinham
 * visto o mesmo perfil e o mesmo repertório. Duas seções do mesmo documento
 * podiam raciocinar sobre contextos diferentes — e uma delas, `entender`,
 * roteava para DUAS skills enquanto as outras roteavam para uma.
 *
 * Esta fatia isola a mudança ARQUITETURAL: o contexto passa a ser único, e
 * nenhuma capacidade nova é ligada. A 4A (perfil consultável, BASE 2, ranking,
 * âncora, licença) é a 3b — separada de propósito, para que uma mudança de
 * conteúdo seja atribuível.
 */

const src = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");
const PLANO = src("ia/plano.ts");
const ENGINE = src("ia/engine.ts");

/** O corpo de uma função, para o teste não casar com o resto do arquivo. */
const corpo = (texto: string, assinatura: string) => {
  const i = texto.indexOf(assinatura);
  expect(i, `${assinatura} sumiu`).toBeGreaterThan(-1);
  const j = texto.indexOf("\nexport ", i + 10);
  const k = texto.indexOf("\nasync function ", i + 10);
  const fim = [j, k].filter((x) => x > i).sort((a, b) => a - b)[0];
  return texto.slice(i, fim ?? texto.length);
};

const MULTICALL = corpo(PLANO, "export async function gerarSecoesPlanoMultiCall");
const ENTENDER = corpo(PLANO, "async function gerarEntenderObservar");

describe("o contexto é montado UMA vez por plano", () => {
  it("1. MORDE: o multi-call chama `montarContextoDeSecoes` exatamente uma vez", () => {
    expect(MULTICALL.split("montarContextoDeSecoes(").length - 1).toBe(1);
  });

  it("2. MORDE: nenhuma das oito chamadas remonta contexto por conta própria", () => {
    // Se `buildContext` ou `routeSkillsAI` reaparecerem aqui, voltaram as ~80
    // consultas — e, pior, a possibilidade de duas seções verem coisas
    // diferentes.
    expect(MULTICALL).not.toMatch(/buildContext\(/);
    expect(MULTICALL).not.toMatch(/routeSkillsAI\(/);
    expect(MULTICALL).not.toMatch(/loadActiveSkills\(/);
    expect(ENTENDER).not.toMatch(/buildContext\(/);
    expect(ENTENDER).not.toMatch(/routeSkillsAI\(/);
    expect(ENTENDER).not.toMatch(/loadActiveSkills\(/);
  });

  it("3. MORDE: as seções práticas E o entender/observar recebem o MESMO contexto", () => {
    // Chamar o montador uma vez e passar só para metade das seções seria o
    // mesmo defeito com outra cara.
    expect(MULTICALL).toMatch(/pedido: desafioComLastro,\s*\n\s*contextoPronto,/);
    expect(MULTICALL).toMatch(/gerarEntenderObservar\(\{[\s\S]{0,200}?contextoPronto,/);
    expect(ENTENDER).toMatch(/buildContextBlock\(contextoPronto\.ctx\)/);
  });
});

describe("o resto do produto não muda", () => {
  it("4. MORDE: sem `contextoPronto`, `respondAsOutputType` monta como antes", () => {
    // Os 7 botões de apoio e qualquer outro chamador seguem montando o próprio
    // contexto — para eles cada pedido É independente, e isso é o certo.
    const fn = corpo(ENGINE, "export async function respondAsOutputType");
    expect(fn).toMatch(/if \(params\.contextoPronto\) \{/);
    expect(fn).toMatch(/\} else \{/);
    expect(fn).toMatch(/roteadas = await routeSkillsAI\(pedido, skills, \{ maxSkills: 1 \}\)/);
    expect(fn).toMatch(/ctx = await buildContext\(supabase, \{/);
  });

  it("5. MORDE: o parâmetro é OPCIONAL — nenhum chamador antigo quebra", () => {
    const fn = corpo(ENGINE, "export async function respondAsOutputType");
    expect(fn).toMatch(/contextoPronto\?: \{/);
  });

  it("6. o montador vive no engine, ao lado de quem o consome", () => {
    // Se ele nascesse em `plano.ts`, passariam a existir duas definições de "o
    // contexto de uma seção" — e elas divergiriam no primeiro dia.
    expect(ENGINE).toMatch(/export async function montarContextoDeSecoes/);
    expect(PLANO).toMatch(/montarContextoDeSecoes/);
  });
});

describe("o que a Fatia 3a NÃO liga — a 4A fica para a 3b", () => {
  it("7. MORDE: `relato` continua fora do buildContext do Plano", () => {
    // Passá-lo ligaria perfil consultável, BASE 2 e ranking de uma vez — e aí
    // não daria para saber se uma mudança de conteúdo veio da 4A ou de o
    // contexto ter passado a ser único.
    const fn = corpo(ENGINE, "export async function montarContextoDeSecoes");
    expect(fn).not.toMatch(/\brelato\s*:/);
    const chamadas = PLANO.split("buildContext(").slice(1);
    for (const c of chamadas) {
      const args = c.slice(0, c.indexOf("})"));
      expect(args, "plano.ts passou relato").not.toMatch(/\brelato\s*:/);
    }
  });

  it("8. MORDE: o Plano continua sem importar a inteligência 4A", () => {
    expect(PLANO).not.toMatch(
      /carregarPerfilConsultavel|secoesDe\(|ordenarPorAderencia|ANCORA_PERFIL|LICENCA_GENERATIVA|pilotoQuatroA/,
    );
  });
});

describe("as duas fatias anteriores continuam de pé", () => {
  it("9. MORDE: o objetivo da conversa (Fatia 2) segue alimentando o Plano", () => {
    const acoes = src("../app/(app)/conversar/actions.ts");
    expect(acoes).toMatch(/objetivoDaConversa\(turnos\)/);
    expect(acoes).toMatch(/enquadrarObjetivo\(alvo\)/);
  });

  it("10. MORDE: o aprendizado (Fatia 1) segue chegando às oito seções", () => {
    expect(MULTICALL).toMatch(/carregarAprendizado\(supabase, familyId, membroAtipicoId\)/);
    expect(MULTICALL).toMatch(/\$\{aprendizado\}\\n\$\{SISTEMA_APRENDIZADO\}/);
    // E o lastro é o que vai para o montador do contexto, não o desafio cru —
    // senão o roteador escolheria a skill sem saber o que já falhou.
    expect(MULTICALL).toMatch(/pedido: desafioComLastro,\s*\n\s*\}\);/);
  });

  it("11. MORDE: título e tema seguem saindo do desafio ORIGINAL", () => {
    expect(MULTICALL).toMatch(/analisarDesafio\(desafio\)/);
    expect(MULTICALL).not.toMatch(/analisarDesafio\(desafioComLastro\)/);
  });
});

describe("isolamento entre famílias e crianças", () => {
  it("12. MORDE: o contexto único é montado COM o id da criança e da família", () => {
    // Um contexto compartilhado entre seções não pode virar contexto
    // compartilhado entre crianças: o montador recebe os dois ids e é chamado
    // dentro do escopo de um plano só.
    expect(MULTICALL).toMatch(/montarContextoDeSecoes\(supabase, \{\s*\n\s*familyId,\s*\n\s*membroAtipicoId,/);
    const fn = corpo(ENGINE, "export async function montarContextoDeSecoes");
    expect(fn).toMatch(/familyId: params\.familyId/);
    expect(fn).toMatch(/membroAtipicoId: params\.membroAtipicoId/);
  });
});
