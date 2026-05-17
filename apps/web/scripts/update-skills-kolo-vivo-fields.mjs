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

// Mapeamento Adendo PRD v1 §6: skill → gaveta espelho + campos auxiliares.
// O primeiro campo da array é a gaveta espelho primária.
const UPDATES = [
  // === Skills existentes — atualizar kolo_vivo_fields ===
  {
    name: "sensorial",
    ativo: true,
    kolo_vivo_fields: ["sensorial", "essencial", "corpo_rotina"],
    notes: "Espelho: sensorial (legado top-level)",
  },
  {
    name: "comunicacao",
    ativo: true,
    kolo_vivo_fields: ["comunicacao", "essencial", "como_e"],
    notes: "Espelho: comunicacao (novo, categorias_extras)",
  },
  {
    name: "regulacao_emocional",
    ativo: true,
    kolo_vivo_fields: ["desafios_regulacao", "essencial", "como_e"],
    notes: "Espelho: desafios_regulacao + essencial (Emocional)",
  },
  {
    name: "sono",
    ativo: true,
    kolo_vivo_fields: ["sono", "corpo_rotina", "sensorial", "essencial"],
    notes: "Espelho: sono (novo, categorias_extras) + contexto rotina/sensorial",
  },
  {
    name: "transicoes",
    ativo: true,
    kolo_vivo_fields: ["corpo_rotina", "essencial"],
    notes: "Espelho: corpo_rotina (legado, cobre Rotina)",
  },
  {
    name: "comportamento_e_limites",
    ativo: true,
    kolo_vivo_fields: ["desafios_regulacao", "essencial", "como_e"],
    notes: "Skill auxiliar (não está nas 12 do Adendo, mas é útil)",
  },
  {
    name: "meu_bem_estar",
    ativo: true,
    // Bug fix: campos reais são dinamica/recursos em perfil_vivo_familia
    kolo_vivo_fields: ["dinamica", "recursos", "composicao"],
    notes: "Skill da mãe — lê contexto família",
  },

  // === Skills novas — placeholder (ativo=false até Karina reescrever) ===
  {
    name: "socializacao",
    create: true,
    ativo: false,
    display_name: "Socialização",
    objective: "Orienta sobre interação social com pares, contato visual, brincadeira paralela vs cooperativa, dinâmica em grupo.",
    tone: "Camada 2 técnica clara. Respeita o ritmo da criança e a hierarquia natural de interação.",
    scope: "Perfil social, dinâmica com pares, contato visual, brincadeira em grupo.",
    limits: "Não diagnostica, não compara com outras crianças. Hipóteses, nunca causa.",
    kolo_vivo_fields: ["socializacao", "essencial", "como_e"],
    knowledge_tags: ["socializacao", "interacao_social", "pares", "contato_visual"],
    routing_keywords: ["socialização", "amigos", "interação", "brincar junto", "isolado", "tímido", "grupo", "contato visual"],
    routing_priority: 65,
    fallback_questions: [
      "Como ele(a) costuma interagir com outras crianças hoje?",
      "Em que momentos a interação social fica mais difícil?",
      "Como ele(a) demonstra que quer brincar com alguém?",
      "Que situações sociais funcionam melhor pra ele(a)?",
    ],
  },
  {
    name: "imitacao",
    create: true,
    ativo: false,
    display_name: "Imitação",
    objective: "Aborda imitação como marco de desenvolvimento — gestos, sons, brincadeira simbólica, modelagem por observação.",
    tone: "Camada 2 técnica clara. Foca em o que a imitação revela sobre comunicação e cognição social.",
    scope: "Imitação motora, vocal, simbólica. Brincar de faz-de-conta. Aprender por modelo.",
    limits: "Não diagnostica. Hipóteses, nunca causa. Não compara com outras crianças.",
    kolo_vivo_fields: ["imitacao", "essencial", "como_e"],
    knowledge_tags: ["imitacao", "modelagem", "brincadeira_simbolica"],
    routing_keywords: ["imita", "imitação", "copia", "faz de conta", "modelo", "fingir", "papel"],
    routing_priority: 60,
    fallback_questions: [
      "Ele(a) imita gestos, sons, ou brincadeiras?",
      "Em que situações você vê imitação aparecer?",
      "Tem brincadeira de faz-de-conta no repertório dele(a)?",
      "Como ele(a) aprende coisas novas — por observação ou explicação?",
    ],
  },
  {
    name: "motor",
    create: true,
    ativo: false,
    display_name: "Motor",
    objective: "Orienta sobre motricidade fina, motricidade grossa, coordenação, postura, planejamento motor.",
    tone: "Camada 2 técnica clara. Linguagem corporal sem jargão.",
    scope: "Coordenação, equilíbrio, força, motricidade fina (lápis, fivela), motricidade grossa (correr, pular).",
    limits: "Não diagnostica. Encaminha pra TO/fisioterapeuta quando passa do escopo. Hipóteses sempre.",
    kolo_vivo_fields: ["motor", "essencial", "corpo_rotina"],
    knowledge_tags: ["motor", "motricidade", "coordenacao", "postura"],
    routing_keywords: ["coordenação", "motor", "motricidade", "desajeitado", "cai", "tropeça", "escrever", "pegar lápis", "bicicleta"],
    routing_priority: 60,
    fallback_questions: [
      "Como está a coordenação de movimentos amplos (correr, pular)?",
      "E o motor fino (segurar lápis, abotoar)?",
      "Tem algo que você nota o corpo dele(a) custar?",
      "Já tem acompanhamento de TO ou fisio?",
    ],
  },
  {
    name: "autonomia",
    create: true,
    ativo: false,
    display_name: "Autonomia",
    objective: "Orienta sobre autonomia funcional adequada à idade — vestir, comer sozinho, higiene, sair sozinho conforme idade.",
    tone: "Camada 2 técnica clara. Foca em construção gradual de independência, sem cobrar etapas precoces.",
    scope: "Vestir, alimentação independente, banho, higiene, lições, transporte (conforme idade).",
    limits: "Não diagnostica. Hipóteses sempre. Respeita ritmo individual.",
    kolo_vivo_fields: ["autonomia", "essencial", "corpo_rotina"],
    knowledge_tags: ["autonomia", "independencia", "habilidades_diarias"],
    routing_keywords: ["autonomia", "sozinho", "vestir", "comer sozinho", "tomar banho", "fazer sozinho", "independente"],
    routing_priority: 60,
    fallback_questions: [
      "Quais atividades do dia ele(a) já faz sozinho?",
      "Em quais ainda precisa de ajuda?",
      "Tem alguma que você está tentando ensinar agora?",
      "Como ele(a) reage quando você tenta ensinar a fazer sozinho?",
    ],
  },
  {
    name: "aprendizado",
    create: true,
    ativo: false,
    display_name: "Aprendizado",
    objective: "Orienta sobre aprendizado escolar e cotidiano — leitura, escrita, matemática, jeito de aprender, dificuldades específicas.",
    tone: "Camada 2 técnica clara. Sem jargão pedagógico. Diferenciar 'dificuldade' de 'jeito de aprender'.",
    scope: "Leitura, escrita, raciocínio, aprender por observação vs explicação, dificuldades específicas (dislexia, discalculia).",
    limits: "Não diagnostica. Encaminha pra psicopedagoga quando passa do escopo.",
    kolo_vivo_fields: ["aprendizado", "essencial", "como_e"],
    knowledge_tags: ["aprendizado", "escola", "leitura", "escrita"],
    routing_keywords: ["aprende", "aprender", "escola", "leitura", "ler", "escrever", "matemática", "lição", "estuda"],
    routing_priority: 65,
    fallback_questions: [
      "Como está o aprendizado escolar (ou caseiro) dele(a)?",
      "Tem alguma matéria/habilidade onde a coisa trava?",
      "Como ele(a) prefere aprender — vendo, ouvindo, fazendo?",
      "Tem queixa da escola ou de adulto que ensina?",
    ],
  },
  {
    name: "foco",
    create: true,
    ativo: false,
    display_name: "Foco",
    objective: "Orienta sobre atenção sustentada, atenção dividida, hiperfoco como força, dispersão.",
    tone: "Camada 2 técnica clara. Trata hiperfoco como força, não problema. Atenção como fenômeno multifacetado.",
    scope: "Atenção sustentada, dividida, hiperfoco, dispersão, mudança de tarefa.",
    limits: "Não diagnostica TDAH. Hipóteses. Encaminha pra neuropsi/psicologo quando passa do escopo.",
    kolo_vivo_fields: ["foco", "essencial", "como_e"],
    knowledge_tags: ["foco", "atencao", "hiperfoco", "dispersao"],
    routing_keywords: ["foco", "atenção", "concentra", "disperso", "hiperfoco", "esquece", "distraído", "termina"],
    routing_priority: 65,
    fallback_questions: [
      "Em quais momentos o foco dele(a) é melhor?",
      "Tem hiperfoco em algum interesse?",
      "Como é trocar de tarefa pra ele(a)?",
      "Onde a dispersão mais aparece?",
    ],
  },
  {
    name: "nutricional",
    create: true,
    ativo: false,
    display_name: "Nutricional",
    objective: "Orienta sobre padrão alimentar — seletividade, texturas, ambiente da refeição, restrições.",
    tone: "Camada 2 técnica clara. Sem alarmismo. Diferenciar seletividade de risco real.",
    scope: "Seletividade alimentar, texturas, recusa, ambiente da refeição, restrições.",
    limits: "Não diagnostica TARSA. Não prescreve dieta. Encaminha pra nutri/fono quando passa do escopo.",
    kolo_vivo_fields: ["nutricional", "essencial", "sensorial"],
    knowledge_tags: ["nutricional", "alimentacao", "seletividade", "texturas"],
    routing_keywords: ["come", "comer", "comida", "alimentação", "seletivo", "não come", "recusa", "textura", "engasga"],
    routing_priority: 65,
    fallback_questions: [
      "Como é a alimentação dele(a) hoje?",
      "Que comidas/texturas ele(a) aceita bem?",
      "Que tipo de recusa aparece com mais frequência?",
      "Tem acompanhamento de nutricionista ou fono?",
    ],
  },
];

