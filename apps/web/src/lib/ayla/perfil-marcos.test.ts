import { describe, it, expect } from "vitest";
import { detectarMarcos } from "@/lib/kolo-vivo/incorporar";
import { marcosRecentes, montarContextoBase } from "./experimental-contexto";

/**
 * A TRANSIÇÃO VIRA HISTÓRIA, E A HISTÓRIA CHEGA AO MODELO — PEND-090, Peças 1 e 2.
 *
 * ═══ O QUE ESTAVA ERRADO ═══
 *
 * O caminho de escrita da Ayla (`aplicarSugestaoNoMembro`) sobrescrevia o
 * seletor de um domínio em silêncio: uma criança registrada como "Não-verbal"
 * que passa a "Fala palavras soltas" perdia o valor anterior sem deixar rastro.
 *
 * `detectarMarcos` — que produz exatamente `"Como se comunica: Não-verbal →
 * Fala palavras soltas"`, datado — já existia e já era chamado pelo Registro
 * Diário e pelo editor da web. O caminho da Ayla, que é o que mais escreve, não
 * o chamava.
 *
 * MEDI em produção antes de corrigir: **1 perfil de 128 tinha marcos**.
 *
 * ═══ POR QUE SÓ SELETOR ═══
 *
 * Marco nasce de transição DISCRETA (sub-campo com `opcoes`). Texto livre não
 * vira marco — e é isso que impede o mecanismo de virar fiscal: diferença de
 * contexto ("na escola faz, em casa não") e ambiguidade de linguagem ("pediu
 * sorvete" pode ser apontando) não produzem alarme nenhum.
 */

const HOJE = new Date("2026-08-17T12:00:00Z");

describe("Peça 1 · a transição é detectada", () => {
  it("1. seletor que muda vira marco datado, no formato ANTES → AGORA", () => {
    const antes = "Como se comunica: Não-verbal";
    const depois = "Como se comunica: Fala palavras soltas";
    const m = detectarMarcos("comunicacao", antes, depois, "2026-08-17T12:00:00Z");
    expect(m).toHaveLength(1);
    expect(m[0]!.texto).toBe("Como se comunica: Não-verbal → Fala palavras soltas");
    expect(m[0]!.data).toBe("2026-08-17");
    expect(m[0]!.dominio).toBe("comunicacao");
  });

  it("2. MORDE: a PRIMEIRA vez que se preenche NÃO é marco", () => {
    // Cadastro inicial não é evolução — seria história inventada.
    const m = detectarMarcos("comunicacao", "", "Como se comunica: Não-verbal", "2026-08-17T12:00:00Z");
    expect(m).toHaveLength(0);
  });

  it("3. mesmo valor reescrito não vira marco", () => {
    const t = "Como se comunica: Fala frases";
    expect(detectarMarcos("comunicacao", t, t, "2026-08-17T12:00:00Z")).toHaveLength(0);
  });

  it("4. MORDE: TEXTO LIVRE não vira marco — é o que impede o fiscal", () => {
    // "na escola faz" × "em casa não" são as duas verdadeiras. Nem isso, nem
    // "pediu sorvete" (que pode ter sido apontando), podem virar alarme.
    const m = detectarMarcos(
      "comunicacao",
      "Outras observações: em casa não pede",
      "Outras observações: em casa não pede\nNa escola pediu água",
      "2026-08-17T12:00:00Z",
    );
    expect(m).toHaveLength(0);
  });

  it("5. o caminho da Ayla chama o detector — e é o MESMO dos outros caminhos", async () => {
    const fonte = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./orchestrator.ts", import.meta.url), "utf8"),
    );
    const bloco = fonte.slice(
      fonte.indexOf("async function aplicarSugestaoNoMembro"),
      fonte.indexOf("async function aplicarSugestaoNoMembro") + 3000,
    );
    expect(bloco, "o caminho da Ayla voltou a sobrescrever sem registrar").toMatch(
      /detectarMarcos\(campo, prev, novoTexto, now\)/,
    );
    // Importado, não reimplementado: um segundo detector divergiria do primeiro.
    expect(fonte).toMatch(/import \{ detectarMarcos, type Marco \} from "@\/lib\/kolo-vivo\/incorporar"/);
  });
});

