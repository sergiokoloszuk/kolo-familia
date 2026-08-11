/**
 * FATIA 3b · CAMADA 2 — O PLANO COMO DOCUMENTO, E O CASO DE CONTRASTE.
 *
 * Duas perguntas que a camada 1 não alcança, porque ela olha UMA seção:
 *
 *   A) O plano inteiro ficou mais repetitivo com o contexto rico? A 3b manda o
 *      MESMO material para as oito seções; se cada uma resolver usar tudo, o
 *      documento vira sete vezes a mesma ideia. Aqui só se MEDE — corrigir é
 *      Fatia 4 / PEND-031, e acrescentar instrução anti-repetição agora seria
 *      exatamente o reflexo que esta frente existe para desfazer.
 *
 *   B) COMPETÊNCIA PRESERVADA. A mãe diz "ele não consegue focar" e o perfil
 *      registra, em texto, que a criança sustenta atenção por muito tempo numa
 *      atividade específica. O plano percebe que a capacidade existe em ALGUM
 *      contexto, ou trata como incapacidade global e despeja técnicas de foco?
 *      Nenhuma regra nova foi escrita para forçar o acerto — é teste, não
 *      implementação.
 *
 * ⚠️ AQUI O PIPELINE É O REAL E INTEIRO: `gerarSecoesPlanoMultiCall`, com as
 * oito chamadas, os output types reais do banco, as retentativas e o guard das
 * práticas. Isso significa CLAUDE (`MODELS.principal`, com thinking) — a
 * migração para o GPT alcançou a conversa, não o Plano. É por isso que a camada
 * 1 ficou no GPT: o ANTES salvo é GPT, e trocar o modelo no meio tornaria a
 * comparação sem sentido.
 *
 * Os DOIS braços usam a MESMA família do piloto; o que muda entre eles é uma
 * variável só: `KOLO_PILOTO_4A` em `off` ou `teste`.
 *
 * 2 planos × ~9 chamadas + 2 contrastes + 4 juízos ≈ 24 chamadas.
 *
 *   node scripts/bancada/piloto-4a/fatia3b-camada2.mjs
 */
import { mod, FAMILIA_PILOTO, linha, caixa } from "./comum.mjs";
import { writeFileSync } from "node:fs";

const U = process.env.NEXT_PUBLIC_SUPABASE_URL;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { gerarSecoesPlanoMultiCall } = await mod("lib/ia/plano.ts");
const { respondAsOutputType, montarContextoDeSecoes } = await mod("lib/ia/engine.ts");
const { gerarConversacional, MODELO_CONVERSA } = await mod("lib/ia/provider.ts");
const JUIZ = MODELO_CONVERSA.openai;

const out = [];
const w = (s) => { out.push(s); console.log(s); };

const gravado = (t) => ({ texto: t, atualizado_em: "2026-08-01T00:00:00Z" });

const SKILLS = [
  {
    id: "s1", ativo: true, name: "socializacao", display_name: "Socialização",
    objective: "apoiar a criança nas interações com outras pessoas",
    tone: "próximo, prático", scope: "socialização, comunicação social",
    limits: "não diagnostica",
    kolo_vivo_fields: ["essencial", "socializacao"], knowledge_tags: ["socializacao"],
    routing_keywords: [], routing_priority: 1, fallback_questions: [],
  },
];

// ── AS DUAS CRIANÇAS ─────────────────────────────────────────────────────
const BIA = {
  id: "cccccccc-4a4a-4a4a-4a4a-000000000003",
  nome: "Bia", genero: "feminino",
  desafio:
    "Bia quase não fala com as crianças da escola. Quero ajudar ela a iniciar e " +
    "sustentar pequenas interações sociais com outras pessoas.",
  perfil: {
    essencial: gravado("Bia, 5 anos. INTERESSES: brincar de mercadinho, caixa registradora, organizar as coisas."),
    // O NEGATIVO explícito, na coluna própria: som e luz não são questão.
    sensorial: gravado("Perfil sensorial: Misto\nReação a sons: não\nLuz: não\nTexturas (roupas, objetos): Evita etiquetas."),
    categorias_extras: {
      socializacao: gravado("Iniciativa e reciprocidade: Fala com adultos conhecidos. Com crianças da idade dela, fica em silêncio."),
      comunicacao: gravado("Como se comunica: Fala frases\nConversa e argumentação: Mantém o vai-e-vem com adulto conhecido."),
    },
  },
};

