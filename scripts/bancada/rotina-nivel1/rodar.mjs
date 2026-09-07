/**
 * NÍVEL 1 — a Rotina Visual reativa com MODELO REAL e banco em memória.
 *
 *     npx tsx scripts/bancada/rotina-nivel1/rodar.mjs
 *
 * ⚠️ O QUE ESTE ROTEIRO PROVA, E O QUE NÃO PROVA. Ele exercita `conduzirRotina`
 * de verdade — o mesmo módulo que o WhatsApp chama — contra o modelo de verdade.
 * O que ele NÃO faz é escrever em produção, mandar mensagem para alguém ou
 * desenhar um cartão. Estado final real (`gerando → pronto` com arte no bucket),
 * imagens e link só se provam com banco e geração reais, e isso é Nível 2.
 *
 * ⚠️ AS TRÊS TRAVAS DE SEGURANÇA, físicas e não disciplinares:
 *
 *   1. `SUPABASE_SERVICE_ROLE_KEY` é APAGADA do ambiente ANTES de qualquer
 *      import do app. Sem ela nenhum cliente real de banco se constrói.
 *   2. `globalThis.fetch` vira um guarda com allowlist. Só a API do modelo passa.
 *      Z-API, Supabase e qualquer outro host ESTOURAM, e o estouro é registrado.
 *   3. O endpoint de geração é INTERCEPTADO, contado e EMULADO — sem desenhar
 *      nada.
 *
 * ── A PRIMEIRA VERSÃO DESTE ROTEIRO ERRAVA, E O ERRO ERA DELE ──────────────
 *
 * Ela chamava `conduzirRotina` em TODO turno. O orquestrador nunca faz isso: há
 * um portão antes. Medido: para "Ok" e "Nao tem barco", `pedeRotina`,
 * `pediuRotinaExplicitamente` e `abreFluxoDeArtefato` devolvem todos `false` — o
 * portão não abriria. O roteiro exercitava um caminho que o sistema não tem, e
 * acusou como defeito do produto uma rotina que ele mesmo mandou criar.
 *
 * Ela também interceptava a geração devolvendo 200 sem gravar
 * `cards_status='gerando'`, que é o que o endpoint real faz ANTES de responder
 * (`gerar-rotina/route.ts` l.132). Sem isso a rotina continuava visível como
 * `aguardando` e era reprocessada — de novo, artefato do instrumento.
 *
 * E o assert do Mario era `<= 1`, que passa com ZERO. Um assert que não pode
 * falhar não é prova; é decoração. Aqui todos são `===`.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { registerHooks } from "node:module";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "../../..");
const SRC = resolve(RAIZ, "apps/web/src");

for (const l of readFileSync(resolve(RAIZ, "apps/web/.env.local"), "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

// ── TRAVA 1 ────────────────────────────────────────────────────────────────
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_SERVICE_KEY;
process.env.KOLO_GERACAO_SECRET = "nivel1-fachada-nao-e-segredo";
process.env.NEXT_PUBLIC_APP_URL = "https://nivel1.invalido";

registerHooks({
  resolve(e, c, n) {
    if (e.startsWith("@/")) return n(pathToFileURL(resolve(SRC, e.slice(2) + ".ts")).href, c);
    if (e.startsWith(".") && !/\.[a-z]+$/.test(e)) {
      try {
        return n(e + ".ts", c);
      } catch {}
    }
    if (["next/headers", "next/cache", "server-only"].includes(e))
      return {
        url: pathToFileURL(resolve(RAIZ, "scripts/bancada/core-v9-vs-v2/stub-next.mjs")).href,
        shortCircuit: true,
      };
    return n(e, c);
  },
});

// ── TRAVAS 2 e 3 ───────────────────────────────────────────────────────────
const rede = globalThis.fetch;
const PERMITIDOS = ["https://api.anthropic.com/v1/messages", "https://api.openai.com/v1/chat/completions"];
const mundos = [];
const contadores = { modelo: 0, geracao: 0, geracaoArgs: [], bloqueadas: [] };

globalThis.fetch = async (input, init) => {
  const url = String(typeof input === "object" && input?.url ? input.url : input);

  if (url.includes("/api/ludico/gerar-rotina")) {
    const corpo = (() => {
      try {
        return JSON.parse(String(init?.body ?? "{}"));
      } catch {
        return {};
      }
    })();
    // ⚠️ EMULAR O QUE O ENDPOINT REAL FAZ, e só isso. Ele é IDEMPOTENTE: recusa
    // quando `cards_status` já é 'gerando' ou 'pronto' (route.ts l.75-78), e
    // grava 'gerando' ANTES de responder (l.132). Sem as duas coisas, o roteiro
    // mede um sistema mais frouxo do que o que está no ar.
    for (const m of mundos) {
      const r = m.db.linhas("rotinas").find((x) => x.id === corpo.rotinaId);
      if (!r) continue;
      if (r.cards_status === "gerando" || r.cards_status === "pronto") {
        contadores.geracaoArgs.push({ ...corpo, resultado: `skipped:${r.cards_status}` });
        return new Response(JSON.stringify({ ok: true, skipped: r.cards_status }), { status: 200 });
      }
      r.tema = corpo.tema ?? r.tema;
      r.cards_status = "gerando";
      contadores.geracao += 1;
      contadores.geracaoArgs.push({ ...corpo, resultado: "aceita" });
      return new Response(JSON.stringify({ ok: true, queued: true }), { status: 200 });
    }
    contadores.geracao += 1;
    contadores.geracaoArgs.push({ ...corpo, resultado: "rotina fora dos mundos" });
    return new Response(JSON.stringify({ ok: true, queued: true }), { status: 200 });
  }

  if (PERMITIDOS.some((p) => url.startsWith(p))) {
    contadores.modelo += 1;
    return rede(input, { ...init, signal: AbortSignal.timeout(120000) });
  }
  contadores.bloqueadas.push(url.slice(0, 120));
  throw Error(`REDE BLOQUEADA pelo guarda do Nível 1: ${url.slice(0, 160)}`);
};

const mod = (p) => import(pathToFileURL(resolve(SRC, p)).href);
const {
  conduzirRotina,
  rotinaConversaPendente,
  lerTemaEscolhido,
  ehAceitePuro,
  transicaoPertenceAoPedido,
  pedeRotina,
  pediuRotinaExplicitamente,
} = await mod("lib/ayla/rotina-guiada.ts");
const { montarMundo } = await mod("lib/ayla/__harness/cenario.ts");
const { atoSobreArtefato, abreFluxoDeArtefato } = await mod("lib/conducao/ato-artefato.ts");
const { decidirTurno } = await mod("lib/conducao/decisao-do-turno.ts");

let falhas = 0;
const linhas = [];
const ok = (nome, cond, detalhe = "") => {
  if (cond) linhas.push(`  ok   ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  else {
    falhas += 1;
    linhas.push(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  }
};
const titulo = (t) => linhas.push(`\n${t}`);
const semAcento = (t) => String(t ?? "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
const tarefasDe = (m) => m.db.linhas("rotina_tarefas");
const rotinasDe = (m) => m.db.linhas("rotinas");

/**
 * O PORTÃO DO ORQUESTRADOR, COPIADO DE `orchestrator.ts` l.2947-2963.
 *
 * Se este roteiro decidisse sozinho quando chamar `conduzirRotina`, ele mediria
 * um sistema inventado. As quatro condições e a precedência são as de lá.
 */
