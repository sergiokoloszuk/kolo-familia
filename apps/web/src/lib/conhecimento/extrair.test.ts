import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── o modelo é falso, as guardas são de verdade ─────────────────────────────
//
// O que este arquivo prova é o que o CÓDIGO faz com o que o modelo devolveu.
// O que o modelo devolveria de verdade não é testável aqui, e fingir que é
// seria trocar prova por encenação. Por isso a saída do modelo é estipulada em
// cada caso, e o que se afirma é sempre sobre o que vem DEPOIS dela.

const respostaDoModelo = { valor: "" };
const usoDoModelo = { input: 1234, output: 56 };
let deveFalhar = false;

vi.mock("@/lib/ia/anthropic", () => ({
  MODELS: { principal: "claude-sonnet-4-6", leve: "claude-haiku-4-5" },
  getAnthropicClient: () => ({
    messages: {
      stream: () => {
        if (deveFalhar) throw new Error("modelo fora do ar");
        return {
          finalMessage: async () => ({
            content: [{ type: "text", text: respostaDoModelo.valor }],
            usage: { input_tokens: usoDoModelo.input, output_tokens: usoDoModelo.output },
          }),
        };
      },
    },
  }),
}));

const logs: Array<Record<string, unknown>> = [];
vi.mock("@/lib/billing/logar", () => ({
  logarUsoApi: async (_c: unknown, p: Record<string, unknown>) => {
    logs.push(p);
  },
}));

const { extrairAtualizacoes } = await import("./extrair");

const MEMBRO = { nome: "Téo", idade: 5, perfil: "autista" };
const EM = "2026-08-22T12:00:00.000Z";
const supabaseFalso = {} as never;

const rodar = (
  modelo: unknown,
  extra: Partial<Parameters<typeof extrairAtualizacoes>[0]> = {},
) => {
  respostaDoModelo.valor = typeof modelo === "string" ? modelo : JSON.stringify(modelo);
  return extrairAtualizacoes({
    transcript: extra.transcript ?? "Ele fala algumas palavras.",
    koloVivoResumo: "",
    membro: MEMBRO,
    supabase: supabaseFalso,
    familyId: "fam-1",
    via: "web_conversa",
    em: EM,
    ...extra,
  });
};

const kv = (itens: unknown[]) => ({ kolo_vivo: itens, conquista: null, desafio: null });

beforeEach(() => {
  logs.length = 0;
  deveFalhar = false;
  usoDoModelo.input = 1234;
  usoDoModelo.output = 56;
});

