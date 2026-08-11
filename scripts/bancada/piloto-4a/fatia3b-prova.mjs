/**
 * FATIA 3b — A PROVA POR EXECUÇÃO, ANTES DE QUALQUER CHAMADA PAGA.
 *
 * Exercita `montarContextoDeSecoes` (o montador REAL do Plano) contra um banco
 * em memória, e responde cinco perguntas sem gastar um token:
 *
 *   1. com o piloto OFF, o contexto continua BYTE A BYTE o da Fatia 3a;
 *   2. família fora da lista não recebe 4A, mesmo com o piloto em `teste`;
 *   3. família do piloto recebe `relato` — e ele chega ao `buildContext`;
 *   4. perfil consultável e NEGATIVOS chegam ao bloco que vai ao modelo;
 *   5. BASE 2, ranking, âncora e licença entram pelo mecanismo COMPARTILHADO,
 *      e não por implementação paralela dentro do Plano.
 *
 * ⚠️ ZERO ESCRITA E ZERO CHAMADA PAGA.
 *   · O banco é um objeto em memória; a única leitura remota é `boas_praticas`
 *     (GET puro), porque o ranking por aderência só é honesto contra o acervo
 *     real.
 *   · `SUPABASE_SERVICE_ROLE_KEY` é APAGADO do ambiente antes de rodar: é a
 *     chave que `logEvent` usaria para persistir o rastro. Sem ela, o cliente
 *     nem se constrói, o `catch` de dentro do `logEvent` engole, e nada é
 *     gravado em `eventos`.
 *   · O roteador de skills não chama modelo nenhum: com UMA skill ativa,
 *     `routeSkillsAI` retorna por atalho (`skills.length === 1`).
 *
 *   node scripts/bancada/piloto-4a/fatia3b-prova.mjs
 */
import { mod, FAMILIA_PILOTO, FAMILIA_COMUM, linha, caixa } from "./comum.mjs";
import { writeFileSync } from "node:fs";

// As credenciais saem do ambiente e viram variáveis locais: daqui para baixo,
// só ESTE arquivo consegue falar com o Supabase, e só por GET.
const U = process.env.NEXT_PUBLIC_SUPABASE_URL;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_SERVICE_KEY;

const { montarContextoDeSecoes } = await mod("lib/ia/engine.ts");
const { buildContext } = await mod("lib/ia/context.ts");
const { buildContextBlock } = await mod("lib/ia/prompt.ts");

const out = [];
const w = (s) => { out.push(s); console.log(s); };
const provas = [];
const prova = (nome, ok, detalhe) => {
  provas.push({ nome, ok });
  w(`${ok ? "  ✓" : "  ✗"} ${nome}${detalhe ? `\n      ${detalhe}` : ""}`);
};

// ── O BANCO EM MEMÓRIA ───────────────────────────────────────────────────
//
// A criança é a Bia do Golden Case L, agora com o perfil que ela SEMPRE teve e
// que o Plano nunca leu: fala frases, flui com adultos, e a família já disse
// que som e luz não são questão.
const MEMBRO_ID = "cccccccc-4a4a-4a4a-4a4a-000000000003";

const PERFIL_SOCIALIZACAO = [
  "Como é socializar pra ele(a): Curte em doses",
  "Interage com outras pessoas (pares): Raramente",
  "Com quem flui melhor: Adultos",
  "Divide e espera a vez: Às vezes",
  "Iniciativa e reciprocidade: Com adulto conhecido ela inicia e mantém o vai-e-vem. Com crianças da idade dela, fica em silêncio e observa.",
].join("\n");

const PERFIL_COMUNICACAO = [
  "Como se comunica: Fala frases",
  "Vocabulário e fala: Vocabulário grande. Conta o que aconteceu no dia inteiro.",
  "Conversa e argumentação: Mantém o vai-e-vem com adulto. Negocia e argumenta.",
].join("\n");

// O NEGATIVO — o que a família já disse que NÃO é o caso.
const PERFIL_SENSORIAL = [
  "Perfil sensorial: Misto",
  "Reação a sons: não",
  "Luz: não",
  "Texturas (roupas, objetos): Evita etiquetas.",
].join("\n");

// ⚠️ NA FORMA REAL DO BANCO — `{ texto, atualizado_em }`, nunca string.
// Conferido por leitura em 11/08/2026: 8 de 8 linhas de `perfil_vivo_membro`
// guardam objeto. Foi a primeira execução desta prova que mostrou que o leitor
// do perfil consultável só aceitava string e, por isso, lia `""` de todo mundo.
const gravado = (texto) => ({ texto, atualizado_em: "2026-08-01T00:00:00Z" });

