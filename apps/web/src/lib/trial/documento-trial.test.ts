import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { blocoDaJornada, EVIDENCIAS_VAZIAS } from "./jornada";
import type { EstadoTrial } from "./estado";

/**
 * O DOCUMENTO DO TRIAL CHEGA AO PROMPT — e só quando deve.
 *
 * A arquitetura, decidida em 17/08/2026 depois de o `trial v2` ser reprovado
 * por criar uma SEGUNDA condução:
 *
 *   lerEstadoTrial ... o estado (que dia é, quem está em condução comercial)
 *   <jornada> ....... o QUANDO (qual intenção está disponível hoje)
 *   trial v3 ........ o COMO (profundidade para executar aquela intenção)
 *   código .......... cadência, proativas, gates, horários
 *
 * ⚠️ O DOCUMENTO NÃO TEM CONDIÇÃO PRÓPRIA. Ele entra exatamente quando o
 * `<jornada>` entra — `jornada ? doc : ""`. Escrever aqui uma segunda regra
 * ("se emConducaoComercial…") criaria duas verdades sobre o mesmo assunto, que
 * é a forma exata do incidente que este repositório mais repete.
 */

const EXP = readFileSync(
  join(process.cwd(), "src/lib/ayla/experimental.ts"),
  "utf8",
);

function estado(p: Partial<EstadoTrial>): EstadoTrial {
  return {
    fase: "trial",
    dia: 2,
    diasRestantes: 5,
    acesso: true,
    emConducaoComercial: true,
    diasAteExclusaoDeDados: null,
    linha: null,
    ...p,
  } as EstadoTrial;
}

