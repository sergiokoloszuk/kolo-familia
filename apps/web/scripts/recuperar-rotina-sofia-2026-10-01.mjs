import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

/**
 * Reparo controlado do único fluxo de `rotina_proposta` perdido entre
 * 27/09 e 04/10/2026.
 *
 * Seguro por padrão: sem `--apply` apenas confere o alvo. Com `--apply`, cria
 * ou reutiliza o quadro exato, relê identidade + etapas, cria o link e só então
 * envia uma única mensagem. Reexecução não duplica envio nem artefato.
 */

const APLICAR = process.argv.includes("--apply");
const argumento = (nome) => process.argv.find((x) => x.startsWith(`--${nome}=`))?.slice(nome.length + 3) ?? "";
const PROPOSTA_ID = argumento("proposta-id");
const FAMILY_ID = argumento("familia-id");
const MEMBRO_ID = argumento("membro-id");
const NOME_ROTINA = "Rotina da tarde da Sofia";
const TEMPLATE_KEY = "rotina_recuperacao_20261001";
const ETAPAS = [
  { texto: "Chegar em casa", hora: "17:30" },
  { texto: "Lanche", hora: "17:40" },
  { texto: "Brincadeira livre", hora: null },
  { texto: "Jantar", hora: "19:00" },
  { texto: "Banho", hora: "19:30" },
  { texto: "Dormir", hora: "20:00" },
];

if (!PROPOSTA_ID || !FAMILY_ID || !MEMBRO_ID) {
  throw new Error("Informe --proposta-id, --familia-id e --membro-id para travar a identidade do reparo.");
}

