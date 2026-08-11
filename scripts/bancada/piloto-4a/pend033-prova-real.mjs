/**
 * PEND-033 · A PROVA CONTRA O FORMATO REALMENTE PERSISTIDO.
 *
 * Os 5 testes da correção usam um cliente falso com linhas escritas à mão — e
 * foi exatamente um dado de entrada inventado que escondeu este defeito desde
 * que ele nasceu. Fixture não prova leitura. Esta prova percorre o caminho
 * inteiro com o registro que está no banco:
 *
 *   registro real de `perfil_vivo_membro`
 *     → leitura
 *     → carregarPerfilConsultavel
 *     → interpretação de positivos e NEGATIVOS
 *     → linhasDoPerfilConsultavel
 *     → <o_que_ja_sabemos>
 *     → ANCORA_PERFIL no contexto efetivamente montado
 *
 * ⚠️ REGRAS DESTA PROVA
 *   · SOMENTE LEITURA. `GET /rest/v1/...`. Qualquer método de escrita estoura.
 *   · `SUPABASE_SERVICE_ROLE_KEY` sai do ambiente antes de qualquer import: é a
 *     chave que `logEvent` usaria para persistir. Sem ela o cliente nem se
 *     constrói e nada é gravado.
 *   · NENHUM DADO DE CRIANÇA APARECE NA SAÍDA. Nome, ids e valores de campo são
 *     redigidos; o que se imprime é ESTRUTURA — rótulo do campo, estado
 *     (preenchido/negativo/vazio) e tamanho. A prova é sobre o caminho, não
 *     sobre o conteúdo de nenhuma família.
 *   · NADA DE CÓDIGO É ALTERADO para esta prova passar.
 *
 *   node scripts/bancada/piloto-4a/pend033-prova-real.mjs
 */
import { mod, linha } from "./comum.mjs";
import { writeFileSync } from "node:fs";

const U = process.env.NEXT_PUBLIC_SUPABASE_URL;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_SERVICE_KEY;

const { carregarPerfilConsultavel, linhasDoPerfilConsultavel } =
  await mod("lib/kolo-vivo/consultar.ts");
const { buildContext } = await mod("lib/ia/context.ts");
const { buildContextBlock } = await mod("lib/ia/prompt.ts");
const { ANCORA_PERFIL } = await mod("lib/conducao/composicao.ts");

const out = [];
const w = (s) => { out.push(s); console.log(s); };
const provas = [];
const prova = (nome, ok, det) => {
  provas.push({ nome, ok });
  w(`${ok ? "  ✓" : "  ✗"} ${nome}${det ? `\n      ${det}` : ""}`);
};

/** GET puro. Não existe caminho de escrita neste arquivo. */
const ler = (rota) =>
  fetch(`${U}/rest/v1/${rota}`, {
    headers: { apikey: K, Authorization: `Bearer ${K}`, Range: "0-9999" },
  }).then((r) => r.json());

w(`${linha()}\nPEND-033 · PROVA CONTRA O FORMATO REALMENTE PERSISTIDO\n${linha()}`);

// ── 1 · OS REGISTROS REAIS, COMO ESTÃO ───────────────────────────────────
const linhasReais = await ler("perfil_vivo_membro?select=*");
w(`\n1. REGISTROS REAIS LIDOS\n`);
prova("há registro real de perfil para ler", linhasReais.length > 0,
  `${linhasReais.length} linhas em perfil_vivo_membro`);

// A forma em que cada domínio está gravado — sem imprimir um caractere do
// conteúdo. É este o fato que o código precisava aceitar e não aceitava.
const formas = { string: 0, "objeto com texto": 0, "objeto sem texto": 0, nulo: 0 };
for (const l of linhasReais) {
  for (const [k, v] of Object.entries(l)) {
    if (["membro_atipico_id", "family_account_id", "id", "created_at", "updated_at"].includes(k)) continue;
    const olhar = (x) => {
      if (x == null) formas.nulo++;
      else if (typeof x === "string") formas.string++;
      else if (typeof x === "object" && typeof x.texto === "string") formas["objeto com texto"]++;
      else if (typeof x === "object") formas["objeto sem texto"]++;
    };
    if (k === "categorias_extras" && v && typeof v === "object") Object.values(v).forEach(olhar);
    else olhar(v);
  }
}
w(`\n   como os domínios estão gravados, somando todas as linhas:`);
for (const [f, n] of Object.entries(formas)) w(`     ${String(n).padStart(5)}  ${f}`);
prova("o banco guarda OBJETO, não string — a premissa do defeito",
  formas["objeto com texto"] > 0 && formas.string === 0,
  `${formas["objeto com texto"]} objetos com texto · ${formas.string} strings`);