describe("Peça 2 · a mudança chega ao modelo", () => {
  const comMarco = (data: string) =>
    ({
      categorias_extras: {
        marcos: [{ data, dominio: "comunicacao", texto: "Como se comunica: Não-verbal → Fala palavras soltas" }],
      },
    }) as never;

  it("6. marco recente entra, com a data", () => {
    const r = marcosRecentes(comMarco("2026-08-15"), HOJE);
    expect(r).toHaveLength(1);
    expect(r[0]).toContain("2026-08-15");
    expect(r[0]).toContain("Não-verbal → Fala palavras soltas");
  });

  it("7. MORDE: marco velho NÃO entra — não é assunto de hoje", () => {
    expect(marcosRecentes(comMarco("2026-04-01"), HOJE)).toHaveLength(0);
  });

  it("8. marco sem data é descartado", () => {
    const pv = {
      categorias_extras: { marcos: [{ dominio: "comunicacao", texto: "algo → outra coisa" }] },
    } as never;
    expect(marcosRecentes(pv, HOJE)).toHaveLength(0);
  });

  it("9. perfil sem marcos devolve lista vazia, sem quebrar", () => {
    expect(marcosRecentes(null, HOJE)).toEqual([]);
    expect(marcosRecentes({ categorias_extras: {} } as never, HOJE)).toEqual([]);
    expect(marcosRecentes({ categorias_extras: { marcos: "isto não é lista" } } as never, HOJE)).toEqual([]);
  });

  it("10. no máximo 3, mais recentes primeiro", () => {
    const pv = {
      categorias_extras: {
        marcos: [
          { data: "2026-08-01", dominio: "a", texto: "a: x → y" },
          { data: "2026-08-16", dominio: "b", texto: "b: x → y" },
          { data: "2026-08-10", dominio: "c", texto: "c: x → y" },
          { data: "2026-08-14", dominio: "d", texto: "d: x → y" },
        ],
      },
    } as never;
    const r = marcosRecentes(pv, HOJE);
    expect(r).toHaveLength(3);
    expect(r[0]).toContain("2026-08-16");
    expect(r[2]).toContain("2026-08-10");
  });
});

describe("o bloco de contexto", () => {
  const MEMBRO = { nome: "Manu", data_nascimento: "2020-03-01", diagnosticos_formais: null, genero: "feminino" };

  it("11. com marco recente, a linha aparece", () => {
    const { bloco } = montarContextoBase({
      nomeResponsavel: "Karina",
      membro: MEMBRO,
      perfilVivo: {
        categorias_extras: {
          marcos: [{ data: "2026-08-15", dominio: "comunicacao", texto: "Como se comunica: Não-verbal → Fala palavras soltas" }],
        },
      } as never,
    });
    expect(bloco).toContain("Mudou recentemente (registrado):");
    expect(bloco).toContain("Não-verbal → Fala palavras soltas");
  });

  it("12. MORDE: sem marco, o bloco fica byte a byte igual ao de antes", () => {
    const perfil = { como_e: { interesses: ["dinossauros"] } } as never;
    const { bloco } = montarContextoBase({ nomeResponsavel: "Karina", membro: MEMBRO, perfilVivo: perfil });
    expect(bloco).not.toContain("Mudou recentemente");
    expect(bloco).toContain("Criança: Manu, 6 anos");
    expect(bloco).toContain("dinossauros");
  });

  it("13. o marco NÃO vira lacuna — nada é perguntado por causa dele", () => {
    const { lacunas } = montarContextoBase({
      nomeResponsavel: "Karina",
      membro: MEMBRO,
      perfilVivo: {
        categorias_extras: {
          marcos: [{ data: "2026-08-15", dominio: "comunicacao", texto: "x → y" }],
        },
      } as never,
    });
    expect(lacunas.join(" ")).not.toContain("mudança");
    expect(lacunas.join(" ")).not.toContain("marco");
  });
});