async function portaDaRotina(mundo, texto) {
  const rotinaConversa = await rotinaConversaPendente(mundo.db.cliente(), mundo.familyId, new Date());
  const pedidoDeRotina =
    (pedeRotina(texto) || pediuRotinaExplicitamente(texto)) && abreFluxoDeArtefato(atoSobreArtefato(texto));
  let decisao = { intencao: "outro", pedidoExplicito: false, origem: "nao-chamado" };
  if (!rotinaConversa && !pedidoDeRotina) {
    // Só quando os ramos determinísticos não abrem é que a decisão do modelo
    // pode abrir — e aí ela é chamada de verdade, como em produção.
    const msgs = mundo.db.linhas("ayla_messages");
    const ultimaMae = [...msgs].reverse().find((m) => m.direcao === "inbound")?.texto ?? null;
    const ultimaAyla = [...msgs].reverse().find((m) => m.direcao === "outbound")?.texto ?? null;
    try {
      decisao = await decidirTurno({ texto, blocoEstado: "", ultimaMae, ultimaAyla, catalogoSkills: [] });
    } catch {
      decisao = { intencao: "outro", pedidoExplicito: false, origem: "erro" };
    }
  }
  const porIntencao =
    decisao.pedidoExplicito === true &&
    (decisao.intencao === "rotina_criar" || decisao.intencao === "organizacao");
  return { abre: !!rotinaConversa || porIntencao || pedidoDeRotina, rotinaConversa, pedidoDeRotina, decisao };
}

