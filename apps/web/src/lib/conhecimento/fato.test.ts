import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  avaliarFatos,
  citacaoConfere,
  classeDoFato,
  habilidadeId,
  partesDaHabilidade,
  vocabularioHabilidades,
  type FatoCandidato,
} from "./fato";

/** Tira comentários de bloco e de linha — asserção estrutural testa CÓDIGO. */
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const EM = "2026-08-22T12:00:00.000Z";
const base = { via: "whatsapp_texto" as const, em: EM };

const cand = (p: Partial<FatoCandidato>): FatoCandidato => ({
  camada: "camada1",
  campo: "comunicacao",
  subcampo: "outras",
  valor: "algo",
  operacao: "adicionar",
  ...p,
});

const avaliar = (candidatos: FatoCandidato[], extra: Partial<Parameters<typeof avaliarFatos>[0]> = {}) =>
  avaliarFatos({
    candidatos,
    temMembro: true,
    entradaNormalizada: "",
    procedenciaBase: base,
    ...extra,
  });

// ─────────────────────────────────────────────────────────────────────────────
describe("A · identidade do fato", () => {
  it("1. habilidade_id é dominio.subcampo, e volta inteiro", () => {
    expect(habilidadeId("comunicacao", "forma")).toBe("comunicacao.forma");
    expect(partesDaHabilidade("comunicacao.forma")).toEqual({
      campo: "comunicacao",
      subcampo: "forma",
    });
  });

  it("2. domínio sem sub-campo é o próprio domínio", () => {
    expect(habilidadeId("essencial", null)).toBe("essencial");
    expect(partesDaHabilidade("essencial")).toEqual({ campo: "essencial", subcampo: null });
  });

  it("3. o vocabulário é fechado e não tem duplicata", () => {
    const v = vocabularioHabilidades();
    expect(v.length).toBeGreaterThan(80);
    expect(new Set(v).size).toBe(v.length);
    expect(v).toContain("comunicacao.forma");
    expect(v).toContain("nutricional.rejeita");
  });

  it("4. o id NUNCA vem do modelo — é derivado de (campo, subcampo)", () => {
    // Guarda estrutural: se alguém aceitar `habilidade_id` no schema do modelo,
    // o endereço do Mapa da Criança passa a ser inventável, e este teste cai.
    const extrator = readFileSync(resolve(__dirname, "extrair.ts"), "utf8");
    const schema = extrator.slice(
      extrator.indexOf("const PropostaSchema"),
      extrator.indexOf("const SYSTEM"),
    );
    expect(schema).not.toMatch(/habilidade_id/);
    // e quem monta o endereço é o contrato, a partir de (campo, subcampo)
    expect(readFileSync(resolve(__dirname, "fato.ts"), "utf8")).toMatch(
      /habilidade_id: habilidadeId\(c\.campo, subcampo\)/,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("B · vocabulário fechado — fail-closed", () => {
  it("5. campo fora do vocabulário é rejeitado, não adaptado", () => {
    const r = avaliar([cand({ campo: "telepatia", subcampo: null })]);
    expect(r.aceitos).toHaveLength(0);
    expect(r.rejeitados[0].motivo).toBe("campo_desconhecido");
  });

  it("6. sub-campo desconhecido é rejeitado — antes ia calado pra 'Outras observações'", () => {
    const r = avaliar([cand({ campo: "comunicacao", subcampo: "aponta" })]);
    expect(r.aceitos).toHaveLength(0);
    expect(r.rejeitados[0].motivo).toBe("subcampo_desconhecido");
    expect(r.rejeitados[0].detalhe).toBe("comunicacao.aponta");
  });

  it("7. fato de criança sem criança não tem dono", () => {
    const r = avaliar([cand({})], { temMembro: false });
    expect(r.rejeitados[0].motivo).toBe("camada1_sem_membro");
  });

  it("8. valor vazio não vira fato", () => {
    const r = avaliar([cand({ valor: "   " })]);
    expect(r.rejeitados[0].motivo).toBe("valor_vazio");
  });

  it("9. camada2 aceita só os quatro campos da família", () => {
    const ok = avaliar([cand({ camada: "camada2", campo: "rotina", subcampo: null })]);
    expect(ok.aceitos).toHaveLength(1);
    const nao = avaliar([cand({ camada: "camada2", campo: "sono", subcampo: null })]);
    expect(nao.rejeitados[0].motivo).toBe("campo_desconhecido");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("C · seletor: casar não é adaptar", () => {
  it("10. valor exato passa e sai canônico", () => {
    const r = avaliar([cand({ subcampo: "forma", valor: "Não-verbal" })]);
    expect(r.aceitos[0].valor).toBe("Não-verbal");
    expect(r.aceitos[0].habilidade_id).toBe("comunicacao.forma");
  });

  it("11. caixa e acento não são divergência de conteúdo", () => {
    const r = avaliar([cand({ subcampo: "forma", valor: "nao-verbal" })]);
    expect(r.aceitos).toHaveLength(1);
    expect(r.aceitos[0].valor).toBe("Não-verbal"); // canonizado, não inventado
  });

  it("12. o caso REAL de produção: 'Fala frases curtas' é rejeitado", () => {
    // MEDI 22/08/2026: 258 seletores preenchidos em produção, 1 fora do enum —
    // exatamente este. Um seletor corrompido quebra as condicionais e faz
    // detectarMarcos inventar um marco na escrita seguinte.
    const r = avaliar([cand({ subcampo: "forma", valor: "Fala frases curtas" })]);
    expect(r.aceitos).toHaveLength(0);
    expect(r.rejeitados[0].motivo).toBe("valor_fora_das_opcoes");
  });

  it("13. domínio sem sub-campo declarado cai em 'outras' — comportamento antigo preservado", () => {
    const r = avaliar([cand({ campo: "sono", subcampo: null, valor: "demora pra dormir" })]);
    expect(r.aceitos[0].subcampo).toBe("outras");
    expect(r.aceitos[0].valor).toBe("demora pra dormir");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("D · condicional olha o LOTE, não só o banco", () => {
  const perfilPalavrasSoltas = { comunicacao: "Como se comunica: Fala palavras soltas" };

  it("14. sub-campo incompatível com o estado é rejeitado", () => {
    const r = avaliar([cand({ campo: "comunicacao", subcampo: "conversa", valor: "argumenta" })], {
      estadoAtual: perfilPalavrasSoltas,
    });
    expect(r.rejeitados[0].motivo).toBe("subcampo_incompativel_com_o_estado");
  });

  it("15. mas o MESMO lote que muda o seletor libera o sub-campo — o caso 'frases de três palavras'", () => {
    const r = avaliar(
      [
        cand({ campo: "comunicacao", subcampo: "forma", valor: "Fala frases", operacao: "reescrever" }),
        cand({ campo: "comunicacao", subcampo: "conversa", valor: "monta frases de três palavras" }),
      ],
      { estadoAtual: perfilPalavrasSoltas },
    );
    expect(r.rejeitados).toHaveLength(0);
    expect(r.aceitos.map((f) => f.habilidade_id)).toEqual([
      "comunicacao.forma",
      "comunicacao.conversa",
    ]);
  });

  it("16. sem estado atual, a condicional não bloqueia — perfil vazio não é perfil incompatível", () => {
    const r = avaliar([cand({ campo: "comunicacao", subcampo: "conversa", valor: "x" })]);
    expect(r.aceitos).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("E · procedência é do pipeline, nunca do modelo", () => {
  it("17. `por` sai de `inferido`, e `via`/`em` de quem chama", () => {
    const r = avaliar([cand({ valor: "x" })], {
      procedenciaBase: { via: "whatsapp_audio", em: EM },
    });
    expect(r.aceitos[0].procedencia).toEqual({ por: "familia", via: "whatsapp_audio", em: EM });
  });

  it("18. leitura da Ayla JAMAIS recebe `por: familia`", () => {
    const r = avaliar([cand({ valor: "dificuldade de atenção compartilhada", inferido: true, citacao: "ele não aponta" })], {
      entradaNormalizada: "Ele não aponta.",
    });
    expect(r.aceitos[0].procedencia.por).toBe("ayla");
    expect(classeDoFato(r.aceitos[0])).toBe("leitura");
  });

  it("19. o modelo não tem como pedir a procedência — ela não está no schema dele", () => {
    const src = readFileSync(resolve(__dirname, "extrair.ts"), "utf8");
    const schema = src.slice(src.indexOf("const PropostaSchema"), src.indexOf("const SYSTEM"));
    for (const proibido of ["procedencia", '"por"', "por:", "via:", '"em"']) {
      expect(schema).not.toContain(proibido);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("F · citação é prova de proveniência", () => {
  const fala = "Ele fala algumas palavras e aponta quando quer água.";

  it("20. citação presente na fala confere", () => {
    expect(citacaoConfere("aponta quando quer água", fala)).toBe(true);
    expect(citacaoConfere("APONTA QUANDO QUER AGUA", fala)).toBe(true);
  });

  it("21. paráfrase NÃO confere — parecença não é proveniência", () => {
    expect(citacaoConfere("usa gestos para pedir bebida", fala)).toBe(false);
  });

  it("22. citação que não existe na fala derruba o fato nos DOIS modos", () => {
    for (const modo of ["compativel", "estrito"] as const) {
      const r = avaliar([cand({ valor: "x", citacao: "ele nunca aponta" })], {
        entradaNormalizada: fala,
        modo,
      });
      expect(r.aceitos).toHaveLength(0);
      expect(r.rejeitados[0].motivo).toBe("citacao_nao_comprovada");
    }
  });

  it("23. citação minúscula demais não serve de âncora", () => {
    expect(citacaoConfere("a", fala)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("G · as quatro classes ficam separadas", () => {
  const fala = "Ele não aponta.";

  it("24. A · relato: família afirmou, persiste", () => {
    const r = avaliar([cand({ valor: "não aponta", citacao: "não aponta", inferido: false })], {
      entradaNormalizada: fala,
    });
    expect(classeDoFato(r.aceitos[0])).toBe("relato");
    expect(r.aceitos[0].procedencia.por).toBe("familia");
  });

  it("25. B · leitura: inferida MAS ancorada — persiste como `ayla`", () => {
    const r = avaliar([cand({ valor: "pouca atenção compartilhada", citacao: "não aponta", inferido: true })], {
      entradaNormalizada: fala,
    });
    expect(classeDoFato(r.aceitos[0])).toBe("leitura");
  });

  it("26. C · hipótese: inferida SEM âncora — sai do perfil, vive só no turno", () => {
    const r = avaliar([cand({ valor: "talvez tenha dificuldade sensorial", inferido: true })], {
      entradaNormalizada: fala,
    });
    expect(r.aceitos).toHaveLength(0);
    expect(r.rejeitados).toHaveLength(0);
    expect(r.hipoteses).toHaveLength(1);
  });

  it("27. D · no modo estrito, hipótese vira rejeição explícita", () => {
    const r = avaliar([cand({ valor: "talvez", inferido: true })], {
      entradaNormalizada: fala,
      modo: "estrito",
    });
    expect(r.rejeitados[0].motivo).toBe("citacao_ausente");
    expect(r.hipoteses).toHaveLength(0);
  });

  it("28. o modo estrito exige âncora até de fato relatado", () => {
    const r = avaliar([cand({ valor: "não aponta" })], {
      entradaNormalizada: fala,
      modo: "estrito",
    });
    expect(r.rejeitados[0].motivo).toBe("citacao_ausente");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("H · caso legítimo não pode ser bloqueado", () => {
  it("29. um lote inteiro de fatos comuns passa sem nenhuma rejeição", () => {
    const r = avaliar(
      [
        cand({ campo: "comunicacao", subcampo: "forma", valor: "Fala palavras soltas" }),
        cand({ campo: "comunicacao", subcampo: "mostra", valor: "aponta quando quer água" }),
        cand({ campo: "nutricional", subcampo: "rejeita", valor: "folhas" }),
        cand({ campo: "sono", subcampo: "outras", valor: "demora pra adormecer" }),
        cand({ camada: "camada2", campo: "recursos", subcampo: null, valor: "faz fono" }),
      ],
      { entradaNormalizada: "" },
    );
    expect(r.rejeitados).toEqual([]);
    expect(r.aceitos).toHaveLength(5);
  });

  it("30. modo compatível NÃO exige citação — exigir apagaria 100% dos fatos da web", () => {
    const r = avaliar([cand({ valor: "algo sem citação" })]);
    expect(r.aceitos).toHaveLength(1);
    expect(r.aceitos[0].citacao).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("I · nada de modelo dentro das guardas", () => {
  it("31. `fato.ts` não importa cliente de IA nenhum", () => {
    const src = readFileSync(resolve(__dirname, "fato.ts"), "utf8");
    for (const proibido of ["anthropic", "openai", "getAnthropicClient", "messages.stream"]) {
      expect(src.toLowerCase()).not.toContain(proibido.toLowerCase());
    }
  });

  it("32. e não carimba o tempo sozinho — `em` vem de fora, senão o teste não congela", () => {
    // ⚠️ SEM OS COMENTÁRIOS. O comentário deste arquivo diz, por extenso,
    // "nunca de `new Date()` aqui dentro" — asserção sobre o texto cru casaria
    // com a própria explicação e passaria a testar prosa, não código.
    const src = semComentarios(readFileSync(resolve(__dirname, "fato.ts"), "utf8"));
    expect(src).not.toMatch(/new Date\(\)/);
    expect(src).not.toMatch(/Date\.now\(\)/);
  });
});
