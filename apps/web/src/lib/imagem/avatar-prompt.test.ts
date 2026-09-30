import { describe, expect, it } from "vitest";
import { AVATAR_ESTILOS, montarPromptCanonico } from "./avatar-prompt";

describe("avatar 3D adequado à idade", () => {
  it("mantém todos os estilos originais, tridimensionais e sem franquias", () => {
    const estilosJovens = ["gamer_3d", "anime_3d", "fantasia_3d", "ficcao_3d"];
    for (const valor of estilosJovens) {
      const estilo = AVATAR_ESTILOS.find((item) => item.value === valor);
      expect(estilo).toBeDefined();
      expect(estilo?.prompt).toMatch(/3D|tridimensional/i);
      expect(estilo?.prompt).toMatch(/original|sem copiar/i);
    }
  });

  it("não infantiliza adolescente", () => {
    const prompt = montarPromptCanonico({
      estilo: "gamer_3d",
      idade: 15,
      generoVisual: "menina",
      roupasFrequentes: "moletom roxo e tênis",
    });
    expect(prompt).toContain("uma adolescente, de 15 anos");
    expect(prompt).toContain("vestindo moletom roxo e tênis");
    expect(prompt).not.toContain("uma menina, de 15 anos");
    expect(prompt).toContain("NÃO fotorrealista");
  });

  it("não descreve adulto como criança", () => {
    const prompt = montarPromptCanonico({
      estilo: "ficcao_3d",
      idade: 34,
      generoVisual: "menino",
    });
    expect(prompt).toContain("um adulto, de 34 anos");
    expect(prompt).not.toContain("menino");
  });
});
