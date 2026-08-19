import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  rotulosConhecidos,
  fatosDisponiveis,
  type LinhaPerfilVivo,
} from "./experimental-contexto";
import { nivelDeEvidencia, blocoPosTrial } from "@/lib/trial/jornada";
import { posTrialAtivo } from "./experimental";

/**
 * ONDA 1 — PÓS-TRIAL, 18/08/2026.
 *
 * ⚠️ O DEFEITO QUE ORIGINOU ESTA ONDA. MEDI em produção: o gate de assinatura
 * intercepta a família expirada ANTES de qualquer caminho conversacional e faz
 * `return` em todos os ramos. Fora da janela de 12h ela recebe um texto fixo;
 * DENTRO dela, nada. Silêncio total. De 179 famílias que chegaram ao fim do
 * teste, 21 receberam qualquer coisa.
 *
 * ⚠️ O QUE ESTES TESTES PROVAM, E O QUE NÃO PROVAM. Aqui se prova a REGRA
 * determinística — o nível de evidência, o que entra no bloco, a ordem no
 * orquestrador. O que NÃO se prova aqui é que um modelo real, com conhecimento
 * próprio, não vai orientar mesmo assim. Isso é a bancada adversarial, com
 * modelo pago, e é o portão de publicação desta onda.
 */

// ── FIXTURES ──────────────────────────────────────────────────────────────
//
// ⚠️ O FORMATO É `{ texto: "..." }`, e isso não é detalhe: `textoDoCampo`
// começa devolvendo null para o que não for string nem objeto com `texto`.
// Fixture com string pura passaria no teste e mentiria sobre a produção.

const CONTEUDO_SONO = "Como adormece: acorda três vezes por noite e só volta com colo";

/** Perfil rico — 6 fatos. É o Grupo A. */
const PERFIL_A: LinhaPerfilVivo = {
  sensorial: { texto: "Reação a sons: cobre os ouvidos com barulhos altos" },
  como_e: { texto: "Adora uva passa." },
  categorias_extras: {
    sono: { texto: CONTEUDO_SONO },
    nutricional: { texto: "Aceita bem / preferidos: banana; maçã" },
    comunicacao: { texto: "Como se comunica: Fala palavras soltas" },
    rotina: { texto: "O que ajuda nas transições: avisar com 5 minutos" },
    preferencias: { temas: ["dinossauros"] },
  },
};

/** Perfil médio — 3 fatos. Grupo B. */
const PERFIL_B: LinhaPerfilVivo = {
  categorias_extras: {
    sono: { texto: "Como costuma ser o sono: Sono irregular" },
    emocional: { texto: "Como costuma ser: Desregula com facilidade" },
    foco: { texto: "Como é o foco: Foca no que gosta" },
  },
};

/** Perfil mínimo — 1 fato. É o que o onboarding deixa, e é Grupo C. */
const PERFIL_C: LinhaPerfilVivo = {
  categorias_extras: { nutricional: { texto: "Seletividade alimentar: Alta" } },
};

const PERFIL_VAZIO: LinhaPerfilVivo = { categorias_extras: {} };

// ── 1. A FLAG ─────────────────────────────────────────────────────────────

describe("1. A flag — default seguro", () => {
  it("ausente = DESLIGADO (o comportamento de hoje, byte a byte)", () => {
    delete process.env.AYLA_POS_TRIAL;
    expect(posTrialAtivo()).toBe(false);
  });

  it("só `1` e `true` ligam — erro de digitação nunca liga", () => {
    for (const v of ["", " ", "0", "sim", "yes", "on", "TRUE ", "falso"]) {
      process.env.AYLA_POS_TRIAL = v;
      expect(posTrialAtivo()).toBe(v.trim().toLowerCase() === "true");
    }
    process.env.AYLA_POS_TRIAL = "1";
    expect(posTrialAtivo()).toBe(true);
    delete process.env.AYLA_POS_TRIAL;
  });
});

// ── 2. A EVIDÊNCIA ────────────────────────────────────────────────────────

