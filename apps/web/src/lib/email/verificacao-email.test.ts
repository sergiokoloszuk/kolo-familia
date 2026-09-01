import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * A TROCA DE E-MAIL PROVANDO SÓ O ENDEREÇO NOVO — as garantias, exercitadas.
 *
 * ⚠️ Não é teste de texto: monta um cliente de banco falso EM MEMÓRIA e roda
 * as funções de verdade. O que está sendo medido é comportamento — uso único,
 * expiração, teto de tentativas, teto de reenvios, cooldown, concorrência e a
 * ordem "provar antes de gravar".
 *
 * A regra que sustenta tudo: **o endereço novo só chega em `auth.users` depois
 * do código bater**. Enquanto não bate, ele mora em `verificacoes_email`, onde
 * não é e-mail de login nem endereço de recuperação — então um e-mail digitado
 * errado nunca vira o endereço para onde vai o link de "esqueci minha senha".
 */

const ATUAL = "mae@antigo.com";
const NOVO = "mae@novo.com";
const USER = "11111111-1111-1111-1111-111111111111";
const OUTRO_USER = "22222222-2222-2222-2222-222222222222";

// ---- estado do mundo falso -------------------------------------------------
let linhas: Map<string, Record<string, unknown>>;
let usuarios: Map<string, { email: string }>;
let enviados: Array<{ to: string; text: string }>;
let falharEnvio: boolean;
let falharTroca: string | null;
let falharFiltro: boolean;

vi.mock("./mailer", () => ({
  send: async (o: { to: string; text?: string }) => {
    if (falharEnvio) throw new Error("SMTP fora do ar (com envelope secreto)");
    enviados.push({ to: o.to, text: o.text ?? "" });
    return { messageId: "x", response: "250", accepted: [o.to], rejected: [] };
  },
}));

vi.mock("@/lib/log", () => ({
  logEvent: async (e: unknown) => {
    eventos.push(e as Record<string, unknown>);
  },
  logServerError: async (k: string, e: unknown, ctx?: unknown) => {
    eventos.push({ kind: k, erro: String(e), ...(ctx as object) });
  },
}));
let eventos: Array<Record<string, unknown>>;

/** Cliente Supabase falso, só com o que estas funções usam. */
function fakeAdmin() {
  const tabela = (nome: string) => {
    if (nome !== "verificacoes_email") throw new Error("tabela inesperada: " + nome);
    let filtroUser: string | null = null;
    let filtroEmail: string | null = null;
    let exigeNulo = false;
    const api = {
      select() {
        return {
          eq(_c: string, v: string) {
            filtroUser = v;
            return {
              maybeSingle: async () => ({ data: linhas.get(filtroUser!) ?? null }),
            };
          },
        };
      },
      async upsert(row: Record<string, unknown>) {
        // `updated_at` vem do banco: `default now()` no insert e o trigger
        // `verificacoes_email_set_updated_at` no update (0085). O cooldown lê
        // esse campo, então o dublê precisa preenchê-lo — senão o teste mede
        // um `new Date(undefined)` e não o mecanismo.
        linhas.set(row.user_id as string, {
          ...row,
          updated_at: new Date().toISOString(),
        });
        return { error: null };
      },
      update(patch: Record<string, unknown>) {
        const chain = {
          eq(coluna: string, v: string) {
            if (coluna === "user_id") filtroUser = v;
            else filtroEmail = v;
            return chain;
          },
          is(_c: string, _v: null) {
            exigeNulo = true;
            return chain;
          },
          select() {
            const atual = linhas.get(filtroUser!);
            const casa =
              atual &&
              (!filtroEmail || atual.email_novo === filtroEmail) &&
              (!exigeNulo || atual.confirmado_em == null);
            if (casa) {
              linhas.set(filtroUser!, { ...atual, ...patch });
              return Promise.resolve({ data: [{ user_id: filtroUser }], error: null });
            }
            return Promise.resolve({ data: [], error: null });
          },
          then(res: (v: { error: null }) => unknown) {
            const atual = linhas.get(filtroUser!);
            if (atual) linhas.set(filtroUser!, { ...atual, ...patch });
            return Promise.resolve(res({ error: null }));
          },
        };
        return chain;
      },
      delete() {
        return {
          eq(_c: string, v: string) {
            linhas.delete(v);
            return Promise.resolve({ error: null });
          },
        };
      },
    };
    return api;
  };
  return {
    from: tabela,
    auth: {
      admin: {
        async updateUserById(id: string, attrs: { email?: string }) {
          if (falharTroca) return { data: null, error: { message: falharTroca } };
          const u = usuarios.get(id);
          if (u && attrs.email) u.email = attrs.email;
          return { data: { user: { id } }, error: null };
        },
      },
    },
  } as never;
}