// ─────────────────────────────────────────────────────────────────────────────
describe("A · INSTRUMENTAÇÃO — a lacuna que motivou esta fase", () => {
  it("1. toda extração vira uma linha em api_calls, com feature própria", async () => {
    await rodar(kv([{ camada: "camada1", campo: "sono", texto: "demora", operacao: "adicionar" }]));
    expect(logs).toHaveLength(1);
    expect(logs[0].feature).toBe("extrair_conhecimento");
    expect(logs[0].provider).toBe("anthropic");
    expect(logs[0].model).toBe("claude-sonnet-4-6");
  });

  it("2. os tokens medidos são os do modelo, não uma estimativa", async () => {
    usoDoModelo.input = 4321;
    usoDoModelo.output = 99;
    await rodar(kv([]));
    expect(logs[0].input_tokens).toBe(4321);
    expect(logs[0].output_tokens).toBe(99);
  });

  it("3. a família é atribuída — custo por família é o que o /admin/uso-api mostra", async () => {
    await rodar(kv([]));
    expect(logs[0].family_account_id).toBe("fam-1");
  });

  it("4. canal, modo, duração e sucesso ficam em `meta` — sem tabela nova de métrica", async () => {
    await rodar(kv([]), { via: "whatsapp_audio", meta: { origem: "webhook" } });
    const meta = logs[0].meta as Record<string, unknown>;
    expect(meta.via).toBe("whatsapp_audio");
    expect(meta.modo).toBe("compativel");
    expect(meta.ok).toBe(true);
    expect(typeof meta.duracao_ms).toBe("number");
    expect(meta.origem).toBe("webhook");
  });

  it("5. FALHA do modelo também é medida — antes ela era invisível dos dois lados", async () => {
    deveFalhar = true;
    const r = await rodar(kv([]));
    expect(r.koloVivo).toEqual([]);
    expect(logs).toHaveLength(1);
    expect((logs[0].meta as Record<string, unknown>).ok).toBe(false);
  });

  it("6. sem cliente, extrai e só não mede — telemetria nunca é pré-requisito de funcionar", async () => {
    const r = await rodar(
      kv([{ camada: "camada1", campo: "sono", texto: "demora", operacao: "adicionar" }]),
      { supabase: null },
    );
    expect(logs).toHaveLength(0);
    expect(r.koloVivo).toHaveLength(1);
  });

  it("7. a web passa SERVICE ROLE — com a sessão da família a RLS recusa o INSERT", () => {
    const conversa = readFileSync(
      resolve(__dirname, "../../app/(app)/conversar/actions.ts"),
      "utf8",
    );
    const diario = readFileSync(
      resolve(__dirname, "../../app/(app)/registrar/diario/actions.ts"),
      "utf8",
    );
    for (const src of [conversa, diario]) {
      const chamada = src.slice(src.indexOf("extrairAtualizacoes({"));
      expect(chamada).toMatch(/supabase: createServiceRoleClient\(\)/);
      expect(chamada).toMatch(/via: "web_(conversa|diario)"/);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("B · CONSOLIDAÇÃO — mesma entrada, mesma saída estrutural", () => {
  // ANTES: `lib/ia/atualizar.ts` devolvia { koloVivo, conquista, desafio }.
  // DEPOIS: o mesmo, de `lib/conhecimento/extrair.ts`, mais `fatos` e
  // `rejeitados`. Nenhum campo antigo mudou de nome, tipo ou semântica.
  const LOTE = kv([
    { camada: "camada1", campo: "nutricional", subcampo: "rejeita", texto: "folhas", operacao: "adicionar" },
    { camada: "camada1", campo: "sono", subcampo: "outras", texto: "demora pra dormir", operacao: "adicionar" },
    { camada: "camada2", campo: "recursos", texto: "faz fono 2x por semana", operacao: "adicionar" },
  ]);

  it("8. o formato legado sai exatamente como saía", async () => {
    const r = await rodar({ ...LOTE, conquista: "comeu brócolis", desafio: "birra no mercado" });
    expect(r.koloVivo).toEqual([
      { camada: "camada1", campo: "nutricional", subcampo: "rejeita", texto: "folhas", operacao: "adicionar" },
      { camada: "camada1", campo: "sono", subcampo: "outras", texto: "demora pra dormir", operacao: "adicionar" },
      { camada: "camada2", campo: "recursos", subcampo: null, texto: "faz fono 2x por semana", operacao: "adicionar" },
    ]);
    expect(r.conquista).toBe("comeu brócolis");
    expect(r.desafio).toBe("birra no mercado");
  });

  it("9. `koloVivo` é DERIVADO de `fatos` — uma decisão, um dono", async () => {
    const r = await rodar(LOTE);
    expect(r.koloVivo).toHaveLength(r.fatos.length);
    r.koloVivo.forEach((it, i) => {
      expect(it.campo).toBe(r.fatos[i].campo);
      expect(it.texto).toBe(r.fatos[i].valor);
      expect(it.subcampo).toBe(r.fatos[i].subcampo);
    });
  });

  it("10. sem membro, camada1 continua caindo fora e conquista/desafio zerados", async () => {
    const r = await rodar({ ...LOTE, conquista: "x", desafio: "y" }, { membro: null });
    expect(r.koloVivo.every((it) => it.camada === "camada2")).toBe(true);
    expect(r.conquista).toBeNull();
    expect(r.desafio).toBeNull();
  });

  it("11. JSON inválido continua devolvendo proposta vazia, sem lançar", async () => {
    const r = await rodar("isto não é json");
    expect(r).toMatchObject({ koloVivo: [], conquista: null, desafio: null, fatos: [] });
  });

  it("12. JSON em cerca ```json continua sendo lido", async () => {
    const r = await rodar(
      "```json\n" + JSON.stringify(kv([{ camada: "camada1", campo: "sono", texto: "ok", operacao: "adicionar" }])) + "\n```",
    );
    expect(r.koloVivo).toHaveLength(1);
  });

  it("13. o endereço antigo ainda funciona — é reexport, não cópia", async () => {
    const shim = readFileSync(resolve(__dirname, "../ia/atualizar.ts"), "utf8");
    expect(shim).toMatch(/export \{[\s\S]*\} from "@\/lib\/conhecimento\/extrair"/);
    expect(shim).not.toMatch(/messages\.stream|SUBCAMPOS_DOMINIO|PropostaSchema/);
  });

  it("14. o merge do Kolo Vivo é UM — a cópia local saiu de conversar/actions.ts", () => {
    const src = readFileSync(resolve(__dirname, "../../app/(app)/conversar/actions.ts"), "utf8");
    expect(src).not.toMatch(/^function aplicarTextoCampo\(/m);
    expect(src).not.toMatch(/^function appendFato\(/m);
    expect(src).toMatch(
      /import \{ appendFato, aplicarTextoCampo \} from "@\/lib\/kolo-vivo\/incorporar"/,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("C · GUARDAS ligadas ao extrator", () => {
  it("15. fato inválido é rejeitado COM MOTIVO, não some", async () => {
    const r = await rodar(
      kv([
        { camada: "camada1", campo: "comunicacao", subcampo: "forma", texto: "Fala frases curtas", operacao: "reescrever" },
        { camada: "camada1", campo: "telepatia", texto: "lê pensamentos", operacao: "adicionar" },
      ]),
    );
    expect(r.koloVivo).toHaveLength(0);
    expect(r.rejeitados.map((x) => x.motivo)).toEqual([
      "valor_fora_das_opcoes",
      "campo_desconhecido",
    ]);
  });

  it("16. a procedência vem do pipeline em todo fato aceito", async () => {
    const r = await rodar(
      kv([{ camada: "camada1", campo: "sono", texto: "demora", operacao: "adicionar" }]),
      { via: "whatsapp_audio" },
    );
    expect(r.fatos[0].procedencia).toEqual({ por: "familia", via: "whatsapp_audio", em: EM });
    expect(r.fatos[0].habilidade_id).toBe("sono.outras");
  });

  it("17. citação é conferida contra a ENTRADA da família, não contra o transcript inteiro", async () => {
    // O transcript carrega também a fala da Kolo. Uma citação que só existe na
    // resposta da assistente é a Ayla se citando como fonte.
    const r = await rodar(
      kv([{ camada: "camada1", campo: "sono", texto: "x", operacao: "adicionar", citacao: "experimente luz baixa" }]),
      {
        transcript: "MÃE: ele demora pra dormir\nKOLO: experimente luz baixa",
        entradaNormalizada: "ele demora pra dormir",
      },
    );
    expect(r.koloVivo).toHaveLength(0);
    expect(r.rejeitados[0].motivo).toBe("citacao_nao_comprovada");
  });

  it("18. o modo estrito só existe atrás de parâmetro — a web não passa por ele", () => {
    const conversa = readFileSync(
      resolve(__dirname, "../../app/(app)/conversar/actions.ts"),
      "utf8",
    );
    expect(conversa).not.toMatch(/modo: "estrito"/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("D · PARIDADE — a mesma informação, pelos três caminhos", () => {
  // A exigência não é resposta idêntica: é CONHECIMENTO equivalente. Mesma
  // informação sobre a criança → mesmo habilidade_id, mesmo valor. A única
  // diferença legítima é metadado de procedência.
  const FALA = "Ele fala algumas palavras e aponta quando quer água.";
  const SAIDA = kv([
    { camada: "camada1", campo: "comunicacao", subcampo: "forma", texto: "Fala palavras soltas", operacao: "reescrever" },
    { camada: "camada1", campo: "comunicacao", subcampo: "mostra", texto: "aponta quando quer água", operacao: "adicionar" },
  ]);

  const canais = [
    { via: "web_conversa" as const, transcript: `MÃE: ${FALA}` },
    { via: "whatsapp_texto" as const, transcript: FALA },
    { via: "whatsapp_audio" as const, transcript: FALA },
  ];

  it("19. os três produzem o MESMO conhecimento estrutural", async () => {
    const saidas = [];
    for (const c of canais) {
      const r = await rodar(SAIDA, { via: c.via, transcript: c.transcript, entradaNormalizada: FALA });
      saidas.push(r.fatos.map((f) => `${f.habilidade_id}=${f.valor}`));
    }
    expect(saidas[0]).toEqual(["comunicacao.forma=Fala palavras soltas", "comunicacao.mostra=aponta quando quer água"]);
    expect(saidas[1]).toEqual(saidas[0]);
    expect(saidas[2]).toEqual(saidas[0]);
  });

  it("20. e diferem SÓ no metadado de procedência", async () => {
    const vias = [];
    for (const c of canais) {
      const r = await rodar(SAIDA, { via: c.via, transcript: c.transcript, entradaNormalizada: FALA });
      vias.push(r.fatos.map((f) => f.procedencia.via));
      expect(r.fatos.every((f) => f.procedencia.por === "familia")).toBe(true);
      expect(r.fatos.every((f) => f.procedencia.em === EM)).toBe(true);
    }
    expect(vias).toEqual([
      ["web_conversa", "web_conversa"],
      ["whatsapp_texto", "whatsapp_texto"],
      ["whatsapp_audio", "whatsapp_audio"],
    ]);
  });

  it("21. áudio é diferença de ENTRADA — não há ramo de código por canal", () => {
    const src = readFileSync(resolve(__dirname, "extrair.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    // `via` só pode ser carimbo. Se virar condição, existem dois cérebros de novo.
    expect(src).not.toMatch(/if\s*\([^)]*via\s*===/);
    expect(src).not.toMatch(/switch\s*\(\s*via\s*\)/);
  });
});
