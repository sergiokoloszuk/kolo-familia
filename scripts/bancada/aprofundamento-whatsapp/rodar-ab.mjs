/**
 * A/B da oferta de aprofundamento contextual.
 *
 * A = o chat atual entrega a primeira ajuda e encerra ali; para aprofundar, a
 *     familia precisaria descobrir e digitar sozinha o proximo pedido.
 * B = a mesma primeira ajuda oferece uma escolha quando pertinente; a familia
 *     toca e a Ayla continua a partir das referencias
 *     exatas do relato e da resposta que originaram a oferta.
 *
 * Familias sinteticas; provider real; Supabase apenas GET; sem WhatsApp e sem
 * persistencia externa. O script interrompe qualquer I/O fora desse desenho.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { registerHooks } from "node:module";
import { createClient } from "@supabase/supabase-js";

const raiz = process.cwd();
const web = resolve(raiz, "apps/web");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      return {
        url: pathToFileURL(resolve(web, "src", `${specifier.slice(2)}.ts`)).href,
        shortCircuit: true,
      };
    }
    if (["next/headers", "next/cache", "server-only"].includes(specifier)) {
      return {
        url: "data:text/javascript,export const cookies=()=>{throw Error('sem request')};export const headers=cookies;export const revalidatePath=()=>{};export const revalidateTag=()=>{};",
        shortCircuit: true,
      };
    }
    if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.includes("/apps/web/src/")) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const U = process.env.NEXT_PUBLIC_SUPABASE_URL;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!U || !K) throw new Error("Variaveis do Supabase ausentes");
const origin = new URL(U).origin;
const fetchReal = globalThis.fetch;
let chamadasModelo = 0;

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const method = (init.method ?? input?.method ?? "GET").toUpperCase();
  const leituraBanco = url.origin === origin && method === "GET";
  const modelo = method === "POST" && (
    (url.origin === "https://api.openai.com" && url.pathname === "/v1/chat/completions") ||
    (url.origin === "https://api.anthropic.com" && url.pathname === "/v1/messages")
  );
  if (!leituraBanco && !modelo) throw new Error(`I/O fora da bancada: ${method} ${url.origin}${url.pathname}`);
  if (modelo) chamadasModelo += 1;
  const resposta = await fetchReal(input, { ...init, signal: init.signal ?? AbortSignal.timeout(90_000) });
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status}: ${method} ${url.pathname}`);
  return resposta;
};

const mod = (p) => import(pathToFileURL(resolve(web, "src", p)).href);
const [
  { montarMundo },
  { responderExperimental },
  { decidirTurno },
  { carregarCatalogoSkills },
  { gerarConversacional, MODELO_CONVERSA },
  { decidirAprofundamento, gerarRespostaAprofundada, respostaPedeRetornoDaFamilia, APROFUNDAMENTOS },
] = await Promise.all([
  mod("lib/ayla/__harness/cenario.ts"),
  mod("lib/ayla/experimental.ts"),
  mod("lib/conducao/decisao-do-turno.ts"),
  mod("lib/ayla/catalogo-skills.ts"),
  mod("lib/ia/provider.ts"),
  mod("lib/ayla/aprofundamento.ts"),
]);

const remoto = createClient(U, K, { auth: { persistSession: false, autoRefreshToken: false } });
const catalogo = await carregarCatalogoSkills(remoto);
if (catalogo.estado !== "ok") throw new Error(`Catalogo indisponivel: ${catalogo.motivo}`);

const tabelasRemotas = new Set([
  "ayla_documentos",
  "boas_praticas",
  "output_types",
  "specialist_prompt_templates",
]);
const todosOsCasos = [
  {
    id: "compartilhar",
    mensagem: "O Leo nao empresta o carrinho de jeito nenhum.",
    ramo: "aprofundar_brincar",
  },
  {
    id: "socializacao",
    mensagem: "Meu filho nao consegue brincar com as outras criancas.",
    ramo: "aprofundar_brincar",
  },
  {
    id: "mercado",
    mensagem: "O Leo nao presta atencao em nada.",
    ramo: "aprofundar_lidar",
  },
  {
    id: "atividade",
    mensagem: "O Leo nao quer fazer nenhuma atividade.",
    ramo: "aprofundar_brincar",
  },
  {
    id: "tablet",
    mensagem: "Quando tiro o tablet, o Leo entra em crise.",
    ramo: "aprofundar_crencas",
  },
  {
    id: "desabafo",
    mensagem: "Estou exausta. Nada funciona.",
    ramo: null,
    pedidoA: null,
  },
  {
    id: "urgencia",
    mensagem: "O Leo bateu a cabeca forte, esta sonolento e vomitou.",
    ramo: null,
    pedidoA: null,
  },
];
const filtroCasos = new Set(
  (process.env.CASOS ?? "").split(",").map((v) => v.trim()).filter(Boolean),
);
const casos = filtroCasos.size
  ? todosOsCasos.filter((caso) => filtroCasos.has(caso.id))
  : todosOsCasos;

const arquivo = resolve(raiz, "docs/auditorias/aprofundamento-whatsapp-ab-2026-09-24.json");
const anterior = process.env.RESUME === "1" && existsSync(arquivo)
  ? JSON.parse(readFileSync(arquivo, "utf8"))
  : null;
const resultado = {
  data: new Date().toISOString(),
  ambiente: "familias sinteticas; provider real; Supabase somente leitura; sem WhatsApp; sem persistencia",
  criterio: "B so vence se o clique produzir orientacao significativamente mais contextual, pratica e natural; tamanho nao e premio",
  casos: (anterior?.casos ?? []).filter(
    (existente) => !casos.some((caso) => caso.id === existente.id),
  ),
};

const semearMensagem = (mundo, { id, direcao, texto, criadoEm }) => {
  mundo.db.semear("ayla_messages", [{
    id,
    family_account_id: mundo.familyId,
    membro_atipico_id: mundo.membros.Leo,
    direcao,
    texto,
    metadata: {},
    created_at: criadoEm,
  }]);
};

const gerarTurno = async (db, mundo, mensagem) => {
  const decisao = await decidirTurno({
    texto: mensagem,
    blocoEstado: "<estado>Leo tem 6 anos. Gosta muito de trens. Sons altos e lugares cheios incomodam. Entende melhor quando o adulto mostra junto. Quando sobrecarregado, puxa a mae pela mao e usa poucas palavras.</estado>",
    catalogoSkills: catalogo.skills,
    catalogoDisponivel: true,
  });
  const falhas = [];
  const resposta = await responderExperimental(db, {
    familyId: mundo.familyId,
    mensagem,
    origem: "simulador",
    turnosSimulados: [],
    turnoClassificado: decisao,
    onFalha: (motivo, detalhe) => falhas.push({ motivo, detalhe }),
  });
  if (!resposta) throw new Error(`Produtor nao concluiu: ${JSON.stringify(falhas)}`);
  return { resposta, decisao, falhas };
};

for (const caso of casos) {
  chamadasModelo = 0;
  const mundo = montarMundo({
    nomeMae: "Ana",
    criancas: [{
      nome: "Leo",
      nascimento: "2020-01-01",
      genero: "masculino",
      sabe: {
        essencial: "Interesses: trens. Comunica necessidades com poucas palavras ou puxando a mae pela mao.",
        sensorial: "Sons altos e lugares cheios incomodam.",
        como_e: "Entende melhor quando o adulto mostra junto.",
      },
    }],
  });
  const memoria = mundo.db.cliente();
  const db = {
    from(tabela) {
      return tabelasRemotas.has(tabela) ? remoto.from(tabela) : memoria.from(tabela);
    },
  };

  const sourceInboundId = `in-${caso.id}`;
  const sourceOutboundId = `out-${caso.id}`;
  semearMensagem(mundo, { id: sourceInboundId, direcao: "inbound", texto: caso.mensagem, criadoEm: "2026-09-24T12:00:00.000Z" });
  const inicial = await gerarTurno(db, mundo, caso.mensagem);
  semearMensagem(mundo, { id: sourceOutboundId, direcao: "outbound", texto: inicial.resposta.texto, criadoEm: "2026-09-24T12:01:00.000Z" });

  const decisaoOferta = decidirAprofundamento({
    ligado: true,
    candidatos: inicial.resposta.aprofundamentos ?? [],
    segurancaAberta: caso.id === "urgencia",
    naturezaEmocional: inicial.decisao.naturezaEmocional,
    naturezaDoTurno: inicial.resposta.metrica.natureza,
    fezPergunta: Boolean(
      inicial.resposta.decisaoLacuna?.acao === "PERGUNTAR" ||
      inicial.resposta.camposInvestigados?.length ||
      respostaPedeRetornoDaFamilia(inicial.resposta.texto),
    ),
    miniInvestigacao: Boolean(
      inicial.resposta.miniInvestigacao?.acao === "PERGUNTAR" ||
      inicial.resposta.camposInvestigados?.length,
    ),
    conviteConcorrente: false,
    ofertaRecente: false,
  });

  const registro = {
    id: caso.id,
    mensagem: caso.mensagem,
    primeiraResposta: inicial.resposta.texto,
    candidatos: inicial.resposta.aprofundamentos ?? [],
    decisaoOferta,
    esperado: caso.ramo ? "oferta somente se houver dois caminhos de valor" : "sem oferta obrigatoriamente",
    A: null,
    B: null,
    juizo: null,
    chamadasModelo: 0,
  };

  if (!caso.ramo) {
    if (decisaoOferta.acao !== "NAO_OFERECER") throw new Error(`${caso.id}: menu indevido`);
    registro.chamadasModelo = chamadasModelo;
    resultado.casos.push(registro);
    console.log(JSON.stringify({ id: caso.id, decisaoOferta }));
    continue;
  }
  registro.ramoSugeridoNestaAmostra =
    decisaoOferta.acao === "OFERECER" && decisaoOferta.opcoes.includes(caso.ramo);
  // O A/B editorial mede a qualidade do ramo em corpus fixo, sem depender da
  // variância da sugestão semântica. O portão continua registrado acima e é
  // testado separadamente; em produção jamais forçamos um ramo não sugerido.

  const contextual = await gerarRespostaAprofundada(db, {
    familyId: mundo.familyId,
    membroId: mundo.membros.Leo,
    sourceInboundId,
    sourceOutboundId,
    ramo: caso.ramo,
  });
  registro.A = {
    experiencia: "primeira ajuda; sem caminho de aprofundamento descobrivel",
    resposta: inicial.resposta.texto,
    esforcoParaContinuar: "a familia precisa formular e digitar um novo pedido",
  };
  registro.B = {
    escolha: APROFUNDAMENTOS[caso.ramo].label,
    resposta: contextual.texto,
    outputType: contextual.outputType,
    repertorio: contextual.repertorio,
  };

  const juizo = await gerarConversacional({
    provider: "openai",
    model: MODELO_CONVERSA.openai,
    system: `Voce audita duas experiencias da Ayla para uma familia de crianca neurodivergente. A termina depois da primeira ajuda; para continuar, a familia teria de descobrir e digitar um novo pedido. B preserva a mesma primeira ajuda e acrescenta um botao de aprofundamento; avalie apenas se a resposta APOS O CLIQUE entrega valor novo real. B so vence se o conjunto for significativamente mais util, especifico, personalizado e natural. Nao premie comprimento, teoria ou quantidade de itens. Reprove contradicao, conselho inseguro, repeticao da primeira resposta, personalizacao decorativa ou cara de relatorio. Avalie tambem esforco para continuar e se a resposta clicada e mais profunda. Responda exatamente com VENCEDOR: A|B|EMPATE; B_SIGNIFICATIVAMENTE_MELHOR: SIM|NAO; e uma justificativa curta por criterio.`,
    messages: [{
      role: "user",
      content: `PERFIL: Leo tem 6 anos; gosta de trens; sons altos e lugares cheios incomodam; entende melhor com demonstracao; sob sobrecarga usa poucas palavras ou puxa a mae.\n\nRELATO: ${caso.mensagem}\n\nA — PRIMEIRA AJUDA, DEPOIS A FAMILIA PRECISA INVENTAR O PROXIMO PEDIDO:\n${registro.A.resposta}\n\nB — A MESMA PRIMEIRA AJUDA + CLIQUE EM ${APROFUNDAMENTOS[caso.ramo].label}; RESPOSTA APOS O CLIQUE:\n${registro.B.resposta}`,
    }],
    maxTokens: 900,
    cacheSystem: true,
  });
  registro.juizo = juizo.texto.trim();
  registro.chamadasModelo = chamadasModelo;
  resultado.casos.push(registro);
  console.log(JSON.stringify({ id: caso.id, oferta: decisaoOferta, juizo: registro.juizo }));
}

if (process.env.SEMANTIC_PROOF === "1") {
  const id = "prova-semantica-tablet";
  const mensagem = "Quando tiro o tablet, o Leo entra em crise.";
  const mundo = montarMundo({
    nomeMae: "Ana",
    criancas: [{
      nome: "Leo",
      nascimento: "2020-01-01",
      genero: "masculino",
      sabe: {
        essencial: "Interesses: trens. Comunica necessidades com poucas palavras ou puxando a mae pela mao.",
        sensorial: "Sons altos e lugares cheios incomodam.",
        como_e: "Entende melhor quando o adulto mostra junto.",
      },
    }],
  });
  const memoria = mundo.db.cliente();
  const db = {
    from(tabela) {
      return tabelasRemotas.has(tabela) ? remoto.from(tabela) : memoria.from(tabela);
    },
  };
  const sourceInboundId = `in-${id}`;
  const sourceOutboundId = `out-${id}`;
  semearMensagem(mundo, { id: sourceInboundId, direcao: "inbound", texto: mensagem, criadoEm: "2026-09-24T14:00:00.000Z" });
  const inicial = await gerarTurno(db, mundo, mensagem);
  semearMensagem(mundo, { id: sourceOutboundId, direcao: "outbound", texto: inicial.resposta.texto, criadoEm: "2026-09-24T14:01:00.000Z" });

  const respostas = {};
  for (const ramo of ["aprofundar_lidar", "aprofundar_brincar", "aprofundar_crencas"]) {
    respostas[ramo] = await gerarRespostaAprofundada(db, {
      familyId: mundo.familyId,
      membroId: mundo.membros.Leo,
      sourceInboundId,
      sourceOutboundId,
      ramo,
    });
  }
  const juizo = await gerarConversacional({
    provider: "openai",
    model: MODELO_CONVERSA.openai,
    system: `Audite tres aprofundamentos da Ayla para o MESMO caso. Eles so passam se forem semanticamente diferentes: COMO LIDAR = manejo da situacao; BRINCAR/PASSEAR = habilidade vivida numa experiencia compartilhada concreta, executavel por uma mae cansada; CRENCAS+FALAS = possiveis interpretacoes da crianca e do adulto, novas formas de pensar/falar/agir, sem afirmar crenças como fato. Reprove se dois ramos entregarem praticamente a mesma orientacao com outra embalagem. Responda exatamente: VEREDITO: PASSOU|FALHOU; depois uma linha curta para cada ramo e uma conclusao sobre sobreposicao.`,
    messages: [{
      role: "user",
      content: `RELATO: ${mensagem}\nPRIMEIRA RESPOSTA: ${inicial.resposta.texto}\n\nCOMO LIDAR:\n${respostas.aprofundar_lidar.texto}\n\nBRINCAR/PASSEAR:\n${respostas.aprofundar_brincar.texto}\n\nCRENCAS+FALAS:\n${respostas.aprofundar_crencas.texto}`,
    }],
    maxTokens: 900,
    cacheSystem: true,
  });
  resultado.provaDistincaoSemantica = {
    caso: mensagem,
    primeiraResposta: inicial.resposta.texto,
    respostas: Object.fromEntries(Object.entries(respostas).map(([ramo, r]) => [ramo, {
      texto: r.texto,
      repertorio: r.repertorio,
    }])),
    juizo: juizo.texto.trim(),
  };
  console.log(JSON.stringify({ provaDistincaoSemantica: resultado.provaDistincaoSemantica.juizo }));
}

mkdirSync(dirname(arquivo), { recursive: true });
writeFileSync(arquivo, `${JSON.stringify(resultado, null, 2)}\n`);
console.log(`Resultado: ${arquivo}`);
