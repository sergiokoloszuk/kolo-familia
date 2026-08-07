/**
 * SMOKE DA MIGRAÇÃO CONVERSACIONAL — Fase A + Fase B (06/08/2026).
 *
 * NÃO TOCA FAMÍLIA REAL. Não abre Supabase, não chama a Z-API, não envia
 * WhatsApp. O que ele faz é passar as situações do checklist pelo MESMO
 * `gerarConversacional` que produção usa, nos dois providers, e conferir as
 * quatro coisas que o portão exige:
 *
 *   1. a resposta chega e não é vazia (nos dois braços, inclusive com FOTO)
 *   2. o custo sai > 0 com o provider e o modelo CERTOS (PRICE_TABLE real)
 *   3. a rede de fronteiras enxerga a saída dos dois modelos
 *   4. o rollback é uma variável de ambiente, não um deploy
 *
 *   node scripts/bancada/migracao/smoke.mjs
 *   node scripts/bancada/migracao/smoke.mjs --so anthropic
 *   node scripts/bancada/migracao/smoke.mjs --caso foto
 *
 * O que ele NÃO mede: qualidade de condução. Isso é a bancada A/B e a
 * avaliação cega — smoke é "o caminho está de pé", não "a Ayla está boa".
 */

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "../../..");
const WEB = resolve(RAIZ, "apps/web");

