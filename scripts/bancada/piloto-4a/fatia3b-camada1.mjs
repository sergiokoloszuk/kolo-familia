/**
 * FATIA 3b · CAMADA 1 — A QUALIDADE DE CADA INTERVENÇÃO (ANTES × DEPOIS).
 *
 * O ANTES é o Golden Case L de 11/08/2026, salvo em
 * `docs/bancada/golden-case-l-2026-08-11.txt`: 3 perfis × 2 execuções, mesma
 * BP, mesmo objetivo, contexto SEM 4A (perfil consultável nulo, BASE 2 vazia).
 *
 * O DEPOIS muda UMA COISA: o `ctx` deixa de ser montado à mão e passa a vir de
 * `montarContextoDeSecoes` — o montador REAL do Plano, com a 3b ligada. Tudo o
 * mais é idêntico: mesmo `assemblePrompt`, mesmo output type, mesmo modelo,
 * mesmo `maxTokens`, mesma BP.
 *
 * ⚠️ A MESMA BP NOS DOIS BRAÇOS, DE PROPÓSITO. O ranking por aderência também
 * é da 3b e escolheria outras duas — mas então duas variáveis mudariam ao mesmo
 * tempo, e um resultado melhor não teria dono. Aqui isola-se o que a pergunta
 * central exige: perfil consultável, negativos, âncora e BASE 2.
 *
 * ⚠️ OS SEIS TEXTOS DO ANTES SÃO RE-JULGADOS pelo juiz NOVO. O juiz antigo não
 * tinha o campo `NIVEL_EXIGIDO`, e o "5 de 6 exigem pré-verbal" registrado na
 * PEND-027 saiu da minha leitura, não de uma medição. Comparar uma leitura
 * minha com um juiz cego seria comparar dois instrumentos.
 *
 * 6 gerações + 6 juízos (DEPOIS) + 6 juízos (ANTES) = 18 chamadas.
 *
 *   node scripts/bancada/piloto-4a/fatia3b-camada1.mjs
 */
import { mod, FAMILIA_PILOTO, linha, caixa } from "./comum.mjs";
import { readFileSync, writeFileSync } from "node:fs";

const U = process.env.NEXT_PUBLIC_SUPABASE_URL;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { assemblePrompt } = await mod("lib/ia/prompt.ts");
const { gerarConversacional, MODELO_CONVERSA } = await mod("lib/ia/provider.ts");
const { montarContextoDeSecoes } = await mod("lib/ia/engine.ts");
const MODELO = MODELO_CONVERSA.openai;

const out = [];
const w = (s) => { out.push(s); console.log(s); };

// ── O CASO, VERBATIM DO GOLDEN CASE L ────────────────────────────────────
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

const SKILL = {
  id: "skill-socializacao",
  ativo: true,
  name: "socializacao",
  display_name: "Socialização",
  objective: "apoiar a criança nas interações com outras pessoas",
  tone: "próximo, prático",
  scope: "socialização, comunicação social",
  limits: "não diagnostica",
  kolo_vivo_fields: ["essencial", "socializacao"],
  knowledge_tags: ["socializacao"],
  routing_keywords: [],
  routing_priority: 1,
  fallback_questions: [],
};

/**
 * OS TRÊS PERFIS, COM OS MESMOS FATOS DO GOLDEN CASE L — nem um a mais.
 *
 * A frase de socialização de cada criança é a mesma, palavra por palavra; o que
 * muda é que agora ela mora num subcampo declarado (`Iniciativa e
 * reciprocidade`), que é o que o perfil consultável sabe ler. Nenhum dado novo
 * foi acrescentado: Ivo e Caio continuam sem qualquer informação sobre nível de
 * comunicação, e a Bia continua com a única que sempre teve — ela fala com
 * adultos conhecidos.
 */