const obrigatorias = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  ...(APLICAR ? ["ZAPI_INSTANCE_ID", "ZAPI_TOKEN", "ZAPI_CLIENT_TOKEN"] : []),
];
for (const nome of obrigatorias) {
  if (!process.env[nome]) throw new Error(`Variável obrigatória ausente: ${nome}`);
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function etapasIguais(linhas) {
  const recebidas = [...(linhas ?? [])]
    .sort((a, b) => Number(a.ordem) - Number(b.ordem))
    .map((x) => ({ texto: String(x.texto), hora: x.hora ? String(x.hora) : null }));
  return JSON.stringify(recebidas) === JSON.stringify(ETAPAS);
}

async function conferirAlvo() {
  const [{ data: proposta, error: propostaErro }, { data: membro, error: membroErro }] =
    await Promise.all([
      db
        .from("ayla_messages")
        .select("id, family_account_id, membro_atipico_id, tipo, metadata, created_at")
        .eq("id", PROPOSTA_ID)
        .single(),
      db
        .from("membros_atipicos")
        .select("id, family_account_id, nome, ativo")
        .eq("id", MEMBRO_ID)
        .single(),
    ]);
  if (propostaErro) throw propostaErro;
  if (membroErro) throw membroErro;
  if (
    proposta.tipo !== "rotina_proposta" ||
    proposta.family_account_id !== FAMILY_ID ||
    proposta.membro_atipico_id !== MEMBRO_ID ||
    membro.family_account_id !== FAMILY_ID ||
    membro.ativo !== true ||
    membro.nome !== "Sofia"
  ) {
    throw new Error("Identidade do caso divergiu; reparo interrompido.");
  }
  return { proposta, membro };
}

async function jaFoiEnviada() {
  const [{ data: logs, error: logsErro }, { data: mensagens, error: mensagensErro }] =
    await Promise.all([
      db
        .from("ayla_send_log")
        .select("id, status, payload, created_at")
        .eq("family_account_id", FAMILY_ID)
        .eq("template_key", TEMPLATE_KEY)
        .order("created_at", { ascending: false })
        .limit(10),
      db
        .from("ayla_messages")
        .select("id, metadata, created_at")
        .eq("family_account_id", FAMILY_ID)
        .eq("direcao", "outbound")
        .eq("tipo", "rotina_conversa")
        .gte("created_at", "2026-10-01T12:31:57Z")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
  if (logsErro) throw logsErro;
  if (mensagensErro) throw mensagensErro;
  const peloLog = (logs ?? []).find(
    (x) => x.status === "enviada" && x.payload?.origem_proposta_id === PROPOSTA_ID,
  );
  const pelaMensagem = (mensagens ?? []).find(
    (x) => x.metadata?.recuperacao_rotina?.origem_proposta_id === PROPOSTA_ID,
  );
  return peloLog || pelaMensagem || null;
}

async function criarOuReusarRotina() {
  const { data: existentes, error: buscaErro } = await db
    .from("rotinas")
    .select("id, family_account_id, membro_atipico_id, nome, cards_status, tema, created_at")
    .eq("family_account_id", FAMILY_ID)
    .eq("membro_atipico_id", MEMBRO_ID)
    .eq("nome", NOME_ROTINA)
    .gte("created_at", "2026-10-04T00:00:00Z")
    .order("created_at", { ascending: false })
    .limit(1);
  if (buscaErro) throw buscaErro;

  let rotina = existentes?.[0] ?? null;
  if (!rotina) {
    const { data, error } = await db
      .from("rotinas")
      .insert({
        family_account_id: FAMILY_ID,
        membro_atipico_id: MEMBRO_ID,
        nome: NOME_ROTINA,
        dia_semana: null,
        tema: null,
        modo_exibicao: "cartoes",
        cards_status: "aguardando",
      })
      .select("id, family_account_id, membro_atipico_id, nome, cards_status, tema, created_at")
      .single();
    if (error) throw error;
    rotina = data;

    const { error: tarefasErro } = await db.from("rotina_tarefas").insert(
      ETAPAS.map((etapa, ordem) => ({
        rotina_id: rotina.id,
        texto: etapa.texto,
        hora: etapa.hora,
        ordem,
        icone: null,
      })),
    );
    if (tarefasErro) throw tarefasErro;
  }

  const [{ data: confirmada, error: rotinaErro }, { data: tarefas, error: tarefasErro }] =
    await Promise.all([
      db
        .from("rotinas")
        .select("id, family_account_id, membro_atipico_id, nome, cards_status, tema")
        .eq("id", rotina.id)
        .single(),
      db
        .from("rotina_tarefas")
        .select("texto, hora, ordem")
        .eq("rotina_id", rotina.id)
        .order("ordem", { ascending: true }),
    ]);
  if (rotinaErro) throw rotinaErro;
  if (tarefasErro) throw tarefasErro;
  if (
    confirmada.family_account_id !== FAMILY_ID ||
    confirmada.membro_atipico_id !== MEMBRO_ID ||
    confirmada.nome !== NOME_ROTINA ||
    !etapasIguais(tarefas)
  ) {
    throw new Error("Releitura da rotina divergiu do caso aprovado; envio interrompido.");
  }
  return confirmada;
}

async function criarLink(rotinaId) {
  const token = randomBytes(32).toString("base64url");
  const expiraEm = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const next = `/ludico/rotinas/${rotinaId}`;
  const { error } = await db.from("acessos_app").insert({
    family_account_id: FAMILY_ID,
    token,
    next,
    expira_em: expiraEm,
    criado_por: "ayla",
  });
  if (error) throw error;
  return `https://app.kolofamilia.com.br/auth/wa?k=${encodeURIComponent(token)}`;
}

async function enviarWhatsapp(phoneE164, texto) {
  const phone = phoneE164.replace(/^\+/, "");
  const url = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}/send-text`;
  const resposta = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": process.env.ZAPI_CLIENT_TOKEN,
    },
    body: JSON.stringify({ phone, message: texto }),
  });
  const rawText = await resposta.text();
  let raw = null;
  try {
    raw = JSON.parse(rawText);
  } catch {
    raw = { resposta: rawText.slice(0, 500) };
  }
  if (!resposta.ok) throw new Error(`Z-API ${resposta.status}: ${rawText.slice(0, 500)}`);
  const messageId = raw?.messageId ?? raw?.zaapId ?? null;
  if (!messageId) throw new Error("Z-API aceitou sem devolver messageId; envio não será declarado concluído.");
  return { messageId, raw };
}

async function run() {
  const { proposta } = await conferirAlvo();
  const enviada = await jaFoiEnviada();
  if (enviada) {
    console.log(JSON.stringify({ ok: true, idempotente: true, proposta: proposta.id.slice(0, 8) }));
    return;
  }

  if (!APLICAR) {
    console.log(
      JSON.stringify({
        ok: true,
        modo: "somente_leitura",
        proposta: proposta.id.slice(0, 8),
        membro: "Sofia",
        etapas: ETAPAS.length,
        envio_anterior: false,
      }),
    );
    return;
  }

  const { data: familia, error: familiaErro } = await db
    .from("family_accounts")
    .select("whatsapp_e164")
    .eq("id", FAMILY_ID)
    .single();
  if (familiaErro) throw familiaErro;
  if (!familia.whatsapp_e164) throw new Error("Família sem telefone; envio interrompido.");

  const rotina = await criarOuReusarRotina();
  const link = await criarLink(rotina.id);
  const texto =
    "A rotina da tarde da Sofia demorou mais do que deveria, mas já corrigimos isso.\n\n" +
    "Ela ficou com lanche às 17:40, jantar às 19:00, banho às 19:30 e dormir às 20:00.\n\n" +
    `*Confira a rotina*\n${link}\n\n` +
    "Se a ordem estiver certa, escolha um tema no app e toque em *Gerar cartões*. Desculpa pela demora 💛";

  const provider = await enviarWhatsapp(familia.whatsapp_e164, texto);
  const agora = new Date().toISOString();
  const metadata = {
    recuperacao_rotina: {
      origem_proposta_id: PROPOSTA_ID,
      rotina_id: rotina.id,
      motivo: "lote_perdeu_estado_especializado",
    },
    entrega: {
      canal: "z-api",
      aceito_pelo_provedor: true,
      aceito_em: agora,
      bolhas: 1,
      ids: [provider.messageId],
    },
  };
  const [log, mensagem, preferencia] = await Promise.all([
    db.from("ayla_send_log").insert({
      family_account_id: FAMILY_ID,
      template_key: TEMPLATE_KEY,
      payload: {
        phone: familia.whatsapp_e164,
        texto,
        origem_proposta_id: PROPOSTA_ID,
        rotina_id: rotina.id,
      },
      resposta_provider: provider.raw,
      status: "enviada",
      erro: null,
    }),
    db
      .from("ayla_messages")
      .insert({
        family_account_id: FAMILY_ID,
        membro_atipico_id: MEMBRO_ID,
        direcao: "outbound",
        category: "proativa",
        tipo: "rotina_conversa",
        texto,
        enviada_em: agora,
        zaap_message_id: provider.messageId,
        metadata,
      })
      .select("id")
      .single(),
    db.from("ayla_preferences").update({ ultima_mensagem_em: agora }).eq("family_account_id", FAMILY_ID),
  ]);
  if (log.error) throw new Error(`Envio aceito, mas ayla_send_log falhou: ${log.error.message}`);
  if (mensagem.error) throw new Error(`Envio aceito, mas ayla_messages falhou: ${mensagem.error.message}`);
  if (preferencia.error) throw new Error(`Envio aceito, mas preferência falhou: ${preferencia.error.message}`);

  console.log(
    JSON.stringify({
      ok: true,
      proposta: PROPOSTA_ID.slice(0, 8),
      rotina: rotina.id.slice(0, 8),
      etapas: ETAPAS.length,
      mensagem: mensagem.data.id.slice(0, 8),
      aceito_pelo_provedor: true,
      message_id: provider.messageId,
    }),
  );
}

run().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
});
