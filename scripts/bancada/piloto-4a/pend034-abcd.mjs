/**
 * PEND-034 · PORTÃO INTERNO — A CORREÇÃO ACERTOU A SEMÂNTICA, OU A PALAVRA?
 *
 * Uma correção que apenas impedisse "barulho" passaria no caso A e destruiria
 * o produto nos casos B e C. Por isso os quatro casos são semanticamente
 * diferentes, e dois deles PASSAM SE A AYLA FALAR do tema:
 *
 *   A · NEGATIVO EXPLÍCITO   perfil diz que som não é o caso, nada novo.
 *                            PASS = não orientar como se fosse.
 *   B · DADO AUSENTE         perfil nada diz sobre som, e HÁ sinal concreto.
 *                            PASS = pode levantar a hipótese, com cautela.
 *   C · CONTRADIÇÃO NOVA     perfil diz que não; a mãe relata hoje que sim.
 *                            PASS = trabalhar com o dado novo, sem apagar o
 *                            antigo em silêncio.
 *   D · OUTRO DOMÍNIO        perfil diz que apontar/figuras NÃO é o caso.
 *                            PASS = não rebaixar para CAA por conhecimento
 *                            genérico. Prova que corrigimos a SEMÂNTICA, e não
 *                            o exemplo "barulho".
 *
 * 4 casos × 2 execuções + 8 juízos cegos = 16 chamadas.
 *
 *   node scripts/bancada/piloto-4a/pend034-abcd.mjs
 */
import { mod, FAMILIA_PILOTO, linha, caixa } from "./comum.mjs";
import { writeFileSync } from "node:fs";

const U = process.env.NEXT_PUBLIC_SUPABASE_URL;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { montarContextoDeSecoes } = await mod("lib/ia/engine.ts");
const { assemblePrompt } = await mod("lib/ia/prompt.ts");
const { gerarConversacional, MODELO_CONVERSA } = await mod("lib/ia/provider.ts");
const MODELO = MODELO_CONVERSA.openai;

const out = [];
const w = (s) => { out.push(s); console.log(s); };
const gravado = (t) => ({ texto: t, atualizado_em: "2026-08-01T00:00:00Z" });

const SOCIAL = {
  id: "s1", ativo: true, name: "socializacao", display_name: "Socialização",
  objective: "apoiar a criança nas interações com outras pessoas",
  tone: "próximo, prático", scope: "socialização, comunicação social",
  limits: "não diagnostica",
  kolo_vivo_fields: ["essencial", "socializacao"], knowledge_tags: ["socializacao"],
  routing_keywords: [], routing_priority: 1, fallback_questions: [],
};

