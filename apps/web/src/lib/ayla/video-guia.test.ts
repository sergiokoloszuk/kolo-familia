import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { textoVideoGuia } from "./orchestrator";

/**
 * CAMPANHA DO VÍDEO INSTITUCIONAL — 06/08/2026.
 *
 * 17 famílias elegíveis, uma mensagem cada, na janela preferida de cada uma.
 * O que este arquivo protege é o que dá pra errar de graça: mandar duas vezes,
 * mandar fora da janela, mandar pra quem já viu, e errar o gênero da criança.
 */

const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");
const CRON = readFileSync(resolve(__dirname, "../../app/api/ayla/cron/route.ts"), "utf8");
const VERCEL = readFileSync(resolve(__dirname, "../../../vercel.json"), "utf8");

const LINK = "https://www.tella.tv/video/como-usar-a-kolo-familia-guia-completo-gy18";

describe("o link é o público, e é um só", () => {
  it("usa a URL pública — nunca /embed", () => {
    const t = textoVideoGuia({ nomeMae: "Ana", nomeMembro: "Léo" });
    expect(t).toContain(LINK);
    expect(t).not.toContain("/embed");
  });

  it("o link do WhatsApp e o do app são o MESMO vídeo", () => {
    // O app usa o /embed (é um iframe); o WhatsApp usa a página. Mesmo id.
    const APP = readFileSync(resolve(__dirname, "../../components/video-guia.tsx"), "utf8");
    expect(APP).toContain("gy18");
    expect(LINK).toContain("gy18");
  });
});

describe("gênero — a mensagem não pode errar quem é a criança", () => {
  it("a frase da evolução é NEUTRA, sem pronome", () => {
    const t = textoVideoGuia({ nomeMae: "Ana", nomeMembro: "Manu" });
    expect(t).toContain("acompanhar a evolução");
    expect(t).not.toMatch(/evolução d(ele|ela)/);
  });

  it("sem nome da criança, a mensagem continua correta", () => {
    const t = textoVideoGuia({ nomeMae: "Ana", nomeMembro: null });
    expect(t).toContain("montar histórias,");
    expect(t).not.toMatch(/\bdo\s+—|\bsobre\s+—|undefined|null/);
  });

  it("sem nome da mãe, não sai vocativo quebrado", () => {
    const t = textoVideoGuia({ nomeMae: null, nomeMembro: "Léo" });
    expect(t.startsWith("Oi 💛")).toBe(true);
    expect(t).not.toMatch(/Oi, \s/);
  });
});

describe("é ativação, não lembrete de trial", () => {
  const t = textoVideoGuia({ nomeMae: "Ana", nomeMembro: "Léo" });
  it("sem preço, sem contagem regressiva, sem venda", () => {
    for (const proibido of [/R\$/, /assinar/i, /assinatura/i, /acaba em/i, /\bdias restantes\b/i]) {
      expect(t).not.toMatch(proibido);
    }
  });
  it("não termina com pergunta e não exige resposta", () => {
    expect(t.trim().endsWith("?")).toBe(false);
    expect(t).not.toMatch(/qual desafio/i);
    expect(t).not.toMatch(/quanto mais você me conta/i);
  });
  it("ensina que basta contar uma situação", () => {
    expect(t).toMatch(/não precisa saber qual ferramenta/i);
    expect(t).toMatch(/por texto ou por áudio/i);
  });
});

describe("uma vez é uma vez", () => {
  it("a dedup é verificada IMEDIATAMENTE antes do envio, não só na seleção", () => {
    const trecho = ORCH.slice(
      ORCH.indexOf("export async function sendVideoGuia"),
      ORCH.indexOf("PROATIVA: Emocional streak"),
    );
    expect(trecho).toMatch(/await abriuGuiaNoApp\(supabase, familyAccountId\)/);
    expect(trecho).toMatch(/await jaRecebeuVideoGuia\(supabase, familyAccountId\)/);
    // e as duas vêm ANTES de carregar o contexto e despachar
    expect(trecho.indexOf("jaRecebeuVideoGuia")).toBeLessThan(trecho.indexOf("enviarEPersistir"));
  });

  it("a prova de envio sai do próprio texto — sem coluna nova", () => {
    expect(ORCH).toMatch(/\.ilike\("texto", "%tella\.tv\/video\/como-usar-a-kolo%"\)/);
    expect(ORCH).toMatch(/sem coluna nova, sem tabela nova e sem migração/);
  });

  it("passa pelo funil único de proativa (segurança, pausa, cadência)", () => {
    expect(ORCH).toMatch(/podeEnviarProativa\(\s*supabase,\s*\{ family_account_id: familyAccountId, agora \},\s*"video_guia",/);
  });

  it("em falha da consulta de dedup, NÃO envia", () => {
    const f = ORCH.slice(ORCH.indexOf("async function jaRecebeuVideoGuia"), ORCH.indexOf("O texto da campanha"));
    expect(f).toMatch(/\} catch \{\s*return true;\s*\}/);
  });

  it("`onboarding_video_exibido` NÃO conta como visto", () => {
    // `abriuGuiaNoApp` só olha os dois eventos de CLIQUE.
    expect(ORCH).toMatch(/\.in\("evento", \["home_video_aberto", "onboarding_video_aberto"\]\)/);
  });
});

describe("janela preferida — cada família na dela", () => {
  it("o runner filtra pela janela, como a rotina diária faz", () => {
    const r = CRON.slice(CRON.indexOf("async function runVideoGuia"), CRON.indexOf("Roda rotina diária"));
    expect(r).toMatch(/horaAtualLocal >= inicio && horaAtualLocal <= fim/);
    expect(r).toMatch(/horaLocalHHMM\(agora\)/);
  });

  it("o cron cobre as QUATRO janelas do produto", () => {
    // 11,15,18,22 UTC = 08h, 12h, 15h e 19h em Brasília.
    expect(VERCEL).toMatch(/"\/api\/ayla\/cron\?tipo=video_guia",\s*"schedule": "0 11,15,18,22 \* \* \*"/);
  });

  it("só TRIAL ATIVO — assinante e trial vencido ficam de fora", () => {
    const r = CRON.slice(CRON.indexOf("async function runVideoGuia"), CRON.indexOf("Roda rotina diária"));
    expect(r).toMatch(/\.eq\("status", "trialing"\)/);
    expect(r).toMatch(/new Date\(a\.trial_ends_at as string\) >= agora/);
    // `filtrarComAcesso` deixaria passar active e past_due — por isso não é
    // CHAMADO aqui (o nome aparece só no comentário que explica a escolha).
    expect(r).not.toMatch(/await filtrarComAcesso\(/);
  });

  it("o tipo está registrado na rota", () => {
    expect(CRON).toMatch(/if \(tipo === "video_guia"\) return await runVideoGuia\(supabase\);/);
  });
});