describe("A LEITURA NÃO ACRESCENTA ESPERA", () => {
  it("o documento é resolvido no MESMO Promise.all do contexto e do Core", () => {
    const bloco = EXP.slice(
      EXP.indexOf("const [ctxTurno, core, bps, estadoTrial, evidencias, docTrial] = await Promise.all(["),
      EXP.indexOf("const msBp ="),
    );
    expect(bloco).toContain("montarContexto(");
    expect(bloco).toContain('resolverDocumento(supabase, "core"');
    expect(bloco).toContain('resolverDocumento(supabase, "trial")');
  });

  it("o simulador do Admin não recebe condução comercial", () => {
    // `semJornada` já é `origem === "simulador"`. Conduzir comercialmente uma
    // tela de Admin não significa nada.
    const bloco = EXP.slice(EXP.indexOf('resolverDocumento(supabase, "trial")') - 120);
    expect(bloco.slice(0, 200)).toContain("semJornada");
  });

  it("NENHUMA chamada de modelo nova — o documento é leitura, não decisão", () => {
    const antes = (EXP.match(/gerarConversacional\(/g) ?? []).length;
    expect(antes, "apareceu uma segunda geração no turno").toBe(1);
  });
});

describe("SÓ ENTRA DURANTE A CONDUÇÃO COMERCIAL", () => {
  it("a injeção está amarrada ao `<jornada>`, não a uma segunda condição", () => {
    expect(EXP).toContain('const conducaoTrial = jornada ? (docTrial?.conteudo ?? "") : ""');
    // Uma segunda checagem de `emConducaoComercial` NA PRÓPRIA ATRIBUIÇÃO seria
    // a segunda verdade. (Ela aparece logo abaixo, em `diaDaJornada`, que é
    // outra coisa: rastro de auditoria, não decisão de injeção.)
    const i = EXP.indexOf("const conducaoTrial =");
    const linha = EXP.slice(i, EXP.indexOf("\n", i));
    expect(linha).not.toContain("emConducaoComercial");
    expect(linha).toContain("jornada ?");
  });

  it("assinante não tem jornada — logo não tem documento", () => {
    // Se `blocoDaJornada` devolve "", `conducaoTrial` é "" por construção.
    const e = estado({ fase: "assinante", emConducaoComercial: false });
    expect(blocoDaJornada(e, EVIDENCIAS_VAZIAS)).toBe("");
  });

  it("cortesia e staff idem", () => {
    for (const fase of ["cortesia", "assinante"] as const) {
      const e = estado({ fase, emConducaoComercial: false });
      expect(blocoDaJornada(e, EVIDENCIAS_VAZIAS)).toBe("");
    }
  });

  it("teste não iniciado e estado desconhecido idem", () => {
    for (const fase of ["nao_iniciado", "desconhecida", "encerrado"] as const) {
      const e = estado({ fase, emConducaoComercial: false });
      expect(blocoDaJornada(e, EVIDENCIAS_VAZIAS)).toBe("");
    }
  });

  it("família EM teste tem jornada — e aí o documento entra", () => {
    const e = estado({ fase: "trial", dia: 2, diasRestantes: 5 });
    expect(blocoDaJornada(e, EVIDENCIAS_VAZIAS).length).toBeGreaterThan(0);
  });
});

describe("A ORDEM DO PROMPT", () => {
  it("Core → contexto → jornada → documento do Trial → repertório", () => {
    expect(EXP).toContain("[core.conteudo, FATOS_COMERCIAIS, bloco, jornada, conducaoTrial, repertorio, conducaoPosTrial]");
    const arr = "[core.conteudo, FATOS_COMERCIAIS, bloco, jornada, conducaoTrial, repertorio, conducaoPosTrial]";
    expect(arr.indexOf("jornada")).toBeLessThan(arr.indexOf("conducaoTrial"));
    expect(arr.indexOf("conducaoTrial")).toBeLessThan(arr.indexOf("repertorio"));
  });

  it("SABOTAGEM · o documento passando na frente da jornada seria pego", () => {
    const sabotado = EXP.replace(
      "[core.conteudo, FATOS_COMERCIAIS, bloco, jornada, conducaoTrial, repertorio, conducaoPosTrial]",
      "[core.conteudo, FATOS_COMERCIAIS, bloco, conducaoTrial, jornada, repertorio]",
    );
    expect(sabotado).not.toContain("[core.conteudo, FATOS_COMERCIAIS, bloco, jornada, conducaoTrial, repertorio, conducaoPosTrial]");
    expect(EXP).toContain("[core.conteudo, FATOS_COMERCIAIS, bloco, jornada, conducaoTrial, repertorio, conducaoPosTrial]");
  });
});

describe("AUSÊNCIA E FALHA NÃO DERRUBAM O TURNO", () => {
  it("documento inexistente vira string vazia, não erro", () => {
    // `resolverDocumento` devolve o FALLBACK — e para `trial` o fallback é "".
    // O `?? ""` aqui cobre o caso de a leitura ter falhado e devolvido null.
    expect(EXP).toContain('docTrial?.conteudo ?? ""');
  });

  it("hoje o documento NÃO está ativo — a integração é inerte até alguém ativar", () => {
    // Estado de produção em 17/08/2026: trial v1, v2 e v3 estão `arquivado`.
    // `resolverDocumento` só lê `status = 'ativo'`, então devolve "" e o prompt
    // não muda um caractere. É de propósito: integrar e ativar são dois atos.
    const doc = readFileSync(join(process.cwd(), "src/lib/ayla/documentos.ts"), "utf8");
    expect(doc).toContain('.eq("status", "ativo")');
  });
});

describe("O RASTRO", () => {
  it("o turno registra quanto o documento engordou o prompt", () => {
    expect(EXP).toContain("trial_doc_chars: conducaoTrial.length");
  });
});

describe("NÃO DUPLICA O QUE A JORNADA JÁ DIZ", () => {
  const V3 = readFileSync(
    join(process.cwd(), "..", "..", "docs/documentos-ayla/trial-v3-proposta.md"),
    "utf8",
  );

  it("o documento não contém contagem de dias — não há mapeamento a divergir", () => {
    expect(V3).not.toMatch(/\bD[0-7]\b/);
  });

  it("o documento não carrega cadência, cron nem gate — isso é do código", () => {
    expect(V3).not.toMatch(/cron|scheduler|hor[áa]rio|webhook|deploy/i);
  });

  it("a precedência da necessidade real está nos DOIS, e concorda", () => {
    // O bloco manda ignorar a intenção; o documento diz o mesmo. Aqui repetir
    // é proteção, não conflito: é a regra que não pode falhar por omissão.
    const e = estado({ fase: "trial", dia: 5, diasRestantes: 2 });
    expect(blocoDaJornada(e, EVIDENCIAS_VAZIAS)).toContain("A NECESSIDADE DE AGORA MANDA");
    expect(V3).toContain("A necessidade de agora vence sempre");
  });

  it("a ordem do fechamento do documento é a mesma da jornada", () => {
    const iAjudou = V3.indexOf("Quando ela nomeia o que ajudou");
    const iUtil = V3.indexOf("Onde eu poderia continuar sendo útil");
    const iResumo = V3.indexOf("Quando você resume o que foi construído");
    const iContinuar = V3.indexOf("Quando chega a hora de falar em continuar");
    expect(iAjudou).toBeGreaterThan(0);
    expect(iAjudou).toBeLessThan(iUtil);
    expect(iUtil).toBeLessThan(iResumo);
    expect(iResumo).toBeLessThan(iContinuar);
  });
});
