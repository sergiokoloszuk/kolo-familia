import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A PORTA DO WHATSAPP, INTEIRA — do código que chega no telefone até o que
 * fica gravado na conta.
 *
 * `verificacao.test.ts` prova o mecanismo. Este arquivo prova a INTEGRAÇÃO: as
 * três portas usando o mesmo mecanismo, e — mais importante — a ausência dos
 * quatro caminhos que gravavam o número sem confirmação nenhuma.
 *
 * ⚠️ O QUE ESTA FRENTE CORRIGE, e é o motivo de metade destes testes provar
 * uma AUSÊNCIA: até 21/08/2026, quatro caminhos escreviam
 * `family_accounts.whatsapp_e164` sem OTP — os dois onboardings, a tela de
 * Configurações e o card do painel (este por HMAC com segredo público). É desse
 * campo que a Ayla lê para escrever às famílias. Bastava digitar o número de um
 * terceiro para a Ayla passar a falar com ele.
 */

const enviarTextoMock = vi.fn();
const logEventMock = vi.fn();
const logServerErrorMock = vi.fn();

vi.mock("@/lib/ayla/whatsappSender", () => ({
  enviarTexto: (...a: unknown[]) => enviarTextoMock(...a),
}));
vi.mock("@/lib/log", () => ({
  logEvent: (...a: unknown[]) => logEventMock(...a),
  logServerError: (...a: unknown[]) => logServerErrorMock(...a),
}));

const { solicitarCodigo, confirmarCodigo, hashCodigo, MAX_TENTATIVAS, MAX_REENVIOS } =
  await import("./verificacao");
const { concluirVerificacao, numeroDeOutraConta } = await import("./porta");

const FAM = "aaaaaaaa-1111-2222-3333-444444444444";
const TEL = "+5511988887777";
const OUTRO_TEL = "+5511977776666";

const RAIZ = join(process.cwd(), "src");
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8");

/**
 * O MESMO ARQUIVO, SEM COMENTÁRIO.
 *
 * ⚠️ Necessário, e a primeira versão deste teste errou justamente aqui: as
 * asserções de ausência casavam com os comentários que DOCUMENTAM a remoção
 * ("o cookie `kolo_ativacao` deixou de existir"). Um teste que reprova o
 * arquivo por explicar o que foi tirado mede texto, não comportamento — e
 * empurraria para apagar a explicação, que é o oposto do que se quer.
 */
