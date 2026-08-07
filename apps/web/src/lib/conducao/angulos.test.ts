import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ANGULOS, angulosUsados, blocoProgressao } from "./angulos";
import { nucleoConducao, PISO, EXPLICACAO } from "./diretrizes";

/**
 * A CONVERSA TEM QUE SUBIR UM DEGRAU.
 *
 * Conversa real da Karina sobre o Mario (07/08/2026): em dois turnos seguidos
 * a Ayla entregou sair da loja, falar pouco, oferecer pressão e observar o
 * gatilho — duas vezes. E não foi falta de contexto: a resposta anterior
 * estava no histórico, verificado no banco.
 *
 * Os turnos reais estão reproduzidos abaixo. Se a detecção de ângulo
 * enfraquecer, é este caso que volta.
 */

// Trechos LITERAIS das duas respostas, com a repetição que a mãe viu.
const TURNO_1 = `*O que fazer agora* Se ele estiver se jogando ou apertando tudo, primeiro reduza riscos: afaste objetos frágeis, quinas e coisas que possam machucá-lo. Fale pouco: "Eu não vou deixar você se machucar. Vamos para um lugar seguro."
*Uma troca segura* Ofereça movimento e pressão sem transformar isso em prêmio: empurrar a parede por alguns segundos, apertar uma almofada grande, fazer força contra as mãos.`;

const TURNO_2 = `*O que fazer na hora* Leve o Mario para um canto mais vazio ou para fora da loja, afastando objetos e quinas. Fale baixo e pouco: "Eu estou aqui. Não vou deixar você se machucar."
Não tente explicar, convencer ou perguntar muito enquanto ele estiver acelerado. Se ele aceitar, ofereça empurrar a parede, apertar uma almofada grande ou caminhar alguns minutos.`;

describe("o caso que originou a regra", () => {
  it("reconhece os três ângulos que a Ayla repetiu", () => {
    const usados = angulosUsados([TURNO_1]);
    expect(usados).toContain("tirar do lugar / afastar dos objetos");
    expect(usados).toContain("reduzir a fala / menos palavras");
    expect(usados).toContain("pressão ou movimento (empurrar, apertar, caminhar)");
  });

  it("o segundo turno teria chegado com os três já marcados", () => {
    // É esta lista que faltava no prompt quando ela repetiu tudo.
    const bloco = blocoProgressao(angulosUsados([TURNO_1]));
    expect(bloco).toMatch(/afastar dos objetos/);
    expect(bloco).toMatch(/menos palavras/);
    expect(bloco).toMatch(/NÃO repita esses pontos como orientação principal/);
  });

  it("títulos genéricos NÃO são o sinal — o conteúdo é", () => {
    // "O que fazer agora" e "O que eu faria primeiro" dizem a forma, não o
    // mérito: duas respostas iguais no conteúdo saem com títulos diferentes.
    expect(angulosUsados(["*O que fazer agora* *O que eu faria primeiro*"])).toEqual([]);
  });
});

describe("o bloco de progressão", () => {
  it("some quando não há nada a evitar — não vira peso fixo", () => {
    expect(blocoProgressao([])).toBe("");
    expect(angulosUsados([])).toEqual([]);
    expect(angulosUsados([""])).toEqual([]);
  });

  it("nomeia saídas, não só proíbe", () => {
    // Só proibir empurra pra reformular a mesma coisa com outras palavras —
    // repetição de novo, disfarçada.
    const bloco = blocoProgressao(angulosUsados([TURNO_1]));
    expect(bloco).toMatch(/AVANCE para um ângulo novo/);
    expect(bloco).toMatch(/Ainda não usados aqui:/);
  });

  it("não oferece como novidade um ângulo que já foi dado", () => {
    const usados = angulosUsados([TURNO_1, TURNO_2]);
    const bloco = blocoProgressao(usados);
    const sugeridos = bloco.split("Ainda não usados aqui:")[1] ?? "";
    for (const u of usados) expect(sugeridos).not.toContain(u);
  });

  it("com o repertório esgotado, ainda dá um caminho em vez de emudecer", () => {
    const bloco = blocoProgressao(ANGULOS.map((a) => a.rotulo));
    expect(bloco).toMatch(/aprofunde um caso concreto/);
  });

  it("não despeja a lista inteira — no máximo 6", () => {
    const tudo = ANGULOS.map((a) => a.rotulo);
    expect(angulosUsados([TURNO_1 + TURNO_2 + tudo.join(" ")]).length).toBeLessThanOrEqual(6);
  });
});

describe("o viés é permissivo — na dúvida não marca", () => {
  it("fala da mãe não é orientação dada", () => {
    // Só o que a AYLA escreveu conta. Marcar a fala da mãe proibiria a Ayla de
    // responder ao que foi perguntado — quem filtra é o chamador, e estes
    // textos não disparam sozinhos.
    expect(angulosUsados(["Mario vive pulando se jogando apertando tudo"])).toEqual([]);
    expect(angulosUsados(["Como faço para acalmar ele ?"])).toEqual([]);
  });

  it("conversa comum não vira ângulo", () => {
    expect(angulosUsados(["Que bom que você contou. Como ele está hoje?"])).toEqual([]);
  });

  it("todo ângulo tem id, rótulo e padrão únicos", () => {
    const ids = ANGULOS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    const rotulos = ANGULOS.map((a) => a.rotulo);
    expect(new Set(rotulos).size).toBe(rotulos.length);
  });
});

