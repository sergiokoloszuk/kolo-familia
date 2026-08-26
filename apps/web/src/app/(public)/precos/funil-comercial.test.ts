import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { ctaDoEstado } from "./cta-por-estado";
import { origemValida } from "./marco-origem";
import { linkPlanos } from "@/lib/billing/destino-comercial";

/**
 * O FUNIL COMERCIAL DO TRIAL — 26/08/2026.
 *
 * ⚠️ O DEFEITO MEDIDO. A Ayla manda o convite de fim de teste com `/precos` — a
 * rota certa. Só que a página é pública e sempre mostrou o mesmo botão:
 * **"Começar 7 dias grátis" → `/signup`**. A família clicava no convite para
 * assinar e chegava num convite para começar o teste que ela já fazia.
 *
 * ⚠️ E O ELO QUE FALTAVA. `trial_fechamento_tentativa` (elegível/enviado),
 * `checkout_iniciado` e a assinatura já existiam. Faltava o do MEIO: se a
 * família abriu a página. Sem ele, "mandamos e ninguém assinou" não distingue
 * *não clicou* de *clicou e a página não convenceu*.
 */
const PAGINA = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8");
const MARCO_BRUTO = fs.readFileSync(path.join(__dirname, "marco-origem.tsx"), "utf8");
/**
 * ⚠️ SEM OS COMENTÁRIOS. Eles EXPLICAM por que `familyId` não pode ir na URL —
 * e um teste que procura a palavra no arquivo inteiro acusaria justamente a
 * documentação da regra que ele existe para proteger.
 */
const MARCO = MARCO_BRUTO.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/**
 * `linkPlanos` lê `NEXT_PUBLIC_APP_URL` e devolve `null` sem ela — degradação
 * deliberada, para o link nunca sair quebrado. No teste a variável é fixada,
 * senão mediríamos a ausência de configuração em vez do formato da URL.
 */
process.env.NEXT_PUBLIC_APP_URL ||= "https://exemplo.test";

describe("1 · o CTA por estado", () => {
  it("visitante continua vendo o teste grátis — o público não mudou", () => {
    const c = ctaDoEstado("visitante");
    expect(c.rotulo).toBe("Começar 7 dias grátis");
    expect(c.destino).toBe("/signup");
    expect(c.nota).toBeNull();
  });

  it("MORDE: família EM TRIAL não é convidada a começar outro teste", () => {
    const c = ctaDoEstado("em_trial");
    expect(c.rotulo).not.toMatch(/grátis|come[çc]ar/i);
    expect(c.destino).not.toBe("/signup");
    expect(c.nota).toBeTruthy();
  });

  it("MORDE: trial vencido também vai para o checkout, não para o signup", () => {
    const c = ctaDoEstado("trial_vencido");
    expect(c.destino).toBe("/assinatura");
    expect(c.rotulo).not.toMatch(/grátis/i);
  });

  it("MORDE: assinante NÃO recebe convite para comprar de novo", () => {
    const c = ctaDoEstado("assinante");
    expect(c.rotulo).toMatch(/minha assinatura/i);
    expect(c.rotulo).not.toMatch(/assinar|grátis|come[çc]ar/i);
    expect(c.nota).toMatch(/j[áa] tem uma assinatura ativa/i);
  });

  it("o destino de quem tem conta é a tela que JÁ tem o checkout canônico", () => {
    // `/assinatura` mostra "Assinar mensal — R$ x/mês" e "Assinar anual", com o
    // preço conferido antes de abrir o Stripe. Reescrever isso em /precos
    // criaria uma segunda porta para a mesma cobrança.
    for (const e of ["em_trial", "trial_vencido", "assinante"] as const) {
      expect(ctaDoEstado(e).destino).toBe("/assinatura");
    }
  });
});

describe("2 · a origem no link — sem PII", () => {
  it("MORDE: só o vocabulário conhecido vira origem", () => {
    expect(origemValida("d7")).toBe("d7");
    expect(origemValida("d3")).toBe("d3");
    expect(origemValida("pos_trial")).toBe("pos_trial");
    // qualquer coisa colada na URL não inventa origem nova
    expect(origemValida("campanha_x")).toBeNull();
    expect(origemValida("")).toBeNull();
    expect(origemValida(undefined)).toBeNull();
    expect(origemValida(["d7", "d3"])).toBeNull();
  });

  it("MORDE: visita comum a /precos NÃO emite o evento", () => {
    // O `useEffect` sai cedo sem origem — é o que separa este número de um
    // contador de pageview.
    expect(MARCO).toMatch(/if \(!origem\) return;/);
  });

  it("MORDE: nenhum identificador de família viaja na URL", () => {
    const link = linkPlanos("d7") ?? "";
    expect(link).toMatch(/\/precos\?de=d7$/);
    expect(link).not.toMatch(/family|familia|email|telefone|phone|token|uid/i);
  });

  it("sem origem, o link canônico segue exatamente como era", () => {
    const link = linkPlanos() ?? "";
    if (link) expect(link).toMatch(/\/precos$/);
  });

  it("MORDE: quem liga o evento à família é o SERVIDOR, pela sessão", () => {
    // `/api/track` carimba a família pela sessão; o cliente não manda id.
    expect(MARCO).toMatch(/"\/api\/track"/);
    expect(MARCO).not.toMatch(/family_account_id|familyId/);
  });

  it("telemetria nunca atrapalha a página", () => {
    expect(MARCO).toMatch(/void fetch\(/);
    expect(MARCO).toMatch(/\.catch\(/);
    expect(MARCO).not.toMatch(/await fetch/);
  });
});

describe("3 · o que NÃO mudou na página", () => {
  it("MORDE: o preço continua vindo da fonte de produção", () => {
    expect(PAGINA).toMatch(/lerPlanosParaExibir\(admin\)/);
    // nenhum valor escrito à mão
    expect(PAGINA).not.toMatch(/R\$\s?\d/);
    expect(PAGINA).not.toMatch(/54[,.]90|603[,.]90/);
  });

  it("MORDE: os dois CTAs usam o estado — nenhum ficou preso em /signup", () => {
    expect(PAGINA).not.toMatch(/href="\/signup"/);
    expect((PAGINA.match(/href=\{cta\.destino\}/g) ?? []).length).toBe(2);
  });

  it("a página continua dinâmica — o preço e o estado são lidos por request", () => {
    expect(PAGINA).toMatch(/export const dynamic = "force-dynamic"/);
  });
});
