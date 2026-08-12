import { describe, expect, it } from "vitest";
import { abreFluxoDeArtefato, atoSobreArtefato, type AtoSobreArtefato } from "./ato-artefato";

/**
 * O CORPUS ADVERSARIAL — e ele nasceu de dois casos reais de produção.
 *
 * ⚠️ Cada linha declara o ato ESPERADO antes de rodar. É o que impede a régua
 * de ser ajustada depois para caber no resultado.
 *
 * As cinco primeiras marcadas com `// ✗ ANTES` são os erros MEDIDOS do
 * classificador booleano: ele devolvia "é pedido de artefato" para todas, e
 * duas delas são RECUSA EXPLÍCITA — a família dizendo que não quer, e o sistema
 * entendendo o contrário.
 */
const CORPUS: Array<[AtoSobreArtefato, string]> = [
  // ── PLANO ──────────────────────────────────────────────────────────────
  ["criar", "faz um plano para o Mario"],
  ["criar", "quero um plano para ajudar nisso"],
  ["conversar_sobre", "o plano que você fez ficou bom"],
  ["conversar_sobre", "por que você colocou isso no plano?"],
  ["conversar_sobre", "você já sabia disso quando fez o plano?"],
  // ✗ ANTES: "criar" — é O CASO DO MÁRIO, o turno real de 11/08.
  ["conversar_sobre", "Você já tinha informação suficiente para montar um plano? Dentro de perfil, você salvou o que sobre ele?"],
  ["conversar_sobre", "o que você salvou sobre ele no perfil para fazer esse plano?"], // ✗ ANTES: criar
  ["editar", "ajusta aquele plano, ele não consegue fazer a atividade 2"],             // ✗ ANTES: criar
  ["reenviar", "manda o plano de novo"],                                               // ✗ ANTES: criar
  ["recusar", "não quero plano agora, só quero entender por que isso acontece"],       // ✗ ANTES: criar
  ["ambiguo", "plano"],

  // ── PORTUGUÊS REAL DE WHATSAPP ─────────────────────────────────────────
  ["recusar", "n quero outro plano"],                                                  // ✗ ANTES: criar
  ["conversar_sobre", "pq vc colocou isso no plano?"],
  ["conversar_sobre", "esse plano n fez sentido"],
  ["editar", "da pra mudar o plano?"],
  ["conversar_sobre", "oq vc sabe dele?"],

  // ── ROTINA ─────────────────────────────────────────────────────────────
  ["criar", "quero monta uma rotina"],
  ["criar", "Quero montar uma rotina visual para a manhã."],
  ["conversar_sobre", "a rotina q vc fez ficou boa"],
  ["recusar", "n quero rotina agora"],
  ["conversar_sobre", "me explica essa rotina"],
  ["editar", "quero mudar a rotina de terça"],
  ["reenviar", "manda a rotina de novo"],

  // ── O USO CONCEITUAL — o caso da Ana, e o mais importante da lista ─────
  // Nenhuma destas pede artefato nenhum. Todas descrevem a vida da criança.
  ["ambiguo", "qdo muda rotina ela fica mal"],
  ["ambiguo", "Ela sofre quando muda a rotina."],
  ["ambiguo", "A professora mudou a rotina da sala"],
  ["ambiguo", "Ela sabe toda a rotina e mesmo assim trava"],
];

describe("pedir a coisa — e os dois freios que seguram esse atalho", () => {
  it("MORDE: primeira pessoa pede; terceira pessoa narra", () => {
    // O artefato como OBJETO de um pedido em primeira pessoa.
    expect(atoSobreArtefato("preciso de um plano pra ele dormir sozinho")).toBe("criar");
    expect(atoSobreArtefato("gostaria de um plano de ação")).toBe("criar");
    expect(atoSobreArtefato("me ajuda com um plano pra socialização")).toBe("criar");
    // ⚠️ TERCEIRA PESSOA É A MÃE CONTANDO A NECESSIDADE DA FILHA, e nunca um
    // pedido à Kolo. Sem este freio, "ela precisa de uma rotina" cria uma.
    expect(atoSobreArtefato("ela precisa de uma rotina mas nao aceita")).toBe("ambiguo");
    expect(atoSobreArtefato("ele precisa de um plano da escola")).toBe("ambiguo");
  });

  it("MORDE: a narrativa continua vencendo o pedido de coisa", () => {
    // Sem o freio da NARRATIVA, a oração temporal vira pedido: a mãe conta o
    // que acontece quando a filha quer algo, e recebe um artefato por isso.
    expect(atoSobreArtefato("quando ela quer uma rotina nova ela briga")).toBe("ambiguo");
    expect(atoSobreArtefato("toda vez que eu quero uma rotina nova ela chora")).toBe("ambiguo");
    expect(atoSobreArtefato("se eu quero um plano diferente ele resiste")).toBe("ambiguo");
  });
});