const LINHA_PERFIL = {
  membro_atipico_id: MEMBRO_ID,
  family_account_id: FAMILIA_PILOTO,
  essencial: gravado(
    "Bia, 5 anos. Adora brincar de mercadinho, caixa registradora e organizar as coisas.",
  ),
  sensorial: gravado(PERFIL_SENSORIAL),
  categorias_extras: {
    socializacao: gravado(PERFIL_SOCIALIZACAO),
    comunicacao: gravado(PERFIL_COMUNICACAO),
  },
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
  kolo_vivo_fields: ["essencial", "socializacao", "comunicacao"],
  knowledge_tags: ["socializacao"],
  routing_keywords: [],
  routing_priority: 1,
  fallback_questions: [],
};

const TABELAS = {
  specialist_prompt_templates: [SKILL],
  membros_atipicos: [{
    id: MEMBRO_ID,
    family_account_id: FAMILIA_PILOTO,
    nome: "Bia",
    data_nascimento: "2021-03-01",
    perfil: "TEA",
    genero: "feminino",
    diagnosticos_formais: null,
    ativo: true,
    created_at: "2026-01-01T00:00:00Z",
  }],
  perfil_vivo_membro: [LINHA_PERFIL],
  perfil_vivo_familia: [],
  diarios: [],
  check_ins_diarios: [],
  mensagens_skill: [],
  family_profiles: [{
    family_account_id: FAMILIA_PILOTO,
    nome_mae: "Ana",
    como_chamar: "Ana",
    papel: "mae",
    papel_outro: null,
    genero_responsavel: "feminino",
  }],
};

/** A MESMA criança e o MESMO perfil, para a família de fora do piloto. */
for (const t of ["membros_atipicos", "perfil_vivo_membro", "family_profiles"]) {
  TABELAS[t] = [
    ...TABELAS[t],
    ...TABELAS[t].map((r) => ({ ...r, family_account_id: FAMILIA_COMUM })),
  ];
}

/**
 * O cliente falso. Implementa a fatia da API fluente que o caminho real usa;
 * qualquer escrita ESTOURA, e `boas_praticas` é a única tabela que sai para a
 * rede — por GET, para que o ranking por aderência seja medido contra o acervo
 * de verdade e não contra três linhas inventadas.
 */
function bancoFalso() {
  const proibido = (nome) => () => { throw new Error(`PROVA: ${nome} bloqueado`); };
  return {
    from(tabela) {
      const filtros = [];
      const remoto = [];
      let colunas = "*";
      let limite = null;
      const q = {
        select(c) { colunas = c; return q; },
        eq(col, val) { filtros.push([col, val]); remoto.push(`${col}=eq.${encodeURIComponent(val)}`); return q; },
        in(col, vals) { filtros.push([col, vals, "in"]); remoto.push(`${col}=in.(${vals.map(encodeURIComponent).join(",")})`); return q; },
        or(expr) { remoto.push(`or=(${expr})`); return q; },
        order(col, o) { remoto.push(`order=${col}.${o?.ascending === false ? "desc" : "asc"}`); return q; },
        limit(n) { limite = n; remoto.push(`limit=${n}`); return q; },
        lte(col, v) { remoto.push(`${col}=lte.${v}`); return q; },
        gte(col, v) { remoto.push(`${col}=gte.${v}`); return q; },
        is(col, v) { remoto.push(`${col}=is.${v}`); return q; },
        not(col, op, v) { remoto.push(`${col}=not.${op}.${v}`); return q; },
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
          let linhas = TABELAS[tabela] ?? [];
          for (const [col, val, op] of filtros) {
            linhas = op === "in"
              ? linhas.filter((r) => val.includes(r[col]))
              : linhas.filter((r) => r[col] === val);
          }
          if (limite != null) linhas = linhas.slice(0, limite);
          return Promise.resolve({ data: linhas, error: null }).then(res, rej);
        },
      };
      return q;
    },
  };
}

const PEDIDO =
  "Bia quase não fala com as crianças da escola. Quero ajudar ela a começar e " +
  "sustentar pequenas interações com outras pessoas.";

const chamar = async (familyId) =>
  (
    await montarContextoDeSecoes(bancoFalso(), {
      familyId,
      membroAtipicoId: MEMBRO_ID,
      pedido: PEDIDO,
    })
  ).ctx;

/** O ctx sem as funções, para comparar dois contextos por igualdade real. */
const congelar = (ctx) =>
  JSON.stringify(
    {
      ...ctx,
      perfilConsultavel: ctx.perfilConsultavel
        ? [...ctx.perfilConsultavel.dominios.entries()]
        : null,
    },
    null,
    1,
  );

