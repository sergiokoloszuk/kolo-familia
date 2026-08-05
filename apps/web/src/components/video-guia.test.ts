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

  it("aberto — a porta usada vira o evento", () => {
    expect(VIDEO).toMatch(/track\(evento\)/);
    expect(VIDEO).toMatch(/evento = "home_video_aberto"/);
    expect(VIDEO).toMatch(/"home_video_aberto" \| "onboarding_video_aberto"/);
  });

  it("NÃO inventa 'concluído' — o embed não expõe isso de forma confiável", () => {
    expect(VIDEO).not.toMatch(/onboarding_video_concluido/);
    expect(FORM_BV).not.toMatch(/onboarding_video_concluido/);
  });
});

// ============================================================
// SEGUNDA CAMADA — vídeos de ajuda por área (05/08/2026)
// ============================================================

import { VIDEOS_AJUDA, videoDaArea } from "@/lib/video-ajuda";

const CONFIG = readFileSync(resolve(__dirname, "../lib/video-ajuda.ts"), "utf8");
const ORCH = readFileSync(resolve(__dirname, "../lib/ayla/orchestrator.ts"), "utf8");
const TEMPLATES = readFileSync(resolve(__dirname, "../lib/ayla/messageTemplates.ts"), "utf8");
const TELA6 = readFileSync(
  resolve(__dirname, "../app/onboarding/steps/tela-6-confirmacao.tsx"),
  "utf8",
);

describe("as 10 áreas estão configuradas e INVISÍVEIS hoje", () => {
  const AREAS = [
    "registro_diario", "perfil", "estrategias", "meus_planos", "evolucao",
    "ludico", "avatar", "historias", "rotina_visual", "desenho",
  ] as const;

  it("todas as 10 existem na configuração central", () => {
    for (const a of AREAS) expect(VIDEOS_AJUDA[a]).toBeDefined();
    expect(Object.keys(VIDEOS_AJUDA)).toHaveLength(10);
  });

  it("TODAS com url null — nada aparece em nenhuma página hoje", () => {
    for (const a of AREAS) expect(VIDEOS_AJUDA[a].url).toBeNull();
    for (const a of AREAS) expect(videoDaArea(a)).toBeNull();
  });

  it("cada uma já tem a chamada escrita — amanhã é só trocar o null", () => {
    for (const a of AREAS) expect(VIDEOS_AJUDA[a].chamada.length).toBeGreaterThan(10);
  });

  it("url null não renderiza nada — nem placeholder, nem 'em breve'", () => {
    expect(VIDEO).toMatch(/if \(!video\) return null/);
    expect(CONFIG).toMatch(/Sem card, sem espaço vazio, sem\n \* "em breve"/);
    // "em breve" só pode existir no comentário que o proíbe, nunca em JSX.
    const emBreve = VIDEO.split("\n").filter((l) => /em breve/i.test(l));
    for (const l of emBreve) expect(l.trim()).toMatch(/^(\*|\/\/|\/\*)/);
  });
});

describe("um player só no produto", () => {
  it("a ajuda contextual usa o MESMO PlayerGuia do institucional", () => {
    expect(VIDEO).toMatch(/<PlayerGuia titulo=\{video\.chamada\} src=\{video\.url!\} \/>/);
    expect(VIDEO.match(/<iframe/g)?.length).toBe(1);
  });

  it("abre em modal, como na Home", () => {
    const modais = VIDEO.match(/role="dialog"/g) ?? [];
    expect(modais.length).toBe(2);
  });

  it("é link discreto, não card grande — o vídeo é ajuda", () => {
    expect(VIDEO).toMatch(/text-sm font-medium text-brand-purple underline-offset-4/);
  });
});

describe("analytics reaproveitando /api/track", () => {
  it("registra a área que foi aberta", () => {
    expect(VIDEO).toMatch(/track\("video_ajuda_aberto", \{ pagina: area \}\)/);
  });
});

describe("o guia foi pro lugar que a família realmente vê", () => {
  it("está na última tela do onboarding, e RECOLHIDO", () => {
    expect(TELA6).toMatch(/<CardVideoGuia/);
    expect(TELA6).toMatch(/evento="onboarding_video_aberto"/);
    expect(TELA6).toMatch(/Quer ver como a Kolo funciona por dentro\?/);
    // Player aberto por padrão deixava a última tela do cadastro comprida no
    // celular, logo antes do botão que conclui.
    expect(TELA6).not.toMatch(/<PlayerGuia/);
  });

  it("o comentário registra por que não fica na /boas-vindas", () => {
    expect(TELA6).toMatch(/aquela tela foi FUNDIDA nesta/);
    expect(TELA6).toMatch(/0 de 82 famílias/);
  });
});

describe("a Ayla oferece o vídeo uma vez, e por último", () => {
  it("só quem NÃO clicou pra ver no app recebe o link", () => {
    expect(ORCH).toMatch(/const jaAbriuVideo = await abriuGuiaNoApp\(supabase, familyAccountId\)/);
    expect(ORCH).toMatch(/linkGuia: jaAbriuVideo \? null : LINK_GUIA_KOLO/);
  });

  it("o sinal é o CLIQUE, não a exibição — não inventa 'assistiu'", () => {
    // As DUAS portas contam — quem viu no onboarding e nunca voltou à Home
    // ficaria de fora se só a Home contasse.
    expect(ORCH).toMatch(/\.in\("evento", \["home_video_aberto", "onboarding_video_aberto"\]\)/);
    // O evento só pode aparecer no comentário que o exclui, nunca numa query.
    expect(ORCH).not.toMatch(/"evento", "onboarding_video_exibido"/);
    expect(ORCH).toMatch(/`onboarding_video_exibido` NÃO entra/);
    expect(ORCH).toMatch(/só diz que o\n   \* player esteve na tela — não que ela assistiu/);
  });

  it('"uma vez" sai de graça: a boas-vindas já é idempotente', () => {
    expect(ORCH).toMatch(/Boas-vindas já enviada\./);
    expect(ORCH).toMatch(/sem coluna nova e sem estado novo/);
  });

  it("em falha da consulta, NÃO manda — repetir pra quem já viu incomoda mais", () => {
    expect(ORCH).toMatch(/\} catch \{\n    return true;\n  \}/);
  });

  it("o link vem DEPOIS da ajuda, nunca antes", () => {
    const iAjuda = TEMPLATES.indexOf("Você não precisa saber o que pedir");
    const iLink = TEMPLATES.indexOf("params.linkGuia");
    expect(iLink).toBeGreaterThan(iAjuda);
    expect(TEMPLATES).toMatch(/se ela\n    \/\/ abrir com "assista nosso vídeo", virou propaganda/);
  });

  it("sem link, a mensagem continua exatamente como era", () => {
    expect(TEMPLATES).toMatch(/linkGuia\?: string \| null;/);
  });
});
