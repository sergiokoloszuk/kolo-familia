/**
 * GOLDEN CASE L — a BASE 3 sustenta GENERALIZAÇÃO POR MECANISMO?
 *
 * A pergunta não é "o modelo produz coisas diferentes". É se ele entende POR QUE
 * uma brincadeira desenvolve uma habilidade, e consegue criar outra experiência
 * que preserve esse mecanismo para uma criança diferente.
 *
 * O caso é o MELHOR POSSÍVEL do acervo, e isso é deliberado: a BP escolhida
 * descreve o mecanismo com todas as letras ("treino de vida social embalado em
 * ficção… experimentação de tom de voz, vocabulário, gesto, hierarquia…
 * capacidade de assumir perspectiva alheia") e NÃO prescreve um cenário único
 * (cita médico, professora, garçom, vendedora). Se falhar aqui, falha em
 * qualquer lugar — das 370 BPs ativas, só 7 têm formato de atividade proposta.
 *
 * 3 perfis × 2 execuções + 6 juízos cegos individuais + 1 comparação = 13.
 *
 *   node scripts/bancada/piloto-4a/golden-case-l.mjs
 */
import { mod, ctxWeb, linha, caixa } from "./comum.mjs";
import { writeFileSync } from "node:fs";

const { assemblePrompt } = await mod("lib/ia/prompt.ts");
const { gerarConversacional, MODELO_CONVERSA } = await mod("lib/ia/provider.ts");
const MODELO = MODELO_CONVERSA.openai;
const out = [];
const w = (s) => { out.push(s); console.log(s); };

/** A BP REAL do acervo, verbatim (lida por SELECT; não reescrita). */
const BP = {
  titulo: "Você faz papel: 'Sou o médico, vou ouvir seu coração'.",
  versao_curta: "Brincadeira de papéis como treino de vida social.",
  versao_conversa:
    "Brincadeira de papéis — médico, professora, garçom, vendedora — é treino de vida social embalado em ficção. Você entra como personagem ('sou o médico, deixa eu ouvir seu coração'), criança imita, depois deixa ela liderar e você responde. Sem dirigir muito ('agora você diz X'). Solta a improvisação dela. Cada papel é experimentação de tom de voz, vocabulário específico, gesto, hierarquia, cuidado. Estendido ao longo dos anos, esse tipo de brincadeira constrói capacidade de assumir perspectiva alheia, que é base de empatia adulta. Não tem brinquedo educativo que substitui — só a invenção compartilhada com tempo livre faz esse trabalho.",
  quando_usar: "Brincadeira livre com estrutura. Ofereça 'Quer brincar de médico?', não force.",
  erros_comuns: ["Dirigir muito ('Agora você diz...'); papel muito complexo; forçar uma narrativa; criticar 'atuação'."],
  passos_praticos: [],
};

const OBJETIVO = "Iniciar e sustentar pequenas interações sociais com outras pessoas.";

const OT = {
  key: "brincadeiras",
  label: "Brincadeiras",
  prompt_template:
    "Sugira 2 a 3 brincadeiras concretas alinhadas ao perfil sensorial e interesses do membro atípico em foco. Inclua materiais simples e duração estimada para cada uma.",
};

const SKILL = [{
  name: "socializacao", display_name: "Socialização",
  objective: "apoiar a criança nas interações com outras pessoas",
  tone: "próximo, prático", scope: "socialização, comunicação social",
  limits: "não diagnostica",
  kolo_vivo_fields: ["essencial", "socializacao"], knowledge_tags: ["socializacao"],
}];

const PERFIS = [
  { id: "A · desenho e personagens", nome: "Ivo", idade: 5, perfil: "TEA", genero: "masculino",
    secoes: { essencial: "Ivo, 5 anos. INTERESSES: desenhar, gibis, criar personagens. Passa horas desenhando.",
              socializacao: "Brinca sozinho. Com outras crianças, observa de longe e não entra." } },
  { id: "B · futebol e movimento", nome: "Caio", idade: 5, perfil: "TEA", genero: "masculino",
    secoes: { essencial: "Caio, 5 anos. INTERESSES: futebol, correr, bola. Não para quieto.",
              socializacao: "Brinca perto de outras crianças mas não interage. Entra correndo e sai." } },
  { id: "C · mercadinho e faz-de-conta", nome: "Bia", idade: 5, perfil: "TEA", genero: "feminino",
    secoes: { essencial: "Bia, 5 anos. INTERESSES: brincar de mercadinho, caixa registradora, organizar as coisas.",
              socializacao: "Fala com adultos conhecidos. Com crianças da idade dela, fica em silêncio." } },
];

