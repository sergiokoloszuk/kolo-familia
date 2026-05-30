import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const target = process.argv[2];
if (!target) {
  console.error("uso: node scripts/zapi-set-webhook.mjs <URL_PUBLICA>");
  process.exit(1);
}

const { ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN } = process.env;
const base = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}`;
const webhookUrl = `${target.replace(/\/$/, "")}/api/ayla/webhook`;

console.log("Setando webhooks Z-API → ", webhookUrl, "\n");

const endpoints = [
  { name: "on-message-received", path: "/update-webhook-received" },
  { name: "on-message-delivery", path: "/update-webhook-delivery" },
];

for (const ep of endpoints) {
  const url = `${base}${ep.path}`;
  console.log(`PUT ${ep.name}:`);
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Client-Token": ZAPI_CLIENT_TOKEN },
    body: JSON.stringify({ value: webhookUrl }),
  });
  console.log(`  HTTP ${res.status}:`, await res.text());
}
