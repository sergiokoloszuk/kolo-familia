import { describe, expect, it } from "vitest";
import {
  afirmacaoTemConteudo,
  classificarSujeito,
  conceitoEhAmplo,
  sujeitoElegivel,
} from "./sujeito";

/**
 * A barreira que impede o pior erro possível desta camada: gravar um fato na
 * pessoa errada. Metade destes testes existe para provar o lado difícil — que
 * a barreira NÃO barra relato legítimo, que é o risco de falso negativo.
 */

const sobre = (texto: string) =>
  classificarSujeito({ texto, membroSelecionado: true });

describe("sujeito — a cuidadora falando dela", () => {
  it("primeira pessoa sobre o próprio estado não é fato da criança", () => {
    for (const t of [
      "Estou exausta e sem paciência",
      "Tô exausta",
      "Não aguento mais",
      "Me sinto uma mãe fracassada",
      "Eu não durmo há três dias",
    ]) {
      expect(sobre(t), t).toBe("caregiver");
    }
  });

  it("mas 'eu acho que ele gosta' é sobre a criança", () => {
    // O "eu" sozinho não decide nada — o que decide é a construção de sujeito.
    expect(sobre("Eu acho que ele gosta de música")).toBe("accompanied_member");
    expect(sobre("Quando eu aviso antes, ele lida melhor")).toBe("accompanied_member");
  });
});

describe("sujeito — mais de uma pessoa", () => {
  it("duas crianças na mesma frase não viram fato automático", () => {
    for (const t of [
      "O Pedro brinca com a irmã, mas a Ana não interage",
      "O irmão dele come de tudo, já ele não",
      "Meus dois filhos são autistas",
      "As duas reagem diferente",
    ]) {
      expect(sobre(t), t).toBe("multiple_or_ambiguous");
    }
  });

  it("terceiro alguém que não é a pessoa acompanhada", () => {
    expect(sobre("A professora nova não entende nada")).toBe("another_person");
  });
});

describe("sujeito — o caso comum precisa passar", () => {
  const legitimos = [
    "Aceita brócolis cozido",
    "Tapa os ouvidos com o barulho do liquidificador",
    "Não fala nenhuma palavra ainda",
    "Escovou os dentes sozinho hoje",
    "Trava e chora na hora de sair de casa",
    "Só fala de dinossauro o dia inteiro",
    "Dormiu a noite inteira",
    "Imita tudo que vê na televisão",
  ];
  for (const t of legitimos) {
    it(`passa: "${t.slice(0, 40)}"`, () => {
      expect(sobre(t)).toBe("accompanied_member");
      expect(sujeitoElegivel(sobre(t))).toBe(true);
    });
  }
});

describe("sujeito — sem membro selecionado", () => {
  it("sem seleção e sem sinal, é desconhecido e não grava", () => {
    const s = classificarSujeito({ texto: "Aceita brócolis", membroSelecionado: false });
    expect(s).toBe("unknown");
    expect(sujeitoElegivel(s)).toBe(false);
  });
});

describe("conteúdo verificável", () => {
  it("elogio puro não vira fato", () => {
    for (const t of [
      "É uma criança especial",
      "Ele é incrível",
      "Ela é uma menina maravilhosa",
      "É muito especial",
    ]) {
      expect(afirmacaoTemConteudo(t).ok, t).toBe(false);
    }
  });

  it("elogio COM atributo funcional passa — é informação", () => {
    for (const t of [
      "É muito carinhoso com a irmã",
      "É observador em ambientes novos",
      "Fica mais tranquilo quando sabe o que vai acontecer",
      "Tem facilidade para montar Lego",
      "Se incomoda com o barulho do liquidificador",
    ]) {
      expect(afirmacaoTemConteudo(t).ok, t).toBe(true);
    }
  });

  it("interjeição e texto vazio não passam", () => {
    for (const t of ["ok", "oi", "sim", "obrigada", "  "]) {
      expect(afirmacaoTemConteudo(t).ok, t).toBe(false);
    }
  });
});

describe("conceito amplo", () => {
  it("identifica o fato sem subcampo, sem precisar de coluna nova", () => {
    expect(conceitoEhAmplo("sensorial", "sensorial")).toBe(true);
    expect(conceitoEhAmplo("sensorial.hipersensibilidade_auditiva", "sensorial")).toBe(false);
  });
});

describe("nenhum fluxo atual produz `confirmed`", () => {
  /**
   * Teste ARQUITETURAL. `confirmed` significa "algo antes incerto foi
   * validado"; enquanto não existir fluxo de validação, produzi-lo faz o termo
   * passar a significar "foi digitado num formulário" — e aí o eixo
   * epistemológico inteiro perde o sentido. O contrato mantém o estado para uso
   * futuro; o que este teste impede é um chamador voltar a emiti-lo por
   * conveniência.
   */
  it("nenhum chamador envia verificationStatus confirmed", async () => {
    const { readFileSync, readdirSync, statSync } = await import("node:fs");
    const { join, resolve, relative } = await import("node:path");
    const SRC = resolve(__dirname, "../../..");

    const arquivos: string[] = [];
    const varrer = (dir: string) => {
      for (const nome of readdirSync(dir)) {
        if (nome === "node_modules" || nome === ".next") continue;
        const caminho = join(dir, nome);
        if (statSync(caminho).isDirectory()) varrer(caminho);
        else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) arquivos.push(caminho);
      }
    };
    varrer(SRC);

    const infratores = arquivos.filter((f) =>
      /verificationStatus:\s*"confirmed"/.test(readFileSync(f, "utf8")),
    );
    expect(
      infratores.map((f) => relative(SRC, f)),
      "`confirmed` só pode vir de um fluxo de validação explícita, que ainda não existe",
    ).toEqual([]);
  });
});
