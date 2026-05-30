import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, "..", ".env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const KEY = process.env.OPENAI_API_KEY;

// 1. Pega um avatar com imagem
const { data: avs } = await admin
  .from("avatares_membros_atipicos")
  .select("membro_atipico_id, estilo, imagem_url")
  .not("imagem_url", "is", null)
  .limit(1);
if (!avs?.length) {
  console.log("Nenhum avatar com imagem no banco. Gere um avatar primeiro.");
  process.exit(0);
}
const av = avs[0];
console.log("avatar:", av.estilo, av.imagem_url);

// 2. Baixa o avatar e salva pra eu poder ver
const avRes = await fetch(av.imagem_url);
const avBuf = Buffer.from(await avRes.arrayBuffer());
writeFileSync(resolve(here, "_test-avatar.png"), avBuf);
console.log("avatar salvo em scripts/_test-avatar.png (", avBuf.length, "bytes )");

// 3. Chama /v1/images/edits passando o avatar como referência + cena nova
const fd = new FormData();
fd.append("model", "gpt-image-1");
fd.append("image", new Blob([avBuf], { type: "image/png" }), "avatar.png");
fd.append(
  "prompt",
  "A MESMA criança da imagem de referência (mesmo rosto, cabelo, tom de pele e estilo de ilustração), agora numa cena de cozinha alegre, cozinhando um 'ovo de dinossauro' (uma abóbora) numa panela. Livro infantil, mesma identidade visual. Sem texto na imagem.",
);
fd.append("size", "1024x1024");
fd.append("quality", "medium");

const t0 = Date.now();
const res = await fetch("https://api.openai.com/v1/images/edits", {
  method: "POST",
  headers: { Authorization: `Bearer ${KEY}` },
  body: fd,
});
console.log("edits status:", res.status, "em", ((Date.now() - t0) / 1000).toFixed(1) + "s");
if (!res.ok) {
  console.log("erro:", (await res.text()).slice(0, 600));
  process.exit(0);
}
const j = await res.json();
const b64 = j.data?.[0]?.b64_json;
if (!b64) {
  console.log("sem b64_json. resposta:", JSON.stringify(j).slice(0, 300));
  process.exit(0);
}
writeFileSync(resolve(here, "_test-cena.png"), Buffer.from(b64, "base64"));
console.log("cena salva em scripts/_test-cena.png");
