import { describe, expect, it } from "vitest";
import { BancoMemoria } from "./__harness/banco-memoria";
import { rotinaConversaPendente, lerTemaEscolhido } from "./rotina-guiada";

describe("continuidade da rotina após a família responder", () => {
  it("não perde a ação depois do primeiro inbound da rajada", async () => {
    const db = new BancoMemoria();
    db.semear("ayla_messages", [
      { family_account_id: "f", membro_atipico_id: "m", direcao: "outbound", tipo: "rotina_conversa", created_at: "2026-09-07T12:55:10Z" },
      { family_account_id: "f", direcao: "inbound", texto: "Pode ser", created_at: "2026-09-07T12:55:34Z" },
      { family_account_id: "f", direcao: "inbound", texto: "Nao tem barco", created_at: "2026-09-07T12:55:35Z" },
    ]);
    expect(await rotinaConversaPendente(db.cliente(), "f", new Date("2026-09-07T12:55:40Z"))).toMatchObject({ membroId: "m" });
  });
  it("uma conclusão posterior fecha a ação anterior", async () => {
    const db = new BancoMemoria();
    db.semear("ayla_messages", [
      { family_account_id: "f", direcao: "outbound", tipo: "rotina_conversa", created_at: "2026-09-07T12:55:10Z" },
      { family_account_id: "f", direcao: "outbound", tipo: "rotina_pronta", created_at: "2026-09-07T12:56:10Z" },
    ]);
    expect(await rotinaConversaPendente(db.cliente(), "f", new Date("2026-09-07T12:57:00Z"))).toBeNull();
  });
  for (const texto of ["sim", "pode", "pode ser", "isso", "ok"]) {
    it(`${texto} isolado não é tema`, () => expect(lerTemaEscolhido(texto)).toBeNull());
  }
});
