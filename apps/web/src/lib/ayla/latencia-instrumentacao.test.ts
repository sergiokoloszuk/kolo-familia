import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * A INSTRUMENTAÇÃO MENTIA, E CUSTOU UMA CONCLUSÃO ERRADA — 26/08/2026.
 *
 * `msBp` era medido em volta de um `Promise.all` de SEIS operações:
 *
 *     const tBp = Date.now();
 *     const [ctxTurno, core, bps, estadoTrial, evidencias, docTrial] =
 *       await Promise.all([...]);
 *     const msBp = Date.now() - tBp;
 *
 * `Promise.all` resolve quando a MAIS LENTA termina. Então `msBp` respondia
 * "quanto demorou a pior das seis", e não "quanto custou o repertório". Como
 * `msContexto` era medido a partir de `t0` — poucas linhas de código síncrono
 * antes de `tBp` —, os dois davam o mesmo número em **98% dos turnos** (MEDI,
 * 270 turnos de 15 a 26/08). A leitura natural desse dado era "as Boas Práticas
 * dominam o contexto", e ela era FALSA.
 *
 * Uma auditoria inteira concluiu isso a partir do nome da variável. Estes
 * testes existem para que o nome volte a ser verdade — e continue sendo.
 */
const OFICIAL = fs.readFileSync(path.join(__dirname, "experimental.ts"), "utf8");

describe("a instrumentação diz a verdade sobre onde o tempo foi", () => {
  it("1. MORDE: `msBp` vem da marca da BP, NÃO do relógio em volta do Promise.all", () => {
    expect(OFICIAL).toMatch(/const msBp = marcas\.bp \?\? 0;/);
    // O padrão antigo não pode voltar.
    expect(OFICIAL).not.toMatch(/const msBp = Date\.now\(\) - tBp;/);
  });

  it("2. o bloco paralelo continua medido — com o nome certo", () => {
    expect(OFICIAL).toMatch(/const msParalelo = Date\.now\(\) - tBp;/);
  });

  it("3. MORDE: cada operação do bloco tem cronômetro próprio", () => {
    // Tolerante à quebra de linha do formatador: prender a formatação faria o
    // teste falhar por prettier, e não por perda de instrumentação.
    const semEspaco = OFICIAL.replace(/\s+/g, "");
    for (const nome of ["ctx", "core", "bp", "trial_estado", "trial_evid", "trial_doc"]) {
      expect(semEspaco).toContain(`cron("${nome}"`);
    }
  });

  it("4. `cron` preserva valor E erro — instrumentar não pode engolir falha", () => {
    const i = OFICIAL.indexOf("const cron = <T,>(nome: string, pr: Promise<T>)");
    expect(i).toBeGreaterThan(0);
    const corpo = OFICIAL.slice(i, i + 600);
    // Os dois ramos do `then`: sucesso devolve, falha relança.
    expect(corpo).toMatch(/return v;/);
    expect(corpo).toMatch(/throw e;/);
    // Nada de `.catch(() => 0)` mascarando erro para poder medir.
    expect(corpo).not.toMatch(/catch\s*\(\s*\)\s*=>/);
  });

  it("5. as TRÊS ondas sequenciais de montarContexto são medidas separadamente", () => {
    expect(OFICIAL).toMatch(/const msOnda1 = Date\.now\(\) - tOnda1;/);
    expect(OFICIAL).toMatch(/const msFoco = Date\.now\(\) - tFoco;/);
    expect(OFICIAL).toMatch(/const msOnda3 = Date\.now\(\) - tOnda3;/);
    expect(OFICIAL).toMatch(/msOndas: \{ onda1: msOnda1, foco: msFoco, onda3: msOnda3 \}/);
  });

  it("6. as marcas chegam à métrica do turno — senão não viram número em produção", () => {
    for (const campo of ["msParalelo", "msCtx", "msCore", "msTrial", "msOnda1", "msFoco", "msOnda3"]) {
      expect(OFICIAL).toContain(`${campo}`);
    }
  });

  it("7. MORDE: `msContexto` segue medindo de `t0` — é o que compara com o baseline de 527 ms", () => {
    expect(OFICIAL).toMatch(/const msContexto = Date\.now\(\) - t0;/);
  });

  it("8. MORDE: instrumentar não acrescentou chamada de modelo nem consulta", () => {
    // `cron` é síncrono em volta de promessas que já existiam. Se alguém
    // acrescentar um await de I/O aqui, o custo de medir passa a ser medido.
    const i = OFICIAL.indexOf("const marcas: Record<string, number> = {};");
    const j = OFICIAL.indexOf("const tBp = Date.now();", i);
    const entre = OFICIAL.slice(i, j);
    expect(entre).not.toMatch(/await |supabase\.from|gerarConversacional/);
  });
});
