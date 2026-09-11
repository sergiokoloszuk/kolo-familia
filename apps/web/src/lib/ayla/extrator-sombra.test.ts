import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A SOMBRA NÃO PODE ESCREVER — PEND-194.
 *
 * ⚠️ O QUE ESTE ARQUIVO PROTEGE não é o resultado da medição: é o fato de ela
 * ser inofensiva. Uma medição que escreve no perfil de uma criança deixa de ser
 * medição e vira a migração inteira, sem revisão e sem flag. Por isso a metade
 * dos testes aqui é sobre o que NÃO acontece.
 */

const chamadasExtrair: unknown[] = [];
const eventos: Array<{ kind: string; payload?: Record<string, unknown>; severity?: string }> = [];
/** Toda operação de ESCRITA tentada no banco — tem de ficar vazia. */
const escritas: string[] = [];

/** Liga a falha do modelo para UMA chamada — sem precisar de spy. */
const falharNaProxima = { valor: false };

vi.mock("@/lib/conhecimento/extrair", () => ({
  extrairAtualizacoes: async (p: unknown) => {
    if (falharNaProxima.valor) {
      falharNaProxima.valor = false;
      throw new Error("modelo fora do ar");
    }
    chamadasExtrair.push(p);
    return {
      koloVivo: [
        { camada: "camada1", campo: "comunicacao", subcampo: "conversa", texto: "Conversa bem", operacao: "adicionar" },
        { camada: "camada1", campo: "emocional", subcampo: "outras", texto: "algo solto", operacao: "adicionar" },
        { camada: "camada2", campo: "dinamica", subcampo: null, texto: "família", operacao: "adicionar" },
      ],
      conquista: null,
      desafio: null,
      fatos: [],
      rejeitados: [{ candidato: {}, motivo: "subcampo_desconhecido", detalhe: "x" }],
    };
  },
}));

vi.mock("@/lib/kolo-vivo/incorporar", () => ({
  montarKoloVivoResumo: async () => "[criança/comunicacao] Outras observações: Conversa bem",
}));

vi.mock("@/lib/log", () => ({
  logEvent: async (e: { kind: string; payload?: Record<string, unknown>; severity?: string }) => {
    eventos.push(e);
  },
  logServerError: async () => {},
}));

const { medirExtratorEmSombra, extratorSombraLigado } = await import("./extrator-sombra");

/** Cliente que grita se alguém tentar escrever. */
const supabaseFalso = {
  from: (tabela: string) => ({
    insert: () => escritas.push(`insert:${tabela}`),
    update: () => escritas.push(`update:${tabela}`),
    upsert: () => escritas.push(`upsert:${tabela}`),
    delete: () => escritas.push(`delete:${tabela}`),
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
  }),
} as unknown as SupabaseClient;

const turno = {
  supabase: supabaseFalso,
  familyId: "fam-1",
  turnoId: "tn_abc123_xyz",
  membroId: "membro-1",
  membro: { nome: "Mario", idade: 9, perfil: "TEA" },
  historico: [{ de: "mae" as const, texto: "ele trava quando fica bravo" }],
  entrada: "Quero ajudar ele a se comunicar melhor quando fica frustrado.",
  via: "whatsapp_texto" as const,
  // A foto do perfil ANTES do aprendizado deste turno — PEND-200.
  koloVivoResumo: "",
};

beforeEach(() => {
  chamadasExtrair.length = 0;
  eventos.length = 0;
  escritas.length = 0;
  process.env.KOLO_EXTRATOR_SOMBRA = "1";
});
afterEach(() => {
  delete process.env.KOLO_EXTRATOR_SOMBRA;
});