// ============================================================
// AS DUAS REGRAS NOVAS DO NÚCLEO
// ============================================================

describe("três níveis: cotidiano não é crise", () => {
  it("o piso nomeia o nível cotidiano e os verbos que enganam", () => {
    // "risco de acidente" pegava "pode derrubar coisas em lojas", e a resposta
    // saía com afastar objetos, "não vou deixar você se machucar" e emergência.
    expect(PISO).toMatch(/TRÊS NÍVEIS, NÃO DOIS/);
    expect(PISO).toMatch(/Palavra isolada não define nível/);
    for (const v of ["se joga", "bate", "derruba"]) expect(PISO).toContain(v);
  });

  it("na dúvida, cotidiano — e o gatilho de crise ficou mais estreito", () => {
    expect(PISO).toMatch(/Na dúvida entre cotidiano e crise, trate como cotidiano/);
    expect(PISO).toMatch(/agressão que machuca alguém/);
    expect(PISO).toMatch(/acidente iminente/);
    expect(PISO).not.toMatch(/fuga, risco de acidente\)/);
  });

  it("o piso do adulto continua intacto", () => {
    // A linha que já existia pro eixo do adulto (assinatura ≠ ideação) não
    // pode ter sido substituída pela nova.
    expect(PISO).toMatch(/CONFIRME O SIGNIFICADO ANTES DE ACIONAR CRISE/);
    expect(PISO).toMatch(/CVV 188/);
    expect(PISO).toMatch(/SAMU 192/);
  });
});

describe("explicação que ensina sem diagnosticar", () => {
  it("autoriza explicar — a regra não é banir cérebro", () => {
    expect(EXPLICACAO).toMatch(/Você PODE ensinar mecanismos gerais/);
    expect(EXPLICACAO).toMatch(/Não empobreça a resposta por medo de explicar/);
  });

  it("a linha é geral × individual, e está escrita como linha", () => {
    expect(EXPLICACAO).toMatch(/conhecimento GERAL pode ser afirmado/);
    expect(EXPLICACAO).toMatch(/MECANISMO INDIVIDUAL não comprovado, não/);
  });

  it("proíbe as formas que viram fato sobre a criança", () => {
    for (const f of ["o cérebro dele precisa", "o sistema nervoso dele está", "o córtex dele"])
      expect(EXPLICACAO).toContain(f);
  });

  it("dá as formas que substituem", () => {
    for (const f of ["para algumas crianças", "uma possibilidade é", "em geral"])
      expect(EXPLICACAO).toContain(f);
  });

  it("os quatro movimentos estão na ordem", () => {
    const i = (t: string) => EXPLICACAO.indexOf(t);
    expect(i("OBSERVAÇÃO")).toBeLessThan(i("EXPLICAÇÃO GERAL"));
    expect(i("EXPLICAÇÃO GERAL")).toBeLessThan(i("HIPÓTESE TESTÁVEL"));
    expect(i("HIPÓTESE TESTÁVEL")).toBeLessThan(i("DIREÇÃO"));
  });

  it("nem toda resposta pede explicação", () => {
    // Sem isto, a regra viraria obrigação de dar aula em todo turno — que é o
    // defeito oposto ao que ela veio corrigir.
    expect(EXPLICACAO).toMatch(/NEM TODA RESPOSTA PEDE EXPLICAÇÃO/);
    expect(EXPLICACAO).toMatch(/não dê aula por dar aula/);
  });

  it("duas hipóteses valem mais que uma certeza", () => {
    expect(EXPLICACAO).toMatch(/Duas hipóteses ensinam mais que uma certeza/);
  });

  it("entra no núcleo, e depois das fronteiras", () => {
    const n = nucleoConducao();
    expect(n).toContain(EXPLICACAO);
    expect(n.indexOf("# Fronteira clínica")).toBeLessThan(n.indexOf("# Explicação que ensina"));
  });
});

describe("os dois canais recebem a progressão", () => {
  const RESP = readFileSync(resolve(__dirname, "../ayla/responder.ts"), "utf8");
  const WEB = readFileSync(resolve(__dirname, "../ia/prompt.ts"), "utf8");

  it("WhatsApp usa só os turnos da Ayla, e nunca os de outro irmão", () => {
    expect(RESP).toMatch(/h\.de === "ayla" && !h\.sobre/);
  });

  it("web usa os turnos assistant", () => {
    expect(WEB).toMatch(/h\.papel === "assistant"/);
  });

  it("nenhum dos dois injeta bloco vazio", () => {
    expect(RESP).toMatch(/progressao \? `\\n\$\{progressao\}` : ""/);
    expect(WEB).toMatch(/if \(progressao\)/);
  });
});