beforeEach(async () => {
  linhas = new Map();
  usuarios = new Map([
    [USER, { email: ATUAL }],
    [OUTRO_USER, { email: "outra@familia.com" }],
  ]);
  enviados = [];
  eventos = [];
  falharEnvio = false;
  falharTroca = null;
  falharFiltro = false;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fake.supabase";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "chave-fake";

  // A checagem de "e-mail de outra conta" bate na Admin API por fetch.
  vi.stubGlobal("fetch", async (url: string) => {
    if (falharFiltro) return { ok: false } as Response;
    const alvo = decodeURIComponent(String(url).split("filter=")[1]?.split("&")[0] ?? "");
    const achados = [...usuarios.entries()]
      .filter(([, u]) => u.email === alvo)
      .map(([id, u]) => ({ id, email: u.email }));
    return {
      ok: true,
      json: async () => ({ users: achados }),
    } as unknown as Response;
  });
});

const M = () => import("./verificacao-email");

/** Extrai o código da mensagem entregue — o teste é o único que "lê" o e-mail. */
function codigoEntregue(): string {
  const m = enviados.at(-1)!.text.match(/(\d{6})/);
  return m![1];
}

describe("A. o caminho normal", () => {
  it("pede o código, confirma, e SÓ ENTÃO o e-mail muda", async () => {
    const { solicitarCodigoEmail, confirmarCodigoEmail } = await M();
    const admin = fakeAdmin();

    const r1 = await solicitarCodigoEmail(admin, {
      userId: USER,
      emailAtual: ATUAL,
      emailNovo: NOVO,
    });
    expect(r1.ok).toBe(true);
    expect(enviados).toHaveLength(1);
    expect(enviados[0].to).toBe(NOVO);

    // ⚠️ A garantia central: antes da prova, o e-mail de login é o ANTIGO.
    expect(usuarios.get(USER)!.email).toBe(ATUAL);

    const r2 = await confirmarCodigoEmail(admin, {
      userId: USER,
      emailNovo: NOVO,
      codigo: codigoEntregue(),
    });
    expect(r2).toEqual({ ok: true, email: NOVO });
    expect(usuarios.get(USER)!.email).toBe(NOVO);
  });

  it("o código vai SÓ para o endereço novo — nunca para o antigo", async () => {
    const { solicitarCodigoEmail } = await M();
    await solicitarCodigoEmail(fakeAdmin(), {
      userId: USER,
      emailAtual: ATUAL,
      emailNovo: NOVO,
    });
    expect(enviados.map((e) => e.to)).toEqual([NOVO]);
  });
});

