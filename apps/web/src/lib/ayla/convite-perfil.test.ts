import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  decidirConviteDePerfil,
  destinoDoConvite,
  fraseDoConvite,
  reservarConviteDePerfil,
  LEXICO_PROIBIDO,
  TIPO_CONVITE_PERFIL,
  type EntradaDoConvite,
} from "./convite-perfil";

/**
 * O ATALHO OPCIONAL, FIADO — PEND-203 Gate 2.
 *
 * ⚠️ A TABELA DE VERDADE MUDOU POR MEDIÇÃO, não por opinião. O desenho original
 * tinha como caminho principal "o Gate B achou lacuna e a Ayla não perguntou".
 * Os 12 turnos reais do Gate 2C mostraram que esse estado ocorreu **0 vezes**
 * — nos 6 turnos com `ASK`, a Ayla perguntou em todos — enquanto
 * `pediu_para_contar` veio `true` em **2 de 12**. O gatilho principal virou o
 * pedido explícito da mãe.
 *
 * ⚠️ A MAIOR PARTE DESTE ARQUIVO PROVA QUE O LINK **NÃO** SAI. Um link a menos
 * não custa nada; um link na hora errada — em cima de um desabafo, ou colado
 * numa pergunta que a mãe ainda não respondeu — transforma a Ayla em
 * formulário, e ninguém percebe o dano.
 */

const base: EntradaDoConvite = {
  pediuParaContar: false,
  decisaoLacuna: {
    decisao: "ASK",
    escolhida: { dominio: "comunicacao", campo: "reciprocidade", label: "Vai-e-vem" },
    candidatasChaves: ["comunicacao.reciprocidade"],
  },
  campoInvestigado: null,
  perguntaAberta: false,
  segurancaAberta: false,
  naturezaEmocional: "neutra",
  naturezaDoTurno: "orientacao",
  cooldownLiberado: true,
  dominiosJaEstruturados: [],
  temaDoTurno: null,
};
const e = (over: Partial<EntradaDoConvite> = {}): EntradaDoConvite => ({ ...base, ...over });

// ─────────────────────────────────────────────────────────────────────────────
describe("A · caminho PRINCIPAL — o pedido explícito", () => {
  it("1. `pediuParaContar` convida, e a origem fica registrada", () => {
    const r = decidirConviteDePerfil(e({ pediuParaContar: true }));
    expect(r.acao).toBe("CONVIDAR");
    expect(r.origem).toBe("pedido_explicito");
    expect(r.motivo).toBe("a mãe pediu para adiantar informações");
  });

  it("9. pedido CURTO também convida — tamanho não é o critério", () => {
    // "Quero te contar mais sobre ele." é curto e é pedido.
    const r = decidirConviteDePerfil(
      e({ pediuParaContar: true, naturezaDoTurno: "simples" }),
    );
    expect(r.acao).toBe("CONVIDAR");
  });

  it("11. o pedido explícito FURA o cooldown — ela está pedindo agora", () => {
    const r = decidirConviteDePerfil(e({ pediuParaContar: true, cooldownLiberado: false }));
    expect(r.acao).toBe("CONVIDAR");
  });

  it("e convida mesmo sem lacuna do Gate B — não depende dele", () => {
    const r = decidirConviteDePerfil(
      e({
        pediuParaContar: true,
        decisaoLacuna: { decisao: "NO_ASK", escolhida: null, candidatasChaves: [] },
      }),
    );
    expect(r.acao).toBe("CONVIDAR");
    expect(r.dominio).toBeNull(); // destino genérico
  });
});