// ── O CASO DE CONTRASTE ──────────────────────────────────────────────────
//
// A queixa é global ("não consegue focar"); o perfil desmente a globalidade.
// A evidência está em TEXTO LIVRE, não num campo chamado "atenção" — é assim
// que ela chega na vida real.
const TITO = {
  id: "cccccccc-4a4a-4a4a-4a4a-000000000009",
  nome: "Tito", genero: "masculino",
  desafio: "Ele não consegue focar.",
  perfil: {
    essencial: gravado(
      "Tito, 7 anos. INTERESSES: montar LEGO. Fica duas horas seguidas montando " +
      "LEGO sem levantar, e termina o modelo inteiro numa sentada. Também assiste " +
      "documentário de dinossauro do começo ao fim.",
    ),
    categorias_extras: {
      foco: gravado(
        "Como é o foco: na lição de casa desiste em cinco minutos e larga o lápis.\n" +
        "O que ajuda: quando é coisa que ele escolheu, não precisa de nada — sustenta sozinho.",
      ),
    },
  },
};

// ── O BANCO ──────────────────────────────────────────────────────────────
let OUTPUT_TYPES = [];

function tabelas(crianca) {
  return {
    specialist_prompt_templates: SKILLS,
    output_types: OUTPUT_TYPES,
    membros_atipicos: [{
      id: crianca.id, family_account_id: FAMILIA_PILOTO, nome: crianca.nome,
      data_nascimento: crianca.nome === "Tito" ? "2019-03-01" : "2021-03-01",
      perfil: "TEA", genero: crianca.genero, diagnosticos_formais: null,
      ativo: true, created_at: "2026-01-01T00:00:00Z",
    }],
    perfil_vivo_membro: [{
      membro_atipico_id: crianca.id, family_account_id: FAMILIA_PILOTO, ...crianca.perfil,
    }],
    perfil_vivo_familia: [], diarios: [], check_ins_diarios: [], mensagens_skill: [],
    planos: [],
    family_profiles: [{
      family_account_id: FAMILIA_PILOTO, nome_mae: "Ana", como_chamar: "Ana",
      papel: "mae", papel_outro: null, genero_responsavel: "feminino",
    }],
  };
}

function bancoFalso(crianca) {
  const T = tabelas(crianca);
  const proibido = (n) => () => { throw new Error(`BANCADA: ${n} bloqueado`); };
  return {
    from(tabela) {
      const filtros = []; const remoto = []; let colunas = "*"; let limite = null;
      const q = {
        select(c) { colunas = c; return q; },
        eq(c, v) { filtros.push([c, v]); remoto.push(`${c}=eq.${encodeURIComponent(v)}`); return q; },
        in(c, v) { filtros.push([c, v, "in"]); remoto.push(`${c}=in.(${v.map(encodeURIComponent).join(",")})`); return q; },
        or(e) { remoto.push(`or=(${e})`); return q; },
        order(c, o) { remoto.push(`order=${c}.${o?.ascending === false ? "desc" : "asc"}`); return q; },
        limit(n) { limite = n; remoto.push(`limit=${n}`); return q; },
        lte(c, v) { remoto.push(`${c}=lte.${v}`); return q; },
        gte(c, v) { remoto.push(`${c}=gte.${v}`); return q; },
        is(c, v) { remoto.push(`${c}=is.${v}`); return q; },
        not(c, o, v) { remoto.push(`${c}=not.${o}.${v}`); return q; },
        insert: proibido("insert"), update: proibido("update"),
        upsert: proibido("upsert"), delete: proibido("delete"),
        maybeSingle() { return q.then((r) => ({ data: r.data[0] ?? null, error: null })); },
        single() { return q.then((r) => ({ data: r.data[0] ?? null, error: null })); },
        then(res, rej) {
          if (tabela === "boas_praticas") {
            const url = `${U}/rest/v1/boas_praticas?select=${encodeURIComponent(colunas)}${remoto.length ? "&" + remoto.join("&") : ""}`;
            return fetch(url, { headers: { apikey: K, Authorization: `Bearer ${K}`, Range: "0-9999" } })
              .then((r) => r.json())
              .then((d) => ({ data: Array.isArray(d) ? d : [], error: Array.isArray(d) ? null : d }))
              .then(res, rej);
          }
          let l = T[tabela] ?? [];
          for (const [c, v, op] of filtros) {
            l = op === "in" ? l.filter((r) => v.includes(r[c])) : l.filter((r) => r[c] === v);
          }
          if (limite != null) l = l.slice(0, limite);
          return Promise.resolve({ data: l, error: null }).then(res, rej);
        },
      };
      return q;
    },
  };
}

