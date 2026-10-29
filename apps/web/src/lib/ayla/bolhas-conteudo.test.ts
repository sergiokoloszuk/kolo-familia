import { describe, expect, it } from "vitest";
import { dividirEmBolhas, LIMITE_OPERACIONAL_TEXTO_WHATSAPP } from "./bolhas";
import { paraWhatsApp } from "./apresentacao";

const atividade = (nome: string) => `### ${nome}\n\n**Tempo:** 5 minutos.\n\n**Material:** blocos.\n\n**Como começar:** deixe duas peças à vista.\n\n> “Você escolhe como continuar.”\n\n1. Manu coloca uma peça.\n\n2. Você acompanha a ideia dela.\n\n**Próxima rodada:** troquem a vez.\n\n**Para terminar:** guardem a construção.\n\n**O que exercita:** acompanhar uma sequência e construir juntas.`;
const tres = `Três jeitos de brincar juntas.\n\n${atividade("A ponte que muda")}\n\n${atividade("O objeto saiu de férias")}\n\n${atividade("O espelho se atrapalha")}\n\nDepois podemos adaptar a favorita.`;
const palavras = (t: string) => t.match(/[\p{L}\p{N}]+/gu);

describe("agrupamento por unidade de conteúdo", () => {
  it("mantém resposta curta inteira", () => {
    const t = "*Uma pista*\n\nDeixe Manu escolher.\n\nVocê pode mostrar uma etapa.";
    expect(dividirEmBolhas(t)).toEqual([t]);
  });

  it("não transforma parágrafos, listas espaçadas ou fala pronta em mensagens separadas", () => {
    const t = paraWhatsApp("### Um apoio\n\nEntendo sua preocupação.\n\n1. Mostre.\n\n2. Espere.\n\n> “Eu estou aqui.”\n\n- Observe a reação.\n\nPodemos adaptar isso.");
    expect(dividirEmBolhas(t)).toEqual([t]);
  });

  it("entrega três atividades completas, com introdução na primeira e continuidade na última", () => {
    const t = paraWhatsApp(tres);
    const mensagens = dividirEmBolhas(t);
    expect(mensagens).toHaveLength(3);
    expect(mensagens[0]).toContain("Três jeitos");
    expect(mensagens[0]).toContain("A ponte que muda");
    expect(mensagens[1]).toContain("O objeto saiu de férias");
    expect(mensagens[2]).toContain("O espelho se atrapalha");
    expect(mensagens[2]).toContain("Depois podemos");
    for (const mensagem of mensagens) {
      expect(mensagem).toContain("Como começar");
      expect(mensagem).toContain("Para terminar");
      expect(mensagem).toContain("O que exercita");
    }
    expect(palavras(mensagens.join("\n\n"))).toEqual(palavras(t));
  });

  it("não confunde três passos de orientação com três atividades", () => {
    const t = "*1. Separe os materiais*\n\nEscolha os blocos.\n\n*2. Mostre uma parte*\n\nDiga o que fazer.\n\n*3. Termine*\n\nGuarde os materiais.";
    expect(dividirEmBolhas(t)).toEqual([t]);
  });

  it("aceita títulos com emoji ou numerados sem exigir uma nova instrução ao modelo", () => {
    for (const formato of [
      (t: string) => t.replace(/^### /gm, "🧩 "),
      (t: string) => t.replace(/^### (.+)$/gm, "1. **$1**"),
    ]) expect(dividirEmBolhas(paraWhatsApp(formato(tres)))).toHaveLength(3);
  });

  it("subtítulos internos não separam o material da execução de cada atividade", () => {
    const t = paraWhatsApp(tres.replaceAll("**Como começar:**", "**Preparação**\n\n**Como começar:**"));
    const mensagens = dividirEmBolhas(t);
    expect(mensagens).toHaveLength(3);
    for (const mensagem of mensagens) {
      expect(mensagem).toContain("*Preparação*");
      expect(mensagem).toContain("Como começar");
      expect(mensagem).toContain("Para terminar");
    }
  });
});

describe("limite operacional sem perda de conteúdo", () => {
  it("divide um texto extenso apenas quando precisa e preserva palavras, números e URL", () => {
    const t = "Uma pista às 18h30. https://kolo.com.br/a_b?x=1 💛\n\n".repeat(150).trim();
    const partes = dividirEmBolhas(t);
    expect(partes.length).toBeGreaterThan(1);
    expect(partes.every((p) => p.length <= LIMITE_OPERACIONAL_TEXTO_WHATSAPP)).toBe(true);
    expect(palavras(partes.join("\n\n"))).toEqual(palavras(t));
    expect(partes.join("\n\n").match(/https:\/\/kolo.com.br\/a_b\?x=1/g)).toHaveLength(150);
  });

  it("mantém cada atividade íntegra quando cabe; ultrapassar o limite permite mais partes", () => {
    const partes = dividirEmBolhas(paraWhatsApp(tres), 200);
    expect(partes.length).toBeGreaterThan(3);
    expect(partes.every((p) => p.length <= 200)).toBe(true);
    expect(palavras(partes.join("\n\n"))).toEqual(palavras(paraWhatsApp(tres)));
  });

  it("não perde caracteres nem separa surrogate pairs em um token muito longo", () => {
    const t = "😀".repeat(3000);
    const partes = dividirEmBolhas(t);
    expect(partes.join("")).toBe(t);
    expect(partes.every((p) => p.isWellFormed())).toBe(true);
  });

  it("preserva emojis compostos mesmo quando um token precisa ser dividido", () => {
    const emoji = "👩🏽‍🍳";
    const partes = dividirEmBolhas(emoji.repeat(100), 63);
    expect(partes.join("")).toBe(emoji.repeat(100));
    expect(partes.every((p) => p.length % emoji.length === 0)).toBe(true);
  });

  it("respeita o limite exato e rejeita limites inválidos", () => {
    expect(dividirEmBolhas("x".repeat(4000))).toHaveLength(1);
    expect(dividirEmBolhas("x".repeat(4001))).toHaveLength(2);
    expect(() => dividirEmBolhas("texto", 0)).toThrow(RangeError);
    expect(dividirEmBolhas("  \r\n\r\n ")).toEqual([]);
  });
});
