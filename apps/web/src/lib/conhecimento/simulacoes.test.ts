import { describe, expect, it } from "vitest";
import { avaliarFatos, classeDoFato, type FatoCandidato, type Via } from "./fato";

/**
 * AS DEZ SIMULAÇÕES DO PORTÃO — o que as guardas fazem, caso a caso.
 *
 * ⚠️ LEIA ISTO ANTES DE LER OS NÚMEROS.
 *
 * O que aqui é **PROVADO POR EXECUÇÃO**: tudo o que acontece DEPOIS que o
 * modelo devolve — vocabulário, enum, condicional, citação, classe, procedência
 * e `habilidade_id`. Essa parte é código rodando, e é o que esta fase entrega.
 *
 * O que aqui é **ESTIPULADO**: os candidatos que o modelo devolveria. Não há
 * como provar isso sem chamar o modelo com dinheiro real e famílias reais, e
 * fingir que dá seria trocar prova por encenação. Os candidatos foram escritos
 * para serem PLAUSÍVEIS E DESFAVORÁVEIS — cada caso inclui pelo menos uma
 * saída que as guardas deveriam recusar.
 *
 * Rode `npx vitest run simulacoes --reporter=verbose` para ver o relatório
 * impresso caso a caso.
 */

const EM = "2026-08-22T12:00:00.000Z";

type Caso = {
  n: number;
  titulo: string;
  entrada: string;
  via: Via;
  perfilAntes: Record<string, string>;
  candidatos: FatoCandidato[];
  /** Quantas chamadas de modelo o turno gasta na arquitetura proposta. */
  chamadas: number;
};

const f = (
  campo: string,
  subcampo: string | null,
  valor: string,
  extra: Partial<FatoCandidato> = {},
): FatoCandidato => ({
  camada: "camada1",
  campo,
  subcampo,
  valor,
  operacao: "adicionar",
  ...extra,
});

