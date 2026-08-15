import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A CONVERSA DE QA — o que ela precisa fazer, e o que ela NUNCA pode fazer.
 *
 * ⚠️ ESTES TESTES SÃO ESTRUTURAIS, e o limite disso está declarado em cada um.
 * Provar por execução que "a Ayla respeita a correção da Manu no turno 3"
 * exigiria chamar o modelo real — que varia por rodada, custa dinheiro e
 * mediria o MODELO, não o produto. O que se prova aqui é o que é do código:
 * que o histórico CHEGA, que ele chega COMPLETO, e que ele NÃO É GRAVADO.
 *
 * A avaliação de que a Ayla usa bem esse histórico é da Karina, no simulador —
 * e é exatamente para isso que ele passou a ter vários turnos.
 */

const raiz = join(process.cwd(), "src");
const ler = (p: string) => readFileSync(join(raiz, p), "utf8");

const experimental = ler("lib/ayla/experimental.ts");
const actions = ler("app/admin/inteligencia/actions.ts");
const simulador = ler("app/admin/inteligencia/simulador.tsx");

describe("O HISTÓRICO CHEGA — turno 2 vê o turno 1", () => {
  it("1. `montarContexto` recebe os turnos simulados", () => {
    expect(experimental).toMatch(
      /montarContexto\(\s*supabase,\s*params\.familyId,\s*params\.mensagem,\s*params\.turnosSimulados/,
    );
  });

  it("2. os turnos simulados entram no MESMO array do histórico real", () => {
    // Se entrassem num bloco separado, o modelo teria como distinguir teste de
    // conversa — e o teste pararia de testar.
    const trecho = experimental.slice(
      experimental.indexOf("for (const t of simulados)"),
      experimental.indexOf("const SEP ="),
    );
    expect(trecho).toContain("historico.push");
    expect(trecho).toContain("Responsável");
    expect(trecho).toContain("Ayla");
  });

  it("3. entram ANTES do corte dos 10 — senão o turno 1 sumiria no turno 6", () => {
    expect(experimental.indexOf("for (const t of simulados)")).toBeLessThan(
      experimental.indexOf("historico.slice(-10)"),
    );
  });

  it("4. a tela manda a sessão INTEIRA, mãe e Ayla, na ordem", () => {
    const trecho = simulador.slice(
      simulador.indexOf("const anteriores ="),
      simulador.indexOf("const r = await simular"),
    );
    expect(trecho).toContain("turnos.flatMap");
    expect(trecho).toContain('quem: "mae" as const');
    expect(trecho).toContain('quem: "ayla" as const');
    // A ordem importa: a fala da mãe vem antes da resposta que ela provocou.
    expect(trecho.indexOf('"mae"')).toBeLessThan(trecho.indexOf('"ayla"'));
  });

  it("5. o turno novo é ACRESCENTADO, não substitui a conversa", () => {
    expect(simulador).toMatch(/setTurnos\(\(t\) => \[\.\.\.t, \{ mae: texto/);
  });
});

describe("A SESSÃO É ISOLADA — nada da conversa de QA é gravado", () => {
  it("6. o simulador não escreve em tabela nenhuma", () => {
    expect(actions).not.toMatch(/\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
  });

  it("7. o simulador não chama o orquestrador — quem grava e envia é ele", () => {
    expect(actions).not.toContain("orchestrator");
    expect(actions).not.toContain("enviarTexto");
    expect(actions).not.toContain("whatsappSender");
  });

  it("8. os turnos simulados não têm caminho até `ayla_messages`", () => {
    // Prova por ausência de caminho: entre a leitura dos turnos e o fim de
    // `montarContexto` não existe escrita nenhuma.
    const trecho = experimental.slice(
      experimental.indexOf("for (const t of simulados)"),
      experimental.indexOf("return { bloco, foco"),
    );
    expect(trecho).not.toContain(".insert(");
    expect(trecho).not.toContain(".upsert(");
    expect(trecho).not.toContain("ayla_messages");
  });

  it("9. a conversa mora no estado do componente, não no banco", () => {
    expect(simulador).toMatch(/const \[turnos, setTurnos\] = useState/);
    // Nada de persistir em localStorage tampouco: fechar a aba tem de apagar.
    expect(simulador).not.toContain("localStorage");
    expect(simulador).not.toContain("sessionStorage");
  });

  it("10. o turno declara origem `simulador` — o custo não vira custo de família", () => {
    expect(actions).toContain('origem: "simulador"');
  });
});

describe("TROCAR CONTEXTO ZERA — Família A não contamina Família B", () => {
  it("11. `trocarContexto` limpa os turnos", () => {
    const trecho = simulador.slice(
      simulador.indexOf("function trocarContexto"),
      simulador.indexOf("const acumulado"),
    );
    expect(trecho).toContain("setTurnos([])");
  });

  it("12. trocar de FAMÍLIA passa por `trocarContexto`", () => {
    expect(simulador).toMatch(
      /onChange=\{\(e\) => trocarContexto\(\(\) => setFamilia\(e\.target\.value\)\)\}/,
    );
  });

  it("13. trocar de CORE passa por `trocarContexto`", () => {
    expect(simulador).toMatch(
      /onChange=\{\(e\) => trocarContexto\(\(\) => setVersaoId\(e\.target\.value\)\)\}/,
    );
  });

  it("14. o botão Nova conversa existe e usa o mesmo caminho de limpeza", () => {
    const trecho = simulador.slice(simulador.indexOf("Nova conversa") - 260);
    expect(trecho).toContain("trocarContexto");
    expect(trecho).toContain("Nova conversa");
  });

  it("15. SABOTAGEM — um `onChange` direto passaria despercebido?", () => {
    // Se alguém trocar `trocarContexto(() => setFamilia(...))` por
    // `setFamilia(...)`, o teste 12 quebra. Aqui prova-se que não existe NENHUM
    // setter de contexto solto na tela.
    expect(simulador).not.toMatch(/onChange=\{\(e\) => setFamilia\(/);
    expect(simulador).not.toMatch(/onChange=\{\(e\) => setVersaoId\(/);
  });
});

describe("O QUE ESTES TESTES NÃO PROVAM — declarado, não omitido", () => {
  it("16. o comportamento da Ayla no turno 3 é NÃO SEI aqui, e é da tela", () => {
    // Este teste não afirma nada: existe para que a lacuna fique escrita no
    // arquivo, e não só no relatório. "Ela conseguiu falar meu" continuar de
    // onde parou, e "é a Manu, não o Mario" prevalecer, dependem do modelo.
    // O código garante que a informação CHEGA; usá-la bem é o que a Karina vai
    // avaliar no simulador, turno a turno.
    expect(true).toBe(true);
  });
});