describe("B. uso único, replay e concorrência", () => {
  it("MORDE: o mesmo código não serve duas vezes", async () => {
    const { solicitarCodigoEmail, confirmarCodigoEmail } = await M();
    const admin = fakeAdmin();
    await solicitarCodigoEmail(admin, { userId: USER, emailAtual: ATUAL, emailNovo: NOVO });
    const codigo = codigoEntregue();

    expect((await confirmarCodigoEmail(admin, { userId: USER, emailNovo: NOVO, codigo })).ok).toBe(true);
    const replay = await confirmarCodigoEmail(admin, { userId: USER, emailNovo: NOVO, codigo });
    expect(replay).toEqual({ ok: false, motivo: "sem_pedido" });
  });

  it("MORDE: duas confirmações simultâneas trocam o e-mail UMA vez", async () => {
    const { solicitarCodigoEmail, confirmarCodigoEmail } = await M();
    const admin = fakeAdmin();
    await solicitarCodigoEmail(admin, { userId: USER, emailAtual: ATUAL, emailNovo: NOVO });
    const codigo = codigoEntregue();

    let trocas = 0;
    const original = (admin as never as { auth: { admin: { updateUserById: unknown } } }).auth
      .admin.updateUserById as (i: string, a: { email?: string }) => Promise<unknown>;
    (admin as never as { auth: { admin: { updateUserById: unknown } } }).auth.admin.updateUserById =
      async (i: string, a: { email?: string }) => {
        trocas += 1;
        return original(i, a);
      };

    const [a, b] = await Promise.all([
      confirmarCodigoEmail(admin, { userId: USER, emailNovo: NOVO, codigo }),
      confirmarCodigoEmail(admin, { userId: USER, emailNovo: NOVO, codigo }),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(trocas).toBe(1);
  });

  it("reenviar invalida o código anterior — nunca dois desafios vivos", async () => {
    const { solicitarCodigoEmail, confirmarCodigoEmail } = await M();
    const admin = fakeAdmin();
    await solicitarCodigoEmail(admin, { userId: USER, emailAtual: ATUAL, emailNovo: NOVO });
    const primeiro = codigoEntregue();

    // Vence o cooldown sem esperar de verdade.
    const l = linhas.get(USER)!;
    l.updated_at = new Date(Date.now() - 120_000).toISOString();
    await solicitarCodigoEmail(admin, { userId: USER, emailAtual: ATUAL, emailNovo: NOVO });

    const r = await confirmarCodigoEmail(admin, { userId: USER, emailNovo: NOVO, codigo: primeiro });
    expect(r).toEqual({ ok: false, motivo: "codigo_errado" });
    expect(usuarios.get(USER)!.email).toBe(ATUAL);
  });
});

describe("C. os tetos", () => {
  it("MORDE: cinco erros fecham a porta", async () => {
    const { solicitarCodigoEmail, confirmarCodigoEmail, MAX_TENTATIVAS } = await M();
    const admin = fakeAdmin();
    await solicitarCodigoEmail(admin, { userId: USER, emailAtual: ATUAL, emailNovo: NOVO });
    const certo = codigoEntregue();
    const errado = certo === "000000" ? "111111" : "000000";

    for (let i = 0; i < MAX_TENTATIVAS; i++) {
      const r = await confirmarCodigoEmail(admin, { userId: USER, emailNovo: NOVO, codigo: errado });
      expect(r).toEqual({ ok: false, motivo: "codigo_errado" });
    }
    // Esgotado, nem o código CERTO passa — força pedir outro.
    const r = await confirmarCodigoEmail(admin, { userId: USER, emailNovo: NOVO, codigo: certo });
    expect(r).toEqual({ ok: false, motivo: "max_tentativas" });
    expect(usuarios.get(USER)!.email).toBe(ATUAL);
  });

  it("expirado não confirma", async () => {
    const { solicitarCodigoEmail, confirmarCodigoEmail } = await M();
    const admin = fakeAdmin();
    await solicitarCodigoEmail(admin, { userId: USER, emailAtual: ATUAL, emailNovo: NOVO });
    const codigo = codigoEntregue();
    linhas.get(USER)!.expira_em = new Date(Date.now() - 1000).toISOString();

    expect(await confirmarCodigoEmail(admin, { userId: USER, emailNovo: NOVO, codigo })).toEqual({
      ok: false,
      motivo: "expirado",
    });
    expect(usuarios.get(USER)!.email).toBe(ATUAL);
  });

  it("cooldown segura o duplo clique", async () => {
    const { solicitarCodigoEmail } = await M();
    const admin = fakeAdmin();
    await solicitarCodigoEmail(admin, { userId: USER, emailAtual: ATUAL, emailNovo: NOVO });
    const r = await solicitarCodigoEmail(admin, { userId: USER, emailAtual: ATUAL, emailNovo: NOVO });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe("cooldown");
    expect(enviados).toHaveLength(1);
  });

  it("teto de reenvios para o assédio ao mesmo endereço", async () => {
    const { solicitarCodigoEmail, MAX_REENVIOS } = await M();
    const admin = fakeAdmin();
    await solicitarCodigoEmail(admin, { userId: USER, emailAtual: ATUAL, emailNovo: NOVO });
    for (let i = 0; i < MAX_REENVIOS + 2; i++) {
      linhas.get(USER)!.updated_at = new Date(Date.now() - 120_000).toISOString();
      await solicitarCodigoEmail(admin, { userId: USER, emailAtual: ATUAL, emailNovo: NOVO });
    }
    expect(enviados.length).toBe(MAX_REENVIOS + 1);
  });

  it("CASO I — trocar de endereço RECOMEÇA a contagem", async () => {
    // Quem digitou errado duas vezes não pode ficar presa pelo limite do
    // endereço errado. É o falso positivo que este mecanismo poderia criar.
    const { solicitarCodigoEmail, MAX_REENVIOS } = await M();
    const admin = fakeAdmin();
    await solicitarCodigoEmail(admin, { userId: USER, emailAtual: ATUAL, emailNovo: NOVO });
    for (let i = 0; i < MAX_REENVIOS + 1; i++) {
      linhas.get(USER)!.updated_at = new Date(Date.now() - 120_000).toISOString();
      await solicitarCodigoEmail(admin, { userId: USER, emailAtual: ATUAL, emailNovo: NOVO });
    }
    const r = await solicitarCodigoEmail(admin, {
      userId: USER,
      emailAtual: ATUAL,
      emailNovo: "terceiro@endereco.com",
    });
    expect(r.ok).toBe(true);
  });
});

describe("D. recusas de negócio", () => {
  it("e-mail de OUTRA conta é recusado ANTES de enviar", async () => {
    // Mandar código para a caixa de outra pessoa é incômodo contra terceiro.
    const { solicitarCodigoEmail } = await M();
    const r = await solicitarCodigoEmail(fakeAdmin(), {
      userId: USER,
      emailAtual: ATUAL,
      emailNovo: "outra@familia.com",
    });
    expect(r).toEqual({ ok: false, motivo: "em_uso" });
    expect(enviados).toHaveLength(0);
  });

  it("o próprio e-mail atual não conta como troca", async () => {
    const { solicitarCodigoEmail } = await M();
    const r = await solicitarCodigoEmail(fakeAdmin(), {
      userId: USER,
      emailAtual: ATUAL,
      emailNovo: ATUAL.toUpperCase(),
    });
    expect(r).toEqual({ ok: false, motivo: "igual_atual" });
  });

  it("endereço malformado nem chega ao envio", async () => {
    const { solicitarCodigoEmail } = await M();
    const r = await solicitarCodigoEmail(fakeAdmin(), {
      userId: USER,
      emailAtual: ATUAL,
      emailNovo: "não é e-mail",
    });
    expect(r).toEqual({ ok: false, motivo: "invalido" });
    expect(enviados).toHaveLength(0);
  });

  it("FAIL-CLOSED: tabela indisponível recusa ANTES de enviar", async () => {
    // O caso real: migração 0085 ainda não aplicada. Se a leitura fosse
    // engolida, a pessoa receberia um código de 6 dígitos que não confirma
    // nada — e o endereço novo nunca poderia ser provado.
    const { solicitarCodigoEmail } = await M();
    const admin = fakeAdmin() as unknown as { from: unknown };
    admin.from = () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: null,
            error: { message: 'relation "public.verificacoes_email" does not exist' },
          }),
        }),
      }),
    });
    const r = await solicitarCodigoEmail(admin as never, {
      userId: USER,
      emailAtual: ATUAL,
      emailNovo: NOVO,
    });
    expect(r).toEqual({ ok: false, motivo: "erro" });
    expect(enviados).toHaveLength(0);
  });

  it("FAIL-CLOSED: sem conseguir conferir duplicidade, não envia", async () => {
    const { solicitarCodigoEmail } = await M();
    falharFiltro = true;
    const r = await solicitarCodigoEmail(fakeAdmin(), {
      userId: USER,
      emailAtual: ATUAL,
      emailNovo: NOVO,
    });
    expect(r.ok).toBe(false);
    expect(enviados).toHaveLength(0);
  });
});