console.log(`Processando ${UPDATES.length} skills...\n`);

let updates = 0;
let creates = 0;
let erros = 0;

for (const u of UPDATES) {
  if (u.create) {
    // INSERT (idempotente: se name já existe, dá conflito mas ignoramos)
    const { error } = await supabase.from("specialist_prompt_templates").upsert(
      {
        name: u.name,
        display_name: u.display_name,
        objective: u.objective,
        tone: u.tone,
        scope: u.scope,
        limits: u.limits,
        kolo_vivo_fields: u.kolo_vivo_fields,
        knowledge_tags: u.knowledge_tags,
        routing_keywords: u.routing_keywords,
        routing_priority: u.routing_priority,
        fallback_questions: u.fallback_questions,
        ativo: u.ativo,
      },
      { onConflict: "name" },
    );
    if (error) {
      console.log(`❌  CREATE ${u.name}: ${error.message}`);
      erros++;
    } else {
      console.log(`✅  CREATE ${u.name} (ativo=${u.ativo}, fields=[${u.kolo_vivo_fields.join(",")}])`);
      creates++;
    }
  } else {
    // UPDATE apenas kolo_vivo_fields + ativo
    const { error } = await supabase
      .from("specialist_prompt_templates")
      .update({
        kolo_vivo_fields: u.kolo_vivo_fields,
        ativo: u.ativo,
      })
      .eq("name", u.name);
    if (error) {
      console.log(`❌  UPDATE ${u.name}: ${error.message}`);
      erros++;
    } else {
      console.log(`✅  UPDATE ${u.name} → fields=[${u.kolo_vivo_fields.join(",")}]`);
      updates++;
    }
  }
}

console.log(`\nTotal: ${updates} updates, ${creates} creates, ${erros} erros`);

// Verificação final
const { data: final } = await supabase
  .from("specialist_prompt_templates")
  .select("name, ativo, kolo_vivo_fields")
  .order("ativo", { ascending: false })
  .order("name");

console.log(`\n=== Estado final (${final?.length ?? 0} skills) ===`);
for (const sk of final ?? []) {
  console.log(
    `  ${sk.ativo ? "✓" : "✗"} ${sk.name.padEnd(24)} [${(sk.kolo_vivo_fields ?? []).join(",")}]`,
  );
}