function semComentarios(p: string): string {
  return ler(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

// ============================================================
// Banco falso — várias tabelas, o suficiente para as consultas reais
// ============================================================

type Linha = Record<string, unknown>;
/** Uma escrita registrada pelo banco falso. */
type Escrita = { tabela: string; op: string; valor: Linha };

function banco(inicial?: {
  verificacao?: Linha | null;
  familias?: Linha[];
  pref?: Linha | null;
  assinatura?: Linha | null;
}) {
  const t = {
    verificacoes_whatsapp: (inicial?.verificacao ?? null) as Linha | null,
    family_accounts: (inicial?.familias ?? [{ id: FAM, whatsapp_e164: null }]) as Linha[],
    ayla_preferences: (inicial?.pref ?? null) as Linha | null,
    subscription_accesses: (inicial?.assinatura ?? null) as Linha | null,
  };
  /** Escritas registradas — é como se prova que uma tabela NÃO foi tocada. */
  const escritas: Escrita[] = [];
  const falhas: Record<string, { code?: string; message: string } | undefined> = {};

  const cli = {
    tabelas: t,
    escritas,
    /** Faz a próxima escrita nesta tabela falhar — para provar fail-closed. */
    falharEm(tabela: string, erro: { code?: string; message: string }) {
      falhas[tabela] = erro;
    },
    from(tabela: string) {
      const erroDaVez = () => {
        const e = falhas[tabela];
        if (e) falhas[tabela] = undefined;
        return e ?? null;
      };
      const selecionar = () => {
        const api: Record<string, unknown> = {
          eq: () => api,
          neq: () => api,
          not: () => api,
          maybeSingle: () =>
            Promise.resolve({
              data:
                tabela === "family_accounts"
                  ? (t.family_accounts[0] ?? null)
                  : (t[tabela as "ayla_preferences"] ?? null),
              error: erroDaVez(),
            }),
          single: () => Promise.resolve({ data: t.family_accounts[0] ?? null, error: null }),
          then: (r: (x: unknown) => unknown) =>
            Promise.resolve({
              data: tabela === "family_accounts" ? t.family_accounts.slice(1) : [],
              error: erroDaVez(),
            }).then(r),
        };
        return api;
      };
      return {
        select: selecionar,
        upsert(v: Linha) {
          const e = erroDaVez();
          if (!e) {
            escritas.push({ tabela, op: "upsert", valor: v });
            if (tabela === "verificacoes_whatsapp") t.verificacoes_whatsapp = { ...v, updated_at: new Date().toISOString() };
            if (tabela === "ayla_preferences") t.ayla_preferences = { ...(t.ayla_preferences ?? {}), ...v };
          }
          return Promise.resolve({ error: e });
        },
        update(v: Linha) {
          const e = erroDaVez();
          const aplicar = () => {
            if (e) return;
            escritas.push({ tabela, op: "update", valor: v });
            if (tabela === "verificacoes_whatsapp" && t.verificacoes_whatsapp)
              t.verificacoes_whatsapp = { ...t.verificacoes_whatsapp, ...v };
            if (tabela === "family_accounts" && t.family_accounts[0])
              t.family_accounts[0] = { ...t.family_accounts[0], ...v };
            if (tabela === "ayla_preferences")
              t.ayla_preferences = { ...(t.ayla_preferences ?? {}), ...v };
            if (tabela === "subscription_accesses")
              t.subscription_accesses = { ...(t.subscription_accesses ?? {}), ...v };
          };
          const resultado = () => ({
            data: t.verificacoes_whatsapp ? [{ family_account_id: FAM }] : [],
            error: e,
          });
          const api: Record<string, unknown> = {
            eq: () => {
              aplicar();
              return api;
            },
            select: () => Promise.resolve(resultado()),
            then: (r: (x: unknown) => unknown) => Promise.resolve({ error: e }).then(r),
          };
          return api;
        },
      };
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return cli as any;
}

/** Pede o código e devolve o que foi mandado no WhatsApp. */
async function pedirEExtrair(db: ReturnType<typeof banco>, telefone = TEL) {
  enviarTextoMock.mockClear();
  const r = await solicitarCodigo(db, { familyId: FAM, telefone });
  const texto = (enviarTextoMock.mock.calls.at(-1)?.[0] as { texto: string } | undefined)?.texto ?? "";
  return { r, codigo: texto.match(/\b(\d{6})\b/)?.[1] ?? "" };
}

beforeEach(() => {
  enviarTextoMock.mockReset();
  logEventMock.mockReset();
  logServerErrorMock.mockReset();
  enviarTextoMock.mockResolvedValue(undefined);
});

// ============================================================
describe("o caminho feliz grava — e só ele grava", () => {
  it("código correto confirma, guarda o número e liga a Ayla", async () => {
    const db = banco();
    const { codigo } = await pedirEExtrair(db);
    expect(codigo).toMatch(/^\d{6}$/);

    const conf = await confirmarCodigo(db, { familyId: FAM, telefone: TEL, codigo });
    expect(conf.ok).toBe(true);

    const fim = await concluirVerificacao(db, { familyId: FAM, telefone: TEL });
    expect(fim.ok).toBe(true);
    expect(db.tabelas.family_accounts[0].whatsapp_e164).toBe(TEL);
    expect(db.tabelas.ayla_preferences?.desativada).toBe(false);
    expect(db.tabelas.ayla_preferences?.consentimento_em).toBeTruthy();
  });

  it("código errado não confirma e não grava nada na conta", async () => {
    const db = banco();
    const { codigo } = await pedirEExtrair(db);
    const errado = codigo === "000000" ? "111111" : "000000";

    const conf = await confirmarCodigo(db, { familyId: FAM, telefone: TEL, codigo: errado });
    expect(conf).toEqual({ ok: false, motivo: "codigo_errado" });
    expect(db.tabelas.family_accounts[0].whatsapp_e164).toBeNull();
    expect(db.escritas.some((e: Escrita) => e.tabela === "family_accounts")).toBe(false);
    expect(db.escritas.some((e: Escrita) => e.tabela === "ayla_preferences")).toBe(false);
  });

  it("código expirado não confirma", async () => {
    const db = banco({
      verificacao: {
        telefone_e164: TEL,
        codigo_hash: hashCodigo("123456"),
        expira_em: new Date(Date.now() - 1000).toISOString(),
        tentativas: 0,
        reenvios: 0,
        verificado_em: null,
        updated_at: new Date(Date.now() - 60_000).toISOString(),
      },
    });
    const conf = await confirmarCodigo(db, { familyId: FAM, telefone: TEL, codigo: "123456" });
    expect(conf).toEqual({ ok: false, motivo: "expirado" });
    expect(db.tabelas.family_accounts[0].whatsapp_e164).toBeNull();
  });
});

describe("os limites bloqueiam de verdade", () => {
  it(`na tentativa ${MAX_TENTATIVAS + 1} o desafio está fechado`, async () => {
    const db = banco();
    const { codigo } = await pedirEExtrair(db);
    const errado = codigo === "000000" ? "111111" : "000000";

    for (let i = 0; i < MAX_TENTATIVAS; i++) {
      const r = await confirmarCodigo(db, { familyId: FAM, telefone: TEL, codigo: errado });
      expect(r).toEqual({ ok: false, motivo: "codigo_errado" });
    }
    const bloqueado = await confirmarCodigo(db, { familyId: FAM, telefone: TEL, codigo: errado });
    expect(bloqueado).toEqual({ ok: false, motivo: "max_tentativas" });
  });

  it("o código CERTO depois do esgotamento continua recusado", async () => {
    const db = banco();
    const { codigo } = await pedirEExtrair(db);
    const errado = codigo === "000000" ? "111111" : "000000";
    for (let i = 0; i < MAX_TENTATIVAS; i++) {
      await confirmarCodigo(db, { familyId: FAM, telefone: TEL, codigo: errado });
    }
    const r = await confirmarCodigo(db, { familyId: FAM, telefone: TEL, codigo });
    expect(r).toEqual({ ok: false, motivo: "max_tentativas" });
    expect(db.tabelas.family_accounts[0].whatsapp_e164).toBeNull();
  });

  it("o cooldown segura o reenvio imediato", async () => {
    const db = banco();
    await pedirEExtrair(db);
    const r = await solicitarCodigo(db, { familyId: FAM, telefone: TEL });
    expect(r.ok).toBe(false);
    if (!r.ok && r.motivo === "cooldown") {
      expect(r.segundosRestantes).toBeGreaterThan(0);
    } else {
      throw new Error("esperava cooldown");
    }
  });

  it(`para no ${MAX_REENVIOS}º reenvio`, async () => {
    const db = banco({
      verificacao: {
        telefone_e164: TEL,
        codigo_hash: hashCodigo("123456"),
        expira_em: new Date(Date.now() + 600_000).toISOString(),
        tentativas: 0,
        reenvios: MAX_REENVIOS,
        verificado_em: null,
        updated_at: new Date(Date.now() - 600_000).toISOString(),
      },
    });
    const r = await solicitarCodigo(db, { familyId: FAM, telefone: TEL });
    expect(r).toEqual({ ok: false, motivo: "max_reenvios" });
    expect(enviarTextoMock).not.toHaveBeenCalled();
  });

  it("reenviar invalida o código anterior", async () => {
    const db = banco();
    const { codigo: antigo } = await pedirEExtrair(db);
    // Envelhece a linha para escapar do cooldown, sem mexer no relógio global.
    db.tabelas.verificacoes_whatsapp!.updated_at = new Date(Date.now() - 600_000).toISOString();
    const { codigo: novo } = await pedirEExtrair(db);
    expect(novo).not.toBe(antigo);

    const r = await confirmarCodigo(db, { familyId: FAM, telefone: TEL, codigo: antigo });
    expect(r).toEqual({ ok: false, motivo: "codigo_errado" });
    const ok = await confirmarCodigo(db, { familyId: FAM, telefone: TEL, codigo: novo });
    expect(ok.ok).toBe(true);
  });

  it("corrigir o número invalida a confirmação do número anterior", async () => {
    const db = banco();
    const { codigo } = await pedirEExtrair(db);
    // A pessoa percebe que errou e troca o número antes de confirmar.
    const r = await confirmarCodigo(db, { familyId: FAM, telefone: OUTRO_TEL, codigo });
    expect(r).toEqual({ ok: false, motivo: "sem_pedido" });
    expect(db.tabelas.family_accounts[0].whatsapp_e164).toBeNull();
  });

  it("retry do pedido não cria segunda verificação viva", async () => {
    const db = banco();
    await pedirEExtrair(db);
    db.tabelas.verificacoes_whatsapp!.updated_at = new Date(Date.now() - 600_000).toISOString();
    await pedirEExtrair(db);
    const upserts = db.escritas.filter(
      (e: Escrita) => e.tabela === "verificacoes_whatsapp" && e.op === "upsert",
    );
    expect(upserts.length).toBe(2);
    // Duas gravações, UMA linha viva — é o índice único da 0080 fazendo efeito.
    expect(db.tabelas.verificacoes_whatsapp).toBeTruthy();
    expect(Array.isArray(db.tabelas.verificacoes_whatsapp)).toBe(false);
  });
});

describe("falha nunca vira sucesso", () => {
  it("Z-API recusando não deixa desafio vivo nem consome reenvio", async () => {
    const db = banco();
    enviarTextoMock.mockRejectedValueOnce(new Error("z-api caiu"));
    const r = await solicitarCodigo(db, { familyId: FAM, telefone: TEL });
    expect(r).toEqual({ ok: false, motivo: "envio_falhou" });
    expect(db.tabelas.verificacoes_whatsapp).toBeNull();
    expect(db.escritas.length).toBe(0);
  });

  it("falha ao gravar o número não devolve ok", async () => {
    const db = banco();
    db.falharEm("family_accounts", { message: "indisponível" });
    const r = await concluirVerificacao(db, { familyId: FAM, telefone: TEL });
    expect(r).toEqual({ ok: false, motivo: "erro" });
    expect(logServerErrorMock).toHaveBeenCalled();
  });

  it("número já de outra conta devolve duplicado, não sucesso", async () => {
    const db = banco();
    db.falharEm("family_accounts", { code: "23505", message: "unique" });
    const r = await concluirVerificacao(db, { familyId: FAM, telefone: TEL });
    expect(r).toEqual({ ok: false, motivo: "duplicado" });
  });

  it("não conseguir LER as outras famílias falha fechado (não manda código)", async () => {
    const db = banco();
    db.falharEm("family_accounts", { message: "timeout" });
    await expect(
      numeroDeOutraConta(db, { familyId: FAM, telefone: TEL, contexto: "teste" }),
    ).rejects.toThrow();
  });
});

describe("o que a confirmação NÃO pode tocar", () => {
  it("não escreve em subscription_accesses — nem cria, nem apaga teste", async () => {
    const db = banco({ assinatura: { status: "trialing", trial_ends_at: null } });
    const { codigo } = await pedirEExtrair(db);
    await confirmarCodigo(db, { familyId: FAM, telefone: TEL, codigo });
    await concluirVerificacao(db, { familyId: FAM, telefone: TEL });
    expect(db.escritas.some((e: Escrita) => e.tabela === "subscription_accesses")).toBe(false);
    expect(db.tabelas.subscription_accesses).toEqual({ status: "trialing", trial_ends_at: null });
  });

  it("família que já consentiu mantém a data original ao reconfirmar", async () => {
    const ONTEM = "2026-01-01T10:00:00.000Z";
    const db = banco({ pref: { consentimento_em: ONTEM, desativada: true } });
    const r = await concluirVerificacao(db, { familyId: FAM, telefone: TEL });
    expect(r.ok).toBe(true);
    expect(db.tabelas.ayla_preferences?.consentimento_em).toBe(ONTEM);
    expect(db.tabelas.ayla_preferences?.desativada).toBe(false);
  });

  it("nenhum código aparece em log ou em payload de evento", async () => {
    const db = banco();
    const { codigo } = await pedirEExtrair(db);
    await confirmarCodigo(db, { familyId: FAM, telefone: TEL, codigo });
    await concluirVerificacao(db, { familyId: FAM, telefone: TEL });

    const tudo = JSON.stringify([logEventMock.mock.calls, logServerErrorMock.mock.calls]);
    expect(tudo).not.toContain(codigo);
    // E o telefone também não precisa estar lá.
    expect(tudo).not.toContain(TEL);
  });
});

// ============================================================
// Estrutura: as portas, e a ausência dos bypasses
// ============================================================

describe("as três portas usam o MESMO mecanismo", () => {
  const COMPONENTE = ler("components/confirmar-whatsapp.tsx");

  it("o componente único chama as ações compartilhadas", () => {
    expect(COMPONENTE).toContain('from "@/lib/whatsapp/acoes"');
    expect(COMPONENTE).toContain("pedirCodigoWhatsapp");
    expect(COMPONENTE).toContain("confirmarCodigoWhatsapp");
  });

  it("onboarding tradicional, conversacional, painel e configurações montam o mesmo componente", () => {
    for (const arquivo of [
      "app/onboarding/wizard.tsx",
      "app/onboarding/conversacional.tsx",
      "app/(app)/painel/ativar-ayla.tsx",
      "app/(app)/configuracoes/conta/whatsapp-form.tsx",
    ]) {
      expect(ler(arquivo), arquivo).toContain("ConfirmarWhatsapp");
    }
  });

  it("o onboarding tradicional não avança sem o número confirmado (trava no servidor)", () => {
    const ACTIONS = ler("app/onboarding/actions.ts");
    const tela2 = ACTIONS.slice(ACTIONS.indexOf("export async function saveTela2"));
    expect(tela2.slice(0, 1500)).toMatch(/if \(!family\.whatsapp_e164\)/);
    // E a tela 1 não pode mais gravar o número.
    const tela1 = ACTIONS.slice(
      ACTIONS.indexOf("export async function saveTela1"),
      ACTIONS.indexOf("export async function saveTela2"),
    );
    expect(tela1).not.toMatch(/update\(\{\s*whatsapp_e164/);
  });

  it("o conversacional não avança sem confirmação, e sua etapa não grava o número", () => {
    expect(ler("app/onboarding/conversacional.tsx")).toContain('setFase("confirmar_whats")');
    const SALVAR = ler("lib/onboarding/salvar-conversacional.ts");
    const cp = SALVAR.slice(SALVAR.indexOf("export async function cpWhatsapp"));
    expect(cp.slice(0, 1200)).not.toMatch(/update\(\{\s*whatsapp_e164/);
  });

  it("o opt-in por caixinha não data mais o consentimento sozinho", () => {
    const SALVAR = ler("lib/onboarding/salvar-conversacional.ts");
    const cp = SALVAR.slice(SALVAR.indexOf("export async function cpAceites"));
    expect(cp.slice(0, 1200)).not.toMatch(/consentimento_em: new Date/);
  });
});

describe("nenhum bypass sobrou", () => {
  const ARQUIVOS = [
    "app/onboarding/actions.ts",
    "lib/onboarding/salvar-conversacional.ts",
    "app/(app)/painel/ativar-ayla.tsx",
    "app/(app)/configuracoes/conta/actions.ts",
    "app/(app)/configuracoes/conta/whatsapp-form.tsx",
  ];

  it("o arquivo do HMAC antigo não existe mais", () => {
    expect(() => ler("app/(app)/painel/ativar-actions.ts")).toThrow();
  });

  it('"kolo-ativacao-dev" não protege nenhum código alcançável', () => {
    for (const a of ARQUIVOS) expect(semComentarios(a), a).not.toContain("kolo-ativacao-dev");
  });

  it("o cookie kolo_ativacao não é lido nem escrito por ninguém", () => {
    for (const a of ARQUIVOS) expect(semComentarios(a), a).not.toContain("kolo_ativacao");
  });

  it("o HMAC de ativação não é recriado em lugar nenhum", () => {
    for (const a of ARQUIVOS) expect(semComentarios(a), a).not.toContain("createHmac");
  });

  it("as ações de configurações não gravam mais o número direto", () => {
    const CONTA = semComentarios("app/(app)/configuracoes/conta/actions.ts");
    expect(CONTA).not.toContain("atualizarWhatsappAction");
    expect(CONTA).not.toMatch(/update\(\{\s*whatsapp_e164/);
  });

  it("porta.ts é o ÚNICO lugar que escreve whatsapp_e164 na conta", () => {
    const PORTA = ler("lib/whatsapp/porta.ts");
    expect(PORTA).toMatch(/update\(\{ whatsapp_e164: telefone \}\)/);
    for (const a of ARQUIVOS) {
      expect(ler(a), a).not.toMatch(/\.update\(\{\s*whatsapp_e164/);
    }
  });

  it("a confirmação só grava depois do ok do mecanismo", () => {
    const ACOES = ler("lib/whatsapp/acoes.ts");
    const i = ACOES.indexOf("const r = await confirmarCodigo(");
    const j = ACOES.indexOf("await concluirVerificacao(");
    expect(i).toBeGreaterThan(0);
    expect(j).toBeGreaterThan(i);
    // Entre um e outro existe a saída antecipada em caso de falha.
    expect(ACOES.slice(i, j)).toContain("if (!r.ok)");
  });

  it("nada do mecanismo fala com o Stripe", () => {
    // Escopo deliberado: os arquivos DESTA frente. `configuracoes/conta`
    // cancela assinatura na exclusão de conta — código anterior, não tocado
    // aqui, e exigir que ele não cite Stripe seria medir a coisa errada.
    for (const a of [
      "lib/whatsapp/porta.ts",
      "lib/whatsapp/acoes.ts",
      "lib/whatsapp/verificacao.ts",
      "components/confirmar-whatsapp.tsx",
      "app/(app)/configuracoes/conta/whatsapp-form.tsx",
      "app/(app)/painel/ativar-ayla.tsx",
    ]) {
      expect(semComentarios(a).toLowerCase(), a).not.toContain("stripe");
    }
  });

  it("nada nesta frente cria ou apaga teste", () => {
    for (const a of ["lib/whatsapp/porta.ts", "lib/whatsapp/acoes.ts", "lib/whatsapp/verificacao.ts"]) {
      const src = ler(a);
      expect(src, a).not.toContain("iniciar_trial_se_apto");
      expect(src, a).not.toMatch(/from\("subscription_accesses"\)[\s\S]{0,80}(insert|delete)/);
    }
  });
});
