import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const TARGET = "https://permissions-infringement-dos-equity.trycloudflare.com/api/ayla/webhook";
const { ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN } = process.env;
const base = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}`;

const attempts = [
  { path: "/update-webhook-received", body: { value: TARGET } },
  { path: "/update-webhook-received", body: { value: TARGET, enabled: true } },
  { path: "/update-webhook-received", body: { url: TARGET } },
  { path: "/update-webhook-received-message", body: { value: TARGET } },
  { path: "/update-every-webhook", body: { value: TARGET } },
];

for (const a of attempts) {
  const res = await fetch(`${base}${a.path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Client-Token": ZAPI_CLIENT_TOKEN },
    body: JSON.stringify(a.body),
  });
  console.log(`PUT ${a.path}  body=${JSON.stringify(a.body)}`);
  console.log(`  → HTTP ${res.status}: ${(await res.text()).slice(0, 200)}\n`);
}

// Manda uma mensagem TESTE pro nosso próprio número e vê se a Z-API
// gera um ReceivedCallback (não vai, porque é fromMe). Mas se gerar status
// callback, sabemos que a config está OK.
console.log("\n=== status atual da instância ===");
const st = await fetch(`${base}/status`, { headers: { "Client-Token": ZAPI_CLIENT_TOKEN } });
console.log(`HTTP ${st.status}: ${await st.text()}`);

console.log("\n=== mensagens dispositivos conectados ===");
const dev = await fetch(`${base}/device`, { headers: { "Client-Token": ZAPI_CLIENT_TOKEN } });
console.log(`HTTP ${dev.status}: ${await dev.text()}`);
