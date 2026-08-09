import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { nucleoConducao } from "./diretrizes";
import {
  ANCORA_PERFIL,
  LICENCA_GENERATIVA,
  montarContexto,
} from "./composicao";

describe("âncora do Perfil", () => {
  it("1. diz o que fazer no conflito, não só que o Perfil importa", () => {
    // A bancada mostrou que "use o Perfil" não basta: sem dizer que ele VENCE,
    // o repertório genérico ganhava.
    expect(ANCORA_PERFIL).toMatch(/precedência/i);
    expect(ANCORA_PERFIL).toMatch(/NÃO descarte/);
    expect(ANCORA_PERFIL).toMatch(/subsidiário/i);
  });

  it("2. a âncora vem COLADA no perfil, antes do repertório", () => {
    const c = montarContexto({ perfil: "PERFIL: Téo, 6 anos", base3: "REPERTORIO X" });
    const iAncora = c.indexOf("O PERFIL É ÂNCORA");
    const iRepertorio = c.indexOf("REPERTORIO X");
    expect(iAncora).toBeGreaterThan(-1);
    expect(iAncora).toBeLessThan(iRepertorio);
  });

  it("3. MORDE: sem perfil, não existe âncora sobrando no contexto", () => {
    const c = montarContexto({ base2: "raciocinio", base3: "repertorio" });
    expect(c).not.toMatch(/O PERFIL É ÂNCORA/);
  });
});

describe("licença generativa", () => {
  it("4. autoriza criar a forma", () => {
    expect(LICENCA_GENERATIVA).toMatch(/LASTRO, NÃO TEXTO PARA COPIAR/);
    expect(LICENCA_GENERATIVA).toMatch(/criar atividade ou brincadeira/i);
    expect(LICENCA_GENERATIVA).toMatch(/ponte para a experiência/i);
  });

  it("5. MORDE: a cláusula anti-invenção não pode sumir — foi ela que falhou", () => {
    // Caso real da bancada: com licença e sem repertório aderente, o modelo
    // escreveu "o cérebro dela está dizendo…". O exemplo ficou no texto de
    // propósito, porque proibição abstrata não pegou.
    expect(LICENCA_GENERATIVA).toMatch(/VOCÊ CRIA A FORMA, NÃO O FATO/);
    expect(LICENCA_GENERATIVA).toMatch(/o cérebro dela está dizendo/);
    expect(LICENCA_GENERATIVA).toMatch(/eficácia garantida/);
    expect(LICENCA_GENERATIVA).toMatch(/característica da criança que ninguém informou/);
  });

  it("6. a dose está escrita — a bancada produziu resposta de 1.261 chars", () => {
    expect(LICENCA_GENERATIVA).toMatch(/DOSE:/);
    expect(LICENCA_GENERATIVA).toMatch(/um ou dois recursos/);
  });

  it("7. MORDE: licença sozinha não entra — só aumentaria a invenção", () => {
    expect(montarContexto({})).toBe("");
    expect(montarContexto({ perfil: null, base2: null, base3: null })).toBe("");
  });
});

describe("o WhatsApp não muda", () => {
  it("8. MORDE: nada disto entrou no núcleo compartilhado", () => {
    // A Fase 3E diz por escrito para não alterar o WhatsApp, e `nucleoConducao`
    // é usado nos dois canais. Se alguém colar a licença lá, este teste cai.
    const n = nucleoConducao();
    expect(n).not.toMatch(/LASTRO, NÃO TEXTO PARA COPIAR/);
    expect(n).not.toMatch(/O PERFIL É ÂNCORA/);
  });

  it("9. na 4A.2 ele ganhou UM consumidor: o prompt da conversa web", () => {
    // Até a 4A.1 este teste guardava a AUSÊNCIA de consumidor — era assim que
    // se provava que a composição existia sem afetar ninguém. A 4A.2 a ligou,
    // e agora ele guarda o oposto, com a mesma severidade: exatamente um
    // consumidor, e é o prompt da web. Se aparecer um segundo, alguém levou a
    // licença para um canal que ninguém mediu.
    const raiz = resolve(__dirname, "../..");
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    const saida = execSync(`git grep -l "conducao/composicao" -- "*.ts" "*.tsx" || true`, {
      cwd: raiz,
      encoding: "utf8",
    });
    const consumidores = saida
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((f) => !f.endsWith(".test.ts"));
    // `git grep` imprime o caminho relativo ao CWD em algumas versões e ao topo
    // do repositório em outras — o que importa é quantos são e qual é.
    expect(consumidores).toHaveLength(1);
    expect(consumidores[0]).toMatch(/lib[\/\\]ia[\/\\]prompt\.ts$/);
  });
});
