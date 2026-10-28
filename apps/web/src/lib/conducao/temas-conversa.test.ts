import { describe, expect, it } from "vitest";
import { GUIAS_TEMATICOS, apoioTematico, guiasDoTurno, temaEscolhidoDoContexto, aberturaTematicaDoTurno, blocoAberturaTematica, CONDUCAO_CASO_FOCO } from "./temas-conversa";

describe("áreas da Ayla e biblioteca real", () => {
  it("reconhece somente a escolha inteira de uma área conhecida", () => {
    for (const guia of GUIAS_TEMATICOS) {
      expect(aberturaTematicaDoTurno(`Quero explorar ${guia.nome}.`, [guia.chave])?.chave).toBe(guia.chave);
    }
    expect(aberturaTematicaDoTurno("Quero explorar Atenção e Concentração.", ["foco"])?.chave).toBe("foco");
    expect(aberturaTematicaDoTurno("quero falar sobre sono", ["sono"])?.chave).toBe("sono");
    for (const mensagem of ["Ela não dorme", "Quero explorar sono porque ela acorda chorando", "Quero explorar outra área", "Sim", "Quero uma brincadeira de foco"]) {
      expect(aberturaTematicaDoTurno(mensagem, ["sono", "foco"])).toBeNull();
    }
    expect(aberturaTematicaDoTurno("Quero explorar Sono Tranquilo.", ["nutricional"])).toBeNull();
  });
  it("dá prioridade à apresentação e caminhos sem confundir texto livre com vazio", () => {
    for (const canal of ["web", "whatsapp"] as const) {
      const bloco = blocoAberturaTematica(GUIAS_TEMATICOS.find((g) => g.chave === "foco")!, canal);
      expect(bloco).toContain("não aplicar o roteiro de uma orientação ou investigar uma lacuna decisiva");
      expect(bloco).toContain("inclusive texto livre e histórico");
      expect(bloco).toContain("quatro caminhos em bullets");
      expect(bloco).toContain("Não pergunte novamente se sustenta atenção em interesses");
      expect(bloco).toContain("áudio");
    }
  });
  it("tem 12 áreas distintas, todas com propósito, perguntas e diferenciação próprios", () => {
    expect(new Set(GUIAS_TEMATICOS.map((g) => g.chave)).size).toBe(12);
    expect(new Set(GUIAS_TEMATICOS.map((g) => g.perguntas.join())).size).toBe(12);
    for (const g of GUIAS_TEMATICOS) {
      expect(g.proposito.length).toBeGreaterThan(30);
      expect(g.perguntas.length).toBe(3);
      const apoio = apoioTematico([g.chave], "web");
      expect(apoio.bloco).toContain(g.proposito);
      expect(apoio.bloco).toContain("Se houver informações, apresente um resumo breve e fiel");
      expect(apoio.bloco).toContain("Se não houver informações do tema");
      expect(apoio.bloco).toContain("Se houver informações parciais");
      expect(apoio.bloco).toContain("perguntas na abertura, liste-as em bullets");
      expect(apoio.bloco).toContain("pode responder por áudio");
      expect(apoio.secoes.length).toBeGreaterThan(0);
      expect(apoio.secoes.length).toBeLessThanOrEqual(2);
      for (const s of apoio.secoes) {
        expect(s.tema).toBe(g.chave);
        expect(apoio.biblioteca).toContain(s.titulo);
      }
    }
  });
  it("Foco não confunde interesse conhecido com padrão de atenção já relatado", () => {
    for (const guia of GUIAS_TEMATICOS) {
      const bloco = blocoAberturaTematica(guia, "web");
      if (guia.chave === "foco") {
        expect(bloco).toContain("Conhecer interesses ou comunicação não prova esse padrão");
        expect(bloco).toContain("não substitua essas lacunas apenas pelo menu");
      } else {
        expect(bloco).not.toContain("Para saber se há dados de Foco");
      }
    }
  });
  it("guia Foco começa pelo apoio doméstico sem proibir ajuda específica à escola", () => {
    const foco = apoioTematico(["foco"], "web").bloco;
    expect(foco).toContain("observações da mãe em casa");
    expect(CONDUCAO_CASO_FOCO).toContain("Não abra com mensagem para professora");
    expect(CONDUCAO_CASO_FOCO).toContain("Se ela pedir explicitamente o que a escola pode mudar");
    expect(foco).not.toContain("<pedido_de_orientacao_foco>");
  });
  it("deduplica aliases, limita dois apoios e não inventa área desconhecida", () => {
    expect(guiasDoTurno(["nutricao", "alimentacao", "sono", "motor"]).map((g) => g.chave)).toEqual(["nutricional", "sono"]);
    expect(apoioTematico(["qualquer_coisa"], "web").bloco).toBe("");
    expect(apoioTematico(["nutricional", "sono"], "web").secoes.map((s) => s.tema)).toEqual(["nutricional", "sono"]);
  });
  it("lê a área ativa persistida sem aceitar rótulos arbitrários", () => {
    expect(temaEscolhidoDoContexto({ tema_escolhido: "sono" })?.chave).toBe("sono");
    expect(temaEscolhidoDoContexto({ tema_escolhido: "sono", tema_ativo: "nutricional" })?.chave).toBe("nutricional");
    expect(temaEscolhidoDoContexto({ tema_escolhido: "admin" })).toBeNull();
    expect(temaEscolhidoDoContexto(null)).toBeNull();
  });
  it("retoma o que a família contou sem anunciar cadastro nem fingir memória, nos dois canais", () => {
    for (const canal of ["web", "whatsapp"] as const) {
      for (const guia of GUIAS_TEMATICOS) {
        const { bloco } = apoioTematico([guia.chave], canal);
        expect(bloco).toContain("Pelo que você já me contou sobre ela…");
        expect(bloco).toContain("ajuste nome e pronome ao alvo");
        expect(bloco).toContain('Não anuncie "vi no perfil", "consta no cadastro"');
        expect(bloco).toContain("conhecimento da biblioteca não é algo que a família contou");
        expect(bloco).toContain("sem fingir lembrança");
      }
    }
  });
});