describe("2. O nível de evidência — por FATOS, nunca por mensagens", () => {
  it("os cortes são os medidos na base: C ≤1, B 2–4, A ≥5", () => {
    expect(nivelDeEvidencia(0)).toBe("C");
    expect(nivelDeEvidencia(1)).toBe("C");
    expect(nivelDeEvidencia(2)).toBe("B");
    expect(nivelDeEvidencia(4)).toBe("B");
    expect(nivelDeEvidencia(5)).toBe("A");
    expect(nivelDeEvidencia(15)).toBe("A");
  });

  it("conta o que existe no perfil", () => {
    expect(fatosDisponiveis(PERFIL_A)).toBeGreaterThanOrEqual(5);
    expect(fatosDisponiveis(PERFIL_B)).toBe(3);
    expect(fatosDisponiveis(PERFIL_C)).toBe(1);
    expect(fatosDisponiveis(PERFIL_VAZIO)).toBe(0);
    expect(fatosDisponiveis(null)).toBe(0);
  });

  it("CASO REAL: 23 mensagens e 1 fato → C, não A", () => {
    // Pietro, medido em 18/08/2026. A régua por mensagens o classificaria como
    // rico e a Ayla alegaria um conhecimento que não tem.
    expect(nivelDeEvidencia(fatosDisponiveis(PERFIL_C))).toBe("C");
  });

  it("CASO REAL: 0 mensagens e muitos fatos → A, não C", () => {
    // Noah, medido em 18/08/2026: 13 fatos vindos do onboarding, zero conversa.
    // A régua por mensagens negaria um conhecimento que existe.
    expect(nivelDeEvidencia(fatosDisponiveis(PERFIL_A))).toBe("A");
  });

  it("o placeholder não vira fato", () => {
    const lixo: LinhaPerfilVivo = { categorias_extras: { sono: { texto: "teste" } } };
    expect(fatosDisponiveis(lixo)).toBe(0);
  });
});

// ── 3. RÓTULO NUNCA VIRA CONTEÚDO ─────────────────────────────────────────

describe("3. O bloco entrega RÓTULOS, nunca o conteúdo", () => {
  it("os rótulos são os assuntos, e nenhum texto do perfil vaza", () => {
    const r = rotulosConhecidos(PERFIL_A);
    expect(r).toContain("sono");
    expect(r).toContain("alimentação");
    expect(r).toContain("comunicação");
    for (const rotulo of r) {
      expect(rotulo.length).toBeLessThan(20);
      expect(rotulo).not.toContain("acorda");
    }
  });

  it("GOLDEN: o conteúdo do sono NÃO aparece no bloco, mesmo no Grupo A", () => {
    const bloco = blocoPosTrial({
      nomeCrianca: "João",
      rotulos: rotulosConhecidos(PERFIL_A),
      fatos: fatosDisponiveis(PERFIL_A),
    });
    // É o coração desta onda: evidência suficiente para vender continuidade,
    // informação insuficiente para prestar orientação.
    expect(bloco).not.toContain(CONTEUDO_SONO);
    expect(bloco).not.toContain("acorda três vezes");
    expect(bloco).not.toContain("banana");
    expect(bloco).not.toContain("uva passa");
    // Mas o ASSUNTO está lá, e é o que sustenta a continuidade.
    expect(bloco).toContain("sono");
    expect(bloco).toContain("João");
  });

  it("o bloco proíbe explicitamente transformar rótulo em afirmação", () => {
    const bloco = blocoPosTrial({
      nomeCrianca: "João",
      rotulos: rotulosConhecidos(PERFIL_A),
      fatos: 6,
    });
    expect(bloco).toContain("ESTES SÃO OS ASSUNTOS, NÃO O CONTEÚDO");
    expect(bloco).toContain("Nunca cite assunto fora desta lista");
  });
});

// ── 4. GRUPO C NÃO FINGE CONTINUIDADE ─────────────────────────────────────

describe("4. Grupo C — não inventa conhecimento", () => {
  it("sem evidência, o bloco PROÍBE alegar conhecimento da criança", () => {
    const bloco = blocoPosTrial({ nomeCrianca: "Ana", rotulos: [], fatos: 0 });
    expect(bloco).toContain("você NÃO conhece esta criança");
    expect(bloco).toContain("nunca o que já teria construído");
  });

  it("com 1 fato ainda é C — o mínimo do onboarding não é conhecer", () => {
    const bloco = blocoPosTrial({
      nomeCrianca: "Ana",
      rotulos: rotulosConhecidos(PERFIL_C),
      fatos: fatosDisponiveis(PERFIL_C),
    });
    expect(bloco).toContain("você NÃO conhece esta criança");
  });

  it("Grupo B reconhece que ainda é pouco", () => {
    const bloco = blocoPosTrial({
      nomeCrianca: "Ana",
      rotulos: rotulosConhecidos(PERFIL_B),
      fatos: fatosDisponiveis(PERFIL_B),
    });
    expect(bloco).toContain("ainda é pouco");
    expect(bloco).not.toContain("você NÃO conhece esta criança");
  });
});