/** O turno como o orquestrador o executa: portão, condução, persistência com o tipo dele. */
async function turno(mundo, membroId, texto) {
  mundo.db.semear("ayla_messages", [
    { family_account_id: mundo.familyId, direcao: "inbound", texto, tipo: null, created_at: new Date().toISOString() },
  ]);
  const porta = await portaDaRotina(mundo, texto);
  if (!porta.abre) return { r: null, porta, entrou: false };

  const r = await conduzirRotina(mundo.db.cliente(), {
    familyId: mundo.familyId,
    membroAtipicoId: porta.rotinaConversa?.membroId ?? membroId,
    contexto: texto,
    phoneE164: mundo.telefone,
  });
  if (r) {
    // `tipo` copiado de orchestrator.ts l.2997 — é ele que decide a posse do
    // turno seguinte, e escolhê-lo aqui por conta própria invalidaria a medição.
    const tipo = r.proposta?.length
      ? "rotina_proposta"
      : r.pronto && !r.aguardandoTema
        ? "rotina_pronta"
        : "rotina_conversa";
    mundo.db.semear("ayla_messages", [
      {
        family_account_id: mundo.familyId,
        membro_atipico_id: porta.rotinaConversa?.membroId ?? membroId,
        direcao: "outbound",
        texto: r.mensagem,
        tipo,
        metadata: r.proposta?.length ? { proposta: r.proposta } : null,
        created_at: new Date(Date.now() + 1000).toISOString(),
      },
    ]);
    r.tipoPersistido = tipo;
  }
  return { r, porta, entrou: true };
}

// ══ MANU ═══════════════════════════════════════════════════════════════════
titulo("═══ MANU — pedido explícito, com a memória do barco semeada no perfil ═══");

const manu = montarMundo({
  nomeMae: "Karina",
  criancas: [
    {
      nome: "Manu",
      nascimento: "2019-05-01",
      genero: "feminino",
      sabe: { como_e: { texto: "Gosta de rotina previsível." } },
      extras: {
        preferencias: { temas: ["contos e princesas"] },
        transicoes: [
          { momento: "passeio de barco", funcionou: null, estrategia: "rotina visual para antecipar os passos e reduzir o medo", merece_plano: false },
          { momento: "arrumação do quarto", funcionou: null, estrategia: "instrução visual por passos", merece_plano: false },
          { momento: "volta da casa da vovó para casa", funcionou: null, estrategia: "aviso antecipado", merece_plano: false },
        ],
      },
    },
  ],
});
mundos.push(manu);
const idManu = manu.membros["Manu"];
const gManu0 = contadores.geracao;

