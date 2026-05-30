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

const email = process.argv[2] ?? "sergiokoloszuk.sk@gmail.com";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// 1. Pega family_id
let userId = null;
for (let page = 1; page <= 50; page++) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw new Error(error.message);
  const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (found) { userId = found.id; break; }
  if (data.users.length < 200) break;
}
if (!userId) { console.log("user not found"); process.exit(0); }

const { data: family } = await supabase
  .from("family_accounts")
  .select("id, whatsapp_e164")
  .eq("user_id", userId)
  .single();

const familyId = family.id;
const agora = new Date();
console.log(`▶ Simulando sendBoasVindas pra family=${familyId}\n`);

// 2. Gate 1: podeEnviarProativa
const { data: prefs } = await supabase
  .from("ayla_preferences")
  .select("consentimento_em, pausada_ate, desativada")
  .eq("family_account_id", familyId)
  .maybeSingle();
console.log("Gate consent:", prefs);
if (!prefs) { console.log("❌ Sem ayla_preferences"); process.exit(0); }
if (!prefs.consentimento_em) { console.log("❌ Sem consentimento"); process.exit(0); }
if (prefs.desativada) { console.log("❌ Desativada"); process.exit(0); }
if (prefs.pausada_ate && new Date(prefs.pausada_ate) > agora) { console.log("❌ Pausada"); process.exit(0); }

const inicioDoDia = new Date(agora); inicioDoDia.setHours(0, 0, 0, 0);
const { data: enviadasHoje } = await supabase
  .from("ayla_messages")
  .select("id, tipo")
  .eq("family_account_id", familyId)
  .eq("category", "proativa")
  .eq("direcao", "outbound")
  .gte("created_at", inicioDoDia.toISOString());
console.log("Gate daily limit: enviadas hoje =", enviadasHoje?.length ?? 0);
if ((enviadasHoje?.length ?? 0) >= 2) { console.log("❌ Limite 2/dia"); process.exit(0); }

// silêncio total
const { data: ultRespArr } = await supabase
  .from("ayla_messages").select("created_at")
  .eq("family_account_id", familyId).eq("direcao", "inbound")
  .order("created_at", { ascending: false }).limit(1);
const { data: priOutArr } = await supabase
  .from("ayla_messages").select("created_at")
  .eq("family_account_id", familyId).eq("direcao", "outbound")
  .order("created_at", { ascending: true }).limit(1);
const ref = (ultRespArr?.length ? ultRespArr[0].created_at : priOutArr?.[0]?.created_at);
console.log("Gate silêncio total: ref =", ref ?? "undefined → permitido");
if (ref) {
  const dias = (agora - new Date(ref)) / 86400000;
  if (dias > 10) { console.log("❌ Silêncio 10d"); process.exit(0); }
}

// 3. Idempotência
const { data: jaEnviada } = await supabase
  .from("ayla_messages").select("id")
  .eq("family_account_id", familyId).eq("tipo", "boas_vindas").eq("direcao", "outbound").limit(1);
console.log("Gate idempotência:", jaEnviada?.length ?? 0);
if ((jaEnviada?.length ?? 0) > 0) { console.log("❌ Já enviou"); process.exit(0); }

// 4. Contexto
const [{ data: fam }, { data: profile }, { data: membros }] = await Promise.all([
  supabase.from("family_accounts").select("id, whatsapp_e164").eq("id", familyId).maybeSingle(),
  supabase.from("family_profiles").select("nome_mae, como_chamar").eq("family_account_id", familyId).maybeSingle(),
  supabase.from("membros_atipicos").select("id, nome").eq("family_account_id", familyId).eq("ativo", true).order("created_at", { ascending: true }),
]);
console.log("Contexto: whatsapp=", fam?.whatsapp_e164, "membros=", membros?.length ?? 0, "nomeMae=", profile?.como_chamar || profile?.nome_mae);

if (!fam?.whatsapp_e164 || !(membros?.length)) { console.log("❌ Sem contexto"); process.exit(0); }

const nomeMae = profile?.como_chamar?.trim() || profile?.nome_mae?.trim().split(/\s+/)[0] || "oi";
const nomeMembro = membros[0].nome;
const texto = `Oi, ${nomeMae}. Sou a Ayla 🌿\n\nObrigada por confiar a gente com a história do/da ${nomeMembro}. A partir de agora vou aparecer por aqui pra te perguntar como foi o dia — sem cobrança, só pra organizar junto.\n\nQuando quiser, é só me escrever. Digite AJUDA pra ver os comandos.`;

console.log("\n✅ Todos os gates passaram. Enviando via Z-API...\n");

const phone = fam.whatsapp_e164.replace(/^\+/, "");
const sendUrl = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}/send-text`;
const res = await fetch(sendUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Client-Token": process.env.ZAPI_CLIENT_TOKEN },
  body: JSON.stringify({ phone, message: texto }),
});
const bodyText = await res.text();
console.log(`Z-API HTTP ${res.status}:`, bodyText);

let providerResp = null;
try { providerResp = JSON.parse(bodyText); } catch {}

const enviada = res.ok;

await supabase.from("ayla_send_log").insert({
  family_account_id: familyId,
  template_key: "boas_vindas",
  payload: { phone, texto },
  resposta_provider: providerResp,
  status: enviada ? "enviada" : "falha",
  erro: enviada ? null : bodyText.slice(0, 500),
});

if (enviada) {
  await supabase.from("ayla_messages").insert({
    family_account_id: familyId,
    membro_atipico_id: membros[0].id,
    direcao: "outbound",
    category: "proativa",
    tipo: "boas_vindas",
    texto,
    enviada_em: new Date().toISOString(),
  });
  await supabase.from("ayla_preferences").update({ ultima_mensagem_em: new Date().toISOString() }).eq("family_account_id", familyId);
}

console.log(`\n${enviada ? "✅ Enviada com sucesso" : "❌ Falha"} — ayla_send_log atualizado`);