// ── 5. O QUE O BLOCO PROÍBE ───────────────────────────────────────────────

describe("5. As proibições estão escritas e são explícitas", () => {
  const bloco = blocoPosTrial({ nomeCrianca: "João", rotulos: ["sono"], fatos: 2 });

  it("proíbe orientação, estratégia, passo e artefato", () => {
    for (const proibido of ["orientação individual nova", "estratégias, passos", "montar plano, rotina"]) {
      expect(bloco).toContain(proibido);
    }
  });

  it("fecha as saídas de emergência que um pedido insistente abriria", () => {
    expect(bloco).toContain("mesmo que o pedido seja urgente");
    expect(bloco).toContain("mesmo que a família insista");
  });

  it("manda mostrar COMO a Kolo trabalharia, e não o que fazer", () => {
    expect(bloco).toContain("mostre COMO a Kolo trabalharia");
    expect(bloco).toContain("NÃO diga o que fazer");
  });

  it("crise tem precedência sobre o comercial", () => {
    expect(bloco).toContain("acolha primeiro");
  });

  it("objeções: uma pergunta por vez, e 'quero assinar' encerra o argumento", () => {
    expect(bloco).toContain("uma pergunta por vez");
    expect(bloco).toContain("PARE de argumentar");
  });
});

// ── 6. A ORDEM NO ORQUESTRADOR ────────────────────────────────────────────
//
// ⚠️ ESTRUTURAL DE PROPÓSITO, e o limite é conhecido: a ordem de blocos dentro
// de uma função de 4.000 linhas não é observável por execução sem subir Z-API,
// Stripe e modelo falsos. O que regride aqui é a ORDEM — e é ela que se prende.

const ORQ = readFileSync(join(process.cwd(), "src/lib/ayla/orchestrator.ts"), "utf8");
const pos = (s: string) => {
  const i = ORQ.indexOf(s);
  return i === -1 ? Number.POSITIVE_INFINITY : i;
};

describe("6. O orquestrador — ordem e ausência de vazamento", () => {
  const GATE = "// 2b. ASSINATURA (GATE)";
  const SEGURANCA = "const emRisco =";
  const POS_TRIAL = "if (posTrialAtivo() && ctxA) {";
  const CONVITE_FIXO = "// COOLDOWN REAL: um convite por família a cada 12h.";

  it("o modo pós-Trial existe UMA vez só", () => {
    expect(ORQ.split(POS_TRIAL).length - 1).toBe(1);
  });

  it("vem DEPOIS da segurança — crise nunca vira conversa comercial", () => {
    expect(pos(SEGURANCA)).toBeLessThan(pos(POS_TRIAL));
  });

  it("vem DENTRO do gate de assinatura — quem tem acesso não entra", () => {
    expect(pos(GATE)).toBeLessThan(pos(POS_TRIAL));
  });

  it("vem ANTES do convite fixo, que continua sendo o caminho de flag desligada", () => {
    expect(pos(POS_TRIAL)).toBeLessThan(pos(CONVITE_FIXO));
  });

  it("NÃO chama a ponte do Plano — o artefato não vaza", () => {
    const bloco = ORQ.slice(pos(POS_TRIAL), pos(CONVITE_FIXO));
    expect(bloco).not.toContain("ponteDePlano");
    expect(bloco).not.toContain("montarPonteWhatsApp");
  });

  it("passa `modo: \"pos_trial\"` — sem isso o turno viria com o contexto inteiro", () => {
    const bloco = ORQ.slice(pos(POS_TRIAL), pos(CONVITE_FIXO));
    expect(bloco).toContain('modo: "pos_trial"');
  });

  it("o cooldown governa o LINK, não a resposta", () => {
    const bloco = ORQ.slice(pos(POS_TRIAL), pos(CONVITE_FIXO));
    // A reserva decide `link`, e o texto da Ayla é enviado com ou sem ele.
    expect(bloco).toContain("const podeLink = await reservarConviteAssinatura");
    // O texto da Ayla existe com OU sem link: o ternário escolhe o sufixo,
    // nunca se responde.
    expect(bloco).toContain("const texto = link");
    expect(bloco).toContain(": exp.texto;");
    // E não existe um `return` mudo entre a reserva e o envio.
    const antesDoEnvio = bloco.slice(0, bloco.indexOf("enviarEPersistir("));
    expect(antesDoEnvio).not.toContain("return { tratada: true, familia: family.id };");
  });

  it("turno sem link NÃO é marcado como assinatura_nudge — senão consome a janela", () => {
    const bloco = ORQ.slice(pos(POS_TRIAL), pos(CONVITE_FIXO));
    expect(bloco).toContain('tipo: link ? "assinatura_nudge" : "pos_trial"');
  });
});