// ── 6 GERAÇÕES pelo caminho real ─────────────────────────────────────────
const R = [];
for (const p of PERFIS) {
  for (let n = 1; n <= 2; n++) {
    const ctx = ctxWeb({
      nome: p.nome, idade: p.idade, perfil: p.perfil, genero: p.genero,
      secoes: p.secoes, perfilConsultavel: null, base2: [], bps: [BP],
    });
    const { system, messages } = assemblePrompt({
      skills: SKILL, ctx, userInput: OBJETIVO, modo: { kind: "output_type", outputType: OT },
    });
    const r = await gerarConversacional({
      provider: "openai", model: MODELO,
      system: system.map((b) => b.text).join("\n\n"), messages, maxTokens: 1400, cacheSystem: true,
    });
    R.push({ perfil: p, exec: n, texto: r.texto.trim() });
    w(`\n${linha()}\n${p.id} · execução ${n} · ${r.texto.trim().length} ch\n`);
    w(caixa(r.texto.trim()));
  }
}

// ── 6 JUÍZOS CEGOS INDIVIDUAIS ───────────────────────────────────────────
const SYS_IND = `Você avalia se uma proposta de intervenção GENERALIZOU o mecanismo de uma boa prática, ou apenas a copiou/decorou.

Você recebe: a BOA PRÁTICA original, o OBJETIVO, o PERFIL de uma criança e UMA proposta. Não conhece outras propostas — julgue só esta.

Responda EXATAMENTE neste formato:

HABILIDADE_ALVO: SIM|NAO — a proposta continua trabalhando o objetivo declarado?
MECANISMOS_PRESENTES: <liste apenas os que REALMENTE estão na proposta, semanticamente — ex.: assumir papel/perspectiva, motivo real para falar com o outro, iniciar, responder, manter a troca, experimentar tom/vocabulário/gesto, reagir ao que o outro faz, reciprocidade. NÃO é checklist: só o que existe>
MECANISMO_PRESERVADO: SIM|NAO — o princípio funcional da boa prática sobreviveu?
MECANICA_MUDOU: SIM|NAO — a experiência funciona de OUTRA MANEIRA para esta criança, ou é a mesma atividade com outro tema?
DECORACAO: <o que mudou que é SÓ personagem, objeto, cenário, nome ou tema visual, sem efeito funcional — ou "nada">
INVENTOU: SIM|NAO — atribuiu à criança algo que o perfil não diz?
REBAIXOU: SIM|NAO — propôs apoio mais básico do que o nível descrito?
INTERESSE_VIROU_OBRIGACAO: SIM|NAO
PERDEU_O_OBJETIVO: SIM|NAO — trocou o alvo por causa do interesse?
VEREDITO: PASS_FORTE|PASS_PARCIAL|FAIL — <uma frase>

Rigoroso. Na dúvida entre PASS_FORTE e PASS_PARCIAL, escolha PASS_PARCIAL.
"MECANICA_MUDOU: SIM" exige que a FORMA da interação seja diferente, não o assunto dela.`;

const notas = [];
for (const r of R) {
  const user = `BOA PRÁTICA ORIGINAL:\n"""\n${BP.titulo}\n${BP.versao_conversa}\nQuando usar: ${BP.quando_usar}\nErros comuns: ${BP.erros_comuns.join(" ")}\n"""\n\nOBJETIVO: "${OBJETIVO}"\n\nPERFIL DA CRIANÇA:\n${Object.values(r.perfil.secoes).join("\n")}\n\nPROPOSTA A AVALIAR:\n"""\n${r.texto}\n"""`;
  const j = await gerarConversacional({
    provider: "openai", model: MODELO, system: SYS_IND,
    messages: [{ role: "user", content: user }], maxTokens: 700, cacheSystem: true,
  });
  notas.push({ ...r, juizo: j.texto.trim() });
  w(`\n${linha()}\nJUÍZO · ${r.perfil.id} · execução ${r.exec}\n`);
  w(caixa(j.texto.trim()));
}

