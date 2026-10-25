import { afterEach, describe, expect, it } from "vitest";
import {
  BRINCADEIRA_PERSONALIZADA_V2,
  CONDUCAO_COM_EVIDENCIA,
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
    expect(CONDUCAO_COM_EVIDENCIA).toContain("no máximo uma pergunta curta");
    expect(CONDUCAO_COM_EVIDENCIA).toContain("Ausência no perfil não significa ausência");
    expect(CONDUCAO_COM_EVIDENCIA).toContain("mude o mecanismo");
  });

  it("faz interesse mudar a mecânica sem inventar quando estiver ausente", () => {
    expect(BRINCADEIRA_PERSONALIZADA_V2).toContain("AÇÃO CENTRAL");
    expect(BRINCADEIRA_PERSONALIZADA_V2).toContain("mudar a mecânica");
    expect(BRINCADEIRA_PERSONALIZADA_V2).toContain("Sem interesse registrado, não invente");
  });
});