// ── 7. O MODO NÃO RECUPERA REPERTÓRIO ─────────────────────────────────────

const EXP = readFileSync(join(process.cwd(), "src/lib/ayla/experimental.ts"), "utf8");

// ── 8. A FLAG É OBSERVÁVEL, E NÃO DERRUBA O HEALTH ────────────────────────

const HEALTH = readFileSync(join(process.cwd(), "src/app/api/health/route.ts"), "utf8");

describe("8. /api/health expõe a flag sem quebrar o health", () => {
  it("a flag aparece na resposta", () => {
    expect(HEALTH).toContain("ayla_pos_trial: posTrialAtivo()");
    expect(HEALTH).toContain("flags,");
  });

  it("MORDE: as flags ficam FORA de `env` — senão flag off = health 503", () => {
    // ⚠️ Defeito real, pego na releitura antes de publicar: `allEnvOk` faz
    // `every(Boolean)` sobre `env`. Uma flag desligada é `false`, e o health
    // passaria a devolver 503 no estado padrão e saudável do produto.
    const iEnv = HEALTH.indexOf("const env = {");
    const iFimEnv = HEALTH.indexOf("};", iEnv);
    const blocoEnv = HEALTH.slice(iEnv, iFimEnv);
    expect(blocoEnv).not.toContain("posTrialAtivo");
    expect(blocoEnv).not.toContain("experimentalParaTodas");
    // E `allEnvOk` continua lendo só `env`.
    expect(HEALTH).toContain("Object.values(env).every(Boolean)");
  });
});

describe("7. O modo desliga os produtores", () => {
  it("pós-Trial zera as skills — a consulta de Boas Práticas nem acontece", () => {
    expect(EXP).toContain("const skillsDoTurno = posTrial ? [] : (params.turnoClassificado?.skills ?? [])");
  });

  it("pós-Trial não injeta a jornada do teste (tem bloco próprio)", () => {
    expect(EXP).toContain('const semJornada = params.origem === "simulador" || posTrial');
  });

  it("o rastro do modo vai para a métrica — é o que prova produção", () => {
    expect(EXP).toContain("pos_trial_nivel");
    expect(EXP).toContain("pos_trial_fatos");
  });
});

// ── 9. O LINK NÃO SE REPETE ───────────────────────────────────────────────

describe("9. Turno sem link proíbe repetir o que está no histórico", () => {
  it("com link disponível, nenhuma proibição entra", () => {
    const b = blocoPosTrial({ nomeCrianca: "Téo", rotulos: ["sono"], fatos: 3, podeOferecerLink: true });
    expect(b).not.toContain("LINK DE ASSINATURA JÁ FOI ENVIADO");
  });

  it("SEM link, o bloco proíbe reproduzir o da conversa recente", () => {
    // ⚠️ Provado em produção 19/08: o cooldown segurou a GERAÇÃO (tipo veio
    // `pos_trial`, não `assinatura_nudge`), e o modelo copiou o link da
    // mensagem anterior nas três respostas. Segurar o link não segura o texto.
    const b = blocoPosTrial({ nomeCrianca: "Téo", rotulos: ["sono"], fatos: 3, podeOferecerLink: false });
    expect(b).toContain("LINK DE ASSINATURA JÁ FOI ENVIADO");
    expect(b).toContain("NÃO reproduza");
    expect(b).toContain("nem escreva o endereço por extenso");
  });

  it("default preserva o comportamento de quem não passa o parâmetro", () => {
    const b = blocoPosTrial({ nomeCrianca: "Téo", rotulos: ["sono"], fatos: 3 });
    expect(b).not.toContain("LINK DE ASSINATURA JÁ FOI ENVIADO");
  });

  it("o orquestrador informa o bloco sobre o link deste turno", () => {
    expect(ORQ).toContain("linkDisponivel: Boolean(link)");
  });
});