describe("a flag manda", () => {
  it("desligada, não chama modelo nem emite evento", async () => {
    delete process.env.KOLO_EXTRATOR_SOMBRA;
    expect(extratorSombraLigado()).toBe(false);
    await medirExtratorEmSombra(turno);
    expect(chamadasExtrair).toHaveLength(0);
    expect(eventos).toHaveLength(0);
  });

  it("aceita `true` como o resto do repositório — e sem caixa", async () => {
    // ⚠️ ESTE TESTE NASCEU DE UM DEFEITO REAL. A primeira versão só aceitava
    // "1"; a variável foi configurada em produção, o deploy subiu e a sombra
    // continuou inerte. `AYLA_EXPERIMENTAL_TODAS` e `AYLA_POS_TRIAL` sempre
    // aceitaram os dois — inventar uma convenção nova custou um deploy.
    process.env.KOLO_EXTRATOR_SOMBRA = "TRUE";
    expect(extratorSombraLigado()).toBe(true);
    await medirExtratorEmSombra(turno);
    expect(chamadasExtrair).toHaveLength(1);
  });

  it("valor que não é 1 nem true continua desligada", async () => {
    for (const v of ["0", "sim", "on", "ligado", " "]) {
      process.env.KOLO_EXTRATOR_SOMBRA = v;
      expect(extratorSombraLigado()).toBe(false);
    }
    await medirExtratorEmSombra(turno);
    expect(chamadasExtrair).toHaveLength(0);
  });
});

describe("a sombra é inofensiva", () => {
  it("não escreve NADA no banco", async () => {
    await medirExtratorEmSombra(turno);
    expect(chamadasExtrair).toHaveLength(1);
    expect(escritas).toEqual([]);
  });

  it("sem criança resolvida, nem roda — não se adivinha dono de fato", async () => {
    await medirExtratorEmSombra({ ...turno, membroId: null });
    await medirExtratorEmSombra({ ...turno, membro: null });
    expect(chamadasExtrair).toHaveLength(0);
  });

  it("falha do extrator não derruba o turno, e fica visível", async () => {
    falharNaProxima.valor = true;
    await expect(medirExtratorEmSombra(turno)).resolves.toBeUndefined();
    expect(eventos.at(-1)?.kind).toBe("extrator_sombra_falhou");
    expect(eventos.at(-1)?.severity).toBe("warn");
  });
});

describe("o que a medição publica", () => {
  it("conta só camada1 e separa o que cairia no balde de sobra", async () => {
    await medirExtratorEmSombra(turno);
    const p = eventos[0].payload!;
    expect(eventos[0].kind).toBe("extrator_sombra");
    expect(p.n_itens).toBe(3);
    expect(p.n_camada1).toBe(2);
    // `emocional.outras` é o último sub-campo do domínio; `comunicacao.conversa` não é.
    expect(p.n_balde_de_sobra).toBe(1);
    expect(p.chaves).toEqual(["comunicacao.conversa", "emocional.outras"]);
    expect(p.motivos_rejeicao).toEqual({ subcampo_desconhecido: 1 });
  });

  it("NENHUMA palavra da família vai para o evento", async () => {
    await medirExtratorEmSombra(turno);
    const serializado = JSON.stringify(eventos[0]);
    expect(serializado).not.toContain("frustrado");
    expect(serializado).not.toContain("trava quando fica bravo");
    expect(serializado).not.toContain("Conversa bem");
  });

  /**
   * ⚠️ ESTE TESTE MUDOU DE LADO EM 11/09/2026, E DE PROPÓSITO — PEND-200.
   *
   * Ele afirmava que o transcript continha TAMBÉM a fala anterior
   * (`"Responsável: ele trava quando fica bravo"`). Era exatamente esse o
   * defeito: o histórico dentro da fonte extraível fez a sombra emitir dois
   * fatos da Manu num turno do Pedro. O histórico não sumiu — mudou de lugar,
   * e agora o teste prende o lugar novo.
   */
  it("o transcript tem SÓ a fala de agora; o histórico vai em contexto separado", async () => {
    await medirExtratorEmSombra({ ...turno, via: "whatsapp_audio" });
    const p = chamadasExtrair[0] as {
      transcript: string;
      contextoRecente: string;
      via: string;
      modo: string;
      entradaNormalizada: string;
      membro: unknown;
    };
    expect(p.via).toBe("whatsapp_audio");
    expect(p.transcript).toContain("Quero ajudar ele a se comunicar melhor");
    expect(p.transcript).not.toContain("ele trava quando fica bravo");
    expect(p.contextoRecente).toContain("Responsável: ele trava quando fica bravo");
    expect(p.membro).toEqual({ nome: "Mario", idade: 9, perfil: "TEA" });
  });

  it("a âncora é conferida contra a fala do turno, e o modo é estrito", async () => {
    await medirExtratorEmSombra(turno);
    const p = chamadasExtrair[0] as { modo: string; entradaNormalizada: string };
    expect(p.modo).toBe("estrito");
    // Sem isto a citação seria conferida contra o transcript inteiro, e a
    // fronteira voltaria a ser um pedido em prompt.
    expect(p.entradaNormalizada).toBe(turno.entrada);
  });

  it("turno sem histórico nenhum não quebra nem inventa contexto", async () => {
    await medirExtratorEmSombra({ ...turno, historico: [] });
    const p = chamadasExtrair[0] as { contextoRecente: string; transcript: string };
    expect(p.contextoRecente).toBe("");
    expect(p.transcript).toContain("Quero ajudar ele a se comunicar melhor");
  });

  it("a chamada é marcada como sombra, para o custo ser separável", async () => {
    await medirExtratorEmSombra(turno);
    const p = chamadasExtrair[0] as { meta: Record<string, unknown> };
    expect(p.meta).toMatchObject({ sombra: true });
  });
});

