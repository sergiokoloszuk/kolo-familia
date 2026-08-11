/**
 * PEND-034 · DE ONDE NASCE A VIOLAÇÃO DO NEGATIVO.
 *
 * "Provavelmente veio do conhecimento genérico" não é conclusão — é desistir de
 * procurar. Aqui se reconstrói o prompt EXATO que foi ao modelo nas três
 * execuções e se pergunta, de cada camada, se ela pode ter induzido a hipótese
 * sonora. Zero chamada paga: o material de entrada é determinístico.
 *
 * ⚠️ Busca literal AQUI é evidência legítima, e é a única vez que é: o objeto
 * examinado é o TEXTO QUE FOI ENVIADO, não o comportamento do modelo. Se a
 * palavra não está na entrada, ela não veio da entrada.
 *
 *   node scripts/bancada/piloto-4a/pend034-origem.mjs
 */
import { mod, FAMILIA_PILOTO, linha, caixa } from "./comum.mjs";
import { writeFileSync } from "node:fs";

const U = process.env.NEXT_PUBLIC_SUPABASE_URL;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { montarContextoDeSecoes } = await mod("lib/ia/engine.ts");
const { assemblePrompt, buildContextBlock } = await mod("lib/ia/prompt.ts");
const { ANCORA_PERFIL } = await mod("lib/conducao/composicao.ts");

const out = [];
const w = (s) => { out.push(s); console.log(s); };
const gravado = (t) => ({ texto: t, atualizado_em: "2026-08-01T00:00:00Z" });

const BIA_ID = "cccccccc-4a4a-4a4a-4a4a-000000000003";
const DESAFIO =
  "Bia quase não fala com as crianças da escola. Quero ajudar ela a iniciar e " +
  "sustentar pequenas interações sociais com outras pessoas.";

const SKILL = {
  id: "s1", ativo: true, name: "socializacao", display_name: "Socialização",
  objective: "apoiar a criança nas interações com outras pessoas",
  tone: "próximo, prático", scope: "socialização, comunicação social",
  limits: "não diagnostica",
  kolo_vivo_fields: ["essencial", "socializacao"], knowledge_tags: ["socializacao"],
  routing_keywords: [], routing_priority: 1, fallback_questions: [],
};

