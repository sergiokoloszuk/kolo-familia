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
 * O ATALHO OPCIONAL — PEND-203.
 *
 * ⚠️ A MAIOR PARTE DESTE ARQUIVO PROVA QUE O CONVITE **NÃO** SAI. Um link a
 * menos não custa nada; um link a mais, na hora errada, transforma a Ayla em
 * formulário — e o pior caso é oferecer cadastro para uma mãe em crise. Por
 * isso cada guarda tem teste próprio, e o `motivo` é verificado junto com a
 * ação: convite que não sai sem motivo registrado é indistinguível de bug.
 */

const base: EntradaDoConvite = {
  decisaoLacuna: {
    decisao: "ASK",
    escolhida: { dominio: "comunicacao", campo: "reciprocidade", label: "Vai-e-vem na conversa" },
    candidatasChaves: ["comunicacao.reciprocidade"],
  },
  campoInvestigado: null,
  natureza: "normal",
  conviteNoTurnoAnterior: false,
  cooldownLiberado: true,
  dominiosJaEstruturados: [],
  pediuParaContar: false,
};
const e = (over: Partial<EntradaDoConvite> = {}): EntradaDoConvite => ({ ...base, ...over });

// ─────────────────────────────────────────────────────────────────────────────
describe("A · o caminho em que o convite existe", () => {
  it("5. HELP + LINK: Gate B viu lacuna do tema e a Ayla NÃO perguntou", () => {
    const r = decidirConviteDePerfil(e());
    expect(r.acao).toBe("CONVIDAR");
    expect(r.dominio).toBe("comunicacao");
    expect(r.motivo).toBe("lacuna do tema não era decisiva agora");
  });

  it("o domínio vem do Gate B, não de escolha própria", () => {
    const r = decidirConviteDePerfil(
      e({
        decisaoLacuna: {
          decisao: "ASK",
          escolhida: null,
          candidatasChaves: ["sensorial.sons", "comunicacao.forma"],
        },
      }),
    );
    // a primeira candidata da ordem que o gate já calculou
    expect(r.dominio).toBe("sensorial");
  });
});

describe("B · o convite NÃO sai", () => {
  it("1. lacuna vazia não gera pergunta nem convite automaticamente", () => {
    const r = decidirConviteDePerfil(
      e({ decisaoLacuna: { decisao: "NO_ASK", escolhida: null, candidatasChaves: [] } }),
    );
    expect(r.acao).toBe("NENHUMA");
    expect(r.motivo).toContain("nenhuma lacuna pertinente");
  });

  it("2. campo já estruturado não recebe convite", () => {
    const r = decidirConviteDePerfil(e({ dominiosJaEstruturados: ["comunicacao"] }));
    expect(r.acao).toBe("NENHUMA");
    expect(r.motivo).toContain("nenhum domínio oferecível");
  });

  it("3+7. a Ayla perguntou neste turno ⇒ ASK NÃO vira link", () => {
    const r = decidirConviteDePerfil(e({ campoInvestigado: "comunicacao.reciprocidade" }));
    expect(r.acao).toBe("NENHUMA");
    expect(r.motivo).toContain("ASK não vira link");
  });

  it("6. desabafo ⇒ zero link", () => {
    const r = decidirConviteDePerfil(e({ natureza: "desabafo" }));
    expect(r.acao).toBe("NENHUMA");
    expect(r.motivo).toContain("desabafo");
  });

  it("7. crise e segurança ⇒ zero link", () => {
    for (const natureza of ["crise", "seguranca"] as const) {
      const r = decidirConviteDePerfil(e({ natureza }));
      expect(r.acao, natureza).toBe("NENHUMA");
    }
  });

  it("9. dois turnos seguidos não recebem convite", () => {
    const r = decidirConviteDePerfil(e({ conviteNoTurnoAnterior: true }));
    expect(r.acao).toBe("NENHUMA");
    expect(r.motivo).toContain("turno anterior");
  });

  it("8. dedup/cooldown impede repetição", () => {
    const r = decidirConviteDePerfil(e({ cooldownLiberado: false }));
    expect(r.acao).toBe("NENHUMA");
    expect(r.motivo).toContain("cooldown");
  });

  it("resposta curta que só continua a conversa não é interrompida", () => {
    const r = decidirConviteDePerfil(e({ natureza: "continuacao_curta" }));
    expect(r.acao).toBe("NENHUMA");
  });

  it("Gate B não rodou ⇒ nada", () => {
    const r = decidirConviteDePerfil(e({ decisaoLacuna: null }));
    expect(r.acao).toBe("NENHUMA");
  });

  it("domínio fora do vocabulário oferecível não vira convite", () => {
    const r = decidirConviteDePerfil(
      e({
        decisaoLacuna: { decisao: "ASK", escolhida: null, candidatasChaves: ["campo_inventado.x"] },
      }),
    );
    expect(r.acao).toBe("NENHUMA");
  });
});

