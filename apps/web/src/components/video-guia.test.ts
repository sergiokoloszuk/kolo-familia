import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * O GUIA EM VÍDEO — 05/08/2026.
 *
 * A auditoria do trial achou 21 de 42 famílias chegando ao fim do teste sem
 * nunca ter escrito pra Ayla: elas entram e não descobrem o que dá pra pedir.
 * O vídeo entra em dois lugares — depois de criar a conta e sempre na Home.
 *
 * Nada de arquitetura nova: a tela de boas-vindas já existia, `boas_vindas_
 * vista_at` já marcava o primeiro acesso, `pularBoasVindas` já estava escrita
 * (e nunca ligada a um botão) e /api/track aceita qualquer evento.
 */

const VIDEO = readFileSync(resolve(__dirname, "video-guia.tsx"), "utf8");
const PAGE_BV = readFileSync(resolve(__dirname, "../app/boas-vindas/page.tsx"), "utf8");
const FORM_BV = readFileSync(resolve(__dirname, "../app/boas-vindas/form.tsx"), "utf8");
const ACTIONS_BV = readFileSync(resolve(__dirname, "../app/boas-vindas/actions.ts"), "utf8");
const PAINEL = readFileSync(resolve(__dirname, "../app/(app)/painel/page.tsx"), "utf8");

describe("o embed é o oficial do Tella", () => {
  it("usa a URL que a própria página do vídeo declara em og:video", () => {
    expect(VIDEO).toContain("https://www.tella.tv/video/vid_cmsens8k600sl04l150o8gy18/embed");
  });

  it("nada foi baixado nem copiado pro projeto", () => {
    expect(VIDEO).toMatch(/Nada é\n \* baixado nem copiado pro projeto/);
  });

  it("proporção fixa — o player não pula no mobile", () => {
    expect(VIDEO).toMatch(/aspectRatio: "16 \/ 9"/);
    expect(VIDEO).toMatch(/overflow-hidden/);
  });
});

describe("aparece uma vez só, com o que já existia", () => {
  it("o primeiro acesso continua sendo `boas_vindas_vista_at`", () => {
    expect(PAGE_BV).toMatch(/if \(family\.boas_vindas_vista_at\) redirect\("\/painel"\)/);
    expect(ACTIONS_BV).toMatch(/boas_vindas_vista_at: new Date\(\)\.toISOString\(\)/);
  });

  it("pular marca como vista e entra na Home — sem virar 'assistiu'", () => {
    expect(FORM_BV).toMatch(/<form action=\{pularBoasVindas\}>/);
    expect(FORM_BV).toMatch(/Pular por enquanto/);
    expect(ACTIONS_BV).toMatch(/redirect\("\/painel"\)/);
  });

  it("a ação de pular já existia e nunca tinha sido ligada", () => {
    expect(FORM_BV).toMatch(/a ação já existia e nunca tinha sido ligada a um botão/);
  });
});

describe("a duração do período é a real, nunca 7 no braço", () => {
  it("lê trial_ends_at — a mesma fonte do banner da Home", () => {
    expect(PAGE_BV).toMatch(/\.from\("subscription_accesses"\)/);
    expect(PAGE_BV).toMatch(/trial_ends_at/);
    expect(PAGE_BV).toMatch(/nunca "7 dias" no braço/i);
  });

  it("cortesia não vira 'gratuito'", () => {
    expect(PAGE_BV).toMatch(/cortesia: sub\?\.cortesia === true/);
    expect(FORM_BV).toMatch(/periodo\.cortesia \? "de cortesia" : "gratuito"/);
  });

  it("assinante não vê aviso de período", () => {
    expect(PAGE_BV).toMatch(/if \(!fim \|\| sub\?\.status === "active"\) return null/);
    expect(FORM_BV).toMatch(/\{periodo && \(/);
  });

  it("nenhuma segunda lógica de trial — o banner da Home segue igual", () => {
    expect(PAINEL).toMatch(/trialDaysLeft=\{trialDaysLeft\}/);
  });
});

describe("na Home, o vídeo é secundário", () => {
  it("entra depois das boas-vindas e antes dos sinais", () => {
    const iVideo = PAINEL.indexOf("<CardVideoGuia />");
    const iSinais = PAINEL.indexOf("TIRA DE SINAIS");
    const iRegistro = PAINEL.indexOf("REGISTRO DO DIA");
    expect(iVideo).toBeGreaterThan(0);
    expect(iVideo).toBeLessThan(iSinais);
    expect(iVideo).toBeLessThan(iRegistro);
  });

  it("é card discreto, não hero — abre em modal sem tirar ninguém da plataforma", () => {
    expect(VIDEO).toMatch(/Conheça tudo o que você pode fazer na Kolo/);
    expect(VIDEO).toMatch(/role="dialog"/);
    expect(VIDEO).toMatch(/aria-modal="true"/);
  });

  it("dá pra fechar o modal", () => {
    expect(VIDEO).toMatch(/onClick=\{\(\) => setAberto\(false\)\}/);
    expect(VIDEO).toMatch(/Fechar/);
  });

  it("mobile: empilha e não estoura a largura", () => {
    expect(VIDEO).toMatch(/flex-col gap-3 rounded-2xl[^"]*md:flex-row/);
    expect(VIDEO).toMatch(/w-full max-w-3xl/);
  });
});

describe("eventos — sem schema novo", () => {
  it("exibido e pulado, no onboarding", () => {
    expect(FORM_BV).toMatch(/track\("onboarding_video_exibido"\)/);
    expect(FORM_BV).toMatch(/track\("onboarding_video_pulado"\)/);
  });

  it("aberto, na Home", () => {
    expect(VIDEO).toMatch(/track\("home_video_aberto"\)/);
  });

  it("NÃO inventa 'concluído' — o embed não expõe isso de forma confiável", () => {
    expect(VIDEO).not.toMatch(/onboarding_video_concluido/);
    expect(FORM_BV).not.toMatch(/onboarding_video_concluido/);
  });
});