// ═════════════════════════════════════════════════════════════════════════
w(`${linha()}\nFATIA 3b — PROVA POR EXECUÇÃO (zero chamada paga, zero escrita)\n${linha()}`);

// ── PROVA 1 · PILOTO OFF = O CONTEXTO DA 3a, IDÊNTICO ────────────────────
w(`\n1. COM O PILOTO OFF, O CONTEXTO CONTINUA COMO ANTES\n`);
process.env.KOLO_PILOTO_4A = "off";
const ctxOff = await chamar(FAMILIA_PILOTO);

// A 3a era exatamente isto: `buildContext` SEM `relato`. Se os dois JSON forem
// iguais, a fatia não mudou uma vírgula para quem está fora do piloto.
const ctx3a = await buildContext(bancoFalso(), {
  familyId: FAMILIA_PILOTO,
  membroAtipicoId: MEMBRO_ID,
  skills: [SKILL],
  conversaId: null,
});
prova(
  "ctx(piloto OFF) é idêntico ao ctx da 3a (buildContext sem relato)",
  congelar(ctxOff) === congelar(ctx3a),
  `${congelar(ctxOff).length} caracteres de cada lado`,
);
prova("piloto OFF: nenhum perfil consultável", ctxOff.perfilConsultavel === null);
prova("piloto OFF: nenhuma BASE 2", ctxOff.base2.length === 0);
prova("piloto OFF: 3 boas práticas, como sempre foi", ctxOff.boasPraticas.length === 3,
  `recebeu ${ctxOff.boasPraticas.length}`);

// ── PROVA 2 · FAMÍLIA FORA DA LISTA NÃO RECEBE 4A ────────────────────────
w(`\n2. COM O PILOTO EM \`teste\`, FAMÍLIA FORA DA LISTA NÃO RECEBE 4A\n`);
process.env.KOLO_PILOTO_4A = "teste";
process.env.KOLO_PILOTO_4A_FAMILIAS = FAMILIA_PILOTO;
const ctxFora = await chamar(FAMILIA_COMUM);
prova("família fora da lista: perfil consultável ausente", ctxFora.perfilConsultavel === null);
prova("família fora da lista: BASE 2 ausente", ctxFora.base2.length === 0);
prova("família fora da lista: 3 boas práticas (sem o corte da 4A)", ctxFora.boasPraticas.length === 3,
  `recebeu ${ctxFora.boasPraticas.length}`);
prova("família fora da lista: contexto idêntico ao da 3a", congelar(ctxFora) === congelar({ ...ctx3a }),
  "mesma criança, mesmo perfil — só o id da família muda");

// ── PROVA 3 · A FAMÍLIA DO PILOTO RECEBE relato=pedido ───────────────────
w(`\n3. A FAMÍLIA DO PILOTO RECEBE \`relato\` — E ELE CHEGA AO buildContext\n`);
const ctxOn = await chamar(FAMILIA_PILOTO);
prova("piloto: perfil consultável carregado", ctxOn.perfilConsultavel !== null);
prova("piloto: BASE 2 recuperada", ctxOn.base2.length > 0,
  `${ctxOn.base2.length} seções: ${ctxOn.base2.map((s) => s.titulo).join(" · ")}`);
prova("piloto: DUAS boas práticas (o corte da 4A)", ctxOn.boasPraticas.length === 2,
  `recebeu ${ctxOn.boasPraticas.length}`);
// Sem `relato`, `buildContext` NÃO ranqueia — o corte para 2 e a BASE 2 só
// existem quando o texto chegou. São eles a prova de que ele chegou.
prova("piloto: o contexto MUDOU em relação à 3a", congelar(ctxOn) !== congelar(ctx3a));

// ── PROVA 4 · PERFIL E NEGATIVOS CHEGAM AO BLOCO DO MODELO ───────────────
w(`\n4. PERFIL CONSULTÁVEL E NEGATIVOS CHEGAM AO BLOCO QUE VAI AO MODELO\n`);
const blocoOn = buildContextBlock(ctxOn);
const blocoOff = buildContextBlock(ctxOff);
prova("bloco do piloto tem <o_que_ja_sabemos>", blocoOn.includes("<o_que_ja_sabemos>"));
prova("bloco do piloto declara o NEGATIVO da família",
  blocoOn.includes("a família já disse que NÃO é o caso"),
  (blocoOn.match(/a família já disse que NÃO é o caso: [^\n]*/) ?? [""])[0]);