describe("B · BLOQUEADORES ABSOLUTOS — nem o pedido atravessa", () => {
  it("5. crise/segurança bloqueia", () => {
    const r = decidirConviteDePerfil(e({ pediuParaContar: true, segurancaAberta: true }));
    expect(r.acao).toBe("NENHUMA");
    expect(r.motivo).toContain("segurança");
  });

  it("3. desabafo bloqueia", () => {
    const r = decidirConviteDePerfil(e({ pediuParaContar: true, naturezaEmocional: "desabafo" }));
    expect(r.acao).toBe("NENHUMA");
    expect(r.motivo).toContain("desabafo");
  });

  it("4. natureza `null` bloqueia — silêncio do modelo não é permissão", () => {
    /**
     * ⚠️ O PONTO MAIS FÁCIL DE ERRAR DO GATE. `null` é "não sei": o modelo
     * omitiu, devolveu valor inválido, ou o turno veio pelo fluxo da Rotina
     * onde o decisor não roda. Se `null` valesse `neutra`, o primeiro convite
     * indevido sairia exatamente no turno em que a telemetria falhou.
     */
    const r = decidirConviteDePerfil(e({ pediuParaContar: true, naturezaEmocional: null }));
    expect(r.acao).toBe("NENHUMA");
    expect(r.motivo).toContain("desconhecida");
  });

  it("6. a Ayla perguntou NESTE turno ⇒ bloqueia", () => {
    const r = decidirConviteDePerfil(
      e({ pediuParaContar: true, campoInvestigado: "comunicacao.forma" }),
    );
    expect(r.acao).toBe("NENHUMA");
    expect(r.motivo).toContain("pergunta e link não vão juntos");
  });

  it("7. pergunta ANTERIOR ainda aberta ⇒ bloqueia", () => {
    // Evita: "ele aponta ou mostra o que quer?" … e no turno seguinte um link.
    const r = decidirConviteDePerfil(e({ pediuParaContar: true, perguntaAberta: true }));
    expect(r.acao).toBe("NENHUMA");
    expect(r.motivo).toContain("aguardando resposta");
  });

  it("os bloqueadores vêm ANTES do pedido, na ordem do código", () => {
    const SRC = readFileSync(new URL("./convite-perfil.ts", import.meta.url), "utf8");
    const bloq = SRC.indexOf("if (e.segurancaAberta)");
    const pedido = SRC.indexOf("if (e.pediuParaContar)");
    expect(bloq).toBeGreaterThan(0);
    expect(bloq).toBeLessThan(pedido);
  });
});