const CASOS: Caso[] = [
  {
    n: 1,
    titulo: "um fato só",
    entrada: "Ele fala algumas palavras.",
    via: "whatsapp_texto",
    perfilAntes: {},
    candidatos: [
      f("comunicacao", "forma", "Fala palavras soltas", {
        operacao: "reescrever",
        citacao: "fala algumas palavras",
      }),
    ],
    chamadas: 1,
  },
  {
    n: 2,
    titulo: "dois fatos — hoje o WhatsApp pegaria UM",
    entrada: "Ele fala algumas palavras e aponta.",
    via: "whatsapp_texto",
    perfilAntes: {},
    candidatos: [
      f("comunicacao", "forma", "Fala palavras soltas", {
        operacao: "reescrever",
        citacao: "fala algumas palavras",
      }),
      f("comunicacao", "contato", "aponta", { citacao: "aponta" }),
    ],
    chamadas: 1,
  },
  {
    n: 3,
    titulo: "três fatos",
    entrada: "Ele fala algumas palavras, aponta e imita.",
    via: "whatsapp_texto",
    perfilAntes: {},
    candidatos: [
      f("comunicacao", "forma", "Fala palavras soltas", {
        operacao: "reescrever",
        citacao: "fala algumas palavras",
      }),
      f("comunicacao", "contato", "aponta", { citacao: "aponta" }),
      f("imitacao", "outras", "imita", { citacao: "imita" }),
    ],
    chamadas: 1,
  },
  {
    n: 4,
    titulo: "não-verbal que entende e aponta",
    entrada: "Ele não fala, mas entende o que eu peço e aponta.",
    via: "whatsapp_texto",
    perfilAntes: {},
    candidatos: [
      f("comunicacao", "forma", "Não-verbal", {
        operacao: "reescrever",
        citacao: "não fala",
      }),
      f("comunicacao", "contexto", "entende pedidos simples", {
        citacao: "entende o que eu peço",
      }),
      f("comunicacao", "contato", "aponta", { citacao: "aponta" }),
      // ⚠️ desfavorável: `entende` exige forma ∈ {Fala frases, Fala palavras
      // soltas}. O modelo escolheu o sub-campo errado para uma criança que
      // acabou de ser marcada como Não-verbal no MESMO lote.
      f("comunicacao", "entende", "segue pedidos", { citacao: "entende o que eu peço" }),
    ],
    chamadas: 1,
  },
  {
    n: 5,
    titulo: "fala bastante MAS regride sob estresse",
    entrada: "Ele fala bastante, mas quando fica nervoso só me puxa pela mão.",
    via: "whatsapp_texto",
    perfilAntes: {},
    candidatos: [
      f("comunicacao", "forma", "Fala frases", {
        operacao: "reescrever",
        citacao: "fala bastante",
      }),
      f("comunicacao", "mostra", "quando nervoso, puxa pela mão", {
        citacao: "quando fica nervoso só me puxa pela mão",
      }),
      f("emocional", "outras", "sob estresse perde a fala", {
        citacao: "quando fica nervoso",
        inferido: true,
      }),
    ],
    chamadas: 1,
  },
  {
    n: 6,
    titulo: "EVOLUÇÃO — o caso que gera marco",
    entrada: "Ele começou a formar frases de três palavras.",
    via: "whatsapp_texto",
    perfilAntes: { comunicacao: "Como se comunica: Fala palavras soltas" },
    candidatos: [
      f("comunicacao", "forma", "Fala frases", {
        operacao: "reescrever",
        citacao: "começou a formar frases",
      }),
      f("comunicacao", "conversa", "frases de três palavras", {
        citacao: "frases de três palavras",
      }),
    ],
    chamadas: 1,
  },
  {
    n: 7,
    titulo: "negativa — 'sei que NÃO', que não é 'não sei'",
    entrada: "Ele não aponta.",
    via: "whatsapp_texto",
    perfilAntes: {},
    candidatos: [
      f("comunicacao", "contato", "não aponta", { citacao: "não aponta" }),
      // ⚠️ desfavorável: a leitura clínica da Ayla, sem âncora. Não pode virar
      // afirmação da família.
      f("comunicacao", "outras", "possível dificuldade de atenção compartilhada", {
        inferido: true,
      }),
    ],
    chamadas: 1,
  },
  {
    n: 8,
    titulo: "ambivalência — 'às vezes / normalmente'",
    entrada: "Às vezes aponta, mas normalmente puxa minha mão.",
    via: "whatsapp_texto",
    perfilAntes: {},
    candidatos: [
      f("comunicacao", "contato", "às vezes aponta", { citacao: "às vezes aponta" }),
      f("comunicacao", "mostra", "normalmente puxa a mão", {
        citacao: "normalmente puxa minha mão",
      }),
      // ⚠️ desfavorável: paráfrase disfarçada de citação.
      f("comunicacao", "forma", "Não-verbal", {
        operacao: "reescrever",
        citacao: "a criança não usa palavras",
      }),
    ],
    chamadas: 1,
  },
  {
    n: 9,
    titulo: "mensagem longa — comunicação + comportamento + interesse + desabafo + pergunta",
    entrada:
      "Oi, tô exausta. O Téo teve crise no mercado hoje de novo, gritou muito quando o caixa apitou. Ele fala frases mas na hora da crise não fala nada. Passa o dia inteiro vendo vídeo de trator, é a única coisa que acalma. Isso é normal? O que eu faço?",
    via: "whatsapp_texto",
    perfilAntes: {},
    candidatos: [
      f("emocional", "outras", "crise no mercado com o apito do caixa", {
        citacao: "crise no mercado hoje de novo, gritou muito quando o caixa apitou",
      }),
      f("sensorial", "outras", "reage a som agudo repentino", {
        citacao: "quando o caixa apitou",
        inferido: true,
      }),
      f("comunicacao", "forma", "Fala frases", {
        operacao: "reescrever",
        citacao: "fala frases",
      }),
      f("comunicacao", "conversa", "na crise, perde a fala", {
        citacao: "na hora da crise não fala nada",
      }),
      f("tela_midia", "outras", "vídeos de trator o dia inteiro", {
        citacao: "Passa o dia inteiro vendo vídeo de trator",
      }),
      f("como_e", null, "interesse por tratores", {
        citacao: "vídeo de trator",
      }),
      // ⚠️ desfavorável: o desabafo da mãe não é fato sobre a criança, e
      // `meu_bem_estar` não é domínio do perfil da criança.
      f("meu_bem_estar", null, "mãe exausta", { citacao: "tô exausta" }),
    ],
    chamadas: 1,
  },
  {
    n: 10,
    titulo: "ÁUDIO transcrito com 5+ fatos — mesmo cérebro, entrada diferente",
    entrada:
      "então assim ele tá comendo melhor essa semana aceitou até brócolis que ele nunca aceitava só que continua não querendo nada de folha né e o sono tá horrível acorda três vezes por noite e aí de manhã não quer ir pra escola chora na porta a professora falou que ele tá brincando mais com o Pedro isso me deixou tão feliz",
    via: "whatsapp_audio",
    perfilAntes: { nutricional: "Seletividade alimentar: Alta" },
    candidatos: [
      f("nutricional", "aceita", "brócolis", { citacao: "aceitou até brócolis" }),
      f("nutricional", "rejeita", "folhas", { citacao: "não querendo nada de folha" }),
      f("nutricional", "seletividade", "Média", {
        operacao: "reescrever",
        citacao: "tá comendo melhor essa semana",
        inferido: true,
      }),
      f("sono", "despertares", "acorda três vezes por noite", {
        citacao: "acorda três vezes por noite",
      }),
      f("escola", "outras", "chora na porta da escola de manhã", {
        citacao: "não quer ir pra escola chora na porta",
      }),
      f("socializacao", "outras", "brinca mais com o Pedro", {
        citacao: "brincando mais com o Pedro",
      }),
    ],
    chamadas: 1,
  },
];