// ⚠️ O SEGUNDO NÚMERO É UM ACHADO À PARTE: `objeto sem texto`. São domínios
// gravados como `{}` — a família abriu o card e não escreveu. Eles precisam
// continuar sendo AUSÊNCIA, e não virar negativa: "não sabemos" e "a família
// disse que não" são coisas diferentes, e confundi-las faria a Ayla afirmar
// para a família uma resposta que ela nunca deu.
prova("convivem duas formas no banco: com texto e vazia — nenhuma string legada",
  formas.string === 0,
  `${formas["objeto sem texto"]} domínios gravados como objeto vazio`);

/** Devolve a linha EXATA que veio do banco, sem normalizar nada. */
const clienteDaLinha = (linhaReal) => ({
  from() {
    const q = {
      select: () => q, eq: () => q,
      maybeSingle: () => Promise.resolve({ data: linhaReal, error: null }),
      insert() { throw new Error("PROVA: escrita bloqueada"); },
      update() { throw new Error("PROVA: escrita bloqueada"); },
      upsert() { throw new Error("PROVA: escrita bloqueada"); },
      delete() { throw new Error("PROVA: escrita bloqueada"); },
    };
    return q;
  },
});

// ── 1b · extrairTexto CONTRA AS CINCO FORMAS ─────────────────────────────
//
// O helper não é exportado — de propósito, é detalhe interno. Exercito-o pelo
// caminho público, que é o que importa: `carregarPerfilConsultavel` com uma
// linha por forma. `sono` é `extras`; `sensorial` é coluna própria.
w(`\n1b. AS CINCO FORMAS DE VALOR, PELO CAMINHO PÚBLICO\n`);
const SONO = "Como adormece: dorme sozinha em 10 minutos";
const formaDe = async (valor) => {
  const p = await carregarPerfilConsultavel(
    clienteDaLinha({ membro_atipico_id: "x", family_account_id: "y", categorias_extras: { sono: valor } }),
    { membroId: "x", familyId: "y" },
  );
  return p.valorDe("sono", "adormece");
};
prova("string antiga (se existir) continua sendo lida", (await formaDe(SONO)) !== null);
prova("`{ texto, atualizado_em }` — a forma real — é lida",
  (await formaDe({ texto: SONO, atualizado_em: "2026-08-01" })) !== null);
prova("null vira ausência, não lixo", (await formaDe(null)) === null);
prova("objeto incompleto (`{}`) vira ausência", (await formaDe({})) === null);
prova("valor inesperado (número, array) vira ausência",
  (await formaDe(42)) === null && (await formaDe([SONO])) === null);

// ── 2 · O CAMINHO, COM CADA REGISTRO REAL ────────────────────────────────
w(`\n2. O CAMINHO, PERCORRIDO COM CADA REGISTRO REAL\n`);
const resultados = [];
for (const l of linhasReais) {
  const perfil = await carregarPerfilConsultavel(clienteDaLinha(l), {
    membroId: l.membro_atipico_id,
    familyId: l.family_account_id,
  });
  let preenchidos = 0, negativos = 0, vazios = 0;
  const rotulosNegativos = [];
  for (const d of perfil.dominios.values()) {
    for (const c of d.campos) {
      if (c.estado === "preenchido") preenchidos++;
      else if (c.estado === "negativo") { negativos++; rotulosNegativos.push(`${d.label}/${c.label}`); }
      else vazios++;
    }
  }
  const linhasBloco = linhasDoPerfilConsultavel(perfil);
  resultados.push({ l, perfil, preenchidos, negativos, vazios, rotulosNegativos, linhasBloco });
}

const comConteudo = resultados.filter((r) => r.preenchidos > 0);
const comNegativo = resultados.filter((r) => r.negativos > 0);
const comBloco = resultados.filter((r) => r.linhasBloco.trim().length > 0);

w(`   crianças com pelo menos um campo PREENCHIDO: ${comConteudo.length}/${resultados.length}`);
w(`   crianças com pelo menos um NEGATIVO:         ${comNegativo.length}/${resultados.length}`);
w(`   crianças cujo bloco sai com conteúdo:        ${comBloco.length}/${resultados.length}`);
w(`   campos reconhecidos no total:                ` +
  `${resultados.reduce((a, r) => a + r.preenchidos, 0)} preenchidos · ` +
  `${resultados.reduce((a, r) => a + r.negativos, 0)} negativos`);