// Os output types REAIS — a redação de cada seção é metade do resultado.
OUTPUT_TYPES = await fetch(
  `${U}/rest/v1/output_types?select=key,label,prompt_template,ativo&ativo=eq.true`,
  { headers: { apikey: K, Authorization: `Bearer ${K}` } },
).then((r) => r.json());
w(`output types carregados: ${OUTPUT_TYPES.map((o) => o.key).join(", ")}`);

const ligar = (on) => {
  process.env.KOLO_PILOTO_4A = on ? "teste" : "off";
  process.env.KOLO_PILOTO_4A_FAMILIAS = FAMILIA_PILOTO;
};

// ── A · O PLANO COMPLETO DA BIA, NOS DOIS BRAÇOS ─────────────────────────
const planos = {};
for (const [braco, on] of [["ANTES", false], ["DEPOIS", true]]) {
  ligar(on);
  const t0 = Date.now();
  const p = await gerarSecoesPlanoMultiCall({
    supabase: bancoFalso(BIA),
    familyId: FAMILIA_PILOTO,
    membroAtipicoId: BIA.id,
    desafio: BIA.desafio,
  });
  planos[braco] = { ...p, ms: Date.now() - t0 };
  const ch = p.secoes.reduce((a, s) => a + s.conteudo_markdown.length, 0);
  w(`\n${linha()}\nPLANO ${braco} · "${p.titulo}" · ${p.secoes.length} seções · ${ch} ch · ${((Date.now() - t0) / 1000).toFixed(1)}s\n${linha()}`);
  for (const s of p.secoes) {
    w(`\n### ${s.tipo}${s.titulo ? ` — ${s.titulo}` : ""} (${s.conteudo_markdown.length} ch)\n`);
    w(caixa(s.conteudo_markdown));
  }
}

// ── B · O CASO DE CONTRASTE, NOS DOIS BRAÇOS ─────────────────────────────
//
// Uma seção só, e a mais reveladora: "o que fazer diferente". Se o plano
// tratasse a queixa como incapacidade global, é aqui que as técnicas genéricas
// de foco apareceriam.
const OT_DIFERENTE = OUTPUT_TYPES.find((o) => o.key === "estrategias") ?? OUTPUT_TYPES[0];
const contrastes = {};
for (const [braco, on] of [["ANTES", false], ["DEPOIS", true]]) {
  ligar(on);
  const contextoPronto = await montarContextoDeSecoes(bancoFalso(TITO), {
    familyId: FAMILIA_PILOTO, membroAtipicoId: TITO.id, pedido: TITO.desafio,
  });
  const r = await respondAsOutputType({
    supabase: bancoFalso(TITO),
    familyId: FAMILIA_PILOTO,
    membroAtipicoId: TITO.id,
    outputType: OT_DIFERENTE,
    pedido: TITO.desafio,
    contextoPronto,
  });
  contrastes[braco] = r.texto.trim();
  w(`\n${linha()}\nCONTRASTE ${braco} · "${TITO.desafio}" · ${r.texto.trim().length} ch\n`);
  w(caixa(r.texto.trim()));
}