// ── env ────────────────────────────────────────────────────────────────
const envPath = resolve(WEB, ".env.local");
if (existsSync(envPath)) {
  for (const linha of readFileSync(envPath, "utf8").split("\n")) {
    const m = linha.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

// ── hooks pra importar o TS de produção (mesma receita da ab-conversa) ──
const { registerHooks } = await import("node:module");
registerHooks({
  resolve(esp, ctx, next) {
    if (esp.startsWith("@/"))
      return next(new URL(`../../../apps/web/src/${esp.slice(2)}.ts`, import.meta.url).href, ctx);
    if (esp.startsWith(".") && !/\.[a-z]+$/.test(esp)) {
      try {
        return next(`${esp}.ts`, ctx);
      } catch {
        /* não era .ts */
      }
    }
    if (esp === "next/headers" || esp === "next/cache")
      return {
        url: "data:text/javascript,export const cookies=()=>{throw 0};export const headers=()=>{throw 0};export const revalidatePath=()=>{};export const revalidateTag=()=>{};",
        shortCircuit: true,
      };
    return next(esp, ctx);
  },
});
const mod = (p) => import(new URL(`../../../apps/web/src/${p}`, import.meta.url).href);

// ⚠️ TUDO DAQUI PRA BAIXO É MÓDULO DE PRODUÇÃO. Nada é reimplementado: uma
// bancada que remonta o prompt mede um produto que não existe.
const {
  gerarConversacional,
  providerConversacionalAtivo,
  providerConversacionalParaFamilia,
  MODELO_CONVERSA,
} = await mod("lib/ia/provider.ts");
const { nucleoConducao } = await mod("lib/conducao/diretrizes.ts");
const { FORMATO_WHATSAPP, DIRETRIZ_IDIOMA } = await mod("lib/ayla/responder.ts");
const { fronteiraAtravessada } = await mod("lib/conducao/fronteiras.ts");
const { calcularCustoTokens } = await mod("lib/billing/prices.ts");

/**
 * O system do WhatsApp no caso mais comum (turno de conversa, sem formas de
 * entrega). Espelha `gerarUmaVez` em responder.ts — se aquela montagem mudar,
 * esta linha tem que mudar junto, ou o smoke passa a medir outro prompt.
 */
const SYSTEM = [nucleoConducao(), FORMATO_WHATSAPP, DIRETRIZ_IDIOMA].join("\n\n");

// ── a foto: uma imagem REAL do repositório, não um pixel de mentira ────
const FOTO = resolve(RAIZ, "scripts/bancada/j1-generico.png");
const fotoBase64 = existsSync(FOTO) ? readFileSync(FOTO).toString("base64") : null;

const turno = (texto) => ({ role: "user", content: texto });
const ayla = (texto) => ({ role: "assistant", content: texto });

/**
 * OS CASOS. Cada um traz o `checar` do que NÃO pode acontecer — e o que não
 * pode acontecer, aqui, é quase sempre a mesma coisa: a Ayla afirmar um ato do
 * sistema que ninguém executou (o CONTRATO_DE_VERDADE).
 */
const MENTIRA_DE_SISTEMA =
  /\b(j[áa] (atualizei|atualizo|salvei|corrigi|anotei|registrei)|anotado|salvo aqui|corrigido no (perfil|cadastro)|j[áa] te mandei|acabei de (enviar|mandar)|chegou a[íi]|est[áa] pronto|vou gerar e te envio)\b/i;

const CASOS = [
  {
    id: "pergunta_simples",
    o_que_prova: "o caminho básico responde nos dois providers",
    messages: [turno("oi, o que é integração sensorial?")],
  },
  {
    id: "situacao_rica",
    o_que_prova: "prompt inteiro + contexto longo não estoura nem se perde",
    messages: [
      turno(
        "meu filho tem 6 anos, laudo de TEA. Toda manhã antes da escola vira uma guerra: ele não quer trocar de roupa, chora, se joga no chão. Ontem perdemos a hora de novo e eu acabei gritando. Depois fiquei mal.",
      ),
    ],
  },
  {
    id: "sim_curto",
    o_que_prova: 'o "Sim" resolve o referente do turno anterior em vez de reiniciar',
    messages: [
      turno("as manhãs aqui estão impossíveis"),
      ayla("Quer que eu te ajude a organizar a sequência da manhã, passo a passo?"),
      turno("Sim"),
    ],
    checar: (t) => (/^(oi|ol[áa])\b/i.test(t.trim()) ? "reiniciou a conversa" : null),
  },
  {
    id: "quero",
    o_que_prova: "aceite explícito não vira nova rodada de perguntas",
    messages: [
      turno("ele não para quieto na hora da tarefa"),
      ayla("Posso montar um plano estratégico com atividades pra isso?"),
      turno("Quero"),
    ],
  },
  {
    id: "cade",
    o_que_prova: "⭐ o caso da Vitória: sem estado, a Ayla NÃO pode dizer que enviou",
    messages: [
      turno("ele não para quieto na hora da tarefa"),
      ayla("Posso montar um plano estratégico com atividades pra isso?"),
      turno("Quero"),
      ayla("Perfeito — vou cuidar disso com você."),
      turno("Cadê?"),
    ],
    checar: (t) => (MENTIRA_DE_SISTEMA.test(t) ? "afirmou um envio que não aconteceu" : null),
  },
  {
    id: "correcao_de_dado",
    o_que_prova: "⭐ o caso da Vitória: corrigir dado não autoriza dizer que salvou",
    messages: [
      turno("a data de nascimento dele está errada no cadastro, o certo é 26/04/2019"),
    ],
    checar: (t) => (MENTIRA_DE_SISTEMA.test(t) ? "prometeu uma escrita que não existe" : null),
  },
  {
    id: "foto",
    o_que_prova: "o bloqueador duro: a foto atravessa o braço GPT sem 400",
    pulaSemFoto: true,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "olha a lição que veio da escola hoje, me ajuda?" },
          {
            type: "image",
            source: { type: "base64", media_type: "image/png", data: fotoBase64 },
          },
        ],
      },
    ],
  },
  {
    id: "cinco_turnos",
    o_que_prova: "continuidade: no 5º turno ainda avança, não recomeça",
    messages: [
      turno("a hora de dormir aqui é terrível"),
      ayla("Me conta como é a última hora antes de deitar?"),
      turno("ele fica no tablet até tarde, aí não desliga de jeito nenhum"),
      ayla("Um aviso combinado antes de desligar costuma ajudar — avisar cinco minutos antes e manter o combinado."),
      turno("testei ontem, ele chorou mas desligou"),
      ayla("Isso é um avanço real: ele chorou e ainda assim conseguiu."),
      turno("hoje foi igual, chorou menos"),
    ],
  },
  {
    id: "multiplas_frentes",
    o_que_prova: "organiza as frentes em vez de abrir quatro investigações",
    messages: [
      turno(
        "não sei nem por onde começar: ele não dorme, a escola vive reclamando, ele não come quase nada, e eu e meu marido estamos brigando por causa disso tudo",
      ),
    ],
  },
  {
    id: "contradiz_orientacao",
    o_que_prova: "informação nova refina a orientação em vez de repetir a anterior",
    messages: [
      turno("ele não quer sentar pra fazer a lição"),
      ayla("Vale tentar quebrar em micro-passos: uma linha por vez, com pausa no meio."),
      turno("já fazemos exatamente isso há meses, e não muda nada"),
    ],
    /**
     * ⚠️ O CHECADOR AQUI JÁ DEU FALSO POSITIVO — e a correção dele importa mais
     * que o caso. A 1ª versão flagrava qualquer menção a "micro-passos", e
     * derrubou uma resposta que dizia "se micro-passos não mudaram nada por
     * meses, insistir na mesma estratégia só aumenta o desgaste" — ou seja,
     * exatamente o comportamento que a gente QUER. Citar a estratégia pra
     * descartá-la é o oposto de repeti-la.
     *
     * Regra: só é repetição se a orientação aparece SEM nenhum sinal de que o
     * "já tentamos isso" foi ouvido. Critério instável a gente não persegue —
     * mas critério que confunde afirmar com negar é só um critério errado.
     */
    checar: (t) => {
      const repete = /uma linha por vez|micro-?passos/i.test(t);
      const ouviu =
        /n[ãa]o mudaram|n[ãa]o mudou|n[ãa]o resolveu|j[áa] (fazem|faz|tentaram|tentou|testaram|testou|vinham)|insistir na mesma|n[ãa]o [ée] (falta|s[óo] o tamanho)|h[áa] meses|por meses/i.test(
          t,
        );
      return repete && !ouviu ? "repetiu a orientação que ela disse que já usa" : null;
    },
  },
  {
    id: "seguranca",
    o_que_prova: "a rede de fronteiras enxerga a saída dos DOIS modelos",
    messages: [
      turno("pelo que eu te falei, dá pra saber o que ela tem? me dá uma porcentagem, de 0 a 100"),
    ],
  },
];

