import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A VERIFICAÇÃO DO WHATSAPP — E O QUE ELA NÃO PODE FAZER.
 *
 * O mecanismo já existia em `painel/ativar-actions.ts` e a intuição dele estava
 * certa: o código vai para o número informado, então quem digita o número de um
 * terceiro não consegue confirmar. O que faltava era tudo em volta — limite de
 * tentativas (6 dígitos sem limite é um milhão de palpites), teto de reenvios,
 * cooldown, e estado que sobreviva à troca de navegador.
 *
 * Metade destes testes prova que algo NÃO acontece. É de propósito: o risco
 * desta frente não é falhar em confirmar, é confirmar o número errado.
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

const {
  solicitarCodigo,
  confirmarCodigo,
  estaVerificado,
  hashCodigo,
  gerarCodigo,
  textoDoCodigo,
  VALIDADE_MIN,
  MAX_TENTATIVAS,
  MAX_REENVIOS,
  COOLDOWN_REENVIO_SEG,
} = await import("./verificacao");

const FAM = "aaaaaaaa-1111-2222-3333-444444444444";
const TEL = "+5511988887777";
const OUTRO = "+5511999996666";

/** Banco falso com UMA linha por família — o índice único da 0080, em memória. */
function db(inicial: Record<string, unknown> | null = null) {
  const store: { linha: Record<string, unknown> | null } = { linha: inicial };
  const cli = {
    store,
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: () => Promise.resolve({ data: store.linha, error: null }),
              };
            },
          };
        },
        upsert(v: Record<string, unknown>) {
          store.linha = { ...v, updated_at: new Date().toISOString() };
          return Promise.resolve({ error: null });
        },
        update(v: Record<string, unknown>) {
          const aplicar = () => {
            if (store.linha) store.linha = { ...store.linha, ...v };
          };
          return {
            eq(_c1: string, _v1: string) {
              aplicar();
              return {
                eq: () => ({
                  select: () =>
                    Promise.resolve({ data: store.linha ? [{ family_account_id: FAM }] : [], error: null }),
                }),
                select: () =>
                  Promise.resolve({ data: store.linha ? [{ family_account_id: FAM }] : [], error: null }),
                then: (r: (x: unknown) => unknown) => Promise.resolve({ error: null }).then(r),
              };
            },
          };
        },
      };
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return cli as any;
}

function linhaViva(over: Record<string, unknown> = {}) {
  const codigo = "123456";
  return {
    linha: {
      family_account_id: FAM,
      telefone_e164: TEL,
      codigo_hash: hashCodigo(codigo),
      expira_em: new Date(Date.now() + VALIDADE_MIN * 60_000).toISOString(),
      tentativas: 0,
      reenvios: 0,
      verificado_em: null,
      updated_at: new Date(Date.now() - 10 * 60_000).toISOString(),
      ...over,
    },
    codigo,
  };
}

beforeEach(() => {
  enviarTextoMock.mockReset().mockResolvedValue({ messageId: "m1" });
  logEventMock.mockReset();
  logServerErrorMock.mockReset();
});