describe("E. falhas de persistência e de envio", () => {
  it("SMTP falhou → nenhum desafio vivo que a pessoa não recebeu", async () => {
    const { solicitarCodigoEmail } = await M();
    falharEnvio = true;
    const r = await solicitarCodigoEmail(fakeAdmin(), {
      userId: USER,
      emailAtual: ATUAL,
      emailNovo: NOVO,
    });
    expect(r).toEqual({ ok: false, motivo: "envio_falhou" });
    expect(linhas.get(USER)).toBeUndefined();
  });

  it("MORDE: erro DEVOLVIDO na troca não vira falso sucesso", async () => {
    const { solicitarCodigoEmail, confirmarCodigoEmail } = await M();
    const admin = fakeAdmin();
    await solicitarCodigoEmail(admin, { userId: USER, emailAtual: ATUAL, emailNovo: NOVO });
    falharTroca = "database is in recovery mode";
    const r = await confirmarCodigoEmail(admin, {
      userId: USER,
      emailNovo: NOVO,
      codigo: codigoEntregue(),
    });
    expect(r.ok).toBe(false);
    expect(usuarios.get(USER)!.email).toBe(ATUAL);
  });

  it("troca recusada por conflito devolve o desafio, não trava a pessoa", async () => {
    const { solicitarCodigoEmail, confirmarCodigoEmail } = await M();
    const admin = fakeAdmin();
    await solicitarCodigoEmail(admin, { userId: USER, emailAtual: ATUAL, emailNovo: NOVO });
    falharTroca = "email address already registered by another user";
    const r = await confirmarCodigoEmail(admin, {
      userId: USER,
      emailNovo: NOVO,
      codigo: codigoEntregue(),
    });
    expect(r).toEqual({ ok: false, motivo: "em_uso" });
    // A reserva foi devolvida: a linha existe e não está marcada como usada.
    expect(linhas.get(USER)!.confirmado_em).toBeNull();
  });
});