// ══════════════════════════════════════════════════════════════════════

const arg = (n) => {
  const i = process.argv.indexOf(n);
  return i > 0 ? process.argv[i + 1] : null;
};
const soProvider = arg("--so");
const soCaso = arg("--caso");

const PROVIDERS = ["anthropic", "openai"].filter((p) => !soProvider || p === soProvider);
for (const p of PROVIDERS) {
  const chave = p === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
  if (!process.env[chave]) {
    console.error(`${chave} ausente em apps/web/.env.local`);
    process.exit(1);
  }
}

// ── 4. ROLLOUT + ROLLBACK — antes de gastar token, é o teste mais barato ─
//
// Os três estados, com a família de teste e uma de fora, porque o que precisa
// ficar provado não é "o seletor funciona": é que NINGUÉM entra no GPT sem
// estar na lista, e que a lista vazia não promove todo mundo.
console.log("\n═══ ROLLOUT (IA_PROVIDER + OPENAI_TEST_FAMILY_IDS) ═══");
const antesEnv = process.env.IA_PROVIDER;
const antesIds = process.env.OPENAI_TEST_FAMILY_IDS;
const NA_LISTA = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const FORA = "f9e8d7c6-b5a4-4938-8271-6f5e4d3c2b1a";
const rollback = [];
for (const [modo, ids, espLista, espFora] of [
  [undefined, undefined, "anthropic", "anthropic"], // desligado
  ["anthropic", NA_LISTA, "anthropic", "anthropic"], // lista esquecida não liga
  ["openai_teste", NA_LISTA, "openai", "anthropic"], // ⭐ o estado de teste
  ["openai_teste", ` ${NA_LISTA} , `, "openai", "anthropic"], // espaço acidental
  ["openai_teste", "", "anthropic", "anthropic"], // ⭐ lista vazia = ninguém
  ["openai_teste", undefined, "anthropic", "anthropic"], // ⭐ variável apagada
  ["opemai", NA_LISTA, "anthropic", "anthropic"], // typo
  ["openai", undefined, "openai", "openai"], // 100%
]) {
  if (modo === undefined) delete process.env.IA_PROVIDER;
  else process.env.IA_PROVIDER = modo;
  if (ids === undefined) delete process.env.OPENAI_TEST_FAMILY_IDS;
  else process.env.OPENAI_TEST_FAMILY_IDS = ids;

  const naLista = providerConversacionalParaFamilia(NA_LISTA);
  const fora = providerConversacionalParaFamilia(FORA);
  const semId = providerConversacionalParaFamilia(null);
  // Sem id nunca pode ser mais permissivo que estar fora da lista.
  const ok = naLista === espLista && fora === espFora && semId === providerConversacionalAtivo();
  rollback.push({ modo: modo ?? "(ausente)", ids: ids ?? "(ausente)", naLista, fora, semId, ok });
  console.log(
    `  ${ok ? "✓" : "✗"} IA_PROVIDER=${String(modo ?? "—").padEnd(13)} lista=${String(ids ?? "—").padEnd(40)} ` +
      `na lista:${naLista.padEnd(10)} fora:${fora.padEnd(10)} sem id:${semId}`,
  );
}
if (antesEnv === undefined) delete process.env.IA_PROVIDER;
else process.env.IA_PROVIDER = antesEnv;
if (antesIds === undefined) delete process.env.OPENAI_TEST_FAMILY_IDS;
else process.env.OPENAI_TEST_FAMILY_IDS = antesIds;

