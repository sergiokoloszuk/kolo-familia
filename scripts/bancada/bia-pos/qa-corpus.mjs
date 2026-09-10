/**
 * QA DO CORPUS DA PÓS — mede antes de recomendar ingestão. LEITURA PURA.
 *
 * Também CARIMBA o `hash` de cada chunk (sha256 do texto + procedência), que é
 * a coluna de idempotência da migração 0071: reimportar o mesmo documento não
 * duplica porque o ON CONFLICT bate ali. Determinístico — rodar duas vezes não
 * muda nada.
 *
 *   node scripts/bancada/bia-pos/qa-corpus.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const CAMINHO = "data/bia/corpus-pos-v1.json";
const MAX_CHARS = 600; // MAX_CHARS_POR_CHUNK de lib/bia/bloco.ts

const chunks = JSON.parse(readFileSync(CAMINHO, "utf8"));

// ----- hash determinístico -----
let carimbados = 0;
for (const c of chunks) {
  const h = createHash("sha256")
    .update(`${c.documento_origem}|${c.versao_documento}|${c.secao}|${c.texto_original}`)
    .digest("hex");
  if (c.hash !== h) {
    c.hash = h;
    carimbados++;
  }
}
if (carimbados) {
  writeFileSync(CAMINHO, JSON.stringify(chunks, null, 2) + "\n", "utf8");
}

const conta = (f) => chunks.filter(f).length;
const dist = (fn) => {
  const m = {};
  for (const c of chunks) {
    const k = fn(c);
    m[k] = (m[k] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
};

const tamanhos = chunks.map((c) => c.texto_original.length);
const acima = chunks.filter((c) => c.texto_original.length > MAX_CHARS);

console.log(`### CORPUS: ${chunks.length} chunks · hashes carimbados agora: ${carimbados}`);
console.log(`\n## TAMANHO`);
console.log(`  média: ${Math.round(tamanhos.reduce((a, b) => a + b, 0) / tamanhos.length)} chars`);
console.log(`  máximo: ${Math.max(...tamanhos)} · mínimo: ${Math.min(...tamanhos)}`);
console.log(`  ACIMA DE ${MAX_CHARS}: ${acima.length}${acima.length ? " ← " + acima.map((c) => `${c.id}(${c.texto_original.length})`).join(", ") : "  ✅ exigência cumprida"}`);

console.log(`\n## DISTRIBUIÇÃO POR NÚCLEO`);
for (const [k, v] of Object.entries(dist((c) => c.nucleo))) console.log(`  ${k.padEnd(22)} ${v}`);
console.log(`\n## DISTRIBUIÇÃO POR TIPO`);
for (const [k, v] of Object.entries(dist((c) => c.tipo_conhecimento))) console.log(`  ${k.padEnd(22)} ${v}`);
console.log(`\n## FONTE`);
for (const [k, v] of Object.entries(dist((c) => c._fonte))) console.log(`  fonte ${k}: ${v}`);

console.log(`\n## PREENCHIMENTO`);
const linha = (rot, n) => console.log(`  ${rot.padEnd(34)} ${String(n).padStart(3)}  (${Math.round((100 * n) / chunks.length)}%)`);
linha("com nucleos_relacionados", conta((c) => c.nucleos_relacionados?.length));
linha("SEM nucleos_relacionados", conta((c) => !c.nucleos_relacionados?.length));
linha("com habilidades_relacionadas", conta((c) => c.habilidades_relacionadas?.length));
linha("SEM habilidades_relacionadas", conta((c) => !c.habilidades_relacionadas?.length));
linha("com situacoes_relacionadas", conta((c) => c.situacoes_relacionadas?.length));
linha("com faixa etária", conta((c) => c.faixa_etaria_min_meses != null || c.faixa_etaria_max_meses != null));
linha("com pergunta investigativa", conta((c) => c.perguntas_investigativas?.length));
linha("com hipótese", conta((c) => c.hipoteses?.length));
linha("com estratégia", conta((c) => c.estrategias?.length));
linha("com o_que_evitar", conta((c) => c.o_que_evitar?.length));
linha("com muda_conduta = true", conta((c) => c.muda_conduta === true));
linha("com cautela acima de baixo", conta((c) => c.nivel_de_cautela !== "baixo"));
linha("com quando_encaminhar", conta((c) => c.quando_encaminhar));
linha("marcados _pressupoe (pré-verbal)", conta((c) => c._pressupoe));

console.log(`\n## RELAÇÃO COM O CORE v11`);
const core = dist((c) => (/^ausente/.test(c._core) ? "ausente do Core" : /SOBREPOSIÇÃO REAL/.test(c._core) ? "sobreposição REAL" : "sobreposição parcial"));
for (const [k, v] of Object.entries(core)) console.log(`  ${k.padEnd(22)} ${v}`);

console.log(`\n## TIPOS SEM COTA NO BLOCO (nunca chegariam ao prompt)`);
const COM_COTA = new Set(["sinal_de_alerta", "encaminhamento", "interpretacao", "pergunta_investigativa", "regra_operacional", "estrategia", "conceito"]);
const semCota = chunks.filter((c) => !COM_COTA.has(c.tipo_conhecimento));
console.log(`  ${semCota.length}${semCota.length ? " ← " + semCota.map((c) => c.id).join(", ") : "  ✅ nenhum"}`);

console.log(`\n## INTEGRIDADE`);
const ids = new Set(chunks.map((c) => c.id));
console.log(`  ids únicos: ${ids.size === chunks.length ? "✅" : "❌ " + (chunks.length - ids.size) + " duplicado(s)"}`);
const hashes = new Set(chunks.map((c) => c.hash));
console.log(`  hashes únicos: ${hashes.size === chunks.length ? "✅" : "❌ colisão"}`);
const NUCLEOS = new Set(["fundamentos","regulacao_emocional","sono","alimentacao","rotina","sensorial","comunicacao","imitacao","socializacao","motor","autonomia","aprendizagem","foco_executivas","pensamentos_crencas","brincadeiras_atividades"]);
const nucleoInvalido = chunks.filter((c) => !NUCLEOS.has(c.nucleo) || (c.nucleos_relacionados ?? []).some((n) => !NUCLEOS.has(n)));
console.log(`  núcleos dentro do CHECK da 0071: ${nucleoInvalido.length === 0 ? "✅" : "❌ " + nucleoInvalido.map((c) => c.id).join(", ")}`);
const semFundamentos = conta((c) => c.nucleo === "fundamentos");
console.log(`  núcleo 'fundamentos' (penalizado −25, já vive no Core): ${semFundamentos === 0 ? "✅ nenhum" : "⚠️ " + semFundamentos}`);

// ----- quase duplicatas por sobreposição de vocabulário -----
const STOP = new Set(["para","como","que","uma","dos","das","com","não","nao","por","mais","the","este","essa","isso","ela","ele","seu","sua","tem","ser","fazer","quando","antes","depois","sem","aos","ate","até","numa","num","pode","precisa","muito","vez","cada","mesmo","onde","porque","quem","qual"]);
const termos = (t) => new Set(t.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !STOP.has(w)));
const pares = [];
for (let i = 0; i < chunks.length; i++) {
  for (let j = i + 1; j < chunks.length; j++) {
    const a = termos(chunks[i].titulo + " " + chunks[i].texto_original);
    const b = termos(chunks[j].titulo + " " + chunks[j].texto_original);
    const inter = [...a].filter((x) => b.has(x)).length;
    const jac = inter / (a.size + b.size - inter);
    if (jac >= 0.25) pares.push([chunks[i].id, chunks[j].id, jac.toFixed(2)]);
  }
}
console.log(`\n## QUASE DUPLICATAS (Jaccard ≥ 0,25): ${pares.length}`);
for (const p of pares) console.log(`  ${p[0]} × ${p[1]} — ${p[2]}`);