const PERFIS = [
  {
    id: "A · desenho e personagens", nome: "Ivo", genero: "masculino",
    essencial: "Ivo, 5 anos. INTERESSES: desenhar, gibis, criar personagens. Passa horas desenhando.",
    socializacao: "Iniciativa e reciprocidade: Brinca sozinho. Com outras crianças, observa de longe e não entra.",
  },
  {
    id: "B · futebol e movimento", nome: "Caio", genero: "masculino",
    essencial: "Caio, 5 anos. INTERESSES: futebol, correr, bola. Não para quieto.",
    socializacao: "Iniciativa e reciprocidade: Brinca perto de outras crianças mas não interage. Entra correndo e sai.",
  },
  {
    id: "C · mercadinho e faz-de-conta", nome: "Bia", genero: "feminino",
    essencial: "Bia, 5 anos. INTERESSES: brincar de mercadinho, caixa registradora, organizar as coisas.",
    socializacao: "Iniciativa e reciprocidade: Fala com adultos conhecidos. Com crianças da idade dela, fica em silêncio.",
  },
];

// ── O BANCO EM MEMÓRIA, NA FORMA REAL ────────────────────────────────────
const gravado = (texto) => ({ texto, atualizado_em: "2026-08-01T00:00:00Z" });
const idDe = (i) => `cccccccc-4a4a-4a4a-4a4a-00000000000${i + 3}`;

const TABELAS = {
  specialist_prompt_templates: [SKILL],
  membros_atipicos: PERFIS.map((p, i) => ({
    id: idDe(i), family_account_id: FAMILIA_PILOTO, nome: p.nome,
    data_nascimento: "2021-03-01", perfil: "TEA", genero: p.genero,
    diagnosticos_formais: null, ativo: true, created_at: "2026-01-01T00:00:00Z",
  })),
  perfil_vivo_membro: PERFIS.map((p, i) => ({
    membro_atipico_id: idDe(i), family_account_id: FAMILIA_PILOTO,
    essencial: gravado(p.essencial),
    categorias_extras: { socializacao: gravado(p.socializacao) },
  })),
  perfil_vivo_familia: [], diarios: [], check_ins_diarios: [], mensagens_skill: [],
  family_profiles: [{
    family_account_id: FAMILIA_PILOTO, nome_mae: "Ana", como_chamar: "Ana",
    papel: "mae", papel_outro: null, genero_responsavel: "feminino",
  }],
};

/** Só a criança em foco é visível — isolamento entre irmãos vale na bancada. */
function bancoFalso(membroId) {
  const proibido = (n) => () => { throw new Error(`BANCADA: ${n} bloqueado`); };
  return {
    from(tabela) {
      const filtros = []; const remoto = []; let colunas = "*"; let limite = null;
      const q = {
        select(c) { colunas = c; return q; },
        eq(c, v) { filtros.push([c, v]); remoto.push(`${c}=eq.${encodeURIComponent(v)}`); return q; },
        in(c, v) { filtros.push([c, v, "in"]); remoto.push(`${c}=in.(${v.map(encodeURIComponent).join(",")})`); return q; },
        or(e) { remoto.push(`or=(${e})`); return q; },
        order(c, o) { remoto.push(`order=${c}.${o?.ascending === false ? "desc" : "asc"}`); return q; },
        limit(n) { limite = n; remoto.push(`limit=${n}`); return q; },
        lte(c, v) { remoto.push(`${c}=lte.${v}`); return q; },
        gte(c, v) { remoto.push(`${c}=gte.${v}`); return q; },
        is(c, v) { remoto.push(`${c}=is.${v}`); return q; },
        not(c, o, v) { remoto.push(`${c}=not.${o}.${v}`); return q; },
        insert: proibido("insert"), update: proibido("update"),
        upsert: proibido("upsert"), delete: proibido("delete"),
        maybeSingle() { return q.then((r) => ({ data: r.data[0] ?? null, error: null })); },
        single() { return q.then((r) => ({ data: r.data[0] ?? null, error: null })); },
        then(res, rej) {
          if (tabela === "boas_praticas") {
            const url = `${U}/rest/v1/boas_praticas?select=${encodeURIComponent(colunas)}${remoto.length ? "&" + remoto.join("&") : ""}`;
            return fetch(url, { headers: { apikey: K, Authorization: `Bearer ${K}`, Range: "0-9999" } })
              .then((r) => r.json())
              .then((d) => ({ data: Array.isArray(d) ? d : [], error: Array.isArray(d) ? null : d }))
              .then(res, rej);
          }
          let l = TABELAS[tabela] ?? [];
          if (tabela === "membros_atipicos") l = l.filter((r) => r.id === membroId);
          if (tabela === "perfil_vivo_membro") l = l.filter((r) => r.membro_atipico_id === membroId);
          for (const [c, v, op] of filtros) {
            l = op === "in" ? l.filter((r) => v.includes(r[c])) : l.filter((r) => r[c] === v);
          }
          if (limite != null) l = l.slice(0, limite);
          return Promise.resolve({ data: l, error: null }).then(res, rej);
        },
      };
      return q;
    },
  };
}

