import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { BancoMemoria, novoId } from "@/lib/ayla/__harness/banco-memoria";
const mock = vi.hoisted(() => ({ client: vi.fn(), resolve: vi.fn(), active: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mock.client, createServiceRoleClient: mock.client }));
vi.mock("@/lib/auth/current-family", () => ({ resolveFamily: mock.resolve }));
vi.mock("@/lib/auth/require-active-write", () => ({ requireActiveWrite: mock.active, SubscriptionBlockedError: class extends Error {} }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/log", () => ({ logEvent: vi.fn(async () => {}) }));
import { criarConversa } from "./actions";
const original = process.env.AYLA_QUALIDADE_RESPOSTA_V2;
let db: BancoMemoria;
let family: string;
let pessoa: string;
beforeEach(() => {
  process.env.AYLA_QUALIDADE_RESPOSTA_V2 = "on";
  db = new BancoMemoria(); family = novoId("fam"); pessoa = novoId("membro");
  db.semear("membros_atipicos", [{ id: pessoa, family_account_id: family, ativo: true }]);
  mock.client.mockResolvedValue({ from: db.from.bind(db), auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) } });
  mock.resolve.mockResolvedValue({ data: { id: family } });
});
afterEach(() => { if (original == null) delete process.env.AYLA_QUALIDADE_RESPOSTA_V2; else process.env.AYLA_QUALIDADE_RESPOSTA_V2 = original; });
const abrir = () => criarConversa({ membroAtipicoId: pessoa, texto: "", temaEscolhido: "sono" });
describe("abrir e retomar área por família/pessoa", () => {
  it("abre com convite e retoma sem duplicar conversa ou apresentação", async () => {
    const r = await abrir();
    expect(r).toHaveProperty("conversaId");
    // Default do Postgres; o banco em memória não aplica defaults.
    db.linhas("conversas")[0].encerrada = false;
    expect(await abrir()).toEqual(r);
    expect(db.linhas("conversas")).toHaveLength(1);
    expect(db.linhas("mensagens_skill")).toHaveLength(1);
  });
  it("não retoma a conversa do irmão nem a de outra família", async () => {
    db.semear("conversas", [
      { family_account_id: family, membro_atipico_id: novoId("irmao"), encerrada: false, contexto_inicial: { tema_escolhido: "sono" } },
      { family_account_id: novoId("outra"), membro_atipico_id: pessoa, encerrada: false, contexto_inicial: { tema_escolhido: "sono" } },
    ]);
    const r = await abrir();
    expect(r).toHaveProperty("conversaId");
    expect(db.linhas("conversas")).toHaveLength(3);
    expect(db.linhas("conversas")[2].membro_atipico_id).toBe(pessoa);
  });
  it("rejeita pessoa de outra família antes de criar conversa", async () => {
    pessoa = novoId("outra");
    expect(await abrir()).toHaveProperty("erro");
    expect(db.linhas("conversas")).toHaveLength(0);
  });
  it("falha silenciosa na primeira mensagem não vira sucesso nem conversa órfã", async () => {
    db.falhamAoEscrever.add("mensagens_skill");
    expect(await abrir()).toHaveProperty("erro");
    expect(db.linhas("conversas")).toHaveLength(0);
  });
  it("recupera conversa temática antiga que ficou vazia", async () => {
    const id = novoId("conv");
    db.semear("conversas", [{ id, family_account_id: family, membro_atipico_id: pessoa, encerrada: false, contexto_inicial: { tema_escolhido: "sono" } }]);
    expect(await abrir()).toEqual({ conversaId: id });
    expect(db.linhas("mensagens_skill")[0].conteudo).toBe("Quero explorar Sono Tranquilo.");
  });
  it("off e área inventada não criam conversa temática", async () => {
    process.env.AYLA_QUALIDADE_RESPOSTA_V2 = "off";
    expect(await abrir()).toHaveProperty("erro");
    process.env.AYLA_QUALIDADE_RESPOSTA_V2 = "on";
    expect(await criarConversa({ membroAtipicoId: pessoa, texto: "", temaEscolhido: "admin" })).toHaveProperty("erro");
    expect(db.linhas("conversas")).toHaveLength(0);
  });
});