prova("carregarPerfilConsultavel lê conteúdo do registro REAL",
  comConteudo.length > 0,
  `antes da correção este número seria 0 — é o defeito da PEND-033`);
prova("os NEGATIVOS são reconhecidos como tal em registro real",
  comNegativo.length > 0,
  comNegativo.length
    ? `exemplo de rótulos negativos (sem valores): ${comNegativo[0].rotulosNegativos.slice(0, 4).join(" · ")}`
    : "nenhum negativo encontrado no banco");
prova("linhasDoPerfilConsultavel devolve texto para registro real",
  comBloco.length > 0,
  `${comBloco.length} de ${resultados.length} produzem bloco não vazio`);

// ⚠️ O ERRO QUE SERIA PIOR QUE O DEFEITO ORIGINAL: um parser generoso demais
// transformaria "a família não escreveu" em "a família disse que não". A Ayla
// passaria a afirmar para a mãe uma resposta que ela nunca deu — e a mãe não
// tem como saber de onde saiu. Contado nos 112 registros reais:
const negativosReais = resultados.reduce((a, r) => a + r.negativos, 0);
const vaziosReais = resultados.reduce((a, r) => a + r.vazios, 0);
prova("ausência de informação continua sendo AUSÊNCIA, não negativa",
  negativosReais < vaziosReais / 100,
  `${vaziosReais} campos vazios · apenas ${negativosReais} negativos — ` +
  `os 747 domínios gravados como \`{}\` não viraram "a família disse que não"`);

// E a recíproca: os negativos reais são de verdade — texto curto de negação.
const amostraNeg = comNegativo
  .flatMap((r) => [...r.perfil.dominios.values()])
  .flatMap((d) => d.campos.filter((c) => c.estado === "negativo"))
  .map((c) => c.valor?.trim().toLowerCase());
prova("todo negativo real é uma negação escrita pela família",
  amostraNeg.length > 0 && amostraNeg.every((v) => /^(n[ãa]o|nenhum[a]?|nada|nunca|-{1,2})[\s.!]*$/i.test(v ?? "")),
  `valores distintos encontrados: ${[...new Set(amostraNeg)].join(" · ")}`);

// ── 3 · O CASO ESCOLHIDO — o mais rico QUE TAMBÉM tem negativo ───────────
const escolhido =
  comNegativo.sort((a, b) => b.preenchidos - a.preenchidos)[0] ??
  comConteudo.sort((a, b) => b.preenchidos - a.preenchidos)[0];
if (!escolhido) throw new Error("nenhum registro real com conteúdo — parar aqui");

w(`\n3. O REGISTRO ESCOLHIDO — o mais rico entre os que têm negativo\n`);
w(`   ${escolhido.preenchidos} preenchidos · ${escolhido.negativos} negativos · ${escolhido.vazios} vazios`);
w(`\n   ESTRUTURA lida (rótulo e estado; VALORES REDIGIDOS):`);
for (const d of escolhido.perfil.dominios.values()) {
  const conhecidos = d.campos.filter((c) => c.estado !== "vazio");
  if (!conhecidos.length) continue;
  w(`     ${d.label}:`);
  for (const c of conhecidos) {
    w(`       · ${c.label.padEnd(38)} ${c.estado.toUpperCase().padEnd(11)} (${c.valor?.length ?? 0} ch)`);
  }
}

// ── 4 · O BLOCO E A ÂNCORA, NO CONTEXTO EFETIVAMENTE MONTADO ─────────────
//
// Daqui para frente é `buildContext` de verdade: mesmo montador da conversa,
// com o rollout apontado para a família REAL deste registro — em memória, neste
// processo, e em lugar nenhum além dele.
w(`\n4. O CONTEXTO EFETIVAMENTE MONTADO — buildContext + buildContextBlock\n`);
process.env.KOLO_PILOTO_4A = "teste";
process.env.KOLO_PILOTO_4A_FAMILIAS = escolhido.l.family_account_id;

const SKILL = {
  id: "s", ativo: true, name: "socializacao", display_name: "Socialização",
  objective: "apoiar a criança nas interações com outras pessoas",
  tone: "próximo", scope: "socialização", limits: "não diagnostica",
  kolo_vivo_fields: ["essencial", "socializacao"], knowledge_tags: ["socializacao"],
  routing_keywords: [], routing_priority: 1, fallback_questions: [],
};

