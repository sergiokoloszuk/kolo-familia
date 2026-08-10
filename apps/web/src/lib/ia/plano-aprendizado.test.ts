import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * O APRENDIZADO CHEGA AO PLANO NORMAL — Fatia 1 de PEND-027 (10/08/2026).
 *
 * ⚠️ O QUE ESTAVA ERRADO, e é a classe que o protocolo manda caçar:
 * `carregarAprendizado` e `SISTEMA_APRENDIZADO` existiam desde a Fase 4,
 * funcionavam, liam `planos.resultado`/`resultado_nota` e montavam o bloco
 * `<o_que_ja_funcionou>` — mas viviam em `gerarSecoesPlano`, o gerador
 * single-call, que hoje só roda para `variante = "fim_de_semana"`.
 *
 * Todo plano NORMAL passa por `gerarSecoesPlanoMultiCall`, que não chamava
 * nenhum dos dois. A família respondia "não funcionou", o dado era gravado, e
 * o plano seguinte não o via. **Função existe, execução não acontece.**
 *
 * Estes testes leem o código-fonte de propósito: o que se guarda aqui é o
 * CAMINHO (quem chama quem, e com o quê), não o texto que o modelo produz.
 * O comportamento do modelo é medido em bancada, não em teste unitário.
 */

const src = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");
const PLANO = src("ia/plano.ts");

/** O corpo de `gerarSecoesPlanoMultiCall`, isolado do resto do arquivo. */
const MULTICALL = (() => {
  const i = PLANO.indexOf("export async function gerarSecoesPlanoMultiCall");
  expect(i).toBeGreaterThan(-1);
  const j = PLANO.indexOf("\n}", PLANO.indexOf("return {", i));
  return PLANO.slice(i, j > i ? j : PLANO.length);
})();

describe("o aprendizado é carregado UMA vez, no caminho normal", () => {
  it("1. MORDE: o multi-call chama `carregarAprendizado`", () => {
    // Se alguém remover esta chamada, o plano volta a ser cego para o feedback
    // que a própria família registrou.
    expect(MULTICALL).toMatch(/carregarAprendizado\(supabase, familyId, membroAtipicoId\)/);
  });

  it("2. é UMA chamada só, dentro do `Promise.all` que já existia", () => {
    // Uma por seção seriam sete consultas ao banco para o mesmo dado.
    const chamadas = MULTICALL.split("carregarAprendizado(").length - 1;
    expect(chamadas).toBe(1);
    // E ela entra no lote que já rodava — sem custo de ida e volta extra.
    const iPromise = MULTICALL.indexOf("await Promise.all([");
    const iChamada = MULTICALL.indexOf("carregarAprendizado(");
    expect(iChamada).toBeGreaterThan(iPromise);
    expect(iChamada).toBeLessThan(MULTICALL.indexOf("]);", iPromise));
  });

  it("3. REUSA o mecanismo — não nasceu um `carregarAprendizadoPlano`", () => {
    // O risco desta frente inteira é a terceira implementação da mesma coisa.
    expect(PLANO).not.toMatch(/carregarAprendizadoMultiCall|aprendizadoDoPlano|carregarFeedback/);
    // E `carregarAprendizado` continua sendo uma função só no arquivo.
    expect(PLANO.split("async function carregarAprendizado").length - 1).toBe(1);
  });
});

