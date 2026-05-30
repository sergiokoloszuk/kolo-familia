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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const TEMPLATES = [
  {
    key: "boas_vindas",
    label: "Boas-vindas",
    description: "Primeira mensagem após onboarding concluído.",
    category: "proativa",
    variables: ["nomeMae", "nomeMembro"],
    variations: [
      "Oi, {nomeMae}. Sou a Ayla 🌿\n\nObrigada por confiar a gente com a história do/da {nomeMembro}. A partir de agora vou aparecer por aqui pra te perguntar como foi o dia — sem cobrança, só pra organizar junto.\n\nQuando quiser, é só me escrever. Digite AJUDA pra ver os comandos.",
      "{nomeMae}, oi! Aqui é a Ayla.\n\nCadastro concluído ✅. Daqui pra frente vou te mandar uma perguntinha por dia sobre o/a {nomeMembro} — uma conquista e um desafio bastam.\n\nVocê pode pausar (PAUSAR), mudar horário (MUDAR HORARIO 20:00) ou sair (SAIR) quando quiser.",
      "Oi, {nomeMae} 🌿\n\nSou a Ayla. A partir de hoje fico do seu lado pra organizar o dia a dia com o/a {nomeMembro}. Sem pressa, sem cobrança.\n\nResponde quando der. Se precisar de ajuda, digite AJUDA.",
    ],
  },
  {
    key: "rotina",
    label: "Pergunta diária de rotina",
    description: "Pergunta enviada no horário preferido — uma conquista e um desafio.",
    category: "proativa",
    variables: ["nomeMae", "nomeMembro"],
    variations: [
      "Oi, {nomeMae}.\nComo foi o dia do/da {nomeMembro}?\n\nMe conta só 2 coisas:\n1. uma conquista, mesmo pequena\n2. um desafio que apareceu hoje",
      "{nomeMae}, oi.\nE aí, como foi o dia hoje com {nomeMembro}?\n\nUma conquista + um desafio é suficiente.",
      "Oi! Como foi o dia do/da {nomeMembro} hoje?\n\nQuando puder responder: uma coisa boa e uma difícil.",
      "Oi, {nomeMae} 🌿\nComo está o dia? Conta uma coisa que deu certo e uma que foi difícil com {nomeMembro}.",
      "{nomeMae}, fim de dia. Como foi com {nomeMembro}?\n\nUma conquista + um desafio bastam — pode ser frase curta.",
    ],
  },
  {
    key: "engajamento_2dias",
    label: "Engajamento (2 dias sem responder)",
    description: "Mensagem após 2 dias sem registro.",
    category: "proativa",
    variables: ["nomeMae", "nomeMembro"],
    variations: [
      "Oi, {nomeMae}. Sumida há uns dias — está tudo bem aí?\n\nSe quiser me contar uma coisa do dia hoje, qualquer frase serve.",
      "{nomeMae}, faltou seu registro nesses dias. Tudo bem?\n\nUma frase curta sobre como vocês estão já ajuda.",
      "Oi! Não te ouvi nos últimos dias 🌿. Está tudo bem com {nomeMembro}?",
    ],
  },
  {
    key: "engajamento_5dias",
    label: "Engajamento (5 dias sem responder)",
    description: "Mensagem após 5 dias sem registro.",
    category: "proativa",
    variables: ["nomeMae", "nomeMembro"],
    variations: [
      "{nomeMae}, faz alguns dias que não nos falamos. Sem cobrança — quero só saber se estão bem.\n\nSe puder responder, mesmo que com 'tudo bem', já me conforta.",
      "Oi, {nomeMae}. Caí da rotina aqui sem você 😅. Me conta uma coisa do dia quando puder.",
    ],
  },
  {
    key: "trial_d3",
    label: "Trial faltam 3 dias",
    description: "Aviso de fim do trial em 3 dias.",
    category: "proativa",
    variables: ["nomeMae"],
    variations: [
      "Oi, {nomeMae}. Te lembrando que seus 30 dias grátis terminam em 3 dias.\n\nSe quiser continuar, entra em /assinatura quando der.",
      "{nomeMae}, faltam 3 dias do seu trial. Sem pressão — só pra você não ser pega de surpresa.",
    ],
  },
  {
    key: "trial_d0",
    label: "Trial último dia",
    description: "Aviso de último dia do trial.",
    category: "proativa",
    variables: ["nomeMae"],
    variations: [
      "Oi, {nomeMae}. Hoje é o último dia do seu trial 🌿\n\nSe quiser seguir, é só assinar em /assinatura. Cancela quando quiser.",
      "{nomeMae}, hoje termina seu trial. Tudo que você registrou continua aqui — pra continuar usando, é só assinar.",
    ],
  },
  {
    key: "emocional_streak",
    label: "Streak emocional (7 dias)",
    description: "Reconhecimento ao completar 7 dias seguidos de registros.",
    category: "proativa",
    variables: ["nomeMae", "nomeMembro"],
    variations: [
      "{nomeMae}, você registrou 7 dias seguidos. Isso é cuidado de verdade — o/a {nomeMembro} está tendo uma mãe bem presente. 🌿",
      "Sete dias de papo seguidos, {nomeMae}. Você tá fazendo um trabalho enorme com {nomeMembro}.",
    ],
  },
  {
    key: "clarificacao_membro",
    label: "Clarificação — sobre quem",
    description: "Pergunta de desambiguação quando a família tem 2+ membros.",
    category: "reativa",
    variables: ["opcoes"],
    variations: ["Sobre quem você está falando? {opcoes}?"],
  },
  {
    key: "clarificacao_conteudo",
    label: "Clarificação — conteúdo",
    description: "Pergunta quando o parser não entendeu o que aconteceu.",
    category: "reativa",
    variables: [],
    variations: [
      "Não consegui entender direito o que aconteceu. Pode me contar de outro jeito? Uma frase curta serve.",
    ],
  },
  {
    key: "comando_ajuda",
    label: "Comando AJUDA",
    description: "Resposta ao comando AJUDA. Lista os comandos disponíveis.",
    category: "comando",
    variables: [],
    variations: [
      "Comandos disponíveis:\n• PAUSAR ou PAUSAR 7 — pausa minhas mensagens\n• MUDAR HORARIO 20:00 — atualiza o horário das perguntas diárias\n• SAIR — desativa as mensagens (mantém seus dados)\n• AJUDA — mostra esta lista",
    ],
  },
  {
    key: "comando_pausada",
    label: "Comando PAUSAR",
    description: "Confirmação quando o usuário pausa as mensagens.",
    category: "comando",
    variables: ["dias_label"],
    variations: ["Pausada por {dias_label}. Volto depois — pode escrever a qualquer hora se quiser falar antes."],
  },
  {
    key: "comando_horario_mudado",
    label: "Comando MUDAR HORARIO",
    description: "Confirmação após alterar o horário das perguntas diárias.",
    category: "comando",
    variables: ["hora"],
    variations: ["Anotado, vou perguntar às {hora}."],
  },
  {
    key: "comando_sair",
    label: "Comando SAIR",
    description: "Confirmação quando o usuário desativa as mensagens.",
    category: "comando",
    variables: [],
    variations: [
      "Desativada. Seus dados continuam aqui, e quando quiser voltar é só me responder qualquer coisa.",
    ],
  },
];

console.log(`Seedando ${TEMPLATES.length} templates...`);

for (const t of TEMPLATES) {
  const { error } = await supabase.from("ayla_message_templates").upsert(
    {
      key: t.key,
      label: t.label,
      description: t.description,
      category: t.category,
      variations: t.variations,
      variables: t.variables,
      ativo: true,
    },
    { onConflict: "key" },
  );
  if (error) console.log(`❌ ${t.key}: ${error.message}`);
  else console.log(`✅ ${t.key} (${t.variations.length} variações)`);
}

const { count } = await supabase
  .from("ayla_message_templates")
  .select("key", { count: "exact", head: true });
console.log(`\nTotal final: ${count ?? 0} templates no DB.`);
