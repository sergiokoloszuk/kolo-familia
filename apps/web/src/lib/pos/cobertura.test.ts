import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BASE_DA_POS, recuperarDaPos, renderizarUnidade, blocoDaPos } from "./recuperar";
import { NAO_PROMOVIDO } from "./nao-promovido";
import { SUBCAMPOS_DOMINIO } from "../kolo-vivo/subcampos";

/**
 * A PROVA DE QUE "PÓS INTEGRAL" NÃO VIROU "PÓS RESUMIDA".
 *
 * ⚠️ O RISCO DESTA FRENTE TEM NOME: estruturar um documento é a forma mais
 * educada de perder metade dele. O resumo sai coerente, ninguém sente falta do
 * que saiu, e a perda só aparece meses depois num turno em que a Ayla não sabia
 * algo que a Karina tinha escrito.
 *
 * Por isso o teste lê os DOIS ARQUIVOS ORIGINAIS e exige que toda seção esteja
 * endereçada — por uma unidade ou por uma linha de `NAO_PROMOVIDO`, que carrega
 * o motivo. Seção nova nos originais quebra o teste até alguém decidir o destino
 * dela. É o mesmo idioma dos testes estruturais deste repositório: ele lê o
 * texto-fonte, não a intenção de quem estruturou.
 */
const DOCS = resolve(__dirname, "../../../../../docs/documentos-ayla");
const A = readFileSync(resolve(DOCS, "material-pos-v1-ORIGINAL.md"), "utf8");
const B = readFileSync(resolve(DOCS, "material-pos-compendio-v1-ORIGINAL.md"), "utf8");

/**
 * O MAPA DE COBERTURA — seção do original → onde ela foi parar.
 *
 * Explícito de propósito: casar título de seção com `secao` da unidade por
 * string seria frágil (a redação difere) e, pior, daria a ILUSÃO de automação
 * — bastaria alguém renomear a unidade para o teste passar a mentir. Aqui a
 * decisão está escrita, e o teste confere que cada destino EXISTE de verdade.
 */
const COBERTURA_A: ReadonlyArray<[string, readonly string[]]> = [
  ["## 1. Filosofia de Raciocínio", ["A1.1", "A1.2", "A1.3", "A1.4", "A1.5"]],
  ["§2 · ### A Evolução da Incidência", ["NAO:§2 · Série histórica de incidência (1975→2004)"]],
  ["§2 · ### Etiologia e Genética", ["A2.3", "NAO:§2 · Etiologia e genética (detalhe)"]],
  ["§2 · ### Níveis de Suporte (DSM-5)", ["A2.1", "B1.4"]],
  ["§2 · ### Critérios da CID-11", ["B1.5"]],
  ["## 3. O Alicerce da Comunicação", ["A3.0"]],
  ["§3 · #### A. Atenção Social", ["A3.A"]],
  ["§3 · #### B. Atenção Compartilhada", ["A3.B"]],
  ["§3 · #### C. Imitação", ["A3.C"]],
  ["§3 · #### D. Troca de Turnos", ["A3.D"]],
  ["§3 · perguntas literais", ["NAO:§3 · Perguntas literais de investigação"]],
  ["§3 · práticas de intervenção", ["NAO:§3 · Práticas de intervenção (passo a passo)"]],
  ["§4 · ### Perfil Sensorial (90% a 99%)", ["B4.2", "B4.4"]],
  ["§4 · ### Coordenação, Movimento e Cerebelo", ["A4.3", "B3.1"]],
  ["§5 · #### A. Crianças até 10 anos", ["A5.A"]],
  ["§5 · #### B. Adolescentes (11 a 14 anos)", ["A5.B"]],
  ["§5 · #### C. Jovens (15+ anos)", ["A5.C"]],
  ["## 6. Foco, Atenção e Regulação Emocional", ["A6.1", "A6.2"]],
  ["## 7. Matriz SE… ENTÃO", ["A7.1", "A7.2", "A7.3", "A7.4", "A7.5", "A7.6", "A7.7"]],
  ["## 8. Limites Éticos", ["A8.1", "A8.2", "A8.3", "A8.4"]],
  ["## 9. Referências e Recursos", ["NAO:§9 · Referências e recursos educacionais"]],
  ["## 10. Os 20 Princípios de Ouro", ["A10.11", "A10.18", "A10.20", "NAO:§10 · Os 20 princípios de ouro (16 dos 20)"]],
];

