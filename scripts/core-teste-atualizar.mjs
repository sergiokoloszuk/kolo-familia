/**
 * ATUALIZA O CORE EM TESTE — o slot único do simulador.
 *
 * REGRA (Karina, 15/08/2026):
 *   Core ATIVO ......... nunca sobrescrever.
 *   Core EM TESTE ...... pode ser substituído a cada nova versão enviada.
 *   Um só Core em teste por vez.
 *
 * ⚠️ O BANCO JÁ GARANTE ISSO. A migração 0077 tem índice parcial de UM
 * `rascunho` por chave — o mesmo índice que, no fluxo de candidatas, obrigou o
 * Admin a usar `arquivado`. Aqui ele é exatamente a regra desejada, então o
 * slot de teste É o `rascunho`, e atualizá-lo é a operação certa, não um
 * acidente.
 *
 * ⚠️ NÃO TOCA NA ATIVA. Um `.eq("status","rascunho")` no update, e uma
 * verificação depois de qual versão continua ativa.
 *
 * Uso:  node scripts/core-teste-atualizar.mjs docs/documentos-ayla/core-ayla-v5.md
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const arquivo = process.argv[2];
if (!arquivo) {
  console.error("uso: node scripts/core-teste-atualizar.mjs <arquivo.md>");
  process.exit(1);
}

const env = {};
for (const l of readFileSync("apps/web/.env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const U = env.NEXT_PUBLIC_SUPABASE_URL;
const H = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  "content-type": "application/json",
};
const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(url, init) {
  for (let i = 1; i <= 5; i++) {
    try {
      return await fetch(url, {
        ...init,
        headers: { ...H, ...(init?.headers ?? {}) },
        signal: AbortSignal.timeout(30000),
      });
    } catch (e) {
      console.log(`  tentativa ${i}: ${e.cause?.code ?? e.message}`);
      await sleep(3000);
    }
  }
  throw new Error("sem conexão");
}

const texto = readFileSync(arquivo, "utf8");
console.log(`arquivo : ${arquivo}`);
console.log(`          ${texto.length} chars · sha ${sha(texto).slice(0, 16)}…`);

// Estado antes.
const rAntes = await req(`${U}/rest/v1/ayla_documentos?select=id,versao,status,conteudo&chave=eq.core&order=versao`);
const antes = await rAntes.json();
const ativaAntes = antes.find((d) => d.status === "ativo");
const teste = antes.find((d) => d.status === "rascunho");
console.log(`\nativa   : v${ativaAntes?.versao ?? "—"} (${ativaAntes?.conteudo.length ?? 0} chars)`);
console.log(`em teste: ${teste ? `v${teste.versao} (${teste.conteudo.length} chars)` : "nenhum"}`);

let alvoId, alvoVersao;
if (teste) {
  alvoId = teste.id;
  alvoVersao = teste.versao;
  const r = await req(`${U}/rest/v1/ayla_documentos?id=eq.${teste.id}`, {
    method: "PATCH",
    body: JSON.stringify({ conteudo: texto, nota: `Core em teste — substituído em ${new Date().toISOString()}` }),
  });
  if (!r.ok) {
    console.log(`❌ falha ao substituir (${r.status}): ${(await r.text()).slice(0, 200)}`);
    process.exit(1);
  }
  console.log(`\n→ substituído no slot de teste (v${teste.versao})`);
} else {
  const versao = Math.max(0, ...antes.map((d) => d.versao)) + 1;
  const r = await req(`${U}/rest/v1/ayla_documentos`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      chave: "core",
      versao,
      status: "rascunho",
      publicado_em: null,
      conteudo: texto,
      nota: "Core em teste — criado como slot único do simulador.",
    }),
  });
  if (!r.ok) {
    console.log(`❌ falha ao criar (${r.status}): ${(await r.text()).slice(0, 200)}`);
    process.exit(1);
  }
  const [nova] = await r.json();
  alvoId = nova.id;
  alvoVersao = nova.versao;
  console.log(`\n→ criado slot de teste (v${nova.versao})`);
}

// PROVA: leitura de volta + a ativa continua a mesma.
const rDepois = await req(`${U}/rest/v1/ayla_documentos?select=id,versao,status,conteudo&chave=eq.core&order=versao`);
const depois = await rDepois.json();
const gravado = depois.find((d) => d.id === alvoId);
const ativaDepois = depois.find((d) => d.status === "ativo");

const shaOk = sha(gravado.conteudo) === sha(texto);
const ativaIntacta =
  ativaAntes?.versao === ativaDepois?.versao && ativaAntes?.conteudo === ativaDepois?.conteudo;
const umSoTeste = depois.filter((d) => d.status === "rascunho").length === 1;

console.log("");
console.log(`  ${shaOk ? "✅" : "❌"} SHA arquivo = SHA banco (${gravado.conteudo.length} chars)`);
console.log(`  ${ativaIntacta ? "✅" : "❌"} Core ATIVO intacto — v${ativaDepois?.versao}`);
console.log(`  ${umSoTeste ? "✅" : "❌"} um só Core em teste`);
console.log("");
console.log("=== ESTADO ===");
for (const d of depois) {
  const rot = d.status === "ativo" ? "NO AR" : d.status === "rascunho" ? "EM TESTE" : "histórico";
  console.log(`  v${d.versao} ${rot.padEnd(10)} ${String(d.conteudo.length).padStart(6)} chars  ${sha(d.conteudo).slice(0, 16)}`);
}
console.log(`\nSHA do Core em teste (v${alvoVersao}): ${sha(gravado.conteudo)}`);
if (!shaOk || !ativaIntacta || !umSoTeste) process.exit(1);
