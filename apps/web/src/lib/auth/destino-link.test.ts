import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { destinoPermitido, normalizarDestino, DESTINO_PADRAO } from "./destino-link";

/**
 * PARA ONDE O LINK DA AYLA LEVA.
 *
 * Caso real (02/08/2026): a mãe pediu o relatório pro médico, a Ayla mandou o
 * link, e ele abriu `/estrategias`. O token estava CERTO — `acessos_app.next`
 * guardava `/evolucao/relatorio`, e a rota existe.
 *
 * O bug era a ordem: `/auth/wa` checava sessão ativa ANTES de ler o token, e
 * nesse caminho usava o `next` da QUERY STRING — que a Ayla não manda. Sem
 * `?next=`, caía no default. Quem já estava logada ia sempre pra Estratégias.
 */

const ROTA = readFileSync(resolve(__dirname, "../../app/auth/wa/route.ts"), "utf8");

describe("allowlist de destinos", () => {
  const OK = [
    "/painel",
    "/estrategias",
    "/assinatura",
    "/evolucao/relatorio",
    "/evolucao/registros",
    "/historias/criar",
    "/ludico/rotinas",
    "/ludico/rotinas/semana",
    "/ludico/rotinas/12dc78f3-6367-4b86-8d01-fb6f5be1abcc",
    "/ludico/desenhos",
    "/configuracoes/avatar",
    "/planos",
    "/planos/77763306-504b-4da4-9259-5e6eed1739a4",
  ];
  for (const d of OK) {
    it(`permite ${d}`, () => expect(destinoPermitido(d)).toBe(true));
  }

  it("os destinos REAIS de produção estão todos na lista", () => {
    // Os cinco que somam ~99% dos tokens em acessos_app, mais os específicos.
    for (const d of [
      "/ludico/rotinas/semana",
      "/configuracoes/avatar",
      "/historias/criar",
      "/evolucao/relatorio",
      "/ludico/desenhos",
    ]) {
      expect(destinoPermitido(d), `regressão: ${d} deixou de ser permitido`).toBe(true);
    }
  });

  const NAO = [
    "https://malicioso.com",
    "//malicioso.com",
    "/../admin",
    "/admin/familias",
    "/rota-que-nao-existe",
    "/ludico/rotinas/nao-e-uuid",
    "",
  ];
  for (const d of NAO) {
    it(`recusa ${JSON.stringify(d)}`, () => expect(destinoPermitido(d)).toBe(false));
  }
});

describe("fallback: destino inválido nunca vira 404", () => {
  it("cai na área mais próxima quando ela existe", () => {
    expect(normalizarDestino("/planos/nao-existe")).toBe("/planos");
    expect(normalizarDestino("/ludico/rotinas/xyz")).toBe("/ludico/rotinas");
    expect(normalizarDestino("/evolucao/inventado")).toBe("/evolucao");
  });

  it("sem área conhecida, vai pro padrão", () => {
    expect(normalizarDestino("/coisa-nenhuma")).toBe(DESTINO_PADRAO);
    expect(normalizarDestino(null)).toBe(DESTINO_PADRAO);
    expect(normalizarDestino("https://malicioso.com")).toBe(DESTINO_PADRAO);
  });

  it("destino válido passa intacto", () => {
    expect(normalizarDestino("/evolucao/relatorio")).toBe("/evolucao/relatorio");
  });
});

describe("a rota /auth/wa honra o token", () => {
  it("o destino é calculado ANTES da checagem de sessão", () => {
    const iDestino = ROTA.indexOf("const destino =");
    const iSessao = ROTA.indexOf("supabase.auth.getUser()");
    expect(iDestino).toBeGreaterThan(0);
    expect(iDestino, "o destino tem que ser resolvido antes do getUser").toBeLessThan(iSessao);
  });

  it("sessão ativa redireciona pro destino do token — não pro default", () => {
    expect(ROTA).toMatch(/if \(user\) return NextResponse\.redirect\(`\$\{origin\}\$\{destino\}`\)/);
    // A forma antiga — usar o next da query string — não pode voltar.
    expect(ROTA).not.toMatch(/if \(user\) return NextResponse\.redirect\(`\$\{origin\}\$\{nextUrl\}`\)/);
  });

  it("os três caminhos (logada, token novo, token antigo) usam o MESMO destino", () => {
    const usos = ROTA.match(/\$\{origin\}\$\{destino\}/g) ?? [];
    expect(usos.length).toBeGreaterThanOrEqual(3);
  });

  it("o artefato é conferido contra a família do token", () => {
    expect(ROTA).toMatch(/destinoDaFamilia\(admin, \{ destino: destinoBruto, familyId: acesso\.familyId \}\)/);
  });
});

describe("a gravação do token também filtra", () => {
  const ACESSO = readFileSync(resolve(__dirname, "acesso-link.ts"), "utf8");

  it("destinoSeguro usa a allowlist, não só o 'começa com barra'", () => {
    expect(ACESSO).toMatch(/return normalizarDestino\(next\)/);
    expect(ACESSO).not.toMatch(/n\.startsWith\("\/"\) && !n\.startsWith\("\/\/"\) \? n : "\/painel"/);
  });
});

describe("relatório: a fala não promete o que o sistema não faz", () => {
  const RESP = readFileSync(resolve(__dirname, "../ayla/responder.ts"), "utf8");

  it("deixa explícito que quem gera é ela, no app", () => {
    expect(RESP).toMatch(/o relatório é gerado POR ELA, NO APP/);
    expect(RESP).toMatch(/você NÃO gera aqui e NÃO manda o PDF pelo WhatsApp/);
  });

  it("proíbe dizer que já gerou ou que o arquivo vem depois", () => {
    expect(RESP).toMatch(/NUNCA diga ou insinue que já gerou, que está gerando, ou que o arquivo vem depois/);
  });

  it("o link continua apontando pra tela de Relatório", () => {
    expect(RESP).toMatch(/Este link abre DIRETO na tela de Relatório/);
  });
});