// ── 1 COMPARAÇÃO FINAL ───────────────────────────────────────────────────
const SYS_COMP = `Você compara propostas de intervenção feitas para o MESMO objetivo, a partir da MESMA boa prática, para três crianças diferentes.

Responda EXATAMENTE neste formato:

A_FUNCIONALMENTE_DIFERENTES: SIM|NAO — <são diferentes no funcionamento, ou só parecem?>
B_NATUREZA_DAS_DIFERENCAS: <para cada par ou grupo, classifique: MECANISMO | MECANICA | CONTEXTO | DECORATIVA — com uma frase>
C_PERFIL_MUDOU_A_ESCOLHA: SIM|NAO — <o perfil determinou a intervenção, ou a intervenção seria a mesma?>
D_PAPEL_DA_BOA_PRATICA: RECEITA_COPIADA | INSPIRACAO_TEMATICA | CONHECIMENTO_GENERALIZAVEL — <por quê>
E_ESTABILIDADE: ESTAVEL|INSTAVEL — <as duas execuções de cada perfil apontam para o mesmo padrão, ou o resultado parece depender do acaso?>
VEREDITO: PASS_FORTE|PASS_PARCIAL|FAIL — <uma frase>

⚠️ Se duas crianças justificarem uma mecânica semelhante, isso NÃO é falha — não exija diversidade artificial. O que se avalia é personalização FUNCIONAL, não variedade cosmética.`;

const userComp = `BOA PRÁTICA ORIGINAL:\n"""\n${BP.versao_conversa}\n"""\n\nOBJETIVO (o mesmo para os três): "${OBJETIVO}"\n\n` +
  PERFIS.map((p, i) => {
    const dois = R.filter((r) => r.perfil.id === p.id);
    return `### CRIANÇA ${i + 1}\nPERFIL: ${Object.values(p.secoes).join(" ")}\nEXECUÇÃO 1:\n"""\n${dois[0].texto}\n"""\nEXECUÇÃO 2:\n"""\n${dois[1].texto}\n"""`;
  }).join("\n\n");

const comp = await gerarConversacional({
  provider: "openai", model: MODELO, system: SYS_COMP,
  messages: [{ role: "user", content: userComp }], maxTokens: 1200, cacheSystem: true,
});
w(`\n\n${linha()}\nCOMPARAÇÃO FINAL\n`);
w(caixa(comp.texto.trim()));

// ── PLACAR ───────────────────────────────────────────────────────────────
w(`\n${linha()}\nPLACAR\n`);
const campo = (t, k) => (t.match(new RegExp(`^${k}:\\s*(\\S+)`, "m")) ?? [])[1] ?? "?";
w("perfil".padEnd(32) + "ex".padEnd(4) + "alvo".padEnd(6) + "mecan".padEnd(7) + "mecânica".padEnd(10) + "veredito");
for (const n of notas) {
  w(n.perfil.id.padEnd(32) + String(n.exec).padEnd(4) +
    campo(n.juizo, "HABILIDADE_ALVO").padEnd(6) +
    campo(n.juizo, "MECANISMO_PRESERVADO").padEnd(7) +
    campo(n.juizo, "MECANICA_MUDOU").padEnd(10) +
    campo(n.juizo, "VEREDITO"));
}
w(`\ninventou algo ausente: ${notas.filter((n) => campo(n.juizo, "INVENTOU") === "SIM").length}/6`);
w(`rebaixou habilidade:   ${notas.filter((n) => campo(n.juizo, "REBAIXOU") === "SIM").length}/6`);
w(`perdeu o objetivo:     ${notas.filter((n) => campo(n.juizo, "PERDEU_O_OBJETIVO") === "SIM").length}/6`);

writeFileSync(`${process.cwd()}/docs/bancada/golden-case-l-2026-08-11.txt`, out.join("\n"), "utf8");
console.log("\npronto → docs/bancada/golden-case-l-2026-08-11.txt");