// ── AS 6 GERAÇÕES DO DEPOIS ──────────────────────────────────────────────
process.env.KOLO_PILOTO_4A = "teste";
process.env.KOLO_PILOTO_4A_FAMILIAS = FAMILIA_PILOTO;

const DEPOIS = [];
for (const [i, p] of PERFIS.entries()) {
  const { ctx } = await montarContextoDeSecoes(bancoFalso(idDe(i)), {
    familyId: FAMILIA_PILOTO,
    membroAtipicoId: idDe(i),
    pedido: OBJETIVO,
  });
  // A MESMA BP do ANTES — ver o cabeçalho.
  const ctx4A = { ...ctx, boasPraticas: [BP] };
  for (let n = 1; n <= 2; n++) {
    const { system, messages } = assemblePrompt({
      skills: [SKILL], ctx: ctx4A, userInput: OBJETIVO,
      modo: { kind: "output_type", outputType: OT },
    });
    const r = await gerarConversacional({
      provider: "openai", model: MODELO,
      system: system.map((b) => b.text).join("\n\n"), messages,
      maxTokens: 1400, cacheSystem: true,
    });
    DEPOIS.push({ perfil: p, exec: n, texto: r.texto.trim() });
    w(`\n${linha()}\nDEPOIS · ${p.id} · execução ${n} · ${r.texto.trim().length} ch\n`);
    w(caixa(r.texto.trim()));
  }
}

// ── OS 6 TEXTOS DO ANTES, LIDOS DO ARQUIVO SALVO ─────────────────────────
const salvo = readFileSync("docs/bancada/golden-case-l-2026-08-11.txt", "utf8");
const ANTES = [];
for (const p of PERFIS) {
  for (let n = 1; n <= 2; n++) {
    const marca = new RegExp(`${p.id.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")} · execução ${n} · \\d+ ch\\n([\\s\\S]*?)\\n(?:█|$)`);
    const m = salvo.match(marca);
    if (!m) throw new Error(`ANTES não encontrado: ${p.id} execução ${n}`);
    const texto = m[1].split("\n").map((l) => l.replace(/^ {2}│ ?/, "")).join("\n").trim();
    ANTES.push({ perfil: p, exec: n, texto });
  }
}
w(`\n${linha()}\nANTES recuperado do arquivo: ${ANTES.length} textos, ` +
  `${ANTES.map((a) => a.texto.length).join("/")} caracteres\n${linha()}`);

