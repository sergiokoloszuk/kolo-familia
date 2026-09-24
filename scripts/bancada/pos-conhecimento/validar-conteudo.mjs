import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { conhecimentoProposto } from "./conhecimento-proposto.mjs";

const sql = readFileSync("supabase/migrations/0089_pos_neurodesenvolvimento_cirurgica.sql", "utf8");
const ids = conhecimentoProposto.map((bp) => bp.id);

assert.equal(conhecimentoProposto.length, 4, "a missão admite exatamente quatro mudanças editoriais");
assert.equal(new Set(ids).size, ids.length, "ids de BP precisam ser únicos");
assert.deepEqual(
  conhecimentoProposto.map((bp) => bp.operacao),
  ["insert", "update", "update", "insert"],
  "duas BPs novas e duas complementações existentes",
);

for (const bp of conhecimentoProposto) {
  for (const campo of ["titulo", "versao_curta", "versao_conversa", "quando_usar"]) {
    assert.ok(typeof bp[campo] === "string" && bp[campo].trim(), `${bp.id}: ${campo} obrigatório`);
  }
  assert.ok(bp.skills_relacionadas.length > 0, `${bp.id}: precisa de skill`);
  assert.ok(bp.tags.length > 0, `${bp.id}: precisa de tags`);
  assert.ok(bp.passos_praticos.length > 0, `${bp.id}: precisa de ação`);
  assert.ok(bp.erros_comuns.length > 0, `${bp.id}: precisa declarar limites`);
  assert.equal(bp.peso_relevancia, 0.5, `${bp.id}: não deve furar ranking por peso`);
  assert.ok(sql.includes(bp.id), `${bp.id}: ausente da migração`);
  assert.ok(sql.includes(bp.titulo), `${bp.id}: título diverge entre fixture e migração`);
  assert.ok(sql.includes(bp.versao_conversa), `${bp.id}: conversa diverge entre fixture e migração`);
}

for (const proibido of [
  /\bdelete\s+from\b/i,
  /\btruncate\b/i,
  /\bdrop\s+(table|column|schema)\b/i,
  /guia_de_teste/i,
]) {
  assert.ok(!proibido.test(sql), `migração contém operação/dependência proibida: ${proibido}`);
}

assert.match(sql, /where id = '4f7f16aa-f67a-44d1-bf4b-ce23c54f7e35'[\s\S]*?versao = 1;/);
assert.match(sql, /where id = 'd5c505c5-03cf-4d5b-9dc9-562bfb6c327d'[\s\S]*?versao = 1;/);
assert.equal((sql.match(/insert into public\.boas_praticas/g) ?? []).length, 2);
assert.equal((sql.match(/update public\.boas_praticas/g) ?? []).length, 2);

console.log(JSON.stringify({ ok: true, bps: conhecimentoProposto.length, inserts: 2, updates: 2 }));