describe("o turno é rastreável — PEND-194 Fase 1", () => {
  it("o id do turno é persistido no evento, e é a MESMA chave de `turno_externo`", async () => {
    await medirExtratorEmSombra(turno);
    expect(eventos[0].payload!.turno).toBe("tn_abc123_xyz");
  });

  it("também vai no evento de FALHA — senão o turno que quebrou fica anônimo", async () => {
    falharNaProxima.valor = true;
    await medirExtratorEmSombra(turno);
    expect(eventos.at(-1)!.kind).toBe("extrator_sombra_falhou");
    expect(eventos.at(-1)!.payload!.turno).toBe("tn_abc123_xyz");
  });

  it("DOIS TURNOS PRÓXIMOS NÃO SE CONFUNDEM — o defeito que originou este campo", async () => {
    // ⚠️ NA MICROPROVA DE 11/09/2026 o pareamento foi por timestamp, e um dos
    // três turnos levou 36 s enquanto o seguinte levou 5 s. Com o debounce
    // agrupando mensagens, dois turnos consecutivos ficam a segundos um do
    // outro — e o relógio deixa de distinguir. Aqui os dois rodam sem nenhuma
    // pausa entre eles, que é o pior caso possível.
    await medirExtratorEmSombra({ ...turno, turnoId: "tn_primeiro" });
    await medirExtratorEmSombra({ ...turno, turnoId: "tn_segundo" });
    expect(eventos).toHaveLength(2);
    expect(eventos.map((e) => e.payload!.turno)).toEqual(["tn_primeiro", "tn_segundo"]);
    // E o id não pode vazar de um evento para o outro por referência comum.
    expect(eventos[0].payload!.turno).not.toBe(eventos[1].payload!.turno);
  });

  it("o id não substitui a anonimização: continua sem palavra da família", async () => {
    await medirExtratorEmSombra(turno);
    const s = JSON.stringify(eventos[0]);
    expect(s).toContain("tn_abc123_xyz");
    expect(s).not.toContain("frustrado");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
/**
 * A FOTOGRAFIA TEMPORAL — PEND-200.
 *
 * ⚠️ O DEFEITO QUE ESTE BLOCO PRENDE não é de estrutura: é de RELÓGIO. A
 * sombra montava o Kolo Vivo por conta própria e roda depois de
 * `persistirRegistro`, então perguntava "o que há de novo?" a um perfil em que
 * o fato do turno já tinha sido escrito — pelo caminho contra o qual ela está
 * sendo comparada. Com a regra de novidade do extrator, a resposta certa
 * passava a ser "nada", e a medição anotava isso como recall perdido.
 *
 * Bancada do Lucas: produção 7/12 turnos com fato; replay dos MESMOS turnos
 * com a foto anterior, 11/12.
 */
describe("a sombra vê o perfil de ANTES do turno — PEND-200", () => {
  it("recebe a foto de fora e a entrega ao extrator sem mexer", async () => {
    const foto = "[criança/sono] Como costuma ser o sono: Acorda à noite";
    await medirExtratorEmSombra({ ...turno, koloVivoResumo: foto });
    const p = chamadasExtrair[0] as { koloVivoResumo: string };
    expect(p.koloVivoResumo).toBe(foto);
  });

  it("PERFIL VIRGEM: a foto vazia chega vazia — o fato do turno pode ser novo", async () => {
    // O turno 1 de uma criança recém-criada. Se a sombra relesse o perfil aqui,
    // já veria o que `persistirRegistro` acabou de gravar.
    await medirExtratorEmSombra({ ...turno, koloVivoResumo: "" });
    const p = chamadasExtrair[0] as { koloVivoResumo: string };
    expect(p.koloVivoResumo).toBe("");
  });

  it("PERFIL QUE JÁ TINHA O FATO: a foto leva o fato, e a novidade é do extrator julgar", async () => {
    // O outro lado da moeda, e é o que mantém a medição honesta: quando o fato
    // JÁ existia antes do turno, a foto tem de dizer isso.
    const comFato = "[criança/comunicacao] Conversa e argumentação: trava quando fica bravo";
    await medirExtratorEmSombra({ ...turno, koloVivoResumo: comFato });
    const p = chamadasExtrair[0] as { koloVivoResumo: string };
    expect(p.koloVivoResumo).toContain("trava quando fica bravo");
  });

  it("as duas fotos produzem entradas DIFERENTES para o mesmo turno", async () => {
    await medirExtratorEmSombra({ ...turno, koloVivoResumo: "" });
    await medirExtratorEmSombra({ ...turno, koloVivoResumo: "[criança/sono] X" });
    const a = chamadasExtrair[0] as { koloVivoResumo: string };
    const b = chamadasExtrair[1] as { koloVivoResumo: string };
    expect(a.koloVivoResumo).not.toBe(b.koloVivoResumo);
  });

  it("continua sem escrever nada, com foto ou sem ela", async () => {
    await medirExtratorEmSombra({ ...turno, koloVivoResumo: "[criança/sono] X" });
    expect(escritas).toEqual([]);
  });

  it("falha da sombra não vaza para o turno, e a foto não muda isso", async () => {
    falharNaProxima.valor = true;
    await expect(
      medirExtratorEmSombra({ ...turno, koloVivoResumo: "[criança/sono] X" }),
    ).resolves.toBeUndefined();
    expect(eventos.at(-1)?.kind).toBe("extrator_sombra_falhou");
    expect(escritas).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("sabotagem — devolver a releitura do perfil para depois da escrita", () => {
  const SRC = readFileSync(new URL("./extrator-sombra.ts", import.meta.url), "utf8");
  const ORQ = readFileSync(new URL("./orchestrator.ts", import.meta.url), "utf8");

  it("a sombra NÃO monta o Kolo Vivo por conta própria", () => {
    // Se alguém reintroduzir a chamada aqui, a foto volta a sair depois da
    // escrita e o recall volta a ser medido errado.
    expect(SRC).not.toMatch(/montarKoloVivoResumo/);
    expect(SRC).toMatch(/koloVivoResumo: t\.koloVivoResumo/);
  });

  it("o orquestrador tira a foto ANTES de `persistirRegistro`", () => {
    const foto = ORQ.indexOf("const koloVivoAntesDoTurno");
    const escrita = ORQ.indexOf("await persistirRegistro(supabase, family.id, parsedExp, {");
    const sombra = ORQ.indexOf("const turnoParaExtrator = {");
    expect(foto).toBeGreaterThan(0);
    expect(escrita).toBeGreaterThan(0);
    // A ordem é o invariante inteiro: FOTO → ESCRITA → SOMBRA.
    expect(foto).toBeLessThan(escrita);
    expect(escrita).toBeLessThan(sombra);
  });

  it("a escrita real NÃO foi movida para depois da sombra", () => {
    // O outro jeito de "consertar" isto seria rodar a sombra antes de
    // persistir. Funcionaria para a medição e atrasaria o aprendizado real —
    // e o aprendizado é do produto, a medição é nossa.
    const escrita = ORQ.indexOf("await persistirRegistro(supabase, family.id, parsedExp, {");
    const sombra = ORQ.indexOf("const turnoParaExtrator = {");
    expect(escrita).toBeLessThan(sombra);
  });

  it("a foto só custa consulta quando a flag está ligada", () => {
    const bloco = ORQ.slice(
      ORQ.indexOf("const koloVivoAntesDoTurno"),
      ORQ.indexOf("await persistirRegistro(supabase, family.id, parsedExp, {"),
    );
    expect(bloco).toMatch(/extratorSombraLigado\(\)/);
  });

  it("o turno entregue ao extrator recebe a foto — e não uma montada na hora", () => {
    const chamada = ORQ.slice(ORQ.indexOf("const turnoParaExtrator = {"));
    expect(chamada).toMatch(/koloVivoResumo: koloVivoAntesDoTurno/);
  });
});