// ── OS JUÍZOS ────────────────────────────────────────────────────────────
const SYS_DOC = `Você avalia um PLANO inteiro — um documento de várias seções escrito para a mãe de uma criança neurodivergente. Julgue só este documento; você não conhece nenhum outro e não deve comparar com nada.

Sua tarefa é medir REPETIÇÃO e COERÊNCIA SEMÂNTICAS. Redação diferente para a mesma ideia CONTA como repetição.

Responda EXATAMENTE neste formato:

IDEIAS_REPETIDAS: <número> — <liste cada ideia que aparece em mais de uma seção, dizendo em quais>
ATIVIDADE_DUPLICADA: <número> — <a mesma brincadeira/atividade reaparecendo como estratégia, frase ou rotina com outra redação; liste>
EXPLICACAO_REPETIDA: <número> — <a mesma explicação sobre a criança ou sobre o problema, redita em outra seção>
CONTRADICOES: <número> — <liste; ou "nenhuma">
SECOES_QUE_NAO_ACRESCENTAM: <liste os títulos das seções cujo conteúdo já estava dito em outra, ou "nenhuma">
CADA_SECAO_ACRESCENTA: SIM|NAO
CONJUNTO_COERENTE: CONJUNTO_COERENTE|RESPOSTAS_INDEPENDENTES — <o documento parece um plano só, ou várias respostas soltas para a mesma pergunta?>
PERSONALIZACAO: DECORATIVA|FUNCIONAL|AUSENTE — <"decorativa" = o interesse da criança aparece como tema (nome, cenário, personagem) mas a MECÂNICA da intervenção seria a mesma para outra criança; "funcional" = o modo de funcionar mudou por causa do que se sabe desta criança>
EVIDENCIA_PERSONALIZACAO: <a passagem que sustenta a classificação acima>
NIVEL_RESPEITADO: SIM|NAO — o documento respeita o que o perfil afirma que a criança já faz?
NEGATIVO_DESRESPEITADO: SIM|NAO|NAO_HA — apoia-se em algo que a família já disse que NÃO é o caso?
UTIL_PARA_A_MAE: 1|2|3|4|5 — <e por quê, em uma frase>
VEREDITO: PASS_FORTE|PASS_PARCIAL|FAIL — <uma frase>

Rigoroso. Na dúvida, escolha a classificação mais severa.`;

const juizosDoc = {};
for (const braco of ["ANTES", "DEPOIS"]) {
  const p = planos[braco];
  const doc = p.secoes
    .map((s) => `## ${s.titulo || s.tipo}\n${s.conteudo_markdown}`)
    .join("\n\n");
  const user =
    `PERFIL DA CRIANÇA (o que se sabe):\n${BIA.perfil.essencial.texto}\n` +
    `${BIA.perfil.categorias_extras.socializacao.texto}\n${BIA.perfil.categorias_extras.comunicacao.texto}\n` +
    `${BIA.perfil.sensorial.texto}\n\nO QUE A MÃE PEDIU: "${BIA.desafio}"\n\n` +
    `PLANO A AVALIAR:\n"""\n${doc}\n"""`;
  const j = await gerarConversacional({
    provider: "openai", model: JUIZ, system: SYS_DOC,
    messages: [{ role: "user", content: user }], maxTokens: 2500, cacheSystem: true,
  });
  juizosDoc[braco] = j.texto.trim();
  w(`\n${linha()}\nJUÍZO DO DOCUMENTO · ${braco}\n`);
  w(caixa(j.texto.trim()));
}

const SYS_CONTRASTE = `Uma mãe disse "Ele não consegue focar". O perfil da criança registra que ela sustenta atenção por muito tempo em atividades que ela mesma escolhe — duas horas montando LEGO, um documentário inteiro — e desiste em cinco minutos na lição de casa.

Você recebe UMA proposta de intervenção. Julgue só esta; não conhece nenhuma outra.

Responda EXATAMENTE neste formato:

RECONHECE_A_CAPACIDADE: SIM|NAO — a proposta reconhece, explicitamente, que a atenção EXISTE em algum contexto?
CITA_A_EVIDENCIA: SIM|NAO — <cita o LEGO, o documentário ou "o que ele escolhe"? qual passagem?>
TRATA_COMO_INCAPACIDADE_GLOBAL: SIM|NAO — trata "não consegue focar" como um déficit geral da criança?
USA_A_CAPACIDADE_COMO_ALAVANCA: SIM|NAO — <a proposta parte do que já funciona para chegar onde não funciona? como?>
TECNICAS_GENERICAS: <liste as técnicas de "aumentar foco" que serviriam para qualquer criança — timer, dividir em partes, pausas, ambiente sem distração… — ou "nenhuma">
PROPORCAO: <quanto do texto é genérico e quanto é desta criança>
VEREDITO: PASS|FAIL — PASS exige RECONHECE_A_CAPACIDADE = SIM **e** TRATA_COMO_INCAPACIDADE_GLOBAL = NAO. <uma frase>`;

const juizosContraste = {};
for (const braco of ["ANTES", "DEPOIS"]) {
  const j = await gerarConversacional({
    provider: "openai", model: JUIZ, system: SYS_CONTRASTE,
    messages: [{ role: "user", content: `PROPOSTA:\n"""\n${contrastes[braco]}\n"""` }],
    maxTokens: 1500, cacheSystem: true,
  });
  juizosContraste[braco] = j.texto.trim();
  w(`\n${linha()}\nJUÍZO DO CONTRASTE · ${braco}\n`);
  w(caixa(j.texto.trim()));
}

