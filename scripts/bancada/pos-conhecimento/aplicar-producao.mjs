/**
 * Publica as quatro BPs aprovadas em uma única instrução PostgREST.
 *
 * Uso seguro:
 *   node --env-file=apps/web/.env.local --use-system-ca \
 *     scripts/bancada/pos-conhecimento/aplicar-producao.mjs --dry-run
 *   node --env-file=apps/web/.env.local --use-system-ca \
 *     scripts/bancada/pos-conhecimento/aplicar-producao.mjs --apply
 *   node --env-file=apps/web/.env.local --use-system-ca \
 *     scripts/bancada/pos-conhecimento/aplicar-producao.mjs --verify
 *
 * O POST com `resolution=merge-duplicates` é uma única instrução SQL no
 * PostgREST: as duas inserções e duas atualizações confirmam juntas ou falham
 * juntas. O script exige o estado de baseline antes de aplicar e nunca envia
 * texto de famílias.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { conhecimentoProposto } from "./conhecimento-proposto.mjs";

const modo = process.argv[2];
if (!["--dry-run", "--apply", "--verify"].includes(modo)) {
  throw new Error("Informe --dry-run, --apply ou --verify");
}

const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !chave) throw new Error("Variáveis do Supabase ausentes");

const headers = { apikey: chave, Authorization: `Bearer ${chave}` };
const ids = conhecimentoProposto.map((bp) => bp.id);
const urlLeitura = `${base}/rest/v1/boas_praticas?select=*&id=in.(${ids.join(",")})`;
const ler = async () => {
  const resposta = await fetch(urlLeitura, { headers, signal: AbortSignal.timeout(30_000) });
  if (!resposta.ok) throw new Error(`Leitura falhou: HTTP ${resposta.status} ${await resposta.text()}`);
  return resposta.json();
};
const sha = (valor) => createHash("sha256").update(JSON.stringify(valor)).digest("hex").slice(0, 16);

const atuais = await ler();
const porId = new Map(atuais.map((bp) => [String(bp.id), bp]));
const estado = conhecimentoProposto.map((proposta) => {
  const atual = porId.get(proposta.id);
  return {
    id: proposta.id,
    operacao: proposta.operacao,
    existe: Boolean(atual),
    status: atual?.status ?? null,
    versao: atual?.versao ?? null,
    tituloHash: atual ? sha(atual.titulo) : null,
  };
});

const verificarFinal = () => {
  for (const proposta of conhecimentoProposto) {
    const atual = porId.get(proposta.id);
    assert.ok(atual, `${proposta.id}: BP publicada ausente`);
    assert.equal(atual.status, "ativo", `${proposta.id}: status`);
    assert.equal(atual.titulo, proposta.titulo, `${proposta.id}: título`);
    assert.equal(atual.versao_conversa, proposta.versao_conversa, `${proposta.id}: conversa`);
    assert.deepEqual(atual.skills_relacionadas, proposta.skills_relacionadas, `${proposta.id}: skills`);
    assert.deepEqual(atual.tags, proposta.tags, `${proposta.id}: tags`);
    assert.equal(Number(atual.peso_relevancia), proposta.peso_relevancia, `${proposta.id}: peso`);
    assert.equal(Number(atual.versao), proposta.operacao === "insert" ? 1 : 2, `${proposta.id}: versão`);
  }
};

execucao: {
if (modo === "--verify") {
  verificarFinal();
  console.log(JSON.stringify({ ok: true, modo: "verify", bps: estado }));
  break execucao;
}

for (const proposta of conhecimentoProposto) {
  const atual = porId.get(proposta.id);
  if (proposta.operacao === "insert") {
    assert.equal(atual, undefined, `${proposta.id}: id novo já existe`);
  } else {
    assert.ok(atual, `${proposta.id}: BP a complementar não existe`);
    assert.equal(atual.status, "ativo", `${proposta.id}: BP não está ativa`);
    assert.equal(Number(atual.versao), 1, `${proposta.id}: versão divergiu do baseline`);
  }
}

console.log(JSON.stringify({ ok: true, modo: modo.slice(2), bps: estado }));
if (modo === "--dry-run") break execucao;

const colunas = [
  "id", "texto_original", "titulo", "resumo", "passos_praticos", "quando_usar",
  "erros_comuns", "versao_curta", "versao_conversa", "versao_passos",
  "skills_relacionadas", "tags", "faixa_etaria_min", "faixa_etaria_max",
  "perfis_aplicaveis", "nivel", "video_id", "aula_id", "origem",
  "peso_relevancia", "versao", "status", "atividades_praticas", "crencas_adulto",
];
const linhas = conhecimentoProposto.map((proposta) => {
  const atual = porId.get(proposta.id) ?? {};
  const mesclada = {
    ...atual,
    ...proposta,
    versao_passos: atual.versao_passos ?? [],
    perfis_aplicaveis: proposta.perfis_aplicaveis ?? atual.perfis_aplicaveis ?? [],
    nivel: proposta.nivel ?? atual.nivel ?? "iniciante",
    video_id: atual.video_id ?? null,
    aula_id: atual.aula_id ?? null,
    origem: proposta.origem ?? atual.origem ?? "admin",
    versao: proposta.operacao === "insert" ? 1 : Number(atual.versao) + 1,
    status: "ativo",
  };
  return Object.fromEntries(colunas.map((coluna) => [coluna, mesclada[coluna] ?? null]));
});

const resposta = await fetch(`${base}/rest/v1/boas_praticas?on_conflict=id`, {
  method: "POST",
  headers: {
    ...headers,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=representation",
  },
  body: JSON.stringify(linhas),
  signal: AbortSignal.timeout(30_000),
});
if (!resposta.ok) throw new Error(`Publicação falhou: HTTP ${resposta.status} ${await resposta.text()}`);
const publicadas = await resposta.json();
assert.equal(publicadas.length, 4, "PostgREST não devolveu as quatro BPs");

const finais = await ler();
porId.clear();
for (const bp of finais) porId.set(String(bp.id), bp);
verificarFinal();
console.log(JSON.stringify({ ok: true, modo: "apply", publicadas: finais.map((bp) => ({ id: bp.id, titulo: bp.titulo, versao: bp.versao })) }));
}
