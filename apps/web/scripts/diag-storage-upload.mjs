import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
console.log("URL:", url);

const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const path = `diag/teste-${Date.now()}.png`;
const conteudo = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

console.log(`\nTentando upload em imagens/${path} com SERVICE ROLE...`);
const { data, error } = await supabase.storage
  .from("imagens")
  .upload(path, conteudo, { contentType: "image/png", upsert: true });

if (error) {
  console.log("❌ FALHOU");
  console.log("  message:", error.message);
  console.log("  name:", error.name);
  console.log("  status:", error.statusCode ?? error.status ?? "(sem status)");
  console.log("  raw:", JSON.stringify(error));
} else {
  console.log("✅ UPLOAD OK:", data?.path);
  const { error: delErr } = await supabase.storage.from("imagens").remove([path]);
  console.log(delErr ? `  (não consegui limpar: ${delErr.message})` : "  (limpo)");
}