describe("C · caminho ESPONTÂNEO — guardas de ritmo", () => {
  it("8. conversa curta/continuação bloqueia o convite espontâneo", () => {
    for (const n of ["simples", "continuacao"]) {
      const r = decidirConviteDePerfil(e({ naturezaDoTurno: n }));
      expect(r.acao, n).toBe("NENHUMA");
      expect(r.motivo).toContain("conversa curta");
    }
  });

  it("10. cooldown bloqueia o espontâneo", () => {
    const r = decidirConviteDePerfil(e({ cooldownLiberado: false }));
    expect(r.acao).toBe("NENHUMA");
    expect(r.motivo).toContain("cooldown");
  });

  it("2. `pediuParaContar=false` sozinho NÃO basta: precisa da lacuna do Gate B", () => {
    const r = decidirConviteDePerfil(
      e({ decisaoLacuna: { decisao: "NO_ASK", escolhida: null, candidatasChaves: [] } }),
    );
    expect(r.acao).toBe("NENHUMA");
    expect(r.motivo).toContain("a mãe não pediu");
  });

  it("20. o caminho SECUNDÁRIO ainda funciona, com origem própria", () => {
    const r = decidirConviteDePerfil(e());
    expect(r.acao).toBe("CONVIDAR");
    expect(r.origem).toBe("lacuna_nao_perguntada");
    expect(r.dominio).toBe("comunicacao");
  });

  it("Gate B ausente ⇒ nada", () => {
    expect(decidirConviteDePerfil(e({ decisaoLacuna: null })).acao).toBe("NENHUMA");
  });

  it("domínio já estruturado não é oferecido no espontâneo", () => {
    expect(
      decidirConviteDePerfil(e({ dominiosJaEstruturados: ["comunicacao"] })).acao,
    ).toBe("NENHUMA");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("D · 13+14. destino e domínio", () => {
  it("13. pedido genérico vai para `/kolo-vivo`; pedido temático especializa", () => {
    expect(decidirConviteDePerfil(e({ pediuParaContar: true })).dominio).toBeNull();
    expect(
      decidirConviteDePerfil(e({ pediuParaContar: true, temaDoTurno: "comunicacao" })).dominio,
    ).toBe("comunicacao");
    // tema que não é domínio do Perfil não especializa
    expect(
      decidirConviteDePerfil(e({ pediuParaContar: true, temaDoTurno: "tema_inventado" })).dominio,
    ).toBeNull();
  });

  it("`null` vira o destino genérico, e nunca uma URL quebrada", () => {
    expect(destinoDoConvite(null)).toBe("/kolo-vivo");
    expect(destinoDoConvite("comunicacao")).toBe("/kolo-vivo?dominio=comunicacao");
  });

  it("NUNCA aceita destino externo — vocabulário fechado, não formato", () => {
    for (const v of ["//evil.com", "https://evil.com", "../../etc", "javascript:alert(1)", ""]) {
      const d = destinoDoConvite(v);
      expect(d, v).toBe("/kolo-vivo");
      expect(d).not.toContain("//");
      expect(d).not.toContain(":");
    }
  });
});

describe("E · a voz", () => {
  it("há frase GENÉRICA para o pedido explícito, e ela usa o nome", () => {
    const f = fraseDoConvite({ dominio: null, nome: "Bento", link: "L", turnoId: "t" })!;
    expect(f).toContain("Bento");
    expect(f.endsWith("L")).toBe(true);
  });

  it("16. o link é a ÚLTIMA coisa da frase", () => {
    for (const dom of [null, "comunicacao", "sensorial"]) {
      const f = fraseDoConvite({ dominio: dom, nome: "X", link: "https://a/b", turnoId: "t" })!;
      expect(f.endsWith("https://a/b"), String(dom)).toBe(true);
    }
  });

  it("sem nome resolvido não sai `{nome}` literal", () => {
    expect(fraseDoConvite({ dominio: null, nome: null, link: "L" })).toContain("ele(a)");
  });

  it("NENHUMA frase usa o léxico de cadastro nem cria suspense", () => {
    const SRC = readFileSync(new URL("./convite-perfil.ts", import.meta.url), "utf8");
    const bloco = SRC.slice(SRC.indexOf("const FRASES"), SRC.indexOf("export const LEXICO_PROIBIDO"));
    for (const p of LEXICO_PROIBIDO) expect(bloco.toLowerCase(), p).not.toContain(p);
    for (const p of ["mas primeiro", "só depois", "preciso que você", "antes de te", "só consigo"]) {
      expect(bloco.toLowerCase(), p).not.toContain(p);
    }
  });

  it("link vazio devolve null — nunca frase sem destino", () => {
    expect(fraseDoConvite({ dominio: null, nome: "X", link: "" })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("F · 12. a reserva (dedup serverless)", () => {
  function db(o: { jaEnviou?: boolean; insertFalha?: boolean; deOutro?: boolean; lanca?: boolean }) {
    return {
      from: (tabela: string) => {
        if (o.lanca) throw new Error("banco fora");
        if (tabela === "ayla_messages") {
          const c: Record<string, unknown> = {};
          for (const k of ["select", "eq", "gte"]) c[k] = () => c;
          c.limit = async () => ({ data: o.jaEnviou ? [{ id: "m" }] : [] });
          return c;
        }
        return {
          insert: () => ({
            select: () => ({
              single: async () =>
                o.insertFalha
                  ? { data: null, error: { message: "x" } }
                  : { data: { id: "minha", created_at: "2026-09-12T00:00:01Z" }, error: null },
            }),
          }),
          select: () => {
            const c: Record<string, unknown> = {};
            for (const k of ["eq", "gte", "order"]) c[k] = () => c;
            c.limit = async () => ({
              data: o.deOutro
                ? [{ id: "outro", created_at: "2026-09-12T00:00:00Z" }]
                : [{ id: "minha", created_at: "2026-09-12T00:00:01Z" }],
            });
            return c;
          },
        };
      },
    } as unknown as SupabaseClient;
  }

  it("libera quando não houve convite e a reserva é minha", async () => {
    expect(await reservarConviteDePerfil(db({}), "f1")).toBe(true);
  });

  it("não libera quando já houve convite na janela", async () => {
    expect(await reservarConviteDePerfil(db({ jaEnviou: true }), "f1")).toBe(false);
  });

  it("12. RAJADA: quem perdeu a corrida não convida", async () => {
    expect(await reservarConviteDePerfil(db({ deOutro: true }), "f1")).toBe(false);
  });

  it("falha da reserva NÃO convida — silêncio é o resultado seguro", async () => {
    expect(await reservarConviteDePerfil(db({ insertFalha: true }), "f1")).toBe(false);
    expect(await reservarConviteDePerfil(db({ lanca: true }), "f1")).toBe(false);
  });

  it("o tipo que o cooldown procura é o mesmo que o envio grava", () => {
    const SRC = readFileSync(new URL("./convite-perfil.ts", import.meta.url), "utf8");
    const ORQ = readFileSync(new URL("./orchestrator.ts", import.meta.url), "utf8");
    expect(TIPO_CONVITE_PERFIL).toBe("perfil_nudge");
    expect(SRC).toMatch(/\.eq\("tipo", TIPO_CONVITE_PERFIL\)/);
    expect(ORQ).toMatch(/tipo: conviteTexto \? TIPO_CONVITE_PERFIL : "resposta_registro"/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("G · a fiação no orquestrador", () => {
  const ORQ = readFileSync(new URL("./orchestrator.ts", import.meta.url), "utf8");

  it("17. a fala do Core é intacta — o convite é acrescentado, nunca substituído", () => {
    expect(ORQ).toMatch(/texto: conviteTexto \? `\$\{exp\.texto\}\\n\\n\$\{conviteTexto\}` : exp\.texto/);
  });

  it("16. ordem: fala do Core → decisão → reserva → link → envio", () => {
    const fala = ORQ.indexOf("const exp = await responderExperimental");
    const decisao = ORQ.indexOf("const decisao = decidirConviteDePerfil({");
    const link = ORQ.indexOf("const link = await gerarMagicLink(supabase, {\n            familyId: family.id,\n            next: destinoDoConvite");
    const envio = ORQ.indexOf("const resp = await enviarEPersistir(supabase, {\n        family_account_id: family.id,\n        membro_atipico_id: exp.membroId,");
    expect(fala).toBeGreaterThan(0);
    expect(fala).toBeLessThan(decisao);
    expect(decisao).toBeLessThan(link);
    expect(link).toBeLessThan(envio);
  });

  it("15. o convite inteiro vive num try/catch — nunca derruba o turno", () => {
    const i = ORQ.indexOf("let conviteTexto: string | null = null;");
    const bloco = ORQ.slice(i, ORQ.indexOf('kind: "convite_perfil"', i));
    expect(bloco).toMatch(/try \{/);
    expect(bloco).toMatch(/\} catch \(e\) \{/);
    // e a falha vira rastro, não exceção
    expect(bloco).toMatch(/motivo: `erro:/);
  });

  it("14. o membro e a família vêm do turno — nunca escolhidos aqui", () => {
    const i = ORQ.indexOf("const decisao = decidirConviteDePerfil({");
    const bloco = ORQ.slice(i, i + 2500);
    expect(bloco).toMatch(/familyId: family\.id/);
    expect(bloco).toMatch(/m\.id === exp\.membroId/);
    expect(bloco).not.toMatch(/membros\[0\]|resolverFoco/);
  });

  it("as guardas são alimentadas pelos donos que já existem", () => {
    const i = ORQ.indexOf("const decisao = decidirConviteDePerfil({");
    const bloco = ORQ.slice(i, i + 1600);
    expect(bloco).toMatch(/perguntaAberta: estadoDoTurno\?\.perguntaPendente\.conhecido === "sim"/);
    expect(bloco).toMatch(/segurancaAberta: seguranca\.aberta/);
    expect(bloco).toMatch(/naturezaEmocional: turnoClassificado\.naturezaEmocional/);
    expect(bloco).toMatch(/naturezaDoTurno: exp\.metrica\.natureza/);
    expect(bloco).toMatch(/campoInvestigado,/);
  });

  it("18. ZERO segunda chamada de modelo para decidir o link", () => {
    const i = ORQ.indexOf("let conviteTexto: string | null = null;");
    const bloco = ORQ.slice(i, ORQ.indexOf('kind: "convite_perfil"', i));
    // ⚠️ CHAMADA, NÃO MENÇÃO. O bloco CITA `responderExperimental` num
    // comentário que explica onde o `PerfilConsultavel` vive — proibir a
    // palavra proibiria a explicação. O que não pode existir é invocação.
    for (const chamada of [
      "gerarConversacional(",
      "responderExperimental(",
      "getAnthropicClient(",
      "decidirTurno(",
      "extrairAtualizacoes(",
    ]) {
      expect(bloco, chamada).not.toContain(chamada);
    }
  });

  it("19. a telemetria separa as duas origens e diz por que não enviou", () => {
    const i = ORQ.indexOf('kind: "convite_perfil"');
    const bloco = ORQ.slice(i, i + 1200);
    for (const campo of [
      "turno: rastro.turno",
      "natureza_turno",
      "natureza_emocional",
      "pediu_para_contar",
      "campo_investigado",
      "pergunta_aberta",
    ]) {
      expect(bloco, campo).toContain(campo);
    }
    // origem e motivo vêm do rastro da decisão
    expect(ORQ).toMatch(/origem: decisao\.origem/);
    expect(ORQ).toMatch(/motivo: decisao\.motivo/);
    expect(ORQ).toMatch(/link_gerado/);
    expect(ORQ).toMatch(/link_enviado/);
  });

  it("a reserva não é pedida quando o pedido foi explícito — não se gasta consulta", () => {
    expect(ORQ).toMatch(
      /cooldownLiberado: turnoClassificado\.pediuParaContar\s*\n\s*\? true\s*\n\s*: await reservarConviteDePerfil/,
    );
  });

  it("Etapa 1: `natureza_turno` entra no rastro sem recálculo", () => {
    expect(ORQ).toMatch(/natureza_turno: exp\.metrica\.natureza,/);
    expect(ORQ).not.toMatch(/naturezaDoTurno\(/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
/**
 * AS 10 JORNADAS — em nível de decisão, que é onde elas são determinísticas.
 */
describe("H · as 10 jornadas", () => {
  const j = (over: Partial<EntradaDoConvite>) => decidirConviteDePerfil(e(over));

  it("J1 genérico: 'quero te contar tudo' → LINK em /kolo-vivo", () => {
    const r = j({ pediuParaContar: true, temaDoTurno: null });
    expect(r.acao).toBe("CONVIDAR");
    expect(destinoDoConvite(r.dominio)).toBe("/kolo-vivo");
  });

  it("J2 temático: 'como ele se comunica' → LINK no domínio", () => {
    const r = j({ pediuParaContar: true, temaDoTurno: "comunicacao" });
    expect(destinoDoConvite(r.dominio)).toBe("/kolo-vivo?dominio=comunicacao");
  });

  it("J3 desabafo → zero link", () => {
    expect(j({ naturezaEmocional: "desabafo" }).acao).toBe("NENHUMA");
  });

  it("J4 emoção + pedido de ajuda, sem pedido de contar → zero link espontâneo", () => {
    // "Estou cansada e preciso de ajuda com o sono" — neutra, e a Ayla
    // perguntou (foi o turno 12 real do Gate 2C).
    expect(j({ naturezaEmocional: "neutra", campoInvestigado: "sono.adormece" }).acao).toBe(
      "NENHUMA",
    );
  });

  it("J5 ASK real → zero link no mesmo turno", () => {
    expect(j({ campoInvestigado: "emocional.gatilhos" }).acao).toBe("NENHUMA");
  });

  it("J6 pergunta aberta → zero link", () => {
    expect(j({ perguntaAberta: true }).acao).toBe("NENHUMA");
  });

  it("J7 continuação curta ('sim', 'pode', 'obrigada') → zero link", () => {
    expect(j({ naturezaDoTurno: "simples" }).acao).toBe("NENHUMA");
    expect(j({ naturezaDoTurno: "continuacao" }).acao).toBe("NENHUMA");
  });

  it("J8 mãe ignora o link e segue conversando → o turno seguinte não cobra", () => {
    // Sem pedido novo e com o cooldown consumido pelo convite anterior.
    expect(j({ cooldownLiberado: false }).acao).toBe("NENHUMA");
  });

  it("J9 já convidou há pouco → dedup bloqueia", () => {
    expect(j({ cooldownLiberado: false, pediuParaContar: false }).acao).toBe("NENHUMA");
  });

  it("J10 multi-criança: o decisor não escolhe criança nenhuma", () => {
    const SRC = readFileSync(new URL("./convite-perfil.ts", import.meta.url), "utf8");
    // ⚠️ A melhor garantia de isolamento é ele NÃO TER como errar: nenhum
    // membroId, nenhuma leitura de Perfil, nenhuma resolução de foco.
    expect(SRC).not.toMatch(/membro_atipico_id|perfil_vivo_membro|resolverFoco|membroId/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("I · sabotagens", () => {
  const SRC = readFileSync(new URL("./convite-perfil.ts", import.meta.url), "utf8");
  const ORQ = readFileSync(new URL("./orchestrator.ts", import.meta.url), "utf8");

  it("PERMITIR LINK EM DESABAFO", () => {
    expect(SRC).toMatch(/if \(e\.naturezaEmocional === "desabafo"\)/);
    expect(decidirConviteDePerfil(e({ pediuParaContar: true, naturezaEmocional: "desabafo" })).acao).toBe("NENHUMA");
  });

  it("IGNORAR PERGUNTA ABERTA", () => {
    expect(SRC).toMatch(/if \(e\.perguntaAberta\) return nao/);
    expect(decidirConviteDePerfil(e({ pediuParaContar: true, perguntaAberta: true })).acao).toBe("NENHUMA");
  });

  it("LINK ANTES DA FALA", () => {
    // A composição é `${exp.texto}\n\n${conviteTexto}` — nunca o inverso.
    expect(ORQ).not.toMatch(/\$\{conviteTexto\}\\n\\n\$\{exp\.texto\}/);
    expect(ORQ).toMatch(/`\$\{exp\.texto\}\\n\\n\$\{conviteTexto\}`/);
  });

  it("MAGIC LINK DERRUBAR A RESPOSTA", () => {
    const i = ORQ.indexOf("let conviteTexto: string | null = null;");
    const bloco = ORQ.slice(i, ORQ.indexOf('kind: "convite_perfil"', i));
    expect(bloco).toMatch(/\} catch \(e\) \{/);
    // e o envio não depende do link
    expect(ORQ).toMatch(/conviteTexto \? `\$\{exp\.texto\}/);
  });

  it("USAR MEMBRO ERRADO", () => {
    expect(SRC).not.toContain("membroId");
    expect(ORQ).toMatch(/m\.id === exp\.membroId/);
  });

  it("PERMITIR URL EXTERNA", () => {
    expect(SRC).toMatch(/if \(!dominio \|\| !DOMINIOS_OFERECIVEIS\.includes\(dominio\)\) return "\/kolo-vivo"/);
    expect(destinoDoConvite("https://evil.com")).toBe("/kolo-vivo");
  });

  it("REPETIR CONVITE", () => {
    expect(SRC).toMatch(/if \(!e\.cooldownLiberado\) return nao/);
    expect(decidirConviteDePerfil(e({ cooldownLiberado: false })).acao).toBe("NENHUMA");
  });

  it("TRATAR `null` COMO `neutra`", () => {
    expect(SRC).toMatch(/if \(e\.naturezaEmocional === null\) return nao/);
    expect(decidirConviteDePerfil(e({ pediuParaContar: true, naturezaEmocional: null })).acao).toBe("NENHUMA");
  });

  it("NOVO LLM PARA DECIDIR O LINK", () => {
    expect(SRC).not.toMatch(/getAnthropicClient|gerarConversacional|messages\.stream|extrairAtualizacoes/);
    const decisao = SRC.slice(
      SRC.indexOf("export function decidirConviteDePerfil"),
      SRC.indexOf("function dominioDoPedido"),
    );
    expect(decisao).not.toMatch(/await|async|fetch\(|supabase/);
  });

  it("a decisão é pura e determinística", () => {
    const x = e({ pediuParaContar: true });
    expect(decidirConviteDePerfil(x)).toEqual(decidirConviteDePerfil(x));
  });
});
