import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aplicarRotina, perguntaDeTema, temaEnunciado } from "./rotina-guiada";

const CODIGO = readFileSync(new URL("./rotina-guiada.ts", import.meta.url), "utf8");

describe("novo pedido de rotina não substitui o anterior", () => {
  it("insere outro quadro e suas etapas, sem ler ou apagar o quadro homônimo", async () => {
    const operacoes: string[] = [];
    const db = {
      from(tabela: string) {
        return {
          insert(linhas: unknown) {
            operacoes.push(`insert:${tabela}`);
            if (tabela === "rotinas") {
              expect(linhas).toMatchObject({ nome: "Rotina visual de Manu", tema: null });
              return { select: () => ({ single: async () => ({ data: { id: "novo-id" }, error: null }) }) };
            }
            expect(linhas).toMatchObject([{ rotina_id: "novo-id", texto: "Almoço" }]);
            return Promise.resolve({ error: null });
          },
          select() { throw new Error("não deve procurar rotina antiga pelo nome"); },
          delete() { throw new Error("não deve apagar etapas da rotina antiga"); },
        };
      },
    } as unknown as SupabaseClient;
    const id = await aplicarRotina(db, "familia", "manu", {
      nome: "Rotina visual de Manu",
      dia_semana: null,
      tarefas: [{ texto: "Almoço", hora: null }],
    } as never, null, true);
    expect(id).toBe("novo-id");
    expect(operacoes).toEqual(["insert:rotinas", "insert:rotina_tarefas"]);
  });

  it("continuação pode transformar o quadro existente em visual", async () => {
    const operacoes: string[] = [];
    const db = {
      from(tabela: string) {
        if (tabela === "rotinas") return {
          select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({
            is: () => ({ maybeSingle: async () => ({ data: { id: "antigo-id" }, error: null }) }),
          }) }) }) }),
          update: () => ({ eq: async () => { operacoes.push("atualizar:antigo-id"); return { error: null }; } }),
          insert: () => { throw new Error("não deve criar cópia na continuação"); },
        };
        return {
          delete: () => ({ eq: async () => { operacoes.push("apagar-etapas:antigo-id"); return { error: null }; } }),
          insert: async () => { operacoes.push("gravar-etapas:antigo-id"); return { error: null }; },
        };
      },
    } as unknown as SupabaseClient;
    const id = await aplicarRotina(db, "familia", "manu", {
      nome: "Rotina visual de Manu", dia_semana: null,
      tarefas: [{ texto: "Almoço", hora: null }],
    } as never, null, true, true);
    expect(id).toBe("antigo-id");
    expect(operacoes).toEqual(["atualizar:antigo-id", "apagar-etapas:antigo-id", "gravar-etapas:antigo-id"]);
  });
});

describe("tema e segundo link", () => {
  it("pergunta o tema quando a sequência nova não o traz", () => {
    expect(temaEnunciado("Quero uma rotina visual para Manu\nAlmoço\nDentista\nVoltar")) .toBeNull();
    expect(perguntaDeTema("Manu", ["Cozinha"])).toContain("1️⃣ *Cozinha*");
    expect(CODIGO).toContain("ditouAgora ? null : temaConfirmadoNestaRotina");
    expect(CODIGO).toContain("const faltaTema = visual && ids.length > 0 && !tema");
  });

  it("o link direto só nasce depois da escolha do tema", () => {
    expect(CODIGO).toContain("const link = ids.length && !faltaTema");
    expect(CODIGO).not.toContain('gerarMagicLink(supabase, { familyId, next: "/ludico/rotinas" })');
    expect(CODIGO).toContain("*Abra a rotina de ${nome}*");
    expect(CODIGO).not.toContain("Em kolofamilia.com.br:");
  });
});