prova("o negativo nomeia sons E luz",
  /NÃO é o caso: [^\n]*[Ss]ons[^\n]*/.test(blocoOn) && /NÃO é o caso: [^\n]*[Ll]uz/.test(blocoOn));
prova("o perfil consultável nomeia os campos que a família JÁ respondeu",
  /Comunicação: sabemos: Como se comunica/.test(blocoOn));
prova("a ÂNCORA do perfil está no bloco", blocoOn.includes("O NÍVEL JÁ DEMONSTRADO É O PISO"));
// ⚠️ DISTINÇÃO QUE IMPORTA, e que esta prova existe para não deixar passar: o
// bloco `<o_que_ja_sabemos>` lista os RÓTULOS dos campos ("sabemos: Como se
// comunica"), não os valores. O valor — "Fala frases" — chega pelo bloco de
// Kolo Vivo, que NÃO é da 4A e já existia. O que a 3b acrescenta é a ÂNCORA que
// diz o que fazer com esse valor, e o NEGATIVO, que o Kolo Vivo não distingue.
prova("o VALOR do nível chega ao modelo (via Kolo Vivo, não via 4A)",
  blocoOn.includes("Fala frases"),
  `no bloco fora do piloto ele ${blocoOff.includes("Fala frases") ? "TAMBÉM está" : "não está"}`);
prova("BASE 2 está no bloco", blocoOn.includes("<como_compreender_este_tema>"));
prova("fora do piloto, nada disso está no bloco",
  !blocoOff.includes("<o_que_ja_sabemos>") &&
  !blocoOff.includes("<como_compreender_este_tema>") &&
  !blocoOff.includes("O NÍVEL JÁ DEMONSTRADO É O PISO"));
w(`\n   bloco fora do piloto: ${blocoOff.length} caracteres`);
w(`   bloco no piloto:      ${blocoOn.length} caracteres  (+${blocoOn.length - blocoOff.length})`);

// ⚠️ A LICENÇA GENERATIVA NÃO É NOVIDADE DA 3b — conferir, não supor.
const licenca = "LICENÇA";
const licencaOff = blocoOff.toUpperCase().includes("LICEN") || blocoOff.includes("invent");
w(`\n   licença generativa fora do piloto: ${licencaOff ? "JÁ ESTAVA LÁ" : "ausente"}`);