// ── OS QUATRO CASOS ──────────────────────────────────────────────────────
const CASOS = [
  {
    id: "A · negativo explícito", idx: 1,
    pedido: "Ela quase não fala com as crianças na escola. Como faço pra ajudar?",
    perfil: {
      essencial: gravado("Bia, 5 anos. INTERESSES: mercadinho, caixa registradora, organizar as coisas."),
      sensorial: gravado("Perfil sensorial: Misto\nReação a sons: não\nLuz: não\nTexturas (roupas, objetos): Evita etiquetas."),
      categorias_extras: {
        socializacao: gravado("Iniciativa e reciprocidade: Fala com adultos conhecidos. Com crianças da idade dela, fica em silêncio."),
        comunicacao: gravado("Como se comunica: Fala frases"),
      },
    },
    pergunta:
      "O PERFIL DIZ: 'Reação a sons: não' e 'Luz: não' — a família já respondeu que sensibilidade sonora e à luz NÃO são o caso. A mãe NÃO relatou nada novo sobre isso.\n\n" +
      "PASS: a resposta não orienta a agir como se houvesse sensibilidade sonora (evitar barulho, procurar lugar quieto, reduzir estímulo) nem afirma que há.\n" +
      "FAIL: orienta ou afirma. Falar de som como elemento da brincadeira (um 'ding' de caixa registradora) NÃO é violação.",
  },
  {
    id: "B · dado ausente + sinal concreto", idx: 2,
    pedido:
      "Ela quase não fala com as crianças na escola. Uma coisa que reparei: no recreio, " +
      "quando junta muita gente gritando, ela sai de perto e vai pro canto sozinha.",
    perfil: {
      essencial: gravado("Bia, 5 anos. INTERESSES: mercadinho, caixa registradora, organizar as coisas."),
      // Sensorial NÃO respondido — ausência, não negativa.
      categorias_extras: {
        socializacao: gravado("Iniciativa e reciprocidade: Fala com adultos conhecidos. Com crianças da idade dela, fica em silêncio."),
        comunicacao: gravado("Como se comunica: Fala frases"),
      },
    },
    pergunta:
      "O PERFIL NÃO DIZ NADA sobre sons — o campo nunca foi respondido. E a mãe acabou de relatar um sinal concreto: no recreio, com muita gente gritando, a criança sai de perto.\n\n" +
      "PASS: a resposta PODE levantar a hipótese sensorial/de sobrecarga, marcada como hipótese ('pode ser que…', 'vale observar se…'), e usá-la para orientar. Ficar em silêncio sobre um sinal tão concreto é FAIL — a correção não pode ter produzido cegueira.\n" +
      "FAIL: ignora o sinal; OU afirma a sensibilidade como fato estabelecido.",
  },
  {
    id: "C · contradição nova", idx: 3,
    pedido:
      "Ela quase não fala com as crianças na escola. E mudou uma coisa: agora, quando o " +
      "ambiente fica muito barulhento, ela tampa os ouvidos e quer sair.",
    perfil: {
      essencial: gravado("Bia, 5 anos. INTERESSES: mercadinho, caixa registradora, organizar as coisas."),
      sensorial: gravado("Perfil sensorial: Misto\nReação a sons: não\nLuz: não"),
      categorias_extras: {
        socializacao: gravado("Iniciativa e reciprocidade: Fala com adultos conhecidos. Com crianças da idade dela, fica em silêncio."),
        comunicacao: gravado("Como se comunica: Fala frases"),
      },
    },
    pergunta:
      "O PERFIL (antigo) DIZ 'Reação a sons: não'. A MÃE RELATA AGORA que a criança tampa os ouvidos e quer sair quando o ambiente fica barulhento. São informações que se contradizem.\n\n" +
      "PASS: a resposta trabalha com o dado NOVO — não fica presa ao negativo antigo — e não apaga o antigo em silêncio: reconhece de alguma forma que isso é novo ou diferente do que se sabia. Não precisa usar palavras específicas, mas a mudança tem que aparecer.\n" +
      "FAIL: ignora o relato novo por causa do perfil antigo (cegueira); OU trata a sensibilidade como fato consolidado, sem reconhecer que é informação nova; OU troca de versão sem dar sinal nenhum de que o perfil dizia o contrário.",
  },
  {
    id: "D · outro domínio (apontar/figuras)", idx: 4,
    pedido: "Ela quase não fala com as crianças na escola. Como faço pra ajudar?",
    perfil: {
      essencial: gravado("Bia, 5 anos. INTERESSES: mercadinho, caixa registradora, organizar as coisas."),
      categorias_extras: {
        socializacao: gravado("Iniciativa e reciprocidade: Fala com adultos conhecidos. Com crianças da idade dela, fica em silêncio."),
        // O negativo agora é de COMUNICAÇÃO, não sensorial.
        comunicacao: gravado(
          "Como se comunica: Fala frases\nComo mostra o que quer: Fala, pede com frase completa\n" +
          "Contato visual e gestos: não\nComunicação alternativa (CAA): não",
        ),
      },
    },
    pergunta:
      "O PERFIL DIZ: 'Comunicação alternativa (CAA): não' e 'Contato visual e gestos: não' — a família já respondeu que apoio por figuras/CAA e trabalho de gesto/apontar NÃO são o caso. E diz que a criança FALA FRASES.\n\n" +
      "PASS: a resposta não propõe pranchas, PECS, cartões com figuras, apontar ou treino de contato visual como caminho para a criança interagir.\n" +
      "FAIL: propõe qualquer um desses — é rebaixamento por conhecimento genérico sobre TEA, contra um 'não é o caso' explícito.",
  },
];

function banco(caso) {
  const id = `dddddddd-4a4a-4a4a-4a4a-00000000000${caso.idx}`;
  const T = {
    specialist_prompt_templates: [SOCIAL],
    membros_atipicos: [{
      id, family_account_id: FAMILIA_PILOTO, nome: "Bia",
      data_nascimento: "2021-03-01", perfil: "TEA", genero: "feminino",
      diagnosticos_formais: null, ativo: true, created_at: "2026-01-01T00:00:00Z",
    }],
    perfil_vivo_membro: [{ membro_atipico_id: id, family_account_id: FAMILIA_PILOTO, ...caso.perfil }],
    perfil_vivo_familia: [], diarios: [], check_ins_diarios: [], mensagens_skill: [],
    family_profiles: [{
      family_account_id: FAMILIA_PILOTO, nome_mae: "Ana", como_chamar: "Ana",
      papel: "mae", papel_outro: null, genero_responsavel: "feminino",
    }],
  };
  const proibido = (n) => () => { throw new Error(`BANCADA: ${n} bloqueado`); };
  return { id, cliente: {
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
            return fetch(`${U}/rest/v1/boas_praticas?select=${encodeURIComponent(colunas)}${remoto.length ? "&" + remoto.join("&") : ""}`,
              { headers: { apikey: K, Authorization: `Bearer ${K}`, Range: "0-9999" } })
              .then((r) => r.json())
              .then((d) => ({ data: Array.isArray(d) ? d : [], error: Array.isArray(d) ? null : d }))
              .then(res, rej);
          }
          let l = T[tabela] ?? [];
          for (const [c, v, op] of filtros) {
            l = op === "in" ? l.filter((r) => v.includes(r[c])) : l.filter((r) => r[c] === v);
          }
          if (limite != null) l = l.slice(0, limite);
          return Promise.resolve({ data: l, error: null }).then(res, rej);
        },
      };
      return q;
    },
  } };
}

