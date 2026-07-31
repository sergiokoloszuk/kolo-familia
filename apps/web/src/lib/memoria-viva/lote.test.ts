import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  chaveDeMensagens,
  consolidarTextos,
  hashDoTexto,
  registrarLote,
  type MensagemDoLote,
} from "./lote";

/**
 * O lote é a resposta a uma pergunta só: **o que o extrator leu?**
 *
 * A prova contra Postgres está em `scripts/db/validar-lote.mjs`. Aqui ficam as
 * regras que não podem mudar sem alguém decidir mudá-las.
 */

describe("consolidarTextos", () => {
  it("junta na ordem recebida, com quebra de linha", () => {
    expect(consolidarTextos(["oi", "tudo bem?"])).toBe("oi\ntudo bem?");
  });

  it("descarta vazio e espaço — o extrator nunca viu linha em branco", () => {
    expect(consolidarTextos(["oi", "  ", null, undefined, "ok"])).toBe("oi\nok");
  });

  it("apara as pontas de cada mensagem", () => {
    expect(consolidarTextos(["  oi  ", "\nok\n"])).toBe("oi\nok");
  });
});

describe("chaveDeMensagens", () => {
  it("não depende da ordem do array — o conjunto é que identifica o lote", () => {
    expect(chaveDeMensagens(["a", "b", "c"])).toBe(chaveDeMensagens(["c", "a", "b"]));
  });

  it("mensagens diferentes dão chaves diferentes", () => {
    expect(chaveDeMensagens(["a", "b"])).not.toBe(chaveDeMensagens(["a", "b", "c"]));
  });

  it("é o CONJUNTO, não o texto: dizer a mesma frase amanhã é lote novo", () => {
    // Mesmo texto, linhas novas em ayla_messages → ids novos → chave nova.
    expect(chaveDeMensagens(["msg-hoje"])).not.toBe(chaveDeMensagens(["msg-amanha"]));
    // E o hash do texto, esse sim, coincide — por isso ele não pode ser a chave.
    expect(hashDoTexto("ele não come nada mole")).toBe(hashDoTexto("ele não come nada mole"));
  });
});

/** Cliente falso que registra o que foi gravado e simula o índice único. */
function bancoFalso(opcoes: { conflito?: boolean; erro?: boolean } = {}) {
  const gravados: Record<string, unknown>[] = [];
  const client = {
    from: () => {
      let payload: Record<string, unknown> | null = null;
      let ehUpsert = false;
      const api: Record<string, unknown> = {
        upsert: (p: Record<string, unknown>) => {
          payload = p;
          ehUpsert = true;
          return api;
        },
        select: () => api,
        eq: () => api,
        maybeSingle: async () => ({ data: { id: "lote-existente" }, error: null }),
        then: (resolve: (v: unknown) => unknown) => {
          if (!ehUpsert) return resolve({ data: [], error: null });
          if (opcoes.erro) return resolve({ data: null, error: { message: "falhou" } });
          if (opcoes.conflito) return resolve({ data: [], error: null });
          gravados.push(payload!);
          return resolve({ data: [{ id: "lote-novo" }], error: null });
        },
      };
      return api;
    },
  } as unknown as SupabaseClient;
  return { client, gravados };
}

const msg = (id: string, minuto: number, texto: string, zaap: string | null = `z-${id}`) =>
  ({
    mensagemId: id,
    provedorMessageId: zaap,
    recebidaEm: `2026-07-31T10:0${minuto}:00.000Z`,
    texto,
  }) satisfies MensagemDoLote;

describe("registrarLote", () => {
  it("ordena pela chegada, não pela ordem do array", async () => {
    const b = bancoFalso();
    const r = await registrarLote(b.client, {
      familyId: "fam",
      canal: "whatsapp",
      mensagens: [msg("c", 3, "terceira"), msg("a", 1, "primeira"), msg("b", 2, "segunda")],
    });

    expect(r?.texto).toBe("primeira\nsegunda\nterceira");
    const refs = b.gravados[0].mensagens as { ordem: number; mensagem_id: string }[];
    expect(refs.map((x) => x.mensagem_id)).toEqual(["a", "b", "c"]);
    expect(refs.map((x) => x.ordem)).toEqual([0, 1, 2]);
  });

  it("registra a ausência do id do provedor como nula, sem inventar", async () => {
    const b = bancoFalso();
    await registrarLote(b.client, {
      familyId: "fam",
      canal: "whatsapp",
      mensagens: [msg("a", 1, "áudio transcrito", null)],
    });
    const refs = b.gravados[0].mensagens as { provedor_message_id: string | null }[];
    expect(refs[0].provedor_message_id).toBeNull();
  });

  it("no conflito devolve o lote existente, marcado como reprocessamento", async () => {
    const b = bancoFalso({ conflito: true });
    const r = await registrarLote(b.client, {
      familyId: "fam",
      canal: "whatsapp",
      mensagens: [msg("a", 1, "oi")],
    });
    expect(r).toMatchObject({ id: "lote-existente", jaExistia: true });
    expect(b.gravados).toHaveLength(0);
  });

  it("falha do banco devolve null — nunca lança, senão derruba o turno da mãe", async () => {
    const b = bancoFalso({ erro: true });
    const r = await registrarLote(b.client, {
      familyId: "fam",
      canal: "whatsapp",
      mensagens: [msg("a", 1, "oi")],
    });
    expect(r).toBeNull();
  });

  it("rajada só de mensagens vazias não vira lote", async () => {
    const b = bancoFalso();
    const r = await registrarLote(b.client, {
      familyId: "fam",
      canal: "whatsapp",
      mensagens: [msg("a", 1, "   ")],
    });
    expect(r).toBeNull();
    expect(b.gravados).toHaveLength(0);
  });

  it("sem mensagem nenhuma não vira lote", async () => {
    const b = bancoFalso();
    expect(
      await registrarLote(b.client, { familyId: "fam", canal: "whatsapp", mensagens: [] }),
    ).toBeNull();
  });
});