describe("C · 17. a mãe que quer acelerar", () => {
  it("pedido explícito convida, mesmo dentro do cooldown e sem Gate B ter perguntado", () => {
    const r = decidirConviteDePerfil(e({ pediuParaContar: true, cooldownLiberado: false }));
    expect(r.acao).toBe("CONVIDAR");
    expect(r.motivo).toBe("a mãe pediu para contar");
  });

  it("mas o pedido NÃO atravessa crise, segurança nem desabafo", () => {
    for (const natureza of ["crise", "seguranca", "desabafo"] as const) {
      const r = decidirConviteDePerfil(e({ pediuParaContar: true, natureza }));
      expect(r.acao, natureza).toBe("NENHUMA");
    }
  });

  it("e não inventa domínio quando não há lacuna em aberto", () => {
    const r = decidirConviteDePerfil(
      e({
        pediuParaContar: true,
        decisaoLacuna: { decisao: "NO_ASK", escolhida: null, candidatasChaves: [] },
      }),
    );
    expect(r.acao).toBe("NENHUMA");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("D · 11+12. o destino", () => {
  it("12. o domínio correto entra no deep-link", () => {
    expect(destinoDoConvite("comunicacao")).toBe("/kolo-vivo?dominio=comunicacao");
    expect(destinoDoConvite("aprendizado")).toBe("/kolo-vivo?dominio=aprendizado");
  });

  it("11. `next` NUNCA aceita destino externo", () => {
    // Vocabulário fechado, não validação de formato: `//evil.com` é caminho
    // relativo de protocolo e passaria por um teste de "começa com /".
    for (const v of ["//evil.com", "https://evil.com", "../../etc", "javascript:alert(1)", ""]) {
      const d = destinoDoConvite(v);
      expect(d, v).toBe("/kolo-vivo");
      expect(d.startsWith("/kolo-vivo")).toBe(true);
      expect(d).not.toContain("//");
      expect(d).not.toContain(":");
    }
  });

  it("o destino é sempre o Kolo Vivo oficial — nenhuma tela paralela", () => {
    expect(destinoDoConvite("sensorial").startsWith("/kolo-vivo")).toBe(true);
  });
});

describe("E · a voz", () => {
  it("usa o nome da criança e termina no link", () => {
    const f = fraseDoConvite({ dominio: "comunicacao", nome: "Bento", link: "https://x/y", turnoId: "tn_a" })!;
    expect(f).toContain("Bento");
    expect(f.endsWith("https://x/y")).toBe(true);
  });

  it("sem nome resolvido, não sai `{nome}` literal", () => {
    const f = fraseDoConvite({ dominio: "sensorial", nome: null, link: "L", turnoId: "t" })!;
    expect(f).not.toContain("{nome}");
    expect(f).toContain("ele(a)");
  });

  it("varia entre turnos, e é reproduzível para o mesmo turno", () => {
    const a1 = fraseDoConvite({ dominio: "comunicacao", nome: "X", link: "L", turnoId: "tn_1" });
    const a2 = fraseDoConvite({ dominio: "comunicacao", nome: "X", link: "L", turnoId: "tn_1" });
    expect(a1).toBe(a2);
    const variantes = new Set(
      ["a", "b", "c", "d", "e", "f", "g", "h"].map(
        (t) => fraseDoConvite({ dominio: "comunicacao", nome: "X", link: "L", turnoId: t })!,
      ),
    );
    expect(variantes.size).toBeGreaterThan(1);
  });

  it("NENHUMA frase usa o léxico de cadastro", () => {
    const SRC = readFileSync(new URL("./convite-perfil.ts", import.meta.url), "utf8");
    const bloco = SRC.slice(SRC.indexOf("const FRASES"), SRC.indexOf("export const LEXICO_PROIBIDO"));
    for (const proibido of LEXICO_PROIBIDO) {
      expect(bloco.toLowerCase(), proibido).not.toContain(proibido);
    }
  });

  it("nenhuma frase cria suspense — a ajuda não fica presa ao clique", () => {
    const SRC = readFileSync(new URL("./convite-perfil.ts", import.meta.url), "utf8");
    const bloco = SRC.slice(SRC.indexOf("const FRASES"), SRC.indexOf("export const LEXICO_PROIBIDO"));
    for (const p of ["mas primeiro", "antes de te", "só depois", "preciso que você"]) {
      expect(bloco.toLowerCase(), p).not.toContain(p);
    }
    // e toda frase é um convite, não uma condição
    expect(bloco).toMatch(/Se quiser|Se você quiser|Se fizer sentido|Se ajudar/);
  });

  it("todo domínio oferecível tem frase — e nenhuma frase órfã", () => {
    const SRC = readFileSync(new URL("./convite-perfil.ts", import.meta.url), "utf8");
    const oferecivel = SRC.slice(SRC.indexOf("DOMINIOS_OFERECIVEIS"), SRC.indexOf("/**\n * A DECISÃO"));
    const dominios = [...oferecivel.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
    expect(dominios.length).toBeGreaterThanOrEqual(14);
    for (const d of dominios) {
      expect(fraseDoConvite({ dominio: d, nome: "X", link: "L" }), d).toBeTruthy();
    }
  });

  it("domínio sem frase e link vazio devolvem null — nunca frase quebrada", () => {
    expect(fraseDoConvite({ dominio: "inexistente", nome: "X", link: "L" })).toBeNull();
    expect(fraseDoConvite({ dominio: "comunicacao", nome: "X", link: "" })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("F · a reserva (dedup serverless)", () => {
  /** Supabase falso: `ayla_messages` responde o histórico, `ayla_send_log` reserva. */
  function db(opts: {
    jaEnviou?: boolean;
    insertFalha?: boolean;
    primeiraDeOutro?: boolean;
    lanca?: boolean;
  }) {
    const escritas: string[] = [];
    const client = {
      from: (tabela: string) => {
        if (opts.lanca) throw new Error("banco fora");
        if (tabela === "ayla_messages") {
          const chain: Record<string, unknown> = {};
          for (const k of ["select", "eq", "gte"]) chain[k] = () => chain;
          chain.limit = async () => ({ data: opts.jaEnviou ? [{ id: "m1" }] : [] });
          return chain;
        }
        // ayla_send_log
        return {
          insert: () => ({
            select: () => ({
              single: async () => {
                escritas.push("insert:ayla_send_log");
                return opts.insertFalha
                  ? { data: null, error: { message: "x" } }
                  : { data: { id: "minha", created_at: "2026-09-12T00:00:01Z" }, error: null };
              },
            }),
          }),
          select: () => {
            const c: Record<string, unknown> = {};
            for (const k of ["eq", "gte", "order"]) c[k] = () => c;
            c.limit = async () => ({
              data: opts.primeiraDeOutro
                ? [{ id: "de_outro", created_at: "2026-09-12T00:00:00Z" }]
                : [{ id: "minha", created_at: "2026-09-12T00:00:01Z" }],
            });
            return c;
          },
        };
      },
    } as unknown as SupabaseClient;
    return { client, escritas };
  }

  it("libera quando não houve convite na janela e a reserva é minha", async () => {
    expect(await reservarConviteDePerfil(db({}).client, "f1")).toBe(true);
  });

  it("8. NÃO libera quando já houve convite na janela de 7 dias", async () => {
    expect(await reservarConviteDePerfil(db({ jaEnviou: true }).client, "f1")).toBe(false);
  });

  it("RAJADA: quem perdeu a corrida não convida", async () => {
    // As quatro leituras de uma rajada acontecem antes da primeira escrita —
    // foi assim que o convite de assinatura saiu 4× em 6 segundos em 23/07.
    expect(await reservarConviteDePerfil(db({ primeiraDeOutro: true }).client, "f1")).toBe(false);
  });

  it("falha da reserva NÃO convida — o silêncio é o resultado seguro", async () => {
    expect(await reservarConviteDePerfil(db({ insertFalha: true }).client, "f1")).toBe(false);
    expect(await reservarConviteDePerfil(db({ lanca: true }).client, "f1")).toBe(false);
  });

  it("o tipo que o cooldown procura é o mesmo que o envio grava", () => {
    const SRC = readFileSync(new URL("./convite-perfil.ts", import.meta.url), "utf8");
    expect(TIPO_CONVITE_PERFIL).toBe("perfil_nudge");
    // uma regra só: o cooldown lê `tipo`, e é o `tipo` que o envio carrega.
    expect(SRC).toMatch(/\.eq\("tipo", TIPO_CONVITE_PERFIL\)/);
  });

  it("a janela do convite é MUITO maior que a do convite comercial", () => {
    const SRC = readFileSync(new URL("./convite-perfil.ts", import.meta.url), "utf8");
    const ORQ = readFileSync(new URL("./orchestrator.ts", import.meta.url), "utf8");
    expect(SRC).toMatch(/JANELA_CONVITE_MS = 7 \* 24 \* 60 \* 60 \* 1000/);
    // 12h é a do nudge de assinatura, que é urgente. Lacuna de Perfil não é.
    expect(ORQ).toMatch(/JANELA_NUDGE_MS = 12 \* 60 \* 60 \* 1000/);
  });

  it("a reserva olha a RAJADA, não a janela — reserva órfã não cala 7 dias", () => {
    const SRC = readFileSync(new URL("./convite-perfil.ts", import.meta.url), "utf8");
    const bloco = SRC.slice(SRC.indexOf("export async function reservarConviteDePerfil"));
    expect(bloco).toMatch(/JANELA_RAJADA_MS/);
    // e a reserva NÃO usa a janela longa para decidir quem chegou antes
    const trechoConcorrentes = bloco.slice(bloco.indexOf("concorrentes"));
    expect(trechoConcorrentes).not.toMatch(/JANELA_CONVITE_MS/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("G · 14+16. o caso Mario, e a lacuna que desaparece", () => {
  /**
   * O perfil do Mario diz "Conversa bem" em PROSA
   * (`comunicacao.outras`), e `comunicacao.reciprocidade` está vazio. A prosa é
   * pista, nunca prova — este módulo nunca a lê, e quem decide a lacuna é o
   * Gate B, que também não a lê como resposta.
   */
  it("14. assunto NÃO é comunicação ⇒ Gate B não traz a lacuna ⇒ nada", () => {
    // Turno sobre sono: o gate só considera domínios do tema.
    const r = decidirConviteDePerfil(
      e({ decisaoLacuna: { decisao: "NO_ASK", escolhida: null, candidatasChaves: [] } }),
    );
    expect(r.acao).toBe("NENHUMA");
  });

  it("assunto é comunicação e a informação não mudava a conduta ⇒ HELP + LINK", () => {
    const r = decidirConviteDePerfil(e());
    expect(r.acao).toBe("CONVIDAR");
    expect(r.dominio).toBe("comunicacao");
  });

  it("assunto é comunicação e a informação ERA decisiva ⇒ ASK, sem link", () => {
    const r = decidirConviteDePerfil(e({ campoInvestigado: "comunicacao.reciprocidade" }));
    expect(r.acao).toBe("NENHUMA");
  });

  it("16. DEPOIS de estruturado, a mesma lacuna nunca mais convida", () => {
    // Dois caminhos independentes fecham: o Gate B deixa de trazê-la
    // (NO_ASK) e a guarda de domínio estruturado também barra.
    expect(decidirConviteDePerfil(e({ dominiosJaEstruturados: ["comunicacao"] })).acao).toBe(
      "NENHUMA",
    );
    expect(
      decidirConviteDePerfil(
        e({ decisaoLacuna: { decisao: "NO_ASK", escolhida: null, candidatasChaves: [] } }),
      ).acao,
    ).toBe("NENHUMA");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("H · sabotagens", () => {
  const SRC = readFileSync(new URL("./convite-perfil.ts", import.meta.url), "utf8");

  it("REMOVER O DEDUP: sem a guarda de cooldown, o convite repetiria", () => {
    // A guarda existe e é a penúltima — se alguém a retirar, este teste cai
    // junto com o comportamento.
    expect(SRC).toMatch(/if \(!e\.cooldownLiberado\) return nao\("cooldown do convite ativo"\)/);
    expect(decidirConviteDePerfil(e({ cooldownLiberado: false })).acao).toBe("NENHUMA");
  });

  it("TRATAR TODA LACUNA COMO ASK: a decisão tem de continuar lendo `campoInvestigado`", () => {
    expect(SRC).toMatch(/if \(e\.campoInvestigado\)/);
    // e a diferença é observável
    expect(decidirConviteDePerfil(e({ campoInvestigado: null })).acao).toBe("CONVIDAR");
    expect(decidirConviteDePerfil(e({ campoInvestigado: "x.y" })).acao).toBe("NENHUMA");
  });

  it("PERMITIR LINK EM DESABAFO: as três guardas de momento vêm ANTES do resto", () => {
    const i = SRC.indexOf('if (e.natureza === "crise")');
    const j = SRC.indexOf("if (e.pediuParaContar)");
    expect(i).toBeGreaterThan(0);
    expect(i).toBeLessThan(j); // precedência de segurança sobre o pedido
    expect(decidirConviteDePerfil(e({ natureza: "desabafo", pediuParaContar: true })).acao).toBe(
      "NENHUMA",
    );
  });

  it("IGNORAR CAMPO PREENCHIDO: a guarda de domínio estruturado é consultada", () => {
    expect(SRC).toMatch(/dominiosJaEstruturados\.includes\(d\)/);
    expect(decidirConviteDePerfil(e({ dominiosJaEstruturados: ["comunicacao"] })).acao).toBe(
      "NENHUMA",
    );
  });

  it("PERMITIR URL EXTERNA: o destino é vocabulário fechado, não formato", () => {
    expect(SRC).toMatch(/if \(!DOMINIOS_OFERECIVEIS\.includes\(dominio\)\) return "\/kolo-vivo"/);
    expect(destinoDoConvite("https://evil.com")).toBe("/kolo-vivo");
  });

  it("13. TROCAR MEMBRO: este módulo não escolhe criança e não lê Perfil", () => {
    // ⚠️ O isolamento entre irmãos não é responsabilidade deste módulo, e a
    // melhor forma de garantir isso é ele NÃO TER como errar: nenhuma consulta
    // a `perfil_vivo_membro`, nenhum `membroId`, nenhuma escolha de criança. O
    // nome da criança chega pronto, de quem já resolveu o foco do turno.
    expect(SRC).not.toMatch(/membro_atipico_id|perfil_vivo_membro|resolverFoco/);
    expect(SRC).not.toMatch(/\.upsert\(|\.update\(/);
  });

  it("18. o módulo não toca a escrita da Fase 2", () => {
    expect(SRC).not.toMatch(/extrairAtualizacoes|persistirRegistro|escritorDoPerfil/);
    // e não chama modelo nenhum
    expect(SRC).not.toMatch(/getAnthropicClient|getAylaAnthropicClient|messages\.stream/);
  });

  it("NÃO EXISTE SEGUNDO DECISOR: a fonte da lacuna é o Gate B", () => {
    // Se este módulo passar a escolher lacuna sozinho, ele duplica o cérebro
    // que a missão proíbe duplicar.
    // ⚠️ A CHECAGEM É SOBRE USO, NÃO SOBRE MENÇÃO. O cabeçalho do módulo CITA
    // `escolherLacunaDecisiva` justamente para dizer que quem decide a lacuna é
    // ele — proibir a palavra proibiria a explicação. O que não pode existir é
    // import de valor e chamada.
    expect(SRC).toMatch(/import type \{ DecisaoDeLacuna \} from "\.\/lacuna-decisiva"/);
    for (const chamada of [
      "escolherLacunaDecisiva(",
      "CAMPOS_DECISIVOS",
      "DOMINIOS_DO_TEMA",
      "degrauProvadoPeloPerfil",
      "ESCADA_COMUNICACAO",
    ]) {
      expect(SRC, chamada).not.toContain(chamada);
    }
  });

  it("a decisão é pura: mesma entrada, mesma saída, sem IO", () => {
    const x = e();
    expect(decidirConviteDePerfil(x)).toEqual(decidirConviteDePerfil(x));
    const decisao = SRC.slice(
      SRC.indexOf("export function decidirConviteDePerfil"),
      SRC.indexOf("function primeiroDominioOferecivel"),
    );
    expect(decisao).not.toMatch(/await|async|fetch\(|supabase/);
  });
});
