import { afterEach, describe, expect, it } from "vitest";
import {
  BRINCADEIRA_PERSONALIZADA_V2,
  CONDUCAO_COM_EVIDENCIA,
  FORMATO_RESPOSTA_RICA,
  qualidadeRespostaV2Ativa,
} from "./qualidade-resposta";

const anterior = process.env.AYLA_QUALIDADE_RESPOSTA_V2;

afterEach(() => {
  if (anterior == null) delete process.env.AYLA_QUALIDADE_RESPOSTA_V2;
  else process.env.AYLA_QUALIDADE_RESPOSTA_V2 = anterior;
});

describe("contrato de qualidade da resposta", () => {
  it("fica desligado por padrão e aceita apenas valores explícitos", () => {
    delete process.env.AYLA_QUALIDADE_RESPOSTA_V2;
    expect(qualidadeRespostaV2Ativa()).toBe(false);
    process.env.AYLA_QUALIDADE_RESPOSTA_V2 = "off";
    expect(qualidadeRespostaV2Ativa()).toBe(false);
    process.env.AYLA_QUALIDADE_RESPOSTA_V2 = "on";
    expect(qualidadeRespostaV2Ativa()).toBe(true);
  });

  it("separa evidência, episódio e hipótese sem transformar tudo em questionário", () => {
    expect(CONDUCAO_COM_EVIDENCIA).toContain("fato registrado, relato deste episódio e hipótese");
    expect(CONDUCAO_COM_EVIDENCIA).toContain("agrupe até três perguntas relacionadas");
    expect(CONDUCAO_COM_EVIDENCIA).toContain("Ausência no perfil não significa ausência");
    expect(FORMATO_RESPOSTA_RICA).toContain("duas ou três ações distintas e executáveis");
    expect(FORMATO_RESPOSTA_RICA).toContain("a resposta vem antes do menu");
    expect(CONDUCAO_COM_EVIDENCIA).toContain("não explique comportamento pelo diagnóstico");
    expect(CONDUCAO_COM_EVIDENCIA).toContain("pedido de brincadeira conservam seus formatos próprios");
    expect(CONDUCAO_COM_EVIDENCIA).toContain("Quando a família trouxer várias frentes");
    expect(CONDUCAO_COM_EVIDENCIA).toContain("preserve a autonomia");
    expect(CONDUCAO_COM_EVIDENCIA).toContain("não reduza evolução a “fez ou não fez”");
    expect(CONDUCAO_COM_EVIDENCIA).toContain("ofereça ajuda física leve quando a pessoa aceitar");
    expect(CONDUCAO_COM_EVIDENCIA).toContain("É válido criar uma oportunidade simples de comunicação");
    expect(CONDUCAO_COM_EVIDENCIA).toContain("não prometa que CAA fará a fala surgir");
    expect(CONDUCAO_COM_EVIDENCIA).toContain("mude o mecanismo");
  });

  it("faz interesse mudar a mecânica sem inventar quando estiver ausente", () => {
    expect(BRINCADEIRA_PERSONALIZADA_V2).toContain("AÇÃO CENTRAL");
    expect(BRINCADEIRA_PERSONALIZADA_V2).toContain("mudar a mecânica");
    expect(BRINCADEIRA_PERSONALIZADA_V2).toContain("Sem interesse registrado, não invente");
  });
  it("usa retomada humana sem atribuir biblioteca ou hipótese à família", () => {
    expect(FORMATO_RESPOSTA_RICA).toContain("Pelo que você já me contou sobre ela…");
    expect(FORMATO_RESPOSTA_RICA).toContain("ajustando nome e pronome ao alvo");
    expect(FORMATO_RESPOSTA_RICA).toContain("Não repita essa frase mecanicamente");
    expect(FORMATO_RESPOSTA_RICA).toContain("informações que ela realmente compartilhou");
    expect(FORMATO_RESPOSTA_RICA).toContain("não apresente conhecimento da biblioteca ou hipótese como lembrança");
  });
  it("orientação completa oferece caminhos específicos sem virar menu repetitivo", () => {
    expect(FORMATO_RESPOSTA_RICA).toContain("Em todos os temas");
    expect(FORMATO_RESPOSTA_RICA).toContain("duas ou três possibilidades concretas");
    expect(FORMATO_RESPOSTA_RICA).toContain("bullets com nome em negrito e emoji discreto");
    expect(FORMATO_RESPOSTA_RICA).toContain("não de um menu fixo");
    expect(FORMATO_RESPOSTA_RICA).toContain("entregue o caminho escolhido no turno seguinte");
    expect(FORMATO_RESPOSTA_RICA).toContain("exemplos de pedidos escritos na linguagem dela");
    expect(FORMATO_RESPOSTA_RICA).toContain("recusa de continuar e necessidade imediata não precisam de menu");
    expect(FORMATO_RESPOSTA_RICA).toContain("Uma pergunta de esclarecimento não substitui os caminhos");
    expect(FORMATO_RESPOSTA_RICA).not.toContain("Uma pergunta realmente necessária pode substituir as ofertas");
  });
  it("reflexão devolve agência e hipóteses observáveis sem culpabilizar a mãe", () => {
    expect(FORMATO_RESPOSTA_RICA).toContain("sensação de impotência");
    expect(FORMATO_RESPOSTA_RICA).toContain("sem chamar ninguém de vítima");
    expect(FORMATO_RESPOSTA_RICA).toContain("o que ajuda");
    expect(FORMATO_RESPOSTA_RICA).toContain("o que pode estar atrapalhando");
    expect(FORMATO_RESPOSTA_RICA).toContain("diga o que observar para distinguir");
    expect(FORMATO_RESPOSTA_RICA).toContain("não exigir pensamento positivo");
    expect(FORMATO_RESPOSTA_RICA).toContain("material temático aprovado recebido");
  });
});