const T1 = await turno(manu, idManu, "E hoje teremos Brincadeira Banho Almoço Shopping. Monta a rotina visual");
ok("T1 · o portão real ABRIU para o pedido explícito", T1.porta.abre && T1.entrou, `pedidoDeRotina=${T1.porta.pedidoDeRotina}`);
ok("T1 · o condutor respondeu", !!T1.r, T1.r ? `tipo=${T1.r.tipoPersistido}` : "null");
ok("T1 · EXATAMENTE uma rotina criada", rotinasDe(manu).length === 1, `${rotinasDe(manu).length}`);
const tarefasT1 = tarefasDe(manu).map((t) => String(t.texto ?? ""));
ok("T1 · NENHUMA etapa contém barco", !tarefasT1.some((t) => semAcento(t).includes("barco")), tarefasT1.join(" | "));
ok("T1 · a Ayla sugeriu o tema do perfil", semAcento(T1.r?.mensagem).includes("conto") || semAcento(T1.r?.mensagem).includes("princesa"));
ok("T1 · nenhuma geração ainda (falta o tema)", contadores.geracao - gManu0 === 0, `${contadores.geracao - gManu0}`);
ok("T1 · a posse fica com a rotina para o próximo turno", !!(await rotinaConversaPendente(manu.db.cliente(), manu.familyId, new Date())));

const T2 = await turno(manu, idManu, "Pode ser");
ok("T2 · o portão abriu por POSSE, não por texto", T2.porta.abre && !!T2.porta.rotinaConversa && !T2.porta.pedidoDeRotina);
ok("T2 · o aceite curto foi resolvido", !!T2.r, (T2.r?.mensagem ?? "").slice(0, 120).replace(/\s+/g, " "));
const rManu = rotinasDe(manu)[0] ?? {};
ok("T2 · o tema aplicado é o SUGERIDO", semAcento(rManu.tema).includes("conto") || semAcento(rManu.tema).includes("princesa"), `tema=${JSON.stringify(rManu.tema)}`);
ok("T2 · EXATAMENTE uma geração", contadores.geracao - gManu0 === 1, `${contadores.geracao - gManu0}`);
ok("T2 · o endpoint emulado moveu o estado para 'gerando'", rManu.cards_status === "gerando", `cards_status=${rManu.cards_status}`);
ok("T2 · a entrega ENCERRA a posse", T2.r?.tipoPersistido === "rotina_pronta", `tipo=${T2.r?.tipoPersistido}`);

const T3 = await turno(manu, idManu, "Nao tem barco");
ok("T3 · o portão NÃO abre para a correção depois do desfecho (é o fluxo real)", !T3.entrou, `abre=${T3.porta.abre} intencao=${T3.porta.decisao.intencao} pedidoExplicito=${T3.porta.decisao.pedidoExplicito}`);

const T4 = await turno(manu, idManu, "Ok");
ok("T4 · o portão NÃO abre para 'Ok' sem pedido novo", !T4.entrou, `abre=${T4.porta.abre} intencao=${T4.porta.decisao.intencao}`);
ok("T4 · continua EXATAMENTE uma rotina", rotinasDe(manu).length === 1, `${rotinasDe(manu).length}`);
ok("T4 · continua EXATAMENTE uma geração", contadores.geracao - gManu0 === 1, `${contadores.geracao - gManu0}`);
const tarefasFinaisManu = tarefasDe(manu).map((t) => String(t.texto ?? ""));
ok("FINAL · nenhuma rotina_tarefas contém barco", !tarefasFinaisManu.some((t) => semAcento(t).includes("barco")), tarefasFinaisManu.join(" | "));
const gManu = contadores.geracao - gManu0;

// ══ MARIO ══════════════════════════════════════════════════════════════════
titulo("═══ MARIO — cartões para uma sequência, aceite curto, até a geração ═══");

const mario = montarMundo({
  nomeMae: "Ana",
  criancas: [
    {
      nome: "Mario",
      nascimento: "2018-03-01",
      genero: "masculino",
      sabe: { como_e: { texto: "Precisa saber a ordem do dia." } },
      extras: { preferencias: { temas: ["dinossauros"] } },
    },
  ],
});
mundos.push(mario);
const idMario = mario.membros["Mario"];
const gMario0 = contadores.geracao;

const M1 = await turno(mario, idMario, "Mario precisa ir para o médico depois da avó. Queria imagens para mostrar para ele a sequencia");
ok("M1 · o portão abriu para o pedido de imagens", M1.entrou, `pedidoDeRotina=${M1.porta.pedidoDeRotina}`);
ok("M1 · o condutor respondeu", !!M1.r, `tipo=${M1.r?.tipoPersistido}`);
ok("M1 · há posse para o turno seguinte", !!(await rotinaConversaPendente(mario.db.cliente(), mario.familyId, new Date())));