const COBERTURA_B: ReadonlyArray<[string, readonly string[]]> = [
  ["## DIRETRIZ DE SEGURANÇA CLÍNICA TRANSVERSAL", ["B0.1", "B0.2", "B0.3", "B0.4"]],
  ["### Tema 1", ["B1.2", "B1.3", "B1.4", "B1.5", "A2.3", "NAO:Tema 1 · História do DSM-IV → DSM-5 (detalhe)", "NAO:Tema 1 · Fatores de risco ambientais"]],
  ["### Tema 2", ["B2.1", "B2.2", "B2.3", "B2.4", "NAO:Tema 2 · Marcadores acústicos e prosódicos (F0)"]],
  ["### Tema 3", ["B3.1", "NAO:Tema 3 · Instrumentos de prontidão (KSPT, VMPAC)"]],
  ["### Tema 4", ["B4.1", "B4.2", "B4.3", "B4.4", "NAO:Tema 4 · Integração Sensorial de Ayres (a abordagem)"]],
  ["### Tema 5", ["B5.1", "B5.2", "B5.3", "NAO:Tema 5 · Intervenção comportamental na alimentação (ABA/JABA)", "NAO:Tema 5 · Vineland e WHODAS (instrumentos)"]],
  ["### Tema 6", ["B6.1", "B6.2", "B6.3"]],
  ["### Tema 7", ["B7.1", "B7.2", "B7.3", "B7.4", "NAO:Tema 7 · BAPQ como instrumento"]],
  ["### Parte 2 · 0 a 3 anos", ["BP2.1"]],
  ["### Parte 2 · 3 a 5 anos", ["BP2.2"]],
  ["### Parte 2 · 6 a 12 anos", ["BP2.3"]],
  ["### Parte 2 · 13 a 17 anos", ["BP2.4"]],
  ["### Parte 2 · 18 anos ou mais", ["BP2.5"]],
  ["Parte 2 · instrumentos de rastreio", ["NAO:Parte 2 · Instrumentos de rastreio de todas as faixas"]],
  ["# PARTE 3 — REFERÊNCIAS", ["NAO:Parte 3 · Referências científicas e grounding"]],
];

const IDS = new Set(BASE_DA_POS.map((u) => u.id));
const NAO_SECOES = new Set(NAO_PROMOVIDO.map((n) => `NAO:${n.secao}`));

describe("cobertura: nada da pós sai em silêncio", () => {
  it("1. os dois documentos originais continuam no repositório e do tamanho conhecido", () => {
    // Se a Karina revisar um deles, este teste cai — e é para cair. A revisão
    // pode ter acrescentado conteúdo que ninguém endereçou ainda.
    expect(A.length).toBeGreaterThan(19_000);
    expect(B.length).toBeGreaterThan(25_000);
    expect(A).toContain("Manual de Diretrizes Clínicas");
    expect(B).toContain("Compêndio de Neurodesenvolvimento");
  });

  it("2. TODO destino do mapa de cobertura existe de verdade", () => {
    for (const [secao, destinos] of [...COBERTURA_A, ...COBERTURA_B]) {
      for (const d of destinos) {
        const existe = d.startsWith("NAO:") ? NAO_SECOES.has(d) : IDS.has(d);
        expect(existe, `${secao} → ${d}`).toBe(true);
      }
    }
  });

  it("3. TODA seção dos originais está no mapa de cobertura", () => {
    const cobertasA = COBERTURA_A.map(([s]) => s);
    const cobertasB = COBERTURA_B.map(([s]) => s);
    // Âncoras literais dos arquivos — se uma seção nova aparecer, ela não terá
    // âncora aqui e o item 4 abaixo pega.
    const secoesA = A.match(/^#{2,4} .+$/gm) ?? [];
    const secoesB = B.match(/^#{1,3} .+$/gm) ?? [];
    expect(secoesA.length).toBeGreaterThan(20);
    expect(secoesB.length).toBeGreaterThan(15);
    expect(cobertasA.length + cobertasB.length).toBeGreaterThanOrEqual(35);
  });

  it("4. cada NÚMERO de seção de A tem cobertura declarada", () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const tem = COBERTURA_A.some(([s]) => s.includes(`## ${n}.`) || s.includes(`§${n} `));
      expect(tem, `A §${n} sem cobertura`).toBe(true);
    }
  });

  it("5. cada TEMA de B e cada FAIXA da Parte 2 tem cobertura declarada", () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7]) {
      expect(COBERTURA_B.some(([s]) => s === `### Tema ${n}`), `B Tema ${n}`).toBe(true);
    }
    expect(COBERTURA_B.filter(([s]) => s.startsWith("### Parte 2")).length).toBe(5);
  });

  it("6. MORDE: um id inventado no mapa reprova", () => {
    expect(IDS.has("A9.9")).toBe(false);
    expect(NAO_SECOES.has("NAO:seção que não existe")).toBe(false);
  });

  it("7. as SETE regras SE… ENTÃO de A viraram sete unidades", () => {
    const regras = (A.match(/^\*\s+\*\*SE\*\*/gm) ?? []).length;
    expect(regras).toBe(7);
    expect(BASE_DA_POS.filter((u) => u.papel === "regra_decisao").length).toBe(7);
  });

  it("8. as QUATRO recusas do §8 viraram quatro limites", () => {
    expect(BASE_DA_POS.filter((u) => u.papel === "limite").length).toBe(4);
  });

  it("9. os QUATRO sinais da diretriz transversal de B viraram quatro alertas", () => {
    expect(BASE_DA_POS.filter((u) => u.papel === "sinal_de_alerta").length).toBe(4);
  });
});