describe("o verbo que entrou por regressão medida", () => {
  it("MORDE: 'organizar' é pedido quando a mãe pede, e narrativa quando não é", () => {
    // Entrou porque a fatia da Rotina o teria silenciado (ver o comentário em
    // CRIAR). O par abaixo é o que impede que ele volte a criar por menção.
    expect(atoSobreArtefato("me ajuda a organizar a rotina dela?")).toBe("criar");
    expect(atoSobreArtefato("quero organizar a rotina da manhã")).toBe("criar");
    expect(atoSobreArtefato("a escola organiza a rotina da sala")).toBe("ambiguo");
    expect(atoSobreArtefato("quando organiza a rotina ela reclama")).toBe("ambiguo");
  });
});

describe("o ato sobre o artefato — seis atos, não um booleano", () => {
  it("1. MORDE: o corpus inteiro classifica como esperado", () => {
    const erros: string[] = [];
    for (const [esperado, frase] of CORPUS) {
      const ato = atoSobreArtefato(frase);
      if (ato !== esperado) erros.push(`"${frase.slice(0, 56)}" → ${ato} (esperado ${esperado})`);
    }
    expect(erros, `\n  ${erros.join("\n  ")}\n`).toEqual([]);
  });

  it("2. MORDE: o caso real do Mário nunca vira criação", () => {
    // O turno de produção que terminou com "Mário ou Manu?" 41 segundos depois
    // de a Ayla gerar um plano para o Mário.
    const real =
      "Você já tinha informação suficiente para montar um plano? Dentro de perfil, você salvou o que sobre ele?";
    expect(atoSobreArtefato(real)).toBe("conversar_sobre");
    expect(abreFluxoDeArtefato(atoSobreArtefato(real))).toBe(false);
  });

  it("3. MORDE: recusa vence verbo de criação na mesma frase", () => {
    // "não quero plano agora, só QUERO entender" — o classificador antigo via
    // "quero" e criava. A família disse o contrário.
    for (const t of [
      "não quero plano agora, só quero entender por que isso acontece",
      "n quero outro plano",
      "agora não quero montar rotina",
      "por enquanto não, prefiro só conversar",
    ]) {
      expect(atoSobreArtefato(t), `"${t}"`).toBe("recusar");
      expect(abreFluxoDeArtefato(atoSobreArtefato(t))).toBe(false);
    }
  });

  it("4. MORDE: só criar e editar abrem fluxo", () => {
    expect(abreFluxoDeArtefato("criar")).toBe(true);
    expect(abreFluxoDeArtefato("editar")).toBe(true);
    for (const a of ["reenviar", "conversar_sobre", "recusar", "ambiguo"] as const) {
      expect(abreFluxoDeArtefato(a), a).toBe(false);
    }
  });

  it("5. MORDE: reenviar NÃO é criar", () => {
    // Gerar um artefato novo quando a mãe pediu o que já existe é trabalho
    // jogado fora e um documento a mais para ela administrar.
    for (const t of ["manda o plano de novo", "me mostra a rotina de novo", "reenvia aquele plano"]) {
      expect(atoSobreArtefato(t), `"${t}"`).toBe("reenviar");
    }
  });

  it("6. MORDE: descrever a vida da criança nunca cria artefato", () => {
    // A classe inteira do caso Ana/Geovanna: falar SOBRE rotina, mudança,
    // transição ou previsibilidade não é pedir para CRIAR uma Rotina.
    for (const t of [
      "qdo muda rotina ela fica mal",
      "Ela sofre quando muda a rotina.",
      "Quando é preciso mudar a rotina de repente ela sente",
      "A professora mudou a rotina da sala",
      "A rotina está ótima mas ela não quer ir",
    ]) {
      expect(abreFluxoDeArtefato(atoSobreArtefato(t)), `"${t}" abriu artefato`).toBe(false);
    }
  });

  it("7. o pedido legítimo continua funcionando — a regra não pode só bloquear", () => {
    for (const t of [
      "faz um plano para o Mario",
      "Quero montar uma rotina visual para a manhã.",
      "quero monta uma rotina",
      "pode criar uma rotina pra manhã?",
      "me faz um plano pra isso",
    ]) {
      expect(abreFluxoDeArtefato(atoSobreArtefato(t)), `"${t}" foi bloqueado`).toBe(true);
    }
  });

  it("8. texto vazio ou lixo não cria nada", () => {
    for (const t of ["", "   ", null, undefined]) {
      expect(atoSobreArtefato(t)).toBe("ambiguo");
    }
  });
});
