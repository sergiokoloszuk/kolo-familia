import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const phone = process.argv[2]?.replace(/^\+/, "") ?? "5511966220221";
const message = process.argv[3] ?? "Teste direto Z-API — Kolo Família";

const { ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN } = process.env;
console.log("envs carregadas:", {
  instance: ZAPI_INSTANCE_ID?.slice(0, 8) + "...",
  token: ZAPI_TOKEN?.slice(0, 8) + "...",
  clientToken: ZAPI_CLIENT_TOKEN?.slice(0, 8) + "...",
});

// 1. Verifica o status da instância primeiro
const statusUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/status`;
console.log("\n→ GET status:", statusUrl);
const statusRes = await fetch(statusUrl, {
  headers: { "Client-Token": ZAPI_CLIENT_TOKEN },
});
console.log("status HTTP:", statusRes.status);
console.log("status body:", await statusRes.text());

// 2. Tenta o send-text
const sendUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
console.log("\n→ POST send-text:", sendUrl);
console.log("   phone:", phone);
console.log("   message:", message);
const res = await fetch(sendUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Client-Token": ZAPI_CLIENT_TOKEN,
  },
  body: JSON.stringify({ phone, message }),
});
console.log("\nsend HTTP:", res.status);
console.log("send body:", await res.text());