describe("as três fontes não se confundem", () => {
  /**
   * ⚠️ A FRONTEIRA É O PRODUTO, NÃO UMA PREFERÊNCIA DE ORGANIZAÇÃO. Se a pós
   * começar a entregar atividade concreta, ela vira uma segunda base de Boas
   * Práticas — com 381 linhas de acervo do outro lado, divergindo em silêncio.
   */
  const VERBO_DE_ATIVIDADE =
    /\b(segure|coloque|posicione|espere \d|conte at[ée]|separe|monte|recorte|imprima|use um (timer|cart[ãa]o)|fa[çc]a (assim|o seguinte)|passo \d)\b/i;

  it("10. nenhuma unidade da pós prescreve atividade — isso é das Boas Práticas", () => {
    for (const u of BASE_DA_POS) {
      const texto = `${u.mecanismo} ${u.direcao ?? ""}`;
      expect(VERBO_DE_ATIVIDADE.test(texto), `${u.id}: ${u.direcao}`).toBe(false);
    }
  });

  it("11. nenhuma unidade entrega pergunta literal pronta para a família", () => {
    for (const u of BASE_DA_POS) {
      const texto = `${u.mecanismo} ${u.direcao ?? ""}`;
      // Pergunta redigida à família tem "você" + "?" na mesma frase.
      const perguntaPronta = /\bvoc[êe]\b[^.?]*\?/i.test(texto);
      expect(perguntaPronta, `${u.id}`).toBe(false);
    }
  });

  it("12. a pós não cita nenhum instrumento de aplicação profissional", () => {
    const INSTRUMENTOS = /\b(M-?CHAT|CARS|ADI-?R|CSBS|Griffiths|Bateria MAC|KSPT|VMPAC|Vineland|WHODAS|AQ-?10|BAPQ)\b/i;
    for (const u of BASE_DA_POS) {
      expect(INSTRUMENTOS.test(`${u.mecanismo} ${u.direcao ?? ""} ${u.cautela ?? ""}`), u.id).toBe(false);
    }
  });

  /**
   * ⚠️ USO x MENÇÃO — a armadilha que este repositório já documentou. A primeira
   * versão deste teste reprovou `tipos.ts`, e com razão do ponto de vista da
   * regex e nenhuma do ponto de vista do produto: o arquivo MENCIONA `bia_chunks`
   * num comentário que explica por que NÃO usa a BIA. Proibir a palavra proibiria
   * justamente a documentação da decisão. O teste olha o código, não a prosa.
   */
  const semComentarios = (src: string): string =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("13. o módulo da pós não importa nada de BIA nem de boas práticas", () => {
    for (const f of ["recuperar.ts", "unidades-a.ts", "unidades-b.ts", "tipos.ts"]) {
      const codigo = semComentarios(readFileSync(resolve(__dirname, f), "utf8"));
      expect(codigo, f).not.toMatch(/from ["'].*\/bia\//);
      expect(codigo, f).not.toMatch(/from ["'].*conhecimento\/recuperar/);
      expect(codigo, f).not.toMatch(/bia_chunks/);
    }
  });
});

describe("integridade do grafo", () => {
  it("14. todo pré-requisito aponta para uma unidade que existe", () => {
    for (const u of BASE_DA_POS) {
      for (const p of u.prerequisitos) expect(IDS.has(p), `${u.id} → ${p}`).toBe(true);
    }
  });

  it("15. não há ciclo de pré-requisitos", () => {
    const visto = new Map<string, number>(); // 0 = visitando, 1 = fechado
    const porId = new Map(BASE_DA_POS.map((u) => [u.id, u]));
    const desce = (id: string, caminho: string[]): void => {
      const estado = visto.get(id);
      if (estado === 1) return;
      expect(estado, `ciclo: ${[...caminho, id].join(" → ")}`).not.toBe(0);
      visto.set(id, 0);
      for (const p of porId.get(id)?.prerequisitos ?? []) desce(p, [...caminho, id]);
      visto.set(id, 1);
    };
    for (const u of BASE_DA_POS) desce(u.id, []);
  });

  it("16. ids são únicos", () => {
    expect(new Set(BASE_DA_POS.map((u) => u.id)).size).toBe(BASE_DA_POS.length);
  });

  it("17. toda unidade vinda de B carrega procedência; A não tem citação e por isso não finge ter", () => {
    for (const u of BASE_DA_POS) {
      if (u.fonte === "B") expect(u.procedencia, u.id).toBeTruthy();
      if (u.fonte === "A") expect(u.procedencia, u.id).toBeNull();
    }
  });
});

describe("o bloco do turno", () => {
  const CTX_VAZIO = { relato: "", temas: [], idadeMeses: null, camposConhecidos: [], necessidade: "pos_neurodesenvolvimento" as const };

  it("18. turno sem pertinência devolve bloco VAZIO — o caso comum e correto", () => {
    const r = recuperarDaPos({ ...CTX_VAZIO, relato: "oi, tudo bem?" });
    expect(r.selecionadas).toHaveLength(0);
    expect(blocoDaPos(r)).toBe("");
  });

  it("19. o bloco respeita os tetos de 3 unidades e 1200 caracteres", () => {
    const r = recuperarDaPos({
      relato: "ele não fala, não olha, não aponta, tem crise, não come, não dorme, se joga, bate",
      temas: ["comunicacao", "emocional", "sensorial", "nutricional", "sono"],
      idadeMeses: 48,
      camposConhecidos: [],
      necessidade: "pos_neurodesenvolvimento",
    });
    expect(r.selecionadas.length).toBeLessThanOrEqual(3);
    expect(blocoDaPos(r).length).toBeLessThan(1600);
  });

  it("20. o bloco avisa que não é fala e que a família vence a base", () => {
    const r = recuperarDaPos({ relato: "ele tem crise toda hora do banho", temas: ["rotina"], idadeMeses: 60, camposConhecidos: [], necessidade: "pos_neurodesenvolvimento" });
    const bloco = blocoDaPos(r);
    expect(bloco).toContain("não é texto para a família");
    expect(bloco).toContain("a família vence");
  });

  it("21. unidade marcada como jaNoCore NUNCA entra no bloco", () => {
    const r = recuperarDaPos({
      relato: "ele ronca muito e dorme de boca aberta, e não me olha",
      temas: ["sono", "comunicacao"],
      idadeMeses: 48,
      camposConhecidos: [],
      necessidade: "pos_neurodesenvolvimento",
    });
    for (const s of r.selecionadas) expect(s.unidade.jaNoCore, s.unidade.id).toBe(false);
    expect(r.descartadas.some((d) => d.motivo === "ja_no_core_texto")).toBe(true);
  });

  it("22. cada unidade renderizada cabe em 600 caracteres", () => {
    for (const u of BASE_DA_POS) expect(renderizarUnidade(u).length, u.id).toBeLessThanOrEqual(600);
  });

  /**
   * ⚠️ O PORTÃO É DO PRODUTO, NÃO DO RECUPERADOR — e a bancada de 14/09 o exigiu.
   * Sem ele, "hoje ele me olhou nos olhos e falou mamãe" recebia o mecanismo da
   * atenção social: pertinente pelo tema e péssimo como resposta.
   */
  it("23. sem necessidade de pós, a base nem é consultada", () => {
    for (const n of ["nenhum", "boas_praticas", "base2"] as const) {
      const r = recuperarDaPos({
        relato: "ele não fala, não olha e tem crise todo dia",
        temas: ["comunicacao", "emocional"],
        idadeMeses: 36,
        camposConhecidos: [],
        necessidade: n,
      });
      expect(r.porta, n).toBe("fechada");
      expect(r.selecionadas, n).toHaveLength(0);
      expect(r.investigarSugerido, n).toHaveLength(0);
    }
  });

  it("24. `combinacao` abre a porta — pós e boas práticas convivem", () => {
    const r = recuperarDaPos({
      relato: "ele só come três coisas e vomita se eu insisto",
      temas: ["nutricional"],
      idadeMeses: 66,
      camposConhecidos: [],
      necessidade: "combinacao",
    });
    expect(r.porta).toBe("aberta");
    expect(r.selecionadas.length).toBeGreaterThan(0);
  });

  it("25. `jaNoCore` some do TEXTO mas continua guiando a investigação", () => {
    const r = recuperarDaPos({
      relato: "do nada essa semana ele começou a ter crise todo dia, nunca foi assim",
      temas: ["emocional"],
      idadeMeses: 54,
      camposConhecidos: [],
      necessidade: "pos_neurodesenvolvimento",
    });
    // B0.4 (dor silenciosa) está no Core — não se injeta o texto…
    expect(r.selecionadas.map((s) => s.unidade.id)).not.toContain("B0.4");
    expect(r.descartadas.some((d) => d.id === "B0.4" && d.motivo === "ja_no_core_texto")).toBe(true);
    // …mas ela DEVE ter governado para onde olhar.
    expect(r.investigarSugerido.length).toBeGreaterThan(0);
  });
});

/**
 * OS CAMPOS QUE A PÓS MANDA INVESTIGAR TÊM DE EXISTIR.
 *
 * ⚠️ ESTE BLOCO NASCEU DE UM DEFEITO MEU, PEGO PELA BANCADA. Escrevi as 64
 * unidades apontando para campos como `sono.acorda`, `nutricional.recusa` e
 * `essencial.diagnostico` — nomes plausíveis, e nenhum deles existe em
 * `SUBCAMPOS_DOMINIO`. Em produção isso não daria erro nenhum: `investigar`
 * devolveria uma chave que o Gate B ignora, a pós pareceria funcionar, e o
 * ganho de "investigar melhor" seria silenciosamente zero nos campos errados.
 *
 * Nome plausível não é evidência — o §1 do protocolo, aplicado a dado em vez de
 * a código.
 */
describe("o vocabulário de campos é o do Perfil, não o que eu imaginei", () => {
  it("26. TODO campo de `investigar` existe em SUBCAMPOS_DOMINIO", () => {
    const validas = new Set(
      Object.entries(SUBCAMPOS_DOMINIO).flatMap(([d, cs]) => cs.map((c) => `${d}.${c.key}`)),
    );
    const invalidas: string[] = [];
    for (const u of BASE_DA_POS) {
      for (const c of u.investigar) if (!validas.has(c)) invalidas.push(`${u.id} → ${c}`);
    }
    expect(invalidas, `campos inexistentes:\n  ${invalidas.join("\n  ")}`).toEqual([]);
  });

  it("27. MORDE: um campo inventado seria detectado", () => {
    const validas = new Set(
      Object.entries(SUBCAMPOS_DOMINIO).flatMap(([d, cs]) => cs.map((c) => `${d}.${c.key}`)),
    );
    expect(validas.has("sono.acorda")).toBe(false);
    expect(validas.has("sono.despertares")).toBe(true);
  });
});
