import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BancoMemoria, novoId } from "@/lib/ayla/__harness/banco-memoria";

// Somente fixtures NOVAS e fictícias. Actions e renderização reais; banco,
// sessão, after e transporte controlados. Nenhum provider/DB/rede externo.
const estado = vi.hoisted(() => ({
  db: null as BancoMemoria | null, familyId: "", userId: "", autenticado: true,
  falhaMensagem: null as "erro" | "zero" | null, erroMembro: false,
  falhaConversa: null as "erro" | "zero" | null, perderRespostaMensagem: false,
  afters: [] as Array<() => unknown>, fetches: 0,
  cookieId: null as string | null,
}));

function cliente() {
  return {
    auth: { getUser: async () => ({ data: { user: estado.autenticado ? { id: estado.userId } : null }, error: null }) },
    from(tabela: string) {
      const q = estado.db!.from(tabela); let insert: Record<string, unknown> | null = null;
      const proxy = new Proxy(q, { get(target, key) {
        if (key === "then") return (resolve: (v: { data: unknown; error: unknown }) => unknown, reject?: (e: unknown) => unknown) => {
          if (estado.erroMembro && tabela === "membros_atipicos") return Promise.resolve({ data: null, error: { message: "erro sintético de leitura" } }).then(resolve, reject);
          if (insert && tabela === "conversas" && estado.falhaConversa) return Promise.resolve({ data: null, error: estado.falhaConversa === "erro" ? { code: "XX000" } : null }).then(resolve, reject);
          if (insert && tabela === "mensagens_skill" && estado.falhaMensagem) return Promise.resolve({ data: null, error: estado.falhaMensagem === "erro" ? { code: "XX000", message: "erro sintético de escrita" } : null }).then(resolve, reject);
          // PK real de ambas as tabelas: o harness genérico não a simula.
          if (insert?.id && estado.db!.linhas(tabela).some(r => r.id === insert!.id)) return Promise.resolve({ data: null, error: { code: "23505", message: "PK sintética" } }).then(resolve, reject);
          if (insert && tabela === "mensagens_skill" && estado.perderRespostaMensagem) {
            estado.perderRespostaMensagem = false;
            return target.then(() => { throw Error("ack sintético perdido depois da escrita"); }).then(resolve, reject);
          }
          return target.then(resolve, reject);
        };
        const valor = Reflect.get(target, key);
        if (typeof valor !== "function") return valor;
        return (...args: unknown[]) => {
          if (key === "insert") insert = args[0] as Record<string, unknown>;
          const ret = Reflect.apply(valor, target, args);
          return ret === target ? proxy : ret;
        };
      } });
      return proxy;
    },
  };
}
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => cliente(), createServiceRoleClient: () => { throw Error("Service client fora da prova"); } }));
vi.mock("@/lib/auth/current-family", () => ({ resolveFamily: async () => ({ data: { id: estado.familyId } }) }));
vi.mock("@/lib/auth/require-active-write", () => ({ requireActiveWrite: async () => undefined, SubscriptionBlockedError: class extends Error {} }));
vi.mock("next/server", () => ({ after: (f: () => unknown) => { estado.afters.push(f); } }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => { throw Error("Navegação não executada em SSR"); } }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => estado.cookieId ? { value: estado.cookieId } : undefined }) }));
vi.mock("@/lib/auth/require-user", () => ({ loadFamilyContext: async () => ({ supabase: cliente(), family: { id: estado.familyId } }) }));
vi.mock("@/components/video-guia", () => ({ VideoAjuda: () => null }));
vi.mock("@/lib/analytics/track", () => ({ trackFeature: () => { throw Error("Analytics externo fora da prova"); } }));

const { criarConversa } = await import("./actions");
const { ConversarForm } = await import("./conversar-form");
const { default: EstrategiasPage } = await import("../estrategias/page");
const TEXTO = "Relato inteiramente fictício de uma brincadeira com papel.";
let a: string, b: string;
function pedido(extra: Record<string, unknown> = {}) {
  return { membroAtipicoId: a, texto: TEXTO, requisicaoId: novoId("pedido-web"), ...extra };
}
beforeEach(() => {
  estado.db = new BancoMemoria(); estado.familyId = novoId("familia-ficticia"); estado.userId = novoId("ator-ficticio");
  a = novoId("membro-a"); b = novoId("membro-b");
  estado.db.semear("membros_atipicos", [
    { id: a, family_account_id: estado.familyId, nome: "Brisa", ativo: true },
    { id: b, family_account_id: estado.familyId, nome: "Cais", ativo: true },
  ]);
  estado.autenticado = true; estado.falhaMensagem = null; estado.falhaConversa = null; estado.perderRespostaMensagem = false;
  estado.erroMembro = false; estado.afters.length = 0; estado.fetches = 0;
  estado.cookieId = null;
  vi.stubGlobal("fetch", async () => { estado.fetches++; throw Error("Rede proibida no teste de entrada Web"); });
});