describe("F. o código não vaza", () => {
  it("MORDE: nem o código nem o endereço aparecem em log ou evento", async () => {
    const { solicitarCodigoEmail, confirmarCodigoEmail } = await M();
    const admin = fakeAdmin();
    await solicitarCodigoEmail(admin, { userId: USER, emailAtual: ATUAL, emailNovo: NOVO });
    const codigo = codigoEntregue();
    await confirmarCodigoEmail(admin, { userId: USER, emailNovo: NOVO, codigo: "000000" });
    await confirmarCodigoEmail(admin, { userId: USER, emailNovo: NOVO, codigo });

    const tudo = JSON.stringify(eventos);
    expect(tudo).not.toContain(codigo);
    expect(tudo).not.toContain(NOVO);
    expect(tudo).not.toContain(ATUAL);
  });

  it("MORDE: o banco guarda o hash, nunca o código", async () => {
    const { solicitarCodigoEmail, hashCodigo } = await M();
    await solicitarCodigoEmail(fakeAdmin(), {
      userId: USER,
      emailAtual: ATUAL,
      emailNovo: NOVO,
    });
    const codigo = codigoEntregue();
    const guardado = linhas.get(USER)!;
    expect(guardado.codigo_hash).toBe(hashCodigo(codigo));
    expect(JSON.stringify(guardado)).not.toContain(codigo);
  });

  it("o erro do SMTP não é repassado cru (pode trazer o envelope)", async () => {
    const { solicitarCodigoEmail } = await M();
    falharEnvio = true;
    await solicitarCodigoEmail(fakeAdmin(), {
      userId: USER,
      emailAtual: ATUAL,
      emailNovo: NOVO,
    });
    expect(JSON.stringify(eventos)).not.toContain("envelope secreto");
  });
});

describe("G. isolamento entre contas", () => {
  it("MORDE: o desafio de um usuário não confirma o e-mail de outro", async () => {
    const { solicitarCodigoEmail, confirmarCodigoEmail } = await M();
    const admin = fakeAdmin();
    await solicitarCodigoEmail(admin, { userId: USER, emailAtual: ATUAL, emailNovo: NOVO });
    const codigo = codigoEntregue();

    const r = await confirmarCodigoEmail(admin, {
      userId: OUTRO_USER,
      emailNovo: NOVO,
      codigo,
    });
    expect(r).toEqual({ ok: false, motivo: "sem_pedido" });
    expect(usuarios.get(OUTRO_USER)!.email).toBe("outra@familia.com");
  });

  it("MORDE: um código pedido para um endereço não confirma outro", async () => {
    const { solicitarCodigoEmail, confirmarCodigoEmail } = await M();
    const admin = fakeAdmin();
    await solicitarCodigoEmail(admin, { userId: USER, emailAtual: ATUAL, emailNovo: NOVO });
    const r = await confirmarCodigoEmail(admin, {
      userId: USER,
      emailNovo: "outro@qualquer.com",
      codigo: codigoEntregue(),
    });
    expect(r).toEqual({ ok: false, motivo: "sem_pedido" });
  });
});

describe("H. a action não aceita id do cliente", () => {
  it("MORDE: userId sai da sessão, nunca do input", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const SRC = fs.readFileSync(
      path.join(process.cwd(), "src/app/(conta)/configuracoes/conta/actions.ts"),
      "utf8",
    );
    const bloco = SRC.slice(
      SRC.indexOf("export async function pedirCodigoEmailAction"),
      SRC.indexOf("const MSG_EMAIL"),
    );
    // O id vem de `requireUser()`; os schemas só aceitam email e código.
    expect(bloco).toContain("await requireUser()");
    expect(bloco).toContain("userId: user.id");
    expect(bloco).not.toMatch(/userId:\s*input\./);
    expect(SRC).not.toMatch(/userId:\s*z\./);
  });
});