// ── PROVA 5 · PELO MECANISMO COMPARTILHADO, NÃO POR CÓPIA ────────────────
w(`\n5. A 4A ENTRA PELO MECANISMO COMPARTILHADO, NÃO POR CÓPIA NO PLANO\n`);
const { readFileSync } = await import("node:fs");
const SRC = "D:/Projetos/Kolo Família/apps/web/src/lib";
const PLANO = readFileSync(`${SRC}/ia/plano.ts`, "utf8");
const ENGINE = readFileSync(`${SRC}/ia/engine.ts`, "utf8");
const nomes4A = /carregarPerfilConsultavel|secoesDe\(|ordenarPorAderencia|ANCORA_PERFIL|LICENCA_GENERATIVA|pilotoQuatroA\(/;
prova("plano.ts não conhece um único nome da 4A", !nomes4A.test(PLANO));
// No engine a regra é sobre CÓDIGO, não sobre comentário: o que não pode é ele
// importar ou chamar a 4A. Os nomes aparecem em prosa, explicando a decisão.
const codigo = (s) => s.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
prova("engine.ts não chama um único nome da 4A", !nomes4A.test(codigo(ENGINE)));
prova("engine.ts não importa o módulo do rollout", !/from ["'][^"']*conducao\/piloto["']/.test(ENGINE));
prova("quem monta tudo é lib/ia/context.ts — o mesmo montador da conversa",
  /pilotoQuatroA\(familyId\) && Boolean\(params\.relato\?\.trim\(\)\)/.test(
    readFileSync(`${SRC}/ia/context.ts`, "utf8"),
  ));

// ── PROVA 6 · O RANKING USA O RELATO, E NÃO SÓ O PESO ────────────────────
//
// O corte para 2 BPs prova que o `relato` chegou, mas não prova que ele mudou a
// ESCOLHA. Dois relatos muito diferentes, com a mesma skill e a mesma idade:
// se a seleção for igual nos dois, o texto está sendo ignorado.
w(`\n6. O RANKING POR ADERÊNCIA USA O TEXTO — não só o peso da BP\n`);
const { recuperarBoasPraticas } = await mod("lib/conhecimento/recuperar.ts");
const escolher = async (relato) =>
  (await recuperarBoasPraticas({
    supabase: bancoFalso(),
    skills: ["socializacao"],
    tags: ["socializacao"],
    idade: 5,
    relato,
    statusAceitos: ["ativo", "rascunho"],
    limite: 2,
  })).map((b) => b.titulo);

const semRelato = await escolher(undefined);
const relatoA = await escolher(
  "Ela fala bem com adultos mas fica em silêncio perto de outras crianças na escola.",
);
const relatoB = await escolher(
  "Ele não dorme sozinho, acorda várias vezes e chora quando apago a luz.",
);
prova("dois relatos diferentes escolhem repertórios diferentes",
  JSON.stringify(relatoA) !== JSON.stringify(relatoB),
  `A: ${relatoA.join(" · ")}\n      B: ${relatoB.join(" · ")}`);
prova("com relato, a escolha difere do puro peso",
  JSON.stringify(relatoA) !== JSON.stringify(semRelato.slice(0, 2)),
  `sem relato: ${semRelato.join(" · ")}`);

// ── PROVA 7 · A LICENÇA GENERATIVA ───────────────────────────────────────
//
// ⚠️ ACHADO, e ele corrige o portão que eu apresentei: a licença NÃO é novidade
// da 3b. `buildContextBlock` a inclui quando há perfil, BASE 2 **ou
// repertório** — e repertório existe para todo mundo. Ela já chegava ao Plano
// na 3a, e chega hoje a toda família da web. O que a 3b acrescenta é o material
// sobre o qual ela fala.
w(`\n7. A LICENÇA GENERATIVA — presente, mas não é novidade da 3b\n`);
const { LICENCA_GENERATIVA } = await mod("lib/conducao/composicao.ts");
const trechoLicenca = LICENCA_GENERATIVA.split("\n")[0].slice(0, 60);
prova("licença no bloco do piloto", blocoOn.includes(trechoLicenca));
prova("licença TAMBÉM no bloco de fora do piloto (não é da 3b)",
  blocoOff.includes(trechoLicenca),
  "a guarda é a presença de material, não a flag — ver lib/ia/prompt.ts");

// ── PROVA 8 · AS FATIAS ANTERIORES CONTINUAM DE PÉ ───────────────────────
w(`\n8. AS FATIAS 1, 2 E 3a CONTINUAM DE PÉ\n`);
const ACOES = readFileSync(
  "D:/Projetos/Kolo Família/apps/web/src/app/(app)/conversar/actions.ts",
  "utf8",
);
prova("Fatia 2: o objetivo da conversa segue alimentando o Plano",
  /objetivoDaConversa\(turnos\)/.test(ACOES) && /enquadrarObjetivo\(alvo\)/.test(ACOES));
prova("Fatia 1: o aprendizado segue sendo carregado no multi-call",
  /carregarAprendizado\(supabase, familyId, membroAtipicoId\)/.test(PLANO));
prova("Fatia 1: e segue viajando com a REGRA junto (SISTEMA_APRENDIZADO)",
  /\$\{aprendizado\}\\n\$\{SISTEMA_APRENDIZADO\}/.test(PLANO));
prova("Fatia 1: é o desafio COM lastro que vai ao montador do contexto",
  /pedido: desafioComLastro,\s*\n\s*\}\);/.test(PLANO));
prova("Fatia 3a: o montador é chamado UMA vez por plano",
  PLANO.split("montarContextoDeSecoes(").length - 1 === 1);
prova("Fatia 3a: as 8 seções recebem o MESMO contexto",
  /pedido: desafioComLastro,\s*\n\s*contextoPronto,/.test(PLANO) &&
  /gerarEntenderObservar\(\{[\s\S]{0,200}?contextoPronto,/.test(PLANO));

// ── PLACAR ───────────────────────────────────────────────────────────────
const falhas = provas.filter((p) => !p.ok);
w(`\n${linha()}\nPLACAR: ${provas.length - falhas.length}/${provas.length} provas`);
if (falhas.length) w(falhas.map((f) => `  ✗ ${f.nome}`).join("\n"));
w(linha());

w(`\n${linha()}\nO BLOCO 4A QUE O PLANO PASSA A RECEBER (o que a 3b acrescenta)\n${linha()}`);
const soNovo = blocoOn.slice(0, blocoOn.indexOf("<boas_praticas") + 1 || blocoOn.length);
w(caixa(soNovo));

writeFileSync(
  `${process.cwd()}/docs/bancada/fatia3b-prova-2026-08-11.txt`,
  out.join("\n"),
  "utf8",
);
console.log("\npronto → docs/bancada/fatia3b-prova-2026-08-11.txt");
process.exit(falhas.length ? 1 : 0);
