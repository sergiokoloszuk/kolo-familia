/**
 * POVOAMENTO INICIAL DOS DOCUMENTOS DA AYLA.
 *
 * ⚠️ SÓ CADASTRA O QUE TEM FONTE TEXTUAL FIEL. Trial, Plano, Cartões Visuais e
 * Fontes Confiáveis só existem como PDF nesta frente, e PROVEI que a extração
 * de PDF corrompe (💛 vira ■, Markdown se perde). Transcrevê-los seria inventar
 * conteúdo com cara de oficial — então eles ficam aguardando colagem no Admin.
 *
 * ⚠️ MESMO MECANISMO DO ADMIN: versão = max+1, nasce `arquivado` com
 * `publicado_em` nulo (= candidata). POVOAR NÃO É ATIVAR.
 *
 * Uso:  node scripts/documentos-povoar.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const RAIZ = "d:/Projetos/Kolo Família";
const env = {};
for (const l of readFileSync(`${RAIZ}/apps/web/.env.local`, "utf8").split(/\r?\n/)) {
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
      // ⚠️ MESCLA os headers em vez de substituir. A primeira versão fazia
      // `headers: H` e apagava o `Prefer: return=representation` do insert — o
      // corpo voltava vazio e o script estourava no JSON.parse.
      const r = await fetch(url, {
        ...init,
        headers: { ...H, ...(init?.headers ?? {}) },
        signal: AbortSignal.timeout(30000),
      });
      return r;
    } catch (e) {
      console.log(`  tentativa ${i} falhou: ${e.cause?.code ?? e.message}`);
      await sleep(3000);
    }
  }
  throw new Error("sem conexão");
}

/** O que tem fonte textual fiel HOJE. Os outros quatro ficam de fora, de propósito. */
const FONTES = [
  {
    chave: "trial",
    arquivo: `${RAIZ}/docs/documentos-ayla/trial-v1.md`,
    nota: "Trial D0–D7 v2 — texto integral fornecido pela Karina no chat, transcrito sem resumir, completar ou reescrever.",
  },
  {
    chave: "cartoes_visuais",
    arquivo: `${RAIZ}/docs/documentos-ayla/cartoes-visuais-v1.md`,
    nota: "Cartões Visuais v1 — texto integral fornecido pela Karina no chat, transcrito sem resumir, completar ou reescrever.",
  },
  {
    chave: "plano",
    arquivo: `${RAIZ}/docs/documentos-ayla/plano-v1.md`,
    nota: "Plano Ayla — documento mestre, texto integral fornecido pela Karina no chat, transcrito sem resumir, completar ou reescrever.",
  },
];

const AGUARDANDO = ["fontes_confiaveis"];

for (const f of FONTES) {
  if (!existsSync(f.arquivo)) {
    console.log(`❌ ${f.chave}: arquivo não encontrado — ${f.arquivo}`);
    continue;
  }
  const texto = readFileSync(f.arquivo, "utf8");
  const shaArquivo = sha(texto);
  console.log(`\n=== ${f.chave} ===`);
  console.log(`  arquivo : ${texto.length} chars · sha ${shaArquivo.slice(0, 16)}…`);

  const rLer = await req(`${U}/rest/v1/ayla_documentos?select=versao,conteudo&chave=eq.${f.chave}&order=versao.desc`);
  if (!rLer.ok) {
    console.log(`  ❌ falha ao ler versões (${rLer.status})`);
    continue;
  }
  const existentes = await rLer.json();
  const maisNova = existentes[0];
  if (maisNova && maisNova.conteudo === texto) {
    console.log(`  ⏭  já existe como v${maisNova.versao} com o mesmo conteúdo — nada a fazer.`);
    continue;
  }
  const versao = (maisNova?.versao ?? 0) + 1;

  const rIns = await req(`${U}/rest/v1/ayla_documentos`, {
    method: "POST",
    headers: { ...H, Prefer: "return=representation" },
    body: JSON.stringify({
      chave: f.chave,
      versao,
      status: "arquivado", // candidata — POVOAR ≠ ATIVAR
      publicado_em: null,
      conteudo: texto,
      nota: f.nota,
    }),
  });
  if (!rIns.ok) {
    console.log(`  ❌ falha ao inserir (${rIns.status}): ${(await rIns.text()).slice(0, 200)}`);
    continue;
  }
  const [linha] = await rIns.json();

  // PROVA: leitura de volta, do banco, comparando SHA.
  const rVolta = await req(`${U}/rest/v1/ayla_documentos?select=conteudo,status,publicado_em&id=eq.${linha.id}`);
  const [volta] = await rVolta.json();
  const shaBanco = sha(volta.conteudo);
  console.log(`  banco   : ${volta.conteudo.length} chars · sha ${shaBanco.slice(0, 16)}…`);
  console.log(`  versão  : v${linha.versao} · status ${volta.status} · publicado_em ${volta.publicado_em}`);
  console.log(
    shaArquivo === shaBanco
      ? "  ✅ SHA arquivo = SHA banco (ida e volta byte a byte)"
      : "  ❌ SHA DIVERGIU — o texto foi alterado no caminho",
  );
  if (shaArquivo !== shaBanco) process.exitCode = 1;
}

console.log(`\n=== AGUARDANDO COLAGEM NO ADMIN ===`);
for (const c of AGUARDANDO) {
  console.log(`  · ${c} — única fonte é PDF; não transcrevo, não reconstruo.`);
}

const rFim = await req(`${U}/rest/v1/ayla_documentos?select=chave,versao,status&order=chave,versao`);
console.log(`\n=== ESTADO FINAL DA TABELA ===`);
for (const d of await rFim.json()) console.log(`  ${d.chave} v${d.versao} ${d.status}`);
