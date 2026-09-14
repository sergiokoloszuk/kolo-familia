/**
 * OBSERVAÇÃO DO LID — o que precisamos aprender para consertar de verdade.
 *
 * ⚠️ O PATCH DE 14/09 SÓ PAROU A MENTIRA, NÃO O PREJUÍZO. A família que chega
 * com um identificador `@lid` deixou de receber "não encontrei um cadastro com
 * este número" — mas continua sem resposta, porque o LID não diz quem ela é.
 * Este script existe para transformar esse silêncio em evidência, e a evidência
 * na correção definitiva.
 *
 * A PERGUNTA QUE ELE PRECISA RESPONDER, e que hoje não tem resposta:
 *   **a Z-API manda o telefone real em algum outro campo do payload?**
 * Se mandar, a correção é ler aquele campo. Se não mandar, a correção é outra
 * (correlação por `messageId`, ou configuração na Z-API) — e são caminhos
 * diferentes o bastante para não se escolher no palpite.
 *
 * ⚠️ NÃO PROPÕE MAPEAMENTO LID → FAMÍLIA. De propósito. Associar uma mensagem
 * à família errada é pior que não associar: seria a Ayla respondendo sobre a
 * criança de outra pessoa. Enquanto não houver evidência do payload, o correto
 * é continuar em silêncio e medir.
 *
 *   node scripts/observacao-lid.mjs [--desde 2026-09-14]
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const env = {};
for (const linha of readFileSync(resolve(AQUI, "../apps/web/.env.local"), "utf8").split(/\r?\n/)) {
  const m = linha.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

async function q(path) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, {
    headers: { apikey: KEY, authorization: `Bearer ${KEY}` },
  });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

const i = process.argv.indexOf("--desde");
const DESDE = i > 0 ? process.argv[i + 1] : "2026-08-01";

const perdas = await q(
  `eventos_app?kind=eq.ayla_identificador_nao_telefone&created_at=gte.${DESDE}&select=created_at,message,payload&order=created_at.asc&limit=500`,
);
const recebidos = await q(
  `eventos_app?kind=eq.ayla_inbound_desconhecido&created_at=gte.${DESDE}&select=created_at,payload&order=created_at.asc&limit=500`,
);
const respondidos = await q(
  `eventos_app?kind=eq.ayla_desconhecido_respondido&created_at=gte.${DESDE}&select=created_at,payload&order=created_at.asc&limit=500`,
);

const comArroba = recebidos.filter((r) => String(r.payload?.phone ?? "").includes("@"));
const falsosEnviados = respondidos.filter((r) => {
  // o evento de resposta guarda só a chave; casa-se pela chave do recebido
  const chavesComArroba = new Set(comArroba.map((x) => x.payload?.chave));
  return chavesComArroba.has(r.payload?.chave);
});

console.log(`\n=== OBSERVAÇÃO DO LID — desde ${DESDE} ===\n`);
console.log(`mensagens de família perdidas (inbound com @) : ${comArroba.length}`);
console.log(`identificadores @ distintos                   : ${new Set(comArroba.map((r) => r.payload?.phone)).size}`);
console.log(`falsos "não encontrei cadastro" enviados       : ${falsosEnviados.length}`);
console.log(`eventos do patch novo (pós 14/09)             : ${perdas.length}`);

// ── quantas ocorrências são da MESMA conversa, e não de pessoas diferentes
const porId = new Map();
for (const r of comArroba) {
  const id = r.payload?.phone;
  if (!porId.has(id)) porId.set(id, []);
  porId.get(id).push(r.created_at);
}
console.log(`\n--- repetição por identificador ---`);
for (const [id, quando] of porId) {
  const janela =
    quando.length > 1
      ? `${((new Date(quando.at(-1)) - new Date(quando[0])) / 60000).toFixed(0)} min entre a 1ª e a última`
      : "ocorrência única";
  console.log(`  ${String(id).slice(0, 26).padEnd(26)} ${String(quando.length).padStart(2)}x · ${janela}`);
  for (const w of quando) console.log(`      ${w.slice(0, 19).replace("T", " ")}`);
}

// ── sufixos: separar LID de grupo/broadcast
const sufixos = new Map();
for (const r of [...comArroba, ...perdas]) {
  const s = String(r.payload?.sufixo ?? String(r.payload?.phone ?? "").split("@")[1] ?? "?");
  sufixos.set(s, (sufixos.get(s) ?? 0) + 1);
}
console.log(`\n--- tipo de identificador ---`);
for (const [s, n] of [...sufixos].sort((a, b) => b[1] - a[1])) console.log(`  @${s}: ${n}`);

// ── crescimento: é a migração do WhatsApp avançando?
const porMes = new Map();
for (const r of comArroba) {
  const k = r.created_at.slice(0, 7);
  porMes.set(k, (porMes.get(k) ?? 0) + 1);
}
console.log(`\n--- crescimento por mês ---`);
for (const [k, n] of [...porMes].sort()) console.log(`  ${k}: ${n}`);

console.log(`
--- O QUE AINDA FALTA, E ONDE ESTÁ ---

O campo alternativo com o telefone real NÃO está no banco: o payload cru da
Z-API só vai para stdout. O patch de 14/09 passou a registrar as CHAVES do
payload (nomes de campo, sem valores) quando o remetente vem como LID:

  Vercel → Logs → filtrar por: IDENTIFICADOR NÃO-TELEFONE

A linha traz o array de campos de primeiro nível. É com ela que se decide:
  · existe 'senderPhone', 'participantPhone', 'chatPhone' ou equivalente?
      → a correção é ler esse campo em parseZapiWebhook;
  · só vem o LID?
      → a correção é outra: correlação por messageId ou ajuste na Z-API.

⚠️ NÃO IMPLEMENTAR MAPEAMENTO LID → FAMÍLIA SEM ESSA EVIDÊNCIA. Associar a
mensagem à família errada é pior do que não associar — seria a Ayla respondendo
sobre a criança de outra pessoa.
`);