// ── O JUIZ ───────────────────────────────────────────────────────────────
const SYS = `Você avalia UMA proposta de intervenção feita a partir de uma boa prática, para uma criança específica.

Você recebe: a BOA PRÁTICA original, o OBJETIVO, o PERFIL da criança e UMA proposta. Não conhece outras propostas — julgue só esta, sem comparar com nada.

Responda EXATAMENTE neste formato:

NIVEL_EXIGIDO: PRE_VERBAL|PALAVRAS_SOLTAS|FRASES|CONVERSA — <qual nível de comunicação a criança precisa TER para a proposta funcionar como escrita>
EVIDENCIA_DO_NIVEL: <a frase da proposta que revela esse nível>
NIVEL_NO_PERFIL: <o que o PERFIL de fato afirma sobre o nível — ou "o perfil não diz nada sobre isso">
REBAIXOU: SIM|NAO — a proposta exige/oferece menos do que o perfil já demonstra, ou trata como ausente uma habilidade que o perfil afirma?
NEGATIVO_DESRESPEITADO: SIM|NAO|NAO_HA — a proposta apoia-se em algo que a família já disse que NÃO é o caso?
HABILIDADE_ALVO: SIM|NAO — continua trabalhando o objetivo declarado?
MECANISMO_PRESERVADO: SIM|NAO — o princípio funcional da boa prática sobreviveu?
MECANICA_MUDOU: SIM|NAO — a experiência funciona de OUTRA MANEIRA para esta criança, ou é a mesma atividade com outro tema?
DECORACAO: <o que mudou que é SÓ personagem, objeto, cenário ou tema visual, sem efeito funcional — ou "nada">
INVENTOU: SIM|NAO — atribuiu à criança habilidade, interesse ou contexto que o perfil não diz?
EXECUTAVEL: SIM|NAO — uma mãe consegue fazer isto amanhã, com o que tem em casa?
ADEQUADA_AO_OBJETIVO: SIM|NAO
VEREDITO: PASS_FORTE|PASS_PARCIAL|FAIL — <uma frase>

Rigoroso. Na dúvida entre PASS_FORTE e PASS_PARCIAL, escolha PASS_PARCIAL.
"MECANICA_MUDOU: SIM" exige que a FORMA da interação seja diferente, não o assunto dela.
Em NIVEL_EXIGIDO, julgue pelo que a proposta PEDE da criança: se ela se apoia em apontar, imagens, gestos e trocas sem fala, é PRE_VERBAL — mesmo que o texto seja gentil.`;

const julgar = async (r) => {
  const user =
    `BOA PRÁTICA ORIGINAL:\n"""\n${BP.titulo}\n${BP.versao_conversa}\nQuando usar: ${BP.quando_usar}\nErros comuns: ${BP.erros_comuns.join(" ")}\n"""\n\n` +
    `OBJETIVO: "${OBJETIVO}"\n\nPERFIL DA CRIANÇA:\n${r.perfil.essencial}\n${r.perfil.socializacao}\n\n` +
    `PROPOSTA A AVALIAR:\n"""\n${r.texto}\n"""`;
  const j = await gerarConversacional({
    provider: "openai", model: MODELO, system: SYS,
    messages: [{ role: "user", content: user }],
    maxTokens: 2000, cacheSystem: true,
  });
  return j.texto.trim();
};

const notas = { ANTES: [], DEPOIS: [] };
for (const [braco, lista] of [["ANTES", ANTES], ["DEPOIS", DEPOIS]]) {
  for (const r of lista) {
    const juizo = await julgar(r);
    notas[braco].push({ ...r, juizo });
    w(`\n${linha()}\nJUÍZO · ${braco} · ${r.perfil.id} · execução ${r.exec}\n`);
    w(caixa(juizo));
  }
}

// ── PLACAR ───────────────────────────────────────────────────────────────
const campo = (t, k) => (t.match(new RegExp(`^${k}:\\s*(\\S+)`, "m")) ?? [])[1] ?? "?";
const conta = (b, k, v) => notas[b].filter((n) => campo(n.juizo, k) === v).length;

