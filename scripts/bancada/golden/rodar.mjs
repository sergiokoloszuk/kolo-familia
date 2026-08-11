/**
 * PEND-039 · A BANCADA PERMANENTE — quatro casos, um juízo semântico cada.
 *
 * O que ela NÃO é: teste de sintaxe. Nenhuma dimensão aqui é decidida por
 * presença de palavra. Regex serve para prender decisão estrutural no código;
 * para julgar um plano, ela mente nos dois sentidos — acha violação onde há só
 * o som de uma caixa registradora, e não acha onde o texto orienta sem afirmar.
 *
 * O que ela é: o caminho REAL de produção, com família sintética.
 *   · caso de PLANO    → `objetivoDaConversa` + `enquadrarObjetivo` +
 *                        `gerarSecoesPlanoMultiCall` (8 chamadas Claude)
 *   · caso de CONVERSA → `montarContextoDeSecoes` + `assemblePrompt` +
 *                        `gerarConversacional` (GPT, o provider da conversa)
 *
 * ⚠️ UM JUIZ POR CASO, e não um juiz por dimensão: dimensões se explicam umas
 * às outras (personalização decorativa costuma vir junto de repetição), e
 * quinze juízes isolados perderiam exatamente o que liga uma coisa à outra.
 *
 * ⚠️ ZERO ESCRITA. `SUPABASE_SERVICE_ROLE_KEY` sai do ambiente antes dos
 * imports — é a chave que `logEvent` usaria para persistir. Só `boas_praticas`
 * e `output_types` saem para a rede, por GET.
 *
 *   node scripts/bancada/golden/rodar.mjs            # os quatro
 *   node scripts/bancada/golden/rodar.mjs bia tito   # só alguns
 */
import { mod, FAMILIA_PILOTO, linha, caixa } from "../piloto-4a/comum.mjs";
import { CASOS, DIMENSOES, SKILL_DE } from "./casos.mjs";
import { writeFileSync } from "node:fs";

const U = process.env.NEXT_PUBLIC_SUPABASE_URL;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { gerarSecoesPlanoMultiCall } = await mod("lib/ia/plano.ts");
const { montarContextoDeSecoes } = await mod("lib/ia/engine.ts");
const { assemblePrompt } = await mod("lib/ia/prompt.ts");
const { gerarConversacional, MODELO_CONVERSA } = await mod("lib/ia/provider.ts");
const { objetivoDaConversa, enquadrarObjetivo } = await mod("lib/conducao/objetivo.ts");
const JUIZ = MODELO_CONVERSA.openai;

const out = [];
const w = (s) => { out.push(s); console.log(s); };

// A 4A ligada para todos — é o estado do rollout geral desde 11/08.
process.env.KOLO_PILOTO_4A = "on";

const OUTPUT_TYPES = await fetch(
  `${U}/rest/v1/output_types?select=key,label,prompt_template,ativo&ativo=eq.true`,
  { headers: { apikey: K, Authorization: `Bearer ${K}` } },
).then((r) => r.json());