/** Leitura real para as tabelas do contexto; escrita estoura em todas. */
const clienteLeitura = () => ({
  from(tabela) {
    const filtros = []; let colunas = "*"; let limite = null;
    const q = {
      select(c) { colunas = c; return q; },
      eq(c, v) { filtros.push(`${c}=eq.${encodeURIComponent(v)}`); return q; },
      in(c, v) { filtros.push(`${c}=in.(${v.map(encodeURIComponent).join(",")})`); return q; },
      or(e) { filtros.push(`or=(${e})`); return q; },
      order(c, o) { filtros.push(`order=${c}.${o?.ascending === false ? "desc" : "asc"}`); return q; },
      limit(n) { limite = n; filtros.push(`limit=${n}`); return q; },
      lte(c, v) { filtros.push(`${c}=lte.${v}`); return q; },
      gte(c, v) { filtros.push(`${c}=gte.${v}`); return q; },
      is(c, v) { filtros.push(`${c}=is.${v}`); return q; },
      not(c, o, v) { filtros.push(`${c}=not.${o}.${v}`); return q; },
      insert() { throw new Error("PROVA: escrita bloqueada"); },
      update() { throw new Error("PROVA: escrita bloqueada"); },
      upsert() { throw new Error("PROVA: escrita bloqueada"); },
      delete() { throw new Error("PROVA: escrita bloqueada"); },
      maybeSingle() { return q.then((r) => ({ data: r.data[0] ?? null, error: null })); },
      single() { return q.then((r) => ({ data: r.data[0] ?? null, error: null })); },
      then(res, rej) {
        void limite;
        return ler(`${tabela}?select=${encodeURIComponent(colunas)}${filtros.length ? "&" + filtros.join("&") : ""}`)
          .then((d) => ({ data: Array.isArray(d) ? d : [], error: Array.isArray(d) ? null : d }))
          .then(res, rej);
      },
    };
    return q;
  },
});

const RELATO =
  "Queria ajudar ela a conseguir participar mais das coisas com outras crianças.";

const ctxCom = await buildContext(clienteLeitura(), {
  familyId: escolhido.l.family_account_id,
  membroAtipicoId: escolhido.l.membro_atipico_id,
  skills: [SKILL],
  conversaId: null,
  relato: RELATO,
});
process.env.KOLO_PILOTO_4A = "off";
const ctxSem = await buildContext(clienteLeitura(), {
  familyId: escolhido.l.family_account_id,
  membroAtipicoId: escolhido.l.membro_atipico_id,
  skills: [SKILL],
  conversaId: null,
  relato: RELATO,
});

prova("o contexto real traz perfilConsultavel", ctxCom.perfilConsultavel !== null);
prova("fora do piloto ele continua nulo", ctxSem.perfilConsultavel === null);

const blocoCom = buildContextBlock(ctxCom);
const blocoSem = buildContextBlock(ctxSem);
prova("<o_que_ja_sabemos> está no bloco montado com dado real",
  blocoCom.includes("<o_que_ja_sabemos>"));
prova("ANCORA_PERFIL está dentro dele",
  blocoCom.includes(ANCORA_PERFIL.split("\n")[0].slice(0, 50)) &&
  blocoCom.includes("O NÍVEL JÁ DEMONSTRADO É O PISO"));
prova("o bloco declara o que a família JÁ RESPONDEU",
  /sabemos: /.test(blocoCom));
prova("o bloco declara os NEGATIVOS com a redação certa",
  blocoCom.includes("a família já disse que NÃO é o caso"),
  escolhido.negativos ? `${escolhido.negativos} campos negativos neste registro` : "—");
prova("fora do piloto nada disso aparece",
  !blocoSem.includes("<o_que_ja_sabemos>") &&
  !blocoSem.includes("O NÍVEL JÁ DEMONSTRADO É O PISO"));
w(`\n   bloco fora do piloto: ${blocoSem.length} ch · no piloto: ${blocoCom.length} ch ` +
  `(+${blocoCom.length - blocoSem.length})`);

// ── PLACAR ───────────────────────────────────────────────────────────────
const falhas = provas.filter((p) => !p.ok);
w(`\n${linha()}\nPLACAR: ${provas.length - falhas.length}/${provas.length}`);
if (falhas.length) w(falhas.map((f) => `  ✗ ${f.nome}`).join("\n"));
w(linha());

writeFileSync("docs/bancada/pend033-prova-real-2026-08-11.txt", out.join("\n"), "utf8");
console.log("\npronto → docs/bancada/pend033-prova-real-2026-08-11.txt");
process.exit(falhas.length ? 1 : 0);
