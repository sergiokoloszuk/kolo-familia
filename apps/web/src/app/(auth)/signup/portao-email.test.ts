import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * O PORTÃO DO E-MAIL NÃO PODE VOLTAR — 31/08/2026.
 *
 * ⚠️ MEDIDO EM PRODUÇÃO, não estimado: de 244 contas criadas, 78 nunca
 * confirmaram o e-mail. 32%. Nos últimos 30 dias, 45 de 120 (37,5%); nos
 * últimos 7, 5 de 11 (45%) — piorando. Todas essas pessoas já tinham digitado
 * e-mail, senha e aceitado os termos. O portão do WhatsApp, que vem depois e
 * prova mais, derruba 11%.
 *
 * Este arquivo prende duas coisas. Primeiro, o comportamento da função que
 * confirma (exercitada de verdade, com um cliente falso em memória — não por
 * regex). Segundo, o caso I do protocolo, que é o mais fácil de perder aqui:
 * quando a confirmação FALHA, a mãe tem que cair na tela de código de antes,
 * não numa tela sem saída. Remover o portão não pode significar remover a
 * saída de emergência.
 */

const usuarios = new Map<string, { created_at: string; email_confirmed_at: string | null }>();
let erroDeEscrita: string | null = null;
let escritas = 0;

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => ({
    auth: {
      admin: {
        async getUserById(id: string) {
          const u = usuarios.get(id);
          return u ? { data: { user: { id, ...u } }, error: null } : { data: null, error: null };
        },
        async updateUserById(id: string, attrs: { email_confirm?: boolean }) {
          escritas += 1;
          // ⚠️ O ponto da §7: este cliente DEVOLVE o erro, não lança. É assim
          // que o Supabase se comporta, e é assim que a falha da Rochelle
          // passou despercebida por seis handlers.
          if (erroDeEscrita) return { data: null, error: { message: erroDeEscrita } };
          const u = usuarios.get(id)!;
          if (attrs.email_confirm) u.email_confirmed_at = new Date().toISOString();
          return { data: { user: { id, ...u } }, error: null };
        },
      },
    },
  }),
}));

const { confirmarEmailAutomatico } = await import("./actions");

const agora = () => new Date().toISOString();
const atras = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const ID = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  usuarios.clear();
  erroDeEscrita = null;
  escritas = 0;
  vi.restoreAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("A. o caso normal: quem acabou de se cadastrar entra", () => {
  it("confirma o e-mail da conta recém-criada", async () => {
    usuarios.set(ID, { created_at: agora(), email_confirmed_at: null });
    const r = await confirmarEmailAutomatico(ID);
    expect(r.ok).toBe(true);
    expect(usuarios.get(ID)!.email_confirmed_at).not.toBeNull();
  });
});

describe("C. repetição — chamar duas vezes não pode se comportar mal", () => {
  it("a segunda chamada devolve ok e NÃO reescreve", async () => {
    usuarios.set(ID, { created_at: agora(), email_confirmed_at: null });
    await confirmarEmailAutomatico(ID);
    const escritasDepoisDaPrimeira = escritas;
    const r = await confirmarEmailAutomatico(ID);
    expect(r.ok).toBe(true);
    expect(escritas).toBe(escritasDepoisDaPrimeira);
  });
});

describe("F. falha de persistência — a escrita é conferida", () => {
  it("erro DEVOLVIDO pelo Supabase vira falha, nunca falso sucesso", async () => {
    usuarios.set(ID, { created_at: agora(), email_confirmed_at: null });
    erroDeEscrita = "database is in recovery mode";
    const r = await confirmarEmailAutomatico(ID);
    expect(r.ok).toBe(false);
    expect(usuarios.get(ID)!.email_confirmed_at).toBeNull();
  });
});

describe("B/D. a função se limita ao caso legítimo", () => {
  it("conta velha e não confirmada não é confirmada por esta rota", async () => {
    usuarios.set(ID, { created_at: atras(60), email_confirmed_at: null });
    const r = await confirmarEmailAutomatico(ID);
    expect(r).toEqual({ ok: false, motivo: "fora_da_janela" });
  });

  it("id que não existe não confirma nada", async () => {
    const r = await confirmarEmailAutomatico(ID);
    expect(r).toEqual({ ok: false, motivo: "nao_encontrado" });
  });

  it("id que não é uuid nem chega ao banco", async () => {
    const r = await confirmarEmailAutomatico("' or 1=1 --");
    expect(r).toEqual({ ok: false, motivo: "nao_encontrado" });
    expect(escritas).toBe(0);
  });
});

describe("I. o caso legítimo que não pode ser bloqueado", () => {
  const pagina = readFileSync(join(process.cwd(), "src/app/(auth)/signup/page.tsx"), "utf8");
  const semComentarios = pagina
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  it("a tela de código continua existindo como saída de emergência", () => {
    // Se a confirmação falhar, `setNeedsConfirm` é o que salva a mãe de uma
    // tela sem saída. Apagar a tela de código junto com o portão deixaria o
    // cadastro pior do que estava.
    expect(semComentarios).toContain("setNeedsConfirm(values.email)");
    expect(semComentarios).toContain("verifyOtp");
  });

  it("o sucesso da confirmação leva pro onboarding, não pra tela de código", () => {
    const trecho = semComentarios.slice(semComentarios.indexOf("confirmarEmailAutomatico("));
    expect(trecho).toContain("signInWithPassword");
    expect(trecho.indexOf("/onboarding")).toBeGreaterThan(0);
  });

  it("a entrada só acontece depois de a confirmação dar ok", () => {
    // Inverter estas duas linhas produziria um login que falha com
    // "email not confirmed" e uma mãe presa — sem erro no servidor.
    expect(semComentarios.indexOf("confirmarEmailAutomatico(")).toBeLessThan(
      semComentarios.indexOf("signInWithPassword"),
    );
  });
});