const linha = (s: string) => `      ${s}`;

describe("SIMULAÇÕES — o que as guardas fazem com o que o modelo devolve", () => {
  for (const caso of CASOS) {
    it(`${caso.n}. ${caso.titulo}`, () => {
      const r = avaliarFatos({
        candidatos: caso.candidatos,
        temMembro: true,
        entradaNormalizada: caso.entrada,
        procedenciaBase: { via: caso.via, em: EM },
        estadoAtual: caso.perfilAntes,
      });

      const out: string[] = [];
      out.push("");
      out.push(linha(`ENTRADA          "${caso.entrada.slice(0, 96)}${caso.entrada.length > 96 ? "…" : ""}"`));
      out.push(
        linha(
          `PERFIL ANTES     ${Object.keys(caso.perfilAntes).length ? JSON.stringify(caso.perfilAntes) : "(vazio)"}`,
        ),
      );
      out.push(linha(`CANDIDATOS       ${caso.candidatos.length}`));
      out.push(linha(`ACEITOS          ${r.aceitos.length}`));
      for (const a of r.aceitos) {
        out.push(
          linha(
            `  ✓ ${a.habilidade_id.padEnd(24)} = "${a.valor}"  [${classeDoFato(a)}] ` +
              `evid="${(a.citacao ?? "—").slice(0, 34)}" ${a.inferido ? "INFERIDO" : "EXPLÍCITO"} ` +
              `por=${a.procedencia.por} via=${a.procedencia.via} em=${a.procedencia.em.slice(0, 10)}`,
          ),
        );
      }
      out.push(linha(`REJEITADOS       ${r.rejeitados.length}`));
      for (const x of r.rejeitados) {
        out.push(linha(`  ✗ ${(x.candidato.campo + "." + (x.candidato.subcampo ?? "")).padEnd(24)} ${x.motivo} — ${x.detalhe}`));
      }
      out.push(linha(`HIPÓTESES (turno)${String(r.hipoteses.length).padStart(2)}`));
      for (const h of r.hipoteses) {
        out.push(linha(`  ~ ${h.campo}.${h.subcampo ?? ""} = "${h.valor}"  (não persiste)`));
      }
      out.push(linha(`CHAMADAS LLM     ${caso.chamadas}`));
      out.push("");
      console.log(out.join("\n"));

      // ── as afirmações que valem como prova ────────────────────────────────
      expect(r.aceitos.length + r.rejeitados.length + r.hipoteses.length).toBe(
        caso.candidatos.length,
      );
      // Nada aceito sem endereço no vocabulário, e nada com procedência inventada.
      for (const a of r.aceitos) {
        expect(a.habilidade_id).toMatch(/^[a-z_]+(\.[a-z_]+)?$/);
        expect(a.procedencia.via).toBe(caso.via);
        expect(a.procedencia.por).toBe(a.inferido ? "ayla" : "familia");
      }
    });
  }
});