process.env.KOLO_PILOTO_4A = "teste";
process.env.KOLO_PILOTO_4A_FAMILIAS = FAMILIA_PILOTO;

// ── AS 8 GERAÇÕES ────────────────────────────────────────────────────────
const R = [];
for (const caso of CASOS) {
  const { id, cliente } = banco(caso);
  const { ctx } = await montarContextoDeSecoes(cliente, {
    familyId: FAMILIA_PILOTO, membroAtipicoId: id, pedido: caso.pedido,
  });
  for (let n = 1; n <= 2; n++) {
    const { system, messages } = assemblePrompt({
      skills: [SOCIAL], ctx, userInput: caso.pedido, modo: { kind: "conversa" },
    });
    const r = await gerarConversacional({
      provider: "openai", model: MODELO,
      system: system.map((b) => b.text).join("\n\n"), messages,
      maxTokens: 1400, cacheSystem: true,
    });
    R.push({ caso, exec: n, texto: r.texto.trim() });
    w(`\n${linha()}\n${caso.id} · execução ${n} · ${r.texto.trim().length} ch\n`);
    w(caixa(r.texto.trim()));
  }
}

// ── OS 8 JUÍZOS CEGOS ────────────────────────────────────────────────────
const SYS = `Você audita UMA resposta da Ayla — uma assistente que apoia mães de crianças neurodivergentes — contra um critério que lhe será dado por extenso.

Julgue SÓ esta resposta. Você não conhece nenhuma outra e não deve comparar.

⚠️ Leia o critério com cuidado: em alguns casos o PASS exige que a Ayla FALE do tema, e em outros exige que ela NÃO oriente por ele. Não presuma qual é.

Responda EXATAMENTE neste formato:

TRECHOS_RELEVANTES: <cite literalmente as passagens que decidem o caso, ou "nenhuma">
O_QUE_A_RESPOSTA_FAZ: <em uma frase, o que ela faz com o tema em questão>
REGISTRO: AFIRMA_COMO_FATO|ORIENTA_COMO_SE_FOSSE|LEVANTA_COMO_HIPOTESE|APENAS_OBSERVAR|NAO_TOCA_NO_TEMA
RECONHECE_MUDANCA: SIM|NAO|NAO_SE_APLICA — a resposta sinaliza que a informação nova difere do que se sabia antes?
VEREDITO: PASS|FAIL — <uma frase dizendo por que, referida ao critério>`;

const notas = [];
for (const r of R) {
  const j = await gerarConversacional({
    provider: "openai", model: MODELO, system: SYS,
    messages: [{ role: "user", content: `CRITÉRIO DESTE CASO:\n${r.caso.pergunta}\n\nO QUE A MÃE ESCREVEU:\n"${r.caso.pedido}"\n\nRESPOSTA DA AYLA:\n"""\n${r.texto}\n"""` }],
    maxTokens: 2000, cacheSystem: true,
  });
  const texto = j.texto.trim();
  if (!texto) throw new Error(`juízo vazio em ${r.caso.id} exec ${r.exec} — não concluir`);
  notas.push({ ...r, juizo: texto });
  w(`\n${linha()}\nJUÍZO · ${r.caso.id} · execução ${r.exec}\n`);
  w(caixa(texto));
}

// ── PLACAR ───────────────────────────────────────────────────────────────
const campo = (t, k) => (t.match(new RegExp(`^${k}:\\s*([^\\n]*)`, "m")) ?? [])[1]?.trim() ?? "?";
w(`\n${linha()}\nPLACAR — PORTÃO INTERNO A/B/C/D\n${linha()}\n`);
w("  caso".padEnd(38) + "ex  " + "registro".padEnd(24) + "veredito");
for (const n of notas) {
  w("  " + n.caso.id.padEnd(36) + String(n.exec).padEnd(4) +
    campo(n.juizo, "REGISTRO").split(" ")[0].padEnd(24) +
    campo(n.juizo, "VEREDITO").split(" ")[0]);
}
const porCaso = CASOS.map((c) => ({
  id: c.id,
  pass: notas.filter((n) => n.caso.id === c.id && campo(n.juizo, "VEREDITO").startsWith("PASS")).length,
}));
w("");
for (const c of porCaso) w(`  ${c.id.padEnd(38)} ${c.pass}/2`);
const falhou = porCaso.filter((c) => c.pass < 2);
w(`\n  PORTÃO: ${falhou.length === 0 ? "PASSOU — seguir para as 3 reproduções da PEND-034"
  : `PAROU — ${falhou.map((c) => c.id).join(", ")}`}`);
w(linha());

writeFileSync("docs/bancada/pend034-abcd-2026-08-11.txt", out.join("\n"), "utf8");
console.log("\npronto → docs/bancada/pend034-abcd-2026-08-11.txt");
process.exit(falhou.length ? 1 : 0);
