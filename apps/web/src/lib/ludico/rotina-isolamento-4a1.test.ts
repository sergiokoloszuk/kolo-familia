import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FLAG_PILOTO, pilotoEstrategiasLigado } from "@/lib/conducao/piloto";
import { recuperarBoasPraticas } from "@/lib/conhecimento/recuperar";

/**
 * A ROTINA NÃO PODE REGREDIR POR CAUSA DA FASE 4A.
 *
 * A frente da Rotina levou correções caras — a sequência da família que a Ayla
 * reordenava, o quadro que não encolhia com a idade, o PDF que uma fase
 * desligou sem querer. Nenhuma delas pode voltar porque a conversa web ganhou
 * contexto novo.
 *
 * Estes testes não repetem o que os 322 testes de Rotina já garantem. Eles
 * guardam a FRONTEIRA: que o caminho da Rotina não passa por nada que a 4A.1
 * tocou, e que a flag não o alcança nem ligada.
 */

const src = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

/** Os quatro arquivos que a 4A.1 alterou, mais o módulo novo. */
const TOCADOS_PELA_4A1 = [
  "ia/context.ts",
  "ia/prompt.ts",
  "ia/engine.ts",
  "conducao/piloto.ts",
];

/** Todo o caminho da Rotina — geração, condução, validação e resultado. */
const CAMINHO_DA_ROTINA = [
  "ludico/gerar.ts",
  "ludico/rotina-progresso.ts",
  "ludico/rotina-resultado.ts",
  "ayla/rotina-guiada.ts",
  "ayla/prontidao-rotina.ts",
  "ayla/validacao-rotina.ts",
];

afterEach(() => {
  delete process.env[FLAG_PILOTO];
});

describe("a Rotina não passa pelo caminho da 4A.1", () => {
  it("1. MORDE: nenhum módulo da Rotina importa o que a 4A.1 mexeu", () => {
    for (const f of CAMINHO_DA_ROTINA) {
      const t = src(f);
      for (const alvo of ["ia/context", "ia/prompt", "ia/engine", "conducao/piloto"]) {
        expect(t, `${f} passou a importar ${alvo}`).not.toMatch(
          new RegExp(`from ["'](@/lib/)?${alvo}`),
        );
      }
      expect(t, `${f} passou a usar buildContext`).not.toMatch(/buildContext\(/);
    }
  });

  it("2. MORDE: a flag não é lida em lugar nenhum da Rotina", () => {
    for (const f of CAMINHO_DA_ROTINA) {
      expect(src(f), `${f} leu a flag do piloto`).not.toMatch(/KOLO_PILOTO_ESTRATEGIAS|pilotoEstrategiasLigado/);
    }
  });

  it("3. MORDE: o que a 4A.1 tocou não conhece a Rotina", () => {
    // A fronteira vale nos dois sentidos: se um dia `context.ts` começar a
    // montar contexto de rotina, a separação some sem ninguém perceber.
    for (const f of TOCADOS_PELA_4A1) {
      const t = src(f);
      expect(t, `${f} passou a importar módulo de rotina`).not.toMatch(
        /from ["'](@\/lib\/)?(ludico|ayla)\/(rotina|prontidao|validacao-rotina)/,
      );
    }
  });
});

describe("o ranking não alcança a Rotina", () => {
  it("4. MORDE: sem `relato`, o recuperador ignora a flag por completo", async () => {
    // A Rotina, quando recupera repertório, o faz pelo orquestrador — que não
    // passa `relato`. Com a flag LIGADA e sem relato, nada muda: é isso que
    // garante que ligar o piloto na Vercel não mexe na Rotina.
    const rec = src("conhecimento/recuperar.ts");
    expect(rec).toMatch(/const finais = p\.relato\?\.trim\(\)/);
    expect(rec).toMatch(/:\s*ordenadas;/);

    // E a flag não é sequer consultada dentro do recuperador — a decisão é de
    // quem chama. Um `if (pilotoLigado())` aqui dentro atingiria todo mundo.
    expect(rec, "o recuperador passou a ler a flag").not.toMatch(
      /KOLO_PILOTO_ESTRATEGIAS|pilotoEstrategiasLigado/,
    );
  });

  it("5. flag ON não muda a assinatura de quem não passa relato", () => {
    process.env[FLAG_PILOTO] = "1";
    expect(pilotoEstrategiasLigado()).toBe(true);
    // A função continua sendo chamável exatamente como a Rotina a chama.
    expect(typeof recuperarBoasPraticas).toBe("function");
    expect(recuperarBoasPraticas.length).toBe(1);
  });
});

describe("as correções caras da Rotina continuam escritas", () => {
  it("6. a sequência da família continua sendo da família", () => {
    const g = src("ayla/rotina-guiada.ts");
    expect(g).toMatch(/A SEQUÊNCIA DO QUADRO É A DA FAMÍLIA/);
  });

  it("7. confirmar × montar continua distinguido", () => {
    expect(src("ayla/rotina-guiada.ts")).toMatch(/CONFIRMAR OU MONTAR/);
  });

  it("8. o quadro ainda encolhe conforme a criança cresce", () => {
    // A regra vive na prontidão: o recorte proposto muda com a idade.
    expect(src("ayla/prontidao-rotina.ts")).toMatch(/QUAL RECORTE/);
  });
});
