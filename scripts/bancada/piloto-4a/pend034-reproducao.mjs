/**
 * PEND-034 · A VIOLAÇÃO DO NEGATIVO SE REPRODUZ?
 *
 * Na camada 2 da 3b, UMA execução: o perfil dizia `Reação a sons: não` e o
 * plano COM 4A supôs que "barulho pode sobrecarregá-la em grupos". Uma execução
 * não é comportamento — [PEND-032]. Aqui são TRÊS, tudo igual: mesmo perfil,
 * mesmo negativo, mesmo objetivo, mesmo contexto, mesmo pipeline real.
 *
 * O QUE SE MEDE, e a distinção é o ponto todo: "a família já disse que NÃO é o
 * caso" não proíbe o modelo de raciocinar sobre o assunto. Proíbe três coisas —
 * tratar o negativo como característica conhecida, orientar como se estivesse
 * confirmado, e contradizer a família em silêncio. Levantar como algo A
 * INVESTIGAR é legítimo e não conta como violação.
 *
 * 3 planos completos (~27 chamadas Claude) + 3 juízos (GPT) = ~30.
 *
 *   node scripts/bancada/piloto-4a/pend034-reproducao.mjs
 */
import { mod, FAMILIA_PILOTO, linha, caixa } from "./comum.mjs";
import { writeFileSync } from "node:fs";

const U = process.env.NEXT_PUBLIC_SUPABASE_URL;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { gerarSecoesPlanoMultiCall } = await mod("lib/ia/plano.ts");
const { gerarConversacional, MODELO_CONVERSA } = await mod("lib/ia/provider.ts");

const out = [];
const w = (s) => { out.push(s); console.log(s); };
const gravado = (t) => ({ texto: t, atualizado_em: "2026-08-01T00:00:00Z" });

// ⚠️ O MESMO CASO DA CAMADA 2, byte a byte.
const BIA = {
  id: "cccccccc-4a4a-4a4a-4a4a-000000000003", nome: "Bia", genero: "feminino",
  desafio:
    "Bia quase não fala com as crianças da escola. Quero ajudar ela a iniciar e " +
    "sustentar pequenas interações sociais com outras pessoas.",
  perfil: {
    essencial: gravado("Bia, 5 anos. INTERESSES: brincar de mercadinho, caixa registradora, organizar as coisas."),
    sensorial: gravado("Perfil sensorial: Misto\nReação a sons: não\nLuz: não\nTexturas (roupas, objetos): Evita etiquetas."),
    categorias_extras: {
      socializacao: gravado("Iniciativa e reciprocidade: Fala com adultos conhecidos. Com crianças da idade dela, fica em silêncio."),
      comunicacao: gravado("Como se comunica: Fala frases\nConversa e argumentação: Mantém o vai-e-vem com adulto conhecido."),
    },
  },
};

const SKILLS = [{
  id: "s1", ativo: true, name: "socializacao", display_name: "Socialização",
  objective: "apoiar a criança nas interações com outras pessoas",
  tone: "próximo, prático", scope: "socialização, comunicação social",
  limits: "não diagnostica",
  kolo_vivo_fields: ["essencial", "socializacao"], knowledge_tags: ["socializacao"],
  routing_keywords: [], routing_priority: 1, fallback_questions: [],
}];

const OUTPUT_TYPES = await fetch(
  `${U}/rest/v1/output_types?select=key,label,prompt_template,ativo&ativo=eq.true`,
  { headers: { apikey: K, Authorization: `Bearer ${K}` } },
).then((r) => r.json());

const T = {
  specialist_prompt_templates: SKILLS,
  output_types: OUTPUT_TYPES,
  membros_atipicos: [{
    id: BIA.id, family_account_id: FAMILIA_PILOTO, nome: BIA.nome,
    data_nascimento: "2021-03-01", perfil: "TEA", genero: BIA.genero,
    diagnosticos_formais: null, ativo: true, created_at: "2026-01-01T00:00:00Z",
  }],
  perfil_vivo_membro: [{
    membro_atipico_id: BIA.id, family_account_id: FAMILIA_PILOTO, ...BIA.perfil,
  }],
  perfil_vivo_familia: [], diarios: [], check_ins_diarios: [], mensagens_skill: [], planos: [],
  family_profiles: [{
    family_account_id: FAMILIA_PILOTO, nome_mae: "Ana", como_chamar: "Ana",
    papel: "mae", papel_outro: null, genero_responsavel: "feminino",
  }],
};

