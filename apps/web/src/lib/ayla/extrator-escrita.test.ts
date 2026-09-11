import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  alvoDaEscritaDoExtrator,
  escritorDoPerfil,
  planejarEscritaDeFatos,
  type FatoParaEscrever,
} from "./extrator-escrita";

/**
 * A FASE 2 DA PEND-194 — QUEM ESCREVE O PERFIL VIVO.
 *
 * ⚠️ O QUE ESTE ARQUIVO PROTEGE é a propriedade mais perigosa da fase: que
 * exista **um** dono da escrita. Dois escritores sobre o mesmo Perfil Vivo não
 * produzem erro visível — produzem perfil silenciosamente errado, com um
 * domínio gravado duas vezes e o segundo apagando o primeiro. Metade dos
 * testes aqui é sobre isso, e a outra metade é sobre o rollback ser instantâneo.
 */

const ADMIN_FAM = "9c14b56b-32ca-4410-b830-09b16cc9a7a1";
const OUTRA_FAM = "c96a3ac1-91d1-4878-8f5f-da4acabb7e4f";

/** Supabase de mentira com só o que a decisão de dono consulta. */
function fakeDb(opts: { userId?: string | null; adminAtivo?: boolean | null }) {
  return {
    from: (tabela: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data:
              tabela === "family_accounts"
                ? opts.userId === null
                  ? null
                  : { user_id: opts.userId ?? "u1" }
                : opts.adminAtivo == null
                  ? null
                  : { ativo: opts.adminAtivo },
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

afterEach(() => {
  delete process.env.KOLO_EXTRATOR_ESCRITA;
});

// ─────────────────────────────────────────────────────────────────────────────
describe("a flag, e o rollback instantâneo", () => {
  it("AUSENTE = ninguém — é o estado em que isto entra no ar", () => {
    expect(alvoDaEscritaDoExtrator()).toEqual({ tipo: "ninguem" });
  });

  it("desligada explicitamente também é ninguém", () => {
    for (const v of ["0", "false", "off", "", "   "]) {
      process.env.KOLO_EXTRATOR_ESCRITA = v;
      expect(alvoDaEscritaDoExtrator()).toEqual({ tipo: "ninguem" });
    }
  });

  /**
   * ⚠️ `1` E `true` VALEM **ADMIN**, NÃO "TODAS".
   *
   * O resto do repositório usa `1`/`true` como "ligado", então alguém vai
   * digitar `1` achando que está ligando para o QA. Se `1` valesse "todas",
   * esse dedo trocaria o cérebro que aprende sobre as crianças de TODAS as
   * famílias de uma vez. A palavra `todas` tem de ser escrita à mão.
   */
  it("`1` e `true` NÃO significam todas — significam admin", () => {
    for (const v of ["1", "true", "TRUE", "admin", " Admin "]) {
      process.env.KOLO_EXTRATOR_ESCRITA = v;
      expect(alvoDaEscritaDoExtrator()).toEqual({ tipo: "admin" });
    }
  });

  it("só a palavra `todas` alcança todas as famílias", () => {
    process.env.KOLO_EXTRATOR_ESCRITA = "todas";
    expect(alvoDaEscritaDoExtrator()).toEqual({ tipo: "todas" });
  });

  it("lista de UUIDs liga só as famílias listadas", () => {
    process.env.KOLO_EXTRATOR_ESCRITA = `${ADMIN_FAM}, ${OUTRA_FAM}`;
    expect(alvoDaEscritaDoExtrator()).toEqual({
      tipo: "lista",
      familias: [ADMIN_FAM, OUTRA_FAM],
    });
  });

  it("FAIL-CLOSED: valor sem sentido não liga nada — typo não é rollout", () => {
    for (const v of ["sim", "on", "ligar", "all", "admin-geral", "9c14b56b"]) {
      process.env.KOLO_EXTRATOR_ESCRITA = v;
      expect(alvoDaEscritaDoExtrator()).toEqual({ tipo: "ninguem" });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("o dono da escrita", () => {
  it("flag desligada: o dono é o caminho ATUAL, sem nem consultar o banco", async () => {
    // O banco aqui explode se alguém tentar usá-lo: com a flag desligada,
    // a decisão não pode custar uma consulta a nenhuma família.
    const dbQueGrita = {
      from: () => {
        throw new Error("não deveria consultar com a flag desligada");
      },
    } as unknown as SupabaseClient;
    await expect(escritorDoPerfil(dbQueGrita, ADMIN_FAM)).resolves.toBe("atual");
  });

  it("admin: família administrativa vira dona; família comum NÃO", async () => {
    process.env.KOLO_EXTRATOR_ESCRITA = "admin";
    expect(
      await escritorDoPerfil(fakeDb({ adminAtivo: true }), ADMIN_FAM),
    ).toBe("extrator_unificado");
    expect(
      await escritorDoPerfil(fakeDb({ adminAtivo: null }), OUTRA_FAM),
    ).toBe("atual");
  });

  it("admin DESATIVADO não vale como admin", async () => {
    process.env.KOLO_EXTRATOR_ESCRITA = "admin";
    expect(await escritorDoPerfil(fakeDb({ adminAtivo: false }), ADMIN_FAM)).toBe("atual");
  });

  it("família sem user_id não vira dona por acidente", async () => {
    process.env.KOLO_EXTRATOR_ESCRITA = "admin";
    expect(await escritorDoPerfil(fakeDb({ userId: null }), ADMIN_FAM)).toBe("atual");
  });

  it("lista: só quem está nela", async () => {
    process.env.KOLO_EXTRATOR_ESCRITA = ADMIN_FAM;
    expect(await escritorDoPerfil(fakeDb({}), ADMIN_FAM)).toBe("extrator_unificado");
    expect(await escritorDoPerfil(fakeDb({}), OUTRA_FAM)).toBe("atual");
  });

  it("FALHA NA CONSULTA NÃO PROMOVE NINGUÉM", async () => {
    // Sem saber se a família é admin, o dono continua sendo quem já era.
    process.env.KOLO_EXTRATOR_ESCRITA = "admin";
    const dbQuebrado = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              throw new Error("banco fora");
            },
          }),
        }),
      }),
    } as unknown as SupabaseClient;
    expect(await escritorDoPerfil(dbQuebrado, ADMIN_FAM)).toBe("atual");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
const f = (
  campo: string,
  subcampo: string | null,
  texto: string,
  operacao: "adicionar" | "reescrever" = "adicionar",
): FatoParaEscrever => ({ campo, subcampo, texto, operacao });

describe("o plano de escrita — multi-fato e multidomínio", () => {
  /**
   * ⚠️ ESTE É O TESTE QUE IMPEDE PERDA SILENCIOSA DE FATO.
   *
   * Na bancada do Bento, `nutricional` recebeu TRÊS fatos no mesmo turno. Se
   * cada um virasse uma escrita, a segunda leitura aconteceria antes da
   * primeira gravação estar visível e duas das três se perderiam — a rajada do
   * §8, dentro de um único turno.
   */
  it("três fatos do mesmo domínio viram UMA escrita, com os três sub-campos", () => {
    const { escritas } = planejarEscritaDeFatos(
      [
        f("nutricional", "seletividade", "Alta"),
        f("nutricional", "aceita", "arroz; macarrão; pão"),
        f("nutricional", "rejeita", "molho; comida misturada"),
      ],
      { nutricional: "" },
    );
    expect(escritas).toHaveLength(1);
    expect(escritas[0].campo).toBe("nutricional");
    expect(escritas[0].subcampos).toEqual(["seletividade", "aceita", "rejeita"]);
    expect(escritas[0].texto).toContain("Alta");
    expect(escritas[0].texto).toContain("arroz");
    expect(escritas[0].texto).toContain("molho");
    // Domínio com sub-campos é serializado inteiro.
    expect(escritas[0].operacao).toBe("reescrever");
  });

  it("MULTIDOMÍNIO: dois domínios no mesmo turno viram duas escritas separadas", () => {
    // O caso T4 da bancada: conversa preservada + perda sob estresse.
    const { escritas } = planejarEscritaDeFatos(
      [
        f("comunicacao", "contexto", "conversa bem quando calmo"),
        f("emocional", "sinais", "trava e não explica quando nervoso"),
      ],
      { comunicacao: "", emocional: "" },
    );
    expect(escritas.map((e) => e.campo)).toEqual(["comunicacao", "emocional"]);
    expect(escritas).toHaveLength(2);
  });

  it("O QUE JÁ EXISTIA NO DOMÍNIO NÃO É APAGADO", () => {
    // `comunicacao.forma` estava preenchido antes do turno; o fato novo é de
    // outro sub-campo. Perder o seletor aqui seria o defeito mais caro
    // possível — é o campo que o Gate B lê.
    const { escritas } = planejarEscritaDeFatos(
      [f("comunicacao", "vocabulario", "troca algumas letras")],
      { comunicacao: "Como se comunica: Fala frases" },
    );
    expect(escritas[0].texto).toContain("Fala frases");
    expect(escritas[0].texto).toContain("troca algumas letras");
  });

  it("dois fatos para o MESMO sub-campo: vale o último, e não se duplica a chave", () => {
    const { escritas } = planejarEscritaDeFatos(
      [f("sono", "despertares", "acorda 1x"), f("sono", "despertares", "acorda 2x")],
      { sono: "" },
    );
    expect(escritas).toHaveLength(1);
    expect(escritas[0].subcampos).toEqual(["despertares"]);
    expect(escritas[0].texto).toContain("acorda 2x");
    expect(escritas[0].texto).not.toContain("acorda 1x");
  });

  it("conta quantos caíram no balde de sobra — a mesma conta que a sombra publica", () => {
    const { escritas } = planejarEscritaDeFatos(
      [f("sensorial", "sons", "chuveiro"), f("sensorial", "outras", "banho melhorou")],
      { sensorial: "" },
    );
    expect(escritas[0].noBaldeDeSobra).toBe(1);
  });

  it("sem sub-campo declarado, cai no último do domínio — e é contado como balde", () => {
    const { escritas } = planejarEscritaDeFatos([f("sensorial", null, "algo solto")], {});
    expect(escritas[0].subcampos).toEqual(["outras"]);
    expect(escritas[0].noBaldeDeSobra).toBe(1);
  });
});

describe("o plano de escrita — o que ele RECUSA", () => {
  it("campo que não existe no Perfil Vivo não é escrito", () => {
    const { escritas, ignorados } = planejarEscritaDeFatos(
      [f("campo_inventado", "x", "algo")],
      {},
    );
    expect(escritas).toHaveLength(0);
    expect(ignorados[0].motivo).toBe("campo_desconhecido");
  });

  it("sub-campo que não existe no domínio não inventa lugar", () => {
    const { escritas, ignorados } = planejarEscritaDeFatos(
      [f("sono", "subcampo_que_nao_existe", "algo")],
      { sono: "" },
    );
    expect(escritas).toHaveLength(0);
    expect(ignorados[0].motivo).toBe("subcampo_inexistente");
  });

  it("texto vazio não vira escrita", () => {
    const { escritas, ignorados } = planejarEscritaDeFatos(
      [f("sono", "despertares", "   ")],
      { sono: "" },
    );
    expect(escritas).toHaveLength(0);
    expect(ignorados[0].motivo).toBe("texto_vazio");
  });

  it("DESABAFO: zero fatos entram, zero escritas saem", () => {
    const { escritas, ignorados } = planejarEscritaDeFatos([], {});
    expect(escritas).toEqual([]);
    expect(ignorados).toEqual([]);
  });

  it("um sub-campo inexistente não derruba os fatos válidos do mesmo domínio", () => {
    // Caso I do §12: correção que suprime, suprimindo demais.
    const { escritas, ignorados } = planejarEscritaDeFatos(
      [f("sono", "nao_existe", "x"), f("sono", "despertares", "acorda 2x")],
      { sono: "" },
    );
    expect(escritas).toHaveLength(1);
    expect(escritas[0].subcampos).toEqual(["despertares"]);
    expect(ignorados).toHaveLength(1);
  });
});

describe("o plano de escrita — domínio de texto livre", () => {
  it("`adicionar` deixa a integração para quem já sabe integrar", () => {
    // `aplicarSugestaoNoMembro` tem a regra de append e o `detectarMarcos`.
    // Vários fatos do mesmo domínio viram um texto só, para integrar UMA vez.
    const { escritas } = planejarEscritaDeFatos(
      [f("como_e", null, "Adora dinossauros."), f("como_e", null, "Gosta de água.")],
      { como_e: "É risonho." },
    );
    expect(escritas).toHaveLength(1);
    expect(escritas[0].operacao).toBe("adicionar");
    expect(escritas[0].texto).toBe("Adora dinossauros. Gosta de água.");
  });

  it("CONTRADIÇÃO/ATUALIZAÇÃO: `reescrever` traz a seção inteira e não empilha", () => {
    const { escritas } = planejarEscritaDeFatos(
      [
        f("como_e", null, "antigo", "adicionar"),
        f("como_e", null, "É risonho e agora também adora dinossauros.", "reescrever"),
      ],
      { como_e: "É risonho." },
    );
    expect(escritas[0].operacao).toBe("reescrever");
    expect(escritas[0].texto).toBe("É risonho e agora também adora dinossauros.");
    expect(escritas[0].texto).not.toContain("antigo");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
/**
 * SABOTAGENS — as duas propriedades que não podem quebrar em silêncio.
 */
describe("sabotagem — dois escritores sobre o mesmo Perfil Vivo", () => {
  const ORQ = readFileSync(new URL("./orchestrator.ts", import.meta.url), "utf8");

  it("a decisão de dono é calculada UMA vez, antes da escrita", () => {
    const decisao = ORQ.indexOf("const escritor = await escritorDoPerfil(");
    const escritaAtual = ORQ.indexOf("await persistirRegistro(supabase, family.id, parsedExp, {");
    expect(decisao).toBeGreaterThan(0);
    expect(escritaAtual).toBeGreaterThan(decisao);
    // Uma decisão só: se aparecer duas vezes, dois lugares podem divergir.
    expect(ORQ.split("await escritorDoPerfil(").length - 1).toBe(1);
  });

  it("o caminho ATUAL só escreve o Perfil quando o dono é ele", () => {
    expect(ORQ).toMatch(/escreverKoloVivo: escritor === "atual"/);
    // E a seção 3 respeita o parâmetro.
    expect(ORQ).toMatch(
      /if \(escreverKoloVivo && p\.sugestao_kolo_vivo && p\.texto_kolo_vivo_sugerido\)/,
    );
  });

  it("os dois caminhos são MUTUAMENTE EXCLUSIVOS, por if/else sobre a mesma variável", () => {
    const i = ORQ.indexOf('if (escritor === "extrator_unificado") {');
    expect(i).toBeGreaterThan(0);
    const bloco = ORQ.slice(i, i + 900);
    expect(bloco).toMatch(/await escreverKoloVivoComExtrator\(/);
    expect(bloco).toMatch(/\} else \{[\s\S]*?await medirExtratorEmSombra\(/);
    // O escritor novo é chamado em UM lugar só, e é dentro desse if.
    expect(ORQ.split("await escreverKoloVivoComExtrator(").length - 1).toBe(1);
  });

  it("o escritor novo grava no membro DO TURNO — nunca num irmão", () => {
    const i = ORQ.indexOf("async function escreverKoloVivoComExtrator(");
    const fn = ORQ.slice(i, ORQ.indexOf("\n}", i));
    expect(fn).toMatch(/aplicarSugestaoNoMembro\(\s*supabase,\s*t\.familyId,\s*t\.membroId,/);
    // Sem criança resolvida não escreve nada.
    expect(fn).toMatch(/if \(!t\.membroId \|\| !t\.membro\) return;/);
  });

  it("a escrita confere o próprio resultado, e a falha é ERRO persistido", () => {
    const i = ORQ.indexOf("async function escreverKoloVivoComExtrator(");
    const fn = ORQ.slice(i, ORQ.indexOf("\n}", i));
    // §7: `aplicarSugestaoNoMembro` devolve boolean; ignorá-lo seria falso sucesso.
    expect(fn).toMatch(/const ok = await aplicarSugestaoNoMembro\(/);
    expect(fn).toMatch(/kind: "extrator_escrita_falhou"/);
    expect(fn).toMatch(/severity: "error"/);
  });

  it("UMA extração por turno — nunca duas chamadas de modelo", () => {
    // O orquestrador extrai em UM lugar: dentro do escritor. O outro caminho
    // extrai dentro de `medirExtratorEmSombra`, e os dois são exclusivos. Se
    // este número virar 2, alguém pagou modelo duas vezes no mesmo turno.
    expect(ORQ.split("await extrairDoTurno(").length - 1).toBe(1);
    const i = ORQ.indexOf("const turnoParaExtrator = {");
    expect(i).toBeGreaterThan(0);
    // O mesmo objeto alimenta os dois caminhos.
    expect(ORQ).toMatch(/await escreverKoloVivoComExtrator\(supabase, turnoParaExtrator,/);
    expect(ORQ).toMatch(/await medirExtratorEmSombra\(turnoParaExtrator\)/);
  });

  it("check-in e diário NÃO mudam de dono nesta fase", () => {
    // `escreverKoloVivo` gateia só a seção 3. Se ele passar a gatear o
    // check-in ou o diário, a fase deixa de ser isolável.
    const i = ORQ.indexOf("async function persistirRegistro(");
    const fn = ORQ.slice(i, ORQ.indexOf("// 3. Sugestão de Kolo Vivo", i));
    expect(fn).toMatch(/from\("ayla_daily_checkins"\)/);
    expect(fn).not.toMatch(/escreverKoloVivo &&/);
  });
});

describe("sabotagem — desligar a flag restaura o comportamento anterior", () => {
  const ORQ = readFileSync(new URL("./orchestrator.ts", import.meta.url), "utf8");

  it("o default do parâmetro é escrever — chamador que não conhece a Fase 2 não muda", () => {
    expect(ORQ).toMatch(/opcoes: \{ escreverKoloVivo\?: boolean \} = \{\}/);
    expect(ORQ).toMatch(/const escreverKoloVivo = opcoes\.escreverKoloVivo !== false;/);
  });

  it("com a flag ausente o dono é `atual` e o caminho novo nem é chamado", async () => {
    delete process.env.KOLO_EXTRATOR_ESCRITA;
    const db = fakeDb({ adminAtivo: true });
    expect(await escritorDoPerfil(db, ADMIN_FAM)).toBe("atual");
  });

  it("o caminho antigo NÃO foi removido — parser e roteador seguem no arquivo", () => {
    // Nesta fase o antigo é o plano de rollback. Removê-lo é o que torna a
    // volta impossível.
    expect(ORQ).toMatch(/await parseInbound\(/);
    expect(ORQ).toMatch(/rotearFatoSubcampo\(/);
    expect(ORQ).toMatch(/decidirDedup\(/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("o que a Fase 2 tem de preservar", () => {
  const ORQ = readFileSync(new URL("./orchestrator.ts", import.meta.url), "utf8");
  const SOM = readFileSync(new URL("./extrator-sombra.ts", import.meta.url), "utf8");

  it("fotografia pré-escrita: a foto é tirada antes da escrita e os DOIS caminhos a recebem", () => {
    const foto = ORQ.indexOf("const koloVivoAntesDoTurno");
    const escrita = ORQ.indexOf("await persistirRegistro(supabase, family.id, parsedExp, {");
    expect(foto).toBeLessThan(escrita);
    expect(ORQ).toMatch(/koloVivoResumo: koloVivoAntesDoTurno/);
  });

  it("transcript = turno atual, contexto anterior separado, modo estrito", () => {
    const i = SOM.indexOf("export async function extrairDoTurno(");
    const fn = SOM.slice(i);
    expect(fn).toMatch(/const transcript = `Responsável: \$\{t\.entrada\}`/);
    expect(fn).toMatch(/contextoRecente,/);
    expect(fn).toMatch(/modo: "estrito"/);
    expect(fn).toMatch(/entradaNormalizada: t\.entrada/);
  });

  it("o custo do escritor é separável do custo da sombra", () => {
    expect(SOM).toMatch(/meta: opts\.escrita \? \{ escrita: true \} : \{ sombra: true \}/);
  });

  it("os dois caminhos publicam a MESMA conta, e `kind` diferentes", () => {
    expect(SOM).toMatch(/export function metricasDaProposta</);
    expect(SOM).toMatch(/kind: "extrator_sombra"/);
    expect(ORQ).toMatch(/kind: "extrator_escreveu"/);
  });

  it("o evento do escritor carrega turno, escritor e a divergência contra o antigo", () => {
    const i = ORQ.indexOf('kind: "extrator_escreveu"');
    const bloco = ORQ.slice(i, i + 2200);
    for (const campo of [
      "turno: t.turnoId",
      'escritor: "extrator_unificado"',
      "n_rejeitados",
      "n_balde_de_sobra",
      "chaves",
      "dominios_escritos",
      "atual_tinha_fato",
      "atual_campo",
      "ms:",
    ]) {
      expect(bloco).toContain(campo);
    }
  });

  it("o turno do escritor usa a fala do LOTE e a via do áudio", () => {
    // Debounce agrupado: `inbound.texto` já foi reatribuído para o texto do
    // lote antes daqui. E áudio tem via própria, que vira `procedencia`.
    const i = ORQ.indexOf("const turnoParaExtrator = {");
    const bloco = ORQ.slice(i, i + 1400);
    expect(bloco).toMatch(/entrada: inbound\.texto/);
    expect(bloco).toMatch(/whatsapp_audio/);
    expect(bloco).toMatch(/membroId: parsedExp\.membro_atipico_id/);
  });

  it("o foco do turno manda sobre o parser — isolamento entre irmãos", () => {
    // A reatribuição acontece ANTES da decisão de dono e da escrita.
    const foco = ORQ.indexOf("if (exp.membroId) parsedExp.membro_atipico_id = exp.membroId;");
    const decisao = ORQ.indexOf("const escritor = await escritorDoPerfil(");
    expect(foco).toBeGreaterThan(0);
    expect(foco).toBeLessThan(decisao);
  });
});
