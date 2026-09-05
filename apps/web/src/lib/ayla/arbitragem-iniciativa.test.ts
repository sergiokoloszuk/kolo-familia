import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BancoMemoria } from "./__harness/banco-memoria";
import {
  conversaAtiva,
  iniciativaDoDiaConsumida,
  trialObrigatorioHoje,
  podeIniciarConversa,
  JANELA_CONVERSA_ATIVA_MS,
} from "./cadencia";

const FAM = "11111111-1111-1111-1111-111111111111";
const AGORA = new Date("2026-09-04T18:00:31.000Z");
const min = (n: number) => new Date(AGORA.getTime() - n * 60_000).toISOString();

function mundo(opts: {
  inbound?: string[];
  jaEnviadas?: Array<{ template_key: string; created_at: string }>;
  trialEndsAt?: string | null;
}) {
  const db = new BancoMemoria();
  db.semear(
    "ayla_messages",
    (opts.inbound ?? []).map((created_at, i) => ({
      id: `m${i}`,
      family_account_id: FAM,
      direcao: "inbound",
      texto: "oi",
      created_at,
    })),
  );
  db.semear(
    "ayla_send_log",
    (opts.jaEnviadas ?? []).map((l, i) => ({
      id: `s${i}`,
      family_account_id: FAM,
      status: "enviada",
      ...l,
    })),
  );
  db.semear(
    "subscription_accesses",
    opts.trialEndsAt
      ? [{ family_account_id: FAM, status: "trialing", trial_ends_at: opts.trialEndsAt }]
      : [],
  );
  return db as never;
}

/**
 * O INCIDENTE VANESSA — 04/09/2026, duas Aylas em seis segundos.
 *
 * ⚠️ ÀS 18:00:31 saiu a proativa ("qual é o desafio que tá pegando mais agora
 * com o Miguel?"). ÀS 18:00:37 saiu o aviso de que faltavam 3 dias do teste.
 * `trial_d3` estava em `PROATIVAS_ISENTAS`, e isento significava "não passo
 * pela janela de cadência".
 *
 * REGRA DE PRODUTO: o Trial obrigatório CONTA como a iniciativa do dia.
 */
describe("arbitragem entre iniciativas", () => {
  it("A1. MORDE: com Trial elegível hoje, a proativa cede", async () => {
    // trial_ends_at daqui a 3 dias = `trial_d3` elegível hoje.
    const db = mundo({ trialEndsAt: "2026-09-07T12:00:00.000Z" });
    expect(await trialObrigatorioHoje(db, FAM, AGORA)).toBe(true);
    const r = await podeIniciarConversa(db, { familyAccountId: FAM, tipo: "rotina", agora: AGORA });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.motivo).toMatch(/Trial obrigat/);
  });

  it("A2. MORDE: e o Trial, esse sim, pode falar", async () => {
    const db = mundo({ trialEndsAt: "2026-09-07T12:00:00.000Z" });
    const r = await podeIniciarConversa(db, { familyAccountId: FAM, tipo: "trial_d3", agora: AGORA });
    expect(r.ok).toBe(true);
  });

  it("A3. MORDE: consumida a vaga do dia, ninguém mais inicia", async () => {
    const db = mundo({ jaEnviadas: [{ template_key: "rotina", created_at: min(30) }] });
    expect(await iniciativaDoDiaConsumida(db, FAM, AGORA)).toBe(true);
    const r = await podeIniciarConversa(db, { familyAccountId: FAM, tipo: "rotina", agora: AGORA });
    expect(r.ok).toBe(false);
  });

  /** ⚠️ `boas_vindas` é a abertura da relação — não disputa vaga com ninguém. */
  it("A4. MORDE: boas_vindas não consome a vaga do dia", async () => {
    const db = mundo({ jaEnviadas: [{ template_key: "boas_vindas", created_at: min(60) }] });
    expect(await iniciativaDoDiaConsumida(db, FAM, AGORA)).toBe(false);
  });

  /**
   * ⚠️ NEM O TRIAL ENTRA NO MEIO DE UM TURNO. A Vanessa respondeu "Ok"
   * dezessete minutos depois e recebeu uma pergunta e um plano.
   */
  it("A5. MORDE: conversa ativa cala as duas — proativa E Trial", async () => {
    const db = mundo({ inbound: [min(5)], trialEndsAt: "2026-09-07T12:00:00.000Z" });
    expect(await conversaAtiva(db, FAM, AGORA)).toBe(true);
    for (const tipo of ["rotina", "trial_d3"]) {
      const r = await podeIniciarConversa(db, { familyAccountId: FAM, tipo, agora: AGORA });
      expect(r.ok, `${tipo} não podia entrar`).toBe(false);
      expect(r.ok === false && r.motivo).toMatch(/conversa ativa/);
    }
  });

  /** ⚠️ E CONVERSA ENCERRADA NÃO É CONVERSA ATIVA — a regra não é "falou hoje". */
  it("A6. MORDE: quem falou de manhã recebe a iniciativa à tarde", async () => {
    const db = mundo({ inbound: [min(JANELA_CONVERSA_ATIVA_MS / 60_000 + 10)] });
    expect(await conversaAtiva(db, FAM, AGORA)).toBe(false);
    const r = await podeIniciarConversa(db, { familyAccountId: FAM, tipo: "rotina", agora: AGORA });
    expect(r.ok).toBe(true);
  });

  it("A7. MORDE: o portão roda ANTES da reserva, e vale para as isentas", () => {
    const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");
    const iPortao = ORCH.indexOf("await podeIniciarConversa(supabase");
    const iReserva = ORCH.indexOf("reservarEnvioProativo(supabase");
    expect(iPortao).toBeGreaterThan(0);
    expect(iPortao).toBeLessThan(iReserva);
    // A condição do portão NÃO exclui as isentas de cadência.
    expect(ORCH).toMatch(/category === "proativa" && params\.tipo !== "boas_vindas"/);
  });
});