describe("o que cada caso desfavorável tinha que pegar", () => {
  const rodar = (c: Caso) =>
    avaliarFatos({
      candidatos: c.candidatos,
      temMembro: true,
      entradaNormalizada: c.entrada,
      procedenciaBase: { via: c.via, em: EM },
      estadoAtual: c.perfilAntes,
    });

  it("caso 4 · sub-campo de criança falante numa criança não-verbal é recusado", () => {
    const r = rodar(CASOS[3]);
    expect(r.rejeitados.map((x) => x.motivo)).toContain("subcampo_incompativel_com_o_estado");
    expect(r.aceitos.map((a) => a.habilidade_id)).toContain("comunicacao.forma");
  });

  it("caso 6 · a evolução passa inteira — seletor novo E o detalhe que ele libera", () => {
    const r = rodar(CASOS[5]);
    expect(r.rejeitados).toEqual([]);
    expect(r.aceitos.map((a) => `${a.habilidade_id}=${a.valor}`)).toEqual([
      "comunicacao.forma=Fala frases",
      "comunicacao.conversa=frases de três palavras",
    ]);
  });

  it("caso 7 · a leitura clínica sem âncora NÃO vira afirmação da família", () => {
    const r = rodar(CASOS[6]);
    expect(r.aceitos).toHaveLength(1);
    expect(r.aceitos[0].procedencia.por).toBe("familia");
    expect(r.hipoteses).toHaveLength(1);
    expect(r.hipoteses[0].valor).toMatch(/atenção compartilhada/);
  });

  it("caso 8 · citação parafraseada é recusada, e o resto do lote sobrevive", () => {
    const r = rodar(CASOS[7]);
    expect(r.rejeitados.map((x) => x.motivo)).toEqual(["citacao_nao_comprovada"]);
    expect(r.aceitos).toHaveLength(2);
  });

  it("caso 9 · o desabafo da mãe não entra no perfil da criança", () => {
    const r = rodar(CASOS[8]);
    expect(r.rejeitados.map((x) => x.motivo)).toEqual(["campo_desconhecido"]);
    expect(r.rejeitados[0].detalhe).toBe("meu_bem_estar");
    expect(r.aceitos).toHaveLength(6);
  });

  it("caso 10 · áudio produz seis fatos, e o inferido fica marcado como leitura", () => {
    const r = rodar(CASOS[9]);
    expect(r.aceitos).toHaveLength(6);
    expect(r.rejeitados).toEqual([]);
    const seletividade = r.aceitos.find((a) => a.habilidade_id === "nutricional.seletividade");
    expect(seletividade?.valor).toBe("Média");
    expect(classeDoFato(seletividade!)).toBe("leitura");
    expect(seletividade?.procedencia.por).toBe("ayla");
    expect(r.aceitos.every((a) => a.procedencia.via === "whatsapp_audio")).toBe(true);
  });
});