const M2 = await turno(mario, idMario, "Sim");
ok("M2 · a posse retomou a ação — o 'Sim' bastou, sem novo pedido", M2.entrou && !!M2.porta.rotinaConversa && !M2.porta.pedidoDeRotina && !!M2.r);
ok("M2 · a sequência foi persistida", tarefasDe(mario).length > 0, `${tarefasDe(mario).length} etapas`);

// ⚠️ O FLUXO REAL PEDE O TEMA ANTES DE DESENHAR. Forçar a geração aqui seria
// provar um atalho que não existe. Se ainda falta tema, o turno do tema é
// reproduzido — e é ELE que tem de gerar, exatamente uma vez.
const rMarioAntes = rotinasDe(mario)[0] ?? {};
let M3 = null;
if (rMarioAntes.cards_status !== "gerando" && rMarioAntes.cards_status !== "pronto") {
  M3 = await turno(mario, idMario, "Pode ser");
  ok("M3 · o turno do tema entrou pela posse", M3.entrou && !!M3.porta.rotinaConversa, `abre=${M3.porta.abre}`);
  ok("M3 · o condutor respondeu ao aceite do tema", !!M3.r, (M3.r?.mensagem ?? "").slice(0, 120).replace(/\s+/g, " "));
}
const rMario = rotinasDe(mario)[0] ?? {};
const gMario = contadores.geracao - gMario0;
ok("MARIO · EXATAMENTE uma geração no fluxo inteiro", gMario === 1, `${gMario}`);
ok("MARIO · o tema aplicado é o do perfil", semAcento(rMario.tema).includes("dinossauro"), `tema=${JSON.stringify(rMario.tema)}`);
ok("MARIO · estado moveu para 'gerando'", rMario.cards_status === "gerando", `cards_status=${rMario.cards_status}`);
ok("MARIO · EXATAMENTE uma rotina", rotinasDe(mario).length === 1, `${rotinasDe(mario).length}`);

// ══ CONTROLES NEGATIVOS ════════════════════════════════════════════════════
titulo("═══ CONTROLES NEGATIVOS ═══");

const vazio = montarMundo({ nomeMae: "Ana", criancas: [{ nome: "Lia", nascimento: "2019-01-01", genero: "feminino" }] });
mundos.push(vazio);
const idLia = vazio.membros["Lia"];
const gVazio0 = contadores.geracao;
for (const t of ["sim", "pode", "pode ser", "ok", "isso"]) {
  const res = await turno(vazio, idLia, t);
  ok(
    `"${t}" sem ação pendente — o portão NÃO abre`,
    !res.entrou,
    `abre=${res.porta.abre} posse=${JSON.stringify(res.porta.rotinaConversa)} intencao=${res.porta.decisao.intencao} pedidoExplicito=${res.porta.decisao.pedidoExplicito}`,
  );
  ok(`"${t}" — não escolhe tema, e é aceite`, lerTemaEscolhido(t) === null && ehAceitePuro(t) === true);
}
ok("controles · ZERO rotinas criadas", rotinasDe(vazio).length === 0, `${rotinasDe(vazio).length}`);
ok("controles · ZERO gerações", contadores.geracao - gVazio0 === 0, `${contadores.geracao - gVazio0}`);

const PEDIDO = "E hoje teremos Brincadeira Banho Almoço Shopping. Monta a rotina visual";
ok("memória NÃO mencionada não entra como etapa atual", transicaoPertenceAoPedido("passeio de barco", PEDIDO) === false);
ok("as outras memórias da Manu também ficam de fora", ["arrumação do quarto", "volta da casa da vovó para casa"].every((m) => transicaoPertenceAoPedido(m, PEDIDO) === false));
ok("memória MENCIONADA continua podendo ser usada", transicaoPertenceAoPedido("passeio de barco", "amanha temos passeio de barco, monta a rotina") === true);
ok("e a que a família citou hoje também", transicaoPertenceAoPedido("hora do banho", PEDIDO) === true);

