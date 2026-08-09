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

  it("4b. a âncora manda USAR o que já sabemos, não só evitar reperguntar", () => {
    // Medido em 09/08/2026: no caso "bate na irmã" o Perfil trazia os sinais
    // precoces e a resposta os ignorou em 4 de 5 rodadas. A âncora era só
    // negativa — proibia reperguntar e nunca mandava construir a pergunta EM
    // CIMA do que já se sabe. Investigar não é começar do zero.
    expect(ANCORA_PERFIL).toMatch(/MESMO QUANDO VOCÊ AINDA ESTIVER INVESTIGANDO/);
    expect(ANCORA_PERFIL).toMatch(/Investigar não é começar do zero/);
    expect(ANCORA_PERFIL).toMatch(/A mesma pergunta, ancorada, vale muito mais/);
  });

  it("4c. MORDE: a defesa contra invenção é ESTRUTURAL, não uma lista de frases", () => {
    // A versão anterior proibia "o cérebro dela está dizendo…" citando a frase
    // exata — e o modelo produziu três variantes assim mesmo. Lista de frases
    // proibidas não escala: existe uma infinidade de maneiras de dizer o mesmo.
    //
    // A regra que substituiu é sobre QUEM É O SUJEITO da oração: o cérebro não
    // pode ser sujeito de verbo de intenção. Isso cobre as variantes que ainda
    // não foram escritas.
    expect(LICENCA_GENERATIVA).toMatch(/REGRA DE SUJEITO/);
    expect(LICENCA_GENERATIVA).toMatch(/quem faz as coisas é A CRIANÇA ou A SITUAÇÃO/i);
    for (const verbo of ["diz", "quer", "decide", "pede", "entende", "manda", "acha"]) {
      expect(LICENCA_GENERATIVA, `o verbo "${verbo}" saiu da regra`).toMatch(
        new RegExp(`não ${verbo}\\b`),
      );
    }
  });

  it("4d. os três registros legítimos continuam permitidos — e nomeados", () => {
    // A correção não pode empobrecer a Ayla. Conhecimento geral hedgeado,
    // hipótese marcada e analogia anunciada seguem valendo; o que sai é o
    // quarto registro, a atribuição inventada.
    expect(LICENCA_GENERATIVA).toMatch(/conhecimento geral, hedgeado/);
    expect(LICENCA_GENERATIVA).toMatch(/hipótese sobre ESTA criança, marcada como hipótese/);
    expect(LICENCA_GENERATIVA).toMatch(/analogia que se anuncia como analogia/);
    expect(LICENCA_GENERATIVA).toMatch(/copo quase cheio/);
  });

  it("5. MORDE: a cláusula anti-invenção não pode sumir — foi ela que falhou", () => {
    // Caso real da bancada: com licença e sem repertório aderente, o modelo
    // escreveu "o cérebro dela está dizendo…". O exemplo ficou no texto de
    // propósito, porque proibição abstrata não pegou.
    expect(LICENCA_GENERATIVA).toMatch(/VOCÊ CRIA A FORMA, NÃO O FATO/);
    expect(LICENCA_GENERATIVA).toMatch(/o cérebro dela está dizendo/);
    expect(LICENCA_GENERATIVA).toMatch(/nunca o cérebro/);
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
