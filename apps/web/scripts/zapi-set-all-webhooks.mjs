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
if (!target) { console.error("uso: <URL>"); process.exit(1); }

const { ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN } = process.env;
const base = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}`;
const url = `${target.replace(/\/$/, "")}/api/ayla/webhook`;

const endpoints = [
  "update-webhook-received",
  "update-webhook-delivery",
  "update-webhook-disconnected",
  "update-webhook-message-status",
  "update-webhook-presence",
  "update-webhook-receive-all-notifications",
  "update-webhook-chat-presence",
];

for (const ep of endpoints) {
  const res = await fetch(`${base}/${ep}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Client-Token": ZAPI_CLIENT_TOKEN },
    body: JSON.stringify({ value: url }),
  });
  const body = await res.text();
  const ok = res.status === 200 && !body.includes("error");
  console.log(`${ok ? "✓" : "✗"} ${ep.padEnd(45)} HTTP ${res.status} ${body}`);
}

// Verifica se o "notifySentByMe" precisa ficar off (não queremos webhook dos enviados)
console.log("\n--- desativando notify-sent-by-me ---");
for (const ep of ["update-notify-sent-by-me/false", "remove-notify-sent-by-me"]) {
  try {
    const res = await fetch(`${base}/${ep}`, {
      method: "PUT",
      headers: { "Client-Token": ZAPI_CLIENT_TOKEN },
    });
    console.log(`${ep}: HTTP ${res.status} ${await res.text()}`);
  } catch (e) {
    console.log(`${ep}: erro`);
  }
}