describe("entrada Web pelo chamador real Estratégias", () => {
  it("dois membros e nenhum contexto explícito não entram como primeiro filho", async () => {
    const html = renderToStaticMarkup(await EstrategiasPage({ searchParams: Promise.resolve({}) }));
    expect(html).not.toContain(`value="${a}" selected=""`);
    expect(html).toContain('value="" disabled="" selected=""');
  });
  it("cookie inválido não escolhe o primeiro filho", async () => {
    estado.cookieId = novoId("cookie-antigo");
    const html = renderToStaticMarkup(await EstrategiasPage({ searchParams: Promise.resolve({}) }));
    expect(html).not.toContain(`value="${a}" selected=""`);
    expect(html).toContain('value="" disabled="" selected=""');
  });
  it("cookie de membro válido continua sendo contexto explícito", async () => {
    estado.cookieId = b;
    const html = renderToStaticMarkup(await EstrategiasPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain(`value="${b}" selected=""`);
  });
  it("deep link válido vence o cookie de outro membro", async () => {
    estado.cookieId = a;
    const html = renderToStaticMarkup(await EstrategiasPage({ searchParams: Promise.resolve({ membro: b }) }));
    expect(html).toContain(`value="${b}" selected=""`);
    expect(html).not.toContain(`value="${a}" selected=""`);
  });
  it("membro único sem contexto continua legítimo no chamador real", async () => {
    estado.db!.linhas("membros_atipicos").splice(1);
    const html = renderToStaticMarkup(await EstrategiasPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain(`value="${a}" selected=""`);
  });
});
afterEach(() => { vi.unstubAllGlobals(); expect(estado.fetches).toBe(0); });

describe("entrada Web: escolha do membro real na renderização", () => {
  it("dois membros sem escolha não selecionam o primeiro filho", () => {
    const html = renderToStaticMarkup(createElement(ConversarForm, { membros: [{ id: a, nome: "Brisa" }, { id: b, nome: "Cais" }] }));
    expect(html).not.toContain(`value="${a}" selected=""`);
    expect(html).not.toContain(`value="${b}" selected=""`);
    expect(html).toContain('value="" disabled="" selected=""');
  });
  it("um alvo explícito válido continua selecionado", () => {
    const html = renderToStaticMarkup(createElement(ConversarForm, { membros: [{ id: a, nome: "Brisa" }, { id: b, nome: "Cais" }], initialMembroId: b }));
    expect(html).toContain(`value="${b}" selected=""`);
  });
  it("um único membro continua sendo um alvo inicial legítimo", () => {
    const html = renderToStaticMarkup(createElement(ConversarForm, { membros: [{ id: a, nome: "Brisa" }] }));
    expect(html).toContain(`value="${a}" selected=""`);
  });
  it("um alvo inicial fora da lista não migra silenciosamente ao único filho", () => {
    const html = renderToStaticMarkup(createElement(ConversarForm, { membros: [{ id: a, nome: "Brisa" }], initialMembroId: novoId("alvo-antigo") }));
    expect(html).not.toContain(`value="${a}" selected=""`);
    expect(html).toContain('value="" disabled="" selected=""');
  });
  it("sem membros e com alvo antigo ainda permite escolher a família em geral", () => {
    const html = renderToStaticMarkup(createElement(ConversarForm, { membros: [], initialMembroId: novoId("alvo-removido") }));
    expect(html).toContain('<select');
    expect(html).toContain('value="familia"');
    expect(html).toContain('value="" disabled="" selected=""');
  });
});

describe("entrada Web: fonte inicial, escopo e recuperação", () => {
  it("salva a fonte familiar original antes de devolver a conversa", async () => {
    const r = await criarConversa(pedido()); expect(r).toHaveProperty("conversaId");
    if (!("conversaId" in r)) throw Error("Conversa sem recibo");
    expect(estado.db!.linhas("mensagens_skill")).toMatchObject([{ conversa_id: r.conversaId, family_account_id: estado.familyId, papel: "user", conteudo: TEXTO }]);
    expect(estado.db!.linhas("conversas")).toMatchObject([{ id: r.conversaId, membro_atipico_id: a }]);
  });
  it.each(["erro", "zero"] as const)("primeira mensagem com %s não aparenta sucesso e não dispara after", async falha => {
    estado.falhaMensagem = falha;
    const r = await criarConversa(pedido());
    expect(r).toHaveProperty("erro"); expect(r).not.toHaveProperty("conversaId");
    expect(estado.db!.linhas("mensagens_skill")).toHaveLength(0); expect(estado.afters).toHaveLength(0);
  });
  it.each(["estrangeiro", "inativo", "ausente"] as const)("recusa alvo %s antes de criar qualquer fonte", async tipo => {
    if (tipo === "estrangeiro") estado.db!.linhas("membros_atipicos")[0].family_account_id = novoId("outra-familia");
    if (tipo === "inativo") estado.db!.linhas("membros_atipicos")[0].ativo = false;
    const r = await criarConversa(pedido({ membroAtipicoId: tipo === "ausente" ? novoId("nao-existe") : a }));
    expect(r).toHaveProperty("erro"); expect(estado.db!.linhas("conversas")).toHaveLength(0); expect(estado.db!.linhas("mensagens_skill")).toHaveLength(0);
  });
  it("erro ao conferir membro não vira membro inexistente ou fonte salva", async () => {
    estado.erroMembro = true;
    expect(await criarConversa(pedido())).toHaveProperty("erro"); expect(estado.db!.linhas("conversas")).toHaveLength(0);
  });
  it("família em geral continua permitida sem atribuir ao primeiro filho", async () => {
    const r = await criarConversa(pedido({ membroAtipicoId: null })); expect(r).toHaveProperty("conversaId");
    expect(estado.db!.linhas("conversas")[0].membro_atipico_id).toBeNull();
  });
  it("repetir a mesma requisição não cria outra conversa/fonte ou after", async () => {
    const p = pedido(), r = await criarConversa(p), n = estado.afters.length;
    expect(await criarConversa(p)).toEqual(r);
    expect(estado.db!.linhas("conversas")).toHaveLength(1); expect(estado.db!.linhas("mensagens_skill")).toHaveLength(1); expect(estado.afters).toHaveLength(n);
  });
  it("retoma criação parcial com o mesmo ID depois da falha da mensagem", async () => {
    const p = pedido(); estado.falhaMensagem = "erro";
    expect(await criarConversa(p)).toHaveProperty("erro");
    expect(estado.db!.linhas("conversas")).toHaveLength(1);
    const id = estado.db!.linhas("conversas")[0].id;
    estado.falhaMensagem = null;
    expect(await criarConversa(p)).toMatchObject({ conversaId: id });
    expect(estado.db!.linhas("conversas")).toHaveLength(1); expect(estado.db!.linhas("mensagens_skill")).toHaveLength(1);
  });
  it("mesmo ID não muda texto/alvo da criação anterior", async () => {
    const p = pedido(); await criarConversa(p);
    expect(await criarConversa({ ...p, texto: "Outro relato fictício." })).toHaveProperty("erro");
    expect(await criarConversa({ ...p, membroAtipicoId: b })).toHaveProperty("erro");
    expect(estado.db!.linhas("conversas")).toHaveLength(1); expect(estado.db!.linhas("mensagens_skill")[0].conteudo).toBe(TEXTO);
  });
  it("duas chamadas concorrentes da mesma intenção resultam numa única fonte", async () => {
    const p = pedido(); const r = await Promise.all([criarConversa(p), criarConversa(p)]);
    expect(r[0]).toHaveProperty("conversaId"); expect(r[1]).toEqual(r[0]);
    expect(estado.db!.linhas("conversas")).toHaveLength(1); expect(estado.db!.linhas("mensagens_skill")).toHaveLength(1);
  });
  it.each(["erro", "zero"] as const)("criação da conversa com %s não grava fonte nem aparenta sucesso", async falha => {
    estado.falhaConversa = falha;
    expect(await criarConversa(pedido())).toHaveProperty("erro");
    expect(estado.db!.linhas("mensagens_skill")).toHaveLength(0); expect(estado.afters).toHaveLength(0);
  });
  it("ack perdido depois da mensagem escrita é recuperável sem duplicar fonte", async () => {
    const p = pedido(); estado.perderRespostaMensagem = true;
    expect(await criarConversa(p)).toHaveProperty("erro");
    expect(estado.db!.linhas("mensagens_skill")).toHaveLength(1);
    expect(await criarConversa(p)).toHaveProperty("conversaId");
    expect(estado.db!.linhas("conversas")).toHaveLength(1); expect(estado.db!.linhas("mensagens_skill")).toHaveLength(1);
  });
  it("chave anterior não aceita fonte alterada, outro ator ou outra família", async () => {
    const p = pedido(); await criarConversa(p);
    const fonte = estado.db!.linhas("mensagens_skill")[0]; fonte.conteudo = "Fonte fictícia corrigida posteriormente.";
    expect(await criarConversa(p)).toHaveProperty("erro");
    fonte.conteudo = TEXTO;
    estado.userId = novoId("outro-ator");
    expect(await criarConversa(p)).toHaveProperty("erro");
    estado.familyId = novoId("outra-familia");
    expect(await criarConversa({ ...p, membroAtipicoId: null })).toHaveProperty("erro");
    expect(estado.db!.linhas("conversas")).toHaveLength(1); expect(estado.db!.linhas("mensagens_skill")).toHaveLength(1);
  });
  it("cliente antigo sem chave continua gravando uma fonte confirmada", async () => {
    expect(await criarConversa({ membroAtipicoId: a, texto: TEXTO })).toHaveProperty("conversaId");
    expect(estado.db!.linhas("mensagens_skill")).toHaveLength(1);
  });
});