describe("o lastro chega às SETE seções", () => {
  it("4. MORDE: as seções práticas recebem `desafioComLastro`, não o desafio cru", () => {
    // `pedido` é o que vira a mensagem de cada `respondAsOutputType`. Se voltar
    // a ser `desafio`, as cinco seções práticas — que são as que ESCOLHEM
    // estratégia — deixam de saber o que já falhou.
    expect(MULTICALL).toMatch(/pedido: desafioComLastro,/);
    expect(MULTICALL).not.toMatch(/pedido: desafio,/);
  });

  it("5. MORDE: `entender`/`observar` também recebem", () => {
    expect(MULTICALL).toMatch(/gerarEntenderObservar\(\{[^}]*desafio: desafioComLastro/);
  });

  it("6. a REGRA viaja junto com o DADO", () => {
    // Bloco sem instrução é só mais texto: o modelo precisa saber o que fazer
    // com ele. `SISTEMA_APRENDIZADO` vivia no system do single-call, que este
    // caminho não carrega — por isso vai no mesmo string.
    expect(MULTICALL).toMatch(/\$\{aprendizado\}\\n\$\{SISTEMA_APRENDIZADO\}/);
  });
});

describe("sem histórico, nada muda", () => {
  it("7. MORDE: o ternário preserva o comportamento atual byte a byte", () => {
    // `carregarAprendizado` devolve `null` quando não há resultado registrado
    // (ou só `nao_testou`). Aí o desafio tem que sair IDÊNTICO ao de hoje —
    // é o que garante que a família nova não vê diferença nenhuma.
    expect(MULTICALL).toMatch(/const desafioComLastro = aprendizado\s*\n?\s*\?/);
    expect(MULTICALL).toMatch(/:\s*desafio;/);
  });

  it("8. `carregarAprendizado` devolve null sem dado — a fonte da garantia", () => {
    const fn = PLANO.slice(PLANO.indexOf("async function carregarAprendizado"));
    expect(fn).toMatch(/if \(!data \|\| data\.length === 0\) return null;/);
    // "ainda não testou" não é aprendizado: não diz nada sobre o que serve.
    expect(fn).toMatch(/p\.resultado !== "nao_testou"/);
    expect(fn).toMatch(/if \(linhas\.length === 0\) return null;/);
  });
});

describe("a identidade do plano não é contaminada", () => {
  it("9. MORDE: título e tema seguem saindo do desafio ORIGINAL", () => {
    // O lastro é contexto para ESCOLHER as ações, não assunto do plano. Se ele
    // entrar em `analisarDesafio`, o título passa a refletir o feedback antigo
    // — que é exatamente o tipo de troca de identidade que já produziu um PDF
    // chamado "Aguardando a situação específica de Adelly".
    expect(MULTICALL).toMatch(/analisarDesafio\(desafio\)/);
    expect(MULTICALL).not.toMatch(/analisarDesafio\(desafioComLastro\)/);
    expect(MULTICALL).toMatch(/tema: assunto \|\| desafio\.slice\(0, 80\)/);
  });
});

describe("isolamento entre famílias e irmãos", () => {
  it("10. MORDE: a consulta é presa à família E à criança", () => {
    const fn = PLANO.slice(
      PLANO.indexOf("async function carregarAprendizado"),
      PLANO.indexOf("function normalizarSecao"),
    );
    // Sem o filtro de família, o aprendizado de uma casa vazaria para outra.
    expect(fn).toMatch(/\.eq\("family_account_id", familyId\)/);
    // E sem o de membro, o irmão levaria o feedback do irmão — o vetor que a
    // frente de isolamento entre irmãos fechou em 08/2026.
    expect(fn).toMatch(/q\.eq\("membro_atipico_id", membroAtipicoId\)/);
    expect(fn).toMatch(/q\.is\("membro_atipico_id", null\)/);
  });
});

describe("o que esta fatia NÃO tocou", () => {
  it("11. MORDE: continua sem BASE 2, perfil consultável e ranking", () => {
    // PEND-027 tem mais nove achados. Esta fatia é só o P0 — se os outros
    // entrarem junto, ninguém saberá qual mudança produziu qual efeito.
    expect(PLANO).not.toMatch(/carregarPerfilConsultavel|secoesDe\(|pilotoQuatroA/);
    const chamadas = PLANO.split("buildContext(").slice(1);
    for (const c of chamadas) {
      const args = c.slice(0, c.indexOf("})"));
      expect(args, "plano.ts passou relato para buildContext").not.toMatch(/\brelato\s*:/);
    }
  });

  it("12. MORDE: nenhuma mudança de estrutura, guard ou schema", () => {
    expect(PLANO).toMatch(/const MINIMO_PRATICAS = 3;/);
    expect(PLANO).toMatch(/const CONCORRENCIA_SECOES = 3;/);
    expect(PLANO).toMatch(/const TENTATIVAS_POR_SECAO = 3;/);
  });
});
