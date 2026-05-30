import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const { ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN } = process.env;
const base = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}`;

// Z-API tem várias rotas pra ver os webhooks configurados
const endpoints = [
  "/webhook-received",
  "/webhook-delivery",
  "/webhook-message-status",
  "/webhook-receive-all-notifications",
];

for (const ep of endpoints) {
  const url = `${base}${ep}`;
  console.log(`\n→ GET ${ep}`);
  try {
    const res = await fetch(url, { headers: { "Client-Token": ZAPI_CLIENT_TOKEN } });
    console.log(`  HTTP ${res.status}:`, await res.text());
  } catch (e) {
    console.log(`  erro:`, e.message);
  }
}