// ── PLACAR ───────────────────────────────────────────────────────────────
const campo = (t, k) => (t.match(new RegExp(`^${k}:\\s*([^\\n]*)`, "m")) ?? [])[1]?.trim() ?? "?";
const num = (t, k) => parseInt((campo(t, k).match(/^\d+/) ?? ["0"])[0], 10);

w(`\n${linha()}\nPLACAR — CAMADA 2\n${linha()}`);
w(`\nO PLANO COMO DOCUMENTO (Bia)`);
w("  " + "medida".padEnd(38) + "ANTES".padEnd(28) + "DEPOIS");
const linhas = [
  ["seções geradas", planos.ANTES.secoes.length, planos.DEPOIS.secoes.length],
  ["caracteres do documento",
    planos.ANTES.secoes.reduce((a, s) => a + s.conteudo_markdown.length, 0),
    planos.DEPOIS.secoes.reduce((a, s) => a + s.conteudo_markdown.length, 0)],
  ["latência (s)", (planos.ANTES.ms / 1000).toFixed(1), (planos.DEPOIS.ms / 1000).toFixed(1)],
  ["ideias repetidas", num(juizosDoc.ANTES, "IDEIAS_REPETIDAS"), num(juizosDoc.DEPOIS, "IDEIAS_REPETIDAS")],
  ["atividade duplicada", num(juizosDoc.ANTES, "ATIVIDADE_DUPLICADA"), num(juizosDoc.DEPOIS, "ATIVIDADE_DUPLICADA")],
  ["explicação repetida", num(juizosDoc.ANTES, "EXPLICACAO_REPETIDA"), num(juizosDoc.DEPOIS, "EXPLICACAO_REPETIDA")],
  ["contradições", num(juizosDoc.ANTES, "CONTRADICOES"), num(juizosDoc.DEPOIS, "CONTRADICOES")],
  ["cada seção acrescenta", campo(juizosDoc.ANTES, "CADA_SECAO_ACRESCENTA"), campo(juizosDoc.DEPOIS, "CADA_SECAO_ACRESCENTA")],
  ["conjunto", campo(juizosDoc.ANTES, "CONJUNTO_COERENTE"), campo(juizosDoc.DEPOIS, "CONJUNTO_COERENTE")],
  ["personalização", campo(juizosDoc.ANTES, "PERSONALIZACAO"), campo(juizosDoc.DEPOIS, "PERSONALIZACAO")],
  ["nível respeitado", campo(juizosDoc.ANTES, "NIVEL_RESPEITADO"), campo(juizosDoc.DEPOIS, "NIVEL_RESPEITADO")],
  ["negativo desrespeitado", campo(juizosDoc.ANTES, "NEGATIVO_DESRESPEITADO"), campo(juizosDoc.DEPOIS, "NEGATIVO_DESRESPEITADO")],
  ["útil para a mãe (1-5)", campo(juizosDoc.ANTES, "UTIL_PARA_A_MAE"), campo(juizosDoc.DEPOIS, "UTIL_PARA_A_MAE")],
  ["veredito", campo(juizosDoc.ANTES, "VEREDITO"), campo(juizosDoc.DEPOIS, "VEREDITO")],
];
for (const [n, a, d] of linhas) {
  w("  " + String(n).padEnd(38) + String(a).slice(0, 26).padEnd(28) + String(d).slice(0, 40));
}

w(`\nCONTRASTE — "Ele não consegue focar" (Tito)`);
w("  " + "medida".padEnd(38) + "ANTES".padEnd(28) + "DEPOIS");
for (const k of ["RECONHECE_A_CAPACIDADE", "CITA_A_EVIDENCIA", "TRATA_COMO_INCAPACIDADE_GLOBAL",
                 "USA_A_CAPACIDADE_COMO_ALAVANCA", "VEREDITO"]) {
  w("  " + k.padEnd(38) +
    campo(juizosContraste.ANTES, k).slice(0, 26).padEnd(28) +
    campo(juizosContraste.DEPOIS, k).slice(0, 40));
}
w(`\n${linha()}`);

writeFileSync("docs/bancada/fatia3b-camada2-2026-08-11.txt", out.join("\n"), "utf8");
console.log("\npronto → docs/bancada/fatia3b-camada2-2026-08-11.txt");