/** Cliente em memória; escrita estoura, `boas_praticas` sai por GET. */
function banco(caso, skills) {
  const T = {
    specialist_prompt_templates: skills,
    output_types: OUTPUT_TYPES,
    membros_atipicos: [{
      id: caso.membroId, family_account_id: FAMILIA_PILOTO, nome: caso.nome,
      data_nascimento: caso.nascimento, perfil: "TEA", genero: caso.genero,
      diagnosticos_formais: null, ativo: true, created_at: "2026-01-01T00:00:00Z",
    }],
    perfil_vivo_membro: [{
      membro_atipico_id: caso.membroId, family_account_id: FAMILIA_PILOTO, ...caso.perfil,
    }],
    perfil_vivo_familia: [], diarios: [], check_ins_diarios: [], mensagens_skill: [], planos: [],
    family_profiles: [{
      family_account_id: FAMILIA_PILOTO, nome_mae: "Ana", como_chamar: "Ana",
      papel: "mae", papel_outro: null, genero_responsavel: "feminino",
    }],
  };
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
            return fetch(`${U}/rest/v1/boas_praticas?select=${encodeURIComponent(colunas)}${remoto.length ? "&" + remoto.join("&") : ""}`,
              { headers: { apikey: K, Authorization: `Bearer ${K}`, Range: "0-9999" } })
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

/** A skill roteada é fixada por caso: o roteador não é o que está sob teste. */
const SKILL_DO_CASO = {
  manu: SKILL_DE("foco", ["foco", "motor"]),
  tito: SKILL_DE("foco", ["foco", "aprendizado"]),
  bia: SKILL_DE("socializacao", ["socializacao", "comunicacao"]),
  vago: SKILL_DE("foco", ["foco"]),
};

// ── O JUIZ — um por caso, cego ao braço e sem comparar com nada ───────────
const SYS = `Você audita UMA resposta da Kolo (assistente que apoia mães de crianças neurodivergentes) contra um critério que lhe será dado por extenso.

Julgue SÓ este material. Você não conhece nenhuma outra resposta, não sabe que versão do produto a gerou, e não deve comparar com nada.

⚠️ Julgue SEMANTICAMENTE. A presença ou ausência de uma palavra não decide nada: o que decide é o que a resposta faz com a informação. Uma proposta pode falar de barulho sem violar nada, e pode violar sem usar a palavra.

Responda EXATAMENTE neste formato, uma linha por campo:

OBJETIVO_PRESERVADO: SIM|NAO|NAO_SE_APLICA — <o alvo continua o que a família quer, ou virou a barreira/um tema vizinho?>
COMPETENCIA_RECONHECIDA: SIM|NAO|NAO_SE_APLICA — <reconheceu capacidade que o perfil demonstra e o relato nega?>
CONTRADICAO_UTIL: SIM|NAO|NAO_SE_APLICA — <percebeu contradição entre relato e perfil e a usou como pista, sem confrontar a mãe?>
NEGATIVO_RESPEITADO: SIM|NAO|NAO_HA — <apoiou-se em algo que a família já disse que NÃO é o caso?>
NIVEL_RESPEITADO: SIM|NAO|NAO_SE_APLICA — <trabalhou a partir do que a criança já faz, sem rebaixar?>
FATO_X_HIPOTESE: SEPARADOS|MISTURADOS — <hipótese apresentada como hipótese, ou como característica conhecida?>
INVENTOU: SIM|NAO — <atribuiu habilidade, interesse, causa ou contexto que ninguém informou? qual?>
PERSONALIZACAO: FUNCIONAL|DECORATIVA|AUSENTE — <FUNCIONAL = o que se sabe da criança muda a MECÂNICA; DECORATIVA = muda só tema, personagem ou cenário, e a mecânica serviria a qualquer criança>
EVIDENCIA_PERSONALIZACAO: <a passagem que sustenta a classificação>
USO_DAS_BASES: CONHECIMENTO|INSPIRACAO|COPIA|NAO_USOU — <o repertório virou raciocínio, tema ou transcrição?>
DIVERSIDADE: <quantas propostas FUNCIONALMENTE distintas existem, e quantas são a mesma ideia com outra roupa? liste os grupos>
REPETICAO: <número de ideias que aparecem em mais de um lugar; liste. Redação diferente para a mesma ideia CONTA>
EXECUTAVEL: SIM|NAO — <uma mãe consegue fazer amanhã, com o que tem em casa?>
ENSINA_COMO: SIM|NAO|NAO_SE_APLICA — <ensina COMO brincar, COMO falar, COMO conduzir — ou só diz o que fazer?>
AVANCA_SEM_INTERROGATORIO: SIM|NAO|NAO_SE_APLICA — <entregou algo utilizável, ou devolveu perguntas?>
CARA_DE: PLANO_PERSONALIZADO|CONTEUDO_GENERICO|CATALOGO — <a impressão que a mãe teria>
UTIL_PARA_A_MAE: 1|2|3|4|5 — <e por quê, em uma frase>
VEREDITO: PASS|PASS_PARCIAL|FAIL — <uma frase, referida ao critério do caso>

Rigoroso. Na dúvida, escolha a classificação mais severa.`;

const alvo = process.argv.slice(2);
const escolhidos = alvo.length ? CASOS.filter((c) => alvo.includes(c.slug)) : CASOS;
w(`${linha()}\nPEND-039 · BANCADA PERMANENTE — ${escolhidos.length} caso(s)\n${linha()}`);
w(`modelo da conversa: ${JUIZ} · modelo do Plano: MODELS.principal (Claude)`);
w(`KOLO_PILOTO_4A=on · família e crianças SINTÉTICAS · zero escrita\n`);

const resultados = [];
for (const caso of escolhidos) {
  const skills = SKILL_DO_CASO[caso.slug];
  const db = banco(caso, skills);
  const alvoObj = objetivoDaConversa(caso.turnos);
  const enquadrado = alvoObj ? enquadrarObjetivo(alvoObj) : caso.turnos.at(-1).texto;

  w(`\n${linha()}\n${caso.id}\n${linha()}`);
  w(`\nOBJETIVO ESCOLHIDO PELO CÓDIGO (\`objetivoDaConversa\`):`);
  w(`  origem: ${alvoObj?.origem ?? "—"}`);
  w(caixa(`"${alvoObj?.objetivo ?? "—"}"`));

  const t0 = Date.now();
  let material;
  if (caso.canal === "plano") {
    const p = await gerarSecoesPlanoMultiCall({
      supabase: db, familyId: FAMILIA_PILOTO,
      membroAtipicoId: caso.membroId, desafio: enquadrado,
    });
    material = `TÍTULO DO PLANO: "${p.titulo}"\n\n` +
      p.secoes.map((s) => `## ${s.titulo || s.tipo}\n${s.conteudo_markdown}`).join("\n\n");
    w(`\nPLANO GERADO · "${p.titulo}" · ${p.secoes.length} seções · ${material.length} ch`);
  } else {
    const { ctx } = await montarContextoDeSecoes(db, {
      familyId: FAMILIA_PILOTO, membroAtipicoId: caso.membroId, pedido: enquadrado,
    });
    const { system, messages } = assemblePrompt({
      skills, ctx, userInput: caso.turnos.at(-1).texto, modo: { kind: "conversa" },
    });
    const r = await gerarConversacional({
      provider: "openai", model: JUIZ,
      system: system.map((b) => b.text).join("\n\n"), messages,
      maxTokens: 1600, cacheSystem: true,
    });
    material = r.texto.trim();
    w(`\nRESPOSTA GERADA · ${material.length} ch`);
  }
  const ms = Date.now() - t0;
  w(caixa(material));

  const juizo = await gerarConversacional({
    provider: "openai", model: JUIZ, system: SYS,
    messages: [{
      role: "user",
      content:
        `CRITÉRIO DESTE CASO:\n${caso.criterio}\n\n` +
        `O QUE A FAMÍLIA ESCREVEU (última fala):\n"${caso.turnos.at(-1).texto}"\n\n` +
        `A CONVERSA INTEIRA:\n${caso.turnos.map((t) => `${t.de === "familia" ? "Mãe" : "Ayla"}: ${t.texto}`).join("\n")}\n\n` +
        `O PERFIL DA CRIANÇA:\n${JSON.stringify(caso.perfil, null, 1)}\n\n` +
        `MATERIAL A AUDITAR:\n"""\n${material}\n"""`,
    }],
    maxTokens: 3000, cacheSystem: true,
  });
  const texto = juizo.texto.trim();
  // ⚠️ Juiz vazio NÃO é "zero problemas" — é ausência de medição.
  if (!texto) throw new Error(`JUÍZO VAZIO em ${caso.id} — não concluir nada deste caso`);
  w(`\n${linha()}\nJUÍZO · ${caso.id}\n`);
  w(caixa(texto));
  resultados.push({ caso, juizo: texto, ms, objetivo: alvoObj });
}

// ── PLACAR ───────────────────────────────────────────────────────────────
const campo = (t, k) => (t.match(new RegExp(`^${k}:\\s*([^\\n]*)`, "m")) ?? [])[1]?.trim() ?? "?";
w(`\n${linha()}\nPLACAR — PEND-039\n${linha()}\n`);
const COLS = ["OBJETIVO_PRESERVADO", "COMPETENCIA_RECONHECIDA", "NEGATIVO_RESPEITADO",
              "NIVEL_RESPEITADO", "FATO_X_HIPOTESE", "INVENTOU", "PERSONALIZACAO",
              "CARA_DE", "VEREDITO"];
for (const r of resultados) {
  w(`${r.caso.id}   (${(r.ms / 1000).toFixed(1)}s)`);
  for (const c of COLS) w(`   ${c.padEnd(26)} ${campo(r.juizo, c).split(" —")[0]}`);
  w(`   ${"REPETICAO".padEnd(26)} ${campo(r.juizo, "REPETICAO").slice(0, 70)}`);
  w("");
}
w(linha());

writeFileSync(`${process.cwd()}/docs/bancada/golden-2026-08-11.txt`, out.join("\n"), "utf8");
console.log("\npronto → docs/bancada/golden-2026-08-11.txt");