w(`\n${linha()}\nPLACAR — CAMADA 1\n${linha()}\n`);
for (const b of ["ANTES", "DEPOIS"]) {
  w(`\n${b}`);
  w("  perfil".padEnd(34) + "ex  " + "nível".padEnd(16) + "rebaixou  mecânica  veredito");
  for (const n of notas[b]) {
    w("  " + n.perfil.id.padEnd(32) + String(n.exec).padEnd(4) +
      campo(n.juizo, "NIVEL_EXIGIDO").padEnd(16) +
      campo(n.juizo, "REBAIXOU").padEnd(10) +
      campo(n.juizo, "MECANICA_MUDOU").padEnd(10) +
      campo(n.juizo, "VEREDITO"));
  }
}

const bia = (b) => notas[b].filter((n) => n.perfil.nome === "Bia");
w(`\n${linha()}\nOS CRITÉRIOS, DECIDIDOS ANTES DE RODAR\n`);
const criterios = [
  ["pré-verbal exigido (alvo: de 5/6 para no máximo 1/6)",
    `${conta("ANTES", "NIVEL_EXIGIDO", "PRE_VERBAL")}/6 → ${conta("DEPOIS", "NIVEL_EXIGIDO", "PRE_VERBAL")}/6`,
    conta("DEPOIS", "NIVEL_EXIGIDO", "PRE_VERBAL") <= 1],
  ["Bia rebaixada (alvo: 0/2)",
    `${bia("ANTES").filter((n) => campo(n.juizo, "REBAIXOU") === "SIM").length}/2 → ${bia("DEPOIS").filter((n) => campo(n.juizo, "REBAIXOU") === "SIM").length}/2`,
    bia("DEPOIS").filter((n) => campo(n.juizo, "REBAIXOU") === "SIM").length === 0],
  ["generalização pelo mecanismo (alvo: manter 6/6)",
    `${conta("ANTES", "MECANISMO_PRESERVADO", "SIM")}/6 → ${conta("DEPOIS", "MECANISMO_PRESERVADO", "SIM")}/6`,
    conta("DEPOIS", "MECANISMO_PRESERVADO", "SIM") === 6],
  ["negativo desrespeitado (alvo: 0)",
    `${conta("ANTES", "NEGATIVO_DESRESPEITADO", "SIM")} → ${conta("DEPOIS", "NEGATIVO_DESRESPEITADO", "SIM")}`,
    conta("DEPOIS", "NEGATIVO_DESRESPEITADO", "SIM") === 0],
  ["PASS_FORTE (alvo: melhorar sobre 1/6)",
    `${conta("ANTES", "VEREDITO", "PASS_FORTE")}/6 → ${conta("DEPOIS", "VEREDITO", "PASS_FORTE")}/6`,
    conta("DEPOIS", "VEREDITO", "PASS_FORTE") > conta("ANTES", "VEREDITO", "PASS_FORTE")],
  ["inventou algo ausente (alvo: não piorar)",
    `${conta("ANTES", "INVENTOU", "SIM")}/6 → ${conta("DEPOIS", "INVENTOU", "SIM")}/6`,
    conta("DEPOIS", "INVENTOU", "SIM") <= conta("ANTES", "INVENTOU", "SIM")],
  ["mecânica mudou (personalização funcional)",
    `${conta("ANTES", "MECANICA_MUDOU", "SIM")}/6 → ${conta("DEPOIS", "MECANICA_MUDOU", "SIM")}/6`, null],
  ["executável",
    `${conta("ANTES", "EXECUTAVEL", "SIM")}/6 → ${conta("DEPOIS", "EXECUTAVEL", "SIM")}/6`, null],
];
for (const [nome, valor, ok] of criterios) {
  w(`  ${ok === null ? "·" : ok ? "✓" : "✗"} ${nome.padEnd(52)} ${valor}`);
}
const decisivos = criterios.filter((c) => c[2] !== null);
w(`\n  ${decisivos.filter((c) => c[2]).length}/${decisivos.length} critérios decisivos atingidos`);
w(linha());

writeFileSync("docs/bancada/fatia3b-camada1-2026-08-11.txt", out.join("\n"), "utf8");
console.log("\npronto → docs/bancada/fatia3b-camada1-2026-08-11.txt");