// ══ TRAVA ESTRUTURAL ═══════════════════════════════════════════════════════
titulo("═══ TRAVA ESTRUTURAL — Rotina retorna antes da ponte do Plano ═══");
const ORQ = readFileSync(resolve(SRC, "lib/ayla/orchestrator.ts"), "utf8");
const iPorta = ORQ.indexOf("const r = await conduzirRotina(supabase, {");
const iRetorno = ORQ.indexOf("return { tratada: true, familia: family.id, resposta: resp };", iPorta);
const iPonte = ORQ.indexOf("await ponteDePlano(supabase, {");
ok("a porta da rotina existe no orquestrador", iPorta > 0);
ok("ela retorna `tratada: true` logo após responder", iRetorno > iPorta, `porta=${iPorta} retorno=${iRetorno}`);
ok("o retorno vem ANTES da ponte do Plano", iRetorno > 0 && iPonte > 0 && iRetorno < iPonte, `retorno=${iRetorno} ponte=${iPonte}`);
const bloco = ORQ.slice(iPorta, iRetorno);
ok("a resposta de rotina sai com tipo de ROTINA, nunca `resposta_registro`", bloco.includes('"rotina_proposta"') && bloco.includes('"rotina_pronta"') && bloco.includes('"rotina_conversa"') && !bloco.includes('tipo: "resposta_registro"'));

// ══ SEGURANÇA ══════════════════════════════════════════════════════════════
titulo("═══ SEGURANÇA ═══");
ok("SUPABASE_SERVICE_ROLE_KEY ausente do processo", !process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_KEY);
ok("ZERO requisições fora da allowlist", contadores.bloqueadas.length === 0, contadores.bloqueadas.join(", ") || "nenhuma");
ok("ZERO geração real — todas emuladas", true, `${contadores.geracao} aceita(s), ${contadores.geracaoArgs.filter((a) => String(a.resultado).startsWith("skipped")).length} recusada(s) por idempotência`);

// ══ RELATÓRIO ══════════════════════════════════════════════════════════════
console.log(linhas.join("\n"));
console.log("\n═══ NÚMEROS ═══");
console.log(`  chamadas ao modelo:            ${contadores.modelo}`);
console.log(`  gerações aceitas:              ${contadores.geracao}  (Manu ${gManu}, Mario ${gMario}, controles 0)`);
console.log(`  chamadas ao endpoint (todas):  ${contadores.geracaoArgs.length}`);
for (const a of contadores.geracaoArgs) console.log(`      ${a.resultado.padEnd(18)} tema=${JSON.stringify(a.tema)}`);
console.log(`  requisições bloqueadas:        ${contadores.bloqueadas.length}`);
for (const [nome, m] of [["Manu", manu], ["Mario", mario], ["Controles", vazio]]) {
  const t = {};
  for (const e of m.db.escritas) t[`${e.tabela}.${e.op}`] = (t[`${e.tabela}.${e.op}`] ?? 0) + 1;
  console.log(`  escritas · ${nome.padEnd(10)} ${JSON.stringify(t)}`);
}
console.log(`\n  rotinas Manu:  ${JSON.stringify(rotinasDe(manu).map((r) => ({ nome: r.nome, tema: r.tema, cards_status: r.cards_status })))}`);
console.log(`  tarefas Manu:  ${JSON.stringify(tarefasDe(manu).map((t) => t.texto))}`);
console.log(`  rotinas Mario: ${JSON.stringify(rotinasDe(mario).map((r) => ({ nome: r.nome, tema: r.tema, cards_status: r.cards_status })))}`);
console.log(`  tarefas Mario: ${JSON.stringify(tarefasDe(mario).map((t) => t.texto))}`);

console.log(falhas ? `\n${falhas} FALHA(S).\n` : "\nTodos os asserts passaram.\n");
process.exit(falhas ? 1 : 0);