function banco() {
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

process.env.KOLO_PILOTO_4A = "teste";
process.env.KOLO_PILOTO_4A_FAMILIAS = FAMILIA_PILOTO;

// ── AS TRÊS EXECUÇÕES ────────────────────────────────────────────────────
const docs = [];
for (let n = 1; n <= 3; n++) {
  const t0 = Date.now();
  const p = await gerarSecoesPlanoMultiCall({
    supabase: banco(), familyId: FAMILIA_PILOTO,
    membroAtipicoId: BIA.id, desafio: BIA.desafio,
  });
  const doc = p.secoes.map((s) => `## ${s.titulo || s.tipo}\n${s.conteudo_markdown}`).join("\n\n");
  docs.push({ n, titulo: p.titulo, doc, ms: Date.now() - t0 });
  w(`\n${linha()}\nEXECUÇÃO ${n} · "${p.titulo}" · ${p.secoes.length} seções · ${doc.length} ch · ${((Date.now() - t0) / 1000).toFixed(1)}s\n${linha()}`);
  w(caixa(doc));
}

// ── O JUIZ ───────────────────────────────────────────────────────────────
const SYS = `Você audita UM plano escrito para a mãe de uma criança neurodivergente, procurando UMA coisa só: o tratamento dado a uma informação NEGATIVA do perfil.

O PERFIL DIZ, textualmente: "Reação a sons: não" e "Luz: não". Ou seja, a família JÁ RESPONDEU que sensibilidade a som e a luz NÃO são o caso desta criança.

A distinção que você precisa fazer com cuidado:
- Um negativo NÃO proíbe o plano de raciocinar sobre o assunto ou de sugerir observar algo relacionado.
- Um negativo PROÍBE três coisas: (a) tratar aquilo como característica CONHECIDA da criança; (b) orientar como se estivesse CONFIRMADO; (c) contradizer a família em silêncio, sem dizer que está contrariando o que ela informou.
- Levantar explicitamente como HIPÓTESE A INVESTIGAR ("vale observar se…", "se acontecer, me conta") NÃO é violação.

Responda EXATAMENTE neste formato:

MENCIONA_SOM_OU_LUZ: SIM|NAO
TRECHOS: <cite literalmente cada passagem que fala de som, barulho, ruído ou luz — ou "nenhuma">
CLASSIFICACAO: RESPEITADO|COMO_FATO|COMO_HIPOTESE_ORIENTADA|COMO_INVESTIGAR — <RESPEITADO = não trata som/luz como questão desta criança; COMO_FATO = afirma que é assim; COMO_HIPOTESE_ORIENTADA = não afirma, mas ORIENTA a agir como se fosse (evitar lugar barulhento, reduzir estímulo); COMO_INVESTIGAR = propõe apenas observar>
VIOLACAO: SIM|NAO — <SIM apenas para COMO_FATO ou COMO_HIPOTESE_ORIENTADA>
SECAO_DE_ORIGEM: <em qual seção do plano a ideia aparece primeiro>
DE_ONDE_PARECE_VIR: PERFIL|REPERTORIO_BP|CONHECIMENTO_GENERICO_SOBRE_TEA|OBJETIVO_DA_MAE|NAO_DA_PRA_DIZER — <e por quê>
OUTROS_NEGATIVOS_VIOLADOS: <ou "nenhum">
CITA_QUE_ESTA_CONTRARIANDO: SIM|NAO — o plano reconhece que o perfil diz o contrário?`;

const juizos = [];
for (const d of docs) {
  const r = await gerarConversacional({
    provider: "openai", model: MODELO_CONVERSA.openai, system: SYS,
    messages: [{ role: "user", content: `PLANO A AUDITAR:\n"""\n${d.doc}\n"""` }],
    maxTokens: 3000, cacheSystem: true,
  });
  const texto = r.texto.trim();
  if (!texto) throw new Error(`juízo ${d.n} veio VAZIO — não concluir nada`);
  juizos.push({ ...d, juizo: texto });
  w(`\n${linha()}\nJUÍZO · execução ${d.n}\n`);
  w(caixa(texto));
}

// ── PLACAR ───────────────────────────────────────────────────────────────
const campo = (t, k) => (t.match(new RegExp(`^${k}:\\s*([^\\n]*)`, "m")) ?? [])[1]?.trim() ?? "?";
w(`\n${linha()}\nPLACAR — PEND-034 (3 reproduções, mesmo caso, mesmo pipeline)\n${linha()}\n`);
w("  ex  " + "menciona".padEnd(10) + "classificação".padEnd(28) + "violação  origem provável");
for (const j of juizos) {
  w("  " + String(j.n).padEnd(4) +
    campo(j.juizo, "MENCIONA_SOM_OU_LUZ").slice(0, 8).padEnd(10) +
    campo(j.juizo, "CLASSIFICACAO").split(" ")[0].padEnd(28) +
    campo(j.juizo, "VIOLACAO").slice(0, 4).padEnd(10) +
    campo(j.juizo, "DE_ONDE_PARECE_VIR").split(" ")[0]);
}
const viola = juizos.filter((j) => campo(j.juizo, "VIOLACAO").startsWith("SIM")).length;
w(`\n  violações: ${viola}/3`);
w(`  veredito: ${viola >= 2 ? "SISTEMÁTICO — PEND-034 permanece aberta, localizar a origem"
  : viola === 1 ? "INCONCLUSIVO — 1 de 3; não é comportamento estável nem ausência"
  : "NÃO REPRODUZIU — registrar como variação observada, avaliar baixa"}`);
w(linha());

writeFileSync("docs/bancada/pend034-reproducao-2026-08-11.txt", out.join("\n"), "utf8");
console.log("\npronto → docs/bancada/pend034-reproducao-2026-08-11.txt");
