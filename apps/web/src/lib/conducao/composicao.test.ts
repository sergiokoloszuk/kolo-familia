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

  it("9. os consumidores são EXATAMENTE os dois canais — nenhum a mais", () => {
    // A genealogia deste teste, inteira, porque ela é a história da frente:
    //   4A.1 — guardava a AUSÊNCIA de consumidor. Era assim que se provava que
    //          a composição existia sem afetar ninguém.
    //   4A.2 — passou a exigir UM: o prompt da web. "Se aparecer um segundo,
    //          alguém levou a licença para um canal que ninguém mediu."
    //   10/08 — o segundo canal foi medido e DECIDIDO: o piloto leva a mesma
    //          compreensão ao WhatsApp. Agora são dois, e continuam sendo
    //          exatamente dois. Um terceiro (Plano, Rotina, História) seria
    //          alguém estendendo a licença a um artefato sem medição — e a
    //          PEND-027 diz explicitamente que o Plano não muda nesta missão.
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
    expect(consumidores).toHaveLength(2);
    expect(consumidores.some((f) => /lib[\/\\]ia[\/\\]prompt\.ts$/.test(f))).toBe(true);
    expect(consumidores.some((f) => /lib[\/\\]ayla[\/\\]responder\.ts$/.test(f))).toBe(true);
  });
});

describe("PEND-034 · a semântica do NEGATIVO tem dono, e é a âncora", () => {
  /**
   * ⚠️ O DEFEITO QUE ESTES TESTES PRENDEM (11/08/2026). Em 2 de 3 planos, o
   * perfil dizia `Reação a sons: não` e o documento orientava "menos barulho,
   * menos imprevisibilidade". Rastreado: nem a BASE 2, nem as duas BPs, nem o
   * pedido da mãe carregavam a ideia sonora — e a ÚNICA instrução do bloco
   * ligada a um negativo governava PERGUNTAR ("não pergunte o que está em
   * 'NÃO se aplica'"). Nada dizia o que fazer ao ORIENTAR.
   *
   * Isto aqui é teste de texto, e sabe disso: prende a decisão estrutural de
   * onde a regra mora. Que ela FUNCIONA é a bancada semântica que prova.
   */
  it("2. MORDE: o negativo prevalece sobre o típico do diagnóstico", () => {
    expect(ANCORA_PERFIL).toMatch(/NÃO É O CASO.*(TÍPICO|típico)/i);
    expect(ANCORA_PERFIL).toMatch(/associação típica|exemplo da base|conhecimento geral/i);
  });

  it("3. MORDE: não basta não afirmar — também não orientar", () => {
    // Era exatamente esta a brecha: o plano nunca escreveu "ela é sensível a
    // som", e mesmo assim mandou procurar lugar mais quieto.
    expect(ANCORA_PERFIL).toMatch(/não basta não afirmar/i);
    expect(ANCORA_PERFIL).toMatch(/N[ÃA]O ORIENTE como se fosse verdade/i);
  });

  it("4. MORDE: o negativo NÃO vira veto eterno", () => {
    // O risco do conserto é o oposto do defeito: a Ayla ficar cega a um sinal
    // novo porque o perfil antigo disse que não.
    expect(ANCORA_PERFIL).toMatch(/não fecha o assunto para sempre/i);
    expect(ANCORA_PERFIL).toMatch(/informação nova e específica DESTA criança/i);
    expect(ANCORA_PERFIL).toMatch(/nunca apagando em silêncio/i);
  });

  it("5. MORDE: semelhança com outras crianças não reabre a hipótese", () => {
    expect(ANCORA_PERFIL).toMatch(/comum em crianças de perfil parecido/i);
  });

  it("6. MORDE: a regra vale para os TRÊS canais, por morar num lugar só", () => {
    // Se alguém copiar isto para o Plano ou para o WhatsApp, passam a existir
    // duas redações da mesma semântica — e elas divergem no primeiro dia.
    const src = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");
    for (const arquivo of ["ia/plano.ts", "ia/engine.ts", "ayla/orchestrator.ts"]) {
      expect(src(arquivo), `${arquivo} recriou a regra do negativo`).not.toMatch(
        /NÃO É O CASO.*típico|não basta não afirmar/i,
      );
    }
    // E o texto chega ao Plano pelo mesmo `buildContextBlock` da conversa.
    expect(src("ia/prompt.ts")).toMatch(/ANCORA_PERFIL/);
  });
});