const T = {
  specialist_prompt_templates: [SKILL],
  membros_atipicos: [{
    id: BIA_ID, family_account_id: FAMILIA_PILOTO, nome: "Bia",
    data_nascimento: "2021-03-01", perfil: "TEA", genero: "feminino",
    diagnosticos_formais: null, ativo: true, created_at: "2026-01-01T00:00:00Z",
  }],
  perfil_vivo_membro: [{
    membro_atipico_id: BIA_ID, family_account_id: FAMILIA_PILOTO,
    essencial: gravado("Bia, 5 anos. INTERESSES: brincar de mercadinho, caixa registradora, organizar as coisas."),
    sensorial: gravado("Perfil sensorial: Misto\nReação a sons: não\nLuz: não\nTexturas (roupas, objetos): Evita etiquetas."),
    categorias_extras: {
      socializacao: gravado("Iniciativa e reciprocidade: Fala com adultos conhecidos. Com crianças da idade dela, fica em silêncio."),
      comunicacao: gravado("Como se comunica: Fala frases\nConversa e argumentação: Mantém o vai-e-vem com adulto conhecido."),
    },
  }],
  perfil_vivo_familia: [], diarios: [], check_ins_diarios: [], mensagens_skill: [],
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

const { ctx } = await montarContextoDeSecoes(banco(), {
  familyId: FAMILIA_PILOTO, membroAtipicoId: BIA_ID, pedido: DESAFIO,
});
const bloco = buildContextBlock(ctx);

// A seção onde a violação nasceu nas execuções 1 e 2 foi `entender` / `crencas`.
// O system é o mesmo para as sete seções práticas; uso um output type qualquer.
const { system } = assemblePrompt({
  skills: [SKILL], ctx, userInput: DESAFIO,
  modo: { kind: "output_type", outputType: { key: "estrategias", label: "O que fazer diferente", prompt_template: "Liste estratégias." } },
});
const systemTexto = system.map((b) => b.text).join("\n\n");

// As palavras que aparecem nas violações medidas: "menos barulho", "menos
// imprevisibilidade", "a escola é barulhenta".
const GATILHOS = /barulh|ruído|ruido|sonor|som\b|sons\b|estímul|estimul|sobrecarg|sensorial|silenci|quiet/i;
const ondeAparece = (texto) => {
  const linhas = texto.split("\n").filter((l) => GATILHOS.test(l));
  return linhas.map((l) => l.trim().slice(0, 150));
};

w(`${linha()}\nPEND-034 · DE ONDE NASCE A HIPÓTESE SONORA\n${linha()}`);

// ── 1-2 · O NEGATIVO CHEGOU? EM QUE POSIÇÃO? ─────────────────────────────
w(`\n1-2. O NEGATIVO CHEGOU, E ONDE\n`);
const iSabemos = bloco.indexOf("<o_que_ja_sabemos>");
const iNegativo = bloco.indexOf("a família já disse que NÃO é o caso");
const iRepertorio = bloco.indexOf("<repertorio_kolo>");
w(`   <o_que_ja_sabemos> começa no caractere ${iSabemos} de ${bloco.length}`);
w(`   o negativo aparece no caractere ${iNegativo}`);
w(`   <repertorio_kolo> começa no caractere ${iRepertorio}`);
w(`   → o negativo chega ${iNegativo < iRepertorio ? "ANTES" : "DEPOIS"} do repertório`);
const linhaNeg = (bloco.match(/^- Sensorial:[^\n]*/m) ?? ["(não encontrada)"])[0];
w(`\n   a linha exata:\n     ${linhaNeg}`);

// ── 3 · QUAL BASE 2 CHEGOU ───────────────────────────────────────────────
w(`\n3. BASE 2 ENTREGUE\n`);
w(`   ${ctx.base2.length} seções: ${ctx.base2.map((s) => s.titulo).join(" · ")}`);
const base2Texto = ctx.base2.map((s) => `${s.titulo}\n${s.conteudo}`).join("\n");
const base2Gatilho = ondeAparece(base2Texto);
w(`   menciona som/barulho/estímulo/sobrecarga? ${base2Gatilho.length ? "SIM" : "NÃO"}`);
base2Gatilho.forEach((l) => w(`     · ${l}`));

// ── 4-5 · QUAIS BPs, E O QUE ELAS DIZEM ──────────────────────────────────
w(`\n4-5. BOAS PRÁTICAS ENTREGUES\n`);
for (const bp of ctx.boasPraticas) {
  const txt = `${bp.titulo}\n${bp.versao_conversa ?? bp.versao_curta ?? ""}\n${(bp.passos_praticos ?? []).join(" ")}\n${bp.quando_usar ?? ""}\n${(bp.erros_comuns ?? []).join(" ")}`;
  const hits = ondeAparece(txt);
  w(`   · ${bp.titulo.slice(0, 90)}`);
  w(`     menciona som/estímulo/sobrecarga? ${hits.length ? "SIM" : "NÃO"}`);
  hits.forEach((l) => w(`       ↳ ${l}`));
}

// ── 6 · O PEDIDO INDUZ? ──────────────────────────────────────────────────
w(`\n6. O PEDIDO / OBJETIVO\n`);
w(`   "${DESAFIO}"`);
w(`   contém gatilho sensorial? ${GATILHOS.test(DESAFIO) ? "SIM" : "NÃO"}`);
w(`   contém "escola"? ${/escola/i.test(DESAFIO) ? "SIM — e a violação 2 falou da escola" : "NÃO"}`);

// ── 7 · O SYSTEM INDUZ? ──────────────────────────────────────────────────
w(`\n7. O SYSTEM PROMPT (${systemTexto.length} ch)\n`);
const sysHits = ondeAparece(systemTexto);
w(`   linhas com gatilho sensorial: ${sysHits.length}`);
sysHits.forEach((l) => w(`     · ${l}`));

// ── 9-10 · A ÂNCORA COBRE ESTE CASO? ─────────────────────────────────────
w(`\n9-10. O QUE A ANCORA_PERFIL DIZ SOBRE NEGATIVO\n`);
const mencoesNegativo = ANCORA_PERFIL.split("\n")
  .map((l, i) => [i, l])
  .filter(([, l]) => /não é o caso|NÃO se aplica|negativ/i.test(l));
w(`   parágrafos da âncora que citam um "não é o caso": ${mencoesNegativo.length} de ${ANCORA_PERFIL.split("\n").length}`);
for (const [i, l] of mencoesNegativo) {
  w(`\n   parágrafo ${i + 1}, e o contexto em que a frase está:`);
  w(caixa(l.trim()));
}

// A única outra instrução ligada a negativo, no bloco montado:
const instrucaoNegativo = bloco
  .split("\n")
  .filter((l) => /NÃO se aplica|já disse que NÃO/.test(l))
  .map((l) => l.trim());
w(`\n   TODAS as instruções do bloco que falam de negativo:`);
instrucaoNegativo.forEach((l) => w(`     · ${l}`));

writeFileSync("docs/bancada/pend034-origem-2026-08-11.txt", out.join("\n"), "utf8");
console.log("\npronto → docs/bancada/pend034-origem-2026-08-11.txt");