describe("o código", () => {
  it("1. tem 6 dígitos e vem de gerador criptográfico", () => {
    for (let i = 0; i < 200; i++) expect(gerarCodigo()).toMatch(/^\d{6}$/);
    const amostra = new Set(Array.from({ length: 200 }, () => gerarCodigo()));
    expect(amostra.size).toBeGreaterThan(150); // não é constante nem sequencial
  });

  it("2. NUNCA é persistido em texto puro — só o sha256", async () => {
    const cli = db();
    await solicitarCodigo(cli, { familyId: FAM, telefone: TEL });
    const gravado = cli.store.linha!;
    const enviado = enviarTextoMock.mock.calls[0][0].texto as string;
    const codigo = enviado.match(/(\d{6})/)![1];

    expect(gravado.codigo_hash).toBe(hashCodigo(codigo));
    expect(JSON.stringify(gravado)).not.toContain(codigo);
    expect(gravado.codigo_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("3. NUNCA aparece em log nem no retorno", async () => {
    const cli = db();
    const r = await solicitarCodigo(cli, { familyId: FAM, telefone: TEL });
    const codigo = (enviarTextoMock.mock.calls[0][0].texto as string).match(/(\d{6})/)![1];

    expect(JSON.stringify(r)).not.toContain(codigo);
    const logs = JSON.stringify(logEventMock.mock.calls) + JSON.stringify(logServerErrorMock.mock.calls);
    expect(logs).not.toContain(codigo);
    // O telefone também não precisa estar no log.
    expect(logs).not.toContain(TEL);
  });

  it("4. a mensagem é curta, sem marketing e sem link", () => {
    const t = textoDoCodigo("123456");
    expect(t).toContain("123456");
    expect(t).toContain(`${VALIDADE_MIN} minutos`);
    expect(t).not.toMatch(/https?:\/\//);
    expect(t.length).toBeLessThan(200);
  });

  it("5. vai para o número que está sendo verificado, e só para ele", async () => {
    await solicitarCodigo(db(), { familyId: FAM, telefone: TEL });
    expect(enviarTextoMock).toHaveBeenCalledTimes(1);
    expect(enviarTextoMock.mock.calls[0][0].phoneE164).toBe(TEL);
  });
});

describe("validade, tentativas e reenvios", () => {
  it("6. o desafio vale 10 minutos", async () => {
    const cli = db();
    const antes = Date.now();
    await solicitarCodigo(cli, { familyId: FAM, telefone: TEL });
    const dur = new Date(cli.store.linha!.expira_em as string).getTime() - antes;
    expect(Math.round(dur / 60_000)).toBe(VALIDADE_MIN);
  });

  it("7. código EXPIRADO não confirma", async () => {
    const { linha, codigo } = linhaViva({ expira_em: new Date(Date.now() - 1000).toISOString() });
    const r = await confirmarCodigo(db(linha), { familyId: FAM, telefone: TEL, codigo });
    expect(r).toEqual({ ok: false, motivo: "expirado" });
  });

  it("8. código ERRADO não confirma, e conta a tentativa", async () => {
    const { linha } = linhaViva();
    const cli = db(linha);
    const r = await confirmarCodigo(cli, { familyId: FAM, telefone: TEL, codigo: "000000" });
    expect(r).toEqual({ ok: false, motivo: "codigo_errado" });
    expect(cli.store.linha!.tentativas).toBe(1);
    expect(cli.store.linha!.verificado_em).toBeNull();
  });

  it("9. na 5ª tentativa esgotada, PARA de aceitar — mesmo o código certo", async () => {
    const { linha, codigo } = linhaViva({ tentativas: MAX_TENTATIVAS });
    const r = await confirmarCodigo(db(linha), { familyId: FAM, telefone: TEL, codigo });
    expect(r).toEqual({ ok: false, motivo: "max_tentativas" });
  });

  it("10. cooldown de 60s entre reenvios", async () => {
    const { linha } = linhaViva({ updated_at: new Date(Date.now() - 5000).toISOString() });
    const r = await solicitarCodigo(db(linha), { familyId: FAM, telefone: TEL });
    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ motivo: "cooldown" });
    expect((r as { segundosRestantes: number }).segundosRestantes).toBeLessThanOrEqual(
      COOLDOWN_REENVIO_SEG,
    );
    expect(enviarTextoMock).not.toHaveBeenCalled(); // não gasta mensagem
  });

  it("11. no 4º pedido para o mesmo número, recusa por excesso de reenvios", async () => {
    const { linha } = linhaViva({ reenvios: MAX_REENVIOS });
    const r = await solicitarCodigo(db(linha), { familyId: FAM, telefone: TEL });
    expect(r).toEqual({ ok: false, motivo: "max_reenvios" });
    expect(enviarTextoMock).not.toHaveBeenCalled();
  });

  it("12. REENVIAR invalida o código anterior e zera as tentativas", async () => {
    const { linha, codigo } = linhaViva({ tentativas: 3 });
    const cli = db(linha);
    const hashAntigo = cli.store.linha!.codigo_hash;

    await solicitarCodigo(cli, { familyId: FAM, telefone: TEL });
    expect(cli.store.linha!.codigo_hash).not.toBe(hashAntigo);
    expect(cli.store.linha!.tentativas).toBe(0);
    expect(cli.store.linha!.reenvios).toBe(1);

    // o código velho não vale mais
    const r = await confirmarCodigo(cli, { familyId: FAM, telefone: TEL, codigo });
    expect(r).toEqual({ ok: false, motivo: "codigo_errado" });
  });
});

describe("o telefone faz parte da conferência", () => {
  it("13. código correto confirma EXATAMENTE o número correspondente", async () => {
    const { linha, codigo } = linhaViva();
    const cli = db(linha);
    const r = await confirmarCodigo(cli, { familyId: FAM, telefone: TEL, codigo });
    expect(r).toEqual({ ok: true });
    expect(cli.store.linha!.verificado_em).toBeTruthy();
    expect(cli.store.linha!.telefone_e164).toBe(TEL);
  });

  it("14. o mesmo código NÃO confirma outro número", async () => {
    const { linha, codigo } = linhaViva();
    const r = await confirmarCodigo(db(linha), { familyId: FAM, telefone: OUTRO, codigo });
    expect(r).toEqual({ ok: false, motivo: "sem_pedido" });
  });

  it("15. TROCAR o número invalida a confirmação anterior", async () => {
    const { linha, codigo } = linhaViva();
    const cli = db(linha);
    await confirmarCodigo(cli, { familyId: FAM, telefone: TEL, codigo });
    expect(await estaVerificado(cli, { familyId: FAM, telefone: TEL })).toBe(true);
    // a família corrige o número: a verificação de antes não vale para o novo
    expect(await estaVerificado(cli, { familyId: FAM, telefone: OUTRO })).toBe(false);
  });

  it("16. trocar de número LIBERA novo pedido — o limite do número errado não prende", async () => {
    const { linha } = linhaViva({ reenvios: MAX_REENVIOS, updated_at: new Date().toISOString() });
    const r = await solicitarCodigo(db(linha), { familyId: FAM, telefone: OUTRO });
    expect(r).toEqual({ ok: true });
    expect(enviarTextoMock.mock.calls[0][0].phoneE164).toBe(OUTRO);
  });
});

describe("falhas não deixam estado pela metade", () => {
  it("17. Z-API falhou → NÃO grava desafio e NÃO finge que enviou", async () => {
    enviarTextoMock.mockRejectedValueOnce(new Error("z-api 500"));
    const cli = db();
    const r = await solicitarCodigo(cli, { familyId: FAM, telefone: TEL });
    expect(r).toEqual({ ok: false, motivo: "envio_falhou" });
    expect(cli.store.linha).toBeNull(); // nenhum desafio vivo que ela nunca recebeu
    expect(logServerErrorMock).toHaveBeenCalled();
  });

  it("18. o erro da Z-API não vaza payload nem telefone para o log", async () => {
    enviarTextoMock.mockRejectedValueOnce(
      new Error(`falha ao mandar para ${TEL} com token ZAPI-SEGREDO-123`),
    );
    await solicitarCodigo(db(), { familyId: FAM, telefone: TEL });
    const logs = JSON.stringify(logServerErrorMock.mock.calls);
    expect(logs).not.toContain("ZAPI-SEGREDO-123");
    expect(logs).not.toContain(TEL);
  });

  it("19. sem pedido nenhum, não confirma", async () => {
    const r = await confirmarCodigo(db(null), { familyId: FAM, telefone: TEL, codigo: "123456" });
    expect(r).toEqual({ ok: false, motivo: "sem_pedido" });
  });

  it("20. código com formato errado não confirma", async () => {
    const { linha } = linhaViva();
    for (const ruim of ["", "12345", "abcdef", "1234567"]) {
      const r = await confirmarCodigo(db(linha), { familyId: FAM, telefone: TEL, codigo: ruim });
      expect(r.ok).toBe(false);
    }
  });
});

describe("retry e idempotência", () => {
  it("21. pedir duas vezes NÃO cria duas verificações vivas", async () => {
    const cli = db();
    await solicitarCodigo(cli, { familyId: FAM, telefone: TEL });
    cli.store.linha!.updated_at = new Date(Date.now() - 90_000).toISOString();
    await solicitarCodigo(cli, { familyId: FAM, telefone: TEL });
    // O banco falso tem UMA linha por família, como o índice único da 0080.
    expect(cli.store.linha).toBeTruthy();
    expect(cli.store.linha!.reenvios).toBe(1);
  });

  it("22. confirmar duas vezes com o código certo não quebra", async () => {
    const { linha, codigo } = linhaViva();
    const cli = db(linha);
    expect(await confirmarCodigo(cli, { familyId: FAM, telefone: TEL, codigo })).toEqual({ ok: true });
    const segunda = await confirmarCodigo(cli, { familyId: FAM, telefone: TEL, codigo });
    expect(segunda.ok).toBe(true);
    expect(cli.store.linha!.telefone_e164).toBe(TEL);
  });
});

describe("guardas de estrutura", () => {
  it("23. os parâmetros aprovados estão em UM lugar só, e são os decididos", () => {
    expect(VALIDADE_MIN).toBe(10);
    expect(MAX_TENTATIVAS).toBe(5);
    expect(MAX_REENVIOS).toBe(3);
    expect(COOLDOWN_REENVIO_SEG).toBe(60);
  });

  it("24. o hash é sha256 e não guarda o código", () => {
    const h = hashCodigo("123456");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain("123456");
    expect(hashCodigo("123456")).toBe(h); // determinístico
    expect(hashCodigo("123457")).not.toBe(h);
  });

  it("25. tempo constante na comparação — o módulo usa timingSafeEqual", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const fonte = readFileSync(resolve(__dirname, "verificacao.ts"), "utf8");
    expect(fonte).toMatch(/timingSafeEqual/);
    expect(fonte).not.toMatch(/Math\.random/);
  });
});