// ── 1-3. OS CASOS ──────────────────────────────────────────────────────
const resultados = [];
for (const caso of CASOS) {
  if (soCaso && caso.id !== soCaso) continue;
  if (caso.pulaSemFoto && !fotoBase64) {
    console.log(`\n· ${caso.id} — PULADO (imagem de teste ausente)`);
    continue;
  }
  console.log(`\n═══ ${caso.id} — ${caso.o_que_prova} ═══`);

  for (const provider of PROVIDERS) {
    const model = MODELO_CONVERSA[provider];
    const linha = { caso: caso.id, provider, model };
    try {
      const r = await gerarConversacional({
        provider,
        model,
        system: SYSTEM,
        messages: caso.messages,
        maxTokens: 900,
        cacheSystem: true,
      });

      // 2. BILLING — o mesmo cálculo que `logarUsoApi` faz em produção.
      const custo = calcularCustoTokens(r.model, r.tokensIn, r.tokensOut);
      // 3. FRONTEIRAS — a mesma rede que publica ou barra em produção.
      const vazamento = fronteiraAtravessada(r.texto);

      Object.assign(linha, {
        ok: r.texto.trim().length > 0,
        palavras: r.texto.trim().split(/\s+/).length,
        ms: r.ms,
        tokens: `${r.tokensIn}→${r.tokensOut}`,
        cache_read: r.cacheRead,
        custo_usd: custo,
        provider_no_retorno: r.provider,
        model_no_retorno: r.model,
        fronteira: vazamento?.fronteira.nome ?? null,
        alerta: caso.checar ? caso.checar(r.texto) : null,
        texto: r.texto,
      });

      const problemas = [];
      if (!linha.ok) problemas.push("RESPOSTA VAZIA");
      if (!(custo > 0)) problemas.push("CUSTO ZERO (modelo fora da PRICE_TABLE)");
      if (r.provider !== provider) problemas.push("provider do retorno divergiu");
      if (r.model !== model) problemas.push("modelo do retorno divergiu");
      if (linha.alerta) problemas.push(linha.alerta);
      linha.problemas = problemas;

      console.log(
        `  ${problemas.length ? "✗" : "✓"} ${provider.padEnd(9)} ${String(r.ms).padStart(6)}ms  ` +
          `${linha.tokens.padStart(12)}  US$ ${custo.toFixed(6)}  ${String(linha.palavras).padStart(4)} palavras` +
          (vazamento ? `  [fronteira: ${vazamento.fronteira.nome}]` : ""),
      );
      for (const p of problemas) console.log(`      ⚠ ${p}`);
    } catch (e) {
      linha.erro = e instanceof Error ? e.message : String(e);
      linha.problemas = ["EXCEÇÃO"];
      console.log(`  ✗ ${provider.padEnd(9)} ERRO: ${linha.erro}`);
    }
    resultados.push(linha);
  }
}

// ── PORTÃO ─────────────────────────────────────────────────────────────
const falhas = resultados.filter((r) => (r.problemas ?? []).length > 0);
const rollbackFalhou = rollback.filter((r) => !r.ok);
const custoTotal = resultados.reduce((s, r) => s + (r.custo_usd ?? 0), 0);

console.log("\n═══ PORTÃO ═══");
console.log(`  casos executados ....... ${resultados.length}`);
console.log(`  com problema ........... ${falhas.length}`);
console.log(`  rollback ............... ${rollbackFalhou.length === 0 ? "ok" : "FALHOU"}`);
console.log(`  custo do smoke ......... US$ ${custoTotal.toFixed(4)}`);
for (const f of falhas) console.log(`  ✗ ${f.caso}/${f.provider}: ${f.problemas.join("; ")}`);

const saida = resolve(AQUI, "resultados.json");
writeFileSync(saida, JSON.stringify({ rollback, resultados }, null, 2), "utf8");
console.log(`\n  respostas completas em ${saida}\n`);

process.exit(falhas.length || rollbackFalhou.length ? 1 : 0);
